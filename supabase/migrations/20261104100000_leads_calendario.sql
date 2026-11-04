-- =============================================================================
-- MESENERGIA CRM · Prospección: calendario de renovaciones y reuniones
--
-- · leads.contrato_luz_fin / contrato_gas_fin: fecha en la que acaba el contrato
--   actual del cliente (sale en la factura) → el calendario avisa para llamarle.
-- · leads_reuniones: reuniones con el cliente (videollamada o presencial) con
--   lugar/enlace, notas y estado.
-- · leads_archivos.reunion_id: lo preparado para la reunión (adjuntos).
-- =============================================================================

alter table public.leads
  add column contrato_luz_fin date,
  add column contrato_gas_fin date;

create index leads_contrato_luz_fin_idx on public.leads (contrato_luz_fin) where contrato_luz_fin is not null;
create index leads_contrato_gas_fin_idx on public.leads (contrato_gas_fin) where contrato_gas_fin is not null;

create table public.leads_reuniones (
  id          uuid primary key default gen_random_uuid(),
  lead_id     uuid not null references public.leads (id) on delete cascade,
  usuario_id  uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  fecha       timestamptz not null,
  modalidad   text not null check (modalidad in ('videollamada', 'presencial')),
  -- dirección (presencial) o enlace de la videollamada
  lugar       text not null default '',
  notas       text not null default '',
  estado      text not null default 'programada' check (estado in ('programada', 'hecha', 'cancelada')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index leads_reuniones_lead_idx on public.leads_reuniones (lead_id, fecha desc);
create index leads_reuniones_fecha_idx on public.leads_reuniones (fecha);

create trigger leads_reuniones_updated_at
  before update on public.leads_reuniones
  for each row execute function public.tg_set_updated_at();

alter table public.leads_reuniones enable row level security;
revoke all on public.leads_reuniones from anon;

create policy leads_reuniones_select on public.leads_reuniones
  for select to authenticated
  using (public.puede_ver_lead(lead_id));

create policy leads_reuniones_insert on public.leads_reuniones
  for insert to authenticated
  with check (public.puede_editar_lead(lead_id) and usuario_id = (select auth.uid()));

create policy leads_reuniones_update on public.leads_reuniones
  for update to authenticated
  using (public.puede_editar_lead(lead_id))
  with check (public.puede_editar_lead(lead_id));

create policy leads_reuniones_delete on public.leads_reuniones
  for delete to authenticated
  using (public.puede_editar_lead(lead_id));

-- Adjuntos de la reunión (lo preparado): mismo bucket, tipo «reunion»
alter table public.leads_archivos
  add column reunion_id uuid references public.leads_reuniones (id) on delete cascade;

alter table public.leads_archivos drop constraint leads_archivos_tipo_check;
alter table public.leads_archivos
  add constraint leads_archivos_tipo_check check (tipo in ('factura', 'comparativa', 'otro', 'reunion'));

create index leads_archivos_reunion_idx on public.leads_archivos (reunion_id) where reunion_id is not null;

-- La preparación suele ser una presentación o un Word
update storage.buckets
   set allowed_mime_types = (
     select array_agg(distinct t) from unnest(
       allowed_mime_types || array[
         'application/vnd.openxmlformats-officedocument.presentationml.presentation',
         'application/vnd.ms-powerpoint',
         'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
         'application/msword',
         'text/plain'
       ]) as t)
 where id = 'leads-archivos';
