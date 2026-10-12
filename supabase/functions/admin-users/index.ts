// =============================================================================
// Edge Function: admin-users
// Alta, edición, activación/desactivación y reseteo de contraseña de usuarios.
// Usa la service_role key (solo en el servidor) y valida que quien llama tiene
// permiso sobre el rol y el equipo del usuario objetivo:
//   · admin       → cualquier usuario y rol
//   · backoffice  → solo comerciales
//   · jefe_equipo → solo comerciales de su equipo (los nuevos van a su equipo)
// Los usuarios nunca se borran: se desactivan (ban en Auth + activo=false).
// =============================================================================
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders, json } from '../_shared/cors.ts';

type Rol = 'admin' | 'backoffice' | 'jefe_equipo' | 'comercial';

interface Perfil {
  id: string;
  nombre: string;
  apellidos: string;
  email: string;
  telefono: string | null;
  rol: Rol;
  equipo_id: string | null;
  activo: boolean;
}

interface DatosUsuario {
  nombre?: string;
  apellidos?: string;
  email?: string;
  telefono?: string | null;
  rol?: Rol;
  equipo_id?: string | null;
  password?: string;
}

type Peticion =
  | ({ accion: 'crear' } & DatosUsuario)
  | ({ accion: 'editar'; id: string } & DatosUsuario)
  | { accion: 'activar'; id: string; activo: boolean }
  | { accion: 'reset_password'; id: string; password: string };

const ROLES: Rol[] = ['admin', 'backoffice', 'jefe_equipo', 'comercial'];
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const BAN_INDEFINIDO = '876000h'; // ~100 años

class ErrorHttp extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const prohibido = (msg: string) => new ErrorHttp(403, msg);
const invalido = (msg: string) => new ErrorHttp(400, msg);

function limpiar(v: string | null | undefined): string {
  return (v ?? '').trim();
}

function normalizarTelefono(v: string | null | undefined): string | null {
  let t = (v ?? '').replace(/\D/g, '');
  if (t.length === 11 && t.startsWith('34')) t = t.slice(2);
  if (t.length === 13 && t.startsWith('0034')) t = t.slice(4);
  return t === '' ? null : t;
}

function validarPassword(p: string | undefined): string {
  const pass = p ?? '';
  if (pass.length < 8) throw invalido('La contraseña debe tener al menos 8 caracteres.');
  return pass;
}

/** Comprueba que el llamante puede gestionar al usuario objetivo con el rol/equipo resultantes. */
function comprobarPermiso(
  llamante: Perfil,
  objetivo: Perfil | null,
  rolFinal: Rol,
  equipoFinal: string | null,
): void {
  if (llamante.rol === 'admin') return;

  if (llamante.rol === 'backoffice') {
    if (objetivo && objetivo.rol !== 'comercial') throw prohibido('Backoffice solo puede gestionar comerciales.');
    if (rolFinal !== 'comercial') throw prohibido('Backoffice solo puede crear o editar usuarios comerciales.');
    return;
  }

  if (llamante.rol === 'jefe_equipo') {
    if (!llamante.equipo_id) throw prohibido('No tienes un equipo asignado.');
    if (objetivo && (objetivo.rol !== 'comercial' || objetivo.equipo_id !== llamante.equipo_id)) {
      throw prohibido('Solo puedes gestionar los comerciales de tu equipo.');
    }
    if (rolFinal !== 'comercial') throw prohibido('Solo puedes crear o editar comerciales.');
    if (equipoFinal !== llamante.equipo_id) throw prohibido('Los comerciales deben pertenecer a tu equipo.');
    return;
  }

  throw prohibido('No tienes permiso para gestionar usuarios.');
}

async function obtenerPerfil(db: SupabaseClient, id: string): Promise<Perfil | null> {
  const { data, error } = await db.from('profiles').select('*').eq('id', id).maybeSingle();
  if (error) throw new ErrorHttp(500, error.message);
  return data as Perfil | null;
}

async function quedaOtroAdminActivo(db: SupabaseClient, excluirId: string): Promise<boolean> {
  const { count, error } = await db
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('rol', 'admin')
    .eq('activo', true)
    .neq('id', excluirId);
  if (error) throw new ErrorHttp(500, error.message);
  return (count ?? 0) > 0;
}

async function comprobarEquipo(db: SupabaseClient, equipoId: string | null): Promise<void> {
  if (!equipoId) return;
  const { data, error } = await db.from('equipos').select('id').eq('id', equipoId).maybeSingle();
  if (error) throw new ErrorHttp(500, error.message);
  if (!data) throw invalido('El equipo indicado no existe.');
}

/** Mantiene equipos.jefe_id coherente con el rol/equipo del usuario. */
async function sincronizarJefatura(db: SupabaseClient, id: string, rol: Rol, equipoId: string | null) {
  if (rol === 'jefe_equipo' && equipoId) {
    const { error } = await db.from('equipos').update({ jefe_id: id }).eq('id', equipoId);
    if (error) throw new ErrorHttp(500, error.message);
  } else {
    const { error } = await db.from('equipos').update({ jefe_id: null }).eq('jefe_id', id);
    if (error) throw new ErrorHttp(500, error.message);
  }
}

function equipoSegunRol(llamante: Perfil, rol: Rol, equipoPedido: string | null | undefined): string | null {
  if (llamante.rol === 'jefe_equipo') return llamante.equipo_id;
  if (rol === 'admin' || rol === 'backoffice') return null;
  return equipoPedido || null;
}

async function crear(db: SupabaseClient, llamante: Perfil, p: DatosUsuario) {
  const nombre = limpiar(p.nombre);
  const apellidos = limpiar(p.apellidos);
  const email = limpiar(p.email).toLowerCase();
  const telefono = normalizarTelefono(p.telefono);
  const rol: Rol = p.rol ?? 'comercial';
  if (!nombre || !apellidos) throw invalido('Nombre y apellidos son obligatorios.');
  if (!EMAIL_RE.test(email)) throw invalido('El email no es válido.');
  if (!ROLES.includes(rol)) throw invalido('Rol no válido.');
  if (telefono && !/^\d{9}$/.test(telefono)) throw invalido('El teléfono debe tener 9 dígitos.');
  const password = validarPassword(p.password);
  const equipoId = equipoSegunRol(llamante, rol, p.equipo_id);

  comprobarPermiso(llamante, null, rol, equipoId);
  await comprobarEquipo(db, equipoId);

  const { data, error } = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { nombre, apellidos, telefono },
    app_metadata: { rol, equipo_id: equipoId, debe_cambiar_password: true },
  });
  if (error || !data.user) {
    const msg = error?.message ?? 'No se pudo crear el usuario.';
    if (/already|registered|exists/i.test(msg)) throw invalido('Ya existe un usuario con ese email.');
    throw invalido(msg);
  }

  const id = data.user.id;
  const { error: errPerfil } = await db.from('profiles').upsert({
    id,
    email,
    nombre,
    apellidos,
    telefono,
    rol,
    equipo_id: equipoId,
    activo: true,
    debe_cambiar_password: true,
  });
  if (errPerfil) throw new ErrorHttp(500, errPerfil.message);

  await sincronizarJefatura(db, id, rol, equipoId);
  return { id };
}

async function editar(db: SupabaseClient, llamante: Perfil, id: string, p: DatosUsuario) {
  const objetivo = await obtenerPerfil(db, id);
  if (!objetivo) throw new ErrorHttp(404, 'Usuario no encontrado.');

  const nombre = p.nombre !== undefined ? limpiar(p.nombre) : objetivo.nombre;
  const apellidos = p.apellidos !== undefined ? limpiar(p.apellidos) : objetivo.apellidos;
  const email = p.email !== undefined ? limpiar(p.email).toLowerCase() : objetivo.email;
  const telefono = p.telefono !== undefined ? normalizarTelefono(p.telefono) : objetivo.telefono;
  const rol: Rol = p.rol ?? objetivo.rol;
  const equipoId =
    p.equipo_id !== undefined || p.rol !== undefined
      ? equipoSegunRol(llamante, rol, p.equipo_id !== undefined ? p.equipo_id : objetivo.equipo_id)
      : objetivo.equipo_id;

  if (!nombre || !apellidos) throw invalido('Nombre y apellidos son obligatorios.');
  if (!EMAIL_RE.test(email)) throw invalido('El email no es válido.');
  if (!ROLES.includes(rol)) throw invalido('Rol no válido.');
  if (telefono && !/^\d{9}$/.test(telefono)) throw invalido('El teléfono debe tener 9 dígitos.');

  comprobarPermiso(llamante, objetivo, rol, equipoId);
  await comprobarEquipo(db, equipoId);

  if (id === llamante.id && rol !== objetivo.rol) throw prohibido('No puedes cambiar tu propio rol.');
  if (objetivo.rol === 'admin' && rol !== 'admin' && !(await quedaOtroAdminActivo(db, id))) {
    throw invalido('Debe quedar al menos un administrador activo.');
  }

  const { error: errAuth } = await db.auth.admin.updateUserById(id, {
    ...(email !== objetivo.email ? { email, email_confirm: true } : {}),
    user_metadata: { nombre, apellidos, telefono },
    app_metadata: { rol, equipo_id: equipoId },
  });
  if (errAuth) {
    if (/already|registered|exists/i.test(errAuth.message)) throw invalido('Ya existe un usuario con ese email.');
    throw invalido(errAuth.message);
  }

  // Si deja de ser jefe, se libera su equipo antes de cambiar el rol.
  if (objetivo.rol === 'jefe_equipo' && rol !== 'jefe_equipo') {
    await sincronizarJefatura(db, id, 'comercial', null);
  }

  const { error } = await db
    .from('profiles')
    .update({ nombre, apellidos, email, telefono, rol, equipo_id: equipoId })
    .eq('id', id);
  if (error) throw new ErrorHttp(500, error.message);

  if (rol === 'jefe_equipo') await sincronizarJefatura(db, id, rol, equipoId);
  return { id };
}

async function activar(db: SupabaseClient, llamante: Perfil, id: string, activo: boolean) {
  const objetivo = await obtenerPerfil(db, id);
  if (!objetivo) throw new ErrorHttp(404, 'Usuario no encontrado.');
  if (id === llamante.id) throw prohibido('No puedes desactivarte a ti mismo.');
  comprobarPermiso(llamante, objetivo, objetivo.rol, objetivo.equipo_id);
  if (!activo && objetivo.rol === 'admin' && !(await quedaOtroAdminActivo(db, id))) {
    throw invalido('Debe quedar al menos un administrador activo.');
  }

  const { error: errAuth } = await db.auth.admin.updateUserById(id, {
    ban_duration: activo ? 'none' : BAN_INDEFINIDO,
  });
  if (errAuth) throw invalido(errAuth.message);

  const { error } = await db.from('profiles').update({ activo }).eq('id', id);
  if (error) throw new ErrorHttp(500, error.message);
  return { id, activo };
}

async function resetPassword(db: SupabaseClient, llamante: Perfil, id: string, password: string) {
  const objetivo = await obtenerPerfil(db, id);
  if (!objetivo) throw new ErrorHttp(404, 'Usuario no encontrado.');
  if (id !== llamante.id) comprobarPermiso(llamante, objetivo, objetivo.rol, objetivo.equipo_id);
  const pass = validarPassword(password);

  const { error: errAuth } = await db.auth.admin.updateUserById(id, { password: pass });
  if (errAuth) throw invalido(errAuth.message);

  const { error } = await db
    .from('profiles')
    .update({ debe_cambiar_password: id !== llamante.id })
    .eq('id', id);
  if (error) throw new ErrorHttp(500, error.message);
  return { id };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405);

  try {
    const url = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !serviceKey) throw new ErrorHttp(500, 'Función mal configurada: faltan variables de entorno.');

    const db = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
    if (!token) throw new ErrorHttp(401, 'No autenticado.');
    const { data: auth, error: errUser } = await db.auth.getUser(token);
    if (errUser || !auth.user) throw new ErrorHttp(401, 'Sesión no válida. Vuelve a iniciar sesión.');

    const llamante = await obtenerPerfil(db, auth.user.id);
    if (!llamante || !llamante.activo) throw prohibido('Tu usuario no está activo.');
    if (llamante.rol === 'comercial') throw prohibido('No tienes permiso para gestionar usuarios.');

    const peticion = (await req.json()) as Peticion;

    switch (peticion.accion) {
      case 'crear':
        return json(await crear(db, llamante, peticion), 201);
      case 'editar':
        return json(await editar(db, llamante, peticion.id, peticion));
      case 'activar':
        return json(await activar(db, llamante, peticion.id, Boolean(peticion.activo)));
      case 'reset_password':
        return json(await resetPassword(db, llamante, peticion.id, peticion.password));
      default:
        throw invalido('Acción no válida.');
    }
  } catch (e) {
    if (e instanceof ErrorHttp) return json({ error: e.message }, e.status);
    console.error(e);
    return json({ error: e instanceof Error ? e.message : 'Error inesperado' }, 500);
  }
});
