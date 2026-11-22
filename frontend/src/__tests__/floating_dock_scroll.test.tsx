import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import {
  DOCK_END_ZONE_PX,
  DOCK_SCROLL_DELTA_PX,
  FloatingNavbar,
  nextDockVisibility,
} from '../components/FloatingNavbar';

vi.mock('next/navigation', () => ({
  usePathname: () => '/clinics',
}));

const base = {
  viewportHeight: 800,
  documentHeight: 4000,
};

describe('Floating dock hides on scroll down and returns on scroll up / page end', () => {
  it('hides when scrolling down in the middle of the page', () => {
    expect(
      nextDockVisibility({ ...base, scrollY: 600, lastScrollY: 500, wasHidden: false }),
    ).toEqual({ hidden: true, anchorY: 600 });
  });

  it('shows again when scrolling up', () => {
    expect(
      nextDockVisibility({ ...base, scrollY: 500, lastScrollY: 600, wasHidden: true }),
    ).toEqual({ hidden: false, anchorY: 500 });
  });

  it('ignores jitter smaller than the scroll threshold', () => {
    const result = nextDockVisibility({
      ...base,
      scrollY: 600 + DOCK_SCROLL_DELTA_PX - 1,
      lastScrollY: 600,
      wasHidden: true,
    });
    expect(result).toEqual({ hidden: true, anchorY: 600 });
  });

  it('always shows near the page top', () => {
    expect(
      nextDockVisibility({ ...base, scrollY: 40, lastScrollY: 0, wasHidden: false }).hidden,
    ).toBe(false);
  });

  it('always shows near the page end, even while scrolling down', () => {
    const scrollY = base.documentHeight - base.viewportHeight - DOCK_END_ZONE_PX + 1;
    expect(
      nextDockVisibility({ ...base, scrollY, lastScrollY: scrollY - 200, wasHidden: true }).hidden,
    ).toBe(false);
  });

  it('starts visible and skips the slide animation under prefers-reduced-motion', () => {
    const html = renderToStaticMarkup(<FloatingNavbar initialAvatar={null} />);
    expect(html).toContain('data-hidden="false"');
    expect(html).toContain('motion-reduce:transition-none');
  });
});
