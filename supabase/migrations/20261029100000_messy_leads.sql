-- =============================================================================
-- MESENERGIA CRM · Messy ↔ Prospección
--
-- · Cada avance de un lead (correo enviado, facturas recibidas, comparativa,
--   visita, firmado) avisa a Messy, que lo publica en el grupo.
-- · messy_resumen_leads_dia(): desglose del día por comercial para el cierre
--   (llamadas, correos y a quién, facturas, comparativas, visitas, firmados).
-- · Por decisión del equipo se nombra la empresa/cliente en el grupo; nunca
--   teléfonos, correos ni direcciones. Se puede apagar con leads_nombres_en_grupo.
-- =============================================================================

alter table public.messy_config
  add column leads_avisos           boolean not null default true,
  add column leads_avisar_correos   boolean not null default true,
  add column leads_nombres_en_grupo boolean not null default true;

alter table public.messy_eventos
  drop constraint messy_eventos_tipo_check,
  add constraint messy_eventos_tipo_check check (tipo in ('venta', 'buenos_dias', 'cierre', 'lead')),
  add column lead_evento_id uuid references public.leads_eventos (id) on delete cascade;

-- -----------------------------------------------------------------------------
-- Avance de un lead → evento. Nunca impide guardar.
-- -----------------------------------------------------------------------------
create or replace function public.tg_messy_lead_evento()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.messy_config;
begin
  if new.estado is null or new.estado not in ('correo', 'facturas', 'comparativa', 'visita', 'firmado') then
    return null;
  end if;

  begin
    select * into c from public.messy_config where id = 1;
    if not found or not c.leads_avisos or (new.estado = 'correo' and not c.leads_avisar_correos) then
      return null;
    end if;

    insert into public.messy_eventos (tipo, clave, lead_evento_id)
    values ('lead', 'lead:' || new.id, new.id)
    on conflict (clave) do nothing;

    perform public.messy_despertar();
  exception when others then
    raise warning 'Messy no ha podido registrar el avance del lead %: %', new.lead_id, sqlerrm;
  end;

  return null;
end;
$$;

create trigger leads_eventos_messy
  after insert on public.leads_eventos
  for each row execute function public.tg_messy_lead_evento();

-- -----------------------------------------------------------------------------
-- Datos del aviso de un avance
-- -----------------------------------------------------------------------------
create or replace function public.messy_datos_lead(p_lead_evento_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'estado',  e.estado,
    'persona', public.messy_nombre(e.usuario_id),
    'cliente', case when c.leads_nombres_en_grupo then nullif(trim(l.nombre), '') end,
    'modulo',  nullif(trim(l.modulo), '')
  )
  from public.leads_eventos e
  join public.leads l on l.id = e.lead_id
  cross join public.messy_config c
  where e.id = p_lead_evento_id and c.id = 1
$$;

-- -----------------------------------------------------------------------------
-- Desglose del día por comercial (hora de Madrid)
-- -----------------------------------------------------------------------------
create or replace function public.messy_resumen_leads_dia(p_fecha date default null)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with d as (
    select coalesce(p_fecha, (now() at time zone 'Europe/Madrid')::date) as dia
  ),
  cfg as (select leads_nombres_en_grupo as nombres from public.messy_config where id = 1),
  ev as (
    select e.usuario_id, e.estado, e.lead_id, e.created_at,
           case when (select nombres from cfg) then nullif(trim(l.nombre), '') end as cliente
    from public.leads_eventos e
    join public.leads l on l.id = e.lead_id, d
    where e.estado is not null
      and (e.created_at at time zone 'Europe/Madrid')::date = d.dia
  ),
  por_persona as (
    select ev.usuario_id,
      count(*) filter (where ev.estado in ('no_contesta', 'no_existe', 'volver_a_llamar', 'rechazado', 'correo')) as llamadas,
      count(*) filter (where ev.estado = 'no_contesta')     as no_contesta,
      count(*) filter (where ev.estado = 'no_existe')       as no_existe,
      count(*) filter (where ev.estado = 'volver_a_llamar') as volver_a_llamar,
      count(*) filter (where ev.estado = 'rechazado')       as rechazados,
      count(*) filter (where ev.estado = 'visita')          as visitas,
      coalesce(jsonb_agg(distinct coalesce(ev.cliente, 'cliente sin nombre')) filter (where ev.estado = 'correo'), '[]') as correos,
      coalesce(jsonb_agg(distinct coalesce(ev.cliente, 'cliente sin nombre')) filter (where ev.estado = 'facturas'), '[]') as facturas,
      coalesce(jsonb_agg(distinct coalesce(ev.cliente, 'cliente sin nombre')) filter (where ev.estado = 'comparativa'), '[]') as comparativas,
      coalesce(jsonb_agg(distinct coalesce(ev.cliente, 'cliente sin nombre')) filter (where ev.estado = 'firmado'), '[]') as firmados,
      count(*) filter (where ev.estado = 'correo') as n_correos,
      count(*) filter (where ev.estado = 'facturas') as n_facturas,
      count(*) filter (where ev.estado = 'comparativa') as n_comparativas,
      count(*) filter (where ev.estado = 'firmado') as n_firmados
    from ev
    group by ev.usuario_id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'persona', public.messy_nombre(p.usuario_id),
      'llamadas', p.llamadas, 'no_contesta', p.no_contesta, 'no_existe', p.no_existe,
      'volver_a_llamar', p.volver_a_llamar, 'rechazados', p.rechazados, 'visitas', p.visitas,
      'correos', p.correos, 'n_correos', p.n_correos,
      'facturas', p.facturas, 'n_facturas', p.n_facturas,
      'comparativas', p.comparativas, 'n_comparativas', p.n_comparativas,
      'firmados', p.firmados, 'n_firmados', p.n_firmados
    ) order by p.llamadas desc, p.n_firmados desc), '[]'::jsonb)
  from por_persona p
$$;

revoke execute on function
  public.tg_messy_lead_evento(),
  public.messy_datos_lead(uuid),
  public.messy_resumen_leads_dia(date)
from public, anon, authenticated;

grant execute on function
  public.messy_datos_lead(uuid),
  public.messy_resumen_leads_dia(date)
to service_role;
