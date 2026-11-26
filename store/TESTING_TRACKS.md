# Testing track plan

## 1. Internal testing (day 0, minutes to go live)
- Play Console → Test and release → Testing → **Internal testing** → Create new release → upload the production `.aab` from EAS.
- Testers: create an email list (up to 100) with your own Gmail and 2–3 friends. Use it to check install, online rooms on real phones, and voice (if enabled).
- Internal builds skip review, so iterate here until the manual checklist passes.

## 2. Closed testing (the "12 testers for 14 days" rule)
**Do you need it again for this new app?** Almost certainly **yes**. Google requires developers with **personal** accounts created after 13 Nov 2023 to run a closed test with **at least 12 testers opted in continuously for the 14 days** before applying for production access, and in practice this applies to **each new app**, not once per account (your Cycle Planner test does not carry over). Check: Play Console → Gully Adda → **Dashboard**; if you see the "Apply for production" task with the closed-test requirement, it applies. It does not apply to **organization** accounts.

Plan:
1. Day 0: Closed testing → create track "Closed - friends", upload the same `.aab`, add a Google Group or email list with **15–20 testers** (buffer for people who drop out; the count must stay ≥ 12 every day).
2. Send the message below. Ask each tester to install via the link and keep it installed for 14 days.
3. Days 1–14: push at least one update (e.g. 1.0.1) during the test, and ask testers to play once or twice (Play looks for real engagement and asks you about it).
4. Day 15+: Dashboard → **Apply for production** → answer the questions about your test (what you learned, what you changed).
5. After approval: Production → create release (promote the tested build), rollout 20% → 100%.

## Message to send testers (copy/paste)

> Hi! 🙏 I've made **Gully Adda**, a free app of our 90s games: Raja Mantri Chor Sipahi, Mafia, Name Place Animal Thing, Dots and Boxes and Ludo (vs bots, pass-and-play, or online with friends). No ads, no payments.
>
> Google needs 12 people to test it for 14 days before it can go public. Could you help?
>
> 1. Send me the Gmail address you use on your Android phone (if I haven't added it yet).
> 2. Open this link on your phone and tap **"Become a tester"**: <OPT-IN LINK FROM PLAY CONSOLE>
> 3. Then tap **"Download it on Google Play"** (or use this link: https://play.google.com/store/apps/details?id=com.valuetools101.gullyadda) and install.
> 4. **Please keep it installed for 14 days** and play a game or two (bots mode works offline). Let's also try one online room together!
> 5. Found a bug or have an idea? Reply here or use "Send feedback" on the Play listing.
>
> Thank you! 🎲👑
