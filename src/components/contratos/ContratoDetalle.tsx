import {
  AlarmClock,
  Building2,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Euro,
  History,
  Landmark,
  Mail,
  MapPin,
  MessageSquare,
  Pencil,
  Phone,
  PhoneCall,
  RefreshCcw,
  ShieldCheck,
  Smartphone,
  Trash2,
  User,
  UserCog,
  XCircle,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { usePermisos } from '@/auth/permisos';
import { EstadoBadge, FirmaBadge } from '@/components/ui/Badge';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Card, CardBody, CardHeader, Dato } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Feedback';
import { Tabs } from '@/components/ui/Misc';
import { useTelefonosPortabilidad } from '@/hooks/datos';
import { useMarcarFirma } from '@/hooks/mutaciones';
import { ESTADOS } from '@/lib/constants';
import {
  diasDesde,
  direccionLinea1,
  direccionLinea2,
  etiquetaDias,
  euros,
  fechaHora,
  fechaHoraCorta,
  fechaLarga,
  hoyISO,
  nombreCliente,
  numeroContrato,
  telefono,
} from '@/lib/format';
import type { Contrato } from '@/lib/types';
import { cn, mensajeError } from '@/lib/utils';
import { formatearIban } from '@/lib/validators';
import { estadoVerificacion, type EstadoVerificacion } from '@/lib/verificaciones';
import { FormularioLlamada, Historial, ListaLlamadas, Observaciones } from './Actividad';
import { CambiarEstadoModal, EliminarContratoModal, ReasignarModal } from './Modales';
import { PdfVisor } from './PdfVisor';
import { AccionesVerificacion, EstadoVerificacionBadge, TextoVerificada } from './Verificacion';

function BotonLlamar({ numero, etiqueta, icon, destacado }: { numero: string; etiqueta: ReactNode; icon: ReactNode; destacado?: boolean }) {
  return (
    <a
      href={`tel:${numero}`}
      className={cn(
        'group flex items-center gap-3 rounded-xl px-3.5 py-3 ring-1 transition active:scale-[0.99]',
        destacado ? 'bg-brand-50 ring-brand-200 hover:bg-brand-100' : 'bg-white ring-slate-200 hover:bg-slate-50',
      )}
    >
      <span
        className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
          destacado ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600',
        )}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-mono text-[15px] font-semibold tracking-wide text-slate-900">{telefono(numero)}</span>
        <span className="block truncate text-xs text-slate-500">{etiqueta}</span>
      </span>
      <PhoneCall className={cn('h-4 w-4 transition', destacado ? 'text-brand-600' : 'text-slate-300 group-hover:text-slate-500')} />
    </a>
  );
}

function Telefonos({ contrato }: { contrato: Contrato }) {
  const tels = useTelefonosPortabilidad(contrato.id);
  return (
    <Card>
      <CardHeader title="Teléfonos" icon={<Phone className="h-4 w-4" />} subtitle="Pulsa para llamar" />
      <CardBody className="space-y-2.5">
        <BotonLlamar numero={contrato.telefono_contacto} etiqueta="Contacto principal" icon={<Smartphone className="h-4 w-4" />} destacado />
        {contrato.telefono_fijo && <BotonLlamar numero={contrato.telefono_fijo} etiqueta="Fijo" icon={<Phone className="h-4 w-4" />} />}
        <div className="pt-2">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">A portabilidad</p>
          {tels.isLoading ? (
            <Spinner />
          ) : tels.data?.length ? (
            <div className="grid gap-2.5 sm:grid-cols-2">
              {tels.data.map((t) => (
                <BotonLlamar
                  key={t.id}
                  numero={t.numero}
                  icon={t.tipo === 'fijo' ? <Phone className="h-4 w-4" /> : <Smartphone className="h-4 w-4" />}
                  etiqueta={`${t.tipo === 'fijo' ? 'Fijo' : 'Móvil'}${t.operador_donante ? ` · viene de ${t.operador_donante}` : ''}`}
                />
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500">Sin portabilidades.</p>
          )}
        </div>
      </CardBody>
    </Card>
  );
}

const TONO_VERIFICACION: Record<EstadoVerificacion, { caja: string; icono: string }> = {
  hecha: { caja: 'bg-brand-50/60 ring-brand-200', icono: 'text-brand-600' },
  ahora: { caja: 'bg-sun-50 ring-sun-300', icono: 'text-sun-600' },
  retrasada: { caja: 'bg-red-50/70 ring-red-200', icono: 'text-red-600' },
  proxima: { caja: 'bg-navy-50/60 ring-navy-100', icono: 'text-navy-600' },
};

function Gestion({ contrato, sinAccionesVerificacion }: { contrato: Contrato; sinAccionesVerificacion?: boolean }) {
  const p = usePermisos();
  const instalacionHoy = contrato.instalacion_fecha === hoyISO();
  const estadoVerif = contrato.verificacion_at ? estadoVerificacion(contrato, new Date()) : null;
  const tono = estadoVerif ? TONO_VERIFICACION[estadoVerif] : { caja: 'bg-slate-50 ring-slate-200', icono: 'text-slate-400' };
  return (
    <Card>
      <CardHeader title="Gestión" icon={<ClipboardList className="h-4 w-4" />} />
      <CardBody>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-4">
          <Dato label="Estado">
            <EstadoBadge estado={contrato.estado} />
          </Dato>
          <Dato label="Firma">
            <FirmaBadge firmado={contrato.firmado} />
            {contrato.fecha_firma && <span className="mt-1 block text-xs text-slate-500">{fechaHora(contrato.fecha_firma)}</span>}
          </Dato>
          {contrato.motivo_estado && (
            <Dato label="Motivo" className="col-span-2">
              <span className="block rounded-lg bg-slate-50 px-3 py-2 text-sm">{contrato.motivo_estado}</span>
            </Dato>
          )}
          <Dato label="Comercial">{contrato.comercial_nombre ?? '—'}</Dato>
          <Dato label="Equipo">{contrato.equipo_nombre ?? '—'}</Dato>
          <Dato label="Fecha de alta">{fechaHora(contrato.created_at)}</Dato>
          <Dato label="Última modificación">{fechaHoraCorta(contrato.updated_at)}</Dato>
        </dl>
        <div className={cn('mt-5 rounded-xl px-3.5 py-3 ring-1', tono.caja)}>
          <div className="flex items-center gap-3">
            <ShieldCheck className={cn('h-5 w-5 shrink-0', tono.icono)} />
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Verificación programada</p>
              {contrato.verificacion_at ? (
                <p className="text-sm font-semibold text-navy-900 first-letter:uppercase">{fechaHoraCorta(contrato.verificacion_at)}</p>
              ) : (
                <p className="text-sm text-slate-500">Sin programar</p>
              )}
            </div>
            {estadoVerif && <EstadoVerificacionBadge estado={estadoVerif} />}
          </div>
          <TextoVerificada contrato={contrato} className="mt-2" />
          {p.puedeVerVerificaciones && !sinAccionesVerificacion && <AccionesVerificacion contrato={contrato} className="mt-3" />}
        </div>
        <div
          className={cn(
            'mt-3 flex items-center gap-3 rounded-xl px-3.5 py-3 ring-1',
            instalacionHoy ? 'bg-sun-50 ring-sun-300' : 'bg-navy-50/60 ring-navy-100',
          )}
        >
          <CalendarClock className={cn('h-5 w-5 shrink-0', instalacionHoy ? 'text-sun-600' : 'text-navy-600')} />
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Cita de instalación</p>
            {contrato.instalacion_fecha ? (
              <p className="text-sm font-semibold text-navy-900 first-letter:uppercase">
                {instalacionHoy ? 'Hoy' : fechaLarga(contrato.instalacion_fecha)}
                {contrato.instalacion_franja && <span className="font-normal text-slate-600"> · {contrato.instalacion_franja}</span>}
              </p>
            ) : (
              <p className="text-sm text-slate-500">Sin fecha</p>
            )}
          </div>
        </div>
        {contrato.estado === 'pendiente' && contrato.proxima_llamada_at && (
          <div className="mt-3 flex items-center gap-2 rounded-xl bg-sun-50 px-3.5 py-2.5 text-sm font-semibold text-sun-700 ring-1 ring-sun-200">
            <AlarmClock className="h-4 w-4" /> Volver a llamar {fechaHoraCorta(contrato.proxima_llamada_at)}
          </div>
        )}
      </CardBody>
    </Card>
  );
}

export function ContratoDetalle({
  contrato,
  accionesExtra,
  sinAccionesVerificacion,
}: {
  contrato: Contrato;
  accionesExtra?: ReactNode;
  /** en el modo llamada de verificaciones las acciones van arriba */
  sinAccionesVerificacion?: boolean;
}) {
  const p = usePermisos();
  const marcarFirma = useMarcarFirma();
  const [cambiandoEstado, setCambiandoEstado] = useState(false);
  const [reasignando, setReasignando] = useState(false);
  const [eliminando, setEliminando] = useState(false);
  const [pestana, setPestana] = useState<'observaciones' | 'historial'>('observaciones');
  const editable = p.puedeEditarContrato(contrato);
  const dias = diasDesde(contrato.created_at);

  async function alternarFirma() {
    try {
      await marcarFirma.mutateAsync({ id: contrato.id, firmado: !contrato.firmado });
      toast.success(contrato.firmado ? 'Se ha quitado la firma' : 'Contrato marcado como firmado');
    } catch (e) {
      toast.error(mensajeError(e));
    }
  }

  return (
    <div className="space-y-5">
      {/* Cabecera */}
      <Card className="relative overflow-hidden">
        <div className="absolute inset-y-0 left-0 w-1.5" style={{ backgroundColor: ESTADOS[contrato.estado].color }} />
        <div className="flex flex-col gap-4 p-5 pl-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-md bg-navy-50 px-2 py-0.5 font-mono text-xs font-semibold text-navy-700">
                {numeroContrato(contrato.numero)}
              </span>
              <EstadoBadge estado={contrato.estado} />
              <FirmaBadge firmado={contrato.firmado} />
              {contrato.estado === 'pendiente' && (
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
                  {dias === 0 ? 'Subido hoy' : `${etiquetaDias(dias)} en pendiente`}
                </span>
              )}
            </div>
            <h1 className="mt-2 truncate text-2xl font-semibold text-navy-900">{nombreCliente(contrato)}</h1>
            <p className="mt-0.5 text-sm text-slate-500">
              {contrato.documento_tipo} {contrato.documento_numero} · {contrato.poblacion} · {contrato.producto ?? contrato.operadora}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {accionesExtra}
            {editable && (
              <ButtonLink to={`/contratos/${contrato.id}/editar`} variant="secondary" icon={<Pencil className="h-4 w-4" />}>
                Editar
              </ButtonLink>
            )}
            {p.puedeReasignar && (
              <Button variant="secondary" icon={<UserCog className="h-4 w-4" />} onClick={() => setReasignando(true)}>
                Reasignar
              </Button>
            )}
            {p.puedeMarcarFirma && (
              <Button
                variant={contrato.firmado ? 'secondary' : 'warning'}
                icon={contrato.firmado ? <XCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                onClick={alternarFirma}
                loading={marcarFirma.isPending}
              >
                {contrato.firmado ? 'Quitar firma' : 'Marcar firmado'}
              </Button>
            )}
            {p.puedeCambiarEstado && (
              <Button variant="navy" icon={<RefreshCcw className="h-4 w-4" />} onClick={() => setCambiandoEstado(true)}>
                Cambiar estado
              </Button>
            )}
            {p.puedeEliminarContrato && (
              <Button
                variant="secondary"
                icon={<Trash2 className="h-4 w-4" />}
                onClick={() => setEliminando(true)}
                className="text-red-600 hover:text-red-700"
              >
                Eliminar
              </Button>
            )}
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <div className="space-y-5 xl:col-span-2">
          <div className="grid gap-5 md:grid-cols-2">
            <Card>
              <CardHeader title="Cliente" icon={<User className="h-4 w-4" />} />
              <CardBody>
                <dl className="grid grid-cols-2 gap-4">
                  <Dato label="Nombre">{contrato.cliente_nombre}</Dato>
                  <Dato label="Apellidos">{contrato.cliente_apellidos}</Dato>
                  <Dato label={contrato.documento_tipo}>
                    <span className="font-mono tracking-wide">{contrato.documento_numero}</span>
                  </Dato>
                  <Dato label="Email">
                    {contrato.cliente_email ? (
                      <a
                        href={`mailto:${contrato.cliente_email}`}
                        title={contrato.cliente_email}
                        className="inline-flex max-w-full items-center gap-1 text-navy-600 hover:underline"
                      >
                        <Mail className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{contrato.cliente_email}</span>
                      </a>
                    ) : (
                      '—'
                    )}
                  </Dato>
                  <Dato label="IBAN" className="col-span-2">
                    {contrato.iban ? (
                      <span className="inline-flex items-center gap-1.5 font-mono text-[13px] tracking-wide">
                        <Landmark className="h-3.5 w-3.5 shrink-0 text-slate-400" /> {formatearIban(contrato.iban)}
                      </span>
                    ) : (
                      '—'
                    )}
                  </Dato>
                </dl>
              </CardBody>
            </Card>
            <Card>
              <CardHeader title="Dirección" icon={<MapPin className="h-4 w-4" />} />
              <CardBody>
                <p className="text-[15px] font-medium text-slate-800">{direccionLinea1(contrato)}</p>
                <p className="text-sm text-slate-500">{direccionLinea2(contrato)}</p>
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${direccionLinea1(contrato)}, ${direccionLinea2(contrato)}`)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-navy-600 hover:text-navy-900"
                >
                  <MapPin className="h-4 w-4" /> Ver en el mapa
                </a>
              </CardBody>
            </Card>
          </div>

          <Telefonos contrato={contrato} />

          <Card>
            <CardHeader title="Oferta" icon={<Building2 className="h-4 w-4" />} />
            <CardBody>
              <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <Dato label="Operadora">{contrato.operadora}</Dato>
                <Dato label="Producto" className="sm:col-span-1">
                  {contrato.producto ?? '—'}
                </Dato>
                <Dato label="Precio mensual">
                  <span className="inline-flex items-center gap-1 text-lg font-semibold text-navy-900">
                    <Euro className="h-4 w-4 text-brand-600" />
                    {euros(contrato.precio_mensual)}
                  </span>
                </Dato>
              </dl>
              {contrato.oferta_detalle && (
                <div className="mt-4 whitespace-pre-wrap rounded-xl bg-slate-50 px-4 py-3 text-sm leading-relaxed text-slate-700">
                  {contrato.oferta_detalle}
                </div>
              )}
            </CardBody>
          </Card>

          <PdfVisor contratoId={contrato.id} puedeSubir={editable} />
        </div>

        <div className="space-y-5">
          <Gestion contrato={contrato} sinAccionesVerificacion={sinAccionesVerificacion} />

          {(p.puedeRegistrarLlamadas || contrato.ultima_llamada_at) && (
            <Card>
              <CardHeader
                title="Llamadas"
                icon={<PhoneCall className="h-4 w-4" />}
                subtitle={contrato.ultima_llamada_at ? `Última: ${fechaHoraCorta(contrato.ultima_llamada_at)}` : 'Sin llamadas'}
              />
              <CardBody className="space-y-5">
                {p.puedeRegistrarLlamadas && <FormularioLlamada contratoId={contrato.id} />}
                <ListaLlamadas contratoId={contrato.id} />
              </CardBody>
            </Card>
          )}

          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <Tabs
                value={pestana}
                onChange={setPestana}
                tabs={[
                  { value: 'observaciones', label: <><MessageSquare className="h-3.5 w-3.5" /> Observaciones</> },
                  { value: 'historial', label: <><History className="h-3.5 w-3.5" /> Historial</> },
                ]}
              />
            </div>
            {pestana === 'observaciones' ? <Observaciones contratoId={contrato.id} /> : <Historial contratoId={contrato.id} />}
          </Card>
        </div>
      </div>

      {cambiandoEstado && <CambiarEstadoModal contrato={contrato} onClose={() => setCambiandoEstado(false)} />}
      {reasignando && <ReasignarModal contrato={contrato} onClose={() => setReasignando(false)} />}
      {eliminando && <EliminarContratoModal contrato={contrato} onClose={() => setEliminando(false)} />}
    </div>
  );
}
