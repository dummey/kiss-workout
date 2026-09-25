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

| Tier | Guidance |
|------|----------|
| T1 | Add 5lbs (bench) or 10lbs (squat and deadlift). If fail, 5x3 > 6x2 > 10x1 > restart at 85% of 1rep. |
| T2 | Add weight. If fail, 3x10 > 3x8 > 3x6 > restart, +5-10lbs from last 3x10. |
| T3 | Increase reps to 15+ at ≤65%. If fail, restart from the bottom of the range. |

Rest periods are tier-aware: **T1 240s, T2 150s, T3 75s**.

### Progression Display Logic

- **Previous performance**: Returns the most recent session *strictly before* the current date for the same exercise. Returns an array (`PreviousPerformance[]`) so the component can be extended without a signature change.
- **Matches `originalId`**: A record logged under a since-deleted exercise still resolves.
- **Skips empty records**: A row with no weight, no reps, and not failed is not a performance.
- **Survives renames**: Exercise ID matching ensures progression history persists if the user renames an exercise
- **Deload-aware**: Most recent session data is shown, so post-deload weights correctly appear as the baseline
- **Guidance is currently static per tier.** The rep-milestone branches in `getNextProgression()` are commented out, so the displayed advice does not yet adapt to the actual previous set. Wiring those back up is a candidate, not current behavior.

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
- Plate calculator
- PR tracking and display
- Dark/light theme toggle
- 1RM estimator (Epley/Brzycki)
- Deload recommender
- Session comparison
- Body weight log
- CSV export
- Re-enable the rep-milestone branches in `getNextProgression()` so guidance adapts to the actual previous set
- Extract the Session Detail workout timer and rest timer into a reusable `Timer` component
