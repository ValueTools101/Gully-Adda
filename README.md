# Gully Adda: 90s Retro Games

Classic Indian 90s/2000s adda games on your phone — **Raja Mantri Chor Sipahi, Mafia, Chhupan Chhupai (real-time Hide & Seek in a 3D mohalla), Name Place Animal Thing, Dots and Boxes, Ludo** — playable **vs bots (offline)**, **pass & play on one phone**, or **online with friends** (6-character room codes).

Expo (React Native) + TypeScript strict · Firebase (anonymous Auth, Firestore, Cloud Functions 2nd gen) · LiveKit voice (optional) · EAS builds · Android first.

---

## Repository layout

```
packages/engine/     Pure TypeScript game rules (no React, no Firebase). Used by BOTH the app and Cloud Functions.
  src/core/          GameDefinition interface, registry, seeded RNG, bot/timeout runner, card helpers (for future card games)
  src/games/<id>/    rmcs, mafia, hideseek, npat, dots, ludo
  test/              unit tests + bot-vs-bot simulations (≈17,000 games)
apps/mobile/         Expo app (expo-router). app/ = screens, src/games = boards, src/local = offline controller,
                     src/online = Firebase client, src/voice = LiveKit, src/strings/en.ts = ALL text (add hi.ts for Hindi)
functions/           Cloud Functions (bundles the engine with esbuild). test/unit + test/emulator
firestore.rules      Clients can only read: their room, their own view, chat addressed to them. No client writes.
store/               Play Store listing, policies, data safety, rating answers, graphics, screenshots, scripts
docs/                GitHub Pages site (privacy, delete-account, house-rules) — generated from store/*.md
CREDITS.md           Every asset and its licence
```

### How a game is built (architecture)
Each game exports a `GameDefinition` (`packages/engine/src/core/types.ts`):
`createGame(config, players, rng, ctx)`, `getPublicState`, `getPlayerView(state, playerId)` (strips every secret), `listLegalActions`, `applyAction` (pure, returns new state or a rejection reason), `pendingActors`, `onTimeout`, `isGameOver`, `scores`, `getBotAction(state, botId, difficulty, rng)`, `isAction` (validates untrusted input), and optional `chatPolicy` (Mafia: who may read/write/speak per phase).

**Adding a game** = one folder in `packages/engine/src/games/`, one line in `core/registry.ts`, one board component in `apps/mobile/src/games/` + entry in `src/games/index.tsx`, strings in `en.ts`. Card games (Teen Patti, Rummy, Bluff, Seep) can use `core/cards.ts`; hidden hands work like Mafia roles.

### Online anti-cheat
- Cloud Functions are the **only writer**. Full state lives in `rooms/{code}/private/state` (rules deny all clients).
- Every player gets `rooms/{code}/views/{uid}` = `getPlayerView(state, uid)`, readable only by that uid while a member.
- `submitAction` checks membership, seat, action shape, phase/turn/legality (engine), timers (expired timers are applied first), **sequence numbers** (no duplicates/replays) and a **rate limit**.
- Dice, shuffles and roles use a seed from `crypto.randomBytes` on the server.
- Dropped players (no heartbeat for 45 s) are played by a bot until they come back; a 1-minute scheduled sweeper plus client "pokes" at deadlines guarantee nothing stalls.
- Mafia: dead players get a limited view, graveyard-only chat, listen-only voice; night = everyone muted; living mafia get a private mafia channel.

---

## 1. Local run

Requirements: Node 22, **npm 11** (`npm i -g npm@11` — npm 10 has a resolver bug with this tree), Java 21 (emulators only).

```bash
npm install
npm run check            # typecheck + lint + unit tests (engine + functions)
npm run test:sim         # bot-vs-bot simulations, thousands of games per game (~1 min)

cd apps/mobile
cp .env.example .env     # fill Firebase web config later; offline modes work without it
npx expo start           # press "a" for an Android emulator/phone, "w" for web
```

Offline modes (bots, pass & play) work in **Expo Go**. Voice needs a **development build** (see §5).

## 2. Emulator testing (Firestore rules + Cloud Functions)

```bash
npm run test:emulator    # builds functions, starts auth+firestore+functions emulators, runs rules + end-to-end tests
npm run emulators        # keep emulators running for manual testing
```
To point the app at the emulators set in `apps/mobile/.env`:
`EXPO_PUBLIC_USE_EMULATORS=true` and `EXPO_PUBLIC_EMULATOR_HOST=10.0.2.2` (Android emulator) or your computer's LAN IP (real phone).

## 3. Firebase setup and deploy (new project)

1. https://console.firebase.google.com → **Add project** → name `gully-adda` (note the project ID). Analytics: off.
2. Upgrade to **Blaze** (Cloud Functions need it; set a budget alert of e.g. ₹500).
3. **Build → Authentication → Get started → Sign-in method → Anonymous → Enable.**
4. **Build → Firestore → Create database** → production mode → location **asia-south1 (Mumbai)**.
5. **Project settings → Your apps → Add app → Web** (nickname "Gully Adda app") → copy the config into `apps/mobile/.env` (`EXPO_PUBLIC_FIREBASE_*`). (We use the JS SDK, so no `google-services.json` is needed.)
6. Deploy:
   ```bash
   npm i -g firebase-tools        # or use npx firebase
   firebase login
   firebase use --add             # pick the project, alias "default" (updates .firebaserc)
   firebase functions:secrets:set LIVEKIT_API_KEY      # type "unset" if not using voice yet
   firebase functions:secrets:set LIVEKIT_API_SECRET   # type "unset" if not using voice yet
   cp functions/.env.example functions/.env.<your-project-id>   # VOICE_ENABLED=false for now
   firebase deploy --only firestore:rules,firestore:indexes,functions
   ```
7. Firestore → **TTL** → check the policy on collection `rooms`, field `expireAt` is "Serving" (auto-deletes old rooms; the sweeper does it too).
8. Optional hardening: App Check with Play Integrity, then set `ENFORCE_APP_CHECK=true` in `functions/.env.<project>` and redeploy.

## 4. LiveKit voice (optional, Mafia online only)

1. https://cloud.livekit.io → create a project (free tier) → **Settings → Keys** → create an API key.
2. `firebase functions:secrets:set LIVEKIT_API_KEY` and `LIVEKIT_API_SECRET` with the real values.
3. In `functions/.env.<project>`: `VOICE_ENABLED=true`, `LIVEKIT_URL=wss://<your-project>.livekit.cloud` → `firebase deploy --only functions`.
4. In the app env (`.env` locally and EAS environment variables): `EXPO_PUBLIC_VOICE_ENABLED=true`, `EXPO_PUBLIC_LIVEKIT_URL=wss://…`.
5. Voice uses native WebRTC, so it does **not** work in Expo Go: build a dev client (`eas build -p android --profile development`).
If voice is off or fails, Mafia uses text chat with the same phase rules.

## 5. EAS build

```bash
npm i -g eas-cli && eas login                 # your existing Expo account
cd apps/mobile
eas init                                      # creates the EAS project; put the ID in EAS_PROJECT_ID
# put the EXPO_PUBLIC_* values in EAS: expo.dev → project → Environment variables (production/preview/development)
eas build -p android --profile development    # dev client (voice testing)
eas build -p android --profile preview        # installable APK for friends
eas build -p android --profile production     # signed .aab for Play (versionCode auto-increments)
```
**Before the first production build confirm the package ID `com.valuetools101.gullyadda`** (`app.config.ts`) — it can never change after upload. Target SDK is 36 (required for new apps since 31 Aug 2026).

## 6. Store assets

```bash
npm run store:graphics      # icon, adaptive icon, splash, 512 icon, 1024x500 feature graphic
npm run store:screenshots   # 1080x1920 screenshots from the real app (web build + Playwright; run `npx playwright install chromium` once)
npm run store:pages         # rebuild docs/*.html from store/*.md
npm run store:check-urls    # verifies the privacy / delete / house-rules pages are public
```

## 7. GitHub Pages (privacy policy, deletion page)

1. Merge this branch into `main`.
2. GitHub → repo **Settings → Pages** → Source: **Deploy from a branch** → Branch `main`, folder **/docs** → Save.
3. After ~1 minute these are public (the repo is public, so no login is needed):
   - Privacy policy: **https://valuetools101.github.io/Gully-Adda/privacy.html**
   - Delete data: **https://valuetools101.github.io/Gully-Adda/delete-account.html**
   - House rules / terms: **https://valuetools101.github.io/Gully-Adda/house-rules.html**
4. Check: `npm run store:check-urls` (all `OK 200`), or open them in a private browser window.

## 8. Moderation (you)
Reports land in Firestore → `reports` (reason, target, recent chat). Review within 24–48 h. To ban someone from online play, delete their user in **Authentication** (they get a fresh anonymous ID but lose their seat) and, if needed, add a server-side block list. Reports auto-delete after 12 months.

---

## 9. What I click in Play Console (in order)

Assets and texts are in `/store`. Do steps 1–6 once.

1. **Create app**: play.google.com/console → **Create app** → App name `Gully Adda: 90s Retro Games` · Default language **English (United Kingdom)** or (India) · **App** · **Free** · tick both declarations → Create.
2. **Dashboard → Set up your app** (each item opens a form):
   1. **Privacy policy** → `https://valuetools101.github.io/Gully-Adda/privacy.html` → Save.
   2. **App access** → "All functionality is available without special access" → Save. (Optional note text in `store/TARGET_AUDIENCE_AND_APP_ACCESS.md`.)
   3. **Ads** → "No, my app does not contain ads".
   4. **Content rating** → Start questionnaire → email `valuetools101@gmail.com`, category **Game** → answers from `store/CONTENT_RATING.md` → Submit.
   5. **Target audience and content** → ages **13–15, 16–17, 18+** (none under 13) → "unintentionally appeal to children?" **No** → Save.
   6. **News app** → No. **COVID-19 apps** → not applicable. **Government apps** → No. **Financial features** → none. **Health** → none.
   7. **Data safety** → answers field by field from `store/DATA_SAFETY.md` → Submit.
   8. **Data deletion / account deletion** (inside Data safety or its own item) → URL `https://valuetools101.github.io/Gully-Adda/delete-account.html`.
   9. **App category** → Games → **Board**; contact email `valuetools101@gmail.com`; website `https://valuetools101.github.io/Gully-Adda/`.
3. **Grow users → Store presence → Main store listing**: App name, Short description and Full description from `store/LISTING.md` (copy only the text between the markers) · App icon `store/graphics/icon-512.png` · Feature graphic `store/graphics/feature-graphic-1024x500.png` · Phone screenshots: all of `store/screenshots/*.png` → Save.
4. **Test and release → Testing → Internal testing** → Testers tab → create email list (your Gmail + friends) → **Create new release** → accept **Play App Signing** → upload the production `.aab` from EAS → Release name `1.0.0 (1)` → Release notes: `First internal test of Gully Adda.` → Next → **Save and publish**. Copy the opt-in link; install on your phones; run `store/MANUAL_TEST_CHECKLIST.md`.
5. **Test and release → Testing → Closed testing** → **Create track** (e.g. `friends`) → Testers: Google Group or email list with 15–20 people → Countries: India (+ any) → **Create new release** → upload the same/newer `.aab` → Release notes: `Closed test: 5 retro games vs bots, pass & play and online.` → **Send for review**. Send testers the message in `store/TESTING_TRACKS.md`. Keep ≥12 opted in for **14 consecutive days**; ship one small update during the test.
6. **Dashboard → Apply for production** (appears after 14 days) → answer: how you recruited testers, what feedback you got, what you changed (keep notes during the test).
7. **Test and release → Production → Create new release** → promote the tested build → release notes `Gully Adda is here! Raja Mantri Chor Sipahi, Mafia, Chhupan Chhupai, Name Place Animal Thing, Dots and Boxes and Ludo – with bots, pass & play, or online with friends.` → Staged rollout 20% → **Send for review** → later raise to 100%.
8. If you later add Google Sign-In / App Check: **Test and release → Setup → App signing** → copy the **app signing key SHA-1/SHA-256** into Firebase → Project settings → Android app → fingerprints.

---

## 10. Everything you must do manually

- [ ] **Confirm package ID** `com.valuetools101.gullyadda` (or tell me a different one) before the first EAS build.
- [ ] Create the **new Firebase project**, enable **Blaze**, **Anonymous Auth**, **Firestore (asia-south1)**, add a **Web app** and paste its config into `apps/mobile/.env` and EAS environment variables (§3).
- [ ] `firebase use --add`, set the two LiveKit secrets (real or `unset`), `firebase deploy` (§3).
- [ ] Optional voice: create a **LiveKit Cloud** project, set secrets + `VOICE_ENABLED=true` + `LIVEKIT_URL`, and `EXPO_PUBLIC_VOICE_ENABLED=true` in the app (§4).
- [ ] `eas init` with your existing Expo account; run development/preview/production builds (§5).
- [ ] Merge to `main`, enable **GitHub Pages** from `main:/docs`, run `npm run store:check-urls` (§7).
- [ ] Create the **new Play Console app** and follow §9 (internal → closed 12×14 days → production).
- [ ] Test real multiplayer on devices with `store/MANUAL_TEST_CHECKLIST.md`.
- [ ] Review moderation reports regularly (§8).
- [ ] Optional: replace generated sounds/art with CC0 packs (see `CREDITS.md`), add Hindi strings (`apps/mobile/src/strings/hi.ts`).

### Chhupan Chhupai (hide & seek) design note
Real-time, joystick-controlled hide & seek in an isometric 3D mohalla (`apps/mobile/src/games/hideseek/RealtimeRound.tsx`). The simulation lives in the shared engine (`packages/engine/src/games/hideseek/sim.ts`): fixed 20 Hz ticks, seeded AI for the seeker and the other kids, and only `+ - * /` and `sqrt` on positions so a round replays identically on any JS engine. The phone records one input per tick; online, the server **replays the input string to compute the score**, so scores can't be faked. Each round every player plays their own run in the same map and role (odd rounds hide, even rounds seek) and scores are compared. Known limit: a determined cheater could script inputs offline, since the level seed is shared with the client.

## Later (architecture ready, not built)
Bluff, Seep, Teen Patti, Rummy (card helpers in `core/cards.ts`), Hangman, Tic-tac-toe, Book cricket, Chess, Antakshari, Dumb Charades, a Business-style trading game (generic design, no trademarked names).
