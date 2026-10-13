import { describe, expect, it } from 'vitest';
import {
  detectarTipoDocumento,
  esCodigoPostalValido,
  esIbanValido,
  esTelefonoValido,
  formatearIban,
  generarPasswordTemporal,
  normalizarDocumento,
  normalizarTelefono,
  parsearPrecio,
  provinciaDesdeCP,
  validarDocumento,
} from './validators';

describe('DNI / NIE', () => {
  it('normaliza a mayúsculas sin espacios ni guiones', () => {
    expect(normalizarDocumento(' 12.345.678-z ')).toBe('12345678Z');
    expect(normalizarDocumento('x-1234567 l')).toBe('X1234567L');
  });

  it('valida la letra de control del DNI', () => {
    expect(validarDocumento('DNI', '12345678Z')).toBe(true);
    expect(validarDocumento('DNI', '45872319-s')).toBe(true);
    expect(validarDocumento('DNI', '12345678A')).toBe(false);
    expect(validarDocumento('DNI', '1234567Z')).toBe(false);
  });

  it('valida la letra de control del NIE', () => {
    expect(validarDocumento('NIE', 'X4567812N')).toBe(true);
    expect(validarDocumento('NIE', 'Y2345671F')).toBe(true);
    expect(validarDocumento('NIE', 'Z1234567R')).toBe(true);
    expect(validarDocumento('NIE', 'X4567812A')).toBe(false);
    expect(validarDocumento('NIE', '12345678Z')).toBe(false);
  });

  it('detecta el tipo de documento', () => {
    expect(detectarTipoDocumento('x123')).toBe('NIE');
    expect(detectarTipoDocumento('123')).toBe('DNI');
    expect(detectarTipoDocumento('')).toBeNull();
  });
});

describe('teléfonos', () => {
  it('normaliza y valida 9 dígitos', () => {
    expect(normalizarTelefono('+34 612 34 56 78')).toBe('612345678');
    expect(normalizarTelefono('0034612345678')).toBe('612345678');
    expect(esTelefonoValido('612 345 678')).toBe(true);
    expect(esTelefonoValido('61234567')).toBe(false);
    expect(esTelefonoValido('')).toBe(false);
  });
});

describe('dirección', () => {
  it('valida el código postal y deduce la provincia', () => {
    expect(esCodigoPostalValido('48011')).toBe(true);
    expect(esCodigoPostalValido('99000')).toBe(false);
    expect(esCodigoPostalValido('4801')).toBe(false);
    expect(provinciaDesdeCP('48011')).toBe('Bizkaia');
    expect(provinciaDesdeCP('28001')).toBe('Madrid');
    expect(provinciaDesdeCP('2800')).toBeNull();
  });
});

describe('otros', () => {
  it('parsea precios en formato español', () => {
    expect(parsearPrecio('35,90')).toBe(35.9);
    expect(parsearPrecio('35.9 €')).toBe(35.9);
    expect(parsearPrecio('')).toBeNull();
    expect(parsearPrecio('abc')).toBeNaN();
  });

  it('genera contraseñas temporales de al menos 8 caracteres', () => {
    const p = generarPasswordTemporal();
    expect(p).toMatch(/^Mes-[A-Za-z]{4}-\d{4}$/);
    expect(p.length).toBeGreaterThanOrEqual(8);
  });
});

describe('IBAN', () => {
  it('acepta IBAN válidos con o sin espacios', () => {
    expect(esIbanValido('ES91 2100 0418 4502 0005 1332')).toBe(true);
    expect(esIbanValido('es7921000813610123456789')).toBe(true);
    expect(esIbanValido('GB82 WEST 1234 5698 7654 32')).toBe(true);
  });

  it('rechaza dígitos de control erróneos y longitudes incorrectas', () => {
    expect(esIbanValido('ES9121000418450200051333')).toBe(false);
    expect(esIbanValido('ES912100041845020005133')).toBe(false);
    expect(esIbanValido('hola')).toBe(false);
  });

  it('formatea en bloques de 4', () => {
    expect(formatearIban('es9121000418450200051332')).toBe('ES91 2100 0418 4502 0005 1332');
  });
});
