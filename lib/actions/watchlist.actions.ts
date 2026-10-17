'use server';

import { revalidatePath } from 'next/cache';
import { connectToDatabase } from '@/database/mongoose';
import { Watchlist } from '@/database/models/watchlist.model';
import { requireUser, getSessionUser } from '@/lib/session';
import { fetchQuotes } from '@/lib/market';

export async function addToWatchlist(symbol: string, company: string): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const cleanSymbol = symbol.trim().toUpperCase();
    if (!cleanSymbol) return { success: false, error: 'Symbol is required' };

    await connectToDatabase();
    await Watchlist.updateOne(
      { userId: user.id, symbol: cleanSymbol },
      { $setOnInsert: { userId: user.id, symbol: cleanSymbol, company: company?.trim() || cleanSymbol, addedAt: new Date() } },
      { upsert: true }
    );

    revalidatePath('/watchlist');
    revalidatePath('/');
    return { success: true, message: `${cleanSymbol} added to your watchlist` };
  } catch (err) {
    console.error('addToWatchlist error:', err);
    return { success: false, error: 'Could not add to watchlist' };
  }
}

export async function removeFromWatchlist(symbol: string): Promise<ActionResult> {
  try {
    const user = await requireUser();
    await connectToDatabase();
    await Watchlist.deleteOne({ userId: user.id, symbol: symbol.trim().toUpperCase() });

    revalidatePath('/watchlist');
    revalidatePath('/');
    return { success: true, message: `${symbol.toUpperCase()} removed from your watchlist` };
  } catch (err) {
    console.error('removeFromWatchlist error:', err);
    return { success: false, error: 'Could not remove from watchlist' };
  }
}

export async function isInWatchlist(symbol: string): Promise<boolean> {
  const user = await getSessionUser();
  if (!user) return false;
  try {
    await connectToDatabase();
    return Boolean(await Watchlist.exists({ userId: user.id, symbol: symbol.trim().toUpperCase() }));
  } catch {
    return false;
  }
}

export async function getWatchlistWithData(): Promise<StockWithData[]> {
  const user = await getSessionUser();
  if (!user) return [];

  try {
    await connectToDatabase();
    const items = await Watchlist.find({ userId: user.id }).sort({ addedAt: -1 }).lean();
    if (items.length === 0) return [];

    const quotes = await fetchQuotes(items.map((i) => i.symbol));

    return items.map((item) => {
      const quote = quotes[item.symbol];
      return {
        userId: item.userId,
        symbol: item.symbol,
        company: item.company,
        addedAt: new Date(item.addedAt).toISOString(),
        currentPrice: quote?.price,
        changePercent: quote?.changePercent,
      };
    });
  } catch (err) {
    console.error('getWatchlistWithData error:', err);
    return [];
  }
}
