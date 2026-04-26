import { useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, ChevronRight } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useGoals, useSettings } from "@/lib/store";
import { PRESETS, presetById, type GoalPresetId } from "@/lib/presets";
import { fundById } from "@/lib/funds";
import {
  blendedCagr,
  DEFAULT_INFLATION_PCT,
  formatINR,
  formatINRPlain,
  inflateTarget,
  requiredSip,
  sipFutureValue,
} from "@/lib/calc";

export const Route = createFileRoute("/goals/new")({
  component: NewGoalPage,
  head: () => ({
    meta: [{ title: "Add a goal — Zerodha Fund House Planner" }],
  }),
});

function NewGoalPage() {
  const navigate = useNavigate();
  const { addGoal } = useGoals();
  const { settings, update } = useSettings();

  const [name, setName] = useState("");
  const [targetAmount, setTargetAmount] = useState<number>(0);
  const [years, setYears] = useState<number>(0);
  const [monthlySip, setMonthlySip] = useState<number>(0);
  const [presetId, setPresetId] = useState<GoalPresetId | "">("");
  const [presetTouched, setPresetTouched] = useState(false);
  const [inflationPct, setInflationPct] = useState<number>(0);

  // Auto-suggest preset based on horizon, until user picks manually
  useEffect(() => {
    if (!presetTouched) {
      // Keep empty until user picks; only auto-suggest after they've interacted
    }
  }, [years, presetTouched]);

  const preset = presetId ? presetById(presetId) : null;
  const allocation = useMemo(
    () => (preset ? preset.allocation(settings.largeCapFundId) : []),
    [preset, settings.largeCapFundId],
  );
  const cagr = allocation.length ? blendedCagr(allocation) : 0;
  const effectiveInflation = inflationPct > 0 ? inflationPct : DEFAULT_INFLATION_PCT;
  const inflatedTarget = inflateTarget(targetAmount, years, effectiveInflation);
  const reqSip = cagr > 0 ? requiredSip(inflatedTarget, cagr, years * 12) : 0;
  const effectiveSip = monthlySip > 0 ? monthlySip : Math.ceil(reqSip / 100) * 100;
  const projected = cagr > 0 ? sipFutureValue(effectiveSip, cagr, years * 12) : 0;
  const onTrack = projected >= inflatedTarget;

  const submit = () => {
    if (!name.trim()) {
      toast.error("Please give your goal a name");
      return;
    }
    if (!presetId) {
      toast.error("Please select a goal type");
      return;
    }
    if (targetAmount <= 0 || years <= 0) {
      toast.error("Target and horizon must be positive");
      return;
    }
    const sipToSave = effectiveSip;
    if (sipToSave <= 0 || !isFinite(sipToSave)) {
      toast.error("Could not calculate a valid SIP — adjust target or horizon");
      return;
    }
    const goal = addGoal({
      name: name.trim(),
      presetId,
      targetAmount: Math.round(inflatedTarget),
      years,
      monthlySip: sipToSave,
      allocation,
    });
    toast.success(
      monthlySip > 0 ? "Goal added" : `Goal added — suggested SIP ${formatINRPlain(sipToSave)}/mo`,
    );
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
        horizon and adjust your target for inflation.
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

              <div className="md:col-span-2">
                <Label htmlFor="goal-type">Goal type</Label>
                <Select
                  value={presetId || undefined}
                  onValueChange={(v) => {
                    setPresetId(v as GoalPresetId);
                    setPresetTouched(true);
                  }}
                >
                  <SelectTrigger id="goal-type" className="mt-1.5">
                    <SelectValue placeholder="Select your goal" />
                  </SelectTrigger>
                  <SelectContent>
                    {PRESETS.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        <div className="flex flex-col">
                          <span className="font-medium">{p.name}</span>
                          <span className="text-xs text-muted-foreground">{p.tagline}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {preset && (
                  <p className="mt-1 text-xs text-muted-foreground">{preset.description}</p>
                )}
              </div>

              <div>
                <Label htmlFor="target">Target amount (today's value)</Label>
                <div className="mt-1.5 flex items-center gap-2 rounded-md border border-input bg-transparent px-3 shadow-sm focus-within:ring-1 focus-within:ring-ring">
                  <span className="text-muted-foreground">₹</span>
                  <Input
                    id="target"
                    inputMode="numeric"
                    placeholder="e.g. 10,00,000"
                    className="h-9 border-0 px-0 shadow-none focus-visible:ring-0"
                    value={targetAmount || ""}
                    onChange={(e) =>
                      setTargetAmount(parseInt(e.target.value.replace(/\D/g, ""), 10) || 0)
                    }
                  />
                </div>
                {targetAmount > 0 && years > 0 && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    ≈ {formatINR(inflatedTarget)} in {years}y at {inflationPct || DEFAULT_INFLATION_PCT}% inflation
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="years">Years to goal</Label>
                <Input
                  id="years"
                  className="mt-1.5"
                  inputMode="numeric"
                  placeholder="e.g. 10"
                  value={years || ""}
                  onChange={(e) =>
                    setYears(Math.max(0, Math.min(50, parseInt(e.target.value, 10) || 0)))
                  }
                />
              </div>

              <div>
                <Label htmlFor="income">Monthly income</Label>
                <div className="mt-1.5 flex items-center gap-2 rounded-md border border-input bg-transparent px-3 shadow-sm focus-within:ring-1 focus-within:ring-ring">
                  <span className="text-muted-foreground">₹</span>
                  <Input
                    id="income"
                    inputMode="numeric"
                    placeholder="e.g. 75,000"
                    className="h-9 border-0 px-0 shadow-none focus-visible:ring-0"
                    value={settings.monthlyIncome || ""}
                    onChange={(e) =>
                      update({
                        monthlyIncome: parseInt(e.target.value.replace(/\D/g, ""), 10) || 0,
                      })
                    }
                  />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Used for affordability checks
                </p>
              </div>

              <div>
                <Label htmlFor="inflation">Inflation %</Label>
                <Input
                  id="inflation"
                  className="mt-1.5"
                  inputMode="decimal"
                  placeholder="e.g. 6"
                  value={inflationPct || ""}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    setInflationPct(isFinite(v) ? Math.max(0, Math.min(20, v)) : 0);
                  }}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  India CPI long-run avg ~6%
                </p>
              </div>

              <div className="md:col-span-2">
                <div className="flex items-baseline justify-between">
                  <Label htmlFor="sip">
                    Monthly SIP{" "}
                    <span className="font-normal text-muted-foreground">(optional)</span>
                  </Label>
                  {monthlySip === 0 && isFinite(reqSip) && reqSip > 0 && (
                    <span className="text-xs text-muted-foreground">
                      Suggested: {formatINRPlain(Math.ceil(reqSip / 100) * 100)}
                    </span>
                  )}
                </div>
                <div className="mt-1.5 flex items-center gap-2 rounded-md border border-input bg-transparent px-3 shadow-sm focus-within:ring-1 focus-within:ring-ring">
                  <span className="text-muted-foreground">₹</span>
                  <Input
                    id="sip"
                    inputMode="numeric"
                    placeholder={
                      isFinite(reqSip) && reqSip > 0
                        ? `Auto: ${Math.ceil(reqSip / 100) * 100}`
                        : "Enter amount"
                    }
                    className="h-9 border-0 px-0 shadow-none focus-visible:ring-0"
                    value={monthlySip || ""}
                    onChange={(e) =>
                      setMonthlySip(parseInt(e.target.value.replace(/\D/g, ""), 10) || 0)
                    }
                  />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Leave blank and we'll calculate it from your inflation-adjusted target.
                </p>
                {monthlySip > 0 && !onTrack && reqSip > monthlySip && isFinite(reqSip) && (
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
        </div>

        {/* Live preview */}
        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Live projection
            </p>
            <p className="mt-2 text-3xl font-bold tracking-tight">{formatINR(projected)}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              after {years}y at {cagr.toFixed(1)}% blended return · SIP{" "}
              {formatINRPlain(effectiveSip)}/mo
            </p>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full transition-all"
                style={{
                  width: `${Math.min(100, (projected / Math.max(1, inflatedTarget)) * 100)}%`,
                  backgroundColor: onTrack ? "var(--success)" : "var(--primary)",
                }}
              />
            </div>
            <p
              className={`mt-2 text-xs font-medium ${onTrack ? "text-success" : "text-foreground/70"}`}
            >
              {onTrack
                ? `On track — surplus of ${formatINR(projected - inflatedTarget)}`
                : `Shortfall: ${formatINR(inflatedTarget - projected)}`}
            </p>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Target inflated to {formatINR(inflatedTarget)} ({inflationPct}% p.a.)
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
