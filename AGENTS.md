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

This project uses a kanban board with a `code-reviewer` profile for pre-PR review, using the same-card review lifecycle from the Hermes Kanban tutorial (Story 3: Role pipeline with retry). The flow uses the first-class review tools: `kanban_request_review`, `kanban_request_changes`, and `kanban_complete`.

### What the developer does

1. Implement the change, run `npm run build` and `npm run test` locally, push the branch to remote.
2. Call `kanban_request_review` with a summary and metadata (changed_files, tests_run).
   → The card enters `review` status; the implementation run closes with outcome `review_requested`.
3. If the reviewer requests changes, apply them, re-run tests, push updates, and call `kanban_request_review` again, incrementing `review_iteration` in the metadata.

### What the reviewer does

1. Pick up the card from `review` status.
2. Inspect the code on the pushed branch.
3. If changes are needed, call `kanban_request_changes` with a concrete reason.
   → The review run closes as outcome `changes_requested`; the card returns to the developer.
4. If approved, **do NOT call `kanban_complete`**. Instead:
   - Leave a comment: "APPROVED — developer, please open the PR and mark this task done."
   - The card stays in `review` status.
   → The developer will open the PR and mark the task done. If you call `kanban_complete` before the PR is open, the task transitions to `done` and the PR URL won't be recorded.

### Who opens the PR

The developer opens the PR after the reviewer approves. Once the PR is open, record the URL in `metadata.published_pr` via `kanban_attach_url`.

### Review cycles

- Expect 1–3 cycles for typical changes. More than 3 without convergence is a signal to escalate.
- Each cycle is recorded in the run history: `review_requested → changes_requested → review_requested → completed`.
- `kanban_block` is for real external escalation (missing access, product decision), not normal review feedback.

### What the developer should NOT do

- Do not open a PR before review. The PR is the final step, not the handoff.
- Do not mark the kanban task `done` before the reviewer approves.
- Do not push to `main` — always push to the feature branch.

### Reviewer expectations

- Review the actual code, not just whether build/tests pass.
- Leave specific, actionable feedback — file name, what, why.
- Distinguish blocking issues (must fix before PR) from suggestions (nice to have).
- When approving, **leave an "APPROVED" comment but do NOT call `kanban_complete`.** Silence is not approval; a comment without `kanban_complete` is the approval signal.
- After leaving the APPROVED comment, the card stays in `review`. The developer will open the PR and mark the task done.

## Local development

- Copy `.env.example` to `.env` if needed (currently no env vars required).
- First run: `npm install` then `npm run dev`.
- Data is stored in the browser's IndexedDB — clearing browser data resets the app.
