import mongoose, { Schema, type Document, type Model } from 'mongoose';
import {
  CAPTURE_SOURCES,
  CONDITIONS,
  URGENCY_LEVELS,
  type CaptureSource,
  type DentalCondition,
  type UrgencyLevel,
} from '../constants/domain';

export interface IDetection {
  label: string;
  confidence: number;
  bbox: [number, number, number, number] | null;
}

export interface ICareRecommendations {
  summary: string;
  dos: string[];
  donts: string[];
}

export interface IImageMetadata {
  width: number;
  height: number;
  mime_type: string;
}

export interface IScanRecord {
  user_id: mongoose.Types.ObjectId;
  capture_source: CaptureSource;
  user_symptoms: string;
  primary_condition: DentalCondition;
  condition_label: string;
  confidence_score: number;
  detections: IDetection[];
  urgency_level: UrgencyLevel;
  trigger_clinic_finder: boolean;
  is_low_confidence?: boolean;
  care_recommendations: ICareRecommendations;
  medical_disclaimer: string;
  image_metadata?: IImageMetadata;
  model_version: string;
  created_at: Date;
  updated_at: Date;
}

export interface IScanRecordDocument extends IScanRecord, Document {
  _id: mongoose.Types.ObjectId;
}

const detectionSchema = new Schema<IDetection>(
  {
    label: { type: String, required: true },
    confidence: { type: Number, required: true, min: 0, max: 1 },
    bbox: {
      type: [Number],
      default: null,
      validate: {
        validator: (val: number[] | null) => val === null || val.length === 4,
        message: 'bbox harus bernilai null atau array berisi 4 angka [x, y, w, h].',
      },
    },
  },
  { _id: false },
);

const careRecommendationsSchema = new Schema<ICareRecommendations>(
  {
    summary: { type: String, required: true },
    dos: { type: [String], required: true, default: [] },
    donts: { type: [String], required: true, default: [] },
  },
  { _id: false },
);

const imageMetadataSchema = new Schema<IImageMetadata>(
  {
    width: { type: Number, required: true },
    height: { type: Number, required: true },
    mime_type: { type: String, required: true },
  },
  { _id: false },
);

const scanRecordSchema = new Schema<IScanRecordDocument>(
  {
    user_id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    capture_source: {
      type: String,
      enum: CAPTURE_SOURCES,
      required: true,
    },
    user_symptoms: {
      type: String,
      maxlength: 500,
      default: '',
    },
    primary_condition: {
      type: String,
      enum: CONDITIONS,
      required: true,
    },
    condition_label: {
      type: String,
      required: true,
    },
    confidence_score: {
      type: Number,
      required: true,
      min: 0,
      max: 1,
    },
    detections: {
      type: [detectionSchema],
      default: [],
    },
    urgency_level: {
      type: String,
      enum: URGENCY_LEVELS,
      required: true,
    },
    trigger_clinic_finder: {
      type: Boolean,
      default: false,
    },
    is_low_confidence: {
      type: Boolean,
      default: false,
    },
    care_recommendations: {
      type: careRecommendationsSchema,
      required: true,
    },
    medical_disclaimer: {
      type: String,
      required: true,
    },
    image_metadata: {
      type: imageMetadataSchema,
      required: false,
    },
    model_version: {
      type: String,
      required: true,
    },
  },
  {
    collection: 'scan_records',
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

scanRecordSchema.index({ user_id: 1, created_at: -1 });

export const ScanRecord: Model<IScanRecordDocument> =
  (mongoose.models.ScanRecord as Model<IScanRecordDocument>) ||
  mongoose.model<IScanRecordDocument>('ScanRecord', scanRecordSchema);
