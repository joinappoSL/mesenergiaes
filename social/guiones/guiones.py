"""Guiones para grabar a cámara (Appo + IA). Genera GUIONES_APPO.pdf y GUIONES_APPO.md.
Uso: python3 guiones.py
"""
from pathlib import Path

G = [
 dict(t="La IA no te va a quitar el trabajo", tipo="Opinión · polémica", dur="35 s",
  gancho="La IA no te va a quitar el trabajo. Te lo va a quitar alguien que sepa usarla.",
  cuerpo=["Y no hablo de programadores. Hablo de la peluquería de al lado, del taller, de la clínica.",
          "El negocio que contesta el WhatsApp en un minuto se lleva el cliente. El que tarda tres horas, lo pierde.",
          "Y eso hoy ya lo hace una IA, a las tres de la mañana y en domingo."],
  cierre="¿Tu negocio está en el lado bueno o en el malo? Te leo en comentarios.",
  pantalla=["La IA no te quitará el trabajo…", "…te lo quitará quien la use", "¿En qué lado estás?"],
  recursos="Plano fijo a cámara. Corte seco tras la primera frase. Zoom rápido en «alguien que sepa usarla»."),
 dict(t="3 cosas que haces a mano y una IA hace sola", tipo="Valor · lista", dur="40 s",
  gancho="Si todavía haces estas tres cosas a mano, estás perdiendo horas cada semana.",
  cuerpo=["Una: contestar WhatsApp. Una IA responde al momento, resuelve dudas y da cita.",
          "Dos: recordar citas. Le escribe al cliente el día antes y los plantones bajan muchísimo.",
          "Tres: hacer facturas. Se generan solas y te avisa de quién no ha pagado."],
  cierre="Guárdalo y mándaselo a alguien que tenga un negocio.",
  pantalla=["3 cosas que ya no deberías hacer a mano", "1. Contestar WhatsApp", "2. Recordar citas", "3. Hacer facturas"],
  recursos="Levanta 1, 2 y 3 dedos en cada punto. Inserta grabación de pantalla del WhatsApp de Appo contestando."),
 dict(t="El error que comete casi todo el mundo con ChatGPT", tipo="Truco IA", dur="35 s",
  gancho="Casi todo el mundo usa la IA mal. Y es por esto.",
  cuerpo=["Le escribes: «hazme un post para Instagram». Y te da algo genérico que no sirve.",
          "Haz esto: dile quién eres, qué quieres conseguir y dale un ejemplo.",
          "Por ejemplo: «Soy una peluquería de Barcelona, quiero llenar los martes, escribe como en este post que te pego». La diferencia es brutal."],
  cierre="Pruébalo hoy y cuéntame qué tal.",
  pantalla=["Usas la IA mal (y es por esto)", "Mal: «Hazme un post»", "Bien: quién eres + objetivo + ejemplo"],
  recursos="Graba la pantalla del móvil con el prompt malo y el bueno, uno detrás de otro."),
 dict(t="¿Cuánto te cuesta una llamada perdida?", tipo="Venta · cálculo", dur="40 s",
  gancho="Te voy a calcular cuánto dinero pierdes al mes por no coger el teléfono.",
  cuerpo=["Pongamos que pierdes [X] llamadas a la semana porque estás atendiendo.",
          "Si solo la mitad eran clientes nuevos y cada uno te deja [X] euros…",
          "Son [X] euros al mes. Al año, [X]. Por no coger el teléfono."],
  cierre="En Appo una recepcionista de IA coge todas tus llamadas. Pide tu auditoría gratis, el enlace está en mi perfil.",
  pantalla=["¿Cuánto pierdes por no coger el teléfono?", "[X] € al mes", "[X] € al año"],
  recursos="Escribe los números en un papel o pizarra mientras hablas. Usa un ejemplo real de un sector (peluquería, clínica…)."),
 dict(t="Por qué creé Appo", tipo="Historia del fundador", dur="45 s",
  gancho="Creé Appo por algo que vi pasar en [negocio / familia / trabajo].",
  cuerpo=["[Cuenta la situación real: un negocio que perdía clientes, alguien que no llegaba a todo…]",
          "Me di cuenta de que la IA ya podía hacer ese trabajo repetitivo, pero que a las pymes nadie se lo explicaba ni se lo montaba.",
          "Así que eso es Appo: te montamos la IA que contesta, agenda y factura por ti, para que tú te dediques a tu negocio."],
  cierre="Sígueme si quieres ver cómo lo hacemos, paso a paso.",
  pantalla=["Por qué creé Appo", "[frase clave de tu historia]", "IA para pymes, sin complicaciones"],
  recursos="Plano más cercano y luz cálida. Si tienes fotos de los inicios, mételas de fondo."),
 dict(t="Chatbot vs agente de IA en 30 segundos", tipo="Explicación", dur="30 s",
  gancho="No es lo mismo un chatbot que un agente de IA. Y esta diferencia te va a ahorrar dinero.",
  cuerpo=["Un chatbot te contesta. Y ya.",
          "Un agente hace el trabajo: lee el mensaje, mira tu agenda, da la cita y le manda la confirmación al cliente.",
          "Uno es un contestador. El otro, un empleado que no duerme."],
  cierre="¿Quieres que te enseñe uno funcionando? Comenta AGENTE.",
  pantalla=["Chatbot vs Agente de IA", "Chatbot: contesta", "Agente: hace el trabajo"],
  recursos="Haz los dos personajes girando la cabeza a izquierda y derecha (formato de sketch)."),
 dict(t="¿La IA es cara para una pyme?", tipo="Objeción", dur="35 s",
  gancho="«La IA es cosa de empresas grandes, yo no me la puedo permitir». Vamos a verlo.",
  cuerpo=["Compáralo con lo que pagas por alguien que conteste el teléfono y el WhatsApp todo el día, incluido el fin de semana.",
          "La IA no se pone enferma, no tiene vacaciones y contesta a la vez a diez personas.",
          "La pregunta no es si puedes permitírtela. Es cuánto te cuesta no tenerla."],
  cierre="Te lo calculamos gratis en una auditoría de 30 minutos. Enlace en el perfil.",
  pantalla=["«La IA es cara»", "¿Cuánto te cuesta NO tenerla?"],
  recursos="Empieza leyendo la frase como si fuera un comentario recibido (pon el comentario en pantalla)."),
 dict(t="Le escribo a mi negocio a las 3 de la mañana", tipo="Demo en directo", dur="30 s",
  gancho="Son las tres de la mañana y voy a escribirle a un negocio a ver qué pasa.",
  cuerpo=["[Graba la pantalla: escribes «¿tenéis hueco mañana?»]",
          "Mira: contesta en segundos, me ofrece horas y me da la cita.",
          "No hay nadie despierto. Es la IA de Appo."],
  cierre="Comenta IA y te lo monto en tu negocio.",
  pantalla=["3:00 AM", "Le escribo a un negocio…", "Contesta una IA"],
  recursos="Graba de noche, con poca luz y la cara iluminada por el móvil: queda muy cinematográfico."),
 dict(t="Un prompt que te ahorra una hora al día", tipo="Truco IA", dur="30 s",
  gancho="Este prompt me ahorra una hora al día. Cópialo.",
  cuerpo=["Pega todos los correos o mensajes que tienes sin leer y escribe:",
          "«Resúmelos en una lista, dime cuáles son urgentes y prepárame una respuesta corta para cada uno».",
          "En un minuto tienes el día organizado y las respuestas hechas."],
  cierre="Guárdalo para mañana por la mañana.",
  pantalla=["El prompt que me ahorra 1 hora al día", "«Resume, prioriza y prepara respuestas»"],
  recursos="Pon el prompt entero en pantalla 3 segundos para que la gente haga captura."),
 dict(t="Día X del reto: embajadores de Claude", tipo="Serie", dur="25 s",
  gancho="Día [X] del reto para que Appo sea la primera empresa española embajadora de Claude.",
  cuerpo=["Hoy os enseño [algo que hemos construido o un truco de Claude].",
          "[Enséñalo en 10–15 segundos, en pantalla.]"],
  cierre="Seguimos mañana. Si conoces a alguien de Anthropic, pásale este vídeo.",
  pantalla=["DÍA [X]", "[el truco del día]"],
  recursos="Siempre el mismo encuadre y la misma frase de inicio: así la gente reconoce la serie."),
]

CONSEJOS = [
 "Los dos primeros segundos lo deciden todo: di el gancho nada más empezar, sin saludar.",
 "Corta cada 2–3 segundos (cambio de plano, zoom o grabación de pantalla).",
 "Subtítulos siempre (CapCut → Subtítulos automáticos) con las palabras clave en turquesa.",
 "No te lo aprendas de memoria: léelo con una app de teleprompter o con el teleprompter de CapCut y dilo con tus palabras.",
 "Graba 2 o 3 tomas de cada uno y quédate con la más natural.",
 "Graba 3 o 4 guiones seguidos el mismo día, con la misma ropa y el mismo sitio: tendrás contenido para toda la semana.",
 "Los [X] son datos tuyos reales: cámbialos antes de grabar. Nunca te inventes cifras.",
]

def md():
    o = ["# Guiones para grabar · Appo e IA\n", "## Antes de grabar\n"] + [f"- {c}" for c in CONSEJOS] + [""]
    for i, g in enumerate(G, 1):
        o += [f"## {i}. {g['t']}", f"*{g['tipo']} · {g['dur']}*\n", f"**Gancho:** «{g['gancho']}»\n", "**Desarrollo:**"]
        o += [f"- {x}" for x in g["cuerpo"]]
        o += [f"\n**Cierre:** «{g['cierre']}»\n", "**Texto en pantalla:** " + " → ".join(g["pantalla"]) + "\n", f"**Planos:** {g['recursos']}\n"]
    return "\n".join(o)

def pdf(path):
    from reportlab.lib.pagesizes import A5
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak, Image, Table, TableStyle
    from reportlab.lib.styles import ParagraphStyle
    from reportlab.lib.colors import HexColor
    from reportlab.lib.units import mm
    BLUE, TURQ, GREY, INK = HexColor("#0E4D9D"), HexColor("#26B9CC"), HexColor("#5b6475"), HexColor("#1d2433")
    S = lambda n, **k: ParagraphStyle(n, fontName=k.pop("f", "Helvetica"), **k)
    tit = S("t", f="Helvetica-Bold", fontSize=16, leading=19, textColor=BLUE, spaceAfter=2)
    meta = S("m", fontSize=8.5, leading=11, textColor=TURQ, spaceAfter=8)
    lab = S("l", f="Helvetica-Bold", fontSize=8, leading=10, textColor=GREY, spaceBefore=6, spaceAfter=2)
    hook = S("h", f="Helvetica-Bold", fontSize=13, leading=17, textColor=INK)
    body = S("b", fontSize=11.5, leading=16, textColor=INK, spaceAfter=4)
    small = S("s", fontSize=8.8, leading=12, textColor=GREY)
    logo = Path(__file__).resolve().parent.parent / "assets" / "logo_h.png"
    def header(c, d):
        c.saveState(); c.setFillColor(TURQ); c.rect(0, d.pagesize[1] - 5, d.pagesize[0], 5, stroke=0, fill=1)
        c.setFont("Helvetica", 7.5); c.setFillColor(GREY); c.drawRightString(d.pagesize[0] - 12*mm, 8*mm, f"joinappo.com · {d.page}"); c.restoreState()
    doc = SimpleDocTemplate(str(path), pagesize=A5, leftMargin=12*mm, rightMargin=12*mm, topMargin=12*mm, bottomMargin=14*mm,
                            title="Guiones para grabar · Appo e IA", author="Appo")
    st = []
    im = Image(str(logo)); im._restrictSize(40*mm, 14*mm); st += [im, Spacer(1, 10)]
    st += [Paragraph("Guiones para grabar", S("c", f="Helvetica-Bold", fontSize=24, leading=28, textColor=BLUE)),
           Paragraph("10 vídeos a cámara sobre Appo e IA", S("c2", fontSize=12, leading=16, textColor=TURQ, spaceAfter=14))]
    rows = [[f"{i}", g["t"], g["dur"]] for i, g in enumerate(G, 1)]
    t = Table(rows, colWidths=[8*mm, 92*mm, 16*mm])
    t.setStyle(TableStyle([("FONT", (0, 0), (-1, -1), "Helvetica", 9.5), ("TEXTCOLOR", (0, 0), (0, -1), TURQ),
                           ("FONT", (0, 0), (0, -1), "Helvetica-Bold", 9.5), ("TEXTCOLOR", (2, 0), (2, -1), GREY),
                           ("LINEBELOW", (0, 0), (-1, -1), 0.3, HexColor("#d9e1f0")), ("BOTTOMPADDING", (0, 0), (-1, -1), 5)]))
    st += [t, Spacer(1, 12), Paragraph("ANTES DE GRABAR", lab)] + [Paragraph("• " + c, small) for c in CONSEJOS]
    for i, g in enumerate(G, 1):
        st += [PageBreak(), Paragraph(f"{i}. {g['t']}", tit), Paragraph(f"{g['tipo'].upper()} · {g['dur']}", meta),
               Paragraph("GANCHO · 0–3 s", lab), Paragraph(f"«{g['gancho']}»", hook), Paragraph("DESARROLLO", lab)]
        st += [Paragraph(x, body) for x in g["cuerpo"]]
        st += [Paragraph("CIERRE", lab), Paragraph(f"«{g['cierre']}»", S("cl", f="Helvetica-Bold", fontSize=11.5, leading=16, textColor=BLUE)),
               Paragraph("TEXTO EN PANTALLA", lab), Paragraph(" → ".join(g["pantalla"]), small),
               Paragraph("PLANOS", lab), Paragraph(g["recursos"], small)]
    doc.build(st, onFirstPage=header, onLaterPages=header)

if __name__ == "__main__":
    here = Path(__file__).resolve().parent
    (here / "GUIONES_APPO.md").write_text(md(), encoding="utf-8")
    pdf(here / "GUIONES_APPO.pdf")
    print("OK")
