# Play Console → App content: other declarations

## Target audience and content
- **Target age groups:** tick **18 and over** and **16–17** and **13–15**. Do **not** tick any age under 13.
- **Could your store listing unintentionally appeal to children?** → **No.** (If Play asks you to explain: "Retro nostalgia games for teens and adults; Mafia has elimination themes and the app has online chat/voice with strangers' invite codes; not designed for children.")
- The app is **not** in the Designed for Families program.

## Ads
- **Does your app contain ads?** → **No, my app does not contain ads.**

## App access
- **All or some functionality is restricted?** → **All functionality is available without special access.**
- Optional note for reviewers: "No login needed. Offline modes work immediately. Online play creates an anonymous account automatically; tap 'Play online with friends', enter any name, tap Create room, add bots, Start game."

## Government apps / Financial features / Health / News
- Not a government app · No financial features · No health features · Not a news app.

## Data deletion / Account deletion
- In-app path: **Settings → Delete my online data**
- Web URL: **https://valuetools101.github.io/Gully-Adda/delete-account.html**

## Permissions declarations
- Microphone (`RECORD_AUDIO`) is used only for optional voice chat in online Mafia. No sensitive permissions (SMS, call log, location, all-files) are requested; camera and location are explicitly blocked in `app.config.ts`.
- **Foreground service**: none declared by the app. If an EAS build ends up including a foreground-service permission from the WebRTC library, declare it as "Microphone: ongoing voice call in a game room", or remove it with `blockedPermissions`.

## User-generated content (UGC) policy checklist
- Terms / house rules users must accept before online play: shown on the online screen ("By playing online you agree to the house rules") and at https://valuetools101.github.io/Gully-Adda/house-rules.html
- In-app **Report** and **Block** on every player in a room (text and voice): yes
- Host can **remove** players (banned from that room): yes
- Profanity filter on names and chat: yes (server side)
- Reports reviewed by you: Firebase console → Firestore → `reports` (status `open`). Act within 24–48 hours (see README "Moderation").
