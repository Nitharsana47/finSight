// GARCH(1,1) volatility model, fitted by Gaussian maximum likelihood.
//
//   r_t      = mu + e_t,            e_t = sigma_t * z_t
//   sigma2_t = omega + alpha * e_{t-1}^2 + beta * sigma2_{t-1}
//
// alpha: how strongly yesterday's surprise moves today's risk
// beta:  how long elevated risk persists
// alpha + beta < 1 keeps volatility mean-reverting to omega / (1 - alpha - beta)
import { logit, mean, nelderMead, sigmoid, variance } from './math';

export type GarchParams = { mu: number; omega: number; alpha: number; beta: number };

export type GarchFit = GarchParams & {
    logLik: number;
    persistence: number;
    longRunVariance: number;
    halfLifeDays: number;
    sigma2: number[]; // in-sample conditional variances, aligned with the returns
    nextSigma2: number; // one-day-ahead forecast
};

const MAX_PERSISTENCE = 0.9995;

// Unconstrained vector -> valid parameters (omega > 0, alpha, beta >= 0, alpha + beta < 1)
function toParams(x: number[]): Omit<GarchParams, 'mu'> {
    const persistence = MAX_PERSISTENCE * sigmoid(x[1]);
    const alpha = persistence * sigmoid(x[2]);
    return { omega: Math.exp(x[0]), alpha, beta: persistence - alpha };
}

function fromParams(omega: number, alpha: number, beta: number): number[] {
    const persistence = alpha + beta;
    return [Math.log(omega), logit(persistence / MAX_PERSISTENCE), logit(alpha / persistence)];
}

// Conditional variance recursion, started at the sample variance
export function garchVariances(eps: number[], p: Omit<GarchParams, 'mu'>, init: number): number[] {
    const out = new Array<number>(eps.length);
    out[0] = init;
    for (let t = 1; t < eps.length; t++) {
        out[t] = p.omega + p.alpha * eps[t - 1] ** 2 + p.beta * out[t - 1];
    }
    return out;
}

function negLogLik(eps: number[], p: Omit<GarchParams, 'mu'>, init: number): number {
    const s2 = garchVariances(eps, p, init);
    let nll = 0;
    for (let t = 0; t < eps.length; t++) {
        nll += 0.5 * (Math.log(2 * Math.PI) + Math.log(s2[t]) + eps[t] ** 2 / s2[t]);
    }
    return Number.isFinite(nll) ? nll : 1e12;
}

export function fitGarch(returns: number[]): GarchFit {
    if (returns.length < 100) throw new Error('Need at least 100 returns to fit GARCH');

    const mu = mean(returns);
    const eps = returns.map((r) => r - mu);
    const sampleVar = variance(eps);

    // Two starting points guard against a poor local optimum
    const starts = [
        fromParams(sampleVar * 0.02, 0.08, 0.9),
        fromParams(sampleVar * 0.1, 0.15, 0.75),
    ];
    const best = starts
        .map((s) => nelderMead((x) => negLogLik(eps, toParams(x), sampleVar), s))
        .sort((a, b) => a.fx - b.fx)[0];

    const p = toParams(best.x);
    const sigma2 = garchVariances(eps, p, sampleVar);
    const last = eps.length - 1;
    const persistence = p.alpha + p.beta;

    return {
        mu,
        ...p,
        logLik: -best.fx,
        persistence,
        longRunVariance: p.omega / (1 - persistence),
        halfLifeDays: Math.log(0.5) / Math.log(persistence),
        sigma2,
        nextSigma2: p.omega + p.alpha * eps[last] ** 2 + p.beta * sigma2[last],
    };
}

// Average daily variance over the next `days`, given the one-day-ahead forecast
export function forecastVariance(fit: Pick<GarchFit, 'persistence' | 'longRunVariance' | 'nextSigma2'>, days: number): number {
    let total = 0;
    for (let h = 1; h <= days; h++) {
        total += fit.longRunVariance + fit.persistence ** (h - 1) * (fit.nextSigma2 - fit.longRunVariance);
    }
    return total / days;
}

// Draws a GARCH(1,1) path; used to check that fitGarch recovers known parameters
export function simulateGarch(p: GarchParams, n: number, rand: () => number = Math.random): number[] {
    const gauss = () => Math.sqrt(-2 * Math.log(1 - rand())) * Math.cos(2 * Math.PI * rand());
    let s2 = p.omega / (1 - p.alpha - p.beta);
    let prevEps = 0;
    const out: number[] = [];
    for (let t = 0; t < n; t++) {
        s2 = p.omega + p.alpha * prevEps ** 2 + p.beta * s2;
        prevEps = Math.sqrt(s2) * gauss();
        out.push(p.mu + prevEps);
    }
    return out;
}
