import { Download, FileText, Mail, Paperclip, Phone, Send, Trash2, Undo2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/Feedback';
import { Input, Select, Textarea } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import {
  descargarArchivoLead,
  useActualizarLead,
  useArchivosLead,
  useBorrarArchivoLead,
  useCambiarEstadoLead,
  useEventosLead,
  useNotaHistorial,
  useSubirArchivosLead,
} from '@/hooks/leads';
import { diasDesde, fechaHora, tamanoArchivo } from '@/lib/format';
import { ESTADOS_LEAD, ESTADOS_SEGUIMIENTO, type EstadoLead, type Lead } from '@/lib/leads';
import { descargarBlob, mensajeError } from '@/lib/utils';
import { EstadoLeadBadge, enlaceTel } from './comunes';

interface Props {
  leads: Lead[];
  mostrarCartera: boolean;
  nombreCartera: (id: string) => string | null;
  puedeEditar: (l: Lead) => boolean;
}

export function SeguimientoLeads({ leads, mostrarCartera, nombreCartera, puedeEditar }: Props) {
  const [filtro, setFiltro] = useState<'todos' | EstadoLead>('todos');
  const [abierto, setAbierto] = useState<string | null>(null);

  const filas = leads
    .filter((l) => ESTADOS_SEGUIMIENTO.includes(l.estado) && (filtro === 'todos' || l.estado === filtro))
    .sort((a, b) => new Date(a.ultimo_movimiento_at).getTime() - new Date(b.ultimo_movimiento_at).getTime());
  const cuenta = (e: EstadoLead) => leads.filter((l) => l.estado === e).length;
  const lead = leads.find((l) => l.id === abierto) ?? null;

  return (
    <div className="space-y-4">
      <Card className="flex flex-wrap items-center gap-3 p-3">
        <Select className="w-auto" value={filtro} onChange={(e) => setFiltro(e.target.value as 'todos' | EstadoLead)}>
          <option value="todos">Todo el seguimiento</option>
          {ESTADOS_SEGUIMIENTO.map((e) => <option key={e} value={e}>{ESTADOS_LEAD[e].etiqueta}</option>)}
        </Select>
        <span className="text-sm text-slate-500">
          {cuenta('correo')} esperando facturas · {cuenta('facturas')} con facturas · {cuenta('comparativa')} con comparativa
        </span>
      </Card>

      <Card className="overflow-x-auto">
        {filas.length === 0 ? (
          <EmptyState
            icon={<Mail className="h-6 w-6" />}
            titulo="Sin clientes en seguimiento"
            texto="Aquí aparecen los clientes a los que ya has enviado el correo."
          />
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-100 text-[11px] uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Teléfono</th>
                {mostrarCartera && <th className="px-4 py-3">Cartera</th>}
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">Correo enviado</th>
                <th className="px-4 py-3">Último mov.</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filas.map((l) => {
                const dias = diasDesde(l.ultimo_movimiento_at);
                const tarde = l.estado === 'correo' && dias >= 3;
                return (
                  <tr key={l.id} className="cursor-pointer transition hover:bg-slate-50" onClick={() => setAbierto(l.id)}>
                    <td className="px-4 py-2.5 font-semibold text-navy-900">{l.nombre || '—'}</td>
                    <td className="px-4 py-2.5">{l.telefono || '—'}</td>
                    {mostrarCartera && <td className="px-4 py-2.5 text-slate-500">{nombreCartera(l.propietario_id) ?? '—'}</td>}
                    <td className="px-4 py-2.5"><EstadoLeadBadge estado={l.estado} /></td>
                    <td className="px-4 py-2.5 text-slate-500">{l.correo_enviado_at ? fechaHora(l.correo_enviado_at) : '—'}</td>
                    <td className="px-4 py-2.5 text-slate-500">hace {dias} d</td>
                    <td className="px-4 py-2.5">
                      {tarde && <Badge className="bg-sun-50 text-sun-700 ring-sun-200">⏰ reclamar facturas</Badge>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>

      {lead && <FichaSeguimiento lead={lead} editable={puedeEditar(lead)} onClose={() => setAbierto(null)} />}
    </div>
  );
}

function FichaSeguimiento({ lead, editable, onClose }: { lead: Lead; editable: boolean; onClose: () => void }) {
  const archivos = useArchivosLead(lead.id);
  const eventos = useEventosLead(lead.id);
  const subir = useSubirArchivosLead();
  const borrar = useBorrarArchivoLead();
  const cambiar = useCambiarEstadoLead();
  const nota = useNotaHistorial();
  const actualizar = useActualizarLead();
  const [texto, setTexto] = useState('');
  const refFactura = useRef<HTMLInputElement>(null);
  const refComparativa = useRef<HTMLInputElement>(null);

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
      title={lead.nombre || '(sin nombre)'}
      description={[lead.cups && `CUPS ${lead.cups}`, lead.kw && `${lead.kw} kW`, lead.comercializadora].filter(Boolean).join(' · ')}
      icon={<Mail className="h-5 w-5" />}
    >
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-3">
          <EstadoLeadBadge estado={lead.estado} />
          {[lead.telefono, lead.telefono2].filter(Boolean).map((t) => (
            <a key={t} href={enlaceTel(t)} className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:underline">
              <Phone className="h-4 w-4" /> {t}
            </a>
          ))}
          {lead.email && <span className="text-sm text-slate-600">✉️ {lead.email}</span>}
        </div>

        {editable && (
          <div className="flex flex-wrap gap-2">
            <Button variant={lead.estado === 'correo' ? 'primary' : 'secondary'} icon={<Paperclip className="h-4 w-4" />} onClick={() => refFactura.current?.click()} loading={subir.isPending}>
              {lead.estado === 'correo' ? 'Facturas recibidas (adjuntar)' : 'Adjuntar más facturas'}
            </Button>
            <Button variant="secondary" icon={<Paperclip className="h-4 w-4" />} onClick={() => refComparativa.current?.click()}>
              Adjuntar comparativa
            </Button>
            {lead.estado !== 'comparativa' && (
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
      </div>
    </Modal>
  );
}
