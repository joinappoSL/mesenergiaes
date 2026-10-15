import { addMinutes } from 'date-fns';
import { AlarmClock, ArrowRight, Bot, MessageSquare, PhoneCall, Send } from 'lucide-react';
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { toast } from 'sonner';
import { usePerfil } from '@/auth/AuthProvider';
import { Badge, EstadoBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState, Spinner } from '@/components/ui/Feedback';
import { Field, Input, Textarea } from '@/components/ui/Field';
import { Avatar } from '@/components/ui/Misc';
import { useHistorial, useLlamadas, useObservaciones } from '@/hooks/datos';
import { useAnadirObservacion, useRegistrarLlamada, useReprogramarVerificacion } from '@/hooks/mutaciones';
import { ESTADOS, LISTA_RESULTADOS, RESULTADOS_LLAMADA, ROLES } from '@/lib/constants';
import { fechaHora, fechaHoraCorta } from '@/lib/format';
import type { Contrato, ResultadoLlamada } from '@/lib/types';
import { cn, mensajeError } from '@/lib/utils';
import { aFechaHoraLocal } from '@/lib/verificaciones';

// -----------------------------------------------------------------------------
// Observaciones: hilo cronológico tipo chat. Solo se añaden.
// -----------------------------------------------------------------------------
export function Observaciones({ contratoId }: { contratoId: string }) {
  const perfil = usePerfil();
  const obs = useObservaciones(contratoId);
  const anadir = useAnadirObservacion();
  const [texto, setTexto] = useState('');
  const finalRef = useRef<HTMLDivElement>(null);
  const total = obs.data?.length ?? 0;

  useEffect(() => {
    finalRef.current?.scrollIntoView({ block: 'nearest' });
  }, [total]);

  async function enviar() {
    if (!texto.trim()) return;
    try {
      await anadir.mutateAsync({ contratoId, texto });
      setTexto('');
    } catch (e) {
      toast.error(mensajeError(e));
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      enviar();
    }
  }

  return (
    <div className="flex flex-col">
      <div className="max-h-[480px] min-h-[160px] space-y-3 overflow-y-auto px-4 py-4 scrollbar-thin">
        {obs.isLoading ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : total === 0 ? (
          <EmptyState
            icon={<MessageSquare className="h-6 w-6" />}
            titulo="Sin observaciones todavía"
            texto="Escribe la primera nota para el equipo."
            className="py-6"
          />
        ) : (
          obs.data!.map((o) => {
            if (o.sistema) {
              return (
                <div key={o.id} className="flex items-center justify-center gap-2 text-center text-xs text-slate-500">
                  <Bot className="h-3.5 w-3.5 shrink-0" />
                  <span>
                    <strong className="font-semibold text-slate-600">{o.autor_nombre ?? 'Sistema'}</strong> {o.texto.charAt(0).toLowerCase() + o.texto.slice(1)}{' '}
                    · {fechaHoraCorta(o.created_at)}
                  </span>
                </div>
              );
            }
            const mio = o.autor_id === perfil.id;
            return (
              <div key={o.id} className={cn('flex gap-2.5 animate-fade-in', mio && 'flex-row-reverse')}>
                <Avatar nombre={o.autor_nombre} className="mt-5 h-8 w-8" />
                <div className={cn('max-w-[85%] min-w-0', mio && 'items-end text-right')}>
                  <p className={cn('mb-1 flex flex-wrap items-center gap-x-1.5 text-xs text-slate-500', mio && 'justify-end')}>
                    <span className="font-semibold text-slate-700">{mio ? 'Tú' : (o.autor_nombre ?? 'Usuario')}</span>
                    {o.autor_rol && <span>· {ROLES[o.autor_rol].etiqueta}</span>}
                    <span title={fechaHora(o.created_at)}>· {fechaHoraCorta(o.created_at)}</span>
                  </p>
                  <div
                    className={cn(
                      'inline-block whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2.5 text-left text-sm leading-relaxed',
                      mio ? 'rounded-tr-md bg-navy-800 text-white' : 'rounded-tl-md bg-slate-100 text-slate-800',
                    )}
                  >
                    {o.texto}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={finalRef} />
      </div>
      <div className="border-t border-slate-100 p-3">
        <div className="flex items-end gap-2">
          <Textarea
            rows={2}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Escribe una observación…"
            className="min-h-[52px] flex-1"
            maxLength={5000}
          />
          <Button
            onClick={enviar}
            loading={anadir.isPending}
            disabled={!texto.trim()}
            size="icon"
            className="h-[52px] w-[52px]"
            aria-label="Enviar observación"
            icon={<Send className="h-4 w-4" />}
          />
        </div>
        <p className="mt-1.5 hidden text-[11px] text-slate-400 sm:block">Ctrl + Enter para enviar · Las observaciones no se pueden editar ni borrar</p>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Historial de estados (timeline)
// -----------------------------------------------------------------------------
export function Historial({ contratoId }: { contratoId: string }) {
  const historial = useHistorial(contratoId);
  if (historial.isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Spinner />
      </div>
    );
  }
  const items = historial.data ?? [];
  if (!items.length) return <p className="px-5 py-6 text-sm text-slate-500">Sin cambios de estado.</p>;

  return (
    <ol className="relative space-y-5 px-5 py-5">
      <span className="absolute bottom-6 left-[29px] top-7 w-px bg-slate-200" aria-hidden />
      {items.map((h) => (
        <li key={h.id} className="relative flex gap-3">
          <span
            className={cn(
              'relative z-10 mt-1 h-3 w-3 shrink-0 rounded-full ring-4 ring-white',
              ESTADOS[h.estado_nuevo].punto,
            )}
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              {h.estado_anterior ? (
                <>
                  <EstadoBadge estado={h.estado_anterior} />
                  <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
                </>
              ) : (
                <span className="text-xs font-semibold text-slate-500">Alta en</span>
              )}
              <EstadoBadge estado={h.estado_nuevo} />
            </div>
            {h.motivo && <p className="mt-1.5 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">{h.motivo}</p>}
            <p className="mt-1 text-xs text-slate-500">
              {h.usuario_nombre ?? 'Sistema'} · {fechaHora(h.created_at)}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}

// -----------------------------------------------------------------------------
// Registro de llamadas (backoffice)
// -----------------------------------------------------------------------------
function manana10(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(10, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function enUnaHora(): string {
  return aFechaHoraLocal(addMinutes(new Date(), 60));
}

export function FormularioLlamada({
  contratoId,
  contrato,
  onRegistrada,
}: {
  contratoId: string;
  /** si tiene la verificación pendiente, «No contesta» permite reprogramarla en el mismo paso */
  contrato?: Pick<Contrato, 'verificacion_at' | 'verificacion_hecha_at' | 'instalacion_fecha'>;
  onRegistrada?: (r: ResultadoLlamada) => void;
}) {
  const registrar = useRegistrarLlamada();
  const reprogramar = useReprogramarVerificacion();
  const [resultado, setResultado] = useState<ResultadoLlamada | null>(null);
  const [nota, setNota] = useState('');
  const [volverAt, setVolverAt] = useState(manana10());
  const verificacionPendiente = !!contrato?.verificacion_at && !contrato.verificacion_hecha_at;
  const [moverVerificacion, setMoverVerificacion] = useState(true);
  const [verificacionAt, setVerificacionAt] = useState(enUnaHora());
  const conReprogramar = verificacionPendiente && resultado === 'no_contesta' && moverVerificacion;
  const fueraDePlazo =
    conReprogramar && !!contrato?.instalacion_fecha && !!verificacionAt && verificacionAt.slice(0, 10) > contrato.instalacion_fecha;

  async function guardar() {
    if (!resultado) return toast.error('Elige el resultado de la llamada');
    if (resultado === 'volver_a_llamar' && !volverAt) return toast.error('Indica cuándo volver a llamar');
    if (conReprogramar && !verificacionAt) return toast.error('Indica la nueva hora de la verificación');
    if (fueraDePlazo) return toast.error('La verificación tiene que ser antes de la cita de instalación.');
    try {
      await registrar.mutateAsync({
        contratoId,
        resultado,
        nota,
        volverALlamarAt: resultado === 'volver_a_llamar' ? new Date(volverAt).toISOString() : null,
      });
      let reprogramada = false;
      if (conReprogramar) {
        try {
          await reprogramar.mutateAsync({ id: contratoId, verificacionAt: new Date(verificacionAt).toISOString() });
          reprogramada = true;
        } catch (e) {
          toast.error(`Llamada registrada, pero no se ha podido reprogramar: ${mensajeError(e)}`);
        }
      }
      toast.success(
        resultado === 'firmado'
          ? 'Llamada registrada y contrato marcado como firmado'
          : reprogramada
            ? `No contesta · verificación reprogramada para ${fechaHoraCorta(new Date(verificacionAt))}`
            : 'Llamada registrada',
      );
      onRegistrada?.(resultado);
      setResultado(null);
      setNota('');
      setVolverAt(manana10());
      setVerificacionAt(enUnaHora());
    } catch (e) {
      toast.error(mensajeError(e));
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {LISTA_RESULTADOS.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setResultado(r)}
            className={cn(
              'rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ring-inset transition',
              resultado === r ? 'bg-navy-900 text-white ring-navy-900' : RESULTADOS_LLAMADA[r].clase,
            )}
          >
            {RESULTADOS_LLAMADA[r].etiqueta}
          </button>
        ))}
      </div>
      {resultado === 'volver_a_llamar' && (
        <Field label="¿Cuándo volver a llamar?" required>
          <Input type="datetime-local" value={volverAt} onChange={(e) => setVolverAt(e.target.value)} />
        </Field>
      )}
      {verificacionPendiente && resultado === 'no_contesta' && (
        <div className="space-y-2.5 rounded-xl bg-sun-50/70 p-3 ring-1 ring-sun-200">
          <label className="flex items-center gap-2 text-sm font-semibold text-navy-900">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 accent-brand-600"
              checked={moverVerificacion}
              onChange={(e) => setMoverVerificacion(e.target.checked)}
            />
            Reprogramar también la verificación
          </label>
          {moverVerificacion && (
            <>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { etiqueta: '+15 min', fecha: addMinutes(new Date(), 15) },
                  { etiqueta: '+1 hora', fecha: addMinutes(new Date(), 60) },
                  { etiqueta: 'Mañana 10:00', fecha: new Date(manana10()) },
                ].map((a) => (
                  <button
                    key={a.etiqueta}
                    type="button"
                    onClick={() => setVerificacionAt(aFechaHoraLocal(a.fecha))}
                    className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-navy-700 ring-1 ring-inset ring-navy-100 transition hover:bg-navy-50"
                  >
                    {a.etiqueta}
                  </button>
                ))}
              </div>
              <Field
                label="Nueva hora de la verificación"
                required
                error={fueraDePlazo ? 'Tiene que ser como tarde el día de la instalación.' : undefined}
              >
                <Input
                  type="datetime-local"
                  value={verificacionAt}
                  onChange={(e) => setVerificacionAt(e.target.value)}
                  invalid={fueraDePlazo}
                  max={contrato?.instalacion_fecha ? `${contrato.instalacion_fecha}T23:59` : undefined}
                />
              </Field>
            </>
          )}
        </div>
      )}
      <Textarea rows={2} value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Nota de la llamada (opcional)" className="min-h-[60px]" />
      <Button
        className="w-full"
        onClick={guardar}
        loading={registrar.isPending || reprogramar.isPending}
        disabled={!resultado || fueraDePlazo}
        icon={<PhoneCall className="h-4 w-4" />}
      >
        {conReprogramar ? 'Registrar y reprogramar' : 'Registrar llamada'}
      </Button>
    </div>
  );
}

export function ListaLlamadas({ contratoId }: { contratoId: string }) {
  const llamadas = useLlamadas(contratoId);
  if (llamadas.isLoading) {
    return (
      <div className="flex justify-center py-6">
        <Spinner />
      </div>
    );
  }
  const items = llamadas.data ?? [];
  if (!items.length) return <p className="text-sm text-slate-500">Todavía no se ha registrado ninguna llamada.</p>;

  return (
    <ul className="space-y-3">
      {items.map((l) => (
        <li key={l.id} className="rounded-xl bg-slate-50 px-3.5 py-3 ring-1 ring-slate-200/70">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Badge className={RESULTADOS_LLAMADA[l.resultado].clase}>{RESULTADOS_LLAMADA[l.resultado].etiqueta}</Badge>
            <span className="text-xs text-slate-500">{fechaHoraCorta(l.created_at)}</span>
          </div>
          {l.volver_a_llamar_at && (
            <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-sun-700">
              <AlarmClock className="h-3.5 w-3.5" /> Volver a llamar: {fechaHoraCorta(l.volver_a_llamar_at)}
            </p>
          )}
          {l.nota && <p className="mt-1.5 whitespace-pre-wrap text-sm text-slate-700">{l.nota}</p>}
          <p className="mt-1.5 text-[11px] text-slate-400">{l.usuario_nombre ?? '—'}</p>
        </li>
      ))}
    </ul>
  );
}
