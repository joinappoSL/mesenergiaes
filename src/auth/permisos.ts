import type { Perfil, Rol } from '@/lib/types';
import { usePerfil } from './AuthProvider';

export interface Permisos {
  rol: Rol;
  esAdmin: boolean;
  esBackoffice: boolean;
  esJefe: boolean;
  esComercial: boolean;
  /** admin o backoffice: ven y gestionan todas las carteras */
  esGestor: boolean;
  puedeVerUsuarios: boolean;
  puedeGestionarEquipos: boolean;
  rolesCreables: Rol[];
  puedeGestionarUsuario: (u: Pick<Perfil, 'id' | 'rol' | 'equipo_id'>) => boolean;
}

export function calcularPermisos(perfil: Perfil): Permisos {
  const rol = perfil.rol;
  const esAdmin = rol === 'admin';
  const esBackoffice = rol === 'backoffice';
  const esJefe = rol === 'jefe_equipo';
  const esComercial = rol === 'comercial';
  const esGestor = esAdmin || esBackoffice;

  return {
    rol,
    esAdmin,
    esBackoffice,
    esJefe,
    esComercial,
    esGestor,
    puedeVerUsuarios: esGestor || esJefe,
    puedeGestionarEquipos: esAdmin,
    rolesCreables: esAdmin ? ['admin', 'backoffice', 'jefe_equipo', 'comercial'] : esGestor || esJefe ? ['comercial'] : [],
    puedeGestionarUsuario: (u) => {
      if (esAdmin) return true;
      if (esBackoffice) return u.rol === 'comercial';
      if (esJefe) return u.rol === 'comercial' && u.equipo_id !== null && u.equipo_id === perfil.equipo_id;
      return false;
    },
  };
}

export function usePermisos(): Permisos {
  return calcularPermisos(usePerfil());
}
