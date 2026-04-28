## Add "See Detailed Analysis" Monte Carlo mode

Keep the existing deterministic base tool exactly as it is. Add an opt-in detailed analysis layer that the user reveals by clicking a button in the goal preview / goal detail page. The detailed view runs a 1,000-run Monte Carlo simulation on top of the engine's allocation and shows a probability of success, a percentile range, and per-fund volatility notes.

### What the user sees

On the **goal creation preview** (`goals.new.tsx`) and the **goal detail page** (`goals.$goalId.tsx`), below the existing projection card add a single collapsed CTA:

```text
[ See Detailed Analysis ▾ ]
   "Stress-test this plan across 1,000 market scenarios"
```

When clicked, an inline panel expands and renders:

1. **Probability of success** — large bold number with color (green ≥80%, amber 60-79%, red <60%) and short label ("Strong" / "Moderate — consider increasing SIP" / "At risk — review your plan").
2. **Outcome range bar** — horizontal bar with 5 markers (p10 / p25 / p50 / p75 / p90) using friendly labels ("If markets are rough" / "Cautious" / "Most likely" / "Optimistic" / "If markets do well"). A dotted marker for the deterministic base projection. A vertical line labeled "Your goal" at the inflated target.
3. **Volatility note** — one-line dynamic message based on bucket (SHORT/MEDIUM/LONG/TAX/EMERGENCY).
4. **Per-fund behaviour notes** — small list showing each allocated fund and its one-line behaviour note.

The base projection number, the deterministic SIP, allocations, stretch band, and all existing logic stay identical and untouched.

### Files added / changed

**NEW `src/lib/volatility.ts`** — pure module, no React.
- Exports `FUND_VOLATILITY: Record<fundId, { mean: number; stdDev: number; class: "equity"|"debt"|"gold"|"silver"|"hybrid"; note: string }>` mapping every fund in `src/lib/funds.ts` to the spec's mean / std-dev table. Mapping for the funds we actually have:
  - `overnight` 6.0/0.3, `liquidcase` 6.0/0.5, `gsec-short` 7.0/1.5, `gsec813` 7.5/5.0
  - `goldcase` & `gold-fof` 8.0/12.0, `silvercase` & `silver-fof` 9.0/18.0
  - `multi-asset` 10.5/7.0 (hybrid)
  - `nifty50-if`, `niftycase`, `sensex-if` 12.0/14.0; `top100case` 12.0/14.0
  - `largemid250-if`, `elss-largemid250` 13.0/16.0
  - `mid150case` 14.0/20.0
  - `smallcase` 15.0/25.0
  - One behaviour-note string per fund (from spec's "Asset behaviour notes").
- Exports `volatilityNote(bucket)` returning the dynamic bucket-level message.

**NEW `src/lib/montecarlo.ts`** — pure module.
- `simulateGoal({ allocation, monthlySip, years, inflatedTarget, runs = 1000, seed? }) → DetailedAnalysis`.
- Implementation:
  - Seeded PRNG (mulberry32) so results are stable across renders for the same inputs (no flicker on re-render).
  - For each run and each year, draw a shared `equityShock ~ N(0,1)`, then per fund:
    - equity: `r = mean + std × (0.7·shock + 0.3·N(0,1))`
    - debt: `r = mean + std × (-0.1·shock + 1.0·N(0,1))`
    - gold: `r = mean + std × (-0.2·shock + 0.98·N(0,1))`
    - silver: gold path × 0.6 correlation (shared gold idiosyncratic factor), then add silver-specific noise.
    - hybrid: treat as 0.5 equity-correlated, 0.5 idiosyncratic.
  - Cap each annual return to `[-60%, +80%]`.
  - For each fund sleeve, allocate `monthlySip × percent/100` and compound month-by-month using that year's monthly rate; carry corpus across years.
  - Sum sleeve corpora → simulation total.
  - After all runs: sort, return `{ p10, p25, p50, p75, p90, probabilityOfSuccess, runs }`.
- `boxMullerNormal(rng)` helper for N(0,1) draws.
- No React, no I/O; fully unit-testable.

**NEW `src/components/DetailedAnalysis.tsx`** — presentational.
- Props: `EngineResult` + `monthlyIncome`. Internally calls `simulateGoal` (memoized via `useMemo` on `[allocation, sip, years, inflatedTarget]`).
- Wrapped in shadcn `<Collapsible>` with a `<CollapsibleTrigger>` button "See Detailed Analysis". Default collapsed.
- Renders: probability badge, range bar (simple flexbox with absolute-positioned markers — no chart lib needed), volatility note, per-fund behaviour list (uses `FUND_VOLATILITY` notes filtered to funds present in `result.allocation`).
- Brief disclaimer: "Simulated outcomes based on historical asset volatility. Not a guarantee."

**EDIT `src/routes/goals.new.tsx`** — render `<DetailedAnalysis result={result} monthlyIncome={income} />` directly under the existing "Live projection" card. No changes to existing fields, calculations, or layout.

**EDIT `src/routes/goals.$goalId.tsx`** — render the same component below the existing projection / insights section, using the already-computed engine result.

### Technical details

- **Determinism for UI**: use a seed derived from `(allocation hash, sip, years, target)` so re-renders don't reshuffle percentiles. Different goals → different seeds.
- **Performance**: 1,000 runs × ~40 years × ~8 funds is well under 50ms in modern browsers; run synchronously inside `useMemo`. No web worker needed at this scale. If `years > 30` and we measure jank later, we can defer to `requestIdleCallback`.
- **EMERGENCY / TAX edge cases**: simulate normally (TAX is a single ELSS sleeve; EMERGENCY is debt-only — narrow band confirms the "very stable" message).
- **Empty allocation** (e.g. CRITICAL vacation returns `allocation: []`): the component renders a small "Detailed analysis unavailable — revise your goal first" message instead of running the sim.
- **No engine changes**: the deterministic engine and its outputs remain byte-identical. Detailed analysis is a sibling computation that reads `result.allocation`, `result.effective_monthly_sip`, `result.inflated_target`, `result.bucket`, and the input `years`.
- **No persistence changes**: simulation runs on demand, results are not stored.

### Out of scope

- No changes to base SIP / inflation / bucket / stretch logic.
- No new routes, no DB, no preset edits.
- No charting library — the range bar is plain Tailwind divs.
