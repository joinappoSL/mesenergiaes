-- =============================================================================
-- MESENERGIA CRM · 12 · Objetivo mensual de reservas de plaza (Messy)
--
-- · objetivo_mes: reservas de plaza que el equipo quiere hacer en el mes.
-- · ajuste_mes / ajuste_mes_inicio: reservas del mes que no están en el CRM
--   (p. ej. las hechas antes de empezar a usarlo). Solo cuentan en ese mes.
-- · messy_progreso_mes(): llevamos / objetivo, quedan y porcentajes, con todas
--   las reservas del equipo en conjunto.
-- =============================================================================

alter table public.messy_config
  add column objetivo_mes      integer not null default 50 check (objetivo_mes > 0),
  add column ajuste_mes        integer not null default 0 check (ajuste_mes >= 0),
  add column ajuste_mes_inicio date;

create or replace function public.messy_progreso_mes(p_fecha date default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  c         public.messy_config;
  v_inicio  date := date_trunc('month', coalesce(p_fecha, (now() at time zone 'Europe/Madrid')::date))::date;
  v_fin     date := (date_trunc('month', coalesce(p_fecha, (now() at time zone 'Europe/Madrid')::date)) + interval '1 month')::date;
  v_crm     int;
  v_ajuste  int;
  v_total   int;
  v_quedan  int;
begin
  select * into c from public.messy_config where id = 1;

  select count(*)::int into v_crm
  from public.contratos k
  where (k.created_at at time zone 'Europe/Madrid')::date >= v_inicio
    and (k.created_at at time zone 'Europe/Madrid')::date < v_fin;

  v_ajuste := case when c.ajuste_mes_inicio = v_inicio then c.ajuste_mes else 0 end;
  v_total  := v_crm + v_ajuste;
  v_quedan := greatest(c.objetivo_mes - v_total, 0);

  return jsonb_build_object(
    'mes',        to_char(v_inicio, 'YYYY-MM'),
    'objetivo',   c.objetivo_mes,
    'llevamos',   v_total,
    'en_crm',     v_crm,
    'ajuste',     v_ajuste,
    'quedan',     v_quedan,
    'pct_hecho',  least(round(100.0 * v_total / c.objetivo_mes), 100)::int,
    'pct_quedan', round(100.0 * v_quedan / c.objetivo_mes)::int,
    'dias_restantes', (v_fin - (now() at time zone 'Europe/Madrid')::date)
  );
end;
$$;

revoke execute on function public.messy_progreso_mes(date) from public, anon, authenticated;
grant execute on function public.messy_progreso_mes(date) to service_role;
