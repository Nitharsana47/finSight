// Out-of-sample Value-at-Risk backtest.
//
// Walk forward one day at a time: every forecast for day t uses only data up to day t-1.
// GARCH is re-estimated every REFIT_EVERY days on an expanding window and rolled forward
// in between. A "breach" is a day whose loss was worse than the forecast VaR.
import { fitGarch, garchVariances } from './garch';
import { chiSquare1PValue, mean, quantile, variance, Z } from './math';

export type VarModel = 'historical' | 'ewma' | 'garch' | 'garch-fhs';

export const MODEL_LABELS: Record<VarModel, string> = {
    historical: 'Historical simulation (250 days)',
    ewma: 'EWMA / RiskMetrics (λ = 0.94)',
    garch: 'GARCH(1,1), normal',
    'garch-fhs': 'GARCH(1,1), filtered historical',
};

export type KupiecResult = { level: number; expected: number; breaches: number; rate: number; lr: number; pValue: number; pass: boolean };

export type ModelBacktest = {
    model: VarModel;
    var95: KupiecResult;
    var99: KupiecResult;
    avgVar95: number; // average forecast size: smaller is better if coverage is correct
    qlike: number | null; // volatility forecast loss: lower is better
};

export type BacktestPoint = { date: string; ret: number; var95: number; breach: boolean };

export type BacktestResult = {
    days: number;
    start: string;
    end: string;
    models: ModelBacktest[];
    series: BacktestPoint[]; // GARCH-FHS 95% path, for the chart
    meanModel: { oosR2: number; directionAccuracy: number };
};

const REFIT_EVERY = 21;
const HS_WINDOW = 250;
const EWMA_LAMBDA = 0.94;

// Kupiec (1995) proportion-of-failures test: is the breach rate consistent with the VaR level?
export function kupiec(breaches: number, days: number, p: number): KupiecResult {
    const x = breaches;
    const T = days;
    const phat = x / T;
    const term = (k: number, q: number) => (k === 0 ? 0 : k * Math.log(q));
    const lr = -2 * (term(T - x, 1 - p) + term(x, p) - term(T - x, 1 - phat) - term(x, phat));
    const pValue = chiSquare1PValue(lr);
    return { level: 1 - p, expected: p * T, breaches: x, rate: phat, lr, pValue, pass: pValue > 0.05 };
}

// Ordinary least squares AR(1): r_t = a + b * r_{t-1}
function fitAr1(r: number[]): { a: number; b: number } {
    const x = r.slice(0, -1);
    const y = r.slice(1);
    const mx = mean(x);
    const my = mean(y);
    let sxy = 0;
    let sxx = 0;
    for (let i = 0; i < x.length; i++) {
        sxy += (x[i] - mx) * (y[i] - my);
        sxx += (x[i] - mx) ** 2;
    }
    const b = sxx ? sxy / sxx : 0;
    return { a: my - b * mx, b };
}

export function runBacktest(returns: number[], dates: string[], minTrain = 750): BacktestResult | null {
    const n = returns.length;
    const start = Math.min(minTrain, n - 250);
    if (start < 500) return null; // need about 2 years to train and 1 year to test

    const forecasts: Record<VarModel, { v95: number; v99: number; sigma2: number | null }[]> = {
        historical: [], ewma: [], garch: [], 'garch-fhs': [],
    };
    const meanForecasts: { ar: number; naive: number }[] = [];

    // EWMA variance, started from the first 30 days
    let ewma = variance(returns.slice(0, 30));
    for (let t = 1; t < start; t++) ewma = EWMA_LAMBDA * ewma + (1 - EWMA_LAMBDA) * returns[t - 1] ** 2;

    let fit: ReturnType<typeof fitGarch> | null = null;
    let fitEnd = 0;
    let sigma2 = 0;
    let zq05: number = Z[0.05];
    let zq01: number = Z[0.01];
    let ar = { a: 0, b: 0 };

    for (let t = start; t < n; t++) {
        const train = returns.slice(0, t);

        if (!fit || t - fitEnd >= REFIT_EVERY) {
            fit = fitGarch(train);
            fitEnd = t;
            sigma2 = fit.nextSigma2;
            // Filtered historical simulation: empirical quantiles of the standardised residuals
            const z = train.map((r, i) => (r - fit!.mu) / Math.sqrt(fit!.sigma2[i]));
            zq05 = quantile(z, 0.05);
            zq01 = quantile(z, 0.01);
            ar = fitAr1(train);
        } else {
            const prevEps = returns[t - 1] - fit.mu;
            sigma2 = garchVariances([prevEps, 0], fit, sigma2)[1];
        }

        const mu = fit.mu;
        const sd = Math.sqrt(sigma2);
        forecasts.garch.push({ v95: -(mu + Z[0.05] * sd), v99: -(mu + Z[0.01] * sd), sigma2 });
        forecasts['garch-fhs'].push({ v95: -(mu + zq05 * sd), v99: -(mu + zq01 * sd), sigma2 });

        const ewmaSd = Math.sqrt(ewma);
        forecasts.ewma.push({ v95: -(Z[0.05] * ewmaSd), v99: -(Z[0.01] * ewmaSd), sigma2: ewma });
        ewma = EWMA_LAMBDA * ewma + (1 - EWMA_LAMBDA) * returns[t] ** 2; // update after using it

        const window = returns.slice(t - HS_WINDOW, t);
        forecasts.historical.push({ v95: -quantile(window, 0.05), v99: -quantile(window, 0.01), sigma2: variance(window) });

        meanForecasts.push({ ar: ar.a + ar.b * returns[t - 1], naive: mean(train) });
    }

    const actual = returns.slice(start);
    const days = actual.length;

    const models: ModelBacktest[] = (Object.keys(forecasts) as VarModel[]).map((model) => {
        const f = forecasts[model];
        const b95 = f.filter((x, i) => actual[i] < -x.v95).length;
        const b99 = f.filter((x, i) => actual[i] < -x.v99).length;
        const qlike = mean(f.map((x, i) => Math.log(x.sigma2!) + actual[i] ** 2 / x.sigma2!));
        return {
            model,
            var95: kupiec(b95, days, 0.05),
            var99: kupiec(b99, days, 0.01),
            avgVar95: mean(f.map((x) => x.v95)),
            qlike,
        };
    });

    // Can a simple AR(1) model predict tomorrow's return? (Expect: barely, if at all)
    const sse = (key: 'ar' | 'naive') => meanForecasts.reduce((s, m, i) => s + (actual[i] - m[key]) ** 2, 0);
    const directionHits = meanForecasts.filter((m, i) => Math.sign(m.ar - m.naive) === Math.sign(actual[i] - m.naive)).length;

    return {
        days,
        start: dates[start],
        end: dates[n - 1],
        models,
        series: forecasts['garch-fhs'].map((f, i) => ({
            date: dates[start + i],
            ret: actual[i],
            var95: f.v95,
            breach: actual[i] < -f.v95,
        })),
        meanModel: { oosR2: 1 - sse('ar') / sse('naive'), directionAccuracy: directionHits / days },
    };
}
