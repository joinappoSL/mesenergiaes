import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import {
  datosDeMaximetro,
  ESTADOS_LLAMADA,
  type EstadoLead,
  type Lead,
  type LeadArchivo,
  type LeadEvento,
  type Maximetro,
  type NuevoLead,
} from '@/lib/leads';

export const BUCKET_LEADS = 'leads-archivos';
export const LEADS_ARCHIVO_MAX = 15 * 1024 * 1024;

export const qkLeads = {
  lista: ['leads'] as const,
  eventos: (id: string) => ['leads', id, 'eventos'] as const,
  archivos: (id: string) => ['leads', id, 'archivos'] as const,
  registro: ['leads', 'registro'] as const,
};

const PAGINA = 1000;

/** Todos los leads que el usuario puede ver (RLS), paginando de 1.000 en 1.000. */
export function useLeads() {
  return useQuery({
    queryKey: qkLeads.lista,
    staleTime: 30_000,
    queryFn: async () => {
      const todos: Lead[] = [];
      for (let desde = 0; ; desde += PAGINA) {
        const { data, error } = await supabase
          .from('leads')
          .select('*')
          .order('created_at', { ascending: true })
          .order('id', { ascending: true })
          .range(desde, desde + PAGINA - 1);
        if (error) throw error;
        todos.push(...((data ?? []) as Lead[]));
        if (!data || data.length < PAGINA) break;
      }
      return todos;
    },
  });
}

export function useEventosLead(id: string | null) {
  return useQuery({
    queryKey: qkLeads.eventos(id ?? ''),
    enabled: Boolean(id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leads_eventos')
        .select('*')
        .eq('lead_id', id!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as LeadEvento[];
    },
  });
}

export function useArchivosLead(id: string | null) {
  return useQuery({
    queryKey: qkLeads.archivos(id ?? ''),
    enabled: Boolean(id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leads_archivos')
        .select('*')
        .eq('lead_id', id!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as LeadArchivo[];
    },
  });
}

export interface EventoRegistro {
  lead_id: string;
  usuario_id: string;
  estado: EstadoLead;
  created_at: string;
}

/** Cambios de estado de los últimos 120 días para el registro diario. */
export function useRegistroLeads() {
  return useQuery({
    queryKey: qkLeads.registro,
    staleTime: 30_000,
    queryFn: async () => {
      const desde = new Date(Date.now() - 120 * 864e5).toISOString();
      const { data, error } = await supabase
        .from('leads_eventos')
        .select('lead_id, usuario_id, estado, created_at')
        .not('estado', 'is', null)
        .gte('created_at', desde)
        .order('created_at', { ascending: false })
        .limit(10000);
      if (error) throw error;
      return (data ?? []) as EventoRegistro[];
    },
  });
}

function useRefrescarLeads() {
  const qc = useQueryClient();
  return (id?: string) => {
    qc.invalidateQueries({ queryKey: qkLeads.lista });
    qc.invalidateQueries({ queryKey: qkLeads.registro });
    if (id) {
      qc.invalidateQueries({ queryKey: qkLeads.eventos(id) });
      qc.invalidateQueries({ queryKey: qkLeads.archivos(id) });
    }
  };
}

async function registrarEvento(leadId: string, estado: EstadoLead | null, texto: string) {
  const { error } = await supabase.from('leads_eventos').insert({ lead_id: leadId, estado, texto });
  if (error) throw error;
}

// -----------------------------------------------------------------------------
// Importar
// -----------------------------------------------------------------------------
export interface ResultadoImportacion {
  nuevos: number;
  repetidos: number;
}

async function insertarTrozo(filas: Record<string, unknown>[]): Promise<number> {
  const { error } = await supabase.from('leads').insert(filas);
  if (!error) return filas.length;
  if (error.code !== '23505') throw error;
  // Algún teléfono ya existía (carrera con otro usuario): se insertan de uno en uno.
  let ok = 0;
  for (const f of filas) {
    const { error: e1 } = await supabase.from('leads').insert(f);
    if (!e1) ok++;
    else if (e1.code !== '23505') throw e1;
  }
  return ok;
}

export function useImportarLeads() {
  const refrescar = useRefrescarLeads();
  return useMutation({
    mutationFn: async ({ propietarioId, leads }: { propietarioId: string; leads: NuevoLead[] }): Promise<ResultadoImportacion> => {
      // Teléfonos que esa persona ya tiene, para no duplicar.
      const existentes = new Set<string>();
      for (let desde = 0; ; desde += PAGINA) {
        const { data, error } = await supabase
          .from('leads')
          .select('telefono')
          .eq('propietario_id', propietarioId)
          .neq('telefono', '')
          .range(desde, desde + PAGINA - 1);
        if (error) throw error;
        (data ?? []).forEach((r) => existentes.add(r.telefono as string));
        if (!data || data.length < PAGINA) break;
      }
      const filas: Record<string, unknown>[] = [];
      let repetidos = 0;
      for (const l of leads) {
        if (!l.nombre && !l.telefono && !l.telefono2 && !l.cups) continue;
        if (l.telefono) {
          if (existentes.has(l.telefono)) {
            repetidos++;
            continue;
          }
          existentes.add(l.telefono);
        }
        filas.push({ ...l, propietario_id: propietarioId });
      }
      let nuevos = 0;
      for (let i = 0; i < filas.length; i += 500) nuevos += await insertarTrozo(filas.slice(i, i + 500));
      return { nuevos, repetidos };
    },
    onSuccess: () => refrescar(),
  });
}

// -----------------------------------------------------------------------------
// Estado, notas y datos
// -----------------------------------------------------------------------------
export function useCambiarEstadoLead() {
  const refrescar = useRefrescarLeads();
  return useMutation({
    mutationFn: async ({
      lead,
      estado,
      texto,
      proxima,
      extra,
    }: {
      lead: Lead;
      estado: EstadoLead;
      texto?: string;
      proxima?: string | null;
      /** otros campos que se guardan a la vez (ficha de cliente) */
      extra?: Partial<Omit<Lead, 'id'>>;
    }) => {
      const ahora = new Date().toISOString();
      // La hora de «volver a llamar» solo vale mientras el lead esté en ese estado.
      const patch: Record<string, unknown> = {
        estado,
        ultimo_movimiento_at: ahora,
        proxima_llamada_at: estado === 'volver_a_llamar' ? (proxima ?? null) : null,
      };
      if (ESTADOS_LLAMADA.includes(estado)) patch.llamadas = lead.llamadas + 1;
      if (estado === 'correo') patch.correo_enviado_at = ahora;
      // Cada paso del proceso guarda su fecha (editable en la ficha) para las estadísticas.
      if (estado === 'facturas') patch.facturas_recibidas_at = lead.facturas_recibidas_at ?? ahora;
      if (estado === 'comparativa') patch.comparativa_enviada_at = lead.comparativa_enviada_at ?? ahora;
      if (estado === 'firmado') patch.firmado_at = lead.firmado_at ?? ahora;
      Object.assign(patch, extra ?? {});
      const { error } = await supabase.from('leads').update(patch).eq('id', lead.id);
      if (error) throw error;
      await registrarEvento(lead.id, estado, texto ?? '');
    },
    onSuccess: (_d, v) => refrescar(v.lead.id),
  });
}

export function useActualizarLead() {
  const refrescar = useRefrescarLeads();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Omit<Lead, 'id'>> }) => {
      const { error } = await supabase.from('leads').update(patch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => refrescar(v.id),
  });
}

export function useNotaHistorial() {
  const refrescar = useRefrescarLeads();
  return useMutation({
    mutationFn: async ({ leadId, texto }: { leadId: string; texto: string }) => {
      await registrarEvento(leadId, null, texto);
      await supabase.from('leads').update({ ultimo_movimiento_at: new Date().toISOString() }).eq('id', leadId);
    },
    onSuccess: (_d, v) => refrescar(v.leadId),
  });
}

export function useEliminarLead() {
  const refrescar = useRefrescarLeads();
  return useMutation({
    mutationFn: async (lead: Lead) => {
      const { data: archivos } = await supabase.from('leads_archivos').select('storage_path').eq('lead_id', lead.id);
      const rutas = (archivos ?? []).map((a) => a.storage_path as string);
      if (rutas.length) await supabase.storage.from(BUCKET_LEADS).remove(rutas);
      const { error } = await supabase.from('leads').delete().eq('id', lead.id);
      if (error) throw error;
    },
    onSuccess: () => refrescar(),
  });
}

// -----------------------------------------------------------------------------
// Maxímetro
// -----------------------------------------------------------------------------
export function useGuardarMaximetro() {
  const refrescar = useRefrescarLeads();
  return useMutation({
    mutationFn: async ({ id, maximetro }: { id: string; maximetro: Maximetro }) => {
      const d = datosDeMaximetro(maximetro);
      const patch: Record<string, unknown> = {
        maximetro,
        consumo_anual: d.consumo_anual,
        periodo_principal: d.periodo_principal,
        periodo_pct: d.periodo_pct,
      };
      if (d.cups) patch.cups = d.cups;
      const { error } = await supabase.from('leads').update(patch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => refrescar(v.id),
  });
}

// -----------------------------------------------------------------------------
// Archivos (facturas y comparativas)
// -----------------------------------------------------------------------------
function nombreSeguro(nombre: string): string {
  const punto = nombre.lastIndexOf('.');
  const base = punto > 0 ? nombre.slice(0, punto) : nombre;
  const ext = punto > 0 ? nombre.slice(punto).toLowerCase().replace(/[^.a-z0-9]/g, '') : '';
  const limpio = base
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
  return `${limpio || 'archivo'}${ext}`;
}

export function useSubirArchivosLead() {
  const refrescar = useRefrescarLeads();
  return useMutation({
    mutationFn: async ({ lead, archivos, tipo }: { lead: Lead; archivos: File[]; tipo: 'factura' | 'comparativa' }) => {
      for (const f of archivos) {
        if (f.size > LEADS_ARCHIVO_MAX) throw new Error(`${f.name} supera el máximo de 15 MB.`);
      }
      for (const f of archivos) {
        const path = `${lead.id}/${Date.now()}-${nombreSeguro(f.name)}`;
        const { error } = await supabase.storage
          .from(BUCKET_LEADS)
          .upload(path, f, { contentType: f.type || undefined, upsert: false, cacheControl: '3600' });
        if (error) throw error;
        const { error: e2 } = await supabase.from('leads_archivos').insert({
          lead_id: lead.id,
          tipo,
          nombre: f.name,
          storage_path: path,
          tamano_bytes: f.size,
        });
        if (e2) throw e2;
      }
      const nombres = archivos.map((f) => f.name).join(', ');
      if (tipo === 'factura' && lead.estado === 'correo') {
        const ahora = new Date().toISOString();
        const { error } = await supabase
          .from('leads')
          .update({ estado: 'facturas', ultimo_movimiento_at: ahora, facturas_recibidas_at: lead.facturas_recibidas_at ?? ahora })
          .eq('id', lead.id);
        if (error) throw error;
        await registrarEvento(lead.id, 'facturas', `Facturas recibidas y adjuntadas: ${nombres}`);
      } else {
        await registrarEvento(lead.id, null, `${tipo === 'factura' ? 'Facturas adjuntadas' : 'Comparativa adjuntada'}: ${nombres}`);
        await supabase.from('leads').update({ ultimo_movimiento_at: new Date().toISOString() }).eq('id', lead.id);
      }
    },
    onSuccess: (_d, v) => refrescar(v.lead.id),
  });
}

export function useBorrarArchivoLead() {
  const refrescar = useRefrescarLeads();
  return useMutation({
    mutationFn: async (a: LeadArchivo) => {
      const { error } = await supabase.from('leads_archivos').delete().eq('id', a.id);
      if (error) throw error;
      await supabase.storage.from(BUCKET_LEADS).remove([a.storage_path]);
    },
    onSuccess: (_d, a) => refrescar(a.lead_id),
  });
}

export async function descargarArchivoLead(a: LeadArchivo): Promise<Blob> {
  const { data, error } = await supabase.storage.from(BUCKET_LEADS).download(a.storage_path);
  if (error || !data) throw error ?? new Error('No se pudo descargar el archivo');
  return data;
}

// -----------------------------------------------------------------------------
// Añadir un cliente a mano (aunque no venga de ningún listado)
// -----------------------------------------------------------------------------
export interface NuevoCliente extends NuevoLead {
  estado: EstadoLead;
  nota: string;
  correo_enviado_at: string | null;
  facturas_recibidas_at: string | null;
  comparativa_enviada_at: string | null;
  visita_at: string | null;
  visita_lugar: string;
  visita_notas: string;
  firmado_at: string | null;
}

export function useCrearCliente() {
  const refrescar = useRefrescarLeads();
  return useMutation({
    mutationFn: async ({ propietarioId, cliente }: { propietarioId: string; cliente: NuevoCliente }) => {
      const { data, error } = await supabase
        .from('leads')
        .insert({
          ...cliente,
          propietario_id: propietarioId,
          ultimo_movimiento_at: new Date().toISOString(),
        })
        .select('id')
        .single();
      if (error) throw error;
      const id = data.id as string;
      // El historial y el registro diario recogen cada paso con su fecha real.
      const pasos: { estado: EstadoLead; fecha: string | null; texto: string }[] = [
        { estado: 'correo', fecha: cliente.correo_enviado_at, texto: 'Correo enviado (cliente cargado a mano)' },
        { estado: 'facturas', fecha: cliente.facturas_recibidas_at, texto: 'Facturas recibidas (cliente cargado a mano)' },
        { estado: 'comparativa', fecha: cliente.comparativa_enviada_at, texto: 'Comparativa enviada (cliente cargado a mano)' },
        { estado: 'firmado', fecha: cliente.firmado_at, texto: 'Cliente firmado (cliente cargado a mano)' },
      ];
      const eventos = pasos
        .filter((p) => p.fecha)
        .map((p) => ({ lead_id: id, estado: p.estado, texto: p.texto, created_at: p.fecha }));
      if (cliente.visita_at) {
        eventos.push({
          lead_id: id,
          estado: 'visita',
          texto: `Visita programada: ${new Date(cliente.visita_at).toLocaleString('es-ES')}`,
          created_at: new Date().toISOString(),
        });
      }
      if (!eventos.length) {
        eventos.push({ lead_id: id, estado: cliente.estado, texto: 'Cliente cargado a mano', created_at: new Date().toISOString() });
      }
      const { error: e2 } = await supabase.from('leads_eventos').insert(eventos);
      if (e2) throw e2;
      return id;
    },
    onSuccess: () => refrescar(),
  });
}
