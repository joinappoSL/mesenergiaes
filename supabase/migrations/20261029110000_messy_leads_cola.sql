-- =============================================================================
-- MESENERGIA CRM · Messy ↔ Prospección (cola propia)
--
-- Los avisos de leads van por su propia cola y su propia Edge Function
-- (messy-leads), sin tocar la cola de reservas de plaza de Messy:
--   · cada avance de un lead (correo, facturas, comparativa, visita, firmado)
--     encola un aviso para el grupo;
--   · a los 5 min de la hora de cierre se encola el desglose del día.
-- Sustituye al enganche de la migración 20261029100000 sobre messy_eventos.
-- =============================================================================

drop trigger if exists leads_eventos_messy on public.leads_eventos;
drop function if exists public.tg_messy_lead_evento();

alter table public.messy_eventos drop column if exists lead_evento_id;
alter table public.messy_eventos
  drop constraint messy_eventos_tipo_check,
  add constraint messy_eventos_tipo_check check (tipo in ('venta', 'buenos_dias', 'cierre'));

alter table public.messy_config
  add column leads_resumen_cierre boolean not null default true;

create table public.messy_leads_cola (
  id              bigint generated always as identity primary key,
  tipo            text not null check (tipo in ('aviso', 'resumen')),
  clave           text not null unique,
  lead_evento_id  uuid references public.leads_eventos (id) on delete cascade,
  estado          text not null default 'pendiente'
                    check (estado in ('pendiente', 'procesando', 'enviado', 'error', 'descartado')),
  intentos        smallint not null default 0,
  error           text,
  mensaje         text,
  created_at      timestamptz not null default now(),
  procesado_at    timestamptz
);

create index messy_leads_cola_pendientes_idx on public.messy_leads_cola (created_at)
  where estado in ('pendiente', 'procesando');

alter table public.messy_leads_cola enable row level security;
revoke all on public.messy_leads_cola from public, anon, authenticated;
grant all on public.messy_leads_cola to service_role;

create or replace function public.messy_leads_reclamar()
returns setof public.messy_leads_cola
language sql
security definer
set search_path = ''
as $$
  update public.messy_leads_cola q
     set estado = 'procesando',
         intentos = q.intentos + 1,
         procesado_at = now()
   where q.id in (
     select x.id
     from public.messy_leads_cola x
     where x.created_at > now() - interval '3 hours'
       and x.intentos < 5
       and (x.estado = 'pendiente'
            or (x.estado = 'procesando' and x.procesado_at < now() - interval '10 minutes'))
     order by x.id
     limit 20
     for update skip locked
   )
  returning q.*;
$$;

-- Despierta a la función messy-leads (asíncrono: no frena el guardado)
create or replace function public.messy_leads_despertar()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.messy_config;
begin
  select * into c from public.messy_config where id = 1;
  if not found or not c.activo or c.funcion_url is null then
    return;
  end if;

  perform net.http_post(
    url                  := regexp_replace(c.funcion_url, '/messy/?$', '/messy-leads'),
    body                 := jsonb_build_object('accion', 'procesar'),
    headers              := jsonb_build_object('Content-Type', 'application/json', 'x-messy-clave', c.clave),
    timeout_milliseconds := 10000
  );
end;
$$;

create or replace function public.tg_messy_leads_aviso()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.messy_config;
begin
  if new.estado is null or new.estado not in ('correo', 'facturas', 'comparativa', 'visita', 'firmado') then
    return null;
  end if;

  begin
    select * into c from public.messy_config where id = 1;
    if not found or not c.leads_avisos or (new.estado = 'correo' and not c.leads_avisar_correos) then
      return null;
    end if;

    insert into public.messy_leads_cola (tipo, clave, lead_evento_id)
    values ('aviso', 'aviso:' || new.id, new.id)
    on conflict (clave) do nothing;

    perform public.messy_leads_despertar();
  exception when others then
    raise warning 'Messy no ha podido registrar el avance del lead %: %', new.lead_id, sqlerrm;
  end;

  return null;
end;
$$;

create trigger leads_eventos_messy
  after insert on public.leads_eventos
  for each row execute function public.tg_messy_leads_aviso();

-- Reloj: desglose del día 5 min después del cierre + reintentos
create or replace function public.messy_leads_tick()
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
  v_min    int := extract(minute from v_ahora)::int;
  v_dia    int := extract(isodow from v_ahora)::int;
begin
  select * into c from public.messy_config where id = 1;
  if not found or not c.activo or c.funcion_url is null then
    return;
  end if;

  if c.grupo_chat_id is not null and c.leads_resumen_cierre
     and v_dia = any (c.dias_activos) and v_hora = c.hora_cierre and v_min >= 5 then
    insert into public.messy_leads_cola (tipo, clave) values ('resumen', 'resumen:' || v_hoy)
    on conflict (clave) do nothing;
  end if;

  if exists (
    select 1 from public.messy_leads_cola q
    where q.created_at > now() - interval '3 hours'
      and q.intentos < 5
      and (q.estado = 'pendiente'
           or (q.estado = 'procesando' and q.procesado_at < now() - interval '10 minutes'))
  ) then
    perform public.messy_leads_despertar();
  end if;
end;
$$;

select cron.schedule('messy-leads-reloj', '*/5 * * * *', 'select public.messy_leads_tick()');

revoke execute on function
  public.messy_leads_reclamar(),
  public.messy_leads_despertar(),
  public.tg_messy_leads_aviso(),
  public.messy_leads_tick()
from public, anon, authenticated;

grant execute on function public.messy_leads_reclamar() to service_role;
