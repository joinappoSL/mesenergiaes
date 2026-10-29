import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { Actividad, TipoActividad } from '@/lib/actividad';

export const qkActividad = ['actividad_equipo'] as const;
const PAGINA = 1000;

/** Todos los registros que el usuario puede ver (RLS), de 1.000 en 1.000. */
export function useActividad() {
  return useQuery({
    queryKey: qkActividad,
    staleTime: 30_000,
    queryFn: async () => {
      const todos: Actividad[] = [];
      for (let desde = 0; ; desde += PAGINA) {
        const { data, error } = await supabase
          .from('actividad_equipo')
          .select('*')
          .order('ocurrio_at', { ascending: false })
          .order('id', { ascending: true })
          .range(desde, desde + PAGINA - 1);
        if (error) throw error;
        todos.push(...((data ?? []) as Actividad[]));
        if (!data || data.length < PAGINA) break;
      }
      return todos;
    },
  });
}

export interface NuevaActividad {
  ocurrio_at: string;
  persona_id: string | null;
  autor: string;
  tipo: TipoActividad;
  empresa: string;
  contacto: string;
  detalle: string;
  cantidad: number;
}

export function useCrearActividad() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (a: NuevaActividad) => {
      const { error } = await supabase.from('actividad_equipo').insert({ ...a, fuente: 'manual' });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: qkActividad }),
  });
}

export function useBorrarActividad() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('actividad_equipo').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: qkActividad }),
  });
}
