import React, { useEffect, useLayoutEffect, useRef } from 'react';
import { incrementCounter } from '../debug/performanceDiagnostics';
import './Card.css';

interface CardProps {
  style?: React.CSSProperties;
  handIndex?: number;
  managedPointer?: boolean;
  inspected?: boolean;
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
  style, handIndex, managedPointer = false, inspected = false, onInspect,
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
    const fitTitle = () => {
      title.style.fontSize = '';
      const style = getComputedStyle(card);
      const available = card.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight) - 3;
      const baseSize = parseFloat(getComputedStyle(title).fontSize);
      if (available > 0 && title.scrollWidth > available) {
        title.style.fontSize = `${baseSize * available / title.scrollWidth * 0.98}px`;
      }
    };
    const observer = new ResizeObserver(fitTitle);
    observer.observe(card);
    fitTitle();
    void document.fonts.ready.then(() => { if (card.isConnected) fitTitle(); });
    return () => observer.disconnect();
  }, [cardName]);


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
