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
import { ChatSession, DentalKnowledge, ScanRecord, User, type IChatSessionDocument } from '../models';
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

const TOPIC_KEYWORD_MAP: Array<{ key: string; keywords: string[] }> = [
  { key: 'periodontitis', keywords: ['periodontitis', 'gusi surut', 'gigi goyang', 'goyang', 'poket'] },
  { key: 'dental_abscess', keywords: ['abses', 'nanah', 'bisul gusi', 'bengkak pipi', 'infeksi akar'] },
  { key: 'dentin_hypersensitivity', keywords: ['sensitif', 'ngilu', 'air dingin', 'es', 'dentin'] },
  { key: 'tooth_wear', keywords: ['erosi', 'abrasi', 'bruksisme', 'gertak', 'gigi aus', 'menipis'] },
  { key: 'cracked_tooth', keywords: ['retak', 'patah', 'cuil', 'sompel', 'pecah'] },
  { key: 'wisdom_tooth_impaction', keywords: ['gigi bungsu', 'impaksi', 'geraham belakang', 'maloklusi', 'berjejal', 'behel'] },
  { key: 'edentulism_implants', keywords: ['ompong', 'gigi hilang', 'implan', 'gigi palsu', 'gigi tiruan', 'bridge'] },
  { key: 'oral_lesions_tmd', keywords: ['sariawan', 'lesi', 'luka mulut', 'rahang', 'tmd', 'tmj', 'klik rahang'] },
  { key: 'calculus', keywords: ['karang gigi', 'kalkulus', 'scaling', 'plak keras'] },
  { key: 'caries', keywords: ['karies', 'berlubang', 'lubang', 'tambal'] },
  { key: 'gingivitis', keywords: ['gingivitis', 'radang gusi', 'gusi berdarah', 'gusi merah'] },
];

async function loadKnowledgeContext(
  condition?: DentalCondition,
  message?: string,
): Promise<AiChatKnowledgeItem[]> {
  const keys: string[] = condition ? [condition, 'general'] : ['general'];
  const lowered = (message || '').toLowerCase();
  if (lowered) {
    for (const entry of TOPIC_KEYWORD_MAP) {
      if (entry.keywords.some((kw) => lowered.includes(kw))) {
        keys.push(entry.key);
      }
    }
  }
  const uniqueKeys = Array.from(new Set(keys)).slice(0, 4);
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
    const attachedImage = (input.image_data_url || input.image_base64)?.trim() || undefined;
    const effectiveMessage =
      input.message.trim() ||
      (attachedImage ? 'Tolong periksa kondisi gigi pada foto yang saya lampirkan.' : '');

    if ((input.scan_id || input.session_id) && !isAuthenticated) {
      throw new ApiError(
        401,
        'UNAUTHENTICATED',
        'Silakan masuk untuk mengakses riwayat scan atau sesi chat.',
      );
    }

    const userId = req.user ? new mongoose.Types.ObjectId(req.user.id) : null;
    let userName: string | undefined;
    if (userId) {
      const userDoc = await User.findById(userId).select('full_name').lean();
      if (userDoc?.full_name) {
        userName = userDoc.full_name;
      }
    }

    // Resolve optional scan_id gracefully (ignore stale/deleted scan IDs instead of failing with 404)
    let linkedScan = null;
    if (input.scan_id && userId && mongoose.isValidObjectId(input.scan_id)) {
      linkedScan = await ScanRecord.findOne({ _id: input.scan_id, user_id: userId });
    }

    // Resolve optional existing session_id gracefully (fall back to a new session if deleted/stale)
    let session: IChatSessionDocument | null = null;
    if (input.session_id && userId && mongoose.isValidObjectId(input.session_id)) {
      session = await ChatSession.findOne({ _id: input.session_id, user_id: userId });
      if (session && !linkedScan && session.scan_id) {
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

    // An unsure scan (below CONFIDENCE_THRESHOLD) has no trusted label, so Deni gets no condition
    // context from it (Decision #4).
    const trustedScan = linkedScan && !linkedScan.is_low_confidence ? linkedScan : null;
    const knowledgeContext = await loadKnowledgeContext(
      trustedScan?.primary_condition,
      effectiveMessage,
    );

    const scanContext = trustedScan
      ? {
          primary_condition: trustedScan.primary_condition,
          confidence_score: trustedScan.confidence_score,
          urgency_level: trustedScan.urgency_level,
          user_symptoms: trustedScan.user_symptoms ?? '',
        }
      : undefined;

    let reply: string;
    let urgencyLevel: UrgencyLevel;
    let triggerClinicFinder: boolean;
    let suggestedQuestions: string[];
    let isFallback = false;

    try {
      const aiReply = await requestAgentChat({
        message: effectiveMessage,
        user_name: userName,
        image_data_url: attachedImage,
        image_base64: attachedImage,
        image_mime_type: input.image_mime_type,
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
      // Static Indonesian fallback on AI/LLM failure
      isFallback = true;
      const severe = containsSevereSymptoms(effectiveMessage);
      reply = STATIC_FALLBACK_CHAT_REPLY;
      urgencyLevel = severe ? 'emergency' : linkedScan?.urgency_level ?? 'low';
      triggerClinicFinder = urgencyLevel === 'emergency';
      suggestedQuestions = STATIC_FALLBACK_SUGGESTIONS;
    }

    // Deterministic backstop: severe symptoms always escalate to emergency + trigger
    if (containsSevereSymptoms(effectiveMessage)) {
      urgencyLevel = 'emergency';
      triggerClinicFinder = true;
    }
    if (urgencyLevel === 'emergency') {
      triggerClinicFinder = true;
    }

    let persistedSessionId: string | null = null;
    if (userId) {
      // 50-message cap rollover
      const needsNewSession = !session || session.messages.length + 2 > MAX_CHAT_MESSAGES;
      if (needsNewSession) {
        session = new ChatSession({
          user_id: userId,
          scan_id: linkedScan ? linkedScan._id : session?.scan_id ?? null,
          title: buildTitleFromMessage(effectiveMessage),
          messages: [],
          has_triggered_clinic: false,
        });
      }

      const targetSession = session as IChatSessionDocument;
      if (targetSession.messages.length === 0) {
        targetSession.title = buildTitleFromMessage(effectiveMessage);
      }
      if (linkedScan && !targetSession.scan_id) {
        targetSession.scan_id = linkedScan._id;
      }

      const now = new Date();
      targetSession.messages.push(
        {
          role: 'user',
          content: effectiveMessage,
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
        is_fallback: isFallback,
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
