'use client';

import React, { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AppButton } from '../../components/AppButton';
import { DentHubLogo } from '../../components/DentHubLogo';
import { ErrorBanner } from '../../components/ErrorBanner';
import { registerUser } from '../../services/authService';
import { mapApiError, type MappedUiError } from '../../services/errorMapper';

export default function RegisterPage() {
  const router = useRouter();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cooldownLeft, setCooldownLeft] = useState(0);
  const [uiError, setUiError] = useState<MappedUiError | null>(null);

  useEffect(() => {
    if (cooldownLeft <= 0) return undefined;
    const timer = window.setInterval(() => {
      setCooldownLeft((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [cooldownLeft]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting || cooldownLeft > 0) return;

    setUiError(null);
    setIsSubmitting(true);

    try {
      await registerUser({
        full_name: fullName,
        email,
        password,
      });
      const redirectParam =
        typeof window !== 'undefined'
          ? new URLSearchParams(window.location.search).get('redirect')
          : null;
      const target =
        redirectParam && redirectParam.startsWith('/') ? redirectParam : '/';
      router.push(target);
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
      setIsSubmitting(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-12 sm:px-6">
      <div className="mb-6 text-center">
        <Link
          href="/"
          className="inline-flex items-center justify-center"
        >
          <DentHubLogo size={38} showText textClassName="text-xl font-extrabold text-brand-dark" />
        </Link>
        <h1 className="mt-4 text-screen-title text-text">Buat Akun DentHub Baru</h1>
        <p className="mt-1 text-badge text-text-muted">
          Simpan riwayat hasil pemindaian gigi dan rencana perawatan preventif Anda secara aman.
        </p>
      </div>

      <section className="rounded-card border border-border bg-surface p-6 shadow-sm sm:p-8">
        {uiError && (
          <div className="mb-4">
            <ErrorBanner error={uiError} onDismiss={() => setUiError(null)} />
          </div>
        )}

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4" noValidate>
          <div>
            <label htmlFor="register-full-name" className="block text-badge font-semibold text-text">
              Nama Lengkap
            </label>
            <input
              id="register-full-name"
              name="full_name"
              type="text"
              autoComplete="name"
              required
              minLength={2}
              maxLength={100}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Contoh: Faris Jihadi"
              className="mt-1.5 w-full rounded-card border border-border bg-surface px-4 py-3 text-body text-text placeholder:text-text-muted focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand"
            />
          </div>

          <div>
            <label htmlFor="register-email" className="block text-badge font-semibold text-text">
              Alamat Email
            </label>
            <input
              id="register-email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nama@contoh.com"
              className="mt-1.5 w-full rounded-card border border-border bg-surface px-4 py-3 text-body text-text placeholder:text-text-muted focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand"
            />
          </div>

          <div>
            <label htmlFor="register-password" className="block text-badge font-semibold text-text">
              Kata Sandi (minimal 8 karakter)
            </label>
            <input
              id="register-password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimal 8 karakter"
              className="mt-1.5 w-full rounded-card border border-border bg-surface px-4 py-3 text-body text-text placeholder:text-text-muted focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand"
            />
          </div>

          <AppButton
            type="submit"
            variant="primary"
            fullWidth
            loading={isSubmitting}
            loadingText="Mendaftarkan Akun..."
            disabled={
              cooldownLeft > 0 ||
              fullName.trim().length < 2 ||
              !email.trim() ||
              password.length < 8
            }
          >
            {cooldownLeft > 0 ? `Tunggu ${cooldownLeft} detik...` : 'Daftar Sekarang'}
          </AppButton>
        </form>

        <div className="mt-6 border-t border-border pt-4 text-center text-badge text-text-muted">
          <p>
            Sudah memiliki akun?{' '}
            <Link href="/login" className="font-semibold text-brand-dark hover:underline">
              Masuk di sini
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
