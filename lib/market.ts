// Server-side market data helpers.
// Finnhub is the primary source; Yahoo Finance (no key required) is used as a
// fallback so prices, search and news keep working if the Finnhub key fails.

const FINNHUB_BASE_URL = 'https://finnhub.io/api/v1';
const YAHOO_BASE_URL = 'https://query1.finance.yahoo.com';
const YAHOO_HEADERS = { 'User-Agent': 'Mozilla/5.0 (FinSight)' };

const getFinnhubToken = () => process.env.FINNHUB_API_KEY ?? '';

export type Quote = {
    symbol: string;
    name?: string;
    price: number;
    change: number;
    changePercent: number;
    high?: number;
    low?: number;
    prevClose?: number;
    source: 'finnhub' | 'yahoo';
};

async function getJSON<T>(url: string, revalidateSeconds: number, headers?: Record<string, string>): Promise<T> {
    const res = await fetch(url, {
        headers,
        signal: AbortSignal.timeout(20_000), // a dropped connection must fail, not hang
        cache: 'force-cache',
        next: { revalidate: revalidateSeconds },
    } as RequestInit & { next?: { revalidate?: number } });
    if (!res.ok) throw new Error(`Fetch failed ${res.status}`);
    return (await res.json()) as T;
}

async function getFinnhubQuote(symbol: string): Promise<Quote | null> {
    const token = getFinnhubToken();
    if (!token) return null;
    const data = await getJSON<{ c?: number; d?: number; dp?: number; h?: number; l?: number; pc?: number }>(
        `${FINNHUB_BASE_URL}/quote?symbol=${encodeURIComponent(symbol)}&token=${token}`,
        60
    );
    // Finnhub returns c = 0 for unknown symbols
    if (!data?.c) return null;
    return {
        symbol,
        price: data.c,
        change: data.d ?? 0,
        changePercent: data.dp ?? 0,
        high: data.h,
        low: data.l,
        prevClose: data.pc,
        source: 'finnhub',
    };
}

type YahooChartMeta = {
    regularMarketPrice?: number;
    previousClose?: number;
    chartPreviousClose?: number;
    regularMarketDayHigh?: number;
    regularMarketDayLow?: number;
    longName?: string;
    shortName?: string;
};

async function getYahooQuote(symbol: string): Promise<Quote | null> {
    const data = await getJSON<{ chart?: { result?: { meta?: YahooChartMeta }[] } }>(
        `${YAHOO_BASE_URL}/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=1d`,
        60,
        YAHOO_HEADERS
    );
    const meta = data?.chart?.result?.[0]?.meta;
    if (!meta?.regularMarketPrice) return null;

    const price = meta.regularMarketPrice;
    const prevClose = meta.previousClose ?? meta.chartPreviousClose;
    const change = prevClose ? price - prevClose : 0;
    return {
        symbol,
        name: meta.longName || meta.shortName,
        price,
        change,
        changePercent: prevClose ? (change / prevClose) * 100 : 0,
        high: meta.regularMarketDayHigh,
        low: meta.regularMarketDayLow,
        prevClose,
        source: 'yahoo',
    };
}

export async function fetchQuote(rawSymbol: string): Promise<Quote | null> {
    const symbol = rawSymbol.trim().toUpperCase();
    if (!symbol) return null;

    try {
        const quote = await getFinnhubQuote(symbol);
        if (quote) return quote;
    } catch {
        // fall through to Yahoo
    }

    try {
        return await getYahooQuote(symbol);
    } catch (e) {
        console.warn(`Quote unavailable for ${symbol}:`, (e as Error).message);
        return null;
    }
}

export async function fetchQuotes(symbols: string[]): Promise<Record<string, Quote | null>> {
    const unique = [...new Set(symbols.map((s) => s.trim().toUpperCase()).filter(Boolean))];
    const entries = await Promise.all(unique.map(async (s) => [s, await fetchQuote(s)] as const));
    return Object.fromEntries(entries);
}

export type PriceHistory = { dates: string[]; closes: number[] };

// Daily split- and dividend-adjusted closes (Yahoo Finance, no key required)
export async function fetchDailyHistory(rawSymbol: string, range = '5y'): Promise<PriceHistory | null> {
    const symbol = rawSymbol.trim().toUpperCase();
    try {
        const data = await getJSON<{
            chart?: { result?: { timestamp?: number[]; indicators?: { adjclose?: { adjclose?: (number | null)[] }[]; quote?: { close?: (number | null)[] }[] } }[] };
        }>(`${YAHOO_BASE_URL}/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=1d`, 6 * 60 * 60, YAHOO_HEADERS);

        const result = data?.chart?.result?.[0];
        const stamps = result?.timestamp ?? [];
        const closes = result?.indicators?.adjclose?.[0]?.adjclose ?? result?.indicators?.quote?.[0]?.close ?? [];

        const dates: string[] = [];
        const values: number[] = [];
        stamps.forEach((ts, i) => {
            const c = closes[i];
            if (typeof c === 'number' && c > 0) {
                dates.push(new Date(ts * 1000).toISOString().slice(0, 10));
                values.push(c);
            }
        });
        return values.length > 1 ? { dates, closes: values } : null;
    } catch (e) {
        console.warn(`Price history unavailable for ${symbol}:`, (e as Error).message);
        return null;
    }
}

type YahooSearchQuote = {
    symbol?: string;
    shortname?: string;
    longname?: string;
    exchDisp?: string;
    typeDisp?: string;
    quoteType?: string;
};

type YahooSearchNews = {
    uuid?: string;
    title?: string;
    publisher?: string;
    link?: string;
    providerPublishTime?: number;
    thumbnail?: { resolutions?: { url?: string }[] };
    relatedTickers?: string[];
};

export async function yahooSearch(query: string): Promise<Stock[]> {
    const data = await getJSON<{ quotes?: YahooSearchQuote[] }>(
        `${YAHOO_BASE_URL}/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=15&newsCount=0`,
        1800,
        YAHOO_HEADERS
    );
    return (data?.quotes || [])
        .filter((q) => q.symbol && (q.quoteType === 'EQUITY' || q.quoteType === 'ETF'))
        .map((q) => ({
            symbol: q.symbol!.toUpperCase(),
            name: q.longname || q.shortname || q.symbol!,
            exchange: q.exchDisp || 'US',
            type: q.typeDisp || 'Stock',
        }));
}

export async function yahooNews(query: string, limit = 6): Promise<MarketNewsArticle[]> {
    const data = await getJSON<{ news?: YahooSearchNews[] }>(
        `${YAHOO_BASE_URL}/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=0&newsCount=${limit}`,
        300,
        YAHOO_HEADERS
    );
    return (data?.news || [])
        .filter((n) => n.title && n.link && n.providerPublishTime)
        .slice(0, limit)
        .map((n, i) => ({
            id: n.providerPublishTime! + i,
            headline: n.title!,
            summary: '',
            source: n.publisher || 'Yahoo Finance',
            url: n.link!,
            datetime: n.providerPublishTime!,
            category: 'company',
            related: n.relatedTickers?.[0] || query.toUpperCase(),
            image: n.thumbnail?.resolutions?.[0]?.url || '',
        }));
}
