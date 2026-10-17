import Link from "next/link";
import { ArrowRight, BellRing, Briefcase, Star, TrendingUp } from "lucide-react";
import TradingViewWidget from "@/components/TradingViewWidget";
import StatCard from "@/components/StatCard";
import ChangeBadge from "@/components/ChangeBadge";
import {
    HEATMAP_WIDGET_CONFIG,
    MARKET_DATA_WIDGET_CONFIG,
    MARKET_OVERVIEW_WIDGET_CONFIG,
    TOP_STORIES_WIDGET_CONFIG
} from "@/lib/constants";
import { getSessionUser } from "@/lib/session";
import { getWatchlistWithData } from "@/lib/actions/watchlist.actions";
import { getAlerts } from "@/lib/actions/alert.actions";
import { getPortfolio } from "@/lib/actions/portfolio.actions";
import { formatPrice } from "@/lib/utils";

const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
};

const Home = async () => {
    const scriptUrl = `https://s3.tradingview.com/external-embedding/embed-widget-`;

    const [user, watchlist, alerts, portfolio] = await Promise.all([
        getSessionUser(),
        getWatchlistWithData(),
        getAlerts(),
        getPortfolio(),
    ]);

    const activeAlerts = alerts.filter((a) => a.active);
    const triggeredAlerts = alerts.filter((a) => !a.active);
    const { summary } = portfolio;
    const topMovers = [...watchlist]
        .filter((w) => typeof w.changePercent === 'number')
        .sort((a, b) => Math.abs(b.changePercent!) - Math.abs(a.changePercent!))
        .slice(0, 4);

    return (
        <div className="flex min-h-screen home-wrapper">
          <section className="hero w-full">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                      <p className="page-eyebrow">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
                      <h1 className="page-title">{greeting()}, {user?.name?.split(' ')[0] ?? 'investor'}</h1>
                      <p className="page-subtitle">Here&apos;s your market snapshot: your watchlist, alerts and portfolio in one place.</p>
                  </div>
                  <div className="flex flex-wrap gap-3">
                      <Link href="/watchlist" className="btn-outline"><Star className="h-4 w-4" /> Watchlist</Link>
                      <Link href="/portfolio" className="btn-primary"><Briefcase className="h-4 w-4" /> Portfolio</Link>
                  </div>
              </div>

              <div className="stat-grid mt-8">
                  <StatCard
                      icon={Briefcase}
                      label="Portfolio value"
                      value={formatPrice(summary.totalValue)}
                      sub={portfolio.holdings.length ? `${summary.totalProfit >= 0 ? '+' : ''}${summary.totalProfitPercent.toFixed(2)}% all time` : 'No holdings yet'}
                      tone={!portfolio.holdings.length ? 'muted' : summary.totalProfit >= 0 ? 'up' : 'down'}
                  />
                  <StatCard
                      icon={TrendingUp}
                      label="Today's change"
                      value={`${summary.dayChange >= 0 ? '+' : '-'}${formatPrice(Math.abs(summary.dayChange))}`}
                      sub={`${summary.dayChangePercent >= 0 ? '+' : ''}${summary.dayChangePercent.toFixed(2)}%`}
                      tone={summary.dayChange >= 0 ? 'up' : 'down'}
                  />
                  <StatCard icon={Star} label="Watchlist" value={String(watchlist.length)} sub={watchlist.length === 1 ? 'stock tracked' : 'stocks tracked'} />
                  <StatCard
                      icon={BellRing}
                      label="Active alerts"
                      value={String(activeAlerts.length)}
                      sub={triggeredAlerts.length ? `${triggeredAlerts.length} triggered` : 'Checked every 5 min'}
                      tone={triggeredAlerts.length ? 'up' : 'muted'}
                  />
              </div>

              {topMovers.length > 0 && (
                  <div className="mt-6">
                      <div className="flex items-center justify-between mb-3">
                          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500">Biggest movers on your watchlist</h2>
                          <Link href="/watchlist" className="text-sm text-yellow-500 hover:underline inline-flex items-center gap-1">View all <ArrowRight className="h-3.5 w-3.5" /></Link>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                          {topMovers.map((s) => (
                              <Link key={s.symbol} href={`/stocks/${s.symbol}`} className="flex items-center justify-between rounded-xl border border-gray-600/60 bg-gray-900/40 px-4 py-3 transition-colors hover:border-yellow-500/40">
                                  <div className="flex items-center gap-3 min-w-0">
                                      <span className="symbol-avatar">{s.symbol.slice(0, 4)}</span>
                                      <div className="min-w-0">
                                          <p className="font-semibold text-gray-100">{s.symbol}</p>
                                          <p className="text-xs text-gray-500 truncate">{s.currentPrice ? formatPrice(s.currentPrice) : '—'}</p>
                                      </div>
                                  </div>
                                  <ChangeBadge value={s.changePercent} />
                              </Link>
                          ))}
                      </div>
                  </div>
              )}
          </section>

          <section className="grid w-full gap-8 home-section">
              <div className="md:col-span-1 xl:col-span-1">
                  <TradingViewWidget
                    title="Market Overview"
                    scriptUrl={`${scriptUrl}market-overview.js`}
                    config={MARKET_OVERVIEW_WIDGET_CONFIG}
                    className="custom-chart"
                    height={600}
                  />
              </div>
              <div className="md-col-span xl:col-span-2">
                  <TradingViewWidget
                      title="Stock Heatmap"
                      scriptUrl={`${scriptUrl}stock-heatmap.js`}
                      config={HEATMAP_WIDGET_CONFIG}
                      height={600}
                  />
              </div>
          </section>
            <section className="grid w-full gap-8 home-section">
                <div className="h-full md:col-span-1 xl:col-span-1">
                    <TradingViewWidget
                        title="Top Stories"
                        scriptUrl={`${scriptUrl}timeline.js`}
                        config={TOP_STORIES_WIDGET_CONFIG}
                        height={600}
                    />
                </div>
                <div className="h-full md:col-span-1 xl:col-span-2">
                    <TradingViewWidget
                        title="Market Data"
                        scriptUrl={`${scriptUrl}market-quotes.js`}
                        config={MARKET_DATA_WIDGET_CONFIG}
                        height={600}
                    />
                </div>
            </section>
        </div>
    )
}

export default Home;
