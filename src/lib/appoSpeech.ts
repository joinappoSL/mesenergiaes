// Speech de ventas de Appo para llamadas en frío: el objetivo de la llamada es
// cerrar la AUDITORÍA GRATIS (30 min), no vender el pack por teléfono.

export interface PasoSpeech {
  titulo: string;
  objetivo: string;
  /** frases para decir tal cual; {nombre}, {empresa} y {comercial} se sustituyen */
  guion: string[];
  consejo?: string;
}

export const SPEECH_APPO: PasoSpeech[] = [
  {
    titulo: '1. Apertura (10 segundos)',
    objetivo: 'Presentarte, pedir permiso y que no cuelgue.',
    guion: [
      'Hola, ¿hablo con {nombre}? Soy {comercial}, de Appo. Te robo 30 segundos y me dices si te interesa o no, ¿vale?',
      'Te llamo porque trabajamos con {sector} de la zona y casi todos nos dicen lo mismo: se les escapan clientes por WhatsApp y llamadas que no pueden coger.',
    ],
    consejo: 'Sonríe al hablar y no leas. Si no es el responsable, pregunta: «¿Quién lleva las citas y los mensajes de los clientes?».',
  },
  {
    titulo: '2. Preguntas de dolor',
    objetivo: 'Que el cliente diga en voz alta lo que pierde. Escucha más de lo que hablas.',
    guion: [
      'Cuando estás atendiendo y suena el teléfono, ¿quién lo coge?',
      'Si alguien te escribe un WhatsApp a las 10 de la noche pidiendo cita, ¿cuándo le contestas?',
      '¿Te pasa que la gente no viene a la cita y se queda el hueco vacío?',
      '¿Cuántas horas a la semana se os van en facturas, cobros y papeleo?',
    ],
    consejo: 'Apunta las respuestas en la nota del lead: son los datos de la calculadora y de la auditoría.',
  },
  {
    titulo: '3. Cuantificar (la calculadora)',
    objetivo: 'Poner un número en euros a lo que pierde. Usa la pestaña «Calculadora».',
    guion: [
      'Hagamos una cuenta rápida: ¿cuántos mensajes o llamadas dirías que no llegas a atender a la semana? ¿Diez?',
      '¿Y cuánto te deja de media un cliente? ¿Unos 60 €?',
      'Si solo 3 de cada 10 acabaran comprando, estás dejando escapar unos 780 € al mes, casi 9.400 € al año. Y sin contar el tiempo del papeleo.',
    ],
    consejo: 'Que los números los diga el cliente. Si duda, usa los de ejemplo y dile que en la auditoría se calcula con sus datos reales.',
  },
  {
    titulo: '4. La solución en una frase',
    objetivo: 'Explicar Appo sin tecnicismos.',
    guion: [
      'Lo que hacemos en Appo es poner un asistente de inteligencia artificial en tu WhatsApp y tu teléfono: contesta al momento, a cualquier hora, da cita y la recuerda. Tú solo ves los resultados.',
      'Lo montamos, lo conectamos con lo que ya usas y lo mantenemos nosotros. No tienes que saber nada de tecnología.',
    ],
  },
  {
    titulo: '5. Cierre: la auditoría gratis',
    objetivo: 'Agendar día y hora. Da siempre dos opciones.',
    guion: [
      'Te propongo una cosa: una auditoría gratis de 30 minutos. Revisamos tus WhatsApp, llamadas, citas, facturas y papeleo, y en 24 horas te mando cuánto pierdes al mes, el pack que lo soluciona con su precio y una demo funcionando en tu móvil.',
      'Sin compromiso: si no te convence, no tienes que hacer nada más. ¿Te va mejor el martes a las 10:00 o el jueves a las 17:00? ¿Online o prefieres que pase por ahí?',
      'Perfecto, te lo apunto. Te mando ahora un WhatsApp con la cita para que lo tengas.',
    ],
    consejo: 'Marca el lead como «Auditoría agendada» con fecha y modalidad, y envíale el WhatsApp desde la ficha.',
  },
  {
    titulo: '6. En la auditoría: cerrar el pack',
    objetivo: 'Recalcular con sus datos y proponer el pack. Cierra con el lanzamiento.',
    guion: [
      'Con lo que me has contado, pierdes unos {perdidas} € al mes. El pack que lo resuelve es el {pack}, por {cuota} €/mes.',
      'Es decir, se paga solo con recuperar {clientes} clientes al mes.',
      'Además estamos en lanzamiento: los 5 primeros clientes tienen el alta al 50 % a cambio de su caso de éxito. ¿Lo dejamos en marcha esta semana?',
    ],
    consejo: 'Si duda con el pack, empieza por un módulo suelto (desde 59 €/mes) y vais sumando. Pago anual: 12 meses al precio de 10.',
  },
];

export interface Objecion {
  objecion: string;
  respuesta: string;
}

export const OBJECIONES_APPO: Objecion[] = [
  {
    objecion: '«No tengo tiempo»',
    respuesta: 'Por eso te llamo: es justo lo que te ahorramos. La auditoría son 30 minutos, cuando tú digas, y puede ser online. ¿Mejor a primera hora o a última?',
  },
  {
    objecion: '«Ya contesto yo los WhatsApp»',
    respuesta: 'Genial, eso dice mucho del negocio. ¿Y cuando estás atendiendo o es de noche? Ahí es donde se van a otro sitio. La IA solo coge lo que tú no llegas, y lo que no sabe te lo pasa a ti.',
  },
  {
    objecion: '«Es caro»',
    respuesta: 'Si pierdes unos 780 € al mes, el Pack Arranque (209 €/mes) se paga solo con 4 clientes. Y la auditoría es gratis: te digo el número exacto antes de que decidas nada.',
  },
  {
    objecion: '«La IA no me fío, los clientes quieren hablar con personas»',
    respuesta: 'Tú decides qué contesta sola y qué no. Si no sabe algo, te pasa la conversación con un resumen. Además, el cliente prefiere que le contesten en 10 segundos a esperar a mañana.',
  },
  {
    objecion: '«No sé de tecnología»',
    respuesta: 'No hace falta. Lo montamos, lo conectamos y lo mantenemos nosotros. Tu equipo sigue trabajando igual.',
  },
  {
    objecion: '«¿Funciona con mi programa?»',
    respuesta: 'En la mayoría de casos sí: lo conectamos con tu agenda, tu WhatsApp y tus herramientas. Lo revisamos en la auditoría antes de que decidas nada.',
  },
  {
    objecion: '«¿Y la protección de datos?»',
    respuesta: 'Firmamos contrato de encargado del tratamiento y trabajamos con servidores en la Unión Europea, cumpliendo el RGPD.',
  },
  {
    objecion: '«¿Hay permanencia?»',
    respuesta: 'Los packs tienen 6 meses y después van mes a mes. Los módulos sueltos, mes a mes desde el principio.',
  },
  {
    objecion: '«Mándamelo por email»',
    respuesta: 'Claro, te lo mando. Pero lo que te puedo enviar es genérico; lo que vale es ver cuánto pierdes tú. ¿Te reservo 30 minutos y te llevas el informe con tus números?',
  },
  {
    objecion: '«Ahora no, llámame más adelante»',
    respuesta: 'Sin problema. Solo una cosa: en 2027 llega Verifactu y la factura electrónica, y conviene tenerlo listo antes. ¿Te llamo el día X a esta hora?',
  },
];

export const ARGUMENTOS_LEY = [
  { cuando: '2027', que: 'Verifactu', texto: 'Los programas de facturación tendrán que cumplir Verifactu. Appo deja la facturación preparada.' },
  { cuando: '2027–2028', que: 'Factura electrónica', texto: 'Obligatoria entre empresas: primero las grandes y después todas las empresas y autónomos.' },
  { cuando: 'En camino', que: 'Fichaje digital', texto: 'El registro de jornada ya es obligatorio y el Gobierno quiere que sea solo digital. Con Appo se ficha desde el móvil.' },
];

/** Sustituye {nombre}, {empresa}… en una frase del guion. */
export function rellenarGuion(frase: string, datos: Record<string, string>): string {
  return frase.replace(/\{(\w+)\}/g, (m, k: string) => (datos[k] ? datos[k] : m));
}
