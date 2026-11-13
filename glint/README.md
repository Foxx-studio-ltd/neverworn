# Glint (working name) — See it. Say it. Send it.

Snap anything, pin the spots you mean, say what you want, send it to any AI as one card.

- `index.html` — installable PWA (built from `src/app.html` by `node glint/build.mjs`). Live camera, hold-shutter-to-talk, Web Speech, native share sheet, Android share target, offline.
- `src/app.html` — the single source; also published as-is as a Claude artifact (uses Claude dictation, "Ask Claude here", downloads).
- `docs/brief.html` — consult: risks + fixes, the 3 visual directions, how to use, virality, architecture, roadmap.
- `promo/` — the ad. `glint-ad-9x16.mp4` (vertical), `glint-ad-16x9.mp4`. Re-render: serve repo root on :8765, `node promo/render.cjs <framesdir>`, `python3 promo/sound.py`, then ffmpeg (see commit).
- `tests/smoke.cjs` — Playwright smoke test (serve repo root on :8765 first).

Architecture: one `Capture` model; Sources, Voice engines and Destinations are adapter registries, so new devices/AIs plug in without touching the core. Data is local-first (IndexedDB); nothing leaves the device until you send.
