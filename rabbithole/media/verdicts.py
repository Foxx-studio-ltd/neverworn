# Alice's verdict for the end of every episode: "So... real or fake?", a beat of suspense, the answer, then "Want to know more?"
# Usage: python3 verdicts.py <kokoro.onnx> <voices.bin> [ids...]  -> media/verdict/<id>.mp3 and data/verdicts.json (timings)
import json, os, re, subprocess, sys, zlib, numpy as np, soundfile as sf
from kokoro_onnx import Kokoro
H = os.path.dirname(os.path.abspath(__file__)); R = os.path.join(H, "..")
g = {"__file__": os.path.join(R, "reels", "voice.py"), "__name__": "voice"}
_argv = sys.argv; sys.argv = ["x", "a", "b", "c"]
exec(open(os.path.join(R, "reels", "voice.py")).read().split("k = Kokoro")[0], g); sys.argv = _argv
speak = g["speak"]
CASES = json.load(open(os.path.join(R, "data", "cases.json")))["cases"]
only = set(sys.argv[3:])
CALL = ["So. Real, or fake?", "Your call. Real, or fake?", "Before I tell you. Real, or fake?"]
WORD = {"true": "It's real.", "false": "It's fake.", "mixed": "Half true.", "unknown": "Nobody knows."}
MORE = ["Want to know more? Dig deeper.", "There's more in the file. Want to see it?", "Want to know how deep it goes?"]
k = Kokoro(sys.argv[1], sys.argv[2]); SR = 24000
os.makedirs(os.path.join(H, "verdict"), exist_ok=True)
jp = os.path.join(R, "data", "verdicts.json"); out = json.load(open(jp)) if os.path.exists(jp) else {}
def say(text):
    a, _ = k.create(speak(text), voice="af_heart", speed=1.0, lang="en-us"); a = a.astype(np.float32)
    nz = np.where(np.abs(a) > .01)[0]; return a[max(0, nz[0] - 240): nz[-1] + 1200]
for c in CASES:
    if only and c["id"] not in only: continue
    h = zlib.crc32(c["id"].encode())
    segs = [("call", CALL[h % 3], 1.1), ("verdict", WORD[c["ans"]], .35), ("reveal", c["reveal"], .45), ("more", MORE[(h >> 4) % 3], .2)]
    parts = [np.zeros(int(.15 * SR), np.float32)]; t = .15; tm = {}
    for name, text, gap in segs:
        a = say(text); tm[name] = round(t, 2); parts += [a, np.zeros(int(gap * SR), np.float32)]; t += len(a) / SR + gap
    v = np.concatenate(parts); v /= np.abs(v).max() * 1.1
    wav = os.path.join(H, "verdict", c["id"] + ".wav"); sf.write(wav, v, SR)
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", wav, "-af", "loudnorm=I=-14:TP=-1.5", "-ac", "1", "-b:a", "64k", os.path.join(H, "verdict", c["id"] + ".mp3")], check=True); os.remove(wav)
    out[c["id"]] = {"f": f"media/verdict/{c['id']}.mp3", "dur": round(t, 2), **tm}
    json.dump(out, open(jp, "w"), indent=0)
    print(c["id"], round(t, 1), flush=True)
