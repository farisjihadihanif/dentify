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

export function FloatingNavbar({
  pathnameOverride,
  initialAvatar,
}: FloatingNavbarProps = {}) {
  const hookPathname = usePathname() || "/";
  const pathname = pathnameOverride ?? hookPathname;
  const isHomeActive = pathname === "/";
  const isChatRoute = pathname === "/chat" || pathname.startsWith("/chat/");

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
          className="h-4 w-4 shrink-0 rounded-full object-cover ring-1 ring-current sm:h-5 sm:w-5"
        />
      );
    }
    const Icon = item.icon;
    return <Icon className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" />;
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
            "inline-flex h-9 w-9 items-center justify-center rounded-xl transition-all duration-150 sm:h-11 sm:w-11 sm:min-h-touch sm:min-w-touch sm:rounded-2xl",
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
                    "flex flex-col items-center justify-center gap-0.5 rounded-xl px-1.5 py-1 text-[9px] font-semibold transition-all duration-150 sm:min-h-touch sm:min-w-touch sm:rounded-2xl sm:px-2 sm:py-1.5 sm:text-[10px]",
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
        className="pointer-events-auto flex max-w-full items-center gap-0.5 rounded-pill border border-border/90 bg-surface/95 px-1.5 py-1 shadow-md backdrop-blur-md sm:gap-1.5 sm:px-3 sm:py-1.5"
      >
        <Link
          href="/"
          aria-label="Beranda Dentify"
          aria-current={isHomeActive ? "page" : undefined}
          data-testid="navbar-logo-home-link"
          className={[
            "inline-flex h-8 shrink-0 items-center justify-center rounded-pill px-2 transition-all duration-150 sm:h-9 sm:min-h-touch sm:min-w-touch sm:px-3",
            isHomeActive
              ? "bg-brand-soft ring-2 ring-brand-ring"
              : "hover:bg-brand-soft/80",
          ].join(" ")}
        >
          <DentifyLogo
            size={20}
            showText
            className="gap-1 text-xs sm:gap-1.5 sm:text-sm"
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
                    "inline-flex h-8 shrink-0 items-center justify-center gap-1 whitespace-nowrap rounded-pill px-1.5 text-[11px] font-semibold transition-all duration-150 sm:h-9 sm:min-h-touch sm:min-w-touch sm:gap-1.5 sm:px-3.5 sm:text-sm",
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
