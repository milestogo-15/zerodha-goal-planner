// Monte Carlo simulation for the "Detailed Analysis" panel.
// Pure module — no React, no I/O. Deterministic given a seed.

import type { AllocationItem } from "./presets";
import { volForFund } from "./volatility";

export interface SimulateInput {
  allocation: AllocationItem[];
  monthlySip: number;
  years: number;
  inflatedTarget: number;
  runs?: number;
  seed?: number;
}

export interface DetailedAnalysis {
  runs: number;
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
  probabilityOfSuccess: number; // 0..1
}

// ─── Seeded PRNG (mulberry32) ────────────────────────────────
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Box-Muller standard normal
function normal(rng: () => number): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

function clampReturn(r: number): number {
  if (r < -60) return -60;
  if (r > 80) return 80;
  return r;
}

function hashSeed(input: SimulateInput): number {
  const s =
    `${input.years}|${input.monthlySip.toFixed(2)}|${input.inflatedTarget.toFixed(2)}|` +
    input.allocation.map((a) => `${a.fundId}:${a.percent.toFixed(2)}`).join(",");
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function simulateGoal(input: SimulateInput): DetailedAnalysis {
  const runs = input.runs ?? 1000;
  const { allocation, monthlySip, years, inflatedTarget } = input;
  const seed = input.seed ?? hashSeed(input);
  const rng = mulberry32(seed);

  // Pre-resolve fund volatilities + per-sleeve SIP amounts
  const sleeves = allocation
    .filter((a) => a.percent > 0)
    .map((a) => {
      const v = volForFund(a.fundId);
      return {
        sip: monthlySip * (a.percent / 100),
        mean: v.mean,
        std: v.stdDev,
        cls: v.class,
      };
    });

  if (sleeves.length === 0 || monthlySip <= 0 || years <= 0) {
    return {
      runs,
      p10: 0,
      p25: 0,
      p50: 0,
      p75: 0,
      p90: 0,
      probabilityOfSuccess: 0,
    };
  }

  const totals = new Float64Array(runs);

  for (let r = 0; r < runs; r++) {
    // Per-sleeve corpus carried across years
    const corpus = new Float64Array(sleeves.length);

    for (let y = 0; y < years; y++) {
      const equityShock = normal(rng);
      const goldShock = normal(rng); // shared idiosyncratic factor for gold/silver

      for (let s = 0; s < sleeves.length; s++) {
        const sl = sleeves[s];
        let annual: number;
        const idio = normal(rng);

        switch (sl.cls) {
          case "equity":
            annual = sl.mean + sl.std * (0.7 * equityShock + 0.3 * idio);
            break;
          case "debt":
            annual = sl.mean + sl.std * (-0.1 * equityShock + 1.0 * idio);
            break;
          case "gold":
            annual = sl.mean + sl.std * (-0.2 * equityShock + 0.98 * goldShock);
            break;
          case "silver":
            // silver ↔ gold +0.6 correlation
            annual = sl.mean + sl.std * (0.6 * goldShock + 0.8 * idio);
            break;
          case "hybrid":
          default:
            annual = sl.mean + sl.std * (0.5 * equityShock + 0.5 * idio);
        }

        annual = clampReturn(annual);
        const monthlyRate = annual / 100 / 12;

        // Compound 12 months: existing corpus + 12 SIP contributions
        let c = corpus[s];
        const sip = sl.sip;
        if (Math.abs(monthlyRate) < 1e-9) {
          c = c + sip * 12;
        } else {
          // existing corpus growth
          c = c * Math.pow(1 + monthlyRate, 12);
          // SIP annuity-due-style: contributions at start of each month
          c += sip * ((Math.pow(1 + monthlyRate, 12) - 1) / monthlyRate) * (1 + monthlyRate);
        }
        corpus[s] = c;
      }
    }

    let total = 0;
    for (let s = 0; s < sleeves.length; s++) total += corpus[s];
    totals[r] = total;
  }

  // Sort + percentiles
  const sorted = Array.from(totals).sort((a, b) => a - b);
  const pct = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];

  let success = 0;
  for (let i = 0; i < sorted.length; i++) if (sorted[i] >= inflatedTarget) success++;

  return {
    runs,
    p10: Math.round(pct(10)),
    p25: Math.round(pct(25)),
    p50: Math.round(pct(50)),
    p75: Math.round(pct(75)),
    p90: Math.round(pct(90)),
    probabilityOfSuccess: success / sorted.length,
  };
}
