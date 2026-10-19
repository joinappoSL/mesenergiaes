#!/usr/bin/env python3
"""Renderiza episodios de episodes.json a MP4 vertical 1080x1920 con la marca Appo.

Uso: python3 render.py            # todos los episodios
     python3 render.py ep01 ep05  # solo los indicados
Cero créditos: Chromium (playwright) + ffmpeg.
"""
import json, subprocess, sys
from pathlib import Path
from playwright.sync_api import sync_playwright

HERE = Path(__file__).parent
FPS = 30
OUT = HERE / "out"
OUT.mkdir(exist_ok=True)

episodes = json.loads((HERE / "episodes.json").read_text(encoding="utf-8"))
wanted = set(sys.argv[1:])
if wanted:
    episodes = [e for e in episodes if e["id"] in wanted]

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path="/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args=["--no-sandbox"])
    page = browser.new_page(viewport={"width": 1080, "height": 1920})
    for ep in episodes:
        page.goto((HERE / "template.html").as_uri())
        page.evaluate("spec => init(spec)", ep)
        page.wait_for_function("Array.from(document.images).every(i => i.complete)")
        total = page.evaluate("window.TOTAL")
        n = int(round(total * FPS))
        dest = OUT / f"{ep['id']}.mp4"
        ff = subprocess.Popen(
            ["ffmpeg", "-y", "-loglevel", "error",
             "-f", "image2pipe", "-framerate", str(FPS), "-c:v", "mjpeg", "-i", "-",
             "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo",
             "-shortest", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "19",
             "-preset", "medium", "-c:a", "aac", "-b:a", "96k", "-movflags", "+faststart",
             str(dest)],
            stdin=subprocess.PIPE)
        for i in range(n):
            t = i / FPS
            page.evaluate("t => setT(t)", t)
            ff.stdin.write(page.screenshot(type="jpeg", quality=95))
            if i == int(n * 0.45):
                (OUT / f"{ep['id']}_poster.jpg").write_bytes(page.screenshot(type="jpeg", quality=92))
        ff.stdin.close()
        ff.wait()
        print(f"{ep['id']}: {total:.1f}s -> {dest.name}")
    browser.close()
