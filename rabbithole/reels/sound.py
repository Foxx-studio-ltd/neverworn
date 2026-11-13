# Soundtrack for a Rabbit Hole reel, synthesised from scratch (no samples, nothing to license),
# mixed under the narration with ducking.
# Usage: python3 sound.py <reel> <voice.wav> <events.json> <out.wav>
import json, sys, numpy as np, soundfile as sf
from scipy.signal import butter, lfilter, resample_poly

reel, vpath, epath, out = sys.argv[1:5]
SR = 44100
ev = json.load(open(epath))
voice, vsr = sf.read(vpath, dtype="float32")
if voice.ndim > 1: voice = voice.mean(1)
voice = resample_poly(voice, SR, vsr).astype(np.float64)
D = max(ev["duration"], len(voice) / SR) + .5
N = int(D * SR); t = np.arange(N) / SR
rng = np.random.default_rng(3)
music = np.zeros((N, 2))

def lp(x, f, o=2): b, a = butter(o, f / (SR / 2), "low"); return lfilter(b, a, x)
def hp(x, f, o=2): b, a = butter(o, f / (SR / 2), "high"); return lfilter(b, a, x)
def add(sig, start, g=1.0, pan=0.0):
    i = int(start * SR)
    if i >= N or i + len(sig) <= 0: return
    if i < 0: sig = sig[-i:]; i = 0
    j = min(N, i + len(sig)); s = sig[: j - i] * g
    music[i:j, 0] += s * (1 - pan); music[i:j, 1] += s * (1 + pan)
hz = lambda m: 440 * 2 ** ((m - 69) / 12)
root = 38 if reel == "mkultra" else 37   # D or C#

# --- drone: detuned saws + sub, slowly breathing filter ---
def saw(f, n): tt = np.arange(n) / SR; return 2 * ((tt * f) % 1) - 1
call_t = next(s for s, n in ev["scenes"] if n == "call"); end_t = next(s for s, n in ev["scenes"] if n == "end")
pad = np.zeros(N)
for m, g in [(root, .5), (root + 7, .3), (root + 12, .25), (root + 15, .18)]:
    for det in (-.08, 0, .08): pad += saw(hz(m) * 2 ** (det / 12), N) * g / 3
chunks = []; step = SR // 10
for k in range(0, N, step):
    cut = 220 + 260 * (.5 + .5 * np.sin(2 * np.pi * k / SR / 9)) + 500 * min(1, max(0, (k / SR - (call_t - 6)) / 6))
    chunks.append((k, cut))
padf = np.zeros(N); state = None
for k, cut in chunks:
    seg = pad[k:k + step]; b, a = butter(2, cut / (SR / 2), "low")
    from scipy.signal import lfilter_zi
    if state is None: state = lfilter_zi(b, a) * seg[0]
    y, state = lfilter(b, a, seg, zi=state); padf[k:k + step] = y
sub = np.sin(2 * np.pi * hz(root - 12) * t) * .35
amp = np.clip(t / 2.5, 0, 1) * np.where(t > end_t + 2.5, np.clip(1 - (t - end_t - 2.5) / 1.5, 0, 1), 1)
drone = (padf * .55 + sub) * amp
music[:, 0] += drone * .9; music[:, 1] += drone * .9

# --- heartbeat pulse, tightening toward the verdict ---
bt = .5
while bt < call_t + 1.4:
    prog = min(1, bt / call_t); n = int(.25 * SR); tt = np.arange(n) / SR
    k = np.sin(2 * np.pi * (55 * tt + 40 * (1 - np.exp(-tt * 30)) / 30)) * np.exp(-tt * 16)
    add(k, bt, .35 + .35 * prog); add(k * .6, bt + .22, .3 + .3 * prog)
    bt += 1.0 - .3 * prog

# --- whoosh into each scene ---
for s, name in ev["scenes"][1:]:
    n = int(.5 * SR); nz = rng.standard_normal(n); e = np.linspace(0, 1, n) ** 2.5
    w = hp(lp(nz, 3500), 400) * e; add(w, s - .5, .22, pan=rng.uniform(-.4, .4))

# --- impact on every stamp: sub drop + body + noisy crack + tail ---
def impact(big=False):
    n = int(1.8 * SR); tt = np.arange(n) / SR
    f = 40 + 110 * np.exp(-tt * 14); boom = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * (2.2 if big else 3.2))
    crack = lp(rng.standard_normal(n), 2500) * np.exp(-tt * 28)
    tail = lp(rng.standard_normal(n), 900) * np.exp(-tt * 3) * .25
    return boom * 1.1 + crack * .7 + tail
call_hit = call_t + 1.45
for h in ev["hits"]:
    big = abs(h - call_hit) < .05
    add(impact(big), h, 1.2 if big else .8)

# --- riser into the verdict, then a bright chord on the end card ---
n = int(3 * SR); tt = np.arange(n) / SR; e = (tt / 3) ** 3
riser = hp(rng.standard_normal(n), 1200) * e * .35 + np.sin(2 * np.pi * (200 + 600 * (tt / 3) ** 2) * tt) * e * .12
add(riser, call_hit - 3)
n = int(5 * SR); tt = np.arange(n) / SR
chord = sum(np.sin(2 * np.pi * hz(root + 24 + m) * tt) for m in (0, 3, 7, 10, 14)) / 5 * np.minimum(1, tt / .05) * np.exp(-tt * .55)
add(lp(chord, 3000), end_t, .5)

# --- duck music under the voice ---
v = np.zeros(N); v[:len(voice)] = voice[:N]
env = lp(np.abs(v), 6, 1); env = env / (env.max() + 1e-9)
duck = 1 - .55 * np.clip(env * 4, 0, 1)
music *= duck[:, None]
music = np.tanh(music * .9) * .5
mix = music + np.stack([v, v], 1) * 1.0
mix /= np.abs(mix).max() * 1.05
sf.write(out, mix.astype(np.float32), SR)
print("wrote", out, round(D, 1), "s")
