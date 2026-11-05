import { Home, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { usePerfil } from '@/auth/AuthProvider';
import { usePermisos } from '@/auth/permisos';
import { FormResidencial } from '@/components/residenciales/FormResidencial';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/Feedback';
import { Input, Select } from '@/components/ui/Field';
import { PageHeader } from '@/components/ui/Misc';
import { usePerfiles } from '@/hooks/datos';
import { useBorrarResidencial, useResidenciales } from '@/hooks/residenciales';
import { fecha, nombreCompleto, telefono } from '@/lib/format';
import { norm } from '@/lib/leads';
import { aDia, nombreMes, porMes, porPropietario, resumirResidenciales, SUMINISTROS, type Residencial } from '@/lib/residenciales';
import { mensajeError } from '@/lib/utils';

function Tarjeta({ titulo, valor, detalle }: { titulo: string; valor: number; detalle?: string }) {
  return (
    <Card className="p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{titulo}</p>
      <p className="font-display text-3xl font-bold text-navy-900">{valor}</p>
      {detalle && <p className="text-xs text-slate-500">{detalle}</p>}
    </Card>
  );
}

export function ResidencialesPage() {
  const perfil = usePerfil();
  const p = usePermisos();
  const q = useResidenciales();
  const perfiles = usePerfiles();
  const borrar = useBorrarResidencial();
  const [formAbierto, setFormAbierto] = useState(false);
  const [editar, setEditar] = useState<Residencial | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [mes, setMes] = useState('');
  const [persona, setPersona] = useState('');

  const nombres = useMemo(() => new Map((perfiles.data ?? []).map((u) => [u.id, nombreCompleto(u)])), [perfiles.data]);
  const todas = q.data ?? [];
  const delGrupo = useMemo(() => (persona ? todas.filter((r) => r.propietario_id === persona) : todas), [todas, persona]);
  const hoy = aDia(new Date());
  const resumen = useMemo(() => resumirResidenciales(delGrupo, hoy), [delGrupo, hoy]);
  const meses = useMemo(() => porMes(delGrupo), [delGrupo]);
  const filas = useMemo(() => {
    const nq = norm(busqueda);
    return delGrupo.filter((r) => (!mes || r.firmado_at.startsWith(mes)) && (!nq || norm([r.nombre, r.telefono, r.email, r.cups, r.comercializadora, r.notas].join(' ')).includes(nq)));
  }, [delGrupo, mes, busqueda]);
  const porPersona = useMemo(() => (p.esGestor ? porPropietario(todas, hoy) : []), [p.esGestor, todas, hoy]);
  const personas = useMemo(
    () => (p.esGestor ? (perfiles.data ?? []).filter((u) => u.activo && ['jefe_equipo', 'comercial'].includes(u.rol)).map((u) => ({ id: u.id, nombre: nombreCompleto(u) })) : undefined),
    [p.esGestor, perfiles.data],
  );

  return (
    <div>
      <PageHeader
        titulo="Residenciales"
        subtitulo="Clientes residenciales firmados, con la fecha de la firma, para llevar el conteo de lo que se vende."
        acciones={
          <div className="flex flex-wrap items-center gap-2">
            {p.esGestor && (
              <Select className="w-auto" value={persona} onChange={(e) => setPersona(e.target.value)} aria-label="Persona">
                <option value="">Todo el equipo</option>
                {[...new Set(todas.map((r) => r.propietario_id))].map((id) => <option key={id} value={id}>{nombres.get(id) ?? 'Usuario'}</option>)}
              </Select>
            )}
            <Button icon={<Plus className="h-4 w-4" />} onClick={() => { setEditar(null); setFormAbierto(true); }}>Añadir cliente</Button>
          </div>
        }
      />

      {q.error ? (
        <ErrorState mensaje={mensajeError(q.error)} onRetry={() => q.refetch()} />
      ) : q.isLoading ? (
        <Skeleton className="h-72 w-full" />
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <Tarjeta titulo="Hoy" valor={resumen.hoy} />
            <Tarjeta titulo="Esta semana" valor={resumen.semana} />
            <Tarjeta titulo="Este mes" valor={resumen.mes} detalle={`mes anterior: ${resumen.mesAnterior}`} />
            <Tarjeta titulo="Este año" valor={resumen.anio} />
            <Tarjeta titulo="Total vendidos" valor={resumen.total} detalle={`${resumen.contratos} contratos (luz y gas)`} />
          </div>

          {(meses.length > 0 || porPersona.length > 0) && (
            <div className="grid gap-4 lg:grid-cols-2">
              {meses.length > 0 && (
                <Card className="p-4">
                  <h3 className="mb-2 text-sm font-semibold text-navy-900">Por mes</h3>
                  <table className="w-full text-sm">
                    <thead className="text-[11px] uppercase text-slate-400"><tr><th className="py-1 text-left">Mes</th><th className="text-right">Clientes</th><th className="text-right">Contratos</th></tr></thead>
                    <tbody className="divide-y divide-slate-100">
                      {meses.slice(0, 12).map((m) => (
                        <tr key={m.mes} className="cursor-pointer hover:bg-slate-50" onClick={() => setMes(mes === m.mes ? '' : m.mes)}>
                          <td className="py-1.5 capitalize">{nombreMes(m.mes)}</td>
                          <td className="text-right font-bold text-navy-900">{m.clientes}</td>
                          <td className="text-right text-slate-500">{m.contratos}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Card>
              )}
              {porPersona.length > 0 && (
                <Card className="p-4">
                  <h3 className="mb-2 text-sm font-semibold text-navy-900">Por persona</h3>
                  <table className="w-full text-sm">
                    <thead className="text-[11px] uppercase text-slate-400"><tr><th className="py-1 text-left">Comercial</th><th className="text-right">Mes</th><th className="text-right">Año</th><th className="text-right">Total</th></tr></thead>
                    <tbody className="divide-y divide-slate-100">
                      {porPersona.map((r) => (
                        <tr key={r.id}><td className="py-1.5">{nombres.get(r.id) ?? 'Usuario'}</td><td className="text-right">{r.mes}</td><td className="text-right">{r.anio}</td><td className="text-right font-bold text-navy-900">{r.total}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </Card>
              )}
            </div>
          )}

          <Card className="flex flex-wrap items-center gap-3 p-3">
            <div className="min-w-[220px] flex-1"><Input icon={<Search className="h-4 w-4" />} placeholder="Buscar cliente, teléfono, CUPS…" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} /></div>
            <Select className="w-auto" value={mes} onChange={(e) => setMes(e.target.value)} aria-label="Mes">
              <option value="">Todos los meses</option>
              {meses.map((m) => <option key={m.mes} value={m.mes}>{nombreMes(m.mes)}</option>)}
            </Select>
            <span className="text-sm text-slate-500">{filas.length} {filas.length === 1 ? "cliente" : "clientes"}</span>
          </Card>

          <Card className="overflow-x-auto">
            {filas.length === 0 ? (
              <EmptyState icon={<Home className="h-6 w-6" />} titulo={todas.length ? 'Sin resultados' : 'Todavía no hay residenciales'} texto={todas.length ? 'Prueba con otro mes o búsqueda.' : 'Añade el primer cliente residencial con la fecha de firma.'} />
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-100 text-[11px] uppercase tracking-wide text-slate-400">
                  <tr>
                    <th className="px-4 py-3">Firmado</th><th className="px-4 py-3">Cliente</th><th className="px-4 py-3">Teléfono</th><th className="px-4 py-3">Suministro</th>
                    <th className="px-4 py-3">Comercializadora</th>{p.esGestor && <th className="px-4 py-3">Comercial</th>}<th className="px-4 py-3">Notas</th><th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filas.map((r) => (
                    <tr key={r.id} className="transition hover:bg-slate-50">
                      <td className="whitespace-nowrap px-4 py-2.5 font-semibold text-navy-900">{fecha(r.firmado_at)}</td>
                      <td className="px-4 py-2.5"><span className="font-semibold">{r.nombre}</span>{r.cups && <span className="block text-xs text-slate-400">{r.cups}</span>}</td>
                      <td className="px-4 py-2.5 tabular-nums">{r.telefono ? telefono(r.telefono) : '—'}</td>
                      <td className="px-4 py-2.5"><Badge className="bg-brand-50 text-brand-700 ring-brand-200">{SUMINISTROS[r.suministro].etiqueta}</Badge></td>
                      <td className="px-4 py-2.5 text-slate-600">{r.comercializadora || '—'}</td>
                      {p.esGestor && <td className="px-4 py-2.5 text-slate-500">{nombres.get(r.propietario_id) ?? '—'}</td>}
                      <td className="max-w-[220px] truncate px-4 py-2.5 text-xs text-slate-500" title={r.notas}>{r.notas}</td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-right">
                        <Button size="sm" variant="ghost" aria-label="Editar" icon={<Pencil className="h-3.5 w-3.5" />} onClick={() => { setEditar(r); setFormAbierto(true); }} />
                        <Button
                          size="sm"
                          variant="ghost"
                          aria-label="Borrar"
                          icon={<Trash2 className="h-3.5 w-3.5" />}
                          onClick={() => { if (confirm(`¿Borrar a «${r.nombre}» de los residenciales?`)) borrar.mutate(r.id, { onError: (e) => toast.error(mensajeError(e)) }); }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </div>
      )}

      <FormResidencial open={formAbierto} onClose={() => setFormAbierto(false)} editar={editar} propietarioId={persona || perfil.id} personas={personas} />
    </div>
  );
}
