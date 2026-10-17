// Small numerical helpers used by the risk models (no external stats library).

export const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;

export const variance = (xs: number[]) => {
    const m = mean(xs);
    return xs.reduce((s, x) => s + (x - m) ** 2, 0) / xs.length;
};

// Empirical quantile with linear interpolation, q in (0, 1)
export function quantile(xs: number[], q: number): number {
    const sorted = [...xs].sort((a, b) => a - b);
    const pos = (sorted.length - 1) * q;
    const lo = Math.floor(pos);
    const hi = Math.ceil(pos);
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

// Daily log returns in percent: 100 * ln(P_t / P_{t-1})
export const logReturnsPct = (prices: number[]) =>
    prices.slice(1).map((p, i) => 100 * Math.log(p / prices[i]));

export const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));
export const logit = (p: number) => Math.log(p / (1 - p));

// Standard normal quantiles used for parametric VaR
export const Z = { 0.05: -1.6448536, 0.01: -2.3263479 } as const;

// Complementary error function (Abramowitz & Stegun 7.1.26, |error| < 1.5e-7)
export function erfc(x: number): number {
    const z = Math.abs(x);
    const t = 1 / (1 + 0.3275911 * z);
    const poly = t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))));
    const r = poly * Math.exp(-z * z);
    return x >= 0 ? r : 2 - r;
}

// P(X > x) for a chi-square variable with 1 degree of freedom
export const chiSquare1PValue = (x: number) => (x <= 0 ? 1 : erfc(Math.sqrt(x / 2)));

// Nelder-Mead simplex minimiser (derivative-free), enough for 3-parameter likelihoods
export function nelderMead(
    f: (x: number[]) => number,
    start: number[],
    { step = 0.5, maxIter = 2000, tol = 1e-9 } = {}
): { x: number[]; fx: number } {
    const n = start.length;
    let simplex = [start, ...start.map((_, i) => start.map((v, j) => (j === i ? v + step : v)))].map((x) => ({ x, fx: f(x) }));

    for (let iter = 0; iter < maxIter; iter++) {
        simplex.sort((a, b) => a.fx - b.fx);
        if (Math.abs(simplex[n].fx - simplex[0].fx) < tol) break;

        const centroid = start.map((_, j) => simplex.slice(0, n).reduce((s, p) => s + p.x[j], 0) / n);
        const worst = simplex[n];
        const move = (k: number) => centroid.map((c, j) => c + k * (worst.x[j] - c));

        const reflected = { x: move(-1), fx: 0 };
        reflected.fx = f(reflected.x);

        if (reflected.fx < simplex[0].fx) {
            const expanded = { x: move(-2), fx: 0 };
            expanded.fx = f(expanded.x);
            simplex[n] = expanded.fx < reflected.fx ? expanded : reflected;
        } else if (reflected.fx < simplex[n - 1].fx) {
            simplex[n] = reflected;
        } else {
            const contracted = { x: move(reflected.fx < worst.fx ? -0.5 : 0.5), fx: 0 };
            contracted.fx = f(contracted.x);
            if (contracted.fx < Math.min(worst.fx, reflected.fx)) {
                simplex[n] = contracted;
            } else {
                // Shrink everything towards the best point
                const best = simplex[0].x;
                simplex = simplex.map((p, i) => {
                    if (i === 0) return p;
                    const x = p.x.map((v, j) => best[j] + 0.5 * (v - best[j]));
                    return { x, fx: f(x) };
                });
            }
        }
    }

    simplex.sort((a, b) => a.fx - b.fx);
    return simplex[0];
}
