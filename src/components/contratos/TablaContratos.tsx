import { AlarmClock, ArrowDown, ArrowUp, ArrowUpDown, CheckCircle2, ChevronRight, FileText } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { EstadoBadge } from '@/components/ui/Badge';
import type { Orden } from '@/hooks/datos';
import { diasDesde, etiquetaDias, euros, fecha, fechaHoraCorta, nombreCliente, numeroContrato, telefono } from '@/lib/format';
import type { Contrato } from '@/lib/types';
import { cn } from '@/lib/utils';

interface Props {
  filas: Contrato[];
  orden: Orden;
  onOrdenar: (campo: Orden['campo']) => void;
  mostrarComercial: boolean;
}

function Cabecera({
  campo,
  children,
  orden,
  onOrdenar,
  className,
}: {
  campo?: Orden['campo'];
  children: ReactNode;
  orden: Orden;
  onOrdenar: (c: Orden['campo']) => void;
  className?: string;
}) {
  if (!campo) {
    return <th className={cn('px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500', className)}>{children}</th>;
  }
  const activo = orden.campo === campo;
  const Icono = activo ? (orden.asc ? ArrowUp : ArrowDown) : ArrowUpDown;
  return (
    <th className={cn('px-4 py-3 text-left', className)} aria-sort={activo ? (orden.asc ? 'ascending' : 'descending') : 'none'}>
      <button
        type="button"
        onClick={() => onOrdenar(campo)}
        className={cn(
          'inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide transition',
          activo ? 'text-navy-900' : 'text-slate-500 hover:text-slate-800',
        )}
      >
        {children}
        <Icono className={cn('h-3.5 w-3.5', !activo && 'opacity-40')} />
      </button>
    </th>
  );
}

export function TablaContratos({ filas, orden, onOrdenar, mostrarComercial }: Props) {
  const navigate = useNavigate();
  const cab = { orden, onOrdenar };

  return (
    <>
      {/* Escritorio */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="border-b border-slate-100 bg-slate-50/70">
            <tr>
              <Cabecera campo="numero" {...cab} className="w-20">
                Nº
              </Cabecera>
              <Cabecera campo="cliente_apellidos" {...cab}>
                Cliente
              </Cabecera>
              <Cabecera {...cab}>Contacto</Cabecera>
              <Cabecera campo="producto" {...cab}>
                Oferta
              </Cabecera>
              {mostrarComercial && (
                <Cabecera campo="comercial_nombre" {...cab}>
                  Comercial
                </Cabecera>
              )}
              <Cabecera campo="estado" {...cab}>
                Estado
              </Cabecera>
              <Cabecera campo="created_at" {...cab}>
                Alta
              </Cabecera>
              <Cabecera campo="instalacion_fecha" {...cab}>
                Instalación
              </Cabecera>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filas.map((c) => (
              <tr
                key={c.id}
                onClick={() => navigate(`/contratos/${c.id}`)}
                className="group cursor-pointer transition hover:bg-navy-50/40"
              >
                <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-500">{numeroContrato(c.numero)}</td>
                <td className="px-4 py-3">
                  <Link
                    to={`/contratos/${c.id}`}
                    onClick={(e) => e.stopPropagation()}
                    className="font-semibold text-navy-900 hover:underline"
                  >
                    {nombreCliente(c)}
                  </Link>
                  <p className="font-mono text-xs text-slate-500">
                    {c.documento_tipo} {c.documento_numero}
                  </p>
                </td>
                <td className="px-4 py-3">
                  <p className="font-mono text-[13px] text-slate-700">{telefono(c.telefono_contacto)}</p>
                  <p className="text-xs text-slate-500">{c.poblacion}</p>
                </td>
                <td className="max-w-[220px] px-4 py-3">
                  <p className="truncate text-slate-700" title={c.producto ?? ''}>
                    {c.producto ?? c.operadora}
                  </p>
                  <p className="text-xs text-slate-500">
                    {euros(c.precio_mensual)}
                    {c.num_documentos > 0 && (
                      <span className="ml-1.5 inline-flex items-center gap-0.5 text-slate-400" title="Tiene PDF">
                        <FileText className="h-3 w-3" /> PDF
                      </span>
                    )}
                  </p>
                </td>
                {mostrarComercial && (
                  <td className="px-4 py-3">
                    <p className="text-slate-700">{c.comercial_nombre ?? '—'}</p>
                    <p className="text-xs text-slate-500">{c.equipo_nombre ?? ''}</p>
                  </td>
                )}
                <td className="px-4 py-3">
                  <div className="flex flex-col items-start gap-1">
                    <EstadoBadge estado={c.estado} />
                    <span className={cn('inline-flex items-center gap-1 text-[11px] font-semibold', c.firmado ? 'text-brand-700' : 'text-slate-400')}>
                      <CheckCircle2 className="h-3 w-3" /> {c.firmado ? 'Firmado' : 'Sin firmar'}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {fecha(c.created_at)}
                  {c.estado === 'pendiente' && (
                    <p className="text-[11px] font-semibold text-amber-700">{etiquetaDias(diasDesde(c.created_at))}</p>
                  )}
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {fecha(c.instalacion_fecha)}
                  {c.instalacion_franja && <p className="text-[11px] text-slate-400">{c.instalacion_franja}</p>}
                </td>
                <td className="pr-3">
                  <ChevronRight className="h-4 w-4 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-slate-500" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Móvil */}
      <ul className="divide-y divide-slate-100 md:hidden">
        {filas.map((c) => (
          <li key={c.id}>
            <Link to={`/contratos/${c.id}`} className="flex gap-3 px-4 py-3.5 active:bg-slate-50">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate font-semibold text-navy-900">{nombreCliente(c)}</p>
                </div>
                <p className="mt-0.5 truncate text-xs text-slate-500">
                  {numeroContrato(c.numero)} · {telefono(c.telefono_contacto)} · {c.poblacion}
                </p>
                <p className="mt-0.5 truncate text-xs text-slate-500">
                  {c.producto ?? c.operadora} · {euros(c.precio_mensual)}
                </p>
                {c.estado === 'pendiente' && c.proxima_llamada_at && (
                  <p className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-sun-700">
                    <AlarmClock className="h-3 w-3" /> Llamar {fechaHoraCorta(c.proxima_llamada_at)}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1.5">
                <EstadoBadge estado={c.estado} />
                <span className={cn('text-[11px] font-semibold', c.firmado ? 'text-brand-700' : 'text-slate-400')}>
                  {c.firmado ? 'Firmado' : 'Sin firmar'}
                </span>
                <span className="text-[11px] text-slate-400">{fecha(c.created_at)}</span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
