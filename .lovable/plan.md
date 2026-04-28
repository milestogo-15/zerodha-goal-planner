## Goal
On the goal detail page (`/goals/:goalId`), the **Recommended allocation** section currently lets the user drag a slider for one fund at a time, but the other funds stay fixed — so the total drifts away from 100% and the user has to manually rebalance. Make sliders auto-rebalance: when the user changes one fund's percent, the remaining funds adjust proportionally so the total stays at 100%.

## Behavior

- User drags fund A's slider from 20% → 30% (delta = +10%).
- The remaining 10% has to come out of the other funds (B, C, D…).
- Each other fund shrinks **in proportion to its current weight** among the "other" funds. If B was 40 of the remaining 80 (50%), it gives up 5%; if C was 24 of 80 (30%), it gives up 3%; etc.
- If the dragged fund is increased and the others' total is 0 (edge case), clamp the dragged fund to whatever room is available.
- All percentages stay as integers (sliders use `step={1}`); after proportional scaling, round and fix any ±1% drift by adjusting the largest "other" fund so the total is exactly 100.
- Lower-bound: no fund can go below 0%. If proportional reduction would push a fund negative, clamp it at 0 and redistribute the residual across the remaining non-zero funds (single re-pass is enough in practice).
- Upper-bound: the dragged fund itself is capped at 100% (already enforced by slider max).
- Single-fund case: if there's only one fund in the allocation, the slider just snaps it to 100%.

The "totals should sum to 100% (X% currently)" helper text becomes redundant once rebalancing is automatic — replace it with a calmer hint like *"Adjust any slider — the others rebalance automatically."* The total badge still renders (useful as confirmation it's exactly 100%).

## Technical changes — `src/routes/goals.$goalId.tsx`

Replace the existing `updateAllocation` (line 96–99) with a rebalancing version:

```ts
const updateAllocation = (fundId: string, nextPercent: number) => {
  const current = goal.allocation;
  if (current.length === 1) {
    updateGoal(goal.id, { allocation: [{ ...current[0], percent: 100 }] });
    return;
  }

  const target = Math.max(0, Math.min(100, Math.round(nextPercent)));
  const others = current.filter((a) => a.fundId !== fundId);
  const othersTotal = others.reduce((s, a) => s + a.percent, 0);
  const remaining = 100 - target;

  let nextOthers: typeof others;
  if (othersTotal <= 0) {
    // Distribute `remaining` evenly across the other funds.
    const base = Math.floor(remaining / others.length);
    nextOthers = others.map((a) => ({ ...a, percent: base }));
  } else {
    // Proportional scaling.
    nextOthers = others.map((a) => ({
      ...a,
      percent: Math.max(0, Math.round((a.percent / othersTotal) * remaining)),
    }));
  }

  // Reconcile rounding so the total is exactly 100.
  const built = current.map((a) =>
    a.fundId === fundId
      ? { ...a, percent: target }
      : nextOthers.find((n) => n.fundId === a.fundId)!,
  );
  const drift = 100 - built.reduce((s, a) => s + a.percent, 0);
  if (drift !== 0) {
    // Apply drift to the largest "other" fund that can absorb it without going <0 or >100.
    const candidates = built
      .filter((a) => a.fundId !== fundId)
      .sort((x, y) => y.percent - x.percent);
    for (const c of candidates) {
      const adjusted = c.percent + drift;
      if (adjusted >= 0 && adjusted <= 100) {
        c.percent = adjusted;
        break;
      }
    }
  }

  updateGoal(goal.id, { allocation: built });
};
```

Also update the helper line (around line 455) from *"Edit percentages — totals should sum to 100% (X% currently)."* to *"Drag any slider — the others rebalance automatically. Total: X%."*

No other files change. The slider component, store, and projection math already accept the updated allocation array as-is.

## Out of scope

- The read-only "Suggested allocation" preview on `/goals/new` stays unchanged — it's a preview, not editable.
- No change to fund add/remove flow. (Newly-added funds default to 5% via the existing `addFund` and will simply make the total drift on insert; that's existing behavior and the helper text still reports the live total.)