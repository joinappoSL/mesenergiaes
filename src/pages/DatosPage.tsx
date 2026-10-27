import { BarChart3, ClipboardPlus, Search, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { usePerfil } from '@/auth/AuthProvider';
import { usePermisos } from '@/auth/permisos';
import { NuevoRegistro } from '@/components/datos/NuevoRegistro';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/Feedback';
import { Input, Select } from '@/components/ui/Field';
import { PageHeader } from '@/components/ui/Misc';
import { useBorrarActividad, useActividad } from '@/hooks/actividad';
import { usePerfiles } from '@/hooks/datos';
import {
  filtrarActividad,
  LISTA_TIPOS,
  porDia,
  porPersona,
  resumirActividad,
  TIPOS_ACTIVIDAD,
  type Actividad,
  type ResumenActividad,
  type TipoActividad,
} from '@/lib/actividad';
import { fecha, fechaHora, nombreCompleto } from '@/lib/format';
import { PERIODOS_ESTADISTICA, rangoPeriodo, type Periodo } from '@/lib/leads';
import { cn, mensajeError } from '@/lib/utils';

const COLUMNAS: { clave: keyof ResumenActividad; titulo: string; clase?: string }[] = [
  { clave: 'llamadas', titulo: 'Llamadas' },
  { clave: 'correos', titulo: 'Correos' },
  { clave: 'facturas', titulo: 'Facturas', clase: 'font-bold text-sky-700' },
  { clave: 'citas', titulo: 'Citas' },
  { clave: 'ventas', titulo: 'Ventas', clase: 'font-bold text-emerald-700' },
  { clave: 'anuladas', titulo: 'Anuladas' },
  { clave: 'verificaciones', titulo: 'Verif.' },
];

function TablaResumen({ titulo, primera, filas }: { titulo: string; primera: string; filas: { clave: string; resumen: ResumenActividad }[] }) {
  return (
    <Card className="overflow-x-auto">
      <CardHeader title={titulo} />
      <table className="w-full text-left text-sm">
        <thead className="border-b border-slate-100 text-[11px] uppercase tracking-wide text-slate-400">
          <tr>
            <th className="px-4 py-3">{primera}</th>
            {COLUMNAS.map((c) => <th key={c.clave} className="px-3 py-3 text-right">{c.titulo}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 tabular-nums">
          {filas.map((f) => (
            <tr key={f.clave}>
              <td className="px-4 py-2.5 font-semibold text-navy-900">{primera === 'Día' ? fecha(f.clave) : f.clave}</td>
              {COLUMNAS.map((c) => (
                <td key={c.clave} className={cn('px-3 py-2.5 text-right', c.clase)}>{f.resumen[c.clave] as number}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

export function DatosPage() {
  const perfil = usePerfil();
  const p = usePermisos();
  const actividad = useActividad();
  const perfiles = usePerfiles();
  const borrar = useBorrarActividad();
  const [periodo, setPeriodo] = useState<Periodo>('todo');
  const [persona, setPersona] = useState('');
  const [tipo, setTipo] = useState<'' | TipoActividad>('');
  const [q, setQ] = useState('');
  const [nuevo, setNuevo] = useState(false);
  const verEquipo = p.esGestor || p.esJefe;

  const todos = actividad.data ?? [];
  const rango = rangoPeriodo(periodo);
  const filtrados = useMemo(
    () => filtrarActividad(todos, { ...rango, persona, tipo, q }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [todos, periodo, persona, tipo, q],
  );
  const resumen = useMemo(() => resumirActividad(filtrados), [filtrados]);
  const dias = useMemo(() => porDia(filtrados), [filtrados]);
  const personas = useMemo(() => porPersona(filtrados), [filtrados]);

  // Personas que aparecen en los datos, para el filtro (la clave es el id o, si no hay, el nombre).
  const opcionesPersona = useMemo(() => {
    const m = new Map<string, string>();
    todos.forEach((a) => m.set(a.persona_id ?? a.autor, a.autor || 'Equipo'));
    return [...m.entries()].sort((x, y) => x[1].localeCompare(y[1], 'es'));
  }, [todos]);

  const asignables = useMemo(
    () => (p.esGestor ? (perfiles.data ?? []).filter((u) => u.activo).map((u) => ({ id: u.id, nombre: nombreCompleto(u) })) : undefined),
    [p.esGestor, perfiles.data],
  );
  const puedeBorrar = (a: Actividad) => p.esGestor || a.persona_id === perfil.id;

  const tiles: { titulo: string; valor: number; clase: string; destacado?: boolean; extra?: string }[] = [
    { titulo: 'Llamadas', valor: resumen.llamadas, clase: 'text-navy-900' },
    { titulo: 'Correos enviados', valor: resumen.correos, clase: 'text-brand-700' },
    { titulo: 'Facturas recibidas', valor: resumen.facturas, clase: 'text-sky-700', destacado: true, extra: resumen.pctFacturas !== null && resumen.pctFacturas <= 100 ? `${resumen.pctFacturas} % de los correos` : undefined },
    { titulo: 'Citas / visitas', valor: resumen.citas, clase: 'text-amber-800' },
    { titulo: 'Ventas', valor: resumen.ventas, clase: 'text-emerald-700', extra: resumen.anuladas ? `${resumen.anuladas} anulada${resumen.anuladas === 1 ? '' : 's'}` : undefined },
    { titulo: 'Verificaciones', valor: resumen.verificaciones, clase: 'text-violet-700' },
  ];

  return (
    <div>
      <PageHeader
        titulo="Datos del equipo"
        subtitulo={verEquipo ? 'Cierres del día y registros de todo el equipo: llamadas, correos, facturas, citas y ventas.' : 'Tus cierres del día y registros.'}
        acciones={
          <Button icon={<ClipboardPlus className="h-4 w-4" />} onClick={() => setNuevo(true)}>
            Añadir registro
          </Button>
        }
      />

      {actividad.isLoading ? (
        <Skeleton className="h-72 w-full" />
      ) : actividad.error ? (
        <ErrorState mensaje={mensajeError(actividad.error)} onRetry={() => actividad.refetch()} />
      ) : (
        <div className="space-y-4">
          <Card className="flex flex-wrap items-center gap-3 p-3">
            <Select className="w-auto" value={periodo} onChange={(e) => setPeriodo(e.target.value as Periodo)}>
              {PERIODOS_ESTADISTICA.map((x) => <option key={x.valor} value={x.valor}>{x.etiqueta}</option>)}
            </Select>
            {verEquipo && (
              <Select className="w-auto" value={persona} onChange={(e) => setPersona(e.target.value)}>
                <option value="">Todo el equipo</option>
                {opcionesPersona.map(([k, nombre]) => <option key={k} value={k}>{nombre}</option>)}
              </Select>
            )}
            <Select className="w-auto" value={tipo} onChange={(e) => setTipo(e.target.value as '' | TipoActividad)}>
              <option value="">Todos los tipos</option>
              {LISTA_TIPOS.map((t) => <option key={t} value={t}>{TIPOS_ACTIVIDAD[t].etiqueta}</option>)}
            </Select>
            <div className="min-w-[200px] flex-1">
              <Input icon={<Search className="h-4 w-4" />} placeholder="Buscar empresa, contacto, detalle…" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
          </Card>

          <Card>
            <CardHeader title="Resumen" icon={<BarChart3 className="h-4 w-4" />} subtitle={`${resumen.registros} registros`} />
            <div className="grid grid-cols-2 gap-3 p-5 sm:grid-cols-3 lg:grid-cols-6">
              {tiles.map((t) => (
                <div key={t.titulo} className={cn('rounded-xl p-3 text-center', t.destacado ? 'bg-sky-50 ring-1 ring-sky-200' : 'bg-slate-50')}>
                  <p className={cn('font-display text-3xl font-bold', t.clase)}>{t.valor}</p>
                  <p className="text-xs text-slate-500">{t.titulo}</p>
                  {t.extra && <p className={cn('mt-0.5 text-[11px] font-semibold', t.destacado ? 'text-sky-700' : 'text-slate-500')}>{t.extra}</p>}
                </div>
              ))}
            </div>
          </Card>

          {filtrados.length === 0 ? (
            <Card>
              <EmptyState
                icon={<BarChart3 className="h-6 w-6" />}
                titulo="Sin registros"
                texto="Cuando se añadan cierres del día o registros aparecerán aquí con sus estadísticas."
              />
            </Card>
          ) : (
            <>
              {verEquipo && personas.length > 1 && <TablaResumen titulo="Por persona" primera="Persona" filas={personas} />}
              <TablaResumen titulo="Por día" primera="Día" filas={dias} />
              <Card className="overflow-x-auto">
                <CardHeader title="Registros" subtitle={`${filtrados.length} en total`} />
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-slate-100 text-[11px] uppercase tracking-wide text-slate-400">
                    <tr>
                      <th className="px-4 py-3">Cuándo</th>
                      <th className="px-4 py-3">Quién</th>
                      <th className="px-4 py-3">Qué</th>
                      <th className="px-4 py-3">Empresa / detalle</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filtrados.slice(0, 500).map((a) => (
                      <tr key={a.id} className="align-top">
                        <td className="whitespace-nowrap px-4 py-2.5 text-slate-500">{fechaHora(a.ocurrio_at)}</td>
                        <td className="px-4 py-2.5 font-semibold text-navy-900">{a.autor || 'Equipo'}</td>
                        <td className="px-4 py-2.5">
                          <Badge className={TIPOS_ACTIVIDAD[a.tipo].clase}>
                            {TIPOS_ACTIVIDAD[a.tipo].etiqueta}
                            {a.cantidad > 1 ? ` ×${a.cantidad}` : ''}
                          </Badge>
                        </td>
                        <td className="px-4 py-2.5">
                          {(a.empresa || a.contacto) && (
                            <p className="font-semibold text-slate-800">
                              {a.empresa}
                              {a.contacto && <span className="font-normal text-slate-500"> · {a.contacto}</span>}
                            </p>
                          )}
                          {a.detalle && <p className="text-slate-600">{a.detalle}</p>}
                        </td>
                        <td className="px-2 py-2.5 text-right">
                          {puedeBorrar(a) && (
                            <button
                              type="button"
                              aria-label="Borrar registro"
                              className="rounded-lg p-1.5 text-slate-300 transition hover:bg-red-50 hover:text-red-600"
                              onClick={() => {
                                if (confirm('¿Borrar este registro?')) borrar.mutate(a.id, { onError: (e) => toast.error(mensajeError(e)) });
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filtrados.length > 500 && <p className="border-t border-slate-100 px-4 py-3 text-xs text-slate-500">Se muestran 500 de {filtrados.length}. Afina los filtros.</p>}
              </Card>
            </>
          )}
        </div>
      )}

      <NuevoRegistro open={nuevo} onClose={() => setNuevo(false)} personas={asignables} />
    </div>
  );
}
