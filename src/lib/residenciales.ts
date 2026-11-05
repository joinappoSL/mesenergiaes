// Residenciales firmados: conteo por día, mes y persona. Lógica pura (sin React ni Supabase).

export type SuministroResidencial = 'luz' | 'gas' | 'luz_gas';

export const SUMINISTROS: Record<SuministroResidencial, { etiqueta: string; contratos: number }> = {
  luz: { etiqueta: 'Luz', contratos: 1 },
  gas: { etiqueta: 'Gas', contratos: 1 },
  luz_gas: { etiqueta: 'Luz y gas', contratos: 2 },
};

export interface Residencial {
  id: string;
  propietario_id: string;
  nombre: string;
  telefono: string;
  email: string;
  cups: string;
  suministro: SuministroResidencial;
  comercializadora: string;
  /** AAAA-MM-DD */
  firmado_at: string;
  notas: string;
  created_at: string;
}

export interface ResumenResidenciales {
  hoy: number;
  semana: number;
  mes: number;
  mesAnterior: number;
  anio: number;
  total: number;
  /** contratos de luz y gas (un cliente con luz y gas cuenta 2) */
  contratos: number;
}

const pad = (n: number) => String(n).padStart(2, '0');
export const aDia = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Lunes de la semana de un día AAAA-MM-DD. */
function inicioSemana(dia: string): string {
  const [y, m, d] = dia.split('-').map(Number);
  const f = new Date(y, m - 1, d);
  f.setDate(f.getDate() - ((f.getDay() + 6) % 7));
  return aDia(f);
}

export function resumirResidenciales(filas: Pick<Residencial, 'firmado_at' | 'suministro'>[], hoy: string): ResumenResidenciales {
  const mes = hoy.slice(0, 7);
  const [y, m] = hoy.split('-').map(Number);
  const anterior = aDia(new Date(y, m - 2, 1)).slice(0, 7);
  const lunes = inicioSemana(hoy);
  const r: ResumenResidenciales = { hoy: 0, semana: 0, mes: 0, mesAnterior: 0, anio: 0, total: filas.length, contratos: 0 };
  for (const f of filas) {
    r.contratos += SUMINISTROS[f.suministro]?.contratos ?? 1;
    if (f.firmado_at === hoy) r.hoy++;
    if (f.firmado_at >= lunes && f.firmado_at <= hoy) r.semana++;
    if (f.firmado_at.startsWith(mes)) r.mes++;
    if (f.firmado_at.startsWith(anterior)) r.mesAnterior++;
    if (f.firmado_at.startsWith(hoy.slice(0, 4))) r.anio++;
  }
  return r;
}

/** Clientes firmados por mes (AAAA-MM), del más reciente al más antiguo. */
export function porMes(filas: Pick<Residencial, 'firmado_at' | 'suministro'>[]): { mes: string; clientes: number; contratos: number }[] {
  const mapa = new Map<string, { mes: string; clientes: number; contratos: number }>();
  for (const f of filas) {
    const k = f.firmado_at.slice(0, 7);
    const e = mapa.get(k) ?? { mes: k, clientes: 0, contratos: 0 };
    e.clientes++;
    e.contratos += SUMINISTROS[f.suministro]?.contratos ?? 1;
    mapa.set(k, e);
  }
  return [...mapa.values()].sort((a, b) => b.mes.localeCompare(a.mes));
}

export function porPropietario(filas: Pick<Residencial, 'propietario_id' | 'firmado_at' | 'suministro'>[], hoy: string) {
  const ids = [...new Set(filas.map((f) => f.propietario_id))];
  return ids.map((id) => ({ id, ...resumirResidenciales(filas.filter((f) => f.propietario_id === id), hoy) }));
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export const nombreMes = (aaaamm: string) => `${MESES[Number(aaaamm.slice(5, 7)) - 1]} ${aaaamm.slice(0, 4)}`;
