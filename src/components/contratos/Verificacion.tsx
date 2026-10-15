import { addDays, addMinutes, format, setHours, setMinutes } from 'date-fns';
import { CalendarClock, CheckCircle2, RotateCcw, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { useMarcarVerificacion, useReprogramarVerificacion } from '@/hooks/mutaciones';
import { fechaHoraCorta, fechaLarga, nombreCliente } from '@/lib/format';
import type { Contrato } from '@/lib/types';
import { cn, mensajeError } from '@/lib/utils';
import { aFechaHoraLocal, ESTADOS_VERIFICACION, type EstadoVerificacion } from '@/lib/verificaciones';

export function EstadoVerificacionBadge({ estado, className }: { estado: EstadoVerificacion; className?: string }) {
  const cfg = ESTADOS_VERIFICACION[estado];
  return (
    <Badge className={cn(cfg.badge, className)} icon={estado === 'hecha' ? <CheckCircle2 className="h-3 w-3" /> : undefined}>
      {estado !== 'hecha' && <span className={cn('h-1.5 w-1.5 rounded-full', cfg.barra)} />}
      {cfg.etiqueta}
    </Badge>
  );
}

/** «Verificada por Gabriela Santamaria · hoy, 10:34» */
export function TextoVerificada({ contrato, className }: { contrato: Contrato; className?: string }) {
  if (!contrato.verificacion_hecha_at) return null;
  return (
    <p className={cn('inline-flex items-center gap-1 text-xs font-semibold text-brand-700', className)}>
      <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
      <span>
        Verificada{contrato.verificacion_hecha_por_nombre ? ` por ${contrato.verificacion_hecha_por_nombre}` : ''} ·{' '}
        {fechaHoraCorta(contrato.verificacion_hecha_at)}
      </span>
    </p>
  );
}

/** Botón «Hecha» con opción de deshacer desde el aviso. */
export function BotonVerificada({
  contrato,
  size = 'sm',
  etiqueta = 'Hecha',
  className,
  onHecha,
}: {
  contrato: Contrato;
  size?: 'sm' | 'md' | 'lg';
  etiqueta?: string;
  className?: string;
  onHecha?: () => void;
}) {
  const marcar = useMarcarVerificacion();

  async function hecha() {
    try {
      await marcar.mutateAsync({ id: contrato.id, hecha: true });
      onHecha?.();
      toast.success(`Verificación de ${nombreCliente(contrato)} hecha`, {
        action: {
          label: 'Deshacer',
          onClick: () =>
            marcar.mutate(
              { id: contrato.id, hecha: false },
              { onError: (e) => toast.error(mensajeError(e)) },
            ),
        },
      });
    } catch (e) {
      toast.error(mensajeError(e));
    }
  }

  return (
    <Button
      size={size}
      className={className}
      onClick={hecha}
      loading={marcar.isPending}
      icon={<CheckCircle2 className={size === 'lg' ? 'h-5 w-5' : 'h-4 w-4'} />}
    >
      {etiqueta}
    </Button>
  );
}

export function BotonDeshacerVerificada({ contrato }: { contrato: Contrato }) {
  const marcar = useMarcarVerificacion();
  return (
    <Button
      size="sm"
      variant="ghost"
      loading={marcar.isPending}
      icon={<RotateCcw className="h-3.5 w-3.5" />}
      onClick={() =>
        marcar.mutate(
          { id: contrato.id, hecha: false },
          {
            onSuccess: () => toast.success('La verificación vuelve a estar pendiente'),
            onError: (e) => toast.error(mensajeError(e)),
          },
        )
      }
    >
      Deshacer
    </Button>
  );
}

export function BotonReprogramar({
  contrato,
  soloIcono,
  size = 'sm',
}: {
  contrato: Contrato;
  soloIcono?: boolean;
  size?: 'sm' | 'md';
}) {
  const [abierto, setAbierto] = useState(false);
  const etiqueta = contrato.verificacion_at ? 'Reprogramar' : 'Programar';
  return (
    <>
      <Button
        size={size}
        variant="secondary"
        icon={<CalendarClock className={size === 'md' ? 'h-4 w-4' : 'h-3.5 w-3.5'} />}
        onClick={() => setAbierto(true)}
        title={`${etiqueta} la verificación`}
        aria-label={soloIcono ? `${etiqueta} la verificación` : undefined}
        className={soloIcono ? 'px-2' : undefined}
      >
        {soloIcono ? null : etiqueta}
      </Button>
      {abierto && <ReprogramarVerificacionModal contrato={contrato} onClose={() => setAbierto(false)} />}
    </>
  );
}

/** Acciones de la verificación para backoffice: hecha / reprogramar / deshacer. */
export function AccionesVerificacion({ contrato, className }: { contrato: Contrato; className?: string }) {
  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      {contrato.verificacion_at &&
        (contrato.verificacion_hecha_at ? <BotonDeshacerVerificada contrato={contrato} /> : <BotonVerificada contrato={contrato} />)}
      <BotonReprogramar contrato={contrato} />
    </div>
  );
}

function enPunto(d: Date, h: number, m = 0): Date {
  return setMinutes(setHours(d, h), m);
}

export function ReprogramarVerificacionModal({ contrato, onClose }: { contrato: Contrato; onClose: () => void }) {
  const reprogramar = useReprogramarVerificacion();
  const ahora = new Date();
  const base = contrato.verificacion_at && new Date(contrato.verificacion_at) > ahora ? new Date(contrato.verificacion_at) : ahora;
  const [valor, setValor] = useState(aFechaHoraLocal(contrato.verificacion_at ? base : addMinutes(ahora, 30)));

  const atajos: { etiqueta: string; fecha: Date }[] = [
    { etiqueta: '+15 min', fecha: addMinutes(base, 15) },
    { etiqueta: '+1 hora', fecha: addMinutes(base, 60) },
    { etiqueta: 'Esta tarde 17:00', fecha: enPunto(ahora, 17) },
    { etiqueta: 'Mañana 10:00', fecha: enPunto(addDays(ahora, 1), 10) },
  ].filter((a) => a.fecha > ahora);

  const elegido = valor ? new Date(valor) : null;
  const error = !elegido
    ? 'Indica fecha y hora'
    : contrato.instalacion_fecha && format(elegido, 'yyyy-MM-dd') > contrato.instalacion_fecha
      ? `Tiene que ser como tarde el día de la instalación (${fechaLarga(contrato.instalacion_fecha)}).`
      : null;

  async function guardar() {
    if (error || !elegido) return;
    try {
      await reprogramar.mutateAsync({ id: contrato.id, verificacionAt: elegido.toISOString() });
      toast.success(`Verificación de ${nombreCliente(contrato)} para ${fechaHoraCorta(elegido)}`);
      onClose();
    } catch (e) {
      toast.error(mensajeError(e));
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      icon={<CalendarClock className="h-5 w-5" />}
      title={contrato.verificacion_at ? 'Reprogramar verificación' : 'Programar verificación'}
      description={nombreCliente(contrato)}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={guardar} loading={reprogramar.isPending} disabled={!!error}>
            Guardar
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {contrato.verificacion_at && (
          <p className="text-sm text-slate-600">
            Ahora está para <strong className="text-navy-900">{fechaHoraCorta(contrato.verificacion_at)}</strong>.
            {contrato.verificacion_hecha_at && ' Al cambiar la hora vuelve a quedar pendiente.'}
          </p>
        )}
        {atajos.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {atajos.map((a) => (
              <button
                key={a.etiqueta}
                type="button"
                onClick={() => setValor(aFechaHoraLocal(a.fecha))}
                className="rounded-full bg-navy-50 px-3 py-1.5 text-xs font-semibold text-navy-700 ring-1 ring-inset ring-navy-100 transition hover:bg-navy-100"
              >
                {a.etiqueta}
              </button>
            ))}
          </div>
        )}
        <Field
          label="Nueva fecha y hora"
          required
          error={valor ? (error ?? undefined) : undefined}
          hint={contrato.instalacion_fecha ? `Instalación: ${fechaLarga(contrato.instalacion_fecha)}` : undefined}
        >
          <Input
            type="datetime-local"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            invalid={!!valor && !!error}
            max={contrato.instalacion_fecha ? `${contrato.instalacion_fecha}T23:59` : undefined}
          />
        </Field>
      </div>
    </Modal>
  );
}
