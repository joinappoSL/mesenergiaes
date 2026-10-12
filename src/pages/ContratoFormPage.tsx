import { zodResolver } from '@hookform/resolvers/zod';
import {
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  FileText,
  Home,
  MessageSquare,
  Phone,
  Plus,
  Save,
  Trash2,
  User,
} from 'lucide-react';
import { useMemo, useRef, useState, type ReactNode } from 'react';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { z } from 'zod';
import { usePermisos } from '@/auth/permisos';
import { DuplicadosAviso } from '@/components/contratos/DuplicadosAviso';
import { PdfDropzone } from '@/components/contratos/PdfDropzone';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Aviso, ErrorState, PageLoader } from '@/components/ui/Feedback';
import { Field, Input, Select, Textarea } from '@/components/ui/Field';
import { PageHeader } from '@/components/ui/Misc';
import { useContrato, useDocumentos, useTelefonosPortabilidad } from '@/hooks/datos';
import { useGuardarContrato, type DatosContrato } from '@/hooks/mutaciones';
import { FRANJAS, OPERADORES, PROVINCIAS, TIPOS_VIA } from '@/lib/constants';
import { nombreCliente, numeroContrato } from '@/lib/format';
import type { Contrato, TelefonoPortabilidad } from '@/lib/types';
import { cn, mensajeError } from '@/lib/utils';
import {
  detectarTipoDocumento,
  esCodigoPostalValido,
  esEmailValido,
  esTelefonoValido,
  normalizarDocumento,
  normalizarTelefono,
  parsearPrecio,
  provinciaDesdeCP,
  validarDocumento,
} from '@/lib/validators';

const obligatorio = 'Campo obligatorio';

const esquema = z
  .object({
    cliente_nombre: z.string().trim().min(1, obligatorio),
    cliente_apellidos: z.string().trim().min(1, obligatorio),
    documento_tipo: z.enum(['DNI', 'NIE']),
    documento_numero: z.string().trim().min(1, obligatorio),
    cliente_email: z.string().refine((v) => v.trim() === '' || esEmailValido(v), 'Email no válido'),

    via_tipo: z.string().min(1, obligatorio),
    via_nombre: z.string().trim().min(1, obligatorio),
    via_numero: z.string().trim().min(1, obligatorio),
    escalera: z.string(),
    piso: z.string(),
    puerta: z.string(),
    codigo_postal: z.string().refine(esCodigoPostalValido, 'Código postal de 5 dígitos'),
    poblacion: z.string().trim().min(1, obligatorio),
    provincia: z.string().trim().min(1, obligatorio),

    telefono_contacto: z.string().refine(esTelefonoValido, 'Debe tener 9 dígitos'),
    telefono_fijo: z.string().refine((v) => v.trim() === '' || esTelefonoValido(v), 'Debe tener 9 dígitos'),
    portabilidad: z.array(
      z.object({
        numero: z.string().refine(esTelefonoValido, 'Debe tener 9 dígitos'),
        tipo: z.enum(['fijo', 'movil']),
        operador_donante: z.string(),
      }),
    ),

    operadora: z.string().trim().min(1, obligatorio),
    producto: z.string(),
    precio_mensual: z.string().refine((v) => !Number.isNaN(parsearPrecio(v)), 'Importe no válido (ej: 35,90)'),
    oferta_detalle: z.string(),

    instalacion_fecha: z.string(),
    instalacion_franja: z.string(),

    observacion_inicial: z.string().max(5000, 'Máximo 5000 caracteres'),
  })
  .superRefine((d, ctx) => {
    if (d.documento_numero.trim() && !validarDocumento(d.documento_tipo, d.documento_numero)) {
      ctx.addIssue({
        code: 'custom',
        path: ['documento_numero'],
        message: d.documento_tipo === 'DNI' ? 'DNI no válido: revisa números y letra' : 'NIE no válido: revisa números y letra',
      });
    }
  });

type Valores = z.infer<typeof esquema>;

const VACIO: Valores = {
  cliente_nombre: '',
  cliente_apellidos: '',
  documento_tipo: 'DNI',
  documento_numero: '',
  cliente_email: '',
  via_tipo: 'Calle',
  via_nombre: '',
  via_numero: '',
  escalera: '',
  piso: '',
  puerta: '',
  codigo_postal: '',
  poblacion: '',
  provincia: '',
  telefono_contacto: '',
  telefono_fijo: '',
  portabilidad: [],
  operadora: 'Avatel',
  producto: '',
  precio_mensual: '',
  oferta_detalle: '',
  instalacion_fecha: '',
  instalacion_franja: '',
  observacion_inicial: '',
};

function valoresDesde(c: Contrato, tels: TelefonoPortabilidad[]): Valores {
  return {
    ...VACIO,
    cliente_nombre: c.cliente_nombre,
    cliente_apellidos: c.cliente_apellidos,
    documento_tipo: c.documento_tipo,
    documento_numero: c.documento_numero,
    cliente_email: c.cliente_email ?? '',
    via_tipo: c.via_tipo,
    via_nombre: c.via_nombre,
    via_numero: c.via_numero,
    escalera: c.escalera ?? '',
    piso: c.piso ?? '',
    puerta: c.puerta ?? '',
    codigo_postal: c.codigo_postal,
    poblacion: c.poblacion,
    provincia: c.provincia,
    telefono_contacto: c.telefono_contacto,
    telefono_fijo: c.telefono_fijo ?? '',
    portabilidad: tels.map((t) => ({ numero: t.numero, tipo: t.tipo, operador_donante: t.operador_donante ?? '' })),
    operadora: c.operadora,
    producto: c.producto ?? '',
    precio_mensual: c.precio_mensual !== null ? String(c.precio_mensual).replace('.', ',') : '',
    oferta_detalle: c.oferta_detalle ?? '',
    instalacion_fecha: c.instalacion_fecha ?? '',
    instalacion_franja: c.instalacion_franja ?? '',
  };
}

const nulo = (v: string) => (v.trim() === '' ? null : v.trim());

function aDatos(v: Valores): DatosContrato {
  return {
    cliente_nombre: v.cliente_nombre.trim(),
    cliente_apellidos: v.cliente_apellidos.trim(),
    documento_tipo: v.documento_tipo,
    documento_numero: normalizarDocumento(v.documento_numero),
    cliente_email: nulo(v.cliente_email)?.toLowerCase() ?? null,
    via_tipo: v.via_tipo,
    via_nombre: v.via_nombre.trim(),
    via_numero: v.via_numero.trim(),
    escalera: nulo(v.escalera),
    piso: nulo(v.piso),
    puerta: nulo(v.puerta),
    codigo_postal: v.codigo_postal.trim(),
    poblacion: v.poblacion.trim(),
    provincia: v.provincia.trim(),
    telefono_fijo: nulo(normalizarTelefono(v.telefono_fijo)),
    telefono_contacto: normalizarTelefono(v.telefono_contacto),
    operadora: v.operadora.trim() || 'Avatel',
    producto: nulo(v.producto),
    precio_mensual: parsearPrecio(v.precio_mensual),
    oferta_detalle: nulo(v.oferta_detalle),
    instalacion_fecha: nulo(v.instalacion_fecha),
    instalacion_franja: nulo(v.instalacion_franja),
  };
}

function Seccion({
  numero,
  titulo,
  icon,
  children,
  descripcion,
}: {
  numero: number;
  titulo: string;
  icon: ReactNode;
  descripcion?: string;
  children: ReactNode;
}) {
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-3 border-b border-slate-100 bg-gradient-to-r from-navy-50/70 to-transparent px-5 py-4">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-navy-900 text-white">{icon}</span>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Paso {numero}</p>
          <h2 className="text-base font-semibold text-navy-900">{titulo}</h2>
        </div>
        {descripcion && <p className="ml-auto hidden text-xs text-slate-500 md:block">{descripcion}</p>}
      </div>
      <div className="grid grid-cols-6 gap-4 p-5">{children}</div>
    </Card>
  );
}

function Segmentado<T extends string>({
  valor,
  opciones,
  onChange,
}: {
  valor: T;
  opciones: { valor: T; etiqueta: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex h-[46px] w-full rounded-xl bg-slate-100 p-1">
      {opciones.map((o) => (
        <button
          key={o.valor}
          type="button"
          onClick={() => onChange(o.valor)}
          className={cn(
            'flex-1 rounded-lg text-sm font-semibold transition',
            valor === o.valor ? 'bg-white text-navy-900 shadow-sm' : 'text-slate-500 hover:text-slate-800',
          )}
        >
          {o.etiqueta}
        </button>
      ))}
    </div>
  );
}

function Formulario({ contrato, telefonos, numDocumentos }: { contrato?: Contrato; telefonos?: TelefonoPortabilidad[]; numDocumentos: number }) {
  const navigate = useNavigate();
  const guardar = useGuardarContrato();
  const [pdf, setPdf] = useState<File | null>(null);
  const provinciaAuto = useRef<string | null>(null);
  const editando = Boolean(contrato);

  const valoresIniciales = useMemo(
    () => (contrato ? valoresDesde(contrato, telefonos ?? []) : VACIO),
    [contrato, telefonos],
  );

  const {
    register,
    control,
    handleSubmit,
    setValue,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<Valores>({
    resolver: zodResolver(esquema),
    mode: 'onTouched',
    reValidateMode: 'onChange',
    defaultValues: valoresIniciales,
  });
  const portabilidad = useFieldArray({ control, name: 'portabilidad' });

  const [docTipo, docNumero, telContacto, franja] = useWatch({
    control,
    name: ['documento_tipo', 'documento_numero', 'telefono_contacto', 'instalacion_franja'],
  });
  const docValido = validarDocumento(docTipo, docNumero ?? '');

  async function onSubmit(v: Valores) {
    try {
      const res = await guardar.mutateAsync({
        id: contrato?.id,
        datos: aDatos(v),
        telefonos: v.portabilidad.map((t) => ({
          numero: normalizarTelefono(t.numero),
          tipo: t.tipo,
          operador_donante: nulo(t.operador_donante),
        })),
        observacion: editando ? undefined : v.observacion_inicial,
        pdf,
      });
      if (res.errorPdf) {
        toast.error(`El contrato se guardó, pero el PDF no se pudo subir: ${mensajeError(res.errorPdf)}`, {
          duration: 8000,
        });
      } else {
        toast.success(editando ? 'Cambios guardados' : 'Contrato subido. Ya está en Pendiente para backoffice.');
      }
      navigate(`/contratos/${res.id}`, { replace: editando });
    } catch (e) {
      toast.error(mensajeError(e));
    }
  }

  function onInvalid() {
    toast.error('Revisa los campos marcados en rojo');
    const primero = document.querySelector<HTMLElement>('[aria-invalid="true"]');
    primero?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    primero?.focus({ preventScroll: true });
  }

  const err = (campo: keyof Valores) => errors[campo]?.message as string | undefined;

  return (
    <form onSubmit={handleSubmit(onSubmit, onInvalid)} noValidate className="space-y-5">
      {/* 1. Cliente */}
      <Seccion numero={1} titulo="Cliente" icon={<User className="h-4 w-4" />}>
        <Field label="Nombre" required error={err('cliente_nombre')} className="col-span-6 sm:col-span-3">
          <Input autoComplete="off" invalid={!!errors.cliente_nombre} aria-invalid={!!errors.cliente_nombre} {...register('cliente_nombre')} />
        </Field>
        <Field label="Apellidos" required error={err('cliente_apellidos')} className="col-span-6 sm:col-span-3">
          <Input autoComplete="off" invalid={!!errors.cliente_apellidos} aria-invalid={!!errors.cliente_apellidos} {...register('cliente_apellidos')} />
        </Field>
        <Field label="Tipo de documento" required className="col-span-6 sm:col-span-2">
          <Segmentado
            valor={docTipo}
            opciones={[
              { valor: 'DNI', etiqueta: 'DNI' },
              { valor: 'NIE', etiqueta: 'NIE' },
            ]}
            onChange={(v) => setValue('documento_tipo', v, { shouldValidate: !!getValues('documento_numero') })}
          />
        </Field>
        <Field
          label={docTipo === 'DNI' ? 'Número de DNI' : 'Número de NIE'}
          required
          error={err('documento_numero')}
          hint={docTipo === 'DNI' ? '8 números y letra, ej: 12345678Z' : 'X/Y/Z + 7 números y letra, ej: X1234567L'}
          className="col-span-6 sm:col-span-2"
        >
          <Input
            autoComplete="off"
            autoCapitalize="characters"
            placeholder={docTipo === 'DNI' ? '12345678Z' : 'X1234567L'}
            className="font-mono uppercase tracking-wide"
            invalid={!!errors.documento_numero}
            aria-invalid={!!errors.documento_numero}
            suffix={docValido ? <CheckCircle2 className="h-5 w-5 text-brand-600 animate-fade-in" /> : null}
            {...register('documento_numero', {
              onChange: (e) => {
                const tipo = detectarTipoDocumento(e.target.value);
                if (tipo && tipo !== getValues('documento_tipo')) setValue('documento_tipo', tipo);
              },
              onBlur: (e) => setValue('documento_numero', normalizarDocumento(e.target.value), { shouldValidate: true }),
            })}
          />
        </Field>
        <Field label="Email del cliente" error={err('cliente_email')} className="col-span-6 sm:col-span-2">
          <Input
            type="email"
            inputMode="email"
            autoComplete="off"
            placeholder="opcional"
            invalid={!!errors.cliente_email}
            aria-invalid={!!errors.cliente_email}
            {...register('cliente_email')}
          />
        </Field>
      </Seccion>

      {/* 2. Dirección */}
      <Seccion numero={2} titulo="Dirección de instalación" icon={<Home className="h-4 w-4" />}>
        <Field label="Tipo de vía" required className="col-span-6 sm:col-span-2">
          <Select {...register('via_tipo')}>
            {TIPOS_VIA.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </Select>
        </Field>
        <Field label="Nombre de la vía" required error={err('via_nombre')} className="col-span-4 sm:col-span-3">
          <Input autoComplete="off" invalid={!!errors.via_nombre} aria-invalid={!!errors.via_nombre} {...register('via_nombre')} />
        </Field>
        <Field label="Número" required error={err('via_numero')} className="col-span-2 sm:col-span-1">
          <Input autoComplete="off" invalid={!!errors.via_numero} aria-invalid={!!errors.via_numero} {...register('via_numero')} />
        </Field>
        <Field label="Escalera" className="col-span-2">
          <Input autoComplete="off" {...register('escalera')} />
        </Field>
        <Field label="Piso" className="col-span-2">
          <Input autoComplete="off" {...register('piso')} />
        </Field>
        <Field label="Puerta" className="col-span-2">
          <Input autoComplete="off" {...register('puerta')} />
        </Field>
        <Field label="Código postal" required error={err('codigo_postal')} className="col-span-2">
          <Input
            inputMode="numeric"
            maxLength={5}
            autoComplete="off"
            placeholder="28001"
            className="font-mono tracking-wider"
            invalid={!!errors.codigo_postal}
            aria-invalid={!!errors.codigo_postal}
            {...register('codigo_postal', {
              onChange: (e) => {
                const prov = provinciaDesdeCP(e.target.value);
                const actual = getValues('provincia');
                if (prov && (!actual || actual === provinciaAuto.current)) {
                  setValue('provincia', prov, { shouldValidate: true });
                  provinciaAuto.current = prov;
                }
              },
            })}
          />
        </Field>
        <Field label="Población" required error={err('poblacion')} className="col-span-4 sm:col-span-2">
          <Input autoComplete="off" invalid={!!errors.poblacion} aria-invalid={!!errors.poblacion} {...register('poblacion')} />
        </Field>
        <Field label="Provincia" required error={err('provincia')} hint="Se rellena con el código postal" className="col-span-6 sm:col-span-2">
          <Input
            list="lista-provincias"
            autoComplete="off"
            invalid={!!errors.provincia}
            aria-invalid={!!errors.provincia}
            {...register('provincia')}
          />
          <datalist id="lista-provincias">
            {PROVINCIAS.map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
        </Field>
      </Seccion>

      {/* 3. Teléfonos */}
      <Seccion numero={3} titulo="Teléfonos" icon={<Phone className="h-4 w-4" />}>
        <Field label="Teléfono principal de contacto" required error={err('telefono_contacto')} className="col-span-6 sm:col-span-3">
          <Input
            type="tel"
            inputMode="tel"
            autoComplete="off"
            placeholder="600 000 000"
            invalid={!!errors.telefono_contacto}
            aria-invalid={!!errors.telefono_contacto}
            {...register('telefono_contacto')}
          />
        </Field>
        <Field label="Teléfono fijo" error={err('telefono_fijo')} className="col-span-6 sm:col-span-3">
          <Input
            type="tel"
            inputMode="tel"
            autoComplete="off"
            placeholder="opcional"
            invalid={!!errors.telefono_fijo}
            aria-invalid={!!errors.telefono_fijo}
            {...register('telefono_fijo')}
          />
        </Field>

        <div className="col-span-6">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-[13px] font-semibold text-slate-700">Teléfonos a portabilidad</p>
            <span className="text-xs text-slate-400">{portabilidad.fields.length} en lista</span>
          </div>
          {portabilidad.fields.length === 0 && (
            <p className="rounded-xl border border-dashed border-slate-200 px-4 py-3 text-sm text-slate-500">
              Sin portabilidades. Añade los números que el cliente se trae de otra operadora.
            </p>
          )}
          <div className="space-y-3">
            {portabilidad.fields.map((f, i) => {
              const e = errors.portabilidad?.[i];
              return (
                <div
                  key={f.id}
                  className="grid grid-cols-1 gap-3 rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200/70 animate-slide-up sm:grid-cols-[1.2fr_0.9fr_1.2fr_auto] sm:items-start"
                >
                  <Field error={e?.numero?.message}>
                    <Input
                      type="tel"
                      inputMode="tel"
                      placeholder="Número"
                      invalid={!!e?.numero}
                      aria-invalid={!!e?.numero}
                      {...register(`portabilidad.${i}.numero`)}
                    />
                  </Field>
                  <Select aria-label="Tipo" {...register(`portabilidad.${i}.tipo`)}>
                    <option value="movil">Móvil</option>
                    <option value="fijo">Fijo</option>
                  </Select>
                  <Input list="lista-operadores" placeholder="Operador donante" {...register(`portabilidad.${i}.operador_donante`)} />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => portabilidad.remove(i)}
                    aria-label="Quitar teléfono"
                    className="justify-self-end text-slate-400 hover:text-red-600"
                    icon={<Trash2 className="h-4 w-4" />}
                  />
                </div>
              );
            })}
          </div>
          <datalist id="lista-operadores">
            {OPERADORES.map((o) => (
              <option key={o} value={o} />
            ))}
          </datalist>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              variant="soft"
              size="sm"
              icon={<Plus className="h-4 w-4" />}
              onClick={() => portabilidad.append({ numero: '', tipo: 'movil', operador_donante: '' })}
            >
              Añadir teléfono
            </Button>
            {esTelefonoValido(telContacto) &&
              !portabilidad.fields.some((f) => normalizarTelefono(f.numero) === normalizarTelefono(telContacto)) && (
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<Plus className="h-4 w-4" />}
                  onClick={() =>
                    portabilidad.append({
                      numero: normalizarTelefono(telContacto),
                      tipo: /^[89]/.test(normalizarTelefono(telContacto)) ? 'fijo' : 'movil',
                      operador_donante: '',
                    })
                  }
                >
                  Portar el teléfono principal
                </Button>
              )}
          </div>
        </div>

        <div className="col-span-6">
          <DuplicadosAviso
            documentoTipo={docTipo}
            documento={docNumero ?? ''}
            telefono={telContacto ?? ''}
            excluirId={contrato?.id}
          />
        </div>
      </Seccion>

      {/* 4. Oferta */}
      <Seccion numero={4} titulo="Oferta" icon={<FileText className="h-4 w-4" />}>
        <Field label="Operadora" required error={err('operadora')} className="col-span-6 sm:col-span-2">
          <Input invalid={!!errors.operadora} aria-invalid={!!errors.operadora} {...register('operadora')} />
        </Field>
        <Field label="Producto" className="col-span-6 sm:col-span-3">
          <Input placeholder="Ej: Fibra 1 Gb + 2 líneas móviles" {...register('producto')} />
        </Field>
        <Field label="Precio mensual" error={err('precio_mensual')} className="col-span-6 sm:col-span-1">
          <Input
            inputMode="decimal"
            placeholder="0,00"
            invalid={!!errors.precio_mensual}
            aria-invalid={!!errors.precio_mensual}
            suffix={<span className="text-sm font-semibold text-slate-400">€</span>}
            {...register('precio_mensual')}
          />
        </Field>
        <Field label="Detalle de la oferta" hint="Promociones, descuentos, permanencia, condiciones…" className="col-span-6">
          <Textarea rows={4} {...register('oferta_detalle')} />
        </Field>
        <Field
          label="PDF de la oferta enviada al cliente"
          hint={editando && numDocumentos > 0 ? `Ya hay ${numDocumentos} versión(es). Si subes otro, se guarda como nueva versión.` : undefined}
          className="col-span-6"
        >
          <PdfDropzone
            archivo={pdf}
            onChange={setPdf}
            texto={editando && numDocumentos > 0 ? 'Subir una nueva versión del PDF' : undefined}
          />
        </Field>
      </Seccion>

      {/* 5. Instalación */}
      <Seccion numero={5} titulo="Cita de instalación" icon={<CalendarClock className="h-4 w-4" />}>
        <Field label="Fecha de la cita" className="col-span-6 sm:col-span-2">
          <Input type="date" {...register('instalacion_fecha')} />
        </Field>
        <Field label="Franja horaria" className="col-span-6 sm:col-span-4">
          <Input list="lista-franjas" placeholder="Ej: mañana 9-14h" {...register('instalacion_franja')} />
          <datalist id="lista-franjas">
            {FRANJAS.map((f) => (
              <option key={f} value={f} />
            ))}
          </datalist>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {FRANJAS.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setValue('instalacion_franja', f, { shouldDirty: true })}
                className={cn(
                  'rounded-full px-3 py-1 text-xs font-semibold ring-1 transition',
                  franja === f ? 'bg-navy-900 text-white ring-navy-900' : 'bg-white text-slate-600 ring-slate-200 hover:ring-navy-300',
                )}
              >
                {f}
              </button>
            ))}
          </div>
        </Field>
      </Seccion>

      {/* 6. Observación inicial */}
      {!editando && (
        <Seccion numero={6} titulo="Observación inicial" icon={<MessageSquare className="h-4 w-4" />}>
          <Field
            label="Notas para backoffice"
            hint="Cualquier detalle útil para cerrar la venta: horario para llamar, dudas del cliente…"
            error={err('observacion_inicial')}
            className="col-span-6"
          >
            <Textarea rows={3} {...register('observacion_inicial')} />
          </Field>
        </Seccion>
      )}

      {/* Barra de guardado fija */}
      <div className="sticky bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-20 lg:bottom-4">
        <div className="flex items-center gap-3 rounded-2xl bg-navy-950/95 px-4 py-3 shadow-pop backdrop-blur">
          <p className="hidden flex-1 text-sm text-navy-200 sm:block">
            {editando ? 'Los cambios se guardan en el historial del contrato.' : 'El contrato entrará en estado Pendiente.'}
          </p>
          <Button variant="ghost" className="text-navy-100 hover:bg-white/10 hover:text-white" onClick={() => navigate(-1)}>
            Cancelar
          </Button>
          <Button type="submit" size="lg" className="flex-1 sm:flex-none" loading={isSubmitting} icon={<Save className="h-4 w-4" />}>
            {editando ? 'Guardar cambios' : 'Guardar contrato'}
          </Button>
        </div>
      </div>
    </form>
  );
}

export function ContratoFormPage() {
  const { id } = useParams();
  const p = usePermisos();
  const contrato = useContrato(id);
  const telefonos = useTelefonosPortabilidad(id);
  const documentos = useDocumentos(id);

  const volver = (
    <Link
      to={id ? `/contratos/${id}` : '/contratos'}
      className="mb-2 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-navy-900"
    >
      <ArrowLeft className="h-4 w-4" /> {id ? 'Volver a la ficha' : 'Contratos'}
    </Link>
  );

  if (!id) {
    return (
      <div className="mx-auto max-w-4xl">
        <PageHeader
          volver={volver}
          titulo="Nuevo contrato"
          subtitulo="Rellena los datos de la venta. Los campos con * son obligatorios."
        />
        <Formulario numDocumentos={0} />
      </div>
    );
  }

  if (contrato.isLoading || telefonos.isLoading || documentos.isLoading) return <PageLoader />;
  if (contrato.error) return <ErrorState mensaje={mensajeError(contrato.error)} onRetry={() => contrato.refetch()} />;
  if (!contrato.data) return <ErrorState mensaje="No se ha encontrado el contrato o no tienes acceso." />;

  const c = contrato.data;
  if (!p.puedeEditarContrato(c)) {
    return (
      <div className="mx-auto max-w-2xl">
        <PageHeader volver={volver} titulo="No se puede editar" />
        <Aviso tipo="warning" titulo="Este contrato ya no es editable">
          Solo se puede modificar mientras está en Pendiente y sin firmar. Si necesitas cambiar algo, déjalo en las
          observaciones para backoffice.
        </Aviso>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        volver={volver}
        titulo={`Editar ${numeroContrato(c.numero)}`}
        subtitulo={nombreCliente(c)}
      />
      <Formulario contrato={c} telefonos={telefonos.data} numDocumentos={documentos.data?.length ?? 0} />
    </div>
  );
}
