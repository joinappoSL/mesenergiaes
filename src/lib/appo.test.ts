import { describe, expect, it } from 'vitest';
import { calcularPerdidas, detectarColumnasAppo, filasAAppoLeads, packRecomendado, resumirAppo, type AppoLead } from './appo';
import { rellenarGuion } from './appoSpeech';

describe('calcularPerdidas', () => {
  it('da lo mismo que la calculadora de la web', () => {
    expect(calcularPerdidas(10, 60, 30)).toEqual({ mes: 780, anio: 9360 });
  });
  it('no admite valores negativos ni más del 100 %', () => {
    expect(calcularPerdidas(-5, 60, 30).mes).toBe(0);
    expect(calcularPerdidas(1, 100, 250).mes).toBe(433);
  });
});

describe('packRecomendado', () => {
  it('elige el pack según lo que necesita', () => {
    expect(packRecomendado({ whatsapp: true, llamadas: false, facturas: false, personal: false })).toBe('arranque');
    expect(packRecomendado({ whatsapp: true, llamadas: false, facturas: true, personal: false })).toBe('crecimiento');
    expect(packRecomendado({ whatsapp: true, llamadas: true, facturas: true, personal: true })).toBe('empresa');
  });
});

describe('importar Excel de Appo', () => {
  it('detecta las columnas por la cabecera', () => {
    expect(detectarColumnasAppo(['Nombre', 'Teléfono', 'Correo electrónico', 'Web', 'Categoría', 'Localidad'])).toEqual({
      empresa: 0,
      telefono: 1,
      email: 2,
      web: 3,
      sector: 4,
      ciudad: 5,
    });
  });
  it('descarta filas sin contacto y teléfonos repetidos', () => {
    const r = filasAAppoLeads(
      [
        ['Empresa', 'Teléfono', 'Email'],
        ['CLINICA DE PRUEBA', '+34 600 000 001', ''],
        ['Sin contacto SL', '', ''],
        ['Repetida', '600000001', ''],
        ['Solo email', '', 'Hola@Ejemplo.es'],
        [null, null, null],
      ],
      'Appo prueba',
    );
    expect(r.descartadas).toBe(1);
    expect(r.repetidas).toBe(1);
    expect(r.leads.map((l) => [l.empresa, l.telefono, l.email, l.modulo])).toEqual([
      ['CLINICA DE PRUEBA', '600000001', '', 'Appo prueba'],
      ['Solo email', '', 'hola@ejemplo.es', 'Appo prueba'],
    ]);
  });
});

describe('resumirAppo', () => {
  it('cuenta auditorías y suma cuotas de los cerrados', () => {
    const base = { auditoria_at: null, cuota_mes: null, alta: null } as unknown as AppoLead;
    const r = resumirAppo(
      [
        { ...base, estado: 'pendiente' },
        { ...base, estado: 'auditoria', auditoria_at: '2099-01-01T10:00:00Z' },
        { ...base, estado: 'cerrado', cuota_mes: 209, alta: 445 },
      ] as AppoLead[],
      new Date('2026-11-11T10:00:00Z'),
    );
    expect(r).toMatchObject({ total: 3, porLlamar: 1, auditorias: 1, auditoriasProximas: 1, cerrados: 1, mrr: 209, altas: 445 });
  });
});

describe('rellenarGuion', () => {
  it('sustituye los datos y deja los que faltan', () => {
    expect(rellenarGuion('Hola {nombre}, soy {comercial}', { nombre: 'Ana' })).toBe('Hola Ana, soy {comercial}');
  });
});
