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
│   ├── weight: string
│   ├── reps: string
│   ├── sets: number | null
```

### Key Design Decisions

- **Decoupled exercises from workouts**: A single exercise (e.g., "Barbell Bench") can appear in multiple workout days
- **Sessions reference exercise IDs**: Preserves full exercise metadata at time of logging
- **Flat exercise library**: Exercises are managed independently of their assignment to workouts
- **Progression tracking by exercise ID**: Survives exercise renames (history doesn't break)

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

### Session Detail Page (`/sessions/:date`)

| Feature | Description |
|---------|-------------|
| Header | Date, workout name, exercise count, delete button |
| Workout timer | Auto-starting H:MM:SS timer with pause/resume/reset (hours shown after 60 min) |
| Timer persistence | Saves elapsed time every 5 seconds; final save on unmount; restores on page load |
| Notes | Auto-saving textarea (500ms debounce) |
| Exercise cards | Grouped by tier (T1/T2/T3/Other) |
| Inline editing | Weight/Reps/Sets inputs per exercise |
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
| Exercise management | Add/remove exercises to/from workout |
| Tier grouping | Exercises grouped by T1/T2/T3/Other |
| Muscle visualization | Interactive body map using `body-muscles` library |
| Filter by exercise | Click "Show Muscles" to highlight only that exercise's muscles |
| Dual view | Front and posterior body maps side-by-side |
| Add exercise modal | Pick from exercises not already in workout |

### Settings Page (`/settings`)

| Feature | Description |
|---------|-------------|
| App statistics | Count of exercises, workouts, and sessions |
| Export data | Download all IndexedDB data as JSON backup |
| Import data | Upload JSON file to replace all data (validated before storing) |
| Delete All Data | Permanently clears all data and resets to defaults (with confirmation) |
| Load Seed Data | Replaces current data with test seed data (5 sessions, sample exercises) |

### Sidebar

| Feature | Description |
|---------|-------------|
| Navigation | Sessions, Exercises, Workouts, Settings links |

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

## Technical Architecture

### Stack

- **Framework**: React 19+ with TypeScript
- **Build tool**: Vite
- **Routing**: react-router-dom v7
- **Storage**: IndexedDB (via custom `db.ts` wrapper)
- **Body visualization**: `body-muscles` npm package
- **Testing**: Vitest + @testing-library/react

### Project Structure

```
src/
├── components/
│   ├── BodyMusclesChart.tsx    # Wrapper for body-muscles library
│   ├── Button.tsx              # Shared button (variants: primary/success, sizes: sm, danger)
│   ├── Layout.tsx              # Sidebar nav
│   └── ProgressionInfo.tsx     # Last time + next progression step display
├── pages/
│   ├── SessionsPage.tsx        # Session list, search, sort toggle
│   ├── SessionDetailPage.tsx   # Logging, timer, notes, exercise cards
│   ├── ExercisesPage.tsx       # Exercise library CRUD
│   ├── SettingsPage.tsx        # Stats, import/export, delete-all, load-seed
│   └── WorkoutsPage.tsx        # Workout organization
├── context.tsx                  # Global state + IndexedDB operations
├── db.ts                        # IndexedDB low-level API
├── data.ts                      # Seed data (5 sessions, 27 exercises, 4 workouts)
├── types.ts                     # TypeScript interfaces for all entities
├── App.tsx                      # Router setup
├── main.tsx                     # Entry point
└── index.css                    # Global styles + CSS variables

test/                            # Test setup
├── setup.ts                     # fake-indexeddb + jest-dom
├── logic.test.ts                # Date compare, GZCL progression, ID generation, sets parsing
├── Button.test.tsx              # Button variants, sizes, danger state
├── ProgressionInfo.test.tsx     # ProgressionInfo rendering, null states, CSS classes
└── session-workflow.test.tsx    # Integration: create session, log data, save notes, timer labels
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

### Data Backup and Restore

1. Go to Settings page
2. Click "Export" to download JSON backup
3. Click "Import" to restore from backup file (validated before storing)
4. Click "Delete All" to reset to defaults
5. Click "Load Seed" to populate test data

---

## Test Data

5 seed sessions spanning Aug 25 – Sep 3, 2026:
- Aug 25: Squat Workout (225x5 squat, etc.)
- Aug 27: Bench Workout (185x3 bench, etc.)
- Aug 29: Deadlift Workout (315x3 deadlift, etc.)
- Sep 1: Squat Workout (230x5 squat progression)
- Sep 3: Bench Workout (185x5 bench PR)

Includes 27 exercises across 3 T1/T2 tiers and realistic GZCL setup notes.

---

## Testing

**44 tests across 5 files:**

| Test File | Count | Coverage |
|-----------|-------|----------|
| `logic.test.ts` | 18 | Date compare, GZCL progression, ID generation, duplicate-date guard, sets parsing (including NaN guard) |
| `Button.test.tsx` | 8 | Variants, sizes, danger state, className merging, disabled, onClick |
| `ProgressionInfo.test.tsx` | 6 | Null data, normal data, missing data, CSS classes |
| `session-workflow.test.tsx` | 12 | Create session, persist to IndexedDB, log exercise data, save notes, timer labels (Start/Resume) |

Run: `npm test` (single run) or `npm run test:watch` (watch mode)

---

## Future Considerations

- Mobile-responsive layout improvements
- Volume & intensity dashboard
- Plate calculator
- Rest timer between sets
- PR tracking and display
- Calendar view / heatmap for session history
- Dark/light theme toggle
- Workout templates / duplication
- 1RM estimator (Epley/Brzycki)
- Deload recommender
