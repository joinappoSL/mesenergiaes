import { Download, FileSpreadsheet, Save } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Aviso } from '@/components/ui/Feedback';
import { Field, Input } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { useGuardarMaximetro } from '@/hooks/leads';
import {
  construirMaximetro,
  esTablaLecturas,
  esTablaPunto,
  parseLecturas,
  parsePunto,
  type Lead,
  type Maximetro,
  type PuntoSuministro,
} from '@/lib/leads';
import { leerHojas } from '@/lib/leadsExcel';
import { maximetroAPdf, urlLogoInforme } from '@/lib/leadsPdf';
import { descargarBlob, mensajeError } from '@/lib/utils';
import { InformeMaximetro } from './InformeMaximetro';

interface Props {
  lead: Lead;
  open: boolean;
  onClose: () => void;
}

export function MaximetroModal({ lead, open, onClose }: Props) {
  const guardar = useGuardarMaximetro();
  const [m, setM] = useState<Maximetro | null>(lead.maximetro);
  const [aviso, setAviso] = useState<string | null>(null);
  const [leyendo, setLeyendo] = useState(false);
  const [generando, setGenerando] = useState(false);
  const entrada = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setM(lead.maximetro);
      setAviso(null);
    }
  }, [open, lead.maximetro]);

  async function cargar(archivos: File[]) {
    if (!archivos.length) return;
    setLeyendo(true);
    setAviso(null);
    try {
      const hojas = await leerHojas(archivos);
      let lecturas: ReturnType<typeof parseLecturas> | null = null;
      let punto: PuntoSuministro | null = null;
      for (const h of hojas) {
        if (esTablaLecturas(h)) lecturas = parseLecturas(h);
        else if (esTablaPunto(h)) punto = parsePunto(h);
      }
      if (!lecturas && !m) {
        setAviso('No encuentro la tabla de lecturas (con «Fecha Lectura Inicial» y «P1 Activa»…). Sube las dos tablas de SIPS.');
        return;
      }
      if (lecturas && punto && lecturas.cups && punto.cups && lecturas.cups !== punto.cups) {
        setAviso('Ojo: los CUPS de las dos tablas no coinciden. Revisa que sean del mismo cliente.');
      }
      const nuevo = construirMaximetro(lecturas, punto, m, lead.nombre);
      if (!nuevo) return;
      setM(nuevo);
      await guardar.mutateAsync({ id: lead.id, maximetro: nuevo });
      toast.success('Maxímetro guardado en el lead');
    } catch (e) {
      setAviso(`No he podido leer los archivos: ${mensajeError(e)}`);
    } finally {
      setLeyendo(false);
      if (entrada.current) entrada.current.value = '';
    }
  }

  async function persistir(nuevo: Maximetro) {
    setM(nuevo);
    try {
      await guardar.mutateAsync({ id: lead.id, maximetro: nuevo });
    } catch (e) {
      toast.error(mensajeError(e));
    }
  }

  async function descargarPdf() {
    if (!m) return;
    setGenerando(true);
    try {
      const f = await maximetroAPdf(m);
      descargarBlob(f, f.name);
    } catch (e) {
      toast.error(`No se pudo generar el PDF: ${mensajeError(e)}`);
    } finally {
      setGenerando(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Maxímetro del cliente"
      description="Sube las 2 tablas de SIPS (lecturas y datos del punto), en .zip o .xls."
      icon={<FileSpreadsheet className="h-5 w-5" />}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cerrar</Button>
          <Button icon={<Download className="h-4 w-4" />} onClick={descargarPdf} loading={generando} disabled={!m}>
            Descargar PDF
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="rounded-xl border-2 border-dashed border-slate-200 p-4 text-center">
          <input
            ref={entrada}
            type="file"
            multiple
            accept=".xls,.xlsx,.zip,.csv"
            onChange={(e) => cargar([...(e.target.files ?? [])])}
            className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-navy-50 file:px-3 file:py-2 file:font-semibold file:text-navy-700"
          />
          {leyendo && <p className="mt-2 text-sm text-slate-500">Leyendo archivos…</p>}
        </div>
        {aviso && <Aviso tipo="warning">{aviso}</Aviso>}
        {m && (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Nombre en el informe">
                <Input value={m.nombre} onChange={(e) => setM({ ...m, nombre: e.target.value })} onBlur={() => persistir(m)} />
              </Field>
              <Field label="NIF/CIF (opcional)">
                <Input value={m.nif} onChange={(e) => setM({ ...m, nif: e.target.value })} onBlur={() => persistir(m)} />
              </Field>
            </div>
            <div className="overflow-hidden rounded-xl ring-1 ring-slate-200">
              <InformeMaximetro m={m} logoUrl={urlLogoInforme()} onCambiarOpt={(opt) => persistir({ ...m, opt })} />
            </div>
            <p className="flex items-center gap-1.5 text-xs text-slate-500">
              <Save className="h-3.5 w-3.5" /> Los cambios se guardan solos en el lead.
            </p>
          </>
        )}
      </div>
    </Modal>
  );
}
