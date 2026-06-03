import React from 'react';
import './GameStatus.css';

interface GameStatusProps {
  currentPlayerIndex: 0 | 1;
  totalPlacedCards: number;
}

export const GameStatus: React.FC<GameStatusProps> = ({
  currentPlayerIndex,
  totalPlacedCards,
}) => {
  const playerLabel =
    currentPlayerIndex === 0 ? 'Игрок 1 (Синий)' : 'Игрок 2 (Оранжевый)';
  const playerColor = currentPlayerIndex === 0 ? 'blue' : 'orange';

  return (
    <div className={`game-status player-${playerColor}`}>
      <div className="status-info">
        <p className="current-turn">
          <strong>Текущий ход:</strong> {playerLabel}
        </p>
        <p className="placed-cards">
          <strong>Карт на доске:</strong> {totalPlacedCards}
        </p>
      </div>
    </div>
  );
};
