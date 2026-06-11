import React, { useRef } from 'react';
import './Card.css';

interface CardProps {
  cardName: string;
  draggable?: boolean;
  isSelected?: boolean;
  onDrag?: (event: React.DragEvent<HTMLDivElement>) => void;
  onDragStart?: (event: React.DragEvent<HTMLDivElement>) => void;
  onDragEnd?: () => void;
  onOpenDictionary?: (cardName: string) => void;
  playerColor?: 'blue' | 'orange' | 'green' | 'purple';
}

export const Card: React.FC<CardProps> = ({
  cardName,
  draggable,
  isSelected,
  onDrag,
  onDragStart,
  onDragEnd,
  onOpenDictionary,
  playerColor = 'blue',
}) => {
  const didDragRecentlyRef = useRef(false);
  const dragResetTimeoutRef = useRef<number | null>(null);
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);

  const handleDragStart = (event: React.DragEvent<HTMLDivElement>) => {
    window.dispatchEvent(new CustomEvent('card-info-close'));
    didDragRecentlyRef.current = true;
    if (dragResetTimeoutRef.current !== null) {
      window.clearTimeout(dragResetTimeoutRef.current);
      dragResetTimeoutRef.current = null;
    }

    const transparentPreview = new Image();
    transparentPreview.src =
      'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', cardName);
    event.dataTransfer.setDragImage(transparentPreview, 0, 0);
    onDragStart?.(event);
  };

  const handleDragEnd = () => {
    onDragEnd?.();
    dragResetTimeoutRef.current = window.setTimeout(() => {
      didDragRecentlyRef.current = false;
      dragResetTimeoutRef.current = null;
    }, 0);
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    pointerStartRef.current = {
      x: event.clientX,
      y: event.clientY,
    };
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;

    const start = pointerStartRef.current;
    pointerStartRef.current = null;

    if (didDragRecentlyRef.current) return;
    if (!start) return;

    const distance = Math.hypot(event.clientX - start.x, event.clientY - start.y);
    if (distance > 8) return;

    onOpenDictionary?.(cardName);
  };

  return (
    <div
      className={`card ${isSelected ? 'selected' : ''} player-${playerColor}`}
      draggable={draggable}
      onDrag={onDrag}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
    >
      <span className="card-title">{cardName}</span>
    </div>
  );
};
