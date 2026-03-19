

## Plan: Fix floating step indicators

### Problem
The floating circle indicators are positioned with `absolute -top-2.5 -right-2.5` inside the card `div`, but the `overflow-auto` on the `<main>` scroll container in `AppLayout.tsx` clips them. Adding `overflow-visible` to the card doesn't help because ancestor elements still clip.

### Solution
Simplify the approach: remove the "X de 2" text labels and restructure so each step is wrapped in a container with `relative` and top padding, placing the indicator circle **outside and above** the card.

### Structure (both pages, both steps)

```text
Before:
<Collapsible>
  <div class="relative overflow-visible rounded-lg border ...">  ← card
    <div class="absolute -top-2.5 -right-2.5 ...">              ← indicator (clipped)
    <CollapsibleTrigger>
    <CollapsibleContent>

After:
<Collapsible>
  <div class="relative pt-3">                                    ← wrapper with space
    <div class="absolute top-0 right-3 z-10 ...">               ← indicator (free)
      <span class="h-6 w-6 rounded-full ...">1 or ✓</span>
    </div>
    <div class="rounded-lg border bg-card ...">                  ← card (no relative/overflow)
      <CollapsibleTrigger>
      <CollapsibleContent>
    </div>
  </div>
</Collapsible>
```

### Changes

**`src/pages/NewReportPage.tsx`** and **`src/pages/CreatePredefinedReportPage.tsx`**:

1. Wrap each step's card in a new `div` with `relative pt-3`
2. Move the indicator `div` to be a sibling of the card, positioned `absolute top-0 right-3`
3. Remove the "1 de 2" / "2 de 2" text labels — keep only the circles
4. Remove `relative overflow-visible` from the card div (no longer needed)
5. Keep `hover:shadow-md` on the card div

### Files modified
- `src/pages/NewReportPage.tsx`
- `src/pages/CreatePredefinedReportPage.tsx`

No logic or functionality changes.

