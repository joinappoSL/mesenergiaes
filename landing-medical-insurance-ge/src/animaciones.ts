import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import Lenis from 'lenis';

gsap.registerPlugin(ScrollTrigger, SplitText);

declare global {
  interface Window {
    __animacionesListas?: boolean;
  }
}

const EASE = 'expo.out';
const conPuntero = window.matchMedia('(pointer: fine)').matches;

// Scroll suave con inercia, sincronizado con ScrollTrigger. En táctil se mantiene el scroll nativo.
function scrollSuave() {
  const lenis = new Lenis({ duration: 1.15, anchors: { offset: -96 } });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
}

// Cabecera compacta y barra de progreso de lectura.
function cabecera() {
  const header = document.getElementById('cabecera');
  if (header) {
    ScrollTrigger.create({
      start: 40,
      end: 'max',
      onToggle: (s) => (header.dataset.scrolled = String(s.isActive)),
    });
  }
  gsap.to('#progreso', { scaleX: 1, ease: 'none', scrollTrigger: { start: 0, end: 'max', scrub: 0.3 } });
}

// Entrada del hero: titular palabra a palabra, subrayado, resto de piezas en cascada.
function hero() {
  const titulo = document.getElementById('hero-titulo');
  if (!titulo) return;
  gsap.set(titulo, { visibility: 'visible' });

  const tl = gsap.timeline({ defaults: { ease: EASE } });
  SplitText.create(titulo, {
    type: 'lines,words',
    mask: 'lines',
    autoSplit: true,
    onSplit: (self) =>
      gsap
        .timeline({ delay: 0.15 })
        .from(self.words, { yPercent: 115, duration: 1.2, stagger: 0.045, ease: EASE })
        .fromTo(
          titulo.querySelectorAll('.resalte'),
          { backgroundSize: '0% 32%' },
          { backgroundSize: '100% 32%', duration: 1, ease: 'power3.inOut' },
          0.8,
        ),
  });
  tl.fromTo('[data-hero]', { autoAlpha: 0, y: 28 }, { autoAlpha: 1, y: 0, duration: 1.1, stagger: 0.09 }, 0.35);

  gsap.to('.flotante', { y: -12, duration: 2.6, ease: 'sine.inOut', yoyo: true, repeat: -1, stagger: 0.9, delay: 2.3 });
  gsap.to('#hero-cruz', {
    yPercent: 35,
    rotate: 30,
    ease: 'none',
    scrollTrigger: { trigger: '#hero', start: 'top top', end: 'bottom top', scrub: true },
  });
}

// Titulares de sección: líneas que suben desde una máscara.
function titulares() {
  document.querySelectorAll<HTMLElement>('[data-split]').forEach((el) => {
    gsap.set(el, { visibility: 'visible' });
    SplitText.create(el, {
      type: 'lines',
      mask: 'lines',
      autoSplit: true,
      onSplit: (self) =>
        gsap.from(self.lines, {
          yPercent: 110,
          duration: 1.1,
          stagger: 0.1,
          ease: EASE,
          scrollTrigger: { trigger: el, start: 'top 85%', once: true },
        }),
    });
  });
}

// Apariciones al entrar en pantalla: piezas sueltas y grupos en cascada.
function apariciones() {
  gsap.utils.toArray<HTMLElement>('[data-reveal]').forEach((el) => {
    gsap.fromTo(
      el,
      { autoAlpha: 0, y: 32 },
      { autoAlpha: 1, y: 0, duration: 1, ease: EASE, scrollTrigger: { trigger: el, start: 'top 88%', once: true } },
    );
  });
  gsap.utils.toArray<HTMLElement>('[data-stagger]').forEach((grupo) => {
    gsap.fromTo(
      grupo.children,
      { autoAlpha: 0, y: 40 },
      {
        autoAlpha: 1,
        y: 0,
        duration: 1,
        ease: EASE,
        stagger: 0.1,
        scrollTrigger: { trigger: grupo, start: 'top 85%', once: true },
      },
    );
  });
}

// La jerga del seguro pasa del caos (rojo, desordenada) a la claridad (azul, alineada) con el scroll.
function jerga() {
  const chips = gsap.utils.toArray<HTMLElement>('.jerga-chip');
  if (!chips.length) return;
  const caos = {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
    color: '#991b1b',
    rotation: () => gsap.utils.random(-16, 16),
    x: () => gsap.utils.random(-24, 24),
    y: () => gsap.utils.random(-18, 18),
  };
  gsap.set(chips, caos);
  gsap.set('.jerga-pie', { autoAlpha: 0, y: 12 });

  const tl = gsap.timeline({
    scrollTrigger: { trigger: '#jerga', start: 'top 85%', end: 'top 35%', scrub: 1 },
  });
  tl.to(chips, {
    backgroundColor: '#eef4fa',
    borderColor: '#d9e7f3',
    color: '#0b3b63',
    rotation: 0,
    x: 0,
    y: 0,
    ease: 'power2.out',
    stagger: 0.05,
  }).to('.jerga-pie', { autoAlpha: 1, y: 0, ease: 'power2.out' }, '-=0.2');
}

// Pasos: la línea se rellena con el scroll y cada número se enciende al alcanzarlo.
function pasos() {
  const contenedor = document.getElementById('pasos');
  if (!contenedor) return;
  gsap.fromTo(
    '#pasos-relleno',
    { scaleY: 0 },
    { scaleY: 1, ease: 'none', scrollTrigger: { trigger: contenedor, start: 'top 65%', end: 'bottom 60%', scrub: 0.6 } },
  );
  contenedor.querySelectorAll<HTMLElement>('.paso').forEach((paso) => {
    ScrollTrigger.create({ trigger: paso, start: 'top 62%', toggleClass: 'activo' });
    gsap.fromTo(
      paso,
      { autoAlpha: 0.35, x: 16 },
      { autoAlpha: 1, x: 0, duration: 0.9, ease: EASE, scrollTrigger: { trigger: paso, start: 'top 75%', once: true } },
    );
  });
}

// Mapa: los puntos se dibujan de oeste a este y las ciudades aparecen en ese orden.
function mapa() {
  const svg = document.querySelector<SVGSVGElement>('#mapa svg');
  if (!svg) return;
  const ciudades = gsap.utils
    .toArray<SVGGElement>('.mapa-ciudad', svg)
    .sort((a, b) => Number(a.dataset.x) - Number(b.dataset.x));
  ciudades.forEach((c, i) => {
    const ping = c.querySelector<SVGCircleElement>('.mapa-ping');
    if (ping) ping.style.animationDelay = `${(i * 0.37) % 2.6}s`;
  });

  const tl = gsap.timeline({ scrollTrigger: { trigger: svg, start: 'top 80%', once: true } });
  tl.fromTo(svg, { clipPath: 'inset(0% 100% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.8, ease: 'power2.inOut', clearProps: 'clipPath' })
    .from(ciudades, { scale: 0, autoAlpha: 0, duration: 0.6, ease: 'back.out(2.5)', stagger: 0.09 }, 0.5);
}

// Botones magnéticos: siguen ligeramente al cursor.
function magneticos() {
  if (!conPuntero) return;
  document.querySelectorAll<HTMLElement>('[data-magnetico]').forEach((el) => {
    const x = gsap.quickTo(el, 'x', { duration: 0.6, ease: 'elastic.out(1, 0.4)' });
    const y = gsap.quickTo(el, 'y', { duration: 0.6, ease: 'elastic.out(1, 0.4)' });
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      x((e.clientX - (r.left + r.width / 2)) * 0.18);
      y((e.clientY - (r.top + r.height / 2)) * 0.3);
    });
    el.addEventListener('pointerleave', () => {
      x(0);
      y(0);
    });
  });
}

// Foco de luz que sigue al cursor dentro de las tarjetas.
function focos() {
  if (!conPuntero) return;
  document.querySelectorAll<HTMLElement>('[data-spotlight]').forEach((el) => {
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      el.style.setProperty('--mx', `${e.clientX - r.left}px`);
      el.style.setProperty('--my', `${e.clientY - r.top}px`);
    });
  });
}

// Cierre: la cruz gira lentamente con el scroll.
function cierre() {
  gsap.to('#cierre-cruz', {
    rotate: 90,
    ease: 'none',
    scrollTrigger: { trigger: '#cierre', start: 'top bottom', end: 'bottom top', scrub: true },
  });
}

export function iniciarAnimaciones() {
  const mm = gsap.matchMedia();
  mm.add('(prefers-reduced-motion: no-preference)', () => {
    scrollSuave();
    cabecera();
    hero();
    titulares();
    apariciones();
    jerga();
    pasos();
    mapa();
    magneticos();
    focos();
    cierre();
  });
  mm.add('(prefers-reduced-motion: reduce)', () => {
    document.documentElement.classList.remove('js');
    const header = document.getElementById('cabecera');
    const marcar = () => header && (header.dataset.scrolled = String(window.scrollY > 40));
    window.addEventListener('scroll', marcar, { passive: true });
    marcar();
  });
  window.__animacionesListas = true;
  // Las fuentes cambian la altura de los textos: recalcula los disparadores al cargarlas.
  document.fonts?.ready.then(() => ScrollTrigger.refresh());
}
