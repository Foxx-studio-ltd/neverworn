# Neverworn — full audit (November 2026)

**Scope:** every file in the repo, every route and every user function, tested in a real browser (Chromium via Playwright) with a fake camera.
**Rule followed:** none of the live app files (`index.html`, `app.js`, `body.js`, `sync.js`, `backend.js`, `style.css`, `catalog.json`, `assets/`) were changed. All fixes are in a **mirror app** in [`improved/`](improved/). It reuses `../assets`, so the 30 MB of media is not copied.

| | Original | Improved mirror |
|---|---|---|
| Feature tests (every function works) | **24 / 24** | **24 / 24** |
| Bug regression tests (one per bug below) | **0 / 25** (every bug reproduced) | **25 / 25** |
| Data from the live site (old password hashes, old bag format) | — | still works (tested) |

Raw results: [`audit/tests/results-original.json`](audit/tests/results-original.json) and [`audit/tests/results-improved.json`](audit/tests/results-improved.json). Screenshots: [`audit/screens/`](audit/screens/).

## How to see it and test it

```bash
python3 -m http.server 8000          # from the repo root
# original: http://localhost:8000/         mirror: http://localhost:8000/improved/
node audit/tests/run.js original     # needs only `playwright` (Chromium)
node audit/tests/run.js improved
node audit/tests/run.js improved B08 # run tests whose name matches a pattern
```

If this branch were published with GitHub Pages, the mirror would be at `…/neverworn/improved/`.
The pose model normally loads from jsDelivr. The tests swap it for [`audit/tests/fakepose.js`](audit/tests/fakepose.js), a fake that always returns the same body points. That keeps runs repeatable and lets them work in CI, where the CDN may be blocked.

---

## 1. Bugs found, and how each one is fixed

Severity: 🔴 security or data loss · 🟠 broken feature · 🟡 UX or accessibility. The `Bxx` ids match the tests in `audit/tests/run.js`.

### 🔴 Security and data
| # | Bug (reproduced by its test) | Why it happens | Fix in `improved/` |
|---|---|---|---|
| B01 | **Reflected XSS.** Opening `#/signup?next="><img src=x onerror=…>` runs the attacker's script. It can read everything in localStorage: password hashes, body measurements and face frames. | `next` from the URL is pasted straight into an inline `onsubmit="auth(this,'${next}')"` attribute. | A `safeNext()` allow-list of known routes. The value is stored escaped in `data-next`. No inline handlers use URL data. An `esc()` helper is applied to every interpolated value app-wide. |
| B02 | **Sign out wipes the page.** The screen goes blank except for the text `#/` (screenshot: `before-signout.png`). | The link is `href="javascript:…;location.hash='#/'"`. A `javascript:` URL whose last expression is a string replaces the whole document with that string. | A real `<button>` that calls `signOut()`. |
| B03 | **Sign out leaves the bag behind** for the next person on the device. | Sign out never cleared `nw_cart`. | `clearLocal()` removes the bag, avatar, consent, body, height and draft. These live on in the account record, not in the active session. |
| B05 | **Avatar is permanently lost after sign out.** | Frames were stored only in `nw_avatar`, which sign out deletes. The account kept only a "meta" stub. | Frames are synced into the account record. They still stay on this device only, as the README promises. They come back on sign-in. |
| B24 | Password hashed with **one round of SHA-256**. Anyone holding the data can brute-force it cheaply. | `hash()` used `crypto.subtle.digest` once. | **PBKDF2-SHA256, 210,000 iterations** (the OWASP figure). Old-format hashes still verify and are upgraded on the next sign-in. |
| — | A corrupt `nw_db`, or storage blocked (private mode, full quota), throws on every load: blank app. | Bare `JSON.parse(localStorage…)`. | Safe `load`/`save`/`S.get`/`S.set` that fail gracefully and show a toast. |

### 🟠 Broken behaviour
| # | Bug | Why | Fix |
|---|---|---|---|
| B04 | **Guest bag disappears when you sign in** to an existing account. Sign-up kept it; sign-in didn't. | `hydrate()` overwrote the local cart with the account's cart. | `mergeCarts()` combines the guest bag and the account bag on both paths. |
| B08 | Leave the body scan part-way through, and **~5 s later you're yanked to `#/measure`.** A half-finished draft is saved. | The `bodyScan()` async loop never checks whether you're still on the page. | **Route tokens:** every render increments `routeToken`. Async flows take the token and stop silently once it changes. |
| B09 | Leave the avatar recording part-way through: **an avatar is created anyway** and you're sent to `#/height`. | Same cause, in `guided()`. | Same route-token guard. |
| B12 | **Camera stays on** (light lit) after leaving a capture page that was loaded directly. | `route()` ran twice at start-up (session + catalogue). Two `getUserMedia` calls raced and one stream was orphaned. | Rendering waits for both the catalogue and the session (`beforeFirstRoute`). `startCam` stops any stream that arrives after the user has left. |
| B11 | Reloading `#/cart` while signed in throws `Cannot read properties of undefined (reading 'price')`. | The session promise rendered the page before `catalog.json` had loaded. | Same single boot sequence. Bag lines whose ids aren't in the catalogue are dropped instead of crashing. |
| B07 | **Jeans size advice talks about chest and sleeves** ("sleeves +5cm", sized from your chest). | `recommend()` treated every garment as a top. | Each catalogue item gets a `kind` (`top` / `bottom` / `dress` / `full`). Bottoms are sized on waist and hips, with leg-length notes. Dresses and suits also check hips. Sleeve notes appear only on garments with sleeves. |
| B13 | **Impossible measurements save** (chest 5 cm, waist 900 cm), and clothes would be "cut" from them. | Validation was only `> 0`. | A plausible range per field, inline errors with `aria-invalid`, and a soft warning when chest, waist and hips don't fit together. |
| B14 | 182 cm shows as **"5 ft 12 in"**. | Feet and inches were rounded separately. | Total inches are rounded first, then split (`toFtIn`). |
| B10 | **Guest checkout is a dead end.** "Place order" just shows a "Not signed in" toast. | No sign-in path. | Checkout shows a "Sign in to check out" button (`?next=checkout`), and the bag is kept. |
| B23 | Orders go through **with no delivery address**. | The field wasn't required. | Address required, saved with the order. The button is disabled while submitting (no double orders). |
| — | The `#/done` route can't be reached and mentions a product that doesn't exist ("Pearl Shell"). | Left over. | Removed. The flow is now one five-step journey: Consent → Record → Height → Scan → Check. The original's step counters disagreed ("Step 2 of 3", then "Body fit · step 1 of 3" with four dots). |
| — | A failed CDN load of the pose model is cached forever. Retrying does nothing until the page is refreshed. | `detP` promise memoised even after rejection. | Reset on failure. |
| — | "Edit measurements" from a product page lost the "scan" source and marked every field as edited. | It compared against an empty draft. | Compares against the saved body profile. |
| — | Switching cm ↔ ft/in throws away what you just typed. | Re-render without reading the input. | The value is converted and kept. |

### 🟡 UX and accessibility
| # | Issue | Fix |
|---|---|---|
| B06 | **On phones you can't scroll past the home video.** It fills the screen and has `touch-action:none`. | `touch-action:none` only on the press-and-hold try-on panel. The home hero is 4:5 on mobile. The turntable uses `pan-y`, so vertical scrolling still works. |
| B16 | "Design with AI", a headline feature, is **hidden from the mobile nav**. | Shown as "Design". The header was re-fitted for 360–390 px; the test checks that every header control stays fully on screen. |
| B19 | Secondary text contrast is **4.15:1** (WCAG AA needs 4.5). | `--mut` set to `#66646a`: 5.3:1 on the page background, 4.95:1 on tier pills. |
| B20 | Try-on "hold" works only with a pointer. | Hold Space or Enter on the button. Media tabs follow the WAI-ARIA tab pattern (arrow keys). The turntable is a slider (← →). |
| B21 | Toasts are invisible to screen readers, and they pile on top of each other. | One `aria-live` region; the newest toast replaces the old one. |
| B17 | The tab title never changes. | Per-page `document.title`. Focus moves to the page `<h1>` on navigation. |
| B18 | An unknown product shows just the bare text "Not found". | A proper 404 page with a link home. Unknown routes no longer show the home page silently. |
| B22 | Adding an item twice shows two rows, with no way to change quantity. | Bag lines `{id, size, qty}` with − / + controls. The recommended **size is saved with the line and the order**. The button reads "Make mine · size M". |
| B25 | Every visit to the Halo Puffer page downloads the **1.9 MB** try-on video, even for visitors with no avatar. | `preload="none"`; the video loads on the first hold. |
| — | No visible keyboard focus; the prompt input removed its outline. | A global `:focus-visible` ring, a skip link, and labels on all inputs. |
| — | Sign-up errors only appear as native bubbles or brief toasts. | Inline `role="alert"` messages, a show/hide password toggle, and correct `autocomplete` values for password managers. |
| — | No order history; no way to delete your account (the backend had `deleteAccount` but no UI). | "Your orders" list and "Delete my account" on the account page. Deleting the avatar now also records consent as withdrawn. |
| — | No sorting in the range. | Sort: Featured / price low→high / high→low (remembered). |
| — | Autoplaying video and the Ken Burns animation ignore `prefers-reduced-motion`. | Respected. |
| — | Two tabs drift out of sync (the bag count goes stale). | A `storage` event listener re-renders. |
| — | No meta description, social preview image or favicon. | Added in `improved/index.html`. |

---

## 2. Findings not changed in the mirror (they need a decision or data)

1. **Body-scan accuracy is biased toward "Pear".** In `fromPose()`, hip width is the hip keypoint distance × **2.6**, but shoulder width is × **1.3**. With the test body (shoulder-to-hip keypoint ratio 1.5), the scan returns chest 74 cm and hips 113 cm, which classifies as Pear. So the sizes, the body-type variant and the "A-line hem eased over hips" advice are likely skewed for most people. **Recommendation:** collect 20–50 tape-measured volunteers, fit the coefficients by least squares, and add those cases as a test. I left the maths unchanged because I had no real measurements to calibrate against; changing it would have been guesswork.
2. **About 2.4 MB of unused images** are shipped in the repo: `01-rain-shell`, `02-contour-knit`, `03-modular-blazer`, `04-gradient-dress`, `05-cell-gilet`, `06-brand-mood`, five `fit-*.jpg` and `you-poster.jpg`. None of them is referenced anywhere. Delete them or move them to a design folder.
3. **The avatar consent text promised "Encrypted, locked to your account".** The prototype stores frames as plain data URLs in localStorage. The mirror says "Kept on this device in this prototype". Keep claims like this accurate until the real backend exists; biometric consent wording is a legal matter under UK GDPR.
4. **Third-party script without an integrity check.** TF.js loads from jsDelivr with no SRI hash, on a page that holds face images. Self-host the four files, or add `integrity=` hashes.
5. **Next steps for a real launch:** a server backend (`backend.js` is already the single swap point), real payment, a Content-Security-Policy, and image `srcset` sizes for the grid. The front images are already WebP, but the full-size image is used for small cards.

---

## 3. What's in this branch

```
AUDIT.md                  this report
improved/                 the mirror app (same 4 scripts + CSS, rewritten readably; catalog.json gains a `kind` field)
audit/tests/run.js        49 Playwright tests (24 feature + 25 bug regressions), target = original | improved
audit/tests/fakepose.js   deterministic stand-in for the MoveNet CDN bundles
audit/tests/results-*.json  last run, both targets
audit/screens/            before/after screenshots (mobile home, bag, guest checkout, jeans fit, account, sign-out bug)
```

To adopt the fixes: copy `improved/*` over the root files, then delete `data-root="../"` and the `.mirror-banner` from `index.html`. The tests then pass against the root with `node audit/tests/run.js original`.
