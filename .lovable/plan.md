## Goal-aware allocation engine (Step 6 spec)

Today every preset returns a static bucket (`SHORT`/`MEDIUM`/`LONG`/`TAX`) and a fixed 7% inflation. The new spec makes allocation **salary + years + target aware** with per-goal inflation, stretch-ratio bands, allocation tilts, and corrective suggestions (revised target / revised years / step-up SIP).

This plan replaces the static `preset.allocation()` call site with a new pure engine module, and rewires the "Add a goal" form + goal-detail page to surface the new outputs.

---

### 1. New module: `src/lib/engine.ts` (the core)

A single pure function `evaluateGoal(input) → result` that contains all the spec logic. Inputs and outputs match the JSON schema in Step 7.

**Inputs**
```ts
type GoalKind =
  | "emergency" | "vacation" | "home"
  | "education" | "retirement" | "wealth" | "tax_saving";

interface EngineInput {
  kind: GoalKind;
  target_today: number;
  years: number;
  monthly_income: number;
  monthly_sip?: number | null;          // null → auto-calc required SIP
  vacation_subtype?: "domestic" | "international";
  existing_savings?: number;            // emergency only
  largeCapFundId: string;               // for LONG bucket SENSEX/Nifty50 swap
}
```

**Per-goal inflation table** (constants at top of file)
| Kind | Inflation | Notes |
|---|---|---|
| education | 7% | CPI |
| home | 8% | property |
| vacation domestic | 7% | CPI |
| vacation intl | 9% | INR depreciation |
| wealth | 7% | CPI |
| retirement | 7% | CPI |
| emergency | none | living-expense buffer |

**Bucket selection (goal-specific)**
- **education**: <3 SHORT, 3–7 MEDIUM, >7 LONG; **special**: years ≤ 2 → force SHORT.
- **home**: <3 SHORT, 3–7 MEDIUM, >7 LONG.
- **vacation**: years ≤ 5 SHORT, 5–7 MEDIUM, >7 cap at MEDIUM (never LONG).
- **wealth**: <3 MEDIUM (never SHORT), 3–7 MEDIUM, >7 LONG.
- **retirement**: <3 SHORT, 3–7 MEDIUM, >7 LONG (fully dynamic, no overrides).
- **emergency**: always SHORT regardless of years.
- **tax_saving**: always TAX (only valid if years ≥ 3).

**Bucket allocations** (refined to match the spec exactly — current `presets.ts` is close, three small fixes)
- SHORT: blended **6.6%** — ZOVER 30, ZLIQD 30, ZNSDG 20, ZGFOF 10, ZGOLD 10. (already correct)
- MEDIUM: blended **9.3%** — ZMLTI 20, ZNH73 20 (we already use `largemid250-if`; rename label only), ZLTGC 15, ZGFOF 15, ZSFOF 15, ZSLVR 8, ZGOLD 7. (already correct)
- LONG: blended **13.0%** — ZN250 20, ZE150 (we currently fold MidSmall400 into `mid150case`; keep as-is at 30), ZESML 10, ZNFTY 10, ZEN50 10, ZBSEN 8, ZE100 7, ZGOLD 5. (already correct)
- TAX: ZELSS 100%.
- **EMERGENCY** (new fixed allocation, distinct from SHORT): ZOVER 40, ZLIQD 40, ZNSDG 20 → blended **6.2%**. No equity/gold/silver. Spec says emergency uses this 3-fund mix, not the 5-fund SHORT mix.

**Stretch ratio**
```
required_SIP = inflated_target / FV_factor(years, blended_return)
stretch      = required_SIP / monthly_income
```
Bands: EASY ≤0.10, MODERATE ≤0.20, STRETCHED ≤0.35, CRITICAL >0.35.

**Allocation tilt rules per goal** (mutates the bucket weights before returning)
- **Education**:
  - STRETCHED → shift 10% from lowest-CAGR fund in bucket to highest-CAGR fund. Add note.
  - CRITICAL + years > 3 → recommend upgrading to next bucket (recompute with new bucket).
  - CRITICAL + years ≤ 3 → emit `revised_target` = FV at 30% income SIP.
- **Home**:
  - STRETCHED + years ≥ 5 → +15% equity (shift from gold/debt sleeves into LargeMidcap/Nifty50). Add note.
  - STRETCHED + years < 5 → emit `revised_years` where stretch ≤ 0.25 (binary search / closed form).
  - CRITICAL → emit both `revised_target` (30% income) and `revised_years`.
- **Vacation**:
  - EASY → shift 10% Gold → Overnight/Liquid for max access.
  - STRETCHED → emit `revised_target` (10% income) and `revised_years` (10% income).
  - CRITICAL → block allocation (return `affordability_flag: "WARN"` with `allocation: []` and `revised_target`).
- **Wealth**:
  - EASY + LONG → +10% mid+small (shift from Nifty50/SENSEX sleeves).
  - EASY + MEDIUM → add ZN250 10% sleeve (shift from lowest-return).
  - STRETCHED → no equity bump; compute `step_up_corpus_10pct`.
  - CRITICAL → emit `revised_years` where stretch = 0.25.
  - Always compute `step_up_corpus_10pct` (10% annual SIP increase).
  - `upgrade_to_long_suggested` = true when years ∈ {5,6} and stretch is EASY.
- **Retirement**:
  - Same EASY tilts as wealth based on years bracket.
  - STRETCHED + years > 5 → emit `step_up_corpus_10pct`.
  - STRETCHED + years ≤ 5 → hard flag in note.
  - CRITICAL → realistic corpus at 25% income SIP.
  - Always emit `glide_path_note` (4 brackets: <3, 3–5, 5–10, >10) and `monthly_withdrawal_estimate = projected_corpus × 0.06 / 12`.
- **Emergency**:
  - Allocation locked (the 3-fund EMERGENCY mix). No tilt logic.
  - If user hasn't set a target, expose `suggested_targets = { conservative: income×3, recommended: income×6, aggressive: income×9 }`.
  - `existing_savings_offset` reduces the SIP base: `remaining = recommended − existing_savings`.

**Helper math** (already in `src/lib/calc.ts`, reuse + add)
- Reuse `sipFutureValue`, `requiredSip`, `inflateTarget` (extend `inflateTarget` to accept any rate — already does).
- Add `stepUpFutureValue(sip, ratePct, years, stepUpPct = 10)` summing `Σ FV(years−i, r) × (1.10)^i` per the spec.
- Add `roundUpTo100(n)` and `roundTo100(n)` for the "ceiling SIP / nearest ₹100 corpus" rules in the validation section.
- Add `solveYearsForStretch(target, monthlyIncome, blendedReturn, targetStretch)` — closed-form solve for years given desired SIP/income ratio.

**Output** (mirrors Step 7 schema)
```ts
interface EngineResult {
  goal_kind: GoalKind;
  bucket: "SHORT" | "MEDIUM" | "LONG" | "TAX" | "EMERGENCY";
  inflation_used: number | null;
  inflated_target: number;
  blended_return: number;          // pct
  required_monthly_sip: number;
  user_monthly_sip: number | null;
  effective_monthly_sip: number;   // user || required, ceiling ₹100
  projected_corpus: number;
  surplus_or_deficit: number;
  on_track: boolean;
  stretch_ratio: number;
  stretch_band: "EASY" | "MODERATE" | "STRETCHED" | "CRITICAL";
  affordability_flag: "OK" | "FLAG" | "WARN";
  allocation: AllocationItem[];    // post-tilt
  notes: string[];                 // tilt explanations, glide path, etc.
  // optional per goal kind
  revised_target?: number;
  revised_years?: number;
  step_up_corpus_10pct?: number;
  monthly_withdrawal_estimate?: number;
  glide_path_note?: string;
  upgrade_to_long_suggested?: boolean;
  suggested_targets?: { conservative: number; recommended: number; aggressive: number };
  existing_savings_offset?: number;
}
```

---

### 2. Map current preset IDs → engine `GoalKind`

`src/lib/presets.ts` keeps presets for UI labels/icons but adds:
```ts
export const PRESET_TO_KIND: Record<GoalPresetId, GoalKind> = {
  emergency: "emergency",
  "short-park": "vacation",
  "tax-saving": "tax_saving",
  car: "home",          // car/down-payment shares Home logic
  house: "home",
  education: "education",
  retirement: "retirement",
  wealth: "wealth",
  custom: "wealth",     // custom defaults to wealth rules
};
```
Existing static `allocation` callbacks become unused but kept for backward compat with previously saved goals on the detail page (we'll prefer engine output when re-evaluating).

---

### 3. `src/routes/goals.new.tsx` — wire to the engine

- Add form fields:
  - **Vacation subtype** (radio: Domestic / International) — visible only when `presetId === "short-park"`.
  - **Existing savings** (₹) — visible only when `presetId === "emergency"`.
  - **Suggested targets chips** (3×: 3 / 6 / 9 months income) for emergency: clicking sets `targetAmount`.
- Replace the local `inflationPct = 7` with `result.inflation_used` from the engine. Display:
  - "7% (CPI)" for most, "8% (property)" for home, "9% (international travel)" / "7% (domestic)" for vacation, "Not applied" for emergency.
  - Keep field read-only / muted as today; just dynamic per-goal.
- Replace ad-hoc `cagr`, `reqSip`, `projected`, `onTrack` calculations with one `result = evaluateGoal({...})` call.
- New live-preview cards on the right column:
  1. **Live projection** (existing) — but values from `result.projected_corpus`, `result.effective_monthly_sip`, `result.blended_return`.
  2. **Affordability** — new card. Shows stretch band as a colored chip (EASY=success, MODERATE=neutral, STRETCHED=warning, CRITICAL=destructive) + `stretch_ratio %` and one-line message.
  3. **Suggested allocation** (existing) — driven by `result.allocation` (post-tilt).
  4. **Smart suggestions** — new conditional card listing any of: revised_target, revised_years, step_up_corpus_10pct, glide_path_note, monthly_withdrawal_estimate, upgrade_to_long_suggested. Each entry is one row; revised_target/years come with "Apply" buttons that prefill the form.
- Submit guards:
  - Vacation CRITICAL → block save with toast pointing at the `revised_target`.
  - Otherwise allow save; persist `result.allocation` and `result.effective_monthly_sip`.

### 4. `src/routes/goals.$goalId.tsx` — re-evaluate on edits

- On every render, call `evaluateGoal` with the current goal + settings. Use the returned `bucket`, `blended_return`, `notes`, `glide_path_note`, `monthly_withdrawal_estimate`, `step_up_corpus_10pct` to enrich the existing view:
  - Status banner now shows stretch band + affordability message in addition to surplus/shortfall.
  - New "Insights" section below the chart: glide path note (retirement), step-up corpus (wealth/retirement), withdrawal estimate (retirement), revised target/years (when not on-track).
- Existing manual allocation editor stays — it lets users override the engine-suggested mix; engine is only re-run when target/years/SIP/preset changes.

### 5. `src/routes/about.tsx` — update mapping page

- Add an **Emergency Bucket** row to the existing bucket tables (3 funds: ZOVER 40 / ZLIQD 40 / ZNSDG 20 @ blended 6.2%).
- Add a small "Inflation per goal" reference table (the summary at the bottom of the spec).
- Keep "stocks-only mapping" rule from the prior turn — no extra prose.

### 6. Round/ceiling rules (validation section of spec)

- All projected corpus values rounded to nearest ₹100 → apply `roundTo100` at engine output boundary.
- All required SIPs ceiling to nearest ₹100 → apply `roundUpTo100` at engine output.
- Reject inputs with `years < 1`, `target ≤ 0`, `monthly_income ≤ 0` (form already validates years/target; add monthly_income > 0 guard with a friendly toast pointing at the income field).

### 7. Files touched

- **NEW** `src/lib/engine.ts` — pure engine, fully unit-testable, no React.
- **EDIT** `src/lib/calc.ts` — add `stepUpFutureValue`, `roundTo100`, `roundUpTo100`, `solveYearsForStretch`.
- **EDIT** `src/lib/presets.ts` — add `PRESET_TO_KIND` map, add EMERGENCY bucket constant. Keep existing static buckets for backward compat.
- **EDIT** `src/routes/goals.new.tsx` — replace inline math with `evaluateGoal`, add vacation subtype + emergency fields + suggestion chips + smart-suggestions card.
- **EDIT** `src/routes/goals.$goalId.tsx` — call `evaluateGoal`, surface notes/glide path/withdrawal/step-up/revised values in a new Insights card.
- **EDIT** `src/routes/about.tsx` — add Emergency bucket table + per-goal inflation reference.

### 8. Out of scope (deliberately)

- No new persistence schema changes — `Goal` keeps the same shape (`presetId`, `targetAmount`, `years`, `monthlySip`, `allocation`). Vacation subtype + existing savings live only in the form (not persisted) for this iteration. If you want them persisted to drive the detail-page re-evaluation, say so and I'll add `kindMeta?: { vacationSubtype?, existingSavings? }` to `Goal`.
- No automated tests — engine is pure and easy to add a test file for later if you want.
