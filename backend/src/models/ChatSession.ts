import mongoose, { Schema, type Document, type Model } from 'mongoose';
import { MAX_CHAT_MESSAGES, URGENCY_LEVELS, type UrgencyLevel } from '../constants/domain';

export interface IChatMessage {
  role: 'user' | 'assistant';
  content: string;
  urgency_level?: UrgencyLevel;
  trigger_clinic_finder: boolean;
  timestamp: Date;
}

export interface IChatSession {
  user_id: mongoose.Types.ObjectId;
  scan_id: mongoose.Types.ObjectId | null;
  title: string;
  messages: IChatMessage[];
  has_triggered_clinic: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface IChatSessionDocument extends IChatSession, Document {
  _id: mongoose.Types.ObjectId;
}

const chatMessageSchema = new Schema<IChatMessage>(
  {
    role: {
      type: String,
      enum: ['user', 'assistant'],
      required: true,
    },
    content: {
      type: String,
      required: true,
      maxlength: 4000,
    },
    urgency_level: {
      type: String,
      enum: URGENCY_LEVELS,
      required: false,
    },
    trigger_clinic_finder: {
      type: Boolean,
      default: false,
    },
    timestamp: {
      type: Date,
      default: () => new Date(),
    },
  },
  { _id: false },
);

const chatSessionSchema = new Schema<IChatSessionDocument>(
  {
    user_id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    scan_id: {
      type: Schema.Types.ObjectId,
      ref: 'ScanRecord',
      default: null,
    },
    title: {
      type: String,
      required: true,
      default: 'Konsultasi Kesehatan Gigi',
      maxlength: 60,
    },
    messages: {
      type: [chatMessageSchema],
      default: [],
      validate: {
        validator: (val: IChatMessage[]) => val.length <= MAX_CHAT_MESSAGES,
        message: `Jumlah pesan dalam satu sesi maksimal ${MAX_CHAT_MESSAGES}.`,
      },
    },
    has_triggered_clinic: {
      type: Boolean,
      default: false,
    },
  },
  {
    collection: 'chat_sessions',
    strict: true,
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    toJSON: {
      transform: (_doc, ret: Record<string, unknown>) => {
        const id = ret._id ? String(ret._id) : undefined;
        delete ret._id;
        delete ret.__v;
        return { id, ...ret };
      },
    },
  },
);

chatSessionSchema.index({ user_id: 1, updated_at: -1 });
chatSessionSchema.index({ scan_id: 1 });

export const ChatSession: Model<IChatSessionDocument> =
  (mongoose.models.ChatSession as Model<IChatSessionDocument>) ||
  mongoose.model<IChatSessionDocument>('ChatSession', chatSessionSchema);
