import { Trash2, Upload, UserPlus } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { usePerfil } from '@/auth/AuthProvider';
import { usePermisos } from '@/auth/permisos';
import { BorrarModulo } from '@/components/leads/BorrarModulo';
import { ImportarLeads } from '@/components/leads/ImportarLeads';
import { ListaLeads } from '@/components/leads/ListaLeads';
import { NuevoCliente } from '@/components/leads/NuevoCliente';
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
import { colaPendientes, ESTADOS_SEGUIMIENTO, modulosDe, type Lead } from '@/lib/leads';
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
  const [nuevo, setNuevo] = useState(false);
  const [borrar, setBorrar] = useState(false);
  const [modulo, setModulo] = useState('');
  const [params, setParams] = useSearchParams();
  const [foco, setFoco] = useState<string | null>(null);
  const verCartera = p.esGestor || p.esJefe;

  // «Nuevo cliente» del menú lateral llega como /prospeccion?nuevo=1
  useEffect(() => {
    if (params.get('nuevo')) {
      setNuevo(true);
      params.delete('nuevo');
      setParams(params, { replace: true });
    }
  }, [params, setParams]);

  const nombres = useMemo(() => {
    const m = new Map<string, string>();
    (perfiles.data ?? []).forEach((u) => m.set(u.id, nombreCompleto(u)));
    return m;
  }, [perfiles.data]);
  const nombreCartera = useCallback((id: string) => nombres.get(id) ?? null, [nombres]);
  const puedeEditar = useCallback((l: Lead) => p.esGestor || l.propietario_id === perfil.id, [p.esGestor, perfil.id]);

  const todos = leadsQ.data ?? [];
  const deLaCartera = useMemo(() => {
    if (!verCartera || cartera === 'todas') return todos;
    const id = cartera === 'mias' ? perfil.id : cartera;
    return todos.filter((l) => l.propietario_id === id);
  }, [todos, cartera, verCartera, perfil.id]);
  const modulos = useMemo(() => modulosDe(deLaCartera), [deLaCartera]);
  // Si el módulo elegido ya no existe (otra cartera), se vuelve a «todos».
  const moduloEfectivo = modulo === '' || modulo === '__sin' || modulos.includes(modulo) ? modulo : '';
  const visibles = useMemo(() => {
    if (moduloEfectivo === '') return deLaCartera;
    if (moduloEfectivo === '__sin') return deLaCartera.filter((l) => !l.modulo);
    return deLaCartera.filter((l) => l.modulo === moduloEfectivo);
  }, [deLaCartera, moduloEfectivo]);

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

  const focoUsado = useCallback(() => setFoco(null), []);

  const migracionPendiente =
    leadsQ.error && /PGRST205|schema cache|does not exist|42P01/i.test(`${(leadsQ.error as { code?: string }).code ?? ''} ${(leadsQ.error as Error).message}`);

  // Lo que se puede borrar del módulo elegido: solo lo que esta persona puede editar.
  const borrables = useMemo(() => visibles.filter(puedeEditar), [visibles, puedeEditar]);
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
            {(modulos.length > 0 || deLaCartera.some((l) => !l.modulo)) && (
              <Select className="w-auto" value={moduloEfectivo} onChange={(e) => setModulo(e.target.value)} aria-label="Módulo">
                <option value="">Todos los módulos</option>
                {modulos.map((m) => <option key={m} value={m}>Módulo {m}</option>)}
                {modulos.length > 0 && <option value="__sin">Sin módulo</option>}
              </Select>
            )}
            {moduloEfectivo !== '' && moduloEfectivo !== '__sin' && borrables.length > 0 && (
              <Button variant="ghost" icon={<Trash2 className="h-4 w-4" />} className="text-red-600 hover:bg-red-50 hover:text-red-700" onClick={() => setBorrar(true)}>
                Borrar módulo
              </Button>
            )}
            <Button variant="secondary" icon={<UserPlus className="h-4 w-4" />} onClick={() => setNuevo(true)}>
              Nuevo cliente
            </Button>
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
            <LlamarLeads leads={visibles} focoId={foco} onFocoUsado={focoUsado} nombreCartera={nombreCartera} puedeEditar={puedeEditar} modulos={modulos} />
          )}
          {vista === 'lista' && <ListaLeads leads={visibles} mostrarCartera={verCartera && cartera === 'todas'} nombreCartera={nombreCartera} puedeEditar={puedeEditar} modulos={modulos} onLlamar={(id) => { setFoco(id); setVista('llamar'); }} />}
          {vista === 'seguimiento' && (
            <SeguimientoLeads leads={visibles} mostrarCartera={verCartera && cartera === 'todas'} nombreCartera={nombreCartera} puedeEditar={puedeEditar} modulos={modulos} />
          )}
          {vista === 'registro' && <RegistroLeads personas={registroPersonas} leads={visibles} />}
        </div>
      )}

      <ImportarLeads open={importar} onClose={() => setImportar(false)} propietarios={asignables} modulos={modulos} moduloActual={moduloEfectivo === '__sin' ? '' : moduloEfectivo} />
      <BorrarModulo open={borrar} onClose={() => setBorrar(false)} modulo={moduloEfectivo} leads={borrables} onBorrado={() => setModulo('')} />
      <NuevoCliente open={nuevo} onClose={() => setNuevo(false)} modulos={modulos} moduloInicial={moduloEfectivo === '__sin' ? '' : moduloEfectivo} propietarios={asignables} />
    </div>
  );
}
