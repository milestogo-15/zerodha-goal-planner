import { useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowRight, Lightbulb } from "lucide-react";
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
import { PRESETS, presetById, PRESET_TO_KIND, type GoalPresetId } from "@/lib/presets";
import { fundById } from "@/lib/funds";
import { evaluateGoal, type EngineResult } from "@/lib/engine";
import { formatINR, formatINRPlain } from "@/lib/calc";
import { DetailedAnalysis } from "@/components/DetailedAnalysis";

export const Route = createFileRoute("/goals/new")({
  component: NewGoalPage,
  head: () => ({
    meta: [{ title: "Add a goal — Zerodha Fund House Planner" }],
  }),
});

const STRETCH_STYLES: Record<string, { color: string; bg: string; label: string }> = {
  EASY: { color: "text-success", bg: "bg-success-soft", label: "Easy" },
  MODERATE: { color: "text-info", bg: "bg-info-soft", label: "Moderate" },
  STRETCHED: { color: "text-warning-foreground", bg: "bg-warning-soft", label: "Stretched" },
  CRITICAL: { color: "text-destructive", bg: "bg-destructive/10", label: "Critical" },
};

function inflationLabel(kind: string, inflationUsed: number | null): string {
  if (inflationUsed === null) return "Not applied — emergency buffer";
  if (kind === "home") return "8% (property prices)";
  if (kind === "vacation") return inflationUsed === 9 ? "9% (international travel)" : "7% (domestic)";
  return "7% (CPI)";
}

function NewGoalPage() {
  const navigate = useNavigate();
  const { addGoal } = useGoals();
  const { settings, update } = useSettings();

  const [name, setName] = useState("");
  const [targetAmount, setTargetAmount] = useState<number>(0);
  const [years, setYears] = useState<number>(0);
  const [monthlySip, setMonthlySip] = useState<number>(0);
  const [presetId, setPresetId] = useState<GoalPresetId | "">("");
  const [vacationSubtype, setVacationSubtype] = useState<"domestic" | "international">("domestic");
  const [existingSavings, setExistingSavings] = useState<number>(0);

  const preset = presetId ? presetById(presetId) : null;
  const kind = presetId ? PRESET_TO_KIND[presetId] : null;

  const result: EngineResult | null = useMemo(() => {
    if (!kind) return null;
    if (settings.monthlyIncome <= 0) return null;
    if (years <= 0) return null;
    if (kind !== "emergency" && targetAmount <= 0) return null;
    return evaluateGoal({
      kind,
      target_today: targetAmount,
      years: Math.max(1, years),
      monthly_income: settings.monthlyIncome,
      monthly_sip: monthlySip > 0 ? monthlySip : null,
      vacation_subtype: vacationSubtype,
      existing_savings: existingSavings,
      largeCapFundId: settings.largeCapFundId,
    });
  }, [
    kind,
    targetAmount,
    years,
    settings.monthlyIncome,
    settings.largeCapFundId,
    monthlySip,
    vacationSubtype,
    existingSavings,
  ]);

  const submit = () => {
    if (!name.trim()) {
      toast.error("Please give your goal a name");
      return;
    }
    if (!presetId || !kind) {
      toast.error("Please select a goal type");
      return;
    }
    if (settings.monthlyIncome <= 0) {
      toast.error("Please enter your monthly income");
      return;
    }
    if (years <= 0) {
      toast.error("Years to goal must be at least 1");
      return;
    }
    if (kind !== "emergency" && targetAmount <= 0) {
      toast.error("Target amount must be positive");
      return;
    }
    if (!result) {
      toast.error("Could not evaluate this goal — please check your inputs");
      return;
    }
    if (kind === "vacation" && result.affordability_flag === "WARN") {
      toast.error(
        `Not feasible at current income. Try a smaller target — e.g. ${formatINRPlain(
          result.revised_target ?? 0,
        )}.`,
      );
      return;
    }
    if (result.allocation.length === 0) {
      toast.error("Allocation is empty — adjust target or horizon and try again");
      return;
    }
    const goal = addGoal({
      name: name.trim(),
      presetId,
      targetAmount: result.inflated_target,
      years,
      monthlySip: result.effective_monthly_sip,
      allocation: result.allocation,
    });
    toast.success(
      monthlySip > 0
        ? "Goal added"
        : `Goal added — suggested SIP ${formatINRPlain(result.effective_monthly_sip)}/mo`,
    );
    navigate({ to: "/goals/$goalId", params: { goalId: goal.id } });
  };

  const stretchStyle = result ? STRETCH_STYLES[result.stretch_band] : null;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 md:px-6 md:py-12">
      <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Add a goal</h1>
      <p className="mt-2 max-w-xl text-muted-foreground">
        Tell us what you're saving for. We'll pick a Zerodha Fund House allocation tuned to your
        horizon, income, and target — adjusted for inflation.
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
                  value={presetId === "" ? undefined : presetId}
                  onValueChange={(v) => setPresetId(v as GoalPresetId)}
                >
                  <SelectTrigger id="goal-type" className="mt-1.5">
                    <SelectValue placeholder="Select your goal" />
                  </SelectTrigger>
                  <SelectContent>
                    {PRESETS.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {preset && (
                  <p className="mt-1 text-xs text-muted-foreground">{preset.tagline}</p>
                )}
              </div>

              {kind === "vacation" && (
                <div className="md:col-span-2">
                  <Label>Trip type</Label>
                  <div className="mt-1.5 flex gap-2">
                    {(["domestic", "international"] as const).map((sub) => (
                      <button
                        key={sub}
                        type="button"
                        onClick={() => setVacationSubtype(sub)}
                        className={`rounded-full border px-3.5 py-1.5 text-sm font-medium capitalize transition ${
                          vacationSubtype === sub
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-card text-foreground/70 hover:text-foreground"
                        }`}
                      >
                        {sub}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {kind === "emergency" && settings.monthlyIncome > 0 && (
                <div className="md:col-span-2">
                  <Label>Suggested target</Label>
                  <div className="mt-1.5 grid gap-2 sm:grid-cols-3">
                    {(
                      [
                        { mult: 3, label: "Conservative" },
                        { mult: 6, label: "Recommended" },
                        { mult: 9, label: "Aggressive" },
                      ] as const
                    ).map(({ mult, label }) => {
                      const value = settings.monthlyIncome * mult;
                      const active = targetAmount === value;
                      return (
                        <button
                          key={mult}
                          type="button"
                          onClick={() => setTargetAmount(value)}
                          className={`rounded-xl border px-3 py-2 text-left transition ${
                            active
                              ? "border-primary bg-primary-soft/40 ring-1 ring-primary"
                              : "border-border bg-card hover:border-primary/40"
                          }`}
                        >
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                            {label} · {mult}m
                          </p>
                          <p className="mt-0.5 text-sm font-semibold">{formatINRPlain(value)}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div>
                <Label htmlFor="target">
                  Target amount {kind !== "emergency" && "(today's value)"}
                </Label>
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
                {result && targetAmount > 0 && years > 0 && result.inflation_used !== null && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    ≈ {formatINR(result.inflated_target)} in {years}y at {result.inflation_used}%
                    inflation
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
                  Used to gauge SIP affordability
                </p>
              </div>

              <div>
                <Label className="text-muted-foreground">Inflation</Label>
                <p className="mt-1.5 text-lg font-semibold text-foreground">
                  {result?.inflation_used === null
                    ? <span className="text-muted-foreground">—</span>
                    : `${result ? result.inflation_used : 7}%`}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {kind ? inflationLabel(kind, result?.inflation_used ?? 7) : "Auto-set per goal type"}
                </p>
              </div>

              {kind === "emergency" && (
                <div>
                  <Label htmlFor="existing">Already saved (optional)</Label>
                  <div className="mt-1.5 flex items-center gap-2 rounded-md border border-input bg-transparent px-3 shadow-sm focus-within:ring-1 focus-within:ring-ring">
                    <span className="text-muted-foreground">₹</span>
                    <Input
                      id="existing"
                      inputMode="numeric"
                      placeholder="e.g. 50,000"
                      className="h-9 border-0 px-0 shadow-none focus-visible:ring-0"
                      value={existingSavings || ""}
                      onChange={(e) =>
                        setExistingSavings(parseInt(e.target.value.replace(/\D/g, ""), 10) || 0)
                      }
                    />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Reduces remaining SIP needed
                  </p>
                </div>
              )}

              {result && result.required_monthly_sip > 0 && (
                <div className="md:col-span-2">
                  <Label>Monthly SIP <span className="font-normal text-muted-foreground">(calculated)</span></Label>
                  <p className="mt-1.5 text-lg font-semibold text-primary">
                    {formatINRPlain(result.required_monthly_sip)}{" "}
                    <span className="text-xs font-normal text-muted-foreground">/ month</span>
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Auto-computed from your inflation-adjusted target and horizon.
                  </p>
                </div>
              )}
            </div>
          </div>

          <Button onClick={submit} size="lg" className="w-full rounded-full">
            Save goal <ArrowRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Live preview */}
        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          {result && (
            <>
              {/* Live projection */}
              <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Live projection
                </p>
                <p className="mt-2 text-3xl font-bold tracking-tight">
                  {formatINR(result.projected_corpus)}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  after {years}y at {result.blended_return.toFixed(1)}% blended · SIP{" "}
                  {formatINRPlain(result.effective_monthly_sip)}/mo
                </p>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full transition-all"
                    style={{
                      width: `${Math.min(
                        100,
                        (result.projected_corpus / Math.max(1, result.inflated_target)) * 100,
                      )}%`,
                      backgroundColor: result.on_track ? "var(--success)" : "var(--primary)",
                    }}
                  />
                </div>
                <p
                  className={`mt-2 text-xs font-medium ${
                    result.on_track ? "text-success" : "text-foreground/70"
                  }`}
                >
                  {result.on_track
                    ? `On track — surplus of ${formatINR(result.surplus_or_deficit)}`
                    : `Shortfall: ${formatINR(-result.surplus_or_deficit)}`}
                </p>
                {result.inflation_used !== null && (
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    Target inflated to {formatINR(result.inflated_target)} ({result.inflation_used}%
                    p.a.)
                  </p>
                )}
              </div>



              {/* Affordability */}
              {stretchStyle && (
                <div
                  className={`rounded-2xl border border-border ${stretchStyle.bg} p-5 shadow-sm`}
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-foreground/60">
                      Affordability
                    </p>
                    <span className={`text-xs font-bold uppercase ${stretchStyle.color}`}>
                      {stretchStyle.label}
                    </span>
                  </div>
                  <p className={`mt-2 text-2xl font-bold tabular-nums ${stretchStyle.color}`}>
                    {(result.stretch_ratio * 100).toFixed(1)}%
                    <span className="ml-2 text-xs font-medium text-foreground/60">of income</span>
                  </p>
                  <p className="mt-1 text-xs text-foreground/70">
                    {formatINRPlain(result.effective_monthly_sip)}/mo SIP on{" "}
                    {formatINRPlain(settings.monthlyIncome)} income
                  </p>
                </div>
              )}

              {/* Suggested allocation */}
              {result.allocation.length > 0 ? (
                <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                  <div className="flex items-baseline justify-between">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Suggested allocation
                    </p>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-primary">
                      {result.bucket}
                    </span>
                  </div>
                  <ul className="mt-3 space-y-2.5">
                    {result.allocation.map((a) => {
                      const f = fundById(a.fundId);
                      if (!f) return null;
                      return (
                        <li
                          key={a.fundId}
                          className="flex items-center justify-between gap-2 text-sm"
                        >
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
              ) : (
                <div className="rounded-2xl border border-dashed border-warning/40 bg-warning-soft p-5 text-sm text-warning-foreground">
                  Allocation blocked — see the suggestion below.
                </div>
              )}

              {/* Smart suggestions */}
              {(result.notes.length > 0 ||
                result.revised_target ||
                result.revised_years ||
                result.step_up_corpus_10pct ||
                result.glide_path_note ||
                result.monthly_withdrawal_estimate ||
                result.upgrade_to_long_suggested) && (
                <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                  <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    <Lightbulb className="h-3.5 w-3.5" />
                    Smart suggestions
                  </div>
                  <div className="space-y-3 text-sm">
                    {result.notes.map((n, i) => (
                      <p key={i} className="text-foreground/80">
                        {n}
                      </p>
                    ))}
                    {result.revised_target !== undefined && (
                      <button
                        type="button"
                        onClick={() => setTargetAmount(result.revised_target!)}
                        className="flex w-full items-center justify-between rounded-lg border border-border bg-surface/60 px-3 py-2 text-left transition hover:border-primary/40"
                      >
                        <span>
                          Try a realistic target:{" "}
                          <span className="font-semibold">
                            {formatINRPlain(result.revised_target)}
                          </span>
                        </span>
                        <span className="text-xs font-medium text-primary">Apply</span>
                      </button>
                    )}
                    {result.revised_years !== undefined && (
                      <button
                        type="button"
                        onClick={() => setYears(result.revised_years!)}
                        className="flex w-full items-center justify-between rounded-lg border border-border bg-surface/60 px-3 py-2 text-left transition hover:border-primary/40"
                      >
                        <span>
                          Extend horizon to{" "}
                          <span className="font-semibold">{result.revised_years} years</span>
                        </span>
                        <span className="text-xs font-medium text-primary">Apply</span>
                      </button>
                    )}
                    {result.step_up_corpus_10pct !== undefined && (
                      <p className="rounded-lg bg-info-soft px-3 py-2 text-info">
                        Step-up SIP (10%/yr) projection:{" "}
                        <span className="font-semibold">
                          {formatINR(result.step_up_corpus_10pct)}
                        </span>
                      </p>
                    )}
                    {result.glide_path_note && (
                      <p className="text-xs text-muted-foreground">{result.glide_path_note}</p>
                    )}
                    {result.monthly_withdrawal_estimate !== undefined && (
                      <p className="text-xs text-muted-foreground">
                        At 6% safe withdrawal: ~
                        <span className="font-semibold text-foreground">
                          {formatINRPlain(result.monthly_withdrawal_estimate)}/mo
                        </span>{" "}
                        for ~20 years post-retirement.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
