import type { Rol } from './types';

export const ROLES: Record<Rol, { etiqueta: string; badge: string }> = {
  admin: { etiqueta: 'Admin', badge: 'bg-navy-900 text-white ring-navy-900' },
  backoffice: { etiqueta: 'Backoffice', badge: 'bg-sun-100 text-sun-700 ring-sun-200' },
  jefe_equipo: { etiqueta: 'Jefe de equipo', badge: 'bg-navy-50 text-navy-700 ring-navy-200' },
  comercial: { etiqueta: 'Comercial', badge: 'bg-brand-50 text-brand-700 ring-brand-200' },
};

export const LISTA_ROLES: Rol[] = ['admin', 'backoffice', 'jefe_equipo', 'comercial'];
