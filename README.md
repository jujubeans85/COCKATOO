# Wareamah Walk — Dani & Juice Cockatoo Island Tour

A static, installable PWA-style voice-guided Cockatoo Island / Wareamah walking tour.

## What it includes

- 12-stop 2–3 hour self-guided route.
- Low-energy mode that hides optional detours.
- Browser voice narration using the Web Speech API.
- Interactive map markers using Dani/Juice’s uploaded map photos.
- Historical photo/plan/media cards linked to source collections.
- Simplified diagrams for dry docks, silos, island layers, workforce, timeline and route logic.
- Progress tracking via localStorage.
- PWA manifest, service worker, offline fallback, install help, update prompt, icons and maskable icons.
- `Save offline` button for pre-caching media before the ferry.

## Run locally

```bash
cd cockatoo_wareamah_tour_pwa
python3 -m http.server 8000
```

Open:

```text
http://localhost:8000
```

Do not use raw `file://` for PWA testing. Service workers and install prompts need HTTPS or localhost.

## Install on phone

### iPhone / iPad

Open in Safari, tap **Share**, then **Add to Home Screen**.

### Android / Chrome

Tap the app’s **Install app** button if Chrome offers it, or open the browser menu and choose **Add to Home screen**.

## Before visiting Cockatoo Island

Open the app while online and tap **Save offline**. The app shell, local maps, diagrams and any cacheable historical media will be stored locally. External historical images are best-effort because third-party servers can be annoying. The route text and maps are the mission-critical bit.

## Deploy

This is static. No backend, no accounts, no analytics.

Good options:

- Netlify drag-and-drop folder deploy.
- GitHub Pages.
- Cloudflare Pages.

For Netlify, the included `_headers` file keeps `sw.js` fresh while letting icons/maps cache hard. That is the non-SPLIT-BRAIN way.

## Limits

- Voice playback uses browser speech synthesis. Screen-lock/background playback depends on OS/browser.
- Remote historical media should be rights-cleared before public/commercial use.
- No GPS/geofence layer yet. Deliberately simple. ROCK SOLID beats DRUNK OCTOPUS ROOTING A FILING CABINET.

## Sources

See the in-app Sources panel for the full source deck.
