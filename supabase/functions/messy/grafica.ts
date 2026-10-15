// Gráfica del mes para el grupo (imagen PNG con la imagen de MESENERGIA):
// reservas de plaza por día, el acumulado («bola de nieve»), el ritmo para
// llegar al objetivo y la proyección a fin de mes. Se dibuja en SVG y se pasa
// a PNG con resvg (WASM). Sin datos de clientes.
import { initWasm, Resvg } from 'npm:@resvg/resvg-wasm@2.6.2';
import { env } from './entorno.ts';

export interface DiaMes {
  dia: string; // AAAA-MM-DD
  reservas: number;
  firmadas: number;
}

export interface DatosGrafica {
  hoy: string; // AAAA-MM-DD (Madrid)
  hora: string; // HH:MM (Madrid)
  dias: DiaMes[]; // todos los días del mes
  objetivo: number;
  llevamos: number; // incluye el ajuste (reservas fuera del CRM)
  ajuste: number;
  quedan: number;
  pctHecho: number;
  firmadasMes: number;
  horaPunta: number | null;
}

// -----------------------------------------------------------------------------
// Recursos (se descargan una vez por instancia)
// -----------------------------------------------------------------------------
const WASM_URLS = (
  Deno.env.get('MESSY_RESVG_WASM_URL') ??
    'https://cdn.jsdelivr.net/npm/@resvg/resvg-wasm@2.6.2/index_bg.wasm,https://unpkg.com/@resvg/resvg-wasm@2.6.2/index_bg.wasm'
).split(',');
const FUENTES_URL = Deno.env.get('MESSY_FUENTES_URL') ?? 'https://raw.githubusercontent.com/google/fonts/main/ofl/poppins/';
const LOGO_URL = Deno.env.get('MESSY_LOGO_URL') ?? `${env.crmUrl.replace(/\/?$/, '/')}logo-dark.png`;
const PESOS = ['Regular', 'Medium', 'SemiBold', 'Bold', 'ExtraBold'];

async function descargar(url: string): Promise<Uint8Array> {
  const r = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  if (!r.ok) throw new Error(`No se ha podido descargar ${url} (${r.status})`);
  return new Uint8Array(await r.arrayBuffer());
}

let preparado: Promise<{ fuentes: Uint8Array[]; logo: string | null }> | null = null;

function preparar() {
  preparado ??= (async () => {
    let wasm: Uint8Array | null = null;
    for (const url of WASM_URLS) {
      try {
        wasm = await descargar(url.trim());
        break;
      } catch (e) {
        console.warn('Messy: resvg', e instanceof Error ? e.message : e);
      }
    }
    if (!wasm) throw new Error('No se ha podido cargar el motor de la gráfica');
    await initWasm(wasm);
    const fuentes = await Promise.all(PESOS.map((p) => descargar(`${FUENTES_URL}Poppins-${p}.ttf`)));
    let logo: string | null = null;
    try {
      const png = await descargar(LOGO_URL);
      logo = `data:image/png;base64,${base64(png)}`;
    } catch (e) {
      console.warn('Messy: sin logo en la gráfica', e instanceof Error ? e.message : e);
    }
    return { fuentes, logo };
  })().catch((e) => {
    preparado = null; // se reintenta la próxima vez
    throw e;
  });
  return preparado;
}

function base64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

// -----------------------------------------------------------------------------
// Colores de la marca (los del CRM)
// -----------------------------------------------------------------------------
const C = {
  navy950: '#0b1a3a',
  navy900: '#0f1e43',
  navy800: '#142652',
  navy700: '#1b3263',
  navy500: '#36538f',
  navy400: '#5571ab',
  navy300: '#8299c7',
  navy200: '#b4c3e0',
  brand300: '#a0cf76',
  brand400: '#82bd4f',
  brand500: '#6ca83c',
  brand600: '#568a2e',
  sun200: '#fde28a',
  sun300: '#fbd04d',
  sun400: '#f5c030',
  sun500: '#e8a817',
  blanco: '#ffffff',
};

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const DIAS_SEMANA = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'];
const INICIAL = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];

const esc = (t: string | number) =>
  String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const n1 = (v: number) => Math.round(v * 10) / 10;

function txt(
  x: number,
  y: number,
  texto: string | number,
  o: { size: number; weight?: number; color?: string; anchor?: 'start' | 'middle' | 'end'; spacing?: number; opacity?: number },
) {
  return (
    `<text x="${n1(x)}" y="${n1(y)}" font-family="Poppins" font-size="${o.size}" font-weight="${o.weight ?? 400}" ` +
    `fill="${o.color ?? C.blanco}" text-anchor="${o.anchor ?? 'start'}"` +
    (o.spacing ? ` letter-spacing="${o.spacing}"` : '') +
    (o.opacity !== undefined ? ` fill-opacity="${o.opacity}"` : '') +
    `>${esc(texto)}</text>`
  );
}

/** Escala «bonita» para el eje: 10, 20, 25, 50, 100… */
function techo(v: number): { max: number; paso: number } {
  const objetivo = Math.max(v, 5);
  for (const paso of [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000]) {
    const max = Math.ceil(objetivo / paso) * paso;
    if (max / paso <= 6) return { max, paso };
  }
  return { max: Math.ceil(objetivo / 1000) * 1000, paso: 1000 };
}

/** Curva suave que pasa por los puntos (sin pasarse de los valores: monótona). */
function curva(puntos: [number, number][]): string {
  if (!puntos.length) return '';
  if (puntos.length === 1) return `M${n1(puntos[0][0])},${n1(puntos[0][1])}`;
  let d = `M${n1(puntos[0][0])},${n1(puntos[0][1])}`;
  for (let i = 1; i < puntos.length; i++) {
    const [x0, y0] = puntos[i - 1];
    const [x1, y1] = puntos[i];
    const cx = (x0 + x1) / 2;
    d += ` C${n1(cx)},${n1(y0)} ${n1(cx)},${n1(y1)} ${n1(x1)},${n1(y1)}`;
  }
  return d;
}

// -----------------------------------------------------------------------------
// SVG
// -----------------------------------------------------------------------------
export function svgMes(d: DatosGrafica, logo: string | null = null): string {
  const W = 1080;
  const H = 1350;
  const [anio, mes, diaHoy] = d.hoy.split('-').map(Number);
  const fechaHoy = new Date(Date.UTC(anio, mes - 1, diaHoy, 12));
  const nombreMes = MESES[mes - 1];
  const nDias = d.dias.length;
  const indiceHoy = d.dias.findIndex((x) => x.dia === d.hoy);
  const transcurridos = indiceHoy + 1;

  // Acumulado (bola de nieve): empieza con las reservas de fuera del CRM
  const acumulado: number[] = [];
  let suma = d.ajuste;
  d.dias.forEach((x, i) => {
    suma += x.reservas;
    if (i <= indiceHoy) acumulado.push(suma);
  });
  const proyeccion = transcurridos > 0 ? Math.round((d.llevamos / transcurridos) * nDias) : d.llevamos;
  const maxDia = Math.max(...d.dias.map((x) => x.reservas), 1);

  // Zona del gráfico: arriba el acumulado, abajo las barras de cada día
  const x0 = 118;
  const x1 = 1000;
  const yTop = 626;
  const yAcumBase = 862;
  const alto = yAcumBase - yTop;
  const yBarrasTop = 918;
  const yBase = 1012;
  const altoBarras = yBase - yBarrasTop;
  const slot = (x1 - x0) / nDias;
  const anchoBarra = Math.min(22, slot * 0.62);
  const escala = techo(Math.max(d.objetivo, proyeccion, d.llevamos) * 1.04);
  const yAcum = (v: number) => yAcumBase - (v / escala.max) * alto;
  const escalaBarras = maxDia;
  const cx = (i: number) => x0 + slot * i + slot / 2;

  const s: string[] = [];
  s.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`);
  s.push(`<defs>
    <radialGradient id="brilloVerde" cx="0.92" cy="0.04" r="0.55"><stop offset="0" stop-color="${C.brand500}" stop-opacity="0.38"/><stop offset="1" stop-color="${C.brand500}" stop-opacity="0"/></radialGradient>
    <radialGradient id="brilloSol" cx="0.02" cy="0.98" r="0.55"><stop offset="0" stop-color="${C.sun400}" stop-opacity="0.22"/><stop offset="1" stop-color="${C.sun400}" stop-opacity="0"/></radialGradient>
    <linearGradient id="barra" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.brand300}"/><stop offset="1" stop-color="${C.brand600}"/></linearGradient>
    <linearGradient id="barraHoy" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.sun200}"/><stop offset="1" stop-color="${C.sun500}"/></linearGradient>
    <linearGradient id="area" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.blanco}" stop-opacity="0.26"/><stop offset="1" stop-color="${C.blanco}" stop-opacity="0"/></linearGradient>
    <linearGradient id="progreso" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${C.brand500}"/><stop offset="1" stop-color="${C.sun400}"/></linearGradient>
  </defs>`);

  // Fondo
  s.push(`<rect width="${W}" height="${H}" fill="${C.navy950}"/>`);
  s.push(`<rect width="${W}" height="${H}" fill="url(#brilloVerde)"/>`);
  s.push(`<rect width="${W}" height="${H}" fill="url(#brilloSol)"/>`);

  // Cabecera
  if (logo) s.push(`<image href="${logo}" x="52" y="44" width="262" height="107"/>`);
  else s.push(txt(60, 118, '+Energía', { size: 54, weight: 800 }));
  s.push(txt(1020, 82, 'HORA DE COMER', { size: 18, weight: 600, color: C.sun400, anchor: 'end', spacing: 4 }));
  s.push(`<rect x="742" y="98" width="278" height="52" rx="26" fill="${C.blanco}" fill-opacity="0.08" stroke="${C.blanco}" stroke-opacity="0.16"/>`);
  s.push(txt(881, 132, `${DIAS_SEMANA[fechaHoy.getUTCDay()]} ${diaHoy} ${nombreMes.slice(0, 3).toUpperCase()} · ${d.hora}`, { size: 22, weight: 600, anchor: 'middle' }));

  s.push(txt(60, 238, `Así vamos en ${nombreMes}`, { size: 62, weight: 700 }));
  s.push(txt(62, 282, 'Reservas de plaza del equipo · día a día', { size: 26, color: C.navy200 }));

  // Tarjetas
  const tarjetas = [
    { titulo: 'LLEVAMOS', valor: `${d.llevamos}`, extra: `/${d.objetivo}`, pie: `${d.pctHecho} % del objetivo`, color: C.brand300 },
    { titulo: 'QUEDAN', valor: `${d.quedan}`, extra: '', pie: d.quedan ? `${100 - d.pctHecho} % por hacer` : '¡Objetivo cumplido!', color: C.sun300 },
    { titulo: 'FIRMADAS', valor: `${d.firmadasMes}`, extra: '', pie: 'este mes', color: C.brand300 },
    { titulo: 'HORA PUNTA', valor: d.horaPunta === null ? '—' : `${d.horaPunta}`, extra: d.horaPunta === null ? '' : ' h', pie: 'más reservas', color: C.sun300 },
  ];
  const anchoT = (960 - 3 * 20) / 4;
  tarjetas.forEach((t, i) => {
    const x = 60 + i * (anchoT + 20);
    s.push(`<rect x="${x}" y="318" width="${anchoT}" height="150" rx="26" fill="${C.blanco}" fill-opacity="0.06" stroke="${C.blanco}" stroke-opacity="0.10"/>`);
    s.push(`<rect x="${x + 24}" y="340" width="34" height="5" rx="2.5" fill="${t.color}"/>`);
    s.push(txt(x + 24, 376, t.titulo, { size: 16, weight: 600, color: C.navy200, spacing: 2 }));
    s.push(
      `<text x="${x + 22}" y="428" font-family="Poppins" fill="${C.blanco}"><tspan font-size="50" font-weight="700">${esc(t.valor)}</tspan>` +
        (t.extra ? `<tspan font-size="26" font-weight="600" fill="${C.navy300}">${esc(t.extra)}</tspan>` : '') +
        `</text>`,
    );
    s.push(txt(x + 24, 454, t.pie, { size: 17, weight: 500, color: t.color }));
  });

  // Panel del gráfico
  s.push(`<rect x="40" y="500" width="1000" height="640" rx="34" fill="${C.blanco}" fill-opacity="0.045" stroke="${C.blanco}" stroke-opacity="0.09"/>`);
  // Leyenda
  const leyenda: [string, string][] = [
    ['barra', 'Reservas del día'],
    ['acum', 'Acumulado'],
    ['ritmo', `Ritmo objetivo (${d.objetivo})`],
    ['proy', `Proyección (~${proyeccion})`],
  ];
  let lx = 76;
  for (const [tipo, etiqueta] of leyenda) {
    if (tipo === 'barra') s.push(`<rect x="${lx}" y="546" width="16" height="22" rx="4" fill="url(#barra)"/>`);
    if (tipo === 'acum') s.push(`<line x1="${lx}" y1="557" x2="${lx + 28}" y2="557" stroke="${C.blanco}" stroke-width="5" stroke-linecap="round"/>`);
    if (tipo === 'ritmo') s.push(`<line x1="${lx}" y1="557" x2="${lx + 28}" y2="557" stroke="${C.sun300}" stroke-width="4" stroke-dasharray="8 7" stroke-linecap="round"/>`);
    if (tipo === 'proy') s.push(`<line x1="${lx}" y1="557" x2="${lx + 28}" y2="557" stroke="${C.brand300}" stroke-width="4" stroke-dasharray="2 8" stroke-linecap="round"/>`);
    const ancho = tipo === 'barra' ? 26 : 40;
    s.push(txt(lx + ancho, 564, etiqueta, { size: 18, weight: 500, color: C.navy200 }));
    lx += ancho + etiqueta.length * 9.6 + 34;
  }

  // Rejilla y eje del acumulado
  for (let v = 0; v <= escala.max; v += escala.paso) {
    const y = yAcum(v);
    s.push(`<line x1="${x0}" y1="${n1(y)}" x2="${x1}" y2="${n1(y)}" stroke="${C.blanco}" stroke-opacity="${v === 0 ? 0.22 : 0.07}" stroke-width="${v === 0 ? 2 : 1}"/>`);
    s.push(txt(x0 - 16, y + 6, v, { size: 16, weight: 500, color: C.navy300, anchor: 'end' }));
  }

  // Separador y título de la franja de barras
  s.push(`<line x1="${x0}" y1="${yAcumBase + 22}" x2="${x1}" y2="${yAcumBase + 22}" stroke="${C.blanco}" stroke-opacity="0.06"/>`);
  s.push(txt(x0 - 16, yBarrasTop - 8, 'Por día', { size: 15, weight: 600, color: C.navy300, anchor: 'start' }));
  s.push(`<line x1="${x0}" y1="${yBase}" x2="${x1}" y2="${yBase}" stroke="${C.blanco}" stroke-opacity="0.22" stroke-width="2"/>`);

  // Barras por día
  d.dias.forEach((x, i) => {
    const futuro = i > indiceHoy;
    const centro = cx(i);
    if (futuro) {
      s.push(`<circle cx="${n1(centro)}" cy="${yBase - 6}" r="3" fill="${C.navy500}"/>`);
      return;
    }
    if (x.reservas > 0) {
      const h = Math.max(12, (x.reservas / escalaBarras) * (altoBarras - 24));
      s.push(
        `<rect x="${n1(centro - anchoBarra / 2)}" y="${n1(yBase - h)}" width="${n1(anchoBarra)}" height="${n1(h)}" rx="${n1(anchoBarra / 3)}" ` +
          `fill="url(#${i === indiceHoy ? 'barraHoy' : 'barra'})"/>`,
      );
      s.push(txt(centro, yBase - h - 10, x.reservas, { size: 17, weight: 700, color: i === indiceHoy ? C.sun200 : C.brand300, anchor: 'middle' }));
    } else {
      s.push(`<rect x="${n1(centro - anchoBarra / 2)}" y="${yBase - 4}" width="${n1(anchoBarra)}" height="4" rx="2" fill="${C.navy400}"/>`);
    }
  });

  // Ritmo objetivo (de 0 al objetivo a fin de mes)
  s.push(
    `<line x1="${x0}" y1="${yAcum(0)}" x2="${n1(cx(nDias - 1))}" y2="${n1(yAcum(d.objetivo))}" stroke="${C.sun300}" stroke-width="3.5" ` +
      `stroke-dasharray="10 9" stroke-linecap="round" stroke-opacity="0.9"/>`,
  );
  s.push(txt(cx(nDias - 1), yAcum(d.objetivo) - 14, d.objetivo, { size: 18, weight: 700, color: C.sun300, anchor: 'end' }));

  // Acumulado: área + curva
  if (acumulado.length) {
    const puntos: [number, number][] = [[x0, yAcum(d.ajuste)], ...acumulado.map((v, i) => [cx(i), yAcum(v)] as [number, number])];
    const linea = curva(puntos);
    const ultimo = puntos[puntos.length - 1];
    s.push(`<path d="${linea} L${n1(ultimo[0])},${yAcumBase} L${x0},${yAcumBase} Z" fill="url(#area)"/>`);
    // Proyección hasta fin de mes
    if (indiceHoy < nDias - 1) {
      s.push(
        `<line x1="${n1(ultimo[0])}" y1="${n1(ultimo[1])}" x2="${n1(cx(nDias - 1))}" y2="${n1(yAcum(proyeccion))}" stroke="${C.brand300}" ` +
          `stroke-width="4" stroke-dasharray="2 9" stroke-linecap="round"/>`,
      );
      s.push(`<circle cx="${n1(cx(nDias - 1))}" cy="${n1(yAcum(proyeccion))}" r="6" fill="${C.brand300}"/>`);
    }
    s.push(`<path d="${linea}" fill="none" stroke="${C.blanco}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>`);
    // Punto de hoy con su globo
    s.push(`<circle cx="${n1(ultimo[0])}" cy="${n1(ultimo[1])}" r="11" fill="${C.sun400}" stroke="${C.navy950}" stroke-width="4"/>`);
    const gx = Math.min(Math.max(ultimo[0], x0 + 50), x1 - 50);
    const arriba = ultimo[1] - 58 - 30 > yTop - 20; // si no cabe encima, el globo va debajo
    const gy = arriba ? ultimo[1] - 58 : ultimo[1] + 80;
    s.push(`<rect x="${n1(gx - 44)}" y="${n1(gy - 30)}" width="88" height="42" rx="21" fill="${C.blanco}"/>`);
    s.push(
      arriba
        ? `<path d="M${n1(ultimo[0] - 8)},${n1(gy + 12)} L${n1(ultimo[0])},${n1(gy + 22)} L${n1(ultimo[0] + 8)},${n1(gy + 12)} Z" fill="${C.blanco}"/>`
        : `<path d="M${n1(ultimo[0] - 8)},${n1(gy - 30)} L${n1(ultimo[0])},${n1(gy - 40)} L${n1(ultimo[0] + 8)},${n1(gy - 30)} Z" fill="${C.blanco}"/>`,
    );
    s.push(txt(gx, gy - 1, d.llevamos, { size: 24, weight: 800, color: C.navy950, anchor: 'middle' }));
  }

  // Eje X: inicial del día de la semana y número
  d.dias.forEach((x, i) => {
    const centro = cx(i);
    const f = new Date(`${x.dia}T12:00:00Z`);
    const futuro = i > indiceHoy;
    const domingo = f.getUTCDay() === 0;
    s.push(txt(centro, yBase + 30, INICIAL[f.getUTCDay()], { size: 14, weight: 500, color: domingo ? C.navy500 : C.navy300, anchor: 'middle' }));
    if (i === indiceHoy) s.push(`<circle cx="${n1(centro)}" cy="${yBase + 56}" r="16" fill="${C.sun400}"/>`);
    s.push(
      txt(centro, yBase + 62, f.getUTCDate(), {
        size: 16,
        weight: i === indiceHoy ? 700 : 600,
        color: i === indiceHoy ? C.navy950 : futuro ? C.navy500 : C.blanco,
        anchor: 'middle',
      }),
    );
  });

  // Pie: barra de progreso del objetivo
  s.push(txt(60, 1196, 'Objetivo del mes', { size: 22, weight: 600 }));
  s.push(
    `<text x="1020" y="1196" font-family="Poppins" text-anchor="end" fill="${C.blanco}"><tspan font-size="22" font-weight="700">${d.llevamos} / ${d.objetivo}</tspan>` +
      `<tspan font-size="22" font-weight="500" fill="${C.navy200}"> · ${d.pctHecho} %</tspan></text>`,
  );
  s.push(`<rect x="60" y="1214" width="960" height="20" rx="10" fill="${C.blanco}" fill-opacity="0.09"/>`);
  const anchoProgreso = Math.max(20, (Math.min(d.pctHecho, 100) / 100) * 960);
  s.push(`<rect x="60" y="1214" width="${n1(anchoProgreso)}" height="20" rx="10" fill="url(#progreso)"/>`);
  s.push(txt(540, 1300, 'MESENERGIA · Nos importa tu ahorro', { size: 19, weight: 500, color: C.navy300, anchor: 'middle', spacing: 1 }));
  if (d.ajuste > 0) {
    s.push(txt(540, 1326, `El acumulado incluye ${d.ajuste} reservas de este mes anteriores al CRM`, { size: 14, color: C.navy400, anchor: 'middle' }));
  }

  s.push('</svg>');
  return s.join('\n');
}

/** PNG listo para enviar por WhatsApp. */
export async function graficaMes(d: DatosGrafica): Promise<Uint8Array> {
  const { fuentes, logo } = await preparar();
  const resvg = new Resvg(svgMes(d, logo), {
    fitTo: { mode: 'width', value: 1080 },
    font: { fontBuffers: fuentes, loadSystemFonts: false, defaultFontFamily: 'Poppins' },
  });
  const png = resvg.render().asPng();
  resvg.free();
  return png;
}
