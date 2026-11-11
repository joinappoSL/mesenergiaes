import { MessageCircle, Phone, Save } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { usePerfil } from '@/auth/AuthProvider';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select, Textarea } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { useGuardarAppoLead, type CambiosAppoLead } from '@/hooks/appo';
import { ESTADOS_APPO, LISTA_ESTADOS_APPO, PACKS, SECTORES_APPO, TAMANOS, whatsappAuditoria, type AppoLead, type EstadoAppo, type PackAppo, type TamanoAppo } from '@/lib/appo';
import { hoyISO, nombreCompleto } from '@/lib/format';
import { enlaceWhatsapp, limpiarTelefono } from '@/lib/leads';
import { mensajeError } from '@/lib/utils';

/** ISO → valor de <input type="datetime-local"> en hora local. */
function aLocal(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
const deLocal = (v: string) => (v ? new Date(v).toISOString() : null);
const num = (v: string) => (v.trim() === '' ? null : Number(v.replace(',', '.')) || 0);

interface Form {
  empresa: string;
  sector: string;
  contacto: string;
  telefono: string;
  email: string;
  web: string;
  ciudad: string;
  tamano: TamanoAppo;
  estado: EstadoAppo;
  modulo: string;
  auditoria_at: string;
  auditoria_modo: 'online' | 'presencial';
  proxima_llamada: string;
  perdidas_mes: string;
  pack: PackAppo;
  cuota_mes: string;
  alta: string;
  nota: string;
}

const VACIO: Form = {
  empresa: '', sector: '', contacto: '', telefono: '', email: '', web: '', ciudad: '', tamano: '', estado: 'pendiente', modulo: '',
  auditoria_at: '', auditoria_modo: 'online', proxima_llamada: '', perdidas_mes: '', pack: '', cuota_mes: '', alta: '', nota: '',
};

function desdeLead(l: AppoLead): Form {
  return {
    empresa: l.empresa, sector: l.sector, contacto: l.contacto, telefono: l.telefono, email: l.email, web: l.web, ciudad: l.ciudad,
    tamano: l.tamano, estado: l.estado, modulo: l.modulo, auditoria_at: aLocal(l.auditoria_at), auditoria_modo: l.auditoria_modo,
    proxima_llamada: aLocal(l.proxima_llamada), perdidas_mes: l.perdidas_mes == null ? '' : String(l.perdidas_mes), pack: l.pack,
    cuota_mes: l.cuota_mes == null ? '' : String(l.cuota_mes), alta: l.alta == null ? '' : String(l.alta), nota: l.nota,
  };
}

interface Props {
  open: boolean;
  onClose: () => void;
  editar?: AppoLead | null;
  /** módulo por defecto al crear */
  modulo?: string;
  propietarioId?: string;
}

/** Ficha de un lead de Appo: datos, auditoría gratis y cierre del pack. */
export function FormAppoLead({ open, onClose, editar, modulo, propietarioId }: Props) {
  const perfil = usePerfil();
  const guardar = useGuardarAppoLead();
  const [f, setF] = useState<Form>(VACIO);

  useEffect(() => {
    if (open) setF(editar ? desdeLead(editar) : { ...VACIO, modulo: modulo ?? '' });
  }, [open, editar, modulo]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((x) => ({ ...x, [k]: v }));

  function elegirPack(pack: PackAppo) {
    setF((x) => {
      const p = pack ? PACKS[pack] : null;
      return { ...x, pack, cuota_mes: x.cuota_mes || (p?.mes ? String(p.mes) : ''), alta: x.alta || (p?.alta ? String(p.alta) : '') };
    });
  }

  async function enviar() {
    if (!f.empresa.trim()) return toast.error('Pon el nombre de la empresa.');
    if (f.estado === 'auditoria' && !f.auditoria_at) return toast.error('Pon el día y la hora de la auditoría.');
    const datos: CambiosAppoLead = {
      empresa: f.empresa.trim(), sector: f.sector, contacto: f.contacto.trim(), telefono: limpiarTelefono(f.telefono), email: f.email.trim().toLowerCase(),
      web: f.web.trim(), ciudad: f.ciudad.trim(), tamano: f.tamano, estado: f.estado, modulo: f.modulo.trim(), auditoria_at: deLocal(f.auditoria_at),
      auditoria_modo: f.auditoria_modo, proxima_llamada: deLocal(f.proxima_llamada), perdidas_mes: num(f.perdidas_mes), pack: f.pack,
      cuota_mes: num(f.cuota_mes), alta: num(f.alta), nota: f.nota,
      cerrado_at: f.estado === 'cerrado' ? editar?.cerrado_at ?? hoyISO() : null,
    };
    if (!editar && propietarioId) datos.propietario_id = propietarioId;
    try {
      await guardar.mutateAsync({ id: editar?.id, datos });
      toast.success(editar ? 'Lead actualizado' : 'Lead de Appo añadido');
      onClose();
    } catch (e) {
      toast.error(mensajeError(e));
    }
  }

  const tel = limpiarTelefono(f.telefono);
  const wa = tel ? enlaceWhatsapp(tel, whatsappAuditoria({ empresa: f.empresa || 'tu negocio', contacto: f.contacto }, nombreCompleto(perfil))) : '';

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      persistent
      title={editar ? editar.empresa : 'Nuevo lead de Appo'}
      description="Objetivo de la llamada: cerrar la auditoría gratis de 30 minutos."
      footer={
        <>
          {tel && (
            <>
              <a href={`tel:${tel}`} className="mr-auto inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold text-[#0E4D9D] hover:bg-[#0E4D9D]/10">
                <Phone className="h-4 w-4" /> Llamar
              </a>
              <a href={wa} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50">
                <MessageCircle className="h-4 w-4" /> WhatsApp auditoría
              </a>
            </>
          )}
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button icon={<Save className="h-4 w-4" />} onClick={enviar} loading={guardar.isPending}>Guardar</Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Empresa" required><Input value={f.empresa} onChange={(e) => set('empresa', e.target.value)} autoFocus /></Field>
        <Field label="Estado">
          <Select value={f.estado} onChange={(e) => set('estado', e.target.value as EstadoAppo)}>
            {LISTA_ESTADOS_APPO.map((s) => <option key={s} value={s}>{ESTADOS_APPO[s].etiqueta}</option>)}
          </Select>
        </Field>
        <Field label="Persona de contacto"><Input value={f.contacto} onChange={(e) => set('contacto', e.target.value)} /></Field>
        <Field label="Sector">
          <Select value={f.sector} onChange={(e) => set('sector', e.target.value)}>
            <option value="">—</option>
            {[...new Set([...SECTORES_APPO, f.sector].filter(Boolean))].map((s) => <option key={s} value={s}>{s}</option>)}
          </Select>
        </Field>
        <Field label="Teléfono"><Input value={f.telefono} onChange={(e) => set('telefono', e.target.value)} placeholder="612 345 678" /></Field>
        <Field label="Email"><Input type="email" value={f.email} onChange={(e) => set('email', e.target.value)} /></Field>
        <Field label="Web"><Input value={f.web} onChange={(e) => set('web', e.target.value)} /></Field>
        <Field label="Ciudad"><Input value={f.ciudad} onChange={(e) => set('ciudad', e.target.value)} /></Field>
        <Field label="Tamaño">
          <Select value={f.tamano} onChange={(e) => set('tamano', e.target.value as TamanoAppo)}>
            <option value="">—</option>
            {(Object.keys(TAMANOS) as Exclude<TamanoAppo, ''>[]).map((t) => <option key={t} value={t}>{TAMANOS[t].etiqueta} ({TAMANOS[t].personas})</option>)}
          </Select>
        </Field>
        <Field label="Módulo / lista"><Input value={f.modulo} onChange={(e) => set('modulo', e.target.value)} /></Field>
      </div>

      <h3 className="mb-2 mt-5 text-sm font-semibold text-[#0E4D9D]">Auditoría gratis</h3>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Día y hora"><Input type="datetime-local" value={f.auditoria_at} onChange={(e) => set('auditoria_at', e.target.value)} /></Field>
        <Field label="Modalidad">
          <Select value={f.auditoria_modo} onChange={(e) => set('auditoria_modo', e.target.value as 'online' | 'presencial')}>
            <option value="online">Online</option>
            <option value="presencial">Presencial</option>
          </Select>
        </Field>
        <Field label="Volver a llamar"><Input type="datetime-local" value={f.proxima_llamada} onChange={(e) => set('proxima_llamada', e.target.value)} /></Field>
      </div>

      <h3 className="mb-2 mt-5 text-sm font-semibold text-[#0E4D9D]">Propuesta y cierre</h3>
      <div className="grid gap-3 sm:grid-cols-4">
        <Field label="Pierde al mes (€)"><Input inputMode="decimal" value={f.perdidas_mes} onChange={(e) => set('perdidas_mes', e.target.value)} /></Field>
        <Field label="Pack">
          <Select value={f.pack} onChange={(e) => elegirPack(e.target.value as PackAppo)}>
            <option value="">—</option>
            {(Object.keys(PACKS) as Exclude<PackAppo, ''>[]).map((p) => <option key={p} value={p}>{PACKS[p].nombre}</option>)}
          </Select>
        </Field>
        <Field label="Cuota €/mes"><Input inputMode="decimal" value={f.cuota_mes} onChange={(e) => set('cuota_mes', e.target.value)} /></Field>
        <Field label="Alta (€)"><Input inputMode="decimal" value={f.alta} onChange={(e) => set('alta', e.target.value)} /></Field>
      </div>

      <div className="mt-3">
        <Field label="Notas de la llamada"><Textarea className="min-h-[80px]" value={f.nota} onChange={(e) => set('nota', e.target.value)} placeholder="Qué le duele: WhatsApp fuera de horario, llamadas perdidas, citas que no vienen, papeleo…" /></Field>
      </div>
    </Modal>
  );
}
