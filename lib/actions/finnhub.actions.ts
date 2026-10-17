'use server';

import { getDateRange, validateArticle, formatArticle } from '@/lib/utils';
import { POPULAR_STOCK_SYMBOLS } from '@/lib/constants';
import { cache } from 'react';
import { fetchQuote, yahooNews, yahooSearch, type Quote } from '@/lib/market';
import { getSessionUser } from '@/lib/session';
import { getWatchlistSymbolsByEmail } from '@/lib/actions/watchlist.actions';

const FINNHUB_BASE_URL = 'https://finnhub.io/api/v1';
const NEXT_PUBLIC_FINNHUB_API_KEY = process.env.NEXT_PUBLIC_FINNHUB_API_KEY ?? '';

async function fetchJSON<T>(url: string, revalidateSeconds?: number): Promise<T> {
  const options: RequestInit & { next?: { revalidate?: number } } = revalidateSeconds
    ? { cache: 'force-cache', next: { revalidate: revalidateSeconds } }
    : { cache: 'no-store' };

  const res = await fetch(url, options);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Fetch failed ${res.status}: ${text.slice(0, 120)}`);
  }
  return (await res.json()) as T;
}

export { fetchJSON };

export async function getStockQuote(symbol: string): Promise<Quote | null> {
  return fetchQuote(symbol);
}

// Yahoo Finance news fallback, picking articles round-robin across symbols
async function getYahooNewsFallback(symbols: string[], maxArticles: number): Promise<MarketNewsArticle[]> {
  if (symbols.length === 0) return yahooNews('stock market', maxArticles);

  const perSymbol = await Promise.all(symbols.map((s) => yahooNews(s, maxArticles).catch(() => [])));
  const collected: MarketNewsArticle[] = [];
  const seen = new Set<string>();
  for (let round = 0; round < maxArticles && collected.length < maxArticles; round++) {
    for (const list of perSymbol) {
      const article = list[round];
      if (!article || seen.has(article.url)) continue;
      seen.add(article.url);
      collected.push(article);
      if (collected.length >= maxArticles) break;
    }
  }
  if (collected.length === 0) return yahooNews('stock market', maxArticles);
  return collected.sort((a, b) => b.datetime - a.datetime);
}

export async function getNews(symbols?: string[]): Promise<MarketNewsArticle[]> {
  const maxArticles = 6;
  const cleanSymbols = (symbols || [])
    .map((s) => s?.trim().toUpperCase())
    .filter((s): s is string => Boolean(s));

  try {
    const range = getDateRange(5);
    const token = process.env.FINNHUB_API_KEY ?? NEXT_PUBLIC_FINNHUB_API_KEY;
    if (!token) {
      throw new Error('FINNHUB API key is not configured');
    }

    // If we have symbols, try to fetch company news per symbol and round-robin select
    if (cleanSymbols.length > 0) {
      const perSymbolArticles: Record<string, RawNewsArticle[]> = {};

      await Promise.all(
        cleanSymbols.map(async (sym) => {
          try {
            const url = `${FINNHUB_BASE_URL}/company-news?symbol=${encodeURIComponent(sym)}&from=${range.from}&to=${range.to}&token=${token}`;
            const articles = await fetchJSON<RawNewsArticle[]>(url, 300);
            perSymbolArticles[sym] = (articles || []).filter(validateArticle);
          } catch {
            perSymbolArticles[sym] = [];
          }
        })
      );

      const collected: MarketNewsArticle[] = [];
      // Round-robin up to 6 picks
      for (let round = 0; round < maxArticles; round++) {
        for (let i = 0; i < cleanSymbols.length; i++) {
          const sym = cleanSymbols[i];
          const list = perSymbolArticles[sym] || [];
          if (list.length === 0) continue;
          const article = list.shift();
          if (!article || !validateArticle(article)) continue;
          collected.push(formatArticle(article, true, sym, round));
          if (collected.length >= maxArticles) break;
        }
        if (collected.length >= maxArticles) break;
      }

      if (collected.length > 0) {
        // Sort by datetime desc
        collected.sort((a, b) => (b.datetime || 0) - (a.datetime || 0));
        return collected.slice(0, maxArticles);
      }
      // If none collected, fall through to general news
    }

    // General market news fallback or when no symbols provided
    const generalUrl = `${FINNHUB_BASE_URL}/news?category=general&token=${token}`;
    const general = await fetchJSON<RawNewsArticle[]>(generalUrl, 300);

    const seen = new Set<string>();
    const unique: RawNewsArticle[] = [];
    for (const art of general || []) {
      if (!validateArticle(art)) continue;
      const key = `${art.id}-${art.url}-${art.headline}`;
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(art);
      if (unique.length >= 20) break; // cap early before final slicing
    }

    return unique.slice(0, maxArticles).map((a, idx) => formatArticle(a, false, undefined, idx));
  } catch (err) {
    console.warn('Finnhub news unavailable, using Yahoo Finance:', (err as Error).message);
    try {
      return await getYahooNewsFallback(cleanSymbols, maxArticles);
    } catch (e) {
      console.error('getNews error:', e);
      throw new Error('Failed to fetch news');
    }
  }
}

async function getPopularStocks(token: string): Promise<Stock[]> {
  const top = POPULAR_STOCK_SYMBOLS.slice(0, 10);
  const stocks = await Promise.all(
    top.map(async (sym): Promise<Stock | null> => {
      if (token) {
        try {
          const url = `${FINNHUB_BASE_URL}/stock/profile2?symbol=${encodeURIComponent(sym)}&token=${token}`;
          // Revalidate every hour
          const profile = await fetchJSON<{ name?: string; ticker?: string; exchange?: string }>(url, 3600);
          const name = profile?.name || profile?.ticker;
          if (name) return { symbol: sym, name, exchange: profile.exchange || 'US', type: 'Common Stock' };
        } catch {
          // fall through to Yahoo
        }
      }
      try {
        const match = (await yahooSearch(sym)).find((s) => s.symbol === sym);
        return match ?? null;
      } catch {
        return null;
      }
    })
  );
  return stocks.filter((s): s is Stock => Boolean(s));
}

async function searchBySymbolOrName(query: string, token: string): Promise<Stock[]> {
  if (token) {
    try {
      const url = `${FINNHUB_BASE_URL}/search?q=${encodeURIComponent(query)}&token=${token}`;
      const data = await fetchJSON<FinnhubSearchResponse>(url, 1800);
      const results = Array.isArray(data?.result) ? data.result : [];
      return results.map((r) => ({
        symbol: (r.symbol || '').toUpperCase(),
        name: r.description || r.symbol,
        exchange: r.displaySymbol || 'US',
        type: r.type || 'Stock',
      }));
    } catch {
      // fall through to Yahoo
    }
  }
  return yahooSearch(query);
}

export const searchStocks = cache(async (query?: string): Promise<StockWithWatchlistStatus[]> => {
  try {
    const token = process.env.FINNHUB_API_KEY ?? NEXT_PUBLIC_FINNHUB_API_KEY;
    const trimmed = typeof query === 'string' ? query.trim() : '';

    const [stocks, user] = await Promise.all([
      trimmed ? searchBySymbolOrName(trimmed, token) : getPopularStocks(token),
      getSessionUser(),
    ]);

    const watchlist = new Set(user ? await getWatchlistSymbolsByEmail(user.email) : []);

    return stocks
      .filter((s) => s.symbol)
      .slice(0, 15)
      .map((s) => ({ ...s, isInWatchlist: watchlist.has(s.symbol) }));
  } catch (err) {
    console.error('Error in stock search:', err);
    return [];
  }
});
