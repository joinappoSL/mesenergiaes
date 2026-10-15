// El agente de Messy: Claude + herramientas de solo lectura sobre el CRM.
// Todas las consultas van con el token del usuario, así que cada persona solo ve
// lo que ve en el CRM (comercial → lo suyo, jefe → su equipo, backoffice/admin → todo).
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { Anthropic, preguntar, textoDe } from './claude.ts';
import {
  admin,
  ahoraMadrid,
  env,
  leerConfig,
  leerProgreso,
  mensajeDeError,
  NOMBRE_ROL,
  sumarDias,
  type Perfil,
} from './entorno.ts';
import { paraElChat, urlCalendario, verificacionesAtrasadas, verificacionesDeDias } from './verificaciones.ts';
import { enviarTexto, listarGrupos } from './whapi.ts';

type Herramienta = Anthropic.Beta.Messages.BetaTool;
type MensajeClaude = Anthropic.Beta.Messages.BetaMessageParam;

interface Contexto {
  db: SupabaseClient;
  perfil: Perfil;
}

class ErrorHerramienta extends Error {}

// -----------------------------------------------------------------------------
// Validación de entradas
// -----------------------------------------------------------------------------
const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ESTADOS = ['pendiente', 'activo', 'riesgos', 'cancelado'];

function fecha(v: unknown, campo: string): string | null {
  if (v === undefined || v === null || v === '') return null;
  if (typeof v !== 'string' || !FECHA_RE.test(v)) throw new ErrorHerramienta(`«${campo}» debe tener formato AAAA-MM-DD`);
  return v;
}

function uuid(v: unknown, campo: string): string | null {
  if (v === undefined || v === null || v === '') return null;
  if (typeof v !== 'string' || !UUID_RE.test(v)) {
    throw new ErrorHerramienta(`«${campo}» debe ser un id (uuid). Búscalo antes con la herramienta «equipo».`);
  }
  return v;
}

function entero(v: unknown, campo: string, min: number, max: number, defecto: number): number {
  if (v === undefined || v === null || v === '') return defecto;
  const n = Number(v);
  if (!Number.isInteger(n) || n < min || n > max) throw new ErrorHerramienta(`«${campo}» debe ser un entero entre ${min} y ${max}`);
  return n;
}

function texto(v: unknown, campo: string, max = 200): string | null {
  if (v === undefined || v === null) return null;
  if (typeof v !== 'string') throw new ErrorHerramienta(`«${campo}» debe ser texto`);
  const t = v.trim();
  if (t.length > max) throw new ErrorHerramienta(`«${campo}» es demasiado largo`);
  return t || null;
}

function fechaHora(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const f = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
  return f.format(new Date(iso));
}

function diasDesde(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

// -----------------------------------------------------------------------------
// Definición de herramientas
// -----------------------------------------------------------------------------
const CAMPOS_LISTA =
  'numero, created_at, estado, motivo_estado, firmado, cliente_nombre, cliente_apellidos, comercial_id, ' +
  'comercial_nombre, equipo_nombre, producto, operadora, precio_mensual, instalacion_fecha, instalacion_franja, ' +
  'ultimo_resultado_llamada, proxima_llamada_at';

interface FilaContrato {
  numero: number;
  created_at: string;
  estado: string;
  motivo_estado: string | null;
  firmado: boolean;
  cliente_nombre: string;
  cliente_apellidos: string;
  comercial_id: string | null;
  comercial_nombre: string | null;
  equipo_nombre: string | null;
  producto: string | null;
  operadora: string | null;
  precio_mensual: number | null;
  instalacion_fecha: string | null;
  instalacion_franja: string | null;
  ultimo_resultado_llamada: string | null;
  proxima_llamada_at: string | null;
}

function resumirContrato(c: FilaContrato) {
  return {
    numero: c.numero,
    subido: fechaHora(c.created_at),
    estado: c.estado,
    motivo: c.motivo_estado ?? undefined,
    firmado: c.firmado,
    cliente: `${c.cliente_nombre} ${c.cliente_apellidos}`.trim(),
    comercial: c.comercial_nombre,
    equipo: c.equipo_nombre,
    producto: c.producto,
    operadora: c.operadora,
    cuota_mensual: c.precio_mensual,
    instalacion: c.instalacion_fecha ? `${c.instalacion_fecha}${c.instalacion_franja ? ` (${c.instalacion_franja})` : ''}` : null,
    ultima_llamada: c.ultimo_resultado_llamada,
    volver_a_llamar: fechaHora(c.proxima_llamada_at),
  };
}

const HERRAMIENTAS: Herramienta[] = [
  {
    name: 'estadisticas',
    description:
      'KPIs del CRM en un periodo (por fecha de subida del contrato): reservas de plaza (contratos subidos) por estado, firmados, ' +
      'pendientes sin firmar, cuota mensual de los activos, reservas por día, ranking de comerciales (subidos, activos, ' +
      'pendientes, perdidos, % activación) y citas de instalación de hoy y los próximos 7 días. Solo incluye lo que el ' +
      'usuario puede ver. Sin fechas: últimos 30 días. Para «hoy» usa desde = hasta = fecha de hoy. Incluye siempre ' +
      'objetivo_mes_equipo: el objetivo del mes con todas las reservas del equipo en conjunto (llevamos, objetivo, quedan, %).',
    input_schema: {
      type: 'object',
      properties: {
        desde: { type: 'string', description: 'Fecha inicial AAAA-MM-DD (incluida)' },
        hasta: { type: 'string', description: 'Fecha final AAAA-MM-DD (incluida)' },
        comercial_id: { type: 'string', description: 'Id de un comercial para ver solo sus datos (ver herramienta equipo)' },
        equipo_id: { type: 'string', description: 'Id de un equipo para ver solo sus datos (ver herramienta equipo)' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'buscar_contratos',
    description:
      'Lista contratos (los más recientes primero) con filtros. Devuelve número, fecha de subida, estado, firma, ' +
      'nombre del cliente, comercial, equipo, producto, operadora, cuota, cita de instalación y última llamada. ' +
      'Nunca devuelve DNI, teléfonos, emails ni direcciones. El texto busca por nombre del cliente o número de contrato.',
    input_schema: {
      type: 'object',
      properties: {
        texto: { type: 'string', description: 'Nombre/apellidos del cliente o número de contrato' },
        estados: {
          type: 'array',
          items: { type: 'string', enum: ESTADOS },
          description: 'Estados a incluir',
        },
        firmado: { type: 'boolean', description: 'true = solo firmados, false = solo sin firmar' },
        comercial_id: { type: 'string', description: 'Id del comercial' },
        equipo_id: { type: 'string', description: 'Id del equipo' },
        desde: { type: 'string', description: 'Subidos desde AAAA-MM-DD' },
        hasta: { type: 'string', description: 'Subidos hasta AAAA-MM-DD' },
        limite: { type: 'integer', description: 'Máximo de contratos a devolver (1-30, por defecto 10)' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'ver_contrato',
    description:
      'Ficha de un contrato por su número: estado, firma, oferta, cita de instalación, últimas observaciones, ' +
      'cambios de estado y llamadas de backoffice. Sin datos personales sensibles del cliente.',
    input_schema: {
      type: 'object',
      properties: { numero: { type: 'integer', description: 'Número del contrato (#)' } },
      required: ['numero'],
      additionalProperties: false,
    },
  },
  {
    name: 'equipo',
    description:
      'Equipos y personas que el usuario puede ver (nombre, rol, equipo, activo) con sus ids, para filtrar ' +
      'estadísticas o contratos por comercial o equipo.',
    input_schema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'cola_backoffice',
    description:
      'Cola de llamadas de backoffice: contratos en Pendiente, primero los recordatorios de «volver a llamar» vencidos ' +
      'y luego por antigüedad. Solo para backoffice y administración.',
    input_schema: {
      type: 'object',
      properties: {
        solo_sin_firmar: { type: 'boolean', description: 'Solo los que aún no están firmados' },
        limite: { type: 'integer', description: 'Máximo a devolver (1-30, por defecto 10)' },
      },
      additionalProperties: false,
    },
  },
];

const HERRAMIENTA_VERIFICACIONES: Herramienta = {
  name: 'verificaciones',
  description:
    'Calendario de verificaciones de backoffice (la llamada de verificación al cliente antes de la instalación), ' +
    'por orden de hora de Madrid. periodo: hoy, manana, semana (hoy y los 6 días siguientes) o atrasadas (pasadas de ' +
    'hora y sin hacer, de contratos en Pendiente). Devuelve cliente, número, día, hora, verificacion (pendiente, toca ' +
    'ahora, retrasada o hecha, con quién la hizo), comercial, producto y cita de instalación.',
  input_schema: {
    type: 'object',
    properties: { periodo: { type: 'string', enum: ['hoy', 'manana', 'semana', 'atrasadas'] } },
    required: ['periodo'],
    additionalProperties: false,
  },
};

const HERRAMIENTAS_ADMIN: Herramienta[] = [
  {
    name: 'grupo_whatsapp',
    description:
      'Gestiona el grupo de WhatsApp donde Messy anuncia las reservas de plaza y manda los buenos días y el cierre. ' +
      'accion=estado: configuración actual. accion=listar: grupos en los que está el número de Messy. ' +
      'accion=activar: usa ese grupo (chat_id de «listar») para los avisos.',
    input_schema: {
      type: 'object',
      properties: {
        accion: { type: 'string', enum: ['estado', 'listar', 'activar'] },
        chat_id: { type: 'string', description: 'Id del grupo (termina en @g.us). Solo para activar.' },
      },
      required: ['accion'],
      additionalProperties: false,
    },
  },
  {
    name: 'ajustes_messy',
    description:
      'Cambia los avisos automáticos de Messy: activarlos o pausarlos, la hora de los buenos días y del cierre ' +
      '(hora de Madrid, 0-23), los días de la semana (1 = lunes … 7 = domingo), el objetivo mensual de reservas de ' +
      'plaza del equipo, corregir cuántas llevamos este mes en total (si hay reservas que no están en el CRM) y los ' +
      'recordatorios privados de verificaciones: minutos de antelación (0 = sin recordatorio), lista del día a la hora ' +
      'de los buenos días y quién los recibe (ids de admin o backoffice de la herramienta equipo; necesitan tener la ' +
      'sesión de Messy iniciada).',
    input_schema: {
      type: 'object',
      properties: {
        activo: { type: 'boolean' },
        hora_buenos_dias: { type: 'integer' },
        hora_cierre: { type: 'integer' },
        dias_activos: { type: 'array', items: { type: 'integer' } },
        objetivo_mes: { type: 'integer', description: 'Reservas de plaza que el equipo quiere hacer este mes' },
        llevamos_este_mes: {
          type: 'integer',
          description: 'Total real de reservas del equipo este mes (incluidas las que no están en el CRM)',
        },
        aviso_verificacion_min: { type: 'integer', description: 'Minutos antes de cada verificación (0-120, 0 = no avisar)' },
        resumen_verificaciones: { type: 'boolean', description: 'Mandar por privado la lista del día (mañana) y el balance (noche)' },
        verificaciones_para: {
          type: 'array',
          items: { type: 'string' },
          description: 'Ids de las personas (admin o backoffice) que reciben los recordatorios; sustituye la lista',
        },
      },
      additionalProperties: false,
    },
  },
];

const HERRAMIENTA_ENVIAR: Herramienta = {
  name: 'enviar_al_grupo',
  description:
    'Publica un mensaje en el grupo de WhatsApp del equipo en nombre de Messy (felicitaciones, avisos, retos). ' +
    'Antes de usarla enseña el texto al usuario y espera su confirmación, salvo que te haya dado el texto exacto ' +
    'y te haya pedido enviarlo.',
  input_schema: {
    type: 'object',
    properties: { texto: { type: 'string', description: 'Mensaje con formato de WhatsApp' } },
    required: ['texto'],
    additionalProperties: false,
  },
};

function herramientasPara(p: Perfil): Herramienta[] {
  const lista = [...HERRAMIENTAS];
  if (p.rol === 'admin' || p.rol === 'backoffice') lista.push(HERRAMIENTA_VERIFICACIONES);
  if (p.rol === 'admin') lista.push(...HERRAMIENTAS_ADMIN);
  if (p.rol === 'admin' || p.rol === 'jefe_equipo') lista.push(HERRAMIENTA_ENVIAR);
  return lista;
}

// -----------------------------------------------------------------------------
// Ejecución de herramientas
// -----------------------------------------------------------------------------
type Entrada = Record<string, unknown>;

async function ejecutar(nombre: string, e: Entrada, ctx: Contexto): Promise<unknown> {
  const { db, perfil } = ctx;

  switch (nombre) {
    case 'estadisticas': {
      const { data, error } = await db.rpc('dashboard', {
        p_desde: fecha(e.desde, 'desde'),
        p_hasta: fecha(e.hasta, 'hasta'),
        p_equipo_id: uuid(e.equipo_id, 'equipo_id'),
        p_comercial_id: uuid(e.comercial_id, 'comercial_id'),
      });
      if (error) throw error;
      const d = data as {
        desde: string;
        hasta: string;
        kpis: Record<string, number>;
        por_dia: { fecha: string; total: number }[];
        ranking: Record<string, unknown>[];
        citas: { numero: number; cliente: string; poblacion: string; fecha: string; franja: string | null; estado: string; firmado: boolean; comercial: string | null }[];
      };
      return {
        objetivo_mes_equipo: await leerProgreso(),
        periodo: { desde: d.desde, hasta: d.hasta },
        kpis: d.kpis,
        reservas_por_dia: d.por_dia.filter((x) => x.total > 0),
        ranking: d.ranking.slice(0, 25),
        citas_instalacion_7_dias: {
          total: d.citas.length,
          proximas: d.citas.slice(0, 15).map((c) => ({
            numero: c.numero,
            cliente: c.cliente,
            poblacion: c.poblacion,
            fecha: c.fecha,
            franja: c.franja,
            estado: c.estado,
            firmado: c.firmado,
            comercial: c.comercial,
          })),
        },
      };
    }

    case 'buscar_contratos': {
      const estados = Array.isArray(e.estados) ? e.estados.filter((x): x is string => ESTADOS.includes(String(x))) : null;
      const limite = entero(e.limite, 'limite', 1, 30, 10);
      if (e.firmado !== undefined && typeof e.firmado !== 'boolean') throw new ErrorHerramienta('«firmado» debe ser true o false');
      const { data, error, count } = await db
        .rpc(
          'buscar_contratos',
          {
            p_q: texto(e.texto, 'texto'),
            p_estados: estados?.length ? estados : null,
            p_firmado: (e.firmado as boolean | undefined) ?? null,
            p_comercial_id: uuid(e.comercial_id, 'comercial_id'),
            p_equipo_id: uuid(e.equipo_id, 'equipo_id'),
            p_desde: fecha(e.desde, 'desde'),
            p_hasta: fecha(e.hasta, 'hasta'),
          },
          { count: 'exact' },
        )
        .select(CAMPOS_LISTA)
        .order('created_at', { ascending: false })
        .limit(limite);
      if (error) throw error;
      const filas = (data ?? []) as unknown as FilaContrato[];
      return { total: count ?? filas.length, mostrados: filas.length, contratos: filas.map(resumirContrato) };
    }

    case 'ver_contrato': {
      const numero = entero(e.numero, 'numero', 1, 1_000_000_000, 0);
      const { data, error } = await db
        .from('v_contratos')
        .select(
          `id, ${CAMPOS_LISTA}, oferta_detalle, poblacion, provincia, fecha_firma, ultima_llamada_at, num_documentos, updated_at, ` +
            'verificacion_at, verificacion_hecha_at, verificacion_hecha_por_nombre',
        )
        .eq('numero', numero)
        .maybeSingle();
      if (error) throw error;
      if (!data) return { encontrado: false, aviso: `No existe el contrato #${numero} o no tienes acceso a él.` };
      const c = data as unknown as FilaContrato & {
        id: string;
        oferta_detalle: string | null;
        poblacion: string;
        provincia: string;
        fecha_firma: string | null;
        ultima_llamada_at: string | null;
        num_documentos: number;
        updated_at: string;
        verificacion_at: string | null;
        verificacion_hecha_at: string | null;
        verificacion_hecha_por_nombre: string | null;
      };
      const [obs, hist, llam] = await Promise.all([
        db.from('observaciones').select('texto, autor_nombre, sistema, created_at').eq('contrato_id', c.id)
          .order('created_at', { ascending: false }).limit(8),
        db.from('historial_estados').select('estado_anterior, estado_nuevo, motivo, usuario_nombre, created_at')
          .eq('contrato_id', c.id).order('created_at', { ascending: false }).limit(8),
        db.from('llamadas').select('resultado, nota, volver_a_llamar_at, usuario_nombre, created_at')
          .eq('contrato_id', c.id).order('created_at', { ascending: false }).limit(5),
      ]);
      return {
        ...resumirContrato(c),
        oferta: c.oferta_detalle,
        localidad: `${c.poblacion} (${c.provincia})`,
        fecha_firma: fechaHora(c.fecha_firma),
        dias_desde_subida: diasDesde(c.created_at),
        pdf_adjuntos: c.num_documentos,
        verificacion: c.verificacion_at
          ? {
              programada: fechaHora(c.verificacion_at),
              hecha: fechaHora(c.verificacion_hecha_at),
              por: c.verificacion_hecha_por_nombre ?? undefined,
            }
          : null,
        observaciones: (obs.data ?? []).map((o) => ({
          fecha: fechaHora(o.created_at),
          autor: o.sistema ? 'Sistema' : o.autor_nombre,
          texto: o.texto,
        })),
        historial_estados: (hist.data ?? []).map((h) => ({
          fecha: fechaHora(h.created_at),
          de: h.estado_anterior,
          a: h.estado_nuevo,
          motivo: h.motivo,
          por: h.usuario_nombre,
        })),
        llamadas: (llam.data ?? []).map((l) => ({
          fecha: fechaHora(l.created_at),
          resultado: l.resultado,
          nota: l.nota,
          volver_a_llamar: fechaHora(l.volver_a_llamar_at),
          por: l.usuario_nombre,
        })),
      };
    }

    case 'equipo': {
      const [personas, equipos] = await Promise.all([
        db.from('profiles').select('id, nombre, apellidos, rol, equipo_id, activo').order('nombre'),
        db.from('equipos').select('id, nombre, jefe_id').order('nombre'),
      ]);
      if (personas.error) throw personas.error;
      if (equipos.error) throw equipos.error;
      const nombreEquipo = new Map((equipos.data ?? []).map((q) => [q.id, q.nombre]));
      return {
        equipos: (equipos.data ?? []).map((q) => ({ id: q.id, nombre: q.nombre })),
        personas: (personas.data ?? []).map((p) => ({
          id: p.id,
          nombre: `${p.nombre} ${p.apellidos}`.trim(),
          rol: p.rol,
          equipo: p.equipo_id ? nombreEquipo.get(p.equipo_id) ?? null : null,
          activo: p.activo,
        })),
      };
    }

    case 'cola_backoffice': {
      const limite = entero(e.limite, 'limite', 1, 30, 10);
      const { data, error, count } = await db
        .rpc('cola_backoffice', { p_solo_sin_firmar: e.solo_sin_firmar === true }, { count: 'exact' })
        .select(CAMPOS_LISTA)
        .limit(limite);
      if (error) throw error;
      const filas = (data ?? []) as unknown as FilaContrato[];
      return {
        total_en_cola: count ?? filas.length,
        primeros: filas.map((c) => ({ ...resumirContrato(c), dias_en_pendiente: diasDesde(c.created_at) })),
      };
    }

    case 'verificaciones': {
      if (perfil.rol !== 'admin' && perfil.rol !== 'backoffice') {
        throw new ErrorHerramienta('El calendario de verificaciones es solo para backoffice y administración.');
      }
      const periodo = texto(e.periodo, 'periodo');
      const hoy = ahoraMadrid().hoy;
      let filas;
      if (periodo === 'hoy') filas = await verificacionesDeDias(db, hoy, hoy);
      else if (periodo === 'manana') filas = await verificacionesDeDias(db, sumarDias(hoy, 1), sumarDias(hoy, 1));
      else if (periodo === 'semana') filas = await verificacionesDeDias(db, hoy, sumarDias(hoy, 6));
      else if (periodo === 'atrasadas') filas = await verificacionesAtrasadas(db);
      else throw new ErrorHerramienta('periodo debe ser hoy, manana, semana o atrasadas');
      const lista = filas.map((c) => paraElChat(c, hoy));
      return {
        periodo,
        total: lista.length,
        hechas: lista.filter((c) => c.verificacion === 'hecha').length,
        por_hacer: lista.filter((c) => c.verificacion !== 'hecha').length,
        verificaciones: lista.slice(0, 40),
        calendario: urlCalendario(),
      };
    }

    case 'grupo_whatsapp': {
      if (perfil.rol !== 'admin') throw new ErrorHerramienta('Solo administración puede gestionar el grupo.');
      const accion = texto(e.accion, 'accion');
      if (accion === 'estado') {
        const c = await leerConfig();
        return {
          avisos_activos: c.activo,
          grupo: c.grupo_chat_id ? { id: c.grupo_chat_id, nombre: c.grupo_nombre } : null,
          hora_buenos_dias: c.hora_buenos_dias,
          hora_cierre: c.hora_cierre,
          dias_activos: c.dias_activos,
          recordatorios_verificaciones: {
            minutos_antes: c.aviso_verificacion_min,
            resumenes_manana_y_noche: c.resumen_verificaciones,
            para: c.verificaciones_para,
          },
        };
      }
      if (accion === 'listar') return { grupos: await listarGrupos() };
      if (accion === 'activar') {
        const chatId = texto(e.chat_id, 'chat_id');
        if (!chatId || !chatId.endsWith('@g.us')) throw new ErrorHerramienta('chat_id debe ser el id de un grupo (termina en @g.us)');
        const grupo = (await listarGrupos()).find((g) => g.id === chatId);
        if (!grupo) throw new ErrorHerramienta('El número de Messy no está en ese grupo. Añádelo primero al grupo.');
        const { error } = await admin
          .from('messy_config')
          .update({ grupo_chat_id: chatId, grupo_nombre: grupo.name ?? null, updated_at: new Date().toISOString() })
          .eq('id', 1);
        if (error) throw error;
        await enviarTexto(chatId, saludoGrupo());
        return { ok: true, grupo };
      }
      throw new ErrorHerramienta('accion debe ser estado, listar o activar');
    }

    case 'ajustes_messy': {
      if (perfil.rol !== 'admin') throw new ErrorHerramienta('Solo administración puede cambiar los ajustes de Messy.');
      const cambios: Record<string, unknown> = {};
      if (e.activo !== undefined) {
        if (typeof e.activo !== 'boolean') throw new ErrorHerramienta('«activo» debe ser true o false');
        cambios.activo = e.activo;
      }
      if (e.hora_buenos_dias !== undefined) cambios.hora_buenos_dias = entero(e.hora_buenos_dias, 'hora_buenos_dias', 0, 23, 9);
      if (e.hora_cierre !== undefined) cambios.hora_cierre = entero(e.hora_cierre, 'hora_cierre', 0, 23, 20);
      if (e.dias_activos !== undefined) {
        if (!Array.isArray(e.dias_activos)) throw new ErrorHerramienta('«dias_activos» debe ser una lista de 1 a 7');
        const dias = [...new Set(e.dias_activos.map((d) => entero(d, 'dias_activos', 1, 7, 1)))].sort();
        cambios.dias_activos = dias;
      }
      if (e.objetivo_mes !== undefined) cambios.objetivo_mes = entero(e.objetivo_mes, 'objetivo_mes', 1, 100000, 50);
      if (e.llevamos_este_mes !== undefined) {
        const llevamos = entero(e.llevamos_este_mes, 'llevamos_este_mes', 0, 100000, 0);
        const p = await leerProgreso();
        if (llevamos < p.en_crm) {
          throw new ErrorHerramienta(`En el CRM ya hay ${p.en_crm} reservas este mes: el total no puede ser menor.`);
        }
        cambios.ajuste_mes = llevamos - p.en_crm;
        cambios.ajuste_mes_inicio = `${p.mes}-01`;
      }
      if (e.aviso_verificacion_min !== undefined) {
        cambios.aviso_verificacion_min = entero(e.aviso_verificacion_min, 'aviso_verificacion_min', 0, 120, 10);
      }
      if (e.resumen_verificaciones !== undefined) {
        if (typeof e.resumen_verificaciones !== 'boolean') throw new ErrorHerramienta('«resumen_verificaciones» debe ser true o false');
        cambios.resumen_verificaciones = e.resumen_verificaciones;
      }
      if (e.verificaciones_para !== undefined) {
        if (!Array.isArray(e.verificaciones_para)) throw new ErrorHerramienta('«verificaciones_para» debe ser una lista de ids');
        const ids = [...new Set(e.verificaciones_para.map((x) => uuid(x, 'verificaciones_para')).filter((x): x is string => !!x))];
        if (ids.length) {
          const { data: gente, error: errGente } = await admin.from('profiles').select('id, rol, activo').in('id', ids);
          if (errGente) throw errGente;
          const validos = (gente ?? []).filter((g) => g.activo && (g.rol === 'admin' || g.rol === 'backoffice'));
          if (validos.length !== ids.length) {
            throw new ErrorHerramienta('Solo pueden recibir los recordatorios personas activas de administración o backoffice.');
          }
        }
        cambios.verificaciones_para = ids;
      }
      if (!Object.keys(cambios).length) throw new ErrorHerramienta('No hay nada que cambiar');
      const { data, error } = await admin
        .from('messy_config')
        .update({ ...cambios, updated_at: new Date().toISOString() })
        .eq('id', 1)
        .select('activo, hora_buenos_dias, hora_cierre, dias_activos, objetivo_mes, aviso_verificacion_min, resumen_verificaciones, verificaciones_para')
        .single();
      if (error) throw error;
      return { ok: true, ajustes: data, objetivo_mes_equipo: await leerProgreso() };
    }

    case 'enviar_al_grupo': {
      if (perfil.rol !== 'admin' && perfil.rol !== 'jefe_equipo') {
        throw new ErrorHerramienta('Solo administración y jefes de equipo pueden escribir en el grupo.');
      }
      const t = texto(e.texto, 'texto', 3000);
      if (!t) throw new ErrorHerramienta('El mensaje está vacío');
      const c = await leerConfig();
      if (!c.grupo_chat_id) throw new ErrorHerramienta('Todavía no hay grupo configurado. Un admin tiene que activarlo.');
      await enviarTexto(c.grupo_chat_id, t);
      return { ok: true, enviado_a: c.grupo_nombre ?? 'grupo del equipo' };
    }
  }
  throw new ErrorHerramienta(`Herramienta desconocida: ${nombre}`);
}

export function saludoGrupo(): string {
  return (
    `👋 ¡Hola, equipo! Soy *Messy*, el asistente de IA de MESENERGIA ⚡\n\n` +
    `A partir de ahora os aviso aquí de cada reserva de plaza que entre en el CRM 🔥, os doy los buenos días con energía ☀️ ` +
    `y hacemos juntos el cierre del día 🌙\n\n` +
    `¿Quieres saber cómo vas? Escríbeme por privado e inicia sesión con tu usuario del CRM 💬`
  );
}

// -----------------------------------------------------------------------------
// Prompt del sistema
// -----------------------------------------------------------------------------
function promptSistema(p: Perfil): string {
  const f = ahoraMadrid();
  const alcance =
    p.rol === 'comercial'
      ? 'solo sus propios contratos y estadísticas'
      : p.rol === 'jefe_equipo'
        ? `los contratos y comerciales de su equipo${p.equipo_nombre ? ` (${p.equipo_nombre})` : ''}`
        : 'todos los contratos, equipos y comerciales';
  const verificaciones =
    p.rol === 'admin' || p.rol === 'backoffice'
      ? `\n- Calendario de verificaciones de backoffice (la llamada de verificación antes de la instalación): con la herramienta verificaciones dices qué hay hoy, mañana, esta semana o qué está atrasado, en orden de hora. Messy publica en el grupo el resultado de cada llamada de verificación (solo número de contrato y comercial) con las firmadas del mes, y manda por privado a las personas configuradas un aviso unos minutos antes de cada una, la lista del día por la mañana y el balance por la noche. Las verificaciones se marcan como hechas o se reprograman en el CRM: ${urlCalendario()}`
      : '';
  const gestion =
    p.rol === 'admin'
      ? `\n- Como es administrador/a, también puede gestionar el grupo de WhatsApp y tus avisos automáticos (grupo_whatsapp, ajustes_messy) y pedirte que publiques en el grupo (enviar_al_grupo).`
      : p.rol === 'jefe_equipo'
        ? `\n- Puede pedirte que publiques un mensaje en el grupo del equipo (enviar_al_grupo).`
        : '';

  return `Eres Messy 🤖, el asistente de inteligencia artificial de MESENERGIA (+Energía, «Nos importa tu ahorro»), un call center que vende contratos de fibra y WiFi. Hablas por WhatsApp con ${p.nombre} ${p.apellidos}, que es ${NOMBRE_ROL[p.rol]}${p.equipo_nombre ? ` del ${p.equipo_nombre}` : ''}.

Hoy es ${f.larga} (${f.hoy}) y en Madrid son las ${f.hora}. Ayer fue ${f.ayer}, la semana empezó el lunes ${f.inicioSemana} y el mes el ${f.inicioMes}.

Cómo trabajas:
- Responde en español, cercano, positivo y con energía, como un compañero que motiva. Sé breve y ve al grano: es WhatsApp.
- Formato de WhatsApp: *negrita* con UN asterisco, _cursiva_, listas con • o 1. 2. 3. Nunca uses tablas, títulos con #, ni **dobles asteriscos**. Algún emoji está bien, sin pasarse.
- Cualquier dato del CRM sale de tus herramientas: consúltalas siempre antes de dar cifras y no inventes ni estimes nada. Si no tienes el dato, dilo.
- ${p.nombre} solo puede ver ${alcance}; tus herramientas ya aplican esos permisos. Si pide algo fuera de su alcance, explícale con amabilidad que con su rol no puedes enseñárselo.
- En MESENERGIA cada contrato subido al CRM se llama «reserva de plaza»: habla siempre de reservas de plaza (o «reservas»), nunca de ventas; si alguien pregunta por «ventas», se refiere a lo mismo. Estados: 🟡 Pendiente, 🟢 Activo, 🟠 Riesgos, 🔴 Cancelado. El % de activación es activos / subidos. «Perdidos» = riesgos + cancelados.
- El equipo tiene un objetivo mensual de reservas de plaza, contando todas en conjunto (no por persona). Cuando hables de cómo va el mes, da «llevamos X/Y, quedan Z (W %)» con los datos de objetivo_mes_equipo.
- Fechas en formato humano (13/10, «ayer», «el lunes»). Importes en euros con coma decimal (39,90 €).
- Nunca muestres DNI, teléfonos, emails ni direcciones de clientes (tus herramientas no los devuelven) y no los pidas.
- No puedes crear ni modificar contratos: eso se hace en el CRM (${env.crmUrl}).${verificaciones}${gestion}
- Si te preguntan algo que no tiene que ver con el trabajo, responde breve y con simpatía y reconduce.
- Para cerrar la sesión de WhatsApp basta con escribir «salir».`;
}

// -----------------------------------------------------------------------------
// Bucle del agente
// -----------------------------------------------------------------------------
const MAX_VUELTAS = 8;

export async function responder(
  ctx: Contexto,
  historial: { rol: 'user' | 'assistant'; texto: string }[],
  pregunta: string,
): Promise<string> {
  const mensajes: MensajeClaude[] = [];
  for (const h of [...historial, { rol: 'user' as const, texto: pregunta }]) {
    const ultimo = mensajes.at(-1);
    if (ultimo && ultimo.role === h.rol && typeof ultimo.content === 'string') {
      ultimo.content = `${ultimo.content}\n\n${h.texto}`;
    } else if (mensajes.length || h.rol === 'user') {
      mensajes.push({ role: h.rol, content: h.texto });
    }
  }

  const sistema = promptSistema(ctx.perfil);
  const herramientas = herramientasPara(ctx.perfil);

  for (let vuelta = 0; vuelta < MAX_VUELTAS; vuelta++) {
    const r = await preguntar(env.modelos.chat, {
      max_tokens: 8000,
      output_config: { effort: 'low' },
      system: sistema,
      tools: herramientas,
      messages: mensajes,
    });

    if (r.stop_reason === 'refusal') {
      return 'Uy, con eso no te puedo ayudar 🙏 ¿Te echo una mano con tus reservas de plaza o contratos?';
    }

    if (r.stop_reason === 'pause_turn') {
      mensajes.push({ role: 'assistant', content: r.content });
      continue;
    }

    const usos = r.content.filter((b): b is Anthropic.Beta.Messages.BetaToolUseBlock => b.type === 'tool_use');
    if (r.stop_reason !== 'tool_use' || usos.length === 0) {
      return textoDe(r) || 'Mmm, no he sabido qué responder. ¿Me lo preguntas de otra forma? 🤔';
    }

    mensajes.push({ role: 'assistant', content: r.content });
    const resultados: Anthropic.Beta.Messages.BetaToolResultBlockParam[] = [];
    for (const uso of usos) {
      try {
        const salida = await ejecutar(uso.name, (uso.input ?? {}) as Entrada, ctx);
        resultados.push({ type: 'tool_result', tool_use_id: uso.id, content: JSON.stringify(salida) });
      } catch (e) {
        const msg = mensajeDeError(e);
        if (!(e instanceof ErrorHerramienta)) console.error(`Messy: herramienta ${uso.name}`, msg);
        const permisos = /privilege|permission|autoriz|denied/i.test(msg);
        resultados.push({
          type: 'tool_result',
          tool_use_id: uso.id,
          is_error: true,
          content: permisos ? `Sin permiso: ${msg}` : `Error: ${msg}`,
        });
      }
    }
    mensajes.push({ role: 'user', content: resultados });
  }

  return 'Me he liado con tantas consultas 😅 ¿Me lo preguntas de forma más concreta?';
}
