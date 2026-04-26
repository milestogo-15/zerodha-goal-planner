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

export const PRESETS: GoalPreset[] = [
  {
    id: "emergency",
    name: "Emergency Fund",
    icon: "shield",
    tagline: "3–6 months of expenses, instant access",
    suggestedYears: [0, 1],
    description: "Mostly liquid for instant access, with tiny gold + short G-Sec hedges.",
    allocation: () => [
      { fundId: "liquidcase", percent: 80 },
      { fundId: "goldcase", percent: 10 },
      { fundId: "gsec813", percent: 10 },
    ],
  },
  {
    id: "short-park",
    name: "Short-Term Parking",
    icon: "wallet",
    tagline: "Goals within 1–3 years",
    suggestedYears: [1, 3],
    description: "Capital preservation with a sliver of gold and short G-Sec for inflation.",
    allocation: () => [
      { fundId: "liquidcase", percent: 80 },
      { fundId: "goldcase", percent: 10 },
      { fundId: "gsec813", percent: 10 },
    ],
  },
  {
    id: "tax-saving",
    name: "Tax Saving (80C)",
    icon: "receipt",
    tagline: "Save ₹46,800/yr in tax + grow wealth",
    suggestedYears: [3, 10],
    description: "ELSS gives 80C deduction (up to ₹1.5L) and 3-year lock-in.",
    allocation: () => [{ fundId: "elss-largemid250", percent: 100 }],
  },
  {
    id: "car",
    name: "Car / Down Payment",
    icon: "car",
    tagline: "Mid-term, balanced approach",
    suggestedYears: [3, 5],
    description: "Tilted toward debt with modest equity for growth.",
    allocation: (large) => [
      { fundId: large, percent: 30 },
      { fundId: "liquidcase", percent: 50 },
      { fundId: "goldcase", percent: 10 },
      { fundId: "gsec813", percent: 10 },
    ],
  },
  {
    id: "house",
    name: "House Purchase",
    icon: "home",
    tagline: "5–7 year accumulation",
    suggestedYears: [5, 7],
    description: "Balanced equity-debt mix targeting your down payment.",
    allocation: (large) => [
      { fundId: large, percent: 40 },
      { fundId: "largemid250-if", percent: 20 },
      { fundId: "gsec813", percent: 20 },
      { fundId: "goldcase", percent: 10 },
      { fundId: "liquidcase", percent: 10 },
    ],
  },
  {
    id: "education",
    name: "Child Education",
    icon: "graduation-cap",
    tagline: "Long horizon, growth + stability",
    suggestedYears: [7, 15],
    description: "Equity-heavy for long compounding with multi-asset cushion.",
    allocation: (large) => [
      { fundId: "largemid250-if", percent: 50 },
      { fundId: large, percent: 20 },
      { fundId: "multi-asset", percent: 10 },
      { fundId: "goldcase", percent: 10 },
      { fundId: "gsec813", percent: 10 },
    ],
  },
  {
    id: "retirement",
    name: "Retirement",
    icon: "palmtree",
    tagline: "15+ year wealth compounding",
    suggestedYears: [15, 40],
    description: "Aggressive growth across cap sizes with commodity diversification.",
    allocation: (large) => [
      { fundId: "largemid250-if", percent: 55 },
      { fundId: large, percent: 20 },
      { fundId: "smallcase", percent: 10 },
      { fundId: "goldcase", percent: 10 },
      { fundId: "silvercase", percent: 5 },
    ],
  },
  {
    id: "wealth",
    name: "Wealth Creation",
    icon: "trending-up",
    tagline: "Pure long-term growth, 7+ years",
    suggestedYears: [7, 30],
    description: "Maximum equity exposure with a small gold hedge.",
    allocation: (large) => [
      { fundId: "largemid250-if", percent: 70 },
      { fundId: large, percent: 20 },
      { fundId: "goldcase", percent: 10 },
    ],
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

export function suggestPresetForHorizon(years: number): GoalPresetId {
  if (years < 1) return "emergency";
  if (years < 3) return "short-park";
  if (years <= 5) return "car";
  if (years <= 7) return "house";
  if (years <= 15) return "education";
  return "retirement";
}

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
