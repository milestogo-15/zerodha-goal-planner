import { useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, ChevronRight } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useGoals, useSettings } from "@/lib/store";
import { PRESETS, presetById, suggestPresetForHorizon, type GoalPresetId } from "@/lib/presets";
import { fundById } from "@/lib/funds";
import { blendedCagr, formatINR, formatINRPlain, requiredSip, sipFutureValue } from "@/lib/calc";

export const Route = createFileRoute("/goals/new")({
  component: NewGoalPage,
  head: () => ({
    meta: [{ title: "Add a goal — Zerodha Fund House Planner" }],
  }),
});

function NewGoalPage() {
  const navigate = useNavigate();
  const { addGoal } = useGoals();
  const { settings } = useSettings();

  const [name, setName] = useState("");
  const [targetAmount, setTargetAmount] = useState<number>(1000000);
  const [years, setYears] = useState<number>(10);
  const [monthlySip, setMonthlySip] = useState<number>(10000);
  const [presetId, setPresetId] = useState<GoalPresetId>("wealth");
  const [presetTouched, setPresetTouched] = useState(false);

  // Auto-suggest preset based on horizon, until user picks manually
  useEffect(() => {
    if (!presetTouched) {
      setPresetId(suggestPresetForHorizon(years));
    }
  }, [years, presetTouched]);

  const preset = presetById(presetId);
  const allocation = useMemo(
    () => preset.allocation(settings.largeCapFundId),
    [preset, settings.largeCapFundId],
  );
  const cagr = blendedCagr(allocation);
  const projected = sipFutureValue(monthlySip, cagr, years * 12);
  const onTrack = projected >= targetAmount;
  const reqSip = requiredSip(targetAmount, cagr, years * 12);

  const submit = () => {
    if (!name.trim()) {
      toast.error("Please give your goal a name");
      return;
    }
    if (targetAmount <= 0 || years <= 0 || monthlySip <= 0) {
      toast.error("Target, horizon and SIP must all be positive");
      return;
    }
    const goal = addGoal({
      name: name.trim(),
      presetId,
      targetAmount,
      years,
      monthlySip,
      allocation,
    });
    toast.success("Goal added");
    navigate({ to: "/goals/$goalId", params: { goalId: goal.id } });
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 md:px-6 md:py-12">
      <Link
        to="/"
        className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground transition hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to dashboard
      </Link>
      <h1 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">Add a goal</h1>
      <p className="mt-2 max-w-xl text-muted-foreground">
        Tell us what you're saving for. We'll suggest a Zerodha Fund House allocation tuned to your
        horizon.
      </p>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          {/* Form card */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <div className="grid gap-5 md:grid-cols-2">
              <div className="md:col-span-2">
                <Label htmlFor="name">Goal name</Label>
                <Input
                  id="name"
                  className="mt-1.5"
                  placeholder="e.g. Down payment for a house"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="target">Target amount</Label>
                <div className="mt-1.5 flex items-center gap-2 rounded-md border border-input bg-transparent px-3 shadow-sm focus-within:ring-1 focus-within:ring-ring">
                  <span className="text-muted-foreground">₹</span>
                  <Input
                    id="target"
                    inputMode="numeric"
                    className="h-9 border-0 px-0 shadow-none focus-visible:ring-0"
                    value={targetAmount || ""}
                    onChange={(e) =>
                      setTargetAmount(parseInt(e.target.value.replace(/\D/g, ""), 10) || 0)
                    }
                  />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{formatINR(targetAmount)}</p>
              </div>
              <div>
                <Label htmlFor="years">Years to goal</Label>
                <Input
                  id="years"
                  className="mt-1.5"
                  inputMode="numeric"
                  value={years || ""}
                  onChange={(e) =>
                    setYears(Math.max(0, Math.min(50, parseInt(e.target.value, 10) || 0)))
                  }
                />
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="sip">Monthly SIP</Label>
                <div className="mt-1.5 flex items-center gap-2 rounded-md border border-input bg-transparent px-3 shadow-sm focus-within:ring-1 focus-within:ring-ring">
                  <span className="text-muted-foreground">₹</span>
                  <Input
                    id="sip"
                    inputMode="numeric"
                    className="h-9 border-0 px-0 shadow-none focus-visible:ring-0"
                    value={monthlySip || ""}
                    onChange={(e) =>
                      setMonthlySip(parseInt(e.target.value.replace(/\D/g, ""), 10) || 0)
                    }
                  />
                </div>
                {!onTrack && reqSip > monthlySip && isFinite(reqSip) && (
                  <button
                    type="button"
                    onClick={() => setMonthlySip(Math.ceil(reqSip / 100) * 100)}
                    className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                  >
                    Bump to {formatINRPlain(Math.ceil(reqSip / 100) * 100)} to hit target →
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Preset selector */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <h2 className="text-lg font-semibold">Goal type</h2>
            <p className="text-sm text-muted-foreground">
              We've suggested one based on your horizon — pick another if you'd like.
            </p>
            <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
              {PRESETS.map((p) => {
                const selected = p.id === presetId;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setPresetId(p.id);
                      setPresetTouched(true);
                    }}
                    className={`group flex items-start gap-3 rounded-xl border p-3.5 text-left transition ${
                      selected
                        ? "border-primary bg-primary-soft/40 ring-1 ring-primary"
                        : "border-border bg-card hover:border-primary/40 hover:bg-surface"
                    }`}
                  >
                    <span
                      className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${
                        selected ? "bg-primary" : "bg-muted-foreground/30"
                      }`}
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">{p.name}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{p.tagline}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Live preview */}
        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Live projection
            </p>
            <p className="mt-2 text-3xl font-bold tracking-tight">{formatINR(projected)}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              after {years}y at {cagr.toFixed(1)}% blended return
            </p>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full transition-all"
                style={{
                  width: `${Math.min(100, (projected / Math.max(1, targetAmount)) * 100)}%`,
                  backgroundColor: onTrack ? "var(--success)" : "var(--primary)",
                }}
              />
            </div>
            <p className={`mt-2 text-xs font-medium ${onTrack ? "text-success" : "text-foreground/70"}`}>
              {onTrack
                ? `On track — surplus of ${formatINR(projected - targetAmount)}`
                : `Shortfall: ${formatINR(targetAmount - projected)}`}
            </p>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Suggested allocation
            </p>
            <ul className="mt-3 space-y-2.5">
              {allocation.map((a) => {
                const f = fundById(a.fundId);
                if (!f) return null;
                return (
                  <li key={a.fundId} className="flex items-center justify-between gap-2 text-sm">
                    <div className="flex min-w-0 items-center gap-2">
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: `var(--${f.assetClass})` }}
                      />
                      <span className="truncate">{f.shortName}</span>
                    </div>
                    <span className="shrink-0 font-semibold tabular-nums">{a.percent}%</span>
                  </li>
                );
              })}
            </ul>
          </div>

          <Button onClick={submit} size="lg" className="w-full rounded-full">
            Save goal <ArrowRight className="h-4 w-4" />
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            You can fine-tune amounts and funds after saving.{" "}
            <ChevronRight className="inline h-3 w-3" />
          </p>
        </aside>
      </div>
    </div>
  );
}
