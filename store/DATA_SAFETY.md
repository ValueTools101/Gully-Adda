# Play Console → App content → Data safety (field by field)

Answers match the code as shipped (Firebase Anonymous Auth + Firestore + Cloud Functions; optional LiveKit voice; no ads, no analytics SDK, no crash SDK). Re-check if you add Crashlytics/Analytics later.

## Step 1: Data collection and security
| Question | Answer |
|---|---|
| Does your app collect or share any of the required user data types? | **Yes** |
| Is all of the user data collected by your app encrypted in transit? | **Yes** (HTTPS/TLS to Firebase and LiveKit) |
| Which of the following methods of account creation does your app support? | Choose **"Other"** and describe: *"An anonymous account is created automatically for online play (no email, phone or password). Offline modes need no account."* (Being upfront here is safer than "does not allow accounts", and you already offer deletion.) |
| Do you provide a way for users to request that their data is deleted? | **Yes**. In-app: Settings → Delete my online data. Web URL: `https://valuetools101.github.io/Gully-Adda/delete-account.html` |

> Play also asks for a **Delete account URL** (App content → Data deletion / Account deletion). Use the same URL above.

## Step 2: Data types
Tick ONLY these:

### Personal info → **Name** (the display name)
- Collected: **Yes** · Shared: **No**
- Processed ephemerally: **No**
- Required or optional: **Optional** (only for online play)
- Purposes: **App functionality**

### Personal info → **User IDs** (anonymous Firebase UID)
- Collected: **Yes** · Shared: **No**
- Ephemeral: **No** · Optional (online only)
- Purposes: **App functionality**, **Fraud prevention, security, and compliance** (anti-cheat, rate limiting, reports)

### Messages → **Other in-app messages** (room text chat)
- Collected: **Yes** · Shared: **No** (shown to other players in the same room is part of the feature, not "sharing" with a third party)
- Ephemeral: **No** (deleted with the room after ~24 h)
- Optional · Purposes: **App functionality**

### Audio → **Voice or sound recordings**
- Collected: **Yes** (streamed live in online Mafia voice; not recorded or stored)
- Shared: **No** (LiveKit is a service provider processing on our behalf)
- Processed ephemerally: **Yes**
- Optional · Purposes: **App functionality**

### App activity → **Other user-generated content** (game moves, Name Place Animal Thing answers, reports)
- Collected: **Yes** · Shared: **No**
- Ephemeral: **No** · Optional (online only)
- Purposes: **App functionality**, **Fraud prevention, security, and compliance**

### Do NOT tick
Location, Financial info, Health, Photos/Videos, Files, Calendar, Contacts, Web browsing, Device or other IDs (no advertising ID is used), App info and performance (no crash/analytics SDK), Email, Phone.

## Notes
- "Shared" = transferred to a third party. Service providers (Google Firebase, LiveKit) processing on your behalf do **not** count as sharing under Play's definition.
- If Play asks "Is data collected only when the user is online/opts in?": offline modes collect nothing.
