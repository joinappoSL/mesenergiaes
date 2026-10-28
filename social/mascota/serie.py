#!/usr/bin/env python3
"""Produce un episodio en los tres formatos (9:16, 4:5, 3:4) en el sandbox de Higgsfield.

Uso: python3 serie.py episodio.json
episodio.json = {"id": "...", "clips": [urls], ...campos de compose_v2 (titulo/subs/voz o textos/cierre/semilla)}
"""
import json, subprocess, sys
from pathlib import Path

here = Path(__file__).parent
ep = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
eid = ep["id"]
src = here / "src" / eid
src.mkdir(parents=True, exist_ok=True)
clips = []
for i, u in enumerate(ep["clips"]):
    ext = Path(u.split("?")[0]).suffix or ".mp4"
    dst = src / f"c{i}{ext}"
    if not dst.exists():
        subprocess.run(["curl", "-sS", "-f", "-o", str(dst), u], check=True)
    clips.append(str(dst))
(here / "out").mkdir(exist_ok=True)
for fmt in ("9x16", "4x5", "3x4"):
    out = here / "out" / f"{eid}_{fmt}.mp4"
    if out.exists():
        continue
    spec = dict(ep, clips=clips, out=str(out), formato=fmt, cache=str(src))
    sp = src / f"spec_{fmt}.json"
    sp.write_text(json.dumps(spec, ensure_ascii=False), encoding="utf-8")
    subprocess.run([sys.executable, str(here / "compose_v2.py"), str(sp)], check=True)
print("HECHO", eid)
