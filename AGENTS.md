# Kanban Orchestrator — Operational Rules

This file is auto-loaded when Hermes runs in this project directory. It contains operational rules for the kanban orchestrator profile that manages this project's board.

## Task Classification

When the orchestrator breaks a parent task into subtasks, classify each one:

| Classification | Meaning | PR Strategy |
|---|---|---|
| **Independent** | Can run and merge without any other subtask | Own PR against integration branch (or main if truly standalone) |
| **Gated** | Needs another subtask to be done first | Child task, gated on parent(s), runs after parents complete |
| **Integration** | Combines multiple subtasks | Parent task or dedicated integration subtask owns the final merge |

The PR graph should be flat (all independent subtasks merge into the integration branch in any order) or shallow (a few gated tasks). It should not be a deep chain.

## Git Workflow Rules

### Worktrees and Branches
- Each code-changing subtask gets its own worktree via `workspace: worktree:<path>`
- Each subtask gets its own branch: `feat/<task-id>-<short-description>`
- Branch names encode the task ID so you can always trace which worker did what
- Never have multiple workers push to the same branch — each worker gets single-owner branches

### PR Strategy (no long chains)
- **Independent subtasks** open PRs against a shared integration branch (e.g., `feat/<parent-slug>-integration`), not against `main`
- The integration branch accumulates changes as subtasks merge — subtasks merge in any order, no chain between them
- The **parent task** has one final PR from the integration branch to `main`
- **Gated subtasks** only open their PR after their parent(s) are `done` — the gating is at the task level, not the PR level
- If a subtask can stand alone and doesn't need other subtasks, its PR can target `main` directly

### Integration Branch Pattern
1. Create the integration branch when the parent task is created: `feat/<parent-slug>-integration` branching off `main`
2. All parallel subtasks branch off the integration branch, not off `main` and not off each other
3. Subtasks merge into the integration branch when their work is done and reviewed
4. The parent task's final step is one PR from integration → `main`
5. Rebase or merge `main` into the integration branch periodically to avoid drift

### Task-Level Gating (alternative to PR chains)
- If subtask B genuinely cannot proceed without subtask A's output, B is a **child task gated on A**, not a parallel subtask
- The dispatcher promotes B from `todo` to `ready` only when A is `done`
- B then runs and opens its PR — no PR-level dependency chain, just a task graph
- Use `kanban_link` to record the parent→child relationship
- **Never** link a support card as a child of the blocked parent it exists to unblock — reference the parent by ID in the body instead

### Commit Discipline
- Workers commit atomically per logical unit, not one giant commit at the end
- Workers push their branch to remote (if there's a remote)
- Workers do NOT merge other workers' branches — that's the orchestrator's job or a dedicated integration step

### Completion and PR URLs
- When a worker completes a task with a PR, the PR URL goes into `metadata.published_pr`
- The worker marks the task `done` with the PR URL
- The parent task's comment thread tracks all expected sub-PRs and updates as they merge

## Blocking and Escalation

### Detection
- **`blocked` tasks that sit too long** → read the block reason, decide: unblock, find missing dependency, or escalate
- **`ready` tasks that never get claimed** → check if the assignee profile exists, if `dispatch_profiles` restricts it, if the workspace is mountable
- **`running` tasks that go stale** (worker crashed, PID gone) → the dispatcher reclaims these; you read why and decide: retry, reassign, or escalate
- **After `failure_limit` consecutive spawn failures** → the dispatcher auto-blocks; read the reason and resolve

### Resolution Priority
1. Fix the structural issue (profile doesn't exist, workspace can't mount, branch conflict)
2. Reassign to a different profile if the current one can't do the work
3. Retry if it was a transient failure
4. Escalate to human if it's a judgment call or the fix is unclear

### What NOT to Retry
- Workspace mount failures (fix the workspace or change the task's workspace)
- Profile doesn't exist (create the profile or reassign)
- Branch conflicts that need human resolution (block and escalate)
- PR review rejections that need substantive changes (unblock the worker to make changes, don't just retry)

## Communication Rules

### Writing Comments
- Write comments that are useful to the **next** agent picking up the task, not just notes to yourself
- When a task is blocked, state clearly what's missing and what would unblock it
- When you create a support card for a blocked task, reference the parent by ID in the body — do NOT `kanban_link` it as a child of the blocked parent

### Task Bodies
- A well-formed task body lets a worker act without going back to the source
- Include: what to do, what not to touch (to avoid overlap), any constraints, expected output
- For code tasks: include the branch name, worktree path, target branch for the PR

### Parent Task Tracking
- The parent task's body or a comment should list expected sub-PRs and their status
- Update as subtasks complete: `[x] task-abc: PR #123`, `[ ] task-def: pending`
- When all sub-PRs are merged (or the integration PR is merged), the parent task moves to review/complete

## Mid-Run Discoveries

If a subtask discovers mid-run that it needs changes from another subtask that's still in progress:
1. Comment on the other task asking for the change (if still running) or on the parent task (if the other is done)
2. Block your task if you can't proceed, with a clear reason
3. When the other task updates, unblock and continue — update your branch if needed (rebase onto the updated integration branch)
4. Don't create new dependency chains — this is a re-block/unblock cycle, not a new link

## Integration Conflict Handling

When two subtasks edit overlapping files and conflict at integration time:
1. Detect the conflict (try to merge, see what conflicts)
2. Block the affected task(s) with a clear reason: "task-abc and task-def both modified `src/foo.ts` — needs resolution"
3. Either a human resolves, or you designate one worker (or a new subtask) to do the merge resolution
4. Don't auto-resolve conflicts — that's a good way to lose changes

## Worker Profile Registry

The orchestrator knows about these profiles and what they're for. Use them as assignees when tasks match their domain:

| Profile | Role | Use For |
|---|---|---|
| `workout-buddy` | General-purpose implementation agent | Coding tasks, feature implementation, bug fixes, tests |
| `code-reviewer` | Code review and audit | Reviewing PRs, auditing codebases, finding bugs and issues |
| `researcher` | Research and investigation | Research tasks, looking up information, analyzing data |
| `librarian` | Knowledge management | Organizing information, writing documentation, maintaining knowledge bases |
| `cat-herder` | Project coordination | Managing projects, coordinating work, tracking progress |

If a task needs a profile that doesn't exist yet, tell the human and ask whether to create it or reassign the task to an existing profile.

## Board Resolution

Board resolution order (highest precedence first):
1. Explicit `--board <slug>` on the CLI call
2. `HERMES_KANBAN_BOARD` env var (set by the dispatcher when spawning a worker)
3. `~/.hermes/kanban/current` — the slug persisted by `hermes kanban boards switch`
4. `default`

Be explicit about which board you're operating on. Don't assume.

## Kanban Config

- `kanban.dispatch_in_gateway: true` (default) — the dispatcher runs in the gateway; you coordinate above it
- `kanban.dispatch_profiles` — if set, restricts which profiles the dispatcher can claim; if unset, any profile can be claimed (be careful)
- `kanban.failure_limit` (default 2) — consecutive spawn failures before auto-block
- `kanban.review_dispatch: true` (default) — automatically dispatch review when a task hits `review` status
- `kanban.default_workdir` — board-level default working directory for new tasks

## Task Creation Template

When creating a code-changing subtask, use this structure:

```
Title: <clear, action-oriented title>

Body:
- What: <what to build/change>
- Scope: <what files/areas this touches>
- Out of scope: <what this task should NOT touch — to avoid overlap with siblings>
- Branch: feat/<task-id>-<short-description>
- Worktree: <path>
- Target PR: <integration branch or main>
- Dependencies: <none, or list of task IDs this is gated on>
- Expected output: <what done looks like — PR, tests passing, etc.>
```

## Completion Contract

A task isn't done when the worker says it's done. Verify:
- For PR tasks: the PR exists, CI passes (if applicable), the completion contract is met
- For non-PR tasks: the stated expected output is actually present
- A commit or diff alone doesn't auto-complete a task
- When in doubt, route to `review` status rather than marking `done`

### PR Completion Contracts

Declare PR work at task creation with `--completion-contract OWNER/REPO` (or an exact `https://github.com/OWNER/REPO/pull/123` URL for existing work). The `complete_task` boundary then enforces the contract at completion time: it reads branch protection and active ruleset required contexts, paginates exact-head check runs and legacy statuses, re-reads the PR head/base, and rejects completion if any **required** check is missing, pending, failed, cancelled, timed-out, stale, skipped, or neutral. A repository without required checks needs a `local-only` contract — local build and test verification is what completes the card.

For kiss-workout specifically: there are no CI workflows in the repo, so the contract is effectively `local-only`. The PR-verification subtask verifies locally (build passes, tests pass) and that's sufficient to complete. If branch protection or required CI checks are added to the repo later, the contract should be re-declared with `--completion-contract dummey/kiss-workout` and the worker will then enforce remote CI status at completion.

After publishing, pass `metadata.published_pr` to completion. The first matching URL binds the card permanently; retries cannot substitute a green sibling PR.

If a completion attempt fails the contract (e.g., CI is red, a required check is missing), the card is retained with the workspace intact. A durable `pr_acceptance` event records the PR URL, SHA, required contexts, check IDs/URLs, classifications, and recovery instructions; `last_failure_error` surfaces the next step. Fix the failure, rerun checks or wait for CI, then retry completion. Use `kanban_block` when human action is needed.

`gh` must be authenticated with read access to the repository's checks and rules for the contract to verify remotely. If `gh` isn't set up, the contract can't verify remotely and falls back to `local-only`.

"Local verification and publication alone are not remote acceptance." — local build + test green ≠ CI verified. For kiss-workout that's fine (no CI), but the distinction matters if CI is added later.
