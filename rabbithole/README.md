# Rabbit Hole: Some of it was true.

A TikTok-style feed of declassified files, cover-ups and famous hoaxes. You swipe through the files, call each one real or fake, and go deeper.

- `src/app.html` is the single source. It's published as-is as the Claude artifact.
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

## Money
There's a paywall called "Get clearance": $29.99 a year with a 7-day free trial (the default), or $4.99 a week. The terms are stated plainly next to the buy button, with a reminder before the trial ends. That's deliberate: dark-pattern trials get apps refunds, bad reviews and App Review trouble. In the prototype no payment is taken. To go live, swap the button for RevenueCat or StoreKit.

## Content rules
The files are real and sourced. Most are declassified government records, plus a set of famous hoaxes with the evidence that debunks them. Health and election conspiracies are deliberately left out. That keeps the app within App Store rule 1.1 and acceptable to payment and ad partners.

## Prototype limits
- **Storage:** progress lives in localStorage on this device only.
- **Social proof:** the "% of diggers" figures need a backend, so the prototype only tracks your own record.
- **Notifications:** the push alert for the daily file needs a push server.
