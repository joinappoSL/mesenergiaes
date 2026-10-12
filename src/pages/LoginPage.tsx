import { ArrowLeft, Eye, EyeOff, Lock, Mail, ShieldCheck, Zap } from 'lucide-react';
import { useState, type FormEvent, type ReactNode } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Aviso } from '@/components/ui/Feedback';
import { Field, Input } from '@/components/ui/Field';
import { Logo } from '@/components/ui/Misc';
import { supabase } from '@/lib/supabase';
import { esEmailValido } from '@/lib/validators';
import { mensajeError } from '@/lib/utils';

/** Fondo corporativo a pantalla partida, reutilizado por login y contraseñas. */
export function PantallaAuth({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh bg-white">
      <div className="relative hidden w-[46%] overflow-hidden bg-navy-950 lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-24 top-1/4 h-[28rem] w-[28rem] rounded-full bg-brand-500/20 blur-3xl" />
          <div className="absolute -right-16 -top-16 h-80 w-80 rounded-full bg-sun-400/20 blur-3xl" />
          <div className="absolute bottom-0 right-0 h-96 w-96 translate-x-1/3 translate-y-1/3 rounded-full bg-navy-500/30 blur-3xl" />
          <svg className="absolute bottom-0 left-0 w-full opacity-60" viewBox="0 0 600 200" preserveAspectRatio="none" aria-hidden>
            <path d="M0 150 C 150 60, 350 220, 600 90 L600 200 L0 200 Z" fill="url(#g1)" />
            <path d="M0 175 C 200 110, 380 230, 600 140 L600 200 L0 200 Z" fill="url(#g2)" />
            <defs>
              <linearGradient id="g1" x1="0" x2="1">
                <stop offset="0" stopColor="#6ca83c" stopOpacity="0.35" />
                <stop offset="1" stopColor="#36538f" stopOpacity="0.35" />
              </linearGradient>
              <linearGradient id="g2" x1="0" x2="1">
                <stop offset="0" stopColor="#f5c030" stopOpacity="0.25" />
                <stop offset="1" stopColor="#6ca83c" stopOpacity="0.25" />
              </linearGradient>
            </defs>
          </svg>
        </div>
        <div className="relative">
          <Logo variante="oscuro" className="w-64" />
        </div>
        <div className="relative max-w-md">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-sun-400">
            <Zap className="h-3.5 w-3.5" /> MESENERGIA CRM
          </p>
          <h2 className="mt-4 text-4xl font-semibold leading-tight text-white">
            Cada contrato,
            <br />
            <span className="text-brand-400">bajo control.</span>
          </h2>
          <p className="mt-4 text-base leading-relaxed text-navy-200">
            Sube las ventas, sigue su tramitación con la operadora y consulta en tiempo real cómo va tu equipo.
          </p>
        </div>
        <p className="relative flex items-center gap-2 text-xs text-navy-300">
          <ShieldCheck className="h-4 w-4" /> Acceso restringido al personal de MESENERGIA
        </p>
      </div>

      <div className="flex flex-1 items-center justify-center bg-surface px-5 py-10 lg:bg-white">
        <div className="w-full max-w-sm animate-slide-up">
          <div className="mb-8 lg:hidden">
            <Logo className="mx-auto w-56" />
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

export function LoginPage() {
  const [modo, setModo] = useState<'login' | 'recuperar'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [verPassword, setVerPassword] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enviado, setEnviado] = useState(false);

  async function entrar(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!esEmailValido(email)) return setError('Introduce un email válido.');
    if (!password) return setError('Introduce tu contraseña.');
    setEnviando(true);
    const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setEnviando(false);
    if (err) setError(mensajeError(err));
  }

  async function recuperar(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!esEmailValido(email)) return setError('Introduce un email válido.');
    setEnviando(true);
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/restablecer`,
    });
    setEnviando(false);
    if (err) return setError(mensajeError(err));
    setEnviado(true);
    toast.success('Te hemos enviado un email para restablecer la contraseña');
  }

  return (
    <PantallaAuth>
      <div className="rounded-3xl bg-white p-7 shadow-card ring-1 ring-slate-200/70 lg:p-0 lg:shadow-none lg:ring-0">
        {modo === 'login' ? (
          <>
            <h1 className="text-2xl font-semibold text-navy-900">Hola de nuevo 👋</h1>
            <p className="mt-1 text-sm text-slate-500">Accede con tu email y contraseña.</p>
            <form onSubmit={entrar} className="mt-7 space-y-4" noValidate>
              <Field label="Email" htmlFor="email">
                <Input
                  id="email"
                  type="email"
                  autoComplete="username"
                  inputMode="email"
                  placeholder="nombre@mesenergia.es"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  icon={<Mail className="h-4 w-4" />}
                />
              </Field>
              <Field label="Contraseña" htmlFor="password">
                <Input
                  id="password"
                  type={verPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  icon={<Lock className="h-4 w-4" />}
                  suffix={
                    <button
                      type="button"
                      onClick={() => setVerPassword((v) => !v)}
                      className="text-slate-400 hover:text-slate-700"
                      aria-label={verPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    >
                      {verPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  }
                />
              </Field>
              {error && <Aviso tipo="danger">{error}</Aviso>}
              <Button type="submit" size="lg" className="w-full" loading={enviando}>
                Entrar
              </Button>
            </form>
            <button
              type="button"
              onClick={() => {
                setModo('recuperar');
                setError(null);
              }}
              className="mt-5 w-full text-center text-sm font-semibold text-navy-600 hover:text-navy-900"
            >
              ¿Has olvidado tu contraseña?
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => {
                setModo('login');
                setError(null);
                setEnviado(false);
              }}
              className="mb-5 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-navy-900"
            >
              <ArrowLeft className="h-4 w-4" /> Volver
            </button>
            <h1 className="text-2xl font-semibold text-navy-900">Recuperar contraseña</h1>
            <p className="mt-1 text-sm text-slate-500">
              Te enviaremos un enlace para crear una nueva contraseña.
            </p>
            {enviado ? (
              <Aviso tipo="success" className="mt-6" titulo="Revisa tu correo">
                Si el email existe en MESENERGIA CRM, recibirás un enlace en unos minutos. Revisa también la carpeta de spam.
              </Aviso>
            ) : (
              <form onSubmit={recuperar} className="mt-7 space-y-4" noValidate>
                <Field label="Email" htmlFor="email-rec">
                  <Input
                    id="email-rec"
                    type="email"
                    autoComplete="username"
                    inputMode="email"
                    placeholder="nombre@mesenergia.es"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    icon={<Mail className="h-4 w-4" />}
                  />
                </Field>
                {error && <Aviso tipo="danger">{error}</Aviso>}
                <Button type="submit" size="lg" className="w-full" loading={enviando}>
                  Enviar enlace
                </Button>
              </form>
            )}
          </>
        )}
      </div>
      <p className="mt-8 text-center text-xs text-slate-400">+Energía · Nos importa tu ahorro</p>
    </PantallaAuth>
  );
}
