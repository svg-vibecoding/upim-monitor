

## Problem

All edge functions validate tokens using `anonClient.auth.getUser(token)`, which fails with the signing-keys system, producing "Token inválido" errors.

## Solution

Update all 4 edge functions to use `getClaims()` instead of `getUser()` for JWT validation, as required by the platform.

### Functions to update:
1. `supabase/functions/activate-pim-version/index.ts`
2. `supabase/functions/create-user/index.ts`
3. `supabase/functions/toggle-user-active/index.ts`
4. `supabase/functions/update-user/index.ts`

### Change pattern (same in all 4 files):

**Before:**
```typescript
const anonClient = createClient(supabaseUrl, anonKey, {
  global: { headers: { Authorization: authHeader } },
});
const token = authHeader.replace("Bearer ", "");
const { data: { user }, error: userError } = await anonClient.auth.getUser(token);
if (userError || !user) { ... "Token inválido" ... }
const callerId = user.id;
```

**After:**
```typescript
const anonClient = createClient(supabaseUrl, anonKey, {
  global: { headers: { Authorization: authHeader } },
});
const token = authHeader.replace("Bearer ", "");
const { data, error: claimsError } = await anonClient.auth.getClaims(token);
if (claimsError || !data?.claims) { ... "Token inválido" ... }
const callerId = data.claims.sub;
```

No other changes needed. The `sub` claim in the JWT is the user ID, which is then used for the `has_role` RPC check exactly as before.

