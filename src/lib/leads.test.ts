import { describe, expect, it } from 'vitest';
import {
  analisis,
  limpiarTelefono,
  telefonosDe,
  aInputFecha,
  deInputFecha,
  embudo,
  moduloDesdeNombre,
  modulosDe,
  rangoPeriodo,
  colaPendientes,
  colaProgramadas,
  llamadaVencida,
  textoHoraLlamada,
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

describe('llamar más tarde', () => {
  const ahora = new Date(2026, 9, 23, 12, 0).getTime();
  const en = (h: number) => new Date(ahora + h * 36e5).toISOString();
  const leads = [
    { id: 'p1', estado: 'pendiente' as const, proxima_llamada_at: null },
    { id: 'v2', estado: 'volver_a_llamar' as const, proxima_llamada_at: en(-1) },
    { id: 'f3', estado: 'volver_a_llamar' as const, proxima_llamada_at: en(3) },
    { id: 'v4', estado: 'volver_a_llamar' as const, proxima_llamada_at: en(-5) },
    { id: 'n5', estado: 'no_existe' as const, proxima_llamada_at: null },
  ];

  it('una llamada programada vence cuando llega su hora', () => {
    expect(llamadaVencida(leads[1], ahora)).toBe(true);
    expect(llamadaVencida(leads[2], ahora)).toBe(false);
    expect(llamadaVencida(leads[0], ahora)).toBe(false);
  });

  it('en Pendientes van primero las programadas que ya tocan (la más antigua antes) y luego los pendientes', () => {
    expect(colaPendientes(leads, ahora).map((l) => l.id)).toEqual(['v4', 'v2', 'p1']);
  });

  it('«Llamar más tarde» se ordena por hora y «No existe» no vuelve a la cola', () => {
    expect(colaProgramadas(leads).map((l) => l.id)).toEqual(['v4', 'v2', 'f3']);
    expect(colaPendientes(leads, ahora).some((l) => l.id === 'n5')).toBe(false);
  });

  it('describe la hora en lenguaje natural', () => {
    const base = new Date(2026, 9, 23, 12, 0);
    expect(textoHoraLlamada(new Date(2026, 9, 23, 17, 30).toISOString(), base)).toBe('hoy a las 17:30');
    expect(textoHoraLlamada(new Date(2026, 9, 24, 10, 0).toISOString(), base)).toBe('mañana a las 10:00');
    expect(textoHoraLlamada(new Date(2026, 9, 28, 9, 5).toISOString(), base)).toBe('28/10 a las 09:05');
  });

  it('el registro cuenta «No existe» y «Llamar más tarde» como llamadas', () => {
    const r = resumenPorDia([
      { estado: 'no_existe', created_at: '2026-10-23T10:00:00' },
      { estado: 'volver_a_llamar', created_at: '2026-10-23T11:00:00' },
    ]);
    expect(r[0]).toMatchObject({ llamadas: 2, no_existe: 1, volver_a_llamar: 1 });
  });
});

describe('módulos (listados por código postal)', () => {
  it('propone el módulo desde el nombre del archivo', () => {
    expect(moduloDesdeNombre('leads 08017.xlsx')).toBe('08017');
    expect(moduloDesdeNombre('08022_listado.xls')).toBe('08022');
    expect(moduloDesdeNombre('listado.xlsx')).toBe('');
    expect(moduloDesdeNombre('contactos 1234567.xlsx')).toBe('');
    expect(moduloDesdeNombre('99999.xlsx')).toBe('');
  });

  it('cada lead lleva el módulo de su carga', () => {
    const { cabeceras, filas } = separarCabecera([
      ['Nombre', 'Tel', 'kW'],
      ['Bar Pep', '611222333', '15'],
    ]);
    const [l] = filasALeads(cabeceras, filas, detectarColumnas(cabeceras), ' 08017 ');
    expect(l.modulo).toBe('08017');
  });

  it('lista los módulos distintos sin vacíos', () => {
    expect(modulosDe([{ modulo: '08022' }, { modulo: '' }, { modulo: '08017' }, { modulo: '08022' }])).toEqual(['08017', '08022']);
  });
});

describe('estadísticas del embudo', () => {
  const l = (modulo: string, o: Partial<Record<string, string | null>> = {}) => ({
    modulo,
    created_at: '2026-10-01T10:00:00.000Z',
    correo_enviado_at: null,
    facturas_recibidas_at: null,
    comparativa_enviada_at: null,
    visita_at: null,
    firmado_at: null,
    ...o,
  });
  const leads = [
    l('08017', { correo_enviado_at: '2026-10-05T10:00:00.000Z', facturas_recibidas_at: '2026-10-07T10:00:00.000Z', comparativa_enviada_at: '2026-10-08T10:00:00.000Z', visita_at: '2026-10-12T10:00:00.000Z' }),
    l('08017', { correo_enviado_at: '2026-10-06T10:00:00.000Z' }),
    l('08022', { correo_enviado_at: '2026-09-20T10:00:00.000Z', facturas_recibidas_at: '2026-09-22T10:00:00.000Z', firmado_at: '2026-10-20T10:00:00.000Z' }),
    l(''),
  ];

  it('cuenta cada paso por su fecha y reparte por módulo', () => {
    const { total, porModulo } = embudo(leads);
    expect(total).toMatchObject({ cargados: 4, correos: 3, facturas: 2, comparativas: 1, visitas: 1, firmados: 1 });
    expect(total.pctFacturas).toBe(67);
    const m17 = porModulo.find((f) => f.modulo === '08017')!;
    expect(m17).toMatchObject({ cargados: 2, correos: 2, facturas: 1, pctFacturas: 50 });
    expect(porModulo.find((f) => f.modulo === '08022')).toMatchObject({ correos: 1, facturas: 1, firmados: 1 });
    expect(porModulo.find((f) => f.modulo === '')!.pctFacturas).toBeNull();
  });

  it('filtra por periodo', () => {
    const ahora = new Date(2026, 9, 21, 12, 0); // 21/10/2026
    const mes = embudo(leads, rangoPeriodo('mes', ahora)).total;
    expect(mes.correos).toBe(2); // el correo de septiembre queda fuera
    expect(mes.facturas).toBe(1);
    expect(embudo(leads, rangoPeriodo('hoy', ahora)).total.correos).toBe(0);
  });

  it('convierte fechas de/para los campos datetime-local', () => {
    const iso = new Date(2026, 9, 21, 17, 30).toISOString();
    expect(aInputFecha(iso)).toBe('2026-10-21T17:30');
    expect(deInputFecha('2026-10-21T17:30')).toBe(iso);
    expect(aInputFecha(null)).toBe('');
    expect(deInputFecha('')).toBeNull();
  });
});

describe('Excel de leads con el formato de SIPS (listados por código postal)', () => {
  const cab = ['CUPS', 'NOMBRE', 'TELEFONO', 'TELEFONO 2', '', 'CIF', 'COMERCIALIZADORA', 'EMAIL', 'PERSONA DE CONTACTO', 'NOTAS'];
  const resto = ['Barcelona', '8022', 'Barcelona', '3.0TD', '17.321', '17.321', '17.321', '17.321', '17.321', '17.321', '31/05/2021', '01/01/2000', '01/01/2000', '1', '20932', 'Sin Autoconsumo'];
  const fila = (cups: string, nombre: string, t1: string, t2: string, kw: string, ...otros: string[]) => [
    cups, nombre, t1, t2, kw, 'B63663942', 'ENDESA ENERGIA SAU - A81948077', otros[0] ?? '', '', '', ...resto,
  ];
  const aoa = [
    cab,
    fila('ES0031405959727001PZ', 'BECCARIA GALLOSTRA -', '648867995', '', '20932', 'ana@x.com'),
    fila('ES0031405995460001JF', 'BRUGCAB SA', '629542012', '932110743', '61980'),
    fila('ES0031405995465001TQ', 'DUPLICADO SL', '934179127', '934179127', '57556'),
    fila('ES0031408137896016AY', 'SIN TEL', '', '', ''),
  ];

  it('coge CUPS, teléfonos, el número junto a Teléfono 2 y la comercializadora', () => {
    const { cabeceras, filas, sinCabecera } = separarCabecera(aoa);
    expect(sinCabecera).toBe(false);
    const mapa = detectarColumnas(cabeceras, filas);
    expect(mapa).toMatchObject({ cups: 0, nombre: 1, tel1: 2, tel2: 3, kw: 4, comer: 6, email: 7 });
    const [a, b, c, d] = filasALeads(cabeceras, filas, mapa, '08022');
    expect(a).toMatchObject({ nombre: 'BECCARIA GALLOSTRA -', telefono: '648867995', telefono2: '', kw: '20932', consumo_anual: 20932, cups: 'ES0031405959727001PZ', modulo: '08022' });
    expect(b).toMatchObject({ telefono: '629542012', telefono2: '932110743', kw: '61980' });
    // Teléfono 2 igual que Teléfono 1: no se repite
    expect(c.telefono2).toBe('');
    expect(d).toMatchObject({ telefono: '', telefono2: '' });
  });

  it('da nombre a las columnas sin cabecera (tarifa, potencias, municipio…)', () => {
    const { cabeceras } = separarCabecera(aoa);
    expect(cabeceras).toContain('Tarifa');
    expect(cabeceras).toContain('Contratada P1');
    expect(cabeceras).toContain('Contratada P6');
    expect(cabeceras).toContain('Código postal');
    expect(cabeceras).toContain('Municipio');
    expect(cabeceras).toContain('Fecha de alta');
    const { cabeceras: c2, filas } = separarCabecera(aoa);
    const [l] = filasALeads(c2, filas, detectarColumnas(c2, filas));
    expect(l.extra['Tarifa']).toBe('3.0TD');
    expect(l.extra['Código postal']).toBe('08022');
    expect(Object.keys(l.extra).some((k) => /^Col \d+$/.test(k) && l.extra[k] === '20932')).toBe(false);
  });

  it('un archivo sin fila de cabeceras se entiende por su contenido y no pierde la primera fila', () => {
    const sinCab = aoa.slice(1);
    const { cabeceras, filas, sinCabecera } = separarCabecera(sinCab);
    expect(sinCabecera).toBe(true);
    expect(filas).toHaveLength(4);
    const mapa = detectarColumnas(cabeceras, filas);
    expect(mapa).toMatchObject({ cups: 0, nombre: 1, tel1: 2, email: 7 });
    const [a] = filasALeads(cabeceras, filas, mapa);
    expect(a).toMatchObject({ nombre: 'BECCARIA GALLOSTRA -', telefono: '648867995', cups: 'ES0031405959727001PZ' });
  });

  it('encuentra la cabecera aunque haya filas de título por encima', () => {
    const { cabeceras, filas } = separarCabecera([['Listado de leads'], [''], ['Código postal 08022'], ...aoa]);
    expect(cabeceras[1]).toBe('NOMBRE');
    expect(filas).toHaveLength(4);
  });

  it('quita el 34 delante y no repite teléfonos', () => {
    expect(limpiarTelefono('34 612 345 678')).toBe('612345678');
    expect(limpiarTelefono('+34612345678')).toBe('612345678');
    expect(limpiarTelefono('0034 612345678')).toBe('612345678');
    expect(limpiarTelefono('933 000 111')).toBe('933000111');
    expect(telefonosDe({ telefono: '612345678', telefono2: '612345678' })).toEqual(['612345678']);
    expect(telefonosDe({ telefono: '', telefono2: '933000111' })).toEqual(['933000111']);
  });
});
