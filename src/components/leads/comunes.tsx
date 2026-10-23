import { Badge } from '@/components/ui/Badge';
import { ESTADOS_LEAD, type EstadoLead } from '@/lib/leads';

export function EstadoLeadBadge({ estado }: { estado: EstadoLead }) {
  return <Badge className={ESTADOS_LEAD[estado].clase}>{ESTADOS_LEAD[estado].etiqueta}</Badge>;
}

/** Teléfono sin espacios para el enlace tel: */
export const enlaceTel = (t: string) => `tel:${t.replace(/[^\d+]/g, '')}`;
