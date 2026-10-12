import { AlertTriangle, Loader2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('h-5 w-5 animate-spin text-brand-600', className)} />;
}

export function PageLoader({ texto = 'Cargando…' }: { texto?: string }) {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-sm text-slate-500 animate-fade-in">
      <Spinner className="h-7 w-7" />
      {texto}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-lg bg-slate-200/70', className)} />;
}

interface EmptyStateProps {
  icon: ReactNode;
  titulo: string;
  texto?: ReactNode;
  accion?: ReactNode;
  className?: string;
}

export function EmptyState({ icon, titulo, texto, accion, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-12 text-center animate-fade-in', className)}>
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-sun-100 to-brand-100 text-navy-700">
        {icon}
      </div>
      <h3 className="text-base font-semibold text-navy-900">{titulo}</h3>
      {texto && <p className="mt-1 max-w-sm text-sm text-slate-500">{texto}</p>}
      {accion && <div className="mt-5">{accion}</div>}
    </div>
  );
}

export function ErrorState({ mensaje, onRetry }: { mensaje: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-red-100 bg-red-50/60 px-6 py-10 text-center">
      <AlertTriangle className="h-7 w-7 text-red-500" />
      <p className="max-w-md text-sm text-red-700">{mensaje}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="text-sm font-semibold text-red-700 underline underline-offset-2">
          Reintentar
        </button>
      )}
    </div>
  );
}

export function Aviso({
  tipo = 'info',
  titulo,
  children,
  icon,
  className,
}: {
  tipo?: 'info' | 'warning' | 'success' | 'danger';
  titulo?: ReactNode;
  children?: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  const estilos = {
    info: 'border-navy-100 bg-navy-50/70 text-navy-800',
    warning: 'border-sun-200 bg-sun-50 text-sun-700',
    success: 'border-brand-200 bg-brand-50 text-brand-800',
    danger: 'border-red-200 bg-red-50 text-red-700',
  }[tipo];
  return (
    <div className={cn('flex gap-3 rounded-xl border px-4 py-3 text-sm', estilos, className)}>
      {icon && <span className="mt-0.5 shrink-0">{icon}</span>}
      <div className="min-w-0 flex-1">
        {titulo && <p className="font-semibold">{titulo}</p>}
        {children && <div className={cn(titulo && 'mt-0.5')}>{children}</div>}
      </div>
    </div>
  );
}
