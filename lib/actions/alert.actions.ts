'use server';

import { revalidatePath } from 'next/cache';
import { connectToDatabase } from '@/database/mongoose';
import { Alert as AlertModel, type AlertItem } from '@/database/models/alert.model';
import { requireUser, getSessionUser } from '@/lib/session';
import { fetchQuotes } from '@/lib/market';

function validate(data: AlertData): { threshold: number } | { error: string } {
  if (!data.symbol?.trim()) return { error: 'Symbol is required' };
  if (!data.alertName?.trim()) return { error: 'Alert name is required' };
  if (data.alertType !== 'upper' && data.alertType !== 'lower') return { error: 'Choose a condition' };
  const threshold = Number(data.threshold);
  if (!Number.isFinite(threshold) || threshold <= 0) return { error: 'Enter a valid target price' };
  return { threshold };
}

function revalidateAlertPages(symbol: string) {
  revalidatePath('/watchlist');
  revalidatePath('/');
  revalidatePath(`/stocks/${symbol.toUpperCase()}`);
}

export async function createAlert(data: AlertData): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const checked = validate(data);
    if ('error' in checked) return { success: false, error: checked.error };

    await connectToDatabase();
    await AlertModel.create({
      userId: user.id,
      userEmail: user.email,
      symbol: data.symbol.trim().toUpperCase(),
      company: data.company?.trim() || data.symbol.trim().toUpperCase(),
      alertName: data.alertName.trim(),
      alertType: data.alertType,
      threshold: checked.threshold,
      active: true,
    });

    revalidateAlertPages(data.symbol);
    return { success: true, message: 'Alert created. We will email you when it triggers.' };
  } catch (err) {
    console.error('createAlert error:', err);
    return { success: false, error: 'Could not create alert' };
  }
}

export async function updateAlert(alertId: string, data: AlertData): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const checked = validate(data);
    if ('error' in checked) return { success: false, error: checked.error };

    await connectToDatabase();
    // Editing an alert re-arms it
    const result = await AlertModel.updateOne(
      { _id: alertId, userId: user.id },
      {
        $set: { alertName: data.alertName.trim(), alertType: data.alertType, threshold: checked.threshold, active: true },
        $unset: { triggeredAt: 1, triggeredPrice: 1 },
      }
    );
    if (result.matchedCount === 0) return { success: false, error: 'Alert not found' };

    revalidateAlertPages(data.symbol);
    return { success: true, message: 'Alert updated' };
  } catch (err) {
    console.error('updateAlert error:', err);
    return { success: false, error: 'Could not update alert' };
  }
}

export async function deleteAlert(alertId: string): Promise<ActionResult> {
  try {
    const user = await requireUser();
    await connectToDatabase();
    const alert = await AlertModel.findOneAndDelete({ _id: alertId, userId: user.id });
    if (!alert) return { success: false, error: 'Alert not found' };

    revalidateAlertPages(alert.symbol);
    return { success: true, message: 'Alert deleted' };
  } catch (err) {
    console.error('deleteAlert error:', err);
    return { success: false, error: 'Could not delete alert' };
  }
}

function toAlert(doc: AlertItem, price?: number, changePercent?: number): Alert {
  return {
    id: String(doc._id),
    symbol: doc.symbol,
    company: doc.company,
    alertName: doc.alertName,
    alertType: doc.alertType,
    threshold: doc.threshold,
    currentPrice: price ?? 0,
    changePercent,
    active: doc.active,
    triggeredAt: doc.triggeredAt ? new Date(doc.triggeredAt).toISOString() : undefined,
    triggeredPrice: doc.triggeredPrice,
  };
}

export async function getAlerts(symbol?: string): Promise<Alert[]> {
  const user = await getSessionUser();
  if (!user) return [];

  try {
    await connectToDatabase();
    const filter: Record<string, unknown> = { userId: user.id };
    if (symbol) filter.symbol = symbol.toUpperCase();

    const docs = await AlertModel.find(filter).sort({ active: -1, createdAt: -1 }).lean<AlertItem[]>();
    if (docs.length === 0) return [];

    const quotes = await fetchQuotes(docs.map((d) => d.symbol));
    return docs.map((d) => toAlert(d, quotes[d.symbol]?.price, quotes[d.symbol]?.changePercent));
  } catch (err) {
    console.error('getAlerts error:', err);
    return [];
  }
}
