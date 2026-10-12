-- =============================================================================
-- MESENERGIA CRM · 01 · Esquema base
-- Tipos, tablas e índices.
-- =============================================================================

create extension if not exists pgcrypto with schema extensions;
create extension if not exists unaccent with schema extensions;

-- -----------------------------------------------------------------------------
-- Tipos enumerados
-- -----------------------------------------------------------------------------
create type public.rol_usuario as enum ('admin', 'backoffice', 'jefe_equipo', 'comercial');
create type public.estado_contrato as enum ('pendiente', 'activo', 'riesgos', 'cancelado');
create type public.tipo_documento as enum ('DNI', 'NIE');
create type public.tipo_telefono as enum ('fijo', 'movil');
create type public.resultado_llamada as enum ('no_contesta', 'contactado', 'volver_a_llamar', 'firmado', 'rechaza');

-- -----------------------------------------------------------------------------
-- Validación de DNI / NIE (letra de control)
-- -----------------------------------------------------------------------------
create or replace function public.es_documento_valido(p_tipo public.tipo_documento, p_numero text)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_letras constant text := 'TRWAGMYFPDXBNJZSQVHLCKE';
  v_digitos text;
begin
  if p_tipo is null or p_numero is null then
    return false;
  end if;

  if p_tipo = 'DNI' then
    if p_numero !~ '^[0-9]{8}[A-Z]$' then
      return false;
    end if;
    v_digitos := substr(p_numero, 1, 8);
  else
    if p_numero !~ '^[XYZ][0-9]{7}[A-Z]$' then
      return false;
    end if;
    v_digitos := translate(substr(p_numero, 1, 1), 'XYZ', '012') || substr(p_numero, 2, 7);
  end if;

  return substr(v_letras, (v_digitos::bigint % 23)::int + 1, 1) = right(p_numero, 1);
end;
$$;

-- Deja solo dígitos y quita el prefijo internacional de España (+34 / 0034).
create or replace function public.normalizar_telefono(p_telefono text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v text;
begin
  if p_telefono is null then
    return null;
  end if;
  v := regexp_replace(p_telefono, '[^0-9]', '', 'g');
  if v = '' then
    return null;
  end if;
  if length(v) = 13 and left(v, 4) = '0034' then
    v := substr(v, 5);
  elsif length(v) = 11 and left(v, 2) = '34' then
    v := substr(v, 3);
  end if;
  return v;
end;
$$;

-- -----------------------------------------------------------------------------
-- Equipos y perfiles
-- -----------------------------------------------------------------------------
create table public.equipos (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null check (length(trim(nombre)) > 0),
  jefe_id     uuid,
  created_at  timestamptz not null default now()
);
create unique index equipos_nombre_key on public.equipos (lower(nombre));

create table public.profiles (
  id                      uuid primary key references auth.users (id) on delete cascade,
  nombre                  text not null default '',
  apellidos               text not null default '',
  email                   text not null,
  telefono                text,
  rol                     public.rol_usuario not null default 'comercial',
  equipo_id               uuid references public.equipos (id) on delete set null,
  activo                  boolean not null default true,
  debe_cambiar_password   boolean not null default false,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);
create index profiles_equipo_idx on public.profiles (equipo_id);
create index profiles_rol_idx on public.profiles (rol);

alter table public.equipos
  add constraint equipos_jefe_fk foreign key (jefe_id) references public.profiles (id) on delete set null;
-- Un jefe solo dirige un equipo.
create unique index equipos_jefe_key on public.equipos (jefe_id) where jefe_id is not null;

-- -----------------------------------------------------------------------------
-- Contratos
-- -----------------------------------------------------------------------------
create table public.contratos (
  id                        uuid primary key default gen_random_uuid(),
  numero                    bigint generated always as identity unique,

  -- Cliente
  cliente_nombre            text not null check (length(trim(cliente_nombre)) > 0),
  cliente_apellidos         text not null check (length(trim(cliente_apellidos)) > 0),
  documento_tipo            public.tipo_documento not null default 'DNI',
  documento_numero          text not null,
  cliente_email             text,

  -- Dirección
  via_tipo                  text not null default 'Calle',
  via_nombre                text not null check (length(trim(via_nombre)) > 0),
  via_numero                text not null check (length(trim(via_numero)) > 0),
  escalera                  text,
  piso                      text,
  puerta                    text,
  codigo_postal             text not null check (codigo_postal ~ '^[0-9]{5}$'),
  poblacion                 text not null check (length(trim(poblacion)) > 0),
  provincia                 text not null check (length(trim(provincia)) > 0),

  -- Teléfonos
  telefono_fijo             text check (telefono_fijo is null or telefono_fijo ~ '^[0-9]{9}$'),
  telefono_contacto         text not null check (telefono_contacto ~ '^[0-9]{9}$'),

  -- Oferta
  operadora                 text not null default 'Avatel',
  producto                  text,
  precio_mensual            numeric(10, 2) check (precio_mensual is null or precio_mensual >= 0),
  oferta_detalle            text,

  -- Instalación
  instalacion_fecha         date,
  instalacion_franja        text,

  -- Gestión
  comercial_id              uuid references public.profiles (id) on delete set null,
  equipo_id                 uuid references public.equipos (id) on delete set null,
  estado                    public.estado_contrato not null default 'pendiente',
  motivo_estado             text,
  firmado                   boolean not null default false,
  fecha_firma               timestamptz,

  -- Cola de backoffice (desnormalizado desde llamadas)
  ultima_llamada_at         timestamptz,
  ultimo_resultado_llamada  public.resultado_llamada,
  proxima_llamada_at        timestamptz,

  created_by                uuid references public.profiles (id) on delete set null,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),

  constraint contratos_documento_valido check (public.es_documento_valido(documento_tipo, documento_numero)),
  constraint contratos_email_valido check (cliente_email is null or cliente_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  constraint contratos_motivo_obligatorio check (
    estado not in ('cancelado', 'riesgos') or length(trim(coalesce(motivo_estado, ''))) > 0
  )
);

create index contratos_documento_idx on public.contratos (documento_numero);
create index contratos_telefono_contacto_idx on public.contratos (telefono_contacto);
create index contratos_telefono_fijo_idx on public.contratos (telefono_fijo);
create index contratos_comercial_idx on public.contratos (comercial_id);
create index contratos_equipo_idx on public.contratos (equipo_id);
create index contratos_estado_idx on public.contratos (estado);
create index contratos_created_at_idx on public.contratos (created_at desc);
create index contratos_instalacion_idx on public.contratos (instalacion_fecha);
create index contratos_proxima_llamada_idx on public.contratos (proxima_llamada_at) where estado = 'pendiente';

-- -----------------------------------------------------------------------------
-- Teléfonos a portabilidad
-- -----------------------------------------------------------------------------
create table public.telefonos_portabilidad (
  id                uuid primary key default gen_random_uuid(),
  contrato_id       uuid not null references public.contratos (id) on delete cascade,
  numero            text not null check (numero ~ '^[0-9]{9}$'),
  tipo              public.tipo_telefono not null default 'movil',
  operador_donante  text,
  orden             int not null default 0,
  created_at        timestamptz not null default now()
);
create index telefonos_portabilidad_contrato_idx on public.telefonos_portabilidad (contrato_id);
create index telefonos_portabilidad_numero_idx on public.telefonos_portabilidad (numero);

-- -----------------------------------------------------------------------------
-- Documentos (PDF de la oferta, con versiones)
-- -----------------------------------------------------------------------------
create table public.documentos (
  id                 uuid primary key default gen_random_uuid(),
  contrato_id        uuid not null references public.contratos (id) on delete cascade,
  storage_path       text not null unique,
  nombre_archivo     text not null,
  tamano_bytes       bigint check (tamano_bytes is null or tamano_bytes <= 10485760),
  version            int not null default 1,
  subido_por         uuid references public.profiles (id) on delete set null,
  subido_por_nombre  text,
  created_at         timestamptz not null default now(),
  constraint documentos_path_en_carpeta_contrato check (storage_path like contrato_id::text || '/%')
);
create index documentos_contrato_idx on public.documentos (contrato_id, version desc);

-- -----------------------------------------------------------------------------
-- Observaciones (hilo, solo se añaden)
-- -----------------------------------------------------------------------------
create table public.observaciones (
  id            uuid primary key default gen_random_uuid(),
  contrato_id   uuid not null references public.contratos (id) on delete cascade,
  autor_id      uuid references public.profiles (id) on delete set null,
  autor_nombre  text,
  autor_rol     public.rol_usuario,
  texto         text not null check (length(trim(texto)) > 0 and length(texto) <= 5000),
  sistema       boolean not null default false,
  created_at    timestamptz not null default now()
);
create index observaciones_contrato_idx on public.observaciones (contrato_id, created_at);

-- -----------------------------------------------------------------------------
-- Historial de estados
-- -----------------------------------------------------------------------------
create table public.historial_estados (
  id               uuid primary key default gen_random_uuid(),
  contrato_id      uuid not null references public.contratos (id) on delete cascade,
  estado_anterior  public.estado_contrato,
  estado_nuevo     public.estado_contrato not null,
  motivo           text,
  usuario_id       uuid references public.profiles (id) on delete set null,
  usuario_nombre   text,
  created_at       timestamptz not null default now()
);
create index historial_estados_contrato_idx on public.historial_estados (contrato_id, created_at);

-- -----------------------------------------------------------------------------
-- Registro de llamadas (backoffice)
-- -----------------------------------------------------------------------------
create table public.llamadas (
  id                  uuid primary key default gen_random_uuid(),
  contrato_id         uuid not null references public.contratos (id) on delete cascade,
  resultado           public.resultado_llamada not null,
  nota                text check (nota is null or length(nota) <= 2000),
  volver_a_llamar_at  timestamptz,
  usuario_id          uuid references public.profiles (id) on delete set null,
  usuario_nombre      text,
  created_at          timestamptz not null default now(),
  constraint llamadas_recordatorio_obligatorio check (
    resultado <> 'volver_a_llamar' or volver_a_llamar_at is not null
  )
);
create index llamadas_contrato_idx on public.llamadas (contrato_id, created_at desc);
