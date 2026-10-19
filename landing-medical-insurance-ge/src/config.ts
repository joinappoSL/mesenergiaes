// Datos del negocio: único sitio que hay que tocar para publicar la landing.
// Los campos vacíos ocultan automáticamente el botón, enlace o etiqueta que dependen de ellos.

export interface Testimonio {
  /** Nombre y apellido reales (con autorización por escrito para publicarlos). */
  nombre: string;
  /** Ocupación y ciudad, p. ej. «Dueña de restaurante · Houston, TX». */
  cargo: string;
  /** Ruta a la foto en /public, p. ej. «/testimonios/maria-lopez.webp» (cuadrada, 160 px). */
  foto: string;
  /** Cómo estaba antes de contratar. */
  antes: string;
  /** Qué consiguió con la agencia. */
  despues: string;
}

export const negocio = {
  nombre: 'Medical Insurance GE LLC',
  nombreCorto: 'Medical Insurance GE',
  /** Dominio final con https y sin barra al final, p. ej. «https://medicalinsurancege.com». */
  dominio: '',
  /** Teléfono en formato E.164, p. ej. «+13055551234». */
  telefono: '',
  /** Número de WhatsApp solo con dígitos y prefijo de país, p. ej. «13055551234». */
  whatsapp: '',
  email: '',
  /** Texto libre, p. ej. «Lunes a viernes de 9:00 a 19:00 (hora del Este)». */
  horario: '',
  /** Dirección postal de la LLC para el aviso legal. */
  direccion: '',
  /** National Producer Number del agente o la agencia. */
  npn: '',
  /**
   * URL que recibe los leads del formulario por POST (JSON): webhook del CRM, Formspree, Supabase…
   * Si está vacía, el formulario abre WhatsApp con los datos ya escritos; sin WhatsApp, abre el email.
   */
  formEndpoint: '',
};

export const testimonios: Testimonio[] = [];
