## Summary

Remove the duplicate T1 guard from `removeExerciseFromSession` in `src/context.tsx`. The guard preventing removal of the last T1 exercise was duplicated between the context and the UI. The UI is the only caller and needs the guard result before deciding which modal to show, so the guard belongs in the UI. Removing it from the context keeps it as a clean data operation.

## Changes

- `src/context.tsx`: Removed the T1 guard (7 lines) from `removeExerciseFromSession`

## Testing

- `npm run test` — all tests pass
- `npm run lint` — no errors
- `npm run build` — builds successfully

Closes DATA-104
