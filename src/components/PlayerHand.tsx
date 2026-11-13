import React, { useLayoutEffect, useRef, useState } from 'react';
import type { RegularCardName } from '../game';
import { incrementCounter } from '../debug/performanceDiagnostics';
import { Card } from './Card';
import { usePortraitHand } from '../hooks/usePortraitHand';
import { useFanHand } from '../hooks/useFanHand';
import { useWordHandLayout } from '../hooks/useWordHandLayout';
import { useWordReorderAnimation } from '../hooks/useWordReorderAnimation';
import { WordReorderPreview } from './WordReorderPreview';
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
  const wordHandRef = useWordHandLayout(portrait, cards);
  const occurrences = new Map<string, number>();
  const entries = cards.map((name, index) => {
    const occurrence = occurrences.get(name) ?? 0;
    occurrences.set(name, occurrence + 1);
    return { name, index, key: `${name}:${occurrence}` };
  });
  const [visualOrders, setVisualOrders] = useState<Record<number, string[]>>({});
  const byKey = new Map(entries.map(entry => [entry.key, entry]));
  const savedKeys = visualOrders[playerNumber] ?? [];
  const validSavedKeys = savedKeys.filter(key => byKey.has(key));
  const savedSet = new Set(validSavedKeys);
  const orderedKeys = [...validSavedKeys, ...entries.filter(entry => !savedSet.has(entry.key)).map(entry => entry.key)];
  const orderedEntries = orderedKeys.map(key => byKey.get(key)!);
  const orderRef = useRef<string[]>([]);
  const snapshotRef = useRef<string[] | null>(null);
  useLayoutEffect(() => { orderRef.current = orderedKeys; });
  const capturePositions = useWordReorderAnimation(wordHandRef, JSON.stringify([playerNumber, orderedKeys]));
  const storeOrder = (keys: string[]) => {
    if (keys.length === orderRef.current.length && keys.every((key, index) => key === orderRef.current[index])) return;
    capturePositions();
    orderRef.current = keys;
    setVisualOrders(previous => ({ ...previous, [playerNumber]: keys }));
  };
  const [scatterSeed] = useState(() => Math.floor(Math.random() * 0x7fffffff));
  const wordPosition = (name: string): React.CSSProperties => {
    // Stable randomness prevents the hand from moving while a pointer selects a word.
    let hash = scatterSeed;
    for (const character of name) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
    hash >>>= 0;
    return {
      '--word-tilt': `${(hash % 801) / 100 - 4}deg`,
      '--word-x': .12 + ((hash >>> 20) % 761) / 1000,
    } as React.CSSProperties;
  };
  const fan = useFanHand({ enabled: portrait, active: isActive, cards, preferred: suggestedCard,
    onStart: (index, event) => onStartCardDrag(cards[index], playerColor, event),
    onEnd: onCancelCardDrag, onInfo: index => onOpenDictionary(cards[index]),
    onReorderStart: () => { snapshotRef.current = [...orderRef.current]; },
    onReorder: (fromIndex, toIndex) => {
      const keys = [...orderRef.current];
      const from = keys.indexOf(entries[fromIndex]?.key);
      const to = keys.indexOf(entries[toIndex]?.key);
      if (from < 0 || to < 0 || from === to) return;
      const [moving] = keys.splice(from, 1);
      keys.splice(to, 0, moving);
      storeOrder(keys);
    },
    onReorderEnd: commit => {
      const original = snapshotRef.current;
      snapshotRef.current = null;
      if (!commit && original) storeOrder(original);
    },
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
          <div ref={wordHandRef} className={`cards-container ${portrait ? 'fan-hand word-hand' : ''} ${fan.dragging ? 'is-hand-dragging' : ''} ${fan.reordering ? 'is-hand-arranging' : ''}`} style={fan.reordering ? { minHeight: fan.reordering.areaHeight } : undefined} {...fan.handlers}>
            {/* FIXME(MVP): Рука оппонента скрыта только в UI, но технически остаётся доступна в gameState. */}
            {hideCards
              ? cards.map((_, index) => (
                  <div
                    aria-label="Скрытая карта оппонента"
                    className={`hidden-hand-card player-${playerNumber}`}
                    key={`hidden-${playerNumber}-${index}`}
                  />
                ))
              : (portrait ? orderedEntries : entries).map(({ name: card, index, key }) => {
                const content = <Card
                  managedPointer={portrait}
                  wordLayout={portrait}
                  inspected={portrait && fan.inspected === index}
                  onInspect={() => fan.inspect(index)}
                  handIndex={index}
                  style={{ '--fan-offset': index - (cards.length - 1) / 2, '--fan-count': cards.length, '--fan-index': index } as React.CSSProperties}
                  key={key}
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
                  />;
                return portrait
                  ? <div className={`word-hand-slot ${fan.reordering?.index === index ? 'is-reorder-source' : ''}`} key={key} data-word-key={key} style={wordPosition(key)}>{content}</div>
                  : content;
              })}
          </div>
          {portrait && fan.reordering && <WordReorderPreview position={fan.reordering} playerColor={playerColor} />}
        </div>

        <div className="player-plate">
          <h3>{playerLabel}</h3>
          <span className="card-count">{playerStatusLabel}</span>
        </div>
      </div>
    </div>
  );
};
