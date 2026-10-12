# MESENERGIA CRM · +Energía

CRM interno para gestionar los contratos de fibra/WiFi del call center: el comercial sube la venta con la oferta en PDF, backoffice la tramita con la operadora y los jefes de equipo siguen en tiempo real cómo va su equipo.

**Stack:** React 19 + TypeScript + Vite + Tailwind CSS 4 · Supabase (Auth, Postgres con RLS, Storage, Realtime y una Edge Function) · TanStack Query · React Hook Form + Zod · Recharts · dnd-kit.

## Qué incluye

| Pantalla | Para quién | Qué hace |
|---|---|---|
| **Login** | Todos | Email + contraseña, recuperar contraseña por email, cambio obligatorio de la contraseña temporal en el primer acceso. |
| **Dashboard** | Admin, backoffice, jefes (el comercial ve un resumen solo con lo suyo) | KPIs por estado, % de activación, pendientes sin firmar, cuota mensual activada, contratos subidos por día (con vista de tabla), citas de instalación de hoy y de los próximos 7 días, ranking de comerciales. Filtros por periodo, equipo y comercial. Se actualiza en tiempo real. |
| **Contratos** | Todos (cada rol ve lo suyo) | Tabla con búsqueda por nombre, apellidos, DNI/NIE o cualquier teléfono (también los de portabilidad), filtros, orden por columnas y paginación. Vista **Kanban** por estados (arrastrar solo backoffice/admin; pide motivo en Cancelado y Riesgos). **Exportar a Excel** (.xlsx) de lo filtrado. |
| **Nuevo / editar contrato** | Comercial, backoffice, admin | Formulario por secciones con validación en vivo: letra del DNI/NIE, teléfonos de 9 dígitos, CP que rellena la provincia, lista dinámica de portabilidades, PDF de la oferta (máx. 10 MB), cita de instalación y observación inicial. **Aviso de duplicados** por DNI/NIE o teléfono (no bloquea). Botón de guardar fijo abajo en móvil. |
| **Ficha del contrato** | Todos | Todos los datos, botón de llamada (`tel:`) en cada teléfono, visor del PDF con versiones, cambio de estado, firma y reasignación (backoffice), registro de llamadas, hilo de observaciones (solo se añaden) e historial de estados. |
| **Cola de llamadas** | Backoffice, admin | Pendientes ordenados por antigüedad con contador de días; primero los recordatorios de «volver a llamar» vencidos. Modo llamada con **Anterior / Siguiente** sin volver al listado. |
| **Usuarios y equipos** | Admin, backoffice, jefes | Alta, edición, desactivación y reseteo de contraseña (con contraseña temporal). Equipos y jefes (solo admin). |

### Roles

| | Admin | Backoffice | Jefe de equipo | Comercial |
|---|:-:|:-:|:-:|:-:|
| Ve contratos | Todos | Todos | Los de su equipo | Los suyos |
| Crea contratos | ✅ | ✅ | — | ✅ |
| Edita contratos | ✅ | ✅ | — | Los suyos, en Pendiente y sin firmar |
| Cambia estado / firma / reasigna / registra llamadas | ✅ | ✅ | — | — |
| Añade observaciones | ✅ | ✅ | ✅ | ✅ |
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

## Seguridad

- **RLS en todas las tablas.** El comercial solo ve sus filas, el jefe las de su equipo, backoffice y admin todo. Un usuario desactivado no ve nada aunque su sesión siga abierta.
- **Reglas de negocio en la base de datos:** validación de la letra del DNI/NIE, motivo obligatorio en Cancelado/Riesgos, el comercial no puede cambiar estado, firma ni comercial, el equipo se deriva siempre del comercial, las observaciones y el historial no se pueden editar ni borrar.
- **PDF en un bucket privado** (`contratos-pdf`, solo PDF, máx. 10 MB). Se abren con URLs firmadas de 1 hora y las mismas reglas que el contrato. Las versiones nunca se sobrescriben.
- **DNI y teléfonos nunca van en las URLs:** las rutas usan el id interno del contrato y las búsquedas viajan en el cuerpo de peticiones POST (RPC). Los filtros se guardan en `sessionStorage`, no en la barra de direcciones.
- **Los usuarios no se borran:** se desactivan (bloqueo en Auth + `activo = false`) y conservan su historial. Siempre queda al menos un admin activo.

## Estructura

```
supabase/
  migrations/      Esquema, triggers, RLS, vistas/RPC y Storage/Realtime
  functions/       Edge Function admin-users (Deno)
  seed.sql         Datos de ejemplo
  config.toml      Configuración para `supabase start`
src/
  auth/            Sesión, perfil y permisos por rol
  hooks/           Consultas, mutaciones y tiempo real (TanStack Query)
  components/      UI base, layout, contratos, dashboard y usuarios
  pages/           Una pantalla por ruta
  lib/             Tipos, constantes, validadores, formato y exportación a Excel
public/            Logo (+ variante para fondo oscuro) e iconos
```

## Personalización

- **Colores corporativos:** tokens `navy`, `brand` (verde) y `sun` (amarillo) en `src/index.css`, muestreados del logo.
- **Estados y sus colores** (badges, Kanban, dashboard): `src/lib/constants.ts`.
- **Logo:** `public/logo.png` y `public/logo-dark.png` (texto en blanco para el menú lateral).

## Comprobaciones

```bash
npm run typecheck   # TypeScript
npm test            # validadores (DNI/NIE, teléfonos, CP, precios…)
npm run build
```
