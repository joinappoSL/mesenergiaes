// Sesiones de WhatsApp: login con el usuario y contraseña del CRM.
// La contraseña nunca se guarda ni se envía a Claude: solo se usa para pedir a
// Supabase Auth una sesión, de la que guardamos los tokens para consultar los
// datos con los permisos (RLS) de esa persona.
import { admin, clienteAnonimo, leerPerfil, mensajeDeError, type Perfil } from './entorno.ts';

export interface Sesion {
  chat_id: string;
  estado: 'nuevo' | 'esperando_email' | 'esperando_password' | 'activa';
  email_pendiente: string | null;
  user_id: string | null;
  access_token: string | null;
  access_expira: string | null;
  refresh_token: string | null;
  fallos: number;
  bloqueado_hasta: string | null;
  nombre_whatsapp: string | null;
}

const MAX_FALLOS = 5;
const MINUTOS_BLOQUEO = 15;
const EMAIL_RE = /[^\s@<>]+@[^\s@<>]+\.[a-z]{2,}/i;

export async function leerSesion(chatId: string, nombreWhatsapp?: string): Promise<Sesion> {
  const { data, error } = await admin.from('messy_sesiones').select('*').eq('chat_id', chatId).maybeSingle();
  if (error) throw error;
  if (data) return data as Sesion;
  const { data: nueva, error: e2 } = await admin
    .from('messy_sesiones')
    .upsert({ chat_id: chatId, nombre_whatsapp: nombreWhatsapp ?? null }, { onConflict: 'chat_id' })
    .select('*')
    .single();
  if (e2) throw e2;
  return nueva as Sesion;
}

async function guardar(chatId: string, cambios: Partial<Sesion>) {
  const { error } = await admin
    .from('messy_sesiones')
    .update({ ...cambios, updated_at: new Date().toISOString() })
    .eq('chat_id', chatId);
  if (error) throw error;
}

const SIN_SESION: Partial<Sesion> = {
  estado: 'esperando_email',
  email_pendiente: null,
  user_id: null,
  access_token: null,
  access_expira: null,
  refresh_token: null,
};

export async function cerrarSesion(s: Sesion): Promise<void> {
  if (s.access_token) {
    // Revoca el refresh token en Supabase Auth (si ya caducó, no pasa nada)
    await admin.auth.admin.signOut(s.access_token, 'local').catch(() => undefined);
  }
  await guardar(s.chat_id, SIN_SESION);
}

/** Token de acceso vigente (lo renueva si le queda menos de 2 minutos). */
export async function tokenVigente(s: Sesion): Promise<string | null> {
  if (s.access_token && s.access_expira && new Date(s.access_expira).getTime() - Date.now() > 120_000) {
    return s.access_token;
  }
  if (!s.refresh_token) return null;
  const { data, error } = await clienteAnonimo().auth.refreshSession({ refresh_token: s.refresh_token });
  if (error || !data.session) {
    console.warn('Messy: no se ha podido renovar la sesión', s.chat_id.slice(-6), error?.message);
    await guardar(s.chat_id, SIN_SESION);
    return null;
  }
  const ses = data.session;
  await guardar(s.chat_id, {
    access_token: ses.access_token,
    refresh_token: ses.refresh_token,
    access_expira: new Date((ses.expires_at ?? Math.floor(Date.now() / 1000) + 3600) * 1000).toISOString(),
  });
  return ses.access_token;
}

export type ResultadoLogin =
  | { tipo: 'respuesta'; texto: string }
  | { tipo: 'dentro'; texto: string; perfil: Perfil };

function minutosRestantes(hasta: string): number {
  return Math.max(1, Math.ceil((new Date(hasta).getTime() - Date.now()) / 60_000));
}

/**
 * Máquina de estados del login. Acepta «email» y luego «contraseña», o las dos
 * cosas en un solo mensaje («nombre@mesenergia.es MiContraseña»).
 */
export async function pasoLogin(s: Sesion, texto: string): Promise<ResultadoLogin> {
  if (s.bloqueado_hasta && new Date(s.bloqueado_hasta) > new Date()) {
    return {
      tipo: 'respuesta',
      texto: `🔒 Demasiados intentos fallidos. Vuelve a probar dentro de ${minutosRestantes(s.bloqueado_hasta)} min.`,
    };
  }

  const limpio = texto.trim();
  const email = limpio.match(EMAIL_RE)?.[0]?.toLowerCase() ?? null;

  // Email + contraseña en el mismo mensaje
  if (email) {
    const resto = limpio.replace(EMAIL_RE, ' ').trim();
    if (resto && !/\s/.test(resto)) return intentarLogin(s, email, resto);
    await guardar(s.chat_id, { estado: 'esperando_password', email_pendiente: email });
    return {
      tipo: 'respuesta',
      texto: `Perfecto 👌 Ahora envíame tu *contraseña del CRM*.\n\n_Cuando entres, borra ese mensaje del chat por seguridad._`,
    };
  }

  if (s.estado === 'esperando_password' && s.email_pendiente) {
    return intentarLogin(s, s.email_pendiente, limpio);
  }

  await guardar(s.chat_id, { estado: 'esperando_email', email_pendiente: null });
  return {
    tipo: 'respuesta',
    texto:
      `¡Hola! 👋 Soy *Messy*, el asistente de IA de MESENERGIA ⚡\n\n` +
      `Para hablar conmigo inicia sesión con tu usuario del CRM.\n` +
      `Escríbeme tu *email* (ej. nombre.apellido@mesenergia.es).`,
  };
}

async function intentarLogin(s: Sesion, email: string, password: string): Promise<ResultadoLogin> {
  const { data, error } = await clienteAnonimo().auth.signInWithPassword({ email, password });

  if (error || !data.session || !data.user) {
    const fallos = (s.fallos ?? 0) + 1;
    if (fallos >= MAX_FALLOS) {
      await guardar(s.chat_id, {
        ...SIN_SESION,
        fallos: 0,
        bloqueado_hasta: new Date(Date.now() + MINUTOS_BLOQUEO * 60_000).toISOString(),
      });
      return {
        tipo: 'respuesta',
        texto: `🔒 Demasiados intentos fallidos. Por seguridad, espera ${MINUTOS_BLOQUEO} minutos antes de volver a probar.`,
      };
    }
    await guardar(s.chat_id, { ...SIN_SESION, fallos });
    const baneado = /banned/i.test(mensajeDeError(error));
    return {
      tipo: 'respuesta',
      texto: baneado
        ? '⛔ Tu usuario está desactivado en el CRM. Habla con administración.'
        : '❌ Email o contraseña incorrectos. Vuelve a escribirme tu *email* para intentarlo de nuevo.',
    };
  }

  const perfil = await leerPerfil(data.user.id);
  if (!perfil || !perfil.activo) {
    await admin.auth.admin.signOut(data.session.access_token, 'local').catch(() => undefined);
    await guardar(s.chat_id, SIN_SESION);
    return { tipo: 'respuesta', texto: '⛔ Tu usuario está desactivado en el CRM. Habla con administración.' };
  }

  await guardar(s.chat_id, {
    estado: 'activa',
    email_pendiente: null,
    user_id: data.user.id,
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    access_expira: new Date((data.session.expires_at ?? Math.floor(Date.now() / 1000) + 3600) * 1000).toISOString(),
    fallos: 0,
    bloqueado_hasta: null,
  });

  const nombre = perfil.nombre || 'crack';
  const ejemplos =
    perfil.rol === 'comercial'
      ? '• ¿Cuántas ventas llevo este mes?\n• ¿Qué contratos tengo pendientes de firmar?\n• ¿Cómo voy en el ranking de hoy?'
      : perfil.rol === 'jefe_equipo'
        ? '• ¿Cómo va mi equipo hoy?\n• Ranking de la semana\n• ¿Qué contratos de mi equipo están en riesgos?'
        : '• Resumen de hoy\n• Ranking del mes por comercial\n• ¿Cuántos pendientes sin firmar hay en la cola?';

  return {
    tipo: 'dentro',
    perfil,
    texto:
      `✅ ¡Ya estás dentro, ${nombre}! 💪\n\nPregúntame lo que quieras sobre el CRM, por ejemplo:\n${ejemplos}\n\n` +
      `_Borra del chat el mensaje con tu contraseña. Para cerrar la sesión escribe «salir»._` +
      (perfil.debe_cambiar_password ? `\n\n⚠️ Aún tienes la contraseña temporal: cámbiala al entrar en el CRM.` : ''),
  };
}
