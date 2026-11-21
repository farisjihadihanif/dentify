'use client';

import React, { type ButtonHTMLAttributes, type ReactNode } from 'react';

export type AppButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
export type AppButtonSize = 'sm' | 'md' | 'lg';

export interface AppButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: AppButtonVariant;
  size?: AppButtonSize;
  loading?: boolean;
  loadingText?: string;
  fullWidth?: boolean;
  children: ReactNode;
}

const VARIANT_CLASSES: Record<AppButtonVariant, string> = {
  primary: 'bg-brand text-surface shadow-sm hover:bg-brand-dark focus-visible:ring-brand',
  secondary:
    'border border-border bg-surface text-text shadow-sm hover:bg-brand-soft focus-visible:ring-brand',
  danger: 'bg-status-red text-surface shadow-sm hover:opacity-95 focus-visible:ring-status-red',
  ghost: 'bg-transparent text-brand-dark hover:bg-brand-soft focus-visible:ring-brand',
};

const SIZE_CLASSES: Record<AppButtonSize, string> = {
  sm: 'h-9 min-h-touch min-w-touch px-3.5 text-xs rounded-lg',
  md: 'h-10 min-h-touch min-w-touch px-4 text-sm rounded-xl',
  lg: 'h-11 min-h-touch min-w-touch px-6 text-base rounded-pill',
};

/**
 * Tombol aksi reusable DentHub yang ramping, modern, dan proporsional:
 * - Varian: `primary`, `secondary`, `danger`, `ghost`
 * - Ukuran:
 *   * `sm` (`h-9 px-3 text-xs`)
 *   * `md` (`h-10 px-4 text-sm` — default standar)
 *   * `lg` (`h-11 px-6 text-base` — CTA Hero)
 * - Menggunakan `inline-flex items-center justify-center gap-2 whitespace-nowrap`
 *   agar ikon dan teks selalu sejajar rapi dalam 1 baris horizontal.
 */
export function AppButton({
  variant = 'primary',
  size = 'md',
  loading = false,
  loadingText = 'Memproses...',
  fullWidth = false,
  disabled,
  className = '',
  type = 'button',
  children,
  ...rest
}: AppButtonProps) {
  const isDisabled = Boolean(disabled || loading);

  return (
    <button
      type={type}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      className={[
        'inline-flex items-center justify-center gap-2 whitespace-nowrap font-semibold transition-all duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
        'disabled:cursor-not-allowed disabled:opacity-60',
        SIZE_CLASSES[size],
        VARIANT_CLASSES[variant],
        fullWidth ? 'w-full' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    >
      {loading ? (
        <>
          <span
            aria-hidden="true"
            className="inline-block h-4 w-4 shrink-0 animate-spin rounded-pill border-2 border-current border-t-transparent"
          />
          <span>{loadingText}</span>
        </>
      ) : (
        children
      )}
    </button>
  );
}

export default AppButton;
