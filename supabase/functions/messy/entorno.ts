// Configuración, clientes de Supabase y utilidades comunes de Messy.
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

function variable(nombre: string): string {
  const v = Deno.env.get(nombre);
  if (!v) throw new Error(`Falta la variable de entorno ${nombre}`);
  return v;
}

export const env = {
  supabaseUrl: variable('SUPABASE_URL').replace(/\/$/, ''),
  anonKey: variable('SUPABASE_ANON_KEY'),
  serviceKey: variable('SUPABASE_SERVICE_ROLE_KEY'),
  whapiUrl: (Deno.env.get('WHAPI_URL') || 'https://gate.whapi.cloud').replace(/\/$/, ''),
  anthropicBaseUrl: Deno.env.get('ANTHROPIC_BASE_URL') || undefined,
  modelos: {
    /** Chat privado (agente con herramientas). */
    chat: Deno.env.get('MESSY_MODELO_CHAT') || 'claude-sonnet-5-5',
    /** Informes del grupo: buenos días y cierre del día. */
    informes: Deno.env.get('MESSY_MODELO_INFORMES') || 'claude-sonnet-5-5',
    /** Avisos de reserva de plaza en el grupo (frase corta tras cada una). */
    avisos: Deno.env.get('MESSY_MODELO_AVISOS') || 'claude-haiku-5-5',
  },
  crmUrl: Deno.env.get('CRM_URL') || 'https://joinapposl.github.io/mesenergiaes/',
};

const opcionesAuth = { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false };

/** Cliente con service_role: solo para las tablas internas de Messy y Auth. */
export const admin: SupabaseClient = createClient(env.supabaseUrl, env.serviceKey, { auth: opcionesAuth });

/** Cliente anónimo nuevo (login / refresco de sesión sin estado compartido). */
export function clienteAnonimo(): SupabaseClient {
  return createClient(env.supabaseUrl, env.anonKey, { auth: opcionesAuth });
}

/** Cliente que actúa como el usuario del CRM: se aplican sus políticas RLS. */
export function clienteUsuario(accessToken: string): SupabaseClient {
  return createClient(env.supabaseUrl, env.anonKey, {
    auth: opcionesAuth,
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}

// -----------------------------------------------------------------------------
// Claves: secretos de la Edge Function o, si no están, Supabase Vault
// -----------------------------------------------------------------------------
const cacheSecretos = new Map<string, { valor: string; hasta: number }>();

async function secreto(variableEntorno: string, nombreVault: string): Promise<string> {
  const deEntorno = Deno.env.get(variableEntorno);
  if (deEntorno) return deEntorno;
  const enCache = cacheSecretos.get(nombreVault);
  if (enCache && enCache.hasta > Date.now()) return enCache.valor;
  const { data, error } = await admin.rpc('messy_secreto', { p_nombre: nombreVault });
  if (error) console.error(`Messy: no se puede leer ${nombreVault} del Vault`, error.message);
  const valor = typeof data === 'string' ? data.trim() : '';
  // Si aún no está configurada, se vuelve a mirar en 30 s; si está, cada 5 min
  cacheSecretos.set(nombreVault, { valor, hasta: Date.now() + (valor ? 5 * 60_000 : 30_000) });
  return valor;
}

export const claveWhapi = () => secreto('WHAPI_TOKEN', 'messy_whapi_token');
export const claveAnthropic = () => secreto('ANTHROPIC_API_KEY', 'messy_anthropic_api_key');

export type Rol = 'admin' | 'backoffice' | 'jefe_equipo' | 'comercial';

export interface Perfil {
  id: string;
  nombre: string;
  apellidos: string;
  email: string;
  rol: Rol;
  equipo_id: string | null;
  equipo_nombre: string | null;
  activo: boolean;
  debe_cambiar_password: boolean;
}

export const NOMBRE_ROL: Record<Rol, string> = {
  admin: 'administrador/a',
  backoffice: 'backoffice',
  jefe_equipo: 'jefe/a de equipo',
  comercial: 'comercial',
};

export interface ConfigMessy {
  activo: boolean;
  funcion_url: string | null;
  clave: string;
  grupo_chat_id: string | null;
  grupo_nombre: string | null;
  hora_buenos_dias: number;
  hora_cierre: number;
  dias_activos: number[];
  /** quién recibe por privado los recordatorios de verificaciones */
  verificaciones_para: string[];
  /** minutos de antelación del recordatorio (0 = no se manda) */
  aviso_verificacion_min: number;
  resumen_verificaciones: boolean;
}

export async function leerConfig(): Promise<ConfigMessy> {
  const { data, error } = await admin.from('messy_config').select('*').eq('id', 1).single();
  if (error) throw error;
  return data as ConfigMessy;
}

/** Objetivo mensual del equipo: todas las reservas de plaza en conjunto. */
export interface Progreso {
  mes: string;
  objetivo: number;
  llevamos: number;
  en_crm: number;
  ajuste: number;
  quedan: number;
  pct_hecho: number;
  pct_quedan: number;
  dias_restantes: number;
}

export async function leerProgreso(): Promise<Progreso> {
  const { data, error } = await admin.rpc('messy_progreso_mes', { p_fecha: null });
  if (error) throw error;
  return data as Progreso;
}

export async function leerPerfil(userId: string): Promise<Perfil | null> {
  const { data, error } = await admin
    .from('profiles')
    .select('id, nombre, apellidos, email, rol, equipo_id, activo, debe_cambiar_password')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  let equipo_nombre: string | null = null;
  if (data.equipo_id) {
    const { data: eq } = await admin.from('equipos').select('nombre').eq('id', data.equipo_id).maybeSingle();
    equipo_nombre = eq?.nombre ?? null;
  }
  return { ...(data as Omit<Perfil, 'equipo_nombre'>), equipo_nombre };
}

/** Comparación en tiempo constante para la clave compartida. */
export function clavesIguales(a: string, b: string): boolean {
  const ea = new TextEncoder().encode(a);
  const eb = new TextEncoder().encode(b);
  let diff = ea.length ^ eb.length;
  for (let i = 0; i < Math.max(ea.length, eb.length); i++) diff |= (ea[i] ?? 0) ^ (eb[i] ?? 0);
  return diff === 0;
}

export function mensajeDeError(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (e && typeof e === 'object') {
    const o = e as { message?: unknown; details?: unknown; code?: unknown };
    if (typeof o.message === 'string' && o.message) return o.code ? `${o.message} (${o.code})` : o.message;
    try {
      return JSON.stringify(e);
    } catch {
      /* sigue abajo */
    }
  }
  return String(e);
}

// -----------------------------------------------------------------------------
// Fechas en hora de Madrid
// -----------------------------------------------------------------------------
const ZONA = 'Europe/Madrid';

function partes(fecha: Date): Record<string, string> {
  const f = new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    weekday: 'short',
  });
  return Object.fromEntries(f.formatToParts(fecha).map((p) => [p.type, p.value]));
}

const DIAS_ISO: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };

/** Suma días a una fecha ISO (AAAA-MM-DD) sin problemas de zona horaria. */
export function sumarDias(iso: string, dias: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

export function fechaLarga(iso: string): string {
  return new Intl.DateTimeFormat('es-ES', {
    timeZone: 'UTC',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(`${iso}T12:00:00Z`));
}

export function ahoraMadrid(fecha = new Date()) {
  const p = partes(fecha);
  const hoy = `${p.year}-${p.month}-${p.day}`;
  const diaSemana = DIAS_ISO[p.weekday] ?? 1;
  return {
    hoy,
    hora: `${p.hour}:${p.minute}`,
    diaSemana,
    larga: fechaLarga(hoy),
    ayer: sumarDias(hoy, -1),
    inicioSemana: sumarDias(hoy, 1 - diaSemana),
    inicioMes: `${p.year}-${p.month}-01`,
  };
}
