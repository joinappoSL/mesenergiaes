import { KeyRound, Pencil, Plus, Power, Search, UserCheck, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { usePerfil } from '@/auth/AuthProvider';
import { usePermisos } from '@/auth/permisos';
import {
  CredencialesModal,
  EquipoModal,
  ResetPasswordModal,
  UsuarioModal,
  type Credenciales,
} from '@/components/usuarios/ModalesUsuario';
import { Badge, RolBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/Feedback';
import { Input, Select } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { Avatar, PageHeader, Tabs } from '@/components/ui/Misc';
import { useEquipos, usePerfiles } from '@/hooks/datos';
import { useActivarUsuario } from '@/hooks/mutaciones';
import { LISTA_ROLES, ROLES } from '@/lib/constants';
import { fecha, nombreCompleto, telefono } from '@/lib/format';
import type { Equipo, Perfil, Rol } from '@/lib/types';
import { cn, mensajeError } from '@/lib/utils';

function quitarAcentos(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function ConfirmarActivacion({ usuario, onClose }: { usuario: Perfil | null; onClose: () => void }) {
  const activar = useActivarUsuario();
  if (!usuario) return null;
  const desactivar = usuario.activo;

  async function confirmar() {
    if (!usuario) return;
    try {
      await activar.mutateAsync({ id: usuario.id, activo: !desactivar });
      toast.success(desactivar ? 'Usuario desactivado' : 'Usuario reactivado');
      onClose();
    } catch (e) {
      toast.error(mensajeError(e));
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title={desactivar ? 'Desactivar usuario' : 'Reactivar usuario'}
      description={nombreCompleto(usuario)}
      icon={<Power className="h-5 w-5" />}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant={desactivar ? 'danger' : 'primary'} onClick={confirmar} loading={activar.isPending}>
            {desactivar ? 'Desactivar' : 'Reactivar'}
          </Button>
        </>
      }
    >
      <p className="text-sm text-slate-600">
        {desactivar
          ? 'No podrá iniciar sesión, pero se conserva todo su historial: contratos, observaciones y llamadas. Puedes reactivarlo cuando quieras.'
          : 'Podrá volver a iniciar sesión con su contraseña actual.'}
      </p>
    </Modal>
  );
}

function TablaUsuarios({
  usuarios,
  equipos,
  onEditar,
  onReset,
  onActivar,
}: {
  usuarios: Perfil[];
  equipos: Equipo[];
  onEditar: (u: Perfil) => void;
  onReset: (u: Perfil) => void;
  onActivar: (u: Perfil) => void;
}) {
  const yo = usePerfil();
  const p = usePermisos();
  const nombreEquipo = (id: string | null) => equipos.find((e) => e.id === id)?.nombre ?? '—';

  return (
    <ul className="divide-y divide-slate-100">
      {usuarios.map((u) => {
        const gestionable = p.puedeGestionarUsuario(u);
        const soyYo = u.id === yo.id;
        return (
          <li key={u.id} className={cn('flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:px-5', !u.activo && 'bg-slate-50/80')}>
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <Avatar nombre={nombreCompleto(u)} className={cn(!u.activo && 'opacity-40')} />
              <div className="min-w-0">
                <p className={cn('flex flex-wrap items-center gap-2 font-semibold', u.activo ? 'text-navy-900' : 'text-slate-400')}>
                  <span className="truncate">{nombreCompleto(u)}</span>
                  {soyYo && <span className="text-xs font-medium text-slate-400">(tú)</span>}
                </p>
                <p className="truncate text-xs text-slate-500">
                  {u.email}
                  {u.telefono ? ` · ${telefono(u.telefono)}` : ''}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 pl-12 sm:w-[300px] sm:pl-0">
              <RolBadge rol={u.rol} />
              <span className="text-xs text-slate-500">{u.rol === 'admin' || u.rol === 'backoffice' ? '' : nombreEquipo(u.equipo_id)}</span>
              {!u.activo && <Badge className="bg-slate-200 text-slate-600 ring-slate-300">Desactivado</Badge>}
              {u.activo && u.debe_cambiar_password && (
                <Badge className="bg-sun-50 text-sun-700 ring-sun-200">Contraseña temporal</Badge>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-1 pl-12 sm:pl-0 lg:w-[340px] lg:justify-end xl:w-[380px]">
              {gestionable ? (
                <>
                  <Button variant="ghost" size="sm" icon={<Pencil className="h-3.5 w-3.5" />} onClick={() => onEditar(u)}>
                    Editar
                  </Button>
                  {!soyYo && (
                    <>
                      <Button variant="ghost" size="sm" icon={<KeyRound className="h-3.5 w-3.5" />} onClick={() => onReset(u)} title="Resetear contraseña">
                        <span className="hidden xl:inline">Contraseña</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={u.activo ? <Power className="h-3.5 w-3.5" /> : <UserCheck className="h-3.5 w-3.5" />}
                        onClick={() => onActivar(u)}
                        className={u.activo ? 'hover:text-red-600' : 'text-brand-700'}
                        title={u.activo ? 'Desactivar' : 'Reactivar'}
                      >
                        <span className="hidden xl:inline">{u.activo ? 'Desactivar' : 'Reactivar'}</span>
                      </Button>
                    </>
                  )}
                </>
              ) : (
                <span className="text-xs text-slate-400">Solo lectura</span>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function ListaEquipos({ equipos, usuarios, onEditar }: { equipos: Equipo[]; usuarios: Perfil[]; onEditar: (e: Equipo) => void }) {
  if (!equipos.length) {
    return <EmptyState icon={<Users className="h-6 w-6" />} titulo="Todavía no hay equipos" texto="Crea el primero y asígnale un jefe." />;
  }
  return (
    <div className="grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3">
      {equipos.map((e) => {
        const jefe = usuarios.find((u) => u.id === e.jefe_id);
        const miembros = usuarios.filter((u) => u.equipo_id === e.id && u.rol === 'comercial');
        const activos = miembros.filter((u) => u.activo);
        return (
          <div key={e.id} className="rounded-2xl bg-white p-4 ring-1 ring-slate-200/80">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-semibold text-navy-900">{e.nombre}</h3>
                <p className="text-xs text-slate-500">Creado el {fecha(e.created_at)}</p>
              </div>
              <Button variant="ghost" size="sm" icon={<Pencil className="h-3.5 w-3.5" />} onClick={() => onEditar(e)}>
                Editar
              </Button>
            </div>
            <div className="mt-4 flex items-center gap-2.5 rounded-xl bg-navy-50/60 px-3 py-2.5">
              <Avatar nombre={jefe ? nombreCompleto(jefe) : '?'} className="h-8 w-8" />
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Jefe de equipo</p>
                <p className="truncate text-sm font-semibold text-navy-900">{jefe ? nombreCompleto(jefe) : 'Sin asignar'}</p>
              </div>
            </div>
            <p className="mt-3 text-sm text-slate-600">
              <strong className="text-navy-900">{activos.length}</strong> comerciales activos
              {miembros.length > activos.length && <span className="text-slate-400"> · {miembros.length - activos.length} desactivados</span>}
            </p>
            {activos.length > 0 && (
              <div className="mt-2 flex -space-x-1">
                {activos.slice(0, 8).map((m) => (
                  <Avatar key={m.id} nombre={nombreCompleto(m)} className="h-7 w-7 text-[10px] ring-2 ring-white" />
                ))}
                {activos.length > 8 && (
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-500 ring-2 ring-white">
                    +{activos.length - 8}
                  </span>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function UsuariosPage() {
  const p = usePermisos();
  const perfiles = usePerfiles();
  const equipos = useEquipos();
  const [pestana, setPestana] = useState<'usuarios' | 'equipos'>('usuarios');
  const [busqueda, setBusqueda] = useState('');
  const [filtroRol, setFiltroRol] = useState<'' | Rol>('');
  const [verInactivos, setVerInactivos] = useState(true);

  const [modalUsuario, setModalUsuario] = useState<{ abierto: boolean; usuario: Perfil | null }>({ abierto: false, usuario: null });
  const [reset, setReset] = useState<Perfil | null>(null);
  const [activacion, setActivacion] = useState<Perfil | null>(null);
  const [credenciales, setCredenciales] = useState<Credenciales | null>(null);
  const [modalEquipo, setModalEquipo] = useState<{ abierto: boolean; equipo: Equipo | null }>({ abierto: false, equipo: null });

  const usuarios = useMemo(() => {
    const q = quitarAcentos(busqueda.trim());
    return (perfiles.data ?? []).filter(
      (u) =>
        (!filtroRol || u.rol === filtroRol) &&
        (verInactivos || u.activo) &&
        (!q || quitarAcentos(`${u.nombre} ${u.apellidos} ${u.email}`).includes(q)),
    );
  }, [perfiles.data, busqueda, filtroRol, verInactivos]);

  const totalActivos = (perfiles.data ?? []).filter((u) => u.activo).length;

  return (
    <div>
      <PageHeader
        titulo={p.puedeGestionarEquipos ? 'Usuarios y equipos' : 'Usuarios'}
        subtitulo={
          p.esJefe
            ? 'Gestiona los comerciales de tu equipo.'
            : p.esBackoffice
              ? 'Puedes crear, editar y desactivar comerciales.'
              : `${totalActivos} usuarios activos`
        }
        acciones={
          pestana === 'usuarios' ? (
            p.rolesCreables.length > 0 && (
              <Button icon={<Plus className="h-4 w-4" />} onClick={() => setModalUsuario({ abierto: true, usuario: null })}>
                {p.esAdmin ? 'Nuevo usuario' : 'Nuevo comercial'}
              </Button>
            )
          ) : (
            <Button icon={<Plus className="h-4 w-4" />} onClick={() => setModalEquipo({ abierto: true, equipo: null })}>
              Nuevo equipo
            </Button>
          )
        }
      />

      {p.puedeGestionarEquipos && (
        <Tabs
          className="mb-4"
          value={pestana}
          onChange={setPestana}
          tabs={[
            { value: 'usuarios', label: 'Usuarios', count: perfiles.data?.length },
            { value: 'equipos', label: 'Equipos', count: equipos.data?.length },
          ]}
        />
      )}

      <Card className="overflow-hidden">
        {pestana === 'usuarios' ? (
          <>
            <div className="flex flex-col gap-2 border-b border-slate-100 p-3 sm:flex-row sm:items-center sm:p-4">
              <div className="flex-1">
                <Input
                  type="search"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Buscar por nombre o email…"
                  icon={<Search className="h-4 w-4" />}
                />
              </div>
              <div className="flex gap-2">
                {!p.esJefe && (
                  <Select value={filtroRol} onChange={(e) => setFiltroRol(e.target.value as '' | Rol)} className="sm:w-48" aria-label="Rol">
                    <option value="">Todos los roles</option>
                    {LISTA_ROLES.map((r) => (
                      <option key={r} value={r}>
                        {ROLES[r].etiqueta}
                      </option>
                    ))}
                  </Select>
                )}
                <Button variant={verInactivos ? 'secondary' : 'soft'} onClick={() => setVerInactivos((v) => !v)}>
                  {verInactivos ? 'Ocultar inactivos' : 'Ver inactivos'}
                </Button>
              </div>
            </div>
            {perfiles.error ? (
              <div className="p-4">
                <ErrorState mensaje={mensajeError(perfiles.error)} onRetry={() => perfiles.refetch()} />
              </div>
            ) : perfiles.isLoading ? (
              <div className="space-y-3 p-4">
                {[0, 1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-14" />
                ))}
              </div>
            ) : usuarios.length === 0 ? (
              <EmptyState icon={<Users className="h-6 w-6" />} titulo="No hay usuarios que coincidan" texto="Prueba con otra búsqueda." />
            ) : (
              <TablaUsuarios
                usuarios={usuarios}
                equipos={equipos.data ?? []}
                onEditar={(u) => setModalUsuario({ abierto: true, usuario: u })}
                onReset={setReset}
                onActivar={setActivacion}
              />
            )}
          </>
        ) : (
          <ListaEquipos
            equipos={equipos.data ?? []}
            usuarios={perfiles.data ?? []}
            onEditar={(e) => setModalEquipo({ abierto: true, equipo: e })}
          />
        )}
      </Card>

      <UsuarioModal
        abierto={modalUsuario.abierto}
        usuario={modalUsuario.usuario}
        onClose={() => setModalUsuario({ abierto: false, usuario: null })}
        onCreado={setCredenciales}
      />
      <ResetPasswordModal usuario={reset} onClose={() => setReset(null)} onHecho={setCredenciales} />
      <ConfirmarActivacion usuario={activacion} onClose={() => setActivacion(null)} />
      <CredencialesModal credenciales={credenciales} onClose={() => setCredenciales(null)} />
      <EquipoModal abierto={modalEquipo.abierto} equipo={modalEquipo.equipo} onClose={() => setModalEquipo({ abierto: false, equipo: null })} />
    </div>
  );
}
