import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { qk } from './datos';

type FilaConContrato = { id?: string; contrato_id?: string };

/**
 * Suscripción a cambios en tiempo real (Supabase Realtime respeta RLS):
 * cuando alguien cambia un contrato, los listados, el dashboard y la ficha
 * se refrescan solos para todos los usuarios que pueden verlo.
 */
export function useRealtime(userId: string | undefined) {
  const qc = useQueryClient();
  const [conectado, setConectado] = useState(false);
  const pendiente = useRef<number | null>(null);

  useEffect(() => {
    if (!userId) return;

    // Agrupa ráfagas de eventos en un solo refresco.
    const refrescarListados = () => {
      if (pendiente.current) window.clearTimeout(pendiente.current);
      pendiente.current = window.setTimeout(() => {
        qc.invalidateQueries({ queryKey: qk.contratos });
        qc.invalidateQueries({ queryKey: qk.dashboard });
        qc.invalidateQueries({ queryKey: qk.cola });
      }, 400);
    };

    const canal = supabase
      .channel(`crm-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contratos' }, (p) => {
        const fila = (p.new && Object.keys(p.new).length ? p.new : p.old) as FilaConContrato;
        refrescarListados();
        if (fila?.id) qc.invalidateQueries({ queryKey: qk.contrato(fila.id), exact: true });
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'observaciones' }, (p) => {
        const fila = p.new as FilaConContrato;
        if (fila.contrato_id) qc.invalidateQueries({ queryKey: qk.observaciones(fila.contrato_id) });
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'llamadas' }, (p) => {
        const fila = p.new as FilaConContrato;
        if (fila.contrato_id) qc.invalidateQueries({ queryKey: qk.llamadas(fila.contrato_id) });
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'historial_estados' }, (p) => {
        const fila = p.new as FilaConContrato;
        if (fila.contrato_id) qc.invalidateQueries({ queryKey: qk.historial(fila.contrato_id) });
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'documentos' }, (p) => {
        const fila = p.new as FilaConContrato;
        if (fila.contrato_id) qc.invalidateQueries({ queryKey: qk.documentos(fila.contrato_id) });
      })
      .subscribe((estado) => setConectado(estado === 'SUBSCRIBED'));

    return () => {
      if (pendiente.current) window.clearTimeout(pendiente.current);
      supabase.removeChannel(canal);
      setConectado(false);
    };
  }, [qc, userId]);

  return conectado;
}
