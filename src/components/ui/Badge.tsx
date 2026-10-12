import { CheckCircle2, PenLine } from 'lucide-react';
import type { ReactNode } from 'react';
import { ESTADOS, ROLES } from '@/lib/constants';
import type { EstadoContrato, Rol } from '@/lib/types';
import { cn } from '@/lib/utils';

interface BadgeProps {
  children: ReactNode;
  className?: string;
  icon?: ReactNode;
}

export function Badge({ children, className, icon }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset',
        className ?? 'bg-slate-100 text-slate-700 ring-slate-200',
      )}
    >
      {icon}
      {children}
    </span>
  );
}

export function EstadoBadge({ estado, className }: { estado: EstadoContrato; className?: string }) {
  const cfg = ESTADOS[estado];
  return (
    <Badge className={cn(cfg.badge, className)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', cfg.punto)} />
      {cfg.etiqueta}
    </Badge>
  );
}

export function RolBadge({ rol }: { rol: Rol }) {
  return <Badge className={ROLES[rol].badge}>{ROLES[rol].etiqueta}</Badge>;
}

export function FirmaBadge({ firmado }: { firmado: boolean }) {
  return firmado ? (
    <Badge className="bg-brand-50 text-brand-700 ring-brand-200" icon={<CheckCircle2 className="h-3.5 w-3.5" />}>
      Firmado
    </Badge>
  ) : (
    <Badge className="bg-slate-50 text-slate-600 ring-slate-200" icon={<PenLine className="h-3.5 w-3.5" />}>
      Sin firmar
    </Badge>
  );
}
