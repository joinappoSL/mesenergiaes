import { describe, expect, it } from 'vitest';
import { leerHojas } from './leadsExcel';
import { parseLecturas, parsePunto } from './leads';

const html = (cab: string[], fila: string[]) =>
  `<html><body><table><thead><tr>${cab.map((c) => `<th>${c}</th>`).join('')}</tr></thead><tbody><tr>${fila
    .map((c) => `<td>${c}</td>`)
    .join('')}</tr></tbody></table></body></html>`;
const archivo = (t: string) => new File([t], 'x.xls');

describe('leerHojas (.xls en HTML con coma decimal)', () => {
  it('lecturas: «6809,000» sigue dando 6809 kWh', async () => {
    const cab = ['CUPS', 'Fecha Lectura Inicial', 'Fecha Lectura Final', 'P1 Activa', 'P1 Maximetro'];
    const [h] = await leerHojas([archivo(html(cab, ['ES1', '2025-11-24T00:00:00', '2025-12-31T00:00:00', '6809,000', '25,500']))]);
    const f = parseLecturas(h).filas[0];
    expect(f.act[0]).toBe(6809);
    expect(f.max[0]).toBe(25.5);
  });

  it('punto: potencias «30,00» son 30 kW (no 3)', async () => {
    const cab = ['Codigo CUPS', 'Tarifa', 'Potencias Contratadas En W P1', 'Potencias Contratadas En W P6'];
    const [h] = await leerHojas([archivo(html(cab, ['ES1', '3.0TD', '30,00', '45,00']))]);
    const p = parsePunto(h);
    expect(p.contr?.[0]).toBe(30);
    expect(p.contr?.[5]).toBe(45);
  });
});
