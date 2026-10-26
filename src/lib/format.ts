import { differenceInCalendarDays, format, formatDistanceToNowStrict, isToday, isTomorrow, isYesterday, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

function aFecha(valor: string | Date): Date {
  if (valor instanceof Date) return valor;
  // Fechas "YYYY-MM-DD" se interpretan en hora local (no UTC).
  return /^\d{4}-\d{2}-\d{2}$/.test(valor) ? parseISO(valor) : new Date(valor);
}

export function fecha(valor: string | Date | null | undefined): string {
  if (!valor) return '—';
  return format(aFecha(valor), 'dd/MM/yyyy');
}

export function fechaLarga(valor: string | Date | null | undefined): string {
  if (!valor) return '—';
  return format(aFecha(valor), "EEEE d 'de' MMMM", { locale: es });
}

export function fechaHora(valor: string | Date | null | undefined): string {
  if (!valor) return '—';
  return format(aFecha(valor), 'dd/MM/yyyy HH:mm');
}

export function hora(valor: string | Date): string {
  return format(aFecha(valor), 'HH:mm');
}

/** "hoy, 10:32", "ayer, 18:00", "12/10/2026 09:15" */
export function fechaHoraCorta(valor: string | Date | null | undefined): string {
  if (!valor) return '—';
  const d = aFecha(valor);
  if (isToday(d)) return `hoy, ${format(d, 'HH:mm')}`;
  if (isYesterday(d)) return `ayer, ${format(d, 'HH:mm')}`;
  if (isTomorrow(d)) return `mañana, ${format(d, 'HH:mm')}`;
  return format(d, 'dd/MM/yyyy HH:mm');
}

export function haceCuanto(valor: string | Date): string {
  return formatDistanceToNowStrict(aFecha(valor), { locale: es, addSuffix: true });
}

export function diasDesde(valor: string | Date): number {
  return Math.max(0, differenceInCalendarDays(new Date(), aFecha(valor)));
}

export function etiquetaDias(dias: number): string {
  if (dias === 0) return 'Hoy';
  if (dias === 1) return '1 día';
  return `${dias} días`;
}

export function diaRelativo(valor: string): string {
  const d = aFecha(valor);
  if (isToday(d)) return 'Hoy';
  if (isTomorrow(d)) return 'Mañana';
  return format(d, "EEE d MMM", { locale: es });
}

const EUR = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' });
const NUM = new Intl.NumberFormat('es-ES');

export function euros(valor: number | null | undefined): string {
  if (valor === null || valor === undefined) return '—';
  return EUR.format(valor);
}

export function numero(valor: number): string {
  return NUM.format(valor);
}

export function porcentaje(parte: number, total: number): string {
  if (!total) return '0 %';
  return `${(Math.round((parte / total) * 1000) / 10).toLocaleString('es-ES')} %`;
}

/** "612345678" → "612 345 678" */
export function telefono(valor: string | null | undefined): string {
  if (!valor) return '—';
  return valor.length === 9 ? `${valor.slice(0, 3)} ${valor.slice(3, 6)} ${valor.slice(6)}` : valor;
}

export function nombreCompleto(p: { nombre: string; apellidos: string } | null | undefined): string {
  if (!p) return '—';
  return `${p.nombre} ${p.apellidos}`.trim() || '—';
}

export function iniciales(nombre: string | null | undefined): string {
  if (!nombre) return '?';
  const partes = nombre.trim().split(/\s+/);
  return ((partes[0]?.[0] ?? '') + (partes[1]?.[0] ?? '')).toUpperCase() || '?';
}

export function tamanoArchivo(bytes: number | null | undefined): string {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;
}

/** Fecha de hoy en formato YYYY-MM-DD (hora local). */
export function hoyISO(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

export function isoLocal(d: Date): string {
  return format(d, 'yyyy-MM-dd');
}
