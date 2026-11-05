import { describe, expect, it } from 'vitest';
import { nombreMes, porMes, porPropietario, resumirResidenciales } from './residenciales';

const f = (firmado_at: string, suministro: 'luz' | 'gas' | 'luz_gas' = 'luz', propietario_id = 'a') => ({ firmado_at, suministro, propietario_id });

describe('residenciales', () => {
  const filas = [f('2026-11-05'), f('2026-11-03', 'luz_gas'), f('2026-11-02'), f('2026-10-30'), f('2026-10-02', 'gas', 'b'), f('2025-12-01')];

  it('cuenta hoy, semana, mes, mes anterior, año y total', () => {
    const r = resumirResidenciales(filas, '2026-11-05'); // jueves; la semana empieza el lunes 2
    expect(r).toEqual({ hoy: 1, semana: 3, mes: 3, mesAnterior: 2, anio: 5, total: 6, contratos: 7 });
  });

  it('agrupa por mes, el más reciente primero', () => {
    expect(porMes(filas).map((m) => [m.mes, m.clientes, m.contratos])).toEqual([
      ['2026-11', 3, 4],
      ['2026-10', 2, 2],
      ['2025-12', 1, 1],
    ]);
  });

  it('separa por persona', () => {
    const p = porPropietario(filas, '2026-11-05');
    expect(p.find((x) => x.id === 'b')?.total).toBe(1);
    expect(p.find((x) => x.id === 'a')?.mes).toBe(3);
  });

  it('el mes anterior de enero es diciembre', () => {
    expect(resumirResidenciales([f('2025-12-20')], '2026-01-10').mesAnterior).toBe(1);
    expect(nombreMes('2026-11')).toBe('noviembre 2026');
  });
});
