# KISS Workout Tracker — Product Requirements Document

## Overview

A local-first, browser-based workout tracking application built for the GZCL strength training method. No server, no accounts — all data persists in IndexedDB within the user's browser.

---

## Data Model

### Core Entities

```
exercises[]
├── id: string (slug)
├── name: string
├── muscles: string[]
├── setup: string
├── superset: string
├── tier: "T1" | "T2" | "T3" | ""

workouts[]
├── name: string
├── exercises: string[] (array of exercise IDs)

sessions[]
├── date: string (YYYY-MM-DD)
├── workoutName: string
├── elapsedTime: number (seconds)
├── notes: string
├── exercises[]
│   ├── id: string
│   ├── name: string
│   ├── muscles: string[]
│   ├── setup: string
│   ├── tier: string
│   ├── superset: string
│   ├── weight: string
│   ├── reps: string
│   ├── sets: number | null
│   ├── originalId?: string   # set when this record supersedes a since-deleted exercise
│   └── failed?: boolean      # marked failed in-session; omitted when false

backup-meta (key in the single `data` object store)
├── lastBackupDate: string | null (ISO date)
├── sessionsSinceBackup: number
└── dismissedAt: string | null (ISO date)
```

### Key Design Decisions

- **Decoupled exercises from workouts**: A single exercise (e.g., "Barbell Bench") can appear in multiple workout days
- **Sessions reference exercise IDs**: Preserves full exercise metadata at time of logging
- **Flat exercise library**: Exercises are managed independently of their assignment to workouts
- **Progression tracking by exercise ID**: Survives exercise renames (history doesn't break)
- **Superseded history survives deletion**: Deleting a library exercise removes it from `exercises[]` and every workout, and strips it from past sessions. For records that had already been logged, `originalId` preserves the link to the deleted definition, so Exercise Detail history and previous-performance lookups still resolve.
- **One IndexedDB store, keyed**: A single object store named `data` (DB `gzcl-tracker-v2`, version 1) holds both the `tracker` document and the `backup-meta` record as separate keys. Not two stores.
- **Failure is a session-scoped flag, not a deleted set**: `failed: true` is an optional boolean on the logged record. Weight, reps, and sets are preserved exactly as entered — a failed set is still evidence.
- **Backup metadata tracked separately from tracker data**: Survives `deleteAllData()`'s effect on the `tracker` key and is cleared explicitly by `resetBackupMeta()`.

---

## Pages & Features

### Sessions Page (`/sessions`)

| Feature | Description |
|---------|-------------|
| Session list | Grid of session cards sorted by date |
| Search | Filter by date, workout name, or notes |
| Sort direction toggle | Flip between newest-first and oldest-first |
| Session count | Shows "X sessions logged" with filtered count |
| Duration display | Shows elapsed time if recorded (e.g., "45m 30s") |
| Add session | Modal to pick date and workout type |
| Navigation | Click card to view session detail |
| Pagination | 12/24/48 page sizes with Prev/Next and "X–Y of Z" count (via `usePagination`) |
| Notes preview | Single-line truncated notes on session cards |
| Training heatmap | GitHub-style activity calendar, 6-month window (`months={6}`, i.e. `months × 30` days) |
| Session stats | Total hours, volume, avg duration, current streak |
| Import session | Upload JSON to import a single session (with duplicate-date handling) |
| Backup reminder banner | Dismissible banner when backup is overdue (≥10 sessions or ≥14 days) |

### Session Detail Page (`/sessions/:date`)

| Feature | Description |
|---------|-------------|
| Header | Date, workout name, exercise count, delete button, export button |
| Export session | Download session as `session-{date}.json` |
| Workout timer | Auto-starting H:MM:SS timer with pause/resume/reset (hours shown after 60 min) |
| Timer persistence | Saves elapsed time periodically; final save on unmount; restores on page load |
| Notes | Auto-saving textarea (500ms debounce) |
| Exercise cards | Grouped by tier (T1/T2/T3/Other) |
| Inline editing | Weight/Reps/Sets inputs per exercise |
| Sets stepper | Plus button inset inside the Sets input for quick increment |
| Progression guidance | GZCL-based suggestions via `ProgressionInfo` component |
| Previous performance | Shows last logged values per exercise (matched by ID or `originalId`, returns most recent) |
| Mark failed | Icon-only `↘` (U+2198) toggle per exercise card |
| Duplicate exercise | Copy a logged exercise within the same session |
| Add exercise | Modal to append a library exercise not yet in the session |
| Remove exercise | Per-card remove, gated by `canRemoveExerciseFromSession` when it is the last of its kind |
| Rest timer | Tier-aware countdown: T1 240s, T2 150s, T3 75s, 120s fallback |
| Delete | Available only at detail level |

#### Mark failed control

- Renders `<span aria-hidden="true">↘</span>` in place of the `Failed` / `Mark failed` text label, so the action row stays visually even next to the duplicate and delete icon buttons.
- **Accessible name is state-dependent and unchanged**: `Mark <exercise> as failed` / `Undo failed status for <exercise>`, supplied by `aria-label`. The glyph is `aria-hidden`, so it contributes nothing to the name.
- A `title` mirrors the `aria-label` for hover discoverability; `aria-pressed` conveys the state.
- The pressed state is **not color-only**: `.btn-toggle[aria-pressed="true"]` adds background, border-color, and underline.
- **The failure *history* display still renders the literal word `Failed`.** Only the interactive control is iconized.

### Exercise Detail Page (`/exercises/:id`)

Read-only. Reached by clicking an exercise name on the Exercises page.

| Feature | Description |
|---------|-------------|
| Header | Exercise name + "Exercise details" subtitle |
| Definition | Muscles, setup, superset, tier |
| Muscle map | `BodyMusclesChart` showing only this exercise's muscles |
| Workout membership | Lists every workout whose `exercises[]` contains this ID |
| History table | Most recent 12 records, newest first |
| History search | Filters across date, weight, reps, sets, and the failure marker |
| Failure marker | Renders the literal word `Failed` for `failed: true` records; `—` otherwise |
| Deleted-exercise fallback | Unknown ID renders "Exercise not found" with a link back to `/exercises` |

History matches on `record.id === id || record.originalId === id`, so it still resolves for exercises that have been deleted from the library.

### Exercises Page (`/exercises`)

| Feature | Description |
|---------|-------------|
| Exercise list | All exercises in library; names link to the detail page |
| Search | Filter by name, muscle, tier, or setup |
| Add exercise | Modal with name, muscles (comma-sep), setup, superset, tier |
| Edit exercise | Inline edit with same fields as add |
| Delete exercise | Removes from library, all workouts, and all past sessions |
| Workout assignment | Add to workouts during creation or editing |
| "Used in" badges | Shows which workouts include each exercise |

### Workouts Page (`/workouts`)

| Feature | Description |
|---------|-------------|
| Workout tabs | Switch between workouts (Squat, Bench, Deadlift, etc.) |
| Workout CRUD | Add, rename, delete workouts |
| Clone workout | Duplicate a workout with a new name (shallow copy of exercise IDs) |
| Exercise management | Add/remove exercises to/from workout |
| Reorder | Move an exercise up or down within the workout |
| Tier grouping | Exercises grouped by T1/T2/T3/Other |
| Muscle visualization | Interactive body map using `body-muscles` library |
| Filter by exercise | "Show" / "Hide" toggle highlights only that exercise's muscles |
| Dual view | Front and posterior body maps side-by-side |
| Add exercise modal | Pick from exercises not already in workout |

#### Muscle map selection semantics

Two independent channels drive the chart, and conflating them is a bug:

- **`intensity`** derives from how often the muscle is trained across the workout.
- **`selected`** derives *only* from `highlightedMuscles` — the exercise the user clicked "Show" on.

So muscles look dimmer as a function of volume, and are highlighted *only* when explicitly selected. "Hide" clears the highlight; switching exercises or workouts clears stale selection rather than carrying it over.

### Settings Page (`/settings`)

| Feature | Description |
|---------|-------------|
| App statistics | Count of exercises, workouts, sessions + backup status (days since last backup, sessions since backup) |
| Export data | Download all IndexedDB data as JSON backup |
| Import data | Upload JSON file to replace all data (validated before storing) |
| Delete All Data | Permanently clears all data and resets to defaults, including backup metadata (with confirmation) |
| Load Seed Data | Replaces current data with seed data (51 sessions, 26 exercises, 5 workouts) |

### Sidebar

| Feature | Description |
|---------|-------------|
| Navigation | Sessions, Exercises, Workouts, Settings links (rendered as both a sidebar and a mobile tab bar) |
| Backup indicator | Red dot on Settings nav link when backup reminder is active |

---

## GZCL Progression Logic

> **GZCL is currently the only progression scheme, and it is hardcoded.** The guidance below and
> the rest periods are written into the app rather than selected. Tiers are a general concept
> that GZCL leans on heavily — other schemes use them more loosely — so the tier field itself
> stays; what becomes selectable is the scheme and the per-tier meaning. See **Progression
> schemes** under Future Considerations.

| Tier | Guidance |
|------|----------|
| T1 | Add 5lbs (bench) or 10lbs (squat and deadlift). If fail, 5x3 > 6x2 > 10x1 > restart at 85% of 1rep. |
| T2 | Add weight. If fail, 3x10 > 3x8 > 3x6 > restart, +5-10lbs from last 3x10. |
| T3 | Increase reps to 15+ at ≤65%. If fail, restart from the bottom of the range. |

Rest periods are tier-aware and currently hardcoded: **T1 240s, T2 150s, T3 75s**. These are
GZCL's values specifically, so they belong to the scheme rather than to the tier concept.

### Progression Display Logic

- **Previous performance**: Returns the most recent session *strictly before* the current date for the same exercise. Returns an array (`PreviousPerformance[]`) so the component can be extended without a signature change.
- **Matches `originalId`**: A record logged under a since-deleted exercise still resolves.
- **Skips empty records**: A row with no weight, no reps, and not failed is not a performance.
- **Survives renames**: Exercise ID matching ensures progression history persists if the user renames an exercise
- **Deload-aware**: Most recent session data is shown, so post-deload weights correctly appear as the baseline
- **Guidance is currently static per tier.** `getNextProgression()` returns a hardcoded string per tier and does not read the previous set. The real direction is **selectable and customizable progression schemes** — see **Progression schemes** under Future Considerations. Note that the GZCL tests in `logic.test.ts` run against a duplicate of that function, not the shipped one, so they do not cover the current behavior.

---

## Backup Reminder System

### Triggers

`shouldShowReminder` is true when ANY of the following are true:
- `sessionsSinceBackup >= 10`
- `lastBackupDate` is set and ≥14 days have elapsed **and** the reminder was not dismissed in the last 14 days
- No backup has ever been created and at least 1 session has been logged

### UI Elements

- **Banner**: Dismissible banner on Sessions page with message ("It's been X days since your last backup" or "You have X sessions without a backup"), Export button, and "Remind me later" button
- **Nav indicator**: Red dot on Settings nav link when reminder is active

### Data Flow

- `incrementBackupCounter()` called after each `addSession()`
- `recordBackup()` called after successful export (resets date, counter, and `dismissedAt`)
- `dismissReminder()` resets the session counter **and** stamps `dismissedAt`, suppressing the time-based trigger for 14 days — not indefinitely
- `exportBackup()` reads the `tracker` key, downloads `kiss-tracker-backup-{date}.json`, then records the backup
- `deleteAllData()` clears the `tracker` key; `resetBackupMeta()` clears backup metadata

---

## Technical Architecture

### Stack

- **Framework**: React 19 with TypeScript 7
- **Build tool**: Vite 8
- **Routing**: react-router-dom v7 (`/` redirects to `/sessions`)
- **Storage**: IndexedDB via a custom `db.ts` wrapper (raw `IDBDatabase`, no `idb-keyval`) — DB `gzcl-tracker-v2`, one object store `data`, keys `tracker` and `backup-meta`
- **Body visualization**: `body-muscles` npm package
- **Testing**: Vitest 5 + @testing-library/react + jsdom + fake-indexeddb
- **Linting**: oxlint
- **Error handling**: `ErrorBoundary` wraps the app

### Project Structure

```
src/
├── components/
│   ├── BackupReminderBanner.tsx # Dismissible backup reminder banner
│   ├── BodyMusclesChart.tsx    # Wrapper for body-muscles library
│   ├── Button.tsx              # Shared button (variants: primary/success, sizes: sm, danger)
│   ├── CalendarHeatmap.tsx     # GitHub-style training activity heatmap
│   ├── ErrorBoundary.tsx       # Top-level error boundary
│   ├── Layout.tsx              # Sidebar/tab nav with backup indicator
│   ├── Modal.tsx               # Reusable modal (title, message, input, actions)
│   ├── ModalProvider.tsx       # Context provider with promise-based showModal()
│   ├── ProgressionInfo.tsx     # Last time + next progression step display
│   └── SessionStats.tsx        # Session statistics (hours, volume, avg, streak)
├── context/
│   └── BackupContext.tsx       # Backup metadata, export, reminder logic
├── hooks/
│   └── usePagination.ts        # Page state, page size, slicing helpers
├── pages/
│   ├── ExerciseDetailPage.tsx  # Read-only exercise detail + searchable history
│   ├── ExercisesPage.tsx       # Exercise library CRUD
│   ├── SessionDetailPage.tsx   # Logging, timers, notes, exercise cards, export
│   ├── SessionsPage.tsx        # Session list, search, sort, pagination, heatmap, stats, banner
│   ├── SettingsPage.tsx        # Stats, import/export, delete-all, load-seed, backup status
│   └── WorkoutsPage.tsx        # Workout organization, clone, reorder, muscle map
├── test/                       # All test files + setup.ts (21 files incl. setup)
├── assets/                     # hero.png, logo.png
├── body-muscles.d.ts           # Ambient types for the body-muscles package
├── context.tsx                 # TrackerContext — all session/exercise/workout state + actions
├── data.ts                     # Seed data
├── db.ts                       # IndexedDB low-level API (single `data` store)
├── types.ts                    # TypeScript interfaces for all entities
├── utils.ts                    # parseNumber helper
├── validation.ts               # Runtime validation for imported JSON
├── App.tsx                     # Router setup
├── main.tsx                    # Entry point
└── index.css                   # Global styles + CSS variables

test/                           # (none — tests live in src/test/)
```

### Key CSS Variables

```css
--bg: #0f1115
--surface: #181b22
--surface2: #1f232c
--border: #2a2f3a
--text: #e6e8ec
--muted: #8a90a0
--accent: #b8a4e8
--t1: #ff6b6b
--t2: #f5b042
--t3: #4ecb71
```

### Shared Components

**Button** (`src/components/Button.tsx`)
- Props: `variant` ('default' | 'primary' | 'success'), `size` ('default' | 'sm'), `danger` (boolean), plus all native `<button>` attributes
- Replaces all raw `<button className="btn ...">` elements across the app
- `danger` adds `--t1` red color; `size="sm"` uses smaller padding
- `className` is merged into the classes array for custom overrides

**Modal** (`src/components/Modal.tsx`)
- Props: `isOpen`, `title`, `message`, `actions`, `input` (optional), `onClose`, `onAction`
- Promise-based API via `useModal()` hook from `ModalProvider`
- Replaces all native `alert()`, `confirm()`, and `prompt()` calls
- Actions: `{ label, value, variant? }[]` — variant applies button styling
- Input: `{ defaultValue?, placeholder? }` — renders text input, Enter triggers first action

**CalendarHeatmap** (`src/components/CalendarHeatmap.tsx`)
- GitHub-style activity calendar grouped by week columns
- Window is `months × 30` days back from today, default `months = 6` (Sessions page passes `months={6}`)
- Intensity levels: 0 (no session) to 4 (all exercises logged)
- Hover tooltip shows date, workout name, exercises logged, elapsed time

**SessionStats** (`src/components/SessionStats.tsx`)
- Computes: total hours, total volume (weight × reps × sets), avg duration, current streak
- Skips non-numeric weights ("BW", "Heavy", "30s", "40yd") via `parseNumber`
- Streak: consecutive weeks with ≥1 session counting backward from current week

**ProgressionInfo** (`src/components/ProgressionInfo.tsx`)
- Displays "Last time" values and the tier's GZCL progression guidance
- Takes `prevInfo: PreviousPerformance[]` and optional `tier`

**BodyMusclesChart** (`src/components/BodyMusclesChart.tsx`)
- Renders front and posterior maps via `body-muscles`
- `intensity` from workout training counts; `selected` from `highlightedMuscles` only
- Selection and intensity are separate channels — see the Workouts Page section

**BackupReminderBanner** (`src/components/BackupReminderBanner.tsx`)
- Dismissible banner with dynamic message (days-since-backup or sessions-without-backup)
- Export button triggers download and updates backup metadata
- "Remind me later" resets session counter and stamps `dismissedAt`

**ErrorBoundary** (`src/components/ErrorBoundary.tsx`)
- Class component wrapping the app; catches render errors and shows a fallback

---

## User Flows

### Starting a Workout

1. Navigate to Sessions page
2. Click "+ Add Session"
3. Select date and workout type
4. Timer auto-starts (for today's session)
5. Log weight/reps/sets per exercise
6. Add notes
7. Navigate away — all data auto-saved

### Tracking Progression

1. Open existing or create new session
2. View "Last time" + progression guidance under each exercise
3. Follow suggested progression (add reps or weight)
4. Log new values

### Logging a Failed Set

1. Open the session
2. Click the `↘` button on the exercise card
3. The exercise is marked failed — weight, reps, and sets are kept as entered
4. The button's accessible name flips to "Undo failed status for &lt;exercise&gt;" and `aria-pressed` becomes true
5. Click again to undo
6. The failure shows as the literal word `Failed` in session history and on the Exercise Detail page

### Reviewing an Exercise

1. Go to Exercises page
2. Click an exercise name
3. Review definition, muscle map, and which workouts use it
4. Scroll the history table; use the search box to filter across date, weight, reps, sets, and failure
5. History shows the 12 most recent records, including any logged under a since-deleted definition

### Managing Exercises

1. Go to Exercises page
2. Use search to find exercises
3. Add new or edit existing
4. Assign to workouts during creation/editing
5. Click through to the detail page for history

### Managing Workouts

1. Go to Workouts page
2. Select or create workout tab
3. Add/remove exercises, reorder them
4. Click "Show" on an exercise to highlight only its muscles on the body map; "Hide" to clear
5. Clone workout to create variants

### Data Backup and Restore

1. Go to Settings page
2. Click "Export" to download JSON backup
3. Click "Import" to restore from backup file (validated before storing)
4. Click "Delete All" to reset to defaults (clears backup metadata too)
5. Click "Load Seed" to populate test data

### Single-Session Portability

1. On Sessions page: click "Import Session" to upload a `session-{date}.json` file
2. On Session Detail page: click "Export" to download that session as JSON
3. Duplicate-date handling: modal prompts to overwrite or cancel

### Backup Reminder

1. System tracks sessions since last backup and days since last backup
2. Banner appears on Sessions page when threshold exceeded (≥10 sessions or ≥14 days)
3. Red dot on Settings nav link indicates active reminder
4. Click "Export" in banner to download backup and clear reminder
5. Click "Remind me later" to dismiss — suppresses both triggers for 14 days

---

## Test Data

51 seed sessions spanning July 13 – October 18, 2026:

| Workout Type | Sessions |
|--------------|----------|
| Squat Workout | 18 |
| Bench Workout | 17 |
| Deadlift Workout | 16 |

Exercises: **26** across 3 tiers (T1: 3, T2: 7, T3: 16), assigned to **5** workouts (Squat, Bench, Deadlift, Unscheduled, Bench Workout (Volume)).

**T1 Progression (realistic GZCL):**
- Squat: 225×3×3 → 235×5×4
- Bench: 185×3×5 → 190×5×4
- Deadlift: 315×3×4 → 325×4×3

**Other realistic touches:**
- Deload weeks every ~4th week (reduced volume, "focusing on recovery" notes)
- Varied rest days between sessions (1-3 days)
- Realistic notes ("Knees felt tight", "Shoulder tweaked", "New PR!", etc.)
- Elapsed times vary 45-90 minutes
- T2/T3 accessories progress independently
- 69 of 439 exercise records (15.7%) are intentionally incomplete
- 4 records carry `originalId` — exercises deleted from the library after being logged
- **2 failed records**, both on 2026-10-13 Bench Workout: Barbell Bench at 190×4×4, and Nordics with blank weight/reps

---

## Testing

**148 tests across 20 files.** Verified by running `npm run test` at `origin/main` (720ca5e) from a clean worktree: 20 files passed, 148 tests passed. Five consecutive full-suite runs were green.

> **Known flake**: `ExerciseDetailPage.test.tsx` → *"renders current details, workout membership, and only this exercise on the muscle map"* failed once on a cold first run and then passed on 5/5 subsequent runs. The assertion reads `BodyChart` mock calls immediately after `renderPage()`, but `BodyChartView` constructs the chart inside a `useEffect` — so the assertion can observe zero calls if the effect has not flushed when the test asserts. It is a test-timing race, not a product defect. Fixing it means awaiting the effect (or asserting on rendered output rather than mock call order) before the `toHaveLength(2)` check.

| Test File | Count | Coverage |
|-----------|-------|----------|
| `logic.test.ts` | 18 | Date compare, GZCL progression, ID generation, duplicate-date guard, sets parsing |
| `BackupContext.test.tsx` | 15 | Backup metadata read/write, export, dismiss, reminder thresholds |
| `ProgressionInfo.test.tsx` | 11 | Null data, normal data, missing data, CSS classes, tier guidance |
| `usePagination.test.ts` | 10 | Page state, page size changes, slicing, reset |
| `BodyMusclesChart.test.tsx` | 8 | Chart rendering, intensity from counts, selection from highlights |
| `Button.test.tsx` | 8 | Variants, sizes, danger state, className merging, disabled, onClick |
| `ExerciseDetailPage.test.tsx` | 8 | Definition, workout membership, muscle map, history, search, deleted-exercise fallback |
| `Modal.test.tsx` | 8 | Open/close, actions, input, variants, onClose |
| `SettingsPage.test.tsx` | 8 | Stats rendering, load seed, delete confirmation modal, cancel flows |
| `exercise-failed.test.tsx` | 7 | Failure toggle, `↘` glyph, `aria-pressed`, state-dependent label + `title`, persistence, legacy sessions, duplicate independence |
| `BackupReminderBanner.test.tsx` | 6 | Banner messages, export, dismiss |
| `Layout.test.tsx` | 6 | Nav links, active state, backup indicator |
| `SessionStats.test.tsx` | 6 | Hours, volume, avg duration, streak, non-numeric weight skipping |
| `db.test.ts` | 6 | Store open, get/set, error handling |
| `CalendarHeatmap.test.tsx` | 5 | Heatmap rendering, intensity calculation, tooltip data |
| `WorkoutsPage.test.tsx` | 5 | Show/Hide highlight, switching exercises, clearing stale selection |
| `session-workflow.test.tsx` | 5 | Create session, persist to IndexedDB, log data, save notes, timer labels |
| `ErrorBoundary.test.tsx` | 3 | Catches render errors, fallback UI |
| `backup-counter-e2e.test.tsx` | 3 | End-to-end counter increments across session creation |
| `seed-data.test.tsx` | 2 | Seed integrity, failed seed records |

Run: `npm run test` (single run) or `npm run test:watch` (watch mode)

---

## Future Considerations

- Mobile-responsive layout improvements
- Full volume & intensity dashboard (SessionStats is a start)
- Selectable and customizable progression schemes (GZCL is the first; see the section below)
- PR tracking and display
- Dark/light theme toggle
- 1RM estimator (Epley/Brzycki)
- Deload recommender
- Session comparison
- Body weight log
- CSV export
- Extract the Session Detail workout timer and rest timer into a reusable `Timer` component

### Progression schemes — selectable, then customizable

**Status: the current advice is static text, not progression logic.** Worth being precise
about what exists today, because the shape of the work depends on it.

`getNextProgression()` in `ProgressionInfo.tsx` branches on tier and returns a **hardcoded
string** — "Add 5lbs (bench) or 10lbs (squat and deadlift)" for T1, and so on. The
history-aware logic that would actually *look at the previous set* is present but **fully
commented out** in all three branches, and the function signature keeps its parameter as
`_prevInfo` to satisfy the unused check. The previous performance is fetched, formatted, and
displayed as "Last time" — then not used for the advice at all.

⚠️ **The tests give false confidence here.** `logic.test.ts` contains a *duplicate* local copy
of `getNextProgression` — with the rep-milestone branches **active** — and 14 GZCL tests run
against that copy. They never call the real function. The suite is green while the app returns
static strings. Whatever happens to this feature, the first fix is to delete the duplicate and
point the tests at the real implementation, otherwise they certify nothing.

Note the old commented-out logic was also not correct on its own terms: it branched only on
rep counts and never read the tier's own rules, and the T1 branch's "add a rep" advice ignores
that a belt squat or a cable stack is not numerically comparable to a barbell (see **Exercise
substitution** and **Multi-equipment**). So this is a rewrite, not an un-comment.

**Direction, in two stages.**

1. **Selectable scheme.** GZCL is hardcoded as if it were the only program that exists. Make the
   scheme a setting: pick GZCL, and later P-Zero, 5×5, Starting Strength, or a custom one.

   **Tiers remain a first-class concept and the existing `T1 | T2 | T3 | ""` union stays as
   it is.** The *strength* of the tier concept varies by program — it is central to GZCL and
   P-Zero, and a weaker organizing axis in others — but every scheme needs some way to say
   "this movement is a primary lift" versus "this is accessory work." What changes is not
   whether tiers exist but **what each one means**: in GZCL a tier encodes an intensity
   percentage and a rep range, and in a weaker-tiered scheme it may encode only priority.
   So the tier *labels* are a scheme's business; the tier *field* is not in question.
2. **Customizable within a scheme.** The longer-term goal: let a user adjust the increment,
   the rep targets, the progression rule, and the failure handling rather than accepting a
   program's defaults. GZCL's own "add 5 lbs bench / 10 lbs squat" and the double-increment
   variants (5/5/2.5, 2.5/1.25) are the natural first settings, because the program itself
   already parameterizes them.

**Open questions**

1. **Is a scheme a global setting, or per-exercise?** Global is far simpler and matches how
   people actually train — one program at a time. Per-exercise is what a real training max or
   an accessory movement might need. Open: global now, per-exercise later?
2. **What is the actual unit of a scheme?** Today it is a display string. For customization it
   has to become structured data — increments, rep targets, a rule, a failure response, and
   per-tier meaning — and that structure *is* the design. Everything else follows from it.
3. **Does a tier mean the same thing on every exercise within a scheme?** A scheme that
   encodes intensity percentage has to decide what a T1 bench and a T1 squat share — and the
   honest answer may be "the tier sets a role, the exercise sets the numbers," which is
   already how the rest of the app works. This is the substantive design question now that
   the tier field itself is settled.
4. **Are tiers fixed at three, or variable?** The type is currently a three-member union
   because GZCL is. A scheme with more or fewer intensity bands (P-Zero's 2P/1P structure
   does not map one-to-one onto T1/T2/T3) either fits inside three or the union has to widen.
   Open, and lower stakes than it looks if the tier *label* is scheme-defined.
5. **Does a scheme change *guidance only*, or also *progression math*?** The 1RM estimator
   bullet above and this one are the same feature seen from two sides — a scheme should
   eventually drive the 1RM estimate that drives the next target, not just the sentence
   displayed under the card. Worth designing them together.
6. **What happens to guidance already shown when the scheme changes?** Recompute on read
   (nothing persisted, always current) or persist advice at log time? Recompute is simpler and
   probably right, but it means the text is a function of current settings, so changing a
   setting silently rewrites history's advice.

### Exercise substitution ("I did belt squats instead of barbell squats")

**Motivation.** Injury, soreness, or accumulated fatigue makes a programmed movement
unavailable on a given day. The motivating case is substituting a **belt squat** for a
**barbell squat** in the Squat workout. The set is still logged; only the implement changes.

**Shape of the feature.** Declare which exercises may stand in for which, then offer a
swap on the Session Detail page that substitutes the implement on the card.

#### Open questions — unresolved, and they gate the design

1. **Where does the relationship live?** Authoring it on the Workouts tab is the obvious
   *surface*, but the underlying data probably belongs on the `Exercise` definition. A
   belt squat is a valid stand-in for a barbell squat on any day that programs one, so
   a per-workout map would mean re-declaring the same pair on every workout that needs it.
   Open: one library-level `Exercise.alternatives` list (reusable, symmetric authoring,
   loses per-day control) vs a per-workout map (precise, does not travel) vs both
   (library-level, with a workout allowed to restrict it).

2. **"Same movement" or "same muscles"?** These are different claims and the difference
   decides whether progression history carries over.
   - *Same movement, different implement* (barbell squat → belt squat). Arguably one
     progression history, with a caveat that belt-squat load is **not** numerically
     comparable to barbell load.
   - *Different movement, same muscles* (barbell squat → hack squat). Should **not**
     share a progression history.
   A symmetric "alternatives" list silently conflates these. Direction matters, and the
   UI probably needs to say which kind of swap it is.

3. **What should "Last time" show after a swap?** Today `getPreviousPerformances()` keys
   on the session record's own `id` and returns the most recent prior session for it.
   After a swap the card's `id` is the *substitute*, so "Last time" would show the
   substitute's own history — probably correct, since the substitute should progress on
   its own merits. Open: whether the card should additionally surface "last time you did
   the *programmed* exercise" as secondary context, especially when the substitute has
   little or no history yet.

4. **Does tier-based guidance survive the swap?** `getNextProgression()` advises by tier
   (T1 → add 10 lbs). A belt squat logged as T1 inherits that advice, but belt-squat
   loading runs on a different scale, so the advice may be wrong rather than merely
   imprecise. Open: whether an exercise-level flag should suppress or re-target the
   guidance.

5. **What happens to values already on the card at swap time?** If the user logged
   225×5×3 and then swaps, the numbers are ambiguous: a starting point for the belt squat,
   or a record of an abandoned set? Clear them, carry them over, or confirm first?

6. **How should the swap be recorded?** A `substitutedFor` field on the logged record
   would make substitutions visible in history — and would let the app eventually answer
   "my squat progression has stalled; I have used belt squats 3 of the last 6 weeks."
   Note this is **not** the same as `originalId`, which today means "supersedes a
   *deleted* exercise" and drives the Exercise Detail "not found" fallback. Reusing
   `originalId` would silently overload it and change existing history-matching behavior.
   A distinct field is the safer route.

#### Touch points

| Area | Why |
|------|-----|
| `types.ts` | New optional field on `Exercise` and/or `SessionExercise` |
| `validation.ts` | Both `validateExercise` and `validateWorkout` need an "absent is valid, present-but-wrong-typed is not" rule, matching how `equipment` and `meta.name` are handled. Backup import round-trips the whole document, so an unvalidated field is a silent-corruption path. |
| `context.tsx` | A swap action. It should **not** route through `removeExerciseFromSession` — that is gated by `canRemoveExerciseFromSession`, which blocks removing the last T1, and swapping the only T1 must not be blocked. |
| `WorkoutsPage` | Authoring surface for the relationship |
| `SessionDetailPage` | The swap control itself |
| `ProgressionInfo` | Questions 3 and 4 land here |
| `SessionStats` | Worth noting: volume is `weight × reps × sets`, so substituting a much heavier implement changes the number. Not wrong, but it will look like a spike. |
| Seed data | A substituted session or two, so the behaviour is visible without hand-editing IndexedDB |

### Multi-equipment and a generic weight inventory

**Motivation.** `equipment` is currently a single-value enum with exactly one meaningful
member — `'barbell' | ''` — and it drives the plate calculator. That is too narrow for two
real cases: a cable machine whose **stack starts at ~5 lbs** (so the "bar weight" is not
zero and not a barbell), and any future implement that changes how weight is added.

**Sibling idea: a kill switch.** A single "enable plate calculator" toggle, off by default
for anyone who does not want the feature at all. Cheap, independent of the rest, and it
de-risks the whole area — see the sequencing note below.

#### What the model would have to become

`equipment: 'barbell' | ''` → an array of objects. A shape that covers the cable machine
would need, at minimum, an id/label and a **starting weight** that acts as the calculator's
"bar" equivalent:

```ts
equipment: { id: string; label: string; baseWeight: number }[]
```

`meta.barbellWeight` and `meta.plates` are currently *global* — one bar, one inventory. With
N equipment types, both become per-equipment. The "plates you own" section becomes a
generic weights inventory with a checkbox matrix marking which weights are usable on which
equipment:

```
weight │ barbell │ cable │ dumbbell
  45   │    ☑    │       │    ☐
  10   │    ☑    │   ☑   │    ☐
  2.5  │    ☑    │   ☑   │    ☐
```

#### Open questions

1. **A cable machine is not plate-loaded.** The whole calculator is a subset search over
   plate stock that loads *symmetrically per side* — `perSideStock()` floors `count / 2`
   and `calculatePlates()` doubles the per-side sum. A cable's selectable increments are a
   single stack, not two sides, so the existing algorithm does not model it. Open: is this
   one feature or two — "equipment becomes an array" (data model, mechanical) and "the
   calculator handles non-plate equipment" (new algorithm)?

2. **Is the cable machine's 5 lbs a `baseWeight`, or is `baseWeight` the wrong abstraction
   entirely?** For a barbell, "bar weight" is an irreducible floor. For a cable stack it is
   a *starting increment* and the increments themselves are the inventory. Open: model the
   cable's own increment ladder as inventory rows, or keep `baseWeight` and accept that a
   cable's smallest step is not representable.

3. **Dumbbells are symmetric-per-side too, but not interchangeable.** Two 45s is one row;
   a pair of dumbbells is two *sides* the user must load, and usually owns as a matched
   pair rather than an even count. Open: does the per-side symmetry assumption hold for
   every equipment type, or does it need to become a per-equipment property?

4. **Does `equipment` become an array on the *session snapshot* too?** `SessionExercise`
   snapshots `equipment` at log time so a session records what was actually used. An array
   is a wider snapshot, so `addExerciseToSession` and `duplicateExerciseInSession` both need
   updating — and the historical records that carry `equipment: 'barbell'` as a bare string
   must keep rendering. Open: a migration, or a read-time coercion that keeps old data valid?

5. **What does the equipment pill look like for a multi-equipment exercise?** The pill is
   currently one `EQUIPMENT_LABELS` lookup and appears in two places (`ExercisesPage` card,
   `SessionDetailPage` card) via `constants.ts`, which exists specifically so the label
   cannot drift between them. An array means deciding the display rule — `Barbell`,
   `Barbell + Cable`, `3 items` — and `EQUIPMENT_LABELS` stops being a `Record` lookup.

6. **Migration risk on `validation.ts`.** `EQUIPMENT_VALUES = ['', 'barbell']` gates import
   validation. Old backups carry the string; new ones carry an array. Whichever way this
   goes, `validateExercise` and `validateSessionExercise` must accept both or existing
   backups stop importing — a silent data-lockout for a cosmetic feature.

7. **What is the default state for existing users?** New equipment types, a new weights
   matrix, and a kill switch all need defaults. Open: does an existing user get the
   calculator silently switched off (safe, but they lose a feature they use) or on (visible,
   but a surprise)?

#### Sequencing

These are separable and should not ship as one PR. The natural order, lowest risk first:

1. **The kill switch.** Self-contained, touches `meta`, and gives an escape hatch for
   everything after it. Worth building first for that reason alone.
2. **The checkbox matrix** on top of the existing single barbell inventory — still one
   equipment, so the algorithm is untouched. De-risks the Settings UI before the model
   changes shape.
3. **Equipment as an array** — the data-model change, with the read-time coercion for
   existing string records.
4. **Non-plate equipment in the calculator** — the actual algorithm work, and the only
   piece that needs new math.

#### Touch points

| Area | Why |
|------|-----|
| `types.ts` | `Exercise.equipment` and `SessionExercise.equipment` both widen to arrays; `meta` gains a per-equipment inventory and the feature toggle |
| `constants.ts` | `EQUIPMENT_LABELS` stops being a `Record<string, string>` lookup once labels live on the equipment objects |
| `validation.ts` | Must accept both legacy string and new array, or old backups stop importing — see open question 6 |
| `utils/plates.ts` | `calculatePlates`, `perSideStock`, and the quarter-pound integer model are all barbell-and-two-sides assumptions. `DEFAULT_BARBELL_WEIGHT` and `DEFAULT_PLATES` become per-equipment defaults. Note the existing comment: the subset search is deliberate, not accidental — do not "simplify" it to greedy while reshaping it. |
| `SessionDetailPage.tsx:370` | The `ex.equipment === 'barbell'` guard becomes a lookup: which equipment applies, and is the toggle on? |
| `ExercisesPage.tsx` | The equipment pill renders for an array |
| `SettingsPage.tsx` | The debounced-write barbell/plates inputs become a matrix plus a toggle. Note the existing half-typed-number handling — "4" and "45" must not clobber each other mid-edit. |
| `data.ts` | Seed data carries the legacy string; exercises the feature is not on must be seeded to prove the toggle works |

### Google Drive backup

**Motivation.** The manual Export button is the only backup. If the user does not click it,
they do not back up — and a local-first app with no server has exactly one copy of the data.
The idea is to push the backup to Drive on a schedule so it happens without being remembered.

> ⚠️ **Scope note, added after the fact.** This section was written when the driver was
> "get the MVP off the group chat so I could test whether it fits." That goal is met — a
> month of consistent use. The surviving need is narrower and smaller: *durability of a month
> of real data*, and possibly "get it onto a second device" (see **Multi-device sync** below).
>
> **Before building any of this, read the sequencing in the sync section.** A local-first app
> with no service worker and no `navigator.storage.persist()` call is currently exposed to
> silent eviction, which is a bigger day-one risk than anything Drive solves. Drive is now
> the *last* rung, not the first, and a purpose-built sync backend may render it unnecessary.

#### The shape of the idea

Push the backup to Drive on a schedule, so it happens without being remembered. Today the
Export button is the only backup: if it isn't clicked, there is no backup.

**The product problem, not the API one:** an *unattended* upload almost certainly needs a
server somewhere to hold the Google credential, because a browser can't silently re-auth as
itself. That spends the app's defining property — no backend, no accounts. Whether that's
worth buying is a product call, not a technical one, and it's reversible only at the cost of
the work already done. **This is the decision; everything else is detail that follows from it.**

**Open questions:**

- One rolling file updated in place, or dated files with a keep-last-N policy? Every backup
  run creates something, and retention has to be designed rather than discovered.
- The backup must be visible and retrievable by the user without the app. Drive's hidden
  app-private folder is deleted on uninstall — a backup that vanishes with the app isn't a
  backup.
- Disconnect has to also wipe stored local state, and should report success when the token is
  already expired (the common case, since access tokens are short-lived).
- Consent must be a user click in context, never at startup. The existing Export button is
  the natural trigger and matches the `BackupReminderBanner` / Settings UX already built.
- With a per-file Drive scope, the consent screen will literally say the app can *"create new
  Drive files."* Don't write "backs up all your data."

#### If no backend is acceptable

The answer is an improved manual export — and the app should **not claim to be automatic**,
because it can't be. The current Export flow already works; the deliverable would be better
copy and clearer backup-state messaging, not automation. Worth writing down explicitly so this
section isn't revisited as if it were still open.

**Feasibility research** (OAuth flows, scopes, token storage, citations, verified/unverified
split) lives in `docs/google-drive-backup-research.md`. Deliberately kept out of this
document — it's a feasibility answer, and this section is an idea register.

### Multi-device sync

**Motivation.** The original Drive idea was about backup — a copy that exists somewhere else
so a lost device isn't a lost month. That goal has evolved: the real gap is now **being able
to see your own history on whichever device you're holding.** Logging a session on the phone
should make it reviewable on the laptop without a manual export/import round-trip. Today
that requires: export JSON, transfer the file by hand, import it. Every time.

**Backup and sync are different problems, and the Drive work does not deliver this.** Backup
is one-way and append-only — write a whole snapshot, lose nothing that existed before it.
Sync is bidirectional and concurrent: two devices edit while offline, and someone has to
decide what happens when they reconnect. A Drive folder full of dated JSON snapshots gives
you the first and not the second. At best it is manual: export from phone, import on laptop.

**The blocking finding: `Session` has no `id`.** `types.ts:37-43` defines identity as
`date: string` — and `deleteSession(date)` filters on `s.date !== date`. The whole
collection is keyed by a human-facing value that is **not unique**. You can plausibly log
Push Day and Pull Day on the same date, and if you ever did, the second `addSession` call
(`context.tsx:100`) prepends a second record with an identical key, and every subsequent
operation that looks up by date — delete, rename, the progression lookups — becomes
ambiguous. This is latent today because it only misbehaves on a collision, but it is
exactly the thing that breaks the moment a second device writes concurrently.

**Why this has to be fixed before any sync design, and it's a good fix anyway:**
`sessions` are a collection of independent records, so the standard solution is to give
each one a stable UUID and treat the store as a set of records to merge rather than one
blob to overwrite. Note that exercises and session-exercises already do this correctly —
`addExercise` builds `` `${baseId}-${crypto.randomUUID()}` `` (`context.tsx:172`) and
`duplicateExerciseInSession` appends `-copy-${crypto.randomUUID()}`. Sessions are the
inconsistent one. Adding `id` to `Session` is backwards-compatible, and a migration that
backfills ids for existing records is a prerequisite for sync.

**Open questions**

1. **What are the actual sync semantics?** Open: last-write-wins per record, a
   field-level merge, or "sessions are append-only and everything else is last-writer-wins"?
   The data model strongly suggests the third is sufficient — you log a session, you don't
   co-edit one — and it would be dramatically simpler than a real CRDT. Worth confirming
   that's true of real usage before building anything.
2. **Deletions don't merge.** LWW handles "both devices changed the same record" but not
   "deleted on phone, unchanged on laptop." The naive merge resurrects it. Open: tombstones,
   or a "recently deleted" view?
3. **Is there a server at all?** This is the same backend question as Drive, and the answer
   is now forced: sync needs somewhere to reconcile, so the "no backend" property is spent
   either way. Given that, **one backend serving both backup and sync is strictly better
   than two** — see below. This is the decision point, and it's bigger than the Drive one.
4. **Auth.** Drive forces Google OAuth. A purpose-built sync backend does not — anonymous
   device pairing (a code from one device entered on the other) would keep the "no accounts"
   property that Drive costs you. Open, and the reason this may be *better* than the Drive
   route despite the extra work.
5. **What about "logged on phone, didn't open laptop for 3 weeks"?** LWW per record handles
   this cleanly if the merge is a set union, since each device only ever appends new
   sessions. This is the case that actually matters, and it's the easy one.
6. **Offline behaviour.** The app is currently write-local, always. Open: queue writes while
   offline, or is it acceptable to only sync on load/foreground?
7. **Does `deleteAllData` mean "delete everywhere"?** Today it clears one browser's
   IndexedDB. Under sync, a user tapping "Delete Everything" on a phone may expect that to
   mean it everywhere. This needs a deliberate answer and probably a much stronger
   confirmation — see the hardening item in the Drive section; sync makes it worse.

#### The strategic point

The backup section above concluded that a backend is unavoidable for automatic backup. Sync
**also** requires one, for the same reason. That's two features independently arriving at
the same architectural change, which is the strongest signal available that the backend is
the right move rather than a concession.

Recommendation: treat "add a small backend" as its own decision, and treat backup and sync
as two consumers of it. Building Drive-first and then retrofitting sync would mean
reconciling two storage systems instead of one, and would spend the backend property twice
to get there more slowly.

The honest sequencing, cheapest protection first:

1. `navigator.storage.persist()` — one prompt, no architecture, removes silent eviction.
2. Harden `deleteAllData` — auto-export first, or typed confirmation.
3. Rolling local snapshots in IndexedDB with a "Restore from…" picker — recovers from
   mistakes, which is the highest-*probability* loss, and needs no backend at all.
4. `Session.id` + backfill migration — required by sync, valuable on its own.
5. Backend + sync — the real answer to the phone/laptop gap.
6. Online backup becomes a byproduct of 5, at which point Drive may be unnecessary: a
   purpose-built backend can keep its own history without asking Google for anything.

### Auth as the prerequisite for sync

**Motivation.** Sync requires knowing *whose* data it is. The app currently has **no identity
concept at all** — grepping `src/` for `userId|deviceId|installId` returns nothing, and
`meta.name` is a display string stored in the same blob as `method` and `created`. It
identifies nothing and is copied into backup files. Auth is therefore the gate on the whole
sync effort, not a detail inside it.

#### Correction on record: the "one login per device" assumption

An earlier draft of this section argued that login frequency barely matters, because the app
is only authenticated once per device and then persists. **That assumption was wrong**, and
two things invalidate it:

1. **The phone is in your hand while you work out.** That is the app's entire premise. The
   original argument leaned on a "phone in a locker, email on another device" scenario that
   does not describe how the app is used, and it assumed email is not continuously reachable,
   which is not true of a phone.
2. **The app may run on shared devices.** This was not considered at all, and it is the more
   important correction. For a shared device the question is not "how often does someone log
   in" but **"should a session persist at all."** A long authenticated window on a device
   other people touch is a security problem, and under sync it is also a *data integrity*
   problem: a session logged on a shared device merges into the account owner's history, and
   "whose session is this" becomes a question the data model does not currently answer.

**What this changes.** Frequent re-auth is only tolerable if re-auth is frictionless, which is
an argument *for* a short code over a link — the user types six digits in the app they are
already holding, rather than switching to a mail client. It also promotes session lifetime
from a detail to a first-class requirement, and one a provider's cheapest tier may not let
you set.

#### Vercel's own auth product is a dead end

Vercel ships "Sign in with Vercel," but it requires that **users have a Vercel account** —
it's an OAuth provider for your app, not a general-purpose auth backend. Asking people to
sign up for Vercel to track their squats is a non-starter. (Two related names to not confuse
it with: "Vercel Authentication" means Deployment Protection, and Vercel Passport is
enterprise SSO. Neither is end-user login.)

⚠️ **Also relevant later:** there is **no first-party Vercel database anymore.** Vercel
Postgres and Vercel KV were both retired 2025-05-31, auto-migrated to Neon and Upstash.
Storage is now third-party via Vercel Marketplace. Worth knowing before the sync section
picks a place to put data.

#### Direction: magic link or magic code, not password

The reasoning is mobile-first — the app is used at the gym, one-handed, between sets. A
password is the worst-fit option on that surface, and hand-rolled password auth is where the
real cost lives anyway: hashing, reset tokens, email verification, breach-password checks, and
a permanent support surface. A magic code eliminates password reset and breach handling
outright.

**Between link and code, a short expiring code is safer.** A magic *link* is a bearer
credential sitting in a mailbox, in browser history, and in server logs. A short code that
expires is strictly better, and it also happens to be the lower-friction option on mobile.

**Requirements this carries, whatever provider is picked:**

- **Session lifetime must be configurable, and short by default.** This is the one that
  actually disqualifies options, given the shared-device point above. A vendor's cheapest
  tier with a non-adjustable multi-day session is a liability, not a default.
- **Email deliverability becomes your problem.** Shared free SMTP tiers land in spam for
  consumer addresses aggressively. With frequent logins this is a recurring failure, not a
  rare one — budget for a proper sending domain, or you'll debug deliverability instead of the
  app.
- **Rate-limit the send endpoint** regardless of provider, or the app becomes an email-bomb
  relay.
- **Account recovery has no fallback.** If the inbox is lost, the account is gone, and with it
  the key to a month of real training data. Plan recovery *before* this ships.
- **Keep IndexedDB as the source of truth.** The server is a sync and backup target, not an
  authority. An auth or email outage then degrades to "no backup today" rather than "app is
  unusable."

#### Open questions

1. **Session lifetime on shared devices.** How long may a session live on a device that may
   not be yours? Is there a "this is a shared device" mode that skips persistence?
2. **Device pairing as an auth path.** If the requirement is genuinely two devices the user
   controls, pairing may be the *whole* feature — no email provider, no deliverability, no
   password surface. What is given up: logging in from a device that isn't already paired, and
   recovery if both are lost. Given the data at stake, that recovery path is worth more than
   it looks.
3. **Does `meta` become user-scoped?** `barbellWeight` and the plates inventory are *your*
   setup, not a device's. If two devices disagree about your barbell weight, that is a real
   conflict, not a detail. Needs a decision before the schema moves.
4. **What does `deleteAllData` mean once there is an account?** "Delete my data" is currently
   one browser. Under an account it must distinguish *this device* from *everywhere* — and
   guessing wrong wipes a month across devices. Resolve before any sync code exists. This is
   the same hardening item as in the Drive section, sharpened.

#### Sequencing

Auth is not step one for the project — the local-first protections still come first, because
they help today with no architecture. But *within* the sync effort, auth gates everything:
local durability first (no backend), then `Session.id`, then the provider decision, then auth
+ sync. **Vendor selection and pricing deliberately not recorded here** — that's a later
exercise, and a provider table in a roadmap goes stale within a quarter.
