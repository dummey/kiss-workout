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

backup-meta (separate IndexedDB store)
├── lastBackupDate: string | null (ISO date)
├── sessionsSinceBackup: number
```

### Key Design Decisions

- **Decoupled exercises from workouts**: A single exercise (e.g., "Barbell Bench") can appear in multiple workout days
- **Sessions reference exercise IDs**: Preserves full exercise metadata at time of logging
- **Flat exercise library**: Exercises are managed independently of their assignment to workouts
- **Progression tracking by exercise ID**: Survives exercise renames (history doesn't break)
- **Backup metadata tracked separately**: `backup-meta` store tracks last backup date and session count for reminder system

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
| Pagination | 12/24/48 page sizes with Prev/Next and "X–Y of Z" count |
| Notes preview | Single-line truncated notes on session cards |
| Training heatmap | GitHub-style 365-day activity calendar |
| Session stats | Total hours, volume, avg duration, current streak |
| Import session | Upload JSON to import a single session (with duplicate-date handling) |
| Backup reminder banner | Dismissible banner when backup is overdue (≥10 sessions or ≥14 days) |

### Session Detail Page (`/sessions/:date`)

| Feature | Description |
|---------|-------------|
| Header | Date, workout name, exercise count, delete button, export button |
| Export session | Download session as `session-{date}.json` |
| Workout timer | Auto-starting H:MM:SS timer with pause/resume/reset (hours shown after 60 min) |
| Timer persistence | Saves elapsed time every 5 seconds; final save on unmount; restores on page load |
| Notes | Auto-saving textarea (500ms debounce) |
| Exercise cards | Grouped by tier (T1/T2/T3/Other) |
| Inline editing | Weight/Reps/Sets inputs per exercise |
| Sets stepper | Plus button inset inside the Sets input for quick increment |
| Progression guidance | GZCL-based suggestions via `ProgressionInfo` component |
| Previous performance | Shows last logged values per exercise (matched by ID, returns most recent) |
| Delete | Available only at detail level |

### Exercises Page (`/exercises`)

| Feature | Description |
|---------|-------------|
| Exercise list | All exercises in library |
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
| Tier grouping | Exercises grouped by T1/T2/T3/Other |
| Muscle visualization | Interactive body map using `body-muscles` library |
| Filter by exercise | Click "Show Muscles" to highlight only that exercise's muscles |
| Dual view | Front and posterior body maps side-by-side |
| Add exercise modal | Pick from exercises not already in workout |

### Settings Page (`/settings`)

| Feature | Description |
|---------|-------------|
| App statistics | Count of exercises, workouts, sessions + backup status (days since last backup, sessions since backup) |
| Export data | Download all IndexedDB data as JSON backup |
| Import data | Upload JSON file to replace all data (validated before storing) |
| Delete All Data | Permanently clears all data and resets to defaults, including backup metadata (with confirmation) |
| Load Seed Data | Replaces current data with test seed data (50 sessions, 27 exercises, 4 workouts) |

### Sidebar

| Feature | Description |
|---------|-------------|
| Navigation | Sessions, Exercises, Workouts, Settings links |
| Backup indicator | Red dot on Settings nav link when backup reminder is active |

---

## GZCL Progression Logic

| Tier | Guidance |
|------|----------|
| T1 | Start at 3 reps. If AMRAP set hits target+ reps, suggest adding weight next session |
| T2 | Target 8-10 reps @ 65-85% of T1. Add weight when hitting 10 reps |
| T3 | Target 10-15+ reps @ ≤65%. Add weight when hitting 15 reps |

### Progression Display Logic

- **Previous performance**: Returns the most recent session for the same exercise (by ID), not the personal best
- **Survives renames**: Exercise ID matching ensures progression history persists if user renames an exercise
- **Deload-aware**: Most recent session data is shown, so post-deload weights correctly appear as the baseline

---

## Backup Reminder System

### Triggers

The reminder activates when ANY of the following are true:
- ≥10 sessions logged without a backup
- ≥14 days since last backup
- No backup ever created and at least 1 session exists

### UI Elements

- **Banner**: Dismissible banner on Sessions page with message ("It's been X days since your last backup" or "You have X sessions without a backup"), Export button, and "Remind me later" button
- **Nav indicator**: Red dot on Settings nav link when reminder is active

### Data Flow

- `incrementBackupCounter()` called after each `addSession()`
- `recordBackup()` called after successful export (resets date and counter)
- `dismissReminder()` resets session counter but preserves lastBackupDate (time-based trigger still works)
- `deleteAllData()` clears `backup-meta` alongside tracker data

---

## Technical Architecture

### Stack

- **Framework**: React 19+ with TypeScript
- **Build tool**: Vite
- **Routing**: react-router-dom v7
- **Storage**: IndexedDB (via custom `db.ts` wrapper) — two stores: `tracker` and `backup-meta`
- **Body visualization**: `body-muscles` npm package
- **Testing**: Vitest + @testing-library/react

### Project Structure

```
src/
├── components/
│   ├── BodyMusclesChart.tsx    # Wrapper for body-muscles library
│   ├── BackupReminderBanner.tsx # Dismissible backup reminder banner
│   ├── Button.tsx              # Shared button (variants: primary/success, sizes: sm, danger)
│   ├── CalendarHeatmap.tsx     # 365-day training activity heatmap
│   ├── Layout.tsx              # Sidebar nav with backup indicator
│   ├── Modal.tsx               # Reusable modal (title, message, input, actions)
│   ├── ModalProvider.tsx       # Context provider with promise-based showModal()
│   ├── ProgressionInfo.tsx     # Last time + next progression step display
│   └── SessionStats.tsx        # Session statistics (hours, volume, avg, streak)
├── hooks/
│   └── useBackupReminder.ts    # Backup metadata management and reminder logic
├── pages/
│   ├── SessionsPage.tsx        # Session list, search, sort toggle, pagination, heatmap, stats, backup banner
│   ├── SessionDetailPage.tsx   # Logging, timer, notes, exercise cards, export
│   ├── ExercisesPage.tsx       # Exercise library CRUD
│   ├── SettingsPage.tsx        # Stats, import/export, delete-all, load-seed, backup status
│   └── WorkoutsPage.tsx        # Workout organization, clone, muscle map
├── context.tsx                  # Global state + IndexedDB operations
├── db.ts                        # IndexedDB low-level API
├── data.ts                      # Seed data (50 sessions, 27 exercises, 4 workouts)
├── types.ts                     # TypeScript interfaces for all entities
├── App.tsx                      # Router setup
├── main.tsx                     # Entry point
└── index.css                    # Global styles + CSS variables

test/                            # Test setup
├── setup.ts                     # fake-indexeddb + jest-dom
├── logic.test.ts                # Date compare, GZCL progression, ID generation, sets parsing
├── Button.test.tsx              # Button variants, sizes, danger state
├── CalendarHeatmap.test.tsx     # Heatmap rendering, intensity calculation
├── Modal.test.tsx               # Modal open/close, actions, input, variants
├── ProgressionInfo.test.tsx     # ProgressionInfo rendering, null states, CSS classes
├── session-workflow.test.tsx    # Integration: create session, log data, save notes, timer labels
└── SettingsPage.test.tsx        # Stats rendering, load seed, delete confirmation modal
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
- 365-day GitHub-style activity calendar grouped by week columns
- Intensity levels: 0 (no session) to 4 (all exercises logged)
- Hover tooltip shows date, workout name, exercises logged, elapsed time

**SessionStats** (`src/components/SessionStats.tsx`)
- Computes: total hours, total volume (weight × reps × sets), avg duration, current streak
- Skips non-numeric weights ("BW", "Heavy", "30s", "40yd")
- Streak: consecutive weeks with ≥1 session counting backward from current week

**ProgressionInfo** (`src/components/ProgressionInfo.tsx`)
- Displays "Last time" values and GZCL-based next progression step
- Extracted from SessionDetailPage for reusability

**BackupReminderBanner** (`src/components/BackupReminderBanner.tsx`)
- Dismissible banner with dynamic message (days-since-backup or sessions-without-backup)
- Export button triggers download and updates backup metadata
- "Remind me later" resets session counter (time-based trigger still works)

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

### Managing Exercises

1. Go to Exercises page
2. Use search to find exercises
3. Add new or edit existing
4. Assign to workouts during creation/editing

### Managing Workouts

1. Go to Workouts page
2. Select or create workout tab
3. Add/remove exercises
4. View muscle map to check coverage
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
5. Click "Remind me later" to dismiss (resets session counter, time-based trigger still works)

---

## Test Data

50 seed sessions spanning July 13 – October 18, 2026:

| Workout Type | Sessions |
|--------------|----------|
| Squat Workout | 17 |
| Bench Workout | 17 |
| Deadlift Workout | 16 |

**T1 Progression (realistic GZCL):**
- Squat: 225×3 → 235×5 (added weight at rep milestones)
- Bench: 185×3 → 190×5 (5lb jumps, rep progression)
- Deadlift: 315×3 → 325×6 (10lb jumps, rep progression)

**Other realistic touches:**
- Deload weeks every ~4th week (reduced volume, "focusing on recovery" notes)
- Varied rest days between sessions (1-3 days)
- Realistic notes ("Knees felt tight", "Shoulder tweaked", "New PR!", etc.)
- Elapsed times vary 45-90 minutes
- T2/T3 accessories progress independently
- ~61 incomplete exercises across sessions (T1: 2% skip, T2: 10% skip, T3: 20% skip)

Includes 27 exercises across 3 T1/T2/T3 tiers and realistic GZCL setup notes.

---

## Testing

**57 tests across 7 files:**

| Test File | Count | Coverage |
|-----------|-------|----------|
| `logic.test.ts` | 18 | Date compare, GZCL progression, ID generation, duplicate-date guard, sets parsing (including NaN guard) |
| `Button.test.tsx` | 8 | Variants, sizes, danger state, className merging, disabled, onClick |
| `CalendarHeatmap.test.tsx` | 9 | Heatmap rendering, intensity calculation, tooltip data |
| `Modal.test.tsx` | 8 | Open/close, actions, input, variants, onClose |
| `ProgressionInfo.test.tsx` | 4 | Null data, normal data, missing data, CSS classes |
| `session-workflow.test.tsx` | 5 | Create session, persist to IndexedDB, log exercise data, save notes, timer labels (Start/Resume) |
| `SettingsPage.test.tsx` | 7 | Stats rendering, load seed, delete confirmation modal, cancel flows |

Run: `npm test` (single run) or `npm run test:watch` (watch mode)

---

## Future Considerations

- Mobile-responsive layout improvements
- Full volume & intensity dashboard (SessionStats is a start)
- Plate calculator
- Rest timer between sets
- PR tracking and display
- Dark/light theme toggle
- 1RM estimator (Epley/Brzycki)
- Deload recommender
- Session comparison
- Body weight log
- CSV export
