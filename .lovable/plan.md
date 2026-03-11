

## Diagnosis

The `activate-pim-version` Edge Function is failing because it calls `anonClient.auth.getClaims(token)` -- a method that does not exist in the version of `@supabase/supabase-js@2` loaded via `esm.sh`. This causes an unhandled crash (TypeError), returning a non-2xx status before any log is written, which explains the empty logs.

## Fix

Rewrite the JWT validation in `supabase/functions/activate-pim-version/index.ts` to use `supabase.auth.getUser(token)` instead of `getClaims()`. This is the standard and supported method in Supabase JS v2.

### Changes to `activate-pim-version/index.ts`

Replace the authentication block (lines 30-47):

```typescript
// Before (broken):
const anonClient = createClient(supabaseUrl, anonKey, { ... });
const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(token);
const callerId = claimsData.claims.sub;

// After (working):
const anonClient = createClient(supabaseUrl, anonKey, {
  global: { headers: { Authorization: authHeader } },
});
const { data: { user }, error: userError } = await anonClient.auth.getUser(token);
if (userError || !user) {
  return 401 response;
}
const callerId = user.id;
```

Everything else in the function stays the same -- the role check via `has_role` RPC and the `activate_pim_version` RPC call are correct.

Single file change, ~5 lines modified.

