import { createElement } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import type { Maximetro } from './leads';

export const urlLogoInforme = () => `${import.meta.env.BASE_URL}leads/logo-energia.png`;

/** Convierte el informe del maxímetro en un PDF A4 (varias páginas sin cortar filas). */
export async function maximetroAPdf(m: Maximetro): Promise<File> {
  const [{ default: html2canvas }, { jsPDF }, { InformeMaximetro }] = await Promise.all([
    import('html2canvas'),
    import('jspdf'),
    import('@/components/leads/InformeMaximetro'),
  ]);

  const holder = document.createElement('div');
  holder.style.cssText = 'position:absolute;left:0;top:0;width:794px;z-index:-1;pointer-events:none;background:#fff;color:#0f1e43';
  document.body.appendChild(holder);
  const root = createRoot(holder);
  const sx = window.scrollX;
  const sy = window.scrollY;
  try {
    flushSync(() => root.render(createElement(InformeMaximetro, { m, logoUrl: urlLogoInforme() })));
    window.scrollTo(0, 0);
    await Promise.all(
      [...holder.querySelectorAll('img')].map((im) => (im.complete ? 1 : new Promise((r) => { im.onload = im.onerror = r; }))),
    );
    const canvas = await html2canvas(holder, { scale: 2, useCORS: true, backgroundColor: '#ffffff', scrollX: 0, scrollY: 0 });
    const W = holder.offsetWidth;
    const k = canvas.width / W;
    const top = holder.getBoundingClientRect().top;
    const cortes = [
      ...[...holder.querySelectorAll('tr, svg')].map((e) => e.getBoundingClientRect().bottom - top),
      ...[...holder.querySelectorAll('div')]
        .filter((e) => (e as HTMLElement).style.textTransform === 'uppercase' && (e as HTMLElement).style.background)
        .map((e) => e.getBoundingClientRect().top - top - 8),
    ].sort((a, b) => a - b);

    const mm = 8;
    const pw = 210 - 2 * mm;
    const ph = 297 - 2 * mm;
    const PH = (W * ph) / pw;
    const total = holder.offsetHeight;
    const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
    let y0 = 0;
    let primera = true;
    while (y0 < total - 1) {
      let y1 = Math.min(total, y0 + PH);
      if (y1 < total) {
        const c = cortes.filter((v) => v > y0 + PH * 0.5 && v <= y1);
        if (c.length) y1 = c[c.length - 1];
      }
      const h = y1 - y0;
      const trozo = document.createElement('canvas');
      trozo.width = canvas.width;
      trozo.height = Math.round(h * k);
      trozo.getContext('2d')!.drawImage(canvas, 0, Math.round(y0 * k), canvas.width, trozo.height, 0, 0, canvas.width, trozo.height);
      if (!primera) pdf.addPage();
      primera = false;
      pdf.addImage(trozo.toDataURL('image/jpeg', 0.92), 'JPEG', mm, mm, pw, (h * pw) / W);
      y0 = y1;
    }
    const nombre = (m.nombre || m.cups || 'cliente').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w-]+/g, '_');
    return new File([pdf.output('blob')], `Maximetro-${nombre}.pdf`, { type: 'application/pdf' });
  } finally {
    root.unmount();
    holder.remove();
    window.scrollTo(sx, sy);
  }
}
