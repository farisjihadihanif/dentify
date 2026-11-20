'use client';

import React, {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Camera,
  CheckCircle2,
  KeyRound,
  LogOut,
  Mail,
  Save,
  Shield,
  ShieldCheck,
  User,
  UserCircle2,
} from 'lucide-react';
import { AppButton } from './AppButton';
import { ErrorBanner } from './ErrorBanner';
import {
  clearStoredSession,
  fetchCurrentUser,
  getStoredUser,
  isAuthenticated,
  updateCurrentUserProfile,
  type AuthUser,
} from '../services/authService';
import { mapApiError, type MappedUiError } from '../services/errorMapper';

export type ProfileSectionTab = 'general' | 'security' | 'session';

export interface ProfileEditorViewProps {
  initialUser?: AuthUser | null;
  initialSection?: ProfileSectionTab;
}

const SETTINGS_TABS = [
  { key: 'general' as const, label: 'Profil Umum', icon: User },
  { key: 'security' as const, label: 'Keamanan & Kata Sandi', icon: KeyRound },
  { key: 'session' as const, label: 'Sesi & Akun', icon: Shield },
] as const;

/**
 * Modern SaaS Two-Column Account Settings Workspace (`ProfileEditorView.tsx`, docs/DESIGN.md §3.5):
 * - Left sticky column: Profile summary card + interactive section tab buttons (`Profil Umum`,
 *   `Keamanan & Kata Sandi`, `Sesi & Akun`) + `Admin Panel` shortcut when `user.role === 'admin'`.
 * - Right column: Renders ONLY the single currently active section card (`general` by default).
 */
export function ProfileEditorView({
  initialUser = null,
  initialSection = 'general',
}: ProfileEditorViewProps) {
  const router = useRouter();
  const avatarInputRef = useRef<HTMLInputElement | null>(null);

  const stored = initialUser ?? getStoredUser();

  const [activeSection, setActiveSection] = useState<ProfileSectionTab>(initialSection);
  const [role, setRole] = useState<'user' | 'admin'>(stored?.role ?? 'user');
  const [fullName, setFullName] = useState<string>(stored?.full_name || '');
  const [username, setUsername] = useState<string>(stored?.username || '');
  const [email, setEmail] = useState<string>(stored?.email || '');
  const [avatar, setAvatar] = useState<string>(stored?.avatar || '');
  const [currentPassword, setCurrentPassword] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
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
        setRole(fresh.role || 'user');
        setFullName(fresh.full_name || '');
        setUsername(fresh.username || '');
        setEmail(fresh.email || '');
        setAvatar(fresh.avatar || '');
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setIsLoadingProfile(false);
      });

    return () => {
      cancelled = true;
    };
  }, [initialUser]);

  const handleAvatarFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUiError(null);
    setSuccessMessage(null);

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setUiError(mapApiError('INVALID_IMAGE'));
      return;
    }
    if (file.size > 500 * 1024) {
      setUiError({
        code: 'PAYLOAD_TOO_LARGE',
        action: 'reset_file_input',
        message: 'Ukuran foto profil maksimal 500 KB. Silakan pilih foto yang lebih ringan.',
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setAvatar(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveGeneral = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSaving) return;

    setUiError(null);
    setSuccessMessage(null);
    setIsSaving(true);

    try {
      const updated = await updateCurrentUserProfile({
        full_name: fullName.trim(),
        username: username.trim() ? username.trim().toLowerCase() : undefined,
        avatar,
      });

      setFullName(updated.full_name || fullName);
      setUsername(updated.username || '');
      setAvatar(updated.avatar || '');
      setSuccessMessage('Profil umum Anda berhasil diperbarui.');
    } catch (error) {
      const mapped =
        error && typeof error === 'object' && 'uiError' in error
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

      setCurrentPassword('');
      setNewPassword('');
      setSuccessMessage('Kata sandi akun Anda berhasil diperbarui.');
    } catch (error) {
      const mapped =
        error && typeof error === 'object' && 'uiError' in error
          ? (error as { uiError: MappedUiError }).uiError
          : mapApiError(error);
      setUiError(mapped);
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = () => {
    clearStoredSession();
    router.push('/login');
  };

  return (
    <div
      data-testid="profile-settings-workspace"
      className="mx-auto max-w-6xl space-y-6 px-4 pb-24 pt-10 sm:px-6 sm:pt-12 lg:px-8"
    >
      {/* Clean Page Header */}
      <div className="border-b border-border pb-5">
        <h1 className="text-2xl font-bold text-text sm:text-3xl">Edit Profil Pengguna</h1>
        <p className="mt-1 text-sm text-text-muted sm:text-base">
          Kelola identitas akun, keamanan kata sandi, dan sesi aktif DentHub Anda dalam satu tempat.
        </p>
      </div>

      {uiError && <ErrorBanner error={uiError} onDismiss={() => setUiError(null)} />}

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
                {fullName || 'Pengguna DentHub'}
              </h2>
              {username && (
                <p className="text-xs font-semibold text-brand-dark">@{username}</p>
              )}
              <p className="mt-1.5 inline-flex items-center gap-1.5 text-xs text-text-muted">
                <Mail className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span className="truncate">{email || 'Belum ada email'}</span>
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
                        'flex min-h-touch w-full items-center gap-2.5 rounded-xl px-3.5 py-2 text-left text-sm font-semibold transition-colors',
                        isActive
                          ? 'bg-brand text-surface shadow-sm'
                          : 'text-text-muted hover:bg-brand-soft hover:text-brand-dark',
                      ].join(' ')}
                    >
                      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <span>{item.label}</span>
                    </button>
                  </li>
                );
              })}
            </ul>

            {role === 'admin' && (
              <div className="mt-2 border-t border-border pt-2">
                <Link
                  href="/admin"
                  data-testid="profile-admin-panel-link"
                  className="flex min-h-touch w-full items-center gap-2.5 rounded-xl bg-brand-soft px-3.5 py-2 text-sm font-bold text-brand-dark transition-colors hover:bg-brand hover:text-surface"
                >
                  <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>Admin Panel</span>
                </Link>
              </div>
            )}
          </nav>
        </aside>

        {/* Right Column: Single Active Section Card */}
        <div className="lg:col-span-8">
          {activeSection === 'general' && (
            <form onSubmit={(e) => void handleSaveGeneral(e)} noValidate>
              <section
                id="profil-umum"
                role="tabpanel"
                aria-labelledby="heading-profil-umum"
                data-testid="profile-panel-general"
                className="rounded-card border border-border bg-surface p-6 shadow-sm sm:p-7"
              >
                <div className="border-b border-border pb-4">
                  <h2 id="heading-profil-umum" className="text-lg font-bold text-text">
                    Profil Umum
                  </h2>
                  <p className="mt-0.5 text-xs text-text-muted sm:text-sm">
                    Informasi ini ditampilkan pada akun dan riwayat pemindaian DentHub Anda.
                  </p>
                </div>

                <div className="mt-5 flex flex-col items-center gap-4 border-b border-border pb-6 sm:flex-row">
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
                    <p className="text-sm font-semibold text-text">Foto Profil</p>
                    <p className="text-xs text-text-muted">
                      Unggah foto berformat JPG, PNG, atau WEBP (maksimal 500 KB).
                    </p>
                    <div className="flex flex-wrap justify-center gap-2 sm:justify-start">
                      <label
                        htmlFor="profile-avatar-upload"
                        className="inline-flex h-9 min-h-touch cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg border border-border bg-bg px-3.5 text-xs font-semibold text-brand-dark transition-colors hover:bg-brand-soft"
                      >
                        <Camera className="h-4 w-4 shrink-0" aria-hidden="true" />
                        <span>Ganti Foto Profil</span>
                        <input
                          ref={avatarInputRef}
                          id="profile-avatar-upload"
                          name="avatar"
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          onChange={handleAvatarFileChange}
                          className="sr-only"
                        />
                      </label>

                      {avatar && (
                        <button
                          type="button"
                          onClick={() => setAvatar('')}
                          className="inline-flex h-9 min-h-touch items-center whitespace-nowrap rounded-lg px-3 text-xs font-semibold text-status-red hover:underline"
                        >
                          Hapus Foto
                        </button>
                      )}
                    </div>
                  </div>
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
                      placeholder="contoh: farislubis"
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

          {activeSection === 'security' && (
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
                    <KeyRound className="h-4 w-4 text-brand-dark" aria-hidden="true" />
                    <h2 id="heading-keamanan" className="text-lg font-bold text-text">
                      Keamanan &amp; Kata Sandi
                    </h2>
                  </div>
                  <p className="mt-0.5 text-xs text-text-muted sm:text-sm">
                    Masukkan kata sandi saat ini dan kata sandi baru minimal 8 karakter untuk
                    memperbarui keamanan akun Anda.
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

          {activeSection === 'session' && (
            <section
              id="sesi-akun"
              role="tabpanel"
              aria-labelledby="heading-sesi-akun"
              data-testid="profile-session-card"
              className="flex flex-col justify-between gap-4 rounded-card border border-border bg-surface p-6 shadow-sm sm:flex-row sm:items-center sm:p-7"
            >
              <div className="space-y-1">
                <h2 id="heading-sesi-akun" className="text-lg font-bold text-text">
                  Sesi &amp; Akun
                </h2>
                <p className="text-xs leading-relaxed text-text-muted sm:text-sm">
                  Keluar dari sesi DentHub pada perangkat ini. Riwayat pemindaian dan percakapan
                  Anda tetap aman tersimpan di akun Anda.
                </p>
              </div>

              <button
                type="button"
                onClick={handleLogout}
                data-testid="logout-btn"
                className="inline-flex h-10 min-h-touch shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-status-red/40 bg-transparent px-4 text-sm font-semibold text-status-red transition-colors hover:border-status-red hover:bg-status-red/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-status-red"
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
