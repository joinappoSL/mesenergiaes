import { FileText, UploadCloud, X } from 'lucide-react';
import { useRef, useState, type DragEvent } from 'react';
import { validarPdf } from '@/hooks/mutaciones';
import { tamanoArchivo } from '@/lib/format';
import { cn } from '@/lib/utils';

interface Props {
  archivo: File | null;
  onChange: (archivo: File | null) => void;
  texto?: string;
  disabled?: boolean;
}

export function PdfDropzone({ archivo, onChange, texto = 'Arrastra aquí el PDF de la oferta o pulsa para elegirlo', disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [encima, setEncima] = useState(false);

  function elegir(file: File | undefined | null) {
    if (!file) return;
    const problema = validarPdf(file);
    if (problema) {
      setError(problema);
      return;
    }
    setError(null);
    onChange(file);
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setEncima(false);
    if (!disabled) elegir(e.dataTransfer.files?.[0]);
  }

  if (archivo) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-brand-200 bg-brand-50/60 px-4 py-3 animate-fade-in">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-red-600 ring-1 ring-brand-200">
          <FileText className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-800">{archivo.name}</p>
          <p className="text-xs text-slate-500">{tamanoArchivo(archivo.size)} · se subirá al guardar</p>
        </div>
        <button
          type="button"
          onClick={() => onChange(null)}
          className="rounded-lg p-2 text-slate-400 hover:bg-white hover:text-red-600"
          aria-label="Quitar PDF"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        onClick={() => !disabled && inputRef.current?.click()}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setEncima(true);
        }}
        onDragLeave={() => setEncima(false)}
        onDrop={onDrop}
        className={cn(
          'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-4 py-7 text-center transition',
          encima ? 'border-brand-500 bg-brand-50' : 'border-slate-200 bg-slate-50/60 hover:border-brand-400 hover:bg-brand-50/40',
          disabled && 'pointer-events-none opacity-50',
        )}
      >
        <UploadCloud className={cn('h-8 w-8', encima ? 'text-brand-600' : 'text-slate-400')} />
        <p className="text-sm font-medium text-slate-700">{texto}</p>
        <p className="text-xs text-slate-400">Solo PDF · máximo 10 MB</p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={(e) => {
          elegir(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      {error && <p className="mt-1.5 text-xs font-medium text-red-600">{error}</p>}
    </div>
  );
}
