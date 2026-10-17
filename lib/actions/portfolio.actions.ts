'use server';

import { revalidatePath } from 'next/cache';
import { connectToDatabase } from '@/database/mongoose';
import { Holding, type HoldingItem } from '@/database/models/holding.model';
import { requireUser, getSessionUser } from '@/lib/session';
import { fetchQuote, fetchQuotes } from '@/lib/market';

const round = (n: number) => Math.round(n * 100) / 100;

export async function addHolding(data: { symbol: string; company?: string; shares: number | string; avgPrice: number | string }): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const symbol = data.symbol?.trim().toUpperCase();
    const shares = Number(data.shares);
    const avgPrice = Number(data.avgPrice);

    if (!symbol) return { success: false, error: 'Symbol is required' };
    if (!Number.isFinite(shares) || shares <= 0) return { success: false, error: 'Enter a valid number of shares' };
    if (!Number.isFinite(avgPrice) || avgPrice <= 0) return { success: false, error: 'Enter a valid buy price' };

    // Confirm the symbol exists and pick up its company name
    const quote = await fetchQuote(symbol);
    if (!quote) return { success: false, error: `Could not find a price for ${symbol}. Check the symbol.` };
    const company = data.company?.trim() && data.company.trim().toUpperCase() !== symbol ? data.company.trim() : quote.name || symbol;

    await connectToDatabase();
    const existing = await Holding.findOne({ userId: user.id, symbol });

    if (existing) {
      // Merge the new buy into the existing position with a weighted average price
      const totalShares = existing.shares + shares;
      existing.avgPrice = round((existing.shares * existing.avgPrice + shares * avgPrice) / totalShares);
      existing.shares = totalShares;
      await existing.save();
    } else {
      await Holding.create({ userId: user.id, symbol, company, shares, avgPrice });
    }

    revalidatePath('/portfolio');
    revalidatePath('/');
    return { success: true, message: `${shares} ${symbol} added to your portfolio` };
  } catch (err) {
    console.error('addHolding error:', err);
    return { success: false, error: 'Could not add holding' };
  }
}

export async function removeHolding(holdingId: string): Promise<ActionResult> {
  try {
    const user = await requireUser();
    await connectToDatabase();
    const result = await Holding.deleteOne({ _id: holdingId, userId: user.id });
    if (result.deletedCount === 0) return { success: false, error: 'Holding not found' };

    revalidatePath('/portfolio');
    revalidatePath('/');
    return { success: true, message: 'Holding removed' };
  } catch (err) {
    console.error('removeHolding error:', err);
    return { success: false, error: 'Could not remove holding' };
  }
}

export async function getPortfolio(): Promise<{ holdings: HoldingWithData[]; summary: PortfolioSummary }> {
  const empty = {
    holdings: [],
    summary: { totalValue: 0, totalCost: 0, totalProfit: 0, totalProfitPercent: 0, dayChange: 0, dayChangePercent: 0 },
  };

  const user = await getSessionUser();
  if (!user) return empty;

  try {
    await connectToDatabase();
    const docs = await Holding.find({ userId: user.id }).sort({ createdAt: -1 }).lean<HoldingItem[]>();
    if (docs.length === 0) return empty;

    const quotes = await fetchQuotes(docs.map((d) => d.symbol));

    const holdings: HoldingWithData[] = docs.map((d) => {
      const quote = quotes[d.symbol];
      // If a price is unavailable, value the position at cost so totals stay sensible
      const price = quote?.price ?? d.avgPrice;
      const value = price * d.shares;
      const cost = d.avgPrice * d.shares;
      const profit = value - cost;
      return {
        id: String(d._id),
        symbol: d.symbol,
        company: d.company,
        shares: d.shares,
        avgPrice: d.avgPrice,
        currentPrice: quote?.price,
        changePercent: quote?.changePercent,
        value: round(value),
        cost: round(cost),
        profit: round(profit),
        profitPercent: cost ? round((profit / cost) * 100) : 0,
        dayChange: round((quote?.change ?? 0) * d.shares),
      };
    });

    const totalValue = holdings.reduce((s, h) => s + h.value, 0);
    const totalCost = holdings.reduce((s, h) => s + h.cost, 0);
    const dayChange = holdings.reduce((s, h) => s + h.dayChange, 0);
    const previousValue = totalValue - dayChange;

    return {
      holdings,
      summary: {
        totalValue: round(totalValue),
        totalCost: round(totalCost),
        totalProfit: round(totalValue - totalCost),
        totalProfitPercent: totalCost ? round(((totalValue - totalCost) / totalCost) * 100) : 0,
        dayChange: round(dayChange),
        dayChangePercent: previousValue ? round((dayChange / previousValue) * 100) : 0,
      },
    };
  } catch (err) {
    console.error('getPortfolio error:', err);
    return empty;
  }
}
