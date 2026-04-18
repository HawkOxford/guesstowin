Guess to Win — Claude Context File
Use this file to onboard Claude at the start of a new conversation. Paste the contents and say "here's the project context, let's continue building."
---
Project Overview
Guess to Win 2025/26 — A Premier League score prediction game for a private group of 10 players. Built as a single HTML file hosted on GitHub Pages with Supabase as the backend.
Live site: https://hawkoxford.github.io/guesstowin
Repo: HawkOxford/guesstowin (GitHub)
Backend: Supabase — iufbdwsmbwrtcqzkvyey.supabase.co (London region)
Fixtures API: football-data.org (free tier, 10 req/min), proxied via Supabase Edge Function
Edge Function: https://iufbdwsmbwrtcqzkvyey.supabase.co/functions/v1/football-proxy
Jake's workflow: edits files via GitHub pencil editor, deploys to GitHub Pages
---
Players
Jake, Glurk, Josh ⭐, Richard ⭐, Teflon, Alex, Gaz ⭐, Liam, Craig, Marcus
⭐ = former champion (Josh, Richard, Gaz)
Base scores after GW26:
Player	Points	Weekly prize won
Jake	153	£16.67
Glurk	154	£33.33
Josh ⭐	143	£20.00
Richard ⭐	159	£38.33
Teflon	147	£48.33
Alex	149	£16.67
Gaz ⭐	142	£30.00
Liam	138	£3.33
Craig	136	£15.00
Marcus	159	£38.33
---
Tech Stack
Frontend: Single HTML file, GitHub Pages
Backend/Auth: Supabase (anon key in HTML, RLS policies on predictions table)
Fixtures: football-data.org API via Supabase Edge Function (service role key)
Fonts: Google Fonts (Bebas Neue + DM Sans)
Charts: Chart.js (position tracker)
---
Supabase Schema
```
profiles       — id (uuid), player_name (text)
predictions    — user_id, gameweek (int), match_key (text), home_score (int), away_score (int), updated_at
results        — gameweek (int), match_key (text), home_score (int), away_score (int), status (text)
```
Match key format: `Home_Away` e.g. `Arsenal_Bournemouth`
Old format `0_Home_Away` stripped via `.replace(/^\d+_/, '')`
Results written via Edge Function using service role key (env var: `SERVICE_ROLE_KEY`)
RLS blocks direct writes to results — must go via Edge Function
---
GW Numbering — Critical Logic
The rule: current GW = highest completed GW + 1, where a GW is only "complete" when the number of finished results equals the number of fixtures for that GW (derived from predictions table).
Never use:
`matchday` field from football-data.org API (unreliable)
Count of distinct GWs in results (causes phantom GW loop — see bugs below)
Hardcoded GW numbers
`estimateGWNumber` queries results table (filtered to GW 27-38, status=finished), counts per GW, cross-references fixture count from predictions table, returns max complete GW + 1.
`syncResultsToSupabase` looks up the correct GW for each finished match from the predictions table (source of truth). Never trusts the in-memory `currentGW` value. Only writes if GW is 27-38.
---
Known Bugs Fixed
Phantom GW loop (critical — fixed GW28 weekend)
Cause: `syncResultsToSupabase` was writing results using whatever `currentGW` was in memory. If `currentGW` was wrong (e.g. 34), it wrote a result under GW34. Next load, `estimateGWNumber` saw GW34 existed and returned GW35. Self-reinforcing loop reaching GW42.
Fix: `syncResultsToSupabase` now looks up GW from predictions table per match. `estimateGWNumber` uses max completed GW (complete = all fixtures have results) + 1, capped 27-38.
Database cleanup needed if it recurs:
```sql
DELETE FROM results WHERE gameweek < 27 OR gameweek > 38;
```
Saturday fixtures not saving (fixed GW28 weekend)
Cause: `now.getDay()` uses UTC day number but `todayDay` uses Europe/London timezone. On Friday evening, UTC could already be Saturday, making the Saturday date calculation jump a week ahead. Saturday fixtures would fetch under wrong dates, Sunday fixtures showed correctly.
Fix: Derive day number from UK timezone string consistently using an array lookup.
Predictions saving to wrong GW (fixed GW28 weekend)
Cause: Phantom GW loop — players submitted when app showed GW36, predictions saved under GW36 not GW28.
Fix: GW numbering logic fixed. Run SQL to move stranded predictions:
```sql
-- Check for stranded predictions
SELECT gameweek, COUNT(*) FROM predictions GROUP BY gameweek ORDER BY gameweek;
-- Move to correct GW (update scores where GW36 is newer)
UPDATE predictions AS p28
SET home_score = p36.home_score, away_score = p36.away_score, updated_at = p36.updated_at
FROM predictions AS p36
WHERE p28.user_id = p36.user_id AND p28.match_key = p36.match_key
  AND p28.gameweek = 28 AND p36.gameweek = 36;
DELETE FROM predictions WHERE gameweek = 36;
```
Sign-in button broken
Cause: Nested template literals (backticks inside `${}` inside backticks) in `renderSummary` or `renderAdmin` break the JS parser.
Rule: Never use nested template literals. Use string concatenation for complex HTML generation.
GW27 wrong result in results table
Brentford_Fulham (GW28 fixture) was written under GW27. Fix:
```sql
DELETE FROM results WHERE gameweek = 27 AND match_key = 'Brentford_Fulham';
```
---
Critical Code Rules
Never use nested template literals — backticks inside `${}` inside backticks breaks the JS parser. Use string concatenation (`+`) for complex HTML in template literals.
Never deploy during a live weekend — pushing code while players have the page open causes race conditions. Deploy before Saturday 12:30 or after Sunday results are in.
`currentMatches` is set once on load — never re-filter during live refresh cycles. The 60-second refresh uses `allPredictions[currentPlayerName]` from memory.
Predictions table is source of truth for GW numbers — never derive GW from results count or API matchday field.
Results must be written via Edge Function — direct Supabase writes to results table are blocked by RLS. Use `syncResultsToSupabase()` which POSTs to the Edge Function with service role key.
Test with `simulateLive()` — run in browser console to simulate a live weekend without real matches. `simulateStop()` to exit.
---
Code Architecture
```
fetchAndRenderFixtures()    — main entry point, loads fixtures + predictions + renders
renderMatchesView()         — renders fixture cards with score inputs or live scores
renderSummary()             — renders all predictions table (post-deadline)
renderGWView(gw)            — renders past GW review OR next GW predictions entry
renderLeaderboard()         — season standings + live GW overlay + position chart
syncLiveResults()           — runs every 60s, writes finished results to Supabase
syncResultsToSupabase()     — writes specific finished matches to results table via Edge Function
estimateGWNumber()          — derives current GW from results + predictions tables
loadAllPredictions(gw)      — loads all player predictions for a GW from Supabase
buildLiveResults()          — populates liveResults{} from API match data
```
---
Pending Code Improvements (low priority — do in quiet week)
Safe to do anytime
Remove `renderLeaderboardGuest` one-liner (just calls `renderLeaderboard` directly)
Remove empty `showSignup()` function
Hoist `abbrevMap` to a top-level constant (currently defined in 3 places)
Align API cache TTL (45s) with refresh timer (60s) — increase TTL to 65s
Remove redundant `warmCrestCache()` call (crests already loaded in `fetchAndRenderFixtures`)
Moderate risk — test carefully
Cache `estimateGWNumber` result for the session (currently queries DB on every call)
Optimise `renderLeaderboard` to not fetch all predictions every 60s (only fetch current GW)
High risk — do in off-season only
Merge `fetchAndRenderFixturesGuest` into `fetchAndRenderFixtures` with `isGuest` flag
Split `renderGWView` into `renderNextGWView` and `renderPastGWView`
Group global state variables into a single `state` object
Move inline styles in `renderAdmin` / `renderLeaderboard` to CSS classes
---
Predictr: Picks — Future Product
A platformised version of this game for public use. Key decisions:
Fresh React app on Vercel, new Supabase project
Handles (usernames) instead of dropdown player selection
League system with persistent invite codes
Configurable entry fee (including £0), advised 50/50 weekly/season split
One set of predictions per player across all their leagues
Pot holder selected by admin (changeable), upfront pot calculator
Pro-rata joining fee for mid-season entrants
Global leaderboard by raw points
Bet365, Sky Bet, Paddy Power affiliate odds per fixture
Accumulator builder — result or correct score per selection, or whole acca
Peer-to-peer settlement calculator at season end
10 current players migrated with existing display names as handles
PWA support from day one (Add to Home Screen)
Target launch: start of 2026/27 season (August 2026)
Jake's action items before Predictr build:
Register predictr.me domain
Contact affiliate managers at Bet365, Sky Bet, Paddy Power for custom deals
Get T&Cs and privacy policy drafted
---
Environment Notes
Supabase redirect URL whitelist requires wildcard: `https://hawkoxford.github.io/guesstowin/**`
Admin tab only visible when logged in as Jake, PIN: hawk1993
`simulateLive()` and `simulateStop()` available in browser console for testing
