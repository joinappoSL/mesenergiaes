// Lectura de Excel/CSV/ZIP en el navegador (las librerías se cargan bajo demanda).
import { ESTADOS_LEAD, type EstadoLead, type Lead } from './leads';

async function aHojas(buf: ArrayBuffer): Promise<string[][]> {
  const XLSX = await import('xlsx');
  const wb = XLSX.read(buf, { type: 'array' });
  const hoja = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json<string[]>(hoja, { header: 1, defval: '', raw: false });
}

/** Devuelve la primera hoja de cada archivo; los .zip se abren y se leen sus Excel. */
export async function leerHojas(archivos: File[]): Promise<string[][][]> {
  const buffers: ArrayBuffer[] = [];
  for (const f of archivos) {
    const buf = await f.arrayBuffer();
    if (/\.zip$/i.test(f.name)) {
      const { default: JSZip } = await import('jszip');
      const zip = await JSZip.loadAsync(buf);
      for (const e of Object.values(zip.files)) {
        if (e.dir || !/\.(xls|xlsx|csv)$/i.test(e.name)) continue;
        buffers.push(await e.async('arraybuffer'));
      }
    } else {
      buffers.push(buf);
    }
  }
  return Promise.all(buffers.map(aHojas));
}

/** Excel tipificado: hoja «Todos» + una hoja por tipificación (estado), con teléfonos, kW y notas. */
export async function exportarTipificado(leads: Lead[]): Promise<void> {
  const XLSX = await import('xlsx');
  const fila = (l: Lead) => ({
    Nombre: l.nombre,
    'Teléfono 1': l.telefono,
    'Teléfono 2': l.telefono2,
    kW: l.kw,
    Email: l.email,
    CUPS: l.cups,
    Módulo: l.modulo,
    Tipificación: ESTADOS_LEAD[l.estado].etiqueta,
    Llamadas: l.llamadas,
    Notas: l.nota,
  });
  const wb = XLSX.utils.book_new();
  const hoja = (rows: Lead[], nombre: string) =>
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows.length ? rows.map(fila) : [{ Nombre: '' }]), nombre.slice(0, 31));
  hoja(leads, 'Todos');
  for (const e of Object.keys(ESTADOS_LEAD) as EstadoLead[]) {
    const r = leads.filter((l) => l.estado === e);
    if (r.length) hoja(r, `${ESTADOS_LEAD[e].etiqueta} (${r.length})`);
  }
  XLSX.writeFile(wb, `leads-tipificado-${new Date().toISOString().slice(0, 10)}.xlsx`);
}
