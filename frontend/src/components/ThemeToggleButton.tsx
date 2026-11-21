'use client';

import React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from './ThemeProvider';

export interface ThemeToggleButtonProps {
  variant?: 'floating' | 'inline';
  className?: string;
}

/**
 * Minimal Sun/Moon Theme Toggle (`ThemeToggleButton.tsx`):
 * - `floating`: compact fixed top-right button accessible across every page
 * - `inline`: labelled button inside `/profile` settings
 */
export function ThemeToggleButton({
  variant = 'floating',
  className = '',
}: ThemeToggleButtonProps) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  if (variant === 'inline') {
    return (
      <button
        type="button"
        onClick={toggleTheme}
        data-testid="theme-toggle-inline"
        aria-label={isDark ? 'Beralih ke Mode Terang' : 'Beralih ke Mode Gelap'}
        aria-pressed={isDark}
        className={[
          'flex min-h-touch w-full items-center justify-between gap-2.5 rounded-xl border border-border bg-bg px-3.5 py-2 text-sm font-semibold text-text transition-colors hover:border-brand/40 hover:bg-brand-soft hover:text-brand-dark',
          className,
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <span className="inline-flex items-center gap-2.5">
          {isDark ? (
            <Sun className="h-4 w-4 shrink-0 text-brand" aria-hidden="true" />
          ) : (
            <Moon className="h-4 w-4 shrink-0 text-brand-dark" aria-hidden="true" />
          )}
          <span>{isDark ? 'Mode Terang' : 'Mode Gelap'}</span>
        </span>
        <span className="rounded-pill bg-surface px-2 py-0.5 text-[11px] font-bold text-text-muted">
          {isDark ? 'Gelap' : 'Terang'}
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      data-testid="theme-toggle-btn"
      aria-label={isDark ? 'Aktifkan Mode Terang' : 'Aktifkan Mode Gelap'}
      title={isDark ? 'Mode Terang' : 'Mode Gelap'}
      aria-pressed={isDark}
      className={[
        'fixed right-4 top-4 z-40 inline-flex h-10 w-10 min-h-touch min-w-touch items-center justify-center rounded-pill border border-border bg-surface text-text shadow-sm transition-colors hover:border-brand/40 hover:bg-brand-soft hover:text-brand-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring sm:right-6 sm:top-6',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {isDark ? (
        <Sun className="h-4 w-4 shrink-0 text-brand" aria-hidden="true" />
      ) : (
        <Moon className="h-4 w-4 shrink-0 text-text" aria-hidden="true" />
      )}
    </button>
  );
}

export default ThemeToggleButton;
