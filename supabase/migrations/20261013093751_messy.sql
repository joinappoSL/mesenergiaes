-- =============================================================================
-- MESENERGIA CRM · 09 · Messy, el agente de IA en WhatsApp
--
-- · Cada contrato nuevo genera un evento «venta» y despierta a la Edge Function
--   `messy`, que lo anuncia en el grupo de WhatsApp («🔥 Mario ha vendido 1»).
-- · Un cron cada 5 minutos crea los mensajes de «Buenos días» y «Cierre del día»
--   (hora de Madrid) y reintenta lo que haya quedado pendiente.
-- · Las sesiones de WhatsApp guardan los tokens del usuario del CRM para que el
--   agente consulte los datos con SUS permisos (RLS), nunca con service_role.
--
-- Todas las tablas son internas: RLS activado y sin políticas, solo las usa la
-- Edge Function con la service_role key.
-- =============================================================================

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

-- -----------------------------------------------------------------------------
-- Configuración (una sola fila)
-- -----------------------------------------------------------------------------
create table public.messy_config (
  id                smallint primary key default 1 check (id = 1),
  activo            boolean not null default true,
  -- URL pública de la Edge Function, p. ej. https://<ref>.supabase.co/functions/v1/messy
  funcion_url       text,
  -- Clave compartida entre la base de datos, Whapi (webhook) y la Edge Function
  clave             text not null default encode(extensions.gen_random_bytes(24), 'hex'),
  grupo_chat_id     text check (grupo_chat_id is null or grupo_chat_id like '%@g.us'),
  grupo_nombre      text,
  hora_buenos_dias  smallint not null default 9 check (hora_buenos_dias between 0 and 23),
  hora_cierre       smallint not null default 20 check (hora_cierre between 0 and 23),
  -- Días con mensaje de buenos días y cierre (ISO: 1 = lunes … 7 = domingo)
  dias_activos      smallint[] not null default '{1,2,3,4,5,6}',
  updated_at        timestamptz not null default now()
);

insert into public.messy_config (id) values (1) on conflict (id) do nothing;

-- -----------------------------------------------------------------------------
-- Sesiones de WhatsApp (un chat privado = una sesión)
-- -----------------------------------------------------------------------------
create table public.messy_sesiones (
  chat_id            text primary key,
  estado             text not null default 'nuevo'
                       check (estado in ('nuevo', 'esperando_email', 'esperando_password', 'activa')),
  email_pendiente    text,
  user_id            uuid references auth.users (id) on delete cascade,
  access_token       text,
  access_expira      timestamptz,
  refresh_token      text,
  fallos             smallint not null default 0,
  bloqueado_hasta    timestamptz,
  nombre_whatsapp    text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index messy_sesiones_user_idx on public.messy_sesiones (user_id);

-- Memoria corta de la conversación (solo texto; nunca contraseñas)
create table public.messy_mensajes (
  id          bigint generated always as identity primary key,
  chat_id     text not null,
  user_id     uuid references auth.users (id) on delete cascade,
  rol         text not null check (rol in ('user', 'assistant')),
  texto       text not null,
  created_at  timestamptz not null default now()
);

create index messy_mensajes_chat_idx on public.messy_mensajes (chat_id, id desc);

-- Ids de mensajes de WhatsApp ya procesados (Whapi puede reenviar un webhook)
create table public.messy_recibidos (
  wa_id       text primary key,
  created_at  timestamptz not null default now()
);

-- Cola de avisos al grupo
create table public.messy_eventos (
  id            bigint generated always as identity primary key,
  tipo          text not null check (tipo in ('venta', 'buenos_dias', 'cierre')),
  clave         text not null unique,
  contrato_id   uuid references public.contratos (id) on delete cascade,
  estado        text not null default 'pendiente'
                  check (estado in ('pendiente', 'procesando', 'enviado', 'error', 'descartado')),
  intentos      smallint not null default 0,
  error         text,
  mensaje       text,
  created_at    timestamptz not null default now(),
  procesado_at  timestamptz
);

create index messy_eventos_pendientes_idx on public.messy_eventos (created_at)
  where estado in ('pendiente', 'procesando');

alter table public.messy_config    enable row level security;
alter table public.messy_sesiones  enable row level security;
alter table public.messy_mensajes  enable row level security;
alter table public.messy_recibidos enable row level security;
alter table public.messy_eventos   enable row level security;

revoke all on public.messy_config, public.messy_sesiones, public.messy_mensajes,
  public.messy_recibidos, public.messy_eventos from public, anon, authenticated;
grant all on public.messy_config, public.messy_sesiones, public.messy_mensajes,
  public.messy_recibidos, public.messy_eventos to service_role;

-- -----------------------------------------------------------------------------
-- Despertar a la Edge Function (asíncrono con pg_net: no frena el guardado)
-- -----------------------------------------------------------------------------
create or replace function public.messy_despertar()
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
    url                  := c.funcion_url,
    body                 := jsonb_build_object('accion', 'procesar'),
    headers              := jsonb_build_object('Content-Type', 'application/json', 'x-messy-clave', c.clave),
    timeout_milliseconds := 10000
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- Nueva venta → evento + aviso. Nunca impide guardar el contrato.
-- -----------------------------------------------------------------------------
create or replace function public.tg_messy_venta()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Solo altas reales (no cargas de datos con fechas pasadas)
  if new.created_at < now() - interval '1 hour' then
    return null;
  end if;

  begin
    insert into public.messy_eventos (tipo, clave, contrato_id)
    values ('venta', 'venta:' || new.id, new.id)
    on conflict (clave) do nothing;

    perform public.messy_despertar();
  exception when others then
    raise warning 'Messy no ha podido registrar la venta %: %', new.numero, sqlerrm;
  end;

  return null;
end;
$$;

create trigger contratos_messy_venta
  after insert on public.contratos
  for each row execute function public.tg_messy_venta();

-- -----------------------------------------------------------------------------
-- Reloj de Messy (cron cada 5 min): buenos días, cierre y reintentos
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

  if exists (
    select 1
    from public.messy_eventos e
    where e.created_at > now() - interval '3 hours'
      and e.intentos < 5
      and (e.estado = 'pendiente'
           or (e.estado = 'procesando' and e.procesado_at < now() - interval '10 minutes'))
  ) then
    perform public.messy_despertar();
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- La Edge Function reclama los eventos de forma atómica (sin duplicados aunque
-- lleguen dos avisos a la vez). Los avisos de más de 3 horas se descartan.
-- -----------------------------------------------------------------------------
create or replace function public.messy_reclamar_eventos()
returns setof public.messy_eventos
language sql
security definer
set search_path = ''
as $$
  update public.messy_eventos e
     set estado = 'procesando',
         intentos = e.intentos + 1,
         procesado_at = now()
   where e.id in (
     select x.id
     from public.messy_eventos x
     where x.created_at > now() - interval '3 hours'
       and x.intentos < 5
       and (x.estado = 'pendiente'
            or (x.estado = 'procesando' and x.procesado_at < now() - interval '10 minutes'))
     order by x.id
     limit 20
     for update skip locked
   )
  returning e.*;
$$;

-- -----------------------------------------------------------------------------
-- Nombre para el grupo: el nombre de pila, o nombre + primer apellido si hay
-- otra persona activa que se llama igual.
-- -----------------------------------------------------------------------------
create or replace function public.messy_nombre(p_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    nullif(
      case
        when exists (
          select 1 from public.profiles o
          where o.id <> p.id and o.activo
            and lower(trim(o.nombre)) = lower(trim(p.nombre))
        ) then trim(p.nombre || ' ' || split_part(trim(p.apellidos), ' ', 1))
        else trim(p.nombre)
      end, ''),
    split_part(p.email, '@', 1)
  )
  from public.profiles p
  where p.id = p_id
$$;

-- -----------------------------------------------------------------------------
-- Datos de una venta para el aviso (sin datos personales del cliente)
-- -----------------------------------------------------------------------------
create or replace function public.messy_datos_venta(p_contrato_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with c as (
    select k.*,
           coalesce(k.comercial_id, k.created_by) as vendedor_id,
           (k.created_at at time zone 'Europe/Madrid')::date as dia
    from public.contratos k
    where k.id = p_contrato_id
  ),
  hoy as (
    select k.*, coalesce(k.comercial_id, k.created_by) as vendedor_id
    from public.contratos k, c
    where (k.created_at at time zone 'Europe/Madrid')::date = c.dia
  ),
  ranking as (
    select h.vendedor_id, count(*) as ventas, max(h.created_at) as ultima
    from hoy h
    where h.vendedor_id is not null
    group by h.vendedor_id
  )
  select jsonb_build_object(
    'numero',                c.numero,
    'vendedor',              coalesce(public.messy_nombre(c.vendedor_id), 'Alguien del equipo'),
    'equipo',                (select e.nombre from public.equipos e where e.id = c.equipo_id),
    'producto',              c.producto,
    'operadora',             c.operadora,
    'precio_mensual',        c.precio_mensual,
    'hora',                  to_char(c.created_at at time zone 'Europe/Madrid', 'HH24:MI'),
    'ventas_hoy_vendedor',   (select count(*) from hoy h where h.vendedor_id = c.vendedor_id),
    'ventas_mes_vendedor',   (
      select count(*) from public.contratos k
      where coalesce(k.comercial_id, k.created_by) = c.vendedor_id
        and date_trunc('month', k.created_at at time zone 'Europe/Madrid')
            = date_trunc('month', c.created_at at time zone 'Europe/Madrid')
    ),
    'ventas_hoy_equipo',     (select count(*) from hoy h where c.equipo_id is not null and h.equipo_id = c.equipo_id),
    'ventas_hoy_total',      (select count(*) from hoy),
    'primera_venta_del_dia', (select count(*) from hoy) = 1,
    'lider_hoy',             (
      select public.messy_nombre(r.vendedor_id) from ranking r
      order by r.ventas desc, r.ultima asc limit 1
    ),
    'top_hoy',               (
      select coalesce(jsonb_agg(jsonb_build_object('nombre', public.messy_nombre(r.vendedor_id), 'ventas', r.ventas)
                                order by r.ventas desc, r.ultima asc), '[]'::jsonb)
      from (select * from ranking order by ventas desc, ultima asc limit 3) r
    )
  )
  from c
$$;

-- -----------------------------------------------------------------------------
-- Resumen de un día (para «Buenos días» y «Cierre del día»)
-- -----------------------------------------------------------------------------
create or replace function public.messy_resumen_dia(p_fecha date)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with dia as (
    select k.*, coalesce(k.comercial_id, k.created_by) as vendedor_id
    from public.contratos k
    where (k.created_at at time zone 'Europe/Madrid')::date = p_fecha
  ),
  mes as (
    select k.*, coalesce(k.comercial_id, k.created_by) as vendedor_id,
           (k.created_at at time zone 'Europe/Madrid')::date as fecha
    from public.contratos k
    where (k.created_at at time zone 'Europe/Madrid')::date
          between date_trunc('month', p_fecha)::date and p_fecha
  )
  select jsonb_build_object(
    'fecha',              p_fecha,
    'ventas',             (select count(*) from dia),
    'facturacion_mensual_vendida', (select coalesce(sum(d.precio_mensual), 0) from dia d),
    'por_estado',         (select coalesce(jsonb_object_agg(x.estado, x.n), '{}'::jsonb)
                           from (select d.estado, count(*) as n from dia d group by d.estado) x),
    'ranking',            (
      select coalesce(jsonb_agg(jsonb_build_object('nombre', x.nombre, 'equipo', x.equipo, 'ventas', x.n)
                                order by x.n desc, x.nombre), '[]'::jsonb)
      from (
        select public.messy_nombre(d.vendedor_id) as nombre,
               (select e.nombre from public.equipos e join public.profiles p on p.equipo_id = e.id
                 where p.id = d.vendedor_id) as equipo,
               count(*) as n
        from dia d
        where d.vendedor_id is not null
        group by d.vendedor_id
        order by count(*) desc
        limit 10
      ) x
    ),
    'por_equipo',         (
      select coalesce(jsonb_agg(jsonb_build_object('equipo', x.equipo, 'ventas', x.n) order by x.n desc), '[]'::jsonb)
      from (
        select e.nombre as equipo, count(*) as n
        from dia d join public.equipos e on e.id = d.equipo_id
        group by e.nombre
      ) x
    ),
    'mismo_dia_semana_pasada', (
      select count(*) from public.contratos k
      where (k.created_at at time zone 'Europe/Madrid')::date = p_fecha - 7
    ),
    'mes', jsonb_build_object(
      'ventas',            (select count(*) from mes),
      'activos',           (select count(*) from mes m where m.estado = 'activo'),
      'mejor_dia_ventas',  (select coalesce(max(x.n), 0) from (select m.fecha, count(*) as n from mes m group by m.fecha) x),
      'top3',              (
        select coalesce(jsonb_agg(jsonb_build_object('nombre', public.messy_nombre(x.vendedor_id), 'ventas', x.n)
                                  order by x.n desc), '[]'::jsonb)
        from (
          select m.vendedor_id, count(*) as n
          from mes m where m.vendedor_id is not null
          group by m.vendedor_id
          order by count(*) desc
          limit 3
        ) x
      )
    ),
    'comerciales_activos', (select count(*) from public.profiles p where p.activo and p.rol = 'comercial')
  )
$$;

-- Último día con ventas antes de una fecha (para el resumen de «Buenos días»)
create or replace function public.messy_ultimo_dia_con_ventas(p_antes date)
returns date
language sql
stable
security definer
set search_path = ''
as $$
  select max((k.created_at at time zone 'Europe/Madrid')::date)
  from public.contratos k
  where k.created_at < (p_antes::timestamp at time zone 'Europe/Madrid')
    and k.created_at > (p_antes::timestamp at time zone 'Europe/Madrid') - interval '14 days'
$$;

-- -----------------------------------------------------------------------------
-- Permisos: nada de esto es accesible desde el navegador
-- -----------------------------------------------------------------------------
revoke execute on function
  public.messy_despertar(),
  public.tg_messy_venta(),
  public.messy_tick(),
  public.messy_reclamar_eventos(),
  public.messy_nombre(uuid),
  public.messy_datos_venta(uuid),
  public.messy_resumen_dia(date),
  public.messy_ultimo_dia_con_ventas(date)
from public, anon, authenticated;

grant execute on function
  public.messy_reclamar_eventos(),
  public.messy_nombre(uuid),
  public.messy_datos_venta(uuid),
  public.messy_resumen_dia(date),
  public.messy_ultimo_dia_con_ventas(date)
to service_role;

-- -----------------------------------------------------------------------------
-- Cron: cada 5 minutos
-- -----------------------------------------------------------------------------
select cron.schedule('messy-reloj', '*/5 * * * *', 'select public.messy_tick()');
