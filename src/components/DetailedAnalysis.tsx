import { useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { formatINR } from "@/lib/calc";
import type { EngineResult } from "@/lib/engine";
import { simulateGoal } from "@/lib/montecarlo";
import { volForFund, volatilityNoteForBucket } from "@/lib/volatility";
import { fundById } from "@/lib/funds";

interface Props {
  result: EngineResult;
  years: number;
}

function probTone(p: number): { color: string; label: string } {
  if (p >= 0.8)
    return { color: "text-emerald-600 dark:text-emerald-400", label: "Strong likelihood of success" };
  if (p >= 0.6)
    return {
      color: "text-foreground",
      label: "Reasonable chance — staying consistent helps",
    };
  return {
    color: "text-foreground",
    label: "Markets vary year to year — your SIP is designed to ride this out",
  };
}

const FRIENDLY = {
  p10: "If markets are rough",
  p25: "Cautious",
  p50: "Most likely",
  p75: "Optimistic",
  p90: "If markets do well",
} as const;

export function DetailedAnalysis({ result, years }: Props) {
  const [detailed, setDetailed] = useState(false);

  const sim = useMemo(() => {
    if (!result.allocation || result.allocation.length === 0) return null;
    return simulateGoal({
      allocation: result.allocation,
      monthlySip: result.effective_monthly_sip,
      years,
      inflatedTarget: result.inflated_target,
    });
  }, [result.allocation, result.effective_monthly_sip, result.inflated_target, years]);

  // Build range bar positions from p10..p90, base projection, and target
  const bar = useMemo(() => {
    if (!sim) return null;
    const points = [
      sim.p10,
      sim.p25,
      sim.p50,
      sim.p75,
      sim.p90,
      result.projected_corpus,
      result.inflated_target,
    ];
    const lo = Math.min(...points);
    const hi = Math.max(...points);
    const span = Math.max(1, hi - lo);
    const pos = (v: number) => ((v - lo) / span) * 100;
    return { lo, hi, pos };
  }, [sim, result.projected_corpus, result.inflated_target]);

  return (
    <Card className="border-dashed">
      {/* Toggle header */}
      <div className="flex items-center justify-between gap-3 px-5 py-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <div>
            <p className="text-sm font-semibold">
              {detailed ? "Detailed analysis" : "Quick analysis"}
            </p>
            <p className="text-xs text-muted-foreground">
              {detailed
                ? "Full stress-test across 1,000 market scenarios"
                : "A quick read on how this plan should behave"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="detailed-toggle" className="text-xs text-muted-foreground">
            Detailed
          </Label>
          <Switch
            id="detailed-toggle"
            checked={detailed}
            onCheckedChange={setDetailed}
          />
        </div>
      </div>

      <CardContent className="space-y-6 border-t pt-5">
        {!sim || !bar ? (
          <p className="text-sm text-muted-foreground">
            Analysis is unavailable — revise your goal first.
          </p>
        ) : (
          <>
            {/* Probability — always shown */}
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Probability of hitting your goal
              </p>
              <p
                className={`mt-1 text-4xl font-bold ${probTone(sim.probabilityOfSuccess).color}`}
              >
                {Math.round(sim.probabilityOfSuccess * 100)}%
              </p>
              <p className={`text-sm font-medium ${probTone(sim.probabilityOfSuccess).color}`}>
                {probTone(sim.probabilityOfSuccess).label}
              </p>
            </div>

            {/* Volatility note — always shown */}
            <div className="rounded-md bg-muted/50 p-3">
              <p className="text-sm">{volatilityNoteForBucket(result.bucket)}</p>
            </div>

            {detailed && (
              <>
                {/* Outcome range */}
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Outcome range across 1,000 simulations
                  </p>
                  <div className="relative mt-8 mb-20 h-2 rounded-full bg-gradient-to-r from-amber-200/70 via-amber-100 to-emerald-200 dark:from-amber-950 dark:via-amber-900/40 dark:to-emerald-950 mx-12">
                    {/* percentile dots */}
                    {(["p10", "p25", "p50", "p75", "p90"] as const).map((k, idx) => {
                      const v = sim[k];
                      const left = bar.pos(v);
                      const isMedian = k === "p50";
                      const isEdge = k === "p10" || k === "p90";
                      const stagger = idx % 2 === 0 ? "top-5" : "top-12";
                      return (
                        <div
                          key={k}
                          className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
                          style={{ left: `${left}%` }}
                        >
                          <div
                            className={`rounded-full border-2 border-background ${
                              isMedian ? "h-4 w-4 bg-primary" : "h-3 w-3 bg-foreground/70"
                            }`}
                          />
                          <p
                            className={`absolute ${stagger} w-20 text-[10px] leading-tight text-muted-foreground ${
                              isEdge && k === "p10"
                                ? "left-0 text-left"
                                : isEdge && k === "p90"
                                  ? "right-0 text-right"
                                  : "left-1/2 -translate-x-1/2 text-center"
                            }`}
                          >
                            {FRIENDLY[k]}
                            <br />
                            <span className="font-semibold text-foreground">{formatINR(v)}</span>
                          </p>
                        </div>
                      );
                    })}
                    {/* base projection marker (dotted) */}
                    <div
                      className="absolute -top-3 h-8 border-l-2 border-dotted border-muted-foreground"
                      style={{ left: `${bar.pos(result.projected_corpus)}%` }}
                      title={`Base projection: ${formatINR(result.projected_corpus)}`}
                    />
                    {/* goal target marker */}
                    <div
                      className="absolute -top-5 h-12 border-l-2 border-primary"
                      style={{ left: `${bar.pos(result.inflated_target)}%` }}
                    >
                      <span className="absolute -top-4 left-1 whitespace-nowrap rounded bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
                        Your goal
                      </span>
                    </div>
                  </div>
                </div>

                {/* Per-fund behaviour */}
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    How each fund behaves
                  </p>
                  <ul className="mt-2 space-y-1.5">
                    {result.allocation.map((a) => {
                      const f = fundById(a.fundId);
                      const v = volForFund(a.fundId);
                      if (!f) return null;
                      return (
                        <li key={a.fundId} className="flex gap-2 text-xs">
                          <span className="min-w-[120px] font-medium">{f.shortName}</span>
                          <span className="text-muted-foreground">{v.note}</span>
                        </li>
                      );
                    })}
                  </ul>
                </div>

                <p className="text-[10px] italic text-muted-foreground">
                  Simulated outcomes based on historical asset volatility. Not a guarantee.
                </p>
              </>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
