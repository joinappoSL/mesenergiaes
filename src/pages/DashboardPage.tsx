import { endOfMonth, startOfMonth, subDays, subMonths } from 'date-fns';
import { CalendarClock, ChevronRight, Euro, PenLine, Trophy, Zap } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { usePerfil } from '@/auth/AuthProvider';
import { usePermisos } from '@/auth/permisos';
import { GraficoPorDia } from '@/components/dashboard/GraficoPorDia';
import { useEnDirecto } from '@/components/layout/AppLayout';
import { EstadoBadge } from '@/components/ui/Badge';
import { Card, CardHeader } from '@/components/ui/Card';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/Feedback';
import { Input, Select } from '@/components/ui/Field';
import { Avatar, Tabs } from '@/components/ui/Misc';
import { useDashboard, useEquipos, usePerfiles } from '@/hooks/datos';
import { useEstadoPersistente } from '@/hooks/useEstadoPersistente';
import { ESTADOS, LISTA_ESTADOS } from '@/lib/constants';
import { diaRelativo, euros, hoyISO, isoLocal, nombreCompleto, numero } from '@/lib/format';
import type { DashboardCita, DashboardData } from '@/lib/types';
import { cn, mensajeError } from '@/lib/utils';

type Preset = 'hoy' | '7' | '30' | 'mes' | 'mes_anterior' | 'personalizado';

const PRESETS: { valor: Preset; etiqueta: string }[] = [
  { valor: 'hoy', etiqueta: 'Hoy' },
  { valor: '7', etiqueta: 'Últimos 7 días' },
  { valor: '30', etiqueta: 'Últimos 30 días' },
  { valor: 'mes', etiqueta: 'Este mes' },
  { valor: 'mes_anterior', etiqueta: 'Mes anterior' },
  { valor: 'personalizado', etiqueta: 'Personalizado' },
];

function rangoDe(preset: Preset, desde: string, hasta: string): { desde: string; hasta: string } {
  const hoy = new Date();
  switch (preset) {
    case 'hoy':
      return { desde: hoyISO(), hasta: hoyISO() };
    case '7':
      return { desde: isoLocal(subDays(hoy, 6)), hasta: hoyISO() };
    case 'mes':
      return { desde: isoLocal(startOfMonth(hoy)), hasta: hoyISO() };
    case 'mes_anterior': {
      const m = subMonths(hoy, 1);
      return { desde: isoLocal(startOfMonth(m)), hasta: isoLocal(endOfMonth(m)) };
    }
    case 'personalizado':
      return { desde: desde || isoLocal(subDays(hoy, 29)), hasta: hasta || hoyISO() };
    default:
      return { desde: isoLocal(subDays(hoy, 29)), hasta: hoyISO() };
  }
}

function saludo(): string {
  const h = new Date().getHours();
  if (h < 14) return 'Buenos días';
  if (h < 21) return 'Buenas tardes';
  return 'Buenas noches';
}

function porcentaje(parte: number, total: number): number {
  return total ? Math.round((parte / total) * 1000) / 10 : 0;
}

// -----------------------------------------------------------------------------
// KPIs
// -----------------------------------------------------------------------------
function Kpis({ datos }: { datos: DashboardData }) {
  const k = datos.kpis;
  const activacion = porcentaje(k.activo, k.total);

  return (
    <div className="grid gap-4 lg:grid-cols-12">
      {/* Cifra principal */}
      <Card className="relative overflow-hidden bg-navy-950 p-6 text-white ring-navy-900 lg:col-span-4">
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-brand-500/20 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-12 right-10 h-32 w-32 rounded-full bg-sun-400/20 blur-2xl" />
        <p className="relative text-sm font-medium text-navy-200">Contratos subidos</p>
        <p className="relative mt-1 text-6xl font-semibold leading-none tracking-tight">{numero(k.total)}</p>
        <div className="relative mt-6">
          <div className="flex items-baseline justify-between text-sm">
            <span className="text-navy-200">Activación</span>
            <span className="text-xl font-semibold text-white">{activacion.toLocaleString('es-ES')} %</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10" role="meter" aria-valuenow={activacion} aria-valuemin={0} aria-valuemax={100} aria-label="Porcentaje de activación">
            <div className="h-full rounded-full bg-brand-400 transition-all duration-700" style={{ width: `${Math.min(100, activacion)}%` }} />
          </div>
          <p className="mt-2 text-xs text-navy-300">
            {numero(k.activo)} activos de {numero(k.total)} · {numero(k.firmados)} firmados
          </p>
        </div>
      </Card>

      {/* Por estado */}
      <div className="grid grid-cols-2 gap-4 lg:col-span-8 lg:grid-cols-4">
        {LISTA_ESTADOS.map((e) => {
          const valor = k[e];
          return (
            <Card key={e} className="relative overflow-hidden p-5">
              <span className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: ESTADOS[e].color }} />
              <p className="flex items-center gap-1.5 text-sm font-medium text-slate-500">
                <span className={cn('h-2 w-2 rounded-full', ESTADOS[e].punto)} />
                {ESTADOS[e].etiqueta}
              </p>
              <p className="mt-2 text-4xl font-semibold tracking-tight text-navy-900">{numero(valor)}</p>
              <p className="mt-1 text-xs text-slate-500">{porcentaje(valor, k.total).toLocaleString('es-ES')} % del total</p>
            </Card>
          );
        })}
        <Card className="col-span-2 flex items-center gap-4 p-5">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sun-100 text-sun-700">
            <PenLine className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-medium text-slate-500">Pendientes sin firmar</p>
            <p className="text-2xl font-semibold text-navy-900">{numero(k.pendientes_sin_firmar)}</p>
          </div>
        </Card>
        <Card className="col-span-2 flex items-center gap-4 p-5">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-brand-700">
            <Euro className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-medium text-slate-500">Cuota mensual activada</p>
            <p className="text-2xl font-semibold text-navy-900">{euros(k.facturacion_activa)}</p>
          </div>
        </Card>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Citas de instalación
// -----------------------------------------------------------------------------
function Citas({ citas }: { citas: DashboardCita[] }) {
  const hoy = hoyISO();
  const deHoy = citas.filter((c) => c.fecha === hoy);
  const proximas = citas.filter((c) => c.fecha > hoy);
  const [pestana, setPestana] = useState<'hoy' | 'proximas'>('hoy');
  const lista = pestana === 'hoy' ? deHoy : proximas;

  return (
    <Card className="flex flex-col overflow-hidden">
      <CardHeader title="Citas de instalación" icon={<CalendarClock className="h-4 w-4" />} />
      <div className="px-5 pt-3">
        <Tabs
          className="w-full [&>button]:flex-1 [&>button]:justify-center"
          value={pestana}
          onChange={setPestana}
          tabs={[
            { value: 'hoy', label: 'Hoy', count: deHoy.length },
            { value: 'proximas', label: 'Próximos 7 días', count: proximas.length },
          ]}
        />
      </div>
      {lista.length === 0 ? (
        <EmptyState
          icon={<CalendarClock className="h-6 w-6" />}
          titulo={pestana === 'hoy' ? 'Hoy no hay instalaciones' : 'Sin citas en los próximos 7 días'}
          texto="Las citas aparecen aquí en cuanto se registran en los contratos."
          className="py-8"
        />
      ) : (
        <ul className="max-h-[340px] divide-y divide-slate-100 overflow-y-auto">
          {lista.map((c) => (
            <li key={c.id}>
              <Link to={`/contratos/${c.id}`} className="flex items-center gap-3 px-5 py-3 transition hover:bg-slate-50">
                <div className="w-14 shrink-0 text-center">
                  <p className="text-[11px] font-semibold uppercase text-slate-400">{diaRelativo(c.fecha)}</p>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-navy-900">{c.cliente}</p>
                  <p className="truncate text-xs text-slate-500">
                    {c.franja ?? 'Sin franja'} · {c.poblacion}
                    {c.comercial ? ` · ${c.comercial}` : ''}
                  </p>
                </div>
                <EstadoBadge estado={c.estado} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

// -----------------------------------------------------------------------------
// Ranking de comerciales
// -----------------------------------------------------------------------------
function Ranking({ datos }: { datos: DashboardData }) {
  const filas = datos.ranking;
  return (
    <Card className="overflow-hidden">
      <CardHeader title="Ranking de comerciales" icon={<Trophy className="h-4 w-4" />} subtitle="Ordenado por contratos activos en el periodo" />
      {filas.length === 0 ? (
        <EmptyState icon={<Trophy className="h-6 w-6" />} titulo="Sin ventas en el periodo" texto="Cuando se suban contratos verás aquí el ranking." className="py-8" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="border-b border-slate-100 bg-slate-50/70 text-[11px] uppercase tracking-wide text-slate-500">
              <tr>
                <th className="w-12 px-5 py-3 text-left font-semibold">#</th>
                <th className="px-3 py-3 text-left font-semibold">Comercial</th>
                <th className="px-3 py-3 text-right font-semibold">Subidos</th>
                <th className="px-3 py-3 text-right font-semibold">Activos</th>
                <th className="px-3 py-3 text-right font-semibold">Pendientes</th>
                <th className="px-3 py-3 text-right font-semibold">Riesgos + canc.</th>
                <th className="w-48 px-5 py-3 text-left font-semibold">Ratio de activación</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 tabular-nums">
              {filas.map((r, i) => (
                <tr key={r.comercial_id ?? `sin-${i}`} className="transition hover:bg-slate-50/70">
                  <td className="px-5 py-3">
                    <span
                      className={cn(
                        'inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold',
                        i === 0 ? 'bg-sun-400 text-navy-950' : i === 1 ? 'bg-slate-200 text-slate-700' : i === 2 ? 'bg-orange-100 text-orange-800' : 'text-slate-400',
                      )}
                    >
                      {i + 1}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2.5">
                      <Avatar nombre={r.nombre} className="h-8 w-8" />
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-navy-900">{r.nombre}</p>
                        <p className="truncate text-xs text-slate-500">{r.equipo ?? 'Sin equipo'}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-right font-semibold text-slate-800">{r.subidos}</td>
                  <td className="px-3 py-3 text-right font-semibold text-brand-700">{r.activos}</td>
                  <td className="px-3 py-3 text-right text-slate-600">{r.pendientes}</td>
                  <td className="px-3 py-3 text-right text-slate-600">{r.perdidos}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-brand-100">
                        <div className="h-full rounded-full bg-brand-600" style={{ width: `${Math.min(100, r.ratio ?? 0)}%` }} />
                      </div>
                      <span className="w-12 text-right text-xs font-semibold text-slate-700">{(r.ratio ?? 0).toLocaleString('es-ES')} %</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

// -----------------------------------------------------------------------------
// Página
// -----------------------------------------------------------------------------
interface FiltrosDashboard {
  preset: Preset;
  desde: string;
  hasta: string;
  equipoId: string;
  comercialId: string;
}

export function DashboardPage() {
  const perfil = usePerfil();
  const p = usePermisos();
  const enDirecto = useEnDirecto();
  const equipos = useEquipos();
  const perfiles = usePerfiles();
  const [f, setF] = useEstadoPersistente<FiltrosDashboard>('mes-filtros-dashboard', {
    preset: '30',
    desde: '',
    hasta: '',
    equipoId: '',
    comercialId: '',
  });

  const rango = rangoDe(f.preset, f.desde, f.hasta);
  const params = {
    ...rango,
    equipoId: p.dashboardCompleto ? f.equipoId : '',
    comercialId: p.dashboardCompleto ? f.comercialId : '',
  };
  const dashboard = useDashboard(params);

  const comerciales = useMemo(
    () => (perfiles.data ?? []).filter((u) => u.rol === 'comercial' && (!f.equipoId || u.equipo_id === f.equipoId)),
    [perfiles.data, f.equipoId],
  );

  const set = (cambios: Partial<FiltrosDashboard>) => setF({ ...f, ...cambios });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <p className="flex items-center gap-2 text-sm font-medium text-slate-500">
          <span className={cn('h-2 w-2 rounded-full', enDirecto ? 'bg-brand-500 animate-pulse-soft' : 'bg-slate-300')} />
          {enDirecto ? 'En directo' : 'Conectando…'}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-navy-900 sm:text-[28px]">
          {saludo()}, {perfil.nombre || nombreCompleto(perfil)}
        </h1>
        <p className="text-sm text-slate-500">
          {p.esComercial
            ? 'Así van tus contratos.'
            : p.esJefe
              ? 'Así va tu equipo en tiempo real.'
              : 'Así van los contratos de MESENERGIA.'}
        </p>
      </div>

      {/* Filtros: una sola fila sobre todo lo que filtran */}
      <div className="flex flex-wrap items-center gap-2">
        <Select value={f.preset} onChange={(e) => set({ preset: e.target.value as Preset })} className="w-auto min-w-44" aria-label="Periodo">
          {PRESETS.map((pr) => (
            <option key={pr.valor} value={pr.valor}>
              {pr.etiqueta}
            </option>
          ))}
        </Select>
        {f.preset === 'personalizado' && (
          <>
            <Input type="date" value={rango.desde} max={rango.hasta} onChange={(e) => set({ desde: e.target.value })} className="w-auto" aria-label="Desde" />
            <Input type="date" value={rango.hasta} min={rango.desde} onChange={(e) => set({ hasta: e.target.value })} className="w-auto" aria-label="Hasta" />
          </>
        )}
        {p.esGestor && (
          <Select value={f.equipoId} onChange={(e) => set({ equipoId: e.target.value, comercialId: '' })} className="w-auto min-w-44" aria-label="Equipo">
            <option value="">Todos los equipos</option>
            {(equipos.data ?? []).map((e) => (
              <option key={e.id} value={e.id}>
                {e.nombre}
              </option>
            ))}
          </Select>
        )}
        {p.dashboardCompleto && (
          <Select value={f.comercialId} onChange={(e) => set({ comercialId: e.target.value })} className="w-auto min-w-48" aria-label="Comercial">
            <option value="">Todos los comerciales</option>
            {comerciales.map((u) => (
              <option key={u.id} value={u.id}>
                {nombreCompleto(u)}
              </option>
            ))}
          </Select>
        )}
      </div>

      {dashboard.error ? (
        <ErrorState mensaje={mensajeError(dashboard.error)} onRetry={() => dashboard.refetch()} />
      ) : !dashboard.data ? (
        <div className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-12">
            <Skeleton className="h-52 rounded-2xl lg:col-span-4" />
            <Skeleton className="h-52 rounded-2xl lg:col-span-8" />
          </div>
          <Skeleton className="h-80 rounded-2xl" />
        </div>
      ) : (
        <div className={cn('space-y-6 transition-opacity', dashboard.isPlaceholderData && 'opacity-60')}>
          <Kpis datos={dashboard.data} />

          <div className="grid gap-6 xl:grid-cols-3">
            <div className="min-w-0 xl:col-span-2">
              <GraficoPorDia datos={dashboard.data.por_dia} cargando={dashboard.isFetching} />
            </div>
            <Citas citas={dashboard.data.citas} />
          </div>

          {p.dashboardCompleto && <Ranking datos={dashboard.data} />}

          {p.esComercial && dashboard.data.kpis.total === 0 && (
            <Card>
              <EmptyState
                icon={<Zap className="h-6 w-6" />}
                titulo="Aún no tienes contratos en este periodo"
                texto="Sube tu primera venta y sigue aquí su estado en todo momento."
                accion={
                  <Link to="/contratos/nuevo" className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline">
                    Nuevo contrato <ChevronRight className="h-4 w-4" />
                  </Link>
                }
              />
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
