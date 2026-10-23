import { ChevronLeft, ChevronRight, FileSpreadsheet, Mail, Phone, PhoneOff, RotateCcw, ThumbsDown } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/Feedback';
import { Select, Textarea } from '@/components/ui/Field';
import { useActualizarLead, useCambiarEstadoLead } from '@/hooks/leads';
import type { Lead } from '@/lib/leads';
import { mensajeError } from '@/lib/utils';
import { EstadoLeadBadge, enlaceTel } from './comunes';
import { MaximetroModal } from './MaximetroModal';
import { PanelCorreo } from './PanelCorreo';

type Filtro = 'pendiente' | 'no_contesta' | 'todos';

interface Props {
  leads: Lead[];
  /** lead al que saltar (viene de la lista) */
  focoId: string | null;
  onFocoUsado: () => void;
  nombreCartera: (id: string) => string | null;
  puedeEditar: (l: Lead) => boolean;
}

export function LlamarLeads({ leads, focoId, onFocoUsado, nombreCartera, puedeEditar }: Props) {
  const [filtro, setFiltro] = useState<Filtro>('pendiente');
  const [idx, setIdx] = useState(0);
  const [correo, setCorreo] = useState(false);
  const [maximetro, setMaximetro] = useState(false);
  const cambiar = useCambiarEstadoLead();
  const actualizar = useActualizarLead();

  const cola = useMemo(() => leads.filter((l) => filtro === 'todos' || l.estado === filtro), [leads, filtro]);

  useEffect(() => {
    if (!focoId) return;
    setFiltro('todos');
    const i = leads.findIndex((l) => l.id === focoId);
    if (i >= 0) setIdx(i);
    onFocoUsado();
  }, [focoId, leads, onFocoUsado]);

  const pos = Math.min(idx, Math.max(0, cola.length - 1));
  const lead = cola[pos];

  if (!lead) {
    return (
      <Card>
        <EmptyState
          icon={<Phone className="h-6 w-6" />}
          titulo={leads.length ? 'No hay leads con este filtro 🎉' : 'Todavía no hay leads'}
          texto={leads.length ? 'Prueba con otro filtro.' : 'Importa un Excel para empezar a llamar.'}
        />
      </Card>
    );
  }

  const editable = puedeEditar(lead);
  const extra = Object.entries(lead.extra ?? {});

  async function marcar(estado: 'no_contesta' | 'rechazado' | 'pendiente') {
    try {
      await cambiar.mutateAsync({ lead, estado });
      if (filtro === 'todos') setIdx(pos + 1);
    } catch (e) {
      toast.error(mensajeError(e));
    }
  }

  return (
    <div className="space-y-4">
      <Card className="flex flex-wrap items-center gap-3 p-3">
        <Select className="w-auto" value={filtro} onChange={(e) => { setFiltro(e.target.value as Filtro); setIdx(0); }}>
          <option value="pendiente">Pendientes</option>
          <option value="no_contesta">No contesta</option>
          <option value="todos">Todos</option>
        </Select>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="secondary" size="sm" icon={<ChevronLeft className="h-4 w-4" />} onClick={() => setIdx(Math.max(0, pos - 1))} aria-label="Anterior" />
          <span className="min-w-16 text-center text-sm text-slate-500">{pos + 1} / {cola.length}</span>
          <Button variant="secondary" size="sm" icon={<ChevronRight className="h-4 w-4" />} onClick={() => setIdx(Math.min(cola.length - 1, pos + 1))} aria-label="Siguiente" />
        </div>
      </Card>

      <Card className="p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate text-xl font-semibold text-navy-900">{lead.nombre || '(sin nombre)'}</h2>
            {nombreCartera(lead.propietario_id) && <p className="text-xs text-slate-500">Cartera de {nombreCartera(lead.propietario_id)}</p>}
          </div>
          <div className="flex items-center gap-2">
            {lead.llamadas > 0 && <span className="text-xs text-slate-500">{lead.llamadas} llamada{lead.llamadas === 1 ? '' : 's'}</span>}
            <EstadoLeadBadge estado={lead.estado} />
          </div>
        </div>

        <div className="mt-5 grid gap-5 sm:grid-cols-[auto_1fr] sm:items-center">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Potencia (kW)</p>
            <p className="font-display text-5xl font-bold leading-none text-brand-600">
              {lead.kw || '—'} <span className="text-xl text-slate-400">kW</span>
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {[lead.telefono, lead.telefono2].filter(Boolean).map((t) => (
              <a
                key={t}
                href={enlaceTel(t)}
                className="inline-flex h-12 items-center gap-2 rounded-xl bg-brand-600 px-5 text-lg font-bold text-white shadow-sm transition hover:bg-brand-700 active:scale-[0.98]"
              >
                <Phone className="h-5 w-5" /> {t}
              </a>
            ))}
          </div>
        </div>

        <dl className="mt-5 grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
          {lead.email && <Dato2 k="Email" v={lead.email} />}
          {lead.cups && <Dato2 k="CUPS" v={lead.cups} />}
          {lead.consumo_anual ? <Dato2 k="Consumo anual" v={`${Math.round(lead.consumo_anual).toLocaleString('es-ES')} kWh`} /> : null}
          {lead.comercializadora && <Dato2 k="Comercializadora" v={lead.comercializadora} />}
          {extra.map(([k, v]) => <Dato2 key={k} k={k} v={v} />)}
        </dl>

        <div className="mt-5">
          <Textarea
            key={lead.id}
            defaultValue={lead.nota}
            placeholder="Notas de la llamada…"
            disabled={!editable}
            onBlur={(e) => {
              if (e.target.value !== lead.nota) actualizar.mutate({ id: lead.id, patch: { nota: e.target.value } });
            }}
          />
        </div>

        {editable && (
          <div className="mt-5 flex flex-wrap gap-2">
            <Button variant="warning" size="lg" icon={<PhoneOff className="h-4 w-4" />} onClick={() => marcar('no_contesta')} loading={cambiar.isPending}>
              No contesta
            </Button>
            <Button variant="danger" size="lg" icon={<ThumbsDown className="h-4 w-4" />} onClick={() => marcar('rechazado')} loading={cambiar.isPending}>
              Rechazado
            </Button>
            <Button size="lg" icon={<Mail className="h-4 w-4" />} onClick={() => setCorreo(true)}>
              Correo enviado
            </Button>
            <Button variant="secondary" size="lg" icon={<FileSpreadsheet className="h-4 w-4" />} onClick={() => setMaximetro(true)}>
              Maxímetro
            </Button>
            {lead.estado !== 'pendiente' && (
              <Button variant="ghost" size="lg" icon={<RotateCcw className="h-4 w-4" />} onClick={() => marcar('pendiente')}>
                Pendiente
              </Button>
            )}
          </div>
        )}
      </Card>

      <PanelCorreo lead={lead} open={correo} onClose={() => setCorreo(false)} onEnviado={() => filtro !== 'todos' || setIdx(pos + 1)} />
      <MaximetroModal lead={lead} open={maximetro} onClose={() => setMaximetro(false)} />
    </div>
  );
}

function Dato2({ k, v }: { k: string; v: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{k}</dt>
      <dd className="mt-0.5 break-words text-[15px] text-slate-800">{v}</dd>
    </div>
  );
}
