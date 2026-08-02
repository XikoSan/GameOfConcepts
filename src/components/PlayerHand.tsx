import React from 'react';
import type { RegularCardName } from '../game';
import { incrementCounter } from '../debug/performanceDiagnostics';
import { Card } from './Card';
import './PlayerHand.css';

interface PlayerHandProps {
  playerNumber: number;
  cards: RegularCardName[];
  deckCount: number;
  selectedCard: RegularCardName | null;
  isActive: boolean;
  className?: string;
  hideCards?: boolean;
  displayName?: string;
  statusLabel?: string;
  onStartCardDrag: (
    cardName: RegularCardName,
    playerColor: 'blue' | 'orange' | 'green' | 'purple',
    event: React.DragEvent<HTMLDivElement>
  ) => void;
  onCancelCardDrag: () => void;
  onOpenDictionary: (term: string) => void;
}

const playerColors = {
  0: 'blue' as const,
  1: 'orange' as const,
  2: 'green' as const,
  3: 'purple' as const,
};

export const PlayerHand: React.FC<PlayerHandProps> = ({
  playerNumber,
  cards,
  deckCount,
  selectedCard,
  isActive,
  className = '',
  hideCards = false,
  displayName,
  statusLabel,
  onStartCardDrag,
  onCancelCardDrag,
  onOpenDictionary,
}) => {
  incrementCounter('render:PlayerHand');
  const playerColor = playerColors[playerNumber as keyof typeof playerColors] ?? 'blue';
  const playerColorLabels = {
    blue: 'Синий',
    orange: 'Оранжевый',
    green: 'Зелёный',
    purple: 'Фиолетовый',
  };
  const playerLabel =
    displayName?.trim() || `Игрок ${playerNumber + 1} (${playerColorLabels[playerColor]})`;
  const playerStatusLabel = statusLabel ?? (isActive ? 'Ход активен' : 'Ожидает');

  return (
    <div className={`player-hand player-${playerNumber} ${isActive ? 'active' : 'inactive'} ${className}`}>
      <div className="hand-content">
        <div className="hand-main-group">
          <div className="deck-stack" aria-label={`Карт в колоде: ${deckCount}`}>
            <div className={`deck-card-back player-${playerNumber}`}>
              <span>{deckCount}</span>
            </div>
            <p>Колода</p>
          </div>

          <div className="cards-container">
            {/* FIXME(MVP): Рука оппонента скрыта только в UI, но технически остаётся доступна в gameState. */}
            {hideCards
              ? cards.map((_, index) => (
                  <div
                    aria-label="Скрытая карта оппонента"
                    className={`hidden-hand-card player-${playerNumber}`}
                    key={`hidden-${playerNumber}-${index}`}
                  />
                ))
              : cards.map((card, index) => (
                  <Card
                  key={`${card}-${index}`}
                  cardName={card}
                  playerColor={playerColor}
                  isSelected={selectedCard === card}
                  draggable={isActive}
                  onDragStart={
                    isActive
                      ? (event) => onStartCardDrag(card, playerColor, event)
                      : undefined
                  }
                    onDragEnd={isActive ? onCancelCardDrag : undefined}
                    onOpenDictionary={onOpenDictionary}
                  />
                ))}
          </div>
        </div>

        <div className="player-plate">
          <h3>{playerLabel}</h3>
          <span className="card-count">{playerStatusLabel}</span>
        </div>
      </div>
    </div>
  );
};
