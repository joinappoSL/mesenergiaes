// Cliente de Claude para Messy.
// Modelos configurables (ver entorno.ts): Sonnet 5.5 para el chat y los
// informes, Haiku 5.5 para los avisos de venta. Donde el modelo lo admite se
// activa el fallback en el servidor: si declina una petición, la API la
// reintenta con el modelo alternativo recomendado. Haiku 5.5 no tiene fallback
// en el servidor, así que a sus peticiones no se les envía.
import Anthropic from 'npm:@anthropic-ai/sdk@0.129.0';
import { claveAnthropic, env } from './entorno.ts';

export { Anthropic };

type Esfuerzo = 'low' | 'medium' | 'high';

let cliente: { clave: string; api: Anthropic } | null = null;

async function claude(): Promise<Anthropic> {
  const clave = await claveAnthropic();
  if (!clave) throw new Error('Falta la clave de la API de Claude (ANTHROPIC_API_KEY)');
  if (cliente?.clave !== clave) {
    cliente = {
      clave,
      api: new Anthropic({ apiKey: clave, baseURL: env.anthropicBaseUrl, maxRetries: 2, timeout: 90_000 }),
    };
  }
  return cliente.api;
}

function admiteFallback(modelo: string): boolean {
  return !/haiku/i.test(modelo);
}

type Parametros = Omit<Anthropic.Beta.Messages.MessageCreateParamsNonStreaming, 'model' | 'betas' | 'fallbacks'>;

export async function preguntar(modelo: string, params: Parametros): Promise<Anthropic.Beta.Messages.BetaMessage> {
  return (await claude()).beta.messages.create({
    model: modelo,
    ...(admiteFallback(modelo) ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const } : {}),
    ...params,
  });
}

/** Texto final de una respuesta (ignora pensamiento, herramientas y marcas de fallback). */
export function textoDe(respuesta: Anthropic.Beta.Messages.BetaMessage): string {
  return respuesta.content
    .filter((b): b is Anthropic.Beta.Messages.BetaTextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim();
}

/** Mensaje corto generado por Claude; si algo falla devuelve null y se usa una plantilla. */
export async function redactar(
  modelo: string,
  sistema: string,
  peticion: string,
  { maxTokens = 3000, esfuerzo = 'low' }: { maxTokens?: number; esfuerzo?: Esfuerzo } = {},
): Promise<string | null> {
  if (!(await claveAnthropic())) return null;
  try {
    const r = await preguntar(modelo, {
      max_tokens: maxTokens,
      output_config: { effort: esfuerzo },
      system: sistema,
      messages: [{ role: 'user', content: peticion }],
    });
    if (r.stop_reason === 'refusal') return null;
    return textoDe(r) || null;
  } catch (e) {
    console.error('Claude no ha podido redactar el mensaje:', e instanceof Anthropic.APIError ? `${e.status} ${e.message}` : e);
    return null;
  }
}
