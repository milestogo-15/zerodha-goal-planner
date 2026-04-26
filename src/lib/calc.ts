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
