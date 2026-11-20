import mongoose, { Schema, type Document, type Model } from 'mongoose';
import { KNOWLEDGE_KEYS, type KnowledgeKey } from '../constants/domain';

export interface IDentalKnowledge {
  condition_key: KnowledgeKey;
  title: string;
  description: string;
  dos: string[];
  donts: string[];
  emergency_signs: string[];
  created_at: Date;
  updated_at: Date;
}

export interface IDentalKnowledgeDocument extends IDentalKnowledge, Document {
  _id: mongoose.Types.ObjectId;
}

const dentalKnowledgeSchema = new Schema<IDentalKnowledgeDocument>(
  {
    condition_key: {
      type: String,
      enum: KNOWLEDGE_KEYS,
      required: true,
      unique: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
    },
    dos: {
      type: [String],
      required: true,
    },
    donts: {
      type: [String],
      required: true,
    },
    emergency_signs: {
      type: [String],
      required: true,
    },
  },
  {
    collection: 'dental_knowledge',
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

export const DentalKnowledge: Model<IDentalKnowledgeDocument> =
  (mongoose.models.DentalKnowledge as Model<IDentalKnowledgeDocument>) ||
  mongoose.model<IDentalKnowledgeDocument>('DentalKnowledge', dentalKnowledgeSchema);
