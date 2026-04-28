import { useMemo, useState } from "react";
import { createFileRoute, useNavigate, Link, notFound } from "@tanstack/react-router";
import {
  ArrowLeft,
  ExternalLink,
  Trash2,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { useGoals, useSettings } from "@/lib/store";
import { presetById, PRESET_TO_KIND } from "@/lib/presets";
import { fundById, FUNDS } from "@/lib/funds";
import {
  blendedCagr,
  formatINR,
  formatINRPlain,
  projectGrowth,
  requiredSip,
  sipFutureValue,
} from "@/lib/calc";
import { evaluateGoal } from "@/lib/engine";
import { DetailedAnalysis } from "@/components/DetailedAnalysis";

export const Route = createFileRoute("/goals/$goalId")({
  component: GoalDetail,
  head: () => ({
    meta: [{ title: "Goal detail — Zerodha Fund House Planner" }],
  }),
  notFoundComponent: () => (
    <div className="mx-auto max-w-2xl px-6 py-20 text-center">
      <h1 className="text-3xl font-bold">Goal not found</h1>
      <p className="mt-2 text-muted-foreground">
        It may have been deleted, or this link is from a different browser.
      </p>
      <Button asChild className="mt-6 rounded-full">
        <Link to="/">Back to dashboard</Link>
      </Button>
    </div>
  ),
});

function GoalDetail() {
  const { goalId } = Route.useParams();
  const navigate = useNavigate();
  const { goals, updateGoal, deleteGoal } = useGoals();
  const { settings } = useSettings();
  const [scenario, setScenario] = useState<"base" | "optimistic" | "pessimistic">("base");

  const goal = goals.find((g) => g.id === goalId);
  if (!goal) throw notFound();

  const preset = presetById(goal.presetId);
  const cagr = blendedCagr(goal.allocation);
  const cagrAdjust = scenario === "optimistic" ? 2 : scenario === "pessimistic" ? -2 : 0;
  const projected = sipFutureValue(goal.monthlySip, cagr + cagrAdjust, goal.years * 12);
  const onTrack = projected >= goal.targetAmount;
  const reqSip = requiredSip(goal.targetAmount, cagr, goal.years * 12);
  const totalInvested = goal.monthlySip * goal.years * 12;

  const engine = useMemo(
    () =>
      evaluateGoal({
        kind: PRESET_TO_KIND[goal.presetId],
        target_today: goal.targetAmount,
        years: goal.years,
        monthly_income: settings.monthlyIncome || 0,
        monthly_sip: goal.monthlySip || null,
        largeCapFundId: settings.largeCapFundId,
      }),
    [goal.presetId, goal.targetAmount, goal.years, goal.monthlySip, settings.monthlyIncome, settings.largeCapFundId],
  );

  const data = useMemo(
    () => projectGrowth(goal.monthlySip, goal.allocation, goal.years, cagrAdjust),
    [goal.monthlySip, goal.allocation, goal.years, cagrAdjust],
  );

  const totalPct = goal.allocation.reduce((s, a) => s + a.percent, 0);

  const updateAllocation = (fundId: string, nextPercent: number) => {
    const current = goal.allocation;
    if (current.length === 1) {
      updateGoal(goal.id, { allocation: [{ ...current[0], percent: 100 }] });
      return;
    }

    const target = Math.max(0, Math.min(100, Math.round(nextPercent)));
    const others = current.filter((a) => a.fundId !== fundId);
    const othersTotal = others.reduce((s, a) => s + a.percent, 0);
    const remaining = 100 - target;

    let nextOthers: typeof others;
    if (othersTotal <= 0) {
      const base = Math.floor(remaining / others.length);
      nextOthers = others.map((a) => ({ ...a, percent: base }));
    } else {
      nextOthers = others.map((a) => ({
        ...a,
        percent: Math.max(0, Math.round((a.percent / othersTotal) * remaining)),
      }));
    }

    const built = current.map((a) =>
      a.fundId === fundId
        ? { ...a, percent: target }
        : nextOthers.find((n) => n.fundId === a.fundId)!,
    );
    const drift = 100 - built.reduce((s, a) => s + a.percent, 0);
    if (drift !== 0) {
      const candidates = built
        .filter((a) => a.fundId !== fundId)
        .sort((x, y) => y.percent - x.percent);
      for (const c of candidates) {
        const adjusted = c.percent + drift;
        if (adjusted >= 0 && adjusted <= 100) {
          c.percent = adjusted;
          break;
        }
      }
    }

    updateGoal(goal.id, { allocation: built });
  };

  const removeFund = (fundId: string) => {
    updateGoal(goal.id, { allocation: goal.allocation.filter((a) => a.fundId !== fundId) });
  };

  const addFund = (fundId: string) => {
    if (goal.allocation.some((a) => a.fundId === fundId)) return;
    updateGoal(goal.id, { allocation: [...goal.allocation, { fundId, percent: 5 }] });
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:px-6 md:py-12">
      <Link
        to="/"
        className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground transition hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to dashboard
      </Link>

      {/* Header */}
      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">
            {preset.name}
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight md:text-4xl">{goal.name}</h1>
        </div>
        <Button
          variant="ghost"
          className="text-muted-foreground hover:text-destructive"
          onClick={() => {
            deleteGoal(goal.id);
            toast.success("Goal deleted");
            navigate({ to: "/" });
          }}
        >
          <Trash2 className="h-4 w-4" /> Delete goal
        </Button>
      </div>

      {/* KPI strip */}
      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Target" value={formatINR(goal.targetAmount)} />
        <Kpi label="Horizon" value={`${goal.years} years`} />
        <Kpi label="Monthly SIP" value={formatINRPlain(goal.monthlySip)} />
        <Kpi
          label="Projected corpus"
          value={formatINR(projected)}
          accent={onTrack ? "success" : "warning"}
        />
      </div>

      {/* Status banner */}
      <div
        className={`mt-4 flex items-center gap-3 rounded-xl px-4 py-3 text-sm ring-1 ${
          onTrack
            ? "bg-success-soft text-success ring-success/30"
            : "bg-warning-soft text-warning-foreground ring-warning/40"
        }`}
      >
        {onTrack ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
        <span className="font-medium">
          {onTrack
            ? `On track — projected surplus of ${formatINR(projected - goal.targetAmount)}.`
            : `Shortfall of ${formatINR(goal.targetAmount - projected)}. Increase SIP to ${formatINRPlain(
                Math.ceil(reqSip / 100) * 100,
              )} to hit target.`}
        </span>
      </div>

      {/* Affordability banner (engine) */}
      <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface/60 px-4 py-3 text-sm">
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${
            engine.stretch_band === "EASY"
              ? "bg-success-soft text-success ring-success/30"
              : engine.stretch_band === "MODERATE"
                ? "bg-muted text-foreground ring-border"
                : engine.stretch_band === "STRETCHED"
                  ? "bg-warning-soft text-warning-foreground ring-warning/40"
                  : "bg-destructive/10 text-destructive ring-destructive/30"
          }`}
        >
          {engine.stretch_band}
        </span>
        <span className="text-muted-foreground">
          Required SIP is{" "}
          <span className="font-semibold text-foreground">
            {(engine.stretch_ratio * 100).toFixed(1)}%
          </span>{" "}
          of your monthly income · inflation{" "}
          <span className="font-semibold text-foreground">
            {engine.inflation_used === null ? "not applied" : `${engine.inflation_used}%`}
          </span>{" "}
          · bucket{" "}
          <span className="font-semibold text-foreground">{engine.bucket}</span>
        </span>
      </div>

      {/* Insights from engine */}
      {(engine.notes.length > 0 ||
        engine.glide_path_note ||
        engine.monthly_withdrawal_estimate ||
        engine.step_up_corpus_10pct ||
        engine.revised_target ||
        engine.revised_years ||
        engine.upgrade_to_long_suggested) && (
        <div className="mt-4 rounded-2xl border border-border bg-card p-5 shadow-sm md:p-6">
          <h2 className="text-lg font-semibold">Insights</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {engine.notes.map((n, i) => (
              <li key={i} className="flex gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                <span className="text-muted-foreground">{n}</span>
              </li>
            ))}
            {engine.glide_path_note && (
              <li className="flex gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-info" />
                <span>
                  <span className="font-medium">Glide path:</span>{" "}
                  <span className="text-muted-foreground">{engine.glide_path_note}</span>
                </span>
              </li>
            )}
            {engine.monthly_withdrawal_estimate ? (
              <li className="flex gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-success" />
                <span>
                  <span className="font-medium">Withdrawal estimate:</span>{" "}
                  <span className="text-muted-foreground">
                    ~{formatINRPlain(engine.monthly_withdrawal_estimate)}/mo at a 6% safe
                    withdrawal rate (≈ 20 years post-retirement).
                  </span>
                </span>
              </li>
            ) : null}
            {engine.step_up_corpus_10pct ? (
              <li className="flex gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-warning" />
                <span>
                  <span className="font-medium">Step-up SIP (+10%/yr):</span>{" "}
                  <span className="text-muted-foreground">
                    Optimistic corpus of {formatINR(engine.step_up_corpus_10pct)} if you raise
                    your SIP by 10% every year.
                  </span>
                </span>
              </li>
            ) : null}
            {engine.revised_target ? (
              <li className="flex flex-wrap items-center gap-2">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-destructive" />
                <span>
                  <span className="font-medium">Revised target:</span>{" "}
                  <span className="text-muted-foreground">
                    {formatINR(engine.revised_target)} fits your income better.
                  </span>
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  className="ml-2 h-7 rounded-full text-xs"
                  onClick={() => {
                    updateGoal(goal.id, { targetAmount: engine.revised_target! });
                    toast.success("Target updated");
                  }}
                >
                  Apply
                </Button>
              </li>
            ) : null}
            {engine.revised_years ? (
              <li className="flex flex-wrap items-center gap-2">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-destructive" />
                <span>
                  <span className="font-medium">Revised horizon:</span>{" "}
                  <span className="text-muted-foreground">
                    Extending to {engine.revised_years} years brings stretch under 25%.
                  </span>
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  className="ml-2 h-7 rounded-full text-xs"
                  onClick={() => {
                    updateGoal(goal.id, { years: engine.revised_years! });
                    toast.success("Horizon updated");
                  }}
                >
                  Apply
                </Button>
              </li>
            ) : null}
            {engine.upgrade_to_long_suggested ? (
              <li className="flex gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                <span className="text-muted-foreground">
                  Adding 1–2 years moves you to the equity-heavy LONG bucket — significantly
                  better expected returns.
                </span>
              </li>
            ) : null}
          </ul>
        </div>
      )}

      {/* Detailed Analysis (Monte Carlo) */}
      <div className="mt-4">
        <DetailedAnalysis result={engine} years={goal.years} />
      </div>

      {/* Edit basics */}
      <div className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-sm md:p-6">
        <h2 className="text-lg font-semibold">Adjust goal</h2>
        <div className="mt-4 grid gap-5 md:grid-cols-3">
          <div>
            <Label htmlFor="g-target">Target (₹)</Label>
            <Input
              id="g-target"
              className="mt-1.5"
              inputMode="numeric"
              value={goal.targetAmount || ""}
              onChange={(e) =>
                updateGoal(goal.id, {
                  targetAmount: parseInt(e.target.value.replace(/\D/g, ""), 10) || 0,
                })
              }
            />
          </div>
          <div>
            <Label htmlFor="g-years">Years</Label>
            <Input
              id="g-years"
              className="mt-1.5"
              inputMode="numeric"
              value={goal.years || ""}
              onChange={(e) =>
                updateGoal(goal.id, {
                  years: Math.max(0, Math.min(50, parseInt(e.target.value, 10) || 0)),
                })
              }
            />
          </div>
          <div>
            <Label htmlFor="g-sip">Monthly SIP (₹)</Label>
            <Input
              id="g-sip"
              className="mt-1.5"
              inputMode="numeric"
              value={goal.monthlySip || ""}
              onChange={(e) =>
                updateGoal(goal.id, {
                  monthlySip: parseInt(e.target.value.replace(/\D/g, ""), 10) || 0,
                })
              }
            />
          </div>
        </div>
      </div>

      {/* Growth chart */}
      <div className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-sm md:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Growth projection</h2>
            <p className="text-sm text-muted-foreground">
              Blended {(cagr + cagrAdjust).toFixed(1)}% p.a. compounding monthly · invested{" "}
              {formatINR(totalInvested)} over {goal.years}y
            </p>
          </div>
          <div className="flex rounded-full border border-border bg-card p-0.5 text-xs font-medium">
            {(["pessimistic", "base", "optimistic"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setScenario(s)}
                className={`rounded-full px-3 py-1.5 transition ${
                  scenario === s ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {s === "base" ? "Base" : s === "optimistic" ? "Optimistic +2%" : "Pessimistic −2%"}
              </button>
            ))}
          </div>
        </div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="corpusFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="investedFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--info)" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="var(--info)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis
                dataKey="year"
                tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                tickFormatter={(v) => `${v}y`}
              />
              <YAxis
                tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                tickFormatter={(v) => formatINR(v)}
                width={70}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: 12,
                  border: "1px solid var(--border)",
                  background: "var(--card)",
                  color: "var(--foreground)",
                  fontSize: 12,
                }}
                formatter={(v: number, name) => [formatINR(v), name === "corpus" ? "Corpus" : "Invested"]}
                labelFormatter={(v) => `Year ${v}`}
              />
              <ReferenceLine
                y={goal.targetAmount}
                stroke="var(--success)"
                strokeDasharray="4 4"
                label={{
                  value: `Target ${formatINR(goal.targetAmount)}`,
                  position: "insideTopRight",
                  fill: "var(--success)",
                  fontSize: 11,
                }}
              />
              <Area
                type="monotone"
                dataKey="invested"
                stroke="var(--info)"
                fill="url(#investedFill)"
                strokeWidth={1.5}
              />
              <Area
                type="monotone"
                dataKey="corpus"
                stroke="var(--primary)"
                fill="url(#corpusFill)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Allocation */}
      <div className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-sm md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold">Recommended allocation</h2>
            <p className="text-sm text-muted-foreground">
              Edit percentages — totals should sum to 100% ({totalPct}% currently).
            </p>
          </div>
          <LargeCapToggle />
        </div>

        <div className="mt-5 space-y-4">
          {goal.allocation.map((a) => {
            const f = fundById(a.fundId);
            if (!f) return null;
            const monthly = (goal.monthlySip * a.percent) / 100;
            return (
              <div
                key={a.fundId}
                className="rounded-xl border border-border bg-surface/60 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <span
                      className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: `var(--${f.assetClass})` }}
                    />
                    <div>
                      <p className="text-sm font-semibold">{f.name}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {f.category} · Expense {f.expenseRatio}% · ~{f.assumedCagr}% assumed CAGR
                        {f.ticker ? ` · ${f.ticker}` : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-base font-bold tabular-nums">{a.percent}%</p>
                      <p className="text-[11px] text-muted-foreground">{formatINRPlain(monthly)}/mo</p>
                    </div>
                    <a
                      href={f.url}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-full border border-border bg-card p-2 text-foreground/70 transition hover:text-primary"
                      title="Invest on Zerodha Fund House"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                    <button
                      onClick={() => removeFund(a.fundId)}
                      className="rounded-full border border-border bg-card p-2 text-foreground/60 transition hover:text-destructive"
                      title="Remove fund"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <div className="mt-3">
                  <Slider
                    min={0}
                    max={100}
                    step={1}
                    value={[a.percent]}
                    onValueChange={(v) => updateAllocation(a.fundId, v[0])}
                  />
                </div>
              </div>
            );
          })}
        </div>

        <AddFundPicker existingIds={goal.allocation.map((a) => a.fundId)} onAdd={addFund} />

        {totalPct !== 100 && (
          <p className="mt-4 rounded-md bg-warning-soft px-3 py-2 text-xs text-warning-foreground">
            Allocation totals {totalPct}%. Aim for 100% — projections still work but may
            under/over-state results.
          </p>
        )}
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: "success" | "warning";
}) {
  const color =
    accent === "success" ? "text-success" : accent === "warning" ? "text-warning-foreground" : "text-foreground";
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className={`mt-1 text-lg font-bold tabular-nums ${color}`}>{value}</p>
    </div>
  );
}

function LargeCapToggle() {
  const { settings, update } = useSettings();
  const opts = [
    { id: "nifty50-if", label: "Nifty 50" },
    { id: "sensex-if", label: "BSE SENSEX" },
  ];
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-muted-foreground">Large-cap sleeve</span>
      <div className="flex rounded-full border border-border bg-card p-0.5 font-medium">
        {opts.map((o) => (
          <button
            key={o.id}
            onClick={() => update({ largeCapFundId: o.id })}
            className={`rounded-full px-3 py-1 transition ${
              settings.largeCapFundId === o.id
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function AddFundPicker({
  existingIds,
  onAdd,
}: {
  existingIds: string[];
  onAdd: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const available = FUNDS.filter((f) => !existingIds.includes(f.id));
  if (available.length === 0) return null;
  return (
    <div className="mt-4">
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="text-sm font-medium text-primary hover:underline"
        >
          + Add another fund
        </button>
      ) : (
        <div className="rounded-xl border border-dashed border-border bg-surface/40 p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Pick a fund
          </p>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {available.map((f) => (
              <button
                key={f.id}
                onClick={() => {
                  onAdd(f.id);
                  setOpen(false);
                }}
                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition hover:bg-card"
              >
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: `var(--${f.assetClass})` }}
                />
                <span className="truncate">{f.shortName}</span>
                <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">
                  ~{f.assumedCagr}%
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
