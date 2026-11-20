import React from "react";

export interface KineticMarqueeRibbonsProps {
  topPhrases?: readonly string[];
  bottomPhrases?: readonly string[];
  testId?: string;
}

const DEFAULT_TOP_PHRASES = [
  "DENI AI SCREENING",
  "DETEKSI KARIES SEJAK DINI",
  "CEK KARANG GIGI & GUSI",
  "BASED ON AI COMPUTER VISION",
  "REKOMENDASI LANGKAH PERTAMA",
] as const;

const DEFAULT_BOTTOM_PHRASES = [
  "KONSULTASI WITH AI DENI",
  "PERAWATAN PREVENTIF",
  "CLINIC FINDER",
  "CEK GIGI GRATIS",
  "CEGAH SEJAK DINI",
] as const;

function FourPointStarIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-5 w-5 shrink-0 text-surface-mint sm:h-6 sm:w-6"
      fill="currentColor"
    >
      <path d="M12 2L14.4 9.6L22 12L14.4 14.4L12 22L9.6 14.4L2 12L9.6 9.6L12 2Z" />
    </svg>
  );
}

/**
 * Double Crossed Bold Kinetic Marquee Ribbons (`KineticMarqueeRibbons.tsx`, docs/DESIGN.md §3.1):
 * - Top ribbon (`surface-teal`, `-rotate-2`) scrolls left
 * - Bottom ribbon (`surface-navy`, `rotate-1`, `-mt-2`) scrolls right
 * - Alternates solid white and hollow outlined stroke uppercase display typography separated by four-point stars
 * - Pauses on hover and respects `prefers-reduced-motion`.
 */
export function KineticMarqueeRibbons({
  topPhrases = DEFAULT_TOP_PHRASES,
  bottomPhrases = DEFAULT_BOTTOM_PHRASES,
  testId = "kinetic-marquee-ribbons",
}: KineticMarqueeRibbonsProps) {
  const repeatedTop = [
    ...topPhrases,
    ...topPhrases,
    ...topPhrases,
    ...topPhrases,
  ];
  const repeatedBottom = [
    ...bottomPhrases,
    ...bottomPhrases,
    ...bottomPhrases,
    ...bottomPhrases,
  ];

  return (
    <div
      aria-hidden="true"
      data-testid={testId}
      className="relative w-full overflow-x-clip py-6 select-none"
    >
      {/* Top Ribbon — Rich Clinical Teal scrolling left */}
      <div className="relative z-10 w-full -rotate-2 scale-[1.03] bg-surface-teal py-3.5 text-surface shadow-md sm:py-4">
        <div className="animate-kinetic-marquee flex items-center gap-6 whitespace-nowrap sm:gap-8">
          {repeatedTop.map((phrase, idx) => (
            <span
              key={`top-${phrase}-${idx}`}
              className="inline-flex items-center gap-6 sm:gap-8"
            >
              <span
                className={[
                  "font-display text-xl font-extrabold uppercase tracking-tight sm:text-3xl lg:text-4xl",
                  idx % 2 === 1 ? "kinetic-stroke-text" : "text-surface",
                ].join(" ")}
              >
                {phrase}
              </span>
              <FourPointStarIcon />
            </span>
          ))}
        </div>
      </div>

      {/* Bottom Ribbon — Deep Midnight Navy scrolling right */}
      <div className="relative z-20 -mt-2 w-full rotate-1 scale-[1.03] bg-surface-navy py-3.5 text-surface shadow-lg sm:py-4">
        <div className="animate-kinetic-marquee-reverse flex items-center gap-6 whitespace-nowrap sm:gap-8">
          {repeatedBottom.map((phrase, idx) => (
            <span
              key={`bot-${phrase}-${idx}`}
              className="inline-flex items-center gap-6 sm:gap-8"
            >
              <span
                className={[
                  "font-display text-xl font-extrabold uppercase tracking-tight sm:text-3xl lg:text-4xl",
                  idx % 2 === 0 ? "kinetic-stroke-text" : "text-surface",
                ].join(" ")}
              >
                {phrase}
              </span>
              <FourPointStarIcon />
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export default KineticMarqueeRibbons;
