import { useMutation, useQueryClient } from '@tanstack/react-query';
import { invocarFuncion, supabase } from '@/lib/supabase';
import type { Rol } from '@/lib/types';
import { qk } from './datos';

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

/** Solo admin y solo equipos vacíos (sin usuarios). */
export function useEliminarEquipo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const miembros = await supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('equipo_id', id);
      if (miembros.error) throw miembros.error;
      if (miembros.count) {
        throw new Error(
          `Este equipo todavía tiene ${miembros.count} usuario(s). Pasa antes a sus comerciales a otro equipo; solo se pueden eliminar equipos vacíos.`,
        );
      }
      const { data, error } = await supabase.from('equipos').delete().eq('id', id).select('id');
      if (error) throw error;
      if (!data?.length) throw new Error('No tienes permiso para eliminar este equipo.');
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.equipos });
      qc.invalidateQueries({ queryKey: qk.perfiles });
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
