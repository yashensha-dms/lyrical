import mongoose, { Schema } from 'mongoose';

export interface IDraft {
  _id: string; // Client-side generated UUID
  title: string;
  content: string;
  scrapbook: string;
  targetTemplate: string;
  syllableTolerance?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface IAudioMemo {
  draftId: string;
  audioData: string; // Base64 data URL
  mimeType: string;
  duration: number; // in seconds
  createdAt: Date;
}

const AudioMemoSchema = new Schema<IAudioMemo>({
  draftId: { type: String, required: true },
  audioData: { type: String, required: true },
  mimeType: { type: String, required: true },
  duration: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now }
});

const AudioMemoSchema = new Schema<IAudioMemo>({
  draftId: { type: String, required: true, unique: true },
  audioData: { type: String, required: true },
  mimeType: { type: String, required: true },
  duration: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now }
});

export const DraftModel = mongoose.model<IDraft>('Draft', DraftSchema);
export const AudioMemoModel = mongoose.model<IAudioMemo>('AudioMemo', AudioMemoSchema);
