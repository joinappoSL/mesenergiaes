import { Upload } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { usePerfil } from '@/auth/AuthProvider';
import { usePermisos } from '@/auth/permisos';
import { ImportarLeads } from '@/components/leads/ImportarLeads';
import { ListaLeads } from '@/components/leads/ListaLeads';
import { LlamarLeads } from '@/components/leads/LlamarLeads';
import { RegistroLeads } from '@/components/leads/RegistroLeads';
import { SeguimientoLeads } from '@/components/leads/SeguimientoLeads';
import { Button } from '@/components/ui/Button';
import { Aviso, ErrorState, Skeleton } from '@/components/ui/Feedback';
import { Select } from '@/components/ui/Field';
import { PageHeader, Tabs } from '@/components/ui/Misc';
import { usePerfiles } from '@/hooks/datos';
import { useLeads } from '@/hooks/leads';
import { nombreCompleto } from '@/lib/format';
import { colaPendientes, ESTADOS_SEGUIMIENTO, type Lead } from '@/lib/leads';
import { mensajeError } from '@/lib/utils';

type Vista = 'llamar' | 'lista' | 'seguimiento' | 'registro';

export function LeadsPage() {
  const perfil = usePerfil();
  const p = usePermisos();
  const leadsQ = useLeads();
  const perfiles = usePerfiles();
  const [vista, setVista] = useState<Vista>('llamar');
  const [cartera, setCartera] = useState<string>('mias');
  const [importar, setImportar] = useState(false);
  const [foco, setFoco] = useState<string | null>(null);
  const verCartera = p.esGestor || p.esJefe;

  const nombres = useMemo(() => {
    const m = new Map<string, string>();
    (perfiles.data ?? []).forEach((u) => m.set(u.id, nombreCompleto(u)));
    return m;
  }, [perfiles.data]);
  const nombreCartera = useCallback((id: string) => nombres.get(id) ?? null, [nombres]);
  const puedeEditar = useCallback((l: Lead) => p.esGestor || l.propietario_id === perfil.id, [p.esGestor, perfil.id]);

  const todos = leadsQ.data ?? [];
  const visibles = useMemo(() => {
    if (!verCartera || cartera === 'todas') return todos;
    const id = cartera === 'mias' ? perfil.id : cartera;
    return todos.filter((l) => l.propietario_id === id);
  }, [todos, cartera, verCartera, perfil.id]);

  const carteras = useMemo(() => [...new Set(todos.map((l) => l.propietario_id))].filter((id) => id !== perfil.id), [todos, perfil.id]);
  const personas = useMemo(
    () => (verCartera ? carteras.map((id) => ({ id, nombre: nombres.get(id) ?? 'Usuario' })) : undefined),
    [verCartera, carteras, nombres],
  );
  const asignables = useMemo(
    () => (p.esGestor ? (perfiles.data ?? []).filter((u) => u.activo).map((u) => ({ id: u.id, nombre: nombreCompleto(u) })) : undefined),
    [p.esGestor, perfiles.data],
  );
  const registroPersonas = useMemo(
    () => (verCartera ? [{ id: perfil.id, nombre: 'Yo' }, ...(personas ?? [])] : undefined),
    [verCartera, perfil.id, personas],
  );

  const abrirDesdeLista = useCallback((id: string) => {
    setFoco(id);
    setVista('llamar');
  }, []);
  const focoUsado = useCallback(() => setFoco(null), []);

  const migracionPendiente =
    leadsQ.error && /PGRST205|schema cache|does not exist|42P01/i.test(`${(leadsQ.error as { code?: string }).code ?? ''} ${(leadsQ.error as Error).message}`);

  const pendientes = colaPendientes(visibles).length;
  const seguimiento = visibles.filter((l) => ESTADOS_SEGUIMIENTO.includes(l.estado)).length;

  return (
    <div>
      <PageHeader
        titulo="Prospección"
        subtitulo="Llama a tus leads, envía el correo con la presentación y el maxímetro y sigue el proceso hasta la comparativa."
        acciones={
          <div className="flex flex-wrap items-center gap-2">
            {verCartera && (
              <Select className="w-auto" value={cartera} onChange={(e) => setCartera(e.target.value)}>
                <option value="mias">Mi cartera</option>
                <option value="todas">Todas las carteras</option>
                {carteras.map((id) => <option key={id} value={id}>{nombres.get(id) ?? 'Usuario'}</option>)}
              </Select>
            )}
            <Button icon={<Upload className="h-4 w-4" />} onClick={() => setImportar(true)}>
              Importar Excel
            </Button>
          </div>
        }
      />

      {migracionPendiente ? (
        <Aviso tipo="warning" titulo="Falta preparar la base de datos">
          Aplica la migración <code className="font-mono">supabase/migrations/20261023100000_leads.sql</code> en Supabase para activar la prospección.
        </Aviso>
      ) : leadsQ.error ? (
        <ErrorState mensaje={mensajeError(leadsQ.error)} onRetry={() => leadsQ.refetch()} />
      ) : leadsQ.isLoading ? (
        <Skeleton className="h-72 w-full" />
      ) : (
        <div className="space-y-4">
          <Tabs
            value={vista}
            onChange={setVista}
            tabs={[
              { value: 'llamar', label: 'Llamar', count: pendientes },
              { value: 'lista', label: 'Lista', count: visibles.length },
              { value: 'seguimiento', label: 'Seguimiento', count: seguimiento },
              { value: 'registro', label: 'Registro diario' },
            ]}
          />
          {vista === 'llamar' && (
            <LlamarLeads leads={visibles} focoId={foco} onFocoUsado={focoUsado} nombreCartera={nombreCartera} puedeEditar={puedeEditar} />
          )}
          {vista === 'lista' && <ListaLeads leads={visibles} mostrarCartera={verCartera && cartera === 'todas'} nombreCartera={nombreCartera} onAbrir={abrirDesdeLista} />}
          {vista === 'seguimiento' && (
            <SeguimientoLeads leads={visibles} mostrarCartera={verCartera && cartera === 'todas'} nombreCartera={nombreCartera} puedeEditar={puedeEditar} />
          )}
          {vista === 'registro' && <RegistroLeads personas={registroPersonas} />}
        </div>
      )}

      <ImportarLeads open={importar} onClose={() => setImportar(false)} propietarios={asignables} />
    </div>
  );
}
