# The first-launch intro: Alice, slow and suspenseful, over a dark drone, a heartbeat and the Rabbit Hole sting.
# Usage: python3 intro.py <kokoro.onnx> <voices.bin>   -> media/intro.mp3 and data/intro.json (caption timings)
import json, os, subprocess, sys, numpy as np, soundfile as sf
from kokoro_onnx import Kokoro
H = os.path.dirname(os.path.abspath(__file__)); R = os.path.join(H, "..")
LINES = [("They called it a conspiracy theory.", .9), ("Some of it was.", 1.1), ("And some of it", .25), ("was true.", 1.3),
         ("The C.I.A. really did drug Americans with L.S.D.", .5), ("The Army really did announce a flying disc.", 1.1),
         ("Every night at seven, I open one file.", .45), ("You decide how deep you go.", 1.1), ("I'm Alice.", .35), ("Welcome to Rabbit Hole.", .9), ("Mind the hole.", 2.4)]
SHOW = {"The C.I.A. really did drug Americans with L.S.D.": "The CIA really did drug Americans with LSD."}
k = Kokoro(sys.argv[1], sys.argv[2]); SR = 24000
parts = [np.zeros(int(1.4 * SR), np.float32)]; t = 1.4; caps = []
for text, gap in LINES:
    a, _ = k.create(text, voice="af_heart", speed=.9, lang="en-us"); a = a.astype(np.float32)
    nz = np.where(np.abs(a) > .01)[0]; a = a[max(0, nz[0] - 240): nz[-1] + 1200]
    caps.append({"text": SHOW.get(text, text), "start": round(t, 2), "end": round(t + len(a) / SR, 2)})
    parts += [a, np.zeros(int(gap * SR), np.float32)]; t += len(a) / SR + gap
voice = np.concatenate(parts); N = len(voice); tt = np.arange(N) / SR
# music: low drone that swells, a heartbeat that quickens, the sting on "Mind the hole"
drone = sum(np.sin(2 * np.pi * f * tt) * g for f, g in ((55, .5), (82.4, .3), (110.2, .18), (164.8, .08))) * np.clip(tt / 4, 0, 1) * (.7 + .3 * np.sin(2 * np.pi * tt / 7))
music = drone * .22
bt = 2.0
while bt < t - 2:
    n = int(.25 * SR); x = np.arange(n) / SR; kick = np.sin(2 * np.pi * (52 * x + 30 * (1 - np.exp(-x * 30)) / 30)) * np.exp(-x * 16)
    for o, g in ((0, .5), (.2, .3)):
        i = int((bt + o) * SR); j = min(N, i + n); music[i:j] += kick[:j - i] * g
    bt += 1.05 - .35 * min(1, bt / t)
sting_at = caps[-1]["start"]
for m, (f, d) in enumerate(((1174.7, 0), (880, .16), (698.5, .32))):
    n = int(2.5 * SR); x = np.arange(n) / SR; b = sum(np.sin(2 * np.pi * f * h * x) * g * np.exp(-x * dd) for h, g, dd in ((1, 1, 2.2), (2.76, .45, 4), (5.4, .25, 7)))
    i = int((sting_at + d) * SR); j = min(N, i + n); music[i:j] += b[:j - i] * .3
env = np.convolve(np.abs(voice), np.ones(2400) / 2400, mode="same"); env /= env.max() + 1e-9
mix = voice * 1.0 + music * (1 - .5 * np.clip(env * 4, 0, 1))
mix /= np.abs(mix).max() * 1.05
wav = os.path.join(H, "intro.wav"); sf.write(wav, mix.astype(np.float32), SR)
subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", wav, "-af", "loudnorm=I=-16:TP=-1.5", "-b:a", "96k", os.path.join(H, "intro.mp3")], check=True); os.remove(wav)
json.dump({"duration": round(t, 2), "captions": caps}, open(os.path.join(R, "data", "intro.json"), "w"), indent=1)
print("intro", round(t, 1), "s")
