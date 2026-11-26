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
- [ ] B: chit shows; Raja publicly shown; when you are Mantri you get 2 choices; points 1000/800/500/0 (right) or 1000/0/500/800 (wrong); totals add up over rounds; leaderboard after last round
- [ ] P (4 people): "Pass the phone to X" before each private chit; nobody's chit visible on the shared screen; "Hide & pass" disabled until "Got it"; Mantri guesses on shared screen
- [ ] O: each phone shows only its own chit; Raja name public; only Mantri's phone gets guess buttons; host sets rounds

## Mafia (5–12, try 6 and 10)
- [ ] B: role card at start; night action list matches role; doctor cannot save same person twice in a row; detective result appears later; day → vote → elimination; win screen reveals all roles
- [ ] P: every living person takes the phone at night (villagers see "asleep" + Done), so holding time doesn't leak roles; day screen shows no roles; secret votes are private turns
- [ ] O: villager phone never shows other roles; two mafia see each other and each other's picks; dead player sees "You are out", graveyard chat only, cannot write in village chat; timers auto-advance; text chat closed at night (except mafia channel for mafia)
- [ ] O voice (dev/prod build, flag on): mic works in day for living; everyone forced muted at night; dead can listen not talk; blocking someone silences them; turning voice off still lets the game continue with text chat

## Chhupan Chhupai / Hide & Seek (3–8)
- [ ] B: seeker is announced; as a hider, glowing spots on the 3D map and the chip list both work; as seeker, you never see where bots are until they are found or the match ends
- [ ] B: Stay / sneak (only nearby spots offered) / Dhappa (only from spots next to the den); a sneak shows a pink "rustle" on that side of the map next round; guarding the den catches a dhappa runner
- [ ] B: scores: seeker 100 per catch, dhappa 150, hidden till the end 100, found = 10 per round survived; seeker rotates each match
- [ ] P: each hider picks a spot on a private turn; every round each active player (seeker too) makes a secret choice on a private turn; the shared screen never shows hiding spots
- [ ] O: no phone shows another player's spot before they are found; the seeker's choice is hidden from hiders until the round resolves; round timer auto-resolves (missing hiders stay, missing seeker searches randomly)
- [ ] Small phone: the town map fits the width, buildings are tappable or use the spot chips

## Name Place Animal Thing (2–10)
- [ ] B: letter shown; timer counts down; STOP only after all boxes filled; bots fill answers; challenge screen shows everyone's answers; wrong-letter answers marked
- [ ] P: each player writes privately with own timer, auto-submits at 0; challenge "Reject" toggles apply group vote; scores: unique 10, same 5, empty/wrong 0
- [ ] O: other phones never see your answers before the round closes; STOP gives others ~5 s; host can add/remove categories; challenges need majority of other players

## Dots and Boxes (2–4, 4x4 and 5x5)
- [ ] B: tapping between dots draws a line; completing a box colours it and gives another turn; bot on hard avoids giving boxes
- [ ] P: 3 people take turns on one screen
- [ ] O: only current player can draw; tapping out of turn shows an error, nothing changes; turn timer (if set) plays a move automatically

## Ludo (2–4)
- [ ] B: need a 6 to leave; 6 = roll again; three 6s ends turn; capture sends token home (+ extra roll); no capture on stars/start squares; exact roll to finish; winner screen
- [ ] P: 2 and 4 humans; tokens glow only for the current player
- [ ] O: dice result is the same on all phones (rolled on server); turn timer auto-plays

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
