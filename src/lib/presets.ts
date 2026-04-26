import type { Fund } from "./funds";
import { FUNDS, fundById } from "./funds";

export type GoalPresetId =
  | "emergency"
  | "short-park"
  | "tax-saving"
  | "car"
  | "house"
  | "education"
  | "retirement"
  | "wealth"
  | "custom";

export interface AllocationItem {
  fundId: string;
  percent: number; // 0-100
}

export interface GoalPreset {
  id: GoalPresetId;
  name: string;
  icon: string; // lucide name
  tagline: string;
  suggestedYears: [number, number]; // min, max
  allocation: (largeCapFundId: string) => AllocationItem[];
  description: string;
}

// ─── Bucket allocations (per allocation-engine spec) ──────────────
// SHORT (<3y): capital preservation + liquidity → blended ~6.6%
const SHORT_BUCKET: AllocationItem[] = [
  { fundId: "overnight", percent: 30 },
  { fundId: "liquidcase", percent: 30 },
  { fundId: "gsec-short", percent: 20 },
  { fundId: "gold-fof", percent: 10 },
  { fundId: "goldcase", percent: 10 },
];

// MEDIUM (3–7y): inflation-beating + moderate growth → blended ~9.3%
const MEDIUM_BUCKET: AllocationItem[] = [
  { fundId: "multi-asset", percent: 20 },
  { fundId: "largemid250-if", percent: 20 },
  { fundId: "gsec813", percent: 15 },
  { fundId: "gold-fof", percent: 15 },
  { fundId: "silver-fof", percent: 15 },
  { fundId: "silvercase", percent: 8 },
  { fundId: "goldcase", percent: 7 },
];

// LONG (>7y): max real growth, equity-heavy → blended ~13.0%
const LONG_BUCKET = (large: string): AllocationItem[] => [
  { fundId: "largemid250-if", percent: 20 },
  { fundId: "mid150case", percent: 30 }, // absorbs ZE150 (15) + ZMIDS (15) — no MidSmall400 fund
  { fundId: "smallcase", percent: 10 },
  { fundId: "nifty50-if", percent: 10 },
  { fundId: "niftycase", percent: 10 },
  { fundId: large === "sensex-if" ? "sensex-if" : "sensex-if", percent: 8 },
  { fundId: "top100case", percent: 7 },
  { fundId: "goldcase", percent: 5 },
];

// TAX (ELSS): 80C + 3y lock-in → 13.0%
const TAX_BUCKET: AllocationItem[] = [
  { fundId: "elss-largemid250", percent: 100 },
];

export const PRESETS: GoalPreset[] = [
  {
    id: "emergency",
    name: "Emergency Fund",
    icon: "shield",
    tagline: "3–6 months of expenses, instant access",
    suggestedYears: [0, 1],
    description:
      "Forced into the SHORT bucket regardless of horizon — emergency funds must be instantly accessible.",
    allocation: () => SHORT_BUCKET,
  },
  {
    id: "short-park",
    name: "Vacation / Short-Term",
    icon: "wallet",
    tagline: "Goals within 1–3 years",
    suggestedYears: [1, 3],
    description: "SHORT bucket — capital preservation with small gold + short G-Sec hedges.",
    allocation: () => SHORT_BUCKET,
  },
  {
    id: "tax-saving",
    name: "Tax Saving (80C)",
    icon: "receipt",
    tagline: "Save ₹46,800/yr in tax + grow wealth",
    suggestedYears: [3, 10],
    description: "TAX bucket — 100% ELSS for 80C deduction (₹1.5L cap) with 3-year lock-in per SIP.",
    allocation: () => TAX_BUCKET,
  },
  {
    id: "car",
    name: "Car / Down Payment",
    icon: "car",
    tagline: "Mid-term, balanced approach (3–7y)",
    suggestedYears: [3, 7],
    description: "MEDIUM bucket — multi-asset, large/mid equity, G-Sec, and gold/silver mix.",
    allocation: () => MEDIUM_BUCKET,
  },
  {
    id: "house",
    name: "House Purchase",
    icon: "home",
    tagline: "3–7 year accumulation",
    suggestedYears: [3, 7],
    description: "MEDIUM bucket — balanced multi-asset + equity + debt to target your down payment.",
    allocation: () => MEDIUM_BUCKET,
  },
  {
    id: "education",
    name: "Child Education",
    icon: "graduation-cap",
    tagline: "Long horizon, equity-led growth",
    suggestedYears: [7, 15],
    description: "LONG bucket — equity-heavy for compounding (uses MEDIUM if horizon < 7y).",
    allocation: (large) => LONG_BUCKET(large),
  },
  {
    id: "retirement",
    name: "Retirement",
    icon: "palmtree",
    tagline: "15+ year wealth compounding",
    suggestedYears: [15, 40],
    description: "LONG bucket — aggressive equity across caps with gold diversifier.",
    allocation: (large) => LONG_BUCKET(large),
  },
  {
    id: "wealth",
    name: "Wealth Creation",
    icon: "trending-up",
    tagline: "Pure long-term growth, 7+ years",
    suggestedYears: [7, 30],
    description: "LONG bucket — maximum equity exposure with a small gold hedge.",
    allocation: (large) => LONG_BUCKET(large),
  },
  {
    id: "custom",
    name: "Custom",
    icon: "sliders",
    tagline: "Build your own allocation",
    suggestedYears: [1, 30],
    description: "Pick from all 17 funds and set your own percentages.",
    allocation: () => [
      { fundId: "largemid250-if", percent: 60 },
      { fundId: "liquidcase", percent: 30 },
      { fundId: "goldcase", percent: 10 },
    ],
  },
];

export const presetById = (id: GoalPresetId) =>
  PRESETS.find((p) => p.id === id) ?? PRESETS[PRESETS.length - 1];

// Horizon-bucket logic from spec:
//   years < 3   → SHORT
//   years 3–7   → MEDIUM
//   years > 7   → LONG
export function suggestPresetForHorizon(years: number): GoalPresetId {
  if (years < 3) return "short-park";
  if (years <= 7) return "house";
  return "wealth";
}

// Map a preset to its bucket label (for display + audit)
export type Bucket = "SHORT" | "MEDIUM" | "LONG" | "TAX";
export function bucketForPreset(id: GoalPresetId, years: number): Bucket {
  if (id === "tax-saving") return "TAX";
  if (id === "emergency") return "SHORT";
  if (id === "retirement") return years >= 7 ? "LONG" : "MEDIUM";
  if (id === "education" || id === "wealth") return years > 7 ? "LONG" : "MEDIUM";
  if (id === "short-park") return "SHORT";
  if (id === "car" || id === "house") return years > 7 ? "LONG" : years < 3 ? "SHORT" : "MEDIUM";
  // custom / fallback
  if (years < 3) return "SHORT";
  if (years <= 7) return "MEDIUM";
  return "LONG";
}

export const BUCKET_BLENDED_RETURN: Record<Bucket, number> = {
  SHORT: 6.6,
  MEDIUM: 9.3,
  LONG: 13.0,
  TAX: 13.0,
};

// ─── Engine bucket exports ──────────────────────────────────────
// The engine consumes raw bucket allocations + an EMERGENCY-only
// allocation that differs from SHORT (no equity/gold/silver).

export const SHORT_BUCKET_ALLOC: AllocationItem[] = SHORT_BUCKET;
export const MEDIUM_BUCKET_ALLOC: AllocationItem[] = MEDIUM_BUCKET;
export const TAX_BUCKET_ALLOC: AllocationItem[] = TAX_BUCKET;
export const longBucketAlloc = (large: string): AllocationItem[] => LONG_BUCKET(large);

// EMERGENCY: ZOVER 40 / ZLIQD 40 / ZNSDG 20 — blended 6.2%. No equity/gold/silver.
export const EMERGENCY_BUCKET_ALLOC: AllocationItem[] = [
  { fundId: "overnight", percent: 40 },
  { fundId: "liquidcase", percent: 40 },
  { fundId: "gsec-short", percent: 20 },
];

export const EMERGENCY_BLENDED_RETURN = 6.2;

// Preset-id → engine GoalKind. Engine lives in src/lib/engine.ts.
export type GoalKind =
  | "emergency"
  | "vacation"
  | "home"
  | "education"
  | "retirement"
  | "wealth"
  | "tax_saving";

export const PRESET_TO_KIND: Record<GoalPresetId, GoalKind> = {
  emergency: "emergency",
  "short-park": "vacation",
  "tax-saving": "tax_saving",
  car: "home",
  house: "home",
  education: "education",
  retirement: "retirement",
  wealth: "wealth",
  custom: "wealth",
};

// Resolve allocations + attach fund objects, gracefully skip missing
export function resolveAllocation(
  items: AllocationItem[],
): Array<{ fund: Fund; percent: number }> {
  return items
    .map((it) => {
      const fund = fundById(it.fundId);
      return fund ? { fund, percent: it.percent } : null;
    })
    .filter((x): x is { fund: Fund; percent: number } => x !== null);
}

export const ALL_FUND_OPTIONS = FUNDS.map((f) => ({ value: f.id, label: f.shortName }));
