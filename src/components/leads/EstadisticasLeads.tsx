import { BarChart3 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Select } from '@/components/ui/Field';
import { embudo, PERIODOS_ESTADISTICA, rangoPeriodo, type Lead, type Periodo } from '@/lib/leads';
import { cn } from '@/lib/utils';

/** Estadísticas del proceso por fechas: correos, facturas recibidas (la clave), comparativas, visitas y firmas. */
export function EstadisticasLeads({ leads }: { leads: Lead[] }) {
  const [periodo, setPeriodo] = useState<Periodo>('mes');
  const { total, porModulo } = useMemo(() => embudo(leads, rangoPeriodo(periodo)), [leads, periodo]);

  const tiles: { titulo: string; valor: number; clase: string; destacado?: boolean; extra?: string }[] = [
    { titulo: 'Leads cargados', valor: total.cargados, clase: 'text-navy-900' },
    { titulo: 'Correos enviados', valor: total.correos, clase: 'text-brand-700' },
    {
      titulo: 'Facturas recibidas',
      valor: total.facturas,
      clase: 'text-sky-700',
      destacado: true,
      extra: total.pctFacturas !== null ? `${total.pctFacturas} % de los correos` : undefined,
    },
    { titulo: 'Comparativas enviadas', valor: total.comparativas, clase: 'text-violet-700' },
    { titulo: 'Visitas', valor: total.visitas, clase: 'text-amber-800' },
    { titulo: 'Firmados', valor: total.firmados, clase: 'text-emerald-700' },
  ];

  return (
    <Card>
      <CardHeader
        title="Estadísticas"
        icon={<BarChart3 className="h-4 w-4" />}
        subtitle="Cada paso se cuenta en la fecha en que ocurrió (editable en la ficha del cliente)"
        actions={
          <Select className="w-auto" value={periodo} onChange={(e) => setPeriodo(e.target.value as Periodo)}>
            {PERIODOS_ESTADISTICA.map((p) => <option key={p.valor} value={p.valor}>{p.etiqueta}</option>)}
          </Select>
        }
      />
      <div className="grid grid-cols-2 gap-3 p-5 sm:grid-cols-3 lg:grid-cols-6">
        {tiles.map((t) => (
          <div key={t.titulo} className={cn('rounded-xl p-3 text-center', t.destacado ? 'bg-sky-50 ring-1 ring-sky-200' : 'bg-slate-50')}>
            <p className={cn('font-display text-3xl font-bold', t.clase)}>{t.valor}</p>
            <p className="text-xs text-slate-500">{t.titulo}</p>
            {t.extra && <p className="mt-0.5 text-[11px] font-semibold text-sky-700">{t.extra}</p>}
          </div>
        ))}
      </div>
      {porModulo.length > 1 || (porModulo.length === 1 && porModulo[0].modulo) ? (
        <div className="overflow-x-auto border-t border-slate-100">
          <table className="w-full text-left text-sm">
            <thead className="text-[11px] uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-4 py-3">Módulo</th>
                <th className="px-4 py-3 text-right">Cargados</th>
                <th className="px-4 py-3 text-right">Correos</th>
                <th className="px-4 py-3 text-right">Facturas</th>
                <th className="px-4 py-3 text-right">% fact./correos</th>
                <th className="px-4 py-3 text-right">Comparativas</th>
                <th className="px-4 py-3 text-right">Visitas</th>
                <th className="px-4 py-3 text-right">Firmados</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 tabular-nums">
              {porModulo.map((f) => (
                <tr key={f.modulo || 'sin'}>
                  <td className="px-4 py-2.5 font-semibold text-navy-900">{f.modulo || 'Sin módulo'}</td>
                  <td className="px-4 py-2.5 text-right">{f.cargados}</td>
                  <td className="px-4 py-2.5 text-right">{f.correos}</td>
                  <td className="px-4 py-2.5 text-right font-bold text-sky-700">{f.facturas}</td>
                  <td className="px-4 py-2.5 text-right">{f.pctFacturas === null ? '—' : `${f.pctFacturas} %`}</td>
                  <td className="px-4 py-2.5 text-right">{f.comparativas}</td>
                  <td className="px-4 py-2.5 text-right">{f.visitas}</td>
                  <td className="px-4 py-2.5 text-right">{f.firmados}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </Card>
  );
}
