import {
  CONDITION_LABELS,
  UNSURE_CARE_RECOMMENDATIONS,
  type DentalCondition,
  type UrgencyLevel,
} from '../constants/domain';
import { DENTAL_KNOWLEDGE_SEED } from '../constants/knowledgeSeed';
import { DentalKnowledge, type ICareRecommendations } from '../models';

function buildUrgencySummary(condition: DentalCondition, urgency: UrgencyLevel): string {
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

  return base;
}

export async function composeCareRecommendations(params: {
  condition: DentalCondition;
  urgency: UrgencyLevel;
  isLowConfidence?: boolean;
}): Promise<ICareRecommendations> {
  if (params.isLowConfidence) {
    const unsure = UNSURE_CARE_RECOMMENDATIONS;
    const summary =
      params.urgency === 'emergency'
        ? `${unsure.summary} Karena keluhan Anda termasuk tanda darurat, segera kunjungi dokter gigi terdekat.`
        : unsure.summary;
    return { summary, dos: [...unsure.dos], donts: [...unsure.donts] };
  }

  const doc = await DentalKnowledge.findOne({ condition_key: params.condition }).lean();
  const fallback =
    DENTAL_KNOWLEDGE_SEED.find((item) => item.condition_key === params.condition) ??
    DENTAL_KNOWLEDGE_SEED[DENTAL_KNOWLEDGE_SEED.length - 1];

  return {
    summary: buildUrgencySummary(params.condition, params.urgency),
    dos: doc?.dos?.length ? doc.dos : fallback.dos,
    donts: doc?.donts?.length ? doc.donts : fallback.donts,
  };
}
