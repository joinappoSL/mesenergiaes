import { CheckCircle2, ClipboardCopy, FileSpreadsheet, Mail, Send } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { usePerfil } from '@/auth/AuthProvider';
import { Button } from '@/components/ui/Button';
import { Aviso } from '@/components/ui/Feedback';
import { Field, Input, Select, Textarea } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { Tabs } from '@/components/ui/Misc';
import { useActualizarLead, useCambiarEstadoLead } from '@/hooks/leads';
import { useEstadoPersistente } from '@/hooks/useEstadoPersistente';
import { nombreCompleto } from '@/lib/format';
import {
  ASUNTO,
  construirCorreo,
  FIRMANTES,
  FORMATOS_CORREO,
  resumir,
  type DatosCorreo,
  type FormatoCorreo,
  type Idioma,
  type Lead,
} from '@/lib/leads';
import { maximetroAPdf } from '@/lib/leadsPdf';
import { copiarAlPortapapeles, descargarBlob, mensajeError, urlApp } from '@/lib/utils';
import { MaximetroModal } from './MaximetroModal';

const RUTA_PRESENTACION = 'leads/presentacion-mes-energia-pymes.pdf';

interface Props {
  lead: Lead;
  open: boolean;
  onClose: () => void;
  onEnviado?: () => void;
}

export function PanelCorreo({ lead, open, onClose, onEnviado }: Props) {
  const perfil = usePerfil();
  const actualizar = useActualizarLead();
  const cambiarEstado = useCambiarEstadoLead();
  const [pref, setPref] = useEstadoPersistente<{ idioma: Idioma; formato: FormatoCorreo }>(
    'mes-correo-leads',
    { idioma: 'ca', formato: 'completo' },
    'local',
  );
  const miNombre = nombreCompleto(perfil);
  const firmas = useMemo(() => [...new Set([miNombre, ...FIRMANTES].filter((x) => x && x !== '—'))], [miNombre]);

  const [campos, setCampos] = useState({ nombre: '', email: '', cups: '', consumo: '', periodo: '3', pct: '', comer: '', firma: miNombre });
  const [editado, setEditado] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [preparando, setPreparando] = useState(false);
  const [verMx, setVerMx] = useState(false);

  // Rellena los campos con lo que ya se sabe del lead (y se actualiza al cargar el maxímetro).
  useEffect(() => {
    if (!open) return;
    setCampos((c) => ({
      ...c,
      nombre: lead.nombre,
      email: lead.email,
      cups: lead.cups,
      consumo: lead.consumo_anual ? String(Math.round(lead.consumo_anual)) : '',
      periodo: String(lead.periodo_principal ?? 3),
      pct: lead.periodo_pct !== null ? String(lead.periodo_pct) : '',
      comer: lead.comercializadora,
      firma: c.firma || miNombre,
    }));
    setEditado(null);
    setMensaje(null);
    // solo al abrir o al cambiar el maxímetro
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, lead.id, lead.maximetro, lead.cups]);

  const set = (k: keyof typeof campos, v: string) => {
    setCampos((c) => ({ ...c, [k]: v }));
    setEditado(null);
  };

  const equilibrado = useMemo(() => {
    if (!lead.maximetro) return true;
    const r = resumir(lead.maximetro);
    return Math.abs(r.pct[0] - r.pct[1]) <= 8;
  }, [lead.maximetro]);

  const datos: DatosCorreo = {
    nombre: campos.nombre.trim(),
    cups: campos.cups.trim(),
    consumo: campos.consumo.trim(),
    periodo: Number(campos.periodo) || 3,
    pct: campos.pct.trim(),
    comercializadora: campos.comer.trim(),
    firma: campos.firma,
    presentacionUrl: urlApp(RUTA_PRESENTACION),
    tieneMaximetro: Boolean(lead.maximetro),
    equilibrado,
    hora: new Date().getHours(),
  };
  const asunto = ASUNTO[pref.idioma];
  const automatico = construirCorreo(pref.formato, pref.idioma, datos);
  const cuerpo = editado ?? automatico;
  const faltan = /\[[^\]]+\]/.test(cuerpo);

  async function guardarDatos() {
    await actualizar.mutateAsync({
      id: lead.id,
      patch: {
        nombre: campos.nombre.trim(),
        email: campos.email.trim(),
        cups: campos.cups.trim(),
        comercializadora: campos.comer.trim(),
        consumo_anual: campos.consumo.trim() ? Number(campos.consumo.replace(',', '.')) || null : null,
        periodo_principal: Number(campos.periodo) || null,
        periodo_pct: campos.pct.trim() ? Number(campos.pct) || null : null,
      },
    });
  }

  async function copiar() {
    const ok = await copiarAlPortapapeles(`Asunto: ${asunto}\n\n${cuerpo}`);
    if (ok) toast.success('Correo copiado');
    else toast.error('No se pudo copiar. Selecciona el texto y cópialo a mano.');
  }

  /** Móvil: menú de compartir con los PDF adjuntos. Ordenador: copia el texto y descarga los PDF. */
  async function enviarTodo() {
    setPreparando(true);
    setMensaje(null);
    try {
      await guardarDatos();
      const archivos: File[] = [];
      if (lead.maximetro) archivos.push(await maximetroAPdf({ ...lead.maximetro, nombre: lead.maximetro.nombre || campos.nombre }));
      const resp = await fetch(`${import.meta.env.BASE_URL}${RUTA_PRESENTACION}`);
      if (!resp.ok) throw new Error('No se encuentra la presentación en el servidor');
      archivos.push(new File([await resp.blob()], 'Presentacion-Mes-Energia.pdf', { type: 'application/pdf' }));

      if (navigator.canShare?.({ files: archivos })) {
        try {
          await navigator.share({ files: archivos, title: asunto, text: cuerpo });
          setMensaje('Compartido con los PDF adjuntos. Cuando lo hayas enviado, pulsa «Confirmar correo enviado».');
          return;
        } catch (e) {
          if ((e as Error).name === 'AbortError') return;
        }
      }
      await copiarAlPortapapeles(cuerpo);
      for (const f of archivos) {
        descargarBlob(f, f.name);
        await new Promise((r) => setTimeout(r, 400));
      }
      setMensaje(
        `Texto copiado y ${archivos.length} PDF descargados (${archivos.map((f) => f.name).join(', ')}). En el correo: pega el texto (Ctrl+V) y arrastra los PDF. Luego pulsa «Confirmar correo enviado».`,
      );
      window.location.href = `mailto:${encodeURIComponent(campos.email.trim())}?subject=${encodeURIComponent(asunto)}`;
    } catch (e) {
      toast.error(`No he podido preparar los adjuntos: ${mensajeError(e)}`);
    } finally {
      setPreparando(false);
    }
  }

  async function confirmar() {
    try {
      await guardarDatos();
      await cambiarEstado.mutateAsync({
        lead: { ...lead, nombre: campos.nombre },
        estado: 'correo',
        texto: `Correo enviado (${pref.idioma === 'ca' ? 'català' : 'castellano'}, formato ${FORMATOS_CORREO.find((f) => f.valor === pref.formato)?.etiqueta.toLowerCase()}, firma ${campos.firma}) con presentación${lead.maximetro ? ' y maxímetro' : ''}`,
      });
      toast.success('Correo registrado: el cliente pasa a Seguimiento');
      onClose();
      onEnviado?.();
    } catch (e) {
      toast.error(mensajeError(e));
    }
  }

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        size="lg"
        persistent
        title={`Correo para ${lead.nombre || 'el cliente'}`}
        icon={<Mail className="h-5 w-5" />}
        footer={
          <>
            <Button variant="secondary" onClick={onClose}>Cancelar</Button>
            <Button variant="primary" icon={<CheckCircle2 className="h-4 w-4" />} onClick={confirmar} loading={cambiarEstado.isPending}>
              Confirmar correo enviado
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Tabs
              value={pref.idioma}
              onChange={(idioma) => { setPref({ ...pref, idioma }); setEditado(null); }}
              tabs={[{ value: 'ca', label: 'Català' }, { value: 'es', label: 'Castellano' }]}
            />
            <Tabs
              value={pref.formato}
              onChange={(formato) => { setPref({ ...pref, formato }); setEditado(null); }}
              tabs={FORMATOS_CORREO.map((f) => ({ value: f.valor, label: f.etiqueta }))}
            />
          </div>

          <div className="flex flex-wrap items-center gap-3 rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200/70">
            <FileSpreadsheet className="h-5 w-5 shrink-0 text-navy-600" />
            <p className="min-w-0 flex-1 text-sm text-slate-700">
              {lead.maximetro ? (
                <>
                  <b>Maxímetro listo</b> · CUPS {lead.maximetro.cups} · {lead.maximetro.filas.length} meses
                </>
              ) : (
                <>Sin maxímetro: el correo irá solo con la presentación.</>
              )}
            </p>
            <Button size="sm" variant="secondary" onClick={() => setVerMx(true)}>
              {lead.maximetro ? 'Ver / cambiar' : 'Subir tablas de SIPS'}
            </Button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nombre"><Input value={campos.nombre} onChange={(e) => set('nombre', e.target.value)} /></Field>
            <Field label="Email del cliente"><Input type="email" value={campos.email} onChange={(e) => set('email', e.target.value)} /></Field>
            <Field label="CUPS"><Input value={campos.cups} onChange={(e) => set('cups', e.target.value)} /></Field>
            <Field label="Consumo anual (kWh)"><Input value={campos.consumo} onChange={(e) => set('consumo', e.target.value)} /></Field>
            <Field label="Periodo con más consumo" hint={lead.maximetro ? 'Elegido solo a partir de SIPS' : undefined}>
              <Select value={campos.periodo} onChange={(e) => set('periodo', e.target.value)}>
                {[1, 2, 3, 4, 5, 6].map((k) => <option key={k} value={k}>P{k}</option>)}
              </Select>
            </Field>
            <Field label="% del total de ese periodo"><Input value={campos.pct} placeholder="48" onChange={(e) => set('pct', e.target.value)} /></Field>
            <Field label="Comercializadora actual"><Input value={campos.comer} onChange={(e) => set('comer', e.target.value)} /></Field>
            <Field label="Firma">
              <Select value={campos.firma} onChange={(e) => set('firma', e.target.value)}>
                {firmas.map((f) => <option key={f}>{f}</option>)}
              </Select>
            </Field>
          </div>

          <Field label="Texto del correo" hint={editado !== null ? 'Editado a mano. Al cambiar un dato o el formato se vuelve a generar.' : undefined}>
            <Textarea className="min-h-[300px] font-mono text-[13px]" value={cuerpo} onChange={(e) => setEditado(e.target.value)} />
          </Field>
          {faltan && <Aviso tipo="warning">Faltan datos entre corchetes. Complétalos arriba antes de enviar.</Aviso>}

          <div className="flex flex-wrap gap-2">
            <Button size="lg" icon={<Send className="h-4 w-4" />} onClick={enviarTodo} loading={preparando}>
              Copiar y enviar con todo adjunto
            </Button>
            <Button variant="secondary" size="lg" icon={<ClipboardCopy className="h-4 w-4" />} onClick={copiar}>
              Copiar texto
            </Button>
            <Button
              variant="secondary"
              size="lg"
              icon={<Mail className="h-4 w-4" />}
              onClick={() => {
                window.location.href = `mailto:${encodeURIComponent(campos.email.trim())}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cuerpo)}`;
              }}
            >
              Abrir en mi correo
            </Button>
          </div>
          {mensaje && <Aviso tipo="success">{mensaje}</Aviso>}
        </div>
      </Modal>
      <MaximetroModal lead={lead} open={verMx} onClose={() => setVerMx(false)} />
    </>
  );
}
