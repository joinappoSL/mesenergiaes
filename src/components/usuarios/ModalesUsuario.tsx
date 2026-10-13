import { Copy, KeyRound, RefreshCw, ShieldCheck, Trash2, UserPlus, Users } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { usePerfil } from '@/auth/AuthProvider';
import { usePermisos } from '@/auth/permisos';
import { Button } from '@/components/ui/Button';
import { Aviso } from '@/components/ui/Feedback';
import { Field, Input, Select } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { useEquipos, usePerfiles } from '@/hooks/datos';
import { useCrearUsuario, useEditarUsuario, useEliminarEquipo, useGuardarEquipo, useResetPassword } from '@/hooks/mutaciones';
import { ROLES } from '@/lib/constants';
import { nombreCompleto } from '@/lib/format';
import type { Equipo, Perfil, Rol } from '@/lib/types';
import { cn, copiarAlPortapapeles, mensajeError, urlApp } from '@/lib/utils';
import { esEmailValido, esTelefonoValido, generarPasswordTemporal, normalizarTelefono } from '@/lib/validators';

export interface Credenciales {
  nombre: string;
  email: string;
  password: string;
}

function CampoPassword({ valor, onChange }: { valor: string; onChange: (v: string) => void }) {
  return (
    <div className="flex gap-2">
      <Input value={valor} onChange={(e) => onChange(e.target.value)} className="font-mono" autoComplete="off" />
      <Button
        variant="secondary"
        size="icon"
        onClick={() => onChange(generarPasswordTemporal())}
        icon={<RefreshCw className="h-4 w-4" />}
        aria-label="Generar otra contraseña"
        title="Generar otra"
      />
    </div>
  );
}

// -----------------------------------------------------------------------------
// Alta / edición de usuario
// -----------------------------------------------------------------------------
export function UsuarioModal({
  abierto,
  usuario,
  onClose,
  onCreado,
}: {
  abierto: boolean;
  usuario: Perfil | null;
  onClose: () => void;
  onCreado: (c: Credenciales) => void;
}) {
  const yo = usePerfil();
  const p = usePermisos();
  const equipos = useEquipos();
  const crear = useCrearUsuario();
  const editar = useEditarUsuario();
  const editando = Boolean(usuario);

  const [form, setForm] = useState({
    nombre: '',
    apellidos: '',
    email: '',
    telefono: '',
    rol: 'comercial' as Rol,
    equipo_id: '',
    password: '',
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!abierto) return;
    setError(null);
    setForm(
      usuario
        ? {
            nombre: usuario.nombre,
            apellidos: usuario.apellidos,
            email: usuario.email,
            telefono: usuario.telefono ?? '',
            rol: usuario.rol,
            equipo_id: usuario.equipo_id ?? '',
            password: '',
          }
        : {
            nombre: '',
            apellidos: '',
            email: '',
            telefono: '',
            rol: 'comercial',
            equipo_id: p.esJefe ? (yo.equipo_id ?? '') : '',
            password: generarPasswordTemporal(),
          },
    );
  }, [abierto, usuario?.id]);

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const necesitaEquipo = form.rol === 'comercial' || form.rol === 'jefe_equipo';
  const rolesDisponibles: Rol[] = editando && usuario?.id === yo.id ? [usuario.rol] : p.rolesCreables;

  async function guardar(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.nombre.trim() || !form.apellidos.trim()) return setError('Nombre y apellidos son obligatorios.');
    if (!esEmailValido(form.email)) return setError('El email no es válido.');
    if (form.telefono.trim() && !esTelefonoValido(form.telefono)) return setError('El teléfono debe tener 9 dígitos.');
    if (!editando && form.password.length < 8) return setError('La contraseña temporal debe tener al menos 8 caracteres.');

    const datos = {
      nombre: form.nombre.trim(),
      apellidos: form.apellidos.trim(),
      email: form.email.trim().toLowerCase(),
      telefono: form.telefono.trim() ? normalizarTelefono(form.telefono) : null,
      rol: form.rol,
      equipo_id: necesitaEquipo && form.equipo_id ? form.equipo_id : null,
    };

    try {
      if (usuario) {
        await editar.mutateAsync({ id: usuario.id, ...datos });
        toast.success('Usuario actualizado');
        onClose();
      } else {
        await crear.mutateAsync({ ...datos, password: form.password });
        onCreado({ nombre: `${datos.nombre} ${datos.apellidos}`, email: datos.email, password: form.password });
        onClose();
      }
    } catch (err) {
      setError(mensajeError(err));
    }
  }

  return (
    <Modal
      open={abierto}
      onClose={onClose}
      persistent
      title={editando ? 'Editar usuario' : 'Nuevo usuario'}
      description={editando ? usuario!.email : 'Recibirá una contraseña temporal que deberá cambiar al entrar.'}
      icon={<UserPlus className="h-5 w-5" />}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="form-usuario" loading={crear.isPending || editar.isPending}>
            {editando ? 'Guardar cambios' : 'Crear usuario'}
          </Button>
        </>
      }
    >
      <form id="form-usuario" onSubmit={guardar} className="grid grid-cols-1 gap-4 sm:grid-cols-2" noValidate>
        <Field label="Nombre" required>
          <Input value={form.nombre} onChange={(e) => set('nombre', e.target.value)} autoComplete="off" />
        </Field>
        <Field label="Apellidos" required>
          <Input value={form.apellidos} onChange={(e) => set('apellidos', e.target.value)} autoComplete="off" />
        </Field>
        <Field label="Email" required>
          <Input type="email" inputMode="email" value={form.email} onChange={(e) => set('email', e.target.value)} autoComplete="off" />
        </Field>
        <Field label="Teléfono">
          <Input type="tel" inputMode="tel" value={form.telefono} onChange={(e) => set('telefono', e.target.value)} autoComplete="off" />
        </Field>
        <Field label="Rol" required>
          <Select value={form.rol} onChange={(e) => set('rol', e.target.value)} disabled={rolesDisponibles.length < 2}>
            {rolesDisponibles.map((r) => (
              <option key={r} value={r}>
                {ROLES[r].etiqueta}
              </option>
            ))}
          </Select>
        </Field>
        <Field
          label="Equipo"
          hint={
            p.esJefe
              ? 'Se asigna automáticamente a tu equipo'
              : form.rol === 'jefe_equipo'
                ? 'Pasará a ser el jefe de este equipo'
                : !necesitaEquipo
                  ? 'No aplica para este rol'
                  : undefined
          }
        >
          <Select
            value={necesitaEquipo ? form.equipo_id : ''}
            onChange={(e) => set('equipo_id', e.target.value)}
            disabled={p.esJefe || !necesitaEquipo}
          >
            <option value="">Sin equipo</option>
            {(equipos.data ?? []).map((eq) => (
              <option key={eq.id} value={eq.id}>
                {eq.nombre}
              </option>
            ))}
          </Select>
        </Field>
        {!editando && (
          <Field label="Contraseña temporal" required hint="Mínimo 8 caracteres. Se le pedirá cambiarla en el primer acceso." className="sm:col-span-2">
            <CampoPassword valor={form.password} onChange={(v) => set('password', v)} />
          </Field>
        )}
        {error && (
          <Aviso tipo="danger" className="sm:col-span-2">
            {error}
          </Aviso>
        )}
      </form>
    </Modal>
  );
}

// -----------------------------------------------------------------------------
// Resetear contraseña
// -----------------------------------------------------------------------------
export function ResetPasswordModal({
  usuario,
  onClose,
  onHecho,
}: {
  usuario: Perfil | null;
  onClose: () => void;
  onHecho: (c: Credenciales) => void;
}) {
  const reset = useResetPassword();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (usuario) {
      setPassword(generarPasswordTemporal());
      setError(null);
    }
  }, [usuario]);

  if (!usuario) return null;

  async function confirmar() {
    if (!usuario) return;
    if (password.length < 8) return setError('Mínimo 8 caracteres.');
    try {
      await reset.mutateAsync({ id: usuario.id, password });
      onHecho({ nombre: nombreCompleto(usuario), email: usuario.email, password });
      onClose();
    } catch (e) {
      setError(mensajeError(e));
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Resetear contraseña"
      description={`${nombreCompleto(usuario)} · ${usuario.email}`}
      icon={<KeyRound className="h-5 w-5" />}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="warning" onClick={confirmar} loading={reset.isPending}>
            Resetear
          </Button>
        </>
      }
    >
      <Field label="Nueva contraseña temporal" hint="El usuario deberá cambiarla al volver a entrar.">
        <CampoPassword valor={password} onChange={setPassword} />
      </Field>
      {error && <p className="mt-2 text-sm font-medium text-red-600">{error}</p>}
    </Modal>
  );
}

// -----------------------------------------------------------------------------
// Credenciales para entregar al usuario
// -----------------------------------------------------------------------------
export function CredencialesModal({ credenciales, onClose }: { credenciales: Credenciales | null; onClose: () => void }) {
  if (!credenciales) return null;
  const texto = `Acceso a MESENERGIA CRM\n${urlApp()}\nUsuario: ${credenciales.email}\nContraseña temporal: ${credenciales.password}`;

  return (
    <Modal
      open
      onClose={onClose}
      title="Credenciales listas"
      description={`Entrégaselas a ${credenciales.nombre}. Por seguridad no se volverán a mostrar.`}
      icon={<ShieldCheck className="h-5 w-5" />}
      size="sm"
      footer={
        <>
          <Button
            variant="secondary"
            icon={<Copy className="h-4 w-4" />}
            onClick={async () => {
              if (await copiarAlPortapapeles(texto)) toast.success('Copiado al portapapeles');
              else toast.error('No se pudo copiar. Selecciona el texto y cópialo a mano.');
            }}
          >
            Copiar
          </Button>
          <Button onClick={onClose}>Hecho</Button>
        </>
      }
    >
      <dl className="space-y-3 rounded-xl bg-navy-950 p-4 font-mono text-sm text-white">
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-navy-300">Usuario</dt>
          <dd className="break-all">{credenciales.email}</dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-navy-300">Contraseña temporal</dt>
          <dd className="text-lg font-semibold tracking-wide text-sun-300">{credenciales.password}</dd>
        </div>
      </dl>
    </Modal>
  );
}

// -----------------------------------------------------------------------------
// Equipos (solo admin)
// -----------------------------------------------------------------------------
export function EquipoModal({ abierto, equipo, onClose }: { abierto: boolean; equipo: Equipo | null; onClose: () => void }) {
  const perfiles = usePerfiles();
  const guardar = useGuardarEquipo();
  const eliminar = useEliminarEquipo();
  const [nombre, setNombre] = useState('');
  const [jefeId, setJefeId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [confirmandoBorrado, setConfirmandoBorrado] = useState(false);

  useEffect(() => {
    if (!abierto) return;
    setNombre(equipo?.nombre ?? '');
    setJefeId(equipo?.jefe_id ?? '');
    setError(null);
    setConfirmandoBorrado(false);
  }, [abierto, equipo]);

  async function borrar() {
    if (!equipo) return;
    if (!confirmandoBorrado) return setConfirmandoBorrado(true);
    try {
      await eliminar.mutateAsync(equipo.id);
      toast.success(`${equipo.nombre} eliminado`);
      onClose();
    } catch (err) {
      setError(mensajeError(err));
      setConfirmandoBorrado(false);
    }
  }

  const jefes = (perfiles.data ?? []).filter((u) => u.rol === 'jefe_equipo' && u.activo);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (!nombre.trim()) return setError('El nombre es obligatorio.');
    try {
      await guardar.mutateAsync({ id: equipo?.id, nombre, jefeId: jefeId || null });
      toast.success(equipo ? 'Equipo actualizado' : 'Equipo creado');
      onClose();
    } catch (err) {
      setError(mensajeError(err));
    }
  }

  return (
    <Modal
      open={abierto}
      onClose={onClose}
      title={equipo ? 'Editar equipo' : 'Nuevo equipo'}
      icon={<Users className="h-5 w-5" />}
      size="sm"
      footer={
        <>
          {equipo && (
            <Button
              variant={confirmandoBorrado ? 'danger' : 'ghost'}
              icon={<Trash2 className="h-4 w-4" />}
              onClick={borrar}
              loading={eliminar.isPending}
              className={cn('mr-auto', !confirmandoBorrado && 'text-red-600 hover:bg-red-50 hover:text-red-700')}
            >
              {confirmandoBorrado ? 'Sí, eliminar' : 'Eliminar'}
            </Button>
          )}
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="form-equipo" loading={guardar.isPending}>
            Guardar
          </Button>
        </>
      }
    >
      <form id="form-equipo" onSubmit={enviar} className="space-y-4" noValidate>
        <Field label="Nombre del equipo" required>
          <Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: Equipo Madrid" />
        </Field>
        <Field
          label="Jefe de equipo"
          hint={jefes.length ? 'Si ya dirigía otro equipo, dejará de hacerlo.' : 'Crea primero un usuario con rol «Jefe de equipo».'}
        >
          <Select value={jefeId} onChange={(e) => setJefeId(e.target.value)}>
            <option value="">Sin jefe asignado</option>
            {jefes.map((j) => (
              <option key={j.id} value={j.id}>
                {nombreCompleto(j)}
              </option>
            ))}
          </Select>
        </Field>
        {error && <Aviso tipo="danger">{error}</Aviso>}
      </form>
    </Modal>
  );
}
