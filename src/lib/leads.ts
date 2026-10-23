// Lógica pura de la prospección de leads: columnas del Excel, tablas de SIPS,
// maxímetro y plantillas de correo. Sin React ni Supabase para poder probarla.

export type EstadoLead =
  | 'pendiente'
  | 'no_contesta'
  | 'no_existe'
  | 'volver_a_llamar'
  | 'rechazado'
  | 'correo'
  | 'facturas'
  | 'comparativa';

export const ESTADOS_LEAD: Record<EstadoLead, { etiqueta: string; clase: string }> = {
  pendiente: { etiqueta: 'Pendiente', clase: 'bg-slate-100 text-slate-700 ring-slate-200' },
  no_contesta: { etiqueta: 'No contesta', clase: 'bg-sun-50 text-sun-700 ring-sun-200' },
  no_existe: { etiqueta: 'No existe teléfono', clase: 'bg-orange-50 text-orange-700 ring-orange-200' },
  volver_a_llamar: { etiqueta: 'Llamar más tarde', clase: 'bg-sky-50 text-sky-700 ring-sky-200' },
  rechazado: { etiqueta: 'Rechazado', clase: 'bg-red-50 text-red-700 ring-red-200' },
  correo: { etiqueta: 'Correo enviado', clase: 'bg-brand-50 text-brand-700 ring-brand-200' },
  facturas: { etiqueta: 'Facturas recibidas', clase: 'bg-sky-50 text-sky-700 ring-sky-200' },
  comparativa: { etiqueta: 'Comparativa enviada', clase: 'bg-violet-50 text-violet-700 ring-violet-200' },
};

/** Estados que cuentan como una llamada en el registro diario. */
export const ESTADOS_LLAMADA: EstadoLead[] = ['no_contesta', 'no_existe', 'volver_a_llamar', 'rechazado', 'correo'];
export const ESTADOS_SEGUIMIENTO: EstadoLead[] = ['correo', 'facturas', 'comparativa'];

export interface Lead {
  id: string;
  propietario_id: string;
  nombre: string;
  telefono: string;
  telefono2: string;
  email: string;
  kw: string;
  cups: string;
  consumo_anual: number | null;
  comercializadora: string;
  periodo_principal: number | null;
  periodo_pct: number | null;
  extra: Record<string, string>;
  estado: EstadoLead;
  llamadas: number;
  nota: string;
  correo_enviado_at: string | null;
  ultimo_movimiento_at: string;
  /** hora a la que volver a llamar (estado «Llamar más tarde») */
  proxima_llamada_at: string | null;
  maximetro: Maximetro | null;
  created_at: string;
  updated_at: string;
}

export interface LeadEvento {
  id: string;
  lead_id: string;
  usuario_id: string;
  estado: EstadoLead | null;
  texto: string;
  created_at: string;
}

export interface LeadArchivo {
  id: string;
  lead_id: string;
  tipo: 'factura' | 'comparativa' | 'otro';
  nombre: string;
  storage_path: string;
  tamano_bytes: number;
  created_at: string;
}

export type NuevoLead = Pick<
  Lead,
  'nombre' | 'telefono' | 'telefono2' | 'email' | 'kw' | 'cups' | 'comercializadora' | 'extra'
> & { consumo_anual: number | null };

// -----------------------------------------------------------------------------
// Excel de leads: detectar columnas por cabecera (da igual el orden)
// -----------------------------------------------------------------------------
export function norm(s: unknown): string {
  return String(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export type RolColumna =
  | 'nombre'
  | 'tel1'
  | 'tel2'
  | 'kw'
  | 'email'
  | 'cups'
  | 'consumo'
  | 'comer';

export const ETIQUETA_COLUMNA: Record<RolColumna, string> = {
  nombre: 'Nombre / Cliente',
  tel1: 'Teléfono 1',
  tel2: 'Teléfono 2',
  kw: 'kW (junto a Teléfono 2)',
  email: 'Email',
  cups: 'CUPS',
  consumo: 'Consumo anual',
  comer: 'Comercializadora actual',
};

const ALIAS: Record<RolColumna, string[]> = {
  nombre: ['nombre', 'cliente', 'razon social', 'titular', 'nom', 'empresa', 'contacto'],
  tel1: ['telefono 1', 'telefono', 'tel 1', 'tel', 'movil', 'telf', 'phone'],
  tel2: ['telefono 2', 'telefono dos', 'tel 2', 'telf 2', 'movil 2', 'segundo telefono', 'telefono2'],
  kw: ['kw', 'potencia', 'kw contratados', 'potencia contratada'],
  email: ['email', 'e mail', 'correo', 'correo electronico', 'mail'],
  cups: ['cups'],
  consumo: ['consumo anual', 'consumo', 'kwh anual', 'kwh'],
  comer: ['comercializadora', 'compania', 'companyia', 'actual comercializadora', 'distribuidora'],
};

export type MapaColumnas = Partial<Record<RolColumna, number>>;

export function detectarColumnas(cabeceras: string[]): MapaColumnas {
  const nh = cabeceras.map(norm);
  const usadas = new Set<number>();
  const mapa: MapaColumnas = {};
  const buscar = (rol: RolColumna, exacto: boolean) => {
    for (const a of ALIAS[rol]) {
      const i = nh.findIndex((h, j) => !usadas.has(j) && (exacto ? h === a : h.includes(a)));
      if (i >= 0) return i;
    }
    return -1;
  };
  for (const rol of ['tel2', 'kw', 'email', 'nombre', 'cups', 'consumo', 'comer', 'tel1'] as RolColumna[]) {
    let i = buscar(rol, true);
    if (i < 0) i = buscar(rol, false);
    if (i >= 0) {
      mapa[rol] = i;
      usadas.add(i);
    }
  }
  // Sin cabecera clara de kW: la columna que va justo después de Teléfono 2.
  if (mapa.kw === undefined && mapa.tel2 !== undefined) {
    const j = mapa.tel2 + 1;
    if (j < cabeceras.length && !usadas.has(j)) mapa.kw = j;
  }
  return mapa;
}

/** Primera fila con al menos 3 celdas rellenas = cabecera. */
export function separarCabecera(aoa: string[][]): { cabeceras: string[]; filas: string[][] } {
  let h = aoa.findIndex((r) => r.filter((c) => String(c).trim() !== '').length >= 3);
  if (h < 0) h = 0;
  const cabeceras = (aoa[h] ?? []).map((c, i) => String(c).trim() || `Col ${i + 1}`);
  const filas = aoa.slice(h + 1).filter((r) => r.some((c) => String(c).trim() !== ''));
  return { cabeceras, filas };
}

export function limpiarTelefono(t: string): string {
  return t.replace(/[^\d+]/g, '').replace(/^(\+34|0034)/, '');
}

export function filasALeads(cabeceras: string[], filas: string[][], mapa: MapaColumnas): NuevoLead[] {
  const usadas = new Set(Object.values(mapa));
  const get = (r: string[], rol: RolColumna) => (mapa[rol] !== undefined ? String(r[mapa[rol]!] ?? '').trim() : '');
  return filas.map((r) => {
    const extra: Record<string, string> = {};
    cabeceras.forEach((h, i) => {
      const v = String(r[i] ?? '').trim();
      if (!usadas.has(i) && v) extra[h] = v;
    });
    const consumo = parseFloat(get(r, 'consumo').replace(/\./g, '').replace(',', '.'));
    return {
      nombre: get(r, 'nombre'),
      telefono: limpiarTelefono(get(r, 'tel1')),
      telefono2: limpiarTelefono(get(r, 'tel2')),
      email: get(r, 'email'),
      kw: get(r, 'kw'),
      cups: get(r, 'cups').replace(/\s/g, '').toUpperCase(),
      consumo_anual: Number.isFinite(consumo) ? consumo : null,
      comercializadora: get(r, 'comer'),
      extra,
    };
  });
}

// -----------------------------------------------------------------------------
// Tablas de SIPS: lecturas mensuales y datos del punto de suministro
// -----------------------------------------------------------------------------
export const PERIODOS = [1, 2, 3, 4, 5, 6] as const;

export interface FilaLectura {
  ini: number;
  fin: number;
  /** kWh por periodo */
  act: number[];
  rea: number[];
  /** kW por periodo */
  max: number[];
}

export interface Maximetro {
  cups: string;
  tarifa: string;
  dist: string;
  mun: string;
  prov: string;
  cp: string;
  cnae: string;
  /** kW contratados por periodo, si venía la tabla del punto */
  contr: number[] | null;
  filas: FilaLectura[];
  /** potencia optimizada propuesta (editable) */
  opt: number[];
  nombre: string;
  nif: string;
}

function num(v: unknown): number {
  const n = parseFloat(String(v ?? '').replace(',', '.'));
  return Number.isNaN(n) ? 0 : n;
}

export function parseFecha(v: unknown): number | null {
  const s = String(v ?? '').trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return Date.UTC(+m[1], +m[2] - 1, +m[3]);
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (m) {
    const y = +m[3] < 100 ? 2000 + +m[3] : +m[3];
    return Date.UTC(y, +m[1] - 1, +m[2]);
  }
  return null;
}

export function esTablaLecturas(aoa: string[][]): boolean {
  return (aoa[0] ?? []).map((x) => String(x).trim()).includes('Fecha Lectura Inicial');
}
export function esTablaPunto(aoa: string[][]): boolean {
  const h = (aoa[0] ?? []).map((x) => String(x).trim());
  return h.includes('Tarifa') || h.includes('Codigo CUPS');
}

/** Lecturas: valores en Wh y W; se pasan a kWh y kW. Se quedan los últimos 12 meses. */
export function parseLecturas(aoa: string[][]): { cups: string; filas: FilaLectura[] } {
  const h = (aoa[0] ?? []).map((x) => String(x).trim());
  const ix = (n: string) => h.indexOf(n);
  const col = (tipo: string) => PERIODOS.map((p) => ix(`P${p} ${tipo}`));
  const A = col('Activa');
  const R = col('Reactiva');
  const M = col('Maximetro');
  const iI = ix('Fecha Lectura Inicial');
  const iF = ix('Fecha Lectura Final');
  const iC = ix('CUPS');
  let cups = '';
  const filas: FilaLectura[] = [];
  for (const r of aoa.slice(1)) {
    if (iC >= 0 && String(r[iC] ?? '').trim()) cups = String(r[iC]).trim();
    const fin = parseFecha(r[iF]);
    if (fin === null) continue;
    filas.push({
      ini: parseFecha(r[iI]) ?? fin,
      fin,
      act: A.map((i) => (i < 0 ? 0 : num(r[i]) / 1000)),
      rea: R.map((i) => (i < 0 ? 0 : num(r[i]) / 1000)),
      max: M.map((i) => (i < 0 ? 0 : num(r[i]) / 1000)),
    });
  }
  filas.sort((a, b) => a.fin - b.fin);
  return { cups, filas: filas.slice(-12) };
}

export interface PuntoSuministro {
  cups: string;
  tarifa: string;
  dist: string;
  mun: string;
  prov: string;
  cp: string;
  cnae: string;
  contr: number[] | null;
  consumoAnual: number;
}

export function parsePunto(aoa: string[][]): PuntoSuministro {
  const h = (aoa[0] ?? []).map((x) => String(x).trim());
  const r = aoa[1] ?? [];
  const g = (n: string) => {
    const i = h.indexOf(n);
    return i < 0 ? '' : String(r[i] ?? '').trim();
  };
  const contr = PERIODOS.map((p) => {
    const v = num(g(`Potencias Contratadas En W P${p}`));
    return v > 1000 ? v / 1000 : v;
  });
  return {
    cups: g('Codigo CUPS'),
    tarifa: g('Tarifa'),
    dist: g('Nombre Empresa Distribuidora'),
    mun: g('Descripcion Municipio PS'),
    prov: g('Descripcion Provincia PS'),
    cp: g('Codigo Postal PS'),
    cnae: g('CNAE'),
    contr: contr.some((x) => x) ? contr : null,
    consumoAnual: num(g('Consumo Anual')),
  };
}

/** Propuesta: máximo de los 12 meses; cada periodo no puede ser menor que el anterior (3.0TD). */
export function optimizar(filas: FilaLectura[]): number[] {
  const mx = PERIODOS.map((_, i) => Math.max(0, ...filas.map((f) => f.max[i])));
  const pos = mx.filter((x) => x > 0);
  const relleno = pos.length ? Math.min(...pos) : 0;
  const o = mx.map((x) => (x > 0 ? x : relleno));
  for (let i = 1; i < 6; i++) if (o[i] < o[i - 1]) o[i] = o[i - 1];
  return o.map((x) => Math.ceil(x * 10 - 1e-9) / 10);
}

export function construirMaximetro(
  lecturas: { cups: string; filas: FilaLectura[] } | null,
  punto: PuntoSuministro | null,
  base: Maximetro | null,
  nombre: string,
): Maximetro | null {
  const filas = lecturas?.filas ?? base?.filas;
  if (!filas?.length) return null;
  return {
    cups: lecturas?.cups || punto?.cups || base?.cups || '',
    tarifa: punto?.tarifa ?? base?.tarifa ?? '',
    dist: punto?.dist ?? base?.dist ?? '',
    mun: punto?.mun ?? base?.mun ?? '',
    prov: punto?.prov ?? base?.prov ?? '',
    cp: punto?.cp ?? base?.cp ?? '',
    cnae: punto?.cnae ?? base?.cnae ?? '',
    contr: punto?.contr ?? base?.contr ?? null,
    filas,
    opt: lecturas || !base ? optimizar(filas) : base.opt,
    nombre: base?.nombre || nombre,
    nif: base?.nif ?? '',
  };
}

export interface ResumenMaximetro {
  /** kWh por periodo en los 12 meses */
  tot: number[];
  total: number;
  /** % por periodo */
  pct: number[];
  /** máximo del maxímetro por periodo (kW) */
  maximos: number[];
  /** periodo (1-6) con más consumo */
  principal: number;
}

export function resumir(m: Pick<Maximetro, 'filas'>): ResumenMaximetro {
  const tot = PERIODOS.map((_, i) => m.filas.reduce((a, f) => a + f.act[i], 0));
  const total = tot.reduce((a, b) => a + b, 0);
  const pct = tot.map((x) => (total ? (x / total) * 100 : 0));
  const maximos = PERIODOS.map((_, i) => Math.max(0, ...m.filas.map((f) => f.max[i])));
  return { tot, total, pct, maximos, principal: pct.indexOf(Math.max(...pct)) + 1 };
}

/** Datos del lead que se derivan del maxímetro (para guardarlos y rellenar el correo). */
export function datosDeMaximetro(m: Maximetro) {
  const r = resumir(m);
  return {
    cups: m.cups,
    consumo_anual: Math.round(r.total),
    periodo_principal: r.principal,
    // "superando el X %": se redondea hacia abajo para no exagerar
    periodo_pct: Math.floor(r.pct[r.principal - 1]),
  };
}

// -----------------------------------------------------------------------------
// Correo
// -----------------------------------------------------------------------------
export type Idioma = 'ca' | 'es';
export type FormatoCorreo = 'completo' | 'directo' | 'datos' | 'express';

export const FORMATOS_CORREO: { valor: FormatoCorreo; etiqueta: string }[] = [
  { valor: 'completo', etiqueta: 'Completo' },
  { valor: 'directo', etiqueta: 'Corto' },
  { valor: 'datos', etiqueta: 'Con datos' },
  { valor: 'express', etiqueta: 'Express' },
];

export const FIRMANTES = ['Carlos Del Moral', 'Mario García', 'Gabriela Santamaría'];

export interface DatosCorreo {
  nombre: string;
  cups: string;
  consumo: string;
  /** periodo con más consumo (1-6) */
  periodo: number;
  /** % del total de ese periodo */
  pct: string;
  comercializadora: string;
  firma: string;
  presentacionUrl: string;
  tieneMaximetro: boolean;
  /** P1 y P2 equilibrados (diferencia de 8 puntos o menos) */
  equilibrado: boolean;
  /** hora local (0-23) para "buenos días / buenas tardes" */
  hora: number;
}

const saludo = (d: DatosCorreo, l: Idioma) => {
  const manana = d.hora < 14;
  return l === 'ca' ? (manana ? 'bon dia' : 'bona tarda') : manana ? 'buenos días' : 'buenas tardes';
};
const cuando = (d: DatosCorreo, l: Idioma) => {
  const manana = d.hora < 14;
  return l === 'ca' ? (manana ? 'aquest matí' : 'aquesta tarda') : manana ? 'esta mañana' : 'esta tarde';
};
const hola = (d: DatosCorreo, l: Idioma) => `Hola${d.nombre ? ' ' + d.nombre : ''} ${saludo(d, l)},`;

const ANA = {
  ca: {
    ini: 'En l’anàlisi preliminar observem que ',
    bal: 'el consum es manté relativament equilibrat entre els períodes P1 i P2, mentre que ',
    principal: (k: number, p: string, pico: boolean) =>
      `el període P${k} concentra ${pico ? 'el pic de consum més elevat' : 'el consum més elevat'}, superant el ${p} % del total.`,
    coste: ' A més, és un dels períodes amb el cost energètic més elevat dins de la seva tarifa actual.',
    p6: ' A més, és el període més econòmic de la tarifa (franja nocturna i caps de setmana), cosa que ens permet ajustar millor el contracte.',
  },
  es: {
    ini: 'En el análisis preliminar observamos que ',
    bal: 'el consumo se mantiene relativamente equilibrado entre los periodos P1 y P2, mientras que ',
    principal: (k: number, p: string, pico: boolean) =>
      `el periodo P${k} concentra ${pico ? 'el pico de consumo más elevado' : 'el consumo más elevado'}, superando el ${p} % del total.`,
    coste: ' Además, es uno de los periodos con mayor coste energético dentro de su tarifa actual.',
    p6: ' Además, es el periodo más económico de la tarifa (franja nocturna y fines de semana), lo que nos permite ajustar mejor el contrato.',
  },
};

/** Párrafo de análisis: usa el periodo con más consumo real, no siempre P3. */
export function analisis(d: DatosCorreo, l: Idioma): string {
  const t = ANA[l];
  const k = d.periodo || 3;
  const p = d.pct || '[48]';
  return (
    t.ini +
    (k >= 3 && d.equilibrado ? t.bal : '') +
    t.principal(k, p, k <= 3) +
    (k <= 3 ? t.coste : k === 6 ? t.p6 : '')
  );
}

export const ASUNTO: Record<Idioma, string> = {
  ca: 'Estudi energètic gratuït - Mes Energia',
  es: 'Estudio energético gratuito - Mes Energia',
};

const adjunto = (d: DatosCorreo, l: Idioma) =>
  l === 'ca'
    ? `${d.tieneMaximetro ? 'la presentació de Mes Energia i el maxímetre del seu subministrament' : 'la presentació de Mes Energia'} (${d.presentacionUrl})`
    : `${d.tieneMaximetro ? 'la presentación de Mes Energia y el maxímetro de su suministro' : 'la presentación de Mes Energia'} (${d.presentacionUrl})`;

const linea = (cond: unknown, texto: string) => (cond ? texto + '\n' : '');

export function construirCorreo(formato: FormatoCorreo, l: Idioma, d: DatosCorreo): string {
  const ca = l === 'ca';
  const cups = d.cups || '[CUPS]';
  const consumo = d.consumo || (ca ? '[consum]' : '[consumo]');
  const comer = d.comercializadora || (ca ? '[comercialitzadora]' : '[comercializadora]');

  if (formato === 'completo') {
    return ca
      ? `${hola(d, l)}

Tal com hem comentat en la nostra conversa telefònica d’${cuando(d, l)}, li envio les nostres dades de contacte i una breu presentació de la nostra empresa.

Trobarà adjunta la presentació de Mes Energia. També pot consultar-la i descarregar-la aquí: ${d.presentacionUrl}

En relació amb el subministrament associat al CUPS: ${cups}, hem dut a terme una primera revisió del maxímetre i de l’històric de consum corresponent a l’any 2026. Segons les dades analitzades, el consum anual supera els ${consumo} kW, mentre que actualment el subministrament disposa d’una tarifa estàndard.
Pel nivell de consum registrat, aquest tipus de subministrament sol beneficiar-se més de tarifes específiques per a grans consums, les quals permeten optimitzar tant els costos energètics com l’estructura del contracte.

Adjunto també una imatge del maxímetre per poder valorar amb més precisió els diferents paràmetres de consum.

${analisis(d, l)}

Cal recordar que el període P6 correspon al tram horari comprès entre les 20.00 h i les 08.00 h, així com als caps de setmana.

Així mateix, hem detectat que el seu contracte amb ${comer} s’ha renovat tàcitament, fet que en molts casos implica que no s’hagin actualitzat les condicions econòmiques més competitives disponibles per a l’any 2027.

A Mes Energia, la nostra tasca com a assessors energètics consisteix a analitzar cada any les condicions dels subministraments dels nostres clients, comparant diferents comercialitzadores del mercat energètic industrial per garantir l’opció més eficient i econòmica.

Per aquest motiu, ens agradaria oferir-li un estudi energètic totalment gratuït i sense cap compromís, mitjançant el qual podrem determinar amb exactitud el potencial d’estalvi real en la seva factura, que habitualment se situa entre el 15 % i el 30 % anual.

Per poder dur a terme aquesta anàlisi, únicament necessitaríem que ens facilités les dues últimes factures de llum i gas. Amb aquesta informació, podrem elaborar l’estudi i presentar-li els resultats en un termini aproximat de 24 a 48 hores.

Resto a l’espera de la seva resposta.

Rebi una cordial salutació,

${d.firma}
Mes Energia`
      : `${hola(d, l)}

Tal como hemos comentado en nuestra conversación telefónica de ${cuando(d, l)}, le envío nuestros datos de contacto y una breve presentación de nuestra empresa.

Encontrará adjunta la presentación de Mes Energia. También puede consultarla y descargarla aquí: ${d.presentacionUrl}

En relación con el suministro asociado al CUPS: ${cups}, hemos realizado una primera revisión del maxímetro y del histórico de consumo correspondiente al año 2026. Según los datos analizados, el consumo anual supera los ${consumo} kW, mientras que actualmente el suministro dispone de una tarifa estándar.
Por el nivel de consumo registrado, este tipo de suministro suele beneficiarse más de tarifas específicas para grandes consumos, que permiten optimizar tanto los costes energéticos como la estructura del contrato.

Adjunto también una imagen del maxímetro para poder valorar con más precisión los diferentes parámetros de consumo.

${analisis(d, l)}

Conviene recordar que el periodo P6 corresponde al tramo horario comprendido entre las 20.00 h y las 08.00 h, así como a los fines de semana.

Asimismo, hemos detectado que su contrato con ${comer} se ha renovado tácitamente, lo que en muchos casos implica que no se hayan actualizado las condiciones económicas más competitivas disponibles para el año 2027.

En Mes Energia, nuestra labor como asesores energéticos consiste en analizar cada año las condiciones de los suministros de nuestros clientes, comparando distintas comercializadoras del mercado energético industrial para garantizar la opción más eficiente y económica.

Por este motivo, nos gustaría ofrecerle un estudio energético totalmente gratuito y sin ningún compromiso, mediante el cual podremos determinar con exactitud el potencial de ahorro real en su factura, que habitualmente se sitúa entre el 15 % y el 30 % anual.

Para poder llevar a cabo este análisis, únicamente necesitaríamos que nos facilitase las dos últimas facturas de luz y gas. Con esta información, podremos elaborar el estudio y presentarle los resultados en un plazo aproximado de 24 a 48 horas.

Quedo a la espera de su respuesta.

Reciba un cordial saludo,

${d.firma}
Mes Energia`;
  }

  if (formato === 'directo') {
    return ca
      ? `${hola(d, l)}

Gràcies per atendre'ns per telèfon. Hem revisat el subministrament${d.cups ? ` amb CUPS ${d.cups}` : ''}: el consum anual supera els ${consumo} kWh i, amb una tarifa estàndard, hi ha marge per optimitzar-lo amb tarifes específiques per a grans consums.

Li oferim un estudi energètic gratuït i sense compromís (estalvi habitual: 15-30 % anual). Només necessitem les dues últimes factures de llum i gas i en 24-48 h li presentem els resultats.

Adjunto ${adjunto(d, l)}.

Rebi una cordial salutació,
${d.firma}
Mes Energia`
      : `${hola(d, l)}

Gracias por atendernos por teléfono. Hemos revisado el suministro${d.cups ? ` con CUPS ${d.cups}` : ''}: el consumo anual supera los ${consumo} kWh y, con una tarifa estándar, hay margen para optimizarlo con tarifas específicas para grandes consumos.

Le ofrecemos un estudio energético gratuito y sin compromiso (ahorro habitual: 15-30 % anual). Solo necesitamos las dos últimas facturas de luz y gas y en 24-48 h le presentamos los resultados.

Adjunto ${adjunto(d, l)}.

Reciba un cordial saludo,
${d.firma}
Mes Energia`;
  }

  if (formato === 'datos') {
    return ca
      ? `${hola(d, l)}

Gràcies per la conversa. Resum del que hem vist del seu subministrament${d.cups ? ` (CUPS ${d.cups})` : ''}:

${linea(d.consumo, `• Consum anual: ${d.consumo} kWh`)}${linea(d.pct, `• Període amb més consum: P${d.periodo} (${d.pct} % del total)`)}${linea(d.comercializadora, `• Contracte amb ${d.comercializadora}, renovat tàcitament`)}• Estalvi habitual amb el nostre estudi: 15-30 % anual

L'estudi és gratuït i sense compromís: només necessitem les dues últimes factures de llum i gas. Resultats en 24-48 h.

Adjunto ${adjunto(d, l)}.

Una salutació,
${d.firma}
Mes Energia`
      : `${hola(d, l)}

Gracias por la conversación. Resumen de lo que hemos visto de su suministro${d.cups ? ` (CUPS ${d.cups})` : ''}:

${linea(d.consumo, `• Consumo anual: ${d.consumo} kWh`)}${linea(d.pct, `• Periodo con más consumo: P${d.periodo} (${d.pct} % del total)`)}${linea(d.comercializadora, `• Contrato con ${d.comercializadora}, renovado tácitamente`)}• Ahorro habitual con nuestro estudio: 15-30 % anual

El estudio es gratuito y sin compromiso: solo necesitamos las dos últimas facturas de luz y gas. Resultados en 24-48 h.

Adjunto ${adjunto(d, l)}.

Un saludo,
${d.firma}
Mes Energia`;
  }

  return ca
    ? `${hola(d, l)}

Seguint la nostra trucada: li oferim un estudi energètic gratuït i sense compromís${d.cups ? ` del subministrament ${d.cups}` : ''}, amb un estalvi habitual del 15-30 % anual.

Només necessitem les dues últimes factures de llum i gas; en 24-48 h té els resultats. Adjunto ${adjunto(d, l)}.

Gràcies i salutacions,
${d.firma} · Mes Energia`
    : `${hola(d, l)}

Siguiendo nuestra llamada: le ofrecemos un estudio energético gratuito y sin compromiso${d.cups ? ` del suministro ${d.cups}` : ''}, con un ahorro habitual del 15-30 % anual.

Solo necesitamos las dos últimas facturas de luz y gas; en 24-48 h tiene los resultados. Adjunto ${adjunto(d, l)}.

Gracias y un saludo,
${d.firma} · Mes Energia`;
}

// -----------------------------------------------------------------------------
// Registro diario
// -----------------------------------------------------------------------------
export interface ResumenDia {
  dia: string;
  llamadas: number;
  no_contesta: number;
  no_existe: number;
  volver_a_llamar: number;
  rechazado: number;
  correo: number;
  facturas: number;
  comparativa: number;
}

export function resumenPorDia(eventos: { estado: EstadoLead | null; created_at: string }[]): ResumenDia[] {
  const mapa = new Map<string, ResumenDia>();
  for (const e of eventos) {
    if (!e.estado || e.estado === 'pendiente') continue;
    const d = new Date(e.created_at);
    const dia = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const r = mapa.get(dia) ?? { dia, llamadas: 0, no_contesta: 0, no_existe: 0, volver_a_llamar: 0, rechazado: 0, correo: 0, facturas: 0, comparativa: 0 };
    r[e.estado]++;
    if (ESTADOS_LLAMADA.includes(e.estado)) r.llamadas++;
    mapa.set(dia, r);
  }
  return [...mapa.values()].sort((a, b) => b.dia.localeCompare(a.dia));
}

// -----------------------------------------------------------------------------
// Llamar más tarde
// -----------------------------------------------------------------------------
/** Llamada programada cuya hora ya ha llegado. */
export function llamadaVencida(l: Pick<Lead, 'estado' | 'proxima_llamada_at'>, ahora = Date.now()): boolean {
  return l.estado === 'volver_a_llamar' && !!l.proxima_llamada_at && new Date(l.proxima_llamada_at).getTime() <= ahora;
}

/** Cola de «Pendientes»: primero las llamadas programadas que ya tocan (la más antigua primero), luego los pendientes. */
export function colaPendientes<T extends Pick<Lead, 'estado' | 'proxima_llamada_at'>>(leads: T[], ahora = Date.now()): T[] {
  const vencidas = leads
    .filter((l) => llamadaVencida(l, ahora))
    .sort((a, b) => new Date(a.proxima_llamada_at!).getTime() - new Date(b.proxima_llamada_at!).getTime());
  return [...vencidas, ...leads.filter((l) => l.estado === 'pendiente')];
}

/** Llamadas programadas, por orden de hora. */
export function colaProgramadas<T extends Pick<Lead, 'estado' | 'proxima_llamada_at'>>(leads: T[]): T[] {
  return leads
    .filter((l) => l.estado === 'volver_a_llamar')
    .sort((a, b) => new Date(a.proxima_llamada_at ?? 0).getTime() - new Date(b.proxima_llamada_at ?? 0).getTime());
}

/** "hoy 17:30", "mañana 10:00" o "24/10 10:00". */
export function textoHoraLlamada(iso: string, ahora = new Date()): string {
  const d = new Date(iso);
  const hh = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  const dia = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const dif = Math.round((dia(d) - dia(ahora)) / 864e5);
  if (dif === 0) return `hoy a las ${hh}`;
  if (dif === 1) return `mañana a las ${hh}`;
  if (dif === -1) return `ayer a las ${hh}`;
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} a las ${hh}`;
}
