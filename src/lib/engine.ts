// Goal-aware allocation engine — implements Step 6 spec.
// Pure module: no React, no I/O. Inputs in, EngineResult out.

import { fundById } from "./funds";
import {
  EMERGENCY_BLENDED_RETURN,
  EMERGENCY_BUCKET_ALLOC,
  longBucketAlloc,
  MEDIUM_BUCKET_ALLOC,
  SHORT_BUCKET_ALLOC,
  TAX_BUCKET_ALLOC,
  type AllocationItem,
  type GoalKind,
} from "./presets";
import {
  inflateTarget,
  requiredSip,
  roundTo100,
  roundUpTo100,
  sipFutureValue,
  solveYearsForStretch,
  stepUpFutureValue,
} from "./calc";

export type EngineBucket = "SHORT" | "MEDIUM" | "LONG" | "TAX" | "EMERGENCY";
export type StretchBand = "EASY" | "MODERATE" | "STRETCHED" | "CRITICAL";
export type AffordabilityFlag = "OK" | "FLAG" | "WARN";

export interface EngineInput {
  kind: GoalKind;
  target_today: number;
  years: number;
  monthly_income: number;
  monthly_sip?: number | null;
  vacation_subtype?: "domestic" | "international";
  existing_savings?: number;
  largeCapFundId: string;
}

export interface EngineResult {
  goal_kind: GoalKind;
  bucket: EngineBucket;
  inflation_used: number | null;          // pct, e.g. 7
  inflated_target: number;
  blended_return: number;                 // pct
  required_monthly_sip: number;           // pre-tilt (after engine, ceiling ₹100)
  user_monthly_sip: number | null;
  effective_monthly_sip: number;          // user || required, ceiling ₹100
  projected_corpus: number;
  surplus_or_deficit: number;             // projected − inflated_target
  on_track: boolean;
  stretch_ratio: number;                  // 0..∞
  stretch_band: StretchBand;
  affordability_flag: AffordabilityFlag;
  allocation: AllocationItem[];           // post-tilt
  notes: string[];
  // optional
  revised_target?: number;
  revised_years?: number;
  step_up_corpus_10pct?: number;
  monthly_withdrawal_estimate?: number;
  glide_path_note?: string;
  upgrade_to_long_suggested?: boolean;
  suggested_targets?: { conservative: number; recommended: number; aggressive: number };
  existing_savings_offset?: number;
  property_inflation_note?: string;
  vacation_subtype?: "domestic" | "international";
  deadline_sensitive?: boolean;
}

// ─── Inflation table ─────────────────────────────────────────
function inflationFor(kind: GoalKind, vacationSubtype?: "domestic" | "international"): number | null {
  switch (kind) {
    case "emergency":
      return null;
    case "home":
      return 8;
    case "vacation":
      return vacationSubtype === "international" ? 9 : 7;
    case "education":
    case "wealth":
    case "retirement":
    case "tax_saving":
    default:
      return 7;
  }
}

// ─── Bucket math ─────────────────────────────────────────────
function bucketAllocation(bucket: EngineBucket, largeCapFundId: string): AllocationItem[] {
  switch (bucket) {
    case "SHORT":
      return clone(SHORT_BUCKET_ALLOC);
    case "MEDIUM":
      return clone(MEDIUM_BUCKET_ALLOC);
    case "LONG":
      return clone(longBucketAlloc(largeCapFundId));
    case "TAX":
      return clone(TAX_BUCKET_ALLOC);
    case "EMERGENCY":
      return clone(EMERGENCY_BUCKET_ALLOC);
  }
}

function blendedReturnFor(bucket: EngineBucket, alloc: AllocationItem[]): number {
  if (bucket === "EMERGENCY") return EMERGENCY_BLENDED_RETURN;
  // Compute from current allocation (post-tilt) so tilts move the blended too.
  const total = alloc.reduce((s, a) => s + a.percent, 0) || 1;
  return alloc.reduce((s, a) => {
    const f = fundById(a.fundId);
    return s + (f?.assumedCagr ?? 0) * (a.percent / total);
  }, 0);
}

function clone<T extends AllocationItem>(items: T[]): T[] {
  return items.map((it) => ({ ...it }));
}

// ─── Bucket selection per kind ───────────────────────────────
function selectBucket(kind: GoalKind, years: number): EngineBucket {
  if (kind === "emergency") return "EMERGENCY";
  if (kind === "tax_saving") return "TAX";
  if (kind === "vacation") {
    if (years <= 5) return "SHORT";
    return "MEDIUM"; // >5 → MEDIUM, capped (never LONG)
  }
  if (kind === "wealth") {
    if (years < 3) return "MEDIUM"; // never SHORT
    if (years <= 7) return "MEDIUM";
    return "LONG";
  }
  if (kind === "education") {
    if (years <= 2) return "SHORT"; // hard rule
    if (years < 3) return "SHORT";
    if (years <= 7) return "MEDIUM";
    return "LONG";
  }
  // home, retirement → standard
  if (years < 3) return "SHORT";
  if (years <= 7) return "MEDIUM";
  return "LONG";
}

function nextBucketUp(bucket: EngineBucket): EngineBucket | null {
  if (bucket === "SHORT") return "MEDIUM";
  if (bucket === "MEDIUM") return "LONG";
  return null;
}

// ─── Stretch bands ───────────────────────────────────────────
function stretchBand(ratio: number): StretchBand {
  if (ratio <= 0.10) return "EASY";
  if (ratio <= 0.20) return "MODERATE";
  if (ratio <= 0.35) return "STRETCHED";
  return "CRITICAL";
}

function affordabilityFromStretch(band: StretchBand): AffordabilityFlag {
  if (band === "CRITICAL") return "WARN";
  if (band === "STRETCHED") return "FLAG";
  return "OK";
}

// ─── Tilt helpers ────────────────────────────────────────────
function shiftWeight(
  alloc: AllocationItem[],
  fromId: string,
  toId: string,
  pct: number,
): AllocationItem[] {
  const from = alloc.find((a) => a.fundId === fromId);
  if (!from) return alloc;
  const moved = Math.min(pct, from.percent);
  from.percent -= moved;
  const to = alloc.find((a) => a.fundId === toId);
  if (to) {
    to.percent += moved;
  } else {
    alloc.push({ fundId: toId, percent: moved });
  }
  return alloc.filter((a) => a.percent > 0);
}

function findLowestReturn(alloc: AllocationItem[]): AllocationItem | undefined {
  let lowest: AllocationItem | undefined;
  let lowestRet = Infinity;
  for (const a of alloc) {
    const r = fundById(a.fundId)?.assumedCagr ?? 0;
    if (r < lowestRet && a.percent > 0) {
      lowestRet = r;
      lowest = a;
    }
  }
  return lowest;
}

function findHighestReturn(alloc: AllocationItem[]): AllocationItem | undefined {
  let highest: AllocationItem | undefined;
  let highestRet = -Infinity;
  for (const a of alloc) {
    const r = fundById(a.fundId)?.assumedCagr ?? 0;
    if (r > highestRet) {
      highestRet = r;
      highest = a;
    }
  }
  return highest;
}

// Move `pct` from gold/debt sleeves into LargeMidcap/Nifty50 (home tilt)
function bumpEquity(alloc: AllocationItem[], pct: number): AllocationItem[] {
  let remaining = pct;
  const debtGoldOrder = alloc
    .map((a) => ({ a, fund: fundById(a.fundId) }))
    .filter((x) => x.fund && (x.fund.assetClass === "gold" || x.fund.assetClass === "debt"))
    .sort((a, b) => (a.fund!.assumedCagr ?? 0) - (b.fund!.assumedCagr ?? 0));

  for (const { a } of debtGoldOrder) {
    if (remaining <= 0) break;
    const take = Math.min(a.percent, remaining);
    a.percent -= take;
    remaining -= take;
  }

  const equityTargets = ["largemid250-if", "nifty50-if"];
  let added = pct - remaining;
  for (const id of equityTargets) {
    const slice = added / equityTargets.length;
    const existing = alloc.find((a) => a.fundId === id);
    if (existing) existing.percent += slice;
    else alloc.push({ fundId: id, percent: slice });
  }
  return alloc.filter((a) => a.percent > 0);
}

// Wealth EASY+LONG: +10% to mid+small (5/5) shifted from Nifty50/SENSEX
function bumpMidSmall(alloc: AllocationItem[], pct: number): AllocationItem[] {
  const sources = ["nifty50-if", "niftycase", "sensex-if", "top100case"];
  let need = pct;
  for (const id of sources) {
    if (need <= 0) break;
    const a = alloc.find((x) => x.fundId === id);
    if (!a) continue;
    const take = Math.min(a.percent, need);
    a.percent -= take;
    need -= take;
  }
  const moved = pct - need;
  const half = moved / 2;
  const mid = alloc.find((a) => a.fundId === "mid150case");
  const small = alloc.find((a) => a.fundId === "smallcase");
  if (mid) mid.percent += half;
  else alloc.push({ fundId: "mid150case", percent: half });
  if (small) small.percent += half;
  else alloc.push({ fundId: "smallcase", percent: half });
  return alloc.filter((a) => a.percent > 0);
}

// ─── Glide path note (retirement) ────────────────────────────
function glidePathNote(years: number): string {
  if (years < 3)
    return "Capital preservation mode. Equity removed. Focus on liquid and debt for safe withdrawal.";
  if (years <= 5)
    return "Conservative pre-retirement. Limited equity, higher debt and gold.";
  if (years <= 10) return "Balanced accumulation. Equity and debt mix.";
  return "Growth phase. Equity-heavy for real wealth creation over long horizon.";
}

// ─── Main entry point ────────────────────────────────────────
export function evaluateGoal(input: EngineInput): EngineResult {
  const {
    kind,
    target_today,
    years,
    monthly_income,
    monthly_sip,
    vacation_subtype,
    existing_savings = 0,
    largeCapFundId,
  } = input;

  const inflationUsed = inflationFor(kind, vacation_subtype);
  const notes: string[] = [];

  // Effective target may be smart-suggested for emergency
  let effectiveTargetToday = target_today;
  let suggested_targets: EngineResult["suggested_targets"];
  let existing_savings_offset: number | undefined;

  if (kind === "emergency") {
    suggested_targets = {
      conservative: monthly_income * 3,
      recommended: monthly_income * 6,
      aggressive: monthly_income * 9,
    };
    if (effectiveTargetToday <= 0) {
      effectiveTargetToday = suggested_targets.recommended;
    }
    if (existing_savings > 0) {
      existing_savings_offset = existing_savings;
      effectiveTargetToday = Math.max(0, effectiveTargetToday - existing_savings);
    }
  }

  // Inflation applies to all kinds except emergency
  const inflated_target =
    inflationUsed === null
      ? effectiveTargetToday
      : inflateTarget(effectiveTargetToday, years, inflationUsed);

  // Initial bucket
  let bucket = selectBucket(kind, years);
  let allocation = bucketAllocation(bucket, largeCapFundId);
  let blended = blendedReturnFor(bucket, allocation);

  // ── First-pass required SIP and stretch ──
  const computeReqSip = (alloc: AllocationItem[], buc: EngineBucket) => {
    const ret = blendedReturnFor(buc, alloc);
    return requiredSip(inflated_target, ret, years * 12);
  };

  let required = computeReqSip(allocation, bucket);
  let stretch = required / Math.max(1, monthly_income);
  let band = stretchBand(stretch);

  // ── Goal-specific tilts ─────────────────────────────────
  switch (kind) {
    case "education": {
      if (years <= 2) {
        notes.push("Education deadline ≤ 2y — locked to SHORT bucket for capital safety.");
      }
      if (band === "STRETCHED") {
        const lo = findLowestReturn(allocation);
        const hi = findHighestReturn(allocation);
        if (lo && hi && lo.fundId !== hi.fundId) {
          shiftWeight(allocation, lo.fundId, hi.fundId, 10);
          notes.push(
            "Stretched: shifted 10% from lowest-return sleeve into highest-return sleeve. Avoid pausing SIP.",
          );
        }
      } else if (band === "CRITICAL") {
        if (years > 3) {
          const next = nextBucketUp(bucket);
          if (next) {
            bucket = next;
            allocation = bucketAllocation(bucket, largeCapFundId);
            notes.push(
              `Critical at current income — upgraded to ${bucket} bucket for higher expected return.`,
            );
          }
        } else {
          // Cannot upgrade safely
          // Revised target = corpus achievable at 30% income SIP
          const sipCap = monthly_income * 0.30;
          const blendedCalc = blendedReturnFor(bucket, allocation);
          const corpus = sipFutureValue(sipCap, blendedCalc, years * 12);
          notes.push(
            `Cannot upgrade safely (deadline ≤ 3y). At ~30% income SIP, achievable corpus is shown as revised target.`,
          );
          // we'll set revised_target after recompute
          (input as unknown as { _revisedTarget?: number })._revisedTarget = roundTo100(corpus);
        }
      }
      break;
    }

    case "home": {
      if (band === "STRETCHED") {
        if (years >= 5) {
          bumpEquity(allocation, 15);
          notes.push(
            "Stretched + 5y+ horizon — equity weight increased by 15%. Stay invested for the full horizon.",
          );
        } else {
          // suggest revised_years
          const ry = solveYearsForStretch(
            target_today,
            monthly_income,
            blendedReturnFor(bucket, allocation),
            inflationUsed ?? 0,
            0.25,
          );
          (input as unknown as { _revisedYears?: number })._revisedYears = ry;
          notes.push(
            `Stretched + horizon < 5y — extending to about ${ry} years brings stretch under 25%.`,
          );
        }
      } else if (band === "CRITICAL") {
        const sipCap = monthly_income * 0.30;
        const blendedCalc = blendedReturnFor(bucket, allocation);
        const corpus = sipFutureValue(sipCap, blendedCalc, years * 12);
        const ry = solveYearsForStretch(
          target_today,
          monthly_income,
          blendedCalc,
          inflationUsed ?? 0,
          0.25,
        );
        (input as unknown as { _revisedTarget?: number })._revisedTarget = roundTo100(corpus);
        (input as unknown as { _revisedYears?: number })._revisedYears = ry;
        notes.push("Critical: pick a smaller target or extend the horizon.");
      } else if (band === "MODERATE") {
        notes.push("Tip: consider an annual bonus top-up to accelerate progress.");
      }
      break;
    }

    case "vacation": {
      if (band === "EASY") {
        // Shift 10% Gold → Overnight/Liquid for max access
        shiftWeight(allocation, "goldcase", "overnight", 5);
        shiftWeight(allocation, "gold-fof", "liquidcase", 5);
        notes.push("Easy stretch — shifted 10% from gold to overnight/liquid for instant access.");
      } else if (band === "STRETCHED") {
        const sipCap = monthly_income * 0.10;
        const blendedCalc = blendedReturnFor(bucket, allocation);
        const corpus = sipFutureValue(sipCap, blendedCalc, years * 12);
        const ry = solveYearsForStretch(
          target_today,
          monthly_income,
          blendedCalc,
          inflationUsed ?? 0,
          0.10,
        );
        (input as unknown as { _revisedTarget?: number })._revisedTarget = roundTo100(corpus);
        (input as unknown as { _revisedYears?: number })._revisedYears = ry;
        notes.push(
          `Two options: a smaller budget achievable at ~10% income SIP, or saving ~${ry} years for original plan.`,
        );
      } else if (band === "CRITICAL") {
        const sipCap = monthly_income * 0.10;
        const blendedCalc = blendedReturnFor(bucket, allocation);
        const corpus = sipFutureValue(sipCap, blendedCalc, years * 12);
        (input as unknown as { _revisedTarget?: number })._revisedTarget = roundTo100(corpus);
        notes.push(
          `Not feasible at current income. Realistic vacation budget shown as revised target.`,
        );
        // CRITICAL vacation: blank out the allocation (block until revised)
        allocation = [];
      }
      break;
    }

    case "wealth": {
      if (years < 3) {
        notes.push(
          "Wealth goals under 3 years carry high risk. Consider extending to at least 5 years.",
        );
      }
      if (band === "EASY" && bucket === "LONG") {
        bumpMidSmall(allocation, 10);
        notes.push("Easy + Long horizon — added 10% mid+small for higher growth.");
      } else if (band === "EASY" && bucket === "MEDIUM") {
        // Add ZN250 sleeve from lowest-return
        const lo = findLowestReturn(allocation);
        if (lo && lo.fundId !== "largemid250-if") {
          shiftWeight(allocation, lo.fundId, "largemid250-if", 10);
          notes.push("Easy + Medium horizon — added 10% LargeMidcap 250 for a return boost.");
        }
      } else if (band === "STRETCHED") {
        notes.push("Stretched: consider a step-up SIP (10% annual) to close the gap.");
      } else if (band === "CRITICAL") {
        const blendedCalc = blendedReturnFor(bucket, allocation);
        const ry = solveYearsForStretch(
          target_today,
          monthly_income,
          blendedCalc,
          inflationUsed ?? 0,
          0.25,
        );
        (input as unknown as { _revisedYears?: number })._revisedYears = ry;
        notes.push(
          `Critical: at your income, target is reachable in ~${ry} years instead.`,
        );
      }
      // upgrade nudge
      const upgrade = (years === 5 || years === 6) && band === "EASY";
      if (upgrade) {
        notes.push("Adding 1–2 years moves you to the equity-heavy LONG bucket — significantly better expected returns.");
      }
      (input as unknown as { _upgradeToLong?: boolean })._upgradeToLong = upgrade;
      break;
    }

    case "retirement": {
      if (band === "EASY" && years > 10) {
        bumpMidSmall(allocation, 10);
        notes.push("Easy + long horizon — boosted mid+small for max real growth.");
      }
      if (band === "STRETCHED" && years <= 5) {
        notes.push(
          `Retirement in ${years} years requires high % of income. Eliminate other large SIPs.`,
        );
      }
      if (band === "CRITICAL") {
        const sipCap = monthly_income * 0.25;
        const blendedCalc = blendedReturnFor(bucket, allocation);
        const corpus = sipFutureValue(sipCap, blendedCalc, years * 12);
        (input as unknown as { _revisedTarget?: number })._revisedTarget = roundTo100(corpus);
        notes.push(
          "Critical: at ~25% income SIP, the realistic corpus is shown — supplement with other income sources.",
        );
      }
      break;
    }

    case "tax_saving":
      // ELSS 100% — no tilts
      if (years < 3) {
        notes.push("Tax-saving requires a 3-year lock-in per SIP — pick at least 3 years.");
      }
      break;

    case "emergency":
      // Allocation locked
      notes.push("Emergency fund allocation is locked — overnight + liquid + short G-Sec only.");
      break;
  }

  // Recompute blended after tilts (or empty allocation for vacation CRITICAL)
  blended =
    allocation.length === 0
      ? 0
      : kind === "emergency"
        ? EMERGENCY_BLENDED_RETURN
        : blendedReturnFor(bucket, allocation);

  required = allocation.length > 0 ? requiredSip(inflated_target, blended, years * 12) : 0;

  const userSip = monthly_sip ?? null;
  const effectiveSipRaw =
    userSip !== null && userSip > 0 ? userSip : required;
  const effectiveSip = roundUpTo100(effectiveSipRaw);

  const projected =
    allocation.length === 0
      ? 0
      : sipFutureValue(effectiveSip, blended, years * 12);

  stretch = (userSip ?? required) / Math.max(1, monthly_income);
  band = stretchBand(stretch);
  const flag = affordabilityFromStretch(band);

  // Optional outputs
  const revised_target = (input as unknown as { _revisedTarget?: number })._revisedTarget;
  const revised_years = (input as unknown as { _revisedYears?: number })._revisedYears;
  const upgrade_to_long_suggested = (input as unknown as { _upgradeToLong?: boolean })._upgradeToLong;

  let step_up_corpus_10pct: number | undefined;
  if (kind === "wealth" || (kind === "retirement" && years > 5 && band === "STRETCHED")) {
    step_up_corpus_10pct = roundTo100(stepUpFutureValue(effectiveSip, blended, years, 10));
  }

  let monthly_withdrawal_estimate: number | undefined;
  let glide_path_note: string | undefined;
  if (kind === "retirement") {
    monthly_withdrawal_estimate = roundTo100((projected * 0.06) / 12);
    glide_path_note = glidePathNote(years);
  }

  let property_inflation_note: string | undefined;
  if (kind === "home") {
    property_inflation_note = "Property prices assumed to rise at 8% p.a.";
  }

  return {
    goal_kind: kind,
    bucket,
    inflation_used: inflationUsed,
    inflated_target: roundTo100(inflated_target),
    blended_return: Math.round(blended * 10) / 10,
    required_monthly_sip: roundUpTo100(required),
    user_monthly_sip: userSip,
    effective_monthly_sip: effectiveSip,
    projected_corpus: roundTo100(projected),
    surplus_or_deficit: roundTo100(projected - inflated_target),
    on_track: projected >= inflated_target,
    stretch_ratio: Math.round(stretch * 10000) / 10000,
    stretch_band: band,
    affordability_flag: flag,
    allocation: roundAllocation(allocation),
    notes,
    revised_target,
    revised_years,
    step_up_corpus_10pct,
    monthly_withdrawal_estimate,
    glide_path_note,
    upgrade_to_long_suggested,
    suggested_targets,
    existing_savings_offset,
    property_inflation_note,
    vacation_subtype,
    deadline_sensitive: kind === "education",
  };
}

function roundAllocation(alloc: AllocationItem[]): AllocationItem[] {
  // Round to integer percents while preserving sum near 100
  if (alloc.length === 0) return alloc;
  const rounded = alloc.map((a) => ({ ...a, percent: Math.round(a.percent) }));
  const diff = 100 - rounded.reduce((s, a) => s + a.percent, 0);
  if (diff !== 0 && rounded.length > 0) {
    // Adjust the largest sleeve to absorb rounding
    const largest = rounded.reduce((max, a) => (a.percent > max.percent ? a : max), rounded[0]);
    largest.percent += diff;
  }
  return rounded.filter((a) => a.percent > 0);
}
