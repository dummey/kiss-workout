# kiss-workout

React 19 + TypeScript 5 SPA. Vite build, Vitest test, oxlint lint. Data in IndexedDB via `idb-keyval`; no backend. Functional components + hooks only.

## Commands

```bash
npm run dev        # Vite dev server
npm run build      # Production build — fails on type errors
npm run test       # Vitest single pass
npm run test:watch # Vitest watch mode
npm run lint       # oxlint
npm run preview    # Preview production build
```

Build and test both run from the project root. Tests are in `src/test/` and colocated `*.test.ts(x)` files.

## Structure

```
src/
  components/     UI components — Button, Modal, ModalProvider, Layout, etc.
  context/        Context providers — BackupContext.tsx
  context.tsx     TrackerContext — session/exercise/workout state + actions
  hooks/          usePagination.ts
  pages/          Route pages — SessionsPage, SessionDetailPage, WorkoutsPage, SettingsPage, ExercisesPage
  types.ts        All shared types (Session, Exercise, Workout, TrackerContextValue, etc.)
  utils/          (empty — pure helpers go here)
  test/           Test files + setup.ts
App.tsx           Router + layout wrapper
main.tsx          Entry point — wraps app in ModalProvider + Router
```

Key files:
- `src/context.tsx` — the heart of the app; contains TrackerContext, reducer, all session actions
- `src/types.ts` — all types in one place; import from here, not inline
- `src/db.ts` — IndexedDB wrapper (openDB, stores)
- `src/data.ts` — initial/exercise data

## Conventions

- **TypeScript strict mode** — no `any` without a comment explaining why.
- **One component per file** (except small pure helpers).
- **Test files**: `*.test.ts(x)` colocated with source or in `src/test/`.
- **Imports**: Absolute from `src/` (Vite resolve alias configured).
- **No commented-out code** — delete it or gate behind a feature flag.

## PR guidelines

- Title format: `<type>(scope): <description>` — e.g. `feat(session): add reset button`
- Types: `feat`, `fix`, `chore`, `test`, `refactor`, `docs`
- PRs target `main`.
- Description should include: what changed, why, how to test, any breaking changes.
- Build must pass before merging. Tests must pass.

### Reviewer expectations

- Review the actual code, not just whether build/tests pass.
- Leave specific, actionable feedback — file name, what, why.
- Distinguish blocking issues (must fix before PR) from suggestions (nice to have).

## Local development

- Copy `.env.example` to `.env` if needed (currently no env vars required).
- First run: `npm install` then `npm run dev`.
- Data is stored in the browser's IndexedDB — clearing browser data resets the app.
