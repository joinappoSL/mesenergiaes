#!/usr/bin/env python3
"""Vídeo de Appi v2: varias escenas + locución aparte (ElevenLabs) + subtítulos, 1080x1920 a 60 fps.

Corre en el sandbox de Higgsfield. Uso:
  python3 compose_v2.py spec.json
spec.json = {"out": "...mp4", "titulo": "...", "subs": "texto exacto en pantalla",
             "voz": "vo.mp3", "clips": ["a.mp4", "b.mp4", ...]}
Sin voz: en lugar de "voz"/"subs"/"titulo" pasar "textos": ["texto escena 1", ...] (uno por clip;
"|" = salto de línea, *palabra* = turquesa). Lleva música propia (musica.py) y efectos.
"""
import json, os, re, subprocess, sys, unicodedata
from pathlib import Path

os.environ.setdefault("HF_HOME", "/home/user/.cache/hf")
here = Path(__file__).parent
spec = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
out = Path(spec["out"])
work = out.with_suffix("")
work.mkdir(parents=True, exist_ok=True)
FMT = spec.get("formato", "9x16")
W, H = {"9x16": (1080, 1920), "4x5": (1080, 1350), "3x4": (1080, 1440)}[FMT]
FPS, XF, OUTRO = 60, 0.35, 1.8
# Posiciones (y) que dependen del formato.
LAY = {"9x16": dict(logo=50, title=250, cap=560, o1=520, o2=330, logo_v=620, logo_v_dy=160),
       "4x5": dict(logo=30, title=215, cap=150, o1=300, o2=150, logo_v=460, logo_v_dy=120),
       "3x4": dict(logo=36, title=225, cap=190, o1=340, o2=170, logo_v=500, logo_v_dy=130)}[FMT]

def run(cmd):
    subprocess.run(cmd, check=True)

def probe(p):
    return float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                                          "-of", "csv=p=0", str(p)]).decode().strip())

clips = spec["clips"]
n = len(clips)
TEXTOS = spec.get("textos")
if TEXTOS:
    assert len(TEXTOS) == n, "un texto por escena"
    scene_len = spec.get("escena", 3.4)
    total = n * scene_len - XF * n + OUTRO + XF
else:
    vo = Path(spec["voz"])
    vo_dur = probe(vo)
    total = vo_dur + 0.4 + OUTRO
    scene_len = (total - OUTRO + XF * n) / n
LENS = [scene_len] * n
if spec.get("cortes"):
    # Cada escena empieza cuando arranca su frase en la locución (que entra con 0,2 s de retraso).
    st = [0.0] + [c + 0.2 for c in spec["cortes"][1:]]
    assert len(st) == n, "un corte por escena"
    st.append(total - OUTRO)
    LENS = [st[i + 1] - st[i] + XF for i in range(n)]

# 1. Escenas: 60 fps por interpolación de movimiento y 1080x1920.
scenes = []
# La interpolación (lo lento) se hace una vez por clip y se reutiliza en todos los formatos.
cache = Path(spec.get("cache", work))
cache.mkdir(parents=True, exist_ok=True)
for i, c in enumerate(clips):
    full = cache / f"full{i}.mp4"
    if not full.exists() and c.lower().endswith((".png", ".jpg", ".jpeg")):
        # Imagen fija: movimiento de cámara (zoom lento, alternando hacia dentro y hacia fuera) de 8 s.
        z = "1+0.0004*on" if i % 2 == 0 else "1.2-0.0004*on"
        run(["ffmpeg", "-y", "-loglevel", "error", "-loop", "1", "-i", c, "-vf",
             f"scale=2160:3840:force_original_aspect_ratio=increase,crop=2160:3840,"
             f"zoompan=z='{z}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=480:s=1080x1920:fps={FPS},setsar=1",
             "-frames:v", "480", "-c:v", "libx264", "-preset", "fast", "-crf", "15", "-pix_fmt", "yuv420p", str(full)])
    if not full.exists():
        run(["ffmpeg", "-y", "-loglevel", "error", "-i", c, "-an", "-vf",
             f"scale=720:1280:flags=lanczos,minterpolate=fps={FPS}:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1,"
             f"scale=1080:1920:flags=lanczos,setsar=1",
             "-c:v", "libx264", "-preset", "fast", "-crf", "15", "-pix_fmt", "yuv420p", str(full)])
    dst = work / f"s{i}.mp4"
    if not dst.exists():
        # Si la escena dura más que el clip, se ralentiza (hasta 1,8x) en vez de congelar la imagen.
        lento = min(max(LENS[i] / (probe(full) - 0.1), 1.0), 1.8)
        run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(full), "-vf",
             f"crop={W}:{H}:0:(ih-{H})/2,setsar=1,setpts={lento:.3f}*PTS,fps={FPS},"
             f"tpad=stop_mode=clone:stop_duration=4,trim=0:{LENS[i]:.3f},setpts=PTS-STARTPTS",
             "-c:v", "libx264", "-preset", "fast", "-crf", "16", "-pix_fmt", "yuv420p", str(dst)])
    scenes.append(dst)

# 2. Cierre de marca: fondo blanco, logo apilado, isotipo con un pequeño zoom.
outro = work / "outro.mp4"
if not outro.exists():
    run(["ffmpeg", "-y", "-loglevel", "error", "-f", "lavfi", "-i", f"color=c=white:s={W}x{H}:r={FPS}:d={OUTRO + XF}",
         "-i", str(spec.get("logo_v", here / "logo_v.png")), "-filter_complex",
         f"[1:v]scale={LAY['logo_v']}:-1[lg];[0:v][lg]overlay=(W-w)/2:(H-h)/2-{LAY['logo_v_dy']},format=yuv420p",
         "-c:v", "libx264", "-preset", "fast", "-crf", "16", str(outro)])

# 3. Une las escenas con transiciones.
trans = ["slideleft", "circleopen", "smoothup", "zoomin", "slideright", "radial"]
inputs, fc, prev, t = [], [], "0:v", 0.0
parts = scenes + [outro]
for p in parts:
    inputs += ["-i", str(p)]
lens = LENS + [OUTRO + XF]
for i in range(1, len(parts)):
    t += lens[i - 1] - XF
    tr = "fade" if i == len(parts) - 1 else trans[(i - 1) % len(trans)]
    fc.append(f"[{prev}][{i}:v]xfade=transition={tr}:duration={XF}:offset={t:.3f}[x{i}]")
    prev = f"x{i}"
cuts = [sum(lens[:i]) - XF * i for i in range(1, len(parts))]
base = work / "base.mp4"
run(["ffmpeg", "-y", "-loglevel", "error", *inputs, "-filter_complex", ";".join(fc), "-map", f"[{prev}]",
     "-c:v", "libx264", "-preset", "fast", "-crf", "16", "-pix_fmt", "yuv420p", "-r", str(FPS), str(base)])

# 4. Tiempos de palabra de la locución (Whisper) emparejados con el texto de pantalla.
words, chunks = [], []
if not TEXTOS:
    from faster_whisper import WhisperModel
    model = WhisperModel("medium", device="cpu", compute_type="int8")
    segs, _ = model.transcribe(str(vo), language="es", word_timestamps=True, beam_size=5)
    heard = [(w.start, w.end) for s in segs for w in s.words]
    # Una palabra de pantalla puede ocupar varias habladas: "CLAUDE.md{4}" = "Clod punto eme de".
    words = []
    for tok in spec["subs"].split():
        m = re.fullmatch(r"(.+)\{(\d+)\}", tok)
        words.append((m.group(1), int(m.group(2))) if m else (tok, 1))
    need = sum(k for _, k in words)
    if len(heard) != need:
        raise SystemExit(f"ERROR: Whisper oye {len(heard)} palabras y el guion tiene {need}; revisar locución")
    VO_DELAY = 0.2  # la locución entra con este retraso (ver paso 6)
    timed, i = [], 0
    for w, k in words:
        timed.append((w, heard[i][0] + VO_DELAY, heard[i + k - 1][1] + VO_DELAY))
        i += k
    chunks, cur = [], []
    for item in timed:
        cur.append(item)
        if len(cur) == 3 or re.search(r"[.,!?¡¿:;…]$", item[0]):
            chunks.append(cur); cur = []
    if cur:
        chunks.append(cur)

def ts(x):
    x = max(x, 0)
    return f"{int(x // 3600)}:{int(x % 3600 // 60):02d}:{x % 60:05.2f}"

def esc(s):
    return s.replace("{", "(").replace("}", ")")

BLUE, TURQ, WHITE = "&H009D4D0E", "&H00CCB926", "&H00FFFFFF"
end_main = total - OUTRO
ass = [
    "[Script Info]", "ScriptType: v4.00+", f"PlayResX: {W}", f"PlayResY: {H}", "WrapStyle: 0", "",
    "[V4+ Styles]",
    "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
    f"Style: Cap,Montserrat ExtraBold,96,{WHITE},{WHITE},{BLUE},&H64000000,0,0,0,0,100,100,0,0,1,9,5,2,70,70,{LAY['cap']},1",
    f"Style: Title,Montserrat ExtraBold,66,{WHITE},{WHITE},{BLUE},{BLUE},0,0,0,0,100,100,0,0,3,24,0,8,70,70,{LAY['title']},1",
    f"Style: Outro1,Montserrat ExtraBold,64,{BLUE},{BLUE},{WHITE},{WHITE},0,0,0,0,100,100,0,0,1,0,0,2,80,80,{LAY['o1']},1",
    f"Style: Big,Montserrat ExtraBold,82,{WHITE},{WHITE},{BLUE},{BLUE},0,0,0,0,100,100,0,0,3,26,0,8,80,80,{LAY['title']},1",
    f"Style: Outro2,Montserrat ExtraBold,58,{WHITE},{WHITE},{TURQ},{TURQ},0,0,0,0,100,100,0,0,3,22,0,2,80,80,{LAY['o2']},1",
    "", "[Events]", "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
    f"Dialogue: 1,{ts(end_main + 0.2)},{ts(total)},Outro1,,0,0,0,,{{\\fad(200,0)}}{esc(spec.get('cierre', 'Sígueme para más trucos de IA'))}",
    f"Dialogue: 1,{ts(end_main + 0.4)},{ts(total)},Outro2,,0,0,0,,{{\\fad(200,0)}}{esc(spec.get('web', 'joinappo.com'))}",
]
if TEXTOS:
    st = 0.0
    for k, txt in enumerate(TEXTOS):
        a, b = st + 0.12, st + scene_len - XF - 0.05
        body = esc(txt).replace("|", "\\N")
        body = re.sub(r"\*(.+?)\*", lambda m: f"{{\\c{TURQ}}}{m.group(1)}{{\\c{WHITE}}}", body)
        ass.append(f"Dialogue: 2,{ts(a)},{ts(b)},Big,,0,0,0,,{{\\fad(120,120)\\fscx70\\fscy70\\t(0,160,\\fscx100\\fscy100)}}{body}")
        st += scene_len - XF
else:
    ass.append(f"Dialogue: 1,{ts(0.15)},{ts(min(3.2, end_main))},Title,,0,0,0,,{{\\fad(150,250)\\fscx80\\fscy80\\t(0,180,\\fscx100\\fscy100)}}{esc(spec['titulo'])}")
for ci, ch in enumerate(chunks):
    nxt = chunks[ci + 1][0][1] if ci + 1 < len(chunks) else ch[-1][2] + 0.5
    for wi, (w, a, b) in enumerate(ch):
        b2 = ch[wi + 1][1] if wi + 1 < len(ch) else min(nxt, end_main)
        txt = " ".join((f"{{\\c{TURQ}}}{esc(x)}{{\\c{WHITE}}}" if j == wi else esc(x)) for j, (x, _, _) in enumerate(ch))
        pop = "{\\fscx115\\fscy115\\t(0,100,\\fscx100\\fscy100)}" if wi == 0 else ""
        ass.append(f"Dialogue: 2,{ts(a)},{ts(b2)},Cap,,0,0,0,,{pop}{txt}")
(work / "subs.ass").write_text("\n".join(ass), encoding="utf-8")

# 5. Audio: locución + "whoosh" en cada transición.
sfx = work / "sfx.wav"
fc_a = []
for i, c in enumerate(cuts):
    fc_a.append(f"anoisesrc=d=0.45:c=pink:a=0.35,highpass=f=500,lowpass=f=6000,"
                f"afade=t=in:d=0.2,afade=t=out:st=0.2:d=0.25,adelay={int(max(c - 0.2, 0) * 1000)}|{int(max(c - 0.2, 0) * 1000)}[w{i}]")
fc_a.append("".join(f"[w{i}]" for i in range(len(cuts))) + f"amix=inputs={len(cuts)}:normalize=0,volume=0.6[s]")
run(["ffmpeg", "-y", "-loglevel", "error", "-filter_complex", ";".join(fc_a), "-map", "[s]", "-ac", "2", "-ar", "48000", str(sfx)])

# 6. Composición final. El logo en color va sobre una pastilla blanca (guía de marca: nunca sobre foto sin soporte).
from PIL import Image, ImageDraw, ImageFilter
pill = work / "logo_pill.png"
lg = Image.open(spec.get("logo_h", here / "logo_h.png")).convert("RGBA")
lw = spec.get("logo_w", 280); lg = lg.resize((lw, round(lg.height * lw / lg.width)), Image.LANCZOS)
px, py = 34, 18
cw, ch = lw + 2 * px, lg.height + 2 * py
canvas = Image.new("RGBA", (cw + 40, ch + 40), (0, 0, 0, 0))
sh = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
ImageDraw.Draw(sh).rounded_rectangle((20, 26, 20 + cw, 26 + ch), radius=ch // 2, fill=(14, 77, 157, 70))
canvas = Image.alpha_composite(canvas, sh.filter(ImageFilter.GaussianBlur(10)))
ImageDraw.Draw(canvas).rounded_rectangle((20, 20, 20 + cw, 20 + ch), radius=ch // 2, fill=(255, 255, 255, 255))
canvas.alpha_composite(lg, (20 + px, 20 + py))
canvas.save(pill)
fc = (
    f"[0:v][1:v]overlay=(W-w)/2:{LAY['logo']}:enable='{0 if spec.get("sin_logo") else f"lt(t,{end_main:.2f})"}'[v1];"
    f"color=c=0x26B9CC:s={W}x14:r={FPS}:d={total}[bar];[v1][bar]overlay=x='-W+W*t/{total}':y=H-14:shortest=1[v2];"
    f"[v2]ass={work / 'subs.ass'}[vo];"
    f"[2:a]adelay=200|200,aresample=48000,volume=1.0[voz];[3:a]aresample=48000[fx];"
    f"[voz][fx]amix=inputs=2:normalize=0:duration=longest,loudnorm=I=-14:TP=-1.5:LRA=11[a]"
)
if TEXTOS:
    vo = work / "musica.wav"
    run([sys.executable, str(here / "musica.py"), str(vo), f"{total + 0.5:.2f}", str(spec.get("semilla", 0))])
    fc = fc.replace("adelay=200|200,aresample=48000,volume=1.0[voz]", "aresample=48000,volume=0.55[voz]")
run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(base), "-i", str(pill), "-i", str(vo), "-i", str(sfx),
     "-filter_complex", fc, "-map", "[vo]", "-map", "[a]", "-t", f"{total:.3f}",
     "-c:v", "libx264", "-profile:v", "high", "-preset", "medium", "-crf", "17", "-pix_fmt", "yuv420p", "-r", str(FPS),
     "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2", "-movflags", "+faststart", str(out)])
print(f"OK {out} {total:.1f}s, {len(words)} palabras sincronizadas, cortes en {[round(c, 2) for c in cuts]}")
