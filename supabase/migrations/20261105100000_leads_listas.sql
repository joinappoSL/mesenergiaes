-- =============================================================================
-- MESENERGIA CRM · Prospección: listas (módulos) que existen aunque estén vacías
--
-- Un «módulo» era solo una etiqueta de los leads, así que no se veía hasta tener
-- leads. leads_listas guarda las listas creadas a mano (de cada cartera) para que
-- salgan en el selector y se puedan llenar importando, añadiendo clientes o
-- moviendo leads desde la Lista.
-- =============================================================================

create table public.leads_listas (
  id              uuid primary key default gen_random_uuid(),
  nombre          text not null check (length(btrim(nombre)) > 0),
  propietario_id  uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  created_at      timestamptz not null default now(),
  unique (propietario_id, nombre)
);

alter table public.leads_listas enable row level security;
revoke all on public.leads_listas from anon;

create policy leads_listas_select on public.leads_listas
  for select to authenticated
  using (
    (select public.es_gestor())
    or ((select public.mi_rol()) is not null and propietario_id = (select auth.uid()))
    or public.es_de_mi_equipo(propietario_id)
  );

create policy leads_listas_insert on public.leads_listas
  for insert to authenticated
  with check (
    (select public.es_gestor())
    or ((select public.mi_rol()) is not null and propietario_id = (select auth.uid()))
  );

create policy leads_listas_delete on public.leads_listas
  for delete to authenticated
  using (
    (select public.es_gestor())
    or ((select public.mi_rol()) is not null and propietario_id = (select auth.uid()))
  );

revoke update on public.leads_listas from authenticated;

-- Listas de partida: «Carlitos sin utilizar» de Mario y de Gabriela
insert into public.leads_listas (nombre, propietario_id)
select 'Carlitos sin utilizar ' || p.nombre, p.id
from public.profiles p
where p.email in ('mario.garcia@mesenergia.es', 'gabriela.santamaria@mesenergia.es')
on conflict do nothing;
