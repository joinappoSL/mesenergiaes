// Función «messy» retirada.
//
// Era el bot de MESENERGIA (verificaciones de backoffice, gráfica del mes,
// objetivo mensual y el asistente privado por WhatsApp). MESENERGIA se dio de
// baja, así que esta función ya no hace nada: responde 200 para que cualquier
// webhook de Whapi que todavía apunte aquí no dé error, pero no procesa nada.
//
// Los avisos de leads de APPO van por la función aparte `messy-leads`, que no
// se ve afectada.
Deno.serve(() =>
  new Response(JSON.stringify({ ok: true, retirado: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  }),
);
