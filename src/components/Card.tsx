import React from 'react';
import './Card.css';

interface CardProps {
  cardName: string;
  onClick?: () => void;
  isSelected?: boolean;
  playerColor?: 'blue' | 'orange';
}

export const Card: React.FC<CardProps> = ({
  cardName,
  onClick,
  isSelected,
  playerColor = 'blue',
}) => {
  return (
    <div
      className={`card ${isSelected ? 'selected' : ''} player-${playerColor}`}
      onClick={onClick}
    >
      {cardName}
    </div>
  );
};
