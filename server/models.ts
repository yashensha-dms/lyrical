import mongoose, { Schema } from 'mongoose';

export interface IDraft {
  _id: string; // Client-side generated UUID
  title: string;
  content: string;
  targetTemplate: string;
  syllableTolerance?: number;
  createdAt: Date;
  updatedAt: Date;
}

const DraftSchema = new Schema<IDraft>({
  _id: { type: String, required: true },
  title: { type: String, default: '' },
  content: { type: String, default: '' },
  targetTemplate: { type: String, default: '' },
  syllableTolerance: { type: Number, default: 1 },
}, {
  timestamps: true,
  _id: false
});

export const DraftModel = mongoose.model<IDraft>('Draft', DraftSchema);
