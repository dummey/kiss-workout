## Fix Summary

**Bug:** Direct navigation to `/exercises` (or page refresh) threw `TypeError: can't access property "exercises", data is null`.

**Root cause:** In `src/pages/ExercisesPage.tsx:18-27`, the `useMemo` hook used `data!.exercises` (non-null assertion). The `useMemo` callback runs **before** the `if (loading)` early return on line 30, so on initial render — when `data` is still `null` (the async `initDB()` hasn't completed) — accessing `.exercises` on `null` throws.

**Fix:** Replaced `data!.exercises` with `data?.exercises ?? []` (optional chaining + nullish coalescing). This mirrors the safe pattern already used in `SessionsPage.tsx:80-85`.

**Diff:**

```diff
   const filteredExercises = useMemo(() => {
-    if (!searchQuery.trim()) return data!.exercises
+    const exercises = data?.exercises ?? []
+    if (!searchQuery.trim()) return exercises
     const query = searchQuery.toLowerCase()
-    return data!.exercises.filter(ex =>
+    return exercises.filter(ex =>
       ex.name.toLowerCase().includes(query) ||
       ...
     )
-  }, [data!.exercises, searchQuery])
+  }, [data?.exercises, searchQuery])
```

**Verification:**
- ✅ 109/109 tests pass
- ✅ `npm run build` succeeds
- ✅ Lint: only pre-existing warnings (no new issues introduced)
