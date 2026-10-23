import { Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/Feedback';
import { Input, Select } from '@/components/ui/Field';
import { ESTADOS_LEAD, norm, type EstadoLead, type Lead } from '@/lib/leads';
import { EstadoLeadBadge } from './comunes';

interface Props {
  leads: Lead[];
  mostrarCartera: boolean;
  nombreCartera: (id: string) => string | null;
  onAbrir: (id: string) => void;
}

export function ListaLeads({ leads, mostrarCartera, nombreCartera, onAbrir }: Props) {
  const [q, setQ] = useState('');
  const [estado, setEstado] = useState<'todos' | EstadoLead>('todos');

  const filas = useMemo(() => {
    const nq = norm(q);
    return leads.filter(
      (l) =>
        (estado === 'todos' || l.estado === estado) &&
        (!nq || norm([l.nombre, l.telefono, l.telefono2, l.email, l.cups, ...Object.values(l.extra ?? {})].join(' ')).includes(nq)),
    );
  }, [leads, q, estado]);

  return (
    <div className="space-y-4">
      <Card className="flex flex-wrap items-center gap-3 p-3">
        <div className="min-w-[220px] flex-1">
          <Input icon={<Search className="h-4 w-4" />} placeholder="Buscar nombre, teléfono, CUPS…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Select className="w-auto" value={estado} onChange={(e) => setEstado(e.target.value as 'todos' | EstadoLead)}>
          <option value="todos">Todos los estados</option>
          {(Object.keys(ESTADOS_LEAD) as EstadoLead[]).map((e) => <option key={e} value={e}>{ESTADOS_LEAD[e].etiqueta}</option>)}
        </Select>
        <span className="text-sm text-slate-500">{filas.length} leads</span>
      </Card>
      <Card className="overflow-x-auto">
        {filas.length === 0 ? (
          <EmptyState icon={<Search className="h-6 w-6" />} titulo="Sin resultados" />
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-100 text-[11px] uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Teléfono</th>
                <th className="px-4 py-3">Teléfono 2</th>
                <th className="px-4 py-3">kW</th>
                {mostrarCartera && <th className="px-4 py-3">Cartera</th>}
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3 text-right">Llam.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filas.slice(0, 500).map((l) => (
                <tr key={l.id} className="cursor-pointer transition hover:bg-slate-50" onClick={() => onAbrir(l.id)}>
                  <td className="px-4 py-2.5 font-semibold text-navy-900">{l.nombre || '—'}</td>
                  <td className="px-4 py-2.5">{l.telefono || '—'}</td>
                  <td className="px-4 py-2.5">{l.telefono2 || '—'}</td>
                  <td className="px-4 py-2.5 font-bold text-brand-700">{l.kw || '—'}</td>
                  {mostrarCartera && <td className="px-4 py-2.5 text-slate-500">{nombreCartera(l.propietario_id) ?? '—'}</td>}
                  <td className="px-4 py-2.5"><EstadoLeadBadge estado={l.estado} /></td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{l.llamadas}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {filas.length > 500 && <p className="border-t border-slate-100 px-4 py-3 text-xs text-slate-500">Se muestran 500 de {filas.length}. Afina la búsqueda.</p>}
      </Card>
    </div>
  );
}
