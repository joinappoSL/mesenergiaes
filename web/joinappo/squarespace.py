"""Genera squarespace-bloque.html: la landing lista para pegar en un Bloque de código de Squarespace.
Aísla el CSS dentro de .appo-lp para no romper el tema y usa las imágenes publicadas en GitHub.
Uso: python3 squarespace.py <sha-del-commit>
"""
import re, sys
from pathlib import Path

sha = sys.argv[1]
base = f"https://raw.githubusercontent.com/joinappoSL/mesenergiaes/{sha}/web/joinappo/"
src = Path(__file__).with_name("index.html").read_text(encoding="utf-8")
css = re.search(r"<style>(.*?)</style>", src, re.S).group(1)
body = re.search(r"<body>(.*?)</body>", src, re.S).group(1)

def scope(sel):
    sel = sel.strip()
    if sel in ("html", "body", ":root"):
        return ".appo-lp"
    if sel.startswith(("body ", "html ")):
        return ".appo-lp " + sel.split(" ", 1)[1]
    return ".appo-lp " + sel

def prefix(block):
    out, i = [], 0
    for m in re.finditer(r"([^{}]+)\{([^{}]*)\}", block):
        out.append(",".join(scope(s) for s in m.group(1).split(",")) + "{" + m.group(2) + "}")
    return "".join(out)

res, pos = [], 0
for m in re.finditer(r"(@media[^{]+|@keyframes[^{]+)\{((?:[^{}]*\{[^{}]*\})*)\s*\}", css):
    res.append(prefix(css[pos:m.start()]))
    head = m.group(1)
    res.append(head + "{" + (m.group(2) if head.startswith("@keyframes") else prefix(m.group(2))) + "}")
    pos = m.end()
res.append(prefix(css[pos:]))
scoped = "".join(res)
# Squarespace ya tiene su cabecera fija: la de la landing deja de ser "sticky" para no taparla.
scoped += ".appo-lp header{position:relative}.appo-lp{font-size:16px}"

body = body.replace('src="assets/', f'src="{base}assets/').replace('href="assets/', f'href="{base}assets/')
fonts = '<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Montserrat:wght@700;800&display=swap" rel="stylesheet">'
html = f"{fonts}\n<style>{scoped}</style>\n<div class=\"appo-lp\">\n{body}\n</div>\n"
Path(__file__).with_name("squarespace-bloque.html").write_text(html, encoding="utf-8")
print(len(html) // 1024, "KB")
