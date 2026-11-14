# Rabbit Hole: Some of it was true.

A TikTok-style feed of declassified files, cover-ups and famous hoaxes. You swipe through the files, call each one real or fake, and go deeper.

- `src/app.html` is the page source. `data/cases.json` holds the case library (62 cases in 10 holes) and `data/media.json` the photos and reels. `node rabbithole/build.mjs` inlines both into `index.html` (the live PWA) and `artifact.html` (the Claude-hosted copy).
- `index.html` is the installable PWA built from that source with `node rabbithole/build.mjs` (it adds the manifest, icons, a service worker and offline support).
- `icons/icon.svg` is the master logo. `node rabbithole/icons/render.cjs` renders the PNG icons, `og.png` and `docs/logo-sheet.png`.
- `tests/smoke.cjs` is a Playwright smoke test with 26 checks. Serve the repo root on :8765, then run `node rabbithole/tests/smoke.cjs <outdir>`.

## The logo
A rabbit whose head is a keyhole. Inside the keyhole is a tunnel of rings that ends in one highlighted point. The one mark carries three ideas: the rabbit, secrets (the keyhole) and depth (the tunnel). In the wordmark, the O in HOLE is the same tunnel.

## The show
Rabbit Hole is hosted by **Alice**, so it feels like a show rather than a content farm.
- **Look and sound:** every episode uses the same voice, the same visual style and the same sonic sting.
- **Format:** cold-open hook, then the ident ("I'm Alice. This is Rabbit Hole. File 8258."), three evidence beats, "Real or fake?", the verdict stamp, and a cliffhanger into the next file ("Mind the hole.").
- **On-screen host:** Alice is the rabbit-keyhole mark, whose tunnel rings pulse with her voice.

## The hook loop
1. **Daily drop at 7 pm local time.** One new file a day in a fixed order (`data/cases.json` → `drops`). Alerts read "Today's Rabbit Hole: the Dyatlov Pass" and are sent by the service worker where the platform allows it (see Alerts).
2. **Light streak.** A day counts when you open that day's drop. One missed day a week is forgiven.
3. **Cliffhanger chain.** Every file and every episode ends on "Next file: …", and the Watch feed auto-advances. Free users get the drop plus the next two links each day. **Clearance** (the subscription) unlocks every chain and all past drops.
4. **Explore.** Ask Alice anything in plain English: a rumour, a name, a question. She opens the strongest lead, then every file offers three doors: next in the chain, same hole, or a different angle. A breadcrumb trail lets you explore one layer at a time. Theories that target real people or groups get no file, only other ways in.
5. **Case files.** Every story expands into its full file: the record, evidence that expands to its source, the original document, related files and community additions.
6. **Depth, case board, holes.** Progress you can see.

## Community: case-building, moderated from day one
People add to cases instead of posting into an open timeline. They can add an evidence tip (with a source link), a video they recorded (up to 20 MB) or propose a new case. Each person has a profile with a handle and a bio, and the Community tab shows everyone's published work.
- **Pre-moderation:** nothing appears until a moderator approves it.
- **Automatic filters:** links in text, threats, phone numbers, emails and street addresses are blocked. Health claims, election claims, hate tropes and shouting are flagged for review.
- **Mod console** (owners and editors only):
  - a queue with optional Claude triage (it suggests; a human decides) and video preview
  - reports with their reasons, plus automatic hiding after N reports
  - bans, with the option to remove everything the person posted
  - an audit log of every action
  - settings: community on or off, slow mode, blocked words and house rules
  - rejected videos are deleted from storage
- **Storage:** inside Claude this runs on the artifact's database and asset store. Data rules:
  - posts and reports can be read only by their author and moderators
  - the public thread and the settings can be written only by moderators
- **Live site:** GitHub Pages has no server, so the live site shows the community as coming soon. To open it to the public, connect a hosted backend (for example Supabase for accounts, database and video storage). Only `Community.connect` and `Community.upload` need to change.

## Alerts
On Android, the installed app sends the 7 pm alert through Periodic Background Sync. Exact-time delivery on every platform, including iOS, needs Web Push from a server: send a push at the drop time and the service worker's `push` handler shows the alert.

## iPhone
The installed app locks the screen: no pinch or double-tap zoom, no sideways drift or rubber-banding, and no input zoom (inputs use 16 px text). Only feeds and panels scroll, vertically.

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
