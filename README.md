# MESENERGIA CRM · +Energía

CRM interno de MESENERGIA para la prospección energética: cada comercial carga sus listados (por módulos, p. ej. el código postal 08017 o 08022), llama, envía el correo con la presentación y el maxímetro, y sigue a cada cliente hasta las facturas, la comparativa, la visita y la firma.

> **Antes** el CRM gestionaba contratos de telecomunicaciones (fibra/WiFi). Esa parte se ha quitado de la aplicación, pero **sus datos siguen guardados en Supabase** (tablas `contratos`, `llamadas`, `documentos`…, bucket `contratos-pdf`) y la Edge Function `messy` los sigue leyendo. No se ha borrado nada.

**Stack:** React 19 + TypeScript + Vite + Tailwind CSS 4 · Supabase (Auth, Postgres con RLS, Storage y Edge Functions) · TanStack Query · SheetJS, jsPDF y html2canvas (se cargan solo al usarlos).

## Qué incluye

| Pantalla | Para quién | Qué hace |
|---|---|---|
| **Login** | Todos | Email + contraseña, recuperar contraseña por email, cambio obligatorio de la contraseña temporal en el primer acceso. |
| **Prospección → Llamar** | Todos | Un lead cada vez, con los kW y los teléfonos (`612 345 678`) en grande. Botones **No contesta**, **No existe teléfono**, **Llamar más tarde** (con día y hora; cuando toca sube a «Pendientes»), **Rechazado**, **Correo enviado**, **Maxímetro** y **Ficha**. |
| **Prospección → Lista** | Todos | Todos los clientes con búsqueda, filtro por estado y módulo; clic para abrir la ficha. |
| **Ficha de cliente** | Todos (editan el propietario y admin/backoffice) | Datos, módulo, **fechas del proceso** (correo enviado, **facturas recibidas**, comparativa enviada, **visita** con lugar y notas, firma), estado, facturas y comparativas adjuntas (Storage), notas e historial. |
| **Nuevo cliente** | Todos | Añade a mano un cliente aunque no esté en ningún listado, con sus fechas ya rellenadas (el historial y el registro diario usan esas fechas). |
| **Importar Excel** | Todos | Columnas detectadas por cabecera aunque cambie el orden (kW junto a Teléfono 2). Cada carga lleva un **módulo** (se propone desde el nombre del archivo, p. ej. `08017.xlsx`); se cargan listados nuevos sin duplicar CUPS (un teléfono con varios CUPS se carga entero). |
| **Correo** | Todos | Catalán o castellano, 4 formatos (completo, corto, con datos, express); elige el periodo con más consumo; **Copiar y enviar con todo adjunto** (maxímetro en PDF + presentación). |
| **Maxímetro** | Todos | A partir de las 2 tablas de SIPS (`.zip` o `.xls`): últimos 12 meses, consumo por periodo, potencia contratada, máximos y **potencia optimizada** editable; PDF con el diseño +Energía. |
| **Seguimiento** | Todos | Clientes con correo enviado en adelante, con **próximas visitas**, aviso a los 3 días sin facturas y fechas de cada paso. |
| **Registro diario → Estadísticas** | Todos | Correos, **facturas recibidas** (y % sobre correos), comparativas, visitas y firmas por periodo y **por módulo**; llamadas por día. |
| **Usuarios y equipos** | Admin, backoffice, jefes | Alta, edición, desactivación y reseteo de contraseña (con contraseña temporal). Equipos y jefes (solo admin). |

### Roles

| | Admin | Backoffice | Jefe de equipo | Comercial |
|---|:-:|:-:|:-:|:-:|
| Ve clientes | Todos | Todos | Los de su equipo (solo lectura) | Los suyos |
| Edita clientes | Todos | Todos | — | Los suyos |
| Gestiona usuarios | Todos los roles | Comerciales | Comerciales de su equipo | — |
| Gestiona equipos | ✅ | — | — | — |

Los permisos se aplican **en la base de datos** (RLS, triggers y la Edge Function), no solo en la interfaz.

## Puesta en marcha

### 1. Proyecto de Supabase

Crea un proyecto en [supabase.com](https://supabase.com) y aplica las migraciones de `supabase/migrations/` **en orden**. Dos opciones:

```bash
# Opción A: con la CLI
npx supabase login
npx supabase link --project-ref TU_PROJECT_REF
npx supabase db push
```

Opción B: copia y ejecuta cada archivo de `supabase/migrations/`, en orden de nombre, en **SQL Editor**.

### 2. Datos de ejemplo (opcional)

Ejecuta `supabase/seed.sql` en el SQL Editor. Crea 2 equipos, 10 contratos repartidos entre los 4 estados y estos usuarios, todos con la contraseña `Mesenergia2026!`:

| Email | Rol | Equipo |
|---|---|---|
| `admin@mesenergia.es` | Admin (debe cambiar la contraseña al entrar) | — |
| `gabriela@mesenergia.es` | Backoffice | — |
| `jefe.norte@mesenergia.es` | Jefe de equipo | Equipo Norte |
| `jefe.sur@mesenergia.es` | Jefe de equipo | Equipo Sur |
| `javier@`, `marta@mesenergia.es` | Comercial | Equipo Norte |
| `sergio@`, `paula@mesenergia.es` | Comercial | Equipo Sur |

> ⚠️ Antes de usar la app con clientes reales, cambia la contraseña del admin y desactiva (o cambia) los usuarios de prueba desde la pantalla **Usuarios**.

Para empezar sin datos de ejemplo, crea el primer admin en **Authentication → Users → Add user** y después, en el SQL Editor:

```sql
update public.profiles
   set rol = 'admin', activo = true, nombre = 'Tu nombre', apellidos = 'Tus apellidos'
 where email = 'tu-email@mesenergia.es';
```

### 3. Edge Function de usuarios

La creación de usuarios usa la `service_role` key, que **nunca** llega al navegador: vive en la Edge Function `admin-users`.

```bash
npx supabase functions deploy admin-users
```

Supabase inyecta `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` automáticamente.

### 4. Ajustes de Auth (panel de Supabase)

- **Authentication → Sign In / Providers → Email:** desactiva *Allow new users to sign up* (los usuarios solo se crean desde la app).
- **Authentication → URL Configuration:** pon tu dominio en *Site URL* y añade `https://TU-DOMINIO/restablecer` a *Redirect URLs* (para el email de recuperar contraseña).
- **Authentication → Emails → SMTP:** configura un SMTP propio para que los emails de recuperación lleguen de forma fiable.

### 5. Frontend

```bash
cp .env.example .env.local   # rellena VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY
npm install
npm run dev                  # http://localhost:5173
```

Para producción, `npm run build` genera `dist/`, que se despliega en cualquier hosting estático (Vercel, Netlify, Cloudflare Pages…). El repo ya incluye `vercel.json` y `public/_redirects` para que las rutas de la SPA funcionen al recargar.

**GitHub Pages (incluido):** el workflow `.github/workflows/pages.yml` compila y publica la app en `https://<usuario>.github.io/<repo>/` en cada push. Solo hay que activarlo una vez en **Settings → Pages → Source: GitHub Actions**. La URL y la clave publicable de Supabase se pueden cambiar con las variables del repositorio `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY`. Si publicas en GitHub Pages, añade también `https://<usuario>.github.io/<repo>/restablecer` a las *Redirect URLs* de Supabase.

### Desarrollo local con Supabase

Con Docker instalado, `npx supabase start` levanta Supabase en local con la configuración de `supabase/config.toml`, aplica las migraciones y carga el seed. Para probar la Edge Function: `npx supabase functions serve admin-users`.

## Messy · el agente de IA en WhatsApp

Messy vive en la Edge Function `messy` y usa un número de WhatsApp conectado a [Whapi.cloud](https://whapi.cloud).

**En el grupo del equipo**

- 🔥 **Cada reserva de plaza**: en cuanto se sube un contrato al CRM, «*Mario ha conseguido 1 reserva de plaza* · Fibra 600 Mb · Avatel», cuántas lleva hoy y este mes, el objetivo del equipo y una frase para animar al resto.
- 🎯 **Objetivo del mes del equipo**, sumando las reservas de todos: «Objetivo del mes: *11/50* · quedan *39* (78 %)». Sale en cada aviso, en los buenos días y en el cierre.
- ☀️ **Buenos días** (9:00) con el resumen del último día con reservas y el acumulado del mes.
- 🌙 **Cierre del día** (20:00) con el total, el podio 🥇🥈🥉 y cómo va el mes.
- Horas y días configurables (por defecto de lunes a sábado), hora de Madrid. En el grupo Messy no lee nada más: solo reacciona a «messy activar».

El objetivo cuenta los contratos subidos al CRM en el mes (hora de Madrid) más un ajuste opcional para las reservas que no están en el CRM; el ajuste solo vale para el mes en el que se pone. Un admin puede pedirle a Messy por privado «el objetivo de este mes es 60» o «llevamos 14 este mes», o hacerlo en SQL:

```sql
update public.messy_config set objetivo_mes = 50, ajuste_mes = 6, ajuste_mes_inicio = date '2026-10-01';
```

Para que Messy publique en el grupo ahora mismo cómo va el objetivo, llama a la acción `anunciar_progreso` como en el paso 5 de la puesta en marcha.

**Verificaciones de backoffice**

En el grupo (solo número de contrato y comercial, nunca el nombre del cliente ni datos personales):

- 📵📞🔁✅❌ **Resultado de cada llamada** a un contrato con verificación programada, y cuando se marca **Hecha** o se **reprograma**: «📵 Verificación #00017 (comercial Mario) · No contesta · reprogramada para hoy a las 17:00 · Vamos 4 firmadas este mes» y debajo lo que queda hoy. Lo que se hace en la misma acción (90 s) va en un solo mensaje; en la ficha, «No contesta» deja reprogramar en el mismo paso.
- **Vamos X firmadas este mes**: todos los contratos marcados como firmados en el mes (hora de Madrid), por llamada o con el botón.
- Con los **buenos días**, las verificaciones de hoy y las atrasadas; con el **cierre**, «🛡️ Verificaciones de hoy: hechas · no contesta · firmadas · firmadas del mes» y las de mañana.
- Acción `anunciar_verificaciones` (`"probar": true` para ver el texto sin enviarlo): la última llamada y todo lo pendiente.

Por privado a las personas de `messy_config.verificaciones_para` (admin/backoffice con la sesión de Messy iniciada):

- 📞 Aviso **10 minutos antes** de cada verificación (`aviso_verificacion_min`, 0 = sin aviso).
- ☀️ A la hora de los buenos días: las verificaciones del día por orden de hora y las atrasadas.
- 🌙 A la hora del cierre: cuántas había, hechas, no contestaron y reprogramadas; las pendientes para mañana; firmadas hoy y del mes.

El reloj de Messy (`pg_cron`, `messy-reloj`) corre cada minuto. Todo queda registrado en `verificaciones_log` y la cola en `messy_cola_verificaciones`.

**🍽️ Hora de comer (15:00)**

Cada día activo, a las 15:00 (hora de Madrid), Messy manda al grupo «¡Hora de comer, equipo!» con una **gráfica del mes** en imagen (1080×1350, colores y tipografía de MESENERGIA):

- Arriba, el **acumulado** de reservas de plaza del mes frente al **ritmo del objetivo** y la **proyección** a fin de mes; abajo, las **barras de cada día** (hoy en amarillo) con su fecha.
- Tarjetas con lo que llevamos sobre el objetivo, lo que queda, las firmadas del mes y la **hora punta** de reservas.
- Debajo de la imagen, el texto con el objetivo, las reservas de hoy, la proyección y las firmadas. Sin datos de clientes.

Se cambia con `update public.messy_config set hora_comida = 14;` (o `informe_comida = false` para quitarlo). Acción `anunciar_comida` para mandarla ahora (`"probar": true` genera la imagen y devuelve el texto sin enviarla). La imagen se dibuja en la Edge Function (SVG → PNG con resvg); la fuente Poppins, el WASM y el logo se descargan al vuelo y se pueden cambiar con `MESSY_FUENTES_URL`, `MESSY_RESVG_WASM_URL` y `MESSY_LOGO_URL`. Cola en `messy_informes`.

**Por privado**

Cada persona inicia sesión con su email y contraseña del CRM y le pregunta lo que quiera: «¿cuántas reservas de plaza llevo este mes?», «¿cómo vamos con el objetivo?», «¿qué verificaciones tengo hoy?», «ranking de la semana», «¿qué pendientes tengo sin firmar?», «ficha del contrato 125»… Messy consulta el CRM **con los permisos de esa persona** (el comercial solo ve lo suyo, el jefe su equipo, backoffice y admin todo), nunca muestra DNI, teléfonos, emails ni direcciones de clientes y no puede modificar nada. Los admins además pueden pedirle que cambie las horas de los avisos, que los pause o que publique algo en el grupo. «salir» cierra la sesión; 5 intentos fallidos bloquean el chat 15 minutos.

**Modelos de Claude** (cambiables sin tocar código, con secretos de la Edge Function):

| Uso | Variable | Por defecto |
|---|---|---|
| Chat privado | `MESSY_MODELO_CHAT` | `claude-sonnet-5-5` |
| Informes (buenos días y cierre) | `MESSY_MODELO_INFORMES` | `claude-sonnet-5-5` |
| Avisos de reserva de plaza | `MESSY_MODELO_AVISOS` | `claude-haiku-5-5` |

Con Sonnet se activa el *fallback* en el servidor de la API (si el modelo declina una petición, se reintenta con el alternativo recomendado); Haiku 5.5 no lo tiene. Si Claude no responde, los avisos salen igualmente con una plantilla.

### Puesta en marcha

1. Aplica las migraciones `…_messy.sql` (activa `pg_net` y `pg_cron`), `…_messy_secretos.sql` y `…_messy_objetivo.sql` y despliega la función: `npx supabase functions deploy messy --no-verify-jwt`.
2. Indica a Messy su propia URL:
   ```sql
   update public.messy_config set funcion_url = 'https://TU_PROJECT_REF.supabase.co/functions/v1/messy';
   ```
3. En [Whapi.cloud](https://whapi.cloud) crea un canal y vincula el número de Messy escaneando el QR desde WhatsApp → *Dispositivos vinculados*. Copia el **token** del canal.
4. Guarda las dos claves: en Supabase → **Edge Functions → Secrets** como `WHAPI_TOKEN` y `ANTHROPIC_API_KEY` (de [console.anthropic.com](https://console.anthropic.com)), o cifradas en Vault desde el SQL Editor:
   ```sql
   select public.messy_guardar_secreto('messy_whapi_token', 'TOKEN_DE_WHAPI');
   select public.messy_guardar_secreto('messy_anthropic_api_key', 'sk-ant-...');
   ```
5. Apunta el webhook de Whapi a Messy (lo hace la propia función):
   ```sql
   select net.http_post(
     url     := (select funcion_url from public.messy_config),
     headers := jsonb_build_object('Content-Type', 'application/json', 'x-messy-clave', (select clave from public.messy_config)),
     body    := '{"accion": "configurar_webhook"}'
   );
   ```
6. Añade el número de Messy al grupo de WhatsApp del equipo. Una persona **admin** inicia sesión con Messy por privado y escribe en el grupo **«messy activar»**.

> Whapi.cloud es una pasarela no oficial (vincula el número como un WhatsApp Web). Es lo más rápido para tener grupos funcionando, pero usa un número dedicado a Messy, no uno personal.

## Seguridad

- **RLS en todas las tablas.** El comercial solo ve sus filas, el jefe las de su equipo, backoffice y admin todo. Un usuario desactivado no ve nada aunque su sesión siga abierta.
- **Reglas de negocio en la base de datos:** validación de la letra del DNI/NIE, motivo obligatorio en Cancelado/Riesgos, el comercial no puede cambiar estado, firma ni comercial, el equipo se deriva siempre del comercial, las observaciones y el historial no se pueden editar ni borrar.
- **PDF en un bucket privado** (`contratos-pdf`, solo PDF, máx. 10 MB). Se abren con URLs firmadas de 1 hora y las mismas reglas que el contrato. Las versiones nunca se sobrescriben.
- **DNI y teléfonos nunca van en las URLs:** las rutas usan el id interno del contrato y las búsquedas viajan en el cuerpo de peticiones POST (RPC). Los filtros se guardan en `sessionStorage`, no en la barra de direcciones.
- **Los usuarios no se borran:** se desactivan (bloqueo en Auth + `activo = false`) y conservan su historial. Siempre queda al menos un admin activo.

## Estructura

```
supabase/
  migrations/      Esquema, triggers, RLS, vistas/RPC, Storage/Realtime, Messy y prospección de leads
  functions/       Edge Functions admin-users y messy (Deno)
  seed.sql         Datos de ejemplo
  config.toml      Configuración para `supabase start`
src/
  auth/            Sesión, perfil y permisos por rol
  hooks/           Consultas, mutaciones y tiempo real (TanStack Query)
  components/      UI base, layout, prospección (leads) y usuarios
  pages/           Una pantalla por ruta
  lib/             Tipos, constantes, validadores, formato y exportación a Excel
public/            Logo (+ variante para fondo oscuro) e iconos; leads/ = presentación y logo del informe (y la primera versión suelta de la app de llamadas)
```

## Personalización

- **Colores corporativos:** tokens `navy`, `brand` (verde) y `sun` (amarillo) en `src/index.css`, muestreados del logo.
- **Estados y sus colores** (badges, Kanban, dashboard): `src/lib/constants.ts`.
- **Logo:** `public/logo.png` y `public/logo-dark.png` (texto en blanco para el menú lateral).

## Comprobaciones

```bash
npm run typecheck   # TypeScript
npm test            # validadores (DNI/NIE, teléfonos, CP, precios…) y lógica de leads (columnas, SIPS, correos)
npm run build
```
