'use server';

import { requireUser, getUserProfile } from '@/lib/session';
import { fetchQuote } from '@/lib/market';
import { generateJSON } from '@/lib/gemini';
import { getNews } from '@/lib/actions/finnhub.actions';
import { getPortfolio } from '@/lib/actions/portfolio.actions';
import { STOCK_INSIGHT_PROMPT, PORTFOLIO_INSIGHT_PROMPT } from '@/lib/inngest/prompts';

const formatProfile = (p: UserProfile) =>
  `- Investment goal: ${p.investmentGoals}\n- Risk tolerance: ${p.riskTolerance}\n- Preferred industry: ${p.preferredIndustry}${p.country ? `\n- Country: ${p.country}` : ''}`;

export async function explainStock(rawSymbol: string): Promise<ActionResult<StockInsight>> {
  try {
    const user = await requireUser();
    const symbol = rawSymbol.trim().toUpperCase();

    const [profile, quote, news] = await Promise.all([
      getUserProfile(user.email),
      fetchQuote(symbol),
      getNews([symbol]).catch(() => [] as MarketNewsArticle[]),
    ]);

    const marketData = quote
      ? `Price: $${quote.price.toFixed(2)}, today's change: ${quote.changePercent.toFixed(2)}%` +
        (quote.high && quote.low ? `, day range: $${quote.low.toFixed(2)} - $${quote.high.toFixed(2)}` : '')
      : 'Live price unavailable';
    const headlines = news.slice(0, 5).map((n) => `- ${n.headline} (${n.source})`).join('\n') || '- No recent headlines';

    const prompt = STOCK_INSIGHT_PROMPT
      .replace('{{symbol}}', () => symbol)
      .replace('{{companyName}}', () => quote?.name || symbol)
      .replace('{{marketData}}', () => marketData)
      .replace('{{headlines}}', () => headlines)
      .replace('{{userProfile}}', () => formatProfile(profile));

    const insight = await generateJSON<StockInsight>(prompt);
    if (!insight?.summary) return { success: false, error: 'Could not prepare the summary. Please try again.' };

    return {
      success: true,
      data: {
        summary: insight.summary,
        keyPoints: Array.isArray(insight.keyPoints) ? insight.keyPoints.slice(0, 4) : [],
        risks: Array.isArray(insight.risks) ? insight.risks.slice(0, 3) : [],
        fitForYou: insight.fitForYou || '',
        sentiment: ['bullish', 'neutral', 'bearish'].includes(insight.sentiment) ? insight.sentiment : 'neutral',
      },
    };
  } catch (err) {
    console.error('explainStock error:', err);
    return { success: false, error: 'Could not generate explanation' };
  }
}

export async function analyzePortfolio(): Promise<ActionResult<PortfolioInsight>> {
  try {
    const user = await requireUser();
    const [profile, { holdings, summary }] = await Promise.all([getUserProfile(user.email), getPortfolio()]);

    if (holdings.length === 0) return { success: false, error: 'Add some holdings first' };

    const positions = holdings
      .map((h) => {
        const weight = summary.totalValue ? ((h.value / summary.totalValue) * 100).toFixed(1) : '0';
        return `- ${h.symbol} (${h.company}): ${h.shares} shares, ${weight}% of portfolio, P/L ${h.profitPercent.toFixed(2)}%`;
      })
      .join('\n');

    const prompt = PORTFOLIO_INSIGHT_PROMPT
      .replace('{{positions}}', () => positions)
      .replace('{{totals}}', () => `Total value: $${summary.totalValue.toFixed(2)}, total P/L: ${summary.totalProfitPercent.toFixed(2)}%`)
      .replace('{{userProfile}}', () => formatProfile(profile));

    const insight = await generateJSON<PortfolioInsight>(prompt);
    if (!insight?.overview) return { success: false, error: 'Could not prepare the review. Please try again.' };

    const score = Number(insight.diversificationScore);
    return {
      success: true,
      data: {
        overview: insight.overview,
        strengths: Array.isArray(insight.strengths) ? insight.strengths.slice(0, 3) : [],
        concerns: Array.isArray(insight.concerns) ? insight.concerns.slice(0, 3) : [],
        suggestions: Array.isArray(insight.suggestions) ? insight.suggestions.slice(0, 3) : [],
        diversificationScore: Number.isFinite(score) ? Math.min(10, Math.max(1, Math.round(score))) : 5,
      },
    };
  } catch (err) {
    console.error('analyzePortfolio error:', err);
    return { success: false, error: 'Could not analyze portfolio' };
  }
}
