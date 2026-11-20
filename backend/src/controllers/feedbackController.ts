import type { NextFunction, Response } from 'express';
import mongoose from 'mongoose';
import { ChatSession, Feedback, ScanRecord } from '../models';
import type { AuthenticatedRequest } from '../middlewares/rateLimiter';
import { ApiError } from '../utils/ApiError';
import type { CreateFeedbackInput } from '../validators/feedbackValidator';

export async function createFeedback(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const input = req.body as CreateFeedbackInput;
    const userId = req.user ? new mongoose.Types.ObjectId(req.user.id) : null;

    // Ownership checks when referencing persisted MongoDB resources (API_SPECS §6.2)
    if (input.target_type === 'scan' && mongoose.isValidObjectId(input.target_id)) {
      const scan = await ScanRecord.findById(input.target_id).select('user_id');
      if (scan) {
        if (!userId || scan.user_id.toString() !== userId.toString()) {
          throw new ApiError(404, 'NOT_FOUND', 'Riwayat scan tidak ditemukan.');
        }
      } else if (userId) {
        throw new ApiError(404, 'NOT_FOUND', 'Riwayat scan tidak ditemukan.');
      }
    }

    if (input.target_type === 'chat_message') {
      const sessionCandidate = input.target_id.split(':')[0];
      if (mongoose.isValidObjectId(sessionCandidate)) {
        const session = await ChatSession.findById(sessionCandidate).select('user_id');
        if (session) {
          if (!userId || session.user_id.toString() !== userId.toString()) {
            throw new ApiError(404, 'NOT_FOUND', 'Sesi chat tidak ditemukan.');
          }
        } else if (userId) {
          throw new ApiError(404, 'NOT_FOUND', 'Sesi chat tidak ditemukan.');
        }
      }
    }

    const doc = await Feedback.create({
      user_id: userId,
      target_type: input.target_type,
      target_id: input.target_id,
      rating: input.rating,
      comment: input.comment ?? '',
    });

    res.status(201).json({
      success: true,
      message: 'Terima kasih atas masukan Anda.',
      data: {
        id: doc._id.toString(),
        target_type: doc.target_type,
        target_id: doc.target_id,
        rating: doc.rating,
        comment: doc.comment,
        created_at: doc.created_at.toISOString(),
      },
    });
  } catch (err) {
    next(err);
  }
}
