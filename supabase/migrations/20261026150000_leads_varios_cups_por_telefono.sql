-- =============================================================================
-- MESENERGIA CRM · 21 · Prospección: un mismo teléfono puede tener varios CUPS
--
-- Una empresa con varios puntos de suministro aparece en el listado varias veces
-- (mismo teléfono, distinto CUPS) y cada fila tiene su propio consumo. La unicidad
-- por teléfono las descartaba al importar; ahora los duplicados se evitan en la
-- importación por CUPS (o por teléfono si el cliente no tiene CUPS).
-- =============================================================================
drop index if exists public.leads_propietario_telefono_uq;

create index if not exists leads_propietario_cups_idx on public.leads (propietario_id, cups) where cups <> '';
create index if not exists leads_propietario_telefono_idx on public.leads (propietario_id, telefono) where telefono <> '';
