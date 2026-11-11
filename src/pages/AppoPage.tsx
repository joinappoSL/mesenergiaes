import { Calculator, CalendarCheck, FileSpreadsheet, MessageSquareQuote, Pencil, Plus, Search, Tag, Trash2, Upload } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { usePerfil } from '@/auth/AuthProvider';
import { usePermisos } from '@/auth/permisos';
import { FormAppoLead } from '@/components/appo/FormAppoLead';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/Feedback';
import { Field, Input, Select } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { Tabs } from '@/components/ui/Misc';
import { usePerfiles } from '@/hooks/datos';
import { useAppoLeads, useBorrarAppoLead, useImportarAppoLeads } from '@/hooks/appo';
import {
  APPO_AZUL,
  APPO_TURQUESA,
  calcularPerdidas,
  ESTADOS_APPO,
  filasAAppoLeads,
  LISTA_ESTADOS_APPO,
  MODULOS_APPO,
  PACKS,
  packRecomendado,
  resumirAppo,
  type AppoLead,
  type EstadoAppo,
  type NuevoAppoLead,
} from '@/lib/appo';
import { ARGUMENTOS_LEY, OBJECIONES_APPO, rellenarGuion, SPEECH_APPO } from '@/lib/appoSpeech';
import { euros, fechaHora, nombreCompleto, telefono } from '@/lib/format';
import { leerHojas } from '@/lib/leadsExcel';
import { norm } from '@/lib/leads';
import { mensajeError } from '@/lib/utils';

type Pestana = 'leads' | 'speech' | 'calculadora' | 'precios';

function Cifra({ titulo, valor, detalle }: { titulo: string; valor: string | number; detalle?: string }) {
  return (
    <Card className="p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{titulo}</p>
      <p className="font-display text-3xl font-bold" style={{ color: APPO_AZUL }}>{valor}</p>
      {detalle && <p className="text-xs text-slate-500">{detalle}</p>}
    </Card>
  );
}

/** Cabecera con la imagen corporativa de Appo. */
function CabeceraAppo() {
  return (
    <div className="relative mb-6 overflow-hidden rounded-3xl text-white shadow-lg" style={{ background: `linear-gradient(120deg, ${APPO_AZUL} 0%, #0b3f82 55%, ${APPO_TURQUESA} 140%)` }}>
      <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full opacity-30 blur-2xl" style={{ background: APPO_TURQUESA }} />
      <div className="relative flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="flex items-center gap-4">
          <div className="rounded-2xl bg-white px-4 py-3 shadow-sm">
            <img src={`${import.meta.env.BASE_URL}appo/logo.png`} alt="Appo" className="h-9 w-auto select-none sm:h-10" draggable={false} />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">Vender Appo</h1>
            <p className="text-sm text-white/80">IA para pymes: WhatsApp, llamadas, citas y facturación en automático.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 text-xs font-semibold">
          <span className="rounded-full bg-white/15 px-3 py-1">Objetivo: auditoría gratis · 30 min</span>
          <span className="rounded-full bg-white/15 px-3 py-1">Informe y demo en 24 h</span>
        </div>
      </div>
    </div>
  );
}

function Calculadora() {
  const [contactos, setContactos] = useState(10);
  const [ticket, setTicket] = useState(60);
  const [conv, setConv] = useState(30);
  const [nec, setNec] = useState({ whatsapp: true, llamadas: false, facturas: false, personal: false });
  const r = calcularPerdidas(contactos, ticket, conv);
  const pack = PACKS[packRecomendado(nec)];
  const clientes = pack.mes && ticket ? Math.ceil(pack.mes / ticket) : 0;
  const barra = (label: string, v: number, set: (n: number) => void, min: number, max: number, sufijo: string) => (
    <label className="block">
      <span className="flex justify-between text-sm font-medium text-slate-700"><span>{label}</span><span className="font-bold" style={{ color: APPO_AZUL }}>{v}{sufijo}</span></span>
      <input type="range" min={min} max={max} value={v} onChange={(e) => set(Number(e.target.value))} className="mt-2 w-full" style={{ accentColor: APPO_TURQUESA }} />
    </label>
  );
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="space-y-5 p-5">
        <h3 className="font-semibold text-navy-900">¿Cuánto está perdiendo el cliente?</h3>
        {barra('Mensajes o llamadas que no atiende a la semana', contactos, setContactos, 0, 100, '')}
        {barra('Lo que le deja de media un cliente', ticket, setTicket, 0, 500, ' €')}
        {barra('De esos contactos, cuántos acabarían comprando', conv, setConv, 0, 100, ' %')}
        <div className="rounded-2xl p-4 text-white" style={{ background: APPO_AZUL }}>
          <p className="text-sm text-white/80">Está dejando escapar unos</p>
          <p className="font-display text-4xl font-bold">{euros(r.mes)} <span className="text-base font-medium text-white/80">al mes</span></p>
          <p className="text-sm text-white/80">{euros(r.anio)} al año</p>
        </div>
      </Card>
      <Card className="space-y-4 p-5">
        <h3 className="font-semibold text-navy-900">Pack recomendado</h3>
        <div className="grid grid-cols-2 gap-2 text-sm">
          {([['whatsapp', 'WhatsApp sin contestar'], ['llamadas', 'Llamadas perdidas'], ['facturas', 'Facturas y cobros'], ['personal', 'Fichaje y personal']] as const).map(([k, t]) => (
            <label key={k} className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2">
              <input type="checkbox" checked={nec[k]} onChange={(e) => setNec({ ...nec, [k]: e.target.checked })} style={{ accentColor: APPO_TURQUESA }} /> {t}
            </label>
          ))}
        </div>
        <div className="rounded-2xl border-2 p-4" style={{ borderColor: APPO_TURQUESA }}>
          <p className="text-lg font-bold" style={{ color: APPO_AZUL }}>{pack.nombre}</p>
          <p className="text-sm text-slate-600">{pack.para}</p>
          <p className="mt-2 text-sm"><b>{euros(pack.mes)}/mes</b> + {euros(pack.alta)} de alta (autónomo, sin IVA)</p>
        </div>
        <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
          💬 «Pierdes unos <b>{euros(r.mes)}</b> al mes. El {pack.nombre} cuesta <b>{euros(pack.mes)}/mes</b>: se paga solo con recuperar <b>{clientes} {clientes === 1 ? 'cliente' : 'clientes'}</b> al mes.»
        </p>
      </Card>
    </div>
  );
}

function Speech() {
  const perfil = usePerfil();
  const [nombre, setNombre] = useState('');
  const [sector, setSector] = useState('negocios');
  const datos = { nombre: nombre || '{nombre}', comercial: nombreCompleto(perfil), sector, perdidas: '780', pack: 'Pack Arranque', cuota: '209', clientes: '4' };
  return (
    <div className="space-y-4">
      <Card className="flex flex-wrap items-end gap-3 p-4">
        <Field label="Nombre del cliente" className="min-w-[180px] flex-1"><Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ana" /></Field>
        <Field label="Sector (en plural)" className="min-w-[180px] flex-1"><Input value={sector} onChange={(e) => setSector(e.target.value)} placeholder="clínicas, peluquerías…" /></Field>
        <p className="w-full text-xs text-slate-500">El objetivo de la llamada <b>no</b> es vender el pack: es cerrar la auditoría gratis. El pack se cierra en la auditoría.</p>
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        {SPEECH_APPO.map((p) => (
          <Card key={p.titulo} className="p-5">
            <h3 className="font-semibold" style={{ color: APPO_AZUL }}>{p.titulo}</h3>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">{p.objetivo}</p>
            <ul className="space-y-2">
              {p.guion.map((g) => <li key={g} className="rounded-xl border-l-4 bg-slate-50 px-3 py-2 text-sm text-slate-800" style={{ borderColor: APPO_TURQUESA }}>{rellenarGuion(g, datos)}</li>)}
            </ul>
            {p.consejo && <p className="mt-3 text-xs text-slate-500">💡 {p.consejo}</p>}
          </Card>
        ))}
      </div>
      <Card className="p-5">
        <h3 className="mb-3 font-semibold" style={{ color: APPO_AZUL }}>Objeciones y respuestas</h3>
        <div className="grid gap-3 md:grid-cols-2">
          {OBJECIONES_APPO.map((o) => (
            <div key={o.objecion} className="rounded-xl border border-slate-200 p-3">
              <p className="text-sm font-bold text-navy-900">{o.objecion}</p>
              <p className="mt-1 text-sm text-slate-700">{o.respuesta}</p>
            </div>
          ))}
        </div>
      </Card>
      <Card className="p-5">
        <h3 className="mb-3 font-semibold" style={{ color: APPO_AZUL }}>Argumento de urgencia: lo que obliga la ley</h3>
        <div className="grid gap-3 md:grid-cols-3">
          {ARGUMENTOS_LEY.map((a) => (
            <div key={a.que} className="rounded-xl bg-slate-50 p-3">
              <p className="text-xs font-bold" style={{ color: APPO_TURQUESA }}>{a.cuando}</p>
              <p className="font-semibold text-navy-900">{a.que}</p>
              <p className="text-sm text-slate-600">{a.texto}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function Precios() {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-3">
        {(['arranque', 'crecimiento', 'empresa'] as const).map((k) => (
          <Card key={k} className="p-5" style={k === 'crecimiento' ? { boxShadow: `0 0 0 2px ${APPO_TURQUESA}` } : undefined}>
            {k === 'crecimiento' && <p className="mb-1 text-xs font-bold uppercase" style={{ color: APPO_TURQUESA }}>El más completo para empezar</p>}
            <h3 className="text-lg font-bold" style={{ color: APPO_AZUL }}>{PACKS[k].nombre}</h3>
            <p className="text-sm text-slate-600">{PACKS[k].para}</p>
            <p className="mt-3"><span className="font-display text-3xl font-bold text-navy-900">{euros(PACKS[k].mes)}</span> /mes <span className="text-sm text-slate-500">+ {euros(PACKS[k].alta)} de alta</span></p>
            <ul className="mt-3 space-y-1 text-sm text-slate-700">{PACKS[k].incluye.map((i) => <li key={i}>✓ {i}</li>)}</ul>
          </Card>
        ))}
      </div>
      <Card className="p-5 text-sm text-slate-700">
        <p>Precios de tamaño <b>Autónomo</b> (0–2 personas), sin IVA. Para Micro, Pequeña y Mediana mira la web. Pago anual: 12 meses al precio de 10. Permanencia: 6 meses en los packs; después, mes a mes.</p>
        <p className="mt-1">🚀 <b>Lanzamiento:</b> los 5 primeros clientes tienen el alta al 50 % a cambio de su caso de éxito.</p>
      </Card>
      <Card className="p-5">
        <h3 className="mb-3 font-semibold" style={{ color: APPO_AZUL }}>Módulos sueltos</h3>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {MODULOS_APPO.map((m) => (
            <div key={m.nombre} className="rounded-xl border border-slate-200 p-3">
              <p className="text-[11px] font-bold uppercase" style={{ color: APPO_TURQUESA }}>{m.tipo}</p>
              <p className="font-semibold text-navy-900">{m.nombre}</p>
              <p className="text-xs text-slate-600">{m.texto}</p>
              <p className="mt-1 text-sm font-bold" style={{ color: APPO_AZUL }}>desde {euros(m.desde)}/mes</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function ImportarAppo({ open, onClose, existentes, propietarioId }: { open: boolean; onClose: () => void; existentes: Set<string>; propietarioId?: string }) {
  const importar = useImportarAppoLeads();
  const ref = useRef<HTMLInputElement>(null);
  const [modulo, setModulo] = useState('');
  const [prev, setPrev] = useState<{ leads: NuevoAppoLead[]; descartadas: number; repetidas: number } | null>(null);

  async function leer(files: FileList | null) {
    if (!files?.length) return;
    try {
      const hojas = await leerHojas([...files]);
      const filas = hojas.flatMap((h, i) => (i === 0 ? h : h.slice(1)));
      setPrev(filasAAppoLeads(filas, modulo.trim(), existentes));
    } catch (e) {
      toast.error(mensajeError(e));
    }
  }

  async function confirmar() {
    if (!prev?.leads.length) return;
    try {
      const n = await importar.mutateAsync({ leads: prev.leads.map((l) => ({ ...l, modulo: modulo.trim() })), propietarioId });
      toast.success(`${n} leads de Appo importados`);
      setPrev(null);
      onClose();
    } catch (e) {
      toast.error(mensajeError(e));
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => { setPrev(null); onClose(); }}
      title="Importar leads de Appo"
      description="Excel o CSV con columnas como Empresa, Teléfono, Email, Web, Sector y Ciudad."
      footer={<><Button variant="secondary" onClick={() => { setPrev(null); onClose(); }}>Cancelar</Button><Button icon={<Upload className="h-4 w-4" />} disabled={!prev?.leads.length} loading={importar.isPending} onClick={confirmar}>Importar {prev?.leads.length ?? ''}</Button></>}
    >
      <div className="space-y-3">
        <Field label="Nombre del módulo"><Input value={modulo} onChange={(e) => setModulo(e.target.value)} placeholder="Appo · Clínicas Barcelona" /></Field>
        <input ref={ref} type="file" accept=".xlsx,.xls,.csv,.zip" multiple className="hidden" onChange={(e) => { void leer(e.target.files); e.target.value = ''; }} />
        <Button variant="secondary" icon={<FileSpreadsheet className="h-4 w-4" />} onClick={() => ref.current?.click()}>Elegir Excel</Button>
        {prev && (
          <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
            <b>{prev.leads.length}</b> leads listos. {prev.descartadas > 0 && `${prev.descartadas} sin empresa o sin teléfono ni email. `}{prev.repetidas > 0 && `${prev.repetidas} repetidos (ya estaban).`}
          </p>
        )}
      </div>
    </Modal>
  );
}

function Leads() {
  const perfil = usePerfil();
  const p = usePermisos();
  const q = useAppoLeads();
  const perfiles = usePerfiles();
  const borrar = useBorrarAppoLead();
  const [busqueda, setBusqueda] = useState('');
  const [estado, setEstado] = useState<EstadoAppo | ''>('');
  const [modulo, setModulo] = useState('');
  const [persona, setPersona] = useState('');
  const [editar, setEditar] = useState<AppoLead | null>(null);
  const [form, setForm] = useState(false);
  const [imp, setImp] = useState(false);

  const nombres = useMemo(() => new Map((perfiles.data ?? []).map((u) => [u.id, nombreCompleto(u)])), [perfiles.data]);
  const todos = useMemo(() => (q.data ?? []).filter((l) => !persona || l.propietario_id === persona), [q.data, persona]);
  const resumen = useMemo(() => resumirAppo(todos), [todos]);
  const modulos = useMemo(() => [...new Set(todos.map((l) => l.modulo).filter(Boolean))].sort(), [todos]);
  const existentes = useMemo(() => new Set((q.data ?? []).filter((l) => l.propietario_id === (persona || perfil.id)).map((l) => l.telefono || l.email).filter(Boolean)), [q.data, persona, perfil.id]);
  const proximas = useMemo(
    () => todos.filter((l) => l.estado === 'auditoria' && l.auditoria_at && new Date(l.auditoria_at) >= new Date(Date.now() - 3600_000)).sort((a, b) => a.auditoria_at!.localeCompare(b.auditoria_at!)).slice(0, 5),
    [todos],
  );
  const filas = useMemo(() => {
    const nq = norm(busqueda);
    return todos
      .filter((l) => (!estado || l.estado === estado) && (!modulo || l.modulo === modulo) && (!nq || norm([l.empresa, l.contacto, l.telefono, l.email, l.sector, l.ciudad, l.nota].join(' ')).includes(nq)))
      .sort((a, b) => ESTADOS_APPO[a.estado].orden - ESTADOS_APPO[b.estado].orden || b.updated_at.localeCompare(a.updated_at));
  }, [todos, estado, modulo, busqueda]);

  if (q.error) return <ErrorState mensaje={mensajeError(q.error)} onRetry={() => q.refetch()} />;
  if (q.isLoading) return <Skeleton className="h-72 w-full" />;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Cifra titulo="Por llamar" valor={resumen.porLlamar} detalle={`${resumen.total} leads en total`} />
        <Cifra titulo="Interesados" valor={resumen.interesados} />
        <Cifra titulo="Auditorías" valor={resumen.auditorias} detalle={`${resumen.auditoriasProximas} próximas`} />
        <Cifra titulo="Cerrados" valor={resumen.cerrados} />
        <Cifra titulo="Cuotas cerradas" valor={euros(resumen.mrr)} detalle={`al mes · altas ${euros(resumen.altas)}`} />
      </div>

      {proximas.length > 0 && (
        <Card className="p-4">
          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold" style={{ color: APPO_AZUL }}><CalendarCheck className="h-4 w-4" /> Próximas auditorías</h3>
          <ul className="divide-y divide-slate-100 text-sm">
            {proximas.map((l) => (
              <li key={l.id} className="flex cursor-pointer items-center justify-between gap-3 py-2 hover:bg-slate-50" onClick={() => { setEditar(l); setForm(true); }}>
                <span className="font-semibold text-navy-900">{l.empresa}</span>
                <span className="text-slate-500">{fechaHora(l.auditoria_at)} · {l.auditoria_modo === 'presencial' ? 'Presencial' : 'Online'}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card className="flex flex-wrap items-center gap-3 p-3">
        <div className="min-w-[200px] flex-1"><Input icon={<Search className="h-4 w-4" />} placeholder="Buscar empresa, teléfono, sector…" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} /></div>
        <Select className="w-auto" value={estado} onChange={(e) => setEstado(e.target.value as EstadoAppo | '')} aria-label="Estado">
          <option value="">Todos los estados</option>
          {LISTA_ESTADOS_APPO.map((s) => <option key={s} value={s}>{ESTADOS_APPO[s].etiqueta}</option>)}
        </Select>
        {modulos.length > 0 && (
          <Select className="w-auto" value={modulo} onChange={(e) => setModulo(e.target.value)} aria-label="Módulo">
            <option value="">Todos los módulos</option>
            {modulos.map((m) => <option key={m} value={m}>{m}</option>)}
          </Select>
        )}
        {(p.esGestor || p.esJefe) && (
          <Select className="w-auto" value={persona} onChange={(e) => setPersona(e.target.value)} aria-label="Persona">
            <option value="">Todo el equipo</option>
            {(perfiles.data ?? []).filter((u) => u.activo).map((u) => <option key={u.id} value={u.id}>{nombreCompleto(u)}</option>)}
          </Select>
        )}
        <Button variant="secondary" icon={<Upload className="h-4 w-4" />} onClick={() => setImp(true)}>Importar Excel</Button>
        <Button icon={<Plus className="h-4 w-4" />} onClick={() => { setEditar(null); setForm(true); }}>Añadir lead</Button>
      </Card>

      <Card className="overflow-x-auto">
        {filas.length === 0 ? (
          <EmptyState
            icon={<Tag className="h-6 w-6" />}
            titulo={todos.length ? 'Sin resultados' : 'Todavía no hay leads de Appo'}
            texto={todos.length ? 'Prueba con otro filtro o búsqueda.' : 'Importa un Excel o añade el primer lead para empezar a cerrar auditorías.'}
          />
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-100 text-[11px] uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-4 py-3">Empresa</th><th className="px-4 py-3">Teléfono</th><th className="px-4 py-3">Estado</th><th className="px-4 py-3">Auditoría</th>
                <th className="px-4 py-3">Pack</th>{(p.esGestor || p.esJefe) && <th className="px-4 py-3">Comercial</th>}<th className="px-4 py-3">Notas</th><th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filas.slice(0, 500).map((l) => (
                <tr key={l.id} className="cursor-pointer transition hover:bg-slate-50" onClick={() => { setEditar(l); setForm(true); }}>
                  <td className="px-4 py-2.5"><span className="font-semibold text-navy-900">{l.empresa}</span><span className="block text-xs text-slate-400">{[l.sector, l.ciudad, l.modulo].filter(Boolean).join(' · ')}</span></td>
                  <td className="whitespace-nowrap px-4 py-2.5 tabular-nums">{l.telefono ? telefono(l.telefono) : l.email || '—'}</td>
                  <td className="px-4 py-2.5"><Badge className={ESTADOS_APPO[l.estado].clase}>{ESTADOS_APPO[l.estado].etiqueta}</Badge></td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-slate-600">{l.auditoria_at ? fechaHora(l.auditoria_at) : '—'}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-slate-600">{l.pack ? `${PACKS[l.pack].nombre}${l.cuota_mes ? ` · ${euros(l.cuota_mes)}` : ''}` : '—'}</td>
                  {(p.esGestor || p.esJefe) && <td className="px-4 py-2.5 text-slate-500">{nombres.get(l.propietario_id) ?? '—'}</td>}
                  <td className="max-w-[220px] truncate px-4 py-2.5 text-xs text-slate-500" title={l.nota}>{l.nota}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                    <Button size="sm" variant="ghost" aria-label="Editar" icon={<Pencil className="h-3.5 w-3.5" />} onClick={() => { setEditar(l); setForm(true); }} />
                    <Button size="sm" variant="ghost" aria-label="Borrar" icon={<Trash2 className="h-3.5 w-3.5" />} onClick={() => { if (confirm(`¿Borrar «${l.empresa}»?`)) borrar.mutate(l.id, { onError: (e) => toast.error(mensajeError(e)) }); }} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {filas.length > 500 && <p className="p-3 text-center text-xs text-slate-500">Se muestran 500 de {filas.length}. Usa la búsqueda o los filtros.</p>}
      </Card>

      <FormAppoLead open={form} onClose={() => setForm(false)} editar={editar} modulo={modulo} propietarioId={persona || undefined} />
      <ImportarAppo open={imp} onClose={() => setImp(false)} existentes={existentes} propietarioId={persona || undefined} />
    </div>
  );
}

export function AppoPage() {
  const [pestana, setPestana] = useState<Pestana>('leads');
  return (
    <div>
      <CabeceraAppo />
      <div className="-mx-4 mb-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <Tabs
        className="whitespace-nowrap"
        value={pestana}
        onChange={setPestana}
        tabs={[
          { value: 'leads', label: <><Tag className="h-3.5 w-3.5" /> Leads y auditorías</> },
          { value: 'speech', label: <><MessageSquareQuote className="h-3.5 w-3.5" /> Speech</> },
          { value: 'calculadora', label: <><Calculator className="h-3.5 w-3.5" /> Calculadora</> },
          { value: 'precios', label: <><FileSpreadsheet className="h-3.5 w-3.5" /> Packs y precios</> },
        ]}
      />
      </div>
      {pestana === 'leads' && <Leads />}
      {pestana === 'speech' && <Speech />}
      {pestana === 'calculadora' && <Calculadora />}
      {pestana === 'precios' && <Precios />}
    </div>
  );
}
