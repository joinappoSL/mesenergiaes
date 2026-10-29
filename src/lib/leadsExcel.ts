// Lectura de Excel/CSV/ZIP en el navegador (las librerías se cargan bajo demanda).

/** Los «.xls» de SIPS suelen ser HTML con coma decimal («6809,000», «30,00»). */
function esHtml(buf: ArrayBuffer): boolean {
  return /^\s*<(html|table)/i.test(new TextDecoder().decode(buf.slice(0, 64)));
}

/**
 * SheetJS lee «30,00» como 3000 (la coma como separador de miles). En HTML se leen las celdas
 * como texto: «6809,000» (3 decimales: Wh/W, como antes) pierde la coma y el resto pasa a punto.
 */
function numeroHtml(v: string): string {
  if (/^-?\d+,\d{3}$/.test(v)) return v.replace(',', '');
  return /^-?\d+,\d+$/.test(v) ? v.replace(',', '.') : v;
}

async function aHojas(buf: ArrayBuffer): Promise<string[][]> {
  const XLSX = await import('xlsx');
  const html = esHtml(buf);
  const wb = XLSX.read(buf, { type: 'array', raw: html });
  const hoja = wb.Sheets[wb.SheetNames[0]];
  const aoa = XLSX.utils.sheet_to_json<string[]>(hoja, { header: 1, defval: '', raw: false });
  return html ? aoa.map((f) => f.map((c) => numeroHtml(String(c).trim()))) : aoa;
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
