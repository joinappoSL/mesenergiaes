import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { AppoLead, NuevoAppoLead } from '@/lib/appo';

const CLAVE = ['appo_leads'] as const;

export function useAppoLeads() {
  return useQuery({
    queryKey: CLAVE,
    staleTime: 30_000,
    queryFn: async () => {
      const todos: AppoLead[] = [];
      // por páginas de 1000 (límite de Supabase)
      for (let desde = 0; ; desde += 1000) {
        const { data, error } = await supabase.from('appo_leads').select('*').order('updated_at', { ascending: false }).range(desde, desde + 999);
        if (error) throw error;
        todos.push(...((data ?? []) as AppoLead[]));
        if (!data || data.length < 1000) break;
      }
      return todos;
    },
  });
}

export type CambiosAppoLead = Partial<Omit<AppoLead, 'id' | 'created_at' | 'updated_at'>>;

export function useGuardarAppoLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, datos }: { id?: string; datos: CambiosAppoLead }) => {
      if (id) {
        const { error } = await supabase.from('appo_leads').update(datos).eq('id', id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('appo_leads').insert(datos);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: CLAVE }),
  });
}

export function useImportarAppoLeads() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ leads, propietarioId }: { leads: NuevoAppoLead[]; propietarioId?: string }) => {
      for (let i = 0; i < leads.length; i += 500) {
        const lote = leads.slice(i, i + 500).map((l) => ({ ...l, ...(propietarioId ? { propietario_id: propietarioId } : {}) }));
        const { error } = await supabase.from('appo_leads').insert(lote);
        if (error) throw error;
      }
      return leads.length;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: CLAVE }),
  });
}

export function useBorrarAppoLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('appo_leads').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: CLAVE }),
  });
}
