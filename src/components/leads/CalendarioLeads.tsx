import { AlarmClock, CalendarClock, ChevronLeft, ChevronRight, Phone, PhoneCall, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/Feedback';
import { Input, Select } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { useReuniones } from '@/hooks/leads';
import {
  ANTELACION_POR_DEFECTO,
  ANTELACIONES,
  aDia,
  casillasDelMes,
  diasEntre,
  eventosCalendario,
  type EventoCalendario,
  type TipoEvento,
} from '@/lib/calendario';
import { telefono } from '@/lib/format';
import { norm, telefonosDe, type Lead } from '@/lib/leads';
import { enlaceTel } from './comunes';
import { FichaCliente } from './FichaCliente';
import { FormReunion, IconoModalidad } from './ReunionesFicha';

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const DIAS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

const TIPO: Record<TipoEvento, { etiqueta: string; punto: string; chip: string }> = {
  renovacion: { etiqueta: 'Llamar por renovación', punto: 'bg-amber-500', chip: 'bg-amber-50 text-amber-800' },
  fin_contrato: { etiqueta: 'Fin de contrato', punto: 'bg-red-500', chip: 'bg-red-50 text-red-700' },
  llamada: { etiqueta: 'Llamada programada', punto: 'bg-sky-500', chip: 'bg-sky-50 text-sky-700' },
  reunion: { etiqueta: 'Reunión', punto: 'bg-brand-600', chip: 'bg-brand-50 text-brand-700' },
};

function leerAntelacion(): number {
  try {
    const v = Number(localStorage.getItem('calendario-antelacion'));
    return (ANTELACIONES as readonly number[]).includes(v) ? v : ANTELACION_POR_DEFECTO;
  } catch {
    return ANTELACION_POR_DEFECTO;
  }
}

interface Props {
  leads: Lead[];
  nombreCartera: (id: string) => string | null;
  puedeEditar: (l: Lead) => boolean;
  modulos: string[];
}

export function CalendarioLeads({ leads, nombreCartera, puedeEditar, modulos }: Props) {
  const reuniones = useReuniones();
  const hoy = aDia(new Date());
  const [mes, setMes] = useState(() => ({ y: new Date().getFullYear(), m: new Date().getMonth() }));
  const [sel, setSel] = useState(hoy);
  const [antelacion, setAntelacion] = useState(leerAntelacion);
  const [abierto, setAbierto] = useState<string | null>(null);
  const [nueva, setNueva] = useState(false);

  const eventos = useMemo(() => eventosCalendario(leads, reuniones.data ?? [], antelacion), [leads, reuniones.data, antelacion]);
  const porDia = useMemo(() => {
    const m = new Map<string, EventoCalendario[]>();
    for (const e of eventos) m.set(e.dia, [...(m.get(e.dia) ?? []), e]);
    return m;
  }, [eventos]);
  const casillas = useMemo(() => casillasDelMes(mes.y, mes.m), [mes]);

  // Clientes a los que ya toca llamar por renovación (su contrato acaba dentro del margen)
  const tocaYa = useMemo(
    () => eventos.filter((e) => e.tipo === 'renovacion' && e.dia <= hoy && diasEntre(hoy, e.dia) >= -antelacion).sort((a, b) => a.dia.localeCompare(b.dia)),
    [eventos, hoy, antelacion],
  );
  const delDia = porDia.get(sel) ?? [];
  const leadAbierto = abierto ? leads.find((l) => l.id === abierto) : undefined;

  const mover = (d: number) => setMes(({ y, m }) => {
    const f = new Date(y, m + d, 1);
    return { y: f.getFullYear(), m: f.getMonth() };
  });

  function cambiarAntelacion(v: number) {
    setAntelacion(v);
    try {
      localStorage.setItem('calendario-antelacion', String(v));
    } catch {
      /* sin almacenamiento: vale solo en esta sesión */
    }
  }

  const fila = (e: EventoCalendario) => (
    <li key={e.clave}>
      <button type="button" onClick={() => setAbierto(e.lead.id)} className="flex w-full items-start gap-3 rounded-xl px-3 py-2 text-left transition hover:bg-slate-50">
        <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${TIPO[e.tipo].punto}`} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-navy-900">{e.lead.nombre || '(sin nombre)'}</span>
          <span className="block text-xs text-slate-500">
            {e.hora && `${e.hora} · `}
            {e.titulo}
            {e.reunion && <IconoModalidad m={e.reunion.modalidad} className="ml-1 inline h-3 w-3" />}
            {nombreCartera(e.lead.propietario_id) && ` · ${nombreCartera(e.lead.propietario_id)}`}
          </span>
          {e.detalle && <span className="block truncate text-xs text-slate-400">{e.detalle}</span>}
        </span>
      </button>
    </li>
  );

  return (
    <div className="space-y-4">
      {tocaYa.length > 0 && (
        <Card className="border-l-4 border-amber-400 p-4">
          <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold text-navy-900">
            <AlarmClock className="h-4 w-4 text-amber-600" /> Toca llamar ya: su contrato está a punto de acabar ({tocaYa.length})
          </h3>
          <ul className="divide-y divide-slate-100">
            {tocaYa.slice(0, 8).map((e) => (
              <li key={e.clave} className="flex flex-wrap items-center gap-2 py-1.5">
                <button type="button" onClick={() => setAbierto(e.lead.id)} className="min-w-0 flex-1 text-left">
                  <span className="block truncate text-sm font-semibold text-navy-900">{e.lead.nombre || '(sin nombre)'}</span>
                  <span className="block text-xs text-slate-500">{e.detalle}</span>
                </button>
                {telefonosDe(e.lead).slice(0, 1).map((t) => (
                  <a key={t} href={enlaceTel(t)} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-brand-600 px-3 text-sm font-bold text-white hover:bg-brand-700">
                    <Phone className="h-3.5 w-3.5" /> {telefono(t)}
                  </a>
                ))}
              </li>
            ))}
          </ul>
          {tocaYa.length > 8 && <p className="pt-1 text-xs text-slate-500">y {tocaYa.length - 8} más en el calendario</p>}
        </Card>
      )}

      <Card className="flex flex-wrap items-center gap-3 p-3">
        <div className="flex items-center gap-1">
          <Button variant="secondary" size="sm" icon={<ChevronLeft className="h-4 w-4" />} onClick={() => mover(-1)} aria-label="Mes anterior" />
          <span className="min-w-36 text-center font-display text-base font-semibold capitalize text-navy-900">{MESES[mes.m]} {mes.y}</span>
          <Button variant="secondary" size="sm" icon={<ChevronRight className="h-4 w-4" />} onClick={() => mover(1)} aria-label="Mes siguiente" />
        </div>
        <Button variant="ghost" size="sm" onClick={() => { setMes({ y: new Date().getFullYear(), m: new Date().getMonth() }); setSel(hoy); }}>Hoy</Button>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-sm text-slate-600">
            Avisar
            <Select className="w-auto" value={antelacion} onChange={(e) => cambiarAntelacion(Number(e.target.value))} aria-label="Antelación del aviso de renovación">
              {ANTELACIONES.map((d) => <option key={d} value={d}>{d} días antes</option>)}
            </Select>
          </label>
          <Button icon={<Plus className="h-4 w-4" />} onClick={() => setNueva(true)}>Nueva reunión</Button>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <Card className="p-3">
          <div className="grid grid-cols-7 gap-1 pb-1 text-center text-[11px] font-semibold uppercase text-slate-400">
            {DIAS.map((d) => <span key={d}>{d}</span>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {casillas.map(({ dia, delMes }) => {
              const ev = porDia.get(dia) ?? [];
              const tipos = [...new Set(ev.map((e) => e.tipo))];
              return (
                <button
                  key={dia}
                  type="button"
                  onClick={() => setSel(dia)}
                  aria-label={`${dia}: ${ev.length} eventos`}
                  className={`flex min-h-[64px] flex-col items-start rounded-lg p-1.5 text-left ring-1 transition sm:min-h-[84px] ${
                    dia === sel ? 'bg-brand-50 ring-brand-500' : 'bg-white ring-slate-100 hover:bg-slate-50'
                  } ${delMes ? '' : 'opacity-40'}`}
                >
                  <span className={`text-xs font-semibold ${dia === hoy ? 'rounded-full bg-brand-600 px-1.5 text-white' : 'text-slate-600'}`}>{Number(dia.slice(8))}</span>
                  {ev.length > 0 && (
                    <>
                      <span className="mt-auto flex flex-wrap gap-0.5 pt-1">
                        {tipos.map((t) => <span key={t} className={`h-2 w-2 rounded-full ${TIPO[t].punto}`} />)}
                      </span>
                      <span className="hidden text-[10px] font-semibold text-slate-500 sm:block">{ev.length} {ev.length === 1 ? 'evento' : 'eventos'}</span>
                    </>
                  )}
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-3 pt-3 text-xs text-slate-500">
            {(Object.keys(TIPO) as TipoEvento[]).map((t) => (
              <span key={t} className="inline-flex items-center gap-1.5"><span className={`h-2 w-2 rounded-full ${TIPO[t].punto}`} />{TIPO[t].etiqueta}</span>
            ))}
          </div>
        </Card>

        <Card className="p-3">
          <h3 className="mb-1 flex items-center gap-2 px-3 text-sm font-semibold text-navy-900 first-letter:uppercase">
            <CalendarClock className="h-4 w-4 text-brand-600" />
            {new Date(`${sel}T12:00:00`).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
          </h3>
          {delDia.length ? (
            <ul>{delDia.map(fila)}</ul>
          ) : (
            <EmptyState icon={<PhoneCall className="h-6 w-6" />} titulo="Nada este día" texto="Apunta el fin de contrato en la ficha del cliente o programa una reunión." />
          )}
        </Card>
      </div>

      {leadAbierto && <FichaCliente lead={leadAbierto} editable={puedeEditar(leadAbierto)} modulos={modulos} onClose={() => setAbierto(null)} />}

      <NuevaReunionModal open={nueva} onClose={() => setNueva(false)} leads={leads.filter(puedeEditar)} dia={sel} />
    </div>
  );
}

function NuevaReunionModal({ open, onClose, leads, dia }: { open: boolean; onClose: () => void; leads: Lead[]; dia: string }) {
  const [q, setQ] = useState('');
  const [elegido, setElegido] = useState<Lead | null>(null);
  const coincidencias = useMemo(() => {
    const nq = norm(q);
    if (!nq) return [];
    return leads.filter((l) => norm([l.nombre, l.telefono, l.telefono2, l.cups].join(' ')).includes(nq)).slice(0, 8);
  }, [q, leads]);

  function cerrar() {
    setQ('');
    setElegido(null);
    onClose();
  }

  return (
    <Modal open={open} onClose={cerrar} title="Nueva reunión" description="Busca al cliente y fija el día, el tipo y el lugar." icon={<CalendarClock className="h-5 w-5" />} size="lg">
      <div className="space-y-4">
        {elegido ? (
          <>
            <p className="text-sm">
              Cliente: <b>{elegido.nombre || '(sin nombre)'}</b>{' '}
              <button type="button" className="text-brand-700 hover:underline" onClick={() => setElegido(null)}>cambiar</button>
            </p>
            <FormReunion lead={elegido} dia={dia} onHecho={cerrar} onCancelar={cerrar} />
          </>
        ) : (
          <>
            <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre, teléfono o CUPS…" />
            <ul className="divide-y divide-slate-100 rounded-xl ring-1 ring-slate-200">
              {coincidencias.map((l) => (
                <li key={l.id}>
                  <button type="button" onClick={() => setElegido(l)} className="flex w-full flex-col px-3 py-2 text-left hover:bg-slate-50">
                    <span className="text-sm font-semibold text-navy-900">{l.nombre || '(sin nombre)'}</span>
                    <span className="text-xs text-slate-500">{[l.telefono && telefono(l.telefono), l.cups, l.modulo && `Módulo ${l.modulo}`].filter(Boolean).join(' · ')}</span>
                  </button>
                </li>
              ))}
              {!coincidencias.length && <li className="px-3 py-3 text-sm text-slate-500">{q ? 'Sin resultados.' : 'Escribe para buscar…'}</li>}
            </ul>
          </>
        )}
      </div>
    </Modal>
  );
}
