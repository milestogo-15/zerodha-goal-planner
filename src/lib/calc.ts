import type { AllocationItem } from "./presets";
import { resolveAllocation } from "./presets";

// Future value of monthly SIP compounded monthly
// FV = P * [((1+r)^n - 1) / r] * (1+r)
// r = monthly rate, n = months
export function sipFutureValue(monthly: number, annualRatePct: number, months: number): number {
  if (months <= 0 || monthly <= 0) return 0;
  const r = annualRatePct / 100 / 12;
  if (r === 0) return monthly * months;
  const factor = (Math.pow(1 + r, months) - 1) / r;
  return monthly * factor * (1 + r);
}

// Solve required monthly SIP to reach target
export function requiredSip(target: number, annualRatePct: number, months: number): number {
  if (months <= 0) return target;
  const r = annualRatePct / 100 / 12;
  if (r === 0) return target / months;
  const factor = (Math.pow(1 + r, months) - 1) / r;
  return target / (factor * (1 + r));
}

// Default inflation assumption for India (CPI long-term average)
export const DEFAULT_INFLATION_PCT = 6;

// Inflate a present-value target to its future nominal value
export function inflateTarget(
  target: number,
  years: number,
  inflationPct: number = DEFAULT_INFLATION_PCT,
): number {
  if (years <= 0) return target;
  return target * Math.pow(1 + inflationPct / 100, years);
}

export function blendedCagr(items: AllocationItem[]): number {
  const resolved = resolveAllocation(items);
  const totalPct = resolved.reduce((s, x) => s + x.percent, 0) || 1;
  return resolved.reduce((s, x) => s + x.fund.assumedCagr * (x.percent / totalPct), 0);
}

// Monthly projection across the goal horizon (in years)
export interface ProjectionPoint {
  month: number;
  year: number;
  invested: number;
  corpus: number;
  // per-asset-class breakdown
  equity: number;
  debt: number;
  gold: number;
  silver: number;
  hybrid: number;
}

export function projectGrowth(
  monthly: number,
  items: AllocationItem[],
  years: number,
  cagrAdjust = 0,
): ProjectionPoint[] {
  const months = Math.max(1, Math.round(years * 12));
  const resolved = resolveAllocation(items);
  const totalPct = resolved.reduce((s, x) => s + x.percent, 0) || 1;

  const sleeves = resolved.map((it) => ({
    monthly: monthly * (it.percent / totalPct),
    rate: (it.fund.assumedCagr + cagrAdjust) / 100 / 12,
    assetClass: it.fund.assetClass,
    balance: 0,
  }));

  const points: ProjectionPoint[] = [];
  for (let m = 1; m <= months; m++) {
    let totals = { equity: 0, debt: 0, gold: 0, silver: 0, hybrid: 0 };
    for (const s of sleeves) {
      s.balance = (s.balance + s.monthly) * (1 + s.rate);
      totals[s.assetClass] += s.balance;
    }
    const corpus =
      totals.equity + totals.debt + totals.gold + totals.silver + totals.hybrid;
    if (m % 3 === 0 || m === months) {
      points.push({
        month: m,
        year: +(m / 12).toFixed(2),
        invested: monthly * m,
        corpus,
        ...totals,
      });
    }
  }
  return points;
}

// ───────────────────────────────────────────────────────────
// Engine helpers
// ───────────────────────────────────────────────────────────

// Step-up SIP future value: SIP increases by stepUpPct% each year.
// step_up_corpus = Σ over each year i of [ (annual SIP for that year) compounded for remaining years ]
// We sum each year's 12-month SIP slab compounded monthly for the remaining months.
export function stepUpFutureValue(
  initialMonthlySip: number,
  annualRatePct: number,
  years: number,
  stepUpPct = 10,
): number {
  if (years <= 0 || initialMonthlySip <= 0) return 0;
  const r = annualRatePct / 100 / 12;
  const stepFactor = 1 + stepUpPct / 100;
  let total = 0;
  for (let i = 0; i < years; i++) {
    const sipThisYear = initialMonthlySip * Math.pow(stepFactor, i);
    // FV of 12 monthly contributions at end of this year, then compound for (years - i - 1) more years
    const contributionsThisYear =
      r === 0
        ? sipThisYear * 12
        : sipThisYear * (((Math.pow(1 + r, 12) - 1) / r) * (1 + r));
    const remainingMonths = (years - i - 1) * 12;
    const compounded =
      r === 0 ? contributionsThisYear : contributionsThisYear * Math.pow(1 + r, remainingMonths);
    total += compounded;
  }
  return total;
}

// Solve for years needed so that required_SIP / monthly_income equals targetStretch.
// Iterative: required_SIP shrinks as years grow. We bisect on years ∈ [1, 60].
export function solveYearsForStretch(
  presentTarget: number,
  monthlyIncome: number,
  blendedReturnPct: number,
  inflationPct: number,
  targetStretch: number,
): number {
  if (presentTarget <= 0 || monthlyIncome <= 0 || targetStretch <= 0) return 0;
  const ratio = (years: number) => {
    const inflated = inflateTarget(presentTarget, years, inflationPct);
    const sip = requiredSip(inflated, blendedReturnPct, years * 12);
    return sip / monthlyIncome;
  };
  let lo = 1;
  let hi = 60;
  // Ensure a solution bracket exists
  if (ratio(hi) > targetStretch) return hi; // even 60y can't bring stretch below target
  if (ratio(lo) <= targetStretch) return lo;
  for (let i = 0; i < 50; i++) {
    const mid = (lo + hi) / 2;
    if (ratio(mid) > targetStretch) lo = mid;
    else hi = mid;
  }
  return Math.ceil(hi);
}

export function roundTo100(n: number): number {
  if (!isFinite(n)) return 0;
  return Math.round(n / 100) * 100;
}

export function roundUpTo100(n: number): number {
  if (!isFinite(n) || n <= 0) return 0;
  return Math.ceil(n / 100) * 100;
}

export function formatINR(n: number): string {
  if (!isFinite(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 1e7) return `₹${(n / 1e7).toFixed(2)} Cr`;
  if (abs >= 1e5) return `₹${(n / 1e5).toFixed(2)} L`;
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

export function formatINRPlain(n: number): string {
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

