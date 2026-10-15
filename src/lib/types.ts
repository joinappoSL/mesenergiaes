export type Rol = 'admin' | 'backoffice' | 'jefe_equipo' | 'comercial';
export type EstadoContrato = 'pendiente' | 'activo' | 'riesgos' | 'cancelado';
export type TipoDocumento = 'DNI' | 'NIE';
export type TipoTelefono = 'fijo' | 'movil';
export type ResultadoLlamada = 'no_contesta' | 'contactado' | 'volver_a_llamar' | 'firmado' | 'rechaza';

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

/** Fila de la vista v_contratos (contratos + datos de presentación). */
export interface Contrato {
  id: string;
  numero: number;
  cliente_nombre: string;
  cliente_apellidos: string;
  documento_tipo: TipoDocumento;
  documento_numero: string;
  cliente_email: string | null;
  via_tipo: string;
  via_nombre: string;
  via_numero: string;
  escalera: string | null;
  piso: string | null;
  puerta: string | null;
  codigo_postal: string;
  poblacion: string;
  provincia: string;
  telefono_fijo: string | null;
  telefono_contacto: string;
  operadora: string;
  producto: string | null;
  precio_mensual: number | null;
  oferta_detalle: string | null;
  instalacion_fecha: string | null;
  instalacion_franja: string | null;
  comercial_id: string | null;
  equipo_id: string | null;
  estado: EstadoContrato;
  motivo_estado: string | null;
  firmado: boolean;
  fecha_firma: string | null;
  ultima_llamada_at: string | null;
  ultimo_resultado_llamada: ResultadoLlamada | null;
  proxima_llamada_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  comercial_nombre: string | null;
  equipo_nombre: string | null;
  num_documentos: number;
  portabilidad_resumen: string | null;
  iban: string | null;
  /** fecha y hora de la llamada de verificación (antes de la instalación) */
  verificacion_at: string | null;
  /** cuándo hizo backoffice la llamada de verificación (null = pendiente) */
  verificacion_hecha_at: string | null;
  verificacion_hecha_por_nombre: string | null;
}

export interface TelefonoPortabilidad {
  id: string;
  contrato_id: string;
  numero: string;
  tipo: TipoTelefono;
  operador_donante: string | null;
  orden: number;
}

export interface Documento {
  id: string;
  contrato_id: string;
  storage_path: string;
  nombre_archivo: string;
  tamano_bytes: number | null;
  version: number;
  subido_por: string | null;
  subido_por_nombre: string | null;
  created_at: string;
}

export interface Observacion {
  id: string;
  contrato_id: string;
  autor_id: string | null;
  autor_nombre: string | null;
  autor_rol: Rol | null;
  texto: string;
  sistema: boolean;
  created_at: string;
}

export interface HistorialEstado {
  id: string;
  contrato_id: string;
  estado_anterior: EstadoContrato | null;
  estado_nuevo: EstadoContrato;
  motivo: string | null;
  usuario_id: string | null;
  usuario_nombre: string | null;
  created_at: string;
}

export interface Llamada {
  id: string;
  contrato_id: string;
  resultado: ResultadoLlamada;
  nota: string | null;
  volver_a_llamar_at: string | null;
  usuario_id: string | null;
  usuario_nombre: string | null;
  created_at: string;
}

export interface Duplicado {
  id: string | null;
  numero: number;
  coincidencia: string;
  estado: EstadoContrato;
  firmado: boolean;
  comercial_nombre: string;
  created_at: string;
}

export interface DashboardKpis {
  total: number;
  pendiente: number;
  activo: number;
  riesgos: number;
  cancelado: number;
  firmados: number;
  pendientes_sin_firmar: number;
  facturacion_activa: number;
}

export interface DashboardDia {
  fecha: string;
  total: number;
  pendiente: number;
  activo: number;
  riesgos: number;
  cancelado: number;
}

export interface DashboardRanking {
  comercial_id: string | null;
  nombre: string;
  equipo: string | null;
  subidos: number;
  activos: number;
  pendientes: number;
  perdidos: number;
  ratio: number | null;
}

export interface DashboardCita {
  id: string;
  numero: number;
  cliente: string;
  poblacion: string;
  fecha: string;
  franja: string | null;
  estado: EstadoContrato;
  firmado: boolean;
  comercial: string | null;
}

export interface DashboardData {
  desde: string;
  hasta: string;
  kpis: DashboardKpis;
  por_dia: DashboardDia[];
  ranking: DashboardRanking[];
  citas: DashboardCita[];
}
