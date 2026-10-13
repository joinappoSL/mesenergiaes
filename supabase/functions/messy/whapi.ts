// Cliente mínimo de Whapi.cloud (pasarela de WhatsApp).
// Docs: https://whapi.readme.io/reference
import { env } from './entorno.ts';

/** Mensaje entrante tal y como lo envía el webhook de Whapi (campos que usamos). */
export interface MensajeWhapi {
  id: string;
  from_me: boolean;
  type: string;
  chat_id: string;
  chat_name?: string;
  from?: string;
  from_name?: string;
  timestamp?: number;
  text?: { body?: string };
  link_preview?: { body?: string };
  image?: { caption?: string };
  video?: { caption?: string };
  document?: { caption?: string };
}

export async function whapi<T = unknown>(
  ruta: string,
  opciones: { method?: 'GET' | 'POST' | 'PATCH' | 'PUT'; body?: unknown; query?: Record<string, string> } = {},
): Promise<T> {
  if (!env.whapiToken) throw new Error('Falta el secreto WHAPI_TOKEN en Supabase');
  const url = new URL(`${env.whapiUrl}/${ruta.replace(/^\//, '')}`);
  for (const [k, v] of Object.entries(opciones.query ?? {})) url.searchParams.set(k, v);
  const res = await fetch(url, {
    method: opciones.method ?? 'POST',
    headers: {
      Authorization: `Bearer ${env.whapiToken}`,
      Accept: 'application/json',
      ...(opciones.body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    body: opciones.body === undefined ? undefined : JSON.stringify(opciones.body),
    signal: AbortSignal.timeout(20_000),
  });
  const texto = await res.text();
  if (!res.ok) throw new Error(`Whapi ${res.status}: ${texto.slice(0, 300)}`);
  try {
    return (texto ? JSON.parse(texto) : null) as T;
  } catch {
    return texto as T;
  }
}

/** WhatsApp corta a 4096 caracteres: troceamos por párrafos si hace falta. */
function trocear(texto: string, max = 3800): string[] {
  if (texto.length <= max) return [texto];
  const trozos: string[] = [];
  let actual = '';
  for (const parrafo of texto.split('\n')) {
    if ((actual + '\n' + parrafo).length > max && actual) {
      trozos.push(actual);
      actual = parrafo;
    } else {
      actual = actual ? `${actual}\n${parrafo}` : parrafo;
    }
  }
  if (actual) trozos.push(actual);
  return trozos.flatMap((t) => (t.length > max ? t.match(new RegExp(`[\\s\\S]{1,${max}}`, 'g')) ?? [] : [t]));
}

export async function enviarTexto(chatId: string, texto: string): Promise<void> {
  for (const trozo of trocear(texto.trim())) {
    await whapi('messages/text', { body: { to: chatId, body: trozo } });
  }
}

export interface GrupoWhapi {
  id: string;
  name?: string;
}

export async function listarGrupos(): Promise<GrupoWhapi[]> {
  const r = await whapi<{ groups?: GrupoWhapi[] }>('groups', { method: 'GET', query: { count: '100' } });
  return (r?.groups ?? []).map((g) => ({ id: g.id, name: g.name }));
}

/** Apunta el webhook del canal de Whapi a esta Edge Function. */
export function configurarWebhook(url: string) {
  return whapi('settings', {
    method: 'PATCH',
    body: {
      webhooks: [{ url, events: [{ type: 'messages', method: 'post' }], mode: 'body' }],
    },
  });
}

export function estadoCanal() {
  return whapi('health', { method: 'GET' });
}
