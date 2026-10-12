import { useEffect, useState } from 'react';

/**
 * Estado que sobrevive a la navegación dentro de la pestaña (sessionStorage).
 * Se usa para filtros: nunca se guardan en la URL porque pueden contener DNI o teléfonos.
 */
export function useEstadoPersistente<T>(clave: string, inicial: T, almacen: 'session' | 'local' = 'session') {
  const storage = () => (almacen === 'session' ? window.sessionStorage : window.localStorage);
  const [valor, setValor] = useState<T>(() => {
    try {
      const guardado = storage().getItem(clave);
      return guardado ? { ...inicial, ...JSON.parse(guardado) } : inicial;
    } catch {
      return inicial;
    }
  });

  useEffect(() => {
    try {
      storage().setItem(clave, JSON.stringify(valor));
    } catch {
      // almacenamiento no disponible (modo privado): no pasa nada
    }
  }, [clave, valor]);

  return [valor, setValor] as const;
}
