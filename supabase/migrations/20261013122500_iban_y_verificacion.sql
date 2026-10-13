-- =============================================================================
-- MESENERGIA CRM · 11 · IBAN y verificación programada
--
-- · iban: cuenta bancaria del cliente (opcional), normalizada sin espacios y
--   validada con el dígito de control (mod 97).
-- · verificacion_at: fecha y hora de la llamada de verificación, que tiene que
--   ser como tarde el día de la cita de instalación.
-- =============================================================================

alter table public.contratos
  add column iban            text,
  add column verificacion_at timestamptz;

-- -----------------------------------------------------------------------------
-- Validación de IBAN (ISO 13616: mod 97 = 1). Los españoles tienen 24 caracteres.
-- -----------------------------------------------------------------------------
create or replace function public.es_iban_valido(p_iban text)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  v  text := upper(regexp_replace(coalesce(p_iban, ''), '[\s-]', '', 'g'));
  r  text;
  c  text;
  d  text;
  m  int := 0;
begin
  if v !~ '^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$' then
    return false;
  end if;
  if left(v, 2) = 'ES' and length(v) <> 24 then
    return false;
  end if;

  r := substr(v, 5) || substr(v, 1, 4);
  for i in 1 .. length(r) loop
    c := substr(r, i, 1);
    d := case when c ~ '[A-Z]' then (ascii(c) - 55)::text else c end;
    for j in 1 .. length(d) loop
      m := (m * 10 + substr(d, j, 1)::int) % 97;
    end loop;
  end loop;
  return m = 1;
end;
$$;

-- Se guarda siempre en mayúsculas y sin espacios
create or replace function public.tg_contratos_iban()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.iban := nullif(upper(regexp_replace(coalesce(new.iban, ''), '[\s-]', '', 'g')), '');
  return new;
end;
$$;

create trigger contratos_iban
  before insert or update of iban on public.contratos
  for each row execute function public.tg_contratos_iban();

alter table public.contratos
  add constraint contratos_iban_valido
    check (iban is null or public.es_iban_valido(iban)),
  add constraint contratos_verificacion_antes_instalacion
    check (
      verificacion_at is null
      or instalacion_fecha is null
      or (verificacion_at at time zone 'Europe/Madrid')::date <= instalacion_fecha
    );

-- -----------------------------------------------------------------------------
-- La vista añade las dos columnas al final (mismo orden que antes para el resto)
-- -----------------------------------------------------------------------------
create or replace view public.v_contratos
with (security_invoker = true)
as
select
  c.id, c.numero, c.cliente_nombre, c.cliente_apellidos, c.documento_tipo, c.documento_numero, c.cliente_email,
  c.via_tipo, c.via_nombre, c.via_numero, c.escalera, c.piso, c.puerta, c.codigo_postal, c.poblacion, c.provincia,
  c.telefono_fijo, c.telefono_contacto, c.operadora, c.producto, c.precio_mensual, c.oferta_detalle,
  c.instalacion_fecha, c.instalacion_franja, c.comercial_id, c.equipo_id, c.estado, c.motivo_estado, c.firmado,
  c.fecha_firma, c.ultima_llamada_at, c.ultimo_resultado_llamada, c.proxima_llamada_at, c.created_by,
  c.created_at, c.updated_at,
  public.nombre_perfil(c.comercial_id) as comercial_nombre,
  e.nombre as equipo_nombre,
  (select count(*) from public.documentos d where d.contrato_id = c.id)::int as num_documentos,
  (
    select string_agg(
      t.numero || ' · ' || case t.tipo when 'fijo' then 'Fijo' else 'Móvil' end
        || coalesce(' · ' || t.operador_donante, ''),
      ' | ' order by t.orden, t.created_at
    )
    from public.telefonos_portabilidad t
    where t.contrato_id = c.id
  ) as portabilidad_resumen,
  c.iban,
  c.verificacion_at
from public.contratos c
left join public.equipos e on e.id = c.equipo_id;

-- -----------------------------------------------------------------------------
-- Permisos
-- -----------------------------------------------------------------------------
revoke execute on function public.es_iban_valido(text) from public, anon;
grant execute on function public.es_iban_valido(text) to authenticated, service_role;
revoke execute on function public.tg_contratos_iban() from public, anon, authenticated;
