import { AlarmClock, ArrowLeft, ArrowRight, CheckCircle2, Clock, Headphones, LogOut, Phone, PhoneCall, PlayCircle, RefreshCw } from 'lucide-react';
import { useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ContratoDetalle } from '@/components/contratos/ContratoDetalle';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Aviso, EmptyState, ErrorState, PageLoader, Skeleton } from '@/components/ui/Feedback';
import { Switch } from '@/components/ui/Field';
import { PageHeader } from '@/components/ui/Misc';
import { useCola, useContrato } from '@/hooks/datos';
import { useEstadoPersistente } from '@/hooks/useEstadoPersistente';
import { RESULTADOS_LLAMADA } from '@/lib/constants';
import { diasDesde, etiquetaDias, euros, fechaHoraCorta, haceCuanto, nombreCliente, numeroContrato, telefono } from '@/lib/format';
import type { Contrato } from '@/lib/types';
import { cn, mensajeError } from '@/lib/utils';

const CLAVE_COLA = 'mes-cola-trabajo';

function guardarSnapshot(ids: string[]) {
  try {
    sessionStorage.setItem(CLAVE_COLA, JSON.stringify(ids));
  } catch {
    // sin almacenamiento: la cola se recalcula al vuelo
  }
}

function leerSnapshot(): string[] {
  try {
    return JSON.parse(sessionStorage.getItem(CLAVE_COLA) ?? '[]') as string[];
  } catch {
    return [];
  }
}

type Grupo = 'vencido' | 'normal' | 'programado';

function grupoDe(c: Contrato): Grupo {
  if (!c.proxima_llamada_at) return 'normal';
  return new Date(c.proxima_llamada_at) <= new Date() ? 'vencido' : 'programado';
}

function colorDias(dias: number): string {
  if (dias >= 7) return 'bg-red-50 text-red-700 ring-red-200';
  if (dias >= 3) return 'bg-orange-50 text-orange-700 ring-orange-200';
  return 'bg-slate-100 text-slate-600 ring-slate-200';
}

function FilaCola({ c, posicion, onAbrir }: { c: Contrato; posicion: number; onAbrir: () => void }) {
  const grupo = grupoDe(c);
  const dias = diasDesde(c.created_at);
  return (
    <li
      className={cn(
        'group flex flex-col gap-3 px-4 py-4 transition hover:bg-slate-50/70 sm:flex-row sm:items-center sm:px-5',
        grupo === 'vencido' && 'bg-sun-50/50',
      )}
    >
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <span className="mt-0.5 w-6 shrink-0 text-right text-xs font-bold tabular-nums text-slate-400">{posicion}</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={onAbrir} className="truncate text-left font-semibold text-navy-900 hover:underline">
              {nombreCliente(c)}
            </button>
            <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-bold ring-1 ring-inset', colorDias(dias))}>
              {etiquetaDias(dias)}
            </span>
            {c.firmado && (
              <Badge className="bg-brand-50 text-brand-700 ring-brand-200" icon={<CheckCircle2 className="h-3 w-3" />}>
                Firmado
              </Badge>
            )}
          </div>
          <p className="mt-0.5 truncate text-xs text-slate-500">
            {numeroContrato(c.numero)} · {c.producto ?? c.operadora} · {euros(c.precio_mensual)} · {c.comercial_nombre ?? 'Sin comercial'}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
            {grupo === 'vencido' && (
              <span className="inline-flex items-center gap-1 font-semibold text-sun-700">
                <AlarmClock className="h-3.5 w-3.5" /> Volver a llamar · vencido {haceCuanto(c.proxima_llamada_at!)}
              </span>
            )}
            {grupo === 'programado' && (
              <span className="inline-flex items-center gap-1 font-semibold text-navy-600">
                <Clock className="h-3.5 w-3.5" /> Llamar {fechaHoraCorta(c.proxima_llamada_at)}
              </span>
            )}
            {c.ultimo_resultado_llamada && (
              <span className="text-slate-500">
                Última: <span className="font-semibold">{RESULTADOS_LLAMADA[c.ultimo_resultado_llamada].etiqueta}</span> ·{' '}
                {fechaHoraCorta(c.ultima_llamada_at)}
              </span>
            )}
            {!c.ultimo_resultado_llamada && <span className="text-slate-400">Sin llamadas todavía</span>}
          </div>
        </div>
      </div>
      <div className="flex shrink-0 gap-2 pl-9 sm:pl-0">
        <a
          href={`tel:${c.telefono_contacto}`}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand-50 px-3 font-mono text-[13px] font-semibold text-brand-800 ring-1 ring-brand-200 transition hover:bg-brand-100"
        >
          <Phone className="h-3.5 w-3.5" /> {telefono(c.telefono_contacto)}
        </a>
        <Button size="sm" variant="navy" onClick={onAbrir} icon={<Headphones className="h-3.5 w-3.5" />}>
          Atender
        </Button>
      </div>
    </li>
  );
}

export function ColaPage() {
  const navigate = useNavigate();
  const [opciones, setOpciones] = useEstadoPersistente('mes-cola-opciones', { soloSinFirmar: false });
  const cola = useCola(opciones.soloSinFirmar);
  const filas = useMemo(() => cola.data ?? [], [cola.data]);

  const resumen = useMemo(() => {
    const r = { vencido: 0, normal: 0, programado: 0 };
    for (const c of filas) r[grupoDe(c)]++;
    return r;
  }, [filas]);

  function abrir(id: string) {
    guardarSnapshot(filas.map((c) => c.id));
    navigate(`/cola/${id}`);
  }

  return (
    <div>
      <PageHeader
        titulo="Cola de llamadas"
        subtitulo="Contratos en Pendiente por antigüedad. Primero los recordatorios de «volver a llamar» vencidos."
        acciones={
          <>
            <Button variant="secondary" icon={<RefreshCw className={cn('h-4 w-4', cola.isFetching && 'animate-spin')} />} onClick={() => cola.refetch()}>
              Actualizar
            </Button>
            <Button size="lg" icon={<PlayCircle className="h-5 w-5" />} disabled={!filas.length} onClick={() => filas[0] && abrir(filas[0].id)}>
              Empezar a llamar
            </Button>
          </>
        }
      />

      <div className="mb-4 grid grid-cols-3 gap-3">
        <Card className="p-4">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-sun-700">
            <AlarmClock className="h-3.5 w-3.5" /> Vencidos
          </p>
          <p className="mt-1 text-2xl font-semibold text-navy-900">{resumen.vencido}</p>
        </Card>
        <Card className="p-4">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
            <PhoneCall className="h-3.5 w-3.5" /> Por llamar
          </p>
          <p className="mt-1 text-2xl font-semibold text-navy-900">{resumen.normal}</p>
        </Card>
        <Card className="p-4">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-navy-600">
            <Clock className="h-3.5 w-3.5" /> Programados
          </p>
          <p className="mt-1 text-2xl font-semibold text-navy-900">{resumen.programado}</p>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-3">
          <p className="text-sm font-semibold text-navy-900">{filas.length} contratos pendientes</p>
          <Switch
            checked={opciones.soloSinFirmar}
            onChange={(v) => setOpciones({ soloSinFirmar: v })}
            label="Ocultar firmados"
          />
        </div>
        {cola.error ? (
          <div className="p-4">
            <ErrorState mensaje={mensajeError(cola.error)} onRetry={() => cola.refetch()} />
          </div>
        ) : cola.isLoading ? (
          <div className="space-y-3 p-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
        ) : filas.length === 0 ? (
          <EmptyState
            icon={<CheckCircle2 className="h-6 w-6" />}
            titulo="¡Cola vacía!"
            texto="No hay contratos pendientes por gestionar. Buen trabajo."
          />
        ) : (
          <ul className="divide-y divide-slate-100">
            {filas.map((c, i) => (
              <FilaCola key={c.id} c={c} posicion={i + 1} onAbrir={() => abrir(c.id)} />
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

/** Modo llamada: la ficha completa con "Anterior / Siguiente" sin volver al listado. */
export function ColaTrabajoPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const contrato = useContrato(id);
  const snapshot = leerSnapshot();
  const cola = useCola(false, !snapshot.includes(id ?? ''));

  const ids = snapshot.includes(id ?? '') ? snapshot : (cola.data ?? []).map((c) => c.id);
  const indice = ids.indexOf(id ?? '');
  const anterior = indice > 0 ? ids[indice - 1] : null;
  const siguiente = indice >= 0 && indice < ids.length - 1 ? ids[indice + 1] : null;

  function ir(destino: string | null) {
    if (!destino) return;
    guardarSnapshot(ids);
    navigate(`/cola/${destino}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return (
    <div>
      <div className="sticky top-14 z-20 -mx-4 mb-5 border-b border-slate-200/70 bg-surface/90 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:top-0 lg:-mx-8 lg:px-8">
        <div className="flex items-center gap-3">
          <Link
            to="/cola"
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-semibold text-slate-500 hover:bg-white hover:text-navy-900"
          >
            <LogOut className="h-4 w-4 rotate-180" /> <span className="hidden sm:inline">Salir de la cola</span>
          </Link>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-navy-900">
              {indice >= 0 ? `Contrato ${indice + 1} de ${ids.length}` : 'Cola de llamadas'}
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
            Siguiente <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {contrato.isLoading ? (
        <PageLoader />
      ) : contrato.error ? (
        <ErrorState mensaje={mensajeError(contrato.error)} onRetry={() => contrato.refetch()} />
      ) : !contrato.data ? (
        <EmptyState icon={<Phone className="h-6 w-6" />} titulo="Contrato no encontrado" />
      ) : (
        <>
          {contrato.data.estado !== 'pendiente' && (
            <Aviso tipo="info" className="mb-4">
              Este contrato ya no está en Pendiente. Pulsa «Siguiente» para continuar con la cola.
            </Aviso>
          )}
          {!siguiente && indice >= 0 && (
            <Aviso tipo="success" className="mb-4" titulo="Último contrato de la cola">
              Cuando termines, vuelve a la cola para ver si han entrado contratos nuevos.
            </Aviso>
          )}
          <ContratoDetalle contrato={contrato.data} />
        </>
      )}
    </div>
  );
}
