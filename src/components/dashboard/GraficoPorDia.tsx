import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { BarChart3, Table2 } from 'lucide-react';
import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card, CardHeader } from '@/components/ui/Card';
import { Tabs } from '@/components/ui/Misc';
import { ESTADOS, LISTA_ESTADOS } from '@/lib/constants';
import type { DashboardDia } from '@/lib/types';
import { cn } from '@/lib/utils';

/** Serie única (subidos por día): navy-500, validado para contraste y croma. */
const COLOR_SERIE = '#36538f';
const COLOR_REJILLA = '#eef1f6';
const COLOR_EJE = '#94a3b8';

function TooltipDia({ active, payload }: { active?: boolean; payload?: ReadonlyArray<{ payload?: DashboardDia }> }) {
  const d = payload?.[0]?.payload;
  if (!active || !d) return null;
  return (
    <div className="min-w-44 rounded-xl bg-white px-3.5 py-3 text-sm shadow-pop ring-1 ring-slate-200">
      <p className="text-xs font-medium text-slate-500 first-letter:uppercase">{format(parseISO(d.fecha), "EEEE d 'de' MMMM", { locale: es })}</p>
      <p className="mt-1 flex items-baseline gap-1.5">
        <span className="text-lg font-semibold text-navy-900">{d.total}</span>
        <span className="text-xs text-slate-500">contratos subidos</span>
      </p>
      {d.total > 0 && (
        <ul className="mt-2 space-y-1 border-t border-slate-100 pt-2">
          {LISTA_ESTADOS.filter((e) => d[e] > 0).map((e) => (
            <li key={e} className="flex items-center justify-between gap-4 text-xs">
              <span className="flex items-center gap-1.5 text-slate-600">
                <span className={cn('h-2 w-2 rounded-full', ESTADOS[e].punto)} />
                {ESTADOS[e].etiqueta}
              </span>
              <span className="font-semibold tabular-nums text-slate-800">{d[e]}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function GraficoPorDia({ datos, cargando }: { datos: DashboardDia[]; cargando: boolean }) {
  const [vista, setVista] = useState<'grafico' | 'tabla'>('grafico');
  const total = datos.reduce((s, d) => s + d.total, 0);
  const media = datos.length ? total / datos.length : 0;
  const pico = datos.reduce<DashboardDia | null>((max, d) => (!max || d.total > max.total ? d : max), null);

  return (
    <Card className={cn('overflow-hidden transition-opacity', cargando && 'opacity-60')}>
      <CardHeader
        title="Contratos subidos por día"
        icon={<BarChart3 className="h-4 w-4" />}
        subtitle={
          pico && pico.total > 0
            ? `Media ${media.toLocaleString('es-ES', { maximumFractionDigits: 1 })}/día · mejor día ${format(parseISO(pico.fecha), 'd MMM', { locale: es })} (${pico.total})`
            : 'Sin contratos en el periodo'
        }
        actions={
          <Tabs
            value={vista}
            onChange={setVista}
            tabs={[
              { value: 'grafico', label: <BarChart3 className="h-4 w-4" aria-label="Gráfico" /> },
              { value: 'tabla', label: <Table2 className="h-4 w-4" aria-label="Tabla" /> },
            ]}
          />
        }
      />
      {vista === 'grafico' ? (
        <div className="px-2 pb-3 pt-5 sm:px-4">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={datos} margin={{ top: 4, right: 8, bottom: 0, left: -12 }} barCategoryGap="18%">
              <CartesianGrid vertical={false} stroke={COLOR_REJILLA} />
              <XAxis
                dataKey="fecha"
                tickLine={false}
                axisLine={{ stroke: '#e2e8f0' }}
                tick={{ fill: COLOR_EJE, fontSize: 11 }}
                tickFormatter={(v: string) => format(parseISO(v), 'd MMM', { locale: es })}
                minTickGap={18}
                interval="preserveStartEnd"
              />
              <YAxis
                allowDecimals={false}
                tickLine={false}
                axisLine={false}
                tick={{ fill: COLOR_EJE, fontSize: 11 }}
                width={40}
              />
              <Tooltip cursor={{ fill: 'rgba(15, 30, 67, 0.05)' }} content={(p) => <TooltipDia active={p.active} payload={p.payload as ReadonlyArray<{ payload?: DashboardDia }>} />} />
              <Bar
                dataKey="total"
                name="Subidos"
                fill={COLOR_SERIE}
                radius={[4, 4, 0, 0]}
                maxBarSize={24}
                activeBar={{ fill: '#284177' }}
                isAnimationActive={false}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="max-h-[320px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2 text-left font-semibold">Día</th>
                <th className="px-3 py-2 text-right font-semibold">Total</th>
                {LISTA_ESTADOS.map((e) => (
                  <th key={e} className="px-3 py-2 text-right font-semibold">
                    {ESTADOS[e].etiqueta}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 tabular-nums">
              {[...datos].reverse().map((d) => (
                <tr key={d.fecha} className={cn(d.total === 0 && 'text-slate-400')}>
                  <td className="px-4 py-2 first-letter:uppercase">{format(parseISO(d.fecha), 'EEE d MMM', { locale: es })}</td>
                  <td className="px-3 py-2 text-right font-semibold">{d.total}</td>
                  {LISTA_ESTADOS.map((e) => (
                    <td key={e} className="px-3 py-2 text-right">
                      {d[e]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
