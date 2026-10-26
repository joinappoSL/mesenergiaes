import { describe, expect, it } from 'vitest';
import { esEmailValido, esTelefonoValido, generarPasswordTemporal, normalizarTelefono } from './validators';

describe('teléfonos', () => {
  it('normaliza y valida 9 dígitos', () => {
    expect(normalizarTelefono('+34 612 34 56 78')).toBe('612345678');
    expect(normalizarTelefono('0034612345678')).toBe('612345678');
    expect(esTelefonoValido('612 345 678')).toBe(true);
    expect(esTelefonoValido('61234567')).toBe(false);
    expect(esTelefonoValido('')).toBe(false);
  });
});

describe('email y contraseñas', () => {
  it('valida emails', () => {
    expect(esEmailValido('ana@x.com')).toBe(true);
    expect(esEmailValido('ana@x')).toBe(false);
  });

  it('genera contraseñas temporales de al menos 8 caracteres', () => {
    const p = generarPasswordTemporal();
    expect(p).toMatch(/^Mes-[A-Za-z]{4}-\d{4}$/);
    expect(p.length).toBeGreaterThanOrEqual(8);
  });
});
