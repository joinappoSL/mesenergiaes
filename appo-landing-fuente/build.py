import re, base64, io, json, os, shutil, sys, html
from PIL import Image

SRC = "/root/.claude/uploads/df60c1c2-15ee-560c-9d35-37995e47140e/ba24f386-joinappo_landing_vista_previa.html"
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(os.path.dirname(HERE), "site")
SITE = "https://www.joinappo.com"
HOY = "2026-11-11"

# Datos legales: si están en datos.json se usan; si no, quedan marcados como pendientes.
DATOS = {"razon_social": "", "nif": "", "domicilio": "", "registro": ""}
if os.path.exists(os.path.join(HERE, "datos.json")):
    DATOS.update(json.load(open(os.path.join(HERE, "datos.json"), encoding="utf-8")))

def dato(k, etiqueta):
    v = DATOS.get(k, "").strip()
    return html.escape(v) if v else '<mark class="pend">[%s: pendiente de completar]</mark>' % etiqueta

shutil.rmtree(OUT, ignore_errors=True)
os.makedirs(OUT + "/assets")
s = open(SRC, encoding="utf-8").read()

# ---------- 1. Extraer imágenes incrustadas a archivos ----------
uris = list(re.finditer(r'data:image/([a-z+.-]+);base64,([A-Za-z0-9+/=]+)', s))
raws = [base64.b64decode(m.group(2)) for m in uris]
assert len(raws) == 9, len(raws)
img = lambda i: Image.open(io.BytesIO(raws[i])).convert("RGB")

open(OUT + "/assets/favicon.ico", "wb").write(raws[0])
open(OUT + "/assets/favicon-16.png", "wb").write(raws[1])
open(OUT + "/assets/favicon-32.png", "wb").write(raws[2])
img(3).resize((180, 180), Image.LANCZOS).save(OUT + "/assets/apple-touch-icon.png", optimize=True)
img(3).resize((512, 512), Image.LANCZOS).quantize(256).save(OUT + "/assets/favicon-512.png", optimize=True)
img(4).resize((262, 88), Image.LANCZOS).save(OUT + "/assets/logo.png", optimize=True)
img(6).resize((112, 112), Image.LANCZOS).save(OUT + "/assets/cliente-hairline-pro.png", optimize=True)
img(7).resize((234, 96), Image.LANCZOS).save(OUT + "/assets/cliente-energia.png", optimize=True)

rutas = ["/assets/favicon.ico", "/assets/favicon-16.png", "/assets/favicon-32.png", "/assets/apple-touch-icon.png",
         "/assets/logo.png", "/assets/favicon-32.png", "/assets/cliente-hairline-pro.png",
         "/assets/cliente-energia.png", "/assets/logo.png"]
it = iter(rutas)
s = re.sub(r'data:image/[a-z+.-]+;base64,[A-Za-z0-9+/=]+', lambda m: next(it), s)

def sub1(old, new, cuenta=1):
    global s
    assert s.count(old) == cuenta, (old[:60], s.count(old))
    s = s.replace(old, new)

# ---------- 2. Cabecera: título, descripción, redes, robots ----------
TITULO = "Appo · IA para pymes: WhatsApp, voz, citas, facturación y CRM"
DESC = ("Appo implanta IA en tu pyme: chatbot de WhatsApp 24/7, recepcionista virtual para llamadas, agenda de citas, "
        "facturación Verifactu, CRM, control horario, panel de dirección y agentes de IA a medida. "
        "Lo montamos y lo mantenemos. Reserva tu auditoría gratis de 30 minutos.")
s = re.sub(r'<title>.*?</title>', '<title>%s</title>' % TITULO, s, count=1, flags=re.S)
s = re.sub(r'<meta name="description" content=".*?">', '<meta name="description" content="%s">' % html.escape(DESC, quote=True), s, count=1, flags=re.S)
s = re.sub(r'<meta property="og:title" content=".*?">',
           '<meta property="og:title" content="Appo · Chatbot WhatsApp, recepcionista virtual, citas, facturación y CRM para pymes">', s, count=1)
s = re.sub(r'<meta property="og:description" content=".*?">',
           '<meta property="og:description" content="Chatbot de WhatsApp, recepcionista virtual con IA, citas, facturación Verifactu, CRM y control horario para pymes. Auditoría gratis de 30 minutos.">', s, count=1)
s = s.replace("https://www.joinappo.com/assets/og.jpg", SITE + "/assets/og.jpg")
sub1('<meta property="og:image" content="%s/assets/og.jpg">' % SITE,
     '<meta property="og:image" content="%s/assets/og.jpg">\n<meta property="og:image:width" content="1200">\n<meta property="og:image:height" content="630">\n<meta property="og:image:alt" content="Appo: IA para pymes">\n<meta property="og:site_name" content="Appo">' % SITE)
sub1('<meta name="twitter:card" content="summary_large_image">',
     '<meta name="twitter:card" content="summary_large_image">\n<meta name="twitter:title" content="Appo · IA para pymes: WhatsApp, voz, citas, facturación y CRM">\n<meta name="twitter:image" content="%s/assets/og.jpg">\n<meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1">\n<!-- Search Console: pega aquí la etiqueta <meta name="google-site-verification" content="..."> -->' % SITE)
sub1('"logo":"https://www.joinappo.com/assets/favicon-512.png"', '"logo":"%s/assets/favicon-512.png"' % SITE)

# ---------- 3. Copy orientado a lo que la gente busca ----------
sub1("Implantamos en tu empresa asistentes de inteligencia artificial para WhatsApp y teléfono, citas, facturación y CRM.",
     "Implantamos en tu empresa un chatbot de WhatsApp con IA, una recepcionista virtual para tus llamadas, agenda de citas, facturación y CRM.")
sub1("<h3>Asistente de WhatsApp IA 24/7</h3>", "<h3>Chatbot de WhatsApp con IA 24/7</h3>")
sub1("<h3>Recepcionista de voz IA</h3>", "<h3>Recepcionista virtual con IA para llamadas</h3>")
sub1("<h3>Citas y recordatorios</h3>", "<h3>Agenda de citas online y recordatorios</h3>")
sub1("<h3>Facturación y cobros</h3>", "<h3>Facturación Verifactu y cobros</h3>")
sub1("<h3>RRHH y fichaje digital</h3>", "<h3>Control horario y fichaje digital (RRHH)</h3>")
sub1("<h3>CRM a medida</h3>", "<h3>CRM a medida para pymes</h3>")
sub1("<li>Asistente de WhatsApp IA 24/7</li>", "<li>Chatbot de WhatsApp con IA 24/7</li>")
sub1("<li>Recepcionista de voz IA</li>", "<li>Recepcionista virtual con IA (llamadas)</li>")
sub1("<li>RRHH, fichaje y panel de dirección</li>", "<li>Control horario, RRHH y panel de dirección</li>")
sub1("Los programas de facturación tendrán que cumplir Verifactu. Te dejamos la facturación preparada sin cambiarlo todo de golpe.",
     "Los programas de facturación tendrán que cumplir Verifactu: desde el 1 de enero de 2027 para sociedades y desde el 1 de julio de 2027 para autónomos y el resto. Te dejamos la facturación preparada sin cambiarlo todo de golpe.")
sub1("La factura electrónica entre empresas será obligatoria, primero para las grandes y después para todas las empresas y autónomos.",
     "La factura electrónica entre empresas será obligatoria: desde octubre de 2027 para las que facturan más de 8 millones de euros y desde octubre de 2028 para el resto de empresas y autónomos.")
sub1("El registro de jornada ya es obligatorio y el Gobierno quiere que sea solo digital. Con Appo fichas desde el móvil.",
     "El registro de jornada (control horario) ya es obligatorio desde 2019 y el Gobierno quiere que sea solo digital. Con Appo fichas desde el móvil.")

faq_extra = """      <details><summary>¿Cuánto cuesta un chatbot de WhatsApp con IA para mi empresa?</summary><p>El chatbot de WhatsApp con IA 24/7 parte desde 99 €/mes como módulo suelto. El Pack Arranque (chatbot de WhatsApp más citas y recordatorios) empieza en 139 €/mes más un alta única desde 590 € para autónomos, y sube según el tamaño de la empresa. Precios sin IVA; los ves todos en la sección de precios.</p></details>
      <details><summary>¿Puede una recepcionista virtual con IA coger el teléfono de mi negocio?</summary><p>Sí. Atiende las llamadas cuando nadie puede, resuelve las dudas básicas, da cita y te envía un resumen de cada llamada por WhatsApp. Parte desde 139 €/mes y se configura en la auditoría.</p></details>
"""
sub1("</details>\n    </div>\n  </div>\n</section>\n\n<!-- RESERVA -->", "</details>\n" + faq_extra + "    </div>\n  </div>\n</section>\n\n<!-- RESERVA -->")

# ---------- 4. Pie con gestor de cookies, estilos y scripts ----------
sub1('<a href="/cookies">Cookies</a></div>',
     '<a href="/cookies">Cookies</a> · <button type="button" data-abrir-cookies>Configurar cookies</button></div>')
sub1("</style>", ".legal button{background:none;border:0;color:inherit;font:inherit;text-decoration:underline;cursor:pointer;padding:0}\n</style>")
sub1("  Cal(\"on\", {action: \"linkReady\", callback: () => document.querySelector('#cal-inline .cargando')?.remove()});",
     "  Cal(\"on\", {action: \"linkReady\", callback: () => document.querySelector('#cal-inline .cargando')?.remove()});\n"
     "  Cal(\"on\", {action: \"bookingSuccessful\", callback: () => window.appoTrack && window.appoTrack('generate_lead', {method: 'cal.com'})});")

# ---------- 5. Datos estructurados ----------
MODULOS = [
    ("Chatbot de WhatsApp con IA 24/7", "Contesta al momento, a cualquier hora: dudas, precios y disponibilidad, recoge los datos del cliente y le da cita.", 99),
    ("Recepcionista virtual con IA para llamadas", "Coge el teléfono cuando nadie puede, resuelve lo básico, da cita y envía un resumen de cada llamada por WhatsApp.", 139),
    ("Agenda de citas online y recordatorios", "Reserva online, recordatorios 24 h y 2 h antes, confirmación con un toque y lista de espera.", 59),
    ("Facturación Verifactu y cobros", "Facturación adaptada a Verifactu, reclamación de impagos por WhatsApp y email y conciliación de cobros.", 79),
    ("CRM a medida para pymes", "Clientes, oportunidades, presupuestos y tareas en un solo sitio, con seguimientos automáticos.", 99),
    ("Control horario y fichaje digital (RRHH)", "Fichaje desde el móvil, vacaciones y ausencias, altas de personal y documentos firmados.", 59),
    ("Panel de dirección", "Ventas, cobros pendientes, citas y ausencias en una pantalla, con informe semanal automático.", 59),
    ("Agente de IA a medida", "Automatiza un proceso concreto de tu oficina: leer pedidos y emails, preparar presupuestos, clasificar documentos.", 169),
]
catalogo = {
    "@context": "https://schema.org", "@type": "ProfessionalService", "@id": SITE + "/#negocio",
    "name": "Appo", "url": SITE + "/", "image": SITE + "/assets/og.jpg", "logo": SITE + "/assets/favicon-512.png",
    "email": "info@joinappo.com", "priceRange": "€€",
    "address": {"@type": "PostalAddress", "addressLocality": "Barcelona", "addressRegion": "Cataluña", "addressCountry": "ES"},
    "areaServed": [{"@type": "City", "name": "Barcelona"}, {"@type": "Country", "name": "España"}],
    "description": "Automatización e inteligencia artificial para pymes en Barcelona y toda España.",
    "hasOfferCatalog": {"@type": "OfferCatalog", "name": "Servicios de Appo", "itemListElement": [
        {"@type": "Offer", "priceSpecification": {"@type": "PriceSpecification", "minPrice": p, "priceCurrency": "EUR", "unitText": "mes"},
         "itemOffered": {"@type": "Service", "name": n, "description": d, "provider": {"@id": SITE + "/#negocio"}}}
        for n, d, p in MODULOS]},
}
faq_items = re.findall(r'<details><summary>(.*?)</summary><p>(.*?)</p></details>', s, flags=re.S)
faq = {"@context": "https://schema.org", "@type": "FAQPage", "mainEntity": [
    {"@type": "Question", "name": html.unescape(q), "acceptedAnswer": {"@type": "Answer", "text": html.unescape(re.sub('<[^>]+>', '', a))}} for q, a in faq_items]}
assert len(faq_items) == 9, len(faq_items)
ld = "\n".join('<script type="application/ld+json">\n%s\n</script>' % json.dumps(o, ensure_ascii=False) for o in (catalogo, faq))
sub1("</head>", '<script src="/assets/site.js" defer></script>\n%s\n</head>' % ld)

open(OUT + "/index.html", "w", encoding="utf-8").write(s)

# ---------- 6. Páginas legales ----------
CSS_LEGAL = """:root{--azul:#0E4D9D;--turq:#26B9CC;--tinta:#0F1B2D;--gris:#56627A;--linea:#E3E9F2;--fondo:#F6F9FC}
*{box-sizing:border-box}body{margin:0;font-family:Inter,system-ui,-apple-system,"Segoe UI",sans-serif;color:var(--tinta);background:#fff;line-height:1.7;-webkit-font-smoothing:antialiased}
a{color:var(--azul)}header{border-bottom:1px solid var(--linea);background:#fff}
.w{max-width:820px;margin:0 auto;padding:0 20px}.nav{display:flex;align-items:center;justify-content:space-between;height:72px}
.nav img{height:44px;width:auto}.nav a.v{font-weight:700;text-decoration:none}
h1{font-family:Montserrat,Inter,sans-serif;font-weight:800;font-size:clamp(1.8rem,4vw,2.4rem);line-height:1.15;margin:40px 0 8px;letter-spacing:-.01em}
h2{font-family:Montserrat,Inter,sans-serif;font-weight:800;font-size:1.25rem;margin:34px 0 8px}
.act{color:var(--gris);font-size:.9rem;margin:0 0 24px}p,li{color:#1d2a40}ul{padding-left:22px}
table{width:100%;border-collapse:collapse;font-size:.92rem;margin:12px 0 8px}th,td{border:1px solid var(--linea);padding:10px;text-align:left;vertical-align:top}th{background:var(--fondo)}
.tabla{overflow-x:auto}mark.pend{background:#FFF3C4;color:#6b4e00;padding:1px 6px;border-radius:6px;font-weight:600}
footer{margin-top:56px;border-top:1px solid var(--linea);background:var(--fondo);padding:24px 0;font-size:.9rem;color:var(--gris)}
footer a,footer button{color:inherit}footer button{background:none;border:0;font:inherit;text-decoration:underline;cursor:pointer;padding:0}
main{padding-bottom:20px}"""

def pagina(slug, titulo, desc, cuerpo):
    return """<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>%(t)s</title>
<meta name="description" content="%(d)s">
<link rel="canonical" href="%(site)s/%(slug)s">
<meta name="robots" content="index,follow">
<meta property="og:type" content="website"><meta property="og:locale" content="es_ES"><meta property="og:site_name" content="Appo">
<meta property="og:url" content="%(site)s/%(slug)s"><meta property="og:title" content="%(t)s"><meta property="og:description" content="%(d)s">
<meta property="og:image" content="%(site)s/assets/og.jpg">
<link rel="icon" href="/assets/favicon.ico" sizes="any"><link rel="icon" type="image/png" sizes="32x32" href="/assets/favicon-32.png">
<link rel="apple-touch-icon" href="/assets/apple-touch-icon.png"><meta name="theme-color" content="#0E4D9D">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=Montserrat:wght@800&display=swap" rel="stylesheet">
<style>%(css)s</style>
<script src="/assets/site.js" defer></script>
</head>
<body>
<header><div class="w nav"><a href="/" aria-label="Appo, inicio"><img src="/assets/logo.png" alt="Appo" width="131" height="44"></a><a class="v" href="/">← Volver a la web</a></div></header>
<main class="w">
%(cuerpo)s
</main>
<footer><div class="w">© 2026 Appo · Barcelona · <a href="/aviso-legal">Aviso legal</a> · <a href="/privacidad">Privacidad</a> · <a href="/cookies">Cookies</a> · <button type="button" data-abrir-cookies>Configurar cookies</button></div></footer>
</body>
</html>
""" % dict(t=html.escape(titulo), d=html.escape(desc, quote=True), site=SITE, slug=slug, css=CSS_LEGAL, cuerpo=cuerpo)

TIT_SUFIJO = "Appo · WhatsApp, llamadas, citas, facturación y CRM con IA"
TITULAR = dato("razon_social", "razón social")

AVISO = """<h1>Aviso legal</h1>
<p class="act">Última actualización: 11 de noviembre de 2026</p>
<h2>1. Datos identificativos del titular</h2>
<p>En cumplimiento del artículo 10 de la Ley 34/2002, de Servicios de la Sociedad de la Información y de Comercio Electrónico (LSSI-CE), se informa de que el sitio web <strong>www.joinappo.com</strong> (en adelante, «la web») es titularidad de:</p>
<ul>
<li><strong>Denominación comercial:</strong> Appo</li>
<li><strong>Razón social:</strong> %(rs)s</li>
<li><strong>NIF/CIF:</strong> %(nif)s</li>
<li><strong>Domicilio:</strong> %(dom)s</li>
<li><strong>Datos registrales:</strong> %(reg)s</li>
<li><strong>Correo electrónico de contacto:</strong> <a href="mailto:info@joinappo.com">info@joinappo.com</a></li>
</ul>
<h2>2. Objeto y actividad</h2>
<p>La web presenta y comercializa los servicios de Appo: chatbot de WhatsApp con inteligencia artificial, recepcionista virtual para llamadas, agenda de citas online y recordatorios, facturación y cobros, CRM a medida, control horario y fichaje digital, panel de dirección y agentes de IA a medida para pymes.</p>
<h2>3. Condiciones de uso</h2>
<p>El acceso y la navegación por la web son gratuitos y atribuyen la condición de usuario. El usuario se compromete a hacer un uso adecuado de los contenidos y servicios, conforme a la ley, a la buena fe y al orden público, y a no emplearlos para actividades ilícitas o que lesionen derechos de terceros, ni para dañar, sobrecargar o inutilizar la web.</p>
<p>La información de la web, incluidos los precios, tiene carácter informativo y no constituye una oferta vinculante. Las condiciones definitivas de cada servicio se fijan en la propuesta o contrato que se firme con el cliente. Los precios se indican sin IVA.</p>
<h2>4. Propiedad intelectual e industrial</h2>
<p>Los textos, imágenes, logotipos, marcas, diseño y código de la web son titularidad de Appo o se usan con autorización de sus titulares, y están protegidos por la normativa de propiedad intelectual e industrial. Queda prohibida su reproducción, distribución, comunicación pública o transformación sin autorización expresa. Las marcas y logotipos de clientes que aparecen en la web pertenecen a sus respectivos titulares.</p>
<h2>5. Responsabilidad</h2>
<p>Appo procura que la información de la web sea exacta y esté actualizada, pero no garantiza la ausencia de errores ni la disponibilidad ininterrumpida del sitio, y no responde de los daños derivados de interrupciones, fallos técnicos o virus ajenos a su control. Las estimaciones de la calculadora de la web son orientativas y no suponen compromiso de resultado. Las fechas de obligaciones legales mencionadas (Verifactu, factura electrónica, registro de jornada) pueden cambiar, y no sustituyen el asesoramiento fiscal o laboral profesional.</p>
<h2>6. Enlaces y servicios de terceros</h2>
<p>La web puede contener enlaces a sitios de terceros y servicios incrustados (por ejemplo, el calendario de reservas de Cal.com). Appo no controla ni se responsabiliza de sus contenidos ni de sus políticas, que se rigen por sus propios avisos legales y de privacidad.</p>
<h2>7. Protección de datos y cookies</h2>
<p>El tratamiento de datos personales se explica en la <a href="/privacidad">Política de privacidad</a> y el uso de cookies en la <a href="/cookies">Política de cookies</a>.</p>
<h2>8. Legislación aplicable y jurisdicción</h2>
<p>Este aviso legal se rige por la legislación española. Para cualquier controversia, y salvo que la ley establezca otro fuero imperativo (en particular para consumidores y usuarios), las partes se someten a los juzgados y tribunales de Barcelona.</p>
""" % dict(rs=dato("razon_social", "razón social"), nif=dato("nif", "NIF/CIF"), dom=dato("domicilio", "domicilio"), reg=dato("registro", "datos del Registro Mercantil"))

PRIV = """<h1>Política de privacidad</h1>
<p class="act">Última actualización: 11 de noviembre de 2026</p>
<p>En Appo tratamos tus datos personales con transparencia y conforme al Reglamento (UE) 2016/679 (RGPD) y la Ley Orgánica 3/2018 (LOPDGDD). Aquí te explicamos qué datos tratamos, para qué y qué derechos tienes.</p>
<h2>1. Responsable del tratamiento</h2>
<ul>
<li><strong>Responsable:</strong> %(rs)s (nombre comercial: Appo)</li>
<li><strong>NIF/CIF:</strong> %(nif)s</li>
<li><strong>Domicilio:</strong> %(dom)s</li>
<li><strong>Contacto para temas de privacidad:</strong> <a href="mailto:info@joinappo.com">info@joinappo.com</a></li>
</ul>
<h2>2. Qué datos tratamos, para qué y con qué base legal</h2>
<div class="tabla"><table>
<tr><th>Finalidad</th><th>Datos</th><th>Base legal</th></tr>
<tr><td>Atender tu solicitud de información o de <strong>auditoría gratuita</strong> (reserva en el calendario o por correo electrónico).</td><td>Nombre, correo electrónico, teléfono (si lo facilitas), datos de tu empresa y el contenido de tu mensaje.</td><td>Aplicación de medidas precontractuales a petición tuya (art. 6.1.b RGPD).</td></tr>
<tr><td>Prestar los servicios contratados y gestionar la relación con el cliente (facturación, soporte, mantenimiento).</td><td>Datos identificativos, de contacto, de facturación y los necesarios para el servicio.</td><td>Ejecución del contrato (art. 6.1.b) y obligaciones legales (art. 6.1.c).</td></tr>
<tr><td>Enviarte comunicaciones comerciales sobre servicios similares a los que has solicitado.</td><td>Nombre y correo electrónico.</td><td>Interés legítimo (art. 6.1.f RGPD y art. 21.2 LSSI-CE). Puedes oponerte en cualquier momento.</td></tr>
<tr><td>Analítica web y medición de campañas publicitarias.</td><td>Identificadores online y datos de navegación (ver <a href="/cookies">política de cookies</a>).</td><td>Tu consentimiento (art. 6.1.a RGPD), que puedes retirar cuando quieras.</td></tr>
</table></div>
<p>La calculadora «¿Cuánto estoy perdiendo?» funciona en tu navegador y <strong>no envía ni guarda</strong> los valores que introduces.</p>
<h2>3. Cuánto tiempo conservamos los datos</h2>
<p>Los datos de solicitudes y contactos comerciales se conservan mientras sea necesario para atender tu petición y, después, bloqueados durante los plazos legales de prescripción de posibles responsabilidades. Los datos de clientes se conservan durante la relación contractual y los plazos legales aplicables (por ejemplo, fiscales y mercantiles). Los datos de analítica y publicidad se conservan según los plazos de cada cookie.</p>
<h2>4. Destinatarios y encargados del tratamiento</h2>
<p>No vendemos tus datos. Para prestar el servicio recurrimos a proveedores que actúan como encargados del tratamiento bajo contrato:</p>
<ul>
<li><strong>Cal.com</strong>: calendario de reserva de auditorías, incrustado en la web.</li>
<li><strong>Vercel</strong>: alojamiento de la web.</li>
<li><strong>Google</strong> (Google Analytics y Google Ads, solo si aceptas esas cookies; y Google Fonts para las tipografías).</li>
<li>Proveedores de correo electrónico y herramientas internas de gestión.</li>
</ul>
<p>También podremos comunicar datos a las administraciones públicas cuando la ley lo exija.</p>
<h2>5. Transferencias internacionales</h2>
<p>Algunos de estos proveedores están establecidos en Estados Unidos o pueden tratar datos fuera del Espacio Económico Europeo. En esos casos, las transferencias se amparan en las garantías previstas por el RGPD: decisión de adecuación (Marco de Privacidad de Datos UE-EE. UU.) o cláusulas contractuales tipo de la Comisión Europea.</p>
<h2>6. Tus derechos</h2>
<p>Puedes ejercer en cualquier momento tus derechos de <strong>acceso, rectificación, supresión, oposición, limitación del tratamiento y portabilidad</strong>, y retirar los consentimientos que hayas dado, escribiendo a <a href="mailto:info@joinappo.com">info@joinappo.com</a> e indicando el derecho que quieres ejercer. Para proteger tu privacidad podremos pedirte que acredites tu identidad.</p>
<p>Si consideras que no hemos tratado tus datos correctamente, tienes derecho a presentar una reclamación ante la <a href="https://www.aepd.es" rel="noopener">Agencia Española de Protección de Datos</a> (www.aepd.es).</p>
<h2>7. Menores</h2>
<p>Los servicios de Appo se dirigen a empresas y profesionales. No tratamos conscientemente datos de menores de 14 años.</p>
<h2>8. Seguridad</h2>
<p>Aplicamos medidas técnicas y organizativas razonables para proteger los datos frente a accesos no autorizados, pérdida o alteración.</p>
<h2>9. Cambios en esta política</h2>
<p>Podemos actualizar esta política para reflejar cambios legales o de nuestros servicios. La fecha de la última actualización figura al principio de la página.</p>
""" % dict(rs=dato("razon_social", "razón social"), nif=dato("nif", "NIF/CIF"), dom=dato("domicilio", "domicilio"))

COOK = """<h1>Política de cookies</h1>
<p class="act">Última actualización: 11 de noviembre de 2026</p>
<h2>1. Qué son las cookies</h2>
<p>Las cookies son pequeños archivos que un sitio web guarda en tu dispositivo para recordar información o medir cómo se usa. Esta política cumple el artículo 22.2 de la LSSI-CE y la guía sobre el uso de cookies de la Agencia Española de Protección de Datos.</p>
<h2>2. Qué usamos y para qué</h2>
<div class="tabla"><table>
<tr><th>Tipo</th><th>Nombre / proveedor</th><th>Finalidad</th><th>Duración</th><th>¿Necesita consentimiento?</th></tr>
<tr><td>Necesaria</td><td><code>appo_consent_v1</code> (almacenamiento local, propio)</td><td>Recordar tu elección sobre cookies.</td><td>13 meses</td><td>No</td></tr>
<tr><td>Analítica</td><td><code>_ga</code>, <code>_ga_*</code> (Google Analytics)</td><td>Medir visitas, páginas vistas y clics en botones, de forma agregada, para mejorar la web.</td><td>Hasta 2 años</td><td><strong>Sí</strong>: solo se cargan si las aceptas.</td></tr>
<tr><td>Publicidad</td><td><code>_gcl_*</code> y otras de Google Ads</td><td>Medir si un anuncio ha generado una reserva y mostrar anuncios más relevantes.</td><td>Hasta 13 meses</td><td><strong>Sí</strong>: solo se cargan si las aceptas.</td></tr>
<tr><td>Funcional de tercero</td><td>Cal.com (calendario de reservas incrustado)</td><td>Hacer funcionar la reserva de la auditoría. Puede instalar cookies técnicas propias de su servicio.</td><td>Según Cal.com</td><td>Técnicas: no. Consulta su <a href="https://cal.com/privacy" rel="noopener">política de privacidad</a>.</td></tr>
</table></div>
<p>La analítica y la publicidad están <strong>desactivadas por defecto</strong>: no se cargan hasta que las aceptas. Las tipografías de Google Fonts no instalan cookies, pero tu navegador se conecta a los servidores de Google para descargarlas (ver <a href="/privacidad">política de privacidad</a>). Las cookies de Google pueden implicar transferencias de datos a EE. UU.</p>
<h2>3. Cómo gestionar o retirar tu consentimiento</h2>
<p>Puedes cambiar tu elección en cualquier momento: <button type="button" data-abrir-cookies style="font:inherit;font-weight:700;color:#0E4D9D;background:none;border:0;padding:0;text-decoration:underline;cursor:pointer">cambiar mis preferencias de cookies</button>. Rechazar las cookies no afecta al uso de la web.</p>
<p>También puedes bloquear o borrar las cookies desde tu navegador: <a href="https://support.google.com/chrome/answer/95647" rel="noopener">Chrome</a>, <a href="https://support.mozilla.org/es/kb/habilitar-y-deshabilitar-cookies-sitios-web-rastrear-preferencias" rel="noopener">Firefox</a>, <a href="https://support.apple.com/es-es/guide/safari/sfri11471/mac" rel="noopener">Safari</a>, <a href="https://support.microsoft.com/es-es/microsoft-edge/eliminar-las-cookies-en-microsoft-edge-63947406-40ac-c3b8-57b9-2a946a29ae09" rel="noopener">Edge</a>. Para desactivar Google Analytics en todos los sitios, puedes usar el <a href="https://tools.google.com/dlpage/gaoptout?hl=es" rel="noopener">complemento de inhabilitación de Google</a>.</p>
<h2>4. Responsable</h2>
<p>El responsable del sitio es %(rs)s (Appo). Más datos en el <a href="/aviso-legal">aviso legal</a>. Para cualquier duda: <a href="mailto:info@joinappo.com">info@joinappo.com</a>.</p>
<h2>5. Cambios</h2>
<p>Actualizaremos esta política si cambian las cookies que usamos. Si el cambio afecta a las finalidades, volveremos a pedirte tu elección.</p>
""" % dict(rs=dato("razon_social", "razón social"))

PAGINAS = [
    ("aviso-legal", "Aviso legal · " + TIT_SUFIJO, "Aviso legal de Appo: titular, condiciones de uso y responsabilidad del sitio joinappo.com. IA para pymes: WhatsApp, llamadas, citas, facturación y CRM.", AVISO),
    ("privacidad", "Política de privacidad · " + TIT_SUFIJO, "Política de privacidad de Appo: qué datos tratamos, para qué, durante cuánto tiempo y cómo ejercer tus derechos RGPD.", PRIV),
    ("cookies", "Política de cookies · " + TIT_SUFIJO, "Política de cookies de Appo: qué cookies usamos (analítica y publicidad solo con tu consentimiento) y cómo cambiar tu elección.", COOK),
]
for slug, t, d, c in PAGINAS:
    open("%s/%s.html" % (OUT, slug), "w", encoding="utf-8").write(pagina(slug, t, d, c))

# ---------- 7. robots, sitemap, vercel.json, site.js ----------
open(OUT + "/robots.txt", "w").write("User-agent: *\nAllow: /\n\nSitemap: %s/sitemap.xml\n" % SITE)
urls = [("/", "1.0"), ("/aviso-legal", "0.2"), ("/privacidad", "0.2"), ("/cookies", "0.2")]
open(OUT + "/sitemap.xml", "w").write('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    "".join("  <url><loc>%s%s</loc><lastmod>%s</lastmod><priority>%s</priority></url>\n" % (SITE, u, HOY, p) for u, p in urls) + "</urlset>\n")
json.dump({
    "framework": None, "buildCommand": None, "installCommand": None, "outputDirectory": ".",
    "cleanUrls": True, "trailingSlash": False,
    "headers": [
        {"source": "/assets/(.*)", "headers": [{"key": "Cache-Control", "value": "public, max-age=3600, stale-while-revalidate=86400"}]},
        {"source": "/(.*)", "headers": [{"key": "X-Content-Type-Options", "value": "nosniff"}, {"key": "Referrer-Policy", "value": "strict-origin-when-cross-origin"}]},
    ]}, open(OUT + "/vercel.json", "w"), indent=2)
shutil.copy(HERE + "/site.js", OUT + "/assets/site.js")
print("OK", sorted(os.listdir(OUT)), {f: os.path.getsize(OUT + "/assets/" + f) for f in os.listdir(OUT + "/assets")}, os.path.getsize(OUT + "/index.html"))
