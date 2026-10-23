-- =============================================================================
-- MESENERGIA CRM · 18 · Permisos de ejecución de las funciones de leads
-- Las funciones de permisos de la prospección solo para usuarios autenticados
-- (nada para anon), igual que el resto de funciones auxiliares de RLS.
-- =============================================================================
revoke execute on function
  public.puede_ver_lead(uuid),
  public.puede_editar_lead(uuid),
  public.es_de_mi_equipo(uuid)
from public, anon;

grant execute on function
  public.puede_ver_lead(uuid),
  public.puede_editar_lead(uuid),
  public.es_de_mi_equipo(uuid)
to authenticated;
