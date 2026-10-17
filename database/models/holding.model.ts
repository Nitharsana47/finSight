import { Schema, model, models, type Document, type Model } from 'mongoose';

export interface HoldingItem extends Document {
  userId: string;
  symbol: string;
  company: string;
  shares: number;
  avgPrice: number;
  createdAt: Date;
}

const HoldingSchema = new Schema<HoldingItem>(
  {
    userId: { type: String, required: true, index: true },
    symbol: { type: String, required: true, uppercase: true, trim: true },
    company: { type: String, required: true, trim: true },
    shares: { type: Number, required: true, min: 0 },
    avgPrice: { type: Number, required: true, min: 0 },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

// One position per symbol per user; new buys are merged into it
HoldingSchema.index({ userId: 1, symbol: 1 }, { unique: true });

export const Holding: Model<HoldingItem> =
  (models?.Holding as Model<HoldingItem>) || model<HoldingItem>('Holding', HoldingSchema);
