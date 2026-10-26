import { Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Aviso } from '@/components/ui/Feedback';
import { Input } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { useEliminarLeads } from '@/hooks/leads';
import type { Lead } from '@/lib/leads';
import { mensajeError } from '@/lib/utils';

interface Props {
  open: boolean;
  onClose: () => void;
  /** nombre del módulo, p. ej. 08022 */
  modulo: string;
  /** los leads de ese módulo que esta persona puede borrar */
  leads: Lead[];
  onBorrado: () => void;
}

export function BorrarModulo({ open, onClose, modulo, leads, onBorrado }: Props) {
  const eliminar = useEliminarLeads();
  const [texto, setTexto] = useState('');
  useEffect(() => {
    if (open) setTexto('');
  }, [open]);

  const trabajados = leads.filter((l) => l.estado !== 'pendiente').length;
  const conFechas = leads.filter((l) => l.facturas_recibidas_at || l.visita_at || l.firmado_at).length;
  const confirmado = texto.trim() === modulo;

  async function borrar() {
    try {
      const n = await eliminar.mutateAsync(leads.map((l) => l.id));
      toast.success(`Módulo ${modulo} borrado: ${n} clientes`);
      onBorrado();
      onClose();
    } catch (e) {
      toast.error(mensajeError(e));
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      persistent
      title={`Borrar el módulo ${modulo}`}
      icon={<Trash2 className="h-5 w-5" />}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button variant="danger" onClick={borrar} disabled={!confirmado} loading={eliminar.isPending}>
            Borrar {leads.length} clientes
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-slate-700">
          Se van a borrar <b>{leads.length}</b> clientes del módulo <b>{modulo}</b>, con su historial, sus notas y sus archivos adjuntos.
          No se puede deshacer.
        </p>
        {(trabajados > 0 || conFechas > 0) && (
          <Aviso tipo="warning">
            {trabajados > 0 && <>{trabajados} ya tienen llamadas o seguimiento. </>}
            {conFechas > 0 && <>{conFechas} tienen facturas recibidas, visita o firma: esas cifras desaparecerán de las estadísticas.</>}
          </Aviso>
        )}
        <div>
          <label className="mb-1.5 block text-[13px] font-semibold text-slate-700" htmlFor="confirmar-modulo">
            Escribe <span className="font-mono">{modulo}</span> para confirmar
          </label>
          <Input id="confirmar-modulo" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder={modulo} autoComplete="off" />
        </div>
      </div>
    </Modal>
  );
}
