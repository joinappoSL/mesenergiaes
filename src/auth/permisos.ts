import type { Contrato, Perfil, Rol } from '@/lib/types';
import { usePerfil } from './AuthProvider';

export interface Permisos {
  rol: Rol;
  esAdmin: boolean;
  esBackoffice: boolean;
  esJefe: boolean;
  esComercial: boolean;
  /** admin o backoffice: ven y gestionan todo */
  esGestor: boolean;
  puedeCrearContrato: boolean;
  puedeCambiarEstado: boolean;
  puedeMarcarFirma: boolean;
  puedeRegistrarLlamadas: boolean;
  puedeReasignar: boolean;
  /** solo admin: borra el contrato con sus teléfonos, PDF, observaciones e historial */
  puedeEliminarContrato: boolean;
  puedeVerCola: boolean;
  /** calendario de verificaciones: marcar hechas y reprogramar */
  puedeVerVerificaciones: boolean;
  puedeVerUsuarios: boolean;
  puedeGestionarEquipos: boolean;
  puedeArrastrarKanban: boolean;
  /** el dashboard completo con filtros por equipo/comercial y ranking */
  dashboardCompleto: boolean;
  rolesCreables: Rol[];
  puedeEditarContrato: (c: Pick<Contrato, 'comercial_id' | 'estado' | 'firmado'>) => boolean;
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
    puedeCrearContrato: esGestor || esComercial,
    puedeCambiarEstado: esGestor,
    puedeMarcarFirma: esGestor,
    puedeRegistrarLlamadas: esGestor,
    puedeReasignar: esGestor,
    puedeEliminarContrato: esAdmin,
    puedeVerCola: esGestor,
    puedeVerVerificaciones: esGestor,
    puedeVerUsuarios: esGestor || esJefe,
    puedeGestionarEquipos: esAdmin,
    puedeArrastrarKanban: esGestor,
    dashboardCompleto: !esComercial,
    rolesCreables: esAdmin ? ['admin', 'backoffice', 'jefe_equipo', 'comercial'] : esGestor || esJefe ? ['comercial'] : [],
    puedeEditarContrato: (c) =>
      esGestor || (esComercial && c.comercial_id === perfil.id && c.estado === 'pendiente' && !c.firmado),
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
