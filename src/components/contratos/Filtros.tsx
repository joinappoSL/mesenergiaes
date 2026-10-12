import { FilterX, Search, SlidersHorizontal, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { usePermisos } from '@/auth/permisos';
import { Card } from '@/components/ui/Card';
import { Input, Select } from '@/components/ui/Field';
import { FILTROS_VACIOS, useEquipos, usePerfiles, type FiltrosContratos } from '@/hooks/datos';
import { ESTADOS, LISTA_ESTADOS } from '@/lib/constants';
import { nombreCompleto } from '@/lib/format';
import { cn } from '@/lib/utils';

interface Props {
  filtros: FiltrosContratos;
  onChange: (f: FiltrosContratos) => void;
}

export function FiltrosContratosBarra({ filtros, onChange }: Props) {
  const p = usePermisos();
  const perfiles = usePerfiles();
  const equipos = useEquipos();
  const [texto, setTexto] = useState(filtros.q);
  const [abiertos, setAbiertos] = useState(false);

  // Búsqueda con espera para no lanzar una consulta por tecla.
  useEffect(() => {
    if (texto === filtros.q) return;
    const t = window.setTimeout(() => onChange({ ...filtros, q: texto }), 350);
    return () => window.clearTimeout(t);
  }, [texto, filtros, onChange]);

  useEffect(() => {
    if (filtros.q === '' && texto !== '') setTexto('');
    // solo al limpiar filtros desde fuera
  }, [filtros.q]);

  const comerciales = useMemo(
    () =>
      (perfiles.data ?? []).filter(
        (u) => u.rol === 'comercial' && (!filtros.equipoId || u.equipo_id === filtros.equipoId),
      ),
    [perfiles.data, filtros.equipoId],
  );

  const activos =
    filtros.estados.length +
    (filtros.firmado ? 1 : 0) +
    (filtros.comercialId ? 1 : 0) +
    (filtros.equipoId ? 1 : 0) +
    (filtros.desde ? 1 : 0) +
    (filtros.hasta ? 1 : 0);

  const set = <K extends keyof FiltrosContratos>(k: K, v: FiltrosContratos[K]) => onChange({ ...filtros, [k]: v });

  function alternarEstado(e: (typeof LISTA_ESTADOS)[number]) {
    set('estados', filtros.estados.includes(e) ? filtros.estados.filter((x) => x !== e) : [...filtros.estados, e]);
  }

  return (
    <Card className="p-3 sm:p-4">
      <div className="flex gap-2">
        <div className="flex-1">
          <Input
            type="search"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Buscar por nombre, apellidos, DNI/NIE o teléfono…"
            icon={<Search className="h-4 w-4" />}
            suffix={
              texto ? (
                <button type="button" onClick={() => setTexto('')} className="text-slate-400 hover:text-slate-700" aria-label="Borrar búsqueda">
                  <X className="h-4 w-4" />
                </button>
              ) : null
            }
            aria-label="Buscar contratos"
          />
        </div>
        <button
          type="button"
          onClick={() => setAbiertos((v) => !v)}
          className={cn(
            'relative inline-flex h-[46px] items-center gap-2 rounded-xl px-3.5 text-sm font-semibold ring-1 transition lg:hidden',
            abiertos ? 'bg-navy-900 text-white ring-navy-900' : 'bg-white text-slate-700 ring-slate-200',
          )}
          aria-expanded={abiertos}
        >
          <SlidersHorizontal className="h-4 w-4" />
          <span className="hidden sm:inline">Filtros</span>
          {activos > 0 && (
            <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-sun-400 px-1 text-[11px] font-bold text-navy-950">
              {activos}
            </span>
          )}
        </button>
      </div>

      <div className={cn('mt-3 space-y-3', !abiertos && 'hidden lg:block')}>
        <div className="flex flex-wrap items-center gap-2">
          {LISTA_ESTADOS.map((e) => {
            const activo = filtros.estados.includes(e);
            return (
              <button
                key={e}
                type="button"
                onClick={() => alternarEstado(e)}
                aria-pressed={activo}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-semibold ring-1 ring-inset transition',
                  activo ? ESTADOS[e].badge : 'bg-white text-slate-500 ring-slate-200 hover:text-slate-800',
                )}
              >
                <span className={cn('h-2 w-2 rounded-full', ESTADOS[e].punto, !activo && 'opacity-50')} />
                {ESTADOS[e].etiqueta}
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-2 gap-2 text-sm md:grid-cols-3 xl:grid-cols-6 [&_select]:text-sm">
          <Select value={filtros.firmado} onChange={(e) => set('firmado', e.target.value as FiltrosContratos['firmado'])} aria-label="Firma">
            <option value="">Firma: todos</option>
            <option value="si">Firmados</option>
            <option value="no">Sin firmar</option>
          </Select>
          {p.esGestor && (
            <Select
              value={filtros.equipoId}
              onChange={(e) => onChange({ ...filtros, equipoId: e.target.value, comercialId: '' })}
              aria-label="Equipo"
            >
              <option value="">Equipo: todos</option>
              {(equipos.data ?? []).map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nombre}
                </option>
              ))}
            </Select>
          )}
          {!p.esComercial && (
            <Select value={filtros.comercialId} onChange={(e) => set('comercialId', e.target.value)} aria-label="Comercial">
              <option value="">Comercial: todos</option>
              {comerciales.map((u) => (
                <option key={u.id} value={u.id}>
                  {nombreCompleto(u)}
                  {!u.activo ? ' (inactivo)' : ''}
                </option>
              ))}
            </Select>
          )}
          <label className="relative">
            <span className="pointer-events-none absolute left-3.5 top-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              Alta desde
            </span>
            <Input type="date" value={filtros.desde} onChange={(e) => set('desde', e.target.value)} className="pb-1.5 pt-4 text-sm" />
          </label>
          <label className="relative">
            <span className="pointer-events-none absolute left-3.5 top-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              Alta hasta
            </span>
            <Input type="date" value={filtros.hasta} onChange={(e) => set('hasta', e.target.value)} className="pb-1.5 pt-4 text-sm" />
          </label>
          {(activos > 0 || filtros.q) && (
            <button
              type="button"
              onClick={() => {
                setTexto('');
                onChange(FILTROS_VACIOS);
              }}
              className="inline-flex h-[46px] items-center justify-center gap-1.5 rounded-xl text-sm font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            >
              <FilterX className="h-4 w-4" /> Limpiar
            </button>
          )}
        </div>
      </div>
    </Card>
  );
}
