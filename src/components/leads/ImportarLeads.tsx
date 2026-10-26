import { Upload } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { usePerfil } from '@/auth/AuthProvider';
import { Button } from '@/components/ui/Button';
import { Aviso } from '@/components/ui/Feedback';
import { Field, Input, Select } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { useImportarLeads } from '@/hooks/leads';
import {
  detectarColumnas,
  ETIQUETA_COLUMNA,
  filasALeads,
  moduloDesdeNombre,
  separarCabecera,
  type MapaColumnas,
  type RolColumna,
} from '@/lib/leads';
import { leerHojas } from '@/lib/leadsExcel';
import { mensajeError } from '@/lib/utils';

interface Props {
  open: boolean;
  onClose: () => void;
  /** personas a las que se puede asignar la cartera (solo gestores) */
  propietarios?: { id: string; nombre: string }[];
  /** módulos ya cargados, para sugerirlos */
  modulos?: string[];
  /** módulo filtrado ahora, por si se quiere añadir más a ese módulo */
  moduloActual?: string;
}

export function ImportarLeads({ open, onClose, propietarios, modulos = [], moduloActual }: Props) {
  const perfil = usePerfil();
  const importar = useImportarLeads();
  const [archivo, setArchivo] = useState<{ cabeceras: string[]; filas: string[][]; nombre: string } | null>(null);
  const [mapa, setMapa] = useState<MapaColumnas>({});
  const [propietarioId, setPropietarioId] = useState(perfil.id);
  const [modulo, setModulo] = useState('');
  const [error, setError] = useState<string | null>(null);

  function cerrar() {
    setArchivo(null);
    setMapa({});
    setModulo('');
    setError(null);
    onClose();
  }

  async function leer(f: File | undefined) {
    if (!f) return;
    setError(null);
    try {
      const [hoja] = await leerHojas([f]);
      const { cabeceras, filas } = separarCabecera(hoja ?? []);
      if (!filas.length) throw new Error('El archivo no tiene filas con datos.');
      setArchivo({ cabeceras, filas, nombre: f.name });
      setMapa(detectarColumnas(cabeceras));
      // «08017.xlsx» o «leads 08017.xlsx» proponen el módulo 08017
      setModulo((m) => m || moduloDesdeNombre(f.name) || moduloActual || '');
    } catch (e) {
      setArchivo(null);
      setError(mensajeError(e));
    }
  }

  async function importarAhora() {
    if (!archivo) return;
    try {
      const leads = filasALeads(archivo.cabeceras, archivo.filas, mapa, modulo);
      const r = await importar.mutateAsync({ propietarioId, leads });
      toast.success(`${r.nuevos} leads importados${modulo.trim() ? ` en el módulo ${modulo.trim()}` : ''}${r.repetidos ? ` · ${r.repetidos} repetidos (mismo teléfono) omitidos` : ''}`);
      cerrar();
    } catch (e) {
      toast.error(mensajeError(e));
    }
  }

  return (
    <Modal
      open={open}
      onClose={cerrar}
      size="lg"
      title="Importar leads desde Excel"
      description="Se detectan las columnas por su cabecera, aunque cambie el orden. Revisa y corrige si hace falta."
      icon={<Upload className="h-5 w-5" />}
      footer={
        <>
          <Button variant="secondary" onClick={cerrar}>Cancelar</Button>
          <Button onClick={importarAhora} disabled={!archivo || mapa.tel1 === undefined && mapa.tel2 === undefined && mapa.nombre === undefined} loading={importar.isPending}>
            {archivo ? `Importar ${archivo.filas.length} filas` : 'Importar'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <input
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={(e) => leer(e.target.files?.[0])}
          className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-navy-50 file:px-3 file:py-2 file:font-semibold file:text-navy-700"
        />
        {error && <Aviso tipo="danger">{error}</Aviso>}
        {propietarios && propietarios.length > 0 && (
          <Field label="Cartera de">
            <Select value={propietarioId} onChange={(e) => setPropietarioId(e.target.value)}>
              <option value={perfil.id}>Yo</option>
              {propietarios.filter((p) => p.id !== perfil.id).map((p) => (
                <option key={p.id} value={p.id}>{p.nombre}</option>
              ))}
            </Select>
          </Field>
        )}
        {archivo && (
          <>
            <Field label="Módulo de este listado" hint="Para distinguir cada carga (por ejemplo el código postal 08017 o 08022). Puedes dejarlo vacío.">
              <Input value={modulo} placeholder="08017" list="modulos-importar" onChange={(e) => setModulo(e.target.value)} />
            </Field>
            <datalist id="modulos-importar">
              {modulos.map((m) => <option key={m} value={m} />)}
            </datalist>
            <p className="text-sm text-slate-600">
              <b>{archivo.nombre}</b> · {archivo.filas.length} filas · {archivo.cabeceras.length} columnas
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {(Object.keys(ETIQUETA_COLUMNA) as RolColumna[]).map((rol) => (
                <Field key={rol} label={ETIQUETA_COLUMNA[rol]}>
                  <Select
                    value={mapa[rol] ?? ''}
                    onChange={(e) => setMapa({ ...mapa, [rol]: e.target.value === '' ? undefined : Number(e.target.value) })}
                  >
                    <option value="">— ninguna —</option>
                    {archivo.cabeceras.map((h, i) => <option key={i} value={i}>{h}</option>)}
                  </Select>
                </Field>
              ))}
            </div>
            <Aviso tipo="info">
              Los teléfonos que ya estén en la cartera no se duplican. El resto de columnas del Excel se guardan como datos extra del lead.
            </Aviso>
          </>
        )}
      </div>
    </Modal>
  );
}
