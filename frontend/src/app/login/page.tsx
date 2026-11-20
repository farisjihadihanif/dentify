'use client';

import React, { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AppButton } from '../../components/AppButton';
import { DentHubLogo } from '../../components/DentHubLogo';
import { ErrorBanner } from '../../components/ErrorBanner';
import { MedicalDisclaimerBanner } from '../../components/MedicalDisclaimerBanner';
import { loginUser } from '../../services/authService';
import { mapApiError, type MappedUiError } from '../../services/errorMapper';

export default function LoginPage() {
  const router = useRouter();

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
      await loginUser({ email, password });
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
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 pb-12 pt-24 sm:px-6">
      <div className="mb-6 text-center">
        <Link
          href="/"
          className="inline-flex items-center justify-center"
        >
          <DentHubLogo size={38} showText textClassName="text-xl font-extrabold text-brand-dark" />
        </Link>
        <h1 className="mt-4 text-screen-title text-text">Masuk ke Akun Anda</h1>
        <p className="mt-1 text-badge text-text-muted">
          Akses kembali riwayat screening gigi dan percakapan Deni Anda.
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
            <label htmlFor="login-email" className="block text-badge font-semibold text-text">
              Alamat Email
            </label>
            <input
              id="login-email"
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
            <label htmlFor="login-password" className="block text-badge font-semibold text-text">
              Kata Sandi
            </label>
            <input
              id="login-password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Masukkan kata sandi Anda"
              className="mt-1.5 w-full rounded-card border border-border bg-surface px-4 py-3 text-body text-text placeholder:text-text-muted focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand"
            />
          </div>

          <AppButton
            type="submit"
            variant="primary"
            fullWidth
            loading={isSubmitting}
            loadingText="Memverifikasi Akun..."
            disabled={cooldownLeft > 0 || !email.trim() || !password}
          >
            {cooldownLeft > 0 ? `Tunggu ${cooldownLeft} detik...` : 'Masuk Sekarang'}
          </AppButton>
        </form>

        <div className="mt-6 border-t border-border pt-4 text-center text-badge text-text-muted">
          <p>
            Belum memiliki akun DentHub?{' '}
            <Link href="/register" className="font-semibold text-brand-dark hover:underline">
              Daftar Akun Baru
            </Link>
          </p>
          <p className="mt-2">
            Atau baca{' '}
            <Link href="/panduan" className="font-semibold text-brand-dark hover:underline">
              Panduan Penggunaan Aplikasi →
            </Link>
          </p>
        </div>
      </section>

      <div className="mt-6">
        <MedicalDisclaimerBanner compact />
      </div>
    </main>
  );
}
