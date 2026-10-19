#!/usr/bin/env python3
"""Genera la carpeta social/out/subir_todo con los vídeos en orden de publicación,
un .txt por vídeo (título, descripción y hashtags), un índice TEXTOS.md y un ZIP."""
import shutil, zipfile
from pathlib import Path

HERE = Path(__file__).parent
OUT = HERE / "out"
DEST = OUT / "subir_todo"

IA = "#IA #InteligenciaArtificial #Claude #ClaudeCode #Anthropic #Automatizacion #Productividad #Tecnologia #AprendeIA #Appo"
PYME = "#Pymes #Autonomos #Emprendedores #Negocios #Automatizacion #IA #Appo #JoinAppo"

POSTS = [
    ("ep01_skills_oficiales", "Claude ya crea PDF, Word, Excel y PowerPoint",
     "Claude ya sabe crear PDF, Word, Excel y PowerPoint. Se lo pides y te devuelve el archivo listo, no solo texto.\n\n"
     "Son skills oficiales que Anthropic publica gratis en el repo anthropics/skills.\n\n"
     "¿Quieres algo así en tu empresa? Auditoría gratis en joinappo.com",
     IA + " #Skills #Excel #PowerPoint"),
    ("ep02_que_es_un_skill", "Qué es un skill de Claude",
     "Un skill de Claude es una carpeta con un archivo SKILL.md dentro. Claude lo lee solo cuando tu petición encaja, y si no, no gasta nada.\n\n"
     "Lo enseñas una vez y lo recuerda siempre.\n\nGuárdalo para cuando lo necesites y compártelo con quien use IA.",
     IA + " #Skills #AgentesIA"),
    ("ad01_whatsapp", "El cliente que te escribe a las 22:00",
     "Son las 22:00 y un cliente te escribe por WhatsApp. Si lo ves mañana, ya se ha ido con la competencia.\n\n"
     "Con el asistente de WhatsApp con IA de Appo, tu negocio contesta al momento, resuelve dudas y da cita. Tú descansas.\n\n"
     "Auditoría gratis de 30 minutos: joinappo.com · +34 747 429 843",
     PYME + " #WhatsAppBusiness #AtencionAlCliente #Chatbot"),
    ("ep03_superpowers", "El repo que hace que Claude piense antes de programar",
     "obra/superpowers es una colección de skills muy popular en GitHub. Hace que Claude pregunte, diseñe y te enseñe el plan antes de tocar código, y que trabaje con pruebas y subagentes.\n\n"
     "Menos código a ciegas, más resultados.\n\n¿Lo has probado?",
     IA + " #GitHub #Programacion #Desarrollo"),
    ("ep04_claude_md", "CLAUDE.md: la memoria de Claude Code",
     "Un simple archivo de texto le da memoria a Claude Code. Se llama CLAUDE.md y lo lee al empezar cada sesión.\n\n"
     "Pon tus reglas una vez: idioma, comandos, lo que no debe tocar. Se acabó repetirte cada día.",
     IA + " #Programacion #Desarrollo #Tips"),
    ("ad02_voz", "¿Cuántas llamadas pierdes cuando estás con un cliente?",
     "¿Cuántas llamadas pierdes cuando estás con un cliente?\n\n"
     "La recepcionista de voz con IA de Appo coge el teléfono cuando nadie puede, resuelve lo básico, da cita y te manda un resumen por WhatsApp. También fuera de horario.\n\n"
     "Pruébalo con una auditoría gratis: joinappo.com",
     PYME + " #IAVoz #Recepcionista #Telefono"),
    ("ep05_subagentes", "Varios Claude trabajando a la vez: subagentes",
     "Los subagentes de Claude Code reparten una tarea en partes y las ejecutan en paralelo. Cada uno trabaja aparte y solo devuelve el resultado.\n\n"
     "Buscar, revisar y probar a la vez, no uno detrás de otro.",
     IA + " #Subagentes #AgentesIA #Programacion"),
    ("ep06_hooks", "Hooks: que Claude ejecute algo solo",
     "Los hooks de Claude Code son acciones que se disparan antes o después de que Claude use una herramienta: formatear código, correr tests o bloquear un comando peligroso.\n\n"
     "Se configuran una vez en .claude/settings.json y ya.",
     IA + " #Hooks #Programacion #Automatizacion"),
    ("ad03_citas", "Menos ausencias, más agenda llena",
     "Menos ausencias y menos huecos vacíos en la agenda.\n\n"
     "Citas y recordatorios de Appo: reserva online, aviso 24 h y 2 h antes, confirmación con un toque y lista de espera cuando alguien cancela.\n\n"
     "Ideal para clínicas, talleres y academias. Auditoría gratis: joinappo.com",
     PYME + " #Clinicas #Talleres #Academias #Citas"),
    ("ep07_mcp", "Conecta Claude con Gmail, Notion y Drive",
     "MCP es un estándar para que la IA use tus herramientas. Le dices qué hacer, por ejemplo buscar un presupuesto y responder, y tú decides a qué apps puede entrar y qué puede hacer.\n\n"
     "Guárdalo para montarlo este fin de semana.",
     IA + " #MCP #Gmail #Notion #GoogleDrive"),
    ("ep08_skill_creator", "Crea tu propio skill de Claude en 1 minuto",
     "Crea tu propio skill de Claude en un minuto con skill-creator, un skill que crea skills.\n\n"
     "Describe tu tarea, por ejemplo resumir tus ventas cada lunes con tu formato. Claude lo prueba, lo mejora y te deja la carpeta lista.\n\n¿Prefieres que lo hagamos nosotros? joinappo.com",
     IA + " #Skills #SkillCreator #Tutorial"),
    ("ad04_verifactu", "Verifactu y factura electrónica: ¿estás listo?",
     "Verifactu y la factura electrónica ya vienen.\n\n"
     "Fechas vigentes de Verifactu: 1 de enero de 2027 para sociedades y 1 de julio de 2027 para autónomos. Hacienda ha anunciado que quiere moverlo a octubre de 2028.\n"
     "Factura electrónica entre empresas: 6 de octubre de 2027 si facturas más de 8 millones y 6 de octubre de 2028 el resto.\n\n"
     "Appo integra un programa de facturación ya adaptado y automatiza facturas, impagos y cobros. Llega sin sustos: joinappo.com\n\n"
     "(Fechas a octubre de 2026, pueden cambiar.)",
     PYME + " #Verifactu #FacturaElectronica #Hacienda #Facturacion"),
    ("ad05_auditoria", "Auditoría gratis: ¿cuánto pierdes en tareas repetitivas?",
     "¿Cuánto dinero pierde tu empresa en tareas repetitivas?\n\n"
     "Auditoría gratis de 30 minutos: revisamos cinco procesos de tu empresa, te damos un informe en 24 h con las horas y euros que pierdes al mes, y una demo funcionando en tu móvil antes de pagar nada.\n\n"
     "Pídela en joinappo.com o escribe a info@joinappo.com · +34 747 429 843",
     PYME + " #Auditoria #Digitalizacion #Barcelona"),
]

if DEST.exists():
    shutil.rmtree(DEST)
DEST.mkdir(parents=True)
index = ["# Textos para publicar\n",
         "Sube los vídeos en este orden (uno al día o dos al día si quieres ir rápido). "
         "Cada vídeo tiene su `.txt` con el mismo nombre. Mismo texto para TikTok, Reels y Shorts.\n"]
for i, (vid, title, body, tags) in enumerate(POSTS, 1):
    name = f"{i:02d}_{vid}"
    shutil.copy(OUT / f"{vid}.mp4", DEST / f"{name}.mp4")
    txt = f"TÍTULO (Shorts / YouTube):\n{title}\n\nDESCRIPCIÓN:\n{body}\n\nHASHTAGS:\n{tags}\n"
    (DEST / f"{name}.txt").write_text(txt, encoding="utf-8")
    index.append(f"\n## {i:02d} · {title}\n`{name}.mp4`\n\n{body}\n\n{tags}\n")
(DEST / "TEXTOS.md").write_text("\n".join(index), encoding="utf-8")

zpath = OUT / "appo_subir_todo.zip"
with zipfile.ZipFile(zpath, "w", zipfile.ZIP_STORED) as z:
    for f in sorted(DEST.iterdir()):
        z.write(f, f"subir_todo/{f.name}")
print(f"{len(POSTS)} vídeos -> {DEST}\nZIP: {zpath} ({zpath.stat().st_size/1e6:.1f} MB)")
