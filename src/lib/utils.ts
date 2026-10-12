import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Traduce errores de Supabase/Postgres a mensajes comprensibles. */
export function mensajeError(e: unknown): string {
  const msg =
    typeof e === 'string'
      ? e
      : ((e as { message?: string; error_description?: string })?.message ??
        (e as { error_description?: string })?.error_description ??
        'Ha ocurrido un error inesperado');

  const reglas: [RegExp, string][] = [
    [/contratos_documento_valido/, 'El DNI/NIE no es válido. Revisa el número y la letra.'],
    [/contratos_motivo_obligatorio/, 'Indica el motivo para pasar a Cancelado o Riesgos.'],
    [/llamadas_recordatorio_obligatorio/, 'Indica fecha y hora para volver a llamar.'],
    [/contratos_email_valido/, 'El email del cliente no es válido.'],
    [/telefono_contacto|telefono_fijo|telefonos_portabilidad_numero/, 'Revisa los teléfonos: deben tener 9 dígitos.'],
    [/codigo_postal/, 'El código postal debe tener 5 dígitos.'],
    [/equipos_nombre_key/, 'Ya existe un equipo con ese nombre.'],
    [/row-level security|permission denied|insufficient_privilege/i, 'No tienes permiso para realizar esta acción.'],
    [/Invalid login credentials/i, 'Email o contraseña incorrectos.'],
    [/banned/i, 'Tu usuario está desactivado. Contacta con administración.'],
    [/Email not confirmed/i, 'Tu email no está confirmado. Contacta con administración.'],
    [/exceeded the maximum allowed size|Payload too large/i, 'El PDF supera el tamaño máximo de 10 MB.'],
    [/mime type|invalid_mime_type/i, 'Solo se admiten archivos PDF.'],
    [/Failed to fetch|NetworkError|Load failed/i, 'No hay conexión con el servidor. Revisa tu conexión a internet.'],
    [/JWT expired/i, 'Tu sesión ha caducado. Vuelve a iniciar sesión.'],
    [/should be different from the old password/i, 'La nueva contraseña debe ser distinta de la anterior.'],
    [/Password should be at least/i, 'La contraseña es demasiado corta (mínimo 8 caracteres).'],
  ];
  for (const [re, texto] of reglas) if (re.test(msg)) return texto;
  return msg;
}

export function slugArchivo(nombre: string): string {
  const base = nombre.replace(/\.pdf$/i, '');
  const limpio = base
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
  return `${limpio || 'oferta'}.pdf`;
}

export function descargarBlob(blob: Blob, nombre: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function copiarAlPortapapeles(texto: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    return false;
  }
}
