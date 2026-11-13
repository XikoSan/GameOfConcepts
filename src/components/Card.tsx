import React, { useEffect, useLayoutEffect, useRef } from 'react';
import { incrementCounter } from '../debug/performanceDiagnostics';
import './Card.css';

interface CardProps {
  style?: React.CSSProperties;
  handIndex?: number;
  managedPointer?: boolean;
  inspected?: boolean;
  wordLayout?: boolean;
  onInspect?: () => void;
  cardName: string;
  draggable?: boolean;
  isSelected?: boolean;
  onDragStart?: (event: React.DragEvent<HTMLDivElement> | React.PointerEvent<HTMLDivElement>) => void;
  onDragEnd?: () => void;
  onOpenDictionary?: (cardName: string) => void;
  playerColor?: 'blue' | 'orange' | 'green' | 'purple';
}

export const Card: React.FC<CardProps> = ({
  style, handIndex, managedPointer = false, inspected = false, wordLayout = false, onInspect,
  cardName,
  draggable,
  isSelected,
  onDragStart,
  onDragEnd,
  onOpenDictionary,
  playerColor = 'blue',
}) => {
  incrementCounter('render:HandCard');
  const cardRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const card = cardRef.current;
    const title = titleRef.current;
    if (!card || !title) return;
    const measure = card.ownerDocument.createElement('canvas').getContext('2d');
    const fitTitle = () => {
      title.style.fontSize = '';
      const style = getComputedStyle(card);
      const titleStyle = getComputedStyle(title);
      const vertical = titleStyle.writingMode.startsWith('vertical');
      // Reserve enough room for the tilted backing inside each hand slot.
      const available = wordLayout
        ? Math.min(196, (card.parentElement?.clientWidth ?? 0) - 6) - parseFloat(titleStyle.paddingLeft) - parseFloat(titleStyle.paddingRight) - 5
        : vertical
        ? title.clientHeight - 3
        : card.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight) - 3;
      const baseSize = parseFloat(titleStyle.fontSize);
      // Measure glyphs rather than a stretched flex label, including when centred text overflows both ends.
      if (measure) measure.font = `${titleStyle.fontWeight} ${baseSize}px ${titleStyle.fontFamily}`;
      const extent = measure
        ? measure.measureText(cardName).width + (parseFloat(titleStyle.letterSpacing) || 0) * Math.max(0, cardName.length - 1)
        : vertical ? title.scrollHeight : title.scrollWidth;
      if (available > 0 && extent > available) {
        title.style.fontSize = `${baseSize * available / extent * 0.98}px`;
      }
    };
    const observer = new ResizeObserver(fitTitle);
    observer.observe(card);
    if (wordLayout && card.parentElement) observer.observe(card.parentElement);
    fitTitle();
    void document.fonts.ready.then(() => { if (card.isConnected) fitTitle(); });
    return () => observer.disconnect();
  }, [cardName, inspected, managedPointer, wordLayout]);


  const pointer = useRef<{ id: number; x: number; y: number; dragging: boolean } | null>(null);
  const endDrag = useRef(onDragEnd);
  useEffect(() => { endDrag.current = onDragEnd; }, [onDragEnd]);
  useEffect(() => () => { if (pointer.current?.dragging) endDrag.current?.(); }, []);

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!event.isPrimary || event.button !== 0) return;
    pointer.current = { id: event.pointerId, x: event.clientX, y: event.clientY, dragging: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const current = pointer.current;
    if (!current || current.id !== event.pointerId || !draggable) return;
    // Portrait hands scroll horizontally; only a vertical touch starts a card drag.
    if (!current.dragging && event.pointerType !== 'mouse' &&
        getComputedStyle(event.currentTarget).touchAction === 'pan-x' &&
        Math.abs(event.clientX - current.x) > 8 && Math.abs(event.clientX - current.x) > Math.abs(event.clientY - current.y)) {
      pointer.current = null;
      return;
    }
    if (!current.dragging && Math.hypot(event.clientX - current.x, event.clientY - current.y) > 8) {
      current.dragging = true;
      window.dispatchEvent(new CustomEvent('card-info-close'));
      onDragStart?.(event);
    }
  };
  const handlePointerCancel = () => {
    const wasDragging = pointer.current?.dragging;
    pointer.current = null;
    if (wasDragging) onDragEnd?.();
  };
  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    const current = pointer.current;
    if (!current || current.id !== event.pointerId) return;
    pointer.current = null;
    if (current.dragging) {
      window.dispatchEvent(new CustomEvent('card-pointer-drop', {
        detail: {
          cardName, clientX: event.clientX,
          clientY: event.clientY - (event.pointerType === 'mouse' ? 0 : 44),
        },
      }));
      onDragEnd?.();
    } else if (Math.hypot(event.clientX - current.x, event.clientY - current.y) <= 8) {
      onOpenDictionary?.(cardName);
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  return (
    <div
      ref={cardRef}
      className={`card ${isSelected ? 'selected' : ''} ${inspected ? 'is-inspected' : ''} player-${playerColor}`}
      style={style}
      data-hand-index={handIndex}
      role={managedPointer ? 'button' : undefined}
      tabIndex={managedPointer ? 0 : undefined}
      aria-label={managedPointer ? cardName : undefined}
      aria-pressed={managedPointer ? inspected : undefined}
      onKeyDown={event => {
        if (!managedPointer || (event.key !== 'Enter' && event.key !== ' ')) return;
        event.preventDefault();
        if (inspected) onOpenDictionary?.(cardName); else onInspect?.();
      }}
      draggable={false}
      data-draggable={draggable}
      onDragStart={event => event.preventDefault()}
      onPointerDown={managedPointer ? undefined : handlePointerDown}
      onPointerUp={managedPointer ? undefined : handlePointerUp}
      onPointerMove={managedPointer ? undefined : handlePointerMove}
      onPointerCancel={managedPointer ? undefined : handlePointerCancel}
      onLostPointerCapture={managedPointer ? undefined : handlePointerCancel}
      onContextMenu={event => event.preventDefault()}
    >
      <span ref={titleRef} className="card-title">{cardName}</span>
    </div>
  );
};
