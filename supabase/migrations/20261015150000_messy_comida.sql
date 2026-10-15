-- =============================================================================
-- MESENERGIA CRM · 15 · Messy: gráfica del mes a la hora de comer
--
-- · hora_comida / informe_comida: cada día activo, a esa hora (15:00 por
--   defecto), Messy manda al grupo «¡Hora de comer!» con una gráfica del mes.
-- · messy_informes: cola de esos mensajes (la llena el reloj).
-- · messy_estadisticas_mes(): reservas y firmadas por día, hora punta y
--   el objetivo del mes (sin datos de clientes).
-- =============================================================================

alter table public.messy_config
  add column hora_comida    smallint not null default 15 check (hora_comida between 0 and 23),
  add column informe_comida boolean  not null default true;

create table public.messy_informes (
  id            bigint generated always as identity primary key,
  tipo          text not null check (tipo in ('comida')),
  clave         text not null unique,
  estado        text not null default 'pendiente'
                  check (estado in ('pendiente', 'procesando', 'enviado', 'error', 'descartado')),
  intentos      smallint not null default 0,
  error         text,
  mensaje       text,
  created_at    timestamptz not null default now(),
  procesado_at  timestamptz
);

create index messy_informes_pendientes_idx on public.messy_informes (created_at)
  where estado in ('pendiente', 'procesando');

alter table public.messy_informes enable row level security;
revoke all on public.messy_informes from public, anon, authenticated;
grant all on public.messy_informes to service_role;

create or replace function public.messy_reclamar_informes()
returns setof public.messy_informes
language sql
security definer
set search_path = ''
as $$
  update public.messy_informes r
     set estado = 'procesando',
         intentos = r.intentos + 1,
         procesado_at = now()
   where r.id in (
     select x.id
     from public.messy_informes x
     where x.created_at > now() - interval '3 hours'
       and x.intentos < 5
       and (x.estado = 'pendiente'
            or (x.estado = 'procesando' and x.procesado_at < now() - interval '10 minutes'))
     order by x.id
     limit 5
     for update skip locked
   )
  returning r.*;
$$;

-- -----------------------------------------------------------------------------
-- Estadísticas del mes para la gráfica (hora de Madrid, todo el equipo)
-- -----------------------------------------------------------------------------
create or replace function public.messy_estadisticas_mes(p_fecha date default null)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with d as (
    select coalesce(p_fecha, (now() at time zone 'Europe/Madrid')::date) as hoy
  ),
  m as (
    select d.hoy,
           date_trunc('month', d.hoy)::date as inicio,
           (date_trunc('month', d.hoy) + interval '1 month')::date as fin
    from d
  ),
  k as (
    select (c.created_at at time zone 'Europe/Madrid') as ts
    from public.contratos c, m
    where (c.created_at at time zone 'Europe/Madrid')::date >= m.inicio
      and (c.created_at at time zone 'Europe/Madrid')::date < m.fin
  ),
  f as (
    select (c.fecha_firma at time zone 'Europe/Madrid')::date as dia
    from public.contratos c, m
    where c.firmado
      and (c.fecha_firma at time zone 'Europe/Madrid')::date >= m.inicio
      and (c.fecha_firma at time zone 'Europe/Madrid')::date < m.fin
  )
  select jsonb_build_object(
    'hoy',          m.hoy,
    'hora',         to_char(now() at time zone 'Europe/Madrid', 'HH24:MI'),
    'dias',         (
      select jsonb_agg(jsonb_build_object(
               'dia',      to_char(g, 'YYYY-MM-DD'),
               'reservas', (select count(*) from k where k.ts::date = g::date),
               'firmadas', (select count(*) from f where f.dia = g::date)
             ) order by g)
      from generate_series(m.inicio::timestamp, (m.fin - 1)::timestamp, interval '1 day') g
    ),
    'reservas_hoy', (select count(*) from k where k.ts::date = m.hoy),
    'firmadas_mes', (select count(*) from f),
    'hora_punta',   (select extract(hour from k.ts)::int from k group by 1 order by count(*) desc, 1 limit 1),
    'progreso',     public.messy_progreso_mes(m.hoy)
  )
  from m
$$;

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

  -- Gráfica del mes a la hora de comer (grupo)
  if c.grupo_chat_id is not null and c.informe_comida and v_dia = any (c.dias_activos) and v_hora = c.hora_comida then
    insert into public.messy_informes (tipo, clave) values ('comida', 'comida:' || v_hoy)
    on conflict (clave) do nothing;
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
    from public.messy_informes x
    where x.created_at > now() - interval '3 hours'
      and x.intentos < 5
      and (x.estado = 'pendiente'
           or (x.estado = 'procesando' and x.procesado_at < now() - interval '10 minutes'))
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

revoke execute on function
  public.messy_reclamar_informes(),
  public.messy_estadisticas_mes(date)
from public, anon, authenticated;

grant execute on function
  public.messy_reclamar_informes(),
  public.messy_estadisticas_mes(date)
to service_role;
