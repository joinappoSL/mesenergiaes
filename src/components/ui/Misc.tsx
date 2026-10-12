import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { iniciales } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Button } from './Button';

export function Logo({ variante = 'claro', className }: { variante?: 'claro' | 'oscuro'; className?: string }) {
  return (
    <img
      src={variante === 'oscuro' ? '/logo-dark.png' : '/logo.png'}
      alt="+Energía · Nos importa tu ahorro"
      className={cn('h-auto select-none', className)}
      draggable={false}
    />
  );
}

const COLORES_AVATAR = [
  'bg-navy-100 text-navy-800',
  'bg-brand-100 text-brand-800',
  'bg-sun-100 text-sun-700',
  'bg-orange-100 text-orange-800',
  'bg-sky-100 text-sky-800',
];

export function Avatar({ nombre, className }: { nombre: string | null | undefined; className?: string }) {
  const n = nombre ?? '';
  let hash = 0;
  for (const ch of n) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return (
    <span
      className={cn(
        'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold',
        COLORES_AVATAR[hash % COLORES_AVATAR.length],
        className,
      )}
      aria-hidden
    >
      {iniciales(n)}
    </span>
  );
}

interface PaginacionProps {
  pagina: number;
  tamano: number;
  total: number;
  onCambiar: (pagina: number) => void;
}

export function Paginacion({ pagina, tamano, total, onCambiar }: PaginacionProps) {
  const paginas = Math.max(1, Math.ceil(total / tamano));
  const desde = total === 0 ? 0 : pagina * tamano + 1;
  const hasta = Math.min(total, (pagina + 1) * tamano);
  return (
    <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 text-sm text-slate-500">
      <span>
        {desde}–{hasta} de <strong className="text-slate-700">{total}</strong>
      </span>
      <div className="flex items-center gap-1.5">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => onCambiar(pagina - 1)}
          disabled={pagina === 0}
          icon={<ChevronLeft className="h-4 w-4" />}
          aria-label="Página anterior"
        />
        <span className="min-w-[4.5rem] text-center text-xs font-medium">
          {pagina + 1} / {paginas}
        </span>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => onCambiar(pagina + 1)}
          disabled={pagina + 1 >= paginas}
          icon={<ChevronRight className="h-4 w-4" />}
          aria-label="Página siguiente"
        />
      </div>
    </div>
  );
}

interface TabsProps<T extends string> {
  value: T;
  onChange: (v: T) => void;
  tabs: { value: T; label: ReactNode; count?: number }[];
  className?: string;
}

export function Tabs<T extends string>({ value, onChange, tabs, className }: TabsProps<T>) {
  return (
    <div className={cn('inline-flex rounded-xl bg-slate-100 p-1', className)} role="tablist">
      {tabs.map((t) => (
        <button
          key={t.value}
          type="button"
          role="tab"
          aria-selected={value === t.value}
          onClick={() => onChange(t.value)}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-semibold transition',
            value === t.value ? 'bg-white text-navy-900 shadow-sm' : 'text-slate-500 hover:text-slate-800',
          )}
        >
          {t.label}
          {t.count !== undefined && (
            <span
              className={cn(
                'rounded-full px-1.5 text-[11px]',
                value === t.value ? 'bg-navy-100 text-navy-700' : 'bg-slate-200 text-slate-600',
              )}
            >
              {t.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

export function PageHeader({
  titulo,
  subtitulo,
  acciones,
  volver,
}: {
  titulo: ReactNode;
  subtitulo?: ReactNode;
  acciones?: ReactNode;
  volver?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {volver}
        <h1 className="text-2xl font-semibold tracking-tight text-navy-900 sm:text-[28px]">{titulo}</h1>
        {subtitulo && <p className="mt-1 text-sm text-slate-500">{subtitulo}</p>}
      </div>
      {acciones && <div className="flex flex-wrap items-center gap-2">{acciones}</div>}
    </div>
  );
}
