"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ScanLine,
  MessageCircleHeart,
  MapPin,
  UserCircle2,
} from "lucide-react";
import { getStoredUser, USER_UPDATED_EVENT } from "../services/authService";
import { DentifyLogo } from "./DentifyLogo";

export interface NavDockItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

export interface FloatingNavbarProps {
  pathnameOverride?: string;
  initialAvatar?: string | null;
}

export const NAV_DOCK_ITEMS: readonly NavDockItem[] = [
  { label: "Scan", href: "/scan", icon: ScanLine },
  { label: "Deni", href: "/chat", icon: MessageCircleHeart },
  { label: "Klinik", href: "/clinics", icon: MapPin },
  { label: "Profil", href: "/profile", icon: UserCircle2 },
];

/** Scroll distance (px) that must accumulate before the dock changes state, so small jitters are ignored. */
export const DOCK_SCROLL_DELTA_PX = 8;
/** The dock always shows within this distance (px) of the page top. */
export const DOCK_TOP_ZONE_PX = 64;
/** The dock always shows within this distance (px) of the page end (the footer area). */
export const DOCK_END_ZONE_PX = 96;

export interface DockScrollState {
  scrollY: number;
  lastScrollY: number;
  viewportHeight: number;
  documentHeight: number;
  wasHidden: boolean;
}

/**
 * Decides whether the bottom dock is hidden after a scroll event: hide on scroll down,
 * show on scroll up and near the page top or end. Returns the new hidden state and the
 * scroll position to compare the next event against.
 */
export function nextDockVisibility({
  scrollY,
  lastScrollY,
  viewportHeight,
  documentHeight,
  wasHidden,
}: DockScrollState): { hidden: boolean; anchorY: number } {
  const nearTop = scrollY <= DOCK_TOP_ZONE_PX;
  const nearEnd = scrollY + viewportHeight >= documentHeight - DOCK_END_ZONE_PX;
  if (nearTop || nearEnd) {
    return { hidden: false, anchorY: scrollY };
  }
  const delta = scrollY - lastScrollY;
  if (Math.abs(delta) < DOCK_SCROLL_DELTA_PX) {
    return { hidden: wasHidden, anchorY: lastScrollY };
  }
  return { hidden: delta > 0, anchorY: scrollY };
}

export function FloatingNavbar({
  pathnameOverride,
  initialAvatar,
}: FloatingNavbarProps = {}) {
  const hookPathname = usePathname() || "/";
  const pathname = pathnameOverride ?? hookPathname;
  const isHomeActive = pathname === "/";
  const isChatRoute = pathname === "/chat" || pathname.startsWith("/chat/");

  const [isDockHidden, setIsDockHidden] = useState(false);

  useEffect(() => {
    setIsDockHidden(false);
    if (isChatRoute) return;

    let lastScrollY = window.scrollY;
    let hidden = false;
    let frame = 0;

    const update = () => {
      frame = 0;
      const next = nextDockVisibility({
        scrollY: window.scrollY,
        lastScrollY,
        viewportHeight: window.innerHeight,
        documentHeight: document.documentElement.scrollHeight,
        wasHidden: hidden,
      });
      lastScrollY = next.anchorY;
      if (next.hidden !== hidden) {
        hidden = next.hidden;
        setIsDockHidden(hidden);
      }
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [isChatRoute, pathname]);

  const [userAvatar, setUserAvatar] = useState<string>(
    initialAvatar?.trim() || "",
  );

  useEffect(() => {
    if (initialAvatar !== undefined) {
      setUserAvatar(initialAvatar?.trim() || "");
      return;
    }

    const syncAvatar = () => {
      const stored = getStoredUser();
      setUserAvatar(stored?.avatar?.trim() || "");
    };

    syncAvatar();
    window.addEventListener("storage", syncAvatar);
    window.addEventListener(USER_UPDATED_EVENT, syncAvatar);
    return () => {
      window.removeEventListener("storage", syncAvatar);
      window.removeEventListener(USER_UPDATED_EVENT, syncAvatar);
    };
  }, [initialAvatar]);

  const renderItemVisual = (item: NavDockItem) => {
    if (item.href === "/profile" && userAvatar) {
      return (
        <img
          src={userAvatar}
          alt="Foto Profil"
          data-testid="navbar-profile-avatar"
          className="h-4 w-4 shrink-0 rounded-full object-cover ring-1 ring-current"
        />
      );
    }
    const Icon = item.icon;
    return <Icon className="h-4 w-4 shrink-0" />;
  };

  if (isChatRoute) {
    return (
      <nav
        aria-label="Navigasi Utama Dentify"
        data-testid="floating-navbar"
        data-orientation="vertical-right"
        className="fixed right-2.5 top-1/2 z-40 flex -translate-y-1/2 flex-col items-center gap-1.5 rounded-2xl border border-border/90 bg-surface/95 p-1.5 shadow-xl backdrop-blur-md sm:right-4 sm:gap-2 sm:rounded-3xl sm:p-2"
      >
        <Link
          href="/"
          aria-label="Beranda Dentify"
          title="Beranda Dentify"
          aria-current={isHomeActive ? "page" : undefined}
          data-testid="navbar-logo-home-link"
          className={[
            "inline-flex h-11 w-11 items-center justify-center rounded-xl transition-all duration-150 sm:rounded-2xl",
            isHomeActive
              ? "bg-brand-soft ring-2 ring-brand-ring"
              : "hover:bg-brand-soft/80",
          ].join(" ")}
        >
          <DentifyLogo size={22} showText={false} />
        </Link>

        <span className="h-px w-6 bg-border sm:w-7" aria-hidden="true" />

        <ul className="flex flex-col items-center gap-1 sm:gap-1.5">
          {NAV_DOCK_ITEMS.map((item) => {
            const isActive =
              pathname === item.href || pathname.startsWith(`${item.href}/`);

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  aria-label={item.label}
                  title={item.label}
                  className={[
                    "flex min-h-touch min-w-touch flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1 text-xs font-semibold leading-none transition-all duration-150 sm:rounded-2xl sm:px-1.5",
                    isActive
                      ? "bg-brand text-surface shadow-sm"
                      : "text-text-muted hover:bg-brand-soft hover:text-brand-dark",
                  ].join(" ")}
                >
                  {renderItemVisual(item)}
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    );
  }

  return (
    <header className="pointer-events-none fixed inset-x-0 bottom-3 z-50 flex justify-center px-2 sm:bottom-6 sm:px-3">
      <nav
        aria-label="Navigasi Utama Dentify"
        data-testid="floating-navbar"
        data-orientation="horizontal-bottom"
        data-hidden={isDockHidden ? "true" : "false"}
        className={[
          "flex max-w-full items-center gap-1 rounded-pill border border-border/90 bg-surface/95 px-1.5 py-1 shadow-md backdrop-blur-md transition-[transform,opacity] duration-200 ease-out motion-reduce:transition-none sm:gap-1.5 sm:px-3 sm:py-1.5",
          // Hidden while scrolling down, but still in the tab order: keyboard focus brings it back.
          isDockHidden
            ? "pointer-events-none translate-y-[calc(100%+1.5rem)] opacity-0 focus-within:pointer-events-auto focus-within:translate-y-0 focus-within:opacity-100"
            : "pointer-events-auto",
        ].join(" ")}
      >
        <Link
          href="/"
          aria-label="Beranda Dentify"
          aria-current={isHomeActive ? "page" : undefined}
          data-testid="navbar-logo-home-link"
          className={[
            "inline-flex min-h-touch min-w-touch shrink-0 items-center justify-center rounded-pill px-2 transition-all duration-150 sm:px-3",
            isHomeActive
              ? "bg-brand-soft ring-2 ring-brand-ring"
              : "hover:bg-brand-soft/80",
          ].join(" ")}
        >
          <DentifyLogo
            size={22}
            showText
            textClassName="hidden text-sm font-extrabold tracking-tight text-brand-dark sm:inline"
            className="gap-1.5"
          />
        </Link>

        <span
          className="h-4 w-px shrink-0 bg-border sm:h-5"
          aria-hidden="true"
        />

        <ul className="flex items-center gap-0.5 sm:gap-1">
          {NAV_DOCK_ITEMS.map((item) => {
            const isActive =
              pathname === item.href || pathname.startsWith(`${item.href}/`);

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  title={item.label}
                  className={[
                    "inline-flex min-h-touch min-w-touch shrink-0 flex-col items-center justify-center gap-0.5 whitespace-nowrap rounded-pill px-2.5 text-xs font-semibold leading-none transition-all duration-150 sm:flex-row sm:gap-1.5 sm:px-3.5 sm:text-sm",
                    isActive
                      ? "bg-brand text-surface shadow-sm"
                      : "text-text-muted hover:bg-brand-soft hover:text-brand-dark",
                  ].join(" ")}
                >
                  {renderItemVisual(item)}
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </header>
  );
}

export default FloatingNavbar;
