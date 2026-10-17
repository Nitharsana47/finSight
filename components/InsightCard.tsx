"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { FileText, Loader2, RefreshCw } from "lucide-react";
import { explainStock, analyzePortfolio } from "@/lib/actions/ai.actions";

const sentimentStyles: Record<StockInsight["sentiment"], string> = {
  bullish: "badge-up",
  neutral: "badge-muted",
  bearish: "badge-down",
};

// Plain list with a small coloured marker instead of icon bullets
const List = ({ items, marker }: { items: string[]; marker: string }) => (
  <ul className="space-y-2">
    {items.map((item, i) => (
      <li key={i} className="flex gap-2.5 text-sm leading-relaxed text-gray-400">
        <span className={`mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full ${marker}`} aria-hidden="true" />
        <span>{item}</span>
      </li>
    ))}
  </ul>
);

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div>
    <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">{title}</p>
    {children}
  </div>
);

const Shell = ({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) => (
  <div className="card">
    <div className="mb-4">
      <h3 className="card-title flex items-center gap-2"><FileText className="h-5 w-5 text-yellow-500" /> {title}</h3>
      <p className="text-sm text-gray-500">{subtitle}</p>
    </div>
    {children}
    <p className="mt-4 border-t border-gray-600/60 pt-3 text-xs text-gray-500">For education only. Not financial advice.</p>
  </div>
);

const Trigger = ({ pending, hasResult, onClick, label }: { pending: boolean; hasResult: boolean; onClick: () => void; label: string }) => (
  <button className={hasResult ? "btn-outline" : "btn-primary w-full h-11"} onClick={onClick} disabled={pending}>
    {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : hasResult ? <RefreshCw className="h-4 w-4" /> : null}
    {pending ? "Preparing…" : hasResult ? "Refresh" : label}
  </button>
);

export const StockInsightCard = ({ symbol }: { symbol: string }) => {
  const [insight, setInsight] = useState<StockInsight | null>(null);
  const [pending, startTransition] = useTransition();

  const run = () =>
    startTransition(async () => {
      const result = await explainStock(symbol);
      if (result.success && result.data) setInsight(result.data);
      else if (!result.success) toast.error(result.error);
    });

  return (
    <Shell title={`${symbol} at a glance`} subtitle="A plain-English summary matched to your goals and risk level.">
      {insight ? (
        <div className="space-y-5">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">Current outlook</span>
            <span className={`badge capitalize ${sentimentStyles[insight.sentiment]}`}>{insight.sentiment}</span>
          </div>
          <p className="text-gray-100 leading-relaxed">{insight.summary}</p>
          {insight.keyPoints.length > 0 && (
            <Section title="Key points">
              <List items={insight.keyPoints} marker="bg-teal-400" />
            </Section>
          )}
          {insight.risks.length > 0 && (
            <Section title="Risks to watch">
              <List items={insight.risks} marker="bg-orange-500" />
            </Section>
          )}
          {insight.fitForYou && (
            <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-4">
              <p className="mb-1 text-sm font-semibold text-yellow-500">For your profile</p>
              <p className="text-sm text-gray-400 leading-relaxed">{insight.fitForYou}</p>
            </div>
          )}
          <Trigger pending={pending} hasResult onClick={run} label="" />
        </div>
      ) : (
        <Trigger pending={pending} hasResult={false} onClick={run} label="Show summary" />
      )}
    </Shell>
  );
};

export const PortfolioInsightCard = ({ disabled }: { disabled?: boolean }) => {
  const [insight, setInsight] = useState<PortfolioInsight | null>(null);
  const [pending, startTransition] = useTransition();

  const run = () =>
    startTransition(async () => {
      const result = await analyzePortfolio();
      if (result.success && result.data) setInsight(result.data);
      else if (!result.success) toast.error(result.error);
    });

  return (
    <Shell title="Portfolio review" subtitle="Diversification, risk fit and ideas based on your profile.">
      {insight ? (
        <div className="space-y-5">
          <div>
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-gray-500">Diversification score</span>
              <span className="font-bold text-gray-100 tabular-nums">{insight.diversificationScore}/10</span>
            </div>
            <div className="h-2 rounded-full bg-gray-600 overflow-hidden">
              <div className="h-full rounded-full bg-yellow-500" style={{ width: `${insight.diversificationScore * 10}%` }} />
            </div>
          </div>
          <p className="text-gray-100 leading-relaxed max-w-3xl">{insight.overview}</p>
          <div className="grid gap-5 md:grid-cols-3">
            {insight.strengths.length > 0 && (
              <Section title="Strengths">
                <List items={insight.strengths} marker="bg-teal-400" />
              </Section>
            )}
            {insight.concerns.length > 0 && (
              <Section title="Concerns">
                <List items={insight.concerns} marker="bg-orange-500" />
              </Section>
            )}
            {insight.suggestions.length > 0 && (
              <Section title="Ideas to consider">
                <List items={insight.suggestions} marker="bg-yellow-500" />
              </Section>
            )}
          </div>
          <Trigger pending={pending} hasResult onClick={run} label="" />
        </div>
      ) : disabled ? (
        <p className="text-sm text-gray-500">Add at least one holding to see a review.</p>
      ) : (
        <div className="max-w-xs"><Trigger pending={pending} hasResult={false} onClick={run} label="Review my portfolio" /></div>
      )}
    </Shell>
  );
};
