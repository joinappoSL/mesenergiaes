import { useMemo, useState } from 'react';
import { Card, CardHeader } from '@/components/ui/Card';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/Feedback';
import { Select } from '@/components/ui/Field';
import { useRegistroLeads } from '@/hooks/leads';
import { fecha, hoyISO } from '@/lib/format';
import type { Lead } from '@/lib/leads';
import { resumenPorDia } from '@/lib/leads';
import { ClipboardList } from 'lucide-react';
import { mensajeError } from '@/lib/utils';
import { EstadisticasLeads } from './EstadisticasLeads';

interface Props {
  /** personas cuyo registro se puede elegir (solo gestores y jefes) */
  personas?: { id: string; nombre: string }[];
  /** leads que se están viendo (cartera y módulo elegidos) */
  leads: Lead[];
}

export function RegistroLeads({ personas, leads }: Props) {
  const registro = useRegistroLeads();
  const [persona, setPersona] = useState('');

  const dias = useMemo(
    () => {
      const ids = new Set(leads.map((l) => l.id));
      return resumenPorDia((registro.data ?? []).filter((e) => ids.has(e.lead_id) && (!persona || e.usuario_id === persona)));
    },
    [registro.data, persona, leads],
  );
  const hoy = dias.find((d) => d.dia === hoyISO());

  if (registro.isLoading) return <Skeleton className="h-64 w-full" />;
  if (registro.error) return <ErrorState mensaje={mensajeError(registro.error)} onRetry={() => registro.refetch()} />;

  const tiles: [string, number | undefined, string][] = [
    ['Llamadas', hoy?.llamadas, 'text-navy-900'],
    ['No contesta', hoy?.no_contesta, 'text-sun-700'],
    ['No existe teléfono', hoy?.no_existe, 'text-orange-700'],
    ['Llamar más tarde', hoy?.volver_a_llamar, 'text-sky-700'],
    ['Rechazados', hoy?.rechazado, 'text-red-600'],
    ['Correos enviados', hoy?.correo, 'text-brand-700'],
    ['Facturas recibidas', hoy?.facturas, 'text-sky-700'],
    ['Comparativas enviadas', hoy?.comparativa, 'text-violet-700'],
    ['Visitas', hoy?.visita, 'text-amber-800'],
    ['Firmados', hoy?.firmado, 'text-emerald-700'],
  ];

  return (
    <div className="space-y-4">
      <EstadisticasLeads leads={leads} />
      {personas && personas.length > 0 && (
        <Card className="p-3">
          <Select className="w-auto" value={persona} onChange={(e) => setPersona(e.target.value)}>
            <option value="">Todo el equipo</option>
            {personas.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </Select>
        </Card>
      )}
      <Card>
        <CardHeader title="Hoy" icon={<ClipboardList className="h-4 w-4" />} />
        <div className="grid grid-cols-2 gap-3 p-5 sm:grid-cols-4">
          {tiles.map(([titulo, valor, clase]) => (
            <div key={titulo} className="rounded-xl bg-slate-50 p-3 text-center">
              <p className={`font-display text-3xl font-bold ${clase}`}>{valor ?? 0}</p>
              <p className="text-xs text-slate-500">{titulo}</p>
            </div>
          ))}
        </div>
      </Card>
      <Card className="overflow-x-auto">
        <CardHeader title="Por día" subtitle="Últimos 120 días" />
        {dias.length === 0 ? (
          <EmptyState icon={<ClipboardList className="h-6 w-6" />} titulo="Aún sin registros" texto="Cada llamada que marques aparecerá aquí." />
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-100 text-[11px] uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-4 py-3">Día</th>
                <th className="px-4 py-3 text-right">Llamadas</th>
                <th className="px-4 py-3 text-right">No contesta</th>
                <th className="px-4 py-3 text-right">No existe</th>
                <th className="px-4 py-3 text-right">Llamar + tarde</th>
                <th className="px-4 py-3 text-right">Rechazado</th>
                <th className="px-4 py-3 text-right">Correo enviado</th>
                <th className="px-4 py-3 text-right">Facturas</th>
                <th className="px-4 py-3 text-right">Comparativas</th>
                <th className="px-4 py-3 text-right">Visitas</th>
                <th className="px-4 py-3 text-right">Firmados</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 tabular-nums">
              {dias.map((d) => (
                <tr key={d.dia}>
                  <td className="px-4 py-2.5">{fecha(d.dia)}</td>
                  <td className="px-4 py-2.5 text-right font-bold text-navy-900">{d.llamadas}</td>
                  <td className="px-4 py-2.5 text-right">{d.no_contesta}</td>
                  <td className="px-4 py-2.5 text-right">{d.no_existe}</td>
                  <td className="px-4 py-2.5 text-right">{d.volver_a_llamar}</td>
                  <td className="px-4 py-2.5 text-right">{d.rechazado}</td>
                  <td className="px-4 py-2.5 text-right">{d.correo}</td>
                  <td className="px-4 py-2.5 text-right">{d.facturas}</td>
                  <td className="px-4 py-2.5 text-right">{d.comparativa}</td>
                  <td className="px-4 py-2.5 text-right">{d.visita}</td>
                  <td className="px-4 py-2.5 text-right">{d.firmado}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
