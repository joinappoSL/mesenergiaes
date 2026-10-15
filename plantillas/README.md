# Plantillas de oferta para llamadas

Excel que generan, durante la llamada, el documento **«Condiciones y tarifa personalizada»** con la imagen de +Energía, listo para exportar a PDF y enviar al cliente.

| Operadora | Plantilla | Ejemplo de PDF |
|---|---|---|
| AVATEL | `oferta-avatel/Oferta_AVATEL_MesEnergia.xlsx` | `oferta-avatel/Ejemplo_Oferta_AVATEL.pdf` |
| O2 | `oferta-o2/Oferta_O2_MesEnergia.xlsx` | `oferta-o2/Ejemplo_Oferta_O2.pdf` |

## Hojas

| Hoja | Para qué |
|---|---|
| **DATOS** | Lo que rellena el comercial (celdas amarillas): fecha, asesor, nombre completo, tarifa, línea principal + 4 adicionales con su bono, teléfono fijo, extras de la operadora, otras ventajas y **precio de nuestra oferta**. La hoja comprueba los datos y avisa en **ESTADO**. |
| **OFERTA** | El documento para el cliente. Se rellena solo a partir de DATOS: solo aparecen los servicios contratados y nunca se mencionan permanencia, comisiones ni precios del tarifario. |
| **TARIFAS** | Precios y textos del tarifario, datos de empresa (web, email, teléfono) y textos de la oferta. Se cambian aquí cuando llegue un tarifario nuevo. |
| CALC | Cálculos auxiliares (oculta). |

## Uso en llamada

1. Rellena las celdas amarillas de **DATOS** (con Tab saltas de una a otra).
2. Comprueba que **ESTADO** diga «✔ Oferta lista».
3. Ve a la hoja **OFERTA** y expórtala a PDF:
   - **Excel:** Archivo › Exportar › Crear PDF (o Imprimir › «Imprimir hojas activas» › Guardar como PDF).
   - **Google Sheets:** Archivo › Descargar › PDF › «Hoja actual».
4. Guarda el Excel como copia por cliente, o limpia las celdas amarillas para la siguiente llamada.

El precio que ve el cliente es el de **«Precio de nuestra oferta»**. Si se deja vacío, se usa el precio orientativo calculado con el tarifario.

Las hojas DATOS y OFERTA están protegidas **sin contraseña** para no borrar fórmulas por error (Revisar › Desproteger hoja).

## Regenerar una plantilla

```bash
python3 plantillas/oferta-avatel/generar_plantilla.py
python3 plantillas/oferta-o2/generar_plantilla.py
```

Necesitan `openpyxl` y `pillow`. Cada script tiene el tarifario de su operadora; el estilo, la cabecera de DATOS y la hoja OFERTA son comunes y están en `estilo_oferta.py`. El logo sale de `public/logo.png`.

Las fórmulas se guardan sin valores calculados: Excel y Google Sheets las calculan al abrir. Para guardar también los valores, recalcula el archivo con LibreOffice.
