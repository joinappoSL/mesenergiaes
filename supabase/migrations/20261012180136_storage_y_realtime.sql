-- =============================================================================
-- MESENERGIA CRM · 06 · Storage (PDF de ofertas) y Realtime
-- =============================================================================

-- Bucket privado: solo PDF, máximo 10 MB. Ruta: {contrato_id}/{archivo}.pdf
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('contratos-pdf', 'contratos-pdf', false, 10485760, array['application/pdf'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Lectura (y por tanto URLs firmadas) con las mismas reglas que el contrato.
create policy contratos_pdf_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'contratos-pdf'
    and public.puede_ver_contrato(public.uuid_o_null((storage.foldername(name))[1]))
  );

-- Subida: quien puede editar el contrato. No hay UPDATE ni DELETE: cada
-- nueva versión es un objeto nuevo y las anteriores se conservan.
create policy contratos_pdf_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'contratos-pdf'
    and public.puede_editar_contrato(public.uuid_o_null((storage.foldername(name))[1]))
  );

-- Realtime: dashboards y fichas se actualizan solos (Realtime respeta RLS).
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table
      public.contratos,
      public.observaciones,
      public.llamadas,
      public.historial_estados,
      public.documentos;
  end if;
end;
$$;
