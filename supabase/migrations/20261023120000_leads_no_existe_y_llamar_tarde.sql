-- =============================================================================
-- MESENERGIA CRM · 19 · Prospección: «No existe teléfono» y «Llamar más tarde»
--
-- · Dos estados nuevos para los leads: no_existe y volver_a_llamar.
-- · proxima_llamada_at: la hora a la que hay que volver a llamar.
-- Solo se amplía lo añadido en la migración 17: no se toca nada de contratos.
-- =============================================================================

alter table public.leads drop constraint leads_estado_check;
alter table public.leads add constraint leads_estado_check
  check (estado in ('pendiente', 'no_contesta', 'no_existe', 'volver_a_llamar', 'rechazado', 'correo', 'facturas', 'comparativa'));

alter table public.leads_eventos drop constraint leads_eventos_estado_check;
alter table public.leads_eventos add constraint leads_eventos_estado_check
  check (estado in ('pendiente', 'no_contesta', 'no_existe', 'volver_a_llamar', 'rechazado', 'correo', 'facturas', 'comparativa'));

alter table public.leads add column proxima_llamada_at timestamptz;

create index leads_proxima_llamada_idx
  on public.leads (propietario_id, proxima_llamada_at)
  where estado = 'volver_a_llamar';
