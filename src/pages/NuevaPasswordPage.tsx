import { KeyRound, Lock } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '@/auth/AuthProvider';
import { Button } from '@/components/ui/Button';
import { Aviso } from '@/components/ui/Feedback';
import { Field, Input } from '@/components/ui/Field';
import { supabase } from '@/lib/supabase';
import { mensajeError } from '@/lib/utils';
import { PantallaAuth } from './LoginPage';

/**
 * Se usa en dos casos:
 *  · "recuperacion": el usuario llega desde el email de recuperar contraseña.
 *  · "obligatorio": primer acceso con contraseña temporal (debe cambiarla).
 */
export function NuevaPasswordPage({ motivo }: { motivo: 'recuperacion' | 'obligatorio' }) {
  const { session, recargarPerfil, terminarRecuperacion, cerrarSesion } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [repetir, setRepetir] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function guardar(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) return setError('La contraseña debe tener al menos 8 caracteres.');
    if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return setError('Usa letras y números.');
    if (password !== repetir) return setError('Las contraseñas no coinciden.');
    setEnviando(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    if (err) {
      setEnviando(false);
      return setError(mensajeError(err));
    }
    await supabase.rpc('marcar_password_cambiada');
    await recargarPerfil();
    terminarRecuperacion();
    setEnviando(false);
    toast.success('Contraseña actualizada');
    navigate('/', { replace: true });
  }

  if (!session) {
    return (
      <PantallaAuth>
        <Aviso tipo="warning" titulo="Enlace no válido o caducado">
          Vuelve a solicitar el email de recuperación desde la pantalla de acceso.
        </Aviso>
        <Button className="mt-5 w-full" variant="secondary" onClick={() => navigate('/login', { replace: true })}>
          Ir al acceso
        </Button>
      </PantallaAuth>
    );
  }

  return (
    <PantallaAuth>
      <div className="rounded-3xl bg-white p-7 shadow-card ring-1 ring-slate-200/70 lg:p-0 lg:shadow-none lg:ring-0">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sun-100 text-sun-700">
          <KeyRound className="h-6 w-6" />
        </span>
        <h1 className="mt-5 text-2xl font-semibold text-navy-900">
          {motivo === 'obligatorio' ? 'Crea tu contraseña' : 'Nueva contraseña'}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {motivo === 'obligatorio'
            ? 'Estás usando una contraseña temporal. Elige una nueva para continuar.'
            : 'Escribe tu nueva contraseña para acceder al CRM.'}
        </p>
        <form onSubmit={guardar} className="mt-7 space-y-4" noValidate>
          <Field label="Nueva contraseña" hint="Mínimo 8 caracteres, con letras y números." htmlFor="np">
            <Input
              id="np"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              icon={<Lock className="h-4 w-4" />}
            />
          </Field>
          <Field label="Repite la contraseña" htmlFor="np2">
            <Input
              id="np2"
              type="password"
              autoComplete="new-password"
              value={repetir}
              onChange={(e) => setRepetir(e.target.value)}
              icon={<Lock className="h-4 w-4" />}
            />
          </Field>
          {error && <Aviso tipo="danger">{error}</Aviso>}
          <Button type="submit" size="lg" className="w-full" loading={enviando}>
            Guardar contraseña
          </Button>
        </form>
        <button
          type="button"
          onClick={cerrarSesion}
          className="mt-5 w-full text-center text-sm font-semibold text-slate-500 hover:text-navy-900"
        >
          Cerrar sesión
        </button>
      </div>
    </PantallaAuth>
  );
}
