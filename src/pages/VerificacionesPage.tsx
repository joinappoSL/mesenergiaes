import { addDays, addWeeks, format, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  AlarmClock,
  ArrowLeft,
  ArrowRight,
  BellRing,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Headphones,
  ListOrdered,
  LogOut,
  Phone,
  PlayCircle,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ContratoDetalle } from '@/components/contratos/ContratoDetalle';
import {
  BotonDeshacerVerificada,
  BotonReprogramar,
  BotonVerificada,
  EstadoVerificacionBadge,
  TextoVerificada,
} from '@/components/contratos/Verificacion';
import { useEnDirecto } from '@/components/layout/AppLayout';
import { EstadoBadge, FirmaBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Aviso, EmptyState, ErrorState, PageLoader, Skeleton } from '@/components/ui/Feedback';
import { PageHeader, Tabs } from '@/components/ui/Misc';
import { useContrato, useVerificaciones, useVerificacionesAtrasadas } from '@/hooks/datos';
import { useAhora, useHoy } from '@/hooks/useAhora';
import { useEstadoPersistente } from '@/hooks/useEstadoPersistente';
import { RESULTADOS_LLAMADA } from '@/lib/constants';
import { diaRelativo, fechaHoraCorta, hora, nombreCliente, numeroContrato, telefono } from '@/lib/format';
import type { Contrato } from '@/lib/types';
import { cn, mensajeError } from '@/lib/utils';
import {
  agruparPorDia,
  AVISO_PREVIO_MIN,
  claveDia,
  cuentaAtras,
  cuentaAtrasCorta,
  diasHastaInstalacion,
  diasSemana,
  ESTADOS_VERIFICACION,
  estadoVerificacion,
  etiquetaDia,
  etiquetaSemana,
  ordenarPorHora,
  rangoSemana,
  reloj,
  type EstadoVerificacion,
} from '@/lib/verificaciones';

const DIAS_AGENDA = 14;
const CLAVE_TRABAJO = 'mes-verificaciones-trabajo';

type Vista = 'agenda' | 'semana';

function guardarSnapshot(ids: string[]) {
  try {
    sessionStorage.setItem(CLAVE_TRABAJO, JSON.stringify(ids));
  } catch {
    // sin almacenamiento: el orden se recalcula al vuelo
  }
}

function leerSnapshot(): string[] {
  try {
    return JSON.parse(sessionStorage.getItem(CLAVE_TRABAJO) ?? '[]') as string[];
  } catch {
    return [];
  }
}

/** Atrasadas de días anteriores + las de hoy y los próximos días. */
function useAgenda(activo = true) {
  const hoy = useHoy();
  const hasta = useMemo(() => addDays(hoy.inicio, DIAS_AGENDA), [hoy.inicio]);
  const atrasadas = useVerificacionesAtrasadas(hoy.inicio, activo);
  const proximas = useVerificaciones(hoy.inicio, hasta, activo);
  const pendientes = useMemo(
    () => ordenarPorHora([...(atrasadas.data ?? []), ...(proximas.data ?? [])].filter((c) => !c.verificacion_hecha_at)),
    [atrasadas.data, proximas.data],
  );
  return { hoy, atrasadas, proximas, pendientes };
}

/** Aviso en pantalla 5 minutos antes y a la hora de cada verificación pendiente. */
function useAvisosVerificacion(pendientes: Contrato[], ahora: Date, onAtender: (id: string) => void) {
  const anterior = useRef(ahora.getTime());
  const avisados = useRef(new Set<string>());
  const atender = useRef(onAtender);
  atender.current = onAtender;

  useEffect(() => {
    const desde = anterior.current;
    const hasta = ahora.getTime();
    anterior.current = hasta;
    // Si la pestaña ha estado dormida un buen rato, no se avisa de golpe de todo.
    if (hasta <= desde || hasta - desde > 5 * 60_000) return;

    for (const c of pendientes) {
      const t = new Date(c.verificacion_at!).getTime();
      const previo = t - AVISO_PREVIO_MIN * 60_000;
      if (previo > desde && previo <= hasta && !avisados.current.has(`previo-${c.id}`)) {
        avisados.current.add(`previo-${c.id}`);
        toast(`En ${AVISO_PREVIO_MIN} min: verificación de ${nombreCliente(c)}`, {
          description: `${hora(c.verificacion_at!)} · ${c.producto ?? c.operadora}`,
          icon: <BellRing className="h-4 w-4 text-navy-600" />,
        });
      }
      if (t > desde && t <= hasta && !avisados.current.has(`hora-${c.id}`)) {
        avisados.current.add(`hora-${c.id}`);
        toast.warning(`Toca verificar a ${nombreCliente(c)}`, {
          description: `${hora(c.verificacion_at!)} · ${numeroContrato(c.numero)}`,
          duration: 60_000,
          action: { label: 'Atender', onClick: () => atender.current(c.id) },
        });
      }
    }
  }, [ahora, pendientes]);
}

// -----------------------------------------------------------------------------
// Piezas
// -----------------------------------------------------------------------------
function BotonTelefono({ numero, className }: { numero: string; className?: string }) {
  return (
    <a
      href={`tel:${numero}`}
      className={cn(
        'inline-flex h-8 items-center gap-1.5 rounded-lg bg-brand-50 px-3 font-mono text-[13px] font-semibold text-brand-800 ring-1 ring-brand-200 transition hover:bg-brand-100',
        className,
      )}
    >
      <Phone className="h-3.5 w-3.5" /> {telefono(numero)}
    </a>
  );
}

function LineaAhora({ ahora }: { ahora: Date }) {
  return (
    <li className="flex items-center gap-2 px-4 py-1 sm:px-5" aria-label={`Ahora, ${hora(ahora)}`}>
      <span className="w-16 shrink-0 text-right text-[11px] font-bold tabular-nums text-red-600">{hora(ahora)}</span>
      <span className="h-2 w-2 shrink-0 rounded-full bg-red-500" />
      <span className="h-px flex-1 bg-red-400" />
    </li>
  );
}

/** Coloca la línea de «ahora» entre las verificaciones ya pasadas y las siguientes. */
function conLineaAhora<T extends Contrato>(items: T[], ahora: Date, render: (c: T) => ReactNode, linea: ReactNode): ReactNode[] {
  const i = items.findIndex((c) => new Date(c.verificacion_at!) > ahora);
  const nodos = items.map(render);
  nodos.splice(i === -1 ? nodos.length : i, 0, linea);
  return nodos;
}

function FilaVerificacion({
  c,
  ahora,
  onAtender,
  conFecha,
}: {
  c: Contrato;
  ahora: Date;
  onAtender: () => void;
  conFecha?: boolean;
}) {
  const estado = estadoVerificacion(c, ahora);
  const cfg = ESTADOS_VERIFICACION[estado];
  const t = new Date(c.verificacion_at!);
  const dInstalacion = diasHastaInstalacion(c, ahora);
  const instalacionCerca = dInstalacion !== null && dInstalacion <= 1 && estado !== 'hecha';

  return (
    <li
      className={cn(
        'flex flex-col gap-3 px-4 py-3.5 transition sm:flex-row sm:items-center sm:px-5',
        estado === 'ahora' && 'bg-sun-50/70',
        estado === 'retrasada' && 'bg-red-50/40',
      )}
    >
      <div className="flex min-w-0 flex-1 items-stretch gap-3">
        <div className="w-16 shrink-0 text-right">
          {conFecha && <p className="text-[11px] font-semibold uppercase text-slate-400">{format(t, 'd MMM', { locale: es })}</p>}
          <p
            className={cn(
              'text-lg font-semibold leading-tight tabular-nums',
              cfg.hora,
              estado === 'hecha' && 'line-through decoration-slate-300',
            )}
          >
            {hora(t)}
          </p>
          {estado !== 'hecha' && (
            <p className="whitespace-nowrap text-[11px] leading-tight text-slate-500">{cuentaAtrasCorta(t, ahora)}</p>
          )}
        </div>
        <span className={cn('w-1 shrink-0 rounded-full', cfg.barra)} />
        <div className={cn('min-w-0 flex-1', estado === 'hecha' && 'opacity-70')}>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={onAtender} className="truncate text-left font-semibold text-navy-900 hover:underline">
              {nombreCliente(c)}
            </button>
            <EstadoVerificacionBadge estado={estado} />
            {c.estado !== 'pendiente' && <EstadoBadge estado={c.estado} />}
            {c.firmado && <FirmaBadge firmado />}
          </div>
          <p className="mt-0.5 truncate text-xs text-slate-500">
            {numeroContrato(c.numero)} · {c.producto ?? c.operadora} · {c.comercial_nombre ?? 'Sin comercial'}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            {c.instalacion_fecha ? (
              <span className={cn('inline-flex items-center gap-1', instalacionCerca ? 'font-semibold text-orange-700' : 'text-slate-500')}>
                <CalendarClock className="h-3.5 w-3.5" /> Instalación {diaRelativo(c.instalacion_fecha).toLowerCase()}
                {c.instalacion_franja && ` · ${c.instalacion_franja}`}
              </span>
            ) : (
              <span className="text-slate-400">Sin fecha de instalación</span>
            )}
            {c.ultimo_resultado_llamada && (
              <span className="text-slate-500">
                Última llamada: <span className="font-semibold">{RESULTADOS_LLAMADA[c.ultimo_resultado_llamada].etiqueta}</span> ·{' '}
                {fechaHoraCorta(c.ultima_llamada_at)}
              </span>
            )}
            <TextoVerificada contrato={c} />
          </div>
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2 pl-[5.75rem] sm:pl-0">
        <BotonTelefono numero={c.telefono_contacto} />
        {estado === 'hecha' ? <BotonDeshacerVerificada contrato={c} /> : <BotonVerificada contrato={c} />}
        <BotonReprogramar contrato={c} soloIcono />
        <Button size="sm" variant="navy" onClick={onAtender} icon={<Headphones className="h-3.5 w-3.5" />}>
          Atender
        </Button>
      </div>
    </li>
  );
}

function CabeceraDia({ titulo, info, tono }: { titulo: string; info?: string; tono?: 'hoy' | 'atrasadas' }) {
  return (
    <div
      className={cn(
        'sticky top-14 z-10 flex items-center justify-between gap-3 border-y border-slate-100 px-4 py-2 backdrop-blur sm:px-5 lg:top-0',
        tono === 'hoy' ? 'bg-brand-50/95' : tono === 'atrasadas' ? 'bg-red-50/95' : 'bg-slate-50/95',
      )}
    >
      <h2
        className={cn(
          'text-[13px] font-semibold first-letter:uppercase',
          tono === 'hoy' ? 'text-brand-800' : tono === 'atrasadas' ? 'text-red-700' : 'text-navy-900',
        )}
      >
        {titulo}
      </h2>
      {info && <span className="text-xs text-slate-500">{info}</span>}
    </div>
  );
}

function resumenDia(items: Contrato[]): string {
  const hechas = items.filter((c) => c.verificacion_hecha_at).length;
  const porHacer = items.length - hechas;
  return [porHacer && `${porHacer} por hacer`, hechas && `${hechas} ${hechas === 1 ? 'hecha' : 'hechas'}`].filter(Boolean).join(' · ');
}

function ProximaVerificacion({
  c,
  totalPendientes,
  onAtender,
}: {
  c: Contrato | null;
  totalPendientes: number;
  onAtender: () => void;
}) {
  const ahora = useAhora(1000);

  if (!c) {
    return (
      <Card className="mb-5 flex items-center gap-4 p-5">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
          <CheckCircle2 className="h-6 w-6" />
        </span>
        <div>
          <p className="font-semibold text-navy-900">Todo al día</p>
          <p className="text-sm text-slate-500">No hay verificaciones pendientes en los próximos {DIAS_AGENDA} días.</p>
        </div>
      </Card>
    );
  }

  const estado = estadoVerificacion(c, ahora);
  const t = new Date(c.verificacion_at!);
  const falta = t.getTime() - ahora.getTime();
  const titulo: Record<EstadoVerificacion, string> = {
    retrasada: 'Verificación retrasada',
    ahora: 'Ahora toca verificar',
    proxima: 'Siguiente verificación',
    hecha: 'Verificada',
  };
  const dInstalacion = diasHastaInstalacion(c, ahora);

  return (
    <div className="relative mb-5 overflow-hidden rounded-2xl bg-navy-950 p-5 text-white shadow-lg shadow-navy-900/20 sm:p-6">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -right-16 -top-20 h-56 w-56 rounded-full bg-brand-500/15 blur-3xl" />
        <div className="absolute -bottom-24 left-10 h-56 w-56 rounded-full bg-sun-400/10 blur-3xl" />
      </div>
      <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center">
        <div className="flex items-center gap-4 lg:w-64 lg:shrink-0">
          <span
            className={cn(
              'flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl',
              estado === 'retrasada' ? 'bg-red-500/20 text-red-300' : estado === 'ahora' ? 'bg-sun-400 text-navy-950' : 'bg-white/10 text-sun-300',
            )}
          >
            {estado === 'proxima' ? <AlarmClock className="h-7 w-7" /> : <BellRing className="h-7 w-7 animate-pulse-soft" />}
          </span>
          <div className="min-w-0">
            <p
              className={cn(
                'text-[11px] font-semibold uppercase tracking-[0.16em]',
                estado === 'retrasada' ? 'text-red-300' : estado === 'ahora' ? 'text-sun-300' : 'text-navy-200',
              )}
            >
              {titulo[estado]}
            </p>
            <p className="font-mono text-[28px] font-semibold leading-tight tabular-nums">
              {estado === 'proxima' && falta < 3_600_000 ? reloj(t, ahora) : cuentaAtras(t, ahora)}
            </p>
            <p className="text-xs text-navy-200 first-letter:uppercase">{fechaHoraCorta(t)}</p>
          </div>
        </div>
        <div className="min-w-0 flex-1 lg:border-l lg:border-white/10 lg:pl-6">
          <p className="truncate text-xl font-semibold">{nombreCliente(c)}</p>
          <p className="mt-0.5 truncate text-sm text-navy-200">
            {numeroContrato(c.numero)} · {c.producto ?? c.operadora} · {c.comercial_nombre ?? 'Sin comercial'}
          </p>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-navy-200">
            {c.instalacion_fecha && (
              <span className={cn('inline-flex items-center gap-1', dInstalacion !== null && dInstalacion <= 1 && 'font-semibold text-sun-300')}>
                <CalendarClock className="h-3.5 w-3.5" /> Instalación {diaRelativo(c.instalacion_fecha).toLowerCase()}
                {c.instalacion_franja && ` · ${c.instalacion_franja}`}
              </span>
            )}
            {totalPendientes > 1 && <span>Después quedan {totalPendientes - 1} más</span>}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href={`tel:${c.telefono_contacto}`}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-white px-4 font-mono text-sm font-semibold text-navy-900 transition hover:bg-brand-50"
          >
            <Phone className="h-4 w-4 text-brand-600" /> {telefono(c.telefono_contacto)}
          </a>
          <BotonVerificada contrato={c} size="md" />
          <Button variant="warning" onClick={onAtender} icon={<Headphones className="h-4 w-4" />}>
            Atender
          </Button>
        </div>
      </div>
    </div>
  );
}

function Indicador({
  icon,
  titulo,
  valor,
  className,
}: {
  icon: ReactNode;
  titulo: string;
  valor: number;
  className?: string;
}) {
  return (
    <Card className="p-4">
      <p className={cn('flex items-center gap-1.5 text-xs font-semibold', className)}>
        {icon} {titulo}
      </p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-navy-900">{valor}</p>
    </Card>
  );
}

// -----------------------------------------------------------------------------
// Vista agenda: todo en orden de hora, por días
// -----------------------------------------------------------------------------
function VistaAgenda({
  atrasadas,
  proximas,
  inicioHoy,
  ahora,
  onAtender,
}: {
  atrasadas: Contrato[];
  proximas: Contrato[];
  inicioHoy: Date;
  ahora: Date;
  onAtender: (id: string, orden: Contrato[]) => void;
}) {
  const orden = useMemo(() => [...ordenarPorHora(atrasadas), ...ordenarPorHora(proximas)], [atrasadas, proximas]);
  const dias = useMemo(() => {
    const lista = agruparPorDia(proximas);
    const hoy = claveDia(inicioHoy);
    if (!lista.some((d) => d.dia === hoy)) lista.unshift({ dia: hoy, items: [] });
    return lista;
  }, [proximas, inicioHoy]);
  const claveHoy = claveDia(inicioHoy);

  return (
    <Card className="overflow-clip">
      {atrasadas.length > 0 && (
        <section>
          <CabeceraDia
            titulo="De días anteriores, sin hacer"
            info={`${atrasadas.length} ${atrasadas.length === 1 ? 'atrasada' : 'atrasadas'}`}
            tono="atrasadas"
          />
          <ul className="divide-y divide-slate-100">
            {ordenarPorHora(atrasadas).map((c) => (
              <FilaVerificacion key={c.id} c={c} ahora={ahora} conFecha onAtender={() => onAtender(c.id, orden)} />
            ))}
          </ul>
        </section>
      )}
      {dias.map((d) => {
        const esHoy = d.dia === claveHoy;
        const fila = (c: Contrato) => <FilaVerificacion key={c.id} c={c} ahora={ahora} onAtender={() => onAtender(c.id, orden)} />;
        return (
          <section key={d.dia}>
            <CabeceraDia titulo={etiquetaDia(d.dia, ahora)} info={resumenDia(d.items)} tono={esHoy ? 'hoy' : undefined} />
            {d.items.length === 0 ? (
              <p className="px-5 py-5 text-sm text-slate-500">Hoy no hay verificaciones programadas.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {esHoy ? conLineaAhora(d.items, ahora, fila, <LineaAhora key="ahora" ahora={ahora} />) : d.items.map(fila)}
              </ul>
            )}
          </section>
        );
      })}
      <p className="border-t border-slate-100 px-5 py-3 text-xs text-slate-400">
        Hoy y los próximos {DIAS_AGENDA - 1} días. Para ver más adelante, usa la vista Semana.
      </p>
    </Card>
  );
}

// -----------------------------------------------------------------------------
// Vista semana: calendario de lunes a domingo
// -----------------------------------------------------------------------------
const CHIP_SEMANA: Record<EstadoVerificacion, string> = {
  hecha: 'bg-brand-50/70 ring-brand-100 opacity-75',
  ahora: 'bg-sun-50 ring-sun-300',
  retrasada: 'bg-red-50 ring-red-200',
  proxima: 'bg-white ring-slate-200',
};

function TarjetaSemana({ c, ahora, onClick }: { c: Contrato; ahora: Date; onClick: () => void }) {
  const estado = estadoVerificacion(c, ahora);
  return (
    <button
      type="button"
      onClick={onClick}
      title={`${hora(c.verificacion_at!)} · ${nombreCliente(c)} · ${ESTADOS_VERIFICACION[estado].etiqueta}`}
      className={cn('block w-full rounded-lg px-2 py-1.5 text-left ring-1 ring-inset transition hover:shadow-sm', CHIP_SEMANA[estado])}
    >
      <span className="flex items-center gap-1.5">
        <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', ESTADOS_VERIFICACION[estado].barra)} />
        <span className={cn('text-xs font-bold tabular-nums', ESTADOS_VERIFICACION[estado].hora)}>{hora(c.verificacion_at!)}</span>
        {estado === 'hecha' && <CheckCircle2 className="h-3 w-3 text-brand-600" />}
      </span>
      <span className="block truncate text-[13px] font-semibold text-navy-900">{nombreCliente(c)}</span>
      <span className="block truncate text-[11px] text-slate-500">{c.producto ?? c.operadora}</span>
    </button>
  );
}

function VistaSemana({
  semana,
  onCambiarSemana,
  items,
  cargando,
  ahora,
  onAtender,
}: {
  semana: Date;
  onCambiarSemana: (d: Date) => void;
  items: Contrato[];
  cargando: boolean;
  ahora: Date;
  onAtender: (id: string, orden: Contrato[]) => void;
}) {
  const orden = useMemo(() => ordenarPorHora(items), [items]);
  const porDia = useMemo(() => new Map(agruparPorDia(items).map((d) => [d.dia, d.items])), [items]);
  const pendientes = items.filter((c) => !c.verificacion_hecha_at).length;

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <div className="flex items-center gap-1.5">
          <Button
            variant="secondary"
            size="sm"
            icon={<ChevronLeft className="h-4 w-4" />}
            aria-label="Semana anterior"
            onClick={() => onCambiarSemana(addWeeks(semana, -1))}
          />
          <Button variant="secondary" size="sm" onClick={() => onCambiarSemana(new Date())}>
            Hoy
          </Button>
          <Button
            variant="secondary"
            size="sm"
            icon={<ChevronRight className="h-4 w-4" />}
            aria-label="Semana siguiente"
            onClick={() => onCambiarSemana(addWeeks(semana, 1))}
          />
          <p className="ml-2 text-sm font-semibold text-navy-900">{etiquetaSemana(semana)}</p>
        </div>
        <p className="text-xs text-slate-500">
          {items.length} {items.length === 1 ? 'verificación' : 'verificaciones'} · {pendientes} por hacer
        </p>
      </div>
      <div className={cn('grid grid-cols-1 divide-y divide-slate-100 md:grid-cols-7 md:divide-x md:divide-y-0', cargando && 'opacity-60')}>
        {diasSemana(semana).map((d) => {
          const k = claveDia(d);
          const lista = porDia.get(k) ?? [];
          const esHoy = isSameDay(d, ahora);
          const tarjeta = (c: Contrato) => <TarjetaSemana key={c.id} c={c} ahora={ahora} onClick={() => onAtender(c.id, orden)} />;
          return (
            <div key={k} className={cn('min-w-0 md:min-h-[440px]', esHoy && 'bg-brand-50/40')}>
              <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-3 py-2">
                <p className="flex items-center gap-1.5 text-xs font-semibold uppercase text-slate-500">
                  {format(d, 'EEE', { locale: es })}
                  <span
                    className={cn(
                      'inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-sm',
                      esHoy ? 'bg-brand-600 text-white' : 'text-navy-900',
                    )}
                  >
                    {format(d, 'd')}
                  </span>
                </p>
                {lista.length > 0 && (
                  <span className="rounded-full bg-slate-100 px-2 text-[11px] font-bold text-slate-600">{lista.length}</span>
                )}
              </div>
              <div className="space-y-1.5 p-2">
                {lista.length === 0 && <p className="px-1 py-1 text-xs text-slate-300 md:py-3 md:text-center">Sin verificaciones</p>}
                {esHoy && lista.length > 0
                  ? conLineaAhora(
                      lista,
                      ahora,
                      tarjeta,
                      <div key="ahora" className="flex items-center gap-1" aria-label={`Ahora, ${hora(ahora)}`}>
                        <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                        <span className="h-px flex-1 bg-red-400" />
                        <span className="text-[10px] font-bold tabular-nums text-red-600">{hora(ahora)}</span>
                      </div>,
                    )
                  : lista.map(tarjeta)}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// -----------------------------------------------------------------------------
// Página
// -----------------------------------------------------------------------------
export function VerificacionesPage() {
  const navigate = useNavigate();
  const ahora = useAhora(15_000);
  const enDirecto = useEnDirecto();
  const [opciones, setOpciones] = useEstadoPersistente<{ vista: Vista }>('mes-verificaciones-vista', { vista: 'agenda' }, 'local');
  const [semana, setSemana] = useState(() => new Date());
  const { hoy, atrasadas, proximas, pendientes } = useAgenda();
  const rango = useMemo(() => rangoSemana(semana), [semana]);
  const deLaSemana = useVerificaciones(rango.desde, rango.hasta, opciones.vista === 'semana');

  const listaAtrasadas = useMemo(() => atrasadas.data ?? [], [atrasadas.data]);
  const listaProximas = useMemo(() => proximas.data ?? [], [proximas.data]);

  const resumen = useMemo(() => {
    const deHoy = listaProximas.filter((c) => new Date(c.verificacion_at!) < hoy.fin);
    const finSemana = addDays(hoy.inicio, 7);
    return {
      atrasadas: listaAtrasadas.length + deHoy.filter((c) => estadoVerificacion(c, ahora) === 'retrasada').length,
      porHacerHoy: deHoy.filter((c) => ['ahora', 'proxima'].includes(estadoVerificacion(c, ahora))).length,
      hechasHoy: deHoy.filter((c) => c.verificacion_hecha_at).length,
      proximos7: listaProximas.filter(
        (c) => !c.verificacion_hecha_at && new Date(c.verificacion_at!) >= hoy.fin && new Date(c.verificacion_at!) < finSemana,
      ).length,
    };
  }, [listaAtrasadas, listaProximas, hoy, ahora]);

  function abrir(id: string, orden: Contrato[]) {
    guardarSnapshot(orden.map((c) => c.id));
    navigate(`/verificaciones/${id}`);
  }

  // Modo llamada con las pendientes en orden (retrasadas primero).
  function atenderPendiente(id: string) {
    abrir(id, pendientes);
  }

  useAvisosVerificacion(pendientes, ahora, atenderPendiente);

  const cargando = atrasadas.isLoading || proximas.isLoading;
  const error = atrasadas.error ?? proximas.error;

  return (
    <div>
      <PageHeader
        titulo="Calendario de verificaciones"
        subtitulo={
          <span className="inline-flex flex-wrap items-center gap-x-2">
            Llamadas de verificación por orden de hora.
            <span className="inline-flex items-center gap-1.5 font-medium">
              <span className={cn('h-2 w-2 rounded-full', enDirecto ? 'bg-brand-500 animate-pulse-soft' : 'bg-slate-300')} />
              {enDirecto ? 'En directo' : 'Conectando…'}
            </span>
          </span>
        }
        acciones={
          <>
            <Tabs
              value={opciones.vista}
              onChange={(vista) => setOpciones({ vista })}
              tabs={[
                { value: 'agenda', label: <><ListOrdered className="h-3.5 w-3.5" /> Agenda</> },
                { value: 'semana', label: <><CalendarDays className="h-3.5 w-3.5" /> Semana</> },
              ]}
            />
            <Button
              variant="secondary"
              icon={<RefreshCw className={cn('h-4 w-4', (proximas.isFetching || deLaSemana.isFetching) && 'animate-spin')} />}
              onClick={() => {
                atrasadas.refetch();
                proximas.refetch();
                if (opciones.vista === 'semana') deLaSemana.refetch();
              }}
            >
              Actualizar
            </Button>
            <Button
              icon={<PlayCircle className="h-5 w-5" />}
              disabled={!pendientes.length}
              onClick={() => pendientes[0] && atenderPendiente(pendientes[0].id)}
            >
              Empezar a llamar
            </Button>
          </>
        }
      />

      {error ? (
        <ErrorState
          mensaje={mensajeError(error)}
          onRetry={() => {
            atrasadas.refetch();
            proximas.refetch();
          }}
        />
      ) : cargando ? (
        <div className="space-y-3">
          <Skeleton className="h-36" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      ) : (
        <>
          <ProximaVerificacion
            c={pendientes[0] ?? null}
            totalPendientes={pendientes.length}
            onAtender={() => pendientes[0] && atenderPendiente(pendientes[0].id)}
          />

          <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Indicador icon={<AlarmClock className="h-3.5 w-3.5" />} titulo="Atrasadas" valor={resumen.atrasadas} className="text-red-600" />
            <Indicador
              icon={<Phone className="h-3.5 w-3.5" />}
              titulo="Por hacer hoy"
              valor={resumen.porHacerHoy}
              className="text-sun-700"
            />
            <Indicador
              icon={<ShieldCheck className="h-3.5 w-3.5" />}
              titulo="Hechas hoy"
              valor={resumen.hechasHoy}
              className="text-brand-700"
            />
            <Indicador
              icon={<CalendarDays className="h-3.5 w-3.5" />}
              titulo="Próximos 7 días"
              valor={resumen.proximos7}
              className="text-navy-600"
            />
          </div>

          {opciones.vista === 'agenda' ? (
            listaAtrasadas.length === 0 && listaProximas.length === 0 ? (
              <Card>
                <EmptyState
                  icon={<CalendarDays className="h-6 w-6" />}
                  titulo="No hay verificaciones programadas"
                  texto="Cuando se suba un contrato con «Verificación programada», aparecerá aquí en su hora."
                />
              </Card>
            ) : (
              <VistaAgenda
                atrasadas={listaAtrasadas}
                proximas={listaProximas}
                inicioHoy={hoy.inicio}
                ahora={ahora}
                onAtender={abrir}
              />
            )
          ) : (
            <>
              {listaAtrasadas.length > 0 && (
                <Aviso tipo="warning" className="mb-4">
                  Hay {listaAtrasadas.length} {listaAtrasadas.length === 1 ? 'verificación atrasada' : 'verificaciones atrasadas'} de días
                  anteriores sin hacer.{' '}
                  <button type="button" className="font-semibold underline" onClick={() => setOpciones({ vista: 'agenda' })}>
                    Verlas en la agenda
                  </button>
                </Aviso>
              )}
              {deLaSemana.error ? (
                <ErrorState mensaje={mensajeError(deLaSemana.error)} onRetry={() => deLaSemana.refetch()} />
              ) : (
                <VistaSemana
                  semana={semana}
                  onCambiarSemana={setSemana}
                  items={deLaSemana.data ?? []}
                  cargando={deLaSemana.isLoading || deLaSemana.isPlaceholderData}
                  ahora={ahora}
                  onAtender={abrir}
                />
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

/** Modo llamada: la ficha completa con «Anterior / Siguiente» en el orden del calendario. */
export function VerificacionTrabajoPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const ahora = useAhora(15_000);
  const contrato = useContrato(id);
  const snapshot = leerSnapshot();
  const enSnapshot = snapshot.includes(id ?? '');
  const { pendientes } = useAgenda(!enSnapshot);

  const ids = enSnapshot ? snapshot : pendientes.map((c) => c.id);
  const indice = ids.indexOf(id ?? '');
  const anterior = indice > 0 ? ids[indice - 1] : null;
  const siguiente = indice >= 0 && indice < ids.length - 1 ? ids[indice + 1] : null;

  function ir(destino: string | null) {
    if (!destino) return;
    guardarSnapshot(ids);
    navigate(`/verificaciones/${destino}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const c = contrato.data;
  const estado = c?.verificacion_at ? estadoVerificacion(c, ahora) : null;

  return (
    <div>
      <div className="sticky top-14 z-20 -mx-4 mb-5 border-b border-slate-200/70 bg-surface/90 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:top-0 lg:-mx-8 lg:px-8">
        <div className="flex items-center gap-3">
          <Link
            to="/verificaciones"
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-semibold text-slate-500 hover:bg-white hover:text-navy-900"
          >
            <LogOut className="h-4 w-4 rotate-180" /> <span className="hidden sm:inline">Volver al calendario</span>
          </Link>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-navy-900">
              {indice >= 0 ? `Verificación ${indice + 1} de ${ids.length}` : 'Verificación'}
              {c?.verificacion_at && <span className="font-normal text-slate-500"> · {fechaHoraCorta(c.verificacion_at)}</span>}
            </p>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-brand-500 transition-all"
                style={{ width: ids.length && indice >= 0 ? `${((indice + 1) / ids.length) * 100}%` : '0%' }}
              />
            </div>
          </div>
          <Button variant="secondary" size="md" onClick={() => ir(anterior)} disabled={!anterior} icon={<ArrowLeft className="h-4 w-4" />}>
            <span className="hidden sm:inline">Anterior</span>
          </Button>
          <Button size="md" onClick={() => ir(siguiente)} disabled={!siguiente}>
            <span className="hidden sm:inline">Siguiente</span> <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {contrato.isLoading ? (
        <PageLoader />
      ) : contrato.error ? (
        <ErrorState mensaje={mensajeError(contrato.error)} onRetry={() => contrato.refetch()} />
      ) : !c ? (
        <EmptyState icon={<Phone className="h-6 w-6" />} titulo="Contrato no encontrado" />
      ) : (
        <>
          {estado ? (
            <Card
              className={cn(
                'mb-5 flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:p-5',
                estado === 'hecha' && 'ring-brand-200',
                estado === 'ahora' && 'bg-sun-50/60 ring-sun-300',
                estado === 'retrasada' && 'ring-red-200',
              )}
            >
              <span
                className={cn(
                  'flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl',
                  estado === 'hecha' ? 'bg-brand-50 text-brand-600' : estado === 'retrasada' ? 'bg-red-50 text-red-600' : 'bg-sun-100 text-sun-700',
                )}
              >
                <ShieldCheck className="h-6 w-6" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Llamada de verificación</p>
                <p className="flex flex-wrap items-center gap-2 text-lg font-semibold text-navy-900">
                  <span className="first-letter:uppercase">{fechaHoraCorta(c.verificacion_at)}</span>
                  <EstadoVerificacionBadge estado={estado} />
                  {estado !== 'hecha' && <span className="text-sm font-normal text-slate-500">{cuentaAtras(c.verificacion_at!, ahora)}</span>}
                </p>
                <TextoVerificada contrato={c} className="mt-1" />
              </div>
              <div className="flex flex-wrap gap-2">
                {estado === 'hecha' ? (
                  <>
                    <BotonDeshacerVerificada contrato={c} />
                    {siguiente && (
                      <Button onClick={() => ir(siguiente)} icon={<ArrowRight className="h-4 w-4" />}>
                        Siguiente verificación
                      </Button>
                    )}
                  </>
                ) : (
                  <BotonVerificada contrato={c} size="md" etiqueta="Verificación hecha" />
                )}
                <BotonReprogramar contrato={c} size="md" />
              </div>
            </Card>
          ) : (
            <Aviso tipo="info" className="mb-4">
              Este contrato ya no tiene verificación programada. Pulsa «Siguiente» para continuar.
            </Aviso>
          )}
          {!siguiente && indice >= 0 && estado === 'hecha' && (
            <Aviso tipo="success" className="mb-4" titulo="Última verificación de la lista">
              Vuelve al calendario para ver si han entrado verificaciones nuevas.
            </Aviso>
          )}
          <ContratoDetalle contrato={c} sinAccionesVerificacion />
        </>
      )}
    </div>
  );
}
