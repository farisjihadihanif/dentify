import type { Config } from 'tailwindcss';

/**
 * Centralized DentHub design tokens (docs/DESIGN.md §2).
 * Components must use these semantic tokens rather than raw hex values.
 */
const config: Config = {
  darkMode: 'class',
  content: [
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: 'var(--color-brand)',
          dark: 'var(--color-brand-dark)',
          ring: 'var(--color-brand-ring)',
          soft: 'var(--color-brand-soft)',
        },
        surface: {
          DEFAULT: 'var(--color-surface)',
          navy: 'var(--color-surface-navy)',
          teal: 'var(--color-surface-teal)',
          mint: 'var(--color-surface-mint)',
          sand: 'var(--color-surface-sand)',
        },
        bg: 'var(--color-bg)',
        text: {
          DEFAULT: 'var(--color-text)',
          muted: 'var(--color-text-muted)',
        },
        border: 'var(--color-border)',
        status: {
          green: 'var(--color-status-green)',
          yellow: 'var(--color-status-yellow)',
          red: 'var(--color-status-red)',
        },
        'accent-deni': {
          DEFAULT: 'var(--color-accent-deni)',
          soft: 'var(--color-accent-deni-soft)',
        },
        'accent-deni-soft': 'var(--color-accent-deni-soft)',
      },
      fontFamily: {
        display: ['var(--font-display)', 'Bricolage Grotesque', 'system-ui', 'sans-serif'],
        sans: ['var(--font-sans)', 'Plus Jakarta Sans', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        hero: ['2.5rem', { lineHeight: '1.25', fontWeight: '700' }],
        'screen-title': ['1.5rem', { lineHeight: '1.4', fontWeight: '700' }],
        'card-title': ['1.125rem', { lineHeight: '1.45', fontWeight: '600' }],
        body: ['1rem', { lineHeight: '1.6' }],
        badge: ['0.875rem', { lineHeight: '1.4', fontWeight: '500' }],
      },
      spacing: {
        touch: '2.75rem',
        cta: '2.75rem',
      },
      minHeight: {
        touch: '2.75rem',
        cta: '2.75rem',
      },
      minWidth: {
        touch: '2.75rem',
      },
      borderRadius: {
        card: '0.875rem',
        pill: '9999px',
      },
    },
  },
  plugins: [],
};

export default config;
