# joinappo.com · landing nueva

Página estática (HTML + CSS + JS sin dependencias) para sustituir la web actual, que solo habla de clínicas de fisioterapia. Objetivo: que el visitante **reserve la auditoría gratis de 30 minutos**.

## Qué incluye

| Sección | Para qué sirve |
|---|---|
| Hero con conversación de WhatsApp animada | Explica Appo en 5 segundos y lleva a reservar |
| «Ya confían en Appo» | Hairline Pro y +EnergIA (con su permiso) |
| Problema + **calculadora de pérdidas** | El visitante ve en euros lo que pierde y pulsa «Quiero recuperarlo» |
| Soluciones | Los 8 módulos con su etiqueta (gana más, pierde menos, cumple) y su precio «desde» |
| Cómo funciona | Auditoría → informe y demo en 24 h → implantación |
| Sectores | Para quién es |
| Precios | Los 3 packs con selector por tamaño de empresa (precios del plan de empresa, sin IVA) |
| Lo que viene | Verifactu, factura electrónica y fichaje digital |
| Preguntas frecuentes | Resuelve las objeciones antes de la llamada |
| Reserva | Calendario de Cal.com incrustado, directo al evento `cal.com/mario-joinappo/consultoria-appo` |

En móvil hay un botón fijo abajo de «Reservar auditoría gratis».

## Publicarla en Vercel

1. En Vercel: **Add New → Project**, elige este repositorio y en **Root Directory** pon `web/joinappo`.
2. Framework: **Other**. Sin comando de build. Directorio de salida: `.` (la raíz).
3. En **Settings → Domains**, mueve `joinappo.com` y `www.joinappo.com` del proyecto antiguo (el de v0) a este.

## Antes de publicar

- [ ] Crear las páginas **/aviso-legal**, **/privacidad** y **/cookies** (obligatorias en España por la LSSI y el RGPD). El pie ya enlaza a ellas.
- [ ] Confirmar que Hairline Pro y +EnergIA han dado permiso para mostrar su logo.
- [ ] Confirmar que la oferta de lanzamiento (alta al 50 % para los 5 primeros) sigue en pie, o quitar el bloque `.lanzamiento`.
- [ ] En Cal.com: cambiar la bio del perfil (todavía dice «Ayudo a clínicas de fisioterapia…»), renombrar «Consultoría gratuita Appo» a «Auditoría gratis de automatización», poner la duración que prometáis (la web dice 30 min y el evento dura 15) y ocultar el evento «CRM Hairline Appo AI».
- [ ] Si queréis medir conversiones, añadir Meta Pixel o Google Analytics: todos los botones llevan `data-cta` para saber cuál se pulsa.

## Archivos

- `index.html`: la página entera.
- `assets/`: logo horizontal y favicons oficiales de la guía de marca, imagen para compartir (`og.jpg`) y logos de clientes.
