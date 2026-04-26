import { useMemo } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import {
  Plus,
  Target,
  Wallet,
  Trash2,
  Pencil,
  TrendingUp,
  Shield,
  Receipt,
  Car,
  Home,
  GraduationCap,
  Palmtree,
  Sliders,
  ArrowRight,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { useGoals, useSettings } from "@/lib/store";
import { presetById } from "@/lib/presets";
import {
  blendedCagr,
  formatINR,
  formatINRPlain,
  sipFutureValue,
} from "@/lib/calc";

export const Route = createFileRoute("/")({
  component: Dashboard,
  head: () => ({
    meta: [
      { title: "Dashboard — Goal-Based Investing Planner" },
      {
        name: "description",
        content:
          "Track all your financial goals, monitor SIP health, and see Zerodha Fund House recommendations.",
      },
    ],
  }),
});

const ICONS = {
  shield: Shield,
  wallet: Wallet,
  receipt: Receipt,
  car: Car,
  home: Home,
  "graduation-cap": GraduationCap,
  palmtree: Palmtree,
  "trending-up": TrendingUp,
  sliders: Sliders,
} as const;

function GoalIcon({ name, className }: { name: string; className?: string }) {
  const Comp = (ICONS as Record<string, typeof Shield>)[name] ?? Target;
  return <Comp className={className} strokeWidth={2} />;
}

function Dashboard() {
  const { goals, deleteGoal } = useGoals();
  const { settings, update } = useSettings();

  const totalSip = useMemo(
    () => goals.reduce((s, g) => s + g.monthlySip, 0),
    [goals],
  );
  const sipPct = settings.monthlyIncome > 0 ? (totalSip / settings.monthlyIncome) * 100 : 0;

  const healthStatus =
    sipPct < 30
      ? { label: "Healthy", color: "text-success", bg: "bg-success-soft", ring: "ring-success/30" }
      : sipPct < 50
        ? { label: "Stretched", color: "text-warning-foreground", bg: "bg-warning-soft", ring: "ring-warning/40" }
        : { label: "Over-allocated", color: "text-destructive", bg: "bg-destructive/10", ring: "ring-destructive/40" };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:px-6 md:py-12">
      {/* Hero */}
      <section className="mb-8 md:mb-12">
        <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
          Goal-based investing planner
        </h1>
        <p className="mt-3 max-w-2xl text-base text-muted-foreground md:text-lg">
          Plan your financial future with precision. Add your goals and we'll allocate across
          Zerodha Fund House products and project the rest.
        </p>
      </section>

      {/* Monthly Income card */}
      <section className="mb-6">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm md:p-6">
          <div className="flex items-start gap-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-info-soft text-info">
              <Wallet className="h-5 w-5" strokeWidth={2} />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-semibold">Monthly Income</h2>
              <p className="text-sm text-muted-foreground">Take-home monthly earnings</p>
              <div className="mt-4 rounded-xl bg-surface px-4 py-3">
                <div className="flex items-center gap-2 text-2xl font-semibold">
                  <span className="text-muted-foreground">₹</span>
                  <Input
                    inputMode="numeric"
                    value={settings.monthlyIncome || ""}
                    onChange={(e) => {
                      const v = parseInt(e.target.value.replace(/\D/g, ""), 10) || 0;
                      update({ monthlyIncome: v });
                    }}
                    className="h-auto border-0 bg-transparent p-0 text-2xl font-semibold shadow-none focus-visible:ring-0"
                    placeholder="0"
                  />
                </div>
              </div>
              <div className="mt-4">
                <Slider
                  min={10000}
                  max={1000000}
                  step={5000}
                  value={[Math.min(1000000, Math.max(10000, settings.monthlyIncome || 10000))]}
                  onValueChange={(v) => update({ monthlyIncome: v[0] })}
                />
                <div className="mt-2 flex justify-between text-xs text-muted-foreground">
                  <span>₹10,000</span>
                  <span>₹10,00,000</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SIP Health Check */}
      <section className="mb-6">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm md:p-6">
          <div className="mb-4 flex items-center gap-2">
            <Target className="h-5 w-5 text-foreground/70" strokeWidth={2} />
            <h2 className="text-lg font-semibold">SIP Health Check</h2>
          </div>
          <div className={`rounded-xl ${healthStatus.bg} px-5 py-4 ring-1 ${healthStatus.ring}`}>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-foreground/60">
                  Total Monthly SIP
                </p>
                <p className="mt-1 text-3xl font-bold tracking-tight">{formatINRPlain(totalSip)}</p>
              </div>
              <div className="text-right">
                <p className={`text-2xl font-bold ${healthStatus.color}`}>{sipPct.toFixed(1)}%</p>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-foreground/60">
                  of income · {healthStatus.label}
                </p>
              </div>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-foreground/10">
              <div
                className="h-full bg-success transition-all"
                style={{ width: `${Math.min(100, sipPct)}%`, backgroundColor: sipPct >= 50 ? "var(--destructive)" : sipPct >= 30 ? "var(--warning)" : "var(--success)" }}
              />
            </div>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Aim to keep total SIPs under 30% of income for a healthy budget.
          </p>
        </div>
      </section>

      {/* Goals */}
      <section className="mb-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Your goals</h2>
          <Button asChild className="rounded-full">
            <Link to="/goals/new">
              <Plus className="h-4 w-4" /> Add goal
            </Link>
          </Button>
        </div>

        {goals.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {goals.map((g) => {
              const preset = presetById(g.presetId);
              const cagr = blendedCagr(g.allocation);
              const projected = sipFutureValue(g.monthlySip, cagr, g.years * 12);
              const onTrack = projected >= g.targetAmount;
              const progress = Math.min(100, (projected / g.targetAmount) * 100);
              return (
                <div
                  key={g.id}
                  className="group relative rounded-2xl border border-border bg-card p-5 shadow-sm transition hover:shadow-md"
                >
                  <div className="flex items-start gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
                      <GoalIcon name={preset.icon} className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="truncate text-base font-semibold">{g.name}</h3>
                          <p className="text-xs text-muted-foreground">{preset.name} · {g.years}y</p>
                        </div>
                        <div className="flex shrink-0 gap-1">
                          <Button asChild size="icon" variant="ghost" className="h-8 w-8">
                            <Link to="/goals/$goalId" params={{ goalId: g.id }}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Link>
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            onClick={() => deleteGoal(g.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>

                      <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Target</p>
                          <p className="mt-0.5 font-semibold">{formatINR(g.targetAmount)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">SIP/mo</p>
                          <p className="mt-0.5 font-semibold">{formatINRPlain(g.monthlySip)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Projected</p>
                          <p className={`mt-0.5 font-semibold ${onTrack ? "text-success" : "text-foreground"}`}>
                            {formatINR(projected)}
                          </p>
                        </div>
                      </div>

                      <div className="mt-3">
                        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full transition-all"
                            style={{
                              width: `${progress}%`,
                              backgroundColor: onTrack ? "var(--success)" : "var(--primary)",
                            }}
                          />
                        </div>
                        <div className="mt-1.5 flex justify-between text-[11px] text-muted-foreground">
                          <span>{progress.toFixed(0)}% of target at {cagr.toFixed(1)}% blended</span>
                          <Link
                            to="/goals/$goalId"
                            params={{ goalId: g.id }}
                            className="inline-flex items-center gap-0.5 font-medium text-primary hover:underline"
                          >
                            Details <ArrowRight className="h-3 w-3" />
                          </Link>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card/40 p-10 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-soft text-primary">
        <Target className="h-7 w-7" strokeWidth={2} />
      </div>
      <h3 className="mt-4 text-lg font-semibold">No goals yet</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Start by adding your first financial goal — retirement, a car, your child's education, anything.
      </p>
      <div className="mt-5">
        <Button asChild className="rounded-full">
          <Link to="/goals/new">
            <Plus className="h-4 w-4" /> Add your first goal
          </Link>
        </Button>
      </div>
    </div>
  );
}
