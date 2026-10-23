// Lectura de Excel/CSV/ZIP en el navegador (las librerías se cargan bajo demanda).

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
