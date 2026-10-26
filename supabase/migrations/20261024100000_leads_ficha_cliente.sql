-- =============================================================================
-- MESENERGIA CRM · 20 · Prospección: ficha de cliente, módulos y fechas
--
-- · modulo: lote de carga del listado (p. ej. el código postal 08017).
-- · Fechas del proceso: facturas recibidas, comparativa enviada, visita, firma.
-- · Estados nuevos: visita (visita programada) y firmado (cliente cerrado).
-- Solo se amplía lo añadido en las migraciones 17 y 19.
-- =============================================================================

alter table public.leads
  add column modulo                text not null default '',
  add column facturas_recibidas_at timestamptz,
  add column comparativa_enviada_at timestamptz,
  add column visita_at             timestamptz,
  add column visita_lugar          text not null default '',
  add column visita_notas          text not null default '',
  add column firmado_at            timestamptz;

alter table public.leads drop constraint leads_estado_check;
alter table public.leads add constraint leads_estado_check
  check (estado in ('pendiente', 'no_contesta', 'no_existe', 'volver_a_llamar', 'rechazado',
                    'correo', 'facturas', 'comparativa', 'visita', 'firmado'));

alter table public.leads_eventos drop constraint leads_eventos_estado_check;
alter table public.leads_eventos add constraint leads_eventos_estado_check
  check (estado in ('pendiente', 'no_contesta', 'no_existe', 'volver_a_llamar', 'rechazado',
                    'correo', 'facturas', 'comparativa', 'visita', 'firmado'));

create index leads_propietario_modulo_idx on public.leads (propietario_id, modulo);
create index leads_visita_idx on public.leads (visita_at) where visita_at is not null;

-- Los leads que ya estaban en seguimiento conservan sus fechas: se rellenan
-- con el último movimiento si el estado ya las implicaba.
update public.leads set facturas_recibidas_at = ultimo_movimiento_at
  where estado = 'facturas' and facturas_recibidas_at is null;
update public.leads set comparativa_enviada_at = ultimo_movimiento_at
  where estado = 'comparativa' and comparativa_enviada_at is null;
