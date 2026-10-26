export type Rol = 'admin' | 'backoffice' | 'jefe_equipo' | 'comercial';

export interface Perfil {
  id: string;
  nombre: string;
  apellidos: string;
  email: string;
  telefono: string | null;
  rol: Rol;
  equipo_id: string | null;
  activo: boolean;
  debe_cambiar_password: boolean;
  created_at: string;
  updated_at: string;
}

export interface Equipo {
  id: string;
  nombre: string;
  jefe_id: string | null;
  created_at: string;
}
