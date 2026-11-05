import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { Residencial, SuministroResidencial } from '@/lib/residenciales';

const CLAVE = ['residenciales'] as const;

export function useResidenciales(activo = true) {
  return useQuery({
    queryKey: CLAVE,
    enabled: activo,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.from('residenciales').select('*').order('firmado_at', { ascending: false }).order('created_at', { ascending: false }).limit(5000);
      if (error) throw error;
      return (data ?? []) as Residencial[];
    },
  });
}

export interface DatosResidencial {
  nombre: string;
  telefono: string;
  email: string;
  cups: string;
  suministro: SuministroResidencial;
  comercializadora: string;
  firmado_at: string;
  notas: string;
}

export function useGuardarResidencial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, propietarioId, datos }: { id?: string; propietarioId?: string; datos: DatosResidencial }) => {
      if (id) {
        const { error } = await supabase.from('residenciales').update(datos).eq('id', id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('residenciales').insert({ ...datos, ...(propietarioId ? { propietario_id: propietarioId } : {}) });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: CLAVE }),
  });
}

export function useBorrarResidencial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('residenciales').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: CLAVE }),
  });
}
