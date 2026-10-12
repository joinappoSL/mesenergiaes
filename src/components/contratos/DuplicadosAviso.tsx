import { AlertTriangle, ExternalLink } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { EstadoBadge } from '@/components/ui/Badge';
import { comprobarDuplicados } from '@/hooks/datos';
import { fecha, numeroContrato } from '@/lib/format';
import type { Duplicado, TipoDocumento } from '@/lib/types';
import { esTelefonoValido, normalizarDocumento, normalizarTelefono, validarDocumento } from '@/lib/validators';

interface Props {
  documentoTipo: TipoDocumento;
  documento: string;
  telefono: string;
  excluirId?: string;
}

/** Aviso (no bloqueante) si ya existe otro contrato con el mismo DNI/NIE o teléfono. */
export function DuplicadosAviso({ documentoTipo, documento, telefono, excluirId }: Props) {
  const [duplicados, setDuplicados] = useState<Duplicado[]>([]);

  const doc = validarDocumento(documentoTipo, documento) ? normalizarDocumento(documento) : null;
  const tel = esTelefonoValido(telefono) ? normalizarTelefono(telefono) : null;

  useEffect(() => {
    if (!doc && !tel) {
      setDuplicados([]);
      return;
    }
    let cancelado = false;
    const t = window.setTimeout(async () => {
      try {
        const res = await comprobarDuplicados(doc, tel, excluirId);
        if (!cancelado) setDuplicados(res);
      } catch {
        if (!cancelado) setDuplicados([]);
      }
    }, 450);
    return () => {
      cancelado = true;
      window.clearTimeout(t);
    };
  }, [doc, tel, excluirId]);

  if (!duplicados.length) return null;

  return (
    <div className="rounded-2xl border border-sun-300 bg-sun-50 p-4 animate-slide-up" role="status">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sun-200 text-sun-700">
          <AlertTriangle className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-navy-900">
            {duplicados.length === 1 ? 'Ya existe un contrato' : `Ya existen ${duplicados.length} contratos`} con estos datos
          </p>
          <p className="text-sm text-slate-600">Puedes guardar igualmente, pero revisa que no sea una venta duplicada.</p>
          <ul className="mt-3 space-y-2">
            {duplicados.map((d) => (
              <li
                key={`${d.numero}-${d.coincidencia}`}
                className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl bg-white/80 px-3 py-2 text-sm ring-1 ring-sun-200"
              >
                <span className="font-mono text-xs font-semibold text-slate-500">{numeroContrato(d.numero)}</span>
                <EstadoBadge estado={d.estado} />
                <span className="text-slate-700">
                  Comercial: <strong>{d.comercial_nombre}</strong>
                </span>
                <span className="text-xs text-slate-500">
                  Mismo {d.coincidencia} · alta {fecha(d.created_at)}
                </span>
                {d.id && (
                  <Link
                    to={`/contratos/${d.id}`}
                    target="_blank"
                    className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-navy-600 hover:text-navy-900"
                  >
                    Ver <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
