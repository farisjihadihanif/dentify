"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Github, Instagram, Linkedin, Newspaper } from "lucide-react";

export const FOOTER_SOCIAL_LINKS = [
  {
    label: "Instagram Faris Jihadi Hanif Lubis",
    href: "https://instagram.com/farisjihadihanif",
    icon: Instagram,
  },
  {
    label: "LinkedIn Faris Jihadi Hanif Lubis",
    href: "https://www.linkedin.com/in/faris-jihadi-hanif-lubis-62337a286/",
    icon: Linkedin,
  },
  {
    label: "GitHub Faris Jihadi Hanif Lubis",
    href: "https://github.com/farisjihadihanif",
    icon: Github,
  },
] as const;

export interface AppFooterProps {
  pathnameOverride?: string;
}

/**
 * Flush bottom responsive global footer (`AppFooter.tsx`):
 * - Hidden on `/chat` so the consultation workspace fills 100dvh cleanly
 * - Uses high-contrast dark-navy (`bg-surface-navy`) styling on `/panduan` only
 * - Desktop (`md:` and up): left credits stacked above `Dentify © 2026`, right `Panduan Aplikasi`
 *   stacked above `Promo, Berita & Artikel`
 * - Bottom padding `--dock-clearance` (globals.css) is the minimum that keeps the last line clear of the
 *   floating dock: dock height + offset below xl, normal padding from xl where the dock sits between columns.
 */
export function AppFooter({ pathnameOverride }: AppFooterProps = {}) {
  const hookPathname = usePathname() || "/";
  const pathname = pathnameOverride ?? hookPathname;

  if (pathname === "/chat" || pathname.startsWith("/chat/")) {
    return null;
  }

  const isPanduan = pathname === "/panduan" || pathname.startsWith("/panduan/");

  return (
    <footer
      data-testid="app-footer"
      data-theme={isPanduan ? "navy" : "default"}
      className={[
        "mt-auto w-full border-t pb-[var(--dock-clearance)] pt-4 text-xs",
        isPanduan
          ? "border-white/15 bg-surface-navy text-slate-200"
          : "border-border/70 bg-bg/95 text-text-muted",
      ].join(" ")}
    >
      <div className="mx-auto flex w-full max-w-7xl flex-col items-center justify-between gap-4 px-4 sm:px-6 md:flex-row md:items-center md:gap-6 lg:px-8">
        <div
          data-testid="footer-left-credits"
          className="flex flex-col items-center gap-1 text-center md:items-start md:text-left"
        >
          <p
            className={
              isPanduan ? "font-medium text-slate-200" : "font-medium text-text"
            }
          >
            created by{" "}
            <a
              href="https://www.instagram.com/farisjihadihanif/"
              target="_blank"
              rel="noopener noreferrer"
              className={
                isPanduan
                  ? "text-white link-underline no-underline visited:text-white"
                  : "text-brand-dark link-underline no-underline visited:text-brand-dark"
              }
            >
              <strong className="font-semibold">
                Faris Jihadi Hanif Lubis
              </strong>
            </a>
          </p>
          <div className="flex items-center gap-2">
            <p
              className={
                isPanduan
                  ? "font-semibold text-slate-200"
                  : "font-semibold text-text-muted"
              }
            >
              Dentify &copy; 2026
            </p>
            <ul
              data-testid="footer-social-links"
              className="flex items-center"
            >
              {FOOTER_SOCIAL_LINKS.map(({ label, href, icon: Icon }) => (
                <li key={href}>
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`${label} (tab baru)`}
                    title={label}
                    className={[
                      "inline-flex min-h-touch min-w-touch items-center justify-center rounded-pill icon-motion",
                      isPanduan
                        ? "text-slate-200 hover:bg-white/10 hover:text-white"
                        : "text-text-muted hover:bg-brand-soft hover:text-brand-dark",
                    ].join(" ")}
                  >
                    <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div
          data-testid="footer-right-links"
          className="flex flex-col items-center gap-2 md:items-end"
        >
          <Link
            href="/panduan"
            className={[
              "inline-flex min-h-touch items-center gap-1.5 whitespace-nowrap rounded-pill px-4 text-sm font-semibold btn-motion",
              isPanduan
                ? "border border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white"
                : "bg-brand-soft text-brand-dark hover:bg-brand hover:text-surface",
            ].join(" ")}
          >
            <BookOpen className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="nav-label">Panduan Aplikasi</span>
          </Link>
          <Link
            href="/berita"
            className={[
              "inline-flex min-h-touch items-center gap-1.5 whitespace-nowrap rounded-pill border px-4 text-sm font-semibold btn-motion",
              isPanduan
                ? "border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white"
                : "border-border bg-surface text-brand-dark hover:border-brand hover:bg-brand-soft",
            ].join(" ")}
          >
            <Newspaper className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="nav-label">Promo, Berita &amp; Artikel</span>
          </Link>
        </div>
      </div>
    </footer>
  );
}

export default AppFooter;
