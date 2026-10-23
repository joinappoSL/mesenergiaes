import type { CSSProperties } from 'react';
import {
  PERIODOS,
  resumir,
  type Maximetro,
} from '@/lib/leads';

// Estilos en línea (hex): el informe se convierte en PDF con html2canvas, que no
// entiende los colores oklch() de Tailwind. Así sale igual en pantalla y en el PDF.
const NAVY = '#1b3263';
const NAVY9 = '#0f1e43';
const GRIS = '#6b7785';
const LINEA = '#e3e8f2';
const COLORES = ['#1b3263', '#36538f', '#6ca83c', '#a0cf76', '#f5c030', '#8299c7'];

const f0 = (n: number) => Math.round(n).toLocaleString('es-ES');
const f1 = (n: number) => (Math.round(n * 10) / 10).toLocaleString('es-ES');
const fd = (t: number, corto = false) => {
  const d = new Date(t);
  const p = (n: number) => String(n).padStart(2, '0');
  const y = corto ? String(d.getUTCFullYear()).slice(2) : String(d.getUTCFullYear());
  return `${p(d.getUTCDate())}/${p(d.getUTCMonth() + 1)}/${y}`;
};

const th: CSSProperties = { background: '#eef2f9', color: NAVY, padding: '4px 6px', textAlign: 'right', fontSize: 11, borderBottom: `1px solid ${LINEA}` };
const td: CSSProperties = { padding: '4px 6px', textAlign: 'right', fontSize: 12, borderBottom: `1px solid ${LINEA}`, color: NAVY9 };
const tdL: CSSProperties = { ...td, textAlign: 'left' };
const titulo: CSSProperties = {
  margin: '22px 0 8px',
  fontSize: 13,
  color: '#fff',
  background: `linear-gradient(90deg, ${NAVY}, #36538f)`,
  padding: '6px 12px',
  borderRadius: 6,
  textTransform: 'uppercase',
  letterSpacing: '.04em',
  fontWeight: 700,
};

function Leyenda({ items }: { items: [string, string][] }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, fontSize: 11, margin: '4px 0', color: NAVY9 }}>
      {items.map(([color, texto]) => (
        <span key={texto} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <i style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: color }} />
          {texto}
        </span>
      ))}
    </div>
  );
}

function GraficoConsumo({ m }: { m: Maximetro }) {
  const W = 720, H = 230, pl = 44, pb = 34, pt = 12;
  const n = m.filas.length;
  const bw = (W - pl - 10) / n;
  const tops = m.filas.map((f) => f.act.reduce((a, b) => a + b, 0));
  const M = Math.max(1, ...tops) * 1.1;
  const y = (v: number) => pt + (H - pt - pb) * (1 - v / M);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="738" height="236" style={{ display: 'block' }}>
      {[0, 1, 2, 3, 4].map((i) => {
        const v = (M * i) / 4;
        return (
          <g key={i}>
            <line x1={pl} x2={W - 6} y1={y(v)} y2={y(v)} stroke={LINEA} />
            <text x={pl - 6} y={y(v) + 3} fontSize="9" textAnchor="end" fill={GRIS}>{f0(v)}</text>
          </g>
        );
      })}
      {m.filas.map((fila, j) => {
        let acc = 0;
        const x = pl + j * bw + bw * 0.15;
        const w = bw * 0.7;
        return (
          <g key={fila.fin}>
            {fila.act.map((v, i) => {
              if (v <= 0) return null;
              const rect = <rect key={i} x={x} y={y(acc + v)} width={w} height={y(acc) - y(acc + v)} fill={COLORES[i]} />;
              acc += v;
              return rect;
            })}
            <text x={x + w / 2} y={H - pb + 13} fontSize="9" textAnchor="middle" fill={GRIS}>{fd(fila.fin, true).slice(3)}</text>
            <text x={x + w / 2} y={y(acc) - 3} fontSize="8.5" textAnchor="middle" fill={NAVY9}>{f0(acc)}</text>
          </g>
        );
      })}
    </svg>
  );
}

function GraficoPotencia({ m, maximos }: { m: Maximetro; maximos: number[] }) {
  const W = 720, H = 230, pl = 44, pb = 30, pt = 12;
  const gw = (W - pl - 10) / 6;
  const C = m.contr ?? [];
  const M = Math.max(1, ...C, ...maximos, ...m.opt) * 1.12;
  const y = (v: number) => pt + (H - pt - pb) * (1 - v / M);
  const series: [number[], string][] = [[C, NAVY], [maximos, '#6ca83c'], [m.opt, '#f5c030']];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="738" height="236" style={{ display: 'block' }}>
      {[0, 1, 2, 3, 4].map((i) => {
        const v = (M * i) / 4;
        return (
          <g key={i}>
            <line x1={pl} x2={W - 6} y1={y(v)} y2={y(v)} stroke={LINEA} />
            <text x={pl - 6} y={y(v) + 3} fontSize="9" textAnchor="end" fill={GRIS}>{f0(v)}</text>
          </g>
        );
      })}
      {PERIODOS.map((_, p) => {
        const x0 = pl + p * gw + gw * 0.12;
        const w = (gw * 0.76) / 3;
        return (
          <g key={p}>
            {series.map(([arr, color], k) => {
              const v = arr[p] ?? 0;
              return (
                <g key={k}>
                  <rect x={x0 + k * w} y={y(v)} width={w - 2} height={y(0) - y(v)} fill={color} />
                  {v ? <text x={x0 + k * w + w / 2 - 1} y={y(v) - 3} fontSize="8.5" textAnchor="middle" fill={NAVY9}>{f1(v)}</text> : null}
                </g>
              );
            })}
            <text x={pl + p * gw + gw / 2} y={H - pb + 14} fontSize="10" textAnchor="middle" fill={NAVY} fontWeight="700">P{p + 1}</text>
          </g>
        );
      })}
    </svg>
  );
}

interface Props {
  m: Maximetro;
  /** si se pasa, la potencia optimizada se puede editar a mano */
  onCambiarOpt?: (opt: number[]) => void;
  logoUrl: string;
}

/** Estudio de consumo y potencia con el diseño de +Energía. */
export function InformeMaximetro({ m, onCambiarOpt, logoUrl }: Props) {
  const r = resumir(m);
  const hot = Math.max(...r.pct);
  const C = m.contr;
  const cabeceras = PERIODOS.map((p) => <th key={p} style={th}>P{p}</th>);
  const celdaOpt = (i: number) =>
    onCambiarOpt ? (
      <input
        defaultValue={String(m.opt[i]).replace('.', ',')}
        key={`${i}-${m.opt[i]}`}
        onBlur={(e) => {
          const v = parseFloat(e.target.value.replace(',', '.'));
          if (Number.isFinite(v) && v >= 0) onCambiarOpt(m.opt.map((x, k) => (k === i ? v : x)));
        }}
        style={{ width: 64, textAlign: 'right', border: '1px solid #c4e2a9', background: '#f2f8ec', borderRadius: 4, padding: '3px 5px', color: NAVY9 }}
      />
    ) : (
      <b>{f1(m.opt[i])}</b>
    );

  return (
    <div style={{ background: '#fff', color: NAVY9, padding: 28, fontSize: 13, fontFamily: 'Inter Variable, system-ui, sans-serif', width: '100%', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, borderBottom: '4px solid #6ca83c', paddingBottom: 12 }}>
        <div>
          <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.08em', color: GRIS }}>Estudio de consumo y potencia</div>
          <h2 style={{ margin: 0, fontSize: 22, color: NAVY }}>
            {m.nombre || 'Cliente'}
            {m.nif ? <span style={{ fontWeight: 400, fontSize: 15 }}> · {m.nif}</span> : null}
          </h2>
          <div style={{ color: GRIS }}>
            Últimos {m.filas.length} meses · {fd(m.filas[0].ini)} – {fd(m.filas[m.filas.length - 1].fin)}
          </div>
        </div>
        <img src={logoUrl} alt="+Energía" style={{ height: 110, margin: '-18px 0' }} crossOrigin="anonymous" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px 18px', marginTop: 12 }}>
        {[
          ['CUPS', m.cups || '—'],
          ['Tarifa de acceso', m.tarifa || '—'],
          ['Distribuidora', m.dist || '—'],
          ['Municipio', [m.cp, m.mun, m.prov].filter(Boolean).join(' · ') || '—'],
          ['Consumo anual', `${f0(r.total)} kWh`],
          ['CNAE', m.cnae || '—'],
        ].map(([k, v]) => (
          <div key={k} style={{ borderBottom: `1px solid ${LINEA}`, padding: '3px 0' }}>
            <b style={{ display: 'block', fontSize: 10, color: GRIS, textTransform: 'uppercase' }}>{k}</b>
            {v}
          </div>
        ))}
      </div>

      <div style={titulo}>Consumo mensual (kWh)</div>
      <Leyenda items={PERIODOS.map((p, i) => [COLORES[i], `P${p}`])} />
      <GraficoConsumo m={m} />
      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 8 }}>
        <thead>
          <tr><th style={{ ...th, textAlign: 'left' }}>Periodo de lectura</th>{cabeceras}<th style={th}>Total</th></tr>
        </thead>
        <tbody>
          {m.filas.map((f) => (
            <tr key={f.fin}>
              <td style={tdL}>{fd(f.ini, true)} – {fd(f.fin, true)}</td>
              {f.act.map((v, i) => <td key={i} style={td}>{v ? f0(v) : '–'}</td>)}
              <td style={td}><b>{f0(f.act.reduce((a, b) => a + b, 0))}</b></td>
            </tr>
          ))}
          <tr style={{ background: '#f2f8ec', fontWeight: 700 }}>
            <td style={tdL}>Consumo anual</td>
            {r.tot.map((v, i) => <td key={i} style={td}>{f0(v)}</td>)}
            <td style={td}>{f0(r.total)}</td>
          </tr>
          <tr>
            <td style={tdL}>% del total</td>
            {r.pct.map((v, i) => <td key={i} style={v === hot ? { ...td, background: '#fef1c7', fontWeight: 700 } : td}>{Math.round(v)} %</td>)}
            <td style={td}>100 %</td>
          </tr>
        </tbody>
      </table>

      <div style={titulo}>Potencia: contratada · maxímetro · propuesta (kW)</div>
      <Leyenda items={[[NAVY, 'Contratada'], ['#6ca83c', 'Máximo registrado'], ['#f5c030', 'Potencia optimizada']]} />
      <GraficoPotencia m={m} maximos={r.maximos} />
      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 8 }}>
        <thead><tr><th style={{ ...th, textAlign: 'left' }}>Maxímetro (kW)</th>{cabeceras}</tr></thead>
        <tbody>
          {m.filas.map((f) => (
            <tr key={f.fin}>
              <td style={tdL}>{fd(f.fin, true)}</td>
              {f.max.map((v, i) => <td key={i} style={td}>{v ? f1(v) : '–'}</td>)}
            </tr>
          ))}
          <tr style={{ background: '#f2f8ec', fontWeight: 700 }}>
            <td style={tdL}>Máximo 12 meses</td>
            {r.maximos.map((v, i) => <td key={i} style={td}>{f1(v)}</td>)}
          </tr>
          <tr>
            <td style={tdL}>Potencia contratada</td>
            {PERIODOS.map((_, i) => <td key={i} style={td}>{C ? f1(C[i]) : '—'}</td>)}
          </tr>
          <tr style={{ background: '#f2f8ec', fontWeight: 700 }}>
            <td style={tdL}>POTENCIA OPTIMIZADA</td>
            {PERIODOS.map((_, i) => <td key={i} style={td}>{celdaOpt(i)}</td>)}
          </tr>
          {C ? (
            <tr>
              <td style={tdL}>Reducción</td>
              {PERIODOS.map((_, i) => {
                const d = C[i] - m.opt[i];
                return <td key={i} style={td}>{d > 0 ? `−${f1(d)} kW` : '–'}</td>;
              })}
            </tr>
          ) : null}
        </tbody>
      </table>
      <div style={{ fontSize: 11, color: GRIS, marginTop: 6 }}>
        Propuesta = máximo registrado en los últimos 12 meses, respetando que cada periodo no sea inferior al anterior.
      </div>
      <div style={{ fontSize: 11, color: GRIS, marginTop: 14, borderTop: `1px solid ${LINEA}`, paddingTop: 8 }}>
        MESENERGIA · +Energía — Nos importa tu ahorro · Estudio preliminar con datos de la distribuidora, sin compromiso.
      </div>
    </div>
  );
}
