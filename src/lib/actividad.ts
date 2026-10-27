// Datos del equipo: registros de actividad (llamadas, correos, facturas, citas, ventas…).
// Lógica pura para poder probarla sin React ni Supabase.

export type TipoActividad =
  | 'llamadas'
  | 'seguimiento'
  | 'no_atiende'
  | 'correo_enviado'
  | 'factura_recibida'
  | 'cita'
  | 'venta_cargada'
  | 'venta'
  | 'venta_anulada'
  | 'verificacion_firmada'
  | 'verificacion_rechazada'
  | 'verificacion_no_contesta'
  | 'nota';

export interface Actividad {
  id: string;
  ocurrio_at: string;
  persona_id: string | null;
  autor: string;
  tipo: TipoActividad;
  empresa: string;
  contacto: string;
  detalle: string;
  cantidad: number;
  fuente: string;
  created_at: string;
}

export interface ConfigTipo {
  etiqueta: string;
  clase: string;
  /** cuenta como llamada en el total de llamadas */
  esLlamada: boolean;
}

export const TIPOS_ACTIVIDAD: Record<TipoActividad, ConfigTipo> = {
  llamadas: { etiqueta: 'Llamadas', clase: 'bg-navy-50 text-navy-700 ring-navy-200', esLlamada: true },
  seguimiento: { etiqueta: 'Seguimiento', clase: 'bg-navy-50 text-navy-700 ring-navy-200', esLlamada: true },
  no_atiende: { etiqueta: 'No atiende', clase: 'bg-sun-50 text-sun-700 ring-sun-200', esLlamada: true },
  correo_enviado: { etiqueta: 'Correo enviado', clase: 'bg-brand-50 text-brand-700 ring-brand-200', esLlamada: false },
  factura_recibida: { etiqueta: 'Factura recibida', clase: 'bg-sky-50 text-sky-700 ring-sky-200', esLlamada: false },
  cita: { etiqueta: 'Cita / visita', clase: 'bg-amber-50 text-amber-800 ring-amber-200', esLlamada: false },
  venta_cargada: { etiqueta: 'Venta cargada', clase: 'bg-violet-50 text-violet-700 ring-violet-200', esLlamada: false },
  venta: { etiqueta: 'Venta cerrada', clase: 'bg-emerald-50 text-emerald-700 ring-emerald-200', esLlamada: false },
  venta_anulada: { etiqueta: 'Venta anulada', clase: 'bg-red-50 text-red-700 ring-red-200', esLlamada: false },
  verificacion_firmada: { etiqueta: 'Verificación firmada', clase: 'bg-emerald-50 text-emerald-700 ring-emerald-200', esLlamada: true },
  verificacion_rechazada: { etiqueta: 'Verificación rechazada', clase: 'bg-red-50 text-red-700 ring-red-200', esLlamada: true },
  verificacion_no_contesta: { etiqueta: 'Verificación: no contesta', clase: 'bg-sun-50 text-sun-700 ring-sun-200', esLlamada: true },
  nota: { etiqueta: 'Nota', clase: 'bg-slate-100 text-slate-700 ring-slate-200', esLlamada: false },
};

export const LISTA_TIPOS: TipoActividad[] = Object.keys(TIPOS_ACTIVIDAD) as TipoActividad[];

/** Tipos que se pueden añadir a mano desde el formulario (los demás vienen de Messy o del chat). */
export const TIPOS_MANUALES: TipoActividad[] = [
  'llamadas',
  'seguimiento',
  'no_atiende',
  'correo_enviado',
  'factura_recibida',
  'cita',
  'venta_cargada',
  'venta',
  'venta_anulada',
  'nota',
];

export interface ResumenActividad {
  llamadas: number;
  correos: number;
  facturas: number;
  citas: number;
  ventas: number;
  anuladas: number;
  verificaciones: number;
  /** facturas recibidas sobre correos enviados, en % (null si no hay correos) */
  pctFacturas: number | null;
  registros: number;
}

export function resumenVacio(): ResumenActividad {
  return { llamadas: 0, correos: 0, facturas: 0, citas: 0, ventas: 0, anuladas: 0, verificaciones: 0, pctFacturas: null, registros: 0 };
}

function sumar(r: ResumenActividad, a: Pick<Actividad, 'tipo' | 'cantidad'>) {
  r.registros++;
  if (TIPOS_ACTIVIDAD[a.tipo].esLlamada) r.llamadas += a.cantidad;
  if (a.tipo === 'correo_enviado') r.correos += a.cantidad;
  if (a.tipo === 'factura_recibida') r.facturas += a.cantidad;
  if (a.tipo === 'cita') r.citas += a.cantidad;
  if (a.tipo === 'venta' || a.tipo === 'venta_cargada') r.ventas += a.cantidad;
  if (a.tipo === 'venta_anulada') r.anuladas += a.cantidad;
  if (a.tipo.startsWith('verificacion_')) r.verificaciones += a.cantidad;
}

function cerrar(r: ResumenActividad): ResumenActividad {
  r.pctFacturas = r.correos ? Math.round((r.facturas / r.correos) * 100) : null;
  return r;
}

export function resumirActividad(registros: Pick<Actividad, 'tipo' | 'cantidad'>[]): ResumenActividad {
  const r = resumenVacio();
  registros.forEach((a) => sumar(r, a));
  return cerrar(r);
}

/** Día local (YYYY-MM-DD) de un instante. */
export function diaLocal(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function agruparPor<T extends Pick<Actividad, 'tipo' | 'cantidad'>>(
  registros: T[],
  clave: (a: T) => string,
): { clave: string; resumen: ResumenActividad }[] {
  const mapa = new Map<string, ResumenActividad>();
  for (const a of registros) {
    const k = clave(a);
    const r = mapa.get(k) ?? resumenVacio();
    mapa.set(k, r);
    sumar(r, a);
  }
  return [...mapa.entries()].map(([k, r]) => ({ clave: k, resumen: cerrar(r) }));
}

export const porDia = (registros: Actividad[]) =>
  agruparPor(registros, (a) => diaLocal(a.ocurrio_at)).sort((x, y) => y.clave.localeCompare(x.clave));

export const porPersona = (registros: Actividad[]) =>
  agruparPor(registros, (a) => a.autor || 'Equipo').sort((x, y) => y.resumen.registros - x.resumen.registros);

export function filtrarActividad(
  registros: Actividad[],
  f: { desde: number; hasta: number; persona: string; tipo: '' | TipoActividad; q: string },
): Actividad[] {
  const q = f.q.trim().toLowerCase();
  return registros.filter((a) => {
    const t = new Date(a.ocurrio_at).getTime();
    if (t < f.desde || t > f.hasta) return false;
    if (f.persona && (a.persona_id ?? a.autor) !== f.persona) return false;
    if (f.tipo && a.tipo !== f.tipo) return false;
    if (q && !`${a.empresa} ${a.contacto} ${a.detalle} ${a.autor}`.toLowerCase().includes(q)) return false;
    return true;
  });
}
