import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { BUCKET_PDF } from '@/lib/constants';
import { supabase } from '@/lib/supabase';
import type {
  Contrato,
  DashboardData,
  Documento,
  Duplicado,
  Equipo,
  EstadoContrato,
  HistorialEstado,
  Llamada,
  Observacion,
  Perfil,
  TelefonoPortabilidad,
} from '@/lib/types';

// -----------------------------------------------------------------------------
// Claves de caché (jerárquicas: invalidar ['contrato', id] refresca toda la ficha)
// -----------------------------------------------------------------------------
export const qk = {
  contratos: ['contratos'] as const,
  contrato: (id: string) => ['contrato', id] as const,
  telefonos: (id: string) => ['contrato', id, 'telefonos'] as const,
  documentos: (id: string) => ['contrato', id, 'documentos'] as const,
  observaciones: (id: string) => ['contrato', id, 'observaciones'] as const,
  historial: (id: string) => ['contrato', id, 'historial'] as const,
  llamadas: (id: string) => ['contrato', id, 'llamadas'] as const,
  dashboard: ['dashboard'] as const,
  cola: ['cola'] as const,
  perfiles: ['perfiles'] as const,
  equipos: ['equipos'] as const,
};

// -----------------------------------------------------------------------------
// Filtros del listado de contratos
// -----------------------------------------------------------------------------
export interface FiltrosContratos {
  q: string;
  estados: EstadoContrato[];
  firmado: '' | 'si' | 'no';
  comercialId: string;
  equipoId: string;
  desde: string;
  hasta: string;
}

export const FILTROS_VACIOS: FiltrosContratos = {
  q: '',
  estados: [],
  firmado: '',
  comercialId: '',
  equipoId: '',
  desde: '',
  hasta: '',
};

export interface Orden {
  campo: keyof Contrato;
  asc: boolean;
}

/** Parámetros del RPC buscar_contratos (se envían en el cuerpo POST, nunca en la URL). */
function argsBusqueda(f: FiltrosContratos) {
  const args: Record<string, unknown> = {};
  if (f.q.trim()) args.p_q = f.q.trim();
  if (f.estados.length) args.p_estados = f.estados;
  if (f.firmado) args.p_firmado = f.firmado === 'si';
  if (f.comercialId) args.p_comercial_id = f.comercialId;
  if (f.equipoId) args.p_equipo_id = f.equipoId;
  if (f.desde) args.p_desde = f.desde;
  if (f.hasta) args.p_hasta = f.hasta;
  return args;
}

export function useContratosLista(filtros: FiltrosContratos, pagina: number, tamano: number, orden: Orden) {
  return useQuery({
    queryKey: [...qk.contratos, 'lista', filtros, pagina, tamano, orden],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const desde = pagina * tamano;
      const { data, error, count } = await supabase
        .rpc('buscar_contratos', argsBusqueda(filtros), { count: 'exact' })
        .order(orden.campo, { ascending: orden.asc, nullsFirst: false })
        .order('numero', { ascending: false })
        .range(desde, desde + tamano - 1);
      if (error) throw error;
      return { filas: (data ?? []) as Contrato[], total: count ?? 0 };
    },
  });
}

export const LIMITE_KANBAN = 400;

export function useContratosKanban(filtros: FiltrosContratos, activo: boolean) {
  return useQuery({
    queryKey: [...qk.contratos, 'kanban', filtros],
    enabled: activo,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const { data, error, count } = await supabase
        .rpc('buscar_contratos', argsBusqueda(filtros), { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(0, LIMITE_KANBAN - 1);
      if (error) throw error;
      return { filas: (data ?? []) as Contrato[], total: count ?? 0 };
    },
  });
}

/** Descarga todos los contratos filtrados en bloques de 1000 (límite de la API). */
export async function obtenerTodosLosContratos(filtros: FiltrosContratos): Promise<Contrato[]> {
  const bloque = 1000;
  const todos: Contrato[] = [];
  for (let desde = 0; ; desde += bloque) {
    const { data, error } = await supabase
      .rpc('buscar_contratos', argsBusqueda(filtros))
      .order('created_at', { ascending: false })
      .order('numero', { ascending: false })
      .range(desde, desde + bloque - 1);
    if (error) throw error;
    const filas = (data ?? []) as Contrato[];
    todos.push(...filas);
    if (filas.length < bloque || todos.length >= 50_000) break;
  }
  return todos;
}

// -----------------------------------------------------------------------------
// Ficha del contrato
// -----------------------------------------------------------------------------
export function useContrato(id: string | undefined) {
  return useQuery({
    queryKey: qk.contrato(id ?? ''),
    enabled: Boolean(id),
    queryFn: async () => {
      const { data, error } = await supabase.from('v_contratos').select('*').eq('id', id!).maybeSingle();
      if (error) throw error;
      return data as Contrato | null;
    },
  });
}

export function useTelefonosPortabilidad(id: string | undefined) {
  return useQuery({
    queryKey: qk.telefonos(id ?? ''),
    enabled: Boolean(id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('telefonos_portabilidad')
        .select('*')
        .eq('contrato_id', id!)
        .order('orden')
        .order('created_at');
      if (error) throw error;
      return (data ?? []) as TelefonoPortabilidad[];
    },
  });
}

export function useDocumentos(id: string | undefined) {
  return useQuery({
    queryKey: qk.documentos(id ?? ''),
    enabled: Boolean(id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('documentos')
        .select('*')
        .eq('contrato_id', id!)
        .order('version', { ascending: false });
      if (error) throw error;
      return (data ?? []) as Documento[];
    },
  });
}

export function useObservaciones(id: string | undefined) {
  return useQuery({
    queryKey: qk.observaciones(id ?? ''),
    enabled: Boolean(id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('observaciones')
        .select('*')
        .eq('contrato_id', id!)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as Observacion[];
    },
  });
}

export function useHistorial(id: string | undefined) {
  return useQuery({
    queryKey: qk.historial(id ?? ''),
    enabled: Boolean(id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('historial_estados')
        .select('*')
        .eq('contrato_id', id!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as HistorialEstado[];
    },
  });
}

export function useLlamadas(id: string | undefined) {
  return useQuery({
    queryKey: qk.llamadas(id ?? ''),
    enabled: Boolean(id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('llamadas')
        .select('*')
        .eq('contrato_id', id!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as Llamada[];
    },
  });
}

/** URL firmada temporal (1 h) para ver o descargar un PDF del bucket privado. */
export function useUrlFirmada(path: string | undefined, descargarComo?: string) {
  return useQuery({
    queryKey: ['pdf-url', path, descargarComo ?? ''],
    enabled: Boolean(path),
    staleTime: 50 * 60 * 1000,
    gcTime: 55 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.storage
        .from(BUCKET_PDF)
        .createSignedUrl(path!, 3600, descargarComo ? { download: descargarComo } : undefined);
      if (error) throw error;
      return data.signedUrl;
    },
  });
}

export async function comprobarDuplicados(documento: string | null, telefono: string | null, excluirId?: string) {
  const { data, error } = await supabase.rpc('comprobar_duplicados', {
    p_documento: documento,
    p_telefono: telefono,
    p_excluir_id: excluirId ?? null,
  });
  if (error) throw error;
  return (data ?? []) as Duplicado[];
}

// -----------------------------------------------------------------------------
// Dashboard y cola
// -----------------------------------------------------------------------------
export interface ParamsDashboard {
  desde: string;
  hasta: string;
  equipoId: string;
  comercialId: string;
}

export function useDashboard(p: ParamsDashboard) {
  return useQuery({
    queryKey: [...qk.dashboard, p],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('dashboard', {
        p_desde: p.desde || null,
        p_hasta: p.hasta || null,
        p_equipo_id: p.equipoId || null,
        p_comercial_id: p.comercialId || null,
      });
      if (error) throw error;
      return data as DashboardData;
    },
  });
}

export function useCola(soloSinFirmar: boolean, activo = true) {
  return useQuery({
    queryKey: [...qk.cola, soloSinFirmar],
    enabled: activo,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('cola_backoffice', { p_solo_sin_firmar: soloSinFirmar });
      if (error) throw error;
      return (data ?? []) as Contrato[];
    },
  });
}

// -----------------------------------------------------------------------------
// Usuarios y equipos (RLS: cada rol ve lo que le corresponde)
// -----------------------------------------------------------------------------
export function usePerfiles() {
  return useQuery({
    queryKey: qk.perfiles,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('*').order('nombre').order('apellidos');
      if (error) throw error;
      return (data ?? []) as Perfil[];
    },
  });
}

export function useEquipos() {
  return useQuery({
    queryKey: qk.equipos,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from('equipos').select('*').order('nombre');
      if (error) throw error;
      return (data ?? []) as Equipo[];
    },
  });
}
