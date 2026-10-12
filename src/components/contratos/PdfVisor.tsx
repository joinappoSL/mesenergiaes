import { Download, ExternalLink, FileText, History, UploadCloud } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { EmptyState, Spinner } from '@/components/ui/Feedback';
import { Modal } from '@/components/ui/Modal';
import { useDocumentos, useUrlFirmada } from '@/hooks/datos';
import { useSubirPdf } from '@/hooks/mutaciones';
import { fechaHoraCorta, tamanoArchivo } from '@/lib/format';
import type { Documento } from '@/lib/types';
import { cn, mensajeError } from '@/lib/utils';
import { PdfDropzone } from './PdfDropzone';

function BotonesDocumento({ doc }: { doc: Documento }) {
  const ver = useUrlFirmada(doc.storage_path);
  const descargar = useUrlFirmada(doc.storage_path, doc.nombre_archivo);
  return (
    <div className="flex gap-2">
      <Button
        variant="secondary"
        size="sm"
        icon={<ExternalLink className="h-3.5 w-3.5" />}
        disabled={!ver.data}
        onClick={() => ver.data && window.open(ver.data, '_blank', 'noopener')}
      >
        Abrir
      </Button>
      <Button
        variant="secondary"
        size="sm"
        icon={<Download className="h-3.5 w-3.5" />}
        disabled={!descargar.data}
        onClick={() => descargar.data && (window.location.href = descargar.data)}
      >
        Descargar
      </Button>
    </div>
  );
}

export function PdfVisor({ contratoId, puedeSubir }: { contratoId: string; puedeSubir: boolean }) {
  const documentos = useDocumentos(contratoId);
  const [seleccionadoId, setSeleccionadoId] = useState<string | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [archivo, setArchivo] = useState<File | null>(null);
  const subir = useSubirPdf();

  const docs = documentos.data ?? [];
  const actual = docs.find((d) => d.id === seleccionadoId) ?? docs[0];
  const url = useUrlFirmada(actual?.storage_path);

  useEffect(() => {
    // Al subir una nueva versión, se muestra la más reciente.
    setSeleccionadoId(null);
  }, [docs.length]);

  async function confirmarSubida() {
    if (!archivo) return;
    try {
      await subir.mutateAsync({ contratoId, file: archivo });
      toast.success('Nueva versión del PDF subida');
      setArchivo(null);
      setSubiendo(false);
    } catch (e) {
      toast.error(mensajeError(e));
    }
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader
        title="PDF de la oferta"
        icon={<FileText className="h-4 w-4" />}
        subtitle={actual ? `v${actual.version} · ${actual.nombre_archivo}` : 'Sin documento'}
        actions={
          puedeSubir && (
            <Button variant="soft" size="sm" icon={<UploadCloud className="h-4 w-4" />} onClick={() => setSubiendo(true)}>
              <span className="hidden sm:inline">{docs.length ? 'Nueva versión' : 'Subir PDF'}</span>
            </Button>
          )
        }
      />

      {documentos.isLoading ? (
        <div className="flex h-40 items-center justify-center">
          <Spinner />
        </div>
      ) : !actual ? (
        <EmptyState
          icon={<FileText className="h-6 w-6" />}
          titulo="Aún no hay PDF"
          texto={puedeSubir ? 'Sube la oferta que se ha enviado al cliente.' : 'El comercial todavía no ha adjuntado la oferta.'}
          accion={
            puedeSubir && (
              <Button variant="primary" size="sm" icon={<UploadCloud className="h-4 w-4" />} onClick={() => setSubiendo(true)}>
                Subir PDF
              </Button>
            )
          }
        />
      ) : (
        <>
          <div className="relative hidden h-[560px] bg-slate-100 md:block">
            {url.data ? (
              <iframe key={url.data} src={`${url.data}#view=FitH`} title="PDF de la oferta" className="h-full w-full" />
            ) : (
              <div className="flex h-full items-center justify-center">
                <Spinner />
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-3">
            <p className="text-xs text-slate-500">
              Subido {fechaHoraCorta(actual.created_at)}
              {actual.subido_por_nombre ? ` por ${actual.subido_por_nombre}` : ''} {tamanoArchivo(actual.tamano_bytes) && `· ${tamanoArchivo(actual.tamano_bytes)}`}
            </p>
            <BotonesDocumento doc={actual} />
          </div>
          {docs.length > 1 && (
            <div className="border-t border-slate-100 px-5 py-3">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
                <History className="h-3.5 w-3.5" /> Versiones
              </p>
              <div className="flex flex-wrap gap-2">
                {docs.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => setSeleccionadoId(d.id)}
                    className={cn(
                      'rounded-lg px-2.5 py-1.5 text-left text-xs ring-1 transition',
                      d.id === actual.id
                        ? 'bg-navy-900 text-white ring-navy-900'
                        : 'bg-white text-slate-600 ring-slate-200 hover:ring-navy-300',
                    )}
                  >
                    <span className="font-semibold">v{d.version}</span> · {fechaHoraCorta(d.created_at)}
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <Modal
        open={subiendo}
        onClose={() => {
          setSubiendo(false);
          setArchivo(null);
        }}
        title={docs.length ? 'Subir nueva versión' : 'Subir PDF de la oferta'}
        description="Las versiones anteriores se conservan."
        icon={<UploadCloud className="h-5 w-5" />}
        footer={
          <>
            <Button variant="secondary" onClick={() => setSubiendo(false)}>
              Cancelar
            </Button>
            <Button onClick={confirmarSubida} disabled={!archivo} loading={subir.isPending}>
              Subir PDF
            </Button>
          </>
        }
      >
        <PdfDropzone archivo={archivo} onChange={setArchivo} />
      </Modal>
    </Card>
  );
}
