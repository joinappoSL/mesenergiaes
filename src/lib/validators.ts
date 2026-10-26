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

export const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function esEmailValido(valor: string): boolean {
  return EMAIL_RE.test(valor.trim());
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
