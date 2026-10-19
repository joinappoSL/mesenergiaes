#!/usr/bin/env python3
"""Monta en el sandbox de Higgsfield todos los episodios de episodios.json que tengan clip.

Uso: python3 batch.py clips.json   # clips.json = {"appi01_claude_archivos": "https://...mp4", ...}
Salta los episodios ya montados en out/.
"""
import json, subprocess, sys
from pathlib import Path

here = Path(__file__).parent
eps = {e["id"]: e for e in json.loads((here / "episodios.json").read_text(encoding="utf-8"))["episodios"]}
clips = json.loads(Path(sys.argv[1]).read_text())
(here / "out").mkdir(exist_ok=True)
for eid, url in clips.items():
    dest = here / "out" / f"{eid}.mp4"
    if dest.exists():
        continue
    e = eps[eid]
    subprocess.run([sys.executable, str(here / "compose.py"), url, str(dest), e["titulo"], e["subs"]], check=True)
