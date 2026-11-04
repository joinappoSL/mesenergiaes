import { ClipboardCopy, MessageCircle } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { usePerfil } from '@/auth/AuthProvider';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select, Textarea } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { useWhatsappEnviado } from '@/hooks/leads';
import { useEstadoPersistente } from '@/hooks/useEstadoPersistente';
import { nombreCompleto, telefono } from '@/lib/format';
import { construirWhatsapp, enlaceWhatsapp, FIRMANTES, telefonosDe, type DatosCorreo, type Idioma, type Lead } from '@/lib/leads';
import { copiarAlPortapapeles, mensajeError, urlApp } from '@/lib/utils';

const RUTA_PRESENTACION = 'leads/presentacion-mes-energia-pymes.pdf';

interface Props {
  lead: Lead;
  open: boolean;
  onClose: () => void;
}

/** WhatsApp al lead (aparte del correo): mensaje corto en catalán o castellano que abre el chat ya escrito. */
export function PanelWhatsapp({ lead, open, onClose }: Props) {
  const perfil = usePerfil();
  const enviado = useWhatsappEnviado();
  const [pref, setPref] = useEstadoPersistente<{ idioma: Idioma }>('mes-whatsapp-leads', { idioma: 'ca' }, 'local');
  const miNombre = nombreCompleto(perfil);
  const firmas = useMemo(() => [...new Set([miNombre, ...FIRMANTES].filter((x) => x && x !== '—'))], [miNombre]);
  const telefonos = telefonosDe(lead);

  const [nombre, setNombre] = useState(lead.nombre);
  const [firma, setFirma] = useState(miNombre);
  const [tel, setTel] = useState(telefonos[0] ?? '');
  const [editado, setEditado] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setNombre(lead.nombre);
    setTel(telefonosDe(lead)[0] ?? '');
    setEditado(null);
    // solo al abrir o al cambiar de lead
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, lead.id]);

  const datos: DatosCorreo = {
    nombre: nombre.trim(),
    cups: '',
    consumo: '',
    periodo: 3,
    pct: '',
    comercializadora: '',
    firma,
    presentacionUrl: urlApp(RUTA_PRESENTACION),
    tieneMaximetro: false,
    equilibrado: true,
    hora: new Date().getHours(),
  };
  const texto = editado ?? construirWhatsapp(pref.idioma, datos);

  async function abrir() {
    if (!tel) {
      toast.error('Este lead no tiene teléfono.');
      return;
    }
    window.open(enlaceWhatsapp(tel, texto), '_blank', 'noopener');
    try {
      await enviado.mutateAsync({ lead, telefono: telefono(tel) });
    } catch (e) {
      toast.error(mensajeError(e));
    }
  }

  async function copiar() {
    if (await copiarAlPortapapeles(texto)) toast.success('Mensaje copiado');
    else toast.error('No se pudo copiar. Selecciona el texto y cópialo a mano.');
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={`WhatsApp a ${lead.nombre || 'este lead'}`}
      description="Se abre el chat con el mensaje ya escrito; solo tienes que pulsar enviar."
      icon={<MessageCircle className="h-5 w-5" />}
      footer={
        <>
          <Button variant="secondary" icon={<ClipboardCopy className="h-4 w-4" />} onClick={copiar}>Copiar mensaje</Button>
          <Button icon={<MessageCircle className="h-4 w-4" />} onClick={abrir} loading={enviado.isPending} disabled={!tel}>
            Abrir WhatsApp
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Idioma">
            <Select value={pref.idioma} onChange={(e) => { setPref({ idioma: e.target.value as Idioma }); setEditado(null); }}>
              <option value="ca">Català</option>
              <option value="es">Castellano</option>
            </Select>
          </Field>
          <Field label="Firma">
            <Select value={firma} onChange={(e) => { setFirma(e.target.value); setEditado(null); }}>
              {firmas.map((f) => <option key={f} value={f}>{f}</option>)}
            </Select>
          </Field>
          <Field label="Teléfono">
            {telefonos.length > 1 ? (
              <Select value={tel} onChange={(e) => setTel(e.target.value)}>
                {telefonos.map((t) => <option key={t} value={t}>{telefono(t)}</option>)}
              </Select>
            ) : (
              <Input value={telefonos[0] ? telefono(telefonos[0]) : ''} readOnly placeholder="Sin teléfono" />
            )}
          </Field>
          <Field label="Nombre para el saludo">
            <Input value={nombre} onChange={(e) => { setNombre(e.target.value); setEditado(null); }} />
          </Field>
        </div>
        <Field label="Mensaje (puedes editarlo)">
          <Textarea className="min-h-[170px]" value={texto} onChange={(e) => setEditado(e.target.value)} />
        </Field>
        <p className="text-xs text-slate-500">Al abrir WhatsApp se anota en el historial del cliente (no cuenta como llamada).</p>
      </div>
    </Modal>
  );
}
