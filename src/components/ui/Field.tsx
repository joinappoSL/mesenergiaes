import { AlertCircle } from 'lucide-react';
import {
  createContext,
  forwardRef,
  useContext,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { cn } from '@/lib/utils';

interface FieldProps {
  label?: ReactNode;
  required?: boolean;
  error?: string;
  hint?: ReactNode;
  htmlFor?: string;
  className?: string;
  children: ReactNode;
}

/** Enlaza la etiqueta y el error de un Field con su control (accesibilidad). */
const FieldContext = createContext<{ id: string; errorId?: string; required?: boolean } | null>(null);

function useCampo(id: string | undefined, describedBy: string | undefined) {
  const ctx = useContext(FieldContext);
  return {
    id: id ?? ctx?.id,
    'aria-describedby': describedBy ?? ctx?.errorId,
    'aria-required': ctx?.required || undefined,
  };
}

export function Field({ label, required, error, hint, htmlFor, className, children }: FieldProps) {
  const autoId = useId();
  const id = htmlFor ?? autoId;
  const errorId = error ? `${id}-error` : undefined;
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label && (
        <label htmlFor={id} className="text-[13px] font-semibold text-slate-700">
          {label}
          {required && (
            <span aria-hidden className="ml-0.5 text-red-500">
              *
            </span>
          )}
        </label>
      )}
      <FieldContext.Provider value={{ id, errorId, required }}>{children}</FieldContext.Provider>
      {error ? (
        <p id={errorId} className="flex items-center gap-1 text-xs font-medium text-red-600 animate-fade-in" role="alert">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-slate-500">{hint}</p>
      ) : null}
    </div>
  );
}

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
  icon?: ReactNode;
  suffix?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { invalid, icon, suffix, className, id, 'aria-describedby': describedBy, ...props },
  ref,
) {
  const campo = useCampo(id, describedBy);
  if (!icon && !suffix) {
    return <input ref={ref} {...campo} className={cn('input-base', invalid && 'input-error', className)} {...props} />;
  }
  return (
    <div className="relative">
      {icon && (
        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400">{icon}</span>
      )}
      <input
        ref={ref}
        {...campo}
        className={cn('input-base', icon && 'pl-10', suffix && 'pr-10', invalid && 'input-error', className)}
        {...props}
      />
      {suffix && <span className="absolute inset-y-0 right-3 flex items-center">{suffix}</span>}
    </div>
  );
});

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { invalid, className, children, id, 'aria-describedby': describedBy, ...props },
  ref,
) {
  const campo = useCampo(id, describedBy);
  return (
    <select
      ref={ref}
      {...campo}
      className={cn(
        'input-base cursor-pointer appearance-none bg-[url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2020%2020%22%20fill%3D%22%2364748b%22%3E%3Cpath%20fill-rule%3D%22evenodd%22%20d%3D%22M5.23%207.21a.75.75%200%20011.06.02L10%2011.168l3.71-3.938a.75.75%200%20111.08%201.04l-4.25%204.5a.75.75%200%2001-1.08%200l-4.25-4.5a.75.75%200%2001.02-1.06z%22%20clip-rule%3D%22evenodd%22%2F%3E%3C%2Fsvg%3E")] bg-[length:1.25rem] bg-[right_0.6rem_center] bg-no-repeat pr-9',
        invalid && 'input-error',
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
});

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { invalid, className, id, 'aria-describedby': describedBy, ...props },
  ref,
) {
  const campo = useCampo(id, describedBy);
  return (
    <textarea
      ref={ref}
      {...campo}
      className={cn('input-base min-h-[96px] resize-y leading-relaxed', invalid && 'input-error', className)}
      {...props}
    />
  );
});

interface SwitchProps {
  checked: boolean;
  onChange: (valor: boolean) => void;
  label?: ReactNode;
  disabled?: boolean;
  id?: string;
}

export function Switch({ checked, onChange, label, disabled, id }: SwitchProps) {
  return (
    <label className={cn('inline-flex cursor-pointer items-center gap-2.5', disabled && 'cursor-not-allowed opacity-60')}>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-500/20',
          checked ? 'bg-brand-600' : 'bg-slate-300',
        )}
      >
        <span
          className={cn(
            'inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform',
            checked ? 'translate-x-[22px]' : 'translate-x-0.5',
          )}
        />
      </button>
      {label && <span className="text-sm font-medium text-slate-700">{label}</span>}
    </label>
  );
}
