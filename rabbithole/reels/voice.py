# Narration for the reels with Kokoro (open-weights TTS, Apache-2.0).
# Usage: python3 voice.py <model.onnx> <voices.bin> <outdir> [reel ids...]
#   Bespoke reels come from scripts.json; any other id is built from data/cases.json with the standard template:
#   hook -> three evidence slips -> "Real or fake?" -> verdict + reveal -> end card.
# Writes <outdir>/<reel>-voice.wav and <outdir>/<reel>.json (scenes with start/end and estimated word timings).
import json, os, re, sys, zlib, numpy as np, soundfile as sf
from kokoro_onnx import Kokoro

HERE = os.path.dirname(os.path.abspath(__file__))
model, voices, out = sys.argv[1:4]
ids = sys.argv[4:]
SCRIPTS = json.load(open(os.path.join(HERE, "scripts.json")))
DATA = json.load(open(os.path.join(HERE, "..", "data", "cases.json")))
CASES = {c["id"]: c for c in DATA["cases"]}
HOLES = DATA["holes"]
HOST = "af_heart"   # Alice, the one host of every episode
DIGIT = "zero one two three four five six seven eight nine".split()
IDENT = ["I'm Alice. This is Rabbit Hole. Let's open file {n}.", "This is Rabbit Hole, I'm Alice. File {n}. Let's dig.", "Rabbit Hole, file {n}. I'm Alice. Here's what's on the record."]
CALL = ["So. Real, or fake?", "Your call. Real, or fake?", "Before I tell you. Real, or fake?"]
OUTRO = ["But it gets stranger. Next file: {t}. Mind the hole.", "And that's not even the strangest one. Next: {t}. Stay with me.", "Next file? {t}. Don't stop now."]
CHAIN = DATA["chain"]
def nxt(cid): return CASES[CHAIN[(CHAIN.index(cid) + 1) % len(CHAIN)]]
def outro(cid, k): n = nxt(cid); return OUTRO[(k >> 5) % 3].format(t=n["tease"][0].upper() + n["tease"][1:])
def fileno(cid): return str(100 + ([c["id"] for c in DATA["cases"]].index(cid) * 373) % 9000).zfill(4)

# ---------- speech normalisation (captions keep the written form) ----------
ONES = "zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen".split()
TENS = "_ _ twenty thirty forty fifty sixty seventy eighty ninety".split()
def words(n):
    n = int(n)
    if n < 20: return ONES[n]
    if n < 100: return TENS[n // 10] + ("-" + ONES[n % 10] if n % 10 else "")
    if n < 1000: return ONES[n // 100] + " hundred" + (" " + words(n % 100) if n % 100 else "")
    for d, name in ((10**9, "billion"), (10**6, "million"), (1000, "thousand")):
        if n >= d: return words(n // d) + " " + name + (" " + words(n % d) if n % d else "")
def year(n):
    n = int(n)
    if 2000 <= n < 2010: return words(n)
    hi, lo = divmod(n, 100)
    return words(hi) + (" hundred" if lo == 0 else " oh " + words(lo) if lo < 10 else " " + words(lo))
ACR = {"CIA": "C.I.A.", "FBI": "F.B.I.", "NSA": "N.S.A.", "USS": "U.S.S.", "US": "U.S.", "LSD": "L.S.D.", "UFO": "U.F.O.", "UFOs": "U.F.O.s",
       "DNA": "D.N.A.", "NIH": "N.I.H.", "AP": "A.P.", "FOIA": "Freedom of Information", "JFK": "J.F.K.", "WWII": "World War Two", "MKUltra": "M.K. Ultra",
       "COINTELPRO": "Co-intel-pro", "HAARP": "harp", "SETI": "setty", "VW": "Volkswagen", "NASA": "NASA", "UK": "U.K.", "USSR": "U.S.S.R.", "KGB": "K.G.B.",
       "SHAMROCK": "Shamrock", "PRISM": "Prism", "CHAOS": "Chaos", "MI6": "M.I. six", "DIA": "D.I.A.", "AARO": "ah-roh", "UAP": "U.A.P.", "UAPs": "U.A.P.s", "kg": "kilograms", "km": "kilometres", "PR": "P.R."}
def speak(text):
    s = text.replace("*", "")
    s = re.sub(r"(\d+)\.(\d+)", lambda m: words(m.group(1)) + " point " + " ".join(ONES[int(x)] for x in m.group(2)), s)
    s = re.sub(r"\$([\d,]+)(?:\s+(million|billion))?", lambda m: words(m.group(1).replace(",", "")) + (" " + m.group(2) if m.group(2) else "") + " dollars", s)
    s = re.sub(r"\b(\d{4})s\b", lambda m: year(m.group(1))[:-1] + "ies" if year(m.group(1)).endswith("y") else year(m.group(1)) + "s", s)
    s = re.sub(r"(?<![\d,])\b(1[1-9]\d\d|20[0-4]\d)\b(?!\d|,\d)", lambda m: year(m.group(1)), s)
    s = re.sub(r"\b\d{1,3}(?:,\d{3})+\b", lambda m: words(m.group(0).replace(",", "")), s)
    s = re.sub(r"\b(\d+)\b", lambda m: words(m.group(1)) if len(m.group(1)) < 10 else m.group(1), s)
    s = re.sub(r"\b(" + "|".join(sorted(map(re.escape, ACR), key=len, reverse=True)) + r")\b", lambda m: ACR[m.group(1)], s)
    return s

VERB = {"true": ("Real.", "REAL", "grn"), "false": ("Fake.", "FAKE", "red"), "mixed": ("Half true.", "HALF TRUE", "ylw"), "unknown": ("Nobody knows.", "UNEXPLAINED", "ylw")}
def from_case(c):
    v = VERB[c["ans"]]; k = zlib.crc32(c["id"].encode()); n = fileno(c["id"])
    lines = [{"scene": "hook", "text": c["hook"].replace("*", ""), "date": c["year"], "label": HOLES[c["hole"]]["name"]},
             {"scene": "ident", "text": IDENT[k % 3].format(n=n), "say": IDENT[k % 3].format(n=" ".join(DIGIT[int(d)] for d in n))}]
    for i, e in enumerate(c["ev"], 1):
        lines.append({"scene": "ev", "n": i, "raw": e, "text": re.sub(r"\[\[|\]\]", "", e)})
    lines.append({"scene": "call", "text": CALL[(k >> 3) % 3]})
    lines.append({"scene": "verdict", "text": v[0] + " " + c["reveal"], "verdict": v[1], "cls": v[2], "source": c["src"][0]})
    lines.append({"scene": "end", "text": outro(c["id"], k)})
    return {"voice": HOST, "speed": 1.0, "file": n, "hole": HOLES[c["hole"]]["name"],
            "hue": HOLES[c["hole"]]["hue"], "caseId": c["id"], "lines": lines}

k = Kokoro(model, voices)
LEAD, GAP = 0.35, 0.5
todo = ids or list(SCRIPTS)
for reel in todo:
    cfg = SCRIPTS.get(reel) or from_case(CASES[reel])
    cfg.setdefault("caseId", reel)
    if reel in SCRIPTS: cfg["lines"][-1] = {"scene": "end", "text": outro(cfg["caseId"], zlib.crc32(reel.encode()))}
    cfg["next"] = {"id": nxt(cfg["caseId"])["id"], "title": nxt(cfg["caseId"])["title"]}
    sr = 24000; parts = [np.zeros(int(LEAD * sr), dtype=np.float32)]; t = LEAD; timeline = []
    for line in cfg["lines"]:
        a, sr = k.create(line.get("say", speak(line["text"])), voice=cfg["voice"], speed=cfg["speed"], lang=cfg.get("lang", "en-gb" if cfg["voice"].startswith("b") else "en-us"))
        a = a.astype(np.float32)
        nz = np.where(np.abs(a) > 0.01)[0]; a = a[max(0, nz[0] - 240): nz[-1] + 1200] if len(nz) else a
        d = len(a) / sr
        ws = line["text"].split()
        pause = lambda x: 5 if re.search(r"[.?!]$", x) else 2.5 if x.endswith(",") else 0
        w = [len(re.sub(r"\W", "", x)) + 2 + pause(x) + (3 if re.search(r"\d", x) else 0) for x in ws]
        tot = sum(w); acc = 0; wt = []
        for x, wi in zip(ws, w):
            wt.append([x, round(t + d * acc / tot, 3), round(t + d * (acc + wi - pause(x)) / tot, 3)]); acc += wi
        gap = GAP + (0.9 if line["scene"] == "call" else 0) + (0.6 if line["scene"] == "end" else 0) + (0.25 if line["scene"] in ("hook", "verdict") else 0)
        timeline.append({**line, "start": round(t, 3), "voiceEnd": round(t + d, 3), "end": round(t + d + gap, 3), "words": wt})
        parts += [a, np.zeros(int(gap * sr), dtype=np.float32)]; t += d + gap
    audio = np.concatenate(parts); sf.write(f"{out}/{reel}-voice.wav", audio, sr)
    hop = sr // 30; env = np.array([np.sqrt(np.mean(audio[i:i + hop] ** 2)) for i in range(0, len(audio), hop)]); env = np.round(np.clip(env / (env.max() + 1e-9) * 1.6, 0, 1), 2).tolist()
    json.dump({"reel": reel, **{k2: v for k2, v in cfg.items() if k2 != "lines"}, "duration": round(t + 1.2, 3), "env": env, "scenes": timeline}, open(f"{out}/{reel}.json", "w"), indent=1)
    print(reel, cfg["voice"], round(t, 1), "s", flush=True)
