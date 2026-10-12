-- =============================================================================
-- MESENERGIA CRM · 02 · Funciones auxiliares y triggers
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Funciones auxiliares de permisos (SECURITY DEFINER para no recursar en RLS)
-- Devuelven NULL / false si el usuario está desactivado.
-- -----------------------------------------------------------------------------
create or replace function public.mi_rol()
returns public.rol_usuario
language sql
stable
security definer
set search_path = ''
as $$
  select p.rol from public.profiles p where p.id = auth.uid() and p.activo
$$;

create or replace function public.mi_equipo()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.equipo_id from public.profiles p where p.id = auth.uid() and p.activo
$$;

-- Admin o backoffice: ven y gestionan todos los contratos.
create or replace function public.es_gestor()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.mi_rol() in ('admin', 'backoffice'), false)
$$;

create or replace function public.puede_ver_contrato(p_contrato_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.contratos c
    join public.profiles me on me.id = auth.uid() and me.activo
    where c.id = p_contrato_id
      and (
        me.rol in ('admin', 'backoffice')
        or (me.rol = 'jefe_equipo' and me.equipo_id is not null and c.equipo_id = me.equipo_id)
        or c.comercial_id = me.id
      )
  )
$$;

-- Admin/backoffice siempre; el comercial solo los suyos mientras estén en Pendiente y sin firmar.
create or replace function public.puede_editar_contrato(p_contrato_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.contratos c
    join public.profiles me on me.id = auth.uid() and me.activo
    where c.id = p_contrato_id
      and (
        me.rol in ('admin', 'backoffice')
        or (me.rol = 'comercial' and c.comercial_id = me.id and c.estado = 'pendiente' and not c.firmado)
      )
  )
$$;

-- Nombre visible de un usuario (solo para usuarios activos de la app).
create or replace function public.nombre_perfil(p_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select nullif(trim(p.nombre || ' ' || p.apellidos), '')
  from public.profiles p
  where p.id = p_id
    and public.mi_rol() is not null
$$;

create or replace function public.uuid_o_null(p_texto text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
begin
  return p_texto::uuid;
exception when others then
  return null;
end;
$$;

-- -----------------------------------------------------------------------------
-- updated_at genérico
-- -----------------------------------------------------------------------------
create or replace function public.tg_set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.tg_set_updated_at();

-- -----------------------------------------------------------------------------
-- Alta de perfil al crear un usuario en auth.users
-- El rol solo se toma de app_metadata (solo la service_role puede escribirlo).
-- Un usuario que no venga de la Edge Function nace desactivado.
-- -----------------------------------------------------------------------------
create or replace function public.tg_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_creado_por_app boolean := coalesce(new.raw_app_meta_data ? 'rol', false);
begin
  insert into public.profiles (id, email, nombre, apellidos, telefono, rol, equipo_id, activo, debe_cambiar_password)
  values (
    new.id,
    lower(coalesce(new.email, '')),
    coalesce(new.raw_user_meta_data ->> 'nombre', ''),
    coalesce(new.raw_user_meta_data ->> 'apellidos', ''),
    new.raw_user_meta_data ->> 'telefono',
    case when v_creado_por_app then (new.raw_app_meta_data ->> 'rol')::public.rol_usuario else 'comercial' end,
    case when v_creado_por_app then public.uuid_o_null(new.raw_app_meta_data ->> 'equipo_id') end,
    v_creado_por_app,
    coalesce((new.raw_app_meta_data ->> 'debe_cambiar_password')::boolean, v_creado_por_app)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.tg_handle_new_user();

-- El propio usuario marca que ya ha cambiado la contraseña temporal.
create or replace function public.marcar_password_cambiada()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.profiles set debe_cambiar_password = false where id = auth.uid();
$$;

-- -----------------------------------------------------------------------------
-- Equipos: el jefe asignado pertenece al equipo y solo dirige uno
-- -----------------------------------------------------------------------------
create or replace function public.tg_equipos_before()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.nombre := trim(new.nombre);
  if new.jefe_id is not null and (tg_op = 'INSERT' or new.jefe_id is distinct from old.jefe_id) then
    if not exists (select 1 from public.profiles p where p.id = new.jefe_id and p.rol = 'jefe_equipo') then
      raise exception 'El usuario asignado como jefe debe tener el rol "Jefe de equipo"'
        using errcode = 'check_violation';
    end if;
    -- Si ya dirigía otro equipo, lo deja.
    update public.equipos set jefe_id = null where jefe_id = new.jefe_id and id <> new.id;
  end if;
  return new;
end;
$$;

create trigger equipos_before
  before insert or update on public.equipos
  for each row execute function public.tg_equipos_before();

create or replace function public.tg_equipos_after()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and old.jefe_id is not null and old.jefe_id is distinct from new.jefe_id then
    update public.profiles set equipo_id = null where id = old.jefe_id and equipo_id = new.id;
  end if;
  if new.jefe_id is not null then
    update public.profiles set equipo_id = new.id where id = new.jefe_id and equipo_id is distinct from new.id;
  end if;
  return null;
end;
$$;

create trigger equipos_after
  after insert or update of jefe_id on public.equipos
  for each row execute function public.tg_equipos_after();

-- -----------------------------------------------------------------------------
-- Contratos: normalización, reglas de negocio y campos derivados
-- -----------------------------------------------------------------------------
create or replace function public.tg_contratos_normalizar()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_rol public.rol_usuario := public.mi_rol();
  v_gestor boolean := v_rol in ('admin', 'backoffice');
begin
  -- Limpieza de datos
  new.cliente_nombre    := trim(new.cliente_nombre);
  new.cliente_apellidos := trim(new.cliente_apellidos);
  new.documento_numero  := upper(regexp_replace(coalesce(new.documento_numero, ''), '[\s.\-]', '', 'g'));
  new.cliente_email     := nullif(lower(trim(coalesce(new.cliente_email, ''))), '');
  new.via_tipo          := coalesce(nullif(trim(new.via_tipo), ''), 'Calle');
  new.via_nombre        := trim(new.via_nombre);
  new.via_numero        := trim(new.via_numero);
  new.escalera          := nullif(trim(coalesce(new.escalera, '')), '');
  new.piso              := nullif(trim(coalesce(new.piso, '')), '');
  new.puerta            := nullif(trim(coalesce(new.puerta, '')), '');
  new.codigo_postal     := regexp_replace(coalesce(new.codigo_postal, ''), '\s', '', 'g');
  new.poblacion         := trim(new.poblacion);
  new.provincia         := trim(new.provincia);
  new.telefono_fijo     := public.normalizar_telefono(new.telefono_fijo);
  new.telefono_contacto := public.normalizar_telefono(new.telefono_contacto);
  new.operadora         := coalesce(nullif(trim(new.operadora), ''), 'Avatel');
  new.producto          := nullif(trim(coalesce(new.producto, '')), '');
  new.oferta_detalle    := nullif(trim(coalesce(new.oferta_detalle, '')), '');
  new.instalacion_franja := nullif(trim(coalesce(new.instalacion_franja, '')), '');
  new.motivo_estado     := nullif(trim(coalesce(new.motivo_estado, '')), '');

  if tg_op = 'INSERT' then
    if v_uid is not null then
      -- Altas desde la app: siempre entran en Pendiente, la fecha la pone el servidor.
      new.created_by := v_uid;
      new.created_at := now();
      new.ultima_llamada_at := null;
      new.ultimo_resultado_llamada := null;
      new.proxima_llamada_at := null;
      if not v_gestor then
        new.comercial_id := v_uid;
        new.estado := 'pendiente';
        new.motivo_estado := null;
        new.firmado := false;
        new.fecha_firma := null;
      end if;
      new.comercial_id := coalesce(new.comercial_id, v_uid);
    end if;
    new.equipo_id := (select p.equipo_id from public.profiles p where p.id = new.comercial_id);
    new.updated_at := coalesce(new.updated_at, now());
    if v_uid is not null then
      new.updated_at := now();
    end if;
  else
    new.created_at := old.created_at;
    new.created_by := old.created_by;

    if v_uid is not null and not v_gestor then
      if new.estado is distinct from old.estado
         or new.motivo_estado is distinct from old.motivo_estado
         or new.firmado is distinct from old.firmado
         or new.fecha_firma is distinct from old.fecha_firma
         or new.comercial_id is distinct from old.comercial_id
         or new.ultima_llamada_at is distinct from old.ultima_llamada_at
         or new.ultimo_resultado_llamada is distinct from old.ultimo_resultado_llamada
         or new.proxima_llamada_at is distinct from old.proxima_llamada_at then
        raise exception 'Solo backoffice o administración pueden cambiar estado, firma, comercial o llamadas'
          using errcode = 'insufficient_privilege';
      end if;
    end if;

    -- El equipo se deriva del comercial asignado.
    if new.comercial_id is distinct from old.comercial_id then
      new.equipo_id := (select p.equipo_id from public.profiles p where p.id = new.comercial_id);
    else
      new.equipo_id := old.equipo_id;
    end if;

    -- Al volver a Pendiente/Activo sin indicar motivo nuevo, se limpia el motivo anterior.
    if new.estado is distinct from old.estado
       and new.estado in ('pendiente', 'activo')
       and new.motivo_estado is not distinct from old.motivo_estado then
      new.motivo_estado := null;
    end if;

    -- Un contrato que sale de Pendiente ya no está en la cola de llamadas.
    if new.estado <> 'pendiente' then
      new.proxima_llamada_at := null;
    end if;

    new.updated_at := now();
  end if;

  -- Firma
  if new.firmado then
    new.fecha_firma := coalesce(new.fecha_firma, now());
  else
    new.fecha_firma := null;
  end if;

  return new;
end;
$$;

create trigger contratos_normalizar
  before insert or update on public.contratos
  for each row execute function public.tg_contratos_normalizar();

-- Historial de estados y eventos de sistema en el hilo de observaciones.
create or replace function public.tg_contratos_auditoria()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_nombre text := (select nullif(trim(p.nombre || ' ' || p.apellidos), '') from public.profiles p where p.id = auth.uid());
begin
  if tg_op = 'INSERT' then
    insert into public.historial_estados (contrato_id, estado_anterior, estado_nuevo, motivo, usuario_id, usuario_nombre, created_at)
    values (new.id, null, new.estado, new.motivo_estado, coalesce(v_uid, new.created_by),
            coalesce(v_nombre, (select nullif(trim(p.nombre || ' ' || p.apellidos), '') from public.profiles p where p.id = new.created_by)),
            new.created_at);
    return null;
  end if;

  if new.estado is distinct from old.estado then
    insert into public.historial_estados (contrato_id, estado_anterior, estado_nuevo, motivo, usuario_id, usuario_nombre)
    values (new.id, old.estado, new.estado, new.motivo_estado, v_uid, v_nombre);
  end if;

  if v_uid is not null and new.firmado is distinct from old.firmado then
    insert into public.observaciones (contrato_id, autor_id, texto, sistema)
    values (new.id, v_uid,
            case when new.firmado then 'Ha marcado el contrato como FIRMADO.' else 'Ha quitado la marca de firmado.' end,
            true);
  end if;

  if v_uid is not null and new.comercial_id is distinct from old.comercial_id then
    insert into public.observaciones (contrato_id, autor_id, texto, sistema)
    values (new.id, v_uid,
            'Ha reasignado el contrato de ' || coalesce(public.nombre_perfil(old.comercial_id), 'sin comercial')
              || ' a ' || coalesce(public.nombre_perfil(new.comercial_id), 'sin comercial') || '.',
            true);
  end if;

  return null;
end;
$$;

create trigger contratos_auditoria
  after insert or update on public.contratos
  for each row execute function public.tg_contratos_auditoria();

-- -----------------------------------------------------------------------------
-- Teléfonos a portabilidad: normalización
-- -----------------------------------------------------------------------------
create or replace function public.tg_telefonos_portabilidad_normalizar()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.numero := public.normalizar_telefono(new.numero);
  new.operador_donante := nullif(trim(coalesce(new.operador_donante, '')), '');
  return new;
end;
$$;

create trigger telefonos_portabilidad_normalizar
  before insert or update on public.telefonos_portabilidad
  for each row execute function public.tg_telefonos_portabilidad_normalizar();

-- -----------------------------------------------------------------------------
-- Autoría: nombre y rol se guardan en el momento (los registros son históricos)
-- -----------------------------------------------------------------------------
create or replace function public.tg_observaciones_autor()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.autor_id := coalesce(auth.uid(), new.autor_id);
  new.texto := trim(new.texto);
  select nullif(trim(p.nombre || ' ' || p.apellidos), ''), p.rol
    into new.autor_nombre, new.autor_rol
    from public.profiles p where p.id = new.autor_id;
  if auth.uid() is not null then
    new.created_at := now();
  end if;
  return new;
end;
$$;

create trigger observaciones_autor
  before insert on public.observaciones
  for each row execute function public.tg_observaciones_autor();

create or replace function public.tg_llamadas_autor()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.usuario_id := coalesce(auth.uid(), new.usuario_id);
  new.nota := nullif(trim(coalesce(new.nota, '')), '');
  new.usuario_nombre := (select nullif(trim(p.nombre || ' ' || p.apellidos), '') from public.profiles p where p.id = new.usuario_id);
  if new.resultado <> 'volver_a_llamar' then
    new.volver_a_llamar_at := null;
  end if;
  if auth.uid() is not null then
    new.created_at := now();
  end if;
  return new;
end;
$$;

create trigger llamadas_autor
  before insert on public.llamadas
  for each row execute function public.tg_llamadas_autor();

-- Cada llamada actualiza la cola del contrato; "Firmado" marca la firma.
create or replace function public.tg_llamadas_actualizar_contrato()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.contratos c
     set ultima_llamada_at = new.created_at,
         ultimo_resultado_llamada = new.resultado,
         proxima_llamada_at = case
           when new.resultado = 'volver_a_llamar' and c.estado = 'pendiente' then new.volver_a_llamar_at
           else null
         end,
         firmado = c.firmado or new.resultado = 'firmado'
   where c.id = new.contrato_id;
  return null;
end;
$$;

create trigger llamadas_actualizar_contrato
  after insert on public.llamadas
  for each row execute function public.tg_llamadas_actualizar_contrato();

create or replace function public.tg_documentos_autor()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.subido_por := coalesce(auth.uid(), new.subido_por);
  new.subido_por_nombre := (select nullif(trim(p.nombre || ' ' || p.apellidos), '') from public.profiles p where p.id = new.subido_por);
  -- Bloquea versiones concurrentes del mismo contrato.
  perform pg_advisory_xact_lock(hashtextextended(new.contrato_id::text, 0));
  new.version := coalesce((select max(d.version) from public.documentos d where d.contrato_id = new.contrato_id), 0) + 1;
  if auth.uid() is not null then
    new.created_at := now();
  end if;
  return new;
end;
$$;

create trigger documentos_autor
  before insert on public.documentos
  for each row execute function public.tg_documentos_autor();
