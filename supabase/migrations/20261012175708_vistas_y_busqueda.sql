-- =============================================================================
-- MESENERGIA CRM · 04 · Vista de contratos, búsqueda, cola y duplicados
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
