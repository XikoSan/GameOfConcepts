import React from 'react';
import './Card.css';

interface CardProps {
  cardName: string;
  draggable?: boolean;
  isSelected?: boolean;
  onDrag?: (event: React.DragEvent<HTMLDivElement>) => void;
  onDragStart?: (event: React.DragEvent<HTMLDivElement>) => void;
  onDragEnd?: () => void;
  playerColor?: 'blue' | 'orange';
}

export const Card: React.FC<CardProps> = ({
  cardName,
  draggable,
  isSelected,
  onDrag,
  onDragStart,
  onDragEnd,
  playerColor = 'blue',
}) => {
  const handleDragStart = (event: React.DragEvent<HTMLDivElement>) => {
    const transparentPreview = new Image();
    transparentPreview.src =
      'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', cardName);
    event.dataTransfer.setDragImage(transparentPreview, 0, 0);
    onDragStart?.(event);
  };

  return (
    <div
      className={`card ${isSelected ? 'selected' : ''} player-${playerColor}`}
      draggable={draggable}
      onDrag={onDrag}
      onDragStart={handleDragStart}
      onDragEnd={onDragEnd}
    >
      <span className="card-title">{cardName}</span>
    </div>
  );
};
