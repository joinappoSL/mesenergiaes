#!/usr/bin/env python3
"""Genera una base musical propia (sin derechos de terceros) para los vídeos sin voz de Appi.

Uso: python3 musica.py salida.wav [segundos] [semilla]
Pop electrónico alegre a 118 BPM: bombo, palmas, hi-hats, bajo y acordes (I–V–vi–IV).
"""
import sys, wave
import numpy as np

out = sys.argv[1]
dur = float(sys.argv[2]) if len(sys.argv) > 2 else 20.0
seed = int(sys.argv[3]) if len(sys.argv) > 3 else 0
SR, BPM = 48000, 118
rng = np.random.default_rng(seed)
beat = 60 / BPM
n = int(SR * dur)
mix = np.zeros(n)

def add(sig, t):
    i = int(t * SR)
    if i >= n:
        return
    seg = sig[: n - i]
    mix[i:i + len(seg)] += seg

def env(length, a=0.005, d=0.2):
    t = np.arange(int(SR * length)) / SR
    return np.minimum(t / a, 1) * np.exp(-t / d)

def kick():
    t = np.arange(int(SR * 0.35)) / SR
    f = 50 + 90 * np.exp(-t * 30)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * env(0.35, 0.002, 0.12) * 0.9

def clap():
    return rng.standard_normal(int(SR * 0.18)) * env(0.18, 0.001, 0.05) * 0.35

def hat():
    s = rng.standard_normal(int(SR * 0.05))
    s = np.diff(s, prepend=0)  # brillo
    return s * env(0.05, 0.001, 0.015) * 0.18

def tone(freqs, length, vol, decay):
    t = np.arange(int(SR * length)) / SR
    s = sum(np.sin(2 * np.pi * f * t) + 0.3 * np.sin(4 * np.pi * f * t) for f in freqs)
    return s / len(freqs) * env(length, 0.01, decay) * vol

# Do mayor: C – G – Am – F
chords = [[261.6, 329.6, 392.0], [196.0, 246.9, 293.7], [220.0, 261.6, 329.6], [174.6, 220.0, 261.6]]
bass = [65.4, 49.0, 55.0, 43.7]
bar = 4 * beat
t, b = 0.0, 0
while t < dur:
    ch = chords[b % 4]
    for k in range(4):
        add(kick(), t + k * beat)
        if k in (1, 3):
            add(clap(), t + k * beat)
        for h in (0.5,):
            add(hat(), t + (k + h) * beat)
        add(tone([bass[b % 4]], beat * 0.9, 0.45, 0.25), t + k * beat)
    for k in range(8):  # acordes en corcheas sincopadas
        if k in (0, 3, 6):
            add(tone(ch, beat * 0.8, 0.22, 0.3), t + k * beat / 2)
    t += bar
    b += 1

mix /= np.max(np.abs(mix)) + 1e-9
fade = int(SR * 1.2)
mix[-fade:] *= np.linspace(1, 0, fade)
mix[: int(SR * 0.05)] *= np.linspace(0, 1, int(SR * 0.05))
pcm = (mix * 0.8 * 32767).astype(np.int16)
with wave.open(out, "wb") as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes(pcm.tobytes())
print(f"OK {out} {dur:.1f}s")
