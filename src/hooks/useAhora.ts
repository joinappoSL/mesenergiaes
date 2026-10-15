import { addDays, startOfDay } from 'date-fns';
import { useEffect, useMemo, useState } from 'react';

/** Hora actual que se refresca sola (y al volver a la pestaña). */
export function useAhora(cadaMs = 15_000): Date {
  const [ahora, setAhora] = useState(() => new Date());
  useEffect(() => {
    const tic = () => setAhora(new Date());
    const id = window.setInterval(tic, cadaMs);
    const alVolver = () => {
      if (document.visibilityState === 'visible') tic();
    };
    document.addEventListener('visibilitychange', alVolver);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', alVolver);
    };
  }, [cadaMs]);
  return ahora;
}

/** Inicio y fin del día de hoy (hora local); cambia solo a medianoche. */
export function useHoy(): { inicio: Date; fin: Date } {
  const [dia, setDia] = useState(() => startOfDay(new Date()).getTime());
  useEffect(() => {
    const comprobar = () => setDia(startOfDay(new Date()).getTime());
    const hastaMedianoche = addDays(new Date(dia), 1).getTime() - Date.now() + 1000;
    const t = window.setTimeout(comprobar, Math.max(1000, hastaMedianoche));
    document.addEventListener('visibilitychange', comprobar);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener('visibilitychange', comprobar);
    };
  }, [dia]);
  return useMemo(() => ({ inicio: new Date(dia), fin: addDays(new Date(dia), 1) }), [dia]);
}
