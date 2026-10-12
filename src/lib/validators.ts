import { PROVINCIA_POR_CP } from './constants';
import type { TipoDocumento } from './types';

const LETRAS_DNI = 'TRWAGMYFPDXBNJZSQVHLCKE';

/** Mayúsculas y sin espacios, puntos ni guiones: "12.345.678-z" → "12345678Z". */
export function normalizarDocumento(valor: string): string {
  return valor.toUpperCase().replace(/[\s.\-]/g, '');
}

export function letraDni(numero: number): string {
  return LETRAS_DNI[numero % 23];
}

/** Valida DNI (8 dígitos + letra) o NIE (X/Y/Z + 7 dígitos + letra) comprobando la letra de control. */
export function validarDocumento(tipo: TipoDocumento, valor: string): boolean {
  const doc = normalizarDocumento(valor);
  if (tipo === 'DNI') {
    if (!/^\d{8}[A-Z]$/.test(doc)) return false;
    return letraDni(Number(doc.slice(0, 8))) === doc[8];
  }
  if (!/^[XYZ]\d{7}[A-Z]$/.test(doc)) return false;
  const prefijo = { X: '0', Y: '1', Z: '2' }[doc[0] as 'X' | 'Y' | 'Z'];
  return letraDni(Number(prefijo + doc.slice(1, 8))) === doc[8];
}

/** Deduce el tipo de documento por su forma (NIE si empieza por X, Y o Z). */
export function detectarTipoDocumento(valor: string): TipoDocumento | null {
  const doc = normalizarDocumento(valor);
  if (/^[XYZ]/.test(doc)) return 'NIE';
  if (/^\d/.test(doc)) return 'DNI';
  return null;
}

/** Solo dígitos, quitando el prefijo de España (+34 / 0034). */
export function normalizarTelefono(valor: string | null | undefined): string {
  let t = (valor ?? '').replace(/\D/g, '');
  if (t.length === 13 && t.startsWith('0034')) t = t.slice(4);
  else if (t.length === 11 && t.startsWith('34')) t = t.slice(2);
  return t;
}

export function esTelefonoValido(valor: string | null | undefined): boolean {
  return /^\d{9}$/.test(normalizarTelefono(valor));
}

export function esCodigoPostalValido(valor: string): boolean {
  return /^\d{5}$/.test(valor.trim()) && Number(valor.slice(0, 2)) >= 1 && Number(valor.slice(0, 2)) <= 52;
}

export function provinciaDesdeCP(cp: string): string | null {
  const limpio = cp.trim();
  if (!/^\d{5}$/.test(limpio)) return null;
  return PROVINCIA_POR_CP[limpio.slice(0, 2)] ?? null;
}

export const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function esEmailValido(valor: string): boolean {
  return EMAIL_RE.test(valor.trim());
}

/** "35,90" o "35.90" → 35.9; vacío → null; inválido → NaN. */
export function parsearPrecio(valor: string): number | null {
  const v = valor.trim().replace(/\s|€/g, '');
  if (v === '') return null;
  if (!/^\d+([.,]\d{1,2})?$/.test(v)) return Number.NaN;
  return Number(v.replace(',', '.'));
}

/** Contraseña temporal legible: "Mes-k7Pq-4829". */
export function generarPasswordTemporal(): string {
  const letras = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ';
  const digitos = '23456789';
  const rnd = (n: number) => {
    const a = new Uint32Array(1);
    crypto.getRandomValues(a);
    return a[0] % n;
  };
  let bloque = '';
  for (let i = 0; i < 4; i++) bloque += letras[rnd(letras.length)];
  let numeros = '';
  for (let i = 0; i < 4; i++) numeros += digitos[rnd(digitos.length)];
  return `Mes-${bloque}-${numeros}`;
}
