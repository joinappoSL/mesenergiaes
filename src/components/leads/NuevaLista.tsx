import { FolderPlus, Upload } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { useCrearLista } from '@/hooks/leads';
import { mensajeError } from '@/lib/utils';

interface Props {
  open: boolean;
  onClose: () => void;
  /** cartera donde se crea (por defecto, la del usuario) */
  propietarioInicial: string;
  /** personas a las que se puede asignar (solo gestores) */
  propietarios?: { id: string; nombre: string }[];
  /** conExcel: se ha pedido añadir un Excel justo después de crearlo */
  onCreada?: (nombre: string, propietarioId: string, conExcel: boolean) => void;
}

/** Crea una lista (módulo) vacía para ir llenándola después. */
export function NuevaLista({ open, onClose, propietarioInicial, propietarios, onCreada }: Props) {
  const crear = useCrearLista();
  const [nombre, setNombre] = useState('');
  const [propietario, setPropietario] = useState(propietarioInicial);

  useEffect(() => {
    if (open) {
      setNombre('');
      setPropietario(propietarioInicial);
    }
  }, [open, propietarioInicial]);

  async function guardar(conExcel: boolean) {
    const n = nombre.trim();
    if (!n) return;
    try {
      await crear.mutateAsync({ nombre: n, propietarioId: propietario });
      toast.success(`Módulo «${n}» creado`);
      onCreada?.(n, propietario, conExcel);
      onClose();
    } catch (e) {
      toast.error(mensajeError(e));
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Nuevo módulo"
      description="Crea el módulo (lista) y, si quieres, añade ya su Excel con los leads."
      icon={<FolderPlus className="h-5 w-5" />}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button variant="secondary" icon={<FolderPlus className="h-4 w-4" />} onClick={() => guardar(false)} loading={crear.isPending} disabled={!nombre.trim()}>
            Crear módulo vacío
          </Button>
          <Button icon={<Upload className="h-4 w-4" />} onClick={() => guardar(true)} loading={crear.isPending} disabled={!nombre.trim()}>
            Crear y añadir Excel
          </Button>
        </>
      }
    >
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); guardar(true); }}>
        <Field label="Nombre del módulo">
          <Input autoFocus value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Carlitos sin utilizar Mario o 08017" />
        </Field>
        {propietarios && propietarios.length > 1 && (
          <Field label="Cartera">
            <Select value={propietario} onChange={(e) => setPropietario(e.target.value)}>
              {propietarios.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </Select>
          </Field>
        )}
      </form>
    </Modal>
  );
}
