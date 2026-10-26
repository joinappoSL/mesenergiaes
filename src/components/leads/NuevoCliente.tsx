import { UserPlus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { usePerfil } from '@/auth/AuthProvider';
import { Button } from '@/components/ui/Button';
import { Field, Select } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { useCrearCliente } from '@/hooks/leads';
import { deInputFecha } from '@/lib/leads';
import { mensajeError } from '@/lib/utils';
import { limpiarTelefono } from '@/lib/leads';
import { CamposCliente, FORM_VACIO, type FormCliente } from './CamposCliente';

interface Props {
  open: boolean;
  onClose: () => void;
  modulos: string[];
  /** módulo que está filtrado ahora, para proponerlo */
  moduloInicial?: string;
  propietarios?: { id: string; nombre: string }[];
}

export function NuevoCliente({ open, onClose, modulos, moduloInicial, propietarios }: Props) {
  const perfil = usePerfil();
  const crear = useCrearCliente();
  const [form, setForm] = useState<FormCliente>(FORM_VACIO);
  const [propietarioId, setPropietarioId] = useState(perfil.id);

  useEffect(() => {
    if (open) {
      setForm({ ...FORM_VACIO, modulo: moduloInicial ?? '' });
      setPropietarioId(perfil.id);
    }
  }, [open, moduloInicial, perfil.id]);

  const valido = form.nombre.trim() !== '' || form.telefono.trim() !== '';

  async function guardar() {
    try {
      const consumo = parseFloat(form.consumo_anual.replace(/\./g, '').replace(',', '.'));
      await crear.mutateAsync({
        propietarioId,
        cliente: {
          nombre: form.nombre.trim(),
          telefono: limpiarTelefono(form.telefono),
          telefono2: limpiarTelefono(form.telefono2),
          email: form.email.trim(),
          kw: form.kw.trim(),
          cups: form.cups.replace(/\s/g, '').toUpperCase(),
          comercializadora: form.comercializadora.trim(),
          consumo_anual: Number.isFinite(consumo) ? consumo : null,
          modulo: form.modulo.trim(),
          extra: {},
          estado: form.estado,
          nota: form.nota,
          correo_enviado_at: deInputFecha(form.correo_enviado_at),
          facturas_recibidas_at: deInputFecha(form.facturas_recibidas_at),
          comparativa_enviada_at: deInputFecha(form.comparativa_enviada_at),
          visita_at: deInputFecha(form.visita_at),
          visita_lugar: form.visita_lugar.trim(),
          visita_notas: form.visita_notas,
          firmado_at: deInputFecha(form.firmado_at),
        },
      });
      toast.success('Cliente añadido');
      onClose();
    } catch (e) {
      const msg = mensajeError(e);
      toast.error(msg);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      persistent
      title="Nuevo cliente"
      description="Añade un cliente a mano, aunque no esté en ningún listado. Rellena las fechas que ya tengas."
      icon={<UserPlus className="h-5 w-5" />}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button onClick={guardar} disabled={!valido} loading={crear.isPending}>Guardar cliente</Button>
        </>
      }
    >
      <div className="space-y-5">
        {propietarios && propietarios.length > 0 && (
          <Field label="Cartera de">
            <Select value={propietarioId} onChange={(e) => setPropietarioId(e.target.value)}>
              <option value={perfil.id}>Yo</option>
              {propietarios.filter((p) => p.id !== perfil.id).map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </Select>
          </Field>
        )}
        <CamposCliente valor={form} onChange={setForm} modulos={modulos} conNota />
      </div>
    </Modal>
  );
}
