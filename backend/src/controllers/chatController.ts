import type { NextFunction, Response } from 'express';
import mongoose from 'mongoose';
import {
  DISCLAIMER_CHAT,
  MAX_CHAT_MESSAGES,
  SEVERE_SYMPTOM_KEYWORDS,
  STATIC_FALLBACK_CHAT_REPLY,
  STATIC_FALLBACK_SUGGESTIONS,
  type DentalCondition,
  type UrgencyLevel,
} from '../constants/domain';
import { DENTAL_KNOWLEDGE_SEED } from '../constants/knowledgeSeed';
import { ChatSession, DentalKnowledge, ScanRecord, type IChatSessionDocument } from '../models';
import type { AuthenticatedRequest } from '../middlewares/rateLimiter';
import { requestAgentChat, type AiChatKnowledgeItem } from '../services/aiServiceClient';
import { ApiError } from '../utils/ApiError';
import type { ChatMessageInput } from '../validators/chatValidator';

function containsSevereSymptoms(text: string): boolean {
  const lowered = text.toLowerCase();
  return SEVERE_SYMPTOM_KEYWORDS.some((kw) => lowered.includes(kw));
}

function buildTitleFromMessage(message: string): string {
  const cleaned = message.replace(/\s+/g, ' ').trim();
  if (!cleaned) return 'Konsultasi Kesehatan Gigi';
  return cleaned.length <= 60 ? cleaned : `${cleaned.slice(0, 57)}...`;
}

async function loadKnowledgeContext(condition?: DentalCondition): Promise<AiChatKnowledgeItem[]> {
  const keys = condition ? [condition, 'general'] : ['general'];
  const uniqueKeys = Array.from(new Set(keys));
  const docs = await DentalKnowledge.find({ condition_key: { $in: uniqueKeys } }).lean();

  if (docs.length > 0) {
    return docs.map((d) => ({
      condition_key: d.condition_key,
      title: d.title,
      description: d.description,
      dos: d.dos,
      donts: d.donts,
      emergency_signs: d.emergency_signs,
    }));
  }

  return DENTAL_KNOWLEDGE_SEED.filter((item) => uniqueKeys.includes(item.condition_key));
}

export async function postChatMessage(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const input = req.body as ChatMessageInput;
    const isAuthenticated = Boolean(req.user);

    if ((input.scan_id || input.session_id) && !isAuthenticated) {
      throw new ApiError(
        401,
        'UNAUTHENTICATED',
        'Silakan masuk untuk mengakses riwayat scan atau sesi chat.',
      );
    }

    const userId = req.user ? new mongoose.Types.ObjectId(req.user.id) : null;

    // Resolve optional scan_id (owner-checked)
    let linkedScan = null;
    if (input.scan_id && userId) {
      if (!mongoose.isValidObjectId(input.scan_id)) {
        throw new ApiError(404, 'NOT_FOUND', 'Riwayat scan tidak ditemukan.');
      }
      linkedScan = await ScanRecord.findOne({ _id: input.scan_id, user_id: userId });
      if (!linkedScan) {
        throw new ApiError(404, 'NOT_FOUND', 'Riwayat scan tidak ditemukan.');
      }
    }

    // Resolve optional existing session_id (owner-checked)
    let session: IChatSessionDocument | null = null;
    if (input.session_id && userId) {
      if (!mongoose.isValidObjectId(input.session_id)) {
        throw new ApiError(404, 'NOT_FOUND', 'Sesi chat tidak ditemukan.');
      }
      session = await ChatSession.findOne({ _id: input.session_id, user_id: userId });
      if (!session) {
        throw new ApiError(404, 'NOT_FOUND', 'Sesi chat tidak ditemukan.');
      }
      // If session has a scan_id and none was supplied explicitly, load it for context
      if (!linkedScan && session.scan_id) {
        linkedScan = await ScanRecord.findOne({ _id: session.scan_id, user_id: userId });
      }
    }

    // Build chat history (last <= 10 messages)
    const chatHistory = isAuthenticated
      ? (session?.messages ?? []).slice(-10).map((m) => ({
          role: m.role,
          content: m.content,
        }))
      : input.history.slice(-10);

    const knowledgeContext = await loadKnowledgeContext(linkedScan?.primary_condition);

    const scanContext = linkedScan
      ? {
          primary_condition: linkedScan.primary_condition,
          confidence_score: linkedScan.confidence_score,
          urgency_level: linkedScan.urgency_level,
          user_symptoms: linkedScan.user_symptoms ?? '',
        }
      : undefined;

    let reply: string;
    let urgencyLevel: UrgencyLevel;
    let triggerClinicFinder: boolean;
    let suggestedQuestions: string[];

    try {
      const aiReply = await requestAgentChat({
        message: input.message,
        scan_context: scanContext,
        chat_history: chatHistory,
        knowledge_context: knowledgeContext,
      });
      reply = aiReply.reply;
      urgencyLevel = aiReply.urgency_level;
      triggerClinicFinder = Boolean(aiReply.trigger_clinic_finder);
      suggestedQuestions =
        aiReply.suggested_questions?.length > 0
          ? aiReply.suggested_questions.slice(0, 3)
          : STATIC_FALLBACK_SUGGESTIONS;
    } catch {
      // Static Indonesian fallback on AI/LLM failure (API_SPECS §6.1, ARCHITECTURE §5.4)
      const severe = containsSevereSymptoms(input.message);
      reply = STATIC_FALLBACK_CHAT_REPLY;
      urgencyLevel = severe ? 'emergency' : linkedScan?.urgency_level ?? 'low';
      triggerClinicFinder = urgencyLevel === 'emergency';
      suggestedQuestions = STATIC_FALLBACK_SUGGESTIONS;
    }

    // Deterministic backstop: severe symptoms always escalate to emergency + trigger
    if (containsSevereSymptoms(input.message)) {
      urgencyLevel = 'emergency';
      triggerClinicFinder = true;
    }
    if (urgencyLevel === 'emergency') {
      triggerClinicFinder = true;
    }

    let persistedSessionId: string | null = null;
    if (userId) {
      // 50-message cap rollover (DATABASE.md §4 rule 3)
      const needsNewSession = !session || session.messages.length + 2 > MAX_CHAT_MESSAGES;
      if (needsNewSession) {
        session = new ChatSession({
          user_id: userId,
          scan_id: linkedScan ? linkedScan._id : session?.scan_id ?? null,
          title: buildTitleFromMessage(input.message),
          messages: [],
          has_triggered_clinic: false,
        });
      }

      const targetSession = session as IChatSessionDocument;
      if (targetSession.messages.length === 0) {
        targetSession.title = buildTitleFromMessage(input.message);
      }
      if (linkedScan && !targetSession.scan_id) {
        targetSession.scan_id = linkedScan._id;
      }

      const now = new Date();
      targetSession.messages.push(
        {
          role: 'user',
          content: input.message,
          trigger_clinic_finder: false,
          timestamp: now,
        },
        {
          role: 'assistant',
          content: reply,
          urgency_level: urgencyLevel,
          trigger_clinic_finder: triggerClinicFinder,
          timestamp: new Date(now.getTime() + 1),
        },
      );

      if (triggerClinicFinder) {
        targetSession.has_triggered_clinic = true;
      }

      await targetSession.save();
      persistedSessionId = targetSession._id.toString();
    }

    res.status(200).json({
      success: true,
      data: {
        session_id: persistedSessionId,
        reply,
        urgency_level: urgencyLevel,
        trigger_clinic_finder: triggerClinicFinder,
        suggested_questions: suggestedQuestions,
        medical_disclaimer: DISCLAIMER_CHAT,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function listChatSessions(
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

    const [sessions, total] = await Promise.all([
      ChatSession.find({ user_id: userId })
        .sort({ updated_at: -1 })
        .skip(skip)
        .limit(query.limit),
      ChatSession.countDocuments({ user_id: userId }),
    ]);

    res.status(200).json({
      success: true,
      data: sessions.map((s) => ({
        id: s._id.toString(),
        title: s.title,
        scan_id: s.scan_id ? s.scan_id.toString() : null,
        has_triggered_clinic: s.has_triggered_clinic,
        updated_at: s.updated_at.toISOString(),
      })),
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

export async function getChatSessionById(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      throw new ApiError(404, 'NOT_FOUND', 'Sesi chat tidak ditemukan.');
    }

    const session = await ChatSession.findOne({
      _id: id,
      user_id: new mongoose.Types.ObjectId(req.user?.id),
    });

    if (!session) {
      throw new ApiError(404, 'NOT_FOUND', 'Sesi chat tidak ditemukan.');
    }

    res.status(200).json({
      success: true,
      data: {
        id: session._id.toString(),
        title: session.title,
        scan_id: session.scan_id ? session.scan_id.toString() : null,
        has_triggered_clinic: session.has_triggered_clinic,
        updated_at: session.updated_at.toISOString(),
        messages: session.messages.map((m) => ({
          role: m.role,
          content: m.content,
          urgency_level: m.urgency_level,
          trigger_clinic_finder: m.trigger_clinic_finder,
          timestamp: m.timestamp.toISOString(),
        })),
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function deleteChatSessionById(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      throw new ApiError(404, 'NOT_FOUND', 'Sesi chat tidak ditemukan.');
    }

    const deleted = await ChatSession.findOneAndDelete({
      _id: id,
      user_id: new mongoose.Types.ObjectId(req.user?.id),
    });

    if (!deleted) {
      throw new ApiError(404, 'NOT_FOUND', 'Sesi chat tidak ditemukan.');
    }

    res.status(200).json({
      success: true,
      message: 'Sesi chat dihapus.',
    });
  } catch (err) {
    next(err);
  }
}
