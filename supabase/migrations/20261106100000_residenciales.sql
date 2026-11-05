-- =============================================================================
-- MESENERGIA CRM · Residenciales: clientes residenciales firmados (conteo de ventas)
--
-- Sección solo para Mario y Gabriela (y admin/backoffice, que ven todo): cada
-- uno añade sus clientes residenciales con la fecha en que firmaron para llevar
-- el conteo de lo que se vende. Tabla nueva; no toca nada existente.
-- =============================================================================

create or replace function public.puede_residenciales()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.activo
      and (
        p.rol in ('admin', 'backoffice')
        or p.email in ('mario.garcia@mesenergia.es', 'gabriela.santamaria@mesenergia.es')
      )
  )
$$;

grant execute on function public.puede_residenciales() to authenticated;
revoke execute on function public.puede_residenciales() from anon, public;

create table public.residenciales (
  id              uuid primary key default gen_random_uuid(),
  propietario_id  uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  nombre          text not null check (length(btrim(nombre)) > 0),
  telefono        text not null default '',
  email           text not null default '',
  cups            text not null default '',
  suministro      text not null default 'luz' check (suministro in ('luz', 'gas', 'luz_gas')),
  comercializadora text not null default '',
  firmado_at      date not null default (now() at time zone 'Europe/Madrid')::date,
  notas           text not null default '',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index residenciales_propietario_fecha_idx on public.residenciales (propietario_id, firmado_at desc);

create trigger residenciales_updated_at
  before update on public.residenciales
  for each row execute function public.tg_set_updated_at();

alter table public.residenciales enable row level security;
revoke all on public.residenciales from anon;

create policy residenciales_select on public.residenciales
  for select to authenticated
  using (public.puede_residenciales() and ((select public.es_gestor()) or propietario_id = (select auth.uid())));

create policy residenciales_insert on public.residenciales
  for insert to authenticated
  with check (public.puede_residenciales() and ((select public.es_gestor()) or propietario_id = (select auth.uid())));

create policy residenciales_update on public.residenciales
  for update to authenticated
  using (public.puede_residenciales() and ((select public.es_gestor()) or propietario_id = (select auth.uid())))
  with check (public.puede_residenciales() and ((select public.es_gestor()) or propietario_id = (select auth.uid())));

create policy residenciales_delete on public.residenciales
  for delete to authenticated
  using (public.puede_residenciales() and ((select public.es_gestor()) or propietario_id = (select auth.uid())));
