-- =============================================================================
-- MESENERGIA CRM · 17 · Prospección de leads (llamadas, correos y seguimiento)
--
-- · leads: cada comercial trabaja sus propios leads (los sube desde un Excel).
-- · leads_eventos: historial del proceso y registro diario de llamadas.
-- · leads_archivos: facturas y comparativas adjuntas (en Storage).
--
-- Permisos: el propietario ve y edita lo suyo; admin y backoffice, todo;
-- el jefe de equipo ve (solo lectura) los leads de su equipo.
-- Solo se añaden tablas nuevas: no se toca nada de contratos.
-- =============================================================================

create table public.leads (
  id                   uuid primary key default gen_random_uuid(),
  propietario_id       uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  nombre               text not null default '',
  telefono             text not null default '',
  telefono2            text not null default '',
  email                text not null default '',
  kw                   text not null default '',
  cups                 text not null default '',
  consumo_anual        numeric,
  comercializadora     text not null default '',
  periodo_principal    smallint check (periodo_principal between 1 and 6),
  periodo_pct          smallint check (periodo_pct between 0 and 100),
  extra                jsonb not null default '{}'::jsonb,
  estado               text not null default 'pendiente'
    check (estado in ('pendiente', 'no_contesta', 'rechazado', 'correo', 'facturas', 'comparativa')),
  llamadas             integer not null default 0 check (llamadas >= 0),
  nota                 text not null default '',
  correo_enviado_at    timestamptz,
  ultimo_movimiento_at timestamptz not null default now(),
  maximetro            jsonb,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index leads_propietario_estado_idx on public.leads (propietario_id, estado);
-- Un mismo teléfono no se repite dentro de la cartera de un comercial.
create unique index leads_propietario_telefono_uq
  on public.leads (propietario_id, telefono) where telefono <> '';

create trigger leads_updated_at
  before update on public.leads
  for each row execute function public.tg_set_updated_at();

create table public.leads_eventos (
  id          uuid primary key default gen_random_uuid(),
  lead_id     uuid not null references public.leads (id) on delete cascade,
  usuario_id  uuid not null default auth.uid(),
  -- estado al que pasó el lead; null si es una nota del historial
  estado      text check (estado in ('pendiente', 'no_contesta', 'rechazado', 'correo', 'facturas', 'comparativa')),
  texto       text not null default '',
  created_at  timestamptz not null default now()
);

create index leads_eventos_lead_idx on public.leads_eventos (lead_id, created_at desc);
create index leads_eventos_dia_idx on public.leads_eventos (usuario_id, created_at) where estado is not null;

create table public.leads_archivos (
  id             uuid primary key default gen_random_uuid(),
  lead_id        uuid not null references public.leads (id) on delete cascade,
  tipo           text not null default 'factura' check (tipo in ('factura', 'comparativa', 'otro')),
  nombre         text not null,
  storage_path   text not null,
  tamano_bytes   bigint not null default 0,
  usuario_id     uuid not null default auth.uid(),
  created_at     timestamptz not null default now()
);

create index leads_archivos_lead_idx on public.leads_archivos (lead_id);

-- -----------------------------------------------------------------------------
-- Funciones de permisos
-- -----------------------------------------------------------------------------
create or replace function public.puede_ver_lead(p_lead_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.leads l
    join public.profiles me on me.id = auth.uid() and me.activo
    where l.id = p_lead_id
      and (
        me.rol in ('admin', 'backoffice')
        or l.propietario_id = me.id
        or (
          me.rol = 'jefe_equipo' and me.equipo_id is not null
          and exists (
            select 1 from public.profiles o
            where o.id = l.propietario_id and o.equipo_id = me.equipo_id
          )
        )
      )
  )
$$;

create or replace function public.puede_editar_lead(p_lead_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.leads l
    join public.profiles me on me.id = auth.uid() and me.activo
    where l.id = p_lead_id
      and (me.rol in ('admin', 'backoffice') or l.propietario_id = me.id)
  )
$$;

grant execute on function public.puede_ver_lead(uuid), public.puede_editar_lead(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.leads          enable row level security;
alter table public.leads_eventos  enable row level security;
alter table public.leads_archivos enable row level security;

revoke all on public.leads, public.leads_eventos, public.leads_archivos from anon;

-- La política de lectura de leads va en línea (sin consultar la tabla leads):
-- así también funciona INSERT ... RETURNING, que ve la fila antes de existir.
create or replace function public.es_de_mi_equipo(p_usuario_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles me
    join public.profiles o on o.id = p_usuario_id and o.equipo_id = me.equipo_id
    where me.id = auth.uid() and me.activo and me.rol = 'jefe_equipo' and me.equipo_id is not null
  )
$$;

grant execute on function public.es_de_mi_equipo(uuid) to authenticated;

create policy leads_select on public.leads
  for select to authenticated
  using (
    (select public.es_gestor())
    or ((select public.mi_rol()) is not null and propietario_id = (select auth.uid()))
    or public.es_de_mi_equipo(propietario_id)
  );

create policy leads_insert on public.leads
  for insert to authenticated
  with check (
    (select public.es_gestor())
    or ((select public.mi_rol()) is not null and propietario_id = (select auth.uid()))
  );

create policy leads_update on public.leads
  for update to authenticated
  using (public.puede_editar_lead(id))
  with check (
    (select public.es_gestor())
    or propietario_id = (select auth.uid())
  );

create policy leads_delete on public.leads
  for delete to authenticated
  using (public.puede_editar_lead(id));

create policy leads_eventos_select on public.leads_eventos
  for select to authenticated
  using (public.puede_ver_lead(lead_id));

create policy leads_eventos_insert on public.leads_eventos
  for insert to authenticated
  with check (public.puede_editar_lead(lead_id) and usuario_id = (select auth.uid()));

-- El historial no se edita ni se borra (solo desaparece con el lead).
revoke update, delete on public.leads_eventos from authenticated;

create policy leads_archivos_select on public.leads_archivos
  for select to authenticated
  using (public.puede_ver_lead(lead_id));

create policy leads_archivos_insert on public.leads_archivos
  for insert to authenticated
  with check (public.puede_editar_lead(lead_id) and usuario_id = (select auth.uid()));

create policy leads_archivos_delete on public.leads_archivos
  for delete to authenticated
  using (public.puede_editar_lead(lead_id));

revoke update on public.leads_archivos from authenticated;

-- -----------------------------------------------------------------------------
-- Storage: bucket privado para facturas y comparativas. Ruta: {lead_id}/{archivo}
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'leads-archivos', 'leads-archivos', false, 15728640,
  array[
    'application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel'
  ]
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy leads_archivos_obj_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'leads-archivos'
    and public.puede_ver_lead(public.uuid_o_null((storage.foldername(name))[1]))
  );

create policy leads_archivos_obj_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'leads-archivos'
    and public.puede_editar_lead(public.uuid_o_null((storage.foldername(name))[1]))
  );

create policy leads_archivos_obj_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'leads-archivos'
    and public.puede_editar_lead(public.uuid_o_null((storage.foldername(name))[1]))
  );
