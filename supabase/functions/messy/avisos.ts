// Avisos de Messy en el grupo de WhatsApp: ventas, buenos días y cierre del día.
// Los datos salen de funciones SQL internas y nunca incluyen datos personales
// de los clientes; Claude solo pone la chispa motivacional.
import { redactar } from './claude.ts';
import { admin, ahoraMadrid, env, fechaLarga, leerConfig, mensajeDeError } from './entorno.ts';
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
  'Usa solo los datos que te doy, sin inventar cifras ni nombres. Nunca señales a nadie por vender poco. ' +
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
  const lineas = [`🔥 *${d.vendedor} ha vendido 1*${oferta ? ` · ${oferta}` : ''}`];
  const marcador = [`lleva *${d.ventas_hoy_vendedor}* hoy`, `*${d.ventas_mes_vendedor}* este mes`];
  lineas.push(`📈 ${d.vendedor} ${marcador.join(' y ')}`);
  lineas.push(
    d.primera_venta_del_dia
      ? '🥇 ¡Primera venta del día! Arrancamos 🚀'
      : `🏢 Hoy llevamos *${plural(d.ventas_hoy_total, 'venta', 'ventas')}* entre todos`,
  );

  const chispa = await redactar(
    env.modelos.avisos,
    PERSONA,
    `Acaba de entrar una venta. Datos:\n${JSON.stringify(d)}\n\n` +
      'Escribe UNA sola frase corta (máx. 20 palabras, 1-2 emojis) para celebrarla y animar al resto. ' +
      'Puedes jugar con la racha, el liderato del día o la hora, pero no repitas el mensaje base que ya dice ' +
      `«${d.vendedor} ha vendido 1» y sus contadores. Varía el estilo cada vez.`,
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

async function textoBuenosDias(): Promise<string> {
  const f = ahoraMadrid();
  const { data: ultimoDia } = await admin.rpc('messy_ultimo_dia_con_ventas', { p_antes: f.hoy });
  const anterior = ultimoDia ? await resumen(ultimoDia as string) : null;
  const mes = (await resumen(f.hoy)).mes;

  const datos = {
    hoy: f.larga,
    ultimo_dia_con_ventas: anterior ? { ...anterior, fecha_larga: fechaLarga(anterior.fecha) } : null,
    acumulado_mes: mes,
  };
  const texto = await redactar(
    env.modelos.informes,
    PERSONA,
    `Son las ${f.hora} y toca dar los buenos días al equipo. Datos:\n${JSON.stringify(datos)}\n\n` +
      'Escribe el mensaje de buenos días (5-8 líneas): empieza con «☀️ *¡Buenos días, equipo!*», resume en 1-2 líneas ' +
      'cómo fue el último día con ventas (total y quién lideró, con sus ventas), cómo va el mes y termina con una ' +
      'frase motivadora original para arrancar la jornada. Si no hay datos, simplemente anima a estrenar el marcador.',
    { esfuerzo: 'medium', maxTokens: 6000 },
  );
  if (texto) return texto;

  const lineas = ['☀️ *¡Buenos días, equipo!*', ''];
  if (anterior && anterior.ventas > 0) {
    const cuando = anterior.fecha === f.ayer ? 'Ayer' : `El ${fechaLarga(anterior.fecha).replace(/ de \d{4}$/, '')}`;
    lineas.push(`${cuando} cerramos con *${plural(anterior.ventas, 'venta', 'ventas')}* 💪`);
    if (anterior.ranking.length) lineas.push(podio(anterior.ranking));
  }
  if (mes.ventas > 0) lineas.push('', `📊 Este mes llevamos *${plural(mes.ventas, 'venta', 'ventas')}*.`);
  lineas.push('', '¡A por un gran día! El primero que venda abre el marcador 🔥');
  return lineas.join('\n');
}

async function textoCierre(): Promise<string> {
  const f = ahoraMadrid();
  const r = await resumen(f.hoy);
  const texto = await redactar(
    env.modelos.informes,
    PERSONA,
    `Son las ${f.hora}: cierre del día (${f.larga}). Datos de hoy:\n${JSON.stringify(r)}\n\n` +
      'Escribe el cierre del día (6-10 líneas): empieza con «🌙 *Cierre del día*», da el total de ventas de hoy, ' +
      'el podio con medallas 🥇🥈🥉 (nombre y ventas) si hay ventas, compáralo con el mismo día de la semana pasada ' +
      'si suma, menciona cómo va el mes y despide la jornada agradeciendo el esfuerzo con una frase motivadora para mañana.',
    { esfuerzo: 'medium', maxTokens: 6000 },
  );
  if (texto) return texto;

  const lineas = ['🌙 *Cierre del día*', ''];
  if (r.ventas > 0) {
    lineas.push(`Hoy hemos hecho *${plural(r.ventas, 'venta', 'ventas')}* 🎉`);
    if (r.ranking.length) lineas.push('', podio(r.ranking));
  } else {
    lineas.push('Hoy el marcador se ha quedado a cero, ¡mañana lo reventamos! 💪');
  }
  lineas.push('', `📊 Mes: *${plural(r.mes.ventas, 'venta', 'ventas')}* · ${r.mes.activos} activas`, '', '¡Gracias por el esfuerzo, equipo! A descansar 💚');
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
