# Rabbit Hole: Some of it was true.

A TikTok-style feed of declassified files, cover-ups and famous hoaxes. You swipe through the files, call each one real or fake, and go deeper.

- `src/app.html` is the page source. `data/cases.json` holds the case library (62 cases in 10 holes) and `data/media.json` the photos and reels. `node rabbithole/build.mjs` inlines both into `index.html` (the live PWA) and `artifact.html` (the Claude-hosted copy).
- `index.html` is the installable PWA built from that source with `node rabbithole/build.mjs` (it adds the manifest, icons, a service worker and offline support).
- `icons/icon.svg` is the master logo. `node rabbithole/icons/render.cjs` renders the PNG icons, `og.png` and `docs/logo-sheet.png`.
- `tests/smoke.cjs` is a Playwright smoke test with 26 checks. Serve the repo root on :8765, then run `node rabbithole/tests/smoke.cjs <outdir>`.

## The logo
A rabbit whose head is a keyhole. Inside the keyhole is a tunnel of rings that ends in one highlighted point. The one mark carries three ideas: the rabbit, secrets (the keyhole) and depth (the tunnel). In the wordmark, the O in HOLE is the same tunnel.

## The hook loop
1. **Hook headline.** Each file opens with one claim, set huge, with a highlighter on the shocking part.
2. **Lift the bars.** The evidence is redacted. Tapping a black bar reveals a clue. If you call it without lifting any bars, you get double depth (a "gut call").
3. **Call it.** You tap Real or Fake. A verdict stamp slams down (Real, Fake, Half true or Unexplained), followed by the truth and a real source.
4. **Go deeper.** Every file chains to the next one in its hole, so stopping feels like leaving a story half-told.
5. **Depth meter.** Every swipe, call and chain adds metres. Levels run from Surface down to The Bottom.
6. **Today's file.** There's a daily drop with a countdown to the next one, plus a daily streak.
7. **Case board.** Pinned files land on a corkboard. Red string joins files from the same story, which makes it a natural screenshot to share.
8. **Top Secret.** About one file in five is locked. You can see the headline and a blurred file, but opening it needs clearance (the paywall).

## The debate
Every case and reel has a debate thread. You pick a side (Real or Fake), post an argument of up to 280 characters, reply to someone (a reply from the other side is tagged Rebuttal) and mark arguments Convincing. A tally bar shows how the room splits, and filters show Newest, Most convincing, Real side or Fake side. Each case opens with a house prompt from Rabbit Hole. No fake users are seeded.
- **In the Claude-hosted copy**, debates are shared. Each person's posts live in their own record (`posts/<id>`), everyone can read them, people write only their own, and the owner can remove anything.
- **On the live site (GitHub Pages)**, there's no server, so posts stay on the device. To make them shared there, swap the two calls in `Debate.connect` for a hosted database such as Supabase or Firebase.

## Money
There's a paywall called "Get clearance": $29.99 a year with a 7-day free trial (the default), or $4.99 a week. The terms are stated plainly next to the buy button, with a reminder before the trial ends. That's deliberate: dark-pattern trials get apps refunds, bad reviews and App Review trouble. In the prototype no payment is taken. To go live, swap the button for RevenueCat or StoreKit.

## Content rules
The files are real and sourced. Most are declassified government records, plus a set of famous hoaxes with the evidence that debunks them. Health and election conspiracies are deliberately left out. That keeps the app within App Store rule 1.1 and acceptable to payment and ad partners.

## Prototype limits
- **Storage:** progress lives in localStorage on this device only.
- **Social proof:** the "% of diggers" figures need a backend, so the prototype only tracks your own record.
- **Notifications:** the push alert for the daily file needs a push server.

## Watch tab
A full-screen vertical feed of reels that autoplays the one in view. Tap once for sound. Each reel has Pin, Debate, Share and Open file buttons.

## Photos (`media/`)
Archive photos come from each case's Wikipedia article. `media/fetch_photos.py` keeps only files Wikimedia Commons marks as public domain or CC0. Then `media/pick_photos.py sheets` makes contact sheets for review by eye, and `pick_photos.py apply` writes the chosen photos with credit, licence and source page into `data/media.json`. Credits show under each reel and on each case's verdict.

## Reels (`reels/`)
These are short promo videos in the style of the Bible apps' reels: narration, word-by-word captions, animated archive documents and a "Real or fake?" verdict that leads into the app.
- `rabbithole-mkultra.mp4` (49s, male voice) and `rabbithole-northwoods.mp4` (44s, female voice). Both are 1080x1920 at 30 fps, mastered to -14 LUFS.
- **Pipeline:**
  - `scripts.json` holds the script.
  - `voice.py` generates the narration with Kokoro (open-weights TTS, Apache-2.0).
  - `reel.html` draws each frame.
  - `render.cjs` captures the frames.
  - `sound.py` synthesises the score and ducks it under the voice.
  - `make.sh` runs everything.
- **Library:** every case has a reel built from the standard template (hook, three evidence slips whose bars lift as they're read, real or fake, verdict and reveal, end card). `voice.py` writes the narration from `data/cases.json`, and `batch.sh <workdir> <parallel> <ids...>` renders 720p copies into `reels/lib/` for in-app streaming.
- **Showcase cuts:** MKUltra, Northwoods and Area 51 have hand-written scripts in `scripts.json`, rendered at 1080p for posting.
- **New reels:** add a case to `data/cases.json` (with a `reveal` line), then run `voice.py` and `batch.sh` for its id.
