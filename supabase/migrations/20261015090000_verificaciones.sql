-- =============================================================================
-- MESENERGIA CRM · 13 · Calendario de verificaciones (backoffice)
--
-- · verificacion_hecha_at / verificacion_hecha_por: cuándo y quién hizo la
--   llamada de verificación. Solo backoffice o administración pueden marcarla;
--   la hora y la persona las pone el servidor.
-- · Si se cambia la hora de la verificación (reprogramar), vuelve a quedar
--   pendiente.
-- · Cada cambio deja una nota de sistema en las observaciones del contrato.
-- =============================================================================

-- verificacion_hecha_por va sin clave foránea: si algún día se borra ese
-- usuario, el nombre simplemente sale vacío (nombre_perfil devuelve null).
alter table public.contratos
  add column verificacion_hecha_at  timestamptz,
  add column verificacion_hecha_por uuid;

create index contratos_verificacion_at_idx
  on public.contratos (verificacion_at)
  where verificacion_at is not null;

-- -----------------------------------------------------------------------------
-- Antes de guardar: quién puede marcarla y limpieza al reprogramar
-- -----------------------------------------------------------------------------
create or replace function public.tg_contratos_verificacion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if tg_op = 'INSERT' then
    -- Un contrato nuevo nunca entra con la verificación hecha.
    if v_uid is not null then
      new.verificacion_hecha_at := null;
      new.verificacion_hecha_por := null;
    end if;
    return new;
  end if;

  if new.verificacion_hecha_at is distinct from old.verificacion_hecha_at then
    if v_uid is not null and not public.es_gestor() then
      raise exception 'Solo backoffice o administración pueden marcar la verificación'
        using errcode = 'insufficient_privilege';
    end if;
    if new.verificacion_hecha_at is null then
      new.verificacion_hecha_por := null;
    elsif v_uid is not null then
      new.verificacion_hecha_at := now();
      new.verificacion_hecha_por := v_uid;
    end if;
  elsif new.verificacion_at is distinct from old.verificacion_at then
    -- Reprogramada: vuelve a estar pendiente.
    new.verificacion_hecha_at := null;
    new.verificacion_hecha_por := null;
  else
    new.verificacion_hecha_por := old.verificacion_hecha_por;
  end if;

  return new;
end;
$$;

create trigger contratos_verificacion
  before insert or update on public.contratos
  for each row execute function public.tg_contratos_verificacion();

-- -----------------------------------------------------------------------------
-- Después de guardar: nota de sistema en el hilo de observaciones
-- -----------------------------------------------------------------------------
create or replace function public.tg_contratos_verificacion_auditoria()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_texto text;
begin
  if v_uid is null then
    return null;
  end if;

  if new.verificacion_hecha_at is not null and old.verificacion_hecha_at is null then
    v_texto := 'Ha hecho la llamada de VERIFICACIÓN.';
  elsif new.verificacion_at is distinct from old.verificacion_at then
    v_texto := case
      when new.verificacion_at is null then 'Ha quitado la verificación programada.'
      when old.verificacion_at is null then 'Ha programado la verificación para el '
        || to_char(new.verificacion_at at time zone 'Europe/Madrid', 'DD/MM/YYYY "a las" HH24:MI') || '.'
      else 'Ha reprogramado la verificación al '
        || to_char(new.verificacion_at at time zone 'Europe/Madrid', 'DD/MM/YYYY "a las" HH24:MI') || '.'
    end;
  elsif new.verificacion_hecha_at is null and old.verificacion_hecha_at is not null then
    v_texto := 'Ha marcado la verificación como pendiente otra vez.';
  end if;

  if v_texto is not null then
    insert into public.observaciones (contrato_id, autor_id, texto, sistema)
    values (new.id, v_uid, v_texto, true);
  end if;
  return null;
end;
$$;

create trigger contratos_verificacion_auditoria
  after update of verificacion_at, verificacion_hecha_at on public.contratos
  for each row execute function public.tg_contratos_verificacion_auditoria();

revoke execute on function public.tg_contratos_verificacion() from public, anon, authenticated;
revoke execute on function public.tg_contratos_verificacion_auditoria() from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- La vista añade las columnas nuevas al final
-- -----------------------------------------------------------------------------
create or replace view public.v_contratos
with (security_invoker = true)
as
select
  c.id, c.numero, c.cliente_nombre, c.cliente_apellidos, c.documento_tipo, c.documento_numero, c.cliente_email,
  c.via_tipo, c.via_nombre, c.via_numero, c.escalera, c.piso, c.puerta, c.codigo_postal, c.poblacion, c.provincia,
  c.telefono_fijo, c.telefono_contacto, c.operadora, c.producto, c.precio_mensual, c.oferta_detalle,
  c.instalacion_fecha, c.instalacion_franja, c.comercial_id, c.equipo_id, c.estado, c.motivo_estado, c.firmado,
  c.fecha_firma, c.ultima_llamada_at, c.ultimo_resultado_llamada, c.proxima_llamada_at, c.created_by,
  c.created_at, c.updated_at,
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
  ) as portabilidad_resumen,
  c.iban,
  c.verificacion_at,
  c.verificacion_hecha_at,
  public.nombre_perfil(c.verificacion_hecha_por) as verificacion_hecha_por_nombre
from public.contratos c
left join public.equipos e on e.id = c.equipo_id;
