import { FileSpreadsheet, FolderInput, Search, UserRound } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/Feedback';
import { Input, Select } from '@/components/ui/Field';
import { telefono } from '@/lib/format';
import { useMoverLeads } from '@/hooks/leads';
import { exportarTipificado } from '@/lib/leadsExcel';
import { mensajeError } from '@/lib/utils';
import { ESTADOS_LEAD, norm, textoHoraLlamada, type EstadoLead, type Lead } from '@/lib/leads';
import { EstadoLeadBadge } from './comunes';
import { FichaCliente } from './FichaCliente';

interface Props {
  leads: Lead[];
  mostrarCartera: boolean;
  nombreCartera: (id: string) => string | null;
  puedeEditar: (l: Lead) => boolean;
  modulos: string[];
  /** listas (módulos) a las que se pueden mover leads */
  listas: string[];
  /** abre el lead en la pestaña «Llamar» */
  onLlamar: (id: string) => void;
}

export function ListaLeads({ leads, mostrarCartera, nombreCartera, puedeEditar, modulos, listas, onLlamar }: Props) {
  const [abierto, setAbierto] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [estado, setEstado] = useState<'todos' | EstadoLead>('todos');
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const [destino, setDestino] = useState('');
  const mover = useMoverLeads();

  const filas = useMemo(() => {
    const nq = norm(q);
    return leads.filter(
      (l) =>
        (estado === 'todos' || l.estado === estado) &&
        (!nq || norm([l.nombre, l.telefono, l.telefono2, l.email, l.cups, ...Object.values(l.extra ?? {})].join(' ')).includes(nq)),
    );
  }, [leads, q, estado]);

  const editables = filas.slice(0, 500).filter(puedeEditar);
  const todosMarcados = editables.length > 0 && editables.every((l) => marcados.has(l.id));
  const seleccion = [...marcados].filter((id) => leads.some((l) => l.id === id));

  async function moverSeleccion() {
    if (!seleccion.length || destino === '') return;
    const modulo = destino === '__sin' ? '' : destino;
    try {
      await mover.mutateAsync({ ids: seleccion, modulo });
      toast.success(`${seleccion.length} lead${seleccion.length === 1 ? '' : 's'} movido${seleccion.length === 1 ? '' : 's'} ${modulo ? `a «${modulo}»` : 'fuera de las listas'}`);
      setMarcados(new Set());
    } catch (e) {
      toast.error(mensajeError(e));
    }
  }

  return (
    <div className="space-y-4">
      {seleccion.length > 0 && (
        <Card className="flex flex-wrap items-center gap-3 border-l-4 border-brand-500 p-3">
          <span className="text-sm font-semibold text-navy-900">{seleccion.length} seleccionado{seleccion.length === 1 ? '' : 's'}</span>
          <Select className="w-auto" value={destino} onChange={(e) => setDestino(e.target.value)} aria-label="Lista de destino">
            <option value="">Mover a la lista…</option>
            {listas.map((m) => <option key={m} value={m}>{m}</option>)}
            <option value="__sin">Sin lista</option>
          </Select>
          <Button icon={<FolderInput className="h-4 w-4" />} onClick={moverSeleccion} loading={mover.isPending} disabled={destino === ''}>
            Mover
          </Button>
          <Button variant="ghost" onClick={() => setMarcados(new Set())}>Quitar selección</Button>
        </Card>
      )}
      <Card className="flex flex-wrap items-center gap-3 p-3">
        <div className="min-w-[220px] flex-1">
          <Input icon={<Search className="h-4 w-4" />} placeholder="Buscar nombre, teléfono, CUPS…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Select className="w-auto" value={estado} onChange={(e) => setEstado(e.target.value as 'todos' | EstadoLead)}>
          <option value="todos">Todos los estados</option>
          {(Object.keys(ESTADOS_LEAD) as EstadoLead[]).map((e) => <option key={e} value={e}>{ESTADOS_LEAD[e].etiqueta}</option>)}
        </Select>
        <span className="text-sm text-slate-500">{filas.length} leads</span>
        <Button
          variant="secondary"
          size="sm"
          className="ml-auto"
          icon={<FileSpreadsheet className="h-4 w-4" />}
          onClick={() => exportarTipificado(filas).catch(() => toast.error('No se ha podido generar el Excel.'))}
        >
          Excel tipificado
        </Button>
      </Card>
      <Card className="overflow-x-auto">
        {filas.length === 0 ? (
          <EmptyState icon={<Search className="h-6 w-6" />} titulo="Sin resultados" />
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-100 text-[11px] uppercase tracking-wide text-slate-400">
              <tr>
                <th className="w-8 px-3 py-3">
                  <input
                    type="checkbox"
                    aria-label="Seleccionar todos"
                    checked={todosMarcados}
                    disabled={!editables.length}
                    onChange={() => setMarcados(todosMarcados ? new Set() : new Set(editables.map((l) => l.id)))}
                  />
                </th>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Teléfono</th>
                <th className="px-4 py-3">Teléfono 2</th>
                <th className="px-4 py-3">kW</th>
                <th className="px-4 py-3">Módulo</th>
                {mostrarCartera && <th className="px-4 py-3">Cartera</th>}
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3 text-right">Llam.</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filas.slice(0, 500).map((l) => (
                <tr key={l.id} className="cursor-pointer transition hover:bg-slate-50" onClick={() => onLlamar(l.id)}>
                  <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                    {puedeEditar(l) && (
                      <input
                        type="checkbox"
                        aria-label={`Seleccionar ${l.nombre}`}
                        checked={marcados.has(l.id)}
                        onChange={() => setMarcados((m) => { const n = new Set(m); if (n.has(l.id)) n.delete(l.id); else n.add(l.id); return n; })}
                      />
                    )}
                  </td>
                  <td className="px-4 py-2.5 font-semibold text-navy-900">{l.nombre || '—'}</td>
                  <td className="px-4 py-2.5 tabular-nums">{telefono(l.telefono)}</td>
                  <td className="px-4 py-2.5 tabular-nums">{telefono(l.telefono2)}</td>
                  <td className="px-4 py-2.5 font-bold text-brand-700">{l.kw || '—'}</td>
                  <td className="px-4 py-2.5 text-slate-500">{l.modulo || '—'}</td>
                  {mostrarCartera && <td className="px-4 py-2.5 text-slate-500">{nombreCartera(l.propietario_id) ?? '—'}</td>}
                  <td className="px-4 py-2.5">
                    <EstadoLeadBadge estado={l.estado} />
                    {l.estado === 'volver_a_llamar' && l.proxima_llamada_at && (
                      <span className="ml-2 text-xs text-slate-500">{textoHoraLlamada(l.proxima_llamada_at)}</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{l.llamadas}</td>
                  <td className="px-4 py-2.5 text-right">
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setAbierto(l.id); }}
                      className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-50"
                    >
                      <UserRound className="h-3.5 w-3.5" /> Ficha
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {filas.length > 500 && <p className="border-t border-slate-100 px-4 py-3 text-xs text-slate-500">Se muestran 500 de {filas.length}. Afina la búsqueda.</p>}
      </Card>
      {abierto && leads.find((l) => l.id === abierto) && (
        <FichaCliente lead={leads.find((l) => l.id === abierto)!} editable={puedeEditar(leads.find((l) => l.id === abierto)!)} modulos={modulos} onClose={() => setAbierto(null)} />
      )}
    </div>
  );
}
