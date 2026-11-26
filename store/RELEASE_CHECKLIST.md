# Release checklist (Android / Google Play)

## Identity (permanent!)
- [ ] **Package ID confirmed:** `com.valuetools101.gullyadda` (set in `apps/mobile/app.config.ts`; can never change after the first upload)
- [ ] App name "Gully Adda", Play title "Gully Adda: 90s Retro Games"

## Versioning
- [ ] `version` in `app.config.ts` (user-facing, e.g. 1.0.0)
- [ ] `versionCode`: EAS manages it remotely (`"appVersionSource": "remote"` + `"autoIncrement": true` in `eas.json`). First build will be 1. To set it manually: `eas build:version:set -p android`.

## Target SDK
- [ ] Google Play requires new apps and updates to target **Android 16 (API 36)** since 31 Aug 2026. We set `compileSdkVersion 36`, `targetSdkVersion 36`, `minSdkVersion 24` via `expo-build-properties`. Re-check https://developer.android.com/google/play/requirements/target-sdk before each release (next bump: API 37, expected Aug 2027).

## Build
- [ ] `apps/mobile/.env` (or EAS environment variables for "production") filled from Firebase web app config
- [ ] `EXPO_PUBLIC_VOICE_ENABLED` decided (true only once LiveKit keys are set on Functions)
- [ ] `cd apps/mobile && eas build -p android --profile production` → produces a **signed .aab** (EAS creates and stores the upload keystore the first time; let it)
- [ ] Smoke test a `preview` APK on a real phone first: `eas build -p android --profile preview`

## Play App Signing
- [ ] Play App Signing is mandatory for new apps and is on by default. EAS's keystore is your **upload key**; Google holds the **app signing key**.
- [ ] Download nothing; just accept. Keep EAS credentials (`eas credentials`) safe.
- [ ] **If you ever add Google Sign-In / Firebase phone auth / App Check with Play Integrity:** copy the **App signing key certificate SHA-1 and SHA-256** from Play Console → Test and release → Setup → **App signing**, and add them in Firebase console → Project settings → Your apps → Android app → Add fingerprint (this is the step that bit Cycle Planner: the upload-key SHA-1 alone is not enough for the Play-installed app). Also add the upload key SHA-1 (from `eas credentials`) for internal builds.

## Backend
- [ ] Firebase project on **Blaze** plan (Cloud Functions need it), region `asia-south1`
- [ ] `firebase deploy --only firestore:rules,firestore:indexes,functions`
- [ ] Firestore TTL policy on `rooms.expireAt` shows "Serving" (Firestore → TTL)
- [ ] Anonymous sign-in enabled (Authentication → Sign-in method → Anonymous)
- [ ] Optional: App Check with Play Integrity, then set `ENFORCE_APP_CHECK=true` in `functions/.env.<project>`

## Store
- [ ] Privacy policy URL is public (run `node store/scripts/check-urls.mjs`)
- [ ] Delete-account URL is public
- [ ] Data safety, content rating, target audience, ads, app access forms done (see `/store/*.md`)
- [ ] Internal test → closed test (12 testers × 14 days if required) → production

## Before every update
- [ ] `npm run check` (typecheck, lint, tests) and `npm run test:emulator`
- [ ] Manual checklist (`store/MANUAL_TEST_CHECKLIST.md`) on 2+ real phones for online
