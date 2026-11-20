'use client';

import React, { useCallback, useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { AlertCircle, MessageSquare, Plus, Sparkles, Trash2 } from 'lucide-react';
import { AiFeedbackControl } from './AiFeedbackControl';
import { AppButton } from './AppButton';
import { ClinicEscalationCard } from './ClinicEscalationCard';
import { ErrorBanner } from './ErrorBanner';
import {
  MedicalDisclaimerBanner,
  STANDARD_CHAT_DISCLAIMER,
} from './MedicalDisclaimerBanner';
import { StatusBadge, type UrgencyLevel } from './StatusBadge';
import { isAuthenticated } from '../services/authService';
import {
  INITIAL_SUGGESTED_QUESTIONS,
  deleteChatSessionById,
  fetchChatSessionDetail,
  fetchChatSessions,
  sendDeniMessage,
  type ChatMessageItem,
  type ChatSessionSummary,
} from '../services/chatService';
import type { ClinicItem } from '../services/clinicService';
import { mapApiError, type MappedUiError } from '../services/errorMapper';
import {
  fetchScanDetailById,
  getLastScanFromStorage,
  type ScanReportData,
} from '../services/scanService';
import { formatJakartaDateTime } from '../utils/dateFormat';

export interface DeniChatProps {
  initialScanId?: string | null;
  initialCondition?: string | null;
  initialScanReport?: ScanReportData | null;
  initialTriggeredClinics?: ClinicItem[];
  initialSessions?: ChatSessionSummary[];
  initialMessages?: ChatMessageItem[];
}

export const FALLBACK_DENI_BANNER_TEXT = 'Deni sedang tidak tersedia. Berikut panduan umum.';

const WELCOME_DENI_MESSAGE =
  'Halo! Saya Deni, asisten AI kesehatan gigi preventif Anda di DentHub. Silakan pilih pertanyaan cepat di bawah atau tuliskan keluhan gigi dan gusi yang ingin Anda tanyakan.';

/**
 * Main interactive consultation panel with Deni (docs/DESIGN.md §3.3 & §8.3).
 */
export function DeniChat({
  initialScanId = null,
  initialCondition = null,
  initialScanReport = null,
  initialTriggeredClinics = [],
  initialSessions = [],
  initialMessages,
}: DeniChatProps) {
  const [scanId, setScanId] = useState<string | null>(initialScanId);
  const [scanReport, setScanReport] = useState<ScanReportData | null>(initialScanReport);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionsList, setSessionsList] = useState<ChatSessionSummary[]>(initialSessions);
  const [loggedIn, setLoggedIn] = useState<boolean>(() => isAuthenticated());
  const [messages, setMessages] = useState<ChatMessageItem[]>(
    initialMessages ?? [
      {
        role: 'assistant',
        content: WELCOME_DENI_MESSAGE,
        trigger_clinic_finder: Boolean(initialScanReport?.trigger_clinic_finder),
        timestamp: new Date().toISOString(),
      },
    ],
  );
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([
    ...INITIAL_SUGGESTED_QUESTIONS,
  ]);
  const [currentUrgency, setCurrentUrgency] = useState<UrgencyLevel>(
    initialScanReport?.urgency_level ?? 'low',
  );
  const [hasTriggeredClinic, setHasTriggeredClinic] = useState<boolean>(
    Boolean(initialScanReport?.trigger_clinic_finder || initialTriggeredClinics.length > 0),
  );
  const [disclaimer, setDisclaimer] = useState<string>(STANDARD_CHAT_DISCLAIMER);
  const [inputMessage, setInputMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [cooldownLeft, setCooldownLeft] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [uiError, setUiError] = useState<MappedUiError | null>(null);

  const loadSessionsHistory = useCallback(async () => {
    const auth = isAuthenticated();
    setLoggedIn(auth);
    if (!auth) return;
    try {
      const res = await fetchChatSessions(1, 20);
      setSessionsList(res.data || []);
    } catch {
      // Guest or unreachable
    }
  }, []);

  useEffect(() => {
    if (initialSessions.length === 0) {
      void loadSessionsHistory();
    }
  }, [initialSessions.length, loadSessionsHistory]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const urlScanId = params.get('scan_id');
    if (urlScanId && !scanId) {
      setScanId(urlScanId);
    }

    if (!scanReport) {
      const cached = getLastScanFromStorage();
      if (cached && (!urlScanId || cached.id === urlScanId)) {
        setScanReport(cached);
        setCurrentUrgency(cached.urgency_level);
        if (cached.trigger_clinic_finder) {
          setHasTriggeredClinic(true);
        }
        return;
      }
      if (urlScanId && isAuthenticated()) {
        void fetchScanDetailById(urlScanId)
          .then((detail) => {
            setScanReport(detail);
            setCurrentUrgency(detail.urgency_level);
            if (detail.trigger_clinic_finder) {
              setHasTriggeredClinic(true);
            }
          })
          .catch(() => {});
      }
    }
  }, [scanId, scanReport]);

  useEffect(() => {
    if (cooldownLeft <= 0) return undefined;
    const timer = window.setInterval(() => {
      setCooldownLeft((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [cooldownLeft]);

  const handleStartNewChat = () => {
    setSessionId(null);
    setUiError(null);
    setInputMessage('');
    setMessages([
      {
        role: 'assistant',
        content: WELCOME_DENI_MESSAGE,
        trigger_clinic_finder: Boolean(scanReport?.trigger_clinic_finder),
        timestamp: new Date().toISOString(),
      },
    ]);
  };

  const handleOpenSavedSession = async (targetSessionId: string) => {
    setUiError(null);
    try {
      const detail = await fetchChatSessionDetail(targetSessionId);
      setSessionId(detail.id);
      if (detail.scan_id) setScanId(detail.scan_id);
      if (detail.has_triggered_clinic) setHasTriggeredClinic(true);
      if (detail.messages.length > 0) {
        setMessages(detail.messages);
      }
      setSidebarOpen(false);
    } catch (error) {
      setUiError(mapApiError(error));
    }
  };

  const handleDeleteSession = async (targetSessionId: string) => {
    setUiError(null);
    try {
      await deleteChatSessionById(targetSessionId);
      setSessionsList((prev) => prev.filter((item) => item.id !== targetSessionId));
      if (sessionId === targetSessionId) {
        handleStartNewChat();
      }
    } catch (error) {
      setUiError(mapApiError(error));
    }
  };

  const handleSendQuestion = async (textToSend: string) => {
    const trimmed = textToSend.trim();
    if (!trimmed || isSending || cooldownLeft > 0) return;

    setUiError(null);
    setInputMessage('');

    const guestHistory = !isAuthenticated()
      ? messages.slice(-10).map((m) => ({ role: m.role, content: m.content }))
      : undefined;

    const userMsg: ChatMessageItem = {
      role: 'user',
      content: trimmed,
      trigger_clinic_finder: false,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsSending(true);

    try {
      const response = await sendDeniMessage({
        message: trimmed,
        sessionId: isAuthenticated() ? sessionId : null,
        scanId: isAuthenticated() ? scanId || scanReport?.id || null : null,
        history: guestHistory,
      });

      if (response.session_id) {
        setSessionId(response.session_id);
      }
      setCurrentUrgency(response.urgency_level);
      if (response.medical_disclaimer) {
        setDisclaimer(response.medical_disclaimer);
      }
      if (response.suggested_questions?.length) {
        setSuggestedQuestions(response.suggested_questions);
      }
      if (response.trigger_clinic_finder) {
        setHasTriggeredClinic(true);
      }

      const deniMsg: ChatMessageItem = {
        role: 'assistant',
        content: response.reply,
        urgency_level: response.urgency_level,
        trigger_clinic_finder: response.trigger_clinic_finder,
        is_fallback: Boolean(response.is_fallback),
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, deniMsg]);
      void loadSessionsHistory();
    } catch (error) {
      const mapped =
        error && typeof error === 'object' && 'uiError' in error
          ? (error as { uiError: MappedUiError }).uiError
          : mapApiError(error);
      setUiError(mapped);

      if (mapped.action === 'cooldown_submit_10s') {
        setCooldownLeft(mapped.cooldownSeconds ?? 10);
      }
    } finally {
      setIsSending(false);
    }
  };

  const handleFormSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void handleSendQuestion(inputMessage);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-12">
      <div className="lg:hidden">
        <AppButton variant="secondary" size="sm" onClick={() => setSidebarOpen((prev) => !prev)}>
          <MessageSquare className="h-4 w-4 shrink-0" />
          <span>{sidebarOpen ? 'Tutup Riwayat Chat' : 'Buka Riwayat Chat'}</span>
        </AppButton>
      </div>

      {/* Sidebar: + Chat Baru & saved sessions */}
      <aside
        aria-label="Sidebar Sesi Percakapan Deni"
        data-testid="deni-sessions-sidebar"
        className={[
          'space-y-4 rounded-card border border-border bg-surface p-4 shadow-sm lg:col-span-4 lg:block',
          sidebarOpen ? 'block' : 'hidden',
        ].join(' ')}
      >
        <div className="flex items-center gap-3 border-b border-border pb-3">
          <img
            src="/images/deni-mascot.png"
            alt="Maskot Deni"
            className="h-12 w-12 shrink-0 object-contain"
          />
          <div>
            <p className="text-card-title font-bold text-text">Tanya Deni</p>
            <p className="text-badge text-text-muted">Asisten Kesehatan Gigi Preventif</p>
          </div>
        </div>

        <AppButton
          variant="primary"
          size="md"
          fullWidth
          onClick={handleStartNewChat}
          data-testid="new-chat-btn"
        >
          <Plus className="h-4 w-4 shrink-0" />
          <span>Chat Baru</span>
        </AppButton>

        <div className="border-t border-border pt-3">
          <p className="inline-flex items-center gap-1.5 text-badge font-bold text-text">
            <MessageSquare className="h-4 w-4 text-brand-dark" />
            <span>Riwayat Konsultasi ({sessionsList.length})</span>
          </p>

          {!loggedIn && sessionsList.length === 0 ? (
            <div className="mt-2 space-y-2 rounded-card border border-dashed border-border bg-bg p-3 text-badge text-text-muted">
              <p>Masuk untuk menyimpan riwayat percakapan Anda bersama Deni.</p>
              <Link
                href="/login?redirect=/chat"
                className="inline-flex h-9 min-h-touch items-center justify-center whitespace-nowrap rounded-lg border border-border bg-surface px-3.5 text-xs font-semibold text-brand-dark hover:bg-brand-soft"
              >
                Masuk untuk Menyimpan Riwayat
              </Link>
            </div>
          ) : sessionsList.length === 0 ? (
            <p className="mt-2 rounded-card border border-dashed border-border bg-bg p-3 text-badge text-text-muted">
              Belum ada sesi percakapan tersimpan. Mulai pertanyaan pertama Anda bersama Deni.
            </p>
          ) : (
            <ul className="mt-2 max-h-80 space-y-2 overflow-y-auto pr-1">
              {sessionsList.map((sess) => {
                const active = sessionId === sess.id;
                return (
                  <li key={sess.id} className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => void handleOpenSavedSession(sess.id)}
                      className={[
                        'min-w-0 flex-1 rounded-card border p-3 text-left transition-colors',
                        active
                          ? 'border-brand bg-brand-soft'
                          : 'border-border bg-bg hover:bg-brand-soft/60',
                      ].join(' ')}
                    >
                      <p className="truncate text-badge font-bold text-text">{sess.title}</p>
                      <p className="mt-0.5 text-xs text-text-muted">
                        {formatJakartaDateTime(sess.updated_at)}
                      </p>
                    </button>
                    <button
                      type="button"
                      aria-label={`Hapus sesi ${sess.title}`}
                      onClick={() => void handleDeleteSession(sess.id)}
                      className="inline-flex h-9 w-9 min-h-touch min-w-touch shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-text-muted transition-colors hover:border-status-red hover:text-status-red"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </aside>

      {/* Main chat area */}
      <div className="space-y-6 lg:col-span-8">
        {(scanReport || scanId) && (
          <section
            aria-label="Konteks Hasil Pemindaian Gigi"
            data-testid="chat-scan-context-card"
            className="flex flex-col justify-between gap-3 rounded-card border border-border bg-brand-soft p-4 sm:flex-row sm:items-center"
          >
            <div>
              <p className="text-badge font-semibold text-brand-dark">
                Konteks Hasil Skrining Terhubung
              </p>
              <h2 className="text-card-title text-text">
                {scanReport
                  ? `${scanReport.condition_label} (${Math.round(
                      scanReport.confidence_score * 100,
                    )}%)`
                  : `ID Pemindaian: ${scanId}${
                      initialCondition ? ` • Kondisi: ${initialCondition}` : ''
                    }`}
              </h2>
            </div>

            <StatusBadge urgency={scanReport?.urgency_level ?? currentUrgency} />
          </section>
        )}

        {uiError && <ErrorBanner error={uiError} onDismiss={() => setUiError(null)} />}

        <section aria-label="Pertanyaan Cepat yang Disarankan" className="space-y-2">
          <p className="text-badge font-semibold text-text-muted">
            Pertanyaan cepat untuk ditanyakan ke Deni:
          </p>
          <div className="flex flex-wrap gap-2">
            {suggestedQuestions.map((question) => (
              <button
                key={question}
                type="button"
                disabled={isSending || cooldownLeft > 0}
                onClick={() => void handleSendQuestion(question)}
                className="inline-flex min-h-touch items-center rounded-pill border border-border bg-surface px-3.5 py-2 text-left text-xs font-medium text-brand-dark transition-colors hover:bg-brand-soft disabled:opacity-60"
              >
                {question}
              </button>
            ))}
          </div>
        </section>

        <section
          aria-label="Percakapan Deni"
          className="space-y-4 rounded-card border border-border bg-surface p-4 shadow-sm sm:p-6"
        >
          <div className="max-h-[28rem] space-y-4 overflow-y-auto pr-1">
            {messages.map((msg, idx) => {
              const isUser = msg.role === 'user';
              const targetId = sessionId ? `${sessionId}:${idx}` : `guest-msg-${idx}`;
              return (
                <div
                  key={`msg-${idx}`}
                  className={[
                    'flex items-start gap-2.5',
                    isUser ? 'justify-end' : 'justify-start',
                  ].join(' ')}
                >
                  {!isUser && (
                    <img
                      src="/images/deni-mascot.png"
                      alt="Avatar Deni"
                      className="mt-1 h-9 w-9 shrink-0 rounded-pill border border-border bg-accent-deni-soft object-contain p-0.5"
                    />
                  )}
                  <div
                    className={[
                      'max-w-xl rounded-card px-4 py-3 text-body',
                      isUser
                        ? 'bg-brand text-surface'
                        : 'border border-border bg-accent-deni-soft/60 text-text',
                    ].join(' ')}
                  >
                    <div className="mb-1.5 flex flex-wrap items-center gap-2">
                      <p className="text-badge font-bold">{isUser ? 'Anda' : 'Deni'}</p>
                      {!isUser && (
                        <span
                          data-testid="deni-ai-label"
                          className="inline-flex items-center gap-1 rounded-pill border border-accent-deni/30 bg-surface px-2.5 py-0.5 text-xs font-semibold text-accent-deni"
                        >
                          <Sparkles className="h-3 w-3 shrink-0" aria-hidden="true" />
                          <span>Dibuat oleh AI</span>
                        </span>
                      )}
                    </div>

                    {!isUser && msg.is_fallback && (
                      <p
                        role="status"
                        data-testid="deni-fallback-label"
                        className="mb-2 inline-flex items-center gap-1.5 rounded-lg border border-status-yellow/40 bg-surface px-2.5 py-1 text-xs font-semibold text-status-yellow"
                      >
                        <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        <span>{FALLBACK_DENI_BANNER_TEXT}</span>
                      </p>
                    )}

                    <div className="whitespace-pre-line leading-relaxed">{msg.content}</div>

                    {!isUser && (
                      <AiFeedbackControl
                        targetType="chat_message"
                        targetId={targetId}
                        compact
                      />
                    )}
                  </div>
                </div>
              );
            })}

            {isSending && (
              <div className="flex items-center gap-2 text-badge font-medium text-accent-deni">
                <span className="inline-block h-3.5 w-3.5 animate-spin rounded-pill border-2 border-current border-t-transparent" />
                <span>Deni sedang menyusun panduan perawatan...</span>
              </div>
            )}
          </div>

          {hasTriggeredClinic && (
            <ClinicEscalationCard
              initialClinics={initialTriggeredClinics}
              scanId={scanId || scanReport?.id || null}
              sourceLabel="Deni mendeteksi indikasi darurat. Segera kunjungi dokter gigi terdekat:"
              testId="deni-clinic-escalation"
            />
          )}

          <form
            onSubmit={handleFormSubmit}
            className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row"
          >
            <label htmlFor="deni-message-input" className="sr-only">
              Tulis pertanyaan konsultasi gigi Anda untuk Deni
            </label>
            <input
              id="deni-message-input"
              name="message"
              type="text"
              maxLength={1000}
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder="Ketik pertanyaan atau keluhan gigi Anda kepada Deni..."
              className="h-11 min-h-touch flex-1 rounded-xl border border-border bg-surface px-4 text-base text-text placeholder:text-text-muted focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand"
            />
            <AppButton
              type="submit"
              variant="primary"
              size="md"
              loading={isSending}
              loadingText="Mengirim..."
              disabled={!inputMessage.trim() || cooldownLeft > 0}
            >
              {cooldownLeft > 0 ? `Tunggu ${cooldownLeft}d` : 'Tanya Deni'}
            </AppButton>
          </form>
        </section>

        <MedicalDisclaimerBanner message={disclaimer} />
      </div>
    </div>
  );
}

export default DeniChat;
