/* Appo · cookies, consentimiento y analítica
 * - Nada de analítica ni publicidad se carga hasta que la persona lo acepta.
 * - "Rechazar" pesa igual que "Aceptar" (exigencia de la AEPD).
 * - Cuando se rellena GA4_ID / ADS_ID, Google Analytics y Google Ads se activan solos
 *   y únicamente para quien haya aceptado.
 */
(function () {
  'use strict';

  var CFG = {
    GA4_ID: '',      // Ej.: 'G-ABC123XYZ'  (Google Analytics 4)
    ADS_ID: '',      // Ej.: 'AW-1234567890' (Google Ads, opcional)
    VERSION: 1,      // súbela si cambias las finalidades: vuelve a preguntar a todos
    MESES: 13        // cada cuánto se vuelve a pedir el consentimiento
  };
  var KEY = 'appo_consent_v1';
  var estado = { analitica: false, marketing: false };
  var gtagCargado = false;

  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  window.gtag = window.gtag || gtag;

  // Por defecto, todo denegado (Consent Mode v2)
  gtag('consent', 'default', {
    ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied',
    analytics_storage: 'denied', functionality_storage: 'granted', security_storage: 'granted'
  });

  function leer() {
    try {
      var j = JSON.parse(localStorage.getItem(KEY));
      if (j && j.v === CFG.VERSION && Date.now() - j.t < CFG.MESES * 30 * 864e5) return j;
    } catch (e) {}
    return null;
  }
  function guardar(a, m) {
    var j = { v: CFG.VERSION, t: Date.now(), analitica: !!a, marketing: !!m };
    try { localStorage.setItem(KEY, JSON.stringify(j)); } catch (e) {}
    return j;
  }

  function cargarGoogle() {
    var id = CFG.GA4_ID || CFG.ADS_ID;
    if (!id || gtagCargado) return;
    gtagCargado = true;
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(id);
    document.head.appendChild(s);
    gtag('js', new Date());
    if (CFG.GA4_ID) gtag('config', CFG.GA4_ID, { anonymize_ip: true });
    if (CFG.ADS_ID) gtag('config', CFG.ADS_ID);
  }

  function aplicar(j) {
    estado.analitica = !!j.analitica;
    estado.marketing = !!j.marketing;
    var g = function (v) { return v ? 'granted' : 'denied'; };
    gtag('consent', 'update', {
      analytics_storage: g(j.analitica),
      ad_storage: g(j.marketing),
      ad_user_data: g(j.marketing),
      ad_personalization: g(j.marketing)
    });
    if (j.analitica || j.marketing) cargarGoogle();
  }

  // Eventos: solo se registran si hay consentimiento
  window.appoTrack = function (nombre, params) {
    if (estado.analitica || estado.marketing) gtag('event', nombre, params || {});
  };
  document.addEventListener('click', function (e) {
    var el = e.target.closest && e.target.closest('[data-cta]');
    if (el) window.appoTrack('cta_click', { cta_name: el.getAttribute('data-cta') });
  });

  // ---------- Banner ----------
  var css =
    '#ck{position:fixed;left:12px;right:12px;bottom:12px;z-index:2147483000;max-width:760px;margin:0 auto;background:#fff;color:#0F1B2D;' +
    'border:1px solid #E3E9F2;border-radius:16px;box-shadow:0 18px 50px rgba(15,27,45,.28);padding:20px;font:15px/1.5 Inter,system-ui,-apple-system,"Segoe UI",sans-serif}' +
    '#ck h2{margin:0 0 6px;font:800 1.05rem/1.2 Montserrat,Inter,sans-serif;letter-spacing:-.01em}' +
    '#ck p{margin:0 0 14px;color:#56627A;font-size:.92rem}#ck a{color:#0E4D9D;font-weight:600}' +
    '#ck .ck-b{display:flex;flex-wrap:wrap;gap:10px}' +
    '#ck button{flex:1 1 140px;font:700 .95rem Inter,system-ui,sans-serif;padding:12px 16px;border-radius:12px;cursor:pointer;' +
    'background:#fff;color:#0E4D9D;border:2px solid #0E4D9D}' +
    '#ck button:hover{background:#E8F8FA}#ck button:focus-visible{outline:3px solid #26B9CC;outline-offset:2px}' +
    '#ck .ck-o{display:grid;gap:10px;margin:0 0 14px}' +
    '#ck label{display:flex;gap:12px;align-items:flex-start;padding:12px 14px;border:1px solid #E3E9F2;border-radius:12px;font-size:.9rem}' +
    '#ck label input{margin-top:3px;width:18px;height:18px;accent-color:#0E4D9D;flex:none}' +
    '#ck label b{display:block}#ck label span{color:#56627A;font-size:.84rem}' +
    '@media (max-width:520px){#ck{padding:16px;bottom:8px;left:8px;right:8px}}';

  function crearBanner(modoConfig) {
    cerrar();
    var st = document.createElement('style'); st.id = 'ck-css'; st.textContent = css;
    if (!document.getElementById('ck-css')) document.head.appendChild(st);
    var d = document.createElement('div');
    d.id = 'ck'; d.setAttribute('role', 'dialog'); d.setAttribute('aria-labelledby', 'ck-t'); d.setAttribute('aria-live', 'polite');
    var hay = leer() || estado;
    d.innerHTML =
      '<h2 id="ck-t">Tu privacidad, tu decisión</h2>' +
      '<p>Usamos cookies propias necesarias para que la web funcione y, solo si tú quieres, cookies de analítica y de publicidad ' +
      'para entender qué te resulta útil y mejorar la web. Puedes aceptarlas, rechazarlas o elegir. ' +
      'Más información en la <a href="/cookies">política de cookies</a> y la <a href="/privacidad">política de privacidad</a>.</p>' +
      (modoConfig
        ? '<div class="ck-o">' +
          '<label><input type="checkbox" checked disabled><div><b>Necesarias</b><span>Imprescindibles para que la web funcione y recordar tu elección. Siempre activas.</span></div></label>' +
          '<label><input type="checkbox" id="ck-a"' + (hay.analitica ? ' checked' : '') + '><div><b>Analítica</b><span>Google Analytics: nos dice qué páginas se visitan y qué botones se pulsan, de forma agregada, para mejorar la web.</span></div></label>' +
          '<label><input type="checkbox" id="ck-m"' + (hay.marketing ? ' checked' : '') + '><div><b>Publicidad</b><span>Google Ads: medir si un anuncio nos ha traído una reserva y mostrarte anuncios más relevantes.</span></div></label>' +
          '</div><div class="ck-b"><button type="button" id="ck-g">Guardar mi elección</button></div>'
        : '<div class="ck-b"><button type="button" id="ck-r">Rechazar todo</button><button type="button" id="ck-c">Configurar</button><button type="button" id="ck-ok">Aceptar todo</button></div>');
    document.body.appendChild(d);
    var $ = function (i) { return document.getElementById(i); };
    if (modoConfig) {
      $('ck-g').onclick = function () { decidir($('ck-a').checked, $('ck-m').checked); };
      $('ck-a').focus();
    } else {
      $('ck-r').onclick = function () { decidir(false, false); };
      $('ck-ok').onclick = function () { decidir(true, true); };
      $('ck-c').onclick = function () { crearBanner(true); };
    }
  }
  function cerrar() { var d = document.getElementById('ck'); if (d) d.remove(); }
  function decidir(a, m) { aplicar(guardar(a, m)); cerrar(); }

  window.appoCookies = { abrir: function () { crearBanner(true); } };

  function iniciar() {
    document.querySelectorAll('[data-abrir-cookies]').forEach(function (b) {
      b.addEventListener('click', function () { crearBanner(true); });
    });
    var j = leer();
    if (j) aplicar(j); else crearBanner(false);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
})();
