-- =============================================================================
-- MESENERGIA CRM · 08 · RPC guardar_contrato
-- Al editar, los teléfonos a portabilidad del contrato se sustituyen por la
-- lista enviada desde el formulario.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Alta / edición de un contrato con sus teléfonos a portabilidad en una sola
-- transacción. SECURITY INVOKER: se aplican las políticas RLS del usuario.
-- -----------------------------------------------------------------------------
create or replace function public.guardar_contrato(
  p_id           uuid,
  p_datos        jsonb,
  p_telefonos    jsonb default '[]'::jsonb,
  p_observacion  text default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  r     public.contratos;
  v_id  uuid;
begin
  r := jsonb_populate_record(null::public.contratos, p_datos);

  if p_id is null then
    insert into public.contratos (
      cliente_nombre, cliente_apellidos, documento_tipo, documento_numero, cliente_email,
      via_tipo, via_nombre, via_numero, escalera, piso, puerta, codigo_postal, poblacion, provincia,
      telefono_fijo, telefono_contacto,
      operadora, producto, precio_mensual, oferta_detalle,
      instalacion_fecha, instalacion_franja, iban, verificacion_at,
      comercial_id
    ) values (
      r.cliente_nombre, r.cliente_apellidos, coalesce(r.documento_tipo, 'DNI'), r.documento_numero, r.cliente_email,
      r.via_tipo, r.via_nombre, r.via_numero, r.escalera, r.piso, r.puerta, r.codigo_postal, r.poblacion, r.provincia,
      r.telefono_fijo, r.telefono_contacto,
      r.operadora, r.producto, r.precio_mensual, r.oferta_detalle,
      r.instalacion_fecha, r.instalacion_franja, r.iban, r.verificacion_at,
      r.comercial_id
    )
    returning id into v_id;
  else
    update public.contratos c set
      cliente_nombre     = r.cliente_nombre,
      cliente_apellidos  = r.cliente_apellidos,
      documento_tipo     = coalesce(r.documento_tipo, c.documento_tipo),
      documento_numero   = r.documento_numero,
      cliente_email      = r.cliente_email,
      via_tipo           = r.via_tipo,
      via_nombre         = r.via_nombre,
      via_numero         = r.via_numero,
      escalera           = r.escalera,
      piso               = r.piso,
      puerta             = r.puerta,
      codigo_postal      = r.codigo_postal,
      poblacion          = r.poblacion,
      provincia          = r.provincia,
      telefono_fijo      = r.telefono_fijo,
      telefono_contacto  = r.telefono_contacto,
      operadora          = r.operadora,
      producto           = r.producto,
      precio_mensual     = r.precio_mensual,
      oferta_detalle     = r.oferta_detalle,
      instalacion_fecha  = r.instalacion_fecha,
      instalacion_franja = r.instalacion_franja,
      iban               = r.iban,
      verificacion_at    = r.verificacion_at
    where c.id = p_id
    returning c.id into v_id;

    if v_id is null then
      raise exception 'No puedes editar este contrato: solo se puede modificar mientras esté Pendiente y sin firmar'
        using errcode = 'insufficient_privilege';
    end if;

    delete from public.telefonos_portabilidad t where t.contrato_id = v_id;
  end if;

  insert into public.telefonos_portabilidad (contrato_id, numero, tipo, operador_donante, orden)
  select
    v_id,
    e.elem ->> 'numero',
    coalesce(nullif(e.elem ->> 'tipo', ''), 'movil')::public.tipo_telefono,
    e.elem ->> 'operador_donante',
    e.ord::int
  from jsonb_array_elements(coalesce(p_telefonos, '[]'::jsonb)) with ordinality as e(elem, ord)
  where nullif(trim(coalesce(e.elem ->> 'numero', '')), '') is not null;

  if p_id is null and nullif(trim(coalesce(p_observacion, '')), '') is not null then
    insert into public.observaciones (contrato_id, autor_id, texto)
    values (v_id, auth.uid(), p_observacion);
  end if;

  return v_id;
end;
$$;

revoke execute on function public.guardar_contrato(uuid, jsonb, jsonb, text) from public, anon;
grant execute on function public.guardar_contrato(uuid, jsonb, jsonb, text) to authenticated, service_role;
