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
import { useGoals } from "@/lib/store";
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
