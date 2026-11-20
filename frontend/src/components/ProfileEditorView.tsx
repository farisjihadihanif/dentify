'use client';

import React, {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react';
import { useRouter } from 'next/navigation';
import { Camera, CheckCircle2, LogOut, Save, UserCircle2, KeyRound } from 'lucide-react';
import { AppButton } from './AppButton';
import { ErrorBanner } from './ErrorBanner';
import { MedicalDisclaimerBanner } from './MedicalDisclaimerBanner';
import {
  clearStoredSession,
  fetchCurrentUser,
  getStoredUser,
  isAuthenticated,
  updateCurrentUserProfile,
  type AuthUser,
} from '../services/authService';
import { mapApiError, type MappedUiError } from '../services/errorMapper';

export interface ProfileEditorViewProps {
  initialUser?: AuthUser | null;
}

/**
 * Form Edit Profile (`ProfileEditorView.tsx`):
 * - Dapat mengganti:
 *   1. Nama Lengkap (`name`)
 *   2. Username (`username`)
 *   3. Kata Sandi (`currentPassword` & `newPassword`)
 *   4. Foto Profile (`avatar` — pratinjau langsung & konversi ke data URL)
 * - Menyediakan tombol Logout untuk keluar dari sesi dengan aman.
 */
export function ProfileEditorView({ initialUser = null }: ProfileEditorViewProps) {
  const router = useRouter();
  const avatarInputRef = useRef<HTMLInputElement | null>(null);

  const stored = initialUser ?? getStoredUser();

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

  const handleSaveSubmit = async (event: FormEvent<HTMLFormElement>) => {
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
        current_password: currentPassword || undefined,
        new_password: newPassword || undefined,
      });

      setFullName(updated.full_name || fullName);
      setUsername(updated.username || '');
      setAvatar(updated.avatar || '');
      setCurrentPassword('');
      setNewPassword('');
      setSuccessMessage('Profil Anda berhasil diperbarui.');
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
    <div className="mx-auto max-w-2xl space-y-6 px-4 pb-12 pt-24 sm:px-6 sm:pt-28">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <span className="inline-block rounded-pill bg-brand-soft px-3.5 py-1 text-xs font-bold text-brand-dark">
            Pengaturan Akun • DentHub Profile
          </span>
          <h1 className="mt-2 text-2xl font-bold text-text sm:text-3xl">
            Edit Profil Pengguna
          </h1>
          <p className="mt-1 text-sm text-text-muted sm:text-base">
            Perbarui nama lengkap, username, kata sandi, dan foto profil akun DentHub Anda.
          </p>
        </div>

        <AppButton
          variant="danger"
          size="sm"
          onClick={handleLogout}
          data-testid="logout-btn"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          <span>Keluar (Logout)</span>
        </AppButton>
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

      <section className="rounded-card border border-border bg-surface p-6 shadow-sm sm:p-8">
        <form onSubmit={(e) => void handleSaveSubmit(e)} className="space-y-6" noValidate>
          <div className="flex flex-col items-center gap-4 border-b border-border pb-6 sm:flex-row">
            <div className="relative flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-pill border-2 border-brand bg-brand-soft text-brand-dark shadow-sm">
              {avatar ? (
                <img
                  src={avatar}
                  alt="Foto Profil Pengguna"
                  className="h-full w-full object-cover"
                />
              ) : (
                <UserCircle2 className="h-14 w-14" />
              )}
            </div>

            <div className="space-y-2 text-center sm:text-left">
              <p className="text-card-title text-text">Foto Profil</p>
              <p className="text-badge text-text-muted">
                Unggah foto berformat JPG, PNG, atau WEBP (maksimal 500 KB).
              </p>
              <div className="flex flex-wrap justify-center gap-2 sm:justify-start">
                <label
                  htmlFor="profile-avatar-upload"
                  className="inline-flex h-9 min-h-touch cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg border border-border bg-bg px-3.5 text-xs font-semibold text-brand-dark transition-colors hover:bg-brand-soft"
                >
                  <Camera className="h-4 w-4 shrink-0" />
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

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="profile-full-name" className="block text-badge font-semibold text-text">
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
                className="mt-1.5 w-full rounded-card border border-border bg-surface px-4 py-3 text-body text-text focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand"
              />
            </div>

            <div>
              <label htmlFor="profile-username" className="block text-badge font-semibold text-text">
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
                className="mt-1.5 w-full rounded-card border border-border bg-surface px-4 py-3 text-body text-text focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand"
              />
            </div>
          </div>

          <div>
            <label htmlFor="profile-email-readonly" className="block text-badge font-semibold text-text">
              Alamat Email Terdaftar
            </label>
            <input
              id="profile-email-readonly"
              type="email"
              disabled
              value={email}
              className="mt-1.5 w-full cursor-not-allowed rounded-card border border-border bg-bg px-4 py-3 text-body text-text-muted"
            />
          </div>

          <div className="space-y-4 border-t border-border pt-5">
            <div className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-brand-dark" />
              <h2 className="text-card-title text-text">
                Ganti Kata Sandi (Kosongkan jika tidak ingin mengubah)
              </h2>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
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
                  className="mt-1.5 w-full rounded-card border border-border bg-surface px-4 py-3 text-body text-text focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand"
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
                  className="mt-1.5 w-full rounded-card border border-border bg-surface px-4 py-3 text-body text-text focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand"
                />
              </div>
            </div>
          </div>

          <AppButton
            type="submit"
            variant="primary"
            fullWidth
            loading={isSaving || isLoadingProfile}
            loadingText="Menyimpan Perubahan..."
            disabled={fullName.trim().length < 2}
          >
            <Save className="h-4 w-4" />
            <span>Simpan Perubahan Profil</span>
          </AppButton>
        </form>
      </section>

      <MedicalDisclaimerBanner compact />
    </div>
  );
}

export default ProfileEditorView;
