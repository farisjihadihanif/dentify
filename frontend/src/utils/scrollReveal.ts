/**
 * Scroll reveals without a library. Mark elements in JSX; the styles live in globals.css:
 * - `data-reveal="up" | "left"`: one element fades and slides in. Siblings that enter together stagger.
 * - `data-reveal-group`: the direct children stagger in when the container enters.
 * - `data-reveal-async` (added to either): content loaded after the page, so it also animates
 *   when it appears inside the viewport.
 *
 * Only elements below the fold are ever hidden, and only by this script, so content stays
 * visible without JavaScript and nothing on the first screen disappears.
 */
export const REVEAL_STAGGER_MS = 80;
export const REVEAL_STAGGER_TOTAL_MS = 480;
const REVEAL_SETTLE_MS = 1400;

const SELECTOR = '[data-reveal], [data-reveal-group]';
const STATE = 'data-reveal-state';

export type RevealAction = 'skip' | 'play' | 'wait';

/** What to do with a newly found element, given where its top edge is. */
export function revealActionFor(
  top: number,
  viewportHeight: number,
  isFirstScan: boolean,
  isAsync: boolean,
): RevealAction {
  if (top >= viewportHeight) return 'wait';
  return !isFirstScan && isAsync && top >= 0 ? 'play' : 'skip';
}

/** Delay for one staggered item; long lists share the same total so they never drag. */
export function revealDelay(index: number, count: number): number {
  if (count < 2) return 0;
  const step = Math.min(REVEAL_STAGGER_MS, REVEAL_STAGGER_TOTAL_MS / (count - 1));
  return Math.round(index * step);
}

function setDelays(items: HTMLElement[]): void {
  items.forEach((item, index) =>
    item.style.setProperty('--reveal-delay', `${revealDelay(index, items.length)}ms`),
  );
}

export function startScrollReveal(): () => void {
  if (
    !('IntersectionObserver' in window) ||
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ) {
    return () => {};
  }

  const timers = new Set<number>();

  const play = (elements: HTMLElement[]) => {
    if (elements.length === 0) return;
    const byParent = new Map<Element | null, HTMLElement[]>();
    for (const el of elements) {
      if (el.hasAttribute('data-reveal-group')) {
        setDelays(Array.from(el.children) as HTMLElement[]);
      } else {
        byParent.set(el.parentElement, [...(byParent.get(el.parentElement) ?? []), el]);
      }
    }
    byParent.forEach(setDelays);
    elements.forEach((el) => el.setAttribute(STATE, 'in'));
    // Drop the animation once finished, so toggling `display` later cannot replay it.
    const timer = window.setTimeout(() => {
      timers.delete(timer);
      elements.forEach((el) => el.setAttribute(STATE, 'done'));
    }, REVEAL_SETTLE_MS);
    timers.add(timer);
  };

  const observer = new IntersectionObserver(
    (entries) => {
      const entered = entries.filter((entry) => entry.isIntersecting).map((entry) => entry.target);
      entered.forEach((el) => observer.unobserve(el));
      play(entered as HTMLElement[]);
    },
    // Huge top margin: elements jumped past (anchor links, End key) still reveal.
    { rootMargin: '100000px 0px -40px 0px' },
  );

  const scan = (found: Set<HTMLElement>, isFirstScan: boolean) => {
    const fresh = Array.from(found).filter((el) => !el.hasAttribute(STATE));
    const actions = fresh.map((el) =>
      revealActionFor(
        el.getBoundingClientRect().top,
        window.innerHeight,
        isFirstScan,
        el.hasAttribute('data-reveal-async'),
      ),
    );
    play(fresh.filter((_, i) => actions[i] === 'play'));
    fresh.forEach((el, i) => {
      if (actions[i] === 'skip') el.setAttribute(STATE, 'done');
      if (actions[i] === 'wait') {
        el.setAttribute(STATE, 'pending');
        observer.observe(el);
      }
    });
  };

  scan(new Set(document.querySelectorAll<HTMLElement>(SELECTOR)), true);

  // Route changes and fetched lists. Runs before the browser paints the new nodes.
  const mutations = new MutationObserver((records) => {
    const found = new Set<HTMLElement>();
    for (const record of records) {
      record.addedNodes.forEach((node) => {
        if (!(node instanceof HTMLElement) || !node.isConnected) return;
        if (node.matches(SELECTOR)) found.add(node);
        node.querySelectorAll<HTMLElement>(SELECTOR).forEach((el) => found.add(el));
      });
    }
    if (found.size > 0) scan(found, false);
  });
  mutations.observe(document.body, { childList: true, subtree: true });

  return () => {
    mutations.disconnect();
    observer.disconnect();
    timers.forEach((timer) => window.clearTimeout(timer));
    document.querySelectorAll(`[${STATE}]`).forEach((el) => el.setAttribute(STATE, 'done'));
  };
}
