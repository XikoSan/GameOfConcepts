import { useLayoutEffect, type RefObject } from 'react';
import '../components/CardTitle.css';

const pixels = (value: string) => Number.parseFloat(value) || 0;
const horizontalPadding = (style: CSSStyleDeclaration) =>
  pixels(style.paddingLeft) + pixels(style.paddingRight);

export function useFitCardTitle(
  cardRef: RefObject<HTMLDivElement | null>,
  titleRef: RefObject<HTMLSpanElement | null>,
  name: string | undefined,
  wordLayout = false,
) {
  useLayoutEffect(() => {
    const card = cardRef.current;
    const title = titleRef.current;
    const text = title?.firstElementChild;
    if (!card || !title || !(text instanceof HTMLElement)) return;

    // Observe the portrait slot rather than its content-sized label.
    const slot = wordLayout ? card.parentElement : null;
    const fitTitle = () => {
      title.style.removeProperty('font-size');
      const cardStyle = getComputedStyle(card);
      const titleStyle = getComputedStyle(title);
      const titleInsets = horizontalPadding(titleStyle)
        + pixels(titleStyle.borderLeftWidth) + pixels(titleStyle.borderRightWidth);
      const available = card.clientWidth - horizontalPadding(cardStyle) - titleInsets - 1;
      if (available <= 0) return;

      // The inline-block's layout width is independent of board zoom and hand tilt.
      const extent = () => pixels(getComputedStyle(text).width);
      let width = extent();
      let size = pixels(titleStyle.fontSize);
      for (let attempt = 0; attempt < 3 && width > available; attempt += 1) {
        size = size * available / width;
        title.style.fontSize = `${size}px`;
        width = extent();
      }
    };

    const observer = new ResizeObserver(fitTitle);
    observer.observe(slot ?? card);
    fitTitle();
    let active = true;
    void card.ownerDocument.fonts.ready.then(() => { if (active) fitTitle(); });
    return () => {
      active = false;
      observer.disconnect();
    };
  }, [cardRef, titleRef, name, wordLayout]);
}
