import { Field, Input, Select, Textarea } from '@/components/ui/Field';
import { ESTADOS_LEAD, type EstadoLead } from '@/lib/leads';

/** Datos editables de un cliente (los comparten la ficha y «Nuevo cliente»). */
export interface FormCliente {
  nombre: string;
  telefono: string;
  telefono2: string;
  email: string;
  kw: string;
  cups: string;
  comercializadora: string;
  consumo_anual: string;
  modulo: string;
  estado: EstadoLead;
  /** fechas en formato <input type="datetime-local"> */
  correo_enviado_at: string;
  facturas_recibidas_at: string;
  comparativa_enviada_at: string;
  visita_at: string;
  firmado_at: string;
  visita_lugar: string;
  visita_notas: string;
  nota: string;
}

export const FORM_VACIO: FormCliente = {
  nombre: '',
  telefono: '',
  telefono2: '',
  email: '',
  kw: '',
  cups: '',
  comercializadora: '',
  consumo_anual: '',
  modulo: '',
  estado: 'pendiente',
  correo_enviado_at: '',
  facturas_recibidas_at: '',
  comparativa_enviada_at: '',
  visita_at: '',
  firmado_at: '',
  visita_lugar: '',
  visita_notas: '',
  nota: '',
};

interface Props {
  valor: FormCliente;
  onChange: (v: FormCliente) => void;
  /** módulos ya usados, para sugerirlos al escribir */
  modulos: string[];
  /** «nota» solo se pide al crear; en la ficha tiene su propia sección */
  conNota?: boolean;
  deshabilitado?: boolean;
}

export function CamposCliente({ valor, onChange, modulos, conNota, deshabilitado }: Props) {
  const set = <K extends keyof FormCliente>(k: K, v: FormCliente[K]) => onChange({ ...valor, [k]: v });
  const campo = (k: keyof FormCliente, etiqueta: string, extra?: { type?: string; placeholder?: string; lista?: string }) => (
    <Field label={etiqueta}>
      <Input
        type={extra?.type ?? 'text'}
        value={valor[k] as string}
        placeholder={extra?.placeholder}
        list={extra?.lista}
        disabled={deshabilitado}
        onChange={(e) => set(k, e.target.value as never)}
      />
    </Field>
  );

  return (
    <div className="space-y-5">
      <section>
        <h3 className="mb-2 text-sm font-semibold text-navy-900">Datos del cliente</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {campo('nombre', 'Nombre / empresa')}
          {campo('email', 'Email', { type: 'email' })}
          {campo('telefono', 'Teléfono', { placeholder: '612 345 678' })}
          {campo('telefono2', 'Teléfono 2')}
          {campo('kw', 'Potencia (kW)')}
          {campo('consumo_anual', 'Consumo anual (kWh)')}
          {campo('cups', 'CUPS')}
          {campo('comercializadora', 'Comercializadora actual')}
          {campo('modulo', 'Módulo (listado)', { placeholder: '08017', lista: 'modulos-leads' })}
        </div>
        <datalist id="modulos-leads">
          {modulos.map((m) => <option key={m} value={m} />)}
        </datalist>
      </section>

      <section>
        <h3 className="mb-2 text-sm font-semibold text-navy-900">Proceso y fechas</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Estado actual">
            <Select value={valor.estado} disabled={deshabilitado} onChange={(e) => set('estado', e.target.value as EstadoLead)}>
              {(Object.keys(ESTADOS_LEAD) as EstadoLead[]).map((e) => (
                <option key={e} value={e}>{ESTADOS_LEAD[e].etiqueta}</option>
              ))}
            </Select>
          </Field>
          <span />
          {campo('correo_enviado_at', 'Correo enviado', { type: 'datetime-local' })}
          {campo('facturas_recibidas_at', 'Facturas recibidas', { type: 'datetime-local' })}
          {campo('comparativa_enviada_at', 'Comparativa enviada', { type: 'datetime-local' })}
          {campo('firmado_at', 'Firma / cliente cerrado', { type: 'datetime-local' })}
          {campo('visita_at', 'Visita (día y hora)', { type: 'datetime-local' })}
          {campo('visita_lugar', 'Lugar de la visita')}
        </div>
        <div className="mt-3">
          <Field label="Notas de la visita">
            <Textarea className="min-h-[64px]" value={valor.visita_notas} disabled={deshabilitado} onChange={(e) => set('visita_notas', e.target.value)} />
          </Field>
        </div>
        {conNota && (
          <div className="mt-3">
            <Field label="Notas">
              <Textarea className="min-h-[64px]" value={valor.nota} onChange={(e) => set('nota', e.target.value)} />
            </Field>
          </div>
        )}
      </section>
    </div>
  );
}
