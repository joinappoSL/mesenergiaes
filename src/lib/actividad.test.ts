import { describe, expect, it } from 'vitest';
import { filtrarActividad, porDia, porPersona, resumirActividad, type Actividad, type TipoActividad } from './actividad';

const a = (tipo: TipoActividad, ocurrio: string, autor = 'Carlos', cantidad = 1, extra: Partial<Actividad> = {}): Actividad => ({
  id: Math.random().toString(36),
  ocurrio_at: new Date(ocurrio).toISOString(),
  persona_id: autor === 'Equipo' ? null : `id-${autor}`,
  autor,
  tipo,
  empresa: '',
  contacto: '',
  detalle: '',
  cantidad,
  fuente: 'test',
  created_at: ocurrio,
  ...extra,
});

const datos = [
  a('correo_enviado', '2026-10-19T12:41:00', 'Carlos', 1, { empresa: 'EMPRESA DE PRUEBA S.L.' }),
  a('correo_enviado', '2026-10-19T12:59:00', 'Carlos'),
  a('correo_enviado', '2026-10-20T09:13:00', 'Carlos'),
  a('factura_recibida', '2026-10-20T10:02:00', 'Carlos'),
  a('factura_recibida', '2026-10-20T14:47:00', 'Mario'),
  a('llamadas', '2026-10-20T15:12:00', 'Equipo', 60),
  a('no_atiende', '2026-10-19T21:34:00', 'Carlos'),
  a('verificacion_firmada', '2026-10-19T10:46:00', 'Mario'),
  a('venta', '2026-10-19T14:43:00', 'Mario'),
  a('venta_cargada', '2026-10-19T11:40:00', 'Carlos'),
  a('venta_anulada', '2026-10-20T16:07:00', 'Carlos'),
  a('cita', '2026-10-19T21:34:00', 'Carlos', 1, { empresa: 'Restaurante de prueba' }),
  a('nota', '2026-10-19T13:18:00', 'Carlos'),
];

describe('datos del equipo', () => {
  it('resume llamadas, correos, facturas, citas y ventas', () => {
    const r = resumirActividad(datos);
    expect(r).toMatchObject({ correos: 3, facturas: 2, citas: 1, ventas: 2, anuladas: 1, verificaciones: 1, registros: 13 });
    // 60 llamadas del equipo + 1 no atiende + 1 verificación
    expect(r.llamadas).toBe(62);
    expect(r.pctFacturas).toBe(67);
  });

  it('el porcentaje de facturas es null si no hay correos', () => {
    expect(resumirActividad([a('llamadas', '2026-10-20T10:00:00')]).pctFacturas).toBeNull();
  });

  it('agrupa por día, el más reciente primero', () => {
    const d = porDia(datos);
    expect(d.map((x) => x.clave)).toEqual(['2026-10-20', '2026-10-19']);
    expect(d[0].resumen).toMatchObject({ facturas: 2, correos: 1, llamadas: 60 });
    expect(d[1].resumen).toMatchObject({ correos: 2, citas: 1, ventas: 2 });
  });

  it('agrupa por persona', () => {
    const p = porPersona(datos);
    expect(p[0].clave).toBe('Carlos');
    expect(p.find((x) => x.clave === 'Mario')!.resumen).toMatchObject({ facturas: 1, ventas: 1, verificaciones: 1 });
    expect(p.find((x) => x.clave === 'Equipo')!.resumen.llamadas).toBe(60);
  });

  it('filtra por periodo, persona, tipo y texto', () => {
    const todo = { desde: 0, hasta: Number.MAX_SAFE_INTEGER, persona: '', tipo: '' as const, q: '' };
    expect(filtrarActividad(datos, todo)).toHaveLength(13);
    const dia20 = { ...todo, desde: new Date('2026-10-20T00:00:00').getTime(), hasta: new Date('2026-10-20T23:59:59').getTime() };
    expect(filtrarActividad(datos, dia20)).toHaveLength(5);
    expect(filtrarActividad(datos, { ...todo, persona: 'id-Mario' })).toHaveLength(3);
    expect(filtrarActividad(datos, { ...todo, tipo: 'correo_enviado' })).toHaveLength(3);
    expect(filtrarActividad(datos, { ...todo, q: 'empresa de prueba' })).toHaveLength(1);
    expect(filtrarActividad(datos, { ...todo, persona: 'Equipo' })).toHaveLength(1);
  });
});
