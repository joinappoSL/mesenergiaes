import { Compass } from 'lucide-react';
import { ButtonLink } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/Feedback';

export function NoEncontradoPage() {
  return (
    <EmptyState
      icon={<Compass className="h-6 w-6" />}
      titulo="Esta página no existe"
      texto="Puede que el enlace esté mal o que ya no tengas acceso."
      accion={<ButtonLink to="/">Volver al inicio</ButtonLink>}
      className="min-h-[50vh]"
    />
  );
}
