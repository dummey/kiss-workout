# kiss-workout

React 19 + TypeScript 7 SPA. Vite build, Vitest test, oxlint lint. Data in IndexedDB via `idb-keyval`; no backend. Functional components + hooks only.

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

## Code review workflow

This project uses a kanban board with a `code-reviewer` profile for pre-PR review. The flow is:

1. **Developer finishes code** — implements the change, runs `npm run build` and `npm run test` locally, pushes the branch to remote.
2. **Developer marks the kanban task `review`** — not `done`. No PR is opened yet.
3. **Code reviewer picks up the task** — the dispatcher auto-routes `review` tasks to `code-reviewer` (review_dispatch is enabled on this board). Reviewer reads the code on the pushed branch.
4. **Reviewer leaves feedback** — comments on the kanban task with specific findings: file names, what to change, why. Each finding is individual, not a lump sum.
5. **If changes are needed** — reviewer states clearly what would satisfy the review. Developer addresses feedback, pushes updates, marks the task `review` again.
6. **If approved** — reviewer comments "approved" or "LGTM, ready to PR." Developer then opens the PR against `main` and marks the task `done`.

### Review cycles

- Expect 1-3 review cycles for typical changes. More than 3 without convergence is a signal to escalate.
- Each cycle's feedback and fixes are recorded in the kanban task's comment thread — that's the review log.
- Reviewer does NOT open the PR. Developer opens the PR only after approval.

### What the developer should NOT do

- Do not open a PR before review. The PR is the final step, not the handoff.
- Do not mark the kanban task `done` until the reviewer has approved and the PR is open.
- Do not push to `main` — always push to the feature branch.

### Reviewer expectations

- Review the actual code, not just whether build/tests pass.
- Leave specific, actionable feedback — file name, what, why.
- Distinguish blocking issues (must fix before PR) from suggestions (nice to have).
- When approving, say so explicitly. Silence is not approval.

## Local development

- Copy `.env.example` to `.env` if needed (currently no env vars required).
- First run: `npm install` then `npm run dev`.
- Data is stored in the browser's IndexedDB — clearing browser data resets the app.
