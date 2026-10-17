import TradingViewWidget from "@/components/TradingViewWidget";
import StockActions from "@/components/StockActions";
import ChangeBadge from "@/components/ChangeBadge";
import { StockInsightCard } from "@/components/InsightCard";
import RiskCard from "@/components/risk/RiskCard";
import { getStockRisk } from "@/lib/risk-data";
import {
  CANDLE_CHART_WIDGET_CONFIG,
  BASELINE_WIDGET_CONFIG,
  TECHNICAL_ANALYSIS_WIDGET_CONFIG,
  COMPANY_PROFILE_WIDGET_CONFIG,
  COMPANY_FINANCIALS_WIDGET_CONFIG,
} from "@/lib/constants";
import { fetchQuote } from "@/lib/market";
import { isInWatchlist } from "@/lib/actions/watchlist.actions";
import { getAlerts } from "@/lib/actions/alert.actions";
import { formatPrice } from "@/lib/utils";

export async function generateMetadata({ params }: StockDetailsPageProps) {
  const { symbol } = await params;
  return { title: symbol.toUpperCase() };
}

export default async function StockDetails({ params }: StockDetailsPageProps) {
  const { symbol: rawSymbol } = await params;
  const symbol = decodeURIComponent(rawSymbol).toUpperCase();
  const scriptUrl = `https://s3.tradingview.com/external-embedding/embed-widget-`;

  const [quote, inWatchlist, alerts, risk] = await Promise.all([
    fetchQuote(symbol),
    isInWatchlist(symbol),
    getAlerts(symbol),
    getStockRisk(symbol),
  ]);
  const company = quote?.name || symbol;

  return (
    <div className="flex flex-col gap-8">
      <div className="hero">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <span className="symbol-avatar h-14! w-14! text-sm! rounded-2xl!">{symbol.slice(0, 4)}</span>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-100">{company}</h1>
              <p className="text-gray-500">{symbol}</p>
            </div>
          </div>
          {quote && (
            <div className="md:text-right">
              <p className="text-3xl md:text-4xl font-bold text-gray-100 tabular-nums">{formatPrice(quote.price)}</p>
              <div className="mt-1 flex items-center gap-2 md:justify-end">
                <span className={`text-sm font-semibold tabular-nums ${quote.change >= 0 ? "text-up" : "text-down"}`}>
                  {quote.change >= 0 ? "+" : "-"}{formatPrice(Math.abs(quote.change))}
                </span>
                <ChangeBadge value={quote.changePercent} />
                <span className="text-xs text-gray-500">today</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Row 1: price chart beside the actions and summary (summary stretches to the chart's height) */}
      <section className="grid w-full grid-cols-1 gap-8 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <TradingViewWidget
            scriptUrl={`${scriptUrl}advanced-chart.js`}
            config={CANDLE_CHART_WIDGET_CONFIG(symbol)}
            className="custom-chart"
            height={600}
          />
        </div>
        <div className="flex flex-col gap-6">
          <StockActions
            symbol={symbol}
            company={company}
            isInWatchlist={inWatchlist}
            currentPrice={quote?.price}
            activeAlerts={alerts.filter((a) => a.active).length}
          />
          <div className="flex-1 [&>.card]:h-full">
            <StockInsightCard symbol={symbol} />
          </div>
        </div>
      </section>

      {/* Row 2: risk forecast across the full width */}
      <RiskCard report={risk} subject={symbol} />

      {/* Row 3: long-term trend chart across the full width */}
      <TradingViewWidget
        scriptUrl={`${scriptUrl}advanced-chart.js`}
        config={BASELINE_WIDGET_CONFIG(symbol)}
        className="custom-chart"
        height={480}
      />

      {/* Row 4: three equal panels */}
      <section className="grid w-full grid-cols-1 items-start gap-8 md:grid-cols-2 xl:grid-cols-3">
        <TradingViewWidget
          scriptUrl={`${scriptUrl}technical-analysis.js`}
          config={TECHNICAL_ANALYSIS_WIDGET_CONFIG(symbol)}
          height={464}
        />
        <TradingViewWidget
          scriptUrl={`${scriptUrl}symbol-profile.js`}
          config={COMPANY_PROFILE_WIDGET_CONFIG(symbol)}
          height={464}
        />
        <TradingViewWidget
          scriptUrl={`${scriptUrl}financials.js`}
          config={COMPANY_FINANCIALS_WIDGET_CONFIG(symbol)}
          height={464}
        />
      </section>
    </div>
  );
}
