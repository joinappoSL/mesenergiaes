-- =============================================================================
-- MESENERGIA CRM · 05 · RPC del dashboard
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Dashboard: KPIs, serie diaria, ranking y citas de instalación.
-- SECURITY INVOKER: cada rol solo agrega lo que puede ver.
-- -----------------------------------------------------------------------------
create or replace function public.dashboard(
  p_desde         date default null,
  p_hasta         date default null,
  p_equipo_id     uuid default null,
  p_comercial_id  uuid default null
)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_hoy    date := (now() at time zone 'Europe/Madrid')::date;
  v_desde  date := coalesce(p_desde, v_hoy - 29);
  v_hasta  date := coalesce(p_hasta, v_hoy);
  v_res    jsonb;
begin
  if public.mi_rol() is null then
    raise exception 'No autorizado' using errcode = 'insufficient_privilege';
  end if;
  if v_hasta < v_desde then
    raise exception 'La fecha "hasta" no puede ser anterior a "desde"';
  end if;
  if v_hasta - v_desde > 731 then
    v_desde := v_hasta - 731;
  end if;

  with base as (
    select c.*
    from public.contratos c
    where (p_equipo_id is null or c.equipo_id = p_equipo_id)
      and (p_comercial_id is null or c.comercial_id = p_comercial_id)
  ),
  rango as (
    select b.*, (b.created_at at time zone 'Europe/Madrid')::date as dia
    from base b
    where (b.created_at at time zone 'Europe/Madrid')::date between v_desde and v_hasta
  )
  select jsonb_build_object(
    'desde', v_desde,
    'hasta', v_hasta,
    'kpis', (
      select jsonb_build_object(
        'total',                 count(*),
        'pendiente',             count(*) filter (where r.estado = 'pendiente'),
        'activo',                count(*) filter (where r.estado = 'activo'),
        'riesgos',               count(*) filter (where r.estado = 'riesgos'),
        'cancelado',             count(*) filter (where r.estado = 'cancelado'),
        'firmados',              count(*) filter (where r.firmado),
        'pendientes_sin_firmar', count(*) filter (where r.estado = 'pendiente' and not r.firmado),
        'facturacion_activa',    coalesce(sum(r.precio_mensual) filter (where r.estado = 'activo'), 0)
      )
      from rango r
    ),
    'por_dia', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'fecha',     d.dia,
        'total',     coalesce(x.total, 0),
        'pendiente', coalesce(x.pendiente, 0),
        'activo',    coalesce(x.activo, 0),
        'riesgos',   coalesce(x.riesgos, 0),
        'cancelado', coalesce(x.cancelado, 0)
      ) order by d.dia), '[]'::jsonb)
      from (select gs::date as dia from generate_series(v_desde, v_hasta, interval '1 day') gs) d
      left join (
        select
          r.dia,
          count(*) as total,
          count(*) filter (where r.estado = 'pendiente') as pendiente,
          count(*) filter (where r.estado = 'activo') as activo,
          count(*) filter (where r.estado = 'riesgos') as riesgos,
          count(*) filter (where r.estado = 'cancelado') as cancelado
        from rango r
        group by r.dia
      ) x on x.dia = d.dia
    ),
    'ranking', (
      select coalesce(jsonb_agg(to_jsonb(k) order by k.activos desc, k.subidos desc, k.nombre), '[]'::jsonb)
      from (
        select
          r.comercial_id,
          coalesce(public.nombre_perfil(r.comercial_id), 'Sin comercial') as nombre,
          (select e.nombre from public.equipos e join public.profiles p on p.equipo_id = e.id where p.id = r.comercial_id) as equipo,
          count(*) as subidos,
          count(*) filter (where r.estado = 'activo') as activos,
          count(*) filter (where r.estado = 'pendiente') as pendientes,
          count(*) filter (where r.estado in ('riesgos', 'cancelado')) as perdidos,
          round(100.0 * count(*) filter (where r.estado = 'activo') / nullif(count(*), 0), 1) as ratio
        from rango r
        group by r.comercial_id
      ) k
    ),
    'citas', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id',        b.id,
        'numero',    b.numero,
        'cliente',   b.cliente_nombre || ' ' || b.cliente_apellidos,
        'poblacion', b.poblacion,
        'fecha',     b.instalacion_fecha,
        'franja',    b.instalacion_franja,
        'estado',    b.estado,
        'firmado',   b.firmado,
        'comercial', public.nombre_perfil(b.comercial_id)
      ) order by b.instalacion_fecha, b.instalacion_franja nulls last, b.numero), '[]'::jsonb)
      from base b
      where b.instalacion_fecha between v_hoy and v_hoy + 7
        and b.estado <> 'cancelado'
    )
  )
  into v_res;

  return v_res;
end;
$$;
