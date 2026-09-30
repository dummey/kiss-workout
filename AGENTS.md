# kiss-workout

React 19 + TypeScript 7 SPA. Vite build, Vitest test, oxlint lint. Data in IndexedDB via a hand-rolled `IDBDatabase` wrapper (`src/db.ts`, raw API — no `idb-keyval`); no backend. Functional components + hooks only.

Deployed to Vercel as a static site (`vercel.json`). There is no `api/` directory and no server-side code.

## Commands

```bash
npm run dev        # Vite dev server
npm run build      # Production build — NOT a typecheck (see below)
npm run test       # Vitest single pass
npm run test:watch # Vitest watch mode
npm run lint       # oxlint
npm run preview    # Preview production build
```

Build and test both run from the project root. Tests are in `src/test/` and colocated `*.test.ts(x)` files.

### `npm run build` does not typecheck

There is **no `tsc` step anywhere in the scripts**. Verified empirically: a deliberate
`const x: number = "string"` in `src/utils.ts` still produced `✓ built in 113ms` and a
successful bundle. Vite transpiles via esbuild, which strips types without checking them.

**So a green build does not mean the code typechecks.** Before opening a PR that changes
types, run it explicitly:

```bash
npx tsc --noEmit
```

Report that separately from the build. A claim of "build passes" is not a claim that
TypeScript is satisfied.

**Baseline on `main`: 25 test files, 247 tests, all passing** (verified by running the suite with worktrees excluded — see the `.worktrees` note below).

### Known trap: `npm run test` globs `.worktrees/`

`vite.config.ts` sets no `test.include`, so Vitest walks the whole project tree — including
every `.worktrees/*` checkout, each of which has its own copy of `src/`. If worktrees exist,
`npm run test` runs those too and the counts balloon (you will see ~177 files / ~1737 tests
instead of 25 / 247). Failures reported from a path containing `/.worktrees/` belong to a
different branch, not to `main`.

To test only the real tree:

```bash
npx vitest run --exclude '**/.worktrees/**' --exclude '**/node_modules/**'
```

Note that `.worktrees/` is **not** in `.gitignore` and shows as untracked in `git status`.
Add it if it is ever at risk of being committed.

## Testing conventions

- Assert **wiring, not pixels.** The realistic regression in this app is a value routed to
  the wrong state key or handler, or a value silently lost on snapshot. That is testable.
- Do **not** write hex-colour assertions, computed-style assertions, total-element-count
  assertions, or full-component snapshots. They churn on unrelated changes and do not catch
  real regressions.
- This repo has **no CI and no visual-regression testing.** `npm run build` and
  `npm run test` passing prove nothing about whether a change *looks* right. Visual checks
  are manual and must be called out as outstanding rather than implied covered.
- `fake-indexeddb` backs the storage tests via `src/test/setup.ts`.

## Conventions

```
src/
  components/     UI components — BackupReminderBanner, BodyMusclesChart, Button,
                  CalendarHeatmap, ErrorBoundary, Layout, Modal, ModalProvider,
                  ProgressionInfo, SessionStats
  context/        Context providers — BackupContext.tsx
  context.tsx     TrackerContext — session/exercise/workout state + actions
  constants.ts    Shared display maps (e.g. EQUIPMENT_LABELS) — single source of
                  truth so a label cannot drift between the two places it renders
  data.ts         Seed data
  db.ts           IndexedDB wrapper — openDB, getStore, setStore, deleteStore
  hooks/          usePagination.ts
  pages/          Route pages — ExerciseDetailPage, ExercisesPage,
                  SessionDetailPage, SessionsPage, SettingsPage, WorkoutsPage
  types.ts        All shared types (Session, Exercise, Workout, TrackerContextValue, etc.)
  utils/plates.ts Barbell plate calculator (pure logic, heavily commented)
  validation.ts   Runtime validation for imported JSON (sessions + full backups)
  test/           Test files + setup.ts (26 files incl. setup)
App.tsx           Router + layout wrapper
main.tsx          Entry point — wraps app in ModalProvider + Router
```

Key files:
- `src/context.tsx` — the heart of the app; contains TrackerContext, reducer, all session actions
- `src/types.ts` — all types in one place; import from here, not inline
- `src/db.ts` — IndexedDB wrapper. One object store named `data` (DB `gzcl-tracker-v2`, version 1) holding two keys: `tracker` and `backup-meta`. It is **not** two stores.
- `src/data.ts` — initial/seed exercise data
- `src/validation.ts` — gates every import path. Optional fields follow one rule: **absent is valid, present-but-wrong-typed is not.** New persisted fields must be added here or they will slip past import validation unvalidated.

## Storage model

```
data store
├── key "tracker"      → TrackerData { meta, exercises[], workouts[], sessions[] }
└── key "backup-meta"  → BackupMeta { lastBackupDate, sessionsSinceBackup, dismissedAt }
```

`backup-meta` is a separate key so it survives `deleteAllData()`, which clears the `tracker` key. It is cleared explicitly by `resetBackupMeta()`.

Session records **snapshot** their exercise's definition at log time (name, muscles, setup, tier, superset, equipment), so editing or deleting a library exercise later does not rewrite history. `originalId` preserves the link to a since-deleted exercise.

## Conventions

- **TypeScript strict mode** — no `any` without a comment explaining why.
- **One component per file** (except small pure helpers).
- **Test files**: `*.test.ts(x)` colocated with source or in `src/test/`.
- **Imports**: Relative imports. There is **no** Vite resolve alias configured — if a doc or
  an old comment claims otherwise, it is wrong.
- **No commented-out code** — delete it or gate behind a feature flag.

## PR guidelines

- Title format: `<type>(scope): <description>` — e.g. `feat(session): add reset button`
- Types: `feat`, `fix`, `chore`, `test`, `refactor`, `docs`
- PRs target `main`.
- Description should include: what changed, why, how to test, any breaking changes.
- **No AI-tool attribution footers** (e.g. "🤖 Generated with Claude Code", "Co-authored by Copilot") in PR descriptions or commit messages. Do not add one unless that tool actually produced the change. A description that names a tool which did not write the diff is a false statement and a reviewer cannot verify it from the code.
- Build must pass before merging. Tests must pass.

### Reviewer expectations

- Review the actual code, not just whether build/tests pass.
- Leave specific, actionable feedback — file name, what, why.
- Distinguish blocking issues (must fix before PR) from suggestions (nice to have).

## Local development

- No env vars are required today, and there is no `.env.example` — if you add one, document it here.
- First run: `npm install` then `npm run dev`.
- Data is stored in the browser's IndexedDB — clearing browser data resets the app.
