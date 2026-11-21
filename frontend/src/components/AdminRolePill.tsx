'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ShieldCheck } from 'lucide-react';
import { getStoredUser, type AuthUser } from '../services/authService';

export interface AdminRolePillProps {
  initialUser?: AuthUser | null;
  pathnameOverride?: string;
}

/**
 * Subtle floating top-right Admin shortcut pill rendered ONLY when the logged-in
 * user has `role === 'admin'`. Keeps the bottom dock unchanged.
 */
export function AdminRolePill({
  initialUser = null,
  pathnameOverride,
}: AdminRolePillProps) {
  const hookPathname = usePathname() || '/';
  const pathname = pathnameOverride ?? hookPathname;
  const [user, setUser] = useState<AuthUser | null>(initialUser);

  useEffect(() => {
    if (initialUser) return;
    const syncUser = () => {
      setUser(getStoredUser());
    };
    syncUser();
    window.addEventListener('storage', syncUser);
    return () => window.removeEventListener('storage', syncUser);
  }, [initialUser, pathname]);

  if (!user || user.role !== 'admin') {
    return null;
  }

  if (pathname === '/admin' || pathname.startsWith('/admin/')) {
    return null;
  }

  return (
    <Link
      href="/admin"
      data-testid="admin-role-pill"
      aria-label="Buka Admin Panel DentHub"
      className="fixed right-4 top-4 z-30 inline-flex h-10 items-center gap-1.5 whitespace-nowrap rounded-pill border border-brand/30 bg-surface/95 px-3.5 text-xs font-bold text-brand-dark shadow-sm backdrop-blur-md transition-colors hover:bg-brand hover:text-surface sm:right-6 sm:top-6"
    >
      <ShieldCheck className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>Admin</span>
    </Link>
  );
}

export default AdminRolePill;
