import { addDays, differenceInCalendarDays, format, startOfDay, startOfWeek } from 'date-fns';
import { es } from 'date-fns/locale';
import type { Contrato } from './types';

/** Minutos de margen: hasta 15 min después de la hora sigue siendo «ahora». */
export const MARGEN_AHORA_MIN = 15;
/** Aviso previo antes de cada verificación. */
export const AVISO_PREVIO_MIN = 5;

export type EstadoVerificacion = 'hecha' | 'ahora' | 'retrasada' | 'proxima';

export function estadoVerificacion(
  c: Pick<Contrato, 'verificacion_at' | 'verificacion_hecha_at'>,
  ahora: Date,
): EstadoVerificacion {
  if (c.verificacion_hecha_at) return 'hecha';
  const minutos = (ahora.getTime() - new Date(c.verificacion_at!).getTime()) / 60_000;
  if (minutos < 0) return 'proxima';
  return minutos <= MARGEN_AHORA_MIN ? 'ahora' : 'retrasada';
}

export const ESTADOS_VERIFICACION: Record<
  EstadoVerificacion,
  { etiqueta: string; badge: string; barra: string; hora: string }
> = {
  hecha: {
    etiqueta: 'Verificada',
    badge: 'bg-brand-50 text-brand-700 ring-brand-200',
    barra: 'bg-brand-500',
    hora: 'text-slate-400',
  },
  ahora: {
    etiqueta: 'Toca ahora',
    badge: 'bg-sun-100 text-sun-700 ring-sun-300',
    barra: 'bg-sun-400',
    hora: 'text-sun-700',
  },
  retrasada: {
    etiqueta: 'Retrasada',
    badge: 'bg-red-50 text-red-700 ring-red-200',
    barra: 'bg-red-500',
    hora: 'text-red-600',
  },
  proxima: {
    etiqueta: 'Pendiente',
    badge: 'bg-navy-50 text-navy-700 ring-navy-200',
    barra: 'bg-navy-300',
    hora: 'text-navy-900',
  },
};

/** Orden del calendario: por hora y, a igual hora, por número de contrato. */
export function ordenarPorHora<T extends Pick<Contrato, 'verificacion_at' | 'numero'>>(items: T[]): T[] {
  return [...items].sort(
    (a, b) => new Date(a.verificacion_at!).getTime() - new Date(b.verificacion_at!).getTime() || a.numero - b.numero,
  );
}

/** Clave de día en hora local (AAAA-MM-DD). */
export function claveDia(valor: string | Date): string {
  return format(new Date(valor), 'yyyy-MM-dd');
}

export interface DiaAgenda<T> {
  dia: string;
  items: T[];
}

/** Agrupa por día (en orden) y deja cada día ordenado por hora. */
export function agruparPorDia<T extends Pick<Contrato, 'verificacion_at' | 'numero'>>(items: T[]): DiaAgenda<T>[] {
  const grupos = new Map<string, T[]>();
  for (const c of ordenarPorHora(items)) {
    const k = claveDia(c.verificacion_at!);
    const lista = grupos.get(k);
    if (lista) lista.push(c);
    else grupos.set(k, [c]);
  }
  return [...grupos.entries()].map(([dia, lista]) => ({ dia, items: lista }));
}

/** Los 7 días (lunes a domingo) de la semana que contiene `fecha`. */
export function diasSemana(fecha: Date): Date[] {
  const lunes = startOfWeek(fecha, { weekStartsOn: 1 });
  return Array.from({ length: 7 }, (_, i) => addDays(lunes, i));
}

export function rangoSemana(fecha: Date): { desde: Date; hasta: Date } {
  const lunes = startOfWeek(fecha, { weekStartsOn: 1 });
  return { desde: lunes, hasta: addDays(lunes, 7) };
}

/** «13 – 19 de octubre de 2026», «27 de octubre – 2 de noviembre de 2026» */
export function etiquetaSemana(fecha: Date): string {
  const [lunes, , , , , , domingo] = diasSemana(fecha);
  if (lunes.getMonth() === domingo.getMonth()) {
    return `${format(lunes, 'd')} – ${format(domingo, "d 'de' MMMM 'de' yyyy", { locale: es })}`;
  }
  if (lunes.getFullYear() === domingo.getFullYear()) {
    return `${format(lunes, "d 'de' MMMM", { locale: es })} – ${format(domingo, "d 'de' MMMM 'de' yyyy", { locale: es })}`;
  }
  return `${format(lunes, "d 'de' MMMM 'de' yyyy", { locale: es })} – ${format(domingo, "d 'de' MMMM 'de' yyyy", { locale: es })}`;
}

/** «Hoy · miércoles 15 de octubre», «Mañana · jueves 16 de octubre», «Viernes 17 de octubre» */
export function etiquetaDia(dia: string, ahora: Date): string {
  const d = new Date(`${dia}T12:00:00`);
  const larga = format(d, "EEEE d 'de' MMMM", { locale: es });
  const diff = differenceInCalendarDays(d, startOfDay(ahora));
  if (diff === 0) return `Hoy · ${larga}`;
  if (diff === 1) return `Mañana · ${larga}`;
  if (diff === -1) return `Ayer · ${larga}`;
  return larga.charAt(0).toUpperCase() + larga.slice(1);
}

/** «en 12 min», «en 1 h 05 min», «hace 20 min», «ahora» */
export function cuentaAtras(objetivo: string | Date, ahora: Date): string {
  const ms = new Date(objetivo).getTime() - ahora.getTime();
  const totalMin = Math.round(Math.abs(ms) / 60_000);
  if (totalMin === 0) return 'ahora';
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  const texto = h ? (h >= 24 ? `${Math.round(h / 24)} d` : `${h} h${m ? ` ${String(m).padStart(2, '0')} min` : ''}`) : `${m} min`;
  return ms > 0 ? `en ${texto}` : `hace ${texto}`;
}

/** Versión corta para listas: «en 12 min», «hace 3 h», «en 2 d». */
export function cuentaAtrasCorta(objetivo: string | Date, ahora: Date): string {
  const ms = new Date(objetivo).getTime() - ahora.getTime();
  const min = Math.floor(Math.abs(ms) / 60_000);
  if (min === 0) return 'ahora';
  const texto = min < 60 ? `${min} min` : min < 24 * 60 ? `${Math.floor(min / 60)} h` : `${Math.floor(min / (24 * 60))} d`;
  return ms > 0 ? `en ${texto}` : `hace ${texto}`;
}

/** Cuenta atrás con segundos para el último tramo: «04:32», «1:02:10». */
export function reloj(objetivo: string | Date, ahora: Date): string {
  const s = Math.max(0, Math.round((new Date(objetivo).getTime() - ahora.getTime()) / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const seg = s % 60;
  const mmss = `${String(m).padStart(2, '0')}:${String(seg).padStart(2, '0')}`;
  return h ? `${h}:${mmss}` : mmss;
}

/** Días que faltan para la cita de instalación desde la verificación. */
export function diasHastaInstalacion(c: Pick<Contrato, 'instalacion_fecha'>, ahora: Date): number | null {
  if (!c.instalacion_fecha) return null;
  return differenceInCalendarDays(new Date(`${c.instalacion_fecha}T12:00:00`), startOfDay(ahora));
}

/** Para `<input type="datetime-local">` en hora local. */
export function aFechaHoraLocal(valor: string | Date | null | undefined): string {
  if (!valor) return '';
  return format(new Date(valor), "yyyy-MM-dd'T'HH:mm");
}
