## Summary

Added test coverage for all 5 previously untested components/contexts. All 16 test files pass (109 tests total), build succeeds, and lint shows no new issues.

## Files Created

1. **`src/test/BackupReminderBanner.test.tsx`** — 6 tests covering:
   - Renders null when reminder is not active
   - Renders banner with session count message
   - Renders days-since-backup message
   - Renders singular day message
   - Calls onExport and recordBackup on Export click
   - Calls dismissReminder on "Remind me later" click

2. **`src/test/Layout.test.tsx`** — 6 tests covering:
   - Renders navigation links (Sessions, Exercises, Workouts, Settings)
   - Renders main content area
   - Renders bottom tab bar
   - Renders logo image
   - Shows backup reminder badge on Settings when active
   - Hides backup reminder badge when inactive

3. **`src/test/BodyMusclesChart.test.tsx`** — 4 tests covering:
   - Renders chart containers (front and back views)
   - Renders "Anterior (Front)" and "Posterior (Back)" labels
   - Renders with no muscles provided
   - Renders with muscles provided

4. **`src/test/ErrorBoundary.test.tsx`** — 3 tests covering:
   - Renders children when no error occurs
   - Renders error UI when a child throws
   - "Reload App" button triggers page reload

5. **`src/test/BackupContext.test.tsx`** — 10 tests covering:
   - Throws error when useBackup is used outside BackupProvider
   - Initializes with default meta when no stored data
   - Loads stored meta on mount
   - shouldShowReminder is false when sessionsSinceBackup is 0
   - shouldShowReminder is true when sessionsSinceBackup >= 10
   - shouldShowReminder is true when lastBackupDate is over 14 days ago
   - shouldShowReminder is true when no lastBackupDate and sessionsSinceBackup > 0
   - incrementBackupCounter increments the counter
   - recordBackup sets lastBackupDate and resets counter
   - resetBackupMeta clears the meta and deletes store

## Verification

- `npm test` — 16 test files passed (109 tests)
- `npm run build` — built successfully
- `npm run lint` — no new issues introduced
