'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, useReducedMotion } from 'framer-motion';
import { MessageCircle } from 'lucide-react';

const HIDDEN_ROUTES = ['/chat', '/login', '/register'];

const CONTENT_SELECTOR =
  'a,button,input,select,textarea,img,video,canvas,iframe,svg,h1,h2,h3,h4,h5,h6,p,li,label,td,th,figure,[role="button"]';

/** True when the element is something a reader looks at or taps, not an empty layout box. */
export function isContentElement(el: Element): boolean {
  if (el.matches(CONTENT_SELECTOR)) return true;
  return Array.from(el.childNodes).some(
    (node) => node.nodeType === 3 && Boolean(node.textContent?.trim()),
  );
}

/**
 * Samples a 3x3 grid over the mascot and reports whether any page content sits underneath it.
 */
export function mascotCollidesWithContent(widget: HTMLElement): boolean {
  const rect = widget.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return false;
  for (let i = 1; i <= 3; i += 1) {
    for (let j = 1; j <= 3; j += 1) {
      const x = rect.left + (rect.width * i) / 4;
      const y = rect.top + (rect.height * j) / 4;
      const stack = document.elementsFromPoint(x, y);
      if (stack.some((el) => !widget.contains(el) && isContentElement(el))) return true;
    }
  }
  return false;
}

/**
 * Floating Deni Mascot:
 * Energetic idle hop/bounce with springy hover jump + "Tanya Deni" tooltip positioned above Deni.
 * Hidden below md (the bottom dock already has a Deni tab); from md up it fades out whenever
 * page content scrolls underneath it, so it never covers text or controls.
 */
export function DeniMascot() {
  const pathname = usePathname() || '/';
  const prefersReducedMotion = useReducedMotion();
  const [isHovered, setIsHovered] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [collides, setCollides] = useState(false);
  const widgetRef = useRef<HTMLDivElement | null>(null);

  const shouldHide = HIDDEN_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );

  useEffect(() => {
    if (shouldHide || typeof window === 'undefined') return undefined;
    let frame = 0;
    const check = () => {
      frame = 0;
      const widget = widgetRef.current;
      if (widget) setCollides(mascotCollidesWithContent(widget));
    };
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(check);
    };
    schedule();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
    // Images and fonts change layout without DOM mutations.
    const resizeObserver =
      typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(schedule);
    resizeObserver?.observe(document.body);
    window.addEventListener('load', schedule);
    // Scripted entrance animations move content without DOM or size changes; re-check slowly.
    const interval = window.setInterval(schedule, 1000);
    return () => {
      window.clearInterval(interval);
      resizeObserver?.disconnect();
      window.removeEventListener('load', schedule);
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      observer.disconnect();
    };
  }, [shouldHide, pathname]);

  if (shouldHide) {
    return null;
  }

  return (
    <div
      ref={widgetRef}
      data-testid="deni-mascot-widget"
      data-collides={collides ? 'true' : 'false'}
      inert={collides}
      className={[
        'fixed bottom-24 right-6 z-50 hidden flex-col items-end transition-opacity duration-200 md:flex',
        collides ? 'pointer-events-none opacity-0' : 'opacity-100',
      ].join(' ')}
    >
      <Link
        href="/chat"
        aria-label="Tanya Deni — Konsultasi dengan Asisten AI Deni"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onFocus={() => setIsHovered(true)}
        onBlur={() => setIsHovered(false)}
        className="group relative flex flex-col items-center focus:outline-none"
      >
        <span
          data-testid="deni-mascot-tooltip"
          className={[
            'pointer-events-none absolute bottom-full right-0 mb-2 inline-flex items-center gap-1.5 whitespace-nowrap rounded-pill border border-accent-deni bg-surface px-3.5 py-1.5 text-badge font-bold text-accent-deni shadow-md transition-all duration-200',
            isHovered
              ? 'animate-deni-tooltip-bounce scale-100 opacity-100'
              : 'translate-y-1 scale-95 opacity-0 group-hover:animate-deni-tooltip-bounce group-hover:translate-y-0 group-hover:scale-100 group-hover:opacity-100',
          ].join(' ')}
        >
          <MessageCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>Tanya Deni</span>
          <span
            aria-hidden="true"
            className="absolute -bottom-1.5 right-6 h-3 w-3 rotate-45 border-b border-r border-accent-deni bg-surface"
          />
        </span>

        <motion.div
          animate={
            prefersReducedMotion
              ? undefined
              : {
                  y: [0, -14, 0, -8, 0],
                  rotate: [-3, 3, -2, 0],
                }
          }
          transition={
            prefersReducedMotion
              ? undefined
              : {
                  duration: 2.3,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }
          }
          whileHover={
            prefersReducedMotion
              ? undefined
              : {
                  y: -16,
                  scale: 1.1,
                  rotate: 4,
                  transition: { type: 'spring', stiffness: 420, damping: 14 },
                }
          }
          whileTap={prefersReducedMotion ? undefined : { scale: 0.94 }}
          className="animate-deni-float relative flex h-20 w-20 items-center justify-center sm:h-24 sm:w-24"
        >
          {!imageError ? (
            <img
              src="/images/deni-mascot.svg"
              alt="Maskot Deni — Asisten Kesehatan Gigi Dentify"
              onError={() => setImageError(true)}
              className="relative z-10 h-full w-full select-none object-contain drop-shadow-md"
            />
          ) : (
            <div className="relative z-10 flex h-16 w-16 items-center justify-center rounded-pill border-2 border-accent-deni bg-accent-deni-soft text-accent-deni shadow-md">
              <MessageCircle className="h-7 w-7" aria-hidden="true" />
            </div>
          )}
        </motion.div>
      </Link>
    </div>
  );
}

export default DeniMascot;
