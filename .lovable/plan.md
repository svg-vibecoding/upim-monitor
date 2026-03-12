

## Diagnosis: Why `login_success` is not being captured

The `LoginPage` calls `login()`, which internally waits up to 1.5s for the auth state to settle. After it resolves with `success: true`, the code schedules a `setTimeout` of 2 seconds for tracking. However, at that point React navigation kicks in (the `AppLayout` redirect renders), which unmounts `LoginPage` and kills the pending timeout before it fires. The event never gets inserted.

## Plan

### 1. Fix `login_success` tracking

Move the tracking call into `AuthContext.tsx` inside `loadAppUser`. Once a valid `AppUser` is resolved after login, fire `trackEventDirect` there — this runs regardless of page navigation. Check the `track_insights` flag before inserting.

Remove the broken tracking code from `LoginPage.tsx`.

### 2. Add `track_insights` column to `profiles`

- Migration: `ALTER TABLE profiles ADD COLUMN track_insights boolean NOT NULL DEFAULT true;`
- Default `true` so existing users are tracked by default.

### 3. Add toggle to user create/edit dialog in `AdminPage.tsx`

- New state: `userTrackInsights` (boolean, default `true`).
- In `openUserDialog`: populate from user data or default to `true`.
- In the dialog UI, after the role selector (and before the save button): add a Switch with label "Capturar insights de uso".
- Pass `track_insights` to both `create-user` and `update-user` edge functions.

### 4. Update Edge Functions

**`create-user/index.ts`**: Accept `track_insights` in body, include it in the profile upsert.

**`update-user/index.ts`**: Accept `track_insights` in body, include it in the profile update.

### 5. Update tracking to respect the flag

**`useTrackEvent.ts`**:
- `useTrackEvent` hook: add `track_insights` to the `AppUser` interface check. If `user.track_insights === false`, skip insert.
- `trackEventDirect`: add a `trackInsights` parameter; skip if false.

**`AuthContext.tsx`**:
- Load `track_insights` from profiles query into `AppUser`.
- After successful `loadAppUser`, call `trackEventDirect` for `login_success` (only if `track_insights` is true).

### 6. Update `DBUser` in AdminPage

- Extend `DBUser` interface with `track_insights: boolean`.
- Fetch it from profiles query.
- Populate in `openUserDialog`.

### Files changed

| File | Change |
|---|---|
| Migration (new) | Add `track_insights` column |
| `supabase/functions/create-user/index.ts` | Accept & store `track_insights` |
| `supabase/functions/update-user/index.ts` | Accept & store `track_insights` |
| `src/contexts/AuthContext.tsx` | Add `track_insights` to AppUser, fire login_success tracking |
| `src/hooks/useTrackEvent.ts` | Check `track_insights` before inserting |
| `src/pages/AdminPage.tsx` | Add toggle to user form, pass to edge functions |
| `src/pages/LoginPage.tsx` | Remove broken tracking code |
| `src/pages/InsightsPage.tsx` | Filter out events from users with tracking disabled (no change needed — they simply won't have events) |

