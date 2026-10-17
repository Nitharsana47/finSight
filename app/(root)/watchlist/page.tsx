import { Star } from "lucide-react";
import WatchlistTable from "@/components/WatchlistTable";
import AlertsList from "@/components/AlertsList";
import NewsGrid from "@/components/NewsGrid";
import SearchCommand from "@/components/SearchCommand";
import { getWatchlistWithData } from "@/lib/actions/watchlist.actions";
import { getAlerts } from "@/lib/actions/alert.actions";
import { getNews, searchStocks } from "@/lib/actions/finnhub.actions";

export const metadata = { title: "Watchlist" };

export default async function WatchlistPage() {
  const [watchlist, alerts, initialStocks] = await Promise.all([getWatchlistWithData(), getAlerts(), searchStocks()]);
  const news = await getNews(watchlist.map((w) => w.symbol)).catch(() => []);

  return (
    <div className="space-y-10">
      <div className="page-header mb-0!">
        <div>
          <p className="page-eyebrow">Your stocks</p>
          <h1 className="page-title">Watchlist</h1>
          <p className="page-subtitle">Track the stocks you care about, set price alerts, and catch the latest news.</p>
        </div>
        <SearchCommand renderAs="button" label="+ Add stock" initialStocks={initialStocks} />
      </div>

      <section>
          {watchlist.length === 0 ? (
            <div className="empty-state">
              <Star className="watchlist-star h-12! w-12! text-yellow-500!" />
              <h2 className="empty-title">Your watchlist is empty</h2>
              <p className="empty-description">
                Search for a stock and tap the star to start tracking it. Your daily news email is built from this list.
              </p>
              <SearchCommand renderAs="button" label="Find a stock" initialStocks={initialStocks} />
            </div>
          ) : (
            <WatchlistTable watchlist={watchlist} />
          )}
      </section>

      <section>
        <AlertsList alertData={alerts} />
      </section>

      <section>
        <h2 className="watchlist-title mb-5">{watchlist.length > 0 ? "News for your watchlist" : "Market news"}</h2>
        <NewsGrid news={news} />
      </section>
    </div>
  );
}
