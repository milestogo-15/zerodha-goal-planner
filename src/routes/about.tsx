import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Home } from "lucide-react";

import { fundById } from "@/lib/funds";

export const Route = createFileRoute("/about")({
  component: AboutPage,
  head: () => ({
    meta: [
      { title: "How it works — Zerodha Fund House Planner" },
      {
        name: "description",
        content:
          "Mapping of horizon buckets to Zerodha Fund House products used by the planner.",
      },
    ],
  }),
});

type Row = { fundId: string; weight: number; ret: number };

const SHORT: Row[] = [
  { fundId: "overnight", weight: 30, ret: 6.0 },
  { fundId: "liquidcase", weight: 30, ret: 6.0 },
  { fundId: "gsec-short", weight: 20, ret: 7.0 },
  { fundId: "gold-fof", weight: 10, ret: 8.0 },
  { fundId: "goldcase", weight: 10, ret: 8.0 },
];

const MEDIUM: Row[] = [
  { fundId: "multi-asset", weight: 20, ret: 10.5 },
  { fundId: "largemid250-if", weight: 20, ret: 11.0 },
  { fundId: "gsec813", weight: 15, ret: 7.5 },
  { fundId: "gold-fof", weight: 15, ret: 8.0 },
  { fundId: "silver-fof", weight: 15, ret: 9.0 },
  { fundId: "silvercase", weight: 8, ret: 9.0 },
  { fundId: "goldcase", weight: 7, ret: 8.0 },
];

const LONG: Row[] = [
  { fundId: "largemid250-if", weight: 20, ret: 13.0 },
  { fundId: "mid150case", weight: 30, ret: 14.0 },
  { fundId: "smallcase", weight: 10, ret: 15.0 },
  { fundId: "nifty50-if", weight: 10, ret: 12.0 },
  { fundId: "niftycase", weight: 10, ret: 12.0 },
  { fundId: "sensex-if", weight: 8, ret: 12.0 },
  { fundId: "top100case", weight: 7, ret: 12.0 },
  { fundId: "goldcase", weight: 5, ret: 8.0 },
];

const TAX: Row[] = [{ fundId: "elss-largemid250", weight: 100, ret: 13.0 }];

const EMERGENCY: Row[] = [
  { fundId: "overnight", weight: 40, ret: 6.0 },
  { fundId: "liquidcase", weight: 40, ret: 6.0 },
  { fundId: "gsec-short", weight: 20, ret: 7.0 },
];

const BUCKETS: Array<{
  key: string;
  title: string;
  horizon: string;
  blended: string;
  rows: Row[];
}> = [
  { key: "EMERGENCY", title: "Emergency Bucket", horizon: "Any horizon (locked)", blended: "6.2%", rows: EMERGENCY },
  { key: "SHORT", title: "Short Bucket", horizon: "< 3 years", blended: "6.6%", rows: SHORT },
  { key: "MEDIUM", title: "Medium Bucket", horizon: "3 – 7 years", blended: "9.3%", rows: MEDIUM },
  { key: "LONG", title: "Long Bucket", horizon: "> 7 years", blended: "13.0%", rows: LONG },
  { key: "TAX", title: "Tax Bucket (ELSS)", horizon: "≥ 3 years lock-in", blended: "13.0%", rows: TAX },
];

const INFLATION_REF: Array<{ goal: string; rate: string; reason: string }> = [
  { goal: "Education", rate: "7%", reason: "Tracks standard CPI" },
  { goal: "Home", rate: "8%", reason: "Property appreciation > CPI" },
  { goal: "Vacation (domestic)", rate: "7%", reason: "Standard CPI" },
  { goal: "Vacation (international)", rate: "9%", reason: "INR depreciation + overseas inflation" },
  { goal: "Wealth", rate: "7%", reason: "Real purchasing power target" },
  { goal: "Retirement", rate: "7%", reason: "Standard CPI, long horizon" },
  { goal: "Emergency", rate: "—", reason: "Living-expense buffer, not a future corpus" },
];

function BucketTable({ rows }: { rows: Row[] }) {
  return (
    <div className="mt-3 overflow-hidden rounded-xl border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-3 py-2 text-left font-medium">Fund</th>
            <th className="px-3 py-2 text-right font-medium">Weight</th>
            <th className="px-3 py-2 text-right font-medium">Return</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const f = fundById(r.fundId);
            return (
              <tr key={`${r.fundId}-${i}`} className="border-t border-border/60">
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    {f && (
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: `var(--${f.assetClass})` }}
                      />
                    )}
                    <span className="font-medium text-foreground">
                      {f?.name ?? r.fundId}
                    </span>
                  </div>
                </td>
                <td className="px-3 py-2 text-right tabular-nums font-semibold">
                  {r.weight}%
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                  {r.ret.toFixed(1)}%
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 md:px-6 md:py-12">
      <div className="flex items-center justify-between">
        <Link
          to="/"
          className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to dashboard
        </Link>
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-3.5 py-1.5 text-xs font-semibold text-background transition hover:opacity-90"
        >
          <Home className="h-3.5 w-3.5" /> Home
        </Link>
      </div>

      <h1 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">How it works</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Each goal maps to a horizon bucket. Below is the exact stock-to-bucket mapping used by the planner.
      </p>

      <div className="mt-8 space-y-8">
        {BUCKETS.map((b) => (
          <section key={b.key}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-xl font-semibold">{b.title}</h2>
              <span className="text-xs text-muted-foreground">
                Horizon: <span className="font-medium text-foreground">{b.horizon}</span>
                {" · "}
                Blended return:{" "}
                <span className="font-medium text-foreground">{b.blended}</span>
              </span>
            </div>
            <BucketTable rows={b.rows} />
          </section>
        ))}
      </div>

      <div className="mt-10">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium transition hover:bg-muted"
        >
          <Home className="h-4 w-4" /> Back to home
        </Link>
      </div>
    </div>
  );
}
