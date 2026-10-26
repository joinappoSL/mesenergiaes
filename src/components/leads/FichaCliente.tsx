import { Download, FileText, Paperclip, Phone, Save, Send, Trash2, Undo2, UserRound } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import {
  descargarArchivoLead,
  useActualizarLead,
  useArchivosLead,
  useBorrarArchivoLead,
  useCambiarEstadoLead,
  useEliminarLead,
  useEventosLead,
  useNotaHistorial,
  useSubirArchivosLead,
} from '@/hooks/leads';
import { fechaHora, tamanoArchivo, telefono } from '@/lib/format';
import { aInputFecha, deInputFecha, ESTADOS_LEAD, limpiarTelefono, telefonosDe, type EstadoLead, type Lead } from '@/lib/leads';
import { descargarBlob, mensajeError } from '@/lib/utils';
import { CamposCliente, type FormCliente } from './CamposCliente';
import { EstadoLeadBadge, enlaceTel } from './comunes';

function formDesdeLead(l: Lead): FormCliente {
  return {
    nombre: l.nombre,
    telefono: l.telefono,
    telefono2: l.telefono2,
    email: l.email,
    kw: l.kw,
    cups: l.cups,
    comercializadora: l.comercializadora,
    consumo_anual: l.consumo_anual !== null ? String(Math.round(l.consumo_anual)) : '',
    modulo: l.modulo,
    estado: l.estado,
    correo_enviado_at: aInputFecha(l.correo_enviado_at),
    facturas_recibidas_at: aInputFecha(l.facturas_recibidas_at),
    comparativa_enviada_at: aInputFecha(l.comparativa_enviada_at),
    visita_at: aInputFecha(l.visita_at),
    firmado_at: aInputFecha(l.firmado_at),
    visita_lugar: l.visita_lugar,
    visita_notas: l.visita_notas,
    nota: l.nota,
  };
}

interface Props {
  lead: Lead;
  editable: boolean;
  modulos: string[];
  onClose: () => void;
}

/** Ficha de cliente: datos, fechas del proceso (facturas, visita…), archivos, notas e historial. */
export function FichaCliente({ lead, editable, modulos, onClose }: Props) {
  const archivos = useArchivosLead(lead.id);
  const eventos = useEventosLead(lead.id);
  const subir = useSubirArchivosLead();
  const borrar = useBorrarArchivoLead();
  const cambiar = useCambiarEstadoLead();
  const nota = useNotaHistorial();
  const actualizar = useActualizarLead();
  const eliminar = useEliminarLead();
  const [texto, setTexto] = useState('');
  const refFactura = useRef<HTMLInputElement>(null);
  const refComparativa = useRef<HTMLInputElement>(null);

  // El formulario se rellena desde el lead y solo se refresca si no hay cambios sin guardar.
  const base = useMemo(() => formDesdeLead(lead), [lead]);
  const [form, setForm] = useState<FormCliente>(base);
  const baseAnterior = useRef(base);
  useEffect(() => {
    setForm((actual) => (JSON.stringify(actual) === JSON.stringify(baseAnterior.current) ? base : actual));
    baseAnterior.current = base;
  }, [base]);
  const sinGuardar = JSON.stringify(form) !== JSON.stringify(base);

  async function guardar() {
    const consumo = parseFloat(form.consumo_anual.replace(/\./g, '').replace(',', '.'));
    const ahora = new Date().toISOString();
    const patch = {
      nombre: form.nombre.trim(),
      telefono: limpiarTelefono(form.telefono),
      telefono2: limpiarTelefono(form.telefono2),
      email: form.email.trim(),
      kw: form.kw.trim(),
      cups: form.cups.replace(/\s/g, '').toUpperCase(),
      comercializadora: form.comercializadora.trim(),
      consumo_anual: Number.isFinite(consumo) ? consumo : null,
      modulo: form.modulo.trim(),
      correo_enviado_at: deInputFecha(form.correo_enviado_at),
      facturas_recibidas_at: deInputFecha(form.facturas_recibidas_at),
      comparativa_enviada_at: deInputFecha(form.comparativa_enviada_at),
      visita_at: deInputFecha(form.visita_at),
      firmado_at: deInputFecha(form.firmado_at),
      visita_lugar: form.visita_lugar.trim(),
      visita_notas: form.visita_notas,
    };
    try {
      if (form.estado !== lead.estado) {
        // Si el nuevo estado implica una fecha y está vacía, se pone la de ahora.
        if (form.estado === 'correo' && !patch.correo_enviado_at) patch.correo_enviado_at = ahora;
        if (form.estado === 'facturas' && !patch.facturas_recibidas_at) patch.facturas_recibidas_at = ahora;
        if (form.estado === 'comparativa' && !patch.comparativa_enviada_at) patch.comparativa_enviada_at = ahora;
        if (form.estado === 'firmado' && !patch.firmado_at) patch.firmado_at = ahora;
        await cambiar.mutateAsync({
          lead,
          estado: form.estado,
          extra: patch,
          texto: `Estado cambiado a «${ESTADOS_LEAD[form.estado].etiqueta}» desde la ficha`,
        });
      } else {
        await actualizar.mutateAsync({ id: lead.id, patch });
      }
      toast.success('Ficha guardada');
    } catch (e) {
      const msg = mensajeError(e);
      toast.error(msg);
    }
  }

  async function adjuntar(files: FileList | null, tipo: 'factura' | 'comparativa') {
    const lista = [...(files ?? [])];
    if (!lista.length) return;
    try {
      await subir.mutateAsync({ lead, archivos: lista, tipo });
      toast.success(tipo === 'factura' && lead.estado === 'correo' ? 'Facturas adjuntadas: pasa a «Facturas recibidas»' : 'Archivos adjuntados');
    } catch (e) {
      toast.error(mensajeError(e));
    }
  }

  async function cambiarEstado(estado: EstadoLead, texto?: string) {
    try {
      await cambiar.mutateAsync({ lead, estado, texto });
    } catch (e) {
      toast.error(mensajeError(e));
    }
  }

  async function bajar(id: string) {
    const a = archivos.data?.find((x) => x.id === id);
    if (!a) return;
    try {
      descargarBlob(await descargarArchivoLead(a), a.nombre);
    } catch (e) {
      toast.error(mensajeError(e));
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      persistent={sinGuardar}
      title={lead.nombre || '(sin nombre)'}
      description={[lead.modulo && `Módulo ${lead.modulo}`, lead.cups && `CUPS ${lead.cups}`, lead.kw && `${lead.kw} kW`].filter(Boolean).join(' · ')}
      icon={<UserRound className="h-5 w-5" />}
      footer={
        editable ? (
          <>
            <Button variant="secondary" onClick={onClose}>{sinGuardar ? 'Descartar y cerrar' : 'Cerrar'}</Button>
            <Button icon={<Save className="h-4 w-4" />} onClick={guardar} disabled={!sinGuardar} loading={actualizar.isPending || cambiar.isPending}>
              Guardar ficha
            </Button>
          </>
        ) : undefined
      }
    >
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-3">
          <EstadoLeadBadge estado={lead.estado} />
          {telefonosDe(lead).map((t) => (
            <a key={`${lead.id}-${t}`} href={enlaceTel(t)} className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:underline">
              <Phone className="h-4 w-4" /> {telefono(t)}
            </a>
          ))}
        </div>

        <CamposCliente valor={form} onChange={setForm} modulos={modulos} deshabilitado={!editable} />

        {editable && (
          <div className="flex flex-wrap gap-2">
            <Button variant={lead.estado === 'correo' ? 'primary' : 'secondary'} icon={<Paperclip className="h-4 w-4" />} onClick={() => refFactura.current?.click()} loading={subir.isPending}>
              {lead.estado === 'correo' ? 'Facturas recibidas (adjuntar)' : 'Adjuntar facturas'}
            </Button>
            <Button variant="secondary" icon={<Paperclip className="h-4 w-4" />} onClick={() => refComparativa.current?.click()}>
              Adjuntar comparativa
            </Button>
            {lead.estado !== 'comparativa' && lead.estado !== 'firmado' && (
              <Button variant="navy" icon={<Send className="h-4 w-4" />} onClick={() => cambiarEstado('comparativa')}>
                Comparativa enviada
              </Button>
            )}
            {lead.estado !== 'correo' && (
              <Button variant="ghost" icon={<Undo2 className="h-4 w-4" />} onClick={() => cambiarEstado('correo', 'Vuelto a «Correo enviado»')}>
                Volver a «Correo enviado»
              </Button>
            )}
            <input ref={refFactura} type="file" multiple className="hidden" onChange={(e) => { adjuntar(e.target.files, 'factura'); e.target.value = ''; }} />
            <input ref={refComparativa} type="file" multiple className="hidden" onChange={(e) => { adjuntar(e.target.files, 'comparativa'); e.target.value = ''; }} />
          </div>
        )}

        <section>
          <h3 className="mb-2 text-sm font-semibold text-navy-900">Archivos</h3>
          {archivos.data?.length ? (
            <ul className="divide-y divide-slate-100 rounded-xl ring-1 ring-slate-200">
              {archivos.data.map((a) => (
                <li key={a.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                  <FileText className={a.tipo === 'comparativa' ? 'h-4 w-4 text-violet-600' : 'h-4 w-4 text-sky-600'} />
                  <span className="min-w-0 flex-1 truncate">{a.nombre}</span>
                  <span className="hidden text-xs text-slate-400 sm:inline">{tamanoArchivo(a.tamano_bytes)} · {fechaHora(a.created_at)}</span>
                  <Button size="sm" variant="secondary" icon={<Download className="h-3.5 w-3.5" />} onClick={() => bajar(a.id)}>Descargar</Button>
                  {editable && (
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={<Trash2 className="h-3.5 w-3.5" />}
                      aria-label="Borrar archivo"
                      onClick={() => {
                        if (confirm('¿Borrar este archivo?')) borrar.mutate(a, { onError: (e) => toast.error(mensajeError(e)) });
                      }}
                    />
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-500">Sin archivos todavía.</p>
          )}
        </section>

        <section>
          <h3 className="mb-2 text-sm font-semibold text-navy-900">Notas</h3>
          <Textarea
            key={lead.id}
            defaultValue={lead.nota}
            disabled={!editable}
            onBlur={(e) => { if (e.target.value !== lead.nota) actualizar.mutate({ id: lead.id, patch: { nota: e.target.value } }); }}
          />
        </section>

        <section>
          <h3 className="mb-2 text-sm font-semibold text-navy-900">Historial del proceso</h3>
          {editable && (
            <form
              className="mb-3 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const t = texto.trim();
                if (!t) return;
                nota.mutate({ leadId: lead.id, texto: t }, { onSuccess: () => setTexto(''), onError: (er) => toast.error(mensajeError(er)) });
              }}
            >
              <Input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Añadir al historial (ej. «llamado, las manda mañana»)" />
              <Button type="submit" variant="secondary" loading={nota.isPending}>Añadir</Button>
            </form>
          )}
          <ol className="space-y-2 border-l-2 border-slate-200 pl-4">
            {eventos.data?.map((e) => (
              <li key={e.id} className="text-sm">
                <p className="text-slate-800">
                  {e.estado && <span className="mr-1.5 align-middle"><EstadoLeadBadge estado={e.estado} /></span>}
                  {e.texto}
                </p>
                <p className="text-xs text-slate-400">{fechaHora(e.created_at)}</p>
              </li>
            ))}
            {!eventos.data?.length && <li className="text-sm text-slate-500">Sin movimientos.</li>}
          </ol>
        </section>

        {editable && (
          <section className="border-t border-slate-100 pt-4">
            <Button
              variant="ghost"
              size="sm"
              className="text-red-600 hover:bg-red-50 hover:text-red-700"
              icon={<Trash2 className="h-4 w-4" />}
              loading={eliminar.isPending}
              onClick={() => {
                if (!confirm(`¿Eliminar a «${lead.nombre || 'este cliente'}» con su historial y sus archivos? No se puede deshacer.`)) return;
                eliminar.mutate(lead, { onSuccess: onClose, onError: (e) => toast.error(mensajeError(e)) });
              }}
            >
              Eliminar cliente
            </Button>
          </section>
        )}
      </div>
    </Modal>
  );
}
