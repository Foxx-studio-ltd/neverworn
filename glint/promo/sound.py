# Soundtrack for ad.html: 140 BPM, synthesised from scratch (no samples, nothing to license).
# Beat map mirrors the cuts in ad2.html. Output: soundtrack.wav
import numpy as np, wave
from scipy.signal import lfilter, butter
SR = 44100; BPM = 140; B = 60 / BPM; BEATS = 50
D = 52 * B; N = int(D * SR); t = np.arange(N) / SR
L = np.zeros(N); R = np.zeros(N); FX = np.zeros(N)  # FX = reverb send
rng = np.random.default_rng(7)
def at(beat): return beat * B
def add(sig, start, g=1.0, pan=0.0, send=0.0):
    i = int(start * SR)
    if i >= N: return
    j = min(N, i + len(sig)); s = sig[: j - i] * g
    L[i:j] += s * (1 - pan); R[i:j] += s * (1 + pan); FX[i:j] += s * send
def env(n, a=.002, r=None, decay=None):
    tt = np.arange(n) / SR; e = np.ones(n)
    ai = max(1, int(a * SR)); e[:ai] = np.linspace(0, 1, ai)
    if decay: e *= np.exp(-tt * decay)
    if r: ri = int(r * SR); e[-ri:] *= np.linspace(1, 0, ri)
    return e
def lp(x, f, o=2): b, a = butter(o, f / (SR / 2), "low"); return lfilter(b, a, x)
def hp(x, f, o=2): b, a = butter(o, f / (SR / 2), "high"); return lfilter(b, a, x)
def bp(x, f1, f2): b, a = butter(2, [f1 / (SR / 2), f2 / (SR / 2)], "band"); return lfilter(b, a, x)
hz = lambda m: 440 * 2 ** ((m - 69) / 12)
def saw(f, n, det=(0, .07, -.07)):
    tt = np.arange(n) / SR; return sum(2 * ((tt * f * 2 ** (d / 12)) % 1) - 1 for d in det) / len(det)

# --- drums ---
def kick(g=1.0):
    n = int(.45 * SR); tt = np.arange(n) / SR
    f = 42 + 140 * np.exp(-tt * 38); ph = 2 * np.pi * np.cumsum(f) / SR
    s = np.sin(ph) * np.exp(-tt * 7.5) + .25 * np.sin(ph * 2) * np.exp(-tt * 30)
    s[:60] += rng.standard_normal(60) * .4 * np.linspace(1, 0, 60)
    return np.tanh(s * 1.6) * g
def clap():
    n = int(.3 * SR); nz = bp(rng.standard_normal(n), 900, 4000); e = np.zeros(n)
    for o in (0, .011, .022): i = int(o * SR); e[i:] += np.exp(-np.arange(n - i) / SR * 38)
    return nz * e * .7
def hat(open_=False):
    n = int((.22 if open_ else .05) * SR); return hp(rng.standard_normal(n), 7000) * np.exp(-np.arange(n) / SR * (12 if open_ else 70)) * .5
def impact():
    n = int(2.2 * SR); tt = np.arange(n) / SR
    boom = np.sin(2 * np.pi * np.cumsum(30 + 70 * np.exp(-tt * 9)) / SR) * np.exp(-tt * 2.2)
    crack = hp(rng.standard_normal(n), 1500) * np.exp(-tt * 18) * .6
    return np.tanh((boom * 1.3 + crack) * 1.4)
def riser(dur):
    n = int(dur * SR); tt = np.arange(n) / SR; x = tt / dur
    nz = rng.standard_normal(n); out = np.zeros(n); seg = 2048
    for i in range(0, n, seg):  # sweep a band-pass upward
        f = 300 + 7000 * (i / n) ** 2; out[i:i + seg] = bp(nz[max(0, i - 4096):i + seg], f, min(f * 1.8, 20000))[-len(out[i:i + seg]):]
    tone = np.sin(2 * np.pi * np.cumsum(200 + 900 * x ** 2) / SR) * .25
    return (out * .9 + tone) * x ** 1.6
def whoosh(dur=.35, up=True):
    n = int(dur * SR); x = np.arange(n) / n; nz = rng.standard_normal(n); out = np.zeros(n); seg = 1024
    for i in range(0, n, seg):
        p = i / n; f = (600 + 5000 * p) if up else (5600 - 5000 * p); out[i:i + seg] = bp(nz[max(0, i - 2048):i + seg], f, f * 1.6)[-len(out[i:i + seg]):]
    return out * np.sin(np.pi * x) ** 1.5 * 1.6
def click(f=2500, g=.5): n = int(.03 * SR); tt = np.arange(n) / SR; return (np.sin(2 * np.pi * f * tt) * .5 + rng.standard_normal(n) * .5) * np.exp(-tt * 160) * g
def shutter():
    a = hp(rng.standard_normal(int(.05 * SR)), 2000) * np.exp(-np.arange(int(.05 * SR)) / SR * 90)
    out = np.zeros(int(.16 * SR)); out[:len(a)] += a; out[int(.07 * SR):int(.07 * SR) + len(a)] += a * .7; return out * 1.1
def pop(f0=500, f1=1400):
    n = int(.14 * SR); tt = np.arange(n) / SR; return np.sin(2 * np.pi * np.cumsum(f0 + (f1 - f0) * tt / .14) / SR) * np.exp(-tt * 28)
def pluck(m, dur=.6, bright=1.0):
    n = int(dur * SR); s = saw(hz(m), n, (0, .1, -.1)) + .5 * np.sin(2 * np.pi * hz(m + 12) * np.arange(n) / SR)
    return lp(s, 1800 + 5000 * bright) * env(n, .002, decay=6)
def stab(ms, dur=.22):
    n = int(dur * SR); s = sum(saw(hz(m), n) for m in ms) / len(ms); return lp(s, 3200) * env(n, .003, r=.05, decay=5)
def chime(m): n = int(2.5 * SR); tt = np.arange(n) / SR; return sum(np.sin(2 * np.pi * hz(m) * k * tt) * a * np.exp(-tt * (2 + k)) for k, a in ((1, 1), (2, .4), (3, .2), (4.2, .12)))
def tapestop(dur):  # downward pitch sweep of a chord
    n = int(dur * SR); x = np.arange(n) / n; f = 1 - .8 * x ** 1.5
    return sum(np.sin(2 * np.pi * np.cumsum(hz(m) * f) / SR) for m in (57, 60, 64)) / 3 * (1 - x) * .6
def glitch(): n = int(.06 * SR); return np.sign(np.sin(2 * np.pi * rng.uniform(300, 1800) * np.arange(n) / SR)) * np.exp(-np.arange(n) / SR * 50) * .25

ROOTS = [45, 41, 48, 43]  # A F C G
CHORDS = [[57, 60, 64, 67], [53, 57, 60, 64], [55, 60, 64, 67], [55, 59, 62, 67]]
duck = np.ones(N)
def kick_at(beat, g=1.0):
    add(kick(g), at(beat), .95); i = int(at(beat) * SR); n = int(.22 * SR)
    if i < N: duck[i:i + n] = np.minimum(duck[i:i + n], np.linspace(.25, 1, len(duck[i:i + n])))

# --- HOOK (b0–5): every word a slam
for b0, ms in [(0, CHORDS[0]), (1, CHORDS[1]), (2, CHORDS[2])]:
    add(impact(), at(b0), .55, send=.2); kick_at(b0, 1.1); add(stab([m + 12 for m in ms], .35), at(b0), .35, send=.4)
add(shutter(), 0, .7); add(pop(), at(.45), .35)
for i in range(8): add(click(3000 - i * 150, .25), at(1 + i * .125), 1, pan=(i % 2 - .5) * .6)  # "say it" chatter
for i in range(4): add(whoosh(.3), at(2 + i * .12) - .1, .35, pan=(i - 1.5) * .3); add(pop(700 + i * 200, 1800 + i * 200), at(2.35 + i * .12), .25)
add(riser(at(1) * 1.0), at(2), .5)
add(impact(), at(3), .9, send=.35); kick_at(3, 1.2)
for i, m in enumerate([76, 79, 83, 88, 91]): add(pluck(m, .9, 1.2), at(3) + i * .045, .16, pan=(i - 2) * .25, send=.5)
add(chime(88), at(3.1), .12, send=.6)
# --- FRICTION (b5–9.5): tense, glitchy, no kick
for i in range(12):
    add(glitch(), at(5 + i * .25), 1, pan=(rng.random() - .5)); add(click(1600 + 120 * i, .45), at(5 + i * .25), 1)
for i in range(24): add(hat(), at(5 + i * .125), .5, pan=.2)
add(riser(at(3)), at(5), .45)
add(impact(), at(8), 1.0, send=.3); kick_at(8, 1.2); add(stab([45, 52, 57, 60], .5), at(8), .5)
add(tapestop(at(1.4)), at(8.1), .8)
add(impact(), at(9.5), .7, send=.3); add(pop(400, 1200), at(9.6), .4)
add(riser(at(1.5)), at(9.5), .55)
# --- GROOVE (b11–41)
for b in np.arange(11, 41, 1.0):
    kick_at(b)
    if int(b) % 2 == 0: add(clap(), at(b), .55, send=.2)
    add(hat(True), at(b + .5), .35, pan=.25)
    if b >= 13: [add(hat(), at(b + s), .22, pan=-.2) for s in (.25, .75)]
    bar = int((b - 11) // 4) % 4
    n = int(B * SR); sub = np.sin(2 * np.pi * hz(ROOTS[bar] - 12) * np.arange(n) / SR) * env(n, .005, r=.05)
    add(sub, at(b), .5); add(sub, at(b + .5), .35)
    if int(b) % 2 == 1: add(stab(CHORDS[bar], .18), at(b + .5), .22, pan=-.15, send=.25)
# demo SFX
add(whoosh(.4), at(11) - .2, .6); add(impact(), at(11), .6, send=.2)
add(click(2400, .6), at(11.95)); add(shutter(), at(12), .9); add(pop(900, 1600), at(12.3), .3)  # mic on
add(pop(), at(15), .45)
add(click(2400, .6), at(17)); add(whoosh(.3), at(17.1), .5)
add(riser(at(1)), at(17), .5)
for i, m in enumerate([72, 76, 79, 84]):  # one bright pluck per AI verb, rising
    add(whoosh(.25), at(18 + i) - .12, .55, pan=(.4 if i % 2 else -.4)); add(impact(), at(18 + i), .45, send=.15)
    add(pluck(m, .5), at(18 + i), .35, send=.35); add(pluck(m + 7, .5), at(18 + i) + .06, .2, send=.35)
add(whoosh(.45), at(22) - .2, .6); add(impact(), at(22), .7, send=.25); add(chime(84), at(22.5), .1, send=.5)
add(riser(at(1)), at(23), .55); add(impact(), at(24), .9, send=.35)
for i in range(4): add(pop(500 + i * 120, 1300 + i * 150), at(26 + i * 1.1), .45, pan=[-.5, 0, .5, -.5][i]); add(click(3200, .25), at(26 + i * 1.1) + .05)
for i in range(3): add(whoosh(.3), at(25 + i * .15) - .1, .35)
add(impact(), at(31), .6, send=.25); add(click(2400, .6), at(32.2))
for i in range(4): add(whoosh(.35, up=i % 2 == 0), at(33 + i * 2) - .15, .7, pan=(.5 if i % 2 else -.5)); add(pop(600, 1500), at(33.3 + i * 2), .3)
add(riser(at(2)), at(39), .6)
# --- END (b41–50)
for i, b in enumerate((41, 42, 43)):
    add(impact(), at(b), .8, send=.3); kick_at(b, 1.2); add(stab([m + 12 for m in CHORDS[i % 3]], .3), at(b), .4, send=.4)
add(impact(), at(44), 1.0, send=.5); kick_at(44, 1.3)
for i, m in enumerate([72, 76, 79, 84, 88]): add(chime(m), at(44) + i * .05, .09, pan=(i - 2) * .25, send=.6)
pad_n = int(at(6) * SR)
for m in (48, 55, 60, 64, 67): add(lp(saw(hz(m), pad_n), 2500) * env(pad_n, .3, r=1.5) * .5, at(44), .09, send=.4)
for i in range(5): add(pop(800 + i * 150, 1900 + i * 150), at(46 + i * .2), .22)
for b in np.arange(45, 51, 1.0):  # outro groove under the end card
    kick_at(b, .9); add(hat(True), at(b + .5), .3, pan=.25); [add(hat(), at(b + q), .18, pan=-.2) for q in (.25, .75)]
    if int(b) % 2 == 0: add(clap(), at(b), .45, send=.3)
    n = int(B * SR); sub = np.sin(2 * np.pi * hz(36) * np.arange(n) / SR) * env(n, .005, r=.05); add(sub, at(b), .45)
    if int(b) % 2 == 1: add(stab([60, 64, 67, 72], .2), at(b + .5), .2, send=.4)
add(impact(), at(51), .7, send=.6); add(chime(84), at(51), .12, send=.7)

# --- mix: sidechain duck on music bus approximated by ducking everything except kicks we already placed
mix = np.stack([L, R], 1) * duck[:, None] ** .5
# reverb: Schroeder combs + allpasses on the send
def comb(x, d, g): a = np.zeros(d + 1); a[0] = 1; a[d] = -g; return lfilter([1], a, x)
def allpass(x, d, g): b = np.zeros(d + 1); b[0] = -g; b[d] = 1; a = np.zeros(d + 1); a[0] = 1; a[d] = -g; return lfilter(b, a, x)
wet = sum(comb(FX, d, .82) for d in (1557, 1617, 1491, 1422)) / 4
for d in (225, 556, 441): wet = allpass(wet, d, .6)
wet = lp(wet, 6000)
mix[:, 0] += wet * .35; mix[:, 1] += np.roll(wet, 300) * .35
mix = hp(mix.T, 28).T
mix = np.tanh(mix * 1.15)  # glue / loudness
fade = np.ones(N); fade[-int(1.6 * SR):] = np.linspace(1, 0, int(1.6 * SR)) ** 1.5; mix *= fade[:, None]
mix /= np.abs(mix).max() / .95
with wave.open("soundtrack.wav", "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((mix * 32767).astype("<i2").tobytes())
print("ok", round(D, 2))
