import { Save } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select, Textarea } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { useGuardarResidencial, type DatosResidencial } from '@/hooks/residenciales';
import { limpiarTelefono } from '@/lib/leads';
import { SUMINISTROS, type Residencial, type SuministroResidencial } from '@/lib/residenciales';
import { mensajeError } from '@/lib/utils';

const hoyISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const VACIO: DatosResidencial = { nombre: '', telefono: '', email: '', cups: '', suministro: 'luz', comercializadora: '', firmado_at: '', notas: '' };

interface Props {
  open: boolean;
  onClose: () => void;
  /** cliente a editar; sin él, se crea uno nuevo */
  editar?: Residencial | null;
  /** cartera donde se crea (gestores pueden elegir otra persona) */
  propietarioId?: string;
  personas?: { id: string; nombre: string }[];
}

/** Alta y edición de un cliente residencial firmado (con la fecha de la firma). */
export function FormResidencial({ open, onClose, editar, propietarioId, personas }: Props) {
  const guardar = useGuardarResidencial();
  const [form, setForm] = useState<DatosResidencial>({ ...VACIO, firmado_at: hoyISO() });
  const [dueno, setDueno] = useState(propietarioId);

  useEffect(() => {
    if (!open) return;
    setForm(editar ? { nombre: editar.nombre, telefono: editar.telefono, email: editar.email, cups: editar.cups, suministro: editar.suministro, comercializadora: editar.comercializadora, firmado_at: editar.firmado_at, notas: editar.notas } : { ...VACIO, firmado_at: hoyISO() });
    setDueno(propietarioId);
  }, [open, editar, propietarioId]);

  const set = <K extends keyof DatosResidencial>(k: K, v: DatosResidencial[K]) => setForm((f) => ({ ...f, [k]: v }));

  async function enviar() {
    if (!form.nombre.trim()) {
      toast.error('Pon el nombre del cliente.');
      return;
    }
    if (!form.firmado_at) {
      toast.error('Pon la fecha en la que firmó.');
      return;
    }
    try {
      await guardar.mutateAsync({
        id: editar?.id,
        propietarioId: editar ? undefined : dueno,
        datos: { ...form, nombre: form.nombre.trim(), telefono: limpiarTelefono(form.telefono), email: form.email.trim(), cups: form.cups.replace(/\s/g, '').toUpperCase(), comercializadora: form.comercializadora.trim() },
      });
      toast.success(editar ? 'Cliente actualizado' : 'Cliente residencial añadido');
      onClose();
    } catch (e) {
      toast.error(mensajeError(e));
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={editar ? 'Editar cliente residencial' : 'Nuevo cliente residencial'}
      description="Guarda la fecha en la que firmó: cuenta para el conteo de residenciales vendidos."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button icon={<Save className="h-4 w-4" />} onClick={enviar} loading={guardar.isPending}>Guardar</Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nombre del cliente" required><Input value={form.nombre} onChange={(e) => set('nombre', e.target.value)} autoFocus /></Field>
        <Field label="Fecha de firma" required><Input type="date" value={form.firmado_at} onChange={(e) => set('firmado_at', e.target.value)} /></Field>
        <Field label="Teléfono"><Input value={form.telefono} onChange={(e) => set('telefono', e.target.value)} placeholder="612 345 678" /></Field>
        <Field label="Email"><Input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} /></Field>
        <Field label="Suministro">
          <Select value={form.suministro} onChange={(e) => set('suministro', e.target.value as SuministroResidencial)}>
            {(Object.keys(SUMINISTROS) as SuministroResidencial[]).map((s) => <option key={s} value={s}>{SUMINISTROS[s].etiqueta}</option>)}
          </Select>
        </Field>
        <Field label="Comercializadora"><Input value={form.comercializadora} onChange={(e) => set('comercializadora', e.target.value)} /></Field>
        <Field label="CUPS"><Input value={form.cups} onChange={(e) => set('cups', e.target.value)} /></Field>
        {!editar && personas && personas.length > 1 && (
          <Field label="Cartera de">
            <Select value={dueno} onChange={(e) => setDueno(e.target.value)}>
              {personas.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </Select>
          </Field>
        )}
      </div>
      <div className="mt-3">
        <Field label="Notas"><Textarea className="min-h-[64px]" value={form.notas} onChange={(e) => set('notas', e.target.value)} /></Field>
      </div>
    </Modal>
  );
}
