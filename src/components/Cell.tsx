import React, { useLayoutEffect, useRef, useState } from 'react';
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
  showPendingActions?: boolean;
  showPendingWaitBadge?: boolean;
  onConfirmPendingMove?: () => void;
  onReturnPendingMove?: () => void;
  pendingOverlayRefreshKey?: string;
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

interface PendingOverlayPosition {
  left: number;
  top: number;
  placeActionsOnLeft: boolean;
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
  showPendingActions = false,
  showPendingWaitBadge = false,
  onConfirmPendingMove,
  onReturnPendingMove,
  pendingOverlayRefreshKey,
}) => {
  const [tooltipPosition, setTooltipPosition] = useState<TooltipPosition | null>(null);
  const [pendingOverlayPosition, setPendingOverlayPosition] =
    useState<PendingOverlayPosition | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const shouldShowPendingOverlay =
    placedCard?.status === 'pending' && (showPendingActions || showPendingWaitBadge);
  const tooltipStyle = tooltipPosition
    ? ({
        left: `${tooltipPosition.left}px`,
        top: `${tooltipPosition.top}px`,
      } satisfies CSSProperties)
    : undefined;
  const pendingOverlayStyle = pendingOverlayPosition
    ? ({
        left: `${pendingOverlayPosition.left}px`,
        top: `${pendingOverlayPosition.top}px`,
      } satisfies CSSProperties)
    : undefined;

  useLayoutEffect(() => {
    if (!shouldShowPendingOverlay || !cardRef.current) {
      setPendingOverlayPosition(null);
      return;
    }

    const updatePendingOverlayPosition = () => {
      const rect = cardRef.current?.getBoundingClientRect();
      if (!rect) return;

      const overlayWidth = showPendingActions ? 30 : 70;
      const overlayHeight = showPendingActions ? 62 : 24;
      const gap = 6;
      const pagePadding = 8;
      const hasRoomOnRight = rect.right + gap + overlayWidth <= window.innerWidth - pagePadding;
      const preferredLeft = hasRoomOnRight
        ? rect.right + gap
        : rect.left - overlayWidth - gap;

      const nextPosition = {
        left: Math.min(
          window.innerWidth - overlayWidth - pagePadding,
          Math.max(pagePadding, preferredLeft)
        ),
        top: Math.min(
          window.innerHeight - overlayHeight - pagePadding,
          Math.max(pagePadding, rect.top)
        ),
        placeActionsOnLeft: !hasRoomOnRight,
      };

      setPendingOverlayPosition((currentPosition) => {
        if (
          currentPosition &&
          currentPosition.left === nextPosition.left &&
          currentPosition.top === nextPosition.top &&
          currentPosition.placeActionsOnLeft === nextPosition.placeActionsOnLeft
        ) {
          return currentPosition;
        }

        return nextPosition;
      });
    };

    updatePendingOverlayPosition();
    window.addEventListener('resize', updatePendingOverlayPosition);

    return () => {
      window.removeEventListener('resize', updatePendingOverlayPosition);
    };
  }, [pendingOverlayRefreshKey, shouldShowPendingOverlay, showPendingActions]);

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
          ref={cardRef}
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
          {shouldShowPendingOverlay &&
            pendingOverlayPosition &&
            createPortal(
              <div
                className={`pending-card-overlay ${
                  pendingOverlayPosition.placeActionsOnLeft ? 'on-left' : 'on-right'
                }`}
                style={pendingOverlayStyle}
                onClick={(event) => event.stopPropagation()}
                onPointerDown={(event) => event.stopPropagation()}
              >
                {showPendingActions ? (
                  <div className="pending-card-actions" aria-label="Решение по карте">
                    <button
                      className="pending-card-action confirm"
                      type="button"
                      title="Подтвердить связь"
                      onClick={onConfirmPendingMove}
                    >
                      ✓
                    </button>
                    <button
                      className="pending-card-action return"
                      type="button"
                      title="Вернуть карту"
                      onClick={onReturnPendingMove}
                    >
                      ↩
                    </button>
                  </div>
                ) : (
                  <span className="pending-card-badge">ожидает</span>
                )}
              </div>,
              document.body
            )}
        </div>
      )}
    </div>
  );
};
