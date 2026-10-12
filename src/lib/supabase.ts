import { createClient, FunctionsHttpError } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY) as
  | string
  | undefined;

export const supabaseConfigurado = Boolean(url && key);

export const supabase = createClient(url || 'http://localhost:54321', key || 'sin-configurar', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

/** Invoca una Edge Function y devuelve el mensaje de error del servidor si falla. */
export async function invocarFuncion<T>(nombre: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(nombre, { body });
  if (error) {
    if (error instanceof FunctionsHttpError) {
      let mensaje = error.message;
      try {
        const cuerpo = (await error.context.json()) as { error?: string };
        if (cuerpo?.error) mensaje = cuerpo.error;
      } catch {
        // respuesta sin JSON: se queda el mensaje genérico
      }
      throw new Error(mensaje);
    }
    throw error;
  }
  return data as T;
}
