import React from 'react';
import type { PlacedCard } from '../game';
import './Cell.css';

interface CellProps {
  placedCard?: PlacedCard;
  onCellClick?: () => void;
  isHighlighted?: boolean;
}

export const Cell: React.FC<CellProps> = ({
  placedCard,
  onCellClick,
  isHighlighted,
}) => {
  return (
    <div
      className={`cell ${isHighlighted ? 'highlighted' : ''} ${
        placedCard ? 'occupied' : 'empty'
      }`}
      onClick={onCellClick}
    >
      {placedCard && (
        <div className={`card-in-cell player-${placedCard.playerId}`}>
          {placedCard.cardName}
        </div>
      )}
    </div>
  );
};
