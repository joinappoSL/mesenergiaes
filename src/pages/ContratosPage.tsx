import { FileSpreadsheet, FileText, KanbanSquare, Plus, Rows3 } from 'lucide-react';
import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { usePermisos } from '@/auth/permisos';
import { FiltrosContratosBarra } from '@/components/contratos/Filtros';
import { KanbanContratos } from '@/components/contratos/Kanban';
import { TablaContratos } from '@/components/contratos/TablaContratos';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/Feedback';
import { PageHeader, Paginacion, Tabs } from '@/components/ui/Misc';
import {
  FILTROS_VACIOS,
  LIMITE_KANBAN,
  obtenerTodosLosContratos,
  useContratosKanban,
  useContratosLista,
  type FiltrosContratos,
  type Orden,
} from '@/hooks/datos';
import { useEstadoPersistente } from '@/hooks/useEstadoPersistente';
import { exportarContratosExcel } from '@/lib/excel';
import { numero } from '@/lib/format';
import { mensajeError } from '@/lib/utils';

const TAMANO_PAGINA = 25;

export function ContratosPage() {
  const p = usePermisos();
  const [filtros, setFiltrosRaw] = useEstadoPersistente<FiltrosContratos>('mes-filtros-contratos', FILTROS_VACIOS);
  const [vista, setVista] = useEstadoPersistente<{ modo: 'tabla' | 'kanban' }>('mes-vista-contratos', { modo: 'tabla' }, 'local');
  const [orden, setOrden] = useState<Orden>({ campo: 'created_at', asc: false });
  const [pagina, setPagina] = useState(0);
  const [exportando, setExportando] = useState(false);

  const setFiltros = useCallback(
    (f: FiltrosContratos) => {
      setFiltrosRaw(f);
      setPagina(0);
    },
    [setFiltrosRaw],
  );

  const lista = useContratosLista(filtros, pagina, TAMANO_PAGINA, orden);
  const kanban = useContratosKanban(filtros, vista.modo === 'kanban');
  const datos = vista.modo === 'tabla' ? lista : kanban;
  const total = datos.data?.total ?? 0;

  function ordenar(campo: Orden['campo']) {
    setOrden((o) => (o.campo === campo ? { campo, asc: !o.asc } : { campo, asc: campo === 'cliente_apellidos' || campo === 'comercial_nombre' }));
    setPagina(0);
  }

  async function exportar() {
    setExportando(true);
    try {
      const filas = await obtenerTodosLosContratos(filtros);
      if (!filas.length) {
        toast.info('No hay contratos con estos filtros');
        return;
      }
      await exportarContratosExcel(filas);
      toast.success(`Exportados ${numero(filas.length)} contratos a Excel`);
    } catch (e) {
      toast.error(mensajeError(e));
    } finally {
      setExportando(false);
    }
  }

  const hayFiltros = JSON.stringify(filtros) !== JSON.stringify(FILTROS_VACIOS);

  return (
    <div>
      <PageHeader
        titulo={p.esComercial ? 'Mis contratos' : 'Contratos'}
        subtitulo={
          datos.isLoading ? 'Cargando…' : `${numero(total)} contrato${total === 1 ? '' : 's'}${hayFiltros ? ' con los filtros aplicados' : ''}`
        }
        acciones={
          <>
            <Tabs
              value={vista.modo}
              onChange={(modo) => setVista({ modo })}
              tabs={[
                { value: 'tabla', label: <><Rows3 className="h-4 w-4" /> Tabla</> },
                { value: 'kanban', label: <><KanbanSquare className="h-4 w-4" /> Kanban</> },
              ]}
            />
            <Button variant="secondary" icon={<FileSpreadsheet className="h-4 w-4 text-brand-600" />} onClick={exportar} loading={exportando}>
              Exportar a Excel
            </Button>
            {p.puedeCrearContrato && (
              <ButtonLink to="/contratos/nuevo" icon={<Plus className="h-4 w-4" />} className="hidden sm:inline-flex">
                Nuevo contrato
              </ButtonLink>
            )}
          </>
        }
      />

      <div className="space-y-4">
        <FiltrosContratosBarra filtros={filtros} onChange={setFiltros} />

        {datos.error ? (
          <ErrorState mensaje={mensajeError(datos.error)} onRetry={() => datos.refetch()} />
        ) : vista.modo === 'kanban' ? (
          kanban.isLoading ? (
            <div className="grid gap-3 xl:grid-cols-4">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-80 rounded-2xl" />
              ))}
            </div>
          ) : (
            <>
              {total > LIMITE_KANBAN && (
                <p className="text-xs text-slate-500">
                  Se muestran los {LIMITE_KANBAN} contratos más recientes de {numero(total)}. Usa los filtros para acotar.
                </p>
              )}
              <KanbanContratos contratos={kanban.data?.filas ?? []} />
            </>
          )
        ) : (
          <Card className="overflow-hidden">
            {lista.isLoading ? (
              <div className="space-y-3 p-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-12" />
                ))}
              </div>
            ) : !lista.data?.filas.length ? (
              <EmptyState
                icon={<FileText className="h-6 w-6" />}
                titulo={hayFiltros ? 'No hay contratos con estos filtros' : 'Todavía no hay contratos'}
                texto={hayFiltros ? 'Prueba a quitar algún filtro o a buscar de otra forma.' : '¡A por la primera venta! Cuando subas un contrato aparecerá aquí.'}
                accion={
                  hayFiltros ? (
                    <Button variant="secondary" onClick={() => setFiltros(FILTROS_VACIOS)}>
                      Limpiar filtros
                    </Button>
                  ) : (
                    p.puedeCrearContrato && (
                      <ButtonLink to="/contratos/nuevo" icon={<Plus className="h-4 w-4" />}>
                        Nuevo contrato
                      </ButtonLink>
                    )
                  )
                }
              />
            ) : (
              <div className={lista.isPlaceholderData ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
                <TablaContratos filas={lista.data.filas} orden={orden} onOrdenar={ordenar} mostrarComercial={!p.esComercial} />
                <Paginacion pagina={pagina} tamano={TAMANO_PAGINA} total={total} onCambiar={setPagina} />
              </div>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}
