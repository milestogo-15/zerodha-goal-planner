// Per-fund volatility profiles for Monte Carlo simulation.
// Means/std-devs from the detailed analysis spec; behaviour notes are user-facing.

export type VolClass = "equity" | "debt" | "gold" | "silver" | "hybrid";

export interface FundVol {
  mean: number; // annual % return
  stdDev: number; // annual % std dev
  class: VolClass;
  note: string;
}

export const FUND_VOLATILITY: Record<string, FundVol> = {
  // Debt
  overnight: {
    mean: 6.0,
    stdDev: 0.3,
    class: "debt",
    note: "Stable. Returns closely track the RBI repo rate.",
  },
  liquidcase: {
    mean: 6.0,
    stdDev: 0.5,
    class: "debt",
    note: "Stable. Returns closely track the RBI repo rate.",
  },
  "gsec-short": {
    mean: 7.0,
    stdDev: 1.5,
    class: "debt",
    note: "Low risk. Small moves with interest rate changes.",
  },
  gsec813: {
    mean: 7.5,
    stdDev: 5.0,
    class: "debt",
    note: "Moderate risk. NAV rises when RBI cuts rates.",
  },
  // Gold
  goldcase: {
    mean: 8.0,
    stdDev: 12.0,
    class: "gold",
    note: "Volatile but defensive. Often rises when equity falls.",
  },
  "gold-fof": {
    mean: 8.0,
    stdDev: 12.0,
    class: "gold",
    note: "Volatile but defensive. Often rises when equity falls.",
  },
  // Silver
  silvercase: {
    mean: 9.0,
    stdDev: 18.0,
    class: "silver",
    note: "High volatility. More speculative than gold.",
  },
  "silver-fof": {
    mean: 9.0,
    stdDev: 18.0,
    class: "silver",
    note: "High volatility. More speculative than gold.",
  },
  // Hybrid
  "multi-asset": {
    mean: 10.5,
    stdDev: 7.0,
    class: "hybrid",
    note: "Balanced. Built-in diversification reduces big swings.",
  },
  // Large-cap equity
  "nifty50-if": {
    mean: 12.0,
    stdDev: 14.0,
    class: "equity",
    note: "Steady equity. Lower swings than mid/small.",
  },
  niftycase: {
    mean: 12.0,
    stdDev: 14.0,
    class: "equity",
    note: "Steady equity. Lower swings than mid/small.",
  },
  "sensex-if": {
    mean: 12.0,
    stdDev: 14.0,
    class: "equity",
    note: "Steady equity. Lower swings than mid/small.",
  },
  top100case: {
    mean: 12.0,
    stdDev: 14.0,
    class: "equity",
    note: "Steady equity. Lower swings than mid/small.",
  },
  // LargeMid / ELSS
  "largemid250-if": {
    mean: 13.0,
    stdDev: 16.0,
    class: "equity",
    note: "Medium-high volatility. Midcap adds meaningful upside.",
  },
  "elss-largemid250": {
    mean: 13.0,
    stdDev: 16.0,
    class: "equity",
    note: "Medium-high volatility. 3-year lock-in prevents panic selling.",
  },
  // Mid / Small
  mid150case: {
    mean: 14.0,
    stdDev: 20.0,
    class: "equity",
    note: "High volatility. Expect 20–30% swings in bad years.",
  },
  smallcase: {
    mean: 15.0,
    stdDev: 25.0,
    class: "equity",
    note: "Highest volatility. Drops hard but recovers strongest over 10+ year horizons.",
  },
};

export function volForFund(fundId: string): FundVol {
  return (
    FUND_VOLATILITY[fundId] ?? {
      mean: 10,
      stdDev: 10,
      class: "equity",
      note: "Returns will vary year to year.",
    }
  );
}

export function volatilityNoteForBucket(
  bucket: "SHORT" | "MEDIUM" | "LONG" | "TAX" | "EMERGENCY",
): string {
  switch (bucket) {
    case "SHORT":
    case "EMERGENCY":
      return "Your portfolio is very stable. Expected range is narrow — market conditions have little impact.";
    case "MEDIUM":
      return "Moderate variability. Gold and G-Sec act as cushions in bad equity years.";
    case "LONG":
      return "High variability expected year-to-year, especially from Midcap and Smallcap funds. This is normal — stay invested through downturns.";
    case "TAX":
      return "ELSS is equity — expect significant swings. The 3-year lock-in prevents panic selling, which historically works in your favour.";
  }
}
