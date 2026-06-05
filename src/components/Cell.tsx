import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import type { CSSProperties } from 'react';
import type { PlacedCard } from '../game';
import './Cell.css';

interface CellProps {
  placedCard?: PlacedCard;
  onCellClick?: () => void;
  isHighlighted?: boolean;
  isPlayable?: boolean;
  isLastPlaced?: boolean;
  showTooltip?: boolean;
}

const getFontSize = (cardName: string) => {
  if (cardName.length <= 5) return 10;
  if (cardName.length <= 10) return 9;
  return 8;
};

const getOwnerLabel = (playerId: PlacedCard['playerId']) => {
  if (playerId === 0) return 'Игрок 1';
  if (playerId === 1) return 'Игрок 2';
  return 'Нейтральная карта';
};

const getOwnerClassName = (playerId: PlacedCard['playerId']) => {
  if (playerId === 0) return 'player-0';
  if (playerId === 1) return 'player-1';
  return 'player-neutral';
};

interface TooltipPosition {
  left: number;
  top: number;
}

const getTooltipPosition = (
  event: React.MouseEvent<HTMLDivElement>
): TooltipPosition => {
  const tooltipWidth = Math.min(240, window.innerWidth - 24);
  const tooltipHeight = Math.min(170, window.innerHeight - 24);
  const offset = 18;
  const left = Math.min(
    window.innerWidth - tooltipWidth - 12,
    Math.max(12, event.clientX + offset)
  );
  const top = Math.min(
    window.innerHeight - tooltipHeight - 12,
    Math.max(12, event.clientY + offset)
  );

  return { left, top };
};

export const Cell: React.FC<CellProps> = ({
  placedCard,
  onCellClick,
  isHighlighted,
  isPlayable,
  isLastPlaced,
  showTooltip = true,
}) => {
  const [tooltipPosition, setTooltipPosition] = useState<TooltipPosition | null>(null);
  const tooltipStyle = tooltipPosition
    ? ({
        left: `${tooltipPosition.left}px`,
        top: `${tooltipPosition.top}px`,
      } satisfies CSSProperties)
    : undefined;

  return (
    <div
      className={`cell ${isHighlighted ? 'highlighted' : ''} ${
        isPlayable ? 'playable' : ''
      } ${
        isLastPlaced ? 'last-placed' : ''
      } ${placedCard?.playerId === null ? 'neutral' : ''} ${
        placedCard?.status === 'pending' ? 'pending' : ''
      } ${
        placedCard ? 'occupied' : 'empty'
      }`}
      onClick={onCellClick}
    >
      {placedCard && (
        <div
          className={`card-in-cell ${
            placedCard.playerId === null ? 'player-neutral' : `player-${placedCard.playerId}`
          } ${placedCard.status === 'pending' ? 'pending' : ''}`}
          onMouseEnter={(event) =>
            showTooltip ? setTooltipPosition(getTooltipPosition(event)) : undefined
          }
          onMouseMove={(event) =>
            showTooltip ? setTooltipPosition(getTooltipPosition(event)) : undefined
          }
          onMouseLeave={() => setTooltipPosition(null)}
          style={{ fontSize: `${getFontSize(placedCard.cardName)}px` }}
        >
          <span className="card-title" lang="ru">
            {placedCard.cardName}
          </span>
          {showTooltip &&
            tooltipPosition &&
            createPortal(
              <div
                className={`card-tooltip ${getOwnerClassName(placedCard.playerId)}`}
                style={tooltipStyle}
              >
                <strong>{placedCard.cardName}</strong>
                <span>Владелец: {getOwnerLabel(placedCard.playerId)}</span>
              </div>,
              document.body
            )}
        </div>
      )}
    </div>
  );
};
