import type { ReactNode } from 'react';
import { ROLES } from '@/lib/constants';
import type { Rol } from '@/lib/types';
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

export function RolBadge({ rol }: { rol: Rol }) {
  return <Badge className={ROLES[rol].badge}>{ROLES[rol].etiqueta}</Badge>;
}
