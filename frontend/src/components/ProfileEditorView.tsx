"use client";

import React, {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Camera,
  CheckCircle2,
  KeyRound,
  LogOut,
  Mail,
  Move,
  RotateCcw,
  Save,
  Shield,
  ShieldCheck,
  SlidersHorizontal,
  User,
  UserCircle2,
  ZoomIn,
} from "lucide-react";
import { AppButton } from "./AppButton";
import { ErrorBanner } from "./ErrorBanner";
import {
  clearStoredSession,
  fetchCurrentUser,
  getStoredUser,
  isAuthenticated,
  notifyUserUpdated,
  updateCurrentUserProfile,
  type AuthUser,
} from "../services/authService";
import { mapApiError, type MappedUiError } from "../services/errorMapper";
import {
  compressImageFileToDataUrl,
  computeAvatarFrameLayout,
  renderFramedAvatarDataUrl,
} from "../utils/imageHelper";

const AVATAR_PREVIEW_SIZE = 144;

export type ProfileSectionTab = "general" | "security" | "session";

export interface ProfileEditorViewProps {
  initialUser?: AuthUser | null;
  initialSection?: ProfileSectionTab;
}

const SETTINGS_TABS = [
  { key: "general" as const, label: "Profil Umum", icon: User },
  { key: "security" as const, label: "Keamanan & Kata Sandi", icon: KeyRound },
  { key: "session" as const, label: "Sesi & Akun", icon: Shield },
] as const;

/**
 * Two-Column Account Settings Workspace:
 * - Left sticky column: Profile summary card + per-section tabs + Admin Panel shortcut for admins.
 * - Right column: Active section panel with auto-compressed avatar upload & interactive circular crop/frame adjuster.
 */
export function ProfileEditorView({
  initialUser = null,
  initialSection = "general",
}: ProfileEditorViewProps) {
  const router = useRouter();
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const dragOriginRef = useRef<{
    x: number;
    y: number;
    startOffsetX: number;
    startOffsetY: number;
  } | null>(null);

  const stored = initialUser ?? getStoredUser();

  const [activeSection, setActiveSection] =
    useState<ProfileSectionTab>(initialSection);
  const [role, setRole] = useState<"user" | "admin">(stored?.role ?? "user");
  const [fullName, setFullName] = useState<string>(stored?.full_name || "");
  const [username, setUsername] = useState<string>(stored?.username || "");
  const [email, setEmail] = useState<string>(stored?.email || "");
  const [avatar, setAvatar] = useState<string>(stored?.avatar || "");

  // Interactive avatar frame adjuster state
  const [pendingAvatarSrc, setPendingAvatarSrc] = useState<string | null>(null);
  const [pendingNaturalSize, setPendingNaturalSize] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [avatarZoom, setAvatarZoom] = useState<number>(1.15);
  const [avatarOffsetX, setAvatarOffsetX] = useState<number>(0);
  const [avatarOffsetY, setAvatarOffsetY] = useState<number>(0);
  const [isDraggingFrame, setIsDraggingFrame] = useState<boolean>(false);
  const [isProcessingAvatar, setIsProcessingAvatar] = useState<boolean>(false);

  const previewFrameLayout = computeAvatarFrameLayout(
    AVATAR_PREVIEW_SIZE,
    pendingNaturalSize?.width ?? AVATAR_PREVIEW_SIZE,
    pendingNaturalSize?.height ?? AVATAR_PREVIEW_SIZE,
    avatarZoom,
    avatarOffsetX,
    avatarOffsetY,
  );

  const [currentPassword, setCurrentPassword] = useState<string>("");
  const [newPassword, setNewPassword] = useState<string>("");
  const [isLoadingProfile, setIsLoadingProfile] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [uiError, setUiError] = useState<MappedUiError | null>(null);

  useEffect(() => {
    if (initialUser || !isAuthenticated()) return;
    let cancelled = false;
    setIsLoadingProfile(true);
    void fetchCurrentUser()
      .then((fresh) => {
        if (cancelled) return;
        setRole(fresh.role || "user");
        setFullName(fresh.full_name || "");
        setUsername(fresh.username || "");
        setEmail(fresh.email || "");
        setAvatar(fresh.avatar || "");
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setIsLoadingProfile(false);
      });

    return () => {
      cancelled = true;
    };
  }, [initialUser]);

  const handleAvatarFileChange = async (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setUiError(null);
    setSuccessMessage(null);

    const mime = (file.type || "").toLowerCase();
    const validType =
      ["image/jpeg", "image/png", "image/webp"].includes(mime) ||
      /\.(jpe?g|png|webp)$/i.test(file.name || "");

    if (!validType) {
      setUiError(mapApiError("INVALID_IMAGE"));
      return;
    }

    setIsProcessingAvatar(true);
    try {
      // Automatically resize & compress photos > 500 KB to <= 450 KB via HTML5 Canvas
      const compressedDataUrl = await compressImageFileToDataUrl(
        file,
        450 * 1024,
        960,
      );
      setPendingNaturalSize(null);
      setPendingAvatarSrc(compressedDataUrl);
      setAvatarZoom(1.1);
      setAvatarOffsetX(0);
      setAvatarOffsetY(0);
    } catch {
      setUiError(mapApiError("INVALID_IMAGE"));
    } finally {
      setIsProcessingAvatar(false);
    }
  };

  const handleFramePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setIsDraggingFrame(true);
    dragOriginRef.current = {
      x: event.clientX,
      y: event.clientY,
      startOffsetX: avatarOffsetX,
      startOffsetY: avatarOffsetY,
    };
  };

  const handleFramePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!isDraggingFrame || !dragOriginRef.current) return;
    const dx = event.clientX - dragOriginRef.current.x;
    const dy = event.clientY - dragOriginRef.current.y;
    const deltaX =
      previewFrameLayout.maxShiftX > 0
        ? (dx / previewFrameLayout.maxShiftX) * 50
        : 0;
    const deltaY =
      previewFrameLayout.maxShiftY > 0
        ? (dy / previewFrameLayout.maxShiftY) * 50
        : 0;
    const nextX = Math.max(
      -50,
      Math.min(50, Math.round(dragOriginRef.current.startOffsetX + deltaX)),
    );
    const nextY = Math.max(
      -50,
      Math.min(50, Math.round(dragOriginRef.current.startOffsetY + deltaY)),
    );
    setAvatarOffsetX(nextX);
    setAvatarOffsetY(nextY);
  };

  const handleFramePointerUp = () => {
    setIsDraggingFrame(false);
    dragOriginRef.current = null;
  };

  const handleApplyAvatarFrame = async () => {
    if (!pendingAvatarSrc) return;
    setIsProcessingAvatar(true);
    try {
      const cropped = await renderFramedAvatarDataUrl(
        pendingAvatarSrc,
        avatarZoom,
        avatarOffsetX,
        avatarOffsetY,
        320,
      );
      setAvatar(cropped);
      setPendingAvatarSrc(null);
    } finally {
      setIsProcessingAvatar(false);
    }
  };

  const handleSaveGeneral = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSaving) return;

    setUiError(null);
    setSuccessMessage(null);
    setIsSaving(true);

    try {
      let avatarToSave = avatar;
      if (pendingAvatarSrc) {
        avatarToSave = await renderFramedAvatarDataUrl(
          pendingAvatarSrc,
          avatarZoom,
          avatarOffsetX,
          avatarOffsetY,
          320,
        );
        setAvatar(avatarToSave);
        setPendingAvatarSrc(null);
      }

      const updated = await updateCurrentUserProfile({
        full_name: fullName.trim(),
        username: username.trim() ? username.trim().toLowerCase() : undefined,
        avatar: avatarToSave,
      });

      setFullName(updated.full_name || fullName);
      setUsername(updated.username || "");
      setAvatar(updated.avatar || avatarToSave || "");
      notifyUserUpdated();
      setSuccessMessage("Profil umum Anda berhasil diperbarui.");
    } catch (error) {
      const mapped =
        error && typeof error === "object" && "uiError" in error
          ? (error as { uiError: MappedUiError }).uiError
          : mapApiError(error);
      setUiError(mapped);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSavePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSaving) return;

    setUiError(null);
    setSuccessMessage(null);
    setIsSaving(true);

    try {
      await updateCurrentUserProfile({
        full_name: fullName.trim() || undefined,
        current_password: currentPassword || undefined,
        new_password: newPassword || undefined,
      });

      setCurrentPassword("");
      setNewPassword("");
      setSuccessMessage("Kata sandi akun Anda berhasil diperbarui.");
    } catch (error) {
      const mapped =
        error && typeof error === "object" && "uiError" in error
          ? (error as { uiError: MappedUiError }).uiError
          : mapApiError(error);
      setUiError(mapped);
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = () => {
    clearStoredSession();
    notifyUserUpdated();
    router.push("/login");
  };

  return (
    <div
      data-testid="profile-settings-workspace"
      className="mx-auto max-w-6xl space-y-6 px-4 pb-24 pt-10 sm:px-6 sm:pt-12 lg:px-8"
    >
      {/* Clean Page Header */}
      <div className="border-b border-border pb-5">
        <h1 className="text-2xl font-bold text-text sm:text-3xl">
          Edit Profil Pengguna
        </h1>
        <p className="mt-1 text-sm text-text-muted sm:text-base">
          Kelola identitas akun, keamanan kata sandi, dan sesi aktif Dentify
          Anda dalam satu tempat.
        </p>
      </div>

      {uiError && (
        <ErrorBanner error={uiError} onDismiss={() => setUiError(null)} />
      )}

      {successMessage && (
        <div
          role="status"
          data-testid="profile-success-banner"
          className="flex items-center gap-2 rounded-card border border-status-green bg-brand-soft p-4 text-badge font-semibold text-status-green"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{successMessage}</span>
        </div>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-12">
        {/* Left Sticky Profile Summary & Per-Section Tab Navigation */}
        <aside
          aria-label="Ringkasan Profil dan Navigasi Pengaturan"
          data-testid="profile-settings-sidebar"
          className="space-y-4 lg:sticky lg:top-8 lg:col-span-4"
        >
          <div className="rounded-card border border-border bg-surface p-6 shadow-sm">
            <div className="flex flex-col items-center text-center">
              <div className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-pill border-2 border-brand bg-brand-soft text-brand-dark shadow-sm">
                {avatar ? (
                  <img
                    src={avatar}
                    alt="Foto Profil Pengguna"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <UserCircle2 className="h-12 w-12" aria-hidden="true" />
                )}
              </div>

              <h2 className="mt-3.5 text-lg font-bold text-text">
                {fullName || "Pengguna Dentify"}
              </h2>
              {username && (
                <p className="text-xs font-semibold text-brand-dark">
                  @{username}
                </p>
              )}
              <p className="mt-1.5 inline-flex items-center gap-1.5 text-xs text-text-muted">
                <Mail className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span className="truncate">{email || "username@mail.com"}</span>
              </p>
            </div>
          </div>

          <nav
            aria-label="Navigasi Bagian Pengaturan"
            className="rounded-card border border-border bg-surface p-2 shadow-sm"
          >
            <ul role="tablist" className="space-y-1">
              {SETTINGS_TABS.map((item) => {
                const Icon = item.icon;
                const isActive = activeSection === item.key;
                return (
                  <li key={item.key} role="presentation">
                    <button
                      type="button"
                      role="tab"
                      aria-selected={isActive}
                      data-testid={`profile-tab-${item.key}`}
                      onClick={() => {
                        setActiveSection(item.key);
                        setUiError(null);
                        setSuccessMessage(null);
                      }}
                      className={[
                        "flex min-h-touch w-full items-center gap-2.5 rounded-xl px-3.5 py-2 text-left text-sm font-semibold transition-colors",
                        isActive
                          ? "bg-brand text-surface shadow-sm"
                          : "text-text-muted hover:bg-brand-soft hover:text-brand-dark",
                      ].join(" ")}
                    >
                      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <span>{item.label}</span>
                    </button>
                  </li>
                );
              })}
            </ul>

            {role === "admin" && (
              <div className="mt-2 border-t border-border pt-2">
                <Link
                  href="/admin"
                  data-testid="profile-admin-panel-link"
                  className="flex min-h-touch w-full items-center gap-2.5 rounded-xl bg-brand-soft px-3.5 py-2 text-sm font-bold text-brand-dark transition-colors hover:bg-brand hover:text-surface"
                >
                  <ShieldCheck
                    className="h-4 w-4 shrink-0"
                    aria-hidden="true"
                  />
                  <span>Admin Panel</span>
                </Link>
              </div>
            )}
          </nav>
        </aside>

        {/* Right Column: Single Active Section Card */}
        <div className="lg:col-span-8">
          {activeSection === "general" && (
            <form onSubmit={(e) => void handleSaveGeneral(e)} noValidate>
              <section
                id="profil-umum"
                role="tabpanel"
                aria-labelledby="heading-profil-umum"
                data-testid="profile-panel-general"
                className="rounded-card border border-border bg-surface p-6 shadow-sm sm:p-7"
              >
                <div className="border-b border-border pb-4">
                  <h2
                    id="heading-profil-umum"
                    className="text-lg font-bold text-text"
                  >
                    Profil Umum
                  </h2>
                  <p className="mt-0.5 text-xs text-text-muted sm:text-sm">
                    Informasi ini ditampilkan pada akun dan riwayat pemindaian
                    Dentify Anda.
                  </p>
                </div>

                <div className="mt-5 space-y-4 border-b border-border pb-6">
                  <div className="flex flex-col items-center gap-4 sm:flex-row">
                    <div className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-pill border border-border bg-brand-soft text-brand-dark">
                      {avatar ? (
                        <img
                          src={avatar}
                          alt="Pratinjau Foto Profil"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <UserCircle2 className="h-11 w-11" aria-hidden="true" />
                      )}
                    </div>

                    <div className="space-y-2 text-center sm:text-left">
                      <p className="text-sm font-semibold text-text">
                        Foto Profil
                      </p>
                      <p className="text-xs text-text-muted">
                        Unggah foto JPG, PNG, atau WEBP (foto &gt; 500 KB akan
                        dikompres otomatis).
                      </p>
                      <div className="flex flex-wrap justify-center gap-2 sm:justify-start">
                        <label
                          htmlFor="profile-avatar-upload"
                          className="inline-flex h-9 min-h-touch cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg border border-border bg-bg px-3.5 text-xs font-semibold text-brand-dark btn-motion hover:bg-brand-soft"
                        >
                          <Camera
                            className="h-4 w-4 shrink-0"
                            aria-hidden="true"
                          />
                          <span>
                            {isProcessingAvatar
                              ? "Memproses Foto..."
                              : "Ganti Foto Profil"}
                          </span>
                          <input
                            ref={avatarInputRef}
                            id="profile-avatar-upload"
                            name="avatar"
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            onChange={(e) => void handleAvatarFileChange(e)}
                            className="sr-only"
                          />
                        </label>

                        {avatar && !pendingAvatarSrc && (
                          <button
                            type="button"
                            data-testid="avatar-open-frame-editor"
                            onClick={() => {
                              setPendingNaturalSize(null);
                              setPendingAvatarSrc(avatar);
                              setAvatarZoom(1);
                              setAvatarOffsetX(0);
                              setAvatarOffsetY(0);
                            }}
                            className="inline-flex h-9 min-h-touch items-center gap-1.5 whitespace-nowrap rounded-lg border border-border bg-surface px-3 text-xs font-semibold text-text btn-motion hover:bg-brand-soft"
                          >
                            <SlidersHorizontal
                              className="h-3.5 w-3.5 shrink-0"
                              aria-hidden="true"
                            />
                            <span>Atur Bingkai</span>
                          </button>
                        )}

                        {avatar && (
                          <button
                            type="button"
                            onClick={() => {
                              setAvatar("");
                              setPendingAvatarSrc(null);
                            }}
                            className="inline-flex h-9 min-h-touch items-center whitespace-nowrap rounded-lg px-3 text-xs font-semibold text-status-red link-underline"
                          >
                            Hapus Foto
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Interactive Circular Avatar Crop & Frame Preview Studio */}
                  {pendingAvatarSrc && (
                    <div
                      data-testid="avatar-frame-adjuster"
                      className="rounded-card border border-brand/30 bg-brand-soft/60 p-4 sm:p-5"
                    >
                      <div className="flex flex-col items-center gap-5 sm:flex-row">
                        <div className="flex flex-col items-center gap-2">
                          <div
                            role="application"
                            aria-label="Geser untuk mengatur posisi foto profil"
                            onPointerDown={handleFramePointerDown}
                            onPointerMove={handleFramePointerMove}
                            onPointerUp={handleFramePointerUp}
                            onPointerCancel={handleFramePointerUp}
                            className={[
                              "relative h-36 w-36 overflow-hidden rounded-full ring-4 ring-brand bg-surface shadow-md select-none touch-none",
                              isDraggingFrame
                                ? "cursor-grabbing"
                                : "cursor-grab",
                            ].join(" ")}
                          >
                            <img
                              src={pendingAvatarSrc}
                              alt="Pratinjau bingkai foto profil"
                              draggable={false}
                              onLoad={(e) => {
                                const w = e.currentTarget.naturalWidth;
                                const h = e.currentTarget.naturalHeight;
                                if (w > 0 && h > 0) {
                                  setPendingNaturalSize({
                                    width: w,
                                    height: h,
                                  });
                                }
                              }}
                              className="pointer-events-none absolute select-none"
                              style={{
                                width: `${previewFrameLayout.drawW}px`,
                                height: `${previewFrameLayout.drawH}px`,
                                left: `${previewFrameLayout.left}px`,
                                top: `${previewFrameLayout.top}px`,
                                maxWidth: "none",
                                maxHeight: "none",
                              }}
                            />
                          </div>
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-text-muted">
                            <Move
                              className="h-3 w-3 shrink-0"
                              aria-hidden="true"
                            />
                            <span>Geser foto atau atur slider</span>
                          </span>
                        </div>

                        <div className="w-full flex-1 space-y-3">
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-bold text-text">
                              Penyesuaian Bingkai Foto Profil
                            </p>
                            <button
                              type="button"
                              onClick={() => {
                                setAvatarZoom(1.1);
                                setAvatarOffsetX(0);
                                setAvatarOffsetY(0);
                              }}
                              className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-dark link-underline"
                            >
                              <RotateCcw
                                className="h-3 w-3"
                                aria-hidden="true"
                              />
                              <span>Reset</span>
                            </button>
                          </div>

                          <div>
                            <label
                              htmlFor="avatar-zoom-slider"
                              className="flex items-center justify-between text-xs font-medium text-text-muted"
                            >
                              <span className="inline-flex items-center gap-1">
                                <ZoomIn
                                  className="h-3.5 w-3.5"
                                  aria-hidden="true"
                                />
                                <span>Zoom</span>
                              </span>
                              <span className="font-semibold text-text">
                                {avatarZoom.toFixed(2)}x
                              </span>
                            </label>
                            <input
                              id="avatar-zoom-slider"
                              data-testid="avatar-zoom-slider"
                              type="range"
                              min={1}
                              max={2.5}
                              step={0.05}
                              value={avatarZoom}
                              onChange={(e) =>
                                setAvatarZoom(Number(e.target.value))
                              }
                              className="mt-1 w-full accent-brand"
                            />
                          </div>

                          <div className="grid gap-3 sm:grid-cols-2">
                            <div>
                              <label
                                htmlFor="avatar-pos-x-slider"
                                className="flex items-center justify-between text-xs font-medium text-text-muted"
                              >
                                <span>Posisi Horizontal (X)</span>
                                <span className="font-semibold text-text">
                                  {avatarOffsetX}%
                                </span>
                              </label>
                              <input
                                id="avatar-pos-x-slider"
                                data-testid="avatar-pos-x-slider"
                                type="range"
                                min={-50}
                                max={50}
                                step={1}
                                value={avatarOffsetX}
                                onChange={(e) =>
                                  setAvatarOffsetX(Number(e.target.value))
                                }
                                className="mt-1 w-full accent-brand"
                              />
                            </div>

                            <div>
                              <label
                                htmlFor="avatar-pos-y-slider"
                                className="flex items-center justify-between text-xs font-medium text-text-muted"
                              >
                                <span>Posisi Vertikal (Y)</span>
                                <span className="font-semibold text-text">
                                  {avatarOffsetY}%
                                </span>
                              </label>
                              <input
                                id="avatar-pos-y-slider"
                                data-testid="avatar-pos-y-slider"
                                type="range"
                                min={-50}
                                max={50}
                                step={1}
                                value={avatarOffsetY}
                                onChange={(e) =>
                                  setAvatarOffsetY(Number(e.target.value))
                                }
                                className="mt-1 w-full accent-brand"
                              />
                            </div>
                          </div>

                          <div className="flex flex-wrap justify-end gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => setPendingAvatarSrc(null)}
                              className="inline-flex h-9 items-center rounded-lg border border-border bg-surface px-3.5 text-xs font-semibold text-text hover:bg-bg"
                            >
                              Batal
                            </button>
                            <button
                              type="button"
                              data-testid="avatar-apply-frame-btn"
                              disabled={isProcessingAvatar}
                              onClick={() => void handleApplyAvatarFrame()}
                              className="inline-flex h-9 items-center rounded-lg bg-brand px-4 text-xs font-bold text-surface shadow-sm hover:bg-brand-dark disabled:opacity-60"
                            >
                              Terapkan Bingkai
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="profile-full-name"
                      className="block text-badge font-semibold text-text"
                    >
                      Nama Lengkap
                    </label>
                    <input
                      id="profile-full-name"
                      name="name"
                      type="text"
                      required
                      minLength={2}
                      maxLength={100}
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Nama lengkap Anda"
                      className="mt-1.5 w-full rounded-card border border-border bg-surface px-4 py-2.5 text-body text-text focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand-ring"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="profile-username"
                      className="block text-badge font-semibold text-text"
                    >
                      Username
                    </label>
                    <input
                      id="profile-username"
                      name="username"
                      type="text"
                      minLength={3}
                      maxLength={30}
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Nama Anda"
                      className="mt-1.5 w-full rounded-card border border-border bg-surface px-4 py-2.5 text-body text-text focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand-ring"
                    />
                  </div>
                </div>

                <div className="mt-4">
                  <label
                    htmlFor="profile-email-readonly"
                    className="block text-badge font-semibold text-text"
                  >
                    Alamat Email Terdaftar
                  </label>
                  <input
                    id="profile-email-readonly"
                    type="email"
                    disabled
                    value={email}
                    placeholder="username@mail.com"
                    className="mt-1.5 w-full cursor-not-allowed rounded-card border border-border bg-bg px-4 py-2.5 text-body text-text-muted"
                  />
                </div>

                <div className="mt-6 flex justify-end border-t border-border pt-5">
                  <AppButton
                    type="submit"
                    variant="primary"
                    size="md"
                    loading={isSaving || isLoadingProfile}
                    loadingText="Menyimpan Perubahan..."
                    disabled={fullName.trim().length < 2}
                  >
                    <Save className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>Simpan Perubahan Profil</span>
                  </AppButton>
                </div>
              </section>
            </form>
          )}

          {activeSection === "security" && (
            <form onSubmit={(e) => void handleSavePassword(e)} noValidate>
              <section
                id="keamanan"
                role="tabpanel"
                aria-labelledby="heading-keamanan"
                data-testid="profile-panel-security"
                className="rounded-card border border-border bg-surface p-6 shadow-sm sm:p-7"
              >
                <div className="border-b border-border pb-4">
                  <div className="flex items-center gap-2">
                    <KeyRound
                      className="h-4 w-4 text-brand-dark"
                      aria-hidden="true"
                    />
                    <h2
                      id="heading-keamanan"
                      className="text-lg font-bold text-text"
                    >
                      Keamanan &amp; Kata Sandi
                    </h2>
                  </div>
                  <p className="mt-0.5 text-xs text-text-muted sm:text-sm">
                    Masukkan kata sandi saat ini dan kata sandi baru minimal 8
                    karakter untuk memperbarui keamanan akun Anda.
                  </p>
                </div>

                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="profile-current-password"
                      className="block text-badge font-semibold text-text"
                    >
                      Kata Sandi Saat Ini
                    </label>
                    <input
                      id="profile-current-password"
                      name="currentPassword"
                      type="password"
                      autoComplete="current-password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Kata sandi lama"
                      className="mt-1.5 w-full rounded-card border border-border bg-surface px-4 py-2.5 text-body text-text focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand-ring"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="profile-new-password"
                      className="block text-badge font-semibold text-text"
                    >
                      Kata Sandi Baru (Min. 8 Karakter)
                    </label>
                    <input
                      id="profile-new-password"
                      name="newPassword"
                      type="password"
                      autoComplete="new-password"
                      minLength={8}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Minimal 8 karakter"
                      className="mt-1.5 w-full rounded-card border border-border bg-surface px-4 py-2.5 text-body text-text focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand-ring"
                    />
                  </div>
                </div>

                <div className="mt-6 flex justify-end border-t border-border pt-5">
                  <AppButton
                    type="submit"
                    variant="primary"
                    size="md"
                    loading={isSaving || isLoadingProfile}
                    loadingText="Memperbarui Kata Sandi..."
                    disabled={!currentPassword || newPassword.length < 8}
                  >
                    <Save className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>Perbarui Kata Sandi</span>
                  </AppButton>
                </div>
              </section>
            </form>
          )}

          {activeSection === "session" && (
            <section
              id="sesi-akun"
              role="tabpanel"
              aria-labelledby="heading-sesi-akun"
              data-testid="profile-session-card"
              className="flex flex-col justify-between gap-4 rounded-card border border-border bg-surface p-6 shadow-sm sm:flex-row sm:items-center sm:p-7"
            >
              <div className="space-y-1">
                <h2
                  id="heading-sesi-akun"
                  className="text-lg font-bold text-text"
                >
                  Sesi &amp; Akun
                </h2>
                <p className="text-xs leading-relaxed text-text-muted sm:text-sm">
                  Keluar dari sesi Dentify pada perangkat ini. Riwayat
                  pemindaian dan percakapan Anda tetap aman tersimpan di akun
                  Anda.
                </p>
              </div>

              <button
                type="button"
                onClick={handleLogout}
                data-testid="logout-btn"
                className="inline-flex h-10 min-h-touch shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-status-red/40 bg-transparent px-4 text-sm font-semibold text-status-red btn-motion hover:border-status-red hover:bg-status-red/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-status-red"
              >
                <LogOut className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>Keluar dari Akun</span>
              </button>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

export default ProfileEditorView;
