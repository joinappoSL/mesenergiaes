// Calendario de la prospección: llamadas de renovación (cuando acaba el contrato),
// llamadas programadas y reuniones. Lógica pura para poder probarla.
import type { Lead, Reunion } from './leads';

export type TipoEvento = 'renovacion' | 'fin_contrato' | 'llamada' | 'reunion';

export interface EventoCalendario {
  clave: string;
  /** AAAA-MM-DD (hora local) */
  dia: string;
  /** HH:MM si el evento tiene hora */
  hora: string | null;
  tipo: TipoEvento;
  lead: Lead;
  titulo: string;
  detalle: string;
  reunion?: Reunion;
}

/** Días de antelación con los que se avisa para llamar antes de que acabe el contrato. */
export const ANTELACIONES = [30, 60, 90, 120] as const;
export const ANTELACION_POR_DEFECTO = 60;

const pad = (n: number) => String(n).padStart(2, '0');

export const aDia = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** «2026-12-16» + días → «2026-10-17» (sin problemas de zona horaria). */
export function sumarDias(dia: string, dias: number): string {
  const [y, m, d] = dia.split('-').map(Number);
  return aDia(new Date(y, m - 1, d + dias));
}

export function diasEntre(desde: string, hasta: string): number {
  const [y1, m1, d1] = desde.split('-').map(Number);
  const [y2, m2, d2] = hasta.split('-').map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 864e5);
}

const horaDe = (iso: string) => {
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const nombreLead = (l: Lead) => l.nombre || '(sin nombre)';

export function eventosCalendario(
  leads: Lead[],
  reuniones: Reunion[],
  antelacion: number,
  opciones: { soloFirmados?: boolean } = {},
): EventoCalendario[] {
  const porId = new Map(leads.map((l) => [l.id, l]));
  const out: EventoCalendario[] = [];

  for (const l of leads) {
    // Un cliente que ya firmó con nosotros no hace falta llamarle por fin de contrato
    if (l.estado === 'firmado' && !opciones.soloFirmados) continue;
    const contratos: [string | null, string][] = [
      [l.contrato_luz_fin, 'luz'],
      [l.contrato_gas_fin, 'gas'],
    ];
    for (const [fin, suministro] of contratos) {
      if (!fin) continue;
      out.push({
        clave: `renov:${l.id}:${suministro}`,
        dia: sumarDias(fin, -antelacion),
        hora: null,
        tipo: 'renovacion',
        lead: l,
        titulo: `Llamar: renovación de ${suministro}`,
        detalle: `Su contrato de ${suministro} acaba el ${fin.split('-').reverse().join('/')}`,
      });
      out.push({
        clave: `fin:${l.id}:${suministro}`,
        dia: fin,
        hora: null,
        tipo: 'fin_contrato',
        lead: l,
        titulo: `Acaba el contrato de ${suministro}`,
        detalle: 'Fin de contrato',
      });
    }
    if (l.estado === 'volver_a_llamar' && l.proxima_llamada_at) {
      out.push({
        clave: `llamada:${l.id}`,
        dia: aDia(new Date(l.proxima_llamada_at)),
        hora: horaDe(l.proxima_llamada_at),
        tipo: 'llamada',
        lead: l,
        titulo: 'Llamada programada',
        detalle: l.nota,
      });
    }
  }

  for (const r of reuniones) {
    const lead = porId.get(r.lead_id);
    if (!lead || r.estado === 'cancelada') continue;
    out.push({
      clave: `reunion:${r.id}`,
      dia: aDia(new Date(r.fecha)),
      hora: horaDe(r.fecha),
      tipo: 'reunion',
      lead,
      titulo: r.modalidad === 'videollamada' ? 'Reunión · videollamada' : 'Reunión · presencial',
      detalle: r.lugar,
      reunion: r,
    });
  }

  return out.sort((a, b) => a.dia.localeCompare(b.dia) || (a.hora ?? '').localeCompare(b.hora ?? '') || nombreLead(a.lead).localeCompare(nombreLead(b.lead)));
}

/** Casillas de un mes (lunes primero), con relleno de semanas completas. */
export function casillasDelMes(anio: number, mes: number): { dia: string; delMes: boolean }[] {
  const primero = new Date(anio, mes, 1);
  const offset = (primero.getDay() + 6) % 7;
  const total = Math.ceil((offset + new Date(anio, mes + 1, 0).getDate()) / 7) * 7;
  return Array.from({ length: total }, (_, i) => {
    const d = new Date(anio, mes, 1 - offset + i);
    return { dia: aDia(d), delMes: d.getMonth() === mes };
  });
}
