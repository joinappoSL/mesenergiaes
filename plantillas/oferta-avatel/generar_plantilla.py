"""Genera la plantilla Excel de ofertas AVATEL de MESENERGIA (+Energía).

Hojas:
  DATOS   -> se rellena durante la llamada (celdas amarillas).
  OFERTA  -> documento corporativo para el cliente; se actualiza solo y se exporta a PDF.
  TARIFAS -> precios y textos del tarifario AVATEL (editable cuando cambie el tarifario).
  CALC    -> cálculos auxiliares (oculta).

Uso:  python3 generar_plantilla.py [salida.xlsx]
"""

import sys
from datetime import date
from pathlib import Path

from openpyxl import Workbook
from openpyxl.drawing.image import Image
from openpyxl.formatting.rule import FormulaRule
from openpyxl.styles import Alignment, Border, Font, PatternFill, Protection, Side
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.worksheet.properties import PageSetupProperties

AQUI = Path(__file__).resolve().parent
LOGO = AQUI.parent.parent / "public" / "logo.png"
SALIDA = Path(sys.argv[1]) if len(sys.argv) > 1 else AQUI / "Oferta_AVATEL_MesEnergia.xlsx"

# Paleta de la marca (src/index.css)
NAVY = "0F1E43"
NAVY_700 = "1B3263"
NAVY_100 = "D9E1F0"
NAVY_50 = "EEF2F9"
VERDE = "6CA83C"
VERDE_50 = "F2F8EC"
SOL = "F5C030"
INPUT = "FFF4CC"
AUTO = "F4F6FA"
GRIS = "5B6475"
BLANCO = "FFFFFF"
FUENTE = "Arial"

EURO = '#,##0.00 "€"'
FECHA = "dd/mm/yyyy"


def font(size=10, bold=False, color=NAVY, italic=False):
    return Font(name=FUENTE, size=size, bold=bold, color=color, italic=italic)


def fill(color):
    return PatternFill("solid", start_color=color, end_color=color)


def side(color=NAVY_100, style="thin"):
    return Side(style=style, color=color)


def borde(color=NAVY_100):
    s = side(color)
    return Border(left=s, right=s, top=s, bottom=s)


def escribir(ws, ref, valor=None, *, f=None, bg=None, al=None, fmt=None, merge=None, bd=None):
    """Escribe una celda (y opcionalmente la combina) aplicando estilo a todo el rango."""
    celda = ws[ref]
    if valor is not None:
        celda.value = valor
    rango = f"{ref}:{merge or ref}"
    if merge:
        ws.merge_cells(rango)
    for fila in ws[rango]:
        for c in fila:
            if f:
                c.font = f
            if bg:
                c.fill = fill(bg)
            if al:
                c.alignment = al
            if fmt:
                c.number_format = fmt
            if bd:
                c.border = bd
    return celda


def alto(ws, fila, puntos):
    ws.row_dimensions[fila].height = puntos


def logo(ws, ancla, alto_px):
    img = Image(str(LOGO))
    proporcion = img.width / img.height
    img.height = alto_px
    img.width = round(alto_px * proporcion)
    ws.add_image(img, ancla)


IZQ = Alignment(horizontal="left", vertical="center", wrap_text=True, indent=1)
IZQ_ARRIBA = Alignment(horizontal="left", vertical="top", wrap_text=True)
DER = Alignment(horizontal="right", vertical="center")
CENTRO = Alignment(horizontal="center", vertical="center", wrap_text=True)
DESBLOQUEADA = Protection(locked=False)

wb = Workbook()
datos = wb.active
datos.title = "DATOS"
oferta = wb.create_sheet("OFERTA")
tarifas = wb.create_sheet("TARIFAS")
calc = wb.create_sheet("CALC")

# ---------------------------------------------------------------------------
# TARIFAS: tarifario AVATEL + datos de empresa + textos de la oferta
# ---------------------------------------------------------------------------
t = tarifas
t.sheet_properties.tabColor = NAVY
t.sheet_view.showGridLines = False
for col, ancho in zip("ABCDEF", (30, 28, 74, 14, 26, 16)):
    t.column_dimensions[col].width = ancho

escribir(t, "A1", "TARIFAS AVATEL · Oferta comercial cliente nuevo", f=font(14, True), merge="F1")
escribir(
    t,
    "A2",
    "Fuente: tarifario AVATEL Telecom + Energía (vigencia 18/08/2026 – 15/10/2026). "
    "Las celdas amarillas se pueden actualizar cuando cambie el tarifario: la oferta se recalcula sola.",
    f=font(9, color=GRIS, italic=True),
    al=Alignment(wrap_text=True, vertical="top"),
    merge="F2",
)
alto(t, 2, 26)


def cabecera_tabla(ws, fila, textos, desde="A"):
    col0 = ord(desde)
    for i, texto in enumerate(textos):
        escribir(
            ws,
            f"{chr(col0 + i)}{fila}",
            texto,
            f=font(9, True, BLANCO),
            bg=NAVY_700,
            al=CENTRO,
            bd=borde(NAVY_700),
        )


def titulo_seccion_tarifas(fila, texto):
    escribir(t, f"A{fila}", texto, f=font(11, True, VERDE), merge=f"F{fila}")
    for c in t[f"A{fila}:F{fila}"][0]:
        c.border = Border(bottom=side(VERDE, "medium"))


# Paquetes (filas 6-9)
titulo_seccion_tarifas(4, "PAQUETES")
cabecera_tabla(
    t,
    5,
    [
        "Tarifa",
        "Nombre en la oferta",
        "Qué incluye (referencia interna)",
        "Líneas móviles incluidas",
        "Datos de las líneas incluidas",
        "Precio €/mes (IVA incl.)",
    ],
)
alto(t, 5, 30)
PAQUETES = [
    ("Conecta Fibra", "Conecta Fibra prime",
     "Fibra 1000 Mb · Router WiFi 6 · Instalación gratis · 12 meses de Amazon Prime",
     0, "—", 19.99),
    ("Conecta Sencillo", "Conecta Sencillo prime",
     "Fibra 1000 Mb · Router WiFi 6 · Instalación gratis · 1 línea móvil 100 GB acumulables "
     "con llamadas ilimitadas · 12 meses de Amazon Prime",
     1, "100 GB acumulables", 24.99),
    ("Conecta Doble", "Conecta Doble prime",
     "Fibra 1000 Mb · Router WiFi 6 · Instalación gratis · 2 líneas móviles 5G 100 GB acumulables "
     "con llamadas ilimitadas · 12 meses de Amazon Prime",
     2, "100 GB acumulables (5G)", 34.99),
    ("Conecta Sin Límites", "Conecta Sin Límites prime",
     "Fibra 1000 Mb · Router WiFi 6 · Instalación gratis · 2 líneas móviles 5G con datos ilimitados "
     "y llamadas ilimitadas · 12 meses de Amazon Prime",
     2, "Datos ilimitados (5G)", 39.99),
]
for i, (clave, nombre, incluye, lineas, datos_inc, precio) in enumerate(PAQUETES):
    r = 6 + i
    alto(t, r, 30)
    escribir(t, f"A{r}", clave, f=font(10, True), al=IZQ, bd=borde())
    for col, valor, fmt, al in (
        ("B", nombre, None, IZQ),
        ("C", incluye, None, IZQ),
        ("D", lineas, "0", CENTRO),
        ("E", datos_inc, None, IZQ),
        ("F", precio, EURO, CENTRO),
    ):
        escribir(t, f"{col}{r}", valor, f=font(10), bg=INPUT, al=al, fmt=fmt, bd=borde())

# Bonos líneas adicionales (cabecera fila 12, matriz B13:E16)
titulo_seccion_tarifas(11, "BONOS PARA LÍNEAS MÓVILES ADICIONALES (€/mes) · todas con llamadas ilimitadas · máx. 5 líneas por cliente")
BONOS = ["25 GB", "50 GB", "100 GB acumulables", "Datos ilimitados"]
cabecera_tabla(t, 12, ["Tarifa"] + BONOS)
alto(t, 12, 22)
MATRIZ = {
    "Conecta Fibra": [5.00, None, None, 12.00],
    "Conecta Sencillo": [5.00, 7.50, None, 12.00],
    "Conecta Doble": [None, None, 5.00, None],
    "Conecta Sin Límites": [None, None, None, 10.00],
}
for i, (clave, *_rest) in enumerate(PAQUETES):
    r = 13 + i
    escribir(t, f"A{r}", clave, f=font(10, True), al=IZQ, bd=borde())
    for j, precio in enumerate(MATRIZ[clave]):
        col = "BCDE"[j]
        escribir(t, f"{col}{r}", precio if precio is not None else "—",
                 f=font(10, color=NAVY if precio is not None else GRIS), bg=INPUT,
                 al=CENTRO, fmt=EURO, bd=borde())
escribir(t, "A17", "«—» = bono no disponible con esa tarifa.", f=font(8, color=GRIS, italic=True), merge="F17")

# Extras (filas 21-24)
titulo_seccion_tarifas(19, "EXTRAS (€/mes)")
cabecera_tabla(t, 20, ["Concepto", "€/mes", "Nota"])
EXTRAS = [
    ("Línea de teléfono fijo", 5.00, "1.000 min a fijos y 1.000 min a móviles nacionales"),
    ("Televisión CLICtv (con deco)", 5.00, ""),
    ("Canal Local CLICtv", 0.00, "Gratuito hasta el 31/12/2026 según el tarifario; actualiza el precio cuando cambie"),
    ("Conecta Mesh (por dispositivo)", 3.99, ""),
]
for i, (concepto, precio, nota) in enumerate(EXTRAS):
    r = 21 + i
    escribir(t, f"A{r}", concepto, f=font(10, True), al=IZQ, bd=borde())
    escribir(t, f"B{r}", precio, f=font(10), bg=INPUT, al=CENTRO, fmt=EURO, bd=borde())
    escribir(t, f"C{r}", nota, f=font(9, color=GRIS), al=IZQ, bd=borde())

# Datos de empresa (filas 27-32)
titulo_seccion_tarifas(26, "DATOS DE EMPRESA (aparecen en la oferta)")
EMPRESA = [
    ("Empresa", "MESENERGIA"),
    ("Web", "www.mesenergia.es"),
    ("Email de contacto", None),
    ("Teléfono de contacto", None),
    ("Operadora", "AVATEL"),
    ("Texto de presentación",
     "En MESENERGIA somos distribuidores oficiales de AVATEL y comercializamos ofertas exclusivas "
     "diseñadas específicamente para nuestros clientes, con condiciones preferentes y promociones "
     "especiales no disponibles en otros canales."),
]
for i, (concepto, valor) in enumerate(EMPRESA):
    r = 27 + i
    escribir(t, f"A{r}", concepto, f=font(10, True), al=IZQ, bd=borde())
    escribir(t, f"B{r}", valor, f=font(10), bg=INPUT, al=IZQ, merge=f"C{r}", bd=borde())
alto(t, 32, 44)

# Textos de los servicios (filas 35-40)
titulo_seccion_tarifas(34, "TEXTOS DE LA OFERTA (lo que lee el cliente)")
TEXTOS = [
    ("Fibra óptica",
     "Conexión a Internet de alta velocidad mediante red de fibra óptica de 1 Gb (1000 Mb), "
     "con router WiFi 6 incluido e instalación gratuita."),
    ("Teléfono fijo (tras el número)",
     "con 1.000 minutos a fijos y 1.000 minutos a móviles nacionales."),
    ("Televisión",
     "Servicio de televisión CLICtv con decodificador incluido, para disfrutar de tus canales "
     "y contenidos favoritos."),
    ("Canal Local",
     "Incluye además el Canal Local de CLICtv, con LALIGA HYPERMOTION y PRIMERA RFEF."),
    ("Amazon Prime",
     "12 meses de Amazon Prime incluidos con tu tarifa, conforme a las condiciones del "
     "proveedor del servicio."),
    ("Nota al pie",
     "Precios con IVA incluido. Servicios prestados por AVATEL, sujetos a cobertura y a la "
     "validación de los datos del titular por parte de la operadora."),
]
for i, (concepto, valor) in enumerate(TEXTOS):
    r = 35 + i
    alto(t, r, 30)
    escribir(t, f"A{r}", concepto, f=font(10, True), al=IZQ, bd=borde())
    escribir(t, f"B{r}", valor, f=font(10), bg=INPUT, al=IZQ, merge=f"C{r}", bd=borde())

t.page_setup.paperSize = t.PAPERSIZE_A4
t.page_setup.orientation = "landscape"
t.sheet_properties.pageSetUpPr = PageSetupProperties(fitToPage=True)
t.page_setup.fitToWidth = 1
t.page_setup.fitToHeight = 0

T_PAQ = "TARIFAS!$A$6:$A$9"
T_NOMBRE = "TARIFAS!$B$6:$B$9"
T_INCLUYE = "TARIFAS!$C$6:$C$9"
T_LINEAS = "TARIFAS!$D$6:$D$9"
T_DATOS = "TARIFAS!$E$6:$E$9"
T_PRECIO = "TARIFAS!$F$6:$F$9"
T_BONOS = "TARIFAS!$B$12:$E$12"
T_MATRIZ_PAQ = "TARIFAS!$A$13:$A$16"
T_MATRIZ = "TARIFAS!$B$13:$E$16"
T_FIJO, T_TV, T_CANAL, T_MESH = "TARIFAS!$B$21", "TARIFAS!$B$22", "TARIFAS!$B$23", "TARIFAS!$B$24"
T_EMPRESA, T_WEB, T_EMAIL, T_TEL, T_OPERADORA, T_INTRO = (f"TARIFAS!$B${r}" for r in range(27, 33))
TX_FIBRA, TX_FIJO, TX_TV, TX_CANAL, TX_AMAZON, TX_PIE = (f"TARIFAS!$B${r}" for r in range(35, 41))

# ---------------------------------------------------------------------------
# DATOS: lo que rellena el comercial en la llamada
# ---------------------------------------------------------------------------
d = datos
d.sheet_properties.tabColor = SOL
d.sheet_view.showGridLines = False
for col, ancho in zip("ABCDEFG", (2.5, 34, 20, 26, 18, 14, 40)):
    d.column_dimensions[col].width = ancho

for r in (1, 2, 3):
    alto(d, r, 20)
logo(d, "B1", 72)
escribir(d, "C1", "MESENERGIA · +Energía", f=font(9, True, VERDE), merge="G1",
         al=Alignment(vertical="bottom"))
escribir(d, "C2", "Generador de ofertas AVATEL", f=font(17, True), merge="G2",
         al=Alignment(vertical="center"))
escribir(d, "C3", "Rellena los datos durante la llamada · la hoja OFERTA se actualiza sola · expórtala a PDF",
         f=font(9, color=GRIS), merge="G3", al=Alignment(vertical="top"))
alto(d, 4, 4)
for c in d["A4:G4"][0]:
    c.fill = fill(VERDE)

alto(d, 6, 46)
escribir(
    d,
    "B6",
    "CÓMO SE USA:  1) Rellena las celdas amarillas (las grises se calculan solas; usa Tab para saltar de una a otra).  "
    "2) Revisa la hoja OFERTA.  3) Exporta a PDF solo la hoja OFERTA → Excel: Archivo › Exportar › Crear PDF "
    "(o Imprimir › «Imprimir hojas activas» › Guardar como PDF). Google Sheets: Archivo › Descargar › PDF › Hoja actual.",
    f=font(9, color=NAVY_700),
    bg=NAVY_50,
    al=Alignment(wrap_text=True, vertical="center", indent=1),
    merge="G6",
)
escribir(d, "B7", "Celda a rellenar", f=font(8, color=GRIS), bg=INPUT, al=CENTRO, bd=borde())
escribir(d, "C7", "Se calcula sola", f=font(8, color=GRIS), bg=AUTO, al=CENTRO, bd=borde())
escribir(d, "D7", "Ejemplo relleno: sobrescríbelo con los datos del cliente.",
         f=font(8, color=GRIS, italic=True), merge="G7", al=Alignment(vertical="center"))


def seccion(ws, fila, texto, hasta="G"):
    escribir(ws, f"B{fila}", texto, f=font(10, True, BLANCO), bg=NAVY,
             al=Alignment(vertical="center", indent=1), merge=f"{hasta}{fila}")
    alto(ws, fila, 22)


def etiqueta(fila, texto, bold=False):
    escribir(d, f"B{fila}", texto, f=font(10, bold), al=IZQ, bd=borde())


def entrada(ref, valor=None, *, merge=None, fmt=None, al=IZQ):
    celda = escribir(d, ref, valor, f=font(10, True, NAVY_700), bg=INPUT, al=al, fmt=fmt,
                     merge=merge, bd=borde(SOL))
    rango = f"{ref}:{merge or ref}"
    for fila in d[rango]:
        for c in fila:
            c.protection = DESBLOQUEADA
    return celda


def automatica(ref, valor, *, merge=None, fmt=None, al=IZQ, f=None):
    return escribir(d, ref, valor, f=f or font(10), bg=AUTO, al=al, fmt=fmt, merge=merge, bd=borde())


def nota(ref, texto, merge="G"):
    fila = ref[1:]
    escribir(d, ref, texto, f=font(8, color=GRIS, italic=True),
             al=Alignment(vertical="center", wrap_text=True, indent=1), merge=f"{merge}{fila}")


for r in range(9, 45):
    if d.row_dimensions[r].height is None:
        alto(d, r, 20)

seccion(d, 9, "1 · DATOS DE LA OFERTA")
etiqueta(10, "Fecha de la oferta")
entrada("C10", date(2026, 10, 13), fmt=FECHA, al=CENTRO)
nota("D10", "Formato dd/mm/aaaa")
etiqueta(11, "Asesor comercial")
entrada("C11", "Gabriela", merge="D11")
nota("E11", "Nombre que verá el cliente en la oferta")
etiqueta(12, "Oferta válida hasta (opcional)")
entrada("C12", None, fmt=FECHA, al=CENTRO)
nota("D12", "Si lo dejas vacío no aparece en la oferta")

seccion(d, 14, "2 · CLIENTE")
etiqueta(15, "Nombre completo", bold=True)
entrada("C15", "María López Fernández", merge="E15")

seccion(d, 17, "3 · TARIFA AVATEL")
etiqueta(18, "Tarifa", bold=True)
entrada("C18", "Conecta Sin Límites", merge="D18")
escribir(d, "E18", "Precio tarifario", f=font(9, color=GRIS), al=DER)
automatica("F18", f"=IFERROR(INDEX({T_PRECIO},MATCH($C$18,{T_PAQ},0)),\"\")", fmt=EURO, al=CENTRO)
etiqueta(19, "Qué incluye")
automatica("C19", f"=IFERROR(INDEX({T_INCLUYE},MATCH($C$18,{T_PAQ},0)),\"Elige una tarifa\")",
           merge="G19", f=font(9))
alto(d, 19, 30)
etiqueta(20, "Líneas móviles incluidas en la tarifa")
automatica("C20", f"=IFERROR(INDEX({T_LINEAS},MATCH($C$18,{T_PAQ},0)),0)", fmt="0", al=CENTRO)
nota("D20", "Las primeras líneas de la tabla de abajo van incluidas; el resto son adicionales con bono")

seccion(d, 22, "4 · LÍNEAS MÓVILES  (portabilidad · máximo 5 por cliente)")
for col, texto in zip("BCDEFG", ["Línea", "Número (9 dígitos)", "Bono de datos (solo adicionales)",
                                 "Datos", "€/mes extra", "Comprobación"]):
    escribir(d, f"{col}23", texto, f=font(9, True, BLANCO), bg=NAVY_700, al=CENTRO, bd=borde(NAVY_700))
alto(d, 23, 26)

FILAS_LINEAS = range(24, 29)
EJEMPLO_LINEAS = [("612345678", None), ("623456789", None), ("634567890", "Datos ilimitados"), (None, None), (None, None)]
for i, r in enumerate(FILAS_LINEAS, start=1):
    etiqueta(r, "Línea principal" if i == 1 else f"Línea adicional {i - 1}", bold=(i == 1))
    numero, bono = EJEMPLO_LINEAS[i - 1]
    entrada(f"C{r}", numero, fmt="@", al=CENTRO)
    entrada(f"D{r}", bono, al=CENTRO)
    incluida = f"{i}<=$C$20"
    precio_bono = (f"INDEX({T_MATRIZ},MATCH($C$18,{T_MATRIZ_PAQ},0),MATCH(D{r},{T_BONOS},0))")
    automatica(
        f"E{r}",
        f'=IF(C{r}="","",IF({incluida},INDEX({T_DATOS},MATCH($C$18,{T_PAQ},0)),D{r}))',
        al=CENTRO, f=font(9),
    )
    automatica(
        f"F{r}",
        f'=IF(OR(C{r}="",D{r}="",{incluida}),0,N(IFERROR({precio_bono},0)))',
        fmt=EURO, al=CENTRO,
    )
    automatica(
        f"G{r}",
        f'=IF(AND(C{r}="",D{r}=""),"",'
        f'IF(C{r}="","⚠ Falta el número",'
        f'IF(LEN(C{r})<>9,"⚠ El número debe tener 9 dígitos",'
        f'IF($C$18="","⚠ Elige primero la tarifa",'
        f'IF({incluida},"✔ Incluida en la tarifa",'
        f'IF(D{r}="","⚠ Elige el bono de datos",'
        f'IF(ISNUMBER(IFERROR({precio_bono},"")),"✔ Línea adicional","⚠ Bono no disponible con esta tarifa")))))))',
        f=font(9),
    )

seccion(d, 30, "5 · TELÉFONO FIJO")
etiqueta(31, "Número fijo a portar")
entrada("C31", "944123456", fmt="@", al=CENTRO)
nota("D31", "Déjalo vacío si el cliente no lleva línea fija")

seccion(d, 33, "6 · EXTRAS")
etiqueta(34, "Televisión CLICtv (con deco)")
entrada("C34", "Sí", al=CENTRO)
nota("D34", "Sí / No")
etiqueta(35, "Canal Local CLICtv")
entrada("C35", "No", al=CENTRO)
nota("D35", "Sí / No · requiere CLICtv")
etiqueta(36, "Conecta Mesh (nº de dispositivos)")
entrada("C36", 1, fmt="0", al=CENTRO)
nota("D36", "0 a 5 · amplía la cobertura WiFi")
etiqueta(37, "Otras ventajas para el cliente (opcional)")
entrada("C37", None, merge="G37", al=Alignment(wrap_text=True, vertical="center", indent=1))
alto(d, 37, 36)

seccion(d, 39, "7 · PRECIO")
etiqueta(40, "Precio orientativo según tarifario")
automatica(
    "C40",
    f"=IFERROR(INDEX({T_PRECIO},MATCH($C$18,{T_PAQ},0)),0)+SUM(F24:F28)"
    f'+IF(C31<>"",{T_FIJO},0)+IF(C34="Sí",{T_TV},0)+IF(AND(C34="Sí",C35="Sí"),{T_CANAL},0)'
    f"+N(C36)*{T_MESH}",
    fmt=EURO, al=CENTRO,
)
nota("D40", "Tarifa + líneas adicionales + fijo + extras, según la hoja TARIFAS (solo referencia interna)")
etiqueta(41, "PRECIO DE NUESTRA OFERTA (€/mes, IVA incl.)", bold=True)
entrada("C41", 59.90, fmt=EURO, al=CENTRO)
nota("D41", "Es el precio que verá el cliente. Si lo dejas vacío se usará el orientativo")
etiqueta(42, "Precio que aparece en el PDF")
automatica("C42", "=IF(ISNUMBER(C41),C41,C40)", fmt=EURO, al=CENTRO, f=font(11, True))

seccion(d, 44, "ESTADO")
ESTADO = (
    '=IF(C15="","⚠ Falta el nombre completo del cliente",'
    'IF(C18="","⚠ Elige la tarifa AVATEL",'
    'IF(SUMPRODUCT(--(LEFT(G24:G28,1)="⚠"))>0,"⚠ Revisa las líneas móviles (columna Comprobación)",'
    'IF(AND(C31<>"",LEN(C31)<>9),"⚠ El teléfono fijo debe tener 9 dígitos",'
    'IF(AND(C35="Sí",C34<>"Sí"),"⚠ El Canal Local requiere CLICtv con deco",'
    'IF(NOT(ISNUMBER(C41)),"ℹ Sin precio propio: el PDF mostrará el precio orientativo",'
    '"✔ Oferta lista: ve a la hoja OFERTA y expórtala a PDF"))))))'
)
escribir(d, "B45", ESTADO, f=font(11, True), al=Alignment(vertical="center", indent=1),
         merge="G45", bd=borde())
alto(d, 45, 28)
d.conditional_formatting.add(
    "B45:G45", FormulaRule(formula=['LEFT($B$45,1)="✔"'], fill=fill(VERDE_50), font=Font(color="2F6B1A"))
)
d.conditional_formatting.add(
    "B45:G45", FormulaRule(formula=['LEFT($B$45,1)<>"✔"'], fill=fill("FEF1C7"), font=Font(color="A95F0F"))
)
d.conditional_formatting.add(
    "G24:G28", FormulaRule(formula=['LEFT($G24,1)="⚠"'], font=Font(color="C0392B", bold=True))
)

# Validaciones
def validacion(ws, rango, **kw):
    dv = DataValidation(allow_blank=True, showErrorMessage=True, **kw)
    ws.add_data_validation(dv)
    for parte in rango.split():
        dv.add(parte)
    return dv


validacion(d, "C10 C12", type="date", operator="greaterThan", formula1="43831",
           errorTitle="Fecha", error="Introduce una fecha válida (dd/mm/aaaa).")
validacion(d, "C18", type="list", formula1=T_PAQ,
           errorTitle="Tarifa", error="Elige una tarifa de la lista.")
validacion(d, "D24:D28", type="list", formula1=T_BONOS,
           errorTitle="Bono", error="Elige un bono de la lista.")
validacion(d, "C24:C28 C31", type="textLength", operator="equal", formula1="9",
           errorTitle="Teléfono", error="El número debe tener 9 dígitos, sin espacios ni prefijo.")
validacion(d, "C34:C35", type="list", formula1='"Sí,No"',
           errorTitle="Sí / No", error="Elige Sí o No.")
validacion(d, "C36", type="whole", operator="between", formula1="0", formula2="5",
           errorTitle="Mesh", error="Entre 0 y 5 dispositivos.")
validacion(d, "C41", type="decimal", operator="greaterThanOrEqual", formula1="0",
           errorTitle="Precio", error="Introduce el precio mensual en euros (ej. 49,90).")

d.print_area = "A1:G45"
d.page_setup.paperSize = d.PAPERSIZE_A4
d.page_setup.orientation = "portrait"
d.sheet_properties.pageSetUpPr = PageSetupProperties(fitToPage=True)
d.page_setup.fitToWidth = 1
d.page_setup.fitToHeight = 1
d.protection.sheet = True
d.protection.formatColumns = False
d.protection.formatRows = False

D_FECHA, D_ASESOR, D_VALIDEZ, D_NOMBRE, D_TARIFA = "DATOS!$C$10", "DATOS!$C$11", "DATOS!$C$12", "DATOS!$C$15", "DATOS!$C$18"
D_FIJO, D_TV, D_CANAL, D_MESH, D_OTROS, D_PRECIO = (
    "DATOS!$C$31", "DATOS!$C$34", "DATOS!$C$35", "DATOS!$C$36", "DATOS!$C$37", "DATOS!$C$42")

# ---------------------------------------------------------------------------
# CALC: textos de la oferta y compactación de servicios (hoja oculta)
# ---------------------------------------------------------------------------
c = calc
c.sheet_state = "hidden"
c.column_dimensions["A"].width = 22
c.column_dimensions["B"].width = 16
c.column_dimensions["C"].width = 26
c.column_dimensions["D"].width = 90
c.column_dimensions["E"].width = 8
c["A1"] = "Hoja auxiliar: no editar. La usa la hoja OFERTA."
c["A1"].font = font(9, True, GRIS)


def fmt_tel(ref):
    return f'IF(LEN({ref})=9,LEFT({ref},3)&" "&MID({ref},4,3)&" "&MID({ref},7,3),{ref}&"")'


# Líneas móviles (filas 3-7): A etiqueta · B número · C datos · D viñeta
c["A2"], c["B2"], c["C2"], c["D2"] = "Línea", "Número", "Datos", "Viñeta"
for i, r_d in enumerate(FILAS_LINEAS, start=1):
    r = 2 + i
    c[f"A{r}"] = "Línea principal" if i == 1 else "Línea adicional"
    c[f"B{r}"] = f'=DATOS!$C${r_d}&""'
    c[f"C{r}"] = f'=DATOS!$E${r_d}&""'
    c[f"D{r}"] = f'=IF(B{r}="","",CHAR(10)&"•  "&A{r}&"  "&{fmt_tel(f"B{r}")}&"   ·   "&C{r})'
c["A8"], c["B8"] = "Nº líneas", '=SUMPRODUCT(--(LEN(B3:B7)>0))'

# Servicios candidatos (filas 11-16): A clave · B incluir · C título · D descripción · E acumulado
c["A10"], c["B10"], c["C10"], c["D10"], c["E10"] = "Servicio", "Incluir", "Título", "Descripción", "Acum."
SERVICIOS = [
    ("Fibra", "TRUE",
     "Fibra óptica 1 Gb",
     f'{TX_FIBRA}&IF(N({D_MESH})>0," Incluye "&{D_MESH}&IF({D_MESH}=1," dispositivo Conecta Mesh"," dispositivos Conecta Mesh")'
     f'&" para ampliar la cobertura WiFi en toda la vivienda.","")'),
    ("Móvil", "$B$8>0",
     "Telefonía móvil",
     'IF($B$8=1,"Línea móvil en modalidad de portabilidad, con llamadas ilimitadas a destinos nacionales:",'
     '"Líneas móviles en modalidad de portabilidad, todas con llamadas ilimitadas a destinos nacionales:")'
     '&D3&D4&D5&D6&D7'),
    ("Fijo", f'{D_FIJO}<>""',
     "Telefonía fija",
     f'"Línea de teléfono fijo en modalidad de portabilidad con el número "&{fmt_tel(D_FIJO)}&", "&{TX_FIJO}'),
    ("TV", f'{D_TV}="Sí"',
     "Televisión",
     f'{TX_TV}&IF({D_CANAL}="Sí"," "&{TX_CANAL},"")'),
    ("Amazon", "TRUE",
     "Amazon Prime",
     f"{TX_AMAZON}&\"\""),
    ("Ventajas", f'{D_OTROS}<>""',
     "Ventajas +Energía",
     f'{D_OTROS}&""'),
]
for i, (clave, cond, titulo, desc) in enumerate(SERVICIOS):
    r = 11 + i
    c[f"A{r}"] = clave
    c[f"B{r}"] = f"=IF({cond},1,0)"
    c[f"C{r}"] = titulo
    c[f"D{r}"] = f"={desc}"
    c[f"E{r}"] = f"=B{r}" if i == 0 else f"=E{r - 1}+B{r}"

# Servicios compactados (filas 19-24): sin huecos para los que no aplican
c["A18"], c["B18"], c["C18"], c["D18"] = "Orden", "", "Título", "Descripción"
for k in range(1, 7):
    r = 18 + k
    c[f"A{r}"] = k
    c[f"C{r}"] = f'=IFERROR(INDEX($C$11:$C$16,MATCH({k},$E$11:$E$16,0)),"")'
    c[f"D{r}"] = f'=IFERROR(INDEX($D$11:$D$16,MATCH({k},$E$11:$E$16,0)),"")'

# Resumen de la tarifa (fila 27)
c["A27"] = "Resumen"
c["D27"] = (
    '="Fibra 1 Gb"&IF($B$8>0,"  ·  "&$B$8&IF($B$8=1," línea móvil"," líneas móviles"),"")'
    f'&IF({D_FIJO}<>"","  ·  Teléfono fijo","")&IF({D_TV}="Sí","  ·  Televisión","")'
    '&"  ·  Amazon Prime"'
)
c.protection.sheet = True

# ---------------------------------------------------------------------------
# OFERTA: documento para el cliente
# ---------------------------------------------------------------------------
o = oferta
o.sheet_properties.tabColor = VERDE
o.sheet_view.showGridLines = False
o.sheet_view.zoomScale = 100
for col, ancho in zip("ABCDEFG", (1.3, 25, 1.5, 17, 17, 17, 17)):
    o.column_dimensions[col].width = ancho

# Cabecera: logo + datos de empresa
for r in range(1, 5):
    alto(o, r, 17)
logo(o, "A1", 78)
escribir(o, "D1", f'={T_EMPRESA}&""', f=font(12, True), al=DER, merge="G1")
escribir(o, "D2", f'={T_WEB}&""', f=font(9, color=GRIS), al=DER, merge="G2")
escribir(o, "D3", f'={T_EMAIL}&""', f=font(9, color=GRIS), al=DER, merge="G3")
escribir(o, "D4", f'={T_TEL}&""', f=font(9, color=GRIS), al=DER, merge="G4")
alto(o, 5, 8)
alto(o, 6, 3)
for cc in o["A6:G6"][0]:
    cc.fill = fill(VERDE)
alto(o, 7, 12)

# Título
alto(o, 8, 34)
escribir(o, "A8", "CONDICIONES Y TARIFA PERSONALIZADA", f=font(15, True, BLANCO), bg=NAVY,
         al=Alignment(horizontal="center", vertical="center"), merge="G8")
alto(o, 9, 14)

# Cliente / fecha / referencia
ETIQ = font(7.5, True, GRIS)
alto(o, 10, 13)
escribir(o, "A10", "CLIENTE", f=ETIQ, al=Alignment(vertical="bottom"), merge="D10")
escribir(o, "E10", "FECHA", f=ETIQ, al=Alignment(horizontal="center", vertical="bottom"))
escribir(o, "F10", "REFERENCIA", f=ETIQ, al=Alignment(horizontal="center", vertical="bottom"), merge="G10")
alto(o, 11, 26)
escribir(o, "A11", f'=IF({D_NOMBRE}="","—",{D_NOMBRE})', f=font(16, True), al=Alignment(vertical="center"),
         merge="D11")
escribir(o, "E11", f'=IF({D_FECHA}="","",{D_FECHA})', f=font(10, True), al=CENTRO, fmt=FECHA)
escribir(
    o, "F11",
    f'=IF({D_FECHA}="","","AV-"&YEAR({D_FECHA})&RIGHT("0"&MONTH({D_FECHA}),2)&RIGHT("0"&DAY({D_FECHA}),2)'
    f'&IF(CALC!$B$3="","","-"&RIGHT(CALC!$B$3,4)))',
    f=font(10, True), al=CENTRO, merge="G11",
)
for cc in o["A11:G11"][0]:
    cc.border = Border(bottom=side(NAVY_100))
alto(o, 12, 18)
escribir(o, "A12", f'=IF({D_ASESOR}="","","Asesor comercial: "&{D_ASESOR})', f=font(9, color=GRIS),
         al=Alignment(vertical="center"), merge="D12")
escribir(o, "E12", f'=IF({D_VALIDEZ}="","","Válida hasta")', f=font(9, color=GRIS),
         al=Alignment(horizontal="right", vertical="center"))
escribir(o, "F12", f'=IF({D_VALIDEZ}="","",{D_VALIDEZ})', f=font(9, True, GRIS), fmt=FECHA,
         al=Alignment(horizontal="center", vertical="center"), merge="G12")
alto(o, 13, 10)

# Presentación
alto(o, 14, 54)
escribir(
    o, "A14",
    f'={T_INTRO}&" Pásate a "&{T_OPERADORA}&" y disfruta de la siguiente oferta, preparada en exclusiva para ti."',
    f=font(10, color="2B3445"), al=Alignment(wrap_text=True, vertical="center", horizontal="justify"),
    merge="G14",
)
alto(o, 15, 12)

# Bloque de precio
for r, h in ((16, 8), (17, 14), (18, 30), (19, 16), (20, 8)):
    alto(o, r, h)
    for cc in o[f"A{r}:G{r}"][0]:
        cc.fill = fill(NAVY)
for r in range(16, 21):
    o[f"A{r}"].fill = fill(VERDE)
escribir(o, "B17", "TU TARIFA AVATEL", f=font(8, True, SOL), al=Alignment(vertical="bottom", indent=1), merge="D17")
escribir(o, "B18", f'=IFERROR(INDEX({T_NOMBRE},MATCH({D_TARIFA},{T_PAQ},0)),"Selecciona una tarifa")',
         f=font(16, True, BLANCO), al=Alignment(vertical="center", indent=1), merge="D18")
escribir(o, "B19", "=CALC!$D$27", f=font(8.5, color=NAVY_100), al=Alignment(vertical="top", indent=1), merge="E19")
escribir(o, "E17", "CUOTA MENSUAL", f=font(8, True, SOL), al=Alignment(horizontal="right", vertical="bottom", indent=1),
         merge="G17")
escribir(o, "E18", f"={D_PRECIO}", f=font(24, True, SOL), al=Alignment(horizontal="right", vertical="center", indent=1),
         fmt=EURO, merge="G18")
escribir(o, "F19", "al mes · IVA incluido", f=font(8.5, color=BLANCO),
         al=Alignment(horizontal="right", vertical="top", indent=1), merge="G19")
alto(o, 21, 16)

# Servicios incluidos
alto(o, 22, 22)
escribir(o, "A22", "SERVICIOS INCLUIDOS EN TU OFERTA", f=font(11, True), al=Alignment(vertical="center"),
         merge="G22")
for cc in o["A22:G22"][0]:
    cc.border = Border(bottom=side(VERDE, "medium"))
alto(o, 23, 6)

FILAS_SERV = range(24, 30)
ALTOS_SERV = (50, 92, 50, 48, 44, 44)
for k, (r, h) in enumerate(zip(FILAS_SERV, ALTOS_SERV), start=1):
    alto(o, r, h)
    escribir(o, f"B{r}", f"=CALC!$C${18 + k}", f=font(10.5, True),
             al=Alignment(vertical="center", wrap_text=True, indent=1))
    escribir(o, f"D{r}", f"=CALC!$D${18 + k}", f=font(9.5, color="2B3445"),
             al=Alignment(vertical="center", wrap_text=True), merge=f"G{r}")
o.conditional_formatting.add(
    "A24:A29", FormulaRule(formula=['$B24<>""'], fill=fill(VERDE))
)
o.conditional_formatting.add(
    "B24:B29", FormulaRule(formula=['$B24<>""'], fill=fill(VERDE_50))
)
o.conditional_formatting.add(
    "A24:G29", FormulaRule(formula=['$B24<>""'], border=Border(bottom=side(NAVY_100)))
)

# Cierre
alto(o, 30, 14)
alto(o, 31, 40)
escribir(
    o, "A31",
    f'=IF({D_ASESOR}="","Nuestro equipo",{D_ASESOR})&" te acompañará durante todo el proceso de alta, portabilidad '
    f'e instalación para que no tengas que preocuparte de nada."'
    f'&IF(AND({T_EMAIL}="",{T_TEL}=""),""," Para cualquier consulta, contacta con nosotros en "'
    f'&{T_EMAIL}&IF(AND({T_EMAIL}<>"",{T_TEL}<>"")," o en el ","")&{T_TEL}&".")',
    f=font(10, color="2B3445"), bg=NAVY_50,
    al=Alignment(wrap_text=True, vertical="center", horizontal="left", indent=1), merge="G31",
)
alto(o, 32, 10)
alto(o, 33, 26)
escribir(o, "A33", f"={TX_PIE}&\"\"", f=font(7.5, color=GRIS, italic=True),
         al=Alignment(wrap_text=True, vertical="top"), merge="G33")

o.print_area = "A1:G33"
o.page_setup.paperSize = o.PAPERSIZE_A4
o.page_setup.orientation = "portrait"
o.sheet_properties.pageSetUpPr = PageSetupProperties(fitToPage=True)
o.page_setup.fitToWidth = 1
o.page_setup.fitToHeight = 1
o.print_options.horizontalCentered = True
o.page_margins.left = o.page_margins.right = 0.55
o.page_margins.top = 0.5
o.page_margins.bottom = 0.6
o.page_margins.footer = 0.3
o.oddFooter.center.text = "MESENERGIA  ·  +Energía  ·  Nos importa tu ahorro"
o.oddFooter.center.size = 8
o.oddFooter.center.font = "Arial"
o.oddFooter.center.color = GRIS
o.protection.sheet = True

wb.active = 0
wb.calculation.fullCalcOnLoad = True
wb.save(SALIDA)
print(f"Plantilla generada: {SALIDA}")
