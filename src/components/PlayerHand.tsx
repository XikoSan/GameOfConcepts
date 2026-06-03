import React from 'react';
import type { CardName } from '../game';
import { Card } from './Card';
import './PlayerHand.css';

interface PlayerHandProps {
  playerNumber: 0 | 1;
  cards: CardName[];
  selectedCard: CardName | null;
  onSelectCard: (cardName: CardName) => void;
}

const playerColors = {
  0: 'blue' as const,
  1: 'orange' as const,
};

export const PlayerHand: React.FC<PlayerHandProps> = ({
  playerNumber,
  cards,
  selectedCard,
  onSelectCard,
}) => {
  const playerLabel = playerNumber === 0 ? 'Игрок 1 (Синий)' : 'Игрок 2 (Оранжевый)';

  return (
    <div className={`player-hand player-${playerNumber}`}>
      <h3>{playerLabel}</h3>
      <div className="cards-container">
        {cards.map((card) => (
          <Card
            key={card}
            cardName={card}
            playerColor={playerColors[playerNumber]}
            isSelected={selectedCard === card}
            onClick={() => onSelectCard(card)}
          />
        ))}
      </div>
      <p className="card-count">Карт в руке: {cards.length}</p>
    </div>
  );
};
