import { ClipboardPlus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { usePerfil } from '@/auth/AuthProvider';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select, Textarea } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { useCrearActividad } from '@/hooks/actividad';
import { nombreCompleto } from '@/lib/format';
import { TIPOS_ACTIVIDAD, TIPOS_MANUALES, type TipoActividad } from '@/lib/actividad';
import { aInputFecha, deInputFecha } from '@/lib/leads';
import { mensajeError } from '@/lib/utils';

interface Props {
  open: boolean;
  onClose: () => void;
  /** personas a las que un gestor puede atribuir el registro */
  personas?: { id: string; nombre: string }[];
}

/** Cierre del día / registro de actividad a mano. */
export function NuevoRegistro({ open, onClose, personas }: Props) {
  const perfil = usePerfil();
  const crear = useCrearActividad();
  const [tipo, setTipo] = useState<TipoActividad>('correo_enviado');
  const [cuando, setCuando] = useState('');
  const [persona, setPersona] = useState(perfil.id);
  const [empresa, setEmpresa] = useState('');
  const [contacto, setContacto] = useState('');
  const [detalle, setDetalle] = useState('');
  const [cantidad, setCantidad] = useState('1');

  useEffect(() => {
    if (open) {
      setCuando(aInputFecha(new Date().toISOString()));
      setPersona(perfil.id);
      setEmpresa('');
      setContacto('');
      setDetalle('');
      setCantidad('1');
    }
  }, [open, perfil.id]);

  const n = Math.floor(Number(cantidad));
  const valido = Number.isFinite(n) && n >= 1 && (empresa.trim() !== '' || detalle.trim() !== '' || tipo === 'llamadas');
  const nombrePersona = persona === perfil.id ? nombreCompleto(perfil) : (personas?.find((p) => p.id === persona)?.nombre ?? '');

  async function guardar() {
    try {
      await crear.mutateAsync({
        ocurrio_at: deInputFecha(cuando) ?? new Date().toISOString(),
        persona_id: persona,
        autor: nombrePersona,
        tipo,
        empresa: empresa.trim(),
        contacto: contacto.trim(),
        detalle: detalle.trim(),
        cantidad: n,
      });
      toast.success('Registro guardado');
      onClose();
    } catch (e) {
      toast.error(mensajeError(e));
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      persistent
      title="Añadir registro"
      description="Un hecho del día: llamadas, correos enviados, facturas recibidas, citas, ventas…"
      icon={<ClipboardPlus className="h-5 w-5" />}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button onClick={guardar} disabled={!valido} loading={crear.isPending}>Guardar</Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Qué ha pasado">
            <Select value={tipo} onChange={(e) => setTipo(e.target.value as TipoActividad)}>
              {TIPOS_MANUALES.map((t) => <option key={t} value={t}>{TIPOS_ACTIVIDAD[t].etiqueta}</option>)}
            </Select>
          </Field>
          <Field label="Día y hora">
            <Input type="datetime-local" value={cuando} onChange={(e) => setCuando(e.target.value)} />
          </Field>
          {personas && personas.length > 0 && (
            <Field label="De quién">
              <Select value={persona} onChange={(e) => setPersona(e.target.value)}>
                <option value={perfil.id}>Yo</option>
                {personas.filter((p) => p.id !== perfil.id).map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </Select>
            </Field>
          )}
          <Field label={tipo === 'llamadas' ? 'Cuántas llamadas' : 'Cantidad'}>
            <Input type="number" min={1} value={cantidad} onChange={(e) => setCantidad(e.target.value)} />
          </Field>
          <Field label="Empresa"><Input value={empresa} onChange={(e) => setEmpresa(e.target.value)} /></Field>
          <Field label="Persona de contacto"><Input value={contacto} onChange={(e) => setContacto(e.target.value)} /></Field>
        </div>
        <Field label="Detalle">
          <Textarea className="min-h-[72px]" value={detalle} onChange={(e) => setDetalle(e.target.value)} placeholder="Presentación enviada y facturas pedidas para estudio…" />
        </Field>
      </div>
    </Modal>
  );
}
