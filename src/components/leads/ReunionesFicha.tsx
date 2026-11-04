import { CalendarClock, Check, Download, FileText, MapPin, Paperclip, Plus, Trash2, Video, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Field, Input, Textarea } from '@/components/ui/Field';
import {
  descargarArchivoLead,
  useActualizarReunion,
  useArchivosLead,
  useBorrarArchivoLead,
  useBorrarReunion,
  useCrearReunion,
  useReuniones,
  useSubirArchivosLead,
} from '@/hooks/leads';
import { fechaHora, tamanoArchivo } from '@/lib/format';
import { deInputFecha, type Lead, type ModalidadReunion, type Reunion } from '@/lib/leads';
import { descargarBlob, mensajeError } from '@/lib/utils';

const ESTADO_CLASE: Record<Reunion['estado'], string> = {
  programada: 'bg-sky-50 text-sky-700 ring-sky-200',
  hecha: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  cancelada: 'bg-slate-100 text-slate-500 ring-slate-200',
};
const ESTADO_TEXTO: Record<Reunion['estado'], string> = { programada: 'Programada', hecha: 'Hecha', cancelada: 'Cancelada' };

export function IconoModalidad({ m, className }: { m: ModalidadReunion; className?: string }) {
  return m === 'videollamada' ? <Video className={className} /> : <MapPin className={className} />;
}

interface FormProps {
  lead: Lead;
  /** hora inicial al abrir desde un día del calendario (AAAA-MM-DD) */
  dia?: string;
  onHecho: () => void;
  onCancelar?: () => void;
}

/** Formulario de nueva reunión: fecha y hora, videollamada o presencial, lugar o enlace y notas. */
export function FormReunion({ lead, dia, onHecho, onCancelar }: FormProps) {
  const crear = useCrearReunion();
  const [fecha, setFecha] = useState(dia ? `${dia}T10:00` : '');
  const [modalidad, setModalidad] = useState<ModalidadReunion>('presencial');
  const [lugar, setLugar] = useState('');
  const [notas, setNotas] = useState('');

  async function guardar() {
    const iso = deInputFecha(fecha);
    if (!iso) {
      toast.error('Pon el día y la hora de la reunión.');
      return;
    }
    try {
      await crear.mutateAsync({ lead, fecha: iso, modalidad, lugar: lugar.trim(), notas });
      toast.success('Reunión programada');
      onHecho();
    } catch (e) {
      toast.error(mensajeError(e));
    }
  }

  return (
    <div className="space-y-3 rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Día y hora">
          <Input type="datetime-local" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </Field>
        <Field label="Tipo de reunión">
          <div className="flex gap-2">
            {(['presencial', 'videollamada'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setModalidad(m)}
                className={`inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl text-sm font-semibold ring-1 transition ${
                  modalidad === m ? 'bg-brand-600 text-white ring-brand-600' : 'bg-white text-slate-700 ring-slate-200 hover:bg-slate-50'
                }`}
              >
                <IconoModalidad m={m} className="h-4 w-4" /> {m === 'presencial' ? 'Presencial' : 'Videollamada'}
              </button>
            ))}
          </div>
        </Field>
      </div>
      <Field label={modalidad === 'videollamada' ? 'Enlace de la videollamada' : 'Dirección'}>
        <Input
          value={lugar}
          onChange={(e) => setLugar(e.target.value)}
          placeholder={modalidad === 'videollamada' ? 'https://meet.google.com/…' : 'Carrer del Doctor Roux 110, Barcelona'}
        />
      </Field>
      <Field label="Qué hay que preparar / notas">
        <Textarea className="min-h-[64px]" value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Comparativa, otros puntos de suministro, documentación…" />
      </Field>
      <div className="flex justify-end gap-2">
        {onCancelar && <Button variant="secondary" onClick={onCancelar}>Cancelar</Button>}
        <Button icon={<CalendarClock className="h-4 w-4" />} onClick={guardar} loading={crear.isPending}>
          Programar reunión
        </Button>
      </div>
    </div>
  );
}

function TarjetaReunion({ r, lead, editable }: { r: Reunion; lead: Lead; editable: boolean }) {
  const archivos = useArchivosLead(lead.id);
  const subir = useSubirArchivosLead();
  const borrarArchivo = useBorrarArchivoLead();
  const actualizar = useActualizarReunion();
  const borrar = useBorrarReunion();
  const ref = useRef<HTMLInputElement>(null);
  const suyos = archivos.data?.filter((a) => a.reunion_id === r.id) ?? [];
  const esEnlace = /^https?:\/\//i.test(r.lugar);

  async function adjuntar(files: FileList | null) {
    const lista = [...(files ?? [])];
    if (!lista.length) return;
    try {
      await subir.mutateAsync({ lead, archivos: lista, tipo: 'reunion', reunionId: r.id });
      toast.success('Material adjuntado a la reunión');
    } catch (e) {
      toast.error(mensajeError(e));
    }
  }

  const cambiarEstado = (estado: Reunion['estado']) =>
    actualizar.mutate({ reunion: r, patch: { estado } }, { onError: (e) => toast.error(mensajeError(e)) });

  return (
    <li className={`rounded-xl p-3 ring-1 ring-slate-200 ${r.estado === 'cancelada' ? 'opacity-60' : ''}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-navy-900">
          <IconoModalidad m={r.modalidad} className="h-4 w-4 text-brand-600" />
          {r.modalidad === 'videollamada' ? 'Videollamada' : 'Presencial'} · {fechaHora(r.fecha)}
        </span>
        <Badge className={ESTADO_CLASE[r.estado]}>{ESTADO_TEXTO[r.estado]}</Badge>
      </div>
      {r.lugar && (
        <p className="mt-1 text-sm text-slate-600">
          {esEnlace ? <a href={r.lugar} target="_blank" rel="noreferrer" className="font-semibold text-brand-700 hover:underline">{r.lugar}</a> : r.lugar}
        </p>
      )}
      {r.notas && <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{r.notas}</p>}

      {suyos.length > 0 && (
        <ul className="mt-2 divide-y divide-slate-100 rounded-lg ring-1 ring-slate-100">
          {suyos.map((a) => (
            <li key={a.id} className="flex items-center gap-2 px-2.5 py-1.5 text-sm">
              <FileText className="h-4 w-4 text-brand-600" />
              <span className="min-w-0 flex-1 truncate">{a.nombre}</span>
              <span className="hidden text-xs text-slate-400 sm:inline">{tamanoArchivo(a.tamano_bytes)}</span>
              <Button
                size="sm"
                variant="secondary"
                icon={<Download className="h-3.5 w-3.5" />}
                onClick={async () => {
                  try {
                    descargarBlob(await descargarArchivoLead(a), a.nombre);
                  } catch (e) {
                    toast.error(mensajeError(e));
                  }
                }}
              >
                Descargar
              </Button>
              {editable && (
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label="Borrar archivo"
                  icon={<Trash2 className="h-3.5 w-3.5" />}
                  onClick={() => {
                    if (confirm('¿Borrar este archivo?')) borrarArchivo.mutate(a, { onError: (e) => toast.error(mensajeError(e)) });
                  }}
                />
              )}
            </li>
          ))}
        </ul>
      )}

      {editable && (
        <div className="mt-2 flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" icon={<Paperclip className="h-3.5 w-3.5" />} onClick={() => ref.current?.click()} loading={subir.isPending}>
            Adjuntar lo preparado
          </Button>
          {r.estado !== 'hecha' && (
            <Button size="sm" variant="secondary" icon={<Check className="h-3.5 w-3.5" />} onClick={() => cambiarEstado('hecha')}>
              Marcar hecha
            </Button>
          )}
          {r.estado === 'programada' && (
            <Button size="sm" variant="ghost" icon={<X className="h-3.5 w-3.5" />} onClick={() => cambiarEstado('cancelada')}>
              Cancelar
            </Button>
          )}
          {r.estado !== 'programada' && (
            <Button size="sm" variant="ghost" onClick={() => cambiarEstado('programada')}>
              Reabrir
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="text-red-600 hover:bg-red-50 hover:text-red-700"
            icon={<Trash2 className="h-3.5 w-3.5" />}
            loading={borrar.isPending}
            onClick={() => {
              if (confirm('¿Borrar la reunión con sus archivos? No se puede deshacer.')) borrar.mutate(r, { onError: (e) => toast.error(mensajeError(e)) });
            }}
          >
            Borrar
          </Button>
          <input ref={ref} type="file" multiple className="hidden" onChange={(e) => { adjuntar(e.target.files); e.target.value = ''; }} />
        </div>
      )}
    </li>
  );
}

/** Sección «Reuniones» de la ficha del cliente. */
export function ReunionesFicha({ lead, editable }: { lead: Lead; editable: boolean }) {
  const reuniones = useReuniones();
  const [nueva, setNueva] = useState(false);
  const suyas = (reuniones.data ?? []).filter((r) => r.lead_id === lead.id).sort((a, b) => b.fecha.localeCompare(a.fecha));

  return (
    <section>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-navy-900">Reuniones</h3>
        {editable && !nueva && (
          <Button size="sm" variant="secondary" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => setNueva(true)}>
            Nueva reunión
          </Button>
        )}
      </div>
      {nueva && <div className="mb-3"><FormReunion lead={lead} onHecho={() => setNueva(false)} onCancelar={() => setNueva(false)} /></div>}
      {suyas.length ? (
        <ul className="space-y-2">{suyas.map((r) => <TarjetaReunion key={r.id} r={r} lead={lead} editable={editable} />)}</ul>
      ) : (
        !nueva && <p className="text-sm text-slate-500">Sin reuniones todavía.</p>
      )}
    </section>
  );
}

