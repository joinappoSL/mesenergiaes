import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { AlarmClock, CheckCircle2, GripVertical } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePermisos } from '@/auth/permisos';
import { ESTADOS, LISTA_ESTADOS } from '@/lib/constants';
import { diasDesde, etiquetaDias, euros, fecha, fechaHoraCorta, nombreCliente, numeroContrato } from '@/lib/format';
import type { Contrato, EstadoContrato } from '@/lib/types';
import { cn } from '@/lib/utils';
import { CambiarEstadoModal } from './Modales';

function Tarjeta({ contrato, arrastrable, overlay }: { contrato: Contrato; arrastrable: boolean; overlay?: boolean }) {
  return (
    <div
      className={cn(
        'rounded-xl bg-white p-3 ring-1 ring-slate-200/80 transition',
        overlay ? 'rotate-[1.5deg] shadow-pop ring-navy-300' : 'shadow-xs hover:shadow-card hover:ring-slate-300',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 truncate text-sm font-semibold text-navy-900">{nombreCliente(contrato)}</p>
        {arrastrable && <GripVertical className="h-4 w-4 shrink-0 text-slate-300" />}
      </div>
      <p className="mt-0.5 truncate text-xs text-slate-500">
        {numeroContrato(contrato.numero)} · {contrato.poblacion}
      </p>
      <p className="mt-1.5 truncate text-xs text-slate-600">{contrato.producto ?? contrato.operadora}</p>
      <div className="mt-2.5 flex items-center justify-between gap-2 text-[11px]">
        <span className="truncate text-slate-500">{contrato.comercial_nombre ?? '—'}</span>
        <span className="shrink-0 font-semibold text-navy-900">{euros(contrato.precio_mensual)}</span>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span
          className={cn(
            'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset',
            contrato.firmado ? 'bg-brand-50 text-brand-700 ring-brand-200' : 'bg-slate-50 text-slate-500 ring-slate-200',
          )}
        >
          <CheckCircle2 className="h-3 w-3" />
          {contrato.firmado ? 'Firmado' : 'Sin firmar'}
        </span>
        {contrato.estado === 'pendiente' ? (
          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 ring-1 ring-inset ring-amber-200">
            {etiquetaDias(diasDesde(contrato.created_at))}
          </span>
        ) : (
          <span className="text-[10px] text-slate-400">{fecha(contrato.created_at)}</span>
        )}
        {contrato.estado === 'pendiente' && contrato.proxima_llamada_at && (
          <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-sun-700">
            <AlarmClock className="h-3 w-3" /> {fechaHoraCorta(contrato.proxima_llamada_at)}
          </span>
        )}
      </div>
    </div>
  );
}

function TarjetaArrastrable({ contrato, arrastrable, onAbrir }: { contrato: Contrato; arrastrable: boolean; onAbrir: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: contrato.id, disabled: !arrastrable });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      role="button"
      tabIndex={0}
      onClick={onAbrir}
      onKeyDown={(e) => e.key === 'Enter' && onAbrir()}
      className={cn('touch-manipulation outline-none focus-visible:ring-2 focus-visible:ring-navy-400 rounded-xl', isDragging && 'opacity-30', arrastrable ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer')}
    >
      <Tarjeta contrato={contrato} arrastrable={arrastrable} />
    </div>
  );
}

function Columna({
  estado,
  contratos,
  arrastrable,
  onAbrir,
}: {
  estado: EstadoContrato;
  contratos: Contrato[];
  arrastrable: boolean;
  onAbrir: (c: Contrato) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: estado, disabled: !arrastrable });
  const cfg = ESTADOS[estado];
  const total = contratos.reduce((s, c) => s + (Number(c.precio_mensual) || 0), 0);

  return (
    <section
      ref={setNodeRef}
      className={cn(
        'flex w-[82vw] shrink-0 snap-start flex-col rounded-2xl ring-1 transition sm:w-80 xl:w-auto',
        cfg.columna,
        isOver && 'ring-2 ring-navy-500 bg-white',
      )}
    >
      <header className="flex items-center justify-between gap-2 px-3.5 pb-2 pt-3.5">
        <div className="flex items-center gap-2">
          <span className={cn('h-2.5 w-2.5 rounded-full', cfg.punto)} />
          <h3 className="text-sm font-semibold text-navy-900">{cfg.etiqueta}</h3>
          <span className="rounded-full bg-white/80 px-2 py-0.5 text-[11px] font-bold text-slate-600 ring-1 ring-slate-200">
            {contratos.length}
          </span>
        </div>
        <span className="text-[11px] font-semibold text-slate-500">{euros(total)}/mes</span>
      </header>
      <div className="flex max-h-[68vh] min-h-[160px] flex-col gap-2.5 overflow-y-auto px-2.5 pb-3 scrollbar-thin">
        {contratos.map((c) => (
          <TarjetaArrastrable key={c.id} contrato={c} arrastrable={arrastrable} onAbrir={() => onAbrir(c)} />
        ))}
        {contratos.length === 0 && (
          <p className="rounded-xl border border-dashed border-slate-300/80 px-3 py-6 text-center text-xs text-slate-400">
            {arrastrable ? 'Arrastra aquí un contrato' : 'Sin contratos'}
          </p>
        )}
      </div>
    </section>
  );
}

export function KanbanContratos({ contratos }: { contratos: Contrato[] }) {
  const p = usePermisos();
  const navigate = useNavigate();
  const [activo, setActivo] = useState<Contrato | null>(null);
  const [cambio, setCambio] = useState<{ contrato: Contrato; estado: EstadoContrato } | null>(null);
  const ultimoArrastre = useRef(0);

  const sensores = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 6 } }),
  );

  const porEstado = useMemo(() => {
    const m: Record<EstadoContrato, Contrato[]> = { pendiente: [], activo: [], riesgos: [], cancelado: [] };
    for (const c of contratos) m[c.estado].push(c);
    return m;
  }, [contratos]);

  function onDragStart(e: DragStartEvent) {
    setActivo(contratos.find((c) => c.id === e.active.id) ?? null);
  }

  function onDragEnd(e: DragEndEvent) {
    ultimoArrastre.current = Date.now();
    const contrato = contratos.find((c) => c.id === e.active.id);
    const destino = e.over?.id as EstadoContrato | undefined;
    setActivo(null);
    if (contrato && destino && destino !== contrato.estado) setCambio({ contrato, estado: destino });
  }

  function abrir(c: Contrato) {
    if (Date.now() - ultimoArrastre.current < 300) return;
    navigate(`/contratos/${c.id}`);
  }

  return (
    <>
      <DndContext sensors={sensores} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setActivo(null)}>
        <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-3 sm:mx-0 sm:px-0 xl:grid xl:grid-cols-4 xl:overflow-visible">
          {LISTA_ESTADOS.map((estado) => (
            <Columna
              key={estado}
              estado={estado}
              contratos={porEstado[estado]}
              arrastrable={p.puedeArrastrarKanban}
              onAbrir={abrir}
            />
          ))}
        </div>
        <DragOverlay dropAnimation={null}>
          {activo ? <Tarjeta contrato={activo} arrastrable overlay /> : null}
        </DragOverlay>
      </DndContext>
      {cambio && (
        <CambiarEstadoModal contrato={cambio.contrato} estadoInicial={cambio.estado} onClose={() => setCambio(null)} />
      )}
    </>
  );
}
