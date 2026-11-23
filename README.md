# APPO CRM

CRM interno de APPO para la prospección comercial: cada comercial carga sus listados (por módulos, p. ej. un código postal), llama, envía la presentación y el estudio de maxímetro, y sigue a cada cliente hasta la comparativa, la reunión y la firma. Incluye además el módulo **Appo · auditorías**, para captar negocios y cerrar auditorías.

**Stack:** React 19 + TypeScript + Vite + Tailwind CSS 4 · Supabase (Auth, Postgres con RLS, Storage y Edge Functions) · TanStack Query · SheetJS, jsPDF y html2canvas (se cargan solo al usarlos).

## Qué incluye

| Pantalla | Para quién | Qué hace |
|---|---|---|
| **Login** | Todos | Email + contraseña, recuperar contraseña por email, cambio obligatorio de la contraseña temporal en el primer acceso. |
| **Prospección → Llamar** | Todos | Un lead cada vez, con los kW y los teléfonos en grande. Botones **No contesta**, **No existe teléfono**, **Llamar más tarde** (con día y hora; cuando toca sube a «Pendientes»), **Rechazado**, **Correo enviado**, **Maxímetro** y **Ficha**. Botón de WhatsApp con mensaje en catalán o castellano. |
| **Prospección → Lista** | Todos | Todos los clientes con búsqueda, filtro por estado y módulo; selección múltiple para mover leads a una lista; clic para abrir la ficha. |
| **Prospección → Calendario** | Todos | Renovaciones y llamadas programadas; aviso «Toca llamar ya» a X días del fin de contrato. |
| **Ficha de cliente** | Todos (editan el propietario y admin/backoffice) | Datos, módulo, **fechas del proceso** (correo enviado, facturas recibidas, comparativa enviada, **reuniones** con lugar/enlace y notas, firma), estado, archivos adjuntos (Storage), notas e historial. |
| **Nuevo cliente** | Todos | Añade a mano un cliente aunque no esté en ningún listado, con sus fechas ya rellenadas. |
| **Importar Excel** | Todos | Columnas detectadas por cabecera aunque cambie el orden. Cada carga lleva un **módulo** (se propone desde el nombre del archivo); se cargan listados nuevos sin duplicar CUPS (un teléfono con varios CUPS se carga entero). Crea módulos nuevos y listas (módulos) vacías para ir llenándolas. |
| **Correo** | Todos | Catalán o castellano, varios formatos; elige el periodo con más consumo; **Copiar y enviar con todo adjunto** (maxímetro en PDF + presentación). |
| **Maxímetro** | Todos | A partir de las 2 tablas de SIPS (`.zip` o `.xls`): últimos 12 meses, consumo por periodo, potencia contratada, máximos y **potencia optimizada** editable; PDF con el diseño de APPO. |
| **Seguimiento** | Todos | Clientes con correo enviado en adelante, con próximas reuniones, aviso a los 3 días sin facturas y fechas de cada paso. |
| **Datos del equipo** | Todos (cada uno ve lo suyo; admin/backoffice, todo; el jefe, su equipo en solo lectura) | Registros de actividad con fecha y persona: llamadas, correos, facturas recibidas, citas/visitas, ventas y notas. Resumen por periodo, tabla por persona y por día, y botón *Añadir registro*. Es la pantalla del dueño/CEO para ver el trabajo del equipo. |
| **Appo · auditorías** | Todos | Captación de negocios para Appo: leads de empresa (importar Excel, ficha, WhatsApp de auditoría, próximas auditorías y cuotas cerradas), speech de ventas con objeciones, calculadora de pérdidas con pack recomendado y precios. |
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

Crea un proyecto en [supabase.com](https://supabase.com) y aplica las migraciones de `supabase/migrations/` **en orden**:

```bash
# Opción A: con la CLI
npx supabase login
npx supabase link --project-ref TU_PROJECT_REF
npx supabase db push
```

Opción B: copia y ejecuta cada archivo de `supabase/migrations/`, en orden de nombre, en **SQL Editor**.

### 2. Edge Function de usuarios

La creación de usuarios usa la `service_role` key, que **nunca** llega al navegador: vive en la Edge Function `admin-users`.

```bash
npx supabase functions deploy admin-users
```

Supabase inyecta `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` automáticamente.

### 3. Primer usuario admin

Crea el primer admin en **Authentication → Users → Add user** y después, en el SQL Editor:

```sql
update public.profiles
   set rol = 'admin', activo = true, nombre = 'Tu nombre', apellidos = 'Tus apellidos'
 where email = 'tu-email@tudominio.com';
```

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

Para producción, `npm run build` genera `dist/`, que se despliega en cualquier hosting estático.

**GitHub Pages (incluido):** el workflow `.github/workflows/pages.yml` compila y publica la app en `https://<usuario>.github.io/<repo>/` en cada push a la rama de trabajo. Actívalo una vez en **Settings → Pages → Source: GitHub Actions**. La URL y la clave publicable de Supabase se pueden cambiar con las variables del repositorio `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY`. Añade también `https://<usuario>.github.io/<repo>/restablecer` a las *Redirect URLs* de Supabase.

## Avisos en WhatsApp (leads)

La función `messy-leads` manda al grupo del equipo los avisos de avance de la prospección (reloj `pg_cron` `messy-leads-reloj`, cada 5 minutos, hora de Madrid). Usa un número de WhatsApp conectado a [Whapi.cloud](https://whapi.cloud) y la tabla `messy_config` (columnas `leads_*`) para su configuración; la cola está en `messy_leads_cola`. Nunca publica datos personales de clientes en el grupo.

## Seguridad

- **RLS en todas las tablas.** El comercial solo ve sus filas, el jefe las de su equipo, backoffice y admin todo. Un usuario desactivado no ve nada aunque su sesión siga abierta.
- **Reglas de negocio en la base de datos:** el comercial no puede cambiar de propietario sus leads, el equipo se deriva siempre del comercial, y las notas e historial no se pueden editar ni borrar.
- **Archivos en buckets privados de Storage**, accesibles con URLs firmadas temporales y las mismas reglas que el lead.
- **Teléfonos nunca en las URLs:** las rutas usan el id interno y las búsquedas viajan en el cuerpo de peticiones POST (RPC). Los filtros se guardan en `sessionStorage`, no en la barra de direcciones.
- **Los usuarios no se borran:** se desactivan (bloqueo en Auth + `activo = false`) y conservan su historial. Siempre queda al menos un admin activo.

## Estructura

```
supabase/
  migrations/      Esquema, triggers, RLS, vistas/RPC, Storage/Realtime y prospección de leads
  functions/       Edge Functions admin-users y messy-leads (Deno)
  config.toml      Configuración para `supabase start`
src/
  auth/            Sesión, perfil y permisos por rol
  hooks/           Consultas, mutaciones y tiempo real (TanStack Query)
  components/      UI base, layout, prospección (leads), appo y usuarios
  pages/           Una pantalla por ruta
  lib/             Tipos, constantes, validadores, formato y exportación a Excel
public/            Logo (+ variante para fondo oscuro) e iconos; leads/ = presentación y logo del informe
```

## Personalización

- **Colores corporativos:** tokens `navy`, `brand` (verde) y `sun` (amarillo) en `src/index.css`.
- **Estados y sus colores** (badges, dashboard): `src/lib/constants.ts`.
- **Logo:** `public/logo.png` y `public/logo-dark.png` (texto en blanco para el menú lateral).

## Comprobaciones

```bash
npm run typecheck   # TypeScript
npm test            # validadores (DNI/NIE, teléfonos, CP, precios…) y lógica de leads (columnas, SIPS, correos)
npm run build
```
