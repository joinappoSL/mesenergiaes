import { LogOut, ShieldOff } from 'lucide-react';
import { lazy, type ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from '@/auth/AuthProvider';
import { calcularPermisos, type Permisos } from '@/auth/permisos';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/Button';
import { Aviso, PageLoader } from '@/components/ui/Feedback';
import { supabaseConfigurado } from '@/lib/supabase';
import { LoginPage, PantallaAuth } from '@/pages/LoginPage';
import { NoEncontradoPage } from '@/pages/NoEncontradoPage';
import { NuevaPasswordPage } from '@/pages/NuevaPasswordPage';

// Cada pantalla se descarga al visitarla (los gráficos y el Kanban pesan).
const DashboardPage = lazy(() => import('@/pages/DashboardPage').then((m) => ({ default: m.DashboardPage })));
const ContratosPage = lazy(() => import('@/pages/ContratosPage').then((m) => ({ default: m.ContratosPage })));
const ContratoFormPage = lazy(() => import('@/pages/ContratoFormPage').then((m) => ({ default: m.ContratoFormPage })));
const ContratoDetallePage = lazy(() =>
  import('@/pages/ContratoDetallePage').then((m) => ({ default: m.ContratoDetallePage })),
);
const ColaPage = lazy(() => import('@/pages/ColaPage').then((m) => ({ default: m.ColaPage })));
const ColaTrabajoPage = lazy(() => import('@/pages/ColaPage').then((m) => ({ default: m.ColaTrabajoPage })));
const UsuariosPage = lazy(() => import('@/pages/UsuariosPage').then((m) => ({ default: m.UsuariosPage })));

function CargandoApp() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-surface">
      <PageLoader texto="Preparando MESENERGIA CRM…" />
    </div>
  );
}

function Protegido() {
  const { session, perfil, cargando, recuperandoPassword, errorPerfil, cerrarSesion } = useAuth();
  const location = useLocation();

  if (cargando) return <CargandoApp />;
  if (!session) return <Navigate to="/login" replace state={{ desde: location.pathname }} />;
  if (recuperandoPassword) return <Navigate to="/restablecer" replace />;

  if (!perfil || !perfil.activo) {
    return (
      <PantallaAuth>
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-600">
          <ShieldOff className="h-6 w-6" />
        </span>
        <h1 className="mt-5 text-2xl font-semibold text-navy-900">Acceso no disponible</h1>
        <Aviso tipo="danger" className="mt-4">
          {errorPerfil
            ? `No se pudo cargar tu perfil: ${errorPerfil}`
            : perfil
              ? 'Tu usuario está desactivado. Si crees que es un error, contacta con administración.'
              : 'Tu usuario no tiene un perfil en el CRM. Contacta con administración.'}
        </Aviso>
        <Button className="mt-5 w-full" variant="secondary" icon={<LogOut className="h-4 w-4" />} onClick={cerrarSesion}>
          Cerrar sesión
        </Button>
      </PantallaAuth>
    );
  }

  if (perfil.debe_cambiar_password) return <NuevaPasswordPage motivo="obligatorio" />;
  return <AppLayout />;
}

/** Restringe una ruta a los roles con un permiso concreto. */
function SoloSi({ permiso, children }: { permiso: keyof Permisos; children: ReactNode }) {
  const { perfil } = useAuth();
  if (!perfil || !calcularPermisos(perfil)[permiso]) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function RutaLogin() {
  const { session, cargando, recuperandoPassword } = useAuth();
  const location = useLocation();
  if (cargando) return <CargandoApp />;
  if (session && !recuperandoPassword) {
    const desde = (location.state as { desde?: string } | null)?.desde;
    return <Navigate to={desde && desde !== '/login' ? desde : '/'} replace />;
  }
  return <LoginPage />;
}

function RutaRestablecer() {
  const { cargando } = useAuth();
  if (cargando) return <CargandoApp />;
  return <NuevaPasswordPage motivo="recuperacion" />;
}

function SinConfiguracion() {
  return (
    <PantallaAuth>
      <h1 className="text-2xl font-semibold text-navy-900">Falta configurar Supabase</h1>
      <Aviso tipo="warning" className="mt-4">
        Crea un archivo <code className="font-mono">.env.local</code> con <code className="font-mono">VITE_SUPABASE_URL</code> y{' '}
        <code className="font-mono">VITE_SUPABASE_ANON_KEY</code> (ver <code className="font-mono">.env.example</code> y el README) y
        reinicia la aplicación.
      </Aviso>
    </PantallaAuth>
  );
}

export default function App() {
  if (!supabaseConfigurado) return <SinConfiguracion />;

  return (
    <Routes>
      <Route path="/login" element={<RutaLogin />} />
      <Route path="/restablecer" element={<RutaRestablecer />} />
      <Route element={<Protegido />}>
        <Route index element={<DashboardPage />} />
        <Route path="contratos" element={<ContratosPage />} />
        <Route
          path="contratos/nuevo"
          element={
            <SoloSi permiso="puedeCrearContrato">
              <ContratoFormPage />
            </SoloSi>
          }
        />
        <Route path="contratos/:id" element={<ContratoDetallePage />} />
        <Route path="contratos/:id/editar" element={<ContratoFormPage />} />
        <Route
          path="cola"
          element={
            <SoloSi permiso="puedeVerCola">
              <ColaPage />
            </SoloSi>
          }
        />
        <Route
          path="cola/:id"
          element={
            <SoloSi permiso="puedeVerCola">
              <ColaTrabajoPage />
            </SoloSi>
          }
        />
        <Route
          path="usuarios"
          element={
            <SoloSi permiso="puedeVerUsuarios">
              <UsuariosPage />
            </SoloSi>
          }
        />
        <Route path="*" element={<NoEncontradoPage />} />
      </Route>
    </Routes>
  );
}
