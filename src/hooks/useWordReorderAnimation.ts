import { useLayoutEffect, useRef } from 'react';
import type { RefObject } from 'react';

// Capture before a local reordering; animate neighbours from their current pixels into their new slots.
export function useWordReorderAnimation(handRef: RefObject<HTMLDivElement | null>, order: string) {
  const previous = useRef<Map<string, DOMRect> | null>(null);
  const animations = useRef<Animation[]>([]);
  const capture = () => {
    const positions = new Map<string, DOMRect>();
    for (const slot of handRef.current?.querySelectorAll<HTMLElement>('[data-word-key]') ?? []) {
      positions.set(slot.dataset.wordKey ?? '', slot.getBoundingClientRect());
    }
    previous.current = positions;
    animations.current.forEach(animation => animation.cancel());
    animations.current = [];
  };
  useLayoutEffect(() => {
    const from = previous.current;
    previous.current = null;
    if (!from || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    for (const slot of handRef.current?.querySelectorAll<HTMLElement>('[data-word-key]') ?? []) {
      const old = from.get(slot.dataset.wordKey ?? '');
      const next = slot.getBoundingClientRect();
      if (!old || Math.hypot(old.left - next.left, old.top - next.top) < 1) continue;
      animations.current.push(slot.animate([
        { transform: `translate(${old.left - next.left}px, ${old.top - next.top}px)` },
        { transform: 'translate(0, 0)' },
      ], { duration: 180, easing: 'cubic-bezier(.2,.7,.2,1)' }));
    }
  }, [handRef, order]);
  useLayoutEffect(() => () => { animations.current.forEach(animation => animation.cancel()); }, []);
  return capture;
}
