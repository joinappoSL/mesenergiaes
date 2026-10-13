import { useMutation, useQueryClient } from '@tanstack/react-query';
import { BUCKET_PDF, PDF_MAX_BYTES } from '@/lib/constants';
import { invocarFuncion, supabase } from '@/lib/supabase';
import type { EstadoContrato, ResultadoLlamada, Rol, TipoTelefono } from '@/lib/types';
import { slugArchivo } from '@/lib/utils';
import { qk } from './datos';

/** Refresca todo lo que depende de un contrato (listados, dashboard, cola y su ficha). */
function useRefrescarContrato() {
  const qc = useQueryClient();
  return (id?: string) => {
    qc.invalidateQueries({ queryKey: qk.contratos });
    qc.invalidateQueries({ queryKey: qk.dashboard });
    qc.invalidateQueries({ queryKey: qk.cola });
    if (id) qc.invalidateQueries({ queryKey: qk.contrato(id) });
  };
}

export function validarPdf(file: File): string | null {
  const esPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  if (!esPdf) return 'Solo se admiten archivos PDF.';
  if (file.size > PDF_MAX_BYTES) return 'El PDF supera el tamaño máximo de 10 MB.';
  return null;
}

export async function subirPdf(contratoId: string, file: File): Promise<void> {
  const problema = validarPdf(file);
  if (problema) throw new Error(problema);
  const path = `${contratoId}/${Date.now()}-${slugArchivo(file.name)}`;
  const { error } = await supabase.storage
    .from(BUCKET_PDF)
    .upload(path, file, { contentType: 'application/pdf', upsert: false, cacheControl: '3600' });
  if (error) throw error;
  const { error: errDoc } = await supabase.from('documentos').insert({
    contrato_id: contratoId,
    storage_path: path,
    nombre_archivo: file.name,
    tamano_bytes: file.size,
  });
  if (errDoc) throw errDoc;
}

// -----------------------------------------------------------------------------
// Contratos
// -----------------------------------------------------------------------------
export interface DatosContrato {
  cliente_nombre: string;
  cliente_apellidos: string;
  documento_tipo: 'DNI' | 'NIE';
  documento_numero: string;
  cliente_email: string | null;
  via_tipo: string;
  via_nombre: string;
  via_numero: string;
  escalera: string | null;
  piso: string | null;
  puerta: string | null;
  codigo_postal: string;
  poblacion: string;
  provincia: string;
  telefono_fijo: string | null;
  telefono_contacto: string;
  operadora: string;
  producto: string | null;
  precio_mensual: number | null;
  oferta_detalle: string | null;
  instalacion_fecha: string | null;
  instalacion_franja: string | null;
  iban: string | null;
  verificacion_at: string | null;
}

export interface TelefonoNuevo {
  numero: string;
  tipo: TipoTelefono;
  operador_donante: string | null;
}

interface GuardarContratoInput {
  id?: string;
  datos: DatosContrato;
  telefonos: TelefonoNuevo[];
  observacion?: string;
  pdf?: File | null;
}

/**
 * Plan B mientras la función `guardar_contrato` no esté creada en la base de
 * datos: los mismos pasos directamente sobre las tablas. Se aplican las mismas
 * políticas RLS y triggers, aunque sin una única transacción.
 */
async function guardarSinRpc(
  id: string | undefined,
  datos: DatosContrato,
  telefonos: TelefonoNuevo[],
  observacion: string | null,
): Promise<string> {
  let contratoId: string;
  if (!id) {
    const { data, error } = await supabase.from('contratos').insert(datos).select('id').single();
    if (error) throw error;
    contratoId = data.id as string;
  } else {
    const { data, error } = await supabase.from('contratos').update(datos).eq('id', id).select('id');
    if (error) throw error;
    if (!data?.length) {
      throw new Error('No puedes editar este contrato: solo se puede modificar mientras esté Pendiente y sin firmar');
    }
    contratoId = id;
    const { error: errBorrar } = await supabase.from('telefonos_portabilidad').delete().eq('contrato_id', id);
    if (errBorrar) throw errBorrar;
  }

  const filas = telefonos
    .filter((t) => t.numero.trim())
    .map((t, i) => ({
      contrato_id: contratoId,
      numero: t.numero,
      tipo: t.tipo || 'movil',
      operador_donante: t.operador_donante,
      orden: i + 1,
    }));
  if (filas.length) {
    const { error } = await supabase.from('telefonos_portabilidad').insert(filas);
    if (error) throw error;
  }

  if (!id && observacion) {
    const { data: sesion } = await supabase.auth.getSession();
    const { error } = await supabase
      .from('observaciones')
      .insert({ contrato_id: contratoId, autor_id: sesion.session?.user.id, texto: observacion });
    if (error) throw error;
  }
  return contratoId;
}

export function useGuardarContrato() {
  const refrescar = useRefrescarContrato();
  return useMutation({
    mutationFn: async ({ id, datos, telefonos, observacion, pdf }: GuardarContratoInput) => {
      const obs = observacion?.trim() || null;
      const { data, error } = await supabase.rpc('guardar_contrato', {
        p_id: id ?? null,
        p_datos: datos,
        p_telefonos: telefonos,
        p_observacion: obs,
      });
      // PGRST202: la función todavía no existe en la base de datos
      if (error && error.code !== 'PGRST202') throw error;
      const contratoId = error ? await guardarSinRpc(id, datos, telefonos, obs) : (data as string);
      let errorPdf: unknown = null;
      if (pdf) {
        try {
          await subirPdf(contratoId, pdf);
        } catch (e) {
          errorPdf = e;
        }
      }
      return { id: contratoId, errorPdf };
    },
    onSuccess: ({ id }) => refrescar(id),
  });
}

async function actualizarContrato(id: string, cambios: Record<string, unknown>) {
  const { data, error } = await supabase.from('contratos').update(cambios).eq('id', id).select('id');
  if (error) throw error;
  if (!data?.length) throw new Error('No tienes permiso para modificar este contrato.');
}

/** Solo admin (política RLS contratos_delete). Se borra con todo lo que cuelga de él. */
export function useEliminarContrato() {
  const refrescar = useRefrescarContrato();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.from('contratos').delete().eq('id', id).select('id');
      if (error) throw error;
      if (!data?.length) throw new Error('No tienes permiso para eliminar este contrato.');
    },
    onSuccess: (_d, id) => {
      qc.removeQueries({ queryKey: qk.contrato(id) });
      refrescar();
    },
  });
}

export function useCambiarEstado() {
  const refrescar = useRefrescarContrato();
  return useMutation({
    mutationFn: ({ id, estado, motivo }: { id: string; estado: EstadoContrato; motivo: string }) =>
      actualizarContrato(id, { estado, motivo_estado: motivo.trim() || null }),
    onSuccess: (_d, v) => refrescar(v.id),
  });
}

export function useMarcarFirma() {
  const refrescar = useRefrescarContrato();
  return useMutation({
    mutationFn: ({ id, firmado }: { id: string; firmado: boolean }) => actualizarContrato(id, { firmado }),
    onSuccess: (_d, v) => refrescar(v.id),
  });
}

export function useReasignar() {
  const refrescar = useRefrescarContrato();
  return useMutation({
    mutationFn: ({ id, comercialId }: { id: string; comercialId: string }) =>
      actualizarContrato(id, { comercial_id: comercialId }),
    onSuccess: (_d, v) => refrescar(v.id),
  });
}

export function useSubirPdf() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ contratoId, file }: { contratoId: string; file: File }) => subirPdf(contratoId, file),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: qk.documentos(v.contratoId) });
      qc.invalidateQueries({ queryKey: qk.contrato(v.contratoId) });
    },
  });
}

export function useAnadirObservacion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ contratoId, texto }: { contratoId: string; texto: string }) => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('observaciones')
        .insert({ contrato_id: contratoId, texto: texto.trim(), autor_id: u.user?.id });
      if (error) throw error;
    },
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: qk.observaciones(v.contratoId) }),
  });
}

export function useRegistrarLlamada() {
  const refrescar = useRefrescarContrato();
  return useMutation({
    mutationFn: async (v: {
      contratoId: string;
      resultado: ResultadoLlamada;
      nota: string;
      volverALlamarAt: string | null;
    }) => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from('llamadas').insert({
        contrato_id: v.contratoId,
        resultado: v.resultado,
        nota: v.nota.trim() || null,
        volver_a_llamar_at: v.resultado === 'volver_a_llamar' ? v.volverALlamarAt : null,
        usuario_id: u.user?.id,
      });
      if (error) throw error;
    },
    onSuccess: (_d, v) => refrescar(v.contratoId),
  });
}

// -----------------------------------------------------------------------------
// Usuarios (Edge Function admin-users) y equipos
// -----------------------------------------------------------------------------
export interface DatosUsuario {
  nombre: string;
  apellidos: string;
  email: string;
  telefono: string | null;
  rol: Rol;
  equipo_id: string | null;
}

export function useCrearUsuario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: DatosUsuario & { password: string }) =>
      invocarFuncion<{ id: string }>('admin-users', { accion: 'crear', ...v }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.perfiles });
      qc.invalidateQueries({ queryKey: qk.equipos });
    },
  });
}

export function useEditarUsuario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: DatosUsuario & { id: string }) =>
      invocarFuncion<{ id: string }>('admin-users', { accion: 'editar', ...v }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.perfiles });
      qc.invalidateQueries({ queryKey: qk.equipos });
      qc.invalidateQueries({ queryKey: ['perfil'] });
    },
  });
}

export function useActivarUsuario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; activo: boolean }) => invocarFuncion('admin-users', { accion: 'activar', ...v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.perfiles }),
  });
}

export function useResetPassword() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; password: string }) =>
      invocarFuncion('admin-users', { accion: 'reset_password', ...v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.perfiles }),
  });
}

/**
 * Solo admin y solo equipos vacíos: el equipo de un contrato se deriva de su
 * comercial, así que borrar un equipo con contratos o miembros los dejaría
 * apuntando a un equipo que ya no existe.
 */
export function useEliminarEquipo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const [miembros, contratos] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('equipo_id', id),
        supabase.from('contratos').select('id', { count: 'exact', head: true }).eq('equipo_id', id),
      ]);
      if (miembros.error) throw miembros.error;
      if (contratos.error) throw contratos.error;
      if (miembros.count || contratos.count) {
        throw new Error(
          `Este equipo todavía tiene ${miembros.count ?? 0} usuario(s) y ${contratos.count ?? 0} contrato(s). ` +
            'Pasa antes a sus comerciales a otro equipo; solo se pueden eliminar equipos vacíos.',
        );
      }
      const { data, error } = await supabase.from('equipos').delete().eq('id', id).select('id');
      if (error) throw error;
      if (!data?.length) throw new Error('No tienes permiso para eliminar este equipo.');
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.equipos });
      qc.invalidateQueries({ queryKey: qk.perfiles });
      qc.invalidateQueries({ queryKey: qk.contratos });
      qc.invalidateQueries({ queryKey: qk.dashboard });
    },
  });
}

export function useGuardarEquipo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, nombre, jefeId }: { id?: string; nombre: string; jefeId: string | null }) => {
      const fila = { nombre: nombre.trim(), jefe_id: jefeId };
      const { error } = id
        ? await supabase.from('equipos').update(fila).eq('id', id)
        : await supabase.from('equipos').insert(fila);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.equipos });
      qc.invalidateQueries({ queryKey: qk.perfiles });
    },
  });
}
