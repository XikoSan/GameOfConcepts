import React from 'react';
import type { RegularCardName } from '../game';
import { Card } from './Card';
import './PlayerHand.css';

interface PlayerHandProps {
  playerNumber: 0 | 1;
  cards: RegularCardName[];
  deckCount: number;
  selectedCard: RegularCardName | null;
  isActive: boolean;
  onMoveCardDrag: (event: React.DragEvent<HTMLDivElement>) => void;
  onStartCardDrag: (
    cardName: RegularCardName,
    playerColor: 'blue' | 'orange',
    event: React.DragEvent<HTMLDivElement>
  ) => void;
  onCancelCardDrag: () => void;
}

const playerColors = {
  0: 'blue' as const,
  1: 'orange' as const,
};

export const PlayerHand: React.FC<PlayerHandProps> = ({
  playerNumber,
  cards,
  deckCount,
  selectedCard,
  isActive,
  onMoveCardDrag,
  onStartCardDrag,
  onCancelCardDrag,
}) => {
  const playerLabel = playerNumber === 0 ? 'Игрок 1 (Синий)' : 'Игрок 2 (Оранжевый)';

  return (
    <div className={`player-hand player-${playerNumber} ${isActive ? 'active' : 'inactive'}`}>
      <div className="hand-content">
        <div className="deck-stack" aria-label={`Карт в колоде: ${deckCount}`}>
          <div className={`deck-card-back player-${playerNumber}`}>
            <span>{deckCount}</span>
          </div>
          <p>Колода</p>
        </div>

        <div className="cards-container">
          {cards.map((card) => (
            <Card
              key={card}
              cardName={card}
              playerColor={playerColors[playerNumber]}
              isSelected={selectedCard === card}
              draggable={isActive}
              onDrag={isActive ? onMoveCardDrag : undefined}
              onDragStart={
                isActive
                  ? (event) => onStartCardDrag(card, playerColors[playerNumber], event)
                  : undefined
              }
              onDragEnd={isActive ? onCancelCardDrag : undefined}
            />
          ))}
        </div>

        <div className="player-plate">
          <h3>{playerLabel}</h3>
          <span className="card-count">{isActive ? 'Ход активен' : 'Ожидает'}</span>
        </div>
      </div>
    </div>
  );
};
