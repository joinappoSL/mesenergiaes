import { ArrowLeft } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { ContratoDetalle } from '@/components/contratos/ContratoDetalle';
import { EmptyState, ErrorState, PageLoader } from '@/components/ui/Feedback';
import { useContrato } from '@/hooks/datos';
import { mensajeError } from '@/lib/utils';

export function ContratoDetallePage() {
  const { id } = useParams();
  const contrato = useContrato(id);

  return (
    <div>
      <Link
        to="/contratos"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-navy-900"
      >
        <ArrowLeft className="h-4 w-4" /> Contratos
      </Link>
      {contrato.isLoading ? (
        <PageLoader />
      ) : contrato.error ? (
        <ErrorState mensaje={mensajeError(contrato.error)} onRetry={() => contrato.refetch()} />
      ) : !contrato.data ? (
        <EmptyState
          icon={<ArrowLeft className="h-6 w-6" />}
          titulo="Contrato no encontrado"
          texto="No existe o no tienes permiso para verlo."
        />
      ) : (
        <ContratoDetalle contrato={contrato.data} />
      )}
    </div>
  );
}
