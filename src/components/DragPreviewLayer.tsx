import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { incrementCounter } from '../debug/performanceDiagnostics';
import type { RegularCardName } from '../game';
import './DragPreviewLayer.css';

interface DragPreviewLayerProps {
  cardName: RegularCardName;
  initialX: number;
  initialY: number;
  playerColor: 'blue' | 'orange' | 'green' | 'purple';
}

export function DragPreviewLayer({
  cardName,
  initialX,
  initialY,
  playerColor,
}: DragPreviewLayerProps) {
  const previewRef = useRef<HTMLDivElement>(null);
  const latestPositionRef = useRef({ x: initialX, y: initialY });
  const animationFrameRef = useRef<number | null>(null);
  const lastEventFrameRef = useRef<number | null>(null);

  const applyPreviewTransform = useCallback(() => {
    animationFrameRef.current = null;
    const previewElement = previewRef.current;
    if (!previewElement) return;

    const { x, y } = latestPositionRef.current;
    previewElement.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`;
  }, []);

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

  useEffect(() => {
    const handleWindowDragOver = (event: globalThis.DragEvent) => {
      if (event.clientX === 0 && event.clientY === 0) return;

      incrementCounter('drag:window-dragover');
      latestPositionRef.current = {
        x: event.clientX,
        y: event.clientY,
      };

      const eventFrame = Math.floor(performance.now() / 16);
      if (lastEventFrameRef.current === eventFrame) {
        incrementCounter('drag:duplicate-events-same-frame');
      }
      lastEventFrameRef.current = eventFrame;

      schedulePreviewTransform();
    };

    window.addEventListener('dragover', handleWindowDragOver);

    return () => {
      window.removeEventListener('dragover', handleWindowDragOver);
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [schedulePreviewTransform]);

  return createPortal(
    <div ref={previewRef} className="drag-card-preview">
      <div className={`drag-card-preview-card player-${playerColor}`}>
        {cardName}
      </div>
    </div>,
    document.body
  );
}
