# Capitalflow — Supplier Asset Verification (Working Demo)

A functional prototype of the supplier verification flow. Unlike the earlier click-through wireframes, this one uses your device's **real camera** and **real GPS** in the browser — nothing is faked. There's no database: submissions live only in memory for the current session, so refreshing or redeploying clears them (per what was agreed for this round).

## What's real vs mocked

**Real (uses actual browser APIs):**
- Camera capture (`getUserMedia`) — takes an actual photo from your device camera
- GPS geotagging (`navigator.geolocation`) — real coordinates from your device
- Serial number validation — blocks progress if it doesn't match the agreement on file
- Condition checklist, notes, verify/flag actions on the dashboard

**Mocked (no backend/database yet):**
- Login — any input works, doesn't check a real account
- The two assets and their "agreement on file" serial numbers are hardcoded in `public/app.js` (`ASSIGNMENTS`)
- Submissions reset when the server restarts or the page is redeployed

## Deploying to Railway (via GitHub)

1. Create a new GitHub repo and push this folder's contents to it:
   ```bash
   git init
   git add .
   git commit -m "Capitalflow supplier verification demo"
   git branch -M main
   git remote add origin <your-new-repo-url>
   git push -u origin main
   ```
2. In Railway, click **New Project → Deploy from GitHub repo**, and select this repo.
3. Railway will detect `package.json`, run `npm install`, then `npm start` automatically. No extra configuration needed — there's no database or environment variables to set up for this version.
4. Once deployed, Railway gives you a live `*.up.railway.app` URL — open it on a phone to test the camera and GPS steps (most browsers require HTTPS for camera/location access, which Railway provides by default).

## Running locally first (optional)

```bash
npm install
npm start
```
Then open `http://localhost:3000`. Camera/GPS prompts will appear the first time you open the capture screen — allow both to test the full flow.

## Next steps if you want to take this further

- Add a real database (Railway offers one-click Postgres) so submissions persist and the dashboard reflects real activity across sessions
- Replace the hardcoded `ASSIGNMENTS` list with a lookup against Capitalflow's actual supplier/agreement records
- Add real authentication for the supplier login and the internal dashboard
