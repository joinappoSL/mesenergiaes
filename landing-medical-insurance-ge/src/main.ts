import { negocio, testimonios, type Testimonio } from './config';

const ESTADOS = [
  'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Carolina del Norte', 'Carolina del Sur',
  'Colorado', 'Connecticut', 'Dakota del Norte', 'Dakota del Sur', 'Delaware', 'Distrito de Columbia',
  'Florida', 'Georgia', 'Hawái', 'Idaho', 'Illinois', 'Indiana', 'Iowa', 'Kansas', 'Kentucky',
  'Luisiana', 'Maine', 'Maryland', 'Massachusetts', 'Míchigan', 'Minnesota', 'Misisipi', 'Misuri',
  'Montana', 'Nebraska', 'Nevada', 'Nueva Jersey', 'Nueva York', 'Nuevo Hampshire', 'Nuevo México',
  'Ohio', 'Oklahoma', 'Oregón', 'Pensilvania', 'Puerto Rico', 'Rhode Island', 'Tennessee', 'Texas',
  'Utah', 'Vermont', 'Virginia', 'Virginia Occidental', 'Washington', 'Wisconsin', 'Wyoming',
];

const MENSAJE_WHATSAPP = 'Hola, quiero información sobre seguros médicos.';

const $ = <T extends HTMLElement>(selector: string) => document.querySelector<T>(selector);

/** «+13055550123» → «(305) 555-0123». */
function telefonoLegible(e164: string): string {
  const d = e164.replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '');
  return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : e164;
}

function urlWhatsApp(texto: string): string {
  return `https://wa.me/${negocio.whatsapp}?text=${encodeURIComponent(texto)}`;
}

// ---- Datos de contacto: se muestran solo los que están configurados ----
function pintarContactos() {
  const contactos: Record<string, { texto: string; href?: string } | null> = {
    telefono: negocio.telefono ? { texto: telefonoLegible(negocio.telefono), href: `tel:${negocio.telefono}` } : null,
    whatsapp: negocio.whatsapp ? { texto: 'WhatsApp', href: urlWhatsApp(MENSAJE_WHATSAPP) } : null,
    email: negocio.email ? { texto: negocio.email, href: `mailto:${negocio.email}` } : null,
    horario: negocio.horario ? { texto: negocio.horario } : null,
    npn: negocio.npn ? { texto: negocio.npn } : null,
    direccion: negocio.direccion ? { texto: negocio.direccion } : null,
  };

  for (const [clave, dato] of Object.entries(contactos)) {
    if (!dato) continue;
    document.querySelectorAll<HTMLElement>(`[data-contacto="${clave}"]`).forEach((el) => {
      el.hidden = false;
      if (el instanceof HTMLAnchorElement && dato.href) el.href = dato.href;
    });
    document.querySelectorAll<HTMLAnchorElement>(`[data-contacto-enlace="${clave}"]`).forEach((el) => {
      if (dato.href) el.href = dato.href;
    });
    document.querySelectorAll<HTMLElement>(`[data-contacto-texto="${clave}"]`).forEach((el) => {
      el.textContent = dato.texto;
    });
  }
}

// ---- Formulario de cotización ----
function iniciarFormulario() {
  const form = $<HTMLFormElement>('#form-cotizar');
  const selectEstado = $<HTMLSelectElement>('#estado');
  if (!form || !selectEstado) return;

  for (const estado of ESTADOS) selectEstado.add(new Option(estado, estado));

  const errorGeneral = $<HTMLParagraphElement>('#form-error')!;
  const boton = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
  const textoBoton = boton.textContent;

  const marcarError = (id: string, mensaje: string) => {
    const campo = $<HTMLInputElement>(`#${id}`)!;
    const error = $<HTMLParagraphElement>(`#${id}-error`)!;
    campo.setAttribute('aria-invalid', mensaje ? 'true' : 'false');
    error.textContent = mensaje;
    error.classList.toggle('hidden', !mensaje);
  };

  // Limpia el error de un campo en cuanto la persona lo corrige.
  form.addEventListener('input', (e) => {
    const campo = e.target as HTMLInputElement;
    if (campo.getAttribute('aria-invalid') === 'true') marcarError(campo.id, '');
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorGeneral.classList.add('hidden');

    const datos = new FormData(form);
    if (datos.get('empresa_web')) return;

    const nombre = String(datos.get('nombre') ?? '').trim();
    const telefono = String(datos.get('telefono') ?? '').replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '');
    const estado = String(datos.get('estado') ?? '');
    const para = String(datos.get('para') ?? '');
    const consentimiento = datos.get('consentimiento') === 'on';

    const errores: [string, string][] = [
      ['nombre', nombre.length < 3 ? 'Escribe tu nombre y apellido.' : ''],
      ['telefono', telefono.length !== 10 ? 'Escribe un teléfono de EE. UU. de 10 dígitos.' : ''],
      ['estado', !estado ? 'Elige el estado donde vives.' : ''],
      ['consentimiento', !consentimiento ? 'Necesitamos tu permiso para poder contactarte.' : ''],
    ];
    errores.forEach(([id, msg]) => marcarError(id, msg));
    const primerError = errores.find(([, msg]) => msg);
    if (primerError) {
      $<HTMLElement>(`#${primerError[0]}`)?.focus();
      return;
    }

    const lead = {
      nombre,
      telefono: `+1${telefono}`,
      estado,
      para,
      consentimiento_tcpa: true,
      texto_consentimiento: form.querySelector('label:has(#consentimiento) span')?.textContent?.replace(/\s+/g, ' ').trim(),
      origen: window.location.href,
      fecha: new Date().toISOString(),
    };

    boton.disabled = true;
    boton.textContent = 'Enviando tu solicitud…';

    try {
      if (negocio.formEndpoint) {
        const res = await fetch(negocio.formEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(lead),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
      } else {
        const resumen = `Hola, soy ${nombre}. Quiero una cotización de seguro médico.\n• Estado: ${estado}\n• Para: ${para}\n• Teléfono: ${telefonoLegible(lead.telefono)}`;
        if (negocio.whatsapp) {
          window.open(urlWhatsApp(resumen), '_blank', 'noopener');
        } else if (negocio.email) {
          window.location.href = `mailto:${negocio.email}?subject=${encodeURIComponent('Solicitud de cotización')}&body=${encodeURIComponent(resumen)}`;
        } else {
          throw new Error('Sin canal de contacto configurado en src/config.ts');
        }
      }

      $('#exito-nombre')!.textContent = nombre.split(' ')[0];
      $('#form-contenido')!.classList.add('hidden');
      const exito = $<HTMLElement>('#form-exito')!;
      exito.classList.remove('hidden');
      exito.focus();
    } catch (err) {
      console.error(err);
      errorGeneral.textContent = negocio.telefono
        ? `No pudimos enviar tu solicitud. Llámanos al ${telefonoLegible(negocio.telefono)} y te atendemos al momento.`
        : 'No pudimos enviar tu solicitud. Inténtalo de nuevo en unos minutos.';
      errorGeneral.classList.remove('hidden');
    } finally {
      boton.disabled = false;
      boton.textContent = textoBoton;
    }
  });
}

// ---- Pestañas de tipos de seguro (patrón ARIA tabs con flechas) ----
function iniciarPestanas() {
  const lista = $('#pestanas');
  if (!lista) return;
  const tabs = [...lista.querySelectorAll<HTMLButtonElement>('[role="tab"]')];

  const activar = (tab: HTMLButtonElement, enfocar = false) => {
    for (const t of tabs) {
      const activa = t === tab;
      t.setAttribute('aria-selected', String(activa));
      t.tabIndex = activa ? 0 : -1;
      document.getElementById(t.getAttribute('aria-controls')!)!.hidden = !activa;
    }
    if (enfocar) tab.focus();
    tab.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  };

  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => activar(tab));
    tab.addEventListener('keydown', (e) => {
      const destino =
        e.key === 'ArrowRight' ? tabs[(i + 1) % tabs.length]
        : e.key === 'ArrowLeft' ? tabs[(i - 1 + tabs.length) % tabs.length]
        : e.key === 'Home' ? tabs[0]
        : e.key === 'End' ? tabs[tabs.length - 1]
        : null;
      if (destino) {
        e.preventDefault();
        activar(destino, true);
      }
    });
  });
}

// ---- CTA fijo en móvil: visible tras el hero y oculto cuando el formulario está en pantalla ----
function iniciarCtaMovil() {
  const cta = $('#cta-movil');
  const hero = $('#hero');
  const formulario = $('#cotizar');
  if (!cta || !hero || !formulario) return;

  let heroVisible = true;
  let formVisible = false;
  const actualizar = () => {
    const mostrar = !heroVisible && !formVisible;
    cta.classList.toggle('translate-y-full', !mostrar);
    cta.setAttribute('aria-hidden', String(!mostrar));
    cta.querySelectorAll('a').forEach((a) => (a.tabIndex = mostrar ? 0 : -1));
  };

  new IntersectionObserver(([entrada]) => {
    heroVisible = entrada.isIntersecting;
    actualizar();
  }, { rootMargin: '-120px 0px 0px 0px' }).observe(hero);
  new IntersectionObserver(([entrada]) => {
    formVisible = entrada.isIntersecting;
    actualizar();
  }, { threshold: 0.25 }).observe(formulario);
}

// ---- Testimonios: solo se muestra la sección si hay testimonios reales ----
function crearTarjeta(t: Testimonio): HTMLElement {
  const tarjeta = document.createElement('figure');
  tarjeta.className = 'flex flex-col rounded-2xl border border-marca-100 bg-white p-8';

  const bloque = (etiqueta: string, texto: string, clase: string) => {
    const div = document.createElement('div');
    const p1 = document.createElement('p');
    p1.className = `text-xs font-bold tracking-widest uppercase ${clase}`;
    p1.textContent = etiqueta;
    const p2 = document.createElement('p');
    p2.className = 'mt-2 text-base leading-relaxed text-slate-600';
    p2.textContent = texto;
    div.append(p1, p2);
    return div;
  };

  const cita = document.createElement('blockquote');
  cita.className = 'flex-1 space-y-5';
  cita.append(bloque('Antes', t.antes, 'text-slate-500'), bloque('Ahora', t.despues, 'text-emerald-700'));

  const autor = document.createElement('figcaption');
  autor.className = 'mt-8 flex items-center gap-4 border-t border-marca-100 pt-6';
  const foto = document.createElement('img');
  foto.src = t.foto;
  foto.alt = `Foto de ${t.nombre}`;
  foto.width = 56;
  foto.height = 56;
  foto.loading = 'lazy';
  foto.className = 'size-14 rounded-full object-cover';
  const datos = document.createElement('div');
  const nombre = document.createElement('p');
  nombre.className = 'font-bold text-marca-900';
  nombre.textContent = t.nombre;
  const cargo = document.createElement('p');
  cargo.className = 'text-sm text-slate-500';
  cargo.textContent = t.cargo;
  datos.append(nombre, cargo);
  autor.append(foto, datos);

  tarjeta.append(cita, autor);
  return tarjeta;
}

function pintarTestimonios() {
  const seccion = $('#testimonios');
  const lista = $('#testimonios-lista');
  if (!seccion || !lista || testimonios.length === 0) return;
  lista.append(...testimonios.map(crearTarjeta));
  seccion.hidden = false;
}

pintarContactos();
iniciarFormulario();
iniciarPestanas();
iniciarCtaMovil();
pintarTestimonios();
$('#anio')!.textContent = String(new Date().getFullYear());
