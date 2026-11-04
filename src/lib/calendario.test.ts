import { describe, expect, it } from 'vitest';
import { casillasDelMes, diasEntre, eventosCalendario, sumarDias } from './calendario';
import { construirWhatsapp, enlaceWhatsapp, type Lead, type Reunion } from './leads';

const lead = (o: Partial<Lead> = {}): Lead =>
  ({
    id: 'l1', propietario_id: 'u', nombre: 'Bar Pep', telefono: '600111222', telefono2: '', email: '', kw: '', cups: '',
    consumo_anual: null, comercializadora: '', periodo_principal: null, periodo_pct: null, extra: {}, estado: 'pendiente',
    llamadas: 0, nota: '', correo_enviado_at: null, ultimo_movimiento_at: '', proxima_llamada_at: null, modulo: '',
    facturas_recibidas_at: null, comparativa_enviada_at: null, visita_at: null, visita_lugar: '', visita_notas: '',
    firmado_at: null, contrato_luz_fin: null, contrato_gas_fin: null, maximetro: null, created_at: '', updated_at: '', ...o,
  }) as Lead;

describe('calendario', () => {
  it('suma días y calcula diferencias sin saltos de horario', () => {
    expect(sumarDias('2026-12-16', -60)).toBe('2026-10-17');
    expect(sumarDias('2026-10-20', 10)).toBe('2026-10-30');
    expect(diasEntre('2026-10-24', '2026-10-26')).toBe(2);
  });

  it('crea la llamada de renovación con antelación y el fin de contrato', () => {
    const ev = eventosCalendario([lead({ contrato_luz_fin: '2026-12-16', contrato_gas_fin: '2027-04-16' })], [], 60);
    expect(ev.map((e) => [e.tipo, e.dia])).toEqual([
      ['renovacion', '2026-10-17'],
      ['fin_contrato', '2026-12-16'],
      ['renovacion', '2027-02-15'],
      ['fin_contrato', '2027-04-16'],
    ]);
  });

  it('no avisa de renovación a un cliente que ya firmó', () => {
    expect(eventosCalendario([lead({ estado: 'firmado', contrato_luz_fin: '2026-12-16' })], [], 60)).toEqual([]);
  });

  it('incluye llamadas programadas y reuniones (sin las canceladas)', () => {
    const r = (o: Partial<Reunion>): Reunion => ({ id: 'r1', lead_id: 'l1', usuario_id: 'u', fecha: new Date(2026, 10, 12, 10, 30).toISOString(), modalidad: 'presencial', lugar: 'Dr. Roux 110', notas: '', estado: 'programada', created_at: '', ...o });
    const l = lead({ estado: 'volver_a_llamar', proxima_llamada_at: new Date(2026, 10, 12, 9, 0).toISOString() });
    const ev = eventosCalendario([l], [r({}), r({ id: 'r2', estado: 'cancelada' })], 60);
    expect(ev.map((e) => [e.tipo, e.dia, e.hora])).toEqual([
      ['llamada', '2026-11-12', '09:00'],
      ['reunion', '2026-11-12', '10:30'],
    ]);
  });

  it('el mes se pinta en semanas completas empezando en lunes', () => {
    const c = casillasDelMes(2026, 10); // noviembre 2026 empieza en domingo
    expect(c.length % 7).toBe(0);
    expect(c[0].dia).toBe('2026-10-26');
    expect(c.filter((x) => x.delMes)).toHaveLength(30);
  });
});

describe('whatsapp', () => {
  it('prefija +34 a un móvil de 9 cifras y codifica el texto', () => {
    expect(enlaceWhatsapp('612 345 678', 'Hola & adiós')).toBe('https://wa.me/34612345678?text=Hola%20%26%20adi%C3%B3s');
    expect(enlaceWhatsapp('0034 612345678', 'x')).toBe('https://wa.me/34612345678?text=x');
  });

  it('el mensaje sale en castellano y en catalán con la firma y la presentación', () => {
    const d = { nombre: 'Xavier', firma: 'Mario García', presentacionUrl: 'https://x.test/p.pdf', hora: 10 } as Parameters<typeof construirWhatsapp>[1];
    expect(construirWhatsapp('es', d)).toContain('soy Mario García de Mes Energia');
    expect(construirWhatsapp('ca', d)).toContain('soc Mario García de Mes Energia');
    expect(construirWhatsapp('es', d)).toContain('https://x.test/p.pdf');
  });
});
