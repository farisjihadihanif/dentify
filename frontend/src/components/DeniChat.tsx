'use client';

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type ClipboardEvent,
  type FormEvent,
} from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  ChevronUp,
  ImagePlus,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  RotateCcw,
  Send,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { AiFeedbackControl } from './AiFeedbackControl';
import { AppButton } from './AppButton';
import { ClinicEscalationCard } from './ClinicEscalationCard';
import { ErrorBanner } from './ErrorBanner';
import { RichMessageContent } from './RichMessageContent';
import { StatusBadge, UnsureBadge, type UrgencyLevel } from './StatusBadge';
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
import {
  compressClientImage,
  validateClientImageFile,
} from '../utils/imageHelper';

export interface DeniChatProps {
  initialScanId?: string | null;
  initialCondition?: string | null;
  initialScanReport?: ScanReportData | null;
  initialTriggeredClinics?: ClinicItem[];
  initialSessions?: ChatSessionSummary[];
  initialMessages?: ChatMessageItem[];
  initialTemplatePopoverOpen?: boolean;
  initialSidebarCollapsed?: boolean;
}

export const FALLBACK_DENI_BANNER_TEXT = 'Deni sedang tidak tersedia. Berikut panduan umum.';

const WELCOME_DENI_MESSAGE =
  'Halo! Saya Deni, asisten AI kesehatan gigi preventif Anda di Dentify. Anda dapat memilih template pertanyaan, melampirkan foto gigi, atau menuliskan keluhan gigi dan gusi yang ingin Anda tanyakan.';

interface AttachedPhotoState {
  dataUrl: string;
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
  name: string;
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Gagal membaca file gambar.'));
      }
    };
    reader.onerror = () => reject(new Error('Gagal membaca file gambar.'));
    reader.readAsDataURL(file);
  });
}

/**
 * Full-viewport interactive consultation workspace with Deni:
 * - Collapsible left `Riwayat Konsultasi` sidebar (`PanelLeftClose` / `PanelLeftOpen`)
 * - Compact `Template Pertanyaan` upward popover in the bottom composer bar
 * - `+ Tambah Foto` tooth photo attachment with thumbnail preview & multimodal AI screening
 * - Rich-text Markdown formatter (`RichMessageContent`) with zero raw `**` asterisks
 */
export function DeniChat({
  initialScanId = null,
  initialCondition = null,
  initialScanReport = null,
  initialTriggeredClinics = [],
  initialSessions = [],
  initialMessages,
  initialTemplatePopoverOpen = false,
  initialSidebarCollapsed = false,
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
  const [inputMessage, setInputMessage] = useState('');
  const [attachedPhoto, setAttachedPhoto] = useState<AttachedPhotoState | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [cooldownLeft, setCooldownLeft] = useState(0);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(!initialSidebarCollapsed);
  const [templateMenuOpen, setTemplateMenuOpen] = useState(initialTemplatePopoverOpen);
  const [uiError, setUiError] = useState<MappedUiError | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const composerRef = useRef<HTMLDivElement | null>(null);
  const messageInputRef = useRef<HTMLInputElement | null>(null);
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const templateMenuRef = useRef<HTMLDivElement | null>(null);
  const initializedScanFromUrlRef = useRef<boolean>(false);
  const lastAttemptRef = useRef<{
    text: string;
    photo: AttachedPhotoState | null;
  } | null>(null);

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
    if (typeof window === 'undefined' || initializedScanFromUrlRef.current) return;
    initializedScanFromUrlRef.current = true;
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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView?.({ behavior: 'smooth' });
  }, [messages.length, isSending]);

  useEffect(() => {
    if (!templateMenuOpen) return undefined;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setTemplateMenuOpen(false);
    };
    const handleClickOutside = (event: MouseEvent) => {
      if (
        templateMenuRef.current &&
        !templateMenuRef.current.contains(event.target as Node)
      ) {
        setTemplateMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKey);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      window.removeEventListener('keydown', handleKey);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [templateMenuOpen]);

  const clearAttachedPhoto = () => {
    setAttachedPhoto(null);
    if (photoInputRef.current) {
      photoInputRef.current.value = '';
    }
  };

  const attachImageFile = async (file: File) => {
    setUiError(null);
    const validation = validateClientImageFile(file);
    if (!validation.valid && validation.error) {
      setUiError(validation.error);
      clearAttachedPhoto();
      return;
    }

    try {
      const optimized = await compressClientImage(file);
      const dataUrl = await fileToDataUrl(optimized);
      const normalizedMime = (
        ['image/jpeg', 'image/png', 'image/webp'].includes(optimized.type)
          ? optimized.type
          : 'image/jpeg'
      ) as 'image/jpeg' | 'image/png' | 'image/webp';
      setAttachedPhoto({
        dataUrl,
        mimeType: normalizedMime,
        name: file.name || 'foto-gigi.png',
      });
      // Auto-focus chat input and scroll composer into view so the user can type or hit Enter immediately
      window.setTimeout(() => {
        composerRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' });
        messageInputRef.current?.focus();
      }, 0);
    } catch {
      setUiError(mapApiError('INVALID_IMAGE'));
      clearAttachedPhoto();
    }
  };

  const handlePhotoSelect = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    await attachImageFile(file);
  };

  const handleComposerPaste = (event: ClipboardEvent<HTMLElement>) => {
    const items = event.clipboardData?.items;
    if (!items || items.length === 0) return;

    for (let i = 0; i < items.length; i += 1) {
      const item = items[i];
      if (item.kind === 'file' && item.type.startsWith('image/')) {
        const pastedFile = item.getAsFile();
        if (pastedFile) {
          event.preventDefault();
          void attachImageFile(pastedFile);
          return;
        }
      }
    }
  };

  const handleStartNewChat = () => {
    setSessionId(null);
    setScanId(null);
    setScanReport(null);
    setHasTriggeredClinic(false);
    setCurrentUrgency('low');
    setUiError(null);
    setInputMessage('');
    clearAttachedPhoto();
    setMobileSidebarOpen(false);
    setTemplateMenuOpen(false);
    setSuggestedQuestions([...INITIAL_SUGGESTED_QUESTIONS]);
    setMessages([
      {
        role: 'assistant',
        content: WELCOME_DENI_MESSAGE,
        trigger_clinic_finder: false,
        timestamp: new Date().toISOString(),
      },
    ]);
    if (typeof window !== 'undefined' && window.location.search) {
      try {
        window.history.replaceState({}, '', '/chat');
      } catch {
        // Ignore history API restrictions in embedded environments
      }
    }
    window.setTimeout(() => {
      messageInputRef.current?.focus();
    }, 0);
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
      setMobileSidebarOpen(false);
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

  const handleSendQuestion = async (
    textToSend: string,
    options?: { photoOverride?: AttachedPhotoState | null },
  ) => {
    const currentPhoto =
      options && 'photoOverride' in options ? options.photoOverride ?? null : attachedPhoto;
    const trimmed =
      textToSend.trim() ||
      (currentPhoto ? 'Tolong periksa kondisi gigi pada foto yang saya lampirkan.' : '');
    if (!trimmed || isSending || cooldownLeft > 0) return;
    // The API requires an account for Deni (Decision #9); guests see the login notice instead.
    if (!isAuthenticated()) {
      setLoggedIn(false);
      return;
    }

    lastAttemptRef.current = { text: trimmed, photo: currentPhoto };
    setUiError(null);
    setInputMessage('');
    setTemplateMenuOpen(false);
    if (!options || !('photoOverride' in options)) {
      clearAttachedPhoto();
    }

    const guestHistory = !isAuthenticated()
      ? messages.slice(-10).map((m) => ({ role: m.role, content: m.content }))
      : undefined;

    const userMsg: ChatMessageItem = {
      role: 'user',
      content: trimmed,
      trigger_clinic_finder: false,
      attached_image_url: currentPhoto?.dataUrl ?? null,
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
        imageBase64: currentPhoto?.dataUrl ?? null,
        imageMimeType: currentPhoto?.mimeType ?? null,
      });

      if (response.session_id) {
        setSessionId(response.session_id);
      }
      setCurrentUrgency(response.urgency_level);
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
      if (mapped.code === 'UNAUTHENTICATED') {
        setLoggedIn(false);
        return;
      }
      setUiError(mapped);

      if (mapped.action === 'cooldown_submit_10s') {
        setCooldownLeft(mapped.cooldownSeconds ?? 10);
      }
    } finally {
      setIsSending(false);
    }
  };

  const handleRetryMessage = (msg: ChatMessageItem) => {
    const photoOverride: AttachedPhotoState | null = msg.attached_image_url
      ? {
          dataUrl: msg.attached_image_url,
          mimeType: msg.attached_image_url.startsWith('data:image/png')
            ? 'image/png'
            : msg.attached_image_url.startsWith('data:image/webp')
              ? 'image/webp'
              : 'image/jpeg',
          name: 'foto-gigi.jpg',
        }
      : null;
    void handleSendQuestion(msg.content, { photoOverride });
  };

  const handleRetryPrecedingUserMessage = (assistantIdx: number) => {
    for (let i = assistantIdx - 1; i >= 0; i -= 1) {
      if (messages[i]?.role === 'user') {
        handleRetryMessage(messages[i]);
        return;
      }
    }
    if (lastAttemptRef.current) {
      void handleSendQuestion(lastAttemptRef.current.text, {
        photoOverride: lastAttemptRef.current.photo,
      });
    }
  };

  const handleFormSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void handleSendQuestion(inputMessage);
  };

  return (
    <div
      data-testid="deni-fullscreen-workspace"
      className="relative flex h-full w-full overflow-hidden bg-bg"
    >
      {/* Left Collapsible History Sidebar */}
      <aside
        aria-label="Sidebar Sesi Percakapan Deni"
        data-testid="deni-sessions-sidebar"
        data-collapsed={!desktopSidebarOpen}
        className={[
          'z-30 flex h-full w-72 shrink-0 flex-col border-r border-border bg-surface p-4 transition-all duration-200',
          mobileSidebarOpen
            ? 'fixed inset-y-0 left-0 shadow-xl lg:static lg:shadow-none'
            : desktopSidebarOpen
              ? 'hidden lg:flex'
              : 'hidden',
        ].join(' ')}
      >
        <div className="flex items-center justify-between gap-2 border-b border-border pb-3">
          <div className="flex items-center gap-2.5">
            <img
              src="/images/deni-mascot.svg"
              alt="Maskot Deni"
              className="h-10 w-10 shrink-0 object-contain"
            />
            <div>
              <h1 className="text-base font-bold leading-tight text-text">Deni</h1>
              <p className="text-xs text-text-muted">Asisten Gigi Dentify</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setMobileSidebarOpen(false);
              setDesktopSidebarOpen(false);
            }}
            aria-label="Sembunyikan sidebar riwayat"
            data-testid="deni-sidebar-collapse-btn"
            className="inline-flex h-9 w-9 min-h-touch min-w-touch items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-brand-soft hover:text-brand-dark"
          >
            <PanelLeftClose className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="mt-3">
          <AppButton
            variant="primary"
            size="md"
            fullWidth
            onClick={handleStartNewChat}
            data-testid="new-chat-btn"
          >
            <Plus className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>Chat Baru</span>
          </AppButton>
        </div>

        <div className="mt-4 flex min-h-0 flex-1 flex-col border-t border-border pt-3">
          <p className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-text-muted">
            <MessageSquare className="h-3.5 w-3.5 text-brand-dark" aria-hidden="true" />
            <span>Riwayat Konsultasi ({sessionsList.length})</span>
          </p>

          {!loggedIn && sessionsList.length === 0 ? (
            <div className="mt-3 space-y-2.5 rounded-card border border-dashed border-border bg-bg p-3 text-xs text-text-muted">
              <p>Masuk untuk menyimpan riwayat percakapan Anda bersama Deni.</p>
              <Link
                href="/login?redirect=/chat"
                className="inline-flex h-9 min-h-touch w-full items-center justify-center whitespace-nowrap rounded-lg border border-border bg-surface px-3 text-xs font-semibold text-brand-dark hover:bg-brand-soft"
              >
                Masuk untuk Menyimpan Riwayat
              </Link>
            </div>
          ) : sessionsList.length === 0 ? (
            <p className="mt-3 rounded-card border border-dashed border-border bg-bg p-3 text-xs text-text-muted">
              Belum ada sesi percakapan tersimpan. Mulai pertanyaan pertama Anda bersama Deni.
            </p>
          ) : (
            <ul className="mt-3 flex-1 space-y-1.5 overflow-y-auto pb-20 pr-1">
              {sessionsList.map((sess) => {
                const active = sessionId === sess.id;
                return (
                  <li key={sess.id} className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => void handleOpenSavedSession(sess.id)}
                      className={[
                        'min-w-0 flex-1 rounded-xl border px-3 py-2.5 text-left transition-colors',
                        active
                          ? 'border-brand bg-brand-soft'
                          : 'border-transparent bg-bg hover:border-border hover:bg-brand-soft/60',
                      ].join(' ')}
                    >
                      <p className="truncate text-xs font-bold text-text">{sess.title}</p>
                      <p className="mt-0.5 text-[11px] text-text-muted">
                        {formatJakartaDateTime(sess.updated_at)}
                      </p>
                    </button>
                    <button
                      type="button"
                      aria-label={`Hapus sesi ${sess.title}`}
                      onClick={() => void handleDeleteSession(sess.id)}
                      className="inline-flex h-9 w-9 min-h-touch min-w-touch shrink-0 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-bg hover:text-status-red"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </aside>

      {/* Main Full-Height Conversation Pane (with pr-20 clearance for vertical right dock) */}
      <div className="flex min-w-0 flex-1 flex-col bg-bg pr-20">
        {/* Compact utility top bar: icon-only PanelLeftOpen when sidebar is collapsed/mobile */}
        <div className="flex items-center justify-between gap-3 border-b border-border bg-surface px-4 py-2.5 sm:px-6">
          <div className="flex items-center gap-2.5">
            {/* Mobile icon-only sidebar toggle */}
            <button
              type="button"
              onClick={() => setMobileSidebarOpen((prev) => !prev)}
              aria-label={mobileSidebarOpen ? 'Tutup Riwayat Chat' : 'Buka Riwayat Chat'}
              className="inline-flex h-9 w-9 min-h-touch min-w-touch items-center justify-center rounded-lg border border-border bg-bg text-brand-dark transition-colors hover:bg-brand-soft lg:hidden"
            >
              {mobileSidebarOpen ? (
                <PanelLeftClose className="h-4 w-4 shrink-0" aria-hidden="true" />
              ) : (
                <PanelLeftOpen className="h-4 w-4 shrink-0" aria-hidden="true" />
              )}
            </button>

            {/* Desktop icon-only sidebar open button (shown only when sidebar is collapsed) */}
            {!desktopSidebarOpen && (
              <button
                type="button"
                onClick={() => setDesktopSidebarOpen(true)}
                aria-label="Buka Sidebar Riwayat"
                data-testid="deni-sidebar-open-btn"
                className="hidden h-9 w-9 min-h-touch min-w-touch items-center justify-center rounded-lg border border-border bg-bg text-brand-dark transition-colors hover:bg-brand-soft lg:inline-flex"
              >
                <PanelLeftOpen className="h-4 w-4 shrink-0" aria-hidden="true" />
              </button>
            )}

            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-pill bg-accent-deni-soft px-2.5 py-0.5 text-xs font-semibold text-accent-deni">
                <Sparkles className="h-3 w-3 shrink-0" aria-hidden="true" />
                <span>Deni AI</span>
              </span>
              <span className="hidden text-xs text-text-muted sm:inline">
                Konsultasi Kesehatan Gigi Preventif
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleStartNewChat}
            className="inline-flex h-9 min-h-touch items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-xs font-semibold text-brand-dark transition-colors hover:bg-brand-soft lg:hidden"
          >
            <Plus className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>Baru</span>
          </button>
        </div>

        {/* Scrollable Full-Height Message Area */}
        <section
          aria-label="Percakapan Deni"
          className="flex-1 overflow-y-auto px-4 py-5 sm:px-6"
        >
          <div className="mx-auto max-w-3xl space-y-5">
            {(scanReport || scanId) && (
              <section
                aria-label="Konteks Hasil Pemindaian Gigi"
                data-testid="chat-scan-context-card"
                className="flex flex-col justify-between gap-3 rounded-card border border-border bg-brand-soft p-3.5 sm:flex-row sm:items-center"
              >
                <div>
                  <p className="text-xs font-semibold text-brand-dark">
                    Konteks Hasil Skrining Terhubung
                  </p>
                  <h2 className="text-sm font-bold text-text">
                    {scanReport
                      ? scanReport.is_low_confidence
                        ? scanReport.condition_label
                        : `${scanReport.condition_label} (${Math.round(
                            scanReport.confidence_score * 100,
                          )}%)`
                      : `ID Pemindaian: ${scanId}${
                          initialCondition ? ` • Kondisi: ${initialCondition}` : ''
                        }`}
                  </h2>
                </div>

                {scanReport?.is_low_confidence ? (
                  <UnsureBadge size="sm" />
                ) : (
                  <StatusBadge urgency={scanReport?.urgency_level ?? currentUrgency} size="sm" />
                )}
              </section>
            )}

            {uiError && (
              <ErrorBanner
                error={uiError}
                onRetry={
                  lastAttemptRef.current
                    ? () => {
                        if (lastAttemptRef.current) {
                          void handleSendQuestion(lastAttemptRef.current.text, {
                            photoOverride: lastAttemptRef.current.photo,
                          });
                        }
                      }
                    : undefined
                }
                onDismiss={() => setUiError(null)}
              />
            )}

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
                      src="/images/deni-mascot.svg"
                      alt="Avatar Deni"
                      className="mt-1 h-9 w-9 shrink-0 rounded-pill border border-border bg-accent-deni-soft object-contain p-0.5"
                    />
                  )}
                  <div
                    className={[
                      'max-w-2xl rounded-card px-4 py-3 text-body',
                      isUser
                        ? 'bg-brand text-surface'
                        : 'border border-border bg-surface text-text shadow-sm',
                    ].join(' ')}
                  >
                    <div className="mb-1.5 flex flex-wrap items-center gap-2">
                      <p className="text-badge font-bold">{isUser ? 'Anda' : 'Deni'}</p>
                      {!isUser && (
                        <span
                          data-testid="deni-ai-label"
                          className="inline-flex items-center gap-1 rounded-pill border border-accent-deni/30 bg-accent-deni-soft px-2.5 py-0.5 text-xs font-semibold text-accent-deni"
                        >
                          <Sparkles className="h-3 w-3 shrink-0" aria-hidden="true" />
                          <span>Dibuat oleh AI</span>
                        </span>
                      )}
                    </div>

                    {isUser && msg.attached_image_url && (
                      <div className="mb-2.5 overflow-hidden rounded-xl border border-surface/30 bg-surface-navy/20">
                        <img
                          src={msg.attached_image_url}
                          alt="Foto gigi yang dilampirkan"
                          data-testid="chat-user-photo-thumbnail"
                          className="max-h-48 w-auto rounded-xl object-cover"
                        />
                      </div>
                    )}

                    {!isUser && msg.is_fallback && (
                      <p
                        role="status"
                        data-testid="deni-fallback-label"
                        className="mb-2 inline-flex items-center gap-1.5 rounded-lg border border-status-yellow/40 bg-bg px-2.5 py-1 text-xs font-semibold text-status-yellow"
                      >
                        <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        <span>{FALLBACK_DENI_BANNER_TEXT}</span>
                      </p>
                    )}

                    {isUser ? (
                      <>
                        <div className="whitespace-pre-line leading-relaxed">{msg.content}</div>
                        <div className="mt-2 flex justify-end">
                          <button
                            type="button"
                            disabled={isSending || cooldownLeft > 0}
                            onClick={() => handleRetryMessage(msg)}
                            data-testid="chat-retry-user-btn"
                            aria-label="Ulangi kirim pesan ini"
                            className="inline-flex items-center gap-1 rounded-pill border border-surface/30 bg-surface/15 px-2.5 py-0.5 text-[11px] font-semibold text-surface transition-colors hover:bg-surface/25 disabled:opacity-50"
                          >
                            <RotateCcw className="h-3 w-3 shrink-0" aria-hidden="true" />
                            <span>Ulangi</span>
                          </button>
                        </div>
                      </>
                    ) : (
                      <RichMessageContent content={msg.content} />
                    )}

                    {!isUser && (
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <AiFeedbackControl
                          targetType="chat_message"
                          targetId={targetId}
                          compact
                        />
                        {msg.is_fallback && (
                          <button
                            type="button"
                            disabled={isSending || cooldownLeft > 0}
                            onClick={() => handleRetryPrecedingUserMessage(idx)}
                            data-testid="chat-retry-fallback-btn"
                            className="inline-flex items-center gap-1 rounded-pill border border-border bg-bg px-2.5 py-1 text-xs font-semibold text-brand-dark transition-colors hover:bg-brand-soft disabled:opacity-50"
                          >
                            <RotateCcw className="h-3 w-3 shrink-0" aria-hidden="true" />
                            <span>Ulangi</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {isSending && (
              <div className="flex items-center gap-2 text-badge font-medium text-accent-deni">
                <span className="inline-block h-3.5 w-3.5 animate-spin rounded-pill border-2 border-current border-t-transparent" />
                <span>Deni sedang menganalisis dan menyusun panduan perawatan...</span>
              </div>
            )}

            {hasTriggeredClinic && (
              <ClinicEscalationCard
                initialClinics={initialTriggeredClinics}
                scanId={scanId || scanReport?.id || null}
                sourceLabel="Deni mendeteksi indikasi darurat. Segera kunjungi dokter gigi terdekat:"
                testId="deni-clinic-escalation"
              />
            )}

            <div ref={messagesEndRef} />
          </div>
        </section>

        {/* Bottom Compact Composer (Contoh Pertanyaan Upward Popover + Tambah Foto + Ctrl+V Paste + Input) */}
        <div
          ref={composerRef}
          onPaste={handleComposerPaste}
          data-testid="deni-bottom-composer"
          className="border-t border-border bg-surface px-4 pb-4 pt-3 sm:px-6 sm:pb-5"
        >
          <div className="mx-auto max-w-3xl space-y-2.5">
            {/* Attached Photo Preview Bar */}
            {attachedPhoto && (
              <div
                data-testid="chat-attached-photo-preview"
                className="inline-flex items-center gap-3 rounded-xl border border-brand/30 bg-brand-soft p-2 pr-3"
              >
                <img
                  src={attachedPhoto.dataUrl}
                  alt="Pratinjau foto gigi"
                  className="h-12 w-12 rounded-lg object-cover"
                />
                <div className="min-w-0">
                  <p className="max-w-[180px] truncate text-xs font-bold text-text">
                    {attachedPhoto.name}
                  </p>
                  <p className="text-xs text-brand-dark">Foto siap diperiksa Deni</p>
                </div>
                <button
                  type="button"
                  onClick={clearAttachedPhoto}
                  aria-label="Hapus lampiran foto"
                  className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-pill border border-border bg-surface text-text opacity-100 shadow-sm hover:bg-bg"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
            )}

            {/* Compact Toolbar: Contoh Pertanyaan Dropdown + Tambah Foto */}
            <div className="flex flex-wrap items-center gap-2">
              <div ref={templateMenuRef} className="relative">
                <button
                  type="button"
                  aria-haspopup="menu"
                  aria-expanded={templateMenuOpen}
                  data-testid="deni-template-dropdown-btn"
                  disabled={isSending || cooldownLeft > 0}
                  onClick={() => setTemplateMenuOpen((prev) => !prev)}
                  className="inline-flex h-9 min-h-touch items-center gap-1.5 rounded-pill border border-border bg-bg px-3.5 text-xs font-semibold text-brand-dark transition-colors hover:border-brand/40 hover:bg-brand-soft disabled:opacity-60"
                >
                  <Sparkles className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span>Contoh Pertanyaan</span>
                  <ChevronUp
                    className={[
                      'h-3.5 w-3.5 shrink-0 transition-transform duration-150',
                      templateMenuOpen ? 'rotate-180' : '',
                    ].join(' ')}
                    aria-hidden="true"
                  />
                </button>

                {templateMenuOpen && (
                  <div
                    role="menu"
                    aria-label="Daftar Contoh Pertanyaan Cepat"
                    data-testid="deni-template-popover"
                    className="absolute bottom-full left-0 z-30 mb-2 w-80 max-w-[calc(100vw-2rem)] rounded-2xl border border-border bg-surface p-1.5 shadow-xl"
                  >
                    <p className="px-3 py-1.5 text-xs font-bold text-text-muted">
                      Pilih Contoh Pertanyaan
                    </p>
                    <div className="space-y-1">
                      {suggestedQuestions.map((question) => (
                        <button
                          key={question}
                          type="button"
                          role="menuitem"
                          onClick={() => void handleSendQuestion(question)}
                          className="block min-h-touch w-full rounded-xl px-3 py-2 text-left text-sm font-medium text-text transition-colors hover:bg-brand-soft hover:text-brand-dark"
                        >
                          {question}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <label
                htmlFor="deni-photo-upload"
                data-testid="deni-add-photo-btn"
                className="inline-flex h-9 min-h-touch cursor-pointer items-center gap-1.5 rounded-pill border border-border bg-bg px-3.5 text-xs font-semibold text-brand-dark transition-colors hover:border-brand/40 hover:bg-brand-soft"
              >
                <ImagePlus className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>+ Tambah Foto</span>
                <input
                  ref={photoInputRef}
                  id="deni-photo-upload"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => void handlePhotoSelect(e)}
                  className="sr-only"
                />
              </label>
            </div>

            {!loggedIn && (
              <div
                role="note"
                data-testid="deni-login-required"
                className="mb-2 flex flex-col gap-2 rounded-card border border-border bg-brand-soft p-3 text-sm text-text sm:flex-row sm:items-center sm:justify-between"
              >
                <p className="leading-relaxed">
                  Masuk dulu untuk bertanya ke Deni. Percakapan bisa berisi informasi kesehatan
                  gigi Anda, jadi kami simpan hanya di akun Anda sendiri.
                </p>
                <div className="flex shrink-0 items-center gap-2">
                  <Link
                    href="/login?redirect=/chat"
                    className="inline-flex h-9 min-h-touch items-center justify-center whitespace-nowrap rounded-lg bg-brand px-3.5 text-xs font-bold text-surface hover:bg-brand-dark"
                  >
                    Masuk
                  </Link>
                  <Link
                    href="/register?redirect=/chat"
                    className="inline-flex h-9 min-h-touch items-center justify-center whitespace-nowrap rounded-lg border border-border bg-surface px-3.5 text-xs font-bold text-brand-dark hover:bg-brand-soft"
                  >
                    Daftar
                  </Link>
                </div>
              </div>
            )}

            <form onSubmit={handleFormSubmit} className="flex items-center gap-2">
              <label htmlFor="deni-message-input" className="sr-only">
                Tulis pertanyaan konsultasi gigi Anda untuk Deni
              </label>
              <input
                ref={messageInputRef}
                id="deni-message-input"
                name="message"
                type="text"
                maxLength={1000}
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder="Ketik pertanyaan atau lampirkan foto gigi untuk Deni..."
                className="h-11 min-h-touch min-w-0 flex-1 rounded-xl border border-border bg-bg px-4 text-base text-text placeholder:text-text-muted focus:border-brand focus:bg-surface focus:outline-none focus:ring-2 focus:ring-brand-ring"
              />
              <AppButton
                type="submit"
                variant="primary"
                size="md"
                loading={isSending}
                loadingText="Mengirim..."
                disabled={
                  !loggedIn || (!inputMessage.trim() && !attachedPhoto) || cooldownLeft > 0
                }
              >
                <Send className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className={cooldownLeft > 0 ? '' : 'sr-only sm:not-sr-only'}>
                  {cooldownLeft > 0 ? `Tunggu ${cooldownLeft}d` : 'Kirim'}
                </span>
              </AppButton>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DeniChat;
