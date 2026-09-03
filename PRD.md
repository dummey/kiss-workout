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

---

## Pages & Features

### Sessions Page (`/sessions`)

| Feature | Description |
|---------|-------------|
| Session list | Grid of session cards sorted newest-first |
| Search | Filter by date, workout name, or notes |
| Session count | Shows "X sessions logged" with filtered count |
| Duration display | Shows elapsed time if recorded (e.g., "45m 30s") |
| Add session | Modal to pick date and workout type |
| Navigation | Click card to view session detail |

### Session Detail Page (`/sessions/:date`)

| Feature | Description |
|---------|-------------|
| Header | Date, workout name, exercise count, delete button |
| Workout timer | Auto-starting MM:SS timer with pause/resume/reset |
| Timer persistence | Saves elapsed time every second; restores on page load |
| Notes | Auto-saving textarea (500ms debounce) |
| Exercise cards | Grouped by tier (T1/T2/T3/Other) |
| Inline editing | Weight/Reps/Sets inputs per exercise |
| Progression guidance | GZCL-based suggestions ("Try X x Y+1 or add weight") |
| Previous performance | Shows last logged values per exercise |
| Delete | Available only at detail level |

### Exercises Page (`/exercises`)

| Feature | Description |
|---------|-------------|
| Exercise list | All exercises in library |
| Search | Filter by name, muscle, tier, or setup |
| Add exercise | Modal with name, muscles (comma-sep), setup, superset, tier |
| Edit exercise | Inline edit with same fields as add |
| Delete exercise | Removes from library and all workouts |
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

### Sidebar

| Feature | Description |
|---------|-------------|
| Navigation | Sessions, Exercises, Workouts links |
| Export data | Download all IndexedDB data as JSON |
| Import data | Upload JSON file to replace all data |

---

## GZCL Progression Logic

| Tier | Guidance |
|------|----------|
| T1 | Start at 3 reps. If AMRAP set hits target+ reps, suggest adding weight next session |
| T2 | Target 8-10 reps @ 65-85% of T1. Add weight when hitting 10 reps |
| T3 | Target 10-15+ reps @ ≤65%. Add weight when hitting 15 reps |

---

## Technical Architecture

### Stack

- **Framework**: React 18+
- **Build tool**: Vite
- **Routing**: react-router-dom v6
- **Storage**: IndexedDB (via custom `db.js` wrapper)
- **Body visualization**: `body-muscles` npm package

### Project Structure

```
src/
├── components/
│   ├── BodyMusclesChart.jsx   # Wrapper for body-muscles library
│   └── Layout.jsx             # Sidebar nav + export/import buttons
├── pages/
│   ├── SessionsPage.jsx       # Session list + search
│   ├── SessionDetailPage.jsx  # Logging, timer, notes
│   ├── ExercisesPage.jsx      # Exercise library CRUD
│   └── WorkoutsPage.jsx       # Workout organization
├── context.jsx                # Global state + IndexedDB operations
├── db.js                      # IndexedDB low-level API
├── data.js                    # Seed data
├── App.jsx                    # Router setup
├── main.jsx                   # Entry point
└── index.css                  # Global styles + CSS variables
```

### Key CSS Variables

```css
--bg: #0f1115
--surface: #181b22
--surface2: #1f232c
--border: #2a2f3a
--text: #e6e8ec
--muted: #8a90a0
--accent: #6c8cff
--t1: #ff6b6b
--t2: #f5b042
--t3: #4ecb71
```

---

## User Flows

### Starting a Workout

1. Navigate to Sessions page
2. Click "+ Add Session"
3. Select date and workout type
4. Optionally start timer
5. Log weight/reps/sets per exercise
6. Add notes
7. Navigate away — all data auto-saved

### Tracking Progression

1. Open existing or create new session
2. View "Last time" guidance under each exercise
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

---

## Future Considerations

- Mobile-responsive layout improvements
- Workout templates / duplication
- Rest timer between sets
- Session history / trends per exercise
- PR tracking and display
- Calendar view for session history
- Dark/light theme toggle
