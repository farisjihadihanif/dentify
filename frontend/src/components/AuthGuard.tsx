'use client';

import React, { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Lock } from 'lucide-react';
import { isAuthenticated } from '../services/authService';

export interface AuthGuardProps {
  children: ReactNode;
  featureName?: string;
  redirectPath?: string;
}

/**
 * Proteksi halaman yang wajib login (`/scan` dan `/profile`).
 * - Saat di browser dan pengguna belum memiliki token JWT, otomatis mengarahkan ke
 *   `/login?redirect=<path>` serta menampilkan kartu akses terproteksi yang rapi.
 */
export function AuthGuard({
  children,
  featureName = 'Fitur AI Scan & Profil',
  redirectPath,
}: AuthGuardProps) {
  const router = useRouter();
  const pathname = usePathname() || '/scan';
  const targetRedirect = redirectPath || pathname;

  const [authorized, setAuthorized] = useState<boolean>(() => isAuthenticated());
  const [checked, setChecked] = useState<boolean>(false);

  useEffect(() => {
    const loggedIn = isAuthenticated();
    setAuthorized(loggedIn);
    setChecked(true);

    if (!loggedIn) {
      router.replace(`/login?redirect=${encodeURIComponent(targetRedirect)}`);
    }
  }, [router, targetRedirect]);

  if (!authorized && checked) {
    return (
      <div className="mx-auto max-w-xl space-y-6 px-4 py-10 sm:py-12">
        <section
          aria-label="Halaman Wajib Login"
          data-testid="auth-guard-prompt"
          className="rounded-card border border-border bg-surface p-8 text-center shadow-sm"
        >
          <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-pill bg-brand-soft text-brand-dark">
            <Lock className="h-6 w-6" />
          </div>
          <h1 className="mt-4 text-xl font-bold text-text sm:text-2xl">
            Silakan Masuk untuk Menggunakan {featureName}
          </h1>
          <p className="mt-2 text-sm text-text-muted sm:text-base">
            Untuk menjaga keamanan riwayat pemeriksaan gigi dan profil kesehatan Anda, halaman ini
            hanya dapat digunakan setelah Anda masuk ke akun Dentify.
          </p>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link
              href={`/login?redirect=${encodeURIComponent(targetRedirect)}`}
              className="inline-flex h-10 min-h-cta items-center justify-center whitespace-nowrap rounded-xl bg-brand px-5 text-sm font-semibold text-surface shadow-sm transition-colors hover:bg-brand-dark"
            >
              Masuk ke Akun Sekarang →
            </Link>
            <Link
              href="/register"
              className="inline-flex h-10 min-h-cta items-center justify-center whitespace-nowrap rounded-xl border border-border bg-surface px-5 text-sm font-semibold text-text transition-colors hover:bg-brand-soft"
            >
              Daftar Akun Gratis
            </Link>
          </div>
        </section>
      </div>
    );
  }

  return <>{children}</>;
}

export default AuthGuard;
