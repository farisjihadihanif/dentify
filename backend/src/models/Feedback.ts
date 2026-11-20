import mongoose, { Schema, type Document, type Model } from 'mongoose';

export const FEEDBACK_TARGET_TYPES = ['scan', 'chat_message'] as const;
export type FeedbackTargetType = (typeof FEEDBACK_TARGET_TYPES)[number];

export const FEEDBACK_RATINGS = ['helpful', 'inaccurate'] as const;
export type FeedbackRating = (typeof FEEDBACK_RATINGS)[number];

export interface IFeedback {
  user_id: mongoose.Types.ObjectId | null;
  target_type: FeedbackTargetType;
  target_id: string;
  rating: FeedbackRating;
  comment: string;
  created_at: Date;
  updated_at: Date;
}

export interface IFeedbackDocument extends IFeedback, Document {
  _id: mongoose.Types.ObjectId;
}

const feedbackSchema = new Schema<IFeedbackDocument>(
  {
    user_id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    target_type: {
      type: String,
      enum: FEEDBACK_TARGET_TYPES,
      required: true,
    },
    target_id: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    rating: {
      type: String,
      enum: FEEDBACK_RATINGS,
      required: true,
    },
    comment: {
      type: String,
      trim: true,
      maxlength: 300,
      default: '',
    },
  },
  {
    collection: 'feedback',
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

feedbackSchema.index({ target_type: 1, target_id: 1 });

export const Feedback: Model<IFeedbackDocument> =
  (mongoose.models.Feedback as Model<IFeedbackDocument>) ||
  mongoose.model<IFeedbackDocument>('Feedback', feedbackSchema);
