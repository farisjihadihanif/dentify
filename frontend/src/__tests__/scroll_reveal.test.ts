import { describe, expect, it } from 'vitest';
import { revealActionFor, revealDelay, REVEAL_STAGGER_TOTAL_MS } from '../utils/scrollReveal';

describe('Scroll reveal', () => {
  it('never hides content that is already on screen at first paint', () => {
    expect(revealActionFor(200, 800, true, false)).toBe('skip');
    expect(revealActionFor(200, 800, true, true)).toBe('skip');
  });

  it('waits for content below the fold', () => {
    expect(revealActionFor(800, 800, true, false)).toBe('wait');
    expect(revealActionFor(1200, 800, false, true)).toBe('wait');
  });

  it('animates only async content that loads into view', () => {
    expect(revealActionFor(200, 800, false, true)).toBe('play');
    expect(revealActionFor(200, 800, false, false)).toBe('skip');
    expect(revealActionFor(-50, 800, false, true)).toBe('skip');
  });

  it('staggers 80 ms apart and caps long lists', () => {
    expect(revealDelay(0, 1)).toBe(0);
    expect(revealDelay(2, 4)).toBe(160);
    expect(revealDelay(29, 30)).toBe(REVEAL_STAGGER_TOTAL_MS);
  });
});
