import React from 'react';
import type { RegularCardName } from '../game';
import { incrementCounter } from '../debug/performanceDiagnostics';
import { Card } from './Card';
import { usePortraitHand } from '../hooks/usePortraitHand';
import { useFanHand } from '../hooks/useFanHand';
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
  suggestedCard?: string;
  onStartCardDrag: (
    cardName: RegularCardName,
    playerColor: 'blue' | 'orange' | 'green' | 'purple',
    event: React.DragEvent<HTMLDivElement> | React.PointerEvent<HTMLDivElement>
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
  suggestedCard,
  onStartCardDrag,
  onCancelCardDrag,
  onOpenDictionary,
}) => {
  incrementCounter('render:PlayerHand');
  const playerColor = playerColors[playerNumber as keyof typeof playerColors] ?? 'blue';
  const portrait = usePortraitHand() && !hideCards;
  const fan = useFanHand({ enabled: portrait, active: isActive, cards, preferred: suggestedCard,
    onStart: (index, event) => onStartCardDrag(cards[index], playerColor, event),
    onEnd: onCancelCardDrag, onInfo: index => onOpenDictionary(cards[index]),
  });
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

          <div className={`cards-container ${portrait ? 'fan-hand' : ''} ${fan.dragging ? 'is-hand-dragging' : ''}`} {...fan.handlers}>
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
                  managedPointer={portrait}
                  inspected={portrait && fan.inspected === index}
                  onInspect={() => fan.inspect(index)}
                  handIndex={index}
                  style={{ '--fan-offset': index - (cards.length - 1) / 2, '--fan-count': cards.length, '--fan-index': index } as React.CSSProperties}
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
