import {
  CONDITION_LABELS,
  type DentalCondition,
  type UrgencyLevel,
} from '../constants/domain';
import { DENTAL_KNOWLEDGE_SEED } from '../constants/knowledgeSeed';
import { DentalKnowledge, type ICareRecommendations } from '../models';

function buildUrgencySummary(
  condition: DentalCondition,
  urgency: UrgencyLevel,
  confidence: number,
): string {
  const label = CONDITION_LABELS[condition];
  let base: string;

  if (urgency === 'emergency') {
    base = `Terdeteksi ${label.toLowerCase()} dengan tingkat urgensi tinggi. Disarankan segera mengunjungi dokter gigi terdekat untuk pemeriksaan langsung.`;
  } else if (urgency === 'medium') {
    if (condition === 'healthy') {
      base =
        'Tampilan visual gigi tampak sehat, namun berdasarkan keluhan yang Anda sampaikan, disarankan memeriksakan diri ke dokter gigi dalam 1–2 minggu.';
    } else {
      base = `Terdeteksi ${label.toLowerCase()}. Disarankan menjadwalkan pemeriksaan ke dokter gigi dalam 1–2 minggu ke depan serta menjaga kebersihan mulut secara rutin.`;
    }
  } else {
    base =
      'Gigi dan gusi Anda tampak sehat pada skrining visual awal ini. Pertahankan kebiasaan perawatan mandiri harian dan pemeriksaan rutin setiap 6 bulan.';
  }

  // PRD §6.1: confidence <= 0.75 adds a helpful certainty note (never rejects valid photos)
  if (confidence <= 0.75) {
    base +=
      ' Catatan: tingkat keyakinan analisis berada pada rentang rendah hingga sedang; pertimbangkan mengambil ulang foto di tempat yang lebih terang jika diperlukan.';
  }

  return base;
}

export async function composeCareRecommendations(params: {
  condition: DentalCondition;
  urgency: UrgencyLevel;
  confidence: number;
}): Promise<ICareRecommendations> {
  const doc = await DentalKnowledge.findOne({ condition_key: params.condition }).lean();
  const fallback =
    DENTAL_KNOWLEDGE_SEED.find((item) => item.condition_key === params.condition) ??
    DENTAL_KNOWLEDGE_SEED[DENTAL_KNOWLEDGE_SEED.length - 1];

  return {
    summary: buildUrgencySummary(params.condition, params.urgency, params.confidence),
    dos: doc?.dos?.length ? doc.dos : fallback.dos,
    donts: doc?.donts?.length ? doc.donts : fallback.donts,
  };
}
