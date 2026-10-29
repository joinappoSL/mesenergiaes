// =============================================================================
// Edge Function: messy-leads — Messy avisa en el grupo de WhatsApp del avance de
// la prospección (correo enviado, facturas, comparativa, visita, firmado) y manda
// el desglose del día (llamadas, correos y a quién, facturas, comparativas,
// firmados). Se nombra la empresa/cliente; nunca teléfonos ni correos.
//
// Entrada: POST { accion: 'procesar' } con la clave de messy_config en la cabecera
// x-messy-clave (la envía la base de datos). verify_jwt = false.
// Texto determinista (sin Claude): no inventa nada.
// =============================================================================
import { createClient } from 'npm:@supabase/supabase-js@2';

const url = (Deno.env.get('SUPABASE_URL') ?? '').replace(/\/$/, '');
const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', {
  auth: { persistSession: false, autoRefreshToken: false },
});
const whapiUrl = (Deno.env.get('WHAPI_URL') || 'https://gate.whapi.cloud').replace(/\/$/, '');

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void } | undefined;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } });

function mensajeDeError(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (e && typeof e === 'object' && typeof (e as { message?: unknown }).message === 'string') return (e as { message: string }).message;
  return String(e);
}

function clavesIguales(a: string, b: string): boolean {
  const ea = new TextEncoder().encode(a);
  const eb = new TextEncoder().encode(b);
  let diff = ea.length ^ eb.length;
  for (let i = 0; i < Math.max(ea.length, eb.length); i++) diff |= (ea[i] ?? 0) ^ (eb[i] ?? 0);
  return diff === 0;
}

async function tokenWhapi(): Promise<string> {
  const deEntorno = Deno.env.get('WHAPI_TOKEN');
  if (deEntorno) return deEntorno;
  const { data, error } = await admin.rpc('messy_secreto', { p_nombre: 'messy_whapi_token' });
  if (error) throw error;
  return typeof data === 'string' ? data.trim() : '';
}

async function enviarTexto(chatId: string, texto: string): Promise<void> {
  const token = await tokenWhapi();
  if (!token) throw new Error('Falta el token de Whapi');
  // WhatsApp corta a 4096 caracteres: se trocea por líneas
  const trozos: string[] = [];
  let actual = '';
  for (const linea of texto.trim().split('\n')) {
    if (actual && (actual + '\n' + linea).length > 3800) {
      trozos.push(actual);
      actual = linea;
    } else {
      actual = actual ? `${actual}\n${linea}` : linea;
    }
  }
  if (actual) trozos.push(actual);
  for (const body of trozos) {
    const res = await fetch(`${whapiUrl}/messages/text`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ to: chatId, body }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) throw new Error(`Whapi ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
}

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

// -----------------------------------------------------------------------------
// Aviso de un avance
// -----------------------------------------------------------------------------
interface DatosLead {
  estado: 'correo' | 'facturas' | 'comparativa' | 'visita' | 'firmado';
  persona: string;
  cliente: string | null;
}

async function textoAviso(leadEventoId: string | null): Promise<string | null> {
  if (!leadEventoId) return null;
  const { data, error } = await admin.rpc('messy_datos_lead', { p_lead_evento_id: leadEventoId });
  if (error) throw error;
  const d = data as DatosLead | null;
  if (!d) return null;
  const quien = d.persona || 'Alguien del equipo';
  const cliente = d.cliente ? `*${d.cliente}*` : 'un cliente';
  switch (d.estado) {
    case 'correo':
      return `📧 *${quien}* ha enviado el correo a ${cliente}`;
    case 'facturas':
      return `📄 *${quien}* ha recibido las facturas de ${cliente} 👏`;
    case 'comparativa':
      return `📊 *${quien}* ha mandado la comparativa a ${cliente} 🤞`;
    case 'visita':
      return `📍 *${quien}* tiene visita cerrada con ${cliente} 🚀`;
    case 'firmado':
      return `✍️ *¡FIRMADO!* 🎉 *${quien}* ha cerrado a ${cliente}. ¡Enhorabuena! 💚`;
    default:
      return null;
  }
}

// -----------------------------------------------------------------------------
// Desglose del día
// -----------------------------------------------------------------------------
interface ResumenPersona {
  persona: string;
  llamadas: number;
  no_contesta: number;
  no_existe: number;
  volver_a_llamar: number;
  rechazados: number;
  visitas: number;
  correos: string[];
  n_correos: number;
  facturas: string[];
  n_facturas: number;
  comparativas: string[];
  n_comparativas: number;
  firmados: string[];
  n_firmados: number;
}

const MAX_NOMBRES = 20;

function listaNombres(nombres: string[]): string {
  const visibles = nombres.slice(0, MAX_NOMBRES).join(', ');
  return nombres.length > MAX_NOMBRES ? `${visibles} y ${nombres.length - MAX_NOMBRES} más` : visibles;
}

export function formatearResumen(personas: ResumenPersona[]): string | null {
  if (!personas.length) return null;
  const suma = (k: 'llamadas' | 'n_correos' | 'n_facturas' | 'n_comparativas' | 'n_firmados') =>
    personas.reduce((t, p) => t + p[k], 0);
  const lineas = ['📞 *Prospección de hoy*'];
  for (const p of personas) {
    const detalle = [
      p.no_contesta ? `${p.no_contesta} no contesta` : '',
      p.no_existe ? `${p.no_existe} sin teléfono` : '',
      p.rechazados ? `${p.rechazados} rechazan` : '',
      p.volver_a_llamar ? `${p.volver_a_llamar} para más tarde` : '',
    ].filter(Boolean);
    lineas.push(
      '',
      `👤 *${p.persona}* · *${p.llamadas}* ${p.llamadas === 1 ? 'llamada' : 'llamadas'}${detalle.length ? ` (${detalle.join(' · ')})` : ''}`,
    );
    if (p.n_correos) lineas.push(`   📧 ${plural(p.n_correos, 'correo', 'correos')}: ${listaNombres(p.correos)}`);
    if (p.n_facturas) lineas.push(`   📄 ${plural(p.n_facturas, 'factura recibida', 'facturas recibidas')}: ${listaNombres(p.facturas)}`);
    if (p.n_comparativas) lineas.push(`   📊 ${plural(p.n_comparativas, 'comparativa', 'comparativas')}: ${listaNombres(p.comparativas)}`);
    if (p.visitas) lineas.push(`   📍 ${plural(p.visitas, 'visita', 'visitas')}`);
    if (p.n_firmados) lineas.push(`   ✍️ ${plural(p.n_firmados, 'firmado', 'firmados')}: ${listaNombres(p.firmados)} 🎉`);
  }
  lineas.push(
    '',
    `*Total equipo:* ${suma('llamadas')} llamadas · ${suma('n_correos')} correos · ${suma('n_facturas')} facturas · ` +
      `${suma('n_comparativas')} comparativas · ${suma('n_firmados')} firmados`,
  );
  return lineas.join('\n');
}

async function textoResumen(): Promise<string | null> {
  const { data, error } = await admin.rpc('messy_resumen_leads_dia', { p_fecha: null });
  if (error) throw error;
  return formatearResumen((data ?? []) as ResumenPersona[]);
}

// -----------------------------------------------------------------------------
// Cola
// -----------------------------------------------------------------------------
interface Item {
  id: number;
  tipo: 'aviso' | 'resumen';
  clave: string;
  lead_evento_id: string | null;
  intentos: number;
}

async function cerrar(id: number, cambios: Record<string, unknown>) {
  const { error } = await admin.from('messy_leads_cola').update(cambios).eq('id', id);
  if (error) console.error('Messy-leads: no se ha podido actualizar', id, error.message);
}

async function procesar(): Promise<number> {
  const { data, error } = await admin.rpc('messy_leads_reclamar');
  if (error) throw error;
  const items = (data ?? []) as Item[];
  if (!items.length) return 0;

  const { data: cfg, error: e2 } = await admin.from('messy_config').select('activo, grupo_chat_id').eq('id', 1).single();
  if (e2) throw e2;

  for (const it of items) {
    try {
      if (!cfg.activo || !cfg.grupo_chat_id) {
        await cerrar(it.id, { estado: 'descartado', error: 'Messy está en pausa o no tiene grupo configurado' });
        continue;
      }
      const texto = it.tipo === 'aviso' ? await textoAviso(it.lead_evento_id) : await textoResumen();
      if (!texto) {
        await cerrar(it.id, { estado: 'descartado', error: 'Sin datos que contar' });
        continue;
      }
      await enviarTexto(cfg.grupo_chat_id, texto);
      await cerrar(it.id, { estado: 'enviado', mensaje: texto, error: null });
    } catch (e) {
      const msg = mensajeDeError(e);
      console.error(`Messy-leads: fallo en ${it.clave}`, msg);
      await cerrar(it.id, { estado: it.intentos >= 5 ? 'error' : 'pendiente', error: msg.slice(0, 500) });
    }
  }
  return items.length;
}

Deno.serve(async (req) => {
  if (req.method === 'GET') return json({ ok: true, servicio: 'messy-leads' });
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405);

  const clave = new URL(req.url).searchParams.get('clave') ?? req.headers.get('x-messy-clave') ?? '';
  const { data: cfg, error } = await admin.from('messy_config').select('clave').eq('id', 1).single();
  if (error) return json({ error: 'Configuración no disponible' }, 500);
  if (!clave || !clavesIguales(clave, cfg.clave)) return json({ error: 'No autorizado' }, 401);

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return json({ error: 'JSON inválido' }, 400);
  }
  if (body.accion !== 'procesar') return json({ ok: true, ignorado: true });

  const tarea = procesar().catch((e) => console.error('Messy-leads:', mensajeDeError(e)));
  if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime?.waitUntil) EdgeRuntime.waitUntil(tarea);
  else await tarea;
  return json({ ok: true }, 202);
});
