# Manual test checklist (real devices)

Use at least 2 Android phones (one small screen, e.g. 5"), for online use 3+ phones/accounts. Tick each box for **Bots (B)**, **Pass & play (P)**, **Online (O)**.

## General (once)
- [ ] Fresh install opens without internet; home shows 5 games
- [ ] Sound toggle in header mutes everything; Settings vibration toggle works
- [ ] Rotate / small phone: no cut-off buttons; all tap targets easy to hit
- [ ] Back during a game asks "Leave game?"
- [ ] Settings → Privacy policy opens; House rules opens; Credits opens
- [ ] Settings → Delete my online data (after playing online): succeeds; joining an old room afterwards fails

## Raja Mantri Chor Sipahi (exactly 4)
- [ ] B: chit shows (unfolds); Raja publicly shown; as Raja you can predict Mantri will catch/miss (+100 if right), shown to everyone; when you are Mantri you get 2 choices; points 1000/800/500/0 (right) or 1000/0/500/800 (wrong); totals add up over rounds; leaderboard after last round
- [ ] P (4 people): "Pass the phone to X" before each private chit; nobody's chit visible on the shared screen; "Hide & pass" disabled until "Got it"; Mantri guesses on shared screen
- [ ] O: each phone shows only its own chit; Raja name public; only Mantri's phone gets guess buttons; host sets rounds

## Mafia (5–12, try 6 and 10)
- [ ] B: role card at start; night action list matches role; doctor cannot save same person twice in a row; detective result appears later; day → vote → elimination; win screen reveals all roles
- [ ] P: every living person takes the phone at night (villagers see "asleep" + Done), so holding time doesn't leak roles; day screen shows no roles; secret votes are private turns
- [ ] Out players: "Ghost guess" card each day (once per day), +25 per correct guess at the end, never blocks the game
- [ ] O: villager phone never shows other roles; two mafia see each other and each other's picks; dead player sees "You are out", graveyard chat only, cannot write in village chat; timers auto-advance; text chat closed at night (except mafia channel for mafia)
- [ ] O voice (dev/prod build, flag on): mic works in day for living; everyone forced muted at night; dead can listen not talk; blocking someone silences them; turning voice off still lets the game continue with text chat

## Chhupan Chhupai / Hide & Seek (1–8, real-time)
- [ ] B: briefing card shows bullet instructions; "Start round" opens the 3D mohalla with joystick (and arrow keys/WASD on web)
- [ ] Hider round: 5 s head start, camera follows you, seeker's yellow torch beam visible, hiding behind houses/trees breaks line of sight; getting touched ends your round; touching a caught kid frees them; marbles collect
- [ ] Seeker round: screen dark for 5 s (eyes closed), then you only see hiders inside your torch beam or right next to you; touching catches them; hiders free each other if you wander off
- [ ] Results: each player's stats and score, bots each play differently, roles alternate hider/seeker, totals add up
- [ ] P: each person plays their own round on a private turn (pass the phone between rounds); results on the shared screen
- [ ] O: every phone plays its own round at the same time; a player who doesn't finish within round + grace time is auto-played; a tampered score is impossible (server replays inputs)
- [ ] Performance: smooth on a low-end phone; leaving the app mid-round pauses it; no crash when backgrounded

## Name Place Animal Thing (2–10)
- [ ] B: letter shown; timer counts down; STOP only after all boxes filled; bots fill answers; challenge screen shows everyone's answers; wrong-letter answers marked
- [ ] P: each player writes privately with own timer, auto-submits at 0; challenge "Reject" toggles apply group vote; scores: unique 10, same 5, empty/wrong 0
- [ ] Live progress chip (✍️ 2/4) for every player while writing, never the words
- [ ] O: other phones never see your answers before the round closes; STOP gives others ~5 s; host can add/remove categories; challenges need majority of other players

## Dots and Boxes (2–4, 4x4 and 5x5)
- [ ] B: tapping between dots draws a line; completing a box colours it and gives another turn; bot on hard avoids giving boxes
- [ ] P: 3 people take turns on one screen
- [ ] O: only current player can draw; tapping out of turn shows an error, nothing changes; turn timer (if set) plays a move automatically

## Ludo (2–4)
- [ ] B: need a 6 to leave; 6 = roll again; three 6s ends turn; capture sends token home (+ extra roll); no capture on stars/start squares; exact roll to finish; winner screen
- [ ] P: 2 and 4 humans; tokens glow only for the current player
- [ ] O: dice result is the same on all phones (rolled on server); turn timer auto-plays

## Everyone
- [ ] "?" in the game header opens bullet-point rules for that game
- [ ] Emoji reaction bar: local floats on screen; online, everyone in the room sees them with your name; blocked players' reactions are hidden; Mafia night: only mafia can react (on their channel)

## Online robustness (O)
- [ ] Create room → 6-character code; friends join with code (lowercase also works); wrong code shows error
- [ ] Host changes game/settings; non-host cannot
- [ ] "Fill empty seats with bots" and bot difficulty work
- [ ] Turn on airplane mode on one phone for 60 s mid-game: a bot plays for them ("dropped out" log); turn airplane mode off: they get their seat back
- [ ] Kill the app and reopen the room from Play online → Join with the same code: rejoins same seat
- [ ] Host leaves lobby: another human becomes host
- [ ] Report a player (pick reason) → "Thanks" + they are blocked; report appears in Firestore `reports`
- [ ] Block hides their chat; unblock restores
- [ ] Host "✕" removes a player; they can't rejoin that room
- [ ] Spam chat fast: rate limited after ~8 messages in 10 s; bad words masked
