"use client";

import { useState } from "react";
import { Activity, ChevronDown } from "lucide-react";
import { BacktestChart, VolatilityChart } from "@/components/risk/RiskCharts";
import { MODEL_LABELS } from "@/lib/risk/backtest";
import type { PortfolioRiskReport, RiskReport } from "@/lib/risk-data";
import { formatPrice } from "@/lib/utils";

const TREND_TEXT = { rising: "Risk rising", falling: "Risk falling", stable: "Risk stable" } as const;
const TREND_STYLE = { rising: "badge-down", falling: "badge-up", stable: "badge-muted" } as const;

const Stat = ({ label, value, sub }: { label: string; value: string; sub?: string }) => (
  <div className="rounded-xl border border-gray-600/60 bg-gray-900/40 p-3 min-w-0">
    <p className="text-xs text-gray-500">{label}</p>
    <p className="mt-0.5 truncate text-lg font-bold tabular-nums text-gray-100 sm:text-xl">{value}</p>
    {sub && <p className="truncate text-xs text-gray-500 tabular-nums">{sub}</p>}
  </div>
);

const PassFail = ({ pass }: { pass: boolean }) => (
  <span className={`font-semibold ${pass ? "text-up" : "text-down"}`}>{pass ? "Pass" : "Fail"}</span>
);

type Props = { report: RiskReport | PortfolioRiskReport | null; title?: string; subject: string };

// The card is a container: in a narrow column it stacks, in a wide one the chart sits beside the numbers
export default function RiskCard({ report, title = "Risk forecast", subject }: Props) {
  const [showDetails, setShowDetails] = useState(false);

  if (!report) {
    return (
      <div className="card">
        <h3 className="card-title flex items-center gap-2"><Activity className="h-5 w-5 text-yellow-500" /> {title}</h3>
        <p className="mt-2 text-sm text-gray-500">Not enough price history to forecast risk yet (needs about 2 years of daily prices).</p>
      </div>
    );
  }

  const portfolio = "value" in report ? report : null;
  const longRunAnnual = report.longRunDailySd * Math.sqrt(252);
  const bt = report.backtest;
  const chosen = bt?.models.find((m) => m.model === "garch-fhs");
  const accurate = chosen ? chosen.var95.pass : null;

  return (
    <div className="card @container">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="card-title flex items-center gap-2"><Activity className="h-5 w-5 shrink-0 text-yellow-500" /> {title}</h3>
          <p className="text-sm text-gray-500">How much {subject.toLowerCase() === "your portfolio" ? "your portfolio" : subject} is likely to move, based on its price history</p>
        </div>
        <span className={`badge shrink-0 ${TREND_STYLE[report.trend]}`}>{TREND_TEXT[report.trend]}</span>
      </div>

      <div className="mt-5 grid gap-6 @3xl:grid-cols-2">
        <div className="space-y-4 min-w-0">
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Typical daily move" value={`±${report.dailySd.toFixed(2)}%`} sub={`Usually ±${report.longRunDailySd.toFixed(2)}%`} />
            <Stat label="Yearly volatility" value={`${report.annualVol.toFixed(1)}%`} sub={`Usually ${longRunAnnual.toFixed(1)}%`} />
            <Stat
              label="Bad day (1 in 20)"
              value={portfolio ? `−${formatPrice(portfolio.var95Usd)}` : `−${report.var95Pct.toFixed(2)}%`}
              sub={portfolio ? `−${report.var95Pct.toFixed(2)}% of value` : "possible one-day loss"}
            />
            <Stat
              label="Very bad day (1 in 100)"
              value={portfolio ? `−${formatPrice(portfolio.var99Usd)}` : `−${report.var99Pct.toFixed(2)}%`}
              sub={portfolio ? `−${report.var99Pct.toFixed(2)}% of value` : "possible one-day loss"}
            />
          </div>

          <p className="text-sm leading-relaxed text-gray-400">
            {portfolio ? "Your portfolio" : subject} moves about <span className="text-gray-100">±{report.dailySd.toFixed(2)}%</span> on a typical day right now,
            compared with ±{report.longRunDailySd.toFixed(2)}% normally. On 19 out of 20 days, the loss should stay under{" "}
            <span className="text-gray-100">{portfolio ? formatPrice(portfolio.var95Usd) : `${report.var95Pct.toFixed(2)}%`}</span>.
          </p>

          {accurate !== null && chosen && (
            <p className="rounded-xl border border-gray-600/60 bg-gray-900/40 px-3 py-2.5 text-sm text-gray-400">
              <span className={`font-semibold ${accurate ? "text-up" : "text-down"}`}>{accurate ? "Forecast checked:" : "Use with care:"}</span>{" "}
              over the last {bt!.days} trading days, real losses were bigger than forecast on {(chosen.var95.rate * 100).toFixed(1)}% of days
              (expected: 5%).
            </p>
          )}
        </div>

        <div className="min-w-0">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">Volatility, last 12 months</p>
          <VolatilityChart series={report.volSeries} longRun={longRunAnnual} />
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            {report.forecast.map((f) => (
              <span key={f.days} className="rounded-md bg-gray-700/70 px-2 py-1 text-gray-400">
                {f.days === 1 ? "Tomorrow" : f.days === 5 ? "Next week" : "Next month"}: <span className="tabular-nums text-gray-100">±{f.dailySd.toFixed(2)}%/day</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-5 border-t border-gray-600/60 pt-4">
        <button
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-100 cursor-pointer"
          onClick={() => setShowDetails((v) => !v)}
          aria-expanded={showDetails}
        >
          <ChevronDown className={`h-4 w-4 transition-transform ${showDetails ? "rotate-180" : ""}`} /> How this is calculated
        </button>

        {showDetails && (
          <div className="mt-4 space-y-5 text-xs text-gray-400">
            <p className="leading-relaxed">
              A GARCH(1,1) model learns from {report.observations.toLocaleString()} trading days how calm and stormy periods follow each other,
              and forecasts tomorrow&apos;s volatility. Possible losses use the model&apos;s own history of surprises, which captures rare big drops.
              After a shock, half of the extra volatility fades in about {Math.round(report.params.halfLifeDays)} trading days.
            </p>

            {bt && (
              <>
                <div>
                  <p className="mb-2 font-semibold text-gray-100">Backtest: forecast loss limit vs what actually happened</p>
                  <BacktestChart series={bt.series} />
                </div>

                <div className="overflow-x-auto">
                  <table className="data-table text-xs!">
                    <thead>
                      <tr>
                        <th>Method</th>
                        <th className="text-right">Bad-day misses</th>
                        <th className="text-right">Very-bad-day misses</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bt.models.map((m) => (
                        <tr key={m.model} className={m.model === "garch-fhs" ? "bg-yellow-500/5" : ""}>
                          <td className="whitespace-normal! text-gray-400">
                            {MODEL_LABELS[m.model]}
                            {m.model === "garch-fhs" && <span className="ml-1.5 text-yellow-500">(used)</span>}
                          </td>
                          <td className="text-right">{(m.var95.rate * 100).toFixed(1)}% · <PassFail pass={m.var95.pass} /></td>
                          <td className="text-right">{(m.var99.rate * 100).toFixed(1)}% · <PassFail pass={m.var99.pass} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="mt-2 leading-relaxed text-gray-500">
                    Targets are 5% and 1% of days. &quot;Pass&quot; means the miss rate is statistically consistent with the target (Kupiec test, 5% level).
                  </p>
                </div>

                <p className="leading-relaxed">
                  <span className="font-semibold text-gray-100">Why forecast risk, not price?</span> A model predicting tomorrow&apos;s return (AR(1)) got the
                  direction right on {(bt.meanModel.directionAccuracy * 100).toFixed(1)}% of days: no better than a coin flip. Volatility, by contrast, is forecastable.
                </p>
              </>
            )}

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Stat label="α (shock impact)" value={report.params.alpha.toFixed(3)} />
              <Stat label="β (persistence)" value={report.params.beta.toFixed(3)} />
              <Stat label="α + β" value={report.params.persistence.toFixed(3)} />
              <Stat label="Shock half-life" value={`${report.params.halfLifeDays.toFixed(0)} days`} />
            </div>

            {portfolio && (
              <p>Weights used: {portfolio.holdings.map((h) => `${h.symbol} ${(h.weight * 100).toFixed(1)}%`).join(", ")}.</p>
            )}
            <p className="text-gray-500">Data as of {report.asOf}. Educational estimate, not financial advice.</p>
          </div>
        )}
      </div>
    </div>
  );
}
