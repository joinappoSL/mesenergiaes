import type { EstadoContrato, ResultadoLlamada, Rol } from './types';

export interface EstadoConfig {
  valor: EstadoContrato;
  etiqueta: string;
  descripcion: string;
  /** Color para gráficos y puntos */
  color: string;
  badge: string;
  punto: string;
  columna: string;
  requiereMotivo: boolean;
}

/** Colores de estado coherentes en toda la app (badges, Kanban, gráficos). */
export const ESTADOS: Record<EstadoContrato, EstadoConfig> = {
  pendiente: {
    valor: 'pendiente',
    etiqueta: 'Pendiente',
    descripcion: 'Subido por el comercial, pendiente de tramitar',
    color: '#f2b705',
    badge: 'bg-amber-50 text-amber-800 ring-amber-200',
    punto: 'bg-amber-400',
    columna: 'bg-amber-50/60 ring-amber-200/70',
    requiereMotivo: false,
  },
  activo: {
    valor: 'activo',
    etiqueta: 'Activo',
    descripcion: 'Tramitado y activado por la operadora',
    color: '#4f9a2c',
    badge: 'bg-brand-50 text-brand-800 ring-brand-200',
    punto: 'bg-brand-500',
    columna: 'bg-brand-50/60 ring-brand-200/70',
    requiereMotivo: false,
  },
  riesgos: {
    valor: 'riesgos',
    etiqueta: 'Riesgos',
    descripcion: 'No pasa el filtro de riesgos de la operadora',
    color: '#f07a1a',
    badge: 'bg-orange-50 text-orange-800 ring-orange-200',
    punto: 'bg-orange-500',
    columna: 'bg-orange-50/60 ring-orange-200/70',
    requiereMotivo: true,
  },
  cancelado: {
    valor: 'cancelado',
    etiqueta: 'Cancelado',
    descripcion: 'Contrato cancelado',
    color: '#dc3b3b',
    badge: 'bg-red-50 text-red-700 ring-red-200',
    punto: 'bg-red-500',
    columna: 'bg-red-50/60 ring-red-200/70',
    requiereMotivo: true,
  },
};

export const LISTA_ESTADOS: EstadoContrato[] = ['pendiente', 'activo', 'riesgos', 'cancelado'];

export const ROLES: Record<Rol, { etiqueta: string; badge: string }> = {
  admin: { etiqueta: 'Admin', badge: 'bg-navy-900 text-white ring-navy-900' },
  backoffice: { etiqueta: 'Backoffice', badge: 'bg-sun-100 text-sun-700 ring-sun-200' },
  jefe_equipo: { etiqueta: 'Jefe de equipo', badge: 'bg-navy-50 text-navy-700 ring-navy-200' },
  comercial: { etiqueta: 'Comercial', badge: 'bg-brand-50 text-brand-700 ring-brand-200' },
};

export const LISTA_ROLES: Rol[] = ['admin', 'backoffice', 'jefe_equipo', 'comercial'];

export const RESULTADOS_LLAMADA: Record<ResultadoLlamada, { etiqueta: string; clase: string }> = {
  no_contesta: { etiqueta: 'No contesta', clase: 'bg-slate-100 text-slate-700 ring-slate-200' },
  contactado: { etiqueta: 'Contactado', clase: 'bg-navy-50 text-navy-700 ring-navy-200' },
  volver_a_llamar: { etiqueta: 'Volver a llamar', clase: 'bg-sun-100 text-sun-700 ring-sun-200' },
  firmado: { etiqueta: 'Firmado', clase: 'bg-brand-50 text-brand-700 ring-brand-200' },
  rechaza: { etiqueta: 'Rechaza', clase: 'bg-red-50 text-red-700 ring-red-200' },
};

export const LISTA_RESULTADOS: ResultadoLlamada[] = [
  'no_contesta',
  'contactado',
  'volver_a_llamar',
  'firmado',
  'rechaza',
];

export const TIPOS_VIA = [
  'Calle',
  'Avenida',
  'Plaza',
  'Paseo',
  'Carretera',
  'Camino',
  'Ronda',
  'Travesía',
  'Glorieta',
  'Urbanización',
  'Polígono',
  'Barrio',
  'Lugar',
  'Otro',
];

export const OPERADORES = [
  'Movistar',
  'Vodafone',
  'Orange',
  'Yoigo',
  'MásMóvil',
  'Jazztel',
  'Digi',
  'Lowi',
  'Simyo',
  'Pepephone',
  'O2',
  'Finetwork',
  'Euskaltel',
  'R',
  'Telecable',
  'Avatel',
  'Adamo',
];

export const FRANJAS = ['Mañana 9-14h', 'Tarde 15-19h', 'Todo el día'];

/** Primeros dos dígitos del código postal → provincia. */
export const PROVINCIA_POR_CP: Record<string, string> = {
  '01': 'Álava',
  '02': 'Albacete',
  '03': 'Alicante',
  '04': 'Almería',
  '05': 'Ávila',
  '06': 'Badajoz',
  '07': 'Illes Balears',
  '08': 'Barcelona',
  '09': 'Burgos',
  '10': 'Cáceres',
  '11': 'Cádiz',
  '12': 'Castellón',
  '13': 'Ciudad Real',
  '14': 'Córdoba',
  '15': 'A Coruña',
  '16': 'Cuenca',
  '17': 'Girona',
  '18': 'Granada',
  '19': 'Guadalajara',
  '20': 'Gipuzkoa',
  '21': 'Huelva',
  '22': 'Huesca',
  '23': 'Jaén',
  '24': 'León',
  '25': 'Lleida',
  '26': 'La Rioja',
  '27': 'Lugo',
  '28': 'Madrid',
  '29': 'Málaga',
  '30': 'Murcia',
  '31': 'Navarra',
  '32': 'Ourense',
  '33': 'Asturias',
  '34': 'Palencia',
  '35': 'Las Palmas',
  '36': 'Pontevedra',
  '37': 'Salamanca',
  '38': 'Santa Cruz de Tenerife',
  '39': 'Cantabria',
  '40': 'Segovia',
  '41': 'Sevilla',
  '42': 'Soria',
  '43': 'Tarragona',
  '44': 'Teruel',
  '45': 'Toledo',
  '46': 'Valencia',
  '47': 'Valladolid',
  '48': 'Bizkaia',
  '49': 'Zamora',
  '50': 'Zaragoza',
  '51': 'Ceuta',
  '52': 'Melilla',
};

export const PROVINCIAS = Object.values(PROVINCIA_POR_CP).sort((a, b) => a.localeCompare(b, 'es'));

export const PDF_MAX_BYTES = 10 * 1024 * 1024;
export const BUCKET_PDF = 'contratos-pdf';
