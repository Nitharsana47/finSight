// Builds the risk reports shown on stock and portfolio pages from daily price history.
import { cache } from 'react';
import { fetchDailyHistory } from '@/lib/market';
import { fitGarch, forecastVariance } from '@/lib/risk/garch';
import { runBacktest, type BacktestResult } from '@/lib/risk/backtest';
import { quantile } from '@/lib/risk/math';

const TRADING_DAYS = 252;

export type RiskTrend = 'rising' | 'falling' | 'stable';

export type RiskReport = {
    asOf: string;
    observations: number;
    dailySd: number; // forecast for the next trading day, in %
    annualVol: number; // %
    longRunDailySd: number;
    trend: RiskTrend;
    var95Pct: number; // 1-day loss not exceeded on 19 of 20 days, in %
    var99Pct: number;
    forecast: { days: number; dailySd: number }[];
    params: { alpha: number; beta: number; persistence: number; halfLifeDays: number };
    volSeries: { date: string; vol: number }[]; // annualised conditional volatility, last year
    backtest: BacktestResult | null;
};

export type PortfolioRiskReport = RiskReport & {
    value: number;
    var95Usd: number;
    var99Usd: number;
    holdings: { symbol: string; weight: number }[];
};

function buildReport(returns: number[], dates: string[]): RiskReport | null {
    if (returns.length < 300) return null;

    const fit = fitGarch(returns);
    const sd = Math.sqrt(fit.nextSigma2);

    // Filtered historical simulation: scale the model's own standardised residuals by tomorrow's volatility
    const z = returns.map((r, i) => (r - fit.mu) / Math.sqrt(fit.sigma2[i]));
    const var95 = -(fit.mu + quantile(z, 0.05) * sd);
    const var99 = -(fit.mu + quantile(z, 0.01) * sd);

    const monthAgoSd = Math.sqrt(fit.sigma2[Math.max(0, fit.sigma2.length - 21)]);
    const change = sd / monthAgoSd;
    const trend: RiskTrend = change > 1.1 ? 'rising' : change < 0.9 ? 'falling' : 'stable';

    const tail = Math.min(TRADING_DAYS, fit.sigma2.length);
    const volSeries = fit.sigma2.slice(-tail).map((s2, i) => ({
        date: dates[dates.length - tail + i],
        vol: Math.sqrt(s2 * TRADING_DAYS),
    }));

    return {
        asOf: dates[dates.length - 1],
        observations: returns.length,
        dailySd: sd,
        annualVol: sd * Math.sqrt(TRADING_DAYS),
        longRunDailySd: Math.sqrt(fit.longRunVariance),
        trend,
        var95Pct: var95,
        var99Pct: var99,
        forecast: [1, 5, 21].map((days) => ({ days, dailySd: Math.sqrt(forecastVariance(fit, days)) })),
        params: { alpha: fit.alpha, beta: fit.beta, persistence: fit.persistence, halfLifeDays: fit.halfLifeDays },
        volSeries,
        backtest: runBacktest(returns, dates),
    };
}

export const getStockRisk = cache(async (symbol: string): Promise<RiskReport | null> => {
    try {
        const history = await fetchDailyHistory(symbol);
        if (!history) return null;
        const returns = history.closes.slice(1).map((p, i) => 100 * Math.log(p / history.closes[i]));
        return buildReport(returns, history.dates.slice(1));
    } catch (err) {
        console.error('getStockRisk error:', err);
        return null;
    }
});

// Portfolio risk with today's weights held constant over the history (standard for VaR of current positions)
export async function getPortfolioRisk(holdings: HoldingWithData[]): Promise<PortfolioRiskReport | null> {
    const positions = holdings.filter((h) => h.value > 0);
    const value = positions.reduce((s, h) => s + h.value, 0);
    if (positions.length === 0 || value <= 0) return null;

    try {
        const histories = await Promise.all(positions.map((h) => fetchDailyHistory(h.symbol)));
        if (histories.some((h) => !h)) return null;

        const priceMaps = histories.map((h) => new Map(h!.dates.map((d, i) => [d, h!.closes[i]])));
        const commonDates = histories[0]!.dates.filter((d) => priceMaps.every((m) => m.has(d)));
        if (commonDates.length < 301) return null;

        const weights = positions.map((h) => h.value / value);
        const returns: number[] = [];
        for (let t = 1; t < commonDates.length; t++) {
            const simple = priceMaps.reduce((s, m, k) => s + weights[k] * (m.get(commonDates[t])! / m.get(commonDates[t - 1])! - 1), 0);
            returns.push(100 * Math.log(1 + simple));
        }

        const report = buildReport(returns, commonDates.slice(1));
        if (!report) return null;

        return {
            ...report,
            value,
            var95Usd: (value * report.var95Pct) / 100,
            var99Usd: (value * report.var99Pct) / 100,
            holdings: positions.map((h, k) => ({ symbol: h.symbol, weight: weights[k] })),
        };
    } catch (err) {
        console.error('getPortfolioRisk error:', err);
        return null;
    }
}
