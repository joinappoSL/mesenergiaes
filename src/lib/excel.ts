import { ESTADOS } from './constants';
import { direccionLinea1, hoyISO } from './format';
import type { Contrato } from './types';

/** Genera y descarga un .xlsx con los contratos (la librería se carga bajo demanda). */
export async function exportarContratosExcel(contratos: Contrato[]): Promise<void> {
  const { default: writeXlsxFile } = await import('write-excel-file/browser');

  const cabecera = (texto: string) => ({
    value: texto,
    fontWeight: 'bold' as const,
    color: '#FFFFFF',
    backgroundColor: '#0F1E43',
  });
  // La librería serializa en UTC: se desplaza para que Excel muestre la hora local.
  const fechaLocal = (v: string | null) => {
    if (!v) return null;
    const d = new Date(v);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60_000);
  };
  const soloFecha = (v: string | null) => {
    if (!v) return null;
    const [y, m, d] = v.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d));
  };

  const columnas: { titulo: string; ancho: number; valor: (c: Contrato) => unknown; formato?: string }[] = [
    { titulo: 'Nº', ancho: 8, valor: (c) => c.numero },
    { titulo: 'Fecha alta', ancho: 17, valor: (c) => fechaLocal(c.created_at), formato: 'dd/mm/yyyy hh:mm' },
    { titulo: 'Estado', ancho: 12, valor: (c) => ESTADOS[c.estado].etiqueta },
    { titulo: 'Motivo estado', ancho: 30, valor: (c) => c.motivo_estado },
    { titulo: 'Firmado', ancho: 9, valor: (c) => (c.firmado ? 'Sí' : 'No') },
    { titulo: 'Fecha firma', ancho: 17, valor: (c) => fechaLocal(c.fecha_firma), formato: 'dd/mm/yyyy hh:mm' },
    { titulo: 'Nombre', ancho: 16, valor: (c) => c.cliente_nombre },
    { titulo: 'Apellidos', ancho: 22, valor: (c) => c.cliente_apellidos },
    { titulo: 'Tipo doc.', ancho: 9, valor: (c) => c.documento_tipo },
    { titulo: 'DNI/NIE', ancho: 13, valor: (c) => c.documento_numero },
    { titulo: 'Email', ancho: 26, valor: (c) => c.cliente_email },
    { titulo: 'Dirección', ancho: 38, valor: (c) => direccionLinea1(c) },
    { titulo: 'CP', ancho: 8, valor: (c) => c.codigo_postal },
    { titulo: 'Población', ancho: 18, valor: (c) => c.poblacion },
    { titulo: 'Provincia', ancho: 16, valor: (c) => c.provincia },
    { titulo: 'Tel. contacto', ancho: 13, valor: (c) => c.telefono_contacto },
    { titulo: 'Tel. fijo', ancho: 12, valor: (c) => c.telefono_fijo },
    { titulo: 'Portabilidad', ancho: 45, valor: (c) => c.portabilidad_resumen },
    { titulo: 'Operadora', ancho: 12, valor: (c) => c.operadora },
    { titulo: 'Producto', ancho: 32, valor: (c) => c.producto },
    { titulo: 'Precio/mes (€)', ancho: 13, valor: (c) => (c.precio_mensual !== null ? Number(c.precio_mensual) : null), formato: '#,##0.00' },
    { titulo: 'Detalle oferta', ancho: 50, valor: (c) => c.oferta_detalle },
    { titulo: 'Fecha instalación', ancho: 15, valor: (c) => soloFecha(c.instalacion_fecha), formato: 'dd/mm/yyyy' },
    { titulo: 'Franja', ancho: 16, valor: (c) => c.instalacion_franja },
    { titulo: 'Comercial', ancho: 22, valor: (c) => c.comercial_nombre },
    { titulo: 'Equipo', ancho: 16, valor: (c) => c.equipo_nombre },
    { titulo: 'Última llamada', ancho: 17, valor: (c) => fechaLocal(c.ultima_llamada_at), formato: 'dd/mm/yyyy hh:mm' },
    { titulo: 'Última modificación', ancho: 17, valor: (c) => fechaLocal(c.updated_at), formato: 'dd/mm/yyyy hh:mm' },
  ];

  const filas = [
    columnas.map((col) => cabecera(col.titulo)),
    ...contratos.map((c) =>
      columnas.map((col) => {
        const v = col.valor(c);
        if (v === null || v === undefined || v === '') return null;
        if (v instanceof Date) return { value: v, type: Date, format: col.formato ?? 'dd/mm/yyyy' };
        if (typeof v === 'number') return { value: v, type: Number, ...(col.formato ? { format: col.formato } : {}) };
        return { value: String(v), type: String };
      }),
    ),
  ];

  // write-excel-file tipa las celdas de forma estricta; la estructura es la documentada.
  await writeXlsxFile(filas as never, {
    sheet: 'Contratos',
    columns: columnas.map((c) => ({ width: c.ancho })),
    stickyRowsCount: 1,
  }).toFile(`contratos_mesenergia_${hoyISO()}.xlsx`);
}
