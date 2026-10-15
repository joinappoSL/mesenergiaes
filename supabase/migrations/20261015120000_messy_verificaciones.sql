-- =============================================================================
-- MESENERGIA CRM · 14 · Messy y las verificaciones de backoffice
--
-- · verificaciones_log: registro de lo que pasa con cada verificación
--   (llamadas, hecha, reprogramada…). Lo rellenan los triggers.
-- · messy_cola_verificaciones: mensajes de Messy sobre verificaciones
--     - resultado       → grupo: resultado de la llamada / hecha / reprogramada
--                         (se espera 90 s para juntar en un solo mensaje lo que
--                         se hace en la misma acción, p. ej. No contesta + reprogramar)
--     - recordatorio    → privado: X minutos antes de cada verificación
--     - resumen_manana  → privado: lista del día a la hora de los buenos días
--     - resumen_noche   → privado: balance del día a la hora del cierre
-- · messy_verificaciones_resumen(): cifras del día y firmadas del mes
-- · El reloj de Messy pasa a ejecutarse cada minuto.
-- =============================================================================

alter table public.messy_config
  add column verificaciones_para    uuid[]   not null default '{}',
  add column aviso_verificacion_min smallint not null default 10 check (aviso_verificacion_min between 0 and 120),
  add column resumen_verificaciones boolean  not null default true;

-- -----------------------------------------------------------------------------
-- Registro de verificaciones (sin clave foránea: es un histórico)
-- -----------------------------------------------------------------------------
create table public.verificaciones_log (
  id           bigint generated always as identity primary key,
  contrato_id  uuid not null,
  accion       text not null
                 check (accion in ('llamada', 'hecha', 'pendiente', 'programada', 'reprogramada', 'quitada')),
  resultado    public.resultado_llamada,
  de_at        timestamptz,
  a_at         timestamptz,
  usuario_id   uuid,
  created_at   timestamptz not null default now()
);

create index verificaciones_log_contrato_idx on public.verificaciones_log (contrato_id, id);
create index verificaciones_log_fecha_idx on public.verificaciones_log (created_at);

alter table public.verificaciones_log enable row level security;
revoke all on public.verificaciones_log from public, anon, authenticated;
grant select on public.verificaciones_log to authenticated;
grant all on public.verificaciones_log to service_role;

create policy verificaciones_log_select on public.verificaciones_log
  for select to authenticated
  using ((select public.es_gestor()));

-- -----------------------------------------------------------------------------
-- Cola de mensajes de verificaciones (interna)
-- -----------------------------------------------------------------------------
create table public.messy_cola_verificaciones (
  id               bigint generated always as identity primary key,
  tipo             text not null check (tipo in ('resultado', 'recordatorio', 'resumen_manana', 'resumen_noche')),
  clave            text not null unique,
  contrato_id      uuid,
  verificacion_at  timestamptz,
  desde_log_id     bigint,
  procesar_desde   timestamptz not null default now(),
  estado           text not null default 'pendiente'
                     check (estado in ('pendiente', 'procesando', 'enviado', 'error', 'descartado')),
  intentos         smallint not null default 0,
  error            text,
  mensaje          text,
  enviado_a        smallint,
  created_at       timestamptz not null default now(),
  procesado_at     timestamptz
);

create index messy_cola_verificaciones_pendientes_idx on public.messy_cola_verificaciones (procesar_desde)
  where estado in ('pendiente', 'procesando');

alter table public.messy_cola_verificaciones enable row level security;
revoke all on public.messy_cola_verificaciones from public, anon, authenticated;
grant all on public.messy_cola_verificaciones to service_role;

-- Un mensaje de resultado por contrato y «acción»: lo que llegue en los
-- próximos 90 segundos se junta en el mismo mensaje.
create or replace function public.messy_encolar_resultado(p_contrato_id uuid, p_log_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.messy_cola_verificaciones q
    where q.tipo = 'resultado' and q.contrato_id = p_contrato_id and q.estado = 'pendiente'
  ) then
    return;
  end if;
  insert into public.messy_cola_verificaciones (tipo, clave, contrato_id, desde_log_id, procesar_desde)
  values ('resultado', 'resultado:' || p_contrato_id || ':' || p_log_id, p_contrato_id, p_log_id, now() + interval '90 seconds')
  on conflict (clave) do nothing;
end;
$$;

-- -----------------------------------------------------------------------------
-- Llamadas a contratos con verificación programada
-- -----------------------------------------------------------------------------
create or replace function public.tg_llamadas_verificacion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_log bigint;
begin
  if exists (select 1 from public.contratos k where k.id = new.contrato_id and k.verificacion_at is not null) then
    insert into public.verificaciones_log (contrato_id, accion, resultado, a_at, usuario_id)
    values (new.contrato_id, 'llamada', new.resultado, new.volver_a_llamar_at, new.usuario_id)
    returning id into v_log;
    perform public.messy_encolar_resultado(new.contrato_id, v_log);
  end if;
  return null;
exception when others then
  -- Nunca impide registrar la llamada
  raise warning 'Messy: no se ha podido registrar la llamada de verificación: %', sqlerrm;
  return null;
end;
$$;

create trigger llamadas_verificacion
  after insert on public.llamadas
  for each row execute function public.tg_llamadas_verificacion();

-- -----------------------------------------------------------------------------
-- Verificación hecha / reprogramada: nota en observaciones, registro y aviso
-- -----------------------------------------------------------------------------
create or replace function public.tg_contratos_verificacion_auditoria()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid   uuid := auth.uid();
  v_texto text;
  v_log   bigint;
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

  begin
    if new.verificacion_hecha_at is not null and old.verificacion_hecha_at is null then
      insert into public.verificaciones_log (contrato_id, accion, de_at, a_at, usuario_id)
      values (new.id, 'hecha', new.verificacion_at, new.verificacion_hecha_at, v_uid)
      returning id into v_log;
      perform public.messy_encolar_resultado(new.id, v_log);
    elsif new.verificacion_hecha_at is null and old.verificacion_hecha_at is not null
          and new.verificacion_at is not distinct from old.verificacion_at then
      insert into public.verificaciones_log (contrato_id, accion, de_at, usuario_id)
      values (new.id, 'pendiente', new.verificacion_at, v_uid);
    end if;

    if new.verificacion_at is distinct from old.verificacion_at then
      insert into public.verificaciones_log (contrato_id, accion, de_at, a_at, usuario_id)
      values (
        new.id,
        case
          when old.verificacion_at is null then 'programada'
          when new.verificacion_at is null then 'quitada'
          else 'reprogramada'
        end,
        old.verificacion_at, new.verificacion_at, v_uid
      )
      returning id into v_log;
      if old.verificacion_at is not null and new.verificacion_at is not null then
        perform public.messy_encolar_resultado(new.id, v_log);
      end if;
    end if;
  exception when others then
    raise warning 'Messy: no se ha podido registrar el cambio de la verificación: %', sqlerrm;
  end;

  return null;
end;
$$;

-- -----------------------------------------------------------------------------
-- Cifras del día y firmadas del mes (hora de Madrid, todo el equipo)
-- -----------------------------------------------------------------------------
create or replace function public.messy_verificaciones_resumen(p_fecha date default null)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with d as (
    select coalesce(p_fecha, (now() at time zone 'Europe/Madrid')::date) as dia
  ),
  programadas as (
    -- Las que están hoy y las que estaban hoy y se han movido hoy a otro momento
    select k.id
    from public.contratos k, d
    where k.verificacion_at is not null
      and k.estado <> 'cancelado'
      and (k.verificacion_at at time zone 'Europe/Madrid')::date = d.dia
    union
    select l.contrato_id
    from public.verificaciones_log l, d
    where l.accion in ('reprogramada', 'quitada')
      and (l.de_at at time zone 'Europe/Madrid')::date = d.dia
      and (l.created_at at time zone 'Europe/Madrid')::date = d.dia
  )
  select jsonb_build_object(
    'fecha',         d.dia,
    'programadas',   (select count(*) from programadas),
    'hechas',        (
      select count(*) from public.contratos k
      where (k.verificacion_hecha_at at time zone 'Europe/Madrid')::date = d.dia
    ),
    'no_contesta',   (
      select count(distinct l.contrato_id)
      from public.llamadas l
      join public.contratos k on k.id = l.contrato_id
      where k.verificacion_at is not null
        and l.resultado = 'no_contesta'
        and (l.created_at at time zone 'Europe/Madrid')::date = d.dia
    ),
    'reprogramadas', (
      select count(distinct l.contrato_id) from public.verificaciones_log l
      where l.accion = 'reprogramada' and (l.created_at at time zone 'Europe/Madrid')::date = d.dia
    ),
    'sin_hacer',     (
      select count(*) from public.contratos k
      where k.verificacion_at is not null
        and k.verificacion_hecha_at is null
        and k.estado <> 'cancelado'
        and (k.verificacion_at at time zone 'Europe/Madrid')::date = d.dia
    ),
    'firmadas_hoy',  (
      select count(*) from public.contratos k
      where k.firmado and (k.fecha_firma at time zone 'Europe/Madrid')::date = d.dia
    ),
    'firmadas_mes',  (
      select count(*) from public.contratos k
      where k.firmado
        and (k.fecha_firma at time zone 'Europe/Madrid')::date >= date_trunc('month', d.dia)::date
        and (k.fecha_firma at time zone 'Europe/Madrid')::date < (date_trunc('month', d.dia) + interval '1 month')::date
    )
  )
  from d
$$;

-- -----------------------------------------------------------------------------
-- La Edge Function reclama los mensajes listos de forma atómica
-- -----------------------------------------------------------------------------
create or replace function public.messy_reclamar_verificaciones()
returns setof public.messy_cola_verificaciones
language sql
security definer
set search_path = ''
as $$
  update public.messy_cola_verificaciones q
     set estado = 'procesando',
         intentos = q.intentos + 1,
         procesado_at = now()
   where q.id in (
     select x.id
     from public.messy_cola_verificaciones x
     where x.procesar_desde <= now()
       and x.created_at > now() - interval '3 hours'
       and x.intentos < 5
       and (x.estado = 'pendiente'
            or (x.estado = 'procesando' and x.procesado_at < now() - interval '10 minutes'))
     order by x.procesar_desde, x.id
     limit 20
     for update skip locked
   )
  returning q.*;
$$;

-- -----------------------------------------------------------------------------
-- Reloj de Messy: buenos días, cierre, recordatorios y resúmenes de
-- verificaciones, y reintentos
-- -----------------------------------------------------------------------------
create or replace function public.messy_tick()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  c        public.messy_config;
  v_ahora  timestamp := now() at time zone 'Europe/Madrid';
  v_hoy    date := (now() at time zone 'Europe/Madrid')::date;
  v_hora   int := extract(hour from v_ahora)::int;
  v_dia    int := extract(isodow from v_ahora)::int;
begin
  select * into c from public.messy_config where id = 1;
  if not found or not c.activo or c.funcion_url is null then
    return;
  end if;

  if c.grupo_chat_id is not null and v_dia = any (c.dias_activos) then
    if v_hora = c.hora_buenos_dias then
      insert into public.messy_eventos (tipo, clave) values ('buenos_dias', 'buenos_dias:' || v_hoy)
      on conflict (clave) do nothing;
    elsif v_hora = c.hora_cierre then
      insert into public.messy_eventos (tipo, clave) values ('cierre', 'cierre:' || v_hoy)
      on conflict (clave) do nothing;
    end if;
  end if;

  -- Mensajes privados de verificaciones para backoffice
  if cardinality(c.verificaciones_para) > 0 then
    if c.aviso_verificacion_min > 0 then
      insert into public.messy_cola_verificaciones (tipo, clave, contrato_id, verificacion_at)
      select 'recordatorio',
             'recordatorio:' || k.id || ':' || to_char(k.verificacion_at at time zone 'UTC', 'YYYYMMDDHH24MI'),
             k.id,
             k.verificacion_at
      from public.contratos k
      where k.verificacion_at > now()
        and k.verificacion_at <= now() + make_interval(mins => c.aviso_verificacion_min)
        and k.verificacion_hecha_at is null
        and k.estado <> 'cancelado'
      on conflict (clave) do nothing;
    end if;

    if c.resumen_verificaciones and v_dia = any (c.dias_activos) then
      if v_hora = c.hora_buenos_dias then
        insert into public.messy_cola_verificaciones (tipo, clave) values ('resumen_manana', 'resumen_manana:' || v_hoy)
        on conflict (clave) do nothing;
      elsif v_hora = c.hora_cierre then
        insert into public.messy_cola_verificaciones (tipo, clave) values ('resumen_noche', 'resumen_noche:' || v_hoy)
        on conflict (clave) do nothing;
      end if;
    end if;
  end if;

  if exists (
    select 1
    from public.messy_eventos e
    where e.created_at > now() - interval '3 hours'
      and e.intentos < 5
      and (e.estado = 'pendiente'
           or (e.estado = 'procesando' and e.procesado_at < now() - interval '10 minutes'))
  ) or exists (
    select 1
    from public.messy_cola_verificaciones q
    where q.procesar_desde <= now()
      and q.created_at > now() - interval '3 hours'
      and q.intentos < 5
      and (q.estado = 'pendiente'
           or (q.estado = 'procesando' and q.procesado_at < now() - interval '10 minutes'))
  ) then
    perform public.messy_despertar();
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- Permisos
-- -----------------------------------------------------------------------------
revoke execute on function
  public.messy_encolar_resultado(uuid, bigint),
  public.tg_llamadas_verificacion(),
  public.tg_contratos_verificacion_auditoria(),
  public.messy_verificaciones_resumen(date),
  public.messy_reclamar_verificaciones()
from public, anon, authenticated;

grant execute on function
  public.messy_verificaciones_resumen(date),
  public.messy_reclamar_verificaciones()
to service_role;

-- -----------------------------------------------------------------------------
-- El reloj pasa a cada minuto (recordatorios puntuales y resultados al momento)
-- -----------------------------------------------------------------------------
select cron.alter_job(j.jobid, schedule := '* * * * *')
from cron.job j
where j.jobname = 'messy-reloj';
