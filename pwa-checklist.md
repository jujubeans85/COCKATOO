# PWA checklist — Wareamah Walk

## Works now

- Web app manifest with installable PNG icons, maskable icons, screenshots, shortcuts, theme colour and standalone display.
- Service worker pre-caches the app shell, local maps, icon set, diagrams code and offline fallback.
- Offline media placeholder for historical images that are not available.
- `Save offline` button sends all tour media URLs to the service worker for opportunistic caching.
- Update button appears when a new service worker is waiting.
- iOS-friendly meta tags and Apple touch icon.
- Netlify-compatible `_headers` file for correct service-worker caching.

## Deployment rules

Serve from HTTPS or localhost. Raw `file://` cannot install a PWA or register the service worker.

Best simple deploy: drag this folder into Netlify, or push it to GitHub and connect Netlify.

## Pre-trip ritual

1. Open the deployed URL while online.
2. Tap **Save offline**.
3. Open a few stops so remote images have a chance to cache.
4. Add to Home Screen / Install app.
5. Put phone in low-power mode only after testing voice, because mobile browsers are petty little goblins about background speech.

## Known limits

- Browser speech synthesis can stop when the screen locks, especially on iOS.
- External historical images can only be cached if their source server and the browser allow it.
- GPS/geofencing is not included; this version is deliberately simple and low-admin.
