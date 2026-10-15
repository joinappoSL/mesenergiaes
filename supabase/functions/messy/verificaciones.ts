// Messy y las verificaciones de backoffice:
//   · grupo: resultado de cada llamada de verificación, hecha o reprogramada
//     (solo número de contrato y comercial, nunca el nombre del cliente)
//   · privado (Gabriela, Mario…): aviso unos minutos antes de cada verificación,
//     la lista del día por la mañana y el balance por la noche
//   · datos para la herramienta «verificaciones» del chat
// Nunca DNI, teléfonos, emails ni direcciones.
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { admin, ahoraMadrid, env, fechaLarga, leerConfig, mensajeDeError, sumarDias, type ConfigMessy } from './entorno.ts';
import { enviarTexto } from './whapi.ts';

interface MensajeCola {
  id: number;
  tipo: 'resultado' | 'recordatorio' | 'resumen_manana' | 'resumen_noche';
  clave: string;
  contrato_id: string | null;
  verificacion_at: string | null;
  desde_log_id: number | null;
  intentos: number;
  created_at: string;
}

interface Registro {
  id: number;
  accion: 'llamada' | 'hecha' | 'pendiente' | 'programada' | 'reprogramada' | 'quitada';
  resultado: 'no_contesta' | 'contactado' | 'volver_a_llamar' | 'firmado' | 'rechaza' | null;
  de_at: string | null;
  a_at: string | null;
}

export interface ResumenVerificaciones {
  fecha: string;
  programadas: number;
  hechas: number;
  no_contesta: number;
  reprogramadas: number;
  sin_hacer: number;
  firmadas_hoy: number;
  firmadas_mes: number;
}

export async function leerResumenVerificaciones(): Promise<ResumenVerificaciones> {
  const { data, error } = await admin.rpc('messy_verificaciones_resumen', { p_fecha: null });
  if (error) throw error;
  return data as ResumenVerificaciones;
}

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;
const firmadasMes = (n: number) => `Vamos ${plural(n, 'firmada', 'firmadas')} este mes`;

export interface FilaVerificacion {
  numero: number;
  cliente_nombre: string;
  cliente_apellidos: string;
  verificacion_at: string;
  verificacion_hecha_at: string | null;
  verificacion_hecha_por_nombre: string | null;
  estado: string;
  producto: string | null;
  operadora: string | null;
  comercial_id: string | null;
  created_by: string | null;
  comercial_nombre: string | null;
  instalacion_fecha: string | null;
  instalacion_franja: string | null;
}

const CAMPOS =
  'numero, cliente_nombre, cliente_apellidos, verificacion_at, verificacion_hecha_at, verificacion_hecha_por_nombre, ' +
  'estado, producto, operadora, comercial_id, created_by, comercial_nombre, instalacion_fecha, instalacion_franja';

/** Hasta 15 minutos después de la hora sigue siendo «toca ahora» (como en el CRM). */
const MARGEN_AHORA_MS = 15 * 60_000;
const HORA = 3_600_000;

export const urlCalendario = () => `${env.crmUrl.replace(/\/?$/, '/')}verificaciones`;

const fmtDia = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit' });
const fmtHora = new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

/** Día en Madrid (AAAA-MM-DD) de un instante. */
export function diaMadrid(iso: string): string {
  return fmtDia.format(new Date(iso));
}

export function horaMadrid(iso: string): string {
  return fmtHora.format(new Date(iso));
}

function nombreCliente(c: FilaVerificacion): string {
  return `${c.cliente_nombre} ${c.cliente_apellidos}`.trim();
}

const numero = (n: number) => `#${String(n).padStart(5, '0')}`;

/** «hoy», «mañana», «el lunes 13/10» */
function diaHumano(dia: string, hoy: string): string {
  if (dia === hoy) return 'hoy';
  if (dia === sumarDias(hoy, 1)) return 'mañana';
  if (dia === sumarDias(hoy, -1)) return 'ayer';
  const d = new Date(`${dia}T12:00:00Z`);
  const semana = new Intl.DateTimeFormat('es-ES', { timeZone: 'UTC', weekday: 'long' }).format(d);
  return `el ${semana} ${dia.slice(8, 10)}/${dia.slice(5, 7)}`;
}

export function estadoVerificacion(c: Pick<FilaVerificacion, 'verificacion_at' | 'verificacion_hecha_at'>, ahora = Date.now()) {
  if (c.verificacion_hecha_at) return 'hecha';
  const pasado = ahora - new Date(c.verificacion_at).getTime();
  if (pasado < 0) return 'pendiente';
  return pasado <= MARGEN_AHORA_MS ? 'toca ahora' : 'retrasada';
}

// -----------------------------------------------------------------------------
// Consultas (con el cliente que toque: service_role para los avisos, el del
// usuario para el chat, así cada uno ve lo que ve en el CRM)
// -----------------------------------------------------------------------------
async function entre(db: SupabaseClient, desde: Date, hasta: Date): Promise<FilaVerificacion[]> {
  const { data, error } = await db
    .from('v_contratos')
    .select(CAMPOS)
    .gte('verificacion_at', desde.toISOString())
    .lt('verificacion_at', hasta.toISOString())
    .neq('estado', 'cancelado')
    .order('verificacion_at', { ascending: true })
    .limit(300);
  if (error) throw error;
  return (data ?? []) as unknown as FilaVerificacion[];
}

/** Verificaciones de los días de Madrid [desdeDia, hastaDia] (ambos incluidos). */
export async function verificacionesDeDias(db: SupabaseClient, desdeDia: string, hastaDia: string): Promise<FilaVerificacion[]> {
  // Ventana amplia en UTC y filtro exacto por día de Madrid (sin líos de horario de verano).
  const desde = new Date(`${desdeDia}T00:00:00Z`).getTime() - 3 * HORA;
  const hasta = new Date(`${hastaDia}T00:00:00Z`).getTime() + 27 * HORA;
  const filas = await entre(db, new Date(desde), new Date(hasta));
  return filas.filter((c) => {
    const d = diaMadrid(c.verificacion_at);
    return d >= desdeDia && d <= hastaDia;
  });
}

/** Sin hacer y pasadas de hora (más de 15 min), de contratos que siguen en Pendiente. */
export async function verificacionesAtrasadas(db: SupabaseClient): Promise<FilaVerificacion[]> {
  const { data, error } = await db
    .from('v_contratos')
    .select(CAMPOS)
    .lt('verificacion_at', new Date(Date.now() - MARGEN_AHORA_MS).toISOString())
    .is('verificacion_hecha_at', null)
    .eq('estado', 'pendiente')
    .order('verificacion_at', { ascending: true })
    .limit(100);
  if (error) throw error;
  return (data ?? []) as unknown as FilaVerificacion[];
}

/** Forma compacta para Claude (herramienta del chat). */
export function paraElChat(c: FilaVerificacion, hoy: string) {
  return {
    numero: c.numero,
    cliente: nombreCliente(c),
    dia: diaHumano(diaMadrid(c.verificacion_at), hoy),
    hora: horaMadrid(c.verificacion_at),
    verificacion: estadoVerificacion(c),
    hecha_por: c.verificacion_hecha_por_nombre ?? undefined,
    hecha_a_las: c.verificacion_hecha_at ? horaMadrid(c.verificacion_hecha_at) : undefined,
    estado_contrato: c.estado,
    comercial: c.comercial_nombre,
    producto: c.producto ?? c.operadora,
    instalacion: c.instalacion_fecha
      ? `${diaHumano(c.instalacion_fecha, hoy)}${c.instalacion_franja ? ` (${c.instalacion_franja})` : ''}`
      : null,
  };
}

// -----------------------------------------------------------------------------
// Textos de los avisos
// -----------------------------------------------------------------------------
/** «hoy a las 17:00», «mañana a las 10:00», «el lunes 20/10 a las 10:00» */
function cuando(iso: string, hoy: string): string {
  return `${diaHumano(diaMadrid(iso), hoy)} a las ${horaMadrid(iso)}`;
}

async function textoRecordatorio(r: MensajeCola): Promise<string | null> {
  if (!r.contrato_id) return null;
  const { data, error } = await admin.from('v_contratos').select(CAMPOS).eq('id', r.contrato_id).maybeSingle();
  if (error) throw error;
  const c = data as unknown as FilaVerificacion | null;
  // Ya no hace falta: borrado, hecha, cancelado o reprogramado (tendrá su propio aviso)
  if (!c || c.verificacion_hecha_at || c.estado === 'cancelado' || !c.verificacion_at) return null;
  if (r.verificacion_at && new Date(c.verificacion_at).getTime() !== new Date(r.verificacion_at).getTime()) return null;

  const hoy = ahoraMadrid().hoy;
  const min = Math.round((new Date(c.verificacion_at).getTime() - Date.now()) / 60_000);
  if (min < -15) return null; // llega tarde: ya no sirve
  const cuando = min >= 1 ? `en ${min} min` : 'ahora';
  const lineas = [
    `📞 *Verificación ${cuando}* · ${horaMadrid(c.verificacion_at)}`,
    `*${nombreCliente(c)}* · ${numero(c.numero)}`,
    [c.producto ?? c.operadora, c.comercial_nombre && `comercial: ${c.comercial_nombre}`].filter(Boolean).join(' · '),
  ];
  if (c.instalacion_fecha) {
    lineas.push(
      `🛠️ Instalación ${diaHumano(c.instalacion_fecha, hoy)}${c.instalacion_franja ? ` (${c.instalacion_franja})` : ''}`,
    );
  }
  lineas.push('', `👉 ${urlCalendario()}`);
  return lineas.join('\n');
}

async function textoResumenManana(): Promise<string | null> {
  const f = ahoraMadrid();
  const [deHoy, atrasadas] = await Promise.all([
    verificacionesDeDias(admin, f.hoy, f.hoy),
    verificacionesAtrasadas(admin),
  ]);
  const pendientesHoy = deHoy.filter((c) => !c.verificacion_hecha_at);
  const anteriores = atrasadas.filter((c) => diaMadrid(c.verificacion_at) < f.hoy);
  if (!pendientesHoy.length && !anteriores.length) return null;

  const lineas = [`☀️ *Verificaciones de hoy* · ${fechaLarga(f.hoy)}`, ''];
  if (pendientesHoy.length) {
    for (const c of pendientesHoy.slice(0, 25)) {
      lineas.push(`• ${horaMadrid(c.verificacion_at)} · ${nombreCliente(c)} · ${numero(c.numero)}`);
    }
    if (pendientesHoy.length > 25) lineas.push(`• … y ${pendientesHoy.length - 25} más`);
  } else {
    lineas.push('Hoy no hay ninguna programada 🙌');
  }
  if (anteriores.length) {
    lineas.push('', `⏰ *Atrasadas sin hacer:* ${anteriores.length}`);
    for (const c of anteriores.slice(0, 10)) {
      const dia = diaMadrid(c.verificacion_at);
      lineas.push(`• ${diaHumano(dia, f.hoy)} ${horaMadrid(c.verificacion_at)} · ${nombreCliente(c)} · ${numero(c.numero)}`);
    }
    if (anteriores.length > 10) lineas.push(`• … y ${anteriores.length - 10} más`);
  }
  lineas.push('', `Te aviso unos minutos antes de cada una 📲`, `👉 ${urlCalendario()}`);
  return lineas.join('\n');
}

async function textoResumenNoche(): Promise<string | null> {
  const f = ahoraMadrid();
  const manana = sumarDias(f.hoy, 1);
  const [r, deHoy, deManana] = await Promise.all([
    leerResumenVerificaciones(),
    verificacionesDeDias(admin, f.hoy, f.hoy),
    verificacionesDeDias(admin, manana, manana),
  ]);
  const sinHacer = deHoy.filter((c) => !c.verificacion_hecha_at);
  const paraManana = deManana.filter((c) => !c.verificacion_hecha_at);
  if (!r.programadas && !r.hechas && !paraManana.length && !r.firmadas_hoy) return null;

  const lineas = [`🌙 *Verificaciones · cierre del día* · ${fechaLarga(f.hoy)}`, ''];
  lineas.push(
    `📋 Hoy había *${r.programadas}*: ✅ ${plural(r.hechas, 'hecha', 'hechas')} · 📵 ${r.no_contesta} no contesta · ` +
      `🗓️ ${plural(r.reprogramadas, 'reprogramada', 'reprogramadas')}`,
  );
  if (sinHacer.length) {
    lineas.push('', `⏳ *Se quedan sin hacer:* ${sinHacer.length}`);
    for (const c of sinHacer.slice(0, 10)) {
      lineas.push(`• ${horaMadrid(c.verificacion_at)} · ${nombreCliente(c)} · ${numero(c.numero)}`);
    }
    if (sinHacer.length > 10) lineas.push(`• … y ${sinHacer.length - 10} más`);
  }
  lineas.push('');
  if (paraManana.length) {
    lineas.push(`📅 *Pendientes para mañana:* ${paraManana.length}`);
    for (const c of paraManana.slice(0, 20)) {
      lineas.push(`• ${horaMadrid(c.verificacion_at)} · ${nombreCliente(c)} · ${numero(c.numero)}`);
    }
    if (paraManana.length > 20) lineas.push(`• … y ${paraManana.length - 20} más`);
  } else {
    lineas.push('📅 Mañana no hay verificaciones programadas');
  }
  lineas.push(
    '',
    `✍️ Firmadas hoy: *${r.firmadas_hoy}* · ${firmadasMes(r.firmadas_mes).replace(/(\d+)/, '*$1*')}${r.firmadas_hoy ? ' 🔥' : ''}`,
    `👉 ${urlCalendario()}`,
  );
  return lineas.join('\n');
}

// -----------------------------------------------------------------------------
// Listados para el grupo: solo número de contrato, hora y comercial
// -----------------------------------------------------------------------------
/** Nombre corto del comercial (el mismo que usa Messy en el grupo). */
async function nombresComerciales(filas: FilaVerificacion[]): Promise<Map<string, string>> {
  const ids = [...new Set(filas.map((c) => c.comercial_id ?? c.created_by).filter((x): x is string => !!x))];
  const nombres = await Promise.all(
    ids.map(async (id) => [id, ((await admin.rpc('messy_nombre', { p_id: id })).data as string | null) ?? ''] as const),
  );
  return new Map(nombres);
}

function lineaGrupo(c: FilaVerificacion, nombres: Map<string, string>, conDia = false, hoy = ''): string {
  const comercial = nombres.get(c.comercial_id ?? c.created_by ?? '');
  const hora = conDia ? `${diaHumano(diaMadrid(c.verificacion_at), hoy)} ${horaMadrid(c.verificacion_at)}` : horaMadrid(c.verificacion_at);
  const estado = estadoVerificacion(c);
  const marca = estado === 'retrasada' ? ' ⏰' : estado === 'toca ahora' ? ' 📞 ahora' : '';
  return `• ${hora} · ${numero(c.numero)}${comercial ? ` (${comercial})` : ''}${marca}`;
}

/** Última llamada registrada a un contrato con verificación (para el grupo). */
async function ultimaLlamadaGrupo(hoy: string): Promise<string | null> {
  const { data, error } = await admin
    .from('llamadas')
    .select('resultado, volver_a_llamar_at, created_at, contratos!inner(numero, comercial_id, created_by, verificacion_at, verificacion_hecha_at)')
    .not('contratos.verificacion_at', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const l = data as unknown as {
    resultado: NonNullable<Registro['resultado']>;
    volver_a_llamar_at: string | null;
    created_at: string;
    contratos: { numero: number; comercial_id: string | null; created_by: string | null; verificacion_at: string; verificacion_hecha_at: string | null };
  };
  const { data: comercial } = await admin.rpc('messy_nombre', { p_id: l.contratos.comercial_id ?? l.contratos.created_by });
  const r = RESULTADO[l.resultado];
  const partes = [
    `${r.emoji} Última llamada: ${numero(l.contratos.numero)}${comercial ? ` (comercial ${comercial})` : ''}`,
    `${r.texto}${l.resultado === 'volver_a_llamar' && l.volver_a_llamar_at ? ` ${cuando(l.volver_a_llamar_at, hoy)}` : ''}`,
    cuando(l.created_at, hoy),
  ];
  if (l.contratos.verificacion_hecha_at) partes.push('verificación hecha ✔️');
  else if (new Date(l.contratos.verificacion_at) > new Date(l.created_at)) {
    partes.push(`verificación programada para ${cuando(l.contratos.verificacion_at, hoy)}`);
  }
  return partes.join(' · ');
}

/**
 * Listado de verificaciones pendientes para el grupo.
 *   · completo: atrasadas + hoy y los próximos 6 días, por días (mensaje suelto)
 *   · manana:   atrasadas + las de hoy (con los buenos días)
 *   · noche:    las de mañana (con el cierre)
 */
export async function bloquePendientesGrupo(modo: 'completo' | 'manana' | 'noche'): Promise<string> {
  const hoy = ahoraMadrid().hoy;
  const manana = sumarDias(hoy, 1);
  const [proximas, atrasadas] = await Promise.all([
    modo === 'noche'
      ? verificacionesDeDias(admin, manana, manana)
      : verificacionesDeDias(admin, hoy, modo === 'completo' ? sumarDias(hoy, 6) : hoy),
    modo === 'noche' ? Promise.resolve([] as FilaVerificacion[]) : verificacionesAtrasadas(admin),
  ]);
  const pendientes = proximas.filter((c) => !c.verificacion_hecha_at);
  const anteriores = atrasadas.filter((c) => diaMadrid(c.verificacion_at) < hoy);
  const nombres = await nombresComerciales([...pendientes, ...anteriores]);

  const lineas: string[] = [];
  if (anteriores.length) {
    lineas.push(`⏰ *Atrasadas:* ${anteriores.length}`);
    for (const c of anteriores.slice(0, 10)) lineas.push(lineaGrupo(c, nombres, true, hoy));
    lineas.push('');
  }
  const porDia = new Map<string, FilaVerificacion[]>();
  for (const c of pendientes) {
    const d = diaMadrid(c.verificacion_at);
    porDia.set(d, [...(porDia.get(d) ?? []), c]);
  }
  if (modo === 'manana' && !porDia.has(hoy)) lineas.push('Ninguna pendiente para hoy 🙌', '');
  if (modo === 'completo' && !porDia.has(hoy)) lineas.push('*Hoy:* ninguna pendiente 🙌', '');
  if (modo === 'noche' && !porDia.size) lineas.push('📅 *Mañana:* no hay verificaciones programadas');
  for (const [dia, lista] of porDia) {
    const titulo = dia === hoy ? 'Hoy' : dia === manana ? 'Mañana' : diaHumano(dia, hoy).replace(/^el /, '');
    // Por la mañana el título ya lo pone el mensaje («Verificaciones de hoy»)
    if (modo !== 'manana') {
      lineas.push(`${modo === 'noche' ? '📅 ' : ''}*${titulo.charAt(0).toUpperCase()}${titulo.slice(1)}* (${lista.length}):`);
    }
    for (const c of lista.slice(0, 20)) lineas.push(lineaGrupo(c, nombres));
    if (lista.length > 20) lineas.push(`• … y ${lista.length - 20} más`);
    lineas.push('');
  }
  return lineas.join('\n').trim();
}

/** Mensaje suelto para el grupo: la última llamada y todo lo pendiente. */
export async function textoPendientesGrupo(): Promise<string> {
  const f = ahoraMadrid();
  const [ultima, bloque, resumen] = await Promise.all([
    ultimaLlamadaGrupo(f.hoy),
    bloquePendientesGrupo('completo'),
    leerResumenVerificaciones(),
  ]);
  const lineas = [`📋 *Verificaciones pendientes* · ${fechaLarga(f.hoy)}`, ''];
  if (ultima) lineas.push(ultima, '');
  lineas.push(bloque, '', `✍️ ${firmadasMes(resumen.firmadas_mes)}`);
  return lineas.join('\n');
}

/** «⏳ Quedan hoy: 16:00 #00019 · 18:30 #00016» para los mensajes de resultado. */
async function quedanHoy(): Promise<string | null> {
  const hoy = ahoraMadrid().hoy;
  const pendientes = (await verificacionesDeDias(admin, hoy, hoy)).filter((c) => !c.verificacion_hecha_at);
  if (!pendientes.length) return '⏳ Hoy no quedan verificaciones pendientes 🙌';
  const lista = pendientes.slice(0, 8).map((c) => `${horaMadrid(c.verificacion_at)} ${numero(c.numero)}`);
  return `⏳ Quedan hoy: ${lista.join(' · ')}${pendientes.length > 8 ? ` · y ${pendientes.length - 8} más` : ''}`;
}

const RESULTADO: Record<NonNullable<Registro['resultado']>, { emoji: string; texto: string }> = {
  no_contesta: { emoji: '📵', texto: 'No contesta' },
  contactado: { emoji: '📞', texto: 'Contactado' },
  volver_a_llamar: { emoji: '🔁', texto: 'Volver a llamar' },
  firmado: { emoji: '✅', texto: '¡FIRMADO!' },
  rechaza: { emoji: '❌', texto: 'Rechaza' },
};

/**
 * Mensaje para el grupo con todo lo que se hizo en la misma acción (llamada,
 * hecha, reprogramada). Solo número de contrato y comercial.
 */
async function textoResultado(q: MensajeCola): Promise<string | null> {
  if (!q.contrato_id || !q.desde_log_id) return null;
  // Lo que venga después de este mensaje irá en el siguiente
  const { data: siguiente } = await admin
    .from('messy_cola_verificaciones')
    .select('desde_log_id')
    .eq('tipo', 'resultado')
    .eq('contrato_id', q.contrato_id)
    .gt('id', q.id)
    .order('id')
    .limit(1)
    .maybeSingle();
  let consulta = admin
    .from('verificaciones_log')
    .select('id, accion, resultado, de_at, a_at')
    .eq('contrato_id', q.contrato_id)
    .gte('id', q.desde_log_id)
    .order('id');
  if (siguiente?.desde_log_id) consulta = consulta.lt('id', siguiente.desde_log_id);
  const [registros, contrato] = await Promise.all([
    consulta,
    admin.from('contratos').select('numero, comercial_id, created_by').eq('id', q.contrato_id).maybeSingle(),
  ]);
  if (registros.error) throw registros.error;
  if (contrato.error) throw contrato.error;
  const c = contrato.data;
  const log = (registros.data ?? []) as Registro[];
  if (!c || !log.length) return null;

  const llamadas = log.filter((l) => l.accion === 'llamada' && l.resultado);
  const firmada = llamadas.find((l) => l.resultado === 'firmado');
  const llamada = firmada ?? llamadas.at(-1);
  const hecha = log.some((l) => l.accion === 'hecha');
  const reprogramada = [...log].reverse().find((l) => l.accion === 'reprogramada' && l.a_at);
  if (!llamada && !hecha && !reprogramada) return null;

  const hoy = ahoraMadrid().hoy;
  const [{ data: comercial }, resumen] = await Promise.all([
    admin.rpc('messy_nombre', { p_id: c.comercial_id ?? c.created_by }),
    leerResumenVerificaciones(),
  ]);

  const emoji = llamada ? RESULTADO[llamada.resultado!].emoji : hecha ? '🛡️' : '🗓️';
  const partes: string[] = [];
  if (llamada) {
    const r = RESULTADO[llamada.resultado!];
    partes.push(llamada.resultado === 'volver_a_llamar' && llamada.a_at ? `${r.texto} ${cuando(llamada.a_at, hoy)}` : r.texto);
  }
  if (hecha) partes.push(partes.length ? 'verificación hecha ✔️' : 'Hecha ✔️');
  if (reprogramada?.a_at) partes.push(`${partes.length ? 'reprogramada' : 'Reprogramada'} para ${cuando(reprogramada.a_at, hoy)}`);
  partes.push(`${firmadasMes(resumen.firmadas_mes)}${firmada ? ' 🔥' : ''}`);

  const cabecera = `${emoji} Verificación ${numero(c.numero)}${comercial ? ` (comercial ${comercial})` : ''}`;
  const quedan = await quedanHoy();
  return [[cabecera, ...partes].join(' · '), quedan].filter(Boolean).join('\n');
}

// -----------------------------------------------------------------------------
// Cola de mensajes de verificaciones
// -----------------------------------------------------------------------------
/** Chats privados de las personas configuradas (admin/backoffice activas con sesión iniciada). */
async function destinatarios(ids: string[]): Promise<string[]> {
  if (!ids.length) return [];
  const [perfiles, sesiones] = await Promise.all([
    admin.from('profiles').select('id, rol, activo').in('id', ids),
    admin.from('messy_sesiones').select('chat_id, user_id').eq('estado', 'activa').in('user_id', ids),
  ]);
  if (perfiles.error) throw perfiles.error;
  if (sesiones.error) throw sesiones.error;
  const validos = new Set(
    (perfiles.data ?? []).filter((p) => p.activo && (p.rol === 'admin' || p.rol === 'backoffice')).map((p) => p.id),
  );
  return (sesiones.data ?? []).filter((s) => validos.has(s.user_id)).map((s) => s.chat_id as string);
}

async function cerrar(id: number, cambios: Record<string, unknown>) {
  const { error } = await admin.from('messy_cola_verificaciones').update(cambios).eq('id', id);
  if (error) console.error('Messy: no se ha podido actualizar el mensaje de verificación', id, error.message);
}

/** A quién va cada mensaje: el grupo o los chats privados configurados. */
async function destinosDe(m: MensajeCola, cfg: ConfigMessy, privados: () => Promise<string[]>) {
  if (m.tipo === 'resultado') {
    return cfg.grupo_chat_id ? [cfg.grupo_chat_id] : { motivo: 'No hay grupo configurado' };
  }
  const chats = await privados();
  return chats.length ? chats : { motivo: 'Nadie con la sesión de Messy iniciada para recibirlo' };
}

export async function procesarVerificaciones(): Promise<{ procesados: number }> {
  const { data, error } = await admin.rpc('messy_reclamar_verificaciones');
  if (error) throw error;
  const lista = (data ?? []) as MensajeCola[];
  if (!lista.length) return { procesados: 0 };

  const cfg = await leerConfig();
  let cachePrivados: Promise<string[]> | null = null;
  const privados = () => (cachePrivados ??= destinatarios(cfg.verificaciones_para ?? []));

  for (const m of lista) {
    try {
      if (!cfg.activo) {
        await cerrar(m.id, { estado: 'descartado', error: 'Messy está en pausa' });
        continue;
      }
      const destinos = await destinosDe(m, cfg, privados);
      if (!Array.isArray(destinos)) {
        await cerrar(m.id, { estado: 'descartado', error: destinos.motivo });
        continue;
      }
      const texto =
        m.tipo === 'resultado'
          ? await textoResultado(m)
          : m.tipo === 'recordatorio'
            ? await textoRecordatorio(m)
            : m.tipo === 'resumen_manana'
              ? await textoResumenManana()
              : await textoResumenNoche();
      if (!texto) {
        await cerrar(m.id, { estado: 'descartado', error: 'Nada que avisar' });
        continue;
      }
      for (const chat of destinos) await enviarTexto(chat, texto);
      await cerrar(m.id, { estado: 'enviado', mensaje: texto, enviado_a: destinos.length, error: null });
    } catch (e) {
      const msg = mensajeDeError(e);
      console.error(`Messy: fallo en ${m.clave}`, msg);
      await cerrar(m.id, { estado: m.intentos >= 5 ? 'error' : 'pendiente', error: msg.slice(0, 500) });
    }
  }
  return { procesados: lista.length };
}
