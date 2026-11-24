'use client';

import { useEffect } from 'react';
import { startScrollReveal } from '../utils/scrollReveal';

/** Runs the `data-reveal` scroll animations for every page. Renders nothing. */
export function ScrollReveal() {
  useEffect(() => startScrollReveal(), []);
  return null;
}

export default ScrollReveal;
