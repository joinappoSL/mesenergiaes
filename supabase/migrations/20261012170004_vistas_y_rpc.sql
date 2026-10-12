-- =============================================================================
-- MESENERGIA CRM · 04 · Vistas y funciones RPC
-- Las búsquedas van por RPC (POST) para no exponer DNI ni teléfonos en URLs.
-- =============================================================================

create or replace function public.f_unaccent(p_texto text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select extensions.unaccent('extensions.unaccent'::regdictionary, coalesce(p_texto, ''))
$$;

-- Escapa los comodines de LIKE en la entrada del usuario.
create or replace function public.like_escape(p_texto text)
returns text
language sql
immutable
set search_path = ''
as $$
  select replace(replace(replace(coalesce(p_texto, ''), '\', '\\'), '%', '\%'), '_', '\_')
$$;

-- -----------------------------------------------------------------------------
-- Vista de contratos con datos de presentación (respeta RLS: security_invoker)
-- -----------------------------------------------------------------------------
create or replace view public.v_contratos
with (security_invoker = true)
as
select
  c.*,
  public.nombre_perfil(c.comercial_id) as comercial_nombre,
  e.nombre as equipo_nombre,
  (select count(*) from public.documentos d where d.contrato_id = c.id)::int as num_documentos,
  (
    select string_agg(
      t.numero || ' · ' || case t.tipo when 'fijo' then 'Fijo' else 'Móvil' end
        || coalesce(' · ' || t.operador_donante, ''),
      ' | ' order by t.orden, t.created_at
    )
    from public.telefonos_portabilidad t
    where t.contrato_id = c.id
  ) as portabilidad_resumen
from public.contratos c
left join public.equipos e on e.id = c.equipo_id;

revoke all on public.v_contratos from anon;
grant select on public.v_contratos to authenticated;

-- -----------------------------------------------------------------------------
-- Búsqueda y filtros del listado (orden y paginación los aplica PostgREST)
-- -----------------------------------------------------------------------------
create or replace function public.buscar_contratos(
  p_q             text default null,
  p_estados       public.estado_contrato[] default null,
  p_firmado       boolean default null,
  p_comercial_id  uuid default null,
  p_equipo_id     uuid default null,
  p_desde         date default null,
  p_hasta         date default null
)
returns setof public.v_contratos
language plpgsql
stable
set search_path = ''
as $$
declare
  v_q        text := nullif(trim(coalesce(p_q, '')), '');
  v_texto    text;
  v_doc      text;
  v_digitos  text;
begin
  if v_q is not null then
    v_texto := '%' || public.like_escape(lower(public.f_unaccent(v_q))) || '%';
    v_doc := '%' || public.like_escape(upper(regexp_replace(v_q, '[\s.\-]', '', 'g'))) || '%';
    v_digitos := regexp_replace(v_q, '[^0-9]', '', 'g');
    if length(v_digitos) < 3 then
      v_digitos := null;
    else
      v_digitos := '%' || v_digitos || '%';
    end if;
  end if;

  return query
  select v.*
  from public.v_contratos v
  where (p_estados is null or cardinality(p_estados) = 0 or v.estado = any (p_estados))
    and (p_firmado is null or v.firmado = p_firmado)
    and (p_comercial_id is null or v.comercial_id = p_comercial_id)
    and (p_equipo_id is null or v.equipo_id = p_equipo_id)
    and (p_desde is null or (v.created_at at time zone 'Europe/Madrid')::date >= p_desde)
    and (p_hasta is null or (v.created_at at time zone 'Europe/Madrid')::date <= p_hasta)
    and (
      v_q is null
      or lower(public.f_unaccent(v.cliente_nombre || ' ' || v.cliente_apellidos)) like v_texto
      or lower(public.f_unaccent(v.cliente_apellidos || ' ' || v.cliente_nombre)) like v_texto
      or v.documento_numero like v_doc
      or (
        v_digitos is not null
        and (
          v.telefono_contacto like v_digitos
          or v.telefono_fijo like v_digitos
          or v.numero::text like v_digitos
          or exists (
            select 1 from public.telefonos_portabilidad t
            where t.contrato_id = v.id and t.numero like v_digitos
          )
        )
      )
    );
end;
$$;

-- -----------------------------------------------------------------------------
-- Cola de backoffice: primero recordatorios vencidos, luego por antigüedad,
-- y al final los que tienen un recordatorio a futuro.
-- -----------------------------------------------------------------------------
create or replace function public.cola_backoffice(p_solo_sin_firmar boolean default false)
returns setof public.v_contratos
language plpgsql
stable
set search_path = ''
as $$
begin
  if not public.es_gestor() then
    raise exception 'Solo backoffice o administración pueden ver la cola' using errcode = 'insufficient_privilege';
  end if;

  return query
  select v.*
  from public.v_contratos v
  where v.estado = 'pendiente'
    and (not coalesce(p_solo_sin_firmar, false) or not v.firmado)
  order by
    case
      when v.proxima_llamada_at is not null and v.proxima_llamada_at <= now() then 0
      when v.proxima_llamada_at is null then 1
      else 2
    end,
    v.proxima_llamada_at asc nulls last,
    v.created_at asc;
end;
$$;

-- -----------------------------------------------------------------------------
-- Aviso de duplicados (no bloquea). SECURITY DEFINER para avisar aunque el
-- contrato sea de otro comercial, pero solo devuelve estado y comercial;
-- el id solo se devuelve si el usuario puede abrir ese contrato.
-- -----------------------------------------------------------------------------
create or replace function public.comprobar_duplicados(
  p_documento   text default null,
  p_telefono    text default null,
  p_excluir_id  uuid default null
)
returns table (
  id                uuid,
  numero            bigint,
  coincidencia      text,
  estado            public.estado_contrato,
  firmado           boolean,
  comercial_nombre  text,
  created_at        timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_doc text := nullif(upper(regexp_replace(coalesce(p_documento, ''), '[\s.\-]', '', 'g')), '');
  v_tel text := public.normalizar_telefono(p_telefono);
begin
  if public.mi_rol() is null then
    raise exception 'No autorizado' using errcode = 'insufficient_privilege';
  end if;
  if v_doc is not null and length(v_doc) < 9 then
    v_doc := null;
  end if;
  if v_tel is not null and length(v_tel) <> 9 then
    v_tel := null;
  end if;
  if v_doc is null and v_tel is null then
    return;
  end if;

  return query
  select
    case when public.puede_ver_contrato(c.id) then c.id end,
    c.numero,
    case
      when v_doc is not null and c.documento_numero = v_doc then 'DNI/NIE'
      else 'Teléfono'
    end,
    c.estado,
    c.firmado,
    coalesce(public.nombre_perfil(c.comercial_id), 'Sin comercial'),
    c.created_at
  from public.contratos c
  where (p_excluir_id is null or c.id <> p_excluir_id)
    and (
      (v_doc is not null and c.documento_numero = v_doc)
      or (
        v_tel is not null
        and (
          c.telefono_contacto = v_tel
          or c.telefono_fijo = v_tel
          or exists (select 1 from public.telefonos_portabilidad t where t.contrato_id = c.id and t.numero = v_tel)
        )
      )
    )
  order by c.created_at desc
  limit 10;
end;
$$;

-- -----------------------------------------------------------------------------
-- Alta / edición de un contrato con sus teléfonos a portabilidad en una sola
-- transacción. SECURITY INVOKER: se aplican las políticas RLS del usuario.
-- -----------------------------------------------------------------------------
create or replace function public.guardar_contrato(
  p_id           uuid,
  p_datos        jsonb,
  p_telefonos    jsonb default '[]'::jsonb,
  p_observacion  text default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  r     public.contratos;
  v_id  uuid;
begin
  r := jsonb_populate_record(null::public.contratos, p_datos);

  if p_id is null then
    insert into public.contratos (
      cliente_nombre, cliente_apellidos, documento_tipo, documento_numero, cliente_email,
      via_tipo, via_nombre, via_numero, escalera, piso, puerta, codigo_postal, poblacion, provincia,
      telefono_fijo, telefono_contacto,
      operadora, producto, precio_mensual, oferta_detalle,
      instalacion_fecha, instalacion_franja,
      comercial_id
    ) values (
      r.cliente_nombre, r.cliente_apellidos, coalesce(r.documento_tipo, 'DNI'), r.documento_numero, r.cliente_email,
      r.via_tipo, r.via_nombre, r.via_numero, r.escalera, r.piso, r.puerta, r.codigo_postal, r.poblacion, r.provincia,
      r.telefono_fijo, r.telefono_contacto,
      r.operadora, r.producto, r.precio_mensual, r.oferta_detalle,
      r.instalacion_fecha, r.instalacion_franja,
      r.comercial_id
    )
    returning id into v_id;
  else
    update public.contratos c set
      cliente_nombre     = r.cliente_nombre,
      cliente_apellidos  = r.cliente_apellidos,
      documento_tipo     = coalesce(r.documento_tipo, c.documento_tipo),
      documento_numero   = r.documento_numero,
      cliente_email      = r.cliente_email,
      via_tipo           = r.via_tipo,
      via_nombre         = r.via_nombre,
      via_numero         = r.via_numero,
      escalera           = r.escalera,
      piso               = r.piso,
      puerta             = r.puerta,
      codigo_postal      = r.codigo_postal,
      poblacion          = r.poblacion,
      provincia          = r.provincia,
      telefono_fijo      = r.telefono_fijo,
      telefono_contacto  = r.telefono_contacto,
      operadora          = r.operadora,
      producto           = r.producto,
      precio_mensual     = r.precio_mensual,
      oferta_detalle     = r.oferta_detalle,
      instalacion_fecha  = r.instalacion_fecha,
      instalacion_franja = r.instalacion_franja
    where c.id = p_id
    returning c.id into v_id;

    if v_id is null then
      raise exception 'No puedes editar este contrato: solo se puede modificar mientras esté Pendiente y sin firmar'
        using errcode = 'insufficient_privilege';
    end if;

    delete from public.telefonos_portabilidad t where t.contrato_id = v_id;
  end if;

  insert into public.telefonos_portabilidad (contrato_id, numero, tipo, operador_donante, orden)
  select
    v_id,
    e.elem ->> 'numero',
    coalesce(nullif(e.elem ->> 'tipo', ''), 'movil')::public.tipo_telefono,
    e.elem ->> 'operador_donante',
    e.ord::int
  from jsonb_array_elements(coalesce(p_telefonos, '[]'::jsonb)) with ordinality as e(elem, ord)
  where nullif(trim(coalesce(e.elem ->> 'numero', '')), '') is not null;

  if p_id is null and nullif(trim(coalesce(p_observacion, '')), '') is not null then
    insert into public.observaciones (contrato_id, autor_id, texto)
    values (v_id, auth.uid(), p_observacion);
  end if;

  return v_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Dashboard: KPIs, serie diaria, ranking y citas de instalación.
-- SECURITY INVOKER: cada rol solo agrega lo que puede ver.
-- -----------------------------------------------------------------------------
create or replace function public.dashboard(
  p_desde         date default null,
  p_hasta         date default null,
  p_equipo_id     uuid default null,
  p_comercial_id  uuid default null
)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_hoy    date := (now() at time zone 'Europe/Madrid')::date;
  v_desde  date := coalesce(p_desde, v_hoy - 29);
  v_hasta  date := coalesce(p_hasta, v_hoy);
  v_res    jsonb;
begin
  if public.mi_rol() is null then
    raise exception 'No autorizado' using errcode = 'insufficient_privilege';
  end if;
  if v_hasta < v_desde then
    raise exception 'La fecha "hasta" no puede ser anterior a "desde"';
  end if;
  if v_hasta - v_desde > 731 then
    v_desde := v_hasta - 731;
  end if;

  with base as (
    select c.*
    from public.contratos c
    where (p_equipo_id is null or c.equipo_id = p_equipo_id)
      and (p_comercial_id is null or c.comercial_id = p_comercial_id)
  ),
  rango as (
    select b.*, (b.created_at at time zone 'Europe/Madrid')::date as dia
    from base b
    where (b.created_at at time zone 'Europe/Madrid')::date between v_desde and v_hasta
  )
  select jsonb_build_object(
    'desde', v_desde,
    'hasta', v_hasta,
    'kpis', (
      select jsonb_build_object(
        'total',                 count(*),
        'pendiente',             count(*) filter (where r.estado = 'pendiente'),
        'activo',                count(*) filter (where r.estado = 'activo'),
        'riesgos',               count(*) filter (where r.estado = 'riesgos'),
        'cancelado',             count(*) filter (where r.estado = 'cancelado'),
        'firmados',              count(*) filter (where r.firmado),
        'pendientes_sin_firmar', count(*) filter (where r.estado = 'pendiente' and not r.firmado),
        'facturacion_activa',    coalesce(sum(r.precio_mensual) filter (where r.estado = 'activo'), 0)
      )
      from rango r
    ),
    'por_dia', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'fecha',     d.dia,
        'total',     coalesce(x.total, 0),
        'pendiente', coalesce(x.pendiente, 0),
        'activo',    coalesce(x.activo, 0),
        'riesgos',   coalesce(x.riesgos, 0),
        'cancelado', coalesce(x.cancelado, 0)
      ) order by d.dia), '[]'::jsonb)
      from (select gs::date as dia from generate_series(v_desde, v_hasta, interval '1 day') gs) d
      left join (
        select
          r.dia,
          count(*) as total,
          count(*) filter (where r.estado = 'pendiente') as pendiente,
          count(*) filter (where r.estado = 'activo') as activo,
          count(*) filter (where r.estado = 'riesgos') as riesgos,
          count(*) filter (where r.estado = 'cancelado') as cancelado
        from rango r
        group by r.dia
      ) x on x.dia = d.dia
    ),
    'ranking', (
      select coalesce(jsonb_agg(to_jsonb(k) order by k.activos desc, k.subidos desc, k.nombre), '[]'::jsonb)
      from (
        select
          r.comercial_id,
          coalesce(public.nombre_perfil(r.comercial_id), 'Sin comercial') as nombre,
          (select e.nombre from public.equipos e join public.profiles p on p.equipo_id = e.id where p.id = r.comercial_id) as equipo,
          count(*) as subidos,
          count(*) filter (where r.estado = 'activo') as activos,
          count(*) filter (where r.estado = 'pendiente') as pendientes,
          count(*) filter (where r.estado in ('riesgos', 'cancelado')) as perdidos,
          round(100.0 * count(*) filter (where r.estado = 'activo') / nullif(count(*), 0), 1) as ratio
        from rango r
        group by r.comercial_id
      ) k
    ),
    'citas', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id',        b.id,
        'numero',    b.numero,
        'cliente',   b.cliente_nombre || ' ' || b.cliente_apellidos,
        'poblacion', b.poblacion,
        'fecha',     b.instalacion_fecha,
        'franja',    b.instalacion_franja,
        'estado',    b.estado,
        'firmado',   b.firmado,
        'comercial', public.nombre_perfil(b.comercial_id)
      ) order by b.instalacion_fecha, b.instalacion_franja nulls last, b.numero), '[]'::jsonb)
      from base b
      where b.instalacion_fecha between v_hoy and v_hoy + 7
        and b.estado <> 'cancelado'
    )
  )
  into v_res;

  return v_res;
end;
$$;

-- -----------------------------------------------------------------------------
-- Permisos de ejecución: nada para anon, todo lo público para authenticated
-- -----------------------------------------------------------------------------
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;
revoke execute on function public.tg_handle_new_user() from authenticated;
