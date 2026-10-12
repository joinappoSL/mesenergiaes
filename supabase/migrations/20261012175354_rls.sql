-- =============================================================================
-- MESENERGIA CRM · 03 · Row Level Security
--   comercial  → solo sus contratos
--   jefe       → contratos de su equipo
--   backoffice → todo
--   admin      → todo
-- Un usuario desactivado no ve nada (mi_rol() devuelve NULL).
-- =============================================================================

alter table public.equipos                enable row level security;
alter table public.profiles               enable row level security;
alter table public.contratos              enable row level security;
alter table public.telefonos_portabilidad enable row level security;
alter table public.documentos             enable row level security;
alter table public.observaciones          enable row level security;
alter table public.historial_estados      enable row level security;
alter table public.llamadas               enable row level security;

-- El rol anónimo no tiene nada que hacer en estas tablas.
revoke all on public.equipos, public.profiles, public.contratos, public.telefonos_portabilidad,
  public.documentos, public.observaciones, public.historial_estados, public.llamadas from anon;

-- -----------------------------------------------------------------------------
-- profiles: las altas/ediciones se hacen desde la Edge Function (service_role)
-- -----------------------------------------------------------------------------
create policy profiles_select on public.profiles
  for select to authenticated
  using (
    id = (select auth.uid())
    or (select public.es_gestor())
    or ((select public.mi_rol()) = 'jefe_equipo' and equipo_id = (select public.mi_equipo()))
  );

revoke insert, update, delete on public.profiles from authenticated;

-- -----------------------------------------------------------------------------
-- equipos: lectura para cualquier usuario activo, gestión solo admin
-- -----------------------------------------------------------------------------
create policy equipos_select on public.equipos
  for select to authenticated
  using ((select public.mi_rol()) is not null);

create policy equipos_insert on public.equipos
  for insert to authenticated
  with check ((select public.mi_rol()) = 'admin');

create policy equipos_update on public.equipos
  for update to authenticated
  using ((select public.mi_rol()) = 'admin')
  with check ((select public.mi_rol()) = 'admin');

create policy equipos_delete on public.equipos
  for delete to authenticated
  using ((select public.mi_rol()) = 'admin');

-- -----------------------------------------------------------------------------
-- contratos
-- -----------------------------------------------------------------------------
create policy contratos_select on public.contratos
  for select to authenticated
  using (
    (select public.es_gestor())
    or ((select public.mi_rol()) = 'jefe_equipo' and equipo_id = (select public.mi_equipo()))
    or ((select public.mi_rol()) is not null and comercial_id = (select auth.uid()))
  );

create policy contratos_insert on public.contratos
  for insert to authenticated
  with check (
    (select public.es_gestor())
    or ((select public.mi_rol()) = 'comercial' and comercial_id = (select auth.uid()))
  );

create policy contratos_update on public.contratos
  for update to authenticated
  using (
    (select public.es_gestor())
    or (
      (select public.mi_rol()) = 'comercial'
      and comercial_id = (select auth.uid())
      and estado = 'pendiente'
      and not firmado
    )
  )
  with check (
    (select public.es_gestor())
    or (
      (select public.mi_rol()) = 'comercial'
      and comercial_id = (select auth.uid())
      and estado = 'pendiente'
      and not firmado
    )
  );

create policy contratos_delete on public.contratos
  for delete to authenticated
  using ((select public.mi_rol()) = 'admin');

-- -----------------------------------------------------------------------------
-- telefonos_portabilidad: igual que el contrato
-- -----------------------------------------------------------------------------
create policy telefonos_portabilidad_select on public.telefonos_portabilidad
  for select to authenticated
  using (public.puede_ver_contrato(contrato_id));

create policy telefonos_portabilidad_insert on public.telefonos_portabilidad
  for insert to authenticated
  with check (public.puede_editar_contrato(contrato_id));

create policy telefonos_portabilidad_update on public.telefonos_portabilidad
  for update to authenticated
  using (public.puede_editar_contrato(contrato_id))
  with check (public.puede_editar_contrato(contrato_id));

create policy telefonos_portabilidad_delete on public.telefonos_portabilidad
  for delete to authenticated
  using (public.puede_editar_contrato(contrato_id));

-- -----------------------------------------------------------------------------
-- documentos: no se borran ni se editan (las versiones se conservan)
-- -----------------------------------------------------------------------------
create policy documentos_select on public.documentos
  for select to authenticated
  using (public.puede_ver_contrato(contrato_id));

create policy documentos_insert on public.documentos
  for insert to authenticated
  with check (public.puede_editar_contrato(contrato_id));

revoke update, delete on public.documentos from authenticated;

-- -----------------------------------------------------------------------------
-- observaciones: cualquiera que vea el contrato puede añadir; nunca editar/borrar
-- -----------------------------------------------------------------------------
create policy observaciones_select on public.observaciones
  for select to authenticated
  using (public.puede_ver_contrato(contrato_id));

create policy observaciones_insert on public.observaciones
  for insert to authenticated
  with check (
    public.puede_ver_contrato(contrato_id)
    and autor_id = (select auth.uid())
    and not sistema
  );

revoke update, delete on public.observaciones from authenticated;

-- -----------------------------------------------------------------------------
-- historial_estados: solo lectura (lo escribe el trigger)
-- -----------------------------------------------------------------------------
create policy historial_estados_select on public.historial_estados
  for select to authenticated
  using (public.puede_ver_contrato(contrato_id));

revoke insert, update, delete on public.historial_estados from authenticated;

-- -----------------------------------------------------------------------------
-- llamadas: las registra backoffice/admin; las ve quien ve el contrato
-- -----------------------------------------------------------------------------
create policy llamadas_select on public.llamadas
  for select to authenticated
  using (public.puede_ver_contrato(contrato_id));

create policy llamadas_insert on public.llamadas
  for insert to authenticated
  with check (
    (select public.es_gestor())
    and public.puede_ver_contrato(contrato_id)
    and usuario_id = (select auth.uid())
  );

revoke update, delete on public.llamadas from authenticated;

-- -----------------------------------------------------------------------------
-- Funciones internas que no deben llamarse por la API
-- -----------------------------------------------------------------------------
revoke execute on function public.tg_handle_new_user() from public, anon, authenticated;
revoke execute on function public.marcar_password_cambiada() from public, anon;
grant execute on function public.marcar_password_cambiada() to authenticated;
