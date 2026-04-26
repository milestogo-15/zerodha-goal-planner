import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/about")({
  component: AboutPage,
  head: () => ({
    meta: [
      { title: "How it works — Zerodha Fund House Planner" },
      {
        name: "description",
        content:
          "How the goal-based investing planner allocates across Zerodha funds and projects growth.",
      },
    ],
  }),
});

function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 md:px-6 md:py-12">
      <Link
        to="/"
        className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground transition hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to dashboard
      </Link>
      <h1 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">How it works</h1>

      <div className="prose mt-6 max-w-none text-foreground/85">
        <h2 className="mt-8 text-xl font-semibold">Goal-type presets</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Each goal you add maps to a preset (Emergency Fund, Retirement, Child Education, etc.).
          Presets choose a tailored allocation across Zerodha Fund House products based on horizon
          and risk profile. You can switch presets or build a custom mix anytime.
        </p>

        <h2 className="mt-8 text-xl font-semibold">Allocation engine</h2>
        <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
          <li>
            <strong className="text-foreground">Short term (&lt;3y):</strong> dominated by{" "}
            <em>LIQUIDCASE</em> with a Gold sliver for inflation hedge.
          </li>
          <li>
            <strong className="text-foreground">Medium term (3–7y):</strong> balanced equity-debt
            with Nifty 50 / SENSEX, G-Sec, and Gold.
          </li>
          <li>
            <strong className="text-foreground">Long term (&gt;7y):</strong> equity-heavy with
            LargeMidcap 250, Nifty 50, Smallcap and commodities.
          </li>
          <li>
            <strong className="text-foreground">Tax saving:</strong> ELSS LargeMidcap 250 (3-year
            lock-in, 80C deduction).
          </li>
        </ul>

        <h2 className="mt-8 text-xl font-semibold">Return assumptions</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Projections compound monthly using historical-average CAGRs:
        </p>
        <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
          <li>Equity (Nifty 50 / SENSEX) — 12%</li>
          <li>Equity (LargeMidcap 250) — 13%</li>
          <li>Equity (Midcap 150) — 14%, Smallcap — 15%</li>
          <li>Debt (LIQUIDCASE / Overnight) — 6%</li>
          <li>Debt (G-Sec funds) — 7–7.5%</li>
          <li>Gold — 8%, Silver — 9%</li>
          <li>Multi-Asset FoF — 10.5%</li>
        </ul>

        <h2 className="mt-8 text-xl font-semibold">Math</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Each sleeve compounds independently using the standard SIP future-value formula
          <code className="mx-1 rounded bg-surface px-1.5 py-0.5 text-xs">
            FV = P × ((1+r)<sup>n</sup> − 1) / r × (1+r)
          </code>
          where <em>r</em> is the monthly rate and <em>n</em> is months. Total corpus = sum across
          sleeves.
        </p>

        <h2 className="mt-8 text-xl font-semibold">Disclaimer</h2>
        <p className="mt-2 rounded-xl border border-border bg-warning-soft px-4 py-3 text-sm leading-relaxed text-foreground/80">
          This is an educational tool, not investment advice. Past performance does not guarantee
          future returns. Verify all fund details, expense ratios and risks on{" "}
          <a
            className="underline underline-offset-2 hover:text-foreground"
            href="https://www.zerodhafundhouse.com/"
            target="_blank"
            rel="noreferrer"
          >
            zerodhafundhouse.com
          </a>{" "}
          before investing. Mutual fund investments are subject to market risks.
        </p>
      </div>
    </div>
  );
}
