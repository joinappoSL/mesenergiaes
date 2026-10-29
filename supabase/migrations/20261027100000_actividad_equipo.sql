-- =============================================================================
-- MESENERGIA CRM · 22 · Datos del equipo (cierres del día y registros de actividad)
--
-- Un registro por hecho: una llamada o tanda de llamadas, un correo enviado con la
-- presentación, una factura recibida, una cita, una venta, una verificación…
-- Permisos: cada persona ve y crea lo suyo; admin y backoffice, todo; el jefe de
-- equipo ve (solo lectura) lo de su equipo y lo del equipo en general.
-- Solo se añade una tabla nueva.
-- =============================================================================

create table public.actividad_equipo (
  id          uuid primary key default gen_random_uuid(),
  ocurrio_at  timestamptz not null default now(),
  -- quién lo hizo; null = dato del equipo en conjunto
  persona_id  uuid references public.profiles (id) on delete set null,
  -- nombre para mostrar cuando no hay persona (o la persona ya no existe)
  autor       text not null default '',
  tipo        text not null check (tipo in (
                'llamadas', 'seguimiento', 'no_atiende',
                'correo_enviado', 'factura_recibida', 'cita',
                'venta_cargada', 'venta', 'venta_anulada',
                'verificacion_firmada', 'verificacion_rechazada', 'verificacion_no_contesta',
                'nota')),
  empresa     text not null default '',
  contacto    text not null default '',
  detalle     text not null default '',
  cantidad    integer not null default 1 check (cantidad >= 1),
  fuente      text not null default 'manual',
  creado_por  uuid default auth.uid(),
  created_at  timestamptz not null default now()
);

create index actividad_equipo_ocurrio_idx on public.actividad_equipo (ocurrio_at desc);
create index actividad_equipo_persona_idx on public.actividad_equipo (persona_id, ocurrio_at desc);

alter table public.actividad_equipo enable row level security;
revoke all on public.actividad_equipo from anon;

create policy actividad_equipo_select on public.actividad_equipo
  for select to authenticated
  using (
    (select public.es_gestor())
    or ((select public.mi_rol()) is not null and (persona_id = (select auth.uid()) or creado_por = (select auth.uid())))
    or ((select public.mi_rol()) = 'jefe_equipo' and (persona_id is null or public.es_de_mi_equipo(persona_id)))
  );

create policy actividad_equipo_insert on public.actividad_equipo
  for insert to authenticated
  with check (
    (select public.es_gestor())
    or ((select public.mi_rol()) is not null and persona_id = (select auth.uid()) and creado_por = (select auth.uid()))
  );

create policy actividad_equipo_update on public.actividad_equipo
  for update to authenticated
  using (
    (select public.es_gestor())
    or ((select public.mi_rol()) is not null and persona_id = (select auth.uid()))
  )
  with check (
    (select public.es_gestor())
    or persona_id = (select auth.uid())
  );

create policy actividad_equipo_delete on public.actividad_equipo
  for delete to authenticated
  using (
    (select public.es_gestor())
    or ((select public.mi_rol()) is not null and persona_id = (select auth.uid()))
  );
