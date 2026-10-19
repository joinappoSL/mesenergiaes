#!/usr/bin/env python3
"""Monta un vídeo viral de Appi a partir de un clip de Higgsfield (720x1280 con voz).

Corre en el sandbox de Higgsfield (sandbox_exec), que tiene ffmpeg+libass, Montserrat
y faster-whisper, y puede descargar los resultados de Higgsfield.

Uso: python3 compose.py <clip_url_o_ruta> <salida.mp4> "<titular>" "<guion exacto>"
"""
import os, re, subprocess, sys, unicodedata
from pathlib import Path

os.environ.setdefault("HF_HOME", "/home/user/.cache/hf")
src, out, title, script = sys.argv[1:5]
work = Path(out).with_suffix("")
work.mkdir(parents=True, exist_ok=True)
clip = work / "clip.mp4"
if src.startswith("http"):
    subprocess.run(["curl", "-sS", "-o", str(clip), src], check=True)
else:
    clip = Path(src)

dur = float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                                     "-of", "csv=p=0", str(clip)]).decode().strip())

# 1. Tiempos de cada palabra con Whisper; el texto sale del guion (Whisper escribe "Api", "APO"...).
from faster_whisper import WhisperModel
model = WhisperModel("small", device="cpu", compute_type="int8")
segs, _ = model.transcribe(str(clip), language="es", word_timestamps=True)
heard = [(w.start, w.end) for s in segs for w in s.words]
words = script.split()

def norm(w):
    w = unicodedata.normalize("NFD", w.lower())
    return re.sub(r"[^a-z0-9]", "", "".join(c for c in w if unicodedata.category(c) != "Mn"))

if heard and len(heard) != len(words):
    # Reparte las palabras del guion sobre el tramo hablado, proporcional a su longitud.
    t0, t1 = heard[0][0], heard[-1][1]
    lens = [max(len(norm(w)), 2) for w in words]
    tot, acc, timed = sum(lens), 0, []
    for w, L in zip(words, lens):
        a = t0 + (t1 - t0) * acc / tot
        acc += L
        timed.append((w, a, t0 + (t1 - t0) * acc / tot))
else:
    if not heard:
        heard = [(dur * i / len(words), dur * (i + 1) / len(words)) for i in range(len(words))]
    timed = [(w, a, b) for w, (a, b) in zip(words, heard)]

# 2. Trozos de hasta 3 palabras, cortando en puntuación.
chunks, cur = [], []
for item in timed:
    cur.append(item)
    if len(cur) == 3 or re.search(r"[.,!?¡¿:;]$", item[0]):
        chunks.append(cur); cur = []
if cur:
    chunks.append(cur)

def ts(t):
    t = max(t, 0)
    return f"{int(t // 3600)}:{int(t % 3600 // 60):02d}:{t % 60:05.2f}"

def esc(s):
    return s.replace("{", "(").replace("}", ")")

BLUE, TURQ, WHITE = "&H009D4D0E", "&H00CCB926", "&H00FFFFFF"  # ASS usa BGR
ass = [
    "[Script Info]", "ScriptType: v4.00+", "PlayResX: 1080", "PlayResY: 1920", "WrapStyle: 0", "",
    "[V4+ Styles]",
    "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
    f"Style: Cap,Montserrat ExtraBold,104,{WHITE},{WHITE},{BLUE},&H50000000,0,0,0,0,100,100,0,0,1,9,4,8,60,60,640,1",
    f"Style: Title,Montserrat ExtraBold,64,{WHITE},{WHITE},{BLUE},{BLUE},0,0,0,0,100,100,0,0,3,22,0,8,80,80,250,1",
    f"Style: Cta,Montserrat ExtraBold,62,{WHITE},{WHITE},{TURQ},{TURQ},0,0,0,0,100,100,0,0,3,20,0,2,80,80,120,1",
    "", "[Events]", "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
    f"Dialogue: 1,{ts(0)},{ts(dur)},Title,,0,0,0,,{{\\fad(200,0)}}{esc(title)}",
    f"Dialogue: 1,{ts(max(dur - 2.2, 0))},{ts(dur)},Cta,,0,0,0,,{{\\fad(200,0)}}joinappo.com",
]
for ci, ch in enumerate(chunks):
    end_chunk = chunks[ci + 1][0][1] if ci + 1 < len(chunks) else min(ch[-1][2] + 0.6, dur)
    for wi, (w, a, b) in enumerate(ch):
        b2 = ch[wi + 1][1] if wi + 1 < len(ch) else end_chunk
        txt = " ".join((f"{{\\c{TURQ}}}{esc(x)}{{\\c{WHITE}}}" if j == wi else esc(x))
                       for j, (x, _, _) in enumerate(ch))
        pop = "{\\fscx112\\fscy112\\t(0,90,\\fscx100\\fscy100)}" if wi == 0 else ""
        ass.append(f"Dialogue: 2,{ts(a)},{ts(b2)},Cap,,0,0,0,,{pop}{txt}")
(work / "subs.ass").write_text("\n".join(ass), encoding="utf-8")

# 3. Composición: 1080x1920, logo arriba, subtítulos, barra de progreso turquesa.
here = Path(__file__).parent
fc = (
    "[0:v]scale=1080:1920:flags=lanczos,setsar=1[v];"
    "[1:v]scale=300:-1[lg];"
    "[v][lg]overlay=(W-w)/2:70[v1];"
    f"color=c=0x26B9CC:s=1080x14:d={dur}[bar];"
    f"[v1][bar]overlay=x='-W+W*t/{dur}':y=H-14:shortest=1[v2];"
    f"[v2]ass={work / 'subs.ass'}[vo]"
)
subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(clip), "-i", str(here / "logo_h.png"),
                "-filter_complex", fc, "-map", "[vo]", "-map", "0:a?", "-c:v", "libx264", "-preset", "veryfast",
                "-crf", "20", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", out],
               check=True)
print(f"OK {out} {dur:.1f}s, {len(words)} palabras, whisper={len(heard)}")
