import { addDays, addHours, format, setHours, setMinutes, startOfHour } from 'date-fns';
import { AlarmClock } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { textoHoraLlamada } from '@/lib/leads';

interface Props {
  open: boolean;
  nombre: string;
  cargando?: boolean;
  onClose: () => void;
  onConfirmar: (cuando: Date) => void;
}

const FORMATO = "yyyy-MM-dd'T'HH:mm";

function atajos(ahora: Date): { etiqueta: string; fecha: Date }[] {
  const base = startOfHour(addHours(ahora, 1));
  const lista = [
    { etiqueta: 'En 1 hora', fecha: base },
    { etiqueta: 'En 2 horas', fecha: addHours(base, 1) },
  ];
  const tarde = setMinutes(setHours(ahora, 16), 0);
  if (tarde.getTime() > ahora.getTime() + 30 * 60_000) lista.push({ etiqueta: 'Hoy a las 16:00', fecha: tarde });
  lista.push({ etiqueta: 'Mañana a las 10:00', fecha: setMinutes(setHours(addDays(ahora, 1), 10), 0) });
  return lista;
}

export function ProgramarLlamada({ open, nombre, cargando, onClose, onConfirmar }: Props) {
  const [valor, setValor] = useState('');

  useEffect(() => {
    if (open) setValor(format(startOfHour(addHours(new Date(), 1)), FORMATO));
  }, [open]);

  const fecha = valor ? new Date(valor) : null;
  const valida = fecha !== null && !Number.isNaN(fecha.getTime());

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title="Llamar más tarde"
      description={nombre || undefined}
      icon={<AlarmClock className="h-5 w-5" />}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button disabled={!valida} loading={cargando} onClick={() => valida && onConfirmar(fecha!)}>
            Programar llamada
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {atajos(new Date()).map((a) => (
            <Button key={a.etiqueta} size="sm" variant="soft" onClick={() => setValor(format(a.fecha, FORMATO))}>
              {a.etiqueta}
            </Button>
          ))}
        </div>
        <Field label="Día y hora" hint={valida ? `Se le volverá a llamar ${textoHoraLlamada(fecha!.toISOString())}.` : undefined}>
          <Input type="datetime-local" step={300} value={valor} onChange={(e) => setValor(e.target.value)} data-autofocus />
        </Field>
      </div>
    </Modal>
  );
}
