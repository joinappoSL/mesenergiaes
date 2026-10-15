// =============================================================================
// Edge Function: messy — el agente de IA de MESENERGIA en WhatsApp
//
// Entradas (todas protegidas con la clave de messy_config, en ?clave= o en la
// cabecera x-messy-clave):
//   · Webhook de Whapi.cloud  { messages: [...] }  → chats privados y grupo
//   · { accion: 'procesar' }            → la base de datos avisa de eventos
//                                          (grupo y recordatorios de verificaciones)
//   · { accion: 'configurar_webhook' }  → apunta el webhook de Whapi aquí
//   · { accion: 'estado' }              → estado del canal y grupos
//   · { accion: 'saludar_grupo' }       → presenta a Messy en el grupo
//   · { accion: 'anunciar_progreso' }   → manda al grupo cómo va el objetivo del mes
//   · { accion: 'anunciar_verificaciones', probar? } → última llamada y verificaciones
//                                          pendientes (sin nombres de clientes)
//
// Despliegue: verify_jwt = false (Whapi no envía JWT; se valida la clave).
// Claves: ANTHROPIC_API_KEY y WHAPI_TOKEN (secretos de la función o Supabase Vault).
// =============================================================================
import { responder, saludoGrupo } from './agente.ts';
import { procesarEventos, textoProgreso } from './avisos.ts';
import { procesarVerificaciones, textoPendientesGrupo } from './verificaciones.ts';
import { admin, claveAnthropic, clavesIguales, clienteUsuario, env, leerConfig, leerPerfil, mensajeDeError } from './entorno.ts';
import { cerrarSesion, leerSesion, pasoLogin, tokenVigente } from './sesion.ts';
import { configurarWebhook, enviarTexto, estadoCanal, listarGrupos, type MensajeWhapi } from './whapi.ts';

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void } | undefined;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

/** Responde ya a quien llama y sigue trabajando en segundo plano. */
async function enSegundoPlano(tarea: () => Promise<unknown>): Promise<void> {
  const p = tarea().catch((e) => console.error('Messy:', mensajeDeError(e)));
  if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime?.waitUntil) EdgeRuntime.waitUntil(p);
  else await p;
}

/** Avisos al grupo y recordatorios privados de verificaciones (uno no frena al otro). */
async function procesarColas(): Promise<void> {
  const [grupo, privados] = await Promise.allSettled([procesarEventos(), procesarVerificaciones()]);
  for (const r of [grupo, privados]) {
    if (r.status === 'rejected') console.error('Messy:', mensajeDeError(r.reason));
  }
}

const HISTORIAL = 12;
const SALIR_RE = /^(salir|cerrar sesi[oó]n|logout|desconectar)\W*$/i;

function textoDe(m: MensajeWhapi): string | null {
  const t = m.text?.body ?? m.link_preview?.body ?? m.image?.caption ?? m.video?.caption ?? m.document?.caption;
  return t?.trim() ? t.trim() : null;
}

// -----------------------------------------------------------------------------
// Chat privado
// -----------------------------------------------------------------------------
async function chatPrivado(m: MensajeWhapi) {
  const texto = textoDe(m);
  if (!texto) {
    await enviarTexto(m.chat_id, 'De momento solo entiendo mensajes de texto ✍️');
    return;
  }

  const s = await leerSesion(m.chat_id, m.from_name);

  if (SALIR_RE.test(texto)) {
    await cerrarSesion(s);
    await enviarTexto(m.chat_id, '👋 Sesión cerrada. Cuando quieras volver, escríbeme tu email del CRM.');
    return;
  }

  if (s.estado !== 'activa' || !s.user_id) {
    const r = await pasoLogin(s, texto);
    await enviarTexto(m.chat_id, r.texto);
    return;
  }

  const token = await tokenVigente(s);
  const perfil = token ? await leerPerfil(s.user_id) : null;
  if (!token || !perfil || !perfil.activo) {
    if (token && perfil && !perfil.activo) await cerrarSesion(s);
    await enviarTexto(m.chat_id, '🔐 Tu sesión ha caducado. Escríbeme tu email del CRM para volver a entrar.');
    return;
  }

  const desde = new Date(Date.now() - 24 * 3600_000).toISOString();
  const { data: previos } = await admin
    .from('messy_mensajes')
    .select('rol, texto')
    .eq('chat_id', m.chat_id)
    .eq('user_id', s.user_id)
    .gte('created_at', desde)
    .order('id', { ascending: false })
    .limit(HISTORIAL);
  const historial = ((previos ?? []) as { rol: 'user' | 'assistant'; texto: string }[]).reverse();

  let respuesta: string;
  try {
    respuesta = await responder({ db: clienteUsuario(token), perfil }, historial, texto);
  } catch (e) {
    console.error('Messy: error del agente', mensajeDeError(e));
    respuesta = 'Uy, se me ha cruzado un cable 🤯 Prueba otra vez en un minuto.';
    await enviarTexto(m.chat_id, respuesta);
    return;
  }

  await enviarTexto(m.chat_id, respuesta);
  await admin.from('messy_mensajes').insert([
    { chat_id: m.chat_id, user_id: s.user_id, rol: 'user', texto },
    { chat_id: m.chat_id, user_id: s.user_id, rol: 'assistant', texto: respuesta },
  ]);
}

// -----------------------------------------------------------------------------
// Grupos: Messy solo reacciona a «messy activar» (y no lee nada más)
// -----------------------------------------------------------------------------
async function chatDeGrupo(m: MensajeWhapi) {
  const texto = textoDe(m);
  if (!texto || !/^\s*@?messy\b/i.test(texto)) return;
  const orden = texto.replace(/^\s*@?messy[\s,.:;!¡]*/i, '').trim().toLowerCase();
  const cfg = await leerConfig();

  if (!/^(activa|activar|act[ií]vate|aqu[ií])\b/.test(orden)) {
    if (cfg.grupo_chat_id === m.chat_id) {
      await enviarTexto(m.chat_id, '¡Aquí estoy! 💪 Para preguntarme cosas, escríbeme por privado.');
    }
    return;
  }

  const numero = (m.from ?? '').split('@')[0];
  const { data: sesiones } = await admin
    .from('messy_sesiones')
    .select('user_id')
    .in('chat_id', [`${numero}@s.whatsapp.net`, `${numero}@c.us`])
    .eq('estado', 'activa');
  const perfiles = await Promise.all((sesiones ?? []).filter((x) => x.user_id).map((x) => leerPerfil(x.user_id)));
  const esAdmin = perfiles.some((p) => p?.activo && p.rol === 'admin');

  if (!esAdmin) {
    await enviarTexto(
      m.chat_id,
      '🔐 Para activarme en este grupo, una persona *administradora* tiene que iniciar sesión conmigo por privado ' +
        'y después escribir aquí «messy activar».',
    );
    return;
  }

  const { error } = await admin
    .from('messy_config')
    .update({ grupo_chat_id: m.chat_id, grupo_nombre: m.chat_name ?? null, updated_at: new Date().toISOString() })
    .eq('id', 1);
  if (error) throw error;
  await enviarTexto(m.chat_id, saludoGrupo());
}

async function procesarEntrantes(mensajes: MensajeWhapi[]) {
  for (const m of mensajes) {
    if (!m?.id || !m.chat_id || m.from_me) continue;

    // Whapi puede reintentar el webhook: cada mensaje se procesa una sola vez
    const { error } = await admin.from('messy_recibidos').insert({ wa_id: m.id });
    if (error) {
      if (error.code === '23505') continue;
      throw error;
    }

    try {
      if (m.chat_id.endsWith('@g.us')) await chatDeGrupo(m);
      else if (/@(s\.whatsapp\.net|c\.us|lid)$/.test(m.chat_id)) await chatPrivado(m);
    } catch (e) {
      console.error('Messy: error procesando un mensaje', mensajeDeError(e));
      if (!m.chat_id.endsWith('@g.us')) {
        await enviarTexto(m.chat_id, 'Uy, algo ha fallado por mi lado 😓 Prueba otra vez en un minuto.').catch(() => undefined);
      }
    }
  }
}

// -----------------------------------------------------------------------------
// HTTP
// -----------------------------------------------------------------------------
Deno.serve(async (req) => {
  if (req.method === 'GET') return json({ ok: true, servicio: 'messy' });
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405);

  const url = new URL(req.url);
  const clave = url.searchParams.get('clave') ?? req.headers.get('x-messy-clave') ?? '';
  let cfg;
  try {
    cfg = await leerConfig();
  } catch (e) {
    console.error('Messy: no se puede leer la configuración', mensajeDeError(e));
    return json({ error: 'Configuración no disponible' }, 500);
  }
  if (!clave || !clavesIguales(clave, cfg.clave)) return json({ error: 'No autorizado' }, 401);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'JSON inválido' }, 400);
  }

  // Webhook de Whapi
  if (Array.isArray(body.messages)) {
    await enSegundoPlano(() => procesarEntrantes(body.messages as MensajeWhapi[]));
    return json({ ok: true });
  }

  try {
    switch (body.accion) {
      case 'procesar':
        await enSegundoPlano(procesarColas);
        return json({ ok: true }, 202);

      case 'configurar_webhook': {
        const destino = `${env.supabaseUrl}/functions/v1/messy?clave=${encodeURIComponent(cfg.clave)}`;
        await configurarWebhook(destino);
        if (!cfg.funcion_url) {
          await admin.from('messy_config').update({ funcion_url: `${env.supabaseUrl}/functions/v1/messy` }).eq('id', 1);
        }
        return json({ ok: true, webhook: destino.replace(cfg.clave, '***') });
      }

      case 'estado':
        return json({
          ok: true,
          canal: await estadoCanal(),
          grupos: await listarGrupos(),
          grupo_configurado: cfg.grupo_chat_id ? { id: cfg.grupo_chat_id, nombre: cfg.grupo_nombre } : null,
          claude: Boolean(await claveAnthropic()),
        });

      case 'saludar_grupo':
        if (!cfg.grupo_chat_id) return json({ error: 'No hay grupo configurado' }, 409);
        await enviarTexto(cfg.grupo_chat_id, saludoGrupo());
        return json({ ok: true });

      case 'anunciar_progreso': {
        if (!cfg.grupo_chat_id) return json({ error: 'No hay grupo configurado' }, 409);
        const texto = await textoProgreso();
        await enviarTexto(cfg.grupo_chat_id, texto);
        return json({ ok: true, texto });
      }

      case 'anunciar_verificaciones': {
        if (!cfg.grupo_chat_id) return json({ error: 'No hay grupo configurado' }, 409);
        const texto = await textoPendientesGrupo();
        if (body.probar !== true) await enviarTexto(cfg.grupo_chat_id, texto);
        return json({ ok: true, enviado: body.probar !== true, texto });
      }
    }
    // Otros eventos de Whapi (estados, etc.): se ignoran
    return json({ ok: true, ignorado: true });
  } catch (e) {
    console.error('Messy:', mensajeDeError(e));
    return json({ error: mensajeDeError(e) }, 502);
  }
});
