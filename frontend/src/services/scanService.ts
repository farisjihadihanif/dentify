/**
 * Dental scan service (/api/v1/scans - docs/API_SPECS.md §5.1 & §5.2).
 */

import apiClient from './apiClient';
import type { UrgencyLevel } from '../components/StatusBadge';

export type DentalCondition = 'caries' | 'calculus' | 'gingivitis' | 'healthy';
export type CaptureSource = 'camera' | 'upload';

export interface ScanDetectionItem {
  label: DentalCondition;
  confidence: number;
  bbox: [number, number, number, number] | null;
}

export interface CareRecommendations {
  summary: string;
  dos: string[];
  donts: string[];
}

export interface ScanReportData {
  id: string | null;
  capture_source: CaptureSource;
  user_symptoms?: string;
  primary_condition: DentalCondition;
  condition_label: string;
  confidence_score: number;
  detections: ScanDetectionItem[];
  urgency_level: UrgencyLevel;
  trigger_clinic_finder: boolean;
  care_recommendations: CareRecommendations;
  medical_disclaimer: string;
  model_version?: string;
  saved?: boolean;
  created_at: string;
}

export interface CreateScanResponsePayload {
  success: true;
  data: ScanReportData;
}

export interface SubmitScanInput {
  image: File;
  captureSource: CaptureSource;
  userSymptoms?: string;
}

export const LAST_SCAN_STORAGE_KEY = 'denthub_last_scan_report';

export function saveLastScanToStorage(report: ScanReportData): void {
  if (typeof window === 'undefined' || !window.sessionStorage) return;
  try {
    window.sessionStorage.setItem(LAST_SCAN_STORAGE_KEY, JSON.stringify(report));
  } catch {
    // Ignore storage errors
  }
}

export function getLastScanFromStorage(): ScanReportData | null {
  if (typeof window === 'undefined' || !window.sessionStorage) return null;
  try {
    const raw = window.sessionStorage.getItem(LAST_SCAN_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ScanReportData) : null;
  } catch {
    return null;
  }
}

export async function submitDentalScan(input: SubmitScanInput): Promise<ScanReportData> {
  const formData = new FormData();
  formData.append('image', input.image);
  formData.append('capture_source', input.captureSource);
  if (input.userSymptoms && input.userSymptoms.trim()) {
    formData.append('user_symptoms', input.userSymptoms.trim());
  }

  const { data } = await apiClient.post<CreateScanResponsePayload>('/scans', formData);
  saveLastScanToStorage(data.data);
  return data.data;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
}

export interface ListScansResponsePayload {
  success: true;
  data: ScanReportData[];
  meta: PaginationMeta;
}

export interface SingleScanResponsePayload {
  success: true;
  data: ScanReportData;
}

export interface DeleteScanResponsePayload {
  success: true;
  message: string;
}

export async function fetchScanHistory(
  page: number = 1,
  limit: number = 10,
): Promise<ListScansResponsePayload> {
  const { data } = await apiClient.get<ListScansResponsePayload>('/scans', {
    params: { page, limit },
  });
  return data;
}

export async function fetchScanDetailById(scanId: string): Promise<ScanReportData> {
  const { data } = await apiClient.get<SingleScanResponsePayload>(
    `/scans/${encodeURIComponent(scanId)}`,
  );
  return data.data;
}

export async function deleteScanById(scanId: string): Promise<DeleteScanResponsePayload> {
  const { data } = await apiClient.delete<DeleteScanResponsePayload>(
    `/scans/${encodeURIComponent(scanId)}`,
  );
  return data;
}
