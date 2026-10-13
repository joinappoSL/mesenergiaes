import { ArrowRight, RefreshCcw, Trash2, UserCog } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { EstadoBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Aviso } from '@/components/ui/Feedback';
import { Field, Select, Textarea } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { useEquipos, usePerfiles } from '@/hooks/datos';
import { useCambiarEstado, useEliminarContrato, useReasignar } from '@/hooks/mutaciones';
import { ESTADOS, LISTA_ESTADOS } from '@/lib/constants';
import { nombreCompleto, numeroContrato } from '@/lib/format';
import type { Contrato, EstadoContrato } from '@/lib/types';
import { cn, mensajeError } from '@/lib/utils';

interface CambiarEstadoProps {
  contrato: Pick<Contrato, 'id' | 'numero' | 'estado' | 'cliente_nombre' | 'cliente_apellidos'> | null;
  estadoInicial?: EstadoContrato;
  onClose: () => void;
  onHecho?: () => void;
}

export function CambiarEstadoModal({ contrato, estadoInicial, onClose, onHecho }: CambiarEstadoProps) {
  const [estado, setEstado] = useState<EstadoContrato>('pendiente');
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const cambiar = useCambiarEstado();

  // Solo se reinicia al abrir para otro contrato (no en cada refresco en tiempo real).
  const contratoId = contrato?.id;
  const estadoActual = contrato?.estado;
  useEffect(() => {
    if (contratoId && estadoActual) {
      setEstado(estadoInicial ?? estadoActual);
      setMotivo('');
      setError(null);
    }
  }, [contratoId, estadoInicial]);

  if (!contrato) return null;
  const requiere = ESTADOS[estado].requiereMotivo;

  async function guardar() {
    if (!contrato) return;
    if (estado === contrato.estado) return setError('Elige un estado distinto al actual.');
    if (requiere && !motivo.trim()) return setError(`El motivo es obligatorio para ${ESTADOS[estado].etiqueta}.`);
    try {
      await cambiar.mutateAsync({ id: contrato.id, estado, motivo });
      toast.success(`${numeroContrato(contrato.numero)} pasa a ${ESTADOS[estado].etiqueta}`);
      onHecho?.();
      onClose();
    } catch (e) {
      setError(mensajeError(e));
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Cambiar estado"
      description={`${numeroContrato(contrato.numero)} · ${contrato.cliente_nombre} ${contrato.cliente_apellidos}`}
      icon={<RefreshCcw className="h-5 w-5" />}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={guardar} loading={cambiar.isPending}>
            Guardar estado
          </Button>
        </>
      }
    >
      <div className="mb-4 flex items-center gap-2 text-sm text-slate-500">
        <EstadoBadge estado={contrato.estado} />
        <ArrowRight className="h-4 w-4" />
        <EstadoBadge estado={estado} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        {LISTA_ESTADOS.map((e) => (
          <button
            key={e}
            type="button"
            onClick={() => {
              setEstado(e);
              setError(null);
            }}
            disabled={e === contrato.estado}
            className={cn(
              'flex items-start gap-2.5 rounded-xl p-3 text-left ring-1 transition disabled:cursor-not-allowed disabled:opacity-40',
              estado === e ? 'bg-white shadow-sm ring-2 ring-navy-700' : 'bg-slate-50 ring-slate-200 hover:bg-white',
            )}
          >
            <span className={cn('mt-1 h-2.5 w-2.5 shrink-0 rounded-full', ESTADOS[e].punto)} />
            <span>
              <span className="block text-sm font-semibold text-navy-900">{ESTADOS[e].etiqueta}</span>
              <span className="block text-xs leading-snug text-slate-500">{ESTADOS[e].descripcion}</span>
            </span>
          </button>
        ))}
      </div>
      <Field
        label="Motivo"
        required={requiere}
        hint={requiere ? 'Obligatorio para Cancelado y Riesgos' : 'Opcional'}
        className="mt-4"
      >
        <Textarea
          rows={3}
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          placeholder={estado === 'riesgos' ? 'Ej: no supera el scoring de la operadora' : estado === 'cancelado' ? 'Ej: el cliente desiste' : ''}
          invalid={!!error && requiere && !motivo.trim()}
        />
      </Field>
      {error && <p className="mt-2 text-sm font-medium text-red-600">{error}</p>}
    </Modal>
  );
}

export function ReasignarModal({
  contrato,
  onClose,
}: {
  contrato: Pick<Contrato, 'id' | 'numero' | 'comercial_id'> | null;
  onClose: () => void;
}) {
  const perfiles = usePerfiles();
  const equipos = useEquipos();
  const reasignar = useReasignar();
  const [comercialId, setComercialId] = useState('');

  const contratoId = contrato?.id;
  useEffect(() => {
    setComercialId(contrato?.comercial_id ?? '');
  }, [contratoId]);

  const porEquipo = useMemo(() => {
    const comerciales = (perfiles.data ?? []).filter((p) => p.rol === 'comercial' && p.activo);
    const grupos = new Map<string, typeof comerciales>();
    for (const c of comerciales) {
      const nombre = equipos.data?.find((e) => e.id === c.equipo_id)?.nombre ?? 'Sin equipo';
      grupos.set(nombre, [...(grupos.get(nombre) ?? []), c]);
    }
    return [...grupos.entries()].sort(([a], [b]) => a.localeCompare(b, 'es'));
  }, [perfiles.data, equipos.data]);

  if (!contrato) return null;

  async function guardar() {
    if (!contrato || !comercialId || comercialId === contrato.comercial_id) return onClose();
    try {
      await reasignar.mutateAsync({ id: contrato.id, comercialId });
      toast.success('Contrato reasignado');
      onClose();
    } catch (e) {
      toast.error(mensajeError(e));
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Reasignar comercial"
      description={`${numeroContrato(contrato.numero)} · el equipo se actualiza con el del nuevo comercial`}
      icon={<UserCog className="h-5 w-5" />}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={guardar} loading={reasignar.isPending} disabled={!comercialId}>
            Reasignar
          </Button>
        </>
      }
    >
      <Field label="Nuevo comercial" required>
        <Select value={comercialId} onChange={(e) => setComercialId(e.target.value)}>
          <option value="" disabled>
            Elige un comercial…
          </option>
          {porEquipo.map(([equipo, lista]) => (
            <optgroup key={equipo} label={equipo}>
              {lista.map((p) => (
                <option key={p.id} value={p.id}>
                  {nombreCompleto(p)}
                </option>
              ))}
            </optgroup>
          ))}
        </Select>
      </Field>
    </Modal>
  );
}

// -----------------------------------------------------------------------------
// Eliminar contrato (solo admin)
// -----------------------------------------------------------------------------
export function EliminarContratoModal({
  contrato,
  onClose,
}: {
  contrato: Pick<Contrato, 'id' | 'numero' | 'cliente_nombre' | 'cliente_apellidos'>;
  onClose: () => void;
}) {
  const eliminar = useEliminarContrato();
  const navigate = useNavigate();

  async function confirmar() {
    try {
      await eliminar.mutateAsync(contrato.id);
      toast.success(`${numeroContrato(contrato.numero)} eliminado`);
      onClose();
      navigate('/contratos', { replace: true });
    } catch (e) {
      toast.error(mensajeError(e));
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Eliminar contrato"
      description={`${numeroContrato(contrato.numero)} · ${contrato.cliente_nombre} ${contrato.cliente_apellidos}`}
      icon={<Trash2 className="h-5 w-5" />}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="danger" onClick={confirmar} loading={eliminar.isPending} icon={<Trash2 className="h-4 w-4" />}>
            Eliminar definitivamente
          </Button>
        </>
      }
    >
      <Aviso tipo="danger" titulo="No se puede deshacer">
        Se borrará el contrato con sus teléfonos, PDF, observaciones, llamadas e historial. Úsalo solo para contratos de
        prueba o duplicados; para una venta caída, cambia el estado a Cancelado.
      </Aviso>
    </Modal>
  );
}
