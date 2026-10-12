-- =============================================================================
-- MESENERGIA CRM · 07 · Permisos de ejecución de funciones
-- Nada para anon. Los RPC y las funciones auxiliares de RLS, solo para usuarios
-- autenticados. Las funciones de trigger no se pueden llamar por la API (los
-- triggers se ejecutan igualmente: no requieren EXECUTE).
-- =============================================================================
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;

revoke execute on function
  public.tg_handle_new_user(),
  public.tg_set_updated_at(),
  public.tg_equipos_before(),
  public.tg_equipos_after(),
  public.tg_contratos_normalizar(),
  public.tg_contratos_auditoria(),
  public.tg_telefonos_portabilidad_normalizar(),
  public.tg_observaciones_autor(),
  public.tg_llamadas_autor(),
  public.tg_llamadas_actualizar_contrato(),
  public.tg_documentos_autor()
from authenticated;

-- Las funciones nuevas que se creen en public no serán ejecutables por anon.
alter default privileges in schema public revoke execute on functions from public, anon;
