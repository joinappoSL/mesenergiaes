-- =============================================================================
-- MESENERGIA CRM · Appo: leads para vender Appo (IA para pymes) y cerrar auditorías
--
-- Tabla nueva y separada de los leads de energía: otra marca, otros estados
-- (de la llamada a la auditoría gratis y al pack cerrado). No toca nada existente.
-- Cada comercial ve su cartera; el jefe de equipo, la de su equipo; admin y
-- backoffice, todas (mismas reglas que los leads de energía).
-- =============================================================================

create table public.appo_leads (
  id               uuid primary key default gen_random_uuid(),
  propietario_id   uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  empresa          text not null check (length(btrim(empresa)) > 0),
  sector           text not null default '',
  contacto         text not null default '',
  telefono         text not null default '',
  email            text not null default '',
  web              text not null default '',
  ciudad           text not null default '',
  tamano           text not null default '' check (tamano in ('', 'autonomo', 'micro', 'pequena', 'mediana')),
  estado           text not null default 'pendiente'
                   check (estado in ('pendiente', 'no_contesta', 'volver_a_llamar', 'interesado', 'auditoria', 'informe', 'cerrado', 'descartado')),
  modulo           text not null default '',
  -- auditoría gratis (30 min): cuándo y cómo
  auditoria_at     timestamptz,
  auditoria_modo   text not null default 'online' check (auditoria_modo in ('online', 'presencial')),
  proxima_llamada  timestamptz,
  -- lo que se calcula en la auditoría y lo que se cierra
  perdidas_mes     numeric,
  pack             text not null default '' check (pack in ('', 'arranque', 'crecimiento', 'empresa', 'modulo')),
  cuota_mes        numeric,
  alta             numeric,
  cerrado_at       date,
  nota             text not null default '',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index appo_leads_propietario_idx on public.appo_leads (propietario_id, estado, updated_at desc);
create index appo_leads_auditoria_idx on public.appo_leads (auditoria_at) where auditoria_at is not null;

create trigger appo_leads_updated_at
  before update on public.appo_leads
  for each row execute function public.tg_set_updated_at();

alter table public.appo_leads enable row level security;
revoke all on public.appo_leads from anon;

create policy appo_leads_select on public.appo_leads
  for select to authenticated
  using ((select public.es_gestor()) or propietario_id = (select auth.uid()) or public.es_de_mi_equipo(propietario_id));

create policy appo_leads_insert on public.appo_leads
  for insert to authenticated
  with check ((select public.es_gestor()) or propietario_id = (select auth.uid()));

create policy appo_leads_update on public.appo_leads
  for update to authenticated
  using ((select public.es_gestor()) or propietario_id = (select auth.uid()))
  with check ((select public.es_gestor()) or propietario_id = (select auth.uid()));

create policy appo_leads_delete on public.appo_leads
  for delete to authenticated
  using ((select public.es_gestor()) or propietario_id = (select auth.uid()));
