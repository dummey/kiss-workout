## Fix Applied

Replaced the raw `<label className="btn">` with the shared `Button` component, using the existing `fileInputRef` to trigger the file input click programmatically.

**Change:** `src/pages/SessionsPage.tsx:174-176`

```diff
- <label htmlFor="import-session-input" className="btn" style={{ cursor: pointer }}>
+ <Button onClick={() => fileInputRef.current?.click()}>
    Import Session
- </label>
+ </Button>
```

**Why this approach:** The `fileInputRef` was already wired to the hidden `<input type="file">`, so the `Button` simply calls `fileInputRef.current?.click()` to open the file picker. This keeps the existing file-handling logic intact while using the shared component for consistent styling and accessibility (proper `<button>` element, focus states, keyboard interaction).

**Verification:**
- `npm run build` — passes
- `npm run test` — 80/80 tests pass
- `npm run lint` — no new warnings
