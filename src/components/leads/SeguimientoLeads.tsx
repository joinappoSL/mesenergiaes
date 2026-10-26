import { CalendarDays, Mail } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Card, CardHeader } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/Feedback';
import { Select } from '@/components/ui/Field';
import { diasDesde, fechaHora, telefono } from '@/lib/format';
import { ESTADOS_LEAD, ESTADOS_SEGUIMIENTO, textoHoraLlamada, type EstadoLead, type Lead } from '@/lib/leads';
import { EstadoLeadBadge } from './comunes';
import { FichaCliente } from './FichaCliente';

interface Props {
  leads: Lead[];
  mostrarCartera: boolean;
  nombreCartera: (id: string) => string | null;
  puedeEditar: (l: Lead) => boolean;
  modulos: string[];
}

export function SeguimientoLeads({ leads, mostrarCartera, nombreCartera, puedeEditar, modulos }: Props) {
  const [filtro, setFiltro] = useState<'todos' | EstadoLead>('todos');
  const [abierto, setAbierto] = useState<string | null>(null);

  const filas = leads
    .filter((l) => ESTADOS_SEGUIMIENTO.includes(l.estado) && (filtro === 'todos' || l.estado === filtro))
    .sort((a, b) => new Date(a.ultimo_movimiento_at).getTime() - new Date(b.ultimo_movimiento_at).getTime());
  const cuenta = (e: EstadoLead) => leads.filter((l) => l.estado === e).length;
  const lead = leads.find((l) => l.id === abierto) ?? null;

  // Próximas visitas: las de hoy en adelante, por fecha.
  const inicioHoy = new Date().setHours(0, 0, 0, 0);
  const visitas = leads
    .filter((l) => l.visita_at && new Date(l.visita_at).getTime() >= inicioHoy && l.estado !== 'firmado' && l.estado !== 'rechazado')
    .sort((a, b) => new Date(a.visita_at!).getTime() - new Date(b.visita_at!).getTime());

  return (
    <div className="space-y-4">
      {visitas.length > 0 && (
        <Card>
          <CardHeader title="Próximas visitas" icon={<CalendarDays className="h-4 w-4" />} subtitle={`${visitas.length} programada${visitas.length === 1 ? '' : 's'}`} />
          <ul className="divide-y divide-slate-100">
            {visitas.slice(0, 8).map((l) => (
              <li key={l.id}>
                <button type="button" onClick={() => setAbierto(l.id)} className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 text-left transition hover:bg-slate-50">
                  <span className="w-44 shrink-0 text-sm font-semibold text-amber-800">{textoHoraLlamada(l.visita_at!)}</span>
                  <span className="min-w-0 flex-1 truncate font-semibold text-navy-900">{l.nombre || '—'}</span>
                  <span className="truncate text-sm text-slate-500">{l.visita_lugar || (l.modulo && `Módulo ${l.modulo}`) || ''}</span>
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card className="flex flex-wrap items-center gap-3 p-3">
        <Select className="w-auto" value={filtro} onChange={(e) => setFiltro(e.target.value as 'todos' | EstadoLead)}>
          <option value="todos">Todo el seguimiento</option>
          {ESTADOS_SEGUIMIENTO.map((e) => <option key={e} value={e}>{ESTADOS_LEAD[e].etiqueta}</option>)}
        </Select>
        <span className="text-sm text-slate-500">
          {cuenta('correo')} esperando facturas · {cuenta('facturas')} con facturas · {cuenta('comparativa')} con comparativa · {cuenta('visita')} con visita · {cuenta('firmado')} firmados
        </span>
      </Card>

      <Card className="overflow-x-auto">
        {filas.length === 0 ? (
          <EmptyState
            icon={<Mail className="h-6 w-6" />}
            titulo="Sin clientes en seguimiento"
            texto="Aquí aparecen los clientes a los que ya has enviado el correo."
          />
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-100 text-[11px] uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Teléfono</th>
                <th className="px-4 py-3">Módulo</th>
                {mostrarCartera && <th className="px-4 py-3">Cartera</th>}
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">Correo</th>
                <th className="px-4 py-3">Facturas</th>
                <th className="px-4 py-3">Visita</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filas.map((l) => {
                const dias = diasDesde(l.ultimo_movimiento_at);
                const tarde = l.estado === 'correo' && dias >= 3;
                return (
                  <tr key={l.id} className="cursor-pointer transition hover:bg-slate-50" onClick={() => setAbierto(l.id)}>
                    <td className="px-4 py-2.5 font-semibold text-navy-900">{l.nombre || '—'}</td>
                    <td className="px-4 py-2.5 tabular-nums">{telefono(l.telefono)}</td>
                    <td className="px-4 py-2.5 text-slate-500">{l.modulo || '—'}</td>
                    {mostrarCartera && <td className="px-4 py-2.5 text-slate-500">{nombreCartera(l.propietario_id) ?? '—'}</td>}
                    <td className="px-4 py-2.5"><EstadoLeadBadge estado={l.estado} /></td>
                    <td className="px-4 py-2.5 text-slate-500">{l.correo_enviado_at ? fechaHora(l.correo_enviado_at) : '—'}</td>
                    <td className="px-4 py-2.5 text-slate-500">{l.facturas_recibidas_at ? fechaHora(l.facturas_recibidas_at) : '—'}</td>
                    <td className="px-4 py-2.5 text-slate-500">{l.visita_at ? fechaHora(l.visita_at) : '—'}</td>
                    <td className="px-4 py-2.5">
                      {tarde && <Badge className="bg-sun-50 text-sun-700 ring-sun-200">⏰ reclamar facturas</Badge>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>

      {lead && <FichaCliente lead={lead} editable={puedeEditar(lead)} modulos={modulos} onClose={() => setAbierto(null)} />}
    </div>
  );
}
