# Synthesises the ad soundtrack (no samples, no licensing). Output: soundtrack.wav
import numpy as np, wave
SR = 44100; D = 34.0; N = int(SR * D); t = np.arange(N) / SR
L = np.zeros(N); R = np.zeros(N)
def env(n, a, r):
    e = np.ones(n); a = int(a * SR); r = int(r * SR)
    if a: e[:a] = np.linspace(0, 1, a)
    if r: e[-r:] *= np.linspace(1, 0, r)
    return e
def add(sig, start, gain=1.0, pan=0.0):
    i = int(start * SR); j = min(N, i + len(sig)); s = sig[: j - i] * gain
    L[i:j] += s * (1 - pan) ; R[i:j] += s * (1 + pan)
def note(f, dur, a=.8, r=1.2, harm=(1, .35, .12), detune=.0015):
    n = int(dur * SR); tt = np.arange(n) / SR; s = np.zeros(n)
    for k, h in enumerate(harm, 1):
        s += h * (np.sin(2*np.pi*f*k*tt) + np.sin(2*np.pi*f*k*(1+detune)*tt)) / 2
    return s * env(n, a, r)
hz = lambda m: 440 * 2 ** ((m - 69) / 12)
# chords (midi): A minor-ish tension → lift to F/C/G at the logo
chords = [(0, 6.4, [45, 52, 57, 60, 64]), (6.4, 11.4, [41, 48, 53, 57, 64]),
          (11.4, 17.4, [48, 55, 60, 64, 67, 71]), (17.4, 23.4, [45, 52, 57, 60, 64, 67]),
          (23.4, 29.6, [41, 48, 57, 60, 65, 69]), (29.6, 34, [43, 50, 55, 59, 62, 67])]
for a, b, ms in chords:
    for i, m in enumerate(ms):
        add(note(hz(m), b - a + 1.2, a=1.2, r=1.6), a, .045 if m > 50 else .07, pan=(i % 2 - .5) * .4)
# soft pulse 100bpm in the demo + montage
beat = 60 / 100
for k in range(int((29.6 - 13.4) / beat)):
    st = 13.4 + k * beat; n = int(.35 * SR); tt = np.arange(n) / SR
    kick = np.sin(2 * np.pi * (48 + 60 * np.exp(-tt * 30)) * tt) * np.exp(-tt * 9)
    add(kick, st, .22)
    if k % 2: 
        hat = np.random.default_rng(k).standard_normal(int(.05 * SR)) * np.exp(-np.arange(int(.05 * SR)) / SR * 90)
        add(np.diff(hat, prepend=0), st, .05, pan=.3)
# arpeggio sparkle over the logo
for i, m in enumerate([72, 76, 79, 83, 84, 88]):
    add(note(hz(m), .9, a=.005, r=.85, harm=(1, .2)), 11.0 + i * .12, .05, pan=(i % 3 - 1) * .5)
def click(f=2400, dur=.03, g=.25, noise=.5, seed=0):
    n = int(dur * SR); tt = np.arange(n) / SR
    s = np.sin(2*np.pi*f*tt) * (1 - noise) + np.random.default_rng(seed).standard_normal(n) * noise
    return s * np.exp(-tt * 140) * g
# friction ticks
for i in range(7): add(click(1800, .04, .5, .3, i), 7 + i * .45)
for i in range(7): add(click(900, .05, .25, .6, 20 + i), 10.35 + i * .08)
# shutter
add(click(3000, .06, .9, .8, 99), 14.55); add(click(1200, .05, .5, .7, 98), 14.62)
# pin pop
n = int(.12 * SR); tt = np.arange(n) / SR; add(np.sin(2*np.pi*(500 + 900*tt/.12)*tt) * np.exp(-tt*30), 17.2, .25)
# send whoosh
n = int(.6 * SR); tt = np.arange(n) / SR; wn = np.random.default_rng(5).standard_normal(n)
wn = np.convolve(wn, np.ones(30) / 30, mode="same") * np.sin(np.pi * tt / .6) ** 2
add(wn, 20.05, .9, pan=.2); add(click(2000, .04, .4, .4, 7), 20.0); add(click(2000, .04, .4, .4, 8), 21.2)
# end chime
for i, m in enumerate([79, 83, 86, 91]): add(note(hz(m), 2.4, a=.005, r=2.2, harm=(1, .25, .05)), 31.3 + i * .06, .07, pan=(i - 1.5) * .25)
mix = np.stack([L, R], 1)
fade = np.ones(N); fade[-int(1.5 * SR):] = np.linspace(1, 0, int(1.5 * SR)); fade[:int(.3 * SR)] = np.linspace(0, 1, int(.3 * SR))
mix *= fade[:, None]; mix /= np.abs(mix).max() / .89
with wave.open("soundtrack.wav", "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((mix * 32767).astype("<i2").tobytes())
print("ok")
