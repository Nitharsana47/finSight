// Server-only helpers for the background price-alert checker.
// Kept out of `lib/actions` so they are not exposed as callable server actions.
import { connectToDatabase } from '@/database/mongoose';
import { Alert as AlertModel, type AlertItem } from '@/database/models/alert.model';

export type AlertToCheck = {
    id: string;
    userEmail: string;
    symbol: string;
    company: string;
    alertName: string;
    alertType: 'upper' | 'lower';
    threshold: number;
};

export async function getActiveAlertsForCheck(): Promise<AlertToCheck[]> {
    await connectToDatabase();
    const docs = await AlertModel.find({ active: true }).lean<AlertItem[]>();
    return docs.map((d) => ({
        id: String(d._id),
        userEmail: d.userEmail,
        symbol: d.symbol,
        company: d.company,
        alertName: d.alertName,
        alertType: d.alertType,
        threshold: d.threshold,
    }));
}

// Returns true only if this call flipped the alert from active to triggered,
// so a retried job never emails the same alert twice.
export async function markAlertTriggered(alertId: string, price: number): Promise<boolean> {
    await connectToDatabase();
    const result = await AlertModel.updateOne(
        { _id: alertId, active: true },
        { $set: { active: false, triggeredAt: new Date(), triggeredPrice: price } }
    );
    return result.modifiedCount > 0;
}

export const isAlertTriggered = (alert: Pick<AlertToCheck, 'alertType' | 'threshold'>, price: number) =>
    alert.alertType === 'upper' ? price >= alert.threshold : price <= alert.threshold;
