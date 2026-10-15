import { describe, expect, it } from 'vitest';
import type { Contrato } from './types';
import {
  agruparPorDia,
  cuentaAtras,
  cuentaAtrasCorta,
  diasHastaInstalacion,
  diasSemana,
  estadoVerificacion,
  etiquetaDia,
  etiquetaSemana,
  ordenarPorHora,
  rangoSemana,
  reloj,
} from './verificaciones';

// Fechas en hora local para que los tests no dependan de la zona del equipo.
const local = (d: number, h: number, m = 0) => new Date(2026, 9, d, h, m);

function contrato(numero: number, verificacion: Date | null, hecha: Date | null = null, instalacion: string | null = null): Contrato {
  return {
    id: `id-${numero}`,
    numero,
    verificacion_at: verificacion?.toISOString() ?? null,
    verificacion_hecha_at: hecha?.toISOString() ?? null,
    instalacion_fecha: instalacion,
  } as Contrato;
}

describe('estadoVerificacion', () => {
  const ahora = local(15, 10, 0);
  it('pendiente si aún no ha llegado la hora', () => {
    expect(estadoVerificacion(contrato(1, local(15, 10, 30)), ahora)).toBe('proxima');
  });
  it('«toca ahora» desde la hora hasta 15 minutos después', () => {
    expect(estadoVerificacion(contrato(1, local(15, 10, 0)), ahora)).toBe('ahora');
    expect(estadoVerificacion(contrato(1, local(15, 9, 45)), ahora)).toBe('ahora');
  });
  it('retrasada pasados 15 minutos', () => {
    expect(estadoVerificacion(contrato(1, local(15, 9, 44)), ahora)).toBe('retrasada');
    expect(estadoVerificacion(contrato(1, local(13, 18)), ahora)).toBe('retrasada');
  });
  it('hecha manda sobre la hora', () => {
    expect(estadoVerificacion(contrato(1, local(13, 18), local(13, 18, 5)), ahora)).toBe('hecha');
  });
});

describe('orden y agrupación', () => {
  const items = [
    contrato(3, local(16, 9)),
    contrato(2, local(15, 18, 30)),
    contrato(5, local(15, 9)),
    contrato(4, local(15, 9)),
    contrato(1, local(17, 12)),
  ];

  it('ordena por hora y, a la misma hora, por número de contrato', () => {
    expect(ordenarPorHora(items).map((c) => c.numero)).toEqual([4, 5, 2, 3, 1]);
  });

  it('agrupa por día en orden', () => {
    const dias = agruparPorDia(items);
    expect(dias.map((d) => d.dia)).toEqual(['2026-10-15', '2026-10-16', '2026-10-17']);
    expect(dias[0].items.map((c) => c.numero)).toEqual([4, 5, 2]);
  });
});

describe('semanas', () => {
  it('va de lunes a domingo', () => {
    const dias = diasSemana(local(15, 12)); // jueves
    expect(dias).toHaveLength(7);
    expect(dias[0].getDay()).toBe(1);
    expect(dias[0].getDate()).toBe(12);
    expect(dias[6].getDate()).toBe(18);
    const { desde, hasta } = rangoSemana(local(18, 23, 59)); // domingo
    expect(desde.getDate()).toBe(12);
    expect(hasta.getDate()).toBe(19);
  });

  it('etiqueta de la semana', () => {
    expect(etiquetaSemana(local(15, 12))).toBe('12 – 18 de octubre de 2026');
    expect(etiquetaSemana(new Date(2026, 9, 28))).toBe('26 de octubre – 1 de noviembre de 2026');
    expect(etiquetaSemana(new Date(2026, 11, 30))).toBe('28 de diciembre de 2026 – 3 de enero de 2027');
  });

  it('etiqueta del día', () => {
    const ahora = local(15, 12);
    expect(etiquetaDia('2026-10-15', ahora)).toBe('Hoy · jueves 15 de octubre');
    expect(etiquetaDia('2026-10-16', ahora)).toBe('Mañana · viernes 16 de octubre');
    expect(etiquetaDia('2026-10-17', ahora)).toBe('Sábado 17 de octubre');
  });
});

describe('cuenta atrás', () => {
  const ahora = local(15, 10, 0);
  it('texto relativo', () => {
    expect(cuentaAtras(local(15, 10, 12), ahora)).toBe('en 12 min');
    expect(cuentaAtras(local(15, 11, 5), ahora)).toBe('en 1 h 05 min');
    expect(cuentaAtras(local(15, 12, 0), ahora)).toBe('en 2 h');
    expect(cuentaAtras(local(15, 9, 40), ahora)).toBe('hace 20 min');
    expect(cuentaAtras(local(17, 10), ahora)).toBe('en 2 d');
    expect(cuentaAtras(ahora, ahora)).toBe('ahora');
  });
  it('texto corto para la agenda', () => {
    expect(cuentaAtrasCorta(local(15, 10, 12), ahora)).toBe('en 12 min');
    expect(cuentaAtrasCorta(local(15, 11, 25), ahora)).toBe('en 1 h');
    expect(cuentaAtrasCorta(local(15, 9, 18), ahora)).toBe('hace 42 min');
    expect(cuentaAtrasCorta(local(13, 9, 0), ahora)).toBe('hace 2 d');
    expect(cuentaAtrasCorta(ahora, ahora)).toBe('ahora');
  });
  it('reloj con segundos', () => {
    expect(reloj(new Date(ahora.getTime() + 272_000), ahora)).toBe('04:32');
    expect(reloj(new Date(ahora.getTime() + 3_730_000), ahora)).toBe('1:02:10');
    expect(reloj(local(15, 9), ahora)).toBe('00:00');
  });
});

describe('instalación', () => {
  it('días que faltan', () => {
    const ahora = local(15, 20);
    expect(diasHastaInstalacion(contrato(1, null, null, '2026-10-15'), ahora)).toBe(0);
    expect(diasHastaInstalacion(contrato(1, null, null, '2026-10-20'), ahora)).toBe(5);
    expect(diasHastaInstalacion(contrato(1, null), ahora)).toBeNull();
  });
});
