import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ExternalLink } from "lucide-react";

import { FUNDS, assetClassLabel, type AssetClass } from "@/lib/funds";

export const Route = createFileRoute("/funds")({
  component: FundsLibrary,
  head: () => ({
    meta: [
      { title: "Fund library — Zerodha Fund House Planner" },
      {
        name: "description",
        content:
          "Browse all 17 Zerodha Fund House products: index funds, ETFs, FoFs across equity, debt, gold, silver and hybrid.",
      },
    ],
  }),
});

const FILTERS: Array<{ id: "all" | AssetClass; label: string }> = [
  { id: "all", label: "All" },
  { id: "equity", label: "Equity" },
  { id: "debt", label: "Debt" },
  { id: "gold", label: "Gold" },
  { id: "silver", label: "Silver" },
  { id: "hybrid", label: "Hybrid" },
];

function FundsLibrary() {
  const [filter, setFilter] = useState<"all" | AssetClass>("all");
  const list = FUNDS.filter((f) => filter === "all" || f.assetClass === filter);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:px-6 md:py-12">
      <Link
        to="/"
        className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground transition hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to dashboard
      </Link>
      <h1 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">Fund library</h1>
      <p className="mt-2 max-w-2xl text-muted-foreground">
        All 17 Zerodha Fund House products from the Feb 2026 factsheet, grouped by asset class.
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
              filter === f.id
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-foreground/70 hover:text-foreground"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {list.map((f) => (
          <article
            key={f.id}
            className="rounded-2xl border border-border bg-card p-5 shadow-sm transition hover:shadow-md"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <span
                  className="inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
                  style={{
                    backgroundColor: `color-mix(in oklab, var(--${f.assetClass}) 15%, transparent)`,
                    color: `var(--${f.assetClass})`,
                  }}
                >
                  {assetClassLabel[f.assetClass]} · {f.category}
                </span>
                <h2 className="mt-2 text-base font-semibold leading-snug">{f.name}</h2>
                {f.ticker && (
                  <p className="mt-0.5 text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
                    {f.ticker}
                  </p>
                )}
              </div>
              <a
                href={f.url}
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-border bg-card p-2 text-foreground/70 transition hover:text-primary"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">{f.description}</p>
            <dl className="mt-4 grid grid-cols-3 gap-3 border-t border-border pt-3 text-xs">
              <div>
                <dt className="text-muted-foreground">Expense</dt>
                <dd className="mt-0.5 font-semibold tabular-nums">{f.expenseRatio}%</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">AUM</dt>
                <dd className="mt-0.5 font-semibold tabular-nums">₹{f.aum.toFixed(1)} Cr</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Assumed CAGR</dt>
                <dd className="mt-0.5 font-semibold tabular-nums">~{f.assumedCagr}%</dd>
              </div>
            </dl>
            <p className="mt-3 text-[11px] text-muted-foreground">Benchmark: {f.benchmark}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
