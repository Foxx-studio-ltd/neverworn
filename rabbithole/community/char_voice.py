# Voices the Rabbit Hole cast (fictional characters) with Kokoro, sentence by sentence.
# Usage: python3 char_voice.py <model.onnx> <voices.bin> <workdir> [ids...]
# Writes <workdir>/char-<id>.wav (voice + quiet bed, ready to encode) and reels/build/char-<id>.json
# (word timings, mouth envelope at 30 fps) for reels/char.html.
import json, os, re, sys, numpy as np, soundfile as sf
from kokoro_onnx import Kokoro
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.join(HERE, "..")
model, voices, out = sys.argv[1:4]; only = set(sys.argv[4:])
# reuse Alice's speech normaliser (years, money, acronyms)
g = {"__file__": os.path.join(ROOT, "reels", "voice.py"), "__name__": "voice"}
_argv = sys.argv; sys.argv = ["x", "a", "b", "c"]
exec(open(os.path.join(ROOT, "reels", "voice.py")).read().split("k = Kokoro")[0], g); sys.argv = _argv
speak = g["speak"]
CAST = json.load(open(os.path.join(HERE, "cast.json")))["cast"]
CASES = {c["id"]: c for c in json.load(open(os.path.join(ROOT, "data", "cases.json")))["cases"]}
k = Kokoro(model, voices); SR = 24000
for ch in CAST:
    if only and ch["id"] not in only: continue
    sents = re.findall(r"[^.!?]+[.!?]+", ch["script"])
    parts = [np.zeros(int(.5 * SR), np.float32)]; t = .5; words = []
    for s in sents:
        s = s.strip(); a, sr = k.create(speak(s), voice=ch["voice"], speed=1.0, lang="en-gb" if ch["voice"].startswith("b") else "en-us")
        a = a.astype(np.float32); nz = np.where(np.abs(a) > .01)[0]; a = a[max(0, nz[0] - 240): nz[-1] + 1200] if len(nz) else a
        d = len(a) / SR; ws = s.split(); pause = lambda x: 5 if re.search(r"[.?!]$", x) else 2.5 if re.search(r"[,:;]$", x) else 0
        w = [len(re.sub(r"\W", "", x)) + 2 + pause(x) + (3 if re.search(r"\d", x) else 0) for x in ws]; tot = sum(w); acc = 0
        for x, wi in zip(ws, w): words.append([x, round(t + d * acc / tot, 3), round(t + d * (acc + wi - pause(x)) / tot, 3)]); acc += wi
        gap = .32; parts += [a, np.zeros(int(gap * SR), np.float32)]; t += d + gap
    voice = np.concatenate(parts + [np.zeros(int(2.6 * SR), np.float32)]); dur = len(voice) / SR
    hop = SR // 30; env = np.array([np.sqrt(np.mean(voice[i:i + hop] ** 2)) for i in range(0, len(voice), hop)])
    env = np.round(np.clip(env / (env.max() + 1e-9) * 1.7, 0, 1), 2).tolist()
    # quiet bed: two soft detuned sines and a slow swell, ducked under the voice
    tt = np.arange(len(voice)) / SR; root = 55 * 2 ** ((hash(ch["id"]) % 5) / 12)
    bed = (np.sin(2 * np.pi * root * tt) + .6 * np.sin(2 * np.pi * root * 1.5 * 1.003 * tt) + .3 * np.sin(2 * np.pi * root * 2.01 * tt)) * (.5 + .5 * np.sin(2 * np.pi * tt / 9))
    duck = np.interp(tt, np.arange(len(env)) / 30, 1 - .6 * np.array(env)); mix = voice + bed * .035 * duck * np.minimum(1, tt / 2)
    mix /= np.abs(mix).max() * 1.05
    sf.write(os.path.join(out, f"char-{ch['id']}.wav"), mix.astype(np.float32), SR)
    c = CASES[ch["case"]]
    json.dump({"reel": "char-" + ch["id"], "duration": round(dur, 3), "env": env, "words": words, "char": ch, "hue": None,
               "case": {"id": c["id"], "title": c["title"], "hole": c["hole"]}}, open(os.path.join(ROOT, "reels", "build", f"char-{ch['id']}.json"), "w"), indent=1)
    print(ch["id"], round(dur, 1), "s", flush=True)
