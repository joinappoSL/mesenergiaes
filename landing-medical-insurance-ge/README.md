# Landing · Medical Insurance GE LLC

Landing page de captación para Medical Insurance GE LLC, agencia de seguros médicos en Estados Unidos (Obamacare, planes Oasis y seguros complementarios), dirigida al público hispano.

**Stack:** HTML + Tailwind CSS 4 + TypeScript sin framework, compilado con Vite. Animaciones con GSAP (ScrollTrigger + SplitText) y scroll suave con Lenis; todo se desactiva si el visitante tiene activado «reducir movimiento». Resultado: HTML estático que se publica en cualquier hosting.

```bash
cd landing-medical-insurance-ge
npm install
npm run dev            # desarrollo en http://localhost:5173
npm run build          # genera dist/ listo para publicar
npm run build:archivo  # genera dist-archivo/index.html: un único archivo para enviar como vista previa
```

## Animaciones

- **Hero:** el titular entra palabra a palabra, «una sola llamada» se subraya como con rotulador, el resto aparece en cascada y los distintivos flotan sobre el formulario.
- **Cabecera** que se compacta al hacer scroll y **barra de progreso** de lectura arriba.
- **Banda infinita** con los tipos de seguro (se pausa al pasar el ratón).
- **Jerga del seguro:** los términos aparecen desordenados en rojo y, con el scroll, se alinean en azul («nosotros te lo traducimos»).
- **Pasos:** una línea se rellena con el scroll y cada número se ilumina al alcanzarlo.
- **Mapa de EE. UU.** (datos reales de us-atlas) que se dibuja de oeste a este, con las ciudades apareciendo y emitiendo pulsos.
- **Titulares** que suben por líneas desde una máscara; **tarjetas** con foco de luz que sigue al cursor; **botones magnéticos**; **pestañas** con píldora deslizante; **FAQ** con apertura suave.

El mapa se genera una sola vez a partir de `us-atlas` y está en `src/mapa-usa.svg`.

## Estructura de la página (orden de conversión)

1. **Hero** con titular, subtítulo, CTA, indicadores de confianza y formulario de cotización.
2. **Banda de confianza** con los tipos de seguro en movimiento.
3. **Problema · Agitación · Solución** + 3 pasos del proceso.
4. **Beneficios** (6, uno con el mapa de EE. UU.) + **pestañas por tipo de seguro**: Obamacare, Oasis, Complementarios.
5. **Testimonios**: la sección queda oculta hasta que haya testimonios reales en `src/config.ts`.
6. **FAQ** (7 preguntas, acordeón nativo accesible).
7. **Cierre con CTA** y **footer** con aviso de no afiliación al gobierno, NPN y enlaces legales.

Además: CTA fijo en móvil al pasar el hero, botón de WhatsApp y página `legal.html` (privacidad con consentimiento TCPA, términos y aviso legal).

## Publicar: checklist

Todo se configura en **`src/config.ts`**. Los campos vacíos ocultan el botón o texto que dependen de ellos.

- [ ] `telefono` y `whatsapp`: sin ellos no aparecen los botones de llamada/WhatsApp.
- [ ] `formEndpoint`: dónde llegan los leads (ver abajo). Sin él, el formulario abre WhatsApp con los datos; sin WhatsApp, el email.
- [ ] `email`, `horario`, `direccion`, `npn`.
- [ ] `dominio`: activa el canonical, Open Graph e imagen para compartir en redes. Hay que volver a ejecutar `npm run build`.
- [ ] `testimonios`: nombre real, ocupación y ciudad, foto en `public/testimonios/`, texto antes/después y **autorización por escrito** del cliente.
- [ ] Revisión del cliente (y de su abogado o *compliance*) de los textos marcados abajo.

### Dónde llegan los leads (`formEndpoint`)

El formulario envía por `POST` un JSON con `nombre`, `telefono` (+1…), `estado`, `para`, `consentimiento_tcpa`, `texto_consentimiento`, `origen` y `fecha`. Sirve cualquier receptor que acepte JSON: un webhook del CRM/SaaS, Formspree, Make/Zapier o una tabla de Supabase vía Edge Function. Guardar el texto del consentimiento con fecha sirve como prueba ante una reclamación TCPA.

### Hosting

**GitHub Pages (incluido):** si esta carpeta es la raíz de su propio repositorio, `.github/workflows/pages.yml` compila y publica la web en cada push a `main`. Solo hay que activarlo una vez en **Settings → Pages → Source: GitHub Actions**. Para el dominio propio: **Settings → Pages → Custom domain**.

Otras opciones (`npm run build` y subir `dist/`), también con dominio propio y HTTPS gratis:

- **Vercel / Netlify / Cloudflare Pages:** conectar el repo con *Root directory* `landing-medical-insurance-ge`, *Build command* `npm run build` y *Output* `dist`. Después se añade el dominio en el panel del hosting y se apuntan los DNS.

## Textos que el cliente debe confirmar antes de publicar

| Texto | Dónde | Por qué |
|---|---|---|
| «Sin costo y sin compromiso» / «La asesoría no tiene costo» | Hero, FAQ | Debe ser cierto: la agencia cobra comisión de la aseguradora, no al cliente. |
| «En todo Estados Unidos» / «cualquier ciudad» | Hero, beneficios, FAQ | La agencia o sus agentes necesitan licencia en cada estado donde venden. Si no la tienen en todos, hay que limitar la lista de estados. |
| Descripción de **planes Oasis** | Pestaña Oasis, FAQ | Hay que confirmar qué son exactamente y sus condiciones. |
| «Sin importar su estatus» | Beneficios, FAQ | Se redactó de forma veraz: hay opciones para todos, pero Obamacare exige estatus migratorio elegible. No hay que prometer Obamacare a quien no califica. |
| Fechas de inscripción abierta 2027 | Hero, FAQ | Calendario de HealthCare.gov. Los estados con mercado propio pueden tener otras fechas. |
| Acompañamiento después de inscribirse | Beneficios | Debe ser un servicio real. |

**Logos de aseguradoras:** solo se pueden mostrar las compañías con las que la agencia esté nombrada (*appointed*) y con permiso de uso de marca. Por eso la barra de confianza muestra tipos de seguro y no logos. Cuando haya autorización, se pueden añadir en la misma sección.
