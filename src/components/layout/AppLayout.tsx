import { CalendarCheck, FileText, LayoutDashboard, LogOut, PhoneCall, Plus, Target, Users, Zap } from 'lucide-react';
import { createContext, Suspense, useContext, useState, type ComponentType } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { usePerfil, useAuth } from '@/auth/AuthProvider';
import { usePermisos } from '@/auth/permisos';
import { RolBadge } from '@/components/ui/Badge';
import { PageLoader } from '@/components/ui/Feedback';
import { Avatar, Logo } from '@/components/ui/Misc';
import { useCola, useVerificacionesPorHacer } from '@/hooks/datos';
import { useHoy } from '@/hooks/useAhora';
import { useRealtime } from '@/hooks/useRealtime';
import { nombreCompleto } from '@/lib/format';
import { cn } from '@/lib/utils';

const RealtimeContext = createContext(false);
export const useEnDirecto = () => useContext(RealtimeContext);

interface ItemNav {
  to: string;
  label: string;
  corto: string;
  icon: ComponentType<{ className?: string }>;
  end?: boolean;
  contador?: number;
}

function useNavegacion(): ItemNav[] {
  const p = usePermisos();
  const cola = useCola(false, p.puedeVerCola);
  const hoy = useHoy();
  const verificaciones = useVerificacionesPorHacer(hoy.inicio, hoy.fin, p.puedeVerVerificaciones);
  const items: ItemNav[] = [
    { to: '/', label: p.esComercial ? 'Mi resumen' : 'Dashboard', corto: 'Inicio', icon: LayoutDashboard, end: true },
    { to: '/contratos', label: p.esComercial ? 'Mis contratos' : 'Contratos', corto: 'Contratos', icon: FileText },
  ];
  // Comerciales y jefes: la prospección va junto a sus contratos; gestión, al final.
  const prospeccion: ItemNav = { to: '/prospeccion', label: 'Prospección', corto: 'Leads', icon: Target };
  if (!p.esGestor) items.push(prospeccion);
  if (p.puedeVerCola) {
    items.push({ to: '/cola', label: 'Cola de llamadas', corto: 'Cola', icon: PhoneCall, contador: cola.data?.length });
  }
  if (p.puedeVerVerificaciones) {
    items.push({
      to: '/verificaciones',
      label: 'Verificaciones',
      corto: 'Verificar',
      icon: CalendarCheck,
      contador: verificaciones.data,
    });
  }
  if (p.puedeVerUsuarios) {
    items.push({
      to: '/usuarios',
      label: p.puedeGestionarEquipos ? 'Usuarios y equipos' : 'Usuarios',
      corto: 'Usuarios',
      icon: Users,
    });
  }
  if (p.esGestor) items.push(prospeccion);
  return items;
}

function Sidebar({ items, enDirecto }: { items: ItemNav[]; enDirecto: boolean }) {
  const perfil = usePerfil();
  const p = usePermisos();
  const { cerrarSesion } = useAuth();

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-navy-950 lg:flex">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-brand-500/10 blur-3xl" />
        <div className="absolute -bottom-32 -left-20 h-72 w-72 rounded-full bg-sun-400/10 blur-3xl" />
      </div>

      <div className="relative px-6 pb-4 pt-7">
        <Link to="/" aria-label="Inicio">
          <Logo variante="oscuro" className="w-44" />
        </Link>
        <p className="mt-3 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-navy-300">
          <Zap className="h-3 w-3 text-sun-400" /> MESENERGIA CRM
        </p>
      </div>

      {p.puedeCrearContrato && (
        <div className="relative px-4 pb-2 pt-3">
          <Link
            to="/contratos/nuevo"
            className="flex h-11 items-center justify-center gap-2 rounded-xl bg-brand-600 text-sm font-semibold text-white shadow-lg shadow-brand-900/30 transition hover:bg-brand-500 active:scale-[0.98]"
          >
            <Plus className="h-4 w-4" /> Nuevo contrato
          </Link>
        </div>
      )}

      <nav className="relative flex-1 space-y-1 overflow-y-auto px-3 py-3">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              cn(
                'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition',
                isActive ? 'bg-white/10 text-white' : 'text-navy-200 hover:bg-white/5 hover:text-white',
              )
            }
          >
            {({ isActive }) => (
              <>
                <item.icon className={cn('h-[18px] w-[18px]', isActive ? 'text-sun-400' : 'text-navy-300 group-hover:text-navy-100')} />
                <span className="flex-1">{item.label}</span>
                {item.contador ? (
                  <span className="rounded-full bg-sun-400 px-2 py-0.5 text-[11px] font-bold text-navy-950">{item.contador}</span>
                ) : null}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="relative border-t border-white/10 p-4">
        <div className="flex items-center gap-3">
          <Avatar nombre={nombreCompleto(perfil)} className="bg-white/10 text-white" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white">{nombreCompleto(perfil)}</p>
            <div className="mt-0.5 flex items-center gap-1.5">
              <RolBadge rol={perfil.rol} />
            </div>
          </div>
          <button
            type="button"
            onClick={cerrarSesion}
            className="rounded-lg p-2 text-navy-300 transition hover:bg-white/10 hover:text-white"
            title="Cerrar sesión"
            aria-label="Cerrar sesión"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-3 flex items-center gap-1.5 text-[11px] text-navy-300">
          <span className={cn('h-1.5 w-1.5 rounded-full', enDirecto ? 'bg-brand-400 animate-pulse-soft' : 'bg-navy-400')} />
          {enDirecto ? 'Actualización en tiempo real' : 'Conectando…'}
        </p>
      </div>
    </aside>
  );
}

function CabeceraMovil({ extra }: { extra: ItemNav[] }) {
  const perfil = usePerfil();
  const { cerrarSesion } = useAuth();
  const [menu, setMenu] = useState(false);

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-slate-200/70 bg-white/90 px-4 backdrop-blur lg:hidden">
      <Link to="/" aria-label="Inicio">
        <Logo className="h-8 w-auto" />
      </Link>
      <div className="relative">
        <button type="button" onClick={() => setMenu((v) => !v)} aria-label="Menú de usuario">
          <Avatar nombre={nombreCompleto(perfil)} className="h-8 w-8" />
        </button>
        {menu && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setMenu(false)} />
            <div className="absolute right-0 z-20 mt-2 w-60 rounded-2xl bg-white p-3 shadow-pop ring-1 ring-slate-200 animate-slide-up">
              <p className="truncate text-sm font-semibold text-navy-900">{nombreCompleto(perfil)}</p>
              <p className="truncate text-xs text-slate-500">{perfil.email}</p>
              <div className="mt-2">
                <RolBadge rol={perfil.rol} />
              </div>
              {extra.length > 0 && (
                <div className="mt-3 border-t border-slate-100 pt-2">
                  {extra.map((item) => (
                    <Link
                      key={item.to}
                      to={item.to}
                      onClick={() => setMenu(false)}
                      className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-navy-900 hover:bg-slate-50"
                    >
                      <item.icon className="h-4 w-4 text-slate-500" /> {item.label}
                    </Link>
                  ))}
                </div>
              )}
              <button
                type="button"
                onClick={cerrarSesion}
                className="mt-3 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
              >
                <LogOut className="h-4 w-4" /> Cerrar sesión
              </button>
            </div>
          </>
        )}
      </div>
    </header>
  );
}

function NavegacionMovil({ items }: { items: ItemNav[] }) {
  const p = usePermisos();
  const izquierda = items.slice(0, 2);
  const derecha = items.slice(2, 4);

  const enlace = (item: ItemNav) => (
    <NavLink
      key={item.to}
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        cn(
          'relative flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-semibold transition',
          isActive ? 'text-navy-900' : 'text-slate-400',
        )
      }
    >
      {({ isActive }) => (
        <>
          <item.icon className={cn('h-5 w-5', isActive && 'text-brand-600')} />
          {item.corto}
          {item.contador ? (
            <span className="absolute right-[22%] top-1 rounded-full bg-sun-400 px-1.5 text-[10px] font-bold text-navy-950">
              {item.contador}
            </span>
          ) : null}
        </>
      )}
    </NavLink>
  );

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur pb-safe lg:hidden">
      <div className="mx-auto flex h-16 max-w-md items-stretch px-2">
        {izquierda.map(enlace)}
        {p.puedeCrearContrato && (
          <div className="flex flex-1 items-center justify-center">
            <Link
              to="/contratos/nuevo"
              aria-label="Nuevo contrato"
              className="-mt-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-lg shadow-brand-700/30 ring-4 ring-white transition active:scale-95"
            >
              <Plus className="h-6 w-6" />
            </Link>
          </div>
        )}
        {derecha.map(enlace)}
      </div>
    </nav>
  );
}

export function AppLayout() {
  const perfil = usePerfil();
  const items = useNavegacion();
  const enDirecto = useRealtime(perfil.id);
  const location = useLocation();

  return (
    <RealtimeContext.Provider value={enDirecto}>
      <div className="min-h-dvh">
        <Sidebar items={items} enDirecto={enDirecto} />
        <CabeceraMovil extra={items.slice(4)} />
        <main className="lg:pl-64">
          <div key={location.pathname} className="mx-auto w-full max-w-[1400px] px-4 pb-28 pt-5 animate-fade-in sm:px-6 lg:px-8 lg:pb-12 lg:pt-8">
            <Suspense fallback={<PageLoader />}>
              <Outlet />
            </Suspense>
          </div>
        </main>
        <NavegacionMovil items={items} />
      </div>
    </RealtimeContext.Provider>
  );
}
