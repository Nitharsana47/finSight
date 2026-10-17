import { Briefcase, CalendarClock, PiggyBank, Wallet } from "lucide-react";
import StatCard from "@/components/StatCard";
import HoldingModal from "@/components/HoldingModal";
import PortfolioTable from "@/components/PortfolioTable";
import { PortfolioInsightCard } from "@/components/InsightCard";
import RiskCard from "@/components/risk/RiskCard";
import { getPortfolio } from "@/lib/actions/portfolio.actions";
import { getPortfolioRisk } from "@/lib/risk-data";
import { formatPrice } from "@/lib/utils";

export const metadata = { title: "Portfolio" };

const signed = (n: number) => `${n >= 0 ? "+" : "-"}${formatPrice(Math.abs(n))}`;
const pct = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;

export default async function PortfolioPage() {
  const { holdings, summary } = await getPortfolio();
  const hasHoldings = holdings.length > 0;
  const risk = hasHoldings ? await getPortfolioRisk(holdings) : null;

  return (
    <div className="space-y-8">
      <div className="page-header mb-0!">
        <div>
          <p className="page-eyebrow">Your investments</p>
          <h1 className="page-title">Portfolio</h1>
          <p className="page-subtitle">Record what you own to see live value, profit and loss, and risk.</p>
        </div>
        <HoldingModal />
      </div>

      <div className="stat-grid">
        <StatCard icon={Wallet} label="Total value" value={formatPrice(summary.totalValue)} sub={`${holdings.length} holding${holdings.length === 1 ? "" : "s"}`} />
        <StatCard icon={PiggyBank} label="Total invested" value={formatPrice(summary.totalCost)} />
        <StatCard
          icon={Briefcase}
          label="Total profit / loss"
          value={signed(summary.totalProfit)}
          sub={pct(summary.totalProfitPercent)}
          tone={summary.totalProfit >= 0 ? "up" : "down"}
        />
        <StatCard
          icon={CalendarClock}
          label="Today"
          value={signed(summary.dayChange)}
          sub={pct(summary.dayChangePercent)}
          tone={summary.dayChange >= 0 ? "up" : "down"}
        />
      </div>

      <div>
          {hasHoldings ? (
            <PortfolioTable holdings={holdings} totalValue={summary.totalValue} />
          ) : (
            <div className="empty-state">
              <Briefcase className="h-12 w-12 text-yellow-500 mb-4" />
              <h2 className="empty-title">No holdings yet</h2>
              <p className="empty-description">Add a stock you own with the number of shares and your buy price to start tracking your returns.</p>
              <HoldingModal triggerLabel="Add your first holding" />
            </div>
          )}
      </div>

      {hasHoldings && <RiskCard report={risk} title="Portfolio risk" subject="Your portfolio" />}
      {hasHoldings && <PortfolioInsightCard />}
    </div>
  );
}
