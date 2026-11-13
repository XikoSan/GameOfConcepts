import { useLayoutEffect, useRef } from 'react';

// Reserve the label's tilted bounds before wrapping so selecting it never moves neighbours.
export function useWordHandLayout(enabled: boolean, cards: readonly string[]) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const hand = ref.current;
    if (!enabled || !hand) return;
    const context = hand.ownerDocument.createElement('canvas').getContext('2d');
    if (!context) return;
    const workspace = hand.closest<HTMLElement>('.table-workspace');
    const updateExtent = () => {
      const bounds = hand.getBoundingClientRect();
      if (!workspace || bounds.height <= 0 || bounds.width <= 0) return;
      const value = `${Math.ceil(workspace.getBoundingClientRect().bottom - bounds.top)}px`;
      if (workspace.style.getPropertyValue('--mobile-hand-extent') !== value) workspace.style.setProperty('--mobile-hand-extent', value);
    };
    const update = () => {
      for (const slot of hand.querySelectorAll<HTMLElement>('.word-hand-slot')) {
        const title = slot.querySelector<HTMLElement>('.card-title');
        if (!title) continue;
        const style = getComputedStyle(title);
        context.font = `${style.fontWeight} 18px ${style.fontFamily}`;
        const text = title.textContent ?? '';
        const spacing = (parseFloat(style.letterSpacing) || 0) * Math.max(0, text.length - 1);
        const width = Math.ceil(Math.min(196, context.measureText(text).width + spacing + 14) + 9);
        const value = `${Math.max(50, width)}px`;
        if (slot.style.getPropertyValue('--word-slot-width') !== value) slot.style.setProperty('--word-slot-width', value);
      }
      updateExtent();
    };
    let lastWidth = -1;
    const observer = new ResizeObserver(entries => {
      updateExtent();
      const width = entries[0]?.contentRect.width ?? 0;
      if (Math.abs(width - lastWidth) < .25) return;
      lastWidth = width;
      update();
    });
    observer.observe(hand);
    update();
    let active = true;
    void hand.ownerDocument.fonts.ready.then(() => { if (active) update(); });
    return () => { active = false; observer.disconnect(); workspace?.style.removeProperty('--mobile-hand-extent'); };
  }, [enabled, cards]);
  return ref;
}
