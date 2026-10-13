-- =============================================================================
-- MESENERGIA CRM · 10 · Claves de Messy en Supabase Vault
--
-- Alternativa a los secretos de Edge Functions: el token de Whapi y la clave de
-- la API de Claude se pueden guardar cifrados en Vault desde el SQL Editor:
--
--   select public.messy_guardar_secreto('messy_whapi_token', '...');
--   select public.messy_guardar_secreto('messy_anthropic_api_key', 'sk-ant-...');
--
-- Si existen los secretos WHAPI_TOKEN / ANTHROPIC_API_KEY de la Edge Function,
-- tienen prioridad.
-- =============================================================================

create or replace function public.messy_secreto(p_nombre text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select s.decrypted_secret
  from vault.decrypted_secrets s
  where p_nombre in ('messy_whapi_token', 'messy_anthropic_api_key')
    and s.name = p_nombre
  order by s.updated_at desc nulls last
  limit 1
$$;

create or replace function public.messy_guardar_secreto(p_nombre text, p_valor text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if p_nombre not in ('messy_whapi_token', 'messy_anthropic_api_key') then
    raise exception 'Nombre de secreto no válido: %', p_nombre;
  end if;
  if nullif(trim(coalesce(p_valor, '')), '') is null then
    raise exception 'El valor del secreto está vacío';
  end if;

  select s.id into v_id from vault.secrets s where s.name = p_nombre;
  if v_id is null then
    perform vault.create_secret(trim(p_valor), p_nombre, 'Messy');
  else
    perform vault.update_secret(v_id, trim(p_valor), p_nombre, 'Messy');
  end if;
end;
$$;

revoke execute on function public.messy_secreto(text), public.messy_guardar_secreto(text, text)
  from public, anon, authenticated;
grant execute on function public.messy_secreto(text) to service_role;
