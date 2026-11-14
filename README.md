# Neverworn (provisional name) — static prototype

AI-designed clothing demo: Drop 01 catalogue, sign up, one-time camera body scan (or manual entry) with editable measurements, press-and-hold try-on matched to one of 5 pre-rendered body types with a size recommendation, bag and mock checkout (no payment taken).

Live: https://foxx-studio-ltd.github.io/neverworn/

- Pure static site (GitHub Pages). Hash routing, relative URLs.
- **Prototype: your account is saved on this device only** (browser localStorage, password hashed with PBKDF2-SHA256). Nothing is sent to a server.
- `backend.js` is the single swap point: replace its methods with API calls to bring back a real server.
- Pose model (TensorFlow.js MoveNet) loads from jsDelivr; camera needs HTTPS.
- "Design with AI" chat uses canned offline replies; no API keys.

- Tests: `node audit/tests/run.js` (Playwright: 24 feature + 25 regression tests). Audit and change log: `AUDIT.md`.

Glint now lives in its own repo at github.com/Foxx-studio-ltd/glint, and Rabbit Hole at github.com/Foxx-studio-ltd/rabbit-hole.
