-- =============================================================================
-- MESENERGIA CRM · Datos de ejemplo
--   · 1 admin inicial (debe cambiar la contraseña en el primer acceso)
--   · Gabriela (backoffice), 2 jefes de equipo y 4 comerciales de prueba
--   · 2 equipos y 10 contratos ficticios repartidos entre los 4 estados
--
-- Contraseña de TODOS los usuarios de ejemplo: Mesenergia2026!
-- Cámbiala (o desactiva los usuarios de prueba) antes de usar la app en real.
-- =============================================================================

-- Equipos (el jefe se asigna cuando existen los usuarios)
insert into public.equipos (id, nombre) values
  ('e0000000-0000-4000-a000-000000000001', 'Equipo Norte'),
  ('e0000000-0000-4000-a000-000000000002', 'Equipo Sur')
on conflict (id) do nothing;

-- -----------------------------------------------------------------------------
-- Usuarios de Supabase Auth (el trigger on_auth_user_created crea el perfil)
-- -----------------------------------------------------------------------------
with usuarios (id, email, nombre, apellidos, telefono, rol, equipo_id, cambiar) as (
  values
    ('00000000-0000-4000-a000-000000000001'::uuid, 'admin@mesenergia.es',        'Administración', 'MESENERGIA',      '910000001', 'admin',       null,                                    true),
    ('00000000-0000-4000-a000-000000000002'::uuid, 'gabriela@mesenergia.es',     'Gabriela',       'Martín Ruiz',     '910000002', 'backoffice',  null,                                    false),
    ('00000000-0000-4000-a000-000000000003'::uuid, 'jefe.norte@mesenergia.es',   'Carlos',         'Navarro Gil',     '600000003', 'jefe_equipo', 'e0000000-0000-4000-a000-000000000001', false),
    ('00000000-0000-4000-a000-000000000004'::uuid, 'jefe.sur@mesenergia.es',     'Lucía',          'Ortega Sanz',     '600000004', 'jefe_equipo', 'e0000000-0000-4000-a000-000000000002', false),
    ('00000000-0000-4000-a000-000000000005'::uuid, 'javier@mesenergia.es',       'Javier',         'Moreno Díaz',     '600000005', 'comercial',   'e0000000-0000-4000-a000-000000000001', false),
    ('00000000-0000-4000-a000-000000000006'::uuid, 'marta@mesenergia.es',        'Marta',          'Iglesias Rubio',  '600000006', 'comercial',   'e0000000-0000-4000-a000-000000000001', false),
    ('00000000-0000-4000-a000-000000000007'::uuid, 'sergio@mesenergia.es',       'Sergio',         'Castro León',     '600000007', 'comercial',   'e0000000-0000-4000-a000-000000000002', false),
    ('00000000-0000-4000-a000-000000000008'::uuid, 'paula@mesenergia.es',        'Paula',          'Delgado Vidal',   '600000008', 'comercial',   'e0000000-0000-4000-a000-000000000002', false)
)
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new
)
select
  '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
  extensions.crypt('Mesenergia2026!', extensions.gen_salt('bf')), now(),
  jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email'),
                     'rol', u.rol, 'equipo_id', u.equipo_id, 'debe_cambiar_password', u.cambiar),
  jsonb_build_object('nombre', u.nombre, 'apellidos', u.apellidos, 'telefono', u.telefono),
  now(), now(), '', '', '', ''
from usuarios u
on conflict (id) do nothing;

insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select
  gen_random_uuid(), u.id, u.id::text,
  jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
  'email', now(), now(), now()
from auth.users u
where u.id::text like '00000000-0000-4000-a000-00000000000_'
  and not exists (select 1 from auth.identities i where i.user_id = u.id and i.provider = 'email');

-- Jefes de equipo
update public.equipos set jefe_id = '00000000-0000-4000-a000-000000000003' where id = 'e0000000-0000-4000-a000-000000000001';
update public.equipos set jefe_id = '00000000-0000-4000-a000-000000000004' where id = 'e0000000-0000-4000-a000-000000000002';

-- -----------------------------------------------------------------------------
-- Contratos (se insertan como "sistema" para poder fijar la fecha de alta)
-- -----------------------------------------------------------------------------
insert into public.contratos (
  id, cliente_nombre, cliente_apellidos, documento_tipo, documento_numero, cliente_email,
  via_tipo, via_nombre, via_numero, escalera, piso, puerta, codigo_postal, poblacion, provincia,
  telefono_fijo, telefono_contacto, operadora, producto, precio_mensual, oferta_detalle,
  instalacion_fecha, instalacion_franja, comercial_id, created_by, created_at, updated_at
) values
  ('c0000000-0000-4000-a000-000000000001', 'Ana', 'López Fernández', 'DNI', '45872319S', 'ana.lopez@example.com',
   'Calle', 'Gran Vía', '24', null, '3', 'B', '48011', 'Bilbao', 'Bizkaia',
   '944000101', '612000101', 'Avatel', 'Fibra 1 Gb + 2 líneas móviles', 45.90,
   'Promo 3 meses al 50 %. 2 líneas con 50 GB y llamadas ilimitadas. Permanencia 12 meses.',
   current_date, 'Mañana 9-14h', '00000000-0000-4000-a000-000000000005', '00000000-0000-4000-a000-000000000005',
   now() - interval '1 day', now() - interval '1 day'),

  ('c0000000-0000-4000-a000-000000000002', 'David', 'García Pérez', 'DNI', '53190486L', null,
   'Avenida', 'de la Constitución', '112', 'A', '1', 'Izq', '33207', 'Gijón', 'Asturias',
   null, '622000202', 'Avatel', 'Fibra 600 Mb + 1 línea móvil', 32.90,
   'Router WiFi 6 incluido. Sin permanencia.',
   current_date + 2, 'Tarde 15-19h', '00000000-0000-4000-a000-000000000005', '00000000-0000-4000-a000-000000000005',
   now() - interval '3 days', now() - interval '3 days'),

  ('c0000000-0000-4000-a000-000000000003', 'Laura', 'Sánchez Romero', 'NIE', 'X4567812N', 'laura.sr@example.com',
   'Plaza', 'del Ayuntamiento', '5', null, '2', 'C', '39001', 'Santander', 'Cantabria',
   '942000303', '633000303', 'Avatel', 'Fibra 1 Gb + TV + 2 líneas', 59.90,
   'TV con 80 canales y fútbol 3 meses gratis. Permanencia 12 meses.',
   current_date + 5, 'Mañana 9-14h', '00000000-0000-4000-a000-000000000006', '00000000-0000-4000-a000-000000000006',
   now() - interval '6 days', now() - interval '6 days'),

  ('c0000000-0000-4000-a000-000000000004', 'Miguel', 'Torres Ruiz', 'DNI', '71234598X', null,
   'Calle', 'Uría', '48', null, '5', 'D', '33003', 'Oviedo', 'Asturias',
   null, '644000404', 'Avatel', 'Fibra 300 Mb + 1 línea 30 GB', 27.90,
   'Oferta captación: 25 % de descuento los 6 primeros meses.',
   current_date + 1, 'Todo el día', '00000000-0000-4000-a000-000000000006', '00000000-0000-4000-a000-000000000006',
   now() - interval '9 days', now() - interval '9 days'),

  ('c0000000-0000-4000-a000-000000000005', 'Carmen', 'Jiménez Vega', 'DNI', '28765431K', 'carmen.jv@example.com',
   'Calle', 'Sierpes', '17', null, '1', null, '41004', 'Sevilla', 'Sevilla',
   '954000505', '655000505', 'Avatel', 'Fibra 1 Gb + 2 líneas móviles', 45.90,
   'Portabilidad de fijo y 2 móviles. Permanencia 12 meses.',
   current_date - 4, 'Mañana 9-14h', '00000000-0000-4000-a000-000000000007', '00000000-0000-4000-a000-000000000007',
   now() - interval '12 days', now() - interval '12 days'),

  ('c0000000-0000-4000-a000-000000000006', 'Antonio', 'Ruiz Molina', 'DNI', '10293847J', null,
   'Avenida', 'de Andalucía', '33', 'B', '4', 'A', '29007', 'Málaga', 'Málaga',
   null, '666000606', 'Avatel', 'Fibra 600 Mb', 25.90,
   'Solo fibra. Sin permanencia.',
   current_date, 'Tarde 15-19h', '00000000-0000-4000-a000-000000000008', '00000000-0000-4000-a000-000000000008',
   now() - interval '8 days', now() - interval '8 days'),

  ('c0000000-0000-4000-a000-000000000007', 'Isabel', 'Morales Castillo', 'NIE', 'Y2345671F', 'isabel.mc@example.com',
   'Camino', 'de Ronda', '81', null, 'Bajo', null, '18004', 'Granada', 'Granada',
   '958000707', '677000707', 'Avatel', 'Fibra 1 Gb + 1 línea', 38.90,
   '1 línea con datos ilimitados. Permanencia 12 meses.',
   current_date - 7, 'Mañana 9-14h', '00000000-0000-4000-a000-000000000008', '00000000-0000-4000-a000-000000000008',
   now() - interval '15 days', now() - interval '15 days'),

  ('c0000000-0000-4000-a000-000000000008', 'Francisco', 'Navarro Ortiz', 'DNI', '47561238K', null,
   'Calle', 'Mayor', '9', null, '2', 'Dcha', '48920', 'Portugalete', 'Bizkaia',
   null, '688000808', 'Avatel', 'Fibra 1 Gb + 2 líneas móviles', 45.90,
   'Promo 3 meses al 50 %.',
   current_date - 2, 'Tarde 15-19h', '00000000-0000-4000-a000-000000000006', '00000000-0000-4000-a000-000000000006',
   now() - interval '10 days', now() - interval '10 days'),

  ('c0000000-0000-4000-a000-000000000009', 'Elena', 'Ramos Herrera', 'DNI', '76543219R', 'elena.rh@example.com',
   'Paseo', 'de Gracia', '120', null, '6', '2', '41010', 'Sevilla', 'Sevilla',
   null, '699000909', 'Avatel', 'Fibra 600 Mb + TV', 39.90,
   'TV básica incluida. Permanencia 12 meses.',
   null, null, '00000000-0000-4000-a000-000000000007', '00000000-0000-4000-a000-000000000007',
   now() - interval '18 days', now() - interval '18 days'),

  ('c0000000-0000-4000-a000-000000000010', 'Pablo', 'Domínguez Gil', 'DNI', '33445566R', null,
   'Ronda', 'de Poniente', '3', null, '3', 'A', '33012', 'Oviedo', 'Asturias',
   '985001010', '611001010', 'Avatel', 'Fibra 1 Gb + 3 líneas móviles', 64.90,
   '3 líneas: 2 x 50 GB y 1 ilimitada. Permanencia 24 meses.',
   null, null, '00000000-0000-4000-a000-000000000005', '00000000-0000-4000-a000-000000000005',
   now() - interval '20 days', now() - interval '20 days')
on conflict (id) do nothing;

insert into public.telefonos_portabilidad (contrato_id, numero, tipo, operador_donante, orden) values
  ('c0000000-0000-4000-a000-000000000001', '944000101', 'fijo',  'Movistar', 1),
  ('c0000000-0000-4000-a000-000000000001', '612000101', 'movil', 'Movistar', 2),
  ('c0000000-0000-4000-a000-000000000001', '612000199', 'movil', 'Orange',   3),
  ('c0000000-0000-4000-a000-000000000003', '633000303', 'movil', 'Vodafone', 1),
  ('c0000000-0000-4000-a000-000000000005', '954000505', 'fijo',  'Orange',   1),
  ('c0000000-0000-4000-a000-000000000005', '655000505', 'movil', 'Orange',   2),
  ('c0000000-0000-4000-a000-000000000005', '655000599', 'movil', 'Yoigo',    3),
  ('c0000000-0000-4000-a000-000000000008', '688000808', 'movil', 'Digi',     1),
  ('c0000000-0000-4000-a000-000000000010', '611001010', 'movil', 'Vodafone', 1),
  ('c0000000-0000-4000-a000-000000000010', '611001011', 'movil', 'Vodafone', 2);

-- Observación inicial del comercial
insert into public.observaciones (contrato_id, autor_id, texto, created_at)
select c.id, c.comercial_id, o.texto, c.created_at + interval '5 minutes'
from public.contratos c
join (values
  ('c0000000-0000-4000-a000-000000000001'::uuid, 'Cliente muy interesado, prefiere que le llamen por la mañana.'),
  ('c0000000-0000-4000-a000-000000000002'::uuid, 'Le he enviado la oferta por WhatsApp. Pendiente de que la revise con su pareja.'),
  ('c0000000-0000-4000-a000-000000000003'::uuid, 'Quiere conservar el número de móvil de Vodafone.'),
  ('c0000000-0000-4000-a000-000000000004'::uuid, 'Viene de la competencia por precio. Ojo con la permanencia actual.'),
  ('c0000000-0000-4000-a000-000000000005'::uuid, 'Portabilidad de fijo y dos móviles.'),
  ('c0000000-0000-4000-a000-000000000009'::uuid, 'Cliente con impagos anteriores según me comenta.')
) as o (contrato_id, texto) on o.contrato_id = c.id;

-- -----------------------------------------------------------------------------
-- Gestión de backoffice (como Gabriela) para tener historial real
-- -----------------------------------------------------------------------------
select set_config('request.jwt.claims',
  json_build_object('sub', '00000000-0000-4000-a000-000000000002', 'role', 'authenticated')::text, false);

-- Firmados
update public.contratos set firmado = true
where id in ('c0000000-0000-4000-a000-000000000004',
             'c0000000-0000-4000-a000-000000000005',
             'c0000000-0000-4000-a000-000000000006',
             'c0000000-0000-4000-a000-000000000007',
             'c0000000-0000-4000-a000-000000000008');

-- Activos
update public.contratos set estado = 'activo', motivo_estado = 'Activado por la operadora'
where id in ('c0000000-0000-4000-a000-000000000005',
             'c0000000-0000-4000-a000-000000000006',
             'c0000000-0000-4000-a000-000000000007');

-- Riesgos
update public.contratos set estado = 'riesgos', motivo_estado = 'No supera el scoring de la operadora'
where id = 'c0000000-0000-4000-a000-000000000008';
update public.contratos set estado = 'riesgos', motivo_estado = 'Deuda pendiente con la operadora donante'
where id = 'c0000000-0000-4000-a000-000000000009';

-- Cancelado
update public.contratos set estado = 'cancelado', motivo_estado = 'El cliente desiste antes de firmar'
where id = 'c0000000-0000-4000-a000-000000000010';

-- Llamadas de backoffice
insert into public.llamadas (contrato_id, resultado, nota, volver_a_llamar_at) values
  ('c0000000-0000-4000-a000-000000000002', 'no_contesta', 'Salta el buzón.', null),
  ('c0000000-0000-4000-a000-000000000002', 'volver_a_llamar', 'Pide que le llamemos esta mañana.', now() - interval '2 hours'),
  ('c0000000-0000-4000-a000-000000000003', 'volver_a_llamar', 'Está trabajando, mejor mañana por la tarde.', now() + interval '1 day'),
  ('c0000000-0000-4000-a000-000000000004', 'firmado', 'Firma realizada por SMS.', null),
  ('c0000000-0000-4000-a000-000000000010', 'rechaza', 'No quiere seguir adelante.', null);

insert into public.observaciones (contrato_id, texto) values
  ('c0000000-0000-4000-a000-000000000004', 'Firmado. Pendiente de tramitar con Avatel.'),
  ('c0000000-0000-4000-a000-000000000008', 'Avatel lo rechaza en riesgos. Se puede reintentar con otro titular.');

select set_config('request.jwt.claims', '', false);

-- Fechas realistas para el historial (un día después del alta)
update public.historial_estados h
   set created_at = c.created_at + interval '1 day'
  from public.contratos c
 where c.id = h.contrato_id
   and h.estado_anterior is not null
   and h.contrato_id::text like 'c0000000-0000-4000-a000-%';
