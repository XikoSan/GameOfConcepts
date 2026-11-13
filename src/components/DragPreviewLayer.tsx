import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { incrementCounter } from '../debug/performanceDiagnostics';
import type { RegularCardName } from '../game';
import './DragPreviewLayer.css';
import { usePortraitHand } from '../hooks/usePortraitHand';
import { getCardDragLift, getDragBoardCellSize } from './cardDragPosition';

interface DragPreviewLayerProps {
  pointerType?: string;
  cardName: RegularCardName;
  initialX: number;
  initialY: number;
  playerColor: 'blue' | 'orange' | 'green' | 'purple';
}

export function DragPreviewLayer({
  pointerType = 'mouse',
  cardName,
  initialX,
  initialY,
  playerColor,
}: DragPreviewLayerProps) {
  const portrait = usePortraitHand();
  const previewRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLSpanElement>(null);
  const latestPositionRef = useRef({ x: initialX, y: initialY });
  const pointerTypeRef = useRef(pointerType);
  const animationFrameRef = useRef<number | null>(null);
  const lastEventFrameRef = useRef<number | null>(null);

  const applyPreviewTransform = useCallback(() => {
    animationFrameRef.current = null;
    const previewElement = previewRef.current;
    if (!previewElement) return;

    const { x, y } = latestPositionRef.current;
    const cellSize = getDragBoardCellSize(previewElement.ownerDocument);
    if (portrait) previewElement.style.setProperty('--drag-cell-size', `${cellSize}px`);
    const lift = getCardDragLift(pointerTypeRef.current, portrait, cellSize);
    previewElement.style.transform = `translate3d(${x}px, ${y - lift}px, 0) translate(-50%, -50%)`;
  }, [portrait]);

  const schedulePreviewTransform = useCallback(() => {
    if (animationFrameRef.current !== null) {
      incrementCounter('drag:preview-raf-duplicate-skipped');
      return;
    }

    incrementCounter('drag:preview-raf-scheduled');
    animationFrameRef.current = window.requestAnimationFrame(applyPreviewTransform);
  }, [applyPreviewTransform]);

  useLayoutEffect(() => {
    applyPreviewTransform();
  }, [applyPreviewTransform]);
  useLayoutEffect(() => {
    const title = titleRef.current, card = title?.parentElement;
    if (!title || !card || !portrait) return;
    const fit = () => {
      title.style.fontSize = '';
      const style = getComputedStyle(card);
      const available = card.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
      if (available > 0 && title.scrollWidth > available) {
        title.style.fontSize = `${parseFloat(getComputedStyle(title).fontSize) * available / title.scrollWidth * .98}px`;
      }
    };
    const observer = new ResizeObserver(fit);
    observer.observe(card);
    fit();
    // A short fade avoids stretching a long label into a square while keeping the drop target exact.
    const animation = matchMedia('(prefers-reduced-motion: reduce)').matches ? undefined : card.animate([
      { opacity: 0, transform: 'scale(.96)' }, { opacity: 1, transform: 'scale(1)' },
    ], { duration: 120, easing: 'ease-out' });
    return () => { observer.disconnect(); animation?.cancel(); };
  }, [cardName, portrait]);

  useEffect(() => {
    const handleWindowDragOver = (event: globalThis.DragEvent | globalThis.PointerEvent) => {
      if (event.clientX === 0 && event.clientY === 0) return;

      incrementCounter('drag:window-dragover');
      latestPositionRef.current = {
        x: event.clientX,
        y: event.clientY,
      };
      pointerTypeRef.current = 'pointerType' in event ? event.pointerType : 'mouse';

      const eventFrame = Math.floor(performance.now() / 16);
      if (lastEventFrameRef.current === eventFrame) {
        incrementCounter('drag:duplicate-events-same-frame');
      }
      lastEventFrameRef.current = eventFrame;

      schedulePreviewTransform();
    };

    window.addEventListener('dragover', handleWindowDragOver);
    window.addEventListener('pointermove', handleWindowDragOver);

    return () => {
      window.removeEventListener('dragover', handleWindowDragOver);
      window.removeEventListener('pointermove', handleWindowDragOver);
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [schedulePreviewTransform, portrait]);

  return createPortal(
    <div ref={previewRef} className={`drag-card-preview ${portrait ? 'portrait-drag-preview' : ''}`}>
      <div className={`drag-card-preview-card player-${playerColor}`}>
        <span ref={titleRef}>{cardName}</span>
      </div>
    </div>,
    document.body
  );
}
