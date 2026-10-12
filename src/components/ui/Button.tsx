import { Loader2 } from 'lucide-react';
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router-dom';
import { cn } from '@/lib/utils';

type Variante = 'primary' | 'secondary' | 'navy' | 'ghost' | 'danger' | 'warning' | 'soft';
type Tamano = 'sm' | 'md' | 'lg' | 'icon';

const VARIANTES: Record<Variante, string> = {
  primary:
    'bg-brand-600 text-white shadow-sm shadow-brand-700/20 hover:bg-brand-700 active:bg-brand-800 focus-visible:ring-brand-500/30',
  navy: 'bg-navy-800 text-white shadow-sm hover:bg-navy-900 active:bg-navy-950 focus-visible:ring-navy-500/30',
  secondary:
    'bg-white text-slate-700 ring-1 ring-inset ring-slate-200 shadow-xs hover:bg-slate-50 hover:text-slate-900 focus-visible:ring-navy-500/20',
  soft: 'bg-navy-50 text-navy-700 hover:bg-navy-100 focus-visible:ring-navy-500/20',
  ghost: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-navy-500/20',
  danger: 'bg-red-600 text-white shadow-sm hover:bg-red-700 focus-visible:ring-red-500/30',
  warning: 'bg-sun-400 text-navy-950 shadow-sm hover:bg-sun-500 focus-visible:ring-sun-500/30',
};

const TAMANOS: Record<Tamano, string> = {
  sm: 'h-8 gap-1.5 rounded-lg px-3 text-[13px]',
  md: 'h-10 gap-2 rounded-xl px-4 text-sm',
  lg: 'h-12 gap-2 rounded-xl px-5 text-[15px]',
  icon: 'h-10 w-10 rounded-xl',
};

const BASE =
  'inline-flex shrink-0 select-none items-center justify-center font-semibold whitespace-nowrap transition-all duration-150 focus-visible:outline-none focus-visible:ring-4 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variante;
  size?: Tamano;
  loading?: boolean;
  icon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading, icon, className, children, disabled, type = 'button', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={cn(BASE, VARIANTES[variant], TAMANOS[size], className)}
      {...props}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
      {children}
    </button>
  );
});

interface ButtonLinkProps extends LinkProps {
  variant?: Variante;
  size?: Tamano;
  icon?: ReactNode;
}

export function ButtonLink({ variant = 'primary', size = 'md', icon, className, children, ...props }: ButtonLinkProps) {
  return (
    <Link className={cn(BASE, VARIANTES[variant], TAMANOS[size], className)} {...props}>
      {icon}
      {children}
    </Link>
  );
}
