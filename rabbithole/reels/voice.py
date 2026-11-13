# Narration for the reels with Kokoro (open-weights TTS, Apache-2.0).
# Usage: python3 voice.py <model.onnx> <voices.bin> <outdir>
# Writes <outdir>/<reel>.wav plus <outdir>/<reel>.json with scene start/end and estimated word timings.
import json, sys, re, numpy as np, soundfile as sf
from kokoro_onnx import Kokoro
model, voices, out = sys.argv[1:4]
k = Kokoro(model, voices)
S = json.load(open(__file__.replace("voice.py", "scripts.json")))
LEAD, GAP = 0.35, 0.55
for reel, cfg in S.items():
    sr = 24000; parts = []; t = LEAD; timeline = []
    parts.append(np.zeros(int(LEAD * sr), dtype=np.float32))
    for i, line in enumerate(cfg["lines"]):
        a, sr = k.create(line.get("say", line["text"]), voice=cfg["voice"], speed=cfg["speed"], lang="en-us")
        a = a.astype(np.float32)
        # trim leading/trailing near-silence so word timings line up
        nz = np.where(np.abs(a) > 0.01)[0]; a = a[max(0, nz[0] - 240): nz[-1] + 1200] if len(nz) else a
        d = len(a) / sr
        words = line["text"].split()
        # weight words by letters, plus pauses after punctuation
        w = [len(re.sub(r"\W", "", x)) + 2 + (5 if re.search(r"[.?!]$", x) else 2.5 if x.endswith(",") else 0) for x in words]
        tot = sum(w); acc = 0; wt = []
        for x, wi in zip(words, w):
            pause = (5 if re.search(r"[.?!]$", x) else 2.5 if x.endswith(",") else 0)
            wt.append([x, round(t + d * acc / tot, 3), round(t + d * (acc + wi - pause) / tot, 3)]); acc += wi
        gap = GAP + (0.9 if line["scene"] in ("call",) else 0) + (0.6 if line["scene"] == "end" else 0)
        timeline.append({**line, "start": round(t, 3), "voiceEnd": round(t + d, 3), "end": round(t + d + gap, 3), "words": wt})
        parts += [a, np.zeros(int(gap * sr), dtype=np.float32)]; t += d + gap
    audio = np.concatenate(parts)
    sf.write(f"{out}/{reel}-voice.wav", audio, sr)
    json.dump({"reel": reel, **{k2: v for k2, v in cfg.items() if k2 != "lines"}, "duration": round(t + 1.2, 3), "scenes": timeline}, open(f"{out}/{reel}.json", "w"), indent=1)
    print(reel, round(t, 1), "s")
