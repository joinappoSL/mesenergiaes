import { describe, expect, it } from 'vitest';
import {
  analisis,
  construirCorreo,
  datosDeMaximetro,
  detectarColumnas,
  filasALeads,
  optimizar,
  parseFecha,
  parseLecturas,
  resumenPorDia,
  resumir,
  separarCabecera,
  type DatosCorreo,
  type FilaLectura,
} from './leads';

const base: DatosCorreo = {
  nombre: 'Ana',
  cups: 'ES0031',
  consumo: '5499',
  periodo: 3,
  pct: '30',
  comercializadora: '',
  firma: 'Mario García',
  presentacionUrl: 'https://x/p.pdf',
  tieneMaximetro: false,
  equilibrado: true,
  hora: 10,
};

describe('detectarColumnas', () => {
  it('encuentra las columnas aunque cambie el orden', () => {
    const a = detectarColumnas(['Nombre', 'Teléfono', 'Teléfono 2', 'Potencia', 'Email']);
    const b = detectarColumnas(['Email', 'Potencia', 'Teléfono 2', 'Nombre', 'Teléfono']);
    expect(a).toMatchObject({ nombre: 0, tel1: 1, tel2: 2, kw: 3, email: 4 });
    expect(b).toMatchObject({ email: 0, kw: 1, tel2: 2, nombre: 3, tel1: 4 });
  });

  it('sin cabecera de kW usa la columna junto a Teléfono 2', () => {
    const m = detectarColumnas(['Cliente', 'Telefono 1', 'Telefono 2', 'Col X']);
    expect(m.kw).toBe(3);
  });

  it('no confunde Teléfono 2 con Teléfono 1', () => {
    const m = detectarColumnas(['Telefono 2', 'Telefono 1']);
    expect(m.tel1).toBe(1);
    expect(m.tel2).toBe(0);
  });
});

describe('filasALeads', () => {
  it('limpia teléfonos, CUPS y guarda el resto en extra', () => {
    const aoa = [
      ['Nombre', 'Tel', 'Tel 2', 'kW', 'Población'],
      ['Bar Pep', '+34 611 22 33 44', '', '15', 'Rubí'],
    ];
    const { cabeceras, filas } = separarCabecera(aoa);
    const [l] = filasALeads(cabeceras, filas, detectarColumnas(cabeceras));
    expect(l.telefono).toBe('611223344');
    expect(l.kw).toBe('15');
    expect(l.extra).toEqual({ Población: 'Rubí' });
  });
});

const fila = (fin: string, act: number[], max: number[]): FilaLectura => ({
  ini: parseFecha(fin)! - 30 * 864e5,
  fin: parseFecha(fin)!,
  act,
  rea: [0, 0, 0, 0, 0, 0],
  max,
});

describe('SIPS', () => {
  it('pasa Wh a kWh y W a kW y se queda con los últimos 12 meses', () => {
    const cab = ['CUPS', 'Fecha Lectura Inicial', 'Fecha Lectura Final', 'P1 Activa', 'P1 Maximetro'];
    const aoa: string[][] = [cab, ['ES01', '', '', '', '']];
    for (let m = 1; m <= 14; m++) {
      const mes = String(((m - 1) % 12) + 1).padStart(2, '0');
      const anio = m <= 12 ? 2025 : 2026;
      aoa.push(['', `${anio}-${mes}-01T00:00:00`, `${anio}-${mes}-28T00:00:00`, '2000', '8000']);
    }
    const r = parseLecturas(aoa);
    expect(r.cups).toBe('ES01');
    expect(r.filas).toHaveLength(12);
    expect(r.filas[0].act[0]).toBe(2);
    expect(r.filas[0].max[0]).toBe(8);
  });

  it('acepta fechas m/d/yy', () => {
    expect(parseFecha('8/31/25')).toBe(Date.UTC(2025, 7, 31));
  });
});

describe('optimizar / resumir', () => {
  it('máximo de 12 meses y nunca un periodo por debajo del anterior', () => {
    const filas = [fila('2026-01-31', [1, 1, 1, 1, 1, 1], [20, 8, 8, 4, 8, 8])];
    expect(optimizar(filas)).toEqual([20, 20, 20, 20, 20, 20]);
  });

  it('un periodo sin lecturas no queda a cero', () => {
    const filas = [fila('2026-01-31', [1, 1, 1, 1, 1, 1], [0, 8, 9, 0, 0, 12])];
    const o = optimizar(filas);
    expect(o.every((x) => x > 0)).toBe(true);
    expect(o).toEqual([8, 8, 9, 9, 9, 12]);
  });

  it('elige el periodo con más consumo y redondea el % hacia abajo', () => {
    const filas = [fila('2026-01-31', [19, 24, 9, 3, 2, 43.6], [1, 1, 1, 1, 1, 1])];
    expect(resumir({ filas }).principal).toBe(6);
    const d = datosDeMaximetro({ filas } as never);
    expect(d.periodo_principal).toBe(6);
    expect(d.periodo_pct).toBe(43);
  });
});

describe('correo', () => {
  it('P6 no se presenta como el periodo más caro', () => {
    const t = analisis({ ...base, periodo: 6, pct: '43' }, 'es');
    expect(t).toContain('P6');
    expect(t).toContain('más económico');
    expect(t).not.toContain('mayor coste');
  });

  it('P3 mantiene la frase del coste y la de equilibrio entre P1 y P2', () => {
    const t = analisis(base, 'ca');
    expect(t).toContain('equilibrat entre els períodes P1 i P2');
    expect(t).toContain('cost energètic més elevat');
  });

  it('sin equilibrio no menciona P1 y P2', () => {
    expect(analisis({ ...base, equilibrado: false }, 'es')).not.toContain('P1 y P2');
  });

  it.each(['completo', 'directo', 'datos', 'express'] as const)('formato %s en ambos idiomas', (f) => {
    for (const l of ['ca', 'es'] as const) {
      const t = construirCorreo(f, l, base);
      expect(t).toContain('Mario García');
      expect(t).toContain('https://x/p.pdf');
      expect(t).toMatch(/Ana buen|Ana bon/);
    }
  });

  it('los formatos cortos omiten las líneas sin datos y mencionan el maxímetro solo si existe', () => {
    const sinNada = construirCorreo('datos', 'es', { ...base, consumo: '', pct: '', comercializadora: '', tieneMaximetro: false });
    expect(sinNada).not.toContain('Consumo anual');
    expect(sinNada).not.toContain('Contrato con');
    expect(sinNada).not.toContain('maxímetro');
    expect(construirCorreo('express', 'ca', { ...base, tieneMaximetro: true })).toContain('maxímetre');
  });

  it('saluda según la hora', () => {
    expect(construirCorreo('express', 'ca', { ...base, hora: 9 })).toContain('bon dia');
    expect(construirCorreo('express', 'ca', { ...base, hora: 17 })).toContain('bona tarda');
  });
});

describe('resumenPorDia', () => {
  it('cuenta llamadas solo para no contesta, rechazado y correo', () => {
    const r = resumenPorDia([
      { estado: 'no_contesta', created_at: '2026-10-21T10:00:00' },
      { estado: 'correo', created_at: '2026-10-21T11:00:00' },
      { estado: 'facturas', created_at: '2026-10-21T12:00:00' },
      { estado: null, created_at: '2026-10-21T12:30:00' },
    ]);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ llamadas: 2, correo: 1, facturas: 1, no_contesta: 1 });
  });
});
