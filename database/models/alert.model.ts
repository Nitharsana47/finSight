import { Schema, model, models, type Document, type Model } from 'mongoose';

export interface AlertItem extends Document {
  userId: string;
  userEmail: string;
  symbol: string;
  company: string;
  alertName: string;
  alertType: 'upper' | 'lower';
  threshold: number;
  active: boolean;
  triggeredAt?: Date;
  triggeredPrice?: number;
  createdAt: Date;
}

const AlertSchema = new Schema<AlertItem>(
  {
    userId: { type: String, required: true, index: true },
    userEmail: { type: String, required: true },
    symbol: { type: String, required: true, uppercase: true, trim: true },
    company: { type: String, required: true, trim: true },
    alertName: { type: String, required: true, trim: true },
    alertType: { type: String, enum: ['upper', 'lower'], required: true },
    threshold: { type: Number, required: true, min: 0 },
    active: { type: Boolean, default: true, index: true },
    triggeredAt: { type: Date },
    triggeredPrice: { type: Number },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

export const Alert: Model<AlertItem> =
  (models?.Alert as Model<AlertItem>) || model<AlertItem>('Alert', AlertSchema);
