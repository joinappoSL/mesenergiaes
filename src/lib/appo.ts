// Appo (IA para pymes): leads, auditorías gratis, packs y calculadora de pérdidas.
// Lógica pura (sin React ni Supabase) para poder probarla.
import { limpiarTelefono, norm } from './leads';

export const APPO_AZUL = '#0E4D9D';
export const APPO_TURQUESA = '#26B9CC';

export type EstadoAppo = 'pendiente' | 'no_contesta' | 'volver_a_llamar' | 'interesado' | 'auditoria' | 'informe' | 'cerrado' | 'descartado';

export const ESTADOS_APPO: Record<EstadoAppo, { etiqueta: string; clase: string; orden: number }> = {
  pendiente: { etiqueta: 'Pendiente', clase: 'bg-slate-100 text-slate-700 ring-slate-200', orden: 0 },
  no_contesta: { etiqueta: 'No contesta', clase: 'bg-amber-50 text-amber-700 ring-amber-200', orden: 1 },
  volver_a_llamar: { etiqueta: 'Volver a llamar', clase: 'bg-orange-50 text-orange-700 ring-orange-200', orden: 2 },
  interesado: { etiqueta: 'Interesado', clase: 'bg-cyan-50 text-cyan-700 ring-cyan-200', orden: 3 },
  auditoria: { etiqueta: 'Auditoría agendada', clase: 'bg-blue-50 text-blue-700 ring-blue-200', orden: 4 },
  informe: { etiqueta: 'Informe y demo enviados', clase: 'bg-indigo-50 text-indigo-700 ring-indigo-200', orden: 5 },
  cerrado: { etiqueta: 'Cerrado', clase: 'bg-emerald-50 text-emerald-700 ring-emerald-200', orden: 6 },
  descartado: { etiqueta: 'Descartado', clase: 'bg-red-50 text-red-700 ring-red-200', orden: 7 },
};

export const LISTA_ESTADOS_APPO = (Object.keys(ESTADOS_APPO) as EstadoAppo[]).sort((a, b) => ESTADOS_APPO[a].orden - ESTADOS_APPO[b].orden);

export type TamanoAppo = '' | 'autonomo' | 'micro' | 'pequena' | 'mediana';

export const TAMANOS: Record<Exclude<TamanoAppo, ''>, { etiqueta: string; personas: string }> = {
  autonomo: { etiqueta: 'Autónomo', personas: '0–2 personas' },
  micro: { etiqueta: 'Micro', personas: '3–9 personas' },
  pequena: { etiqueta: 'Pequeña', personas: '10–49 personas' },
  mediana: { etiqueta: 'Mediana', personas: '50–249 personas' },
};

export type PackAppo = '' | 'arranque' | 'crecimiento' | 'empresa' | 'modulo';

/** Precios de la web (joinappo.com), sin IVA. Los de los packs son los de tamaño «Autónomo». */
export const PACKS: Record<Exclude<PackAppo, ''>, { nombre: string; mes: number | null; alta: number | null; incluye: string[]; para: string }> = {
  arranque: {
    nombre: 'Pack Arranque',
    mes: 209,
    alta: 890,
    para: 'Para no perder ni un cliente que escribe o pide cita.',
    incluye: ['Asistente de WhatsApp IA 24/7', 'Citas y recordatorios automáticos', 'Mensajes de WhatsApp incluidos', 'Implantación y mantenimiento'],
  },
  crecimiento: {
    nombre: 'Pack Crecimiento',
    mes: 419,
    alta: 2690,
    para: 'Atiende, agenda, factura y haz seguimiento de cada venta.',
    incluye: ['Todo lo del Pack Arranque', 'Facturación y cobros (Verifactu)', 'CRM a medida de tu negocio', 'Reclamación automática de impagos'],
  },
  empresa: {
    nombre: 'Empresa Automatizada',
    mes: 889,
    alta: 5690,
    para: 'Los 8 módulos, con un agente de IA hecho para ti.',
    incluye: ['Todo lo del Pack Crecimiento', 'Recepcionista de voz IA', 'RRHH, fichaje y panel de dirección', 'Agente de IA a medida'],
  },
  modulo: { nombre: 'Módulo suelto', mes: 59, alta: null, para: 'Desde 59 €/mes. Se recomienda en la auditoría.', incluye: [] },
};

export const MODULOS_APPO: { nombre: string; desde: number; tipo: 'Gana más' | 'Pierde menos' | 'Cumple'; texto: string }[] = [
  { nombre: 'Asistente de WhatsApp IA 24/7', desde: 99, tipo: 'Gana más', texto: 'Contesta al momento, a cualquier hora: dudas, precios y disponibilidad. Recoge los datos y da cita.' },
  { nombre: 'Recepcionista de voz IA', desde: 139, tipo: 'Gana más', texto: 'Coge el teléfono cuando nadie puede, da cita y manda un resumen de cada llamada por WhatsApp.' },
  { nombre: 'Citas y recordatorios', desde: 59, tipo: 'Pierde menos', texto: 'Reserva online, recordatorio 24 h y 2 h antes, y aviso a la lista de espera si alguien cancela.' },
  { nombre: 'Facturación y cobros', desde: 79, tipo: 'Cumple', texto: 'Factura adaptada a Verifactu, reclama impagos por WhatsApp y email y concilia cobros.' },
  { nombre: 'CRM a medida', desde: 99, tipo: 'Gana más', texto: 'Clientes, oportunidades, presupuestos y tareas en un solo sitio, con seguimientos automáticos.' },
  { nombre: 'RRHH y fichaje digital', desde: 59, tipo: 'Cumple', texto: 'Fichaje desde el móvil, vacaciones, documentos firmados y envío de datos a la gestoría.' },
  { nombre: 'Panel de dirección', desde: 59, tipo: 'Pierde menos', texto: 'Ventas, cobros pendientes, citas y ausencias en una pantalla, con informe semanal automático.' },
  { nombre: 'Agente de IA a medida', desde: 169, tipo: 'Gana más', texto: 'Automatiza un proceso concreto: leer pedidos y emails, preparar presupuestos, clasificar documentos…' },
];

export const SECTORES_APPO = [
  'Clínicas y fisioterapia',
  'Dentistas',
  'Peluquerías y estética',
  'Talleres',
  'Inmobiliarias',
  'Academias',
  'Gimnasios',
  'Reformas e instaladores',
  'Despachos y asesorías',
  'Energía y telecomunicaciones',
  'Otro',
];

export interface AppoLead {
  id: string;
  propietario_id: string;
  empresa: string;
  sector: string;
  contacto: string;
  telefono: string;
  email: string;
  web: string;
  ciudad: string;
  tamano: TamanoAppo;
  estado: EstadoAppo;
  modulo: string;
  auditoria_at: string | null;
  auditoria_modo: 'online' | 'presencial';
  proxima_llamada: string | null;
  perdidas_mes: number | null;
  pack: PackAppo;
  cuota_mes: number | null;
  alta: number | null;
  cerrado_at: string | null;
  nota: string;
  created_at: string;
  updated_at: string;
}

/** Semanas por mes (52 / 12), como la calculadora de la web. */
const SEMANAS_MES = 52 / 12;

/**
 * Calculadora «¿Cuánto estoy perdiendo?» de la web: contactos que no se atienden a
 * la semana × lo que deja un cliente × % que acabaría comprando.
 */
export function calcularPerdidas(contactosSemana: number, ticket: number, conversionPct: number): { mes: number; anio: number } {
  const c = Math.max(0, contactosSemana || 0);
  const t = Math.max(0, ticket || 0);
  const p = Math.min(100, Math.max(0, conversionPct || 0)) / 100;
  const mes = Math.round(c * t * p * SEMANAS_MES);
  return { mes, anio: mes * 12 };
}

/** Pack que se recomienda según lo que dice el cliente en la auditoría. */
export function packRecomendado(r: { whatsapp: boolean; llamadas: boolean; facturas: boolean; personal: boolean }): Exclude<PackAppo, '' | 'modulo'> {
  if (r.llamadas && (r.personal || r.facturas)) return 'empresa';
  if (r.facturas || r.personal) return 'crecimiento';
  return 'arranque';
}

export interface ResumenAppo {
  total: number;
  porLlamar: number;
  interesados: number;
  auditorias: number;
  auditoriasProximas: number;
  cerrados: number;
  /** cuotas mensuales de los cerrados */
  mrr: number;
  /** altas cobradas de los cerrados */
  altas: number;
}

export function resumirAppo(leads: AppoLead[], ahora = new Date()): ResumenAppo {
  const r: ResumenAppo = { total: leads.length, porLlamar: 0, interesados: 0, auditorias: 0, auditoriasProximas: 0, cerrados: 0, mrr: 0, altas: 0 };
  for (const l of leads) {
    if (l.estado === 'pendiente' || l.estado === 'no_contesta' || l.estado === 'volver_a_llamar') r.porLlamar++;
    if (l.estado === 'interesado') r.interesados++;
    if (l.estado === 'auditoria' || l.estado === 'informe') r.auditorias++;
    if (l.estado === 'auditoria' && l.auditoria_at && new Date(l.auditoria_at) >= ahora) r.auditoriasProximas++;
    if (l.estado === 'cerrado') {
      r.cerrados++;
      r.mrr += Number(l.cuota_mes) || 0;
      r.altas += Number(l.alta) || 0;
    }
  }
  return r;
}

export type NuevoAppoLead = Pick<AppoLead, 'empresa' | 'sector' | 'contacto' | 'telefono' | 'email' | 'web' | 'ciudad' | 'modulo' | 'nota'>;

const ALIAS: Record<keyof Omit<NuevoAppoLead, 'modulo'>, string[]> = {
  empresa: ['empresa', 'nombre', 'negocio', 'razon social', 'nombre comercial', 'name', 'titular', 'cliente'],
  sector: ['sector', 'actividad', 'categoria', 'tipo', 'category', 'cnae'],
  contacto: ['contacto', 'persona de contacto', 'responsable', 'gerente', 'contact'],
  telefono: ['telefono', 'tel', 'movil', 'phone', 'telefono 1', 'telefono1', 'whatsapp'],
  email: ['email', 'correo', 'e mail', 'mail', 'correo electronico'],
  web: ['web', 'website', 'pagina web', 'url', 'sitio web'],
  ciudad: ['ciudad', 'localidad', 'municipio', 'poblacion', 'city', 'direccion', 'address'],
  nota: ['nota', 'notas', 'observaciones', 'comentarios'],
};

/** Qué columna del Excel corresponde a cada campo (por el nombre de la cabecera). */
export function detectarColumnasAppo(cabecera: unknown[]): Partial<Record<keyof typeof ALIAS, number>> {
  const res: Partial<Record<keyof typeof ALIAS, number>> = {};
  const cab = cabecera.map((c) => norm(c));
  for (const campo of Object.keys(ALIAS) as (keyof typeof ALIAS)[]) {
    const exacta = cab.findIndex((c) => ALIAS[campo].includes(c));
    const parcial = exacta >= 0 ? exacta : cab.findIndex((c) => c && ALIAS[campo].some((a) => a.length > 3 && c.startsWith(a)));
    if (parcial >= 0 && !Object.values(res).includes(parcial)) res[campo] = parcial;
  }
  return res;
}

/**
 * Filas del Excel a leads de Appo. Se descartan las que no tienen empresa o no
 * tienen ni teléfono ni email (no se pueden contactar) y los teléfonos repetidos.
 */
export function filasAAppoLeads(filas: unknown[][], modulo: string, existentes: Set<string> = new Set()): { leads: NuevoAppoLead[]; descartadas: number; repetidas: number } {
  if (!filas.length) return { leads: [], descartadas: 0, repetidas: 0 };
  const col = detectarColumnasAppo(filas[0]);
  const g = (f: unknown[], k: keyof typeof ALIAS) => (col[k] === undefined ? '' : String(f[col[k]!] ?? '').trim());
  const vistos = new Set(existentes);
  const leads: NuevoAppoLead[] = [];
  let descartadas = 0;
  let repetidas = 0;
  for (const f of filas.slice(1)) {
    if (!f || f.every((c) => c === null || c === undefined || String(c).trim() === '')) continue;
    const empresa = g(f, 'empresa');
    const telefono = limpiarTelefono(g(f, 'telefono'));
    const email = g(f, 'email').replace(/\s/g, '').toLowerCase();
    if (!empresa || (!telefono && !email.includes('@'))) {
      descartadas++;
      continue;
    }
    const clave = telefono || email;
    if (vistos.has(clave)) {
      repetidas++;
      continue;
    }
    vistos.add(clave);
    leads.push({ empresa, sector: g(f, 'sector'), contacto: g(f, 'contacto'), telefono, email: email.includes('@') ? email : '', web: g(f, 'web'), ciudad: g(f, 'ciudad'), modulo, nota: g(f, 'nota') });
  }
  return { leads, descartadas, repetidas };
}

/** Mensaje de WhatsApp para proponer la auditoría gratis. */
export function whatsappAuditoria(l: Pick<AppoLead, 'empresa' | 'contacto'>, comercial: string): string {
  const saludo = l.contacto ? `Hola ${l.contacto.split(' ')[0]}` : 'Hola';
  return (
    `${saludo}, soy ${comercial} de Appo 👋\n\n` +
    `Ayudamos a negocios como ${l.empresa} a no perder clientes por WhatsApp o llamadas sin contestar, con asistentes de IA que responden, dan cita y recuerdan las citas solos.\n\n` +
    `Te propongo una auditoría gratis de 30 minutos: en 24 h te mando cuánto estás perdiendo al mes y una demo funcionando en tu móvil. ¿Qué día te va bien?`
  );
}
