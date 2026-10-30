// Avisos de Messy en el grupo de WhatsApp: reservas de plaza, buenos días y cierre del día.
// (Internamente se siguen llamando «venta»; hacia fuera, siempre «reserva de plaza».)
// Los datos salen de funciones SQL internas y nunca incluyen datos personales
// de los clientes; Claude solo pone la chispa motivacional.
import { redactar } from './claude.ts';
import { admin, ahoraMadrid, env, fechaLarga, leerConfig, leerProgreso, mensajeDeError, type Progreso } from './entorno.ts';
import { bloquePendientesGrupo, leerResumenVerificaciones } from './verificaciones.ts';
import { enviarTexto } from './whapi.ts';

interface Evento {
  id: number;
  tipo: 'venta' | 'buenos_dias' | 'cierre';
  clave: string;
  contrato_id: string | null;
  intentos: number;
  created_at: string;
}

const PERSONA =
  'Eres Messy, el asistente de IA de MESENERGIA (+Energía), un call center que vende fibra y WiFi. ' +
  'Escribes en el grupo de WhatsApp del equipo comercial: tono cercano, positivo, con energía y algo de humor sano, ' +
  'como un compañero que motiva (nunca un jefe que presiona). Español de España. Formato de WhatsApp: *negrita* ' +
  'con un asterisco, _cursiva_; nada de títulos con #, tablas ni **dobles asteriscos**. ' +
  'En el equipo cada contrato subido al CRM se llama «reserva de plaza»: di siempre «reservas de plaza» ' +
  '(o «reservas»), nunca «ventas». ' +
  'Usa solo los datos que te doy, sin inventar cifras ni nombres. Nunca señales a nadie por conseguir pocas. ' +
  'Devuelve únicamente el texto del mensaje, sin comillas ni explicaciones.';

const FRASES_VENTA = [
  '¡Así se hace! 💪 ¿Quién es el siguiente?',
  '¡Vamos, vamos! El marcador no para 🚀',
  '¡Eso es actitud! A por la siguiente 🔥',
  '¡Qué crack! Que se note el ritmo, equipo ⚡',
  '¡Otra más al saco! Seguimos sumando 💚',
  '¡Imparable! ¿Quién se apunta a la racha? 🙌',
];

function azar<T>(lista: T[]): T {
  return lista[Math.floor(Math.random() * lista.length)];
}

function plural(n: number, uno: string, varios: string) {
  return `${n} ${n === 1 ? uno : varios}`;
}

const reservas = (n: number) => plural(n, 'reserva de plaza', 'reservas de plaza');

/** 🎯 Objetivo del mes: 11/50 · quedan 39 (78 %) */
export function lineaObjetivo(p: Progreso): string {
  if (p.quedan === 0) return `🏆 *¡Objetivo del mes conseguido!* Llevamos *${p.llevamos}/${p.objetivo}* 🎉`;
  return `🎯 Objetivo del mes: *${p.llevamos}/${p.objetivo}* · quedan *${p.quedan}* (${p.pct_quedan} %)`;
}

const INSTRUCCION_OBJETIVO =
  'Incluye una línea con el objetivo del mes del equipo (todas las reservas en conjunto): cuántas llevamos de ' +
  'cuántas, cuántas quedan y el porcentaje que queda, con los datos de «objetivo_mes». ';

/** Los datos van a Claude con el vocabulario del equipo (reservas, no ventas). */
function paraClaude(valor: unknown): string {
  const renombrar = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(renombrar);
    if (v && typeof v === 'object') {
      return Object.fromEntries(
        Object.entries(v).map(([k, x]) => [
          k.replace('facturacion_mensual_vendida', 'cuota_mensual_reservada').replace(/ventas?/g, 'reservas').replace('vendedor', 'comercial'),
          renombrar(x),
        ]),
      );
    }
    return v;
  };
  return JSON.stringify(renombrar(valor));
}

// -----------------------------------------------------------------------------
// Venta
// -----------------------------------------------------------------------------
interface DatosVenta {
  numero: number;
  vendedor: string;
  equipo: string | null;
  producto: string | null;
  operadora: string | null;
  precio_mensual: number | null;
  hora: string;
  ventas_hoy_vendedor: number;
  ventas_mes_vendedor: number;
  ventas_hoy_equipo: number;
  ventas_hoy_total: number;
  primera_venta_del_dia: boolean;
  lider_hoy: string | null;
  top_hoy: { nombre: string; ventas: number }[];
}

async function textoVenta(contratoId: string | null): Promise<string | null> {
  if (!contratoId) return null;
  const { data, error } = await admin.rpc('messy_datos_venta', { p_contrato_id: contratoId });
  if (error) throw error;
  if (!data) return null; // el contrato ya no existe
  const d = data as DatosVenta;

  const oferta = [d.producto, d.operadora].filter(Boolean).join(' · ');
  const lineas = [`🔥 *${d.vendedor} ha conseguido 1 reserva de plaza*${oferta ? ` · ${oferta}` : ''}`];
  const marcador = [`lleva *${d.ventas_hoy_vendedor}* hoy`, `*${d.ventas_mes_vendedor}* este mes`];
  lineas.push(`📈 ${d.vendedor} ${marcador.join(' y ')}`);
  lineas.push(
    d.primera_venta_del_dia
      ? '🥇 ¡Primera reserva de plaza del día! Arrancamos 🚀'
      : `🏢 Hoy llevamos *${reservas(d.ventas_hoy_total)}* entre todos`,
  );
  const objetivo = await leerProgreso();
  lineas.push(lineaObjetivo(objetivo));

  const chispa = await redactar(
    env.modelos.avisos,
    PERSONA,
    `Acaba de entrar una reserva de plaza. Datos:\n${paraClaude({ ...d, objetivo_mes: objetivo })}\n\n` +
      'Escribe UNA sola frase corta (máx. 20 palabras, 1-2 emojis) para celebrarla y animar al resto. ' +
      'Puedes jugar con la racha, el liderato del día o la hora, pero no repitas el mensaje base que ya dice ' +
      `«${d.vendedor} ha conseguido 1 reserva de plaza» y sus contadores. Varía el estilo cada vez.`,
    { maxTokens: 1500, esfuerzo: 'low' },
  );
  lineas.push('', chispa ?? azar(FRASES_VENTA));
  return lineas.join('\n');
}

// -----------------------------------------------------------------------------
// Buenos días y cierre
// -----------------------------------------------------------------------------
interface ResumenDia {
  fecha: string;
  ventas: number;
  facturacion_mensual_vendida: number;
  por_estado: Record<string, number>;
  ranking: { nombre: string; equipo: string | null; ventas: number }[];
  por_equipo: { equipo: string; ventas: number }[];
  mismo_dia_semana_pasada: number;
  mes: { ventas: number; activos: number; mejor_dia_ventas: number; top3: { nombre: string; ventas: number }[] };
  comerciales_activos: number;
}

async function resumen(fecha: string): Promise<ResumenDia> {
  const { data, error } = await admin.rpc('messy_resumen_dia', { p_fecha: fecha });
  if (error) throw error;
  return data as ResumenDia;
}

const MEDALLAS = ['🥇', '🥈', '🥉'];

function podio(ranking: { nombre: string; ventas: number }[]): string {
  return ranking
    .slice(0, 3)
    .map((r, i) => `${MEDALLAS[i]} ${r.nombre}: ${r.ventas}`)
    .join('\n');
}

/** Verificaciones pendientes para el grupo (sin nombres de clientes); null si falla. */
async function pendientesGrupo(modo: 'manana' | 'noche'): Promise<string | null> {
  try {
    return await bloquePendientesGrupo(modo);
  } catch (e) {
    console.error('Messy: no se ha podido preparar el listado de verificaciones', mensajeDeError(e));
    return null;
  }
}

async function textoBuenosDias(): Promise<string> {
  const texto = await textoBuenosDiasBase();
  const pendientes = await pendientesGrupo('manana');
  return pendientes ? `${texto}\n\n📋 *Verificaciones de hoy*\n${pendientes}` : texto;
}

async function textoBuenosDiasBase(): Promise<string> {
  const f = ahoraMadrid();
  const { data: ultimoDia } = await admin.rpc('messy_ultimo_dia_con_ventas', { p_antes: f.hoy });
  const anterior = ultimoDia ? await resumen(ultimoDia as string) : null;
  const mes = (await resumen(f.hoy)).mes;
  const objetivo = await leerProgreso();

  const datos = {
    hoy: f.larga,
    ultimo_dia_con_ventas: anterior ? { ...anterior, fecha_larga: fechaLarga(anterior.fecha) } : null,
    acumulado_mes: { ...mes, ventas: objetivo.llevamos },
    objetivo_mes: objetivo,
  };
  const texto = await redactar(
    env.modelos.informes,
    PERSONA,
    `Son las ${f.hora} y toca dar los buenos días al equipo. Datos:\n${paraClaude(datos)}\n\n` +
      'Escribe el mensaje de buenos días (5-8 líneas): empieza con «☀️ *¡Buenos días, equipo!*», resume en 1-2 líneas ' +
      'cómo fue el último día con reservas de plaza (total y quién lideró, con sus reservas), cómo va el mes y termina con una ' +
      'frase motivadora original para arrancar la jornada. Si no hay datos, simplemente anima a estrenar el marcador. ' +
      INSTRUCCION_OBJETIVO,
    { esfuerzo: 'medium', maxTokens: 6000 },
  );
  if (texto) return texto;

  const lineas = ['☀️ *¡Buenos días, equipo!*', ''];
  if (anterior && anterior.ventas > 0) {
    const cuando = anterior.fecha === f.ayer ? 'Ayer' : `El ${fechaLarga(anterior.fecha).replace(/ de \d{4}$/, '')}`;
    lineas.push(`${cuando} cerramos con *${reservas(anterior.ventas)}* 💪`);
    if (anterior.ranking.length) lineas.push(podio(anterior.ranking));
  }
  lineas.push('', lineaObjetivo(objetivo));
  lineas.push('', '¡A por un gran día! La primera reserva de plaza abre el marcador 🔥');
  return lineas.join('\n').replace(/\n{3,}/g, '\n\n');
}

/** Línea de verificaciones de backoffice para el cierre del grupo (sin datos de clientes). */
async function lineaVerificaciones(): Promise<string | null> {
  try {
    const v = await leerResumenVerificaciones();
    return (
      `🛡️ Verificaciones de hoy: *${v.hechas}* ${v.hechas === 1 ? 'hecha' : 'hechas'} · *${v.no_contesta}* no contesta · ` +
      `*${v.firmadas_hoy}* ${v.firmadas_hoy === 1 ? 'firmada' : 'firmadas'} · vamos *${v.firmadas_mes}* ` +
      `${v.firmadas_mes === 1 ? 'firmada' : 'firmadas'} este mes`
    );
  } catch (e) {
    console.error('Messy: no se han podido leer las verificaciones del día', mensajeDeError(e));
    return null;
  }
}

async function textoCierre(): Promise<string> {
  const [texto, verificaciones, manana] = await Promise.all([textoCierreBase(), lineaVerificaciones(), pendientesGrupo('noche')]);
  const bloque = [verificaciones, manana].filter(Boolean).join('\n');
  return bloque ? `${texto}\n\n${bloque}` : texto;
}

async function textoCierreBase(): Promise<string> {
  const f = ahoraMadrid();
  const r = await resumen(f.hoy);
  const objetivo = await leerProgreso();
  const texto = await redactar(
    env.modelos.informes,
    PERSONA,
    `Son las ${f.hora}: cierre del día (${f.larga}). Datos de hoy:\n${paraClaude({ ...r, mes: { ...r.mes, ventas: objetivo.llevamos }, objetivo_mes: objetivo })}\n\n` +
      'Escribe el cierre del día (6-10 líneas): empieza con «🌙 *Cierre del día*», da el total de reservas de plaza de hoy, ' +
      'el podio con medallas 🥇🥈🥉 (nombre y reservas) si hay reservas, compáralo con el mismo día de la semana pasada ' +
      'si suma, menciona cómo va el mes y despide la jornada agradeciendo el esfuerzo con una frase motivadora para mañana. ' +
      INSTRUCCION_OBJETIVO,
    { esfuerzo: 'medium', maxTokens: 6000 },
  );
  if (texto) return texto;

  const lineas = ['🌙 *Cierre del día*', ''];
  if (r.ventas > 0) {
    lineas.push(`Hoy hemos conseguido *${reservas(r.ventas)}* 🎉`);
    if (r.ranking.length) lineas.push('', podio(r.ranking));
  } else {
    lineas.push('Hoy el marcador se ha quedado a cero, ¡mañana lo reventamos! 💪');
  }
  lineas.push('', lineaObjetivo(objetivo), '', '¡Gracias por el esfuerzo, equipo! A descansar 💚');
  return lineas.join('\n');
}

/** Mensaje suelto con cómo va el objetivo del mes (lo puede pedir un admin). */
export async function textoProgreso(): Promise<string> {
  const p = await leerProgreso();
  const lineas = ['📊 *Así vamos este mes, equipo*', '', lineaObjetivo(p)];
  if (p.quedan > 0 && p.dias_restantes > 0) {
    const porDia = Math.ceil(p.quedan / p.dias_restantes);
    lineas.push(`📅 Quedan ${plural(p.dias_restantes, 'día', 'días')}: a ${plural(porDia, 'reserva', 'reservas')} por día lo tenemos`);
  }
  const chispa = await redactar(
    env.modelos.avisos,
    PERSONA,
    `Datos del objetivo del mes del equipo:\n${paraClaude(p)}\n\n` +
      'Escribe UNA sola frase corta (máx. 20 palabras, 1-2 emojis) para animar al equipo a llegar al objetivo. ' +
      'No repitas las cifras, ya van en el mensaje.',
    { maxTokens: 1500, esfuerzo: 'low' },
  );
  lineas.push('', chispa ?? '¡Vamos a por ello, que este mes lo petamos! 💪');
  return lineas.join('\n');
}

// -----------------------------------------------------------------------------
// Procesar la cola
// -----------------------------------------------------------------------------
async function cerrarEvento(id: number, cambios: Record<string, unknown>) {
  const { error } = await admin.from('messy_eventos').update(cambios).eq('id', id);
  if (error) console.error('Messy: no se ha podido actualizar el evento', id, error.message);
}

export async function procesarEventos(): Promise<{ procesados: number }> {
  const { data, error } = await admin.rpc('messy_reclamar_eventos');
  if (error) throw error;
  const eventos = (data ?? []) as Evento[];
  if (!eventos.length) return { procesados: 0 };

  const cfg = await leerConfig();
  for (const ev of eventos) {
    try {
      if (!cfg.activo || !cfg.grupo_chat_id) {
        await cerrarEvento(ev.id, { estado: 'descartado', error: 'Messy está en pausa o no tiene grupo configurado' });
        continue;
      }
      const texto =
        ev.tipo === 'venta' ? await textoVenta(ev.contrato_id) : ev.tipo === 'buenos_dias' ? await textoBuenosDias() : await textoCierre();
      if (!texto) {
        await cerrarEvento(ev.id, { estado: 'descartado', error: 'El contrato ya no existe' });
        continue;
      }
      await enviarTexto(cfg.grupo_chat_id, texto);
      await cerrarEvento(ev.id, { estado: 'enviado', mensaje: texto, error: null });
    } catch (e) {
      const msg = mensajeDeError(e);
      console.error(`Messy: fallo en el evento ${ev.clave}`, msg);
      await cerrarEvento(ev.id, { estado: ev.intentos >= 5 ? 'error' : 'pendiente', error: msg.slice(0, 500) });
    }
  }

  // Limpieza ocasional de ids de mensajes ya procesados (más de 7 días)
  if (Math.random() < 0.1) {
    await admin.from('messy_recibidos').delete().lt('created_at', new Date(Date.now() - 7 * 86_400_000).toISOString());
  }
  return { procesados: eventos.length };
}
