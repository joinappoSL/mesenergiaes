import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { Equipo, Perfil } from '@/lib/types';

// Claves de caché
export const qk = {
  perfiles: ['perfiles'] as const,
  equipos: ['equipos'] as const,
};

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
