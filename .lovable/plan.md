## Diagnosis: Button "Actualizar datos de la app" disabled after successful upload

### Root cause

The `canActivate` guard (line 505) requires four conditions:

```
csvResult?.success
  && missingProtected.length === 0
  && (csvResult.uniqueRows || 0) > 0
  && !!pendingUploadId          // <-- this is the suspect
```

`pendingUploadId` is set via `setPendingUploadId(firstResult.uploadId)` on line 632 (React state setter), but the upload ID only comes from the **first chunk** response (`firstResult.uploadId`). The edge function only returns `uploadId` when `isFirstChunk === true` and the insert into `pim_upload_history` succeeds.

Two failure modes can cause `pendingUploadId` to be `null`:

1. **Edge function returns `uploadId: null**`: If the `pim_upload_history` insert fails silently (the edge function catches the error with `console.error` but still returns `success: true` with `uploadId: null`), `setPendingUploadId(null)` is called, keeping the button disabled.
2. **React state timing**: `setPendingUploadId` is called mid-async-function. If a re-render triggered by `setCsvProgress` causes the component to re-evaluate before `setPendingUploadId` takes effect, `canActivate` evaluates to `false`. This is less likely but explains intermittency.

### Fix (minimal, 1 file)

`**src/pages/AdminPage.tsx**` — Make `canActivate` resilient by also storing `uploadId` inside `csvResult` and checking both sources:

1. Add `uploadId` to the `csvResult` state object (line 693-703): include `uploadId: currentUploadId`.
2. Update `canActivate` (line 505) to:
  ```ts
   const canActivate = csvResult?.success
     && missingProtected.length === 0
     && (csvResult.uniqueRows || 0) > 0
     && !!(pendingUploadId || csvResult.uploadId);
  ```
3. Update the activation onClick (line 888) to also fall back to `csvResult.uploadId`:
  ```ts
   const uploadIdToActivate = (latestPending as ...)?.id || pendingUploadId || csvResult?.uploadId;
  ```

This ensures the button enables even if `setPendingUploadId` was called with `null` or had a timing issue, as long as the upload ID was captured in the local variable `currentUploadId` which is set synchronously.

### Files modified

- `src/pages/AdminPage.tsx` (3 line edits)