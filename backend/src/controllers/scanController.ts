import type { NextFunction, Response } from 'express';
import mongoose from 'mongoose';
import {
  CONDITION_LABELS,
  DISCLAIMER_SCAN,
  UNSURE_CONDITION_LABEL,
  type CaptureSource,
} from '../constants/domain';
import { ChatSession, ScanRecord, type IScanRecordDocument } from '../models';
import type { AuthenticatedRequest } from '../middlewares/rateLimiter';
import { requestDentalPrediction } from '../services/aiServiceClient';
import { composeCareRecommendations } from '../services/careRecommendationService';
import { ApiError } from '../utils/ApiError';
import { inspectImageBuffer } from '../utils/imageInspector';
import { createScanBodySchema } from '../validators/scanValidator';

function serializeScanRecord(doc: IScanRecordDocument, saved = true) {
  return {
    id: doc._id.toString(),
    capture_source: doc.capture_source,
    user_symptoms: doc.user_symptoms,
    primary_condition: doc.primary_condition,
    condition_label: doc.condition_label,
    confidence_score: doc.confidence_score,
    detections: doc.detections,
    urgency_level: doc.urgency_level,
    trigger_clinic_finder: doc.trigger_clinic_finder,
    is_low_confidence: Boolean(doc.is_low_confidence),
    care_recommendations: doc.care_recommendations,
    medical_disclaimer: doc.medical_disclaimer,
    model_version: doc.model_version,
    saved,
    created_at: doc.created_at.toISOString(),
  };
}

export async function createScan(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.file || !req.file.buffer) {
      throw new ApiError(422, 'INVALID_IMAGE', 'Foto gigi wajib diunggah.');
    }

    // 1. Validate body fields (capture_source, user_symptoms)
    const parsedBody = createScanBodySchema.safeParse(req.body);
    if (!parsedBody.success) {
      const errors: Record<string, string[]> = {};
      for (const issue of parsedBody.error.issues) {
        const key = issue.path.join('.') || '_root';
        errors[key] = [...(errors[key] ?? []), issue.message];
      }
      throw new ApiError(422, 'VALIDATION_ERROR', 'Data yang dikirim tidak valid.', errors);
    }

    const captureSource: CaptureSource = parsedBody.data.capture_source;
    const userSymptoms = parsedBody.data.user_symptoms;

    // 2. Validate magic bytes and minimum resolution (>= 224x224)
    const imageMeta = inspectImageBuffer(req.file.buffer);

    // 3. Call internal FastAPI CV prediction service
    const prediction = await requestDentalPrediction({
      buffer: req.file.buffer,
      filename: req.file.originalname || 'scan.jpg',
      mimeType: imageMeta.mime_type,
      userSymptoms,
    });

    // 4. Compose Indonesian care_recommendations from dental_knowledge + urgency.
    // Below CONFIDENCE_THRESHOLD (ai-service sets is_low_confidence) the result is "unsure, retake
    // the photo" instead of a condition (Decision #4).
    const isLowConfidence = Boolean(prediction.is_low_confidence);
    const careRecommendations = await composeCareRecommendations({
      condition: prediction.primary_condition,
      urgency: prediction.urgency_level,
      isLowConfidence,
    });

    const conditionLabel = isLowConfidence
      ? UNSURE_CONDITION_LABEL
      : CONDITION_LABELS[prediction.primary_condition];
    const triggerClinicFinder =
      prediction.urgency_level === 'emergency' || Boolean(prediction.trigger_clinic_finder);

    // 5. Save only if authenticated (quick mode returns saved: false)
    if (req.user) {
      const record = await ScanRecord.create({
        user_id: new mongoose.Types.ObjectId(req.user.id),
        capture_source: captureSource,
        user_symptoms: userSymptoms,
        primary_condition: prediction.primary_condition,
        condition_label: conditionLabel,
        confidence_score: prediction.confidence_score,
        detections: prediction.detections,
        urgency_level: prediction.urgency_level,
        trigger_clinic_finder: triggerClinicFinder,
        is_low_confidence: isLowConfidence,
        care_recommendations: careRecommendations,
        medical_disclaimer: DISCLAIMER_SCAN,
        image_metadata: {
          width: imageMeta.width,
          height: imageMeta.height,
          mime_type: imageMeta.mime_type,
        },
        model_version: prediction.model_version,
      });

      res.status(201).json({
        success: true,
        data: serializeScanRecord(record, true),
      });
      return;
    }

    res.status(201).json({
      success: true,
      data: {
        id: null,
        capture_source: captureSource,
        user_symptoms: userSymptoms,
        primary_condition: prediction.primary_condition,
        condition_label: conditionLabel,
        confidence_score: prediction.confidence_score,
        detections: prediction.detections,
        urgency_level: prediction.urgency_level,
        trigger_clinic_finder: triggerClinicFinder,
        is_low_confidence: isLowConfidence,
        care_recommendations: careRecommendations,
        medical_disclaimer: DISCLAIMER_SCAN,
        model_version: prediction.model_version,
        saved: false,
        created_at: new Date().toISOString(),
      },
    });
  } catch (err) {
    next(err);
  } finally {
    // Explicitly release in-memory image buffer
    if (req.file) {
      req.file.buffer = Buffer.alloc(0);
      req.file = undefined;
    }
  }
}

export async function listScans(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const query = (req.validatedQuery as { page: number; limit: number } | undefined) ?? {
      page: 1,
      limit: 10,
    };
    const userId = new mongoose.Types.ObjectId(req.user?.id);
    const skip = (query.page - 1) * query.limit;

    const [items, total] = await Promise.all([
      ScanRecord.find({ user_id: userId })
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(query.limit),
      ScanRecord.countDocuments({ user_id: userId }),
    ]);

    res.status(200).json({
      success: true,
      data: items.map((doc) => serializeScanRecord(doc, true)),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        total_pages: Math.max(1, Math.ceil(total / query.limit)),
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function getScanById(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      throw new ApiError(404, 'NOT_FOUND', 'Riwayat scan tidak ditemukan.');
    }

    const record = await ScanRecord.findOne({
      _id: id,
      user_id: new mongoose.Types.ObjectId(req.user?.id),
    });

    if (!record) {
      throw new ApiError(404, 'NOT_FOUND', 'Riwayat scan tidak ditemukan.');
    }

    res.status(200).json({
      success: true,
      data: serializeScanRecord(record, true),
    });
  } catch (err) {
    next(err);
  }
}

export async function deleteScanById(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      throw new ApiError(404, 'NOT_FOUND', 'Riwayat scan tidak ditemukan.');
    }

    const deleted = await ScanRecord.findOneAndDelete({
      _id: id,
      user_id: new mongoose.Types.ObjectId(req.user?.id),
    });

    if (!deleted) {
      throw new ApiError(404, 'NOT_FOUND', 'Riwayat scan tidak ditemukan.');
    }

    // Cascade rule: preserve chat sessions by clearing scan_id
    await ChatSession.updateMany({ scan_id: deleted._id }, { $set: { scan_id: null } });

    res.status(200).json({
      success: true,
      message: 'Riwayat scan dihapus.',
    });
  } catch (err) {
    next(err);
  }
}
