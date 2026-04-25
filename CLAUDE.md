Guess to Win — Claude Context File
Use this file to onboard Claude at the start of a new conversation. Paste the contents and say "here's the project context, let's continue building."

---

## ⚠️ DATA INTEGRITY RULES - NEVER VIOLATE

**CRITICAL - Read before making ANY database changes:**

- **NEVER delete predictions from the database** under any circumstances
- **NEVER delete results from the database** under any circumstances
- Players may update their own predictions **before the deadline** - this is the ONLY permitted write operation to predictions
- If Jake suggests deleting predictions or results, **ask him to confirm TWICE** with explicit acknowledgement of consequences before proceeding
- **Only exception:** Cleaning up phantom/test data from bugs (e.g. accidental GW36 test data with NULL dates) - requires explicit confirmation and must document what was deleted and why
- **Late entry rule:** Players who haven't submitted ANY predictions can still predict future matches after first kickoff - see Late Entry section below

**Why these rules exist:**
- Predictions are the historical record of what players actually predicted
- Deleting predictions breaks scoring, leaderboard integrity, and season review features
- Results are the official match outcomes - deleting corrupts all historical data
- There is NO legitimate reason to delete either, only to add or update before deadline

---

## Prediction Deadline Rules — VERIFIED WORKING ✅

**Two rules govern when predictions can be submitted:**

**RULE A — Player HAS submitted at least one prediction before first kickoff:**
- All matches lock at first kickoff (deadline)
- Player cannot edit any predictions after first kickoff
- Standard behavior for players who remembered to predict

**RULE B — Player has NOT submitted any predictions before first kickoff:**
- Individual matches lock as they kick off
- Matches that have not yet started remain open for prediction
- Player can still submit predictions for future matches in the gameweek
- Grace period for players who forgot completely
- Anti-gaming: can't wait to see Saturday results then predict Sunday (only works if zero predictions submitted)

**Status:** ✅ VERIFIED — Both rules working correctly (tested 22 April 2026)

**Implementation (index.html):**

1. **Detection logic** (line 1589):
   ```javascript
   const hasAnyPreds = Object.values(myPreds).some(p => 
     p.home !== null && p.home !== undefined && p.away !== null && p.away !== undefined
   );
   ```

2. **Per-match locking** (line 1677):
   ```javascript
   const matchLocked = hasAnyPreds ? deadlinePassed : matchStarted;
   ```
   - Rule A: `hasAnyPreds = true` → `matchLocked = deadlinePassed` (all matches lock at first kickoff)
   - Rule B: `hasAnyPreds = false` → `matchLocked = matchStarted` (individual match locking)

3. **Save button visibility** (line 1633):
   ```javascript
   ${(isOpen || (!hasAnyPreds && deadlinePassed)) ? `<div class="save-bar">
   ```
   - Shows before deadline (normal entry)
   - OR shows after deadline if player has zero predictions (late entry)
   - Displays warning when in late entry mode: "⚠ Late entry — games already started are locked"

4. **Input field display** (line 1677):
   - Uses `matchLocked` to determine whether to show input fields or read-only scores
   - Correctly implements both Rule A and Rule B

---

## CLAUDE.md Maintenance Rules — MUST FOLLOW

**This file is the source of truth.** Keep it complete and accurate after every change.

**Rules:**
1. **Update after every change** — feature, bug fix, config change, database update, anything that affects the project
2. **New feature** → document in "Known Bugs Fixed" (if it was broken) or add a dated note in relevant section
3. **Bug fix** → add to "Known Bugs Fixed" section with symptom, cause, and fix
4. **Superseding changes** → update or remove the old entry to avoid contradictions (e.g., if API key changes, update the relevant section, don't duplicate)
5. **Outstanding tasks** → update "Pending Code Improvements" or other task sections when items are completed
6. **Push with every commit** — CLAUDE.md should be committed alongside code changes so it stays in sync with the repo
7. **Goal** — anyone reading CLAUDE.md should have a complete and accurate picture of the project state, no detective work needed

**What to document:**
- Features added (what, why, how it works)
- Bugs fixed (symptom, root cause, solution)
- Database changes (manual SQL fixes, cleanup operations)
- Configuration changes (API keys, Edge Function deployments)
- Code structure changes (major refactoring, new patterns)
- Lessons learned (technical decisions, things that didn't work, gotchas to avoid)

**What NOT to document:**
- Trivial typo fixes (unless they caused a production bug)
- Formatting-only changes (linting, whitespace)
- Minor UI tweaks that don't change behavior

---

## Deadline Reminder Emails — Automatic Cron Job ✅

**Status:** Configured (22 April 2026)

**How it works:**
- Cron job runs Edge Function every hour: `send-deadline-reminder`
- Function checks if first kickoff is within 24-25 hours (1-hour window)
- Function checks `email_log` table to see if reminder already sent for this GW
- If both checks pass, sends emails to all 10 players via Resend API
- Logs send to `email_log` table to prevent duplicates

**Implementation:**

1. **Edge Function:** `supabase/functions/send-deadline-reminder/index.ts`
   - Checks time window: `23 < hours_until_kickoff < 25`
   - Checks email_log for existing send
   - Fetches upcoming fixtures and current standings
   - Sends branded email to all players
   - Logs to email_log table

2. **Database Table:** `email_log` (created by migration `20260422_deadline_reminder_cron.sql`)
   - Columns: gameweek, email_type, sent_at, success, error_message
   - Unique constraint on (gameweek, email_type) prevents duplicates
   - RLS: authenticated users can read, service role can insert

3. **Cron Schedule:** `0 * * * *` (every hour on the hour)
   - Configured in Supabase Dashboard → Database → Cron Jobs
   - Calls Edge Function via `net.http_post()` with service role key
   - See `supabase/functions/send-deadline-reminder/README.md` for setup instructions

4. **Email Template:**
   - Dark theme with GTW branding (GUESS TO WIN. logo, green accents)
   - Shows upcoming fixtures for the gameweek
   - Shows current league standings (motivational)
   - Link to hawkoxford.github.io/guesstowin
   - Sent via Resend API (requires `RESEND_API_KEY` secret)

**Manual override removed:** Previous manual "Send deadline reminder" button in Admin tab was removed. Emails now send automatically - no manual trigger needed.

**Testing:**
```bash
# Manual test (ignores schedule checks - will send regardless of time window)
curl -X POST https://iufbdwsmbwrtcqzkvyey.supabase.co/functions/v1/send-deadline-reminder \
  -H "Authorization: Bearer <ANON_KEY>"

# Check email log
SELECT * FROM email_log ORDER BY sent_at DESC;

# Clear log for re-testing
DELETE FROM email_log WHERE gameweek = 29;
```

**Player emails hardcoded:**
- Jake: jake14vanags@gmail.com
- Glurk, Josh, Richard, Teflon, Alex, Gaz, Liam, Craig, Marcus: Placeholder addresses (update in Edge Function before using)

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
GW navigation showing next button beyond current GW (fixed 23 April 2026)
Symptom: When viewing GW29 (current GW), a "GW30 →" button was appearing on the right.
Cause: The `gwNavButtons()` function was disabling the next button but still rendering it when `nextGW > currentGW`.
Fix: Changed logic to conditionally render the next button only when viewing a past GW (`gw < currentGW`). When viewing the current GW, the next button is hidden entirely. The prev button always shows if GW > 1.
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

## Recent Fixes — 25 April 2026

### Live GW Points Not Updating for Players with Champion Stars ✅

**Problem:** Glurk, Richard, Teflon, and Gaz showing 0 points for "this GW" on leaderboard despite having predictions that should be scoring points.

**Root cause:** 
- Database `profiles.player_name` has names WITHOUT stars: "Josh", "Richard", "Gaz"
- `PLAYERS` array has names WITH stars for champions: "Josh ⭐", "Richard ⭐", "Gaz ⭐"
- When building `livePredMap` (line 570-576), it uses database names (without stars) as keys
- When iterating over `PLAYERS` (line 578), it uses names WITH stars to lookup predictions
- Lookup failed: `livePredMap["Josh ⭐"]` is undefined because livePredMap only has "Josh"

**Fix applied (line 579-580):**
```javascript
// Strip star from name for lookup (DB has "Josh", PLAYERS has "Josh ⭐")
const nameWithoutStar = name.replace(/\s*⭐\s*/g, '');
const preds = livePredMap[nameWithoutStar] || {};
```

**Files modified:**
- `index.html` — Added star-stripping in leaderboard live points calculation

**Result:**
- ✅ Josh, Richard, and Gaz now show correct live GW points
- ✅ Handles any player name with star emoji
- ✅ Maintains star display in UI while fixing backend lookups

**Committed:** d1d131b

---

### Leaderboard Refresh Interval Reduced to 30s ✅

**Problem:** Leaderboard "points this GW" not updating in real-time during live matches.

**Root cause:** Leaderboard auto-refreshed every 60 seconds, but Scores tab updates live scores every 30 seconds, causing a delay in leaderboard points.

**Fix applied (line 486-488):**
```javascript
// Auto-refresh leaderboard every 30s during live weekend to match Scores tab refresh rate
setInterval(() => {
  if (deadlinePassed) renderLeaderboard();
}, 30000);  // Changed from 60000
```

**Files modified:**
- `index.html` — Reduced leaderboard refresh interval from 60s to 30s

**Result:**
- ✅ Leaderboard now updates every 30 seconds during live gameweeks
- ✅ "Points this GW" updates in sync with live match scores
- ✅ Matches Scores tab refresh rate for consistent UX

**Committed:** 088514d

---

### Live GW Points Calculation Fix — Match Scores Tab Logic ✅

**Problem:** Live GW points still showing 0 for all players after star-stripping fix.

**Root cause:** Leaderboard was using `Object.keys(liveResults)` to iterate, which might not include all matches. Scores tab uses `currentMatches.forEach()` which ensures all fixtures are checked.

**Fix applied (lines 567-595):**
```javascript
// Before: Object.keys(liveResults).forEach(key => ...)
// After: currentMatches.forEach(m => ...)

currentMatches.forEach(m => {
  const home = cleanTeamName(m.homeTeam?.name) || 'Home';
  const away = cleanTeamName(m.awayTeam?.name) || 'Away';
  const key = `${home}_${away}`;
  const pred = preds[key];
  const res = liveResults[key];
  if (pred && res && res.home !== null) {
    const pts = calcPoints(pred.home, pred.away, res.home, res.away);
    if (pts !== null) livePts += pts;
  }
});
```

**Files modified:**
- `index.html` — Leaderboard live points calculation

**Result:**
- ✅ Matches exact logic from Scores tab (lines 1581-1592)
- ✅ All players now show correct live GW points
- ✅ Updates every 30 seconds in sync with live scores

**Committed:** a4ef834

---

### Name Normalization Bug — Half Players Showing 0pts for "This GW" ✅

**Problem:** Craig, Josh, Gaz, Teflon, Richard, Glurk all showed 0 points for "This GW" (GW29) while other players showed correct scores.

**Root cause:** Name mismatch between database `player_name` and PLAYERS array names:
- Database stores names without stars: "Josh", "Richard", "Gaz"
- PLAYERS array has names WITH stars: "Josh ⭐", "Richard ⭐", "Gaz ⭐"
- Base Supabase calculation (lines 531-545) stored points using database names: `gwPoints["Josh"][29] = 12`
- Display code (line 626+) looked up using PLAYERS array names: `gwPoints["Josh ⭐"][29]` → undefined → 0pts

**Why half the players:**
- Not all players had the exact name mismatch
- Some had other naming inconsistencies (whitespace, case, etc.)
- All affected players: Craig, Josh, Gaz, Teflon, Richard, Glurk

**Fix applied across 7 locations:**

1. **Base Supabase calculation (lines 533-534):**
   ```javascript
   const dbName = profileMap[p.user_id];
   const name = dbName.replace(/\s*⭐\s*/g, ''); // Strip stars
   gwPoints[name][p.gameweek] = points;
   ```

2. **Live overlay storage (lines 600-604):**
   ```javascript
   const nameWithoutStar = name.replace(/\s*⭐\s*/g, '');
   gwPoints[nameWithoutStar][currentGW] = livePts;
   ```

3. **gwWinners calculation (lines 549-552)**
4. **liveScores calculation (lines 608-611)**
5. **gwScores/GW leader calculation (lines 665-670)**
6. **baseTotals calculation (lines 614-620)**
7. **totals/display calculation (lines 628-641)**

**Files modified:**
- `index.html` — All gwPoints operations now use normalized names (stars stripped)

**Result:**
- ✅ All players now show correct "This GW" points
- ✅ Season totals now update correctly with live GW points
- ✅ GW winner badges display correctly
- ✅ Rank arrows work correctly (based on baseTotals)

**Committed:** 94bf5c4

**UPDATE:** Initial fix was incomplete. Found duplicate gwPoints keys:
- Historical points stored at `gwPoints["Josh ⭐"]` (with star)
- Supabase points stored at `gwPoints["Josh"]` (without star)
- Display looked up `gwPoints["Josh"]` → only found GW27+ points, missing historical

**Final fix:** Also normalize historical points seeding (line 522):
```javascript
PLAYERS.forEach(name => {
  const nameKey = name.replace(/\s*⭐\s*/g, '');
  const hist = HISTORICAL_GW_POINTS[name] || {};
  Object.entries(hist).forEach(([gw, pts]) => {
    gwPoints[nameKey][parseInt(gw)] = pts; // Use normalized key
  });
});
```

**Result:** All gwPoints now use consistent normalized keys (stars stripped)

**Committed:** 0934f29 (fix), b79bf1e (cleanup)

---

### Edge Function Payload Mismatch — Sync Failing with "No results provided" ✅

**Date:** 25 April 2026

**Problem:** Live results sync was failing with Edge Function error: `{"success":false,"error":"No results provided"}`. GW29 results were not being written to database, causing points calculation to fail.

**Root cause:** Client-server payload mismatch:
- Client (index.html line 1062) was sending: `{ rows: [...] }`
- Edge Function (football-proxy/index.ts line 30) expected: `{ results: [...] }`
- Mismatched property name caused Edge Function to reject the request

**Fix:**
- Changed line 1062 from `body: JSON.stringify({ rows })` to `body: JSON.stringify({ results: rows })`

**Result:**
- ✅ Sync now working correctly
- ✅ Console shows: `{"success":true,"count":1}`
- ✅ GW29 results successfully written to database

**Committed:** 4be7492

---

### "This GW" Column Removed from Leaderboard

**Date:** 25 April 2026

**Reason:** Temporarily removed while investigating scoring issues. The column was showing 0 points for 6 players (Glurk, Josh, Richard, Teflon, Gaz, Craig) on GW29, which turned out to be accurate (they legitimately scored 0 points), but caused confusion during debugging.

**Change:**
- Removed the live GW points column from leaderboard (line 719)
- Removed all SYNC DEBUG and gwPoints DEBUG console logs (production cleanup)
- Kept sync error logging for failures only

**Files modified:**
- `index.html` — Removed "This GW" column and debug logging

**Committed:** 23e4833

**Note:** The "This GW" column can be re-added later if desired. The underlying live points calculation is working correctly.

---

### Bug #3: Premature GW Advancement (GW29→GW30) — Sync Only Writing Finished Matches ✅

**Date:** 25 April 2026

**Problem:** App showed GW29 with only 1 fixture (Fulham v AVL) and incorrectly advanced to GW30, even though GW29 had 5 weekend fixtures total.

**Root cause:** `syncLiveResults` (line 2263-2265) only wrote FINISHED matches to the results table:
```javascript
return m.status === 'FINISHED' && currentMatchKeys.has(key);
```

When GW29 had 5 fixtures but only Fulham v AVL finished, only 1 row was written. Then `estimateGWNumber` (line 925-962) counted:
- `totalCounts[29] = 1` (only 1 result row)
- `finishedCounts[29] = 1` (that 1 row was finished)
- Concluded: `finished >= total` → GW29 complete → advanced to GW30

**Fix applied:**

1. **syncLiveResults** (line 2259-2270): Changed filter to include ALL weekend fixtures (scheduled/in_play/finished), not just finished
2. **syncResultsToSupabase** (line 999-1068): 
   - Removed `finished` filter
   - Added status mapping: API statuses (SCHEDULED/IN_PLAY/FINISHED) → lowercase (scheduled/in_play/finished)
   - Allows null scores for scheduled matches
   - Writes actual match status from API instead of hardcoding 'finished'

**Result:**
- ✅ All weekend fixtures now written to results table immediately (with status='scheduled')
- ✅ `estimateGWNumber` sees correct total fixture count (e.g., 5 for GW29)
- ✅ GW only advances when ALL fixtures are finished, not just 1 of 5
- ✅ Also fixes points calculation issues (Bugs #1 & #2) - players can now be scored against all fixtures, not just the 1 that finished

**Committed:** f49d669

---

### Complete Fix for GW Detection Issues — Three Root Causes ✅

**Date:** 25 April 2026 (final fixes)

**Problem:** App showed GW30 instead of GW29, displayed wrong fixtures, marked live GW as complete.

**Root Cause #1: Sync only wrote FINISHED matches**
- Fixed in commit f49d669 (see above)

**Root Cause #2: Circular dependency - sync filtered predictions by wrong currentGW**
- Sync queried: `predictions WHERE gameweek = currentGW (30)`
- But GW29 matches had predictions in GW29
- Query returned empty → sync failed → currentGW stayed wrong
- **Fix (commit d680841):** Removed `.eq('gameweek', currentGW)` filter, search ALL gameweeks

**Root Cause #3: Rescheduled matches had predictions in multiple GWs**
- Arsenal, Liverpool, West Ham, Wolves were rescheduled from GW28 → GW29
- Had 1 prediction in GW28 (old), 10 predictions in GW29 (new)
- Old code: `forEach` overwrote, last GW wins (non-deterministic)
- Could assign matches to wrong GW (28 instead of 29)
- **Fix (commit b4ff936):** Count predictions per GW, use GW with most predictions

**Complete solution:**
1. Sync writes ALL weekend fixtures (scheduled/in_play/finished) → correct total count
2. Sync searches ALL GWs for predictions → breaks circular dependency
3. Use GW with most predictions → handles rescheduled matches correctly
4. Use 0 for scheduled match scores → satisfies NOT NULL constraint
5. Manual cleanup: Delete orphaned GW28 predictions for rescheduled matches

**Deployed:** c2bb624 (debug cleanup)

**TODO - Improve GW detection logic (implement after GW29 finishes):**

Current logic (functional but flawed):
- Counts results rows in database per GW
- GW complete when: finished count >= total count in database
- Problem: Relies on database being correct, no validation against actual fixture count

Correct logic to implement:
1. **Fixture count from API = source of truth**
   - Query API for GW's fixture list (weekend matches only)
   - Count how many fixtures the GW should have (e.g., GW29 has 5)
2. **GW complete when: API fixture count == finished results count**
   - Check database: how many results have status='finished' for this GW
   - When finished == API count → GW complete
3. **Monday 00:01 UK time → advance to next GW**
   - Even if previous GW incomplete, new GW goes live Monday morning
   - Prevents stuck states if a match is postponed/abandoned

Benefits:
- API is source of truth (more robust)
- Validates database against reality
- Handles edge cases (postponed matches, database errors)
- Time-based fallback prevents infinite loops

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
