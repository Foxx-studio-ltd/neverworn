# Glint (working name): See it. Say it. Send it.

Snap anything, pin the spots you mean, say what you want, then Claude it / ChatGPT it / Grok it / Gemini it / Perplexity it.

- `src/app.html`: the single source. Published as-is as the Claude artifact (adds Claude dictation, "Claude it here", downloads, and live #SeeSaySend rooms via db/user/room).
- `index.html`: installable PWA built from the source (`node glint/build.mjs`). Live camera, hold-shutter-to-talk, Web Speech, native share sheet, Android share target, offline.
- `logos.py`: inlines the AI brand marks (from `@lobehub/icons-static-svg`, MIT) into the source.
- `docs/brief.html`: product brief (risks and fixes, colour plan, rooms, how-to, roadmap, ad).
- `promo/`: the ad (`glint-ad-9x16.mp4`, `glint-ad-16x9.mp4`). Re-render: serve the repo root on :8765, run `node promo/render.cjs ad.html <framesdir>`, run `python3 promo/sound.py`, then mux with ffmpeg.
- `tests/smoke.cjs`: Playwright smoke test. Covers the standalone app, remix links, Before → After, and rooms on a fake in-memory Claude host.

Architecture: one `Capture` model. Sources, voice engines and destinations are adapter registries, so new devices and AIs plug in without touching the core. Local-first (IndexedDB). Remix links carry note and pins in the URL hash. Rooms store posts as `rooms/{rid}/posts/{pid}`, with `notes` and `glints` subcollections.
