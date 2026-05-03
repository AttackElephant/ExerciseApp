# Testing Phase 1 on an iPhone

Goal: install the PWA on an iPhone home screen and verify it launches and
renders today's regime fully offline (US1).

This guide covers two paths:

- **A. Public test via GitHub Pages** — recommended; mirrors production.
- **B. Local-network test via Mac dev server** — faster iteration, requires HTTPS.

> Service workers and "Add to Home Screen" require **HTTPS** (or `localhost` in
> desktop Safari). Plain `http://192.168.x.x` from your Mac will not register
> the service worker on iPhone — use one of the paths below.

---

## A. GitHub Pages (recommended)

> **Test the branch before you merge.** GitHub Pages can deploy directly from
> a feature branch — point Pages at `claude/build-phase-1-OtBmb`, validate on
> the iPhone, then merge to `main` once it passes. Don't merge unverified
> code into `main` just to deploy it.

### A1. Confirm the branch is pushed

The Phase 1 work lives on `claude/build-phase-1-OtBmb`. It's already on the
remote — verify with:

```bash
git fetch origin
git ls-remote --heads origin claude/build-phase-1-OtBmb
```

### A2. Point GitHub Pages at the test branch

1. On GitHub, go to **Settings → Pages**.
2. Under **Build and deployment → Source**, choose **Deploy from a branch**.
3. Branch: `claude/build-phase-1-OtBmb`, folder: `/ (root)`. Click **Save**.
4. Wait for the deployment to go green (1–2 minutes). The URL will be:

   ```
   https://attackelephant.github.io/ExerciseApp/
   ```

   The URL stays the same when you re-point Pages later — only the source
   branch changes.

### A2b. Promote to `main` once the branch passes iPhone testing

After steps A3–A7 below succeed on a real device:

```bash
git checkout main
git pull
git merge --no-ff claude/build-phase-1-OtBmb
git push origin main
```

Then return to **Settings → Pages** and switch the source branch from
`claude/build-phase-1-OtBmb` to `main`. From here on, `main` is the deployed
branch and feature branches are tested by re-pointing Pages at them
temporarily (or by spinning up Path B for short iterations).

### A3. Smoke-test in desktop Safari first

On a Mac:

1. Open `https://attackelephant.github.io/ExerciseApp/` in Safari.
2. Open **Develop → Show Web Inspector → Storage → Service Workers**.
3. Confirm `sw.js` is **Activated and is running**.
4. Under **Storage → Cache Storage**, confirm `exerciseapp-v1` exists with all
   shipped files (`index.html`, `src/app.js`, icons, etc.).
5. Confirm today's weekday and exercises render correctly.

If anything fails here, fix on desktop before going to iPhone — iOS Safari is
strictly harder to debug.

### A4. Install on iPhone

On the iPhone (iOS 15+):

1. Open **Safari** (not Chrome — Chrome on iOS cannot install PWAs).
2. Navigate to `https://attackelephant.github.io/ExerciseApp/`.
3. Tap the **Share** icon (square with up-arrow) at the bottom.
4. Scroll down and tap **Add to Home Screen**.
5. Title should pre-fill as "Exercise". Tap **Add** (top right).
6. The app icon (solid green tile from `icon-192.png`) appears on the home screen.

### A5. First online launch

1. Tap the home-screen icon. The app opens in **standalone mode** (no Safari
   chrome — no URL bar, no tabs). If you still see Safari UI, the install
   didn't work; remove and re-add.
2. Verify:
   - Today's date and weekday at the top match the device clock.
   - Morning/afternoon sessions match the default regime
     (`src/defaultRegime.js`).
   - On Sunday, the rest-day message shows.
   - The "Install: tap Share, then Add to Home Screen" hint is **hidden**
     (it only shows when not in standalone mode).

This first launch lets the service worker precache every asset.

### A6. Offline test (airplane mode)

> Use **airplane mode**, not just DevTools throttling. Safari handles airplane
> mode and "Offline" in Web Inspector differently — only airplane mode is the
> truthful test.

1. Force-quit the app: swipe up from the bottom and flick the Exercise tile up.
2. Enable **Airplane Mode** (Control Center).
3. Disable **Wi-Fi** explicitly (airplane mode in iOS 15+ can leave Wi-Fi on).
4. Re-launch the app from the home screen.
5. Expected: the app opens, renders today's sessions, no error banners, no
   blank screen. **Network requests are zero** (you can verify via the
   inspector once back online — see A7).
6. Disable airplane mode and re-enable Wi-Fi.

### A7. Verifying zero network calls

Connect the iPhone to a Mac with a USB cable, then:

1. On Mac Safari → **Develop → [Your iPhone] → Exercise**.
2. Open the **Network** tab in the attached inspector.
3. Pull-to-refresh inside the PWA (or close and reopen).
4. Every entry should show **(from ServiceWorker)** in the Source column.
5. No requests should leave the device after the initial install.

(Requires "Web Inspector" enabled on the iPhone: **Settings → Safari →
Advanced → Web Inspector → On**.)

---

## B. Local-network test (faster iteration)

Use this when iterating on changes; it avoids waiting for GitHub Pages builds.

### B1. Serve the repo with HTTPS on your Mac

iPhone Safari requires HTTPS for service workers. The simplest path is `mkcert`
plus any static server that takes a cert:

```bash
brew install mkcert nss
mkcert -install
mkcert "$(hostname -s).local" 192.168.1.42   # use your Mac's IP

# Then serve:
npx http-server . -S -C "$(hostname -s).local+1.pem" \
  -K "$(hostname -s).local+1-key.pem" -p 4443
```

The dev server at `https://<your-mac>.local:4443/` will be reachable from the
iPhone if both are on the same Wi-Fi.

### B2. Trust the cert on the iPhone

1. AirDrop or email `rootCA.pem` from `~/Library/Application Support/mkcert/`
   to the iPhone.
2. Open it on the iPhone. iOS prompts to install a profile: **Settings →
   General → VPN & Device Management** → install.
3. Trust it: **Settings → General → About → Certificate Trust Settings** →
   enable for the mkcert root.

### B3. Install and test

Follow steps **A4–A7** above, but use the local URL
`https://<your-mac>.local:4443/` instead of the GitHub Pages URL.

> When you change code, bump `CACHE_VERSION` in `sw.js` so the iPhone picks up
> the new precache. Otherwise the home-screen app keeps serving the old
> cached assets.

---

## What to verify (Phase 1 acceptance)

Walk through these explicitly — they map to the PRD user stories.

| Story | Check |
| ----- | ----- |
| US1   | App opens from home screen in airplane mode and renders without error. |
| US2   | First launch with no user setup shows the default regime. |
| US3   | Different weekdays show different exercises and sessions (test by changing the device date — see below). |
| US4   | Running shows distance/duration/surface; resistance shows sets and either reps or `Ns hold`. |
| US5   | Sunday shows a rest-day message; weekdays show morning/afternoon sections. |

### Forcing a different weekday for testing

To check Tuesday rendering on a Sunday, the easiest path is:

1. **Settings → General → Date & Time → Set Automatically: Off**.
2. Set the date to a Tuesday.
3. Force-quit and relaunch the app.
4. Restore "Set Automatically: On" when finished.

Avoid changing time zones for this — the app uses device-local weekday from
`new Date()` and timezone shifts can produce confusing results.

---

## Common iOS gotchas

- **Service worker doesn't activate.** Almost always an HTTPS issue, or the
  page is being loaded from a different origin/subpath than `manifest.json`'s
  `scope`.
- **App opens in Safari, not standalone.** The icon was added before the
  manifest was reachable, or `display: standalone` is missing. Remove the
  home-screen icon and re-add after confirming `manifest.json` returns 200.
- **Stale assets after a deploy.** Service worker is doing its job — bump
  `CACHE_VERSION` in `sw.js` and redeploy. The next launch will activate the
  new worker after the old one releases its clients.
- **"Add to Home Screen" missing.** You're in Chrome or Firefox on iOS. They
  don't expose it; only Safari does.
- **Storage eviction.** iOS may evict IndexedDB after ~7 days of disuse for
  sites the user has not added to the home screen. After install this risk
  drops sharply, but is not zero.

---

## Reporting back

When testing, capture:

- iOS version (Settings → General → About → Software Version).
- Safari version (matches iOS).
- Whether airplane-mode launch rendered correctly.
- Any console errors (via Mac-attached Web Inspector).
- Screenshot of the home-screen icon and the first-launch view.

These let us reproduce anything that breaks before we move on to Phase 2.
