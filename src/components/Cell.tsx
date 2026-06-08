import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { CSSProperties } from 'react';
import type { PlacedCard } from '../game';
import { getShortConceptDescription } from '../services/conceptDescriptionService';
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
  isCrossPending?: boolean;
  isCrossPendingCenter?: boolean;
  showPendingCrossActions?: boolean;
  pendingCrossReviewerLabel?: string;
  onApprovePendingCross?: () => void;
  onRejectPendingCross?: () => void;
  tooltipScopeKey?: string;
  onOpenDictionary?: (term: string) => void;
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
  cardKey: string;
}

interface TooltipDescriptionState {
  cardKey: string;
  status: 'loading' | 'ready' | 'empty';
  text: string | null;
}

interface PendingOverlayPosition {
  left: number;
  top: number;
  placeActionsOnLeft: boolean;
}

interface CardPointerStart {
  x: number;
  y: number;
}

interface LastCardClick {
  cardId: string;
  time: number;
  x: number;
  y: number;
}

const getTooltipPosition = (element: HTMLElement, cardKey: string): TooltipPosition => {
  const rect = element.getBoundingClientRect();
  const tooltipWidth = Math.min(240, window.innerWidth - 24);
  const tooltipHeight = Math.min(170, window.innerHeight - 24);
  const offset = 12;
  const left = Math.min(
    window.innerWidth - tooltipWidth - 12,
    Math.max(12, rect.right + offset)
  );
  const top = Math.min(
    window.innerHeight - tooltipHeight - 12,
    Math.max(12, rect.top)
  );

  return { left, top, cardKey };
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
  isCrossPending = false,
  isCrossPendingCenter = false,
  showPendingCrossActions = false,
  pendingCrossReviewerLabel,
  onApprovePendingCross,
  onRejectPendingCross,
  tooltipScopeKey = 'default',
  onOpenDictionary,
}) => {
  const [tooltipPosition, setTooltipPosition] = useState<TooltipPosition | null>(null);
  const [tooltipDescription, setTooltipDescription] =
    useState<TooltipDescriptionState | null>(null);
  const [pendingOverlayPosition, setPendingOverlayPosition] =
    useState<PendingOverlayPosition | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const tooltipCloseTimeoutRef = useRef<number | null>(null);
  const tooltipOpenTimeoutRef = useRef<number | null>(null);
  const tooltipRequestIdRef = useRef(0);
  const cardPointerStartRef = useRef<CardPointerStart | null>(null);
  const lastCardClickRef = useRef<LastCardClick | null>(null);
  const suppressNextCardClickRef = useRef(false);
  const shouldShowPendingMoveOverlay =
    placedCard?.status === 'pending' && (showPendingActions || showPendingWaitBadge);
  const shouldShowPendingCrossOverlay = Boolean(placedCard) && isCrossPendingCenter;
  const shouldShowPendingOverlay =
    shouldShowPendingMoveOverlay || shouldShowPendingCrossOverlay;
  const tooltipCardKey = placedCard
    ? `${placedCard.id}:${placedCard.status}:${placedCard.crossId ?? 'none'}:${placedCard.cardName}:${placedCard.playerId}:${tooltipScopeKey}`
    : null;
  const shouldShowTooltip =
    showTooltip && tooltipPosition && tooltipPosition.cardKey === tooltipCardKey;
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

  const clearTooltipCloseTimeout = () => {
    if (tooltipCloseTimeoutRef.current !== null) {
      window.clearTimeout(tooltipCloseTimeoutRef.current);
      tooltipCloseTimeoutRef.current = null;
    }
  };

  const clearTooltipOpenTimeout = () => {
    if (tooltipOpenTimeoutRef.current !== null) {
      window.clearTimeout(tooltipOpenTimeoutRef.current);
      tooltipOpenTimeoutRef.current = null;
    }
  };

  const closeTooltip = () => {
    clearTooltipOpenTimeout();
    clearTooltipCloseTimeout();
    tooltipRequestIdRef.current += 1;
    setTooltipPosition(null);
  };

  const scheduleTooltipClose = () => {
    clearTooltipOpenTimeout();
    clearTooltipCloseTimeout();
    tooltipRequestIdRef.current += 1;
    tooltipCloseTimeoutRef.current = window.setTimeout(() => {
      setTooltipPosition(null);
      tooltipCloseTimeoutRef.current = null;
    }, 140);
  };

  const scheduleTooltipOpen = () => {
    clearTooltipOpenTimeout();
    clearTooltipCloseTimeout();

    if (!showTooltip || !tooltipCardKey || !placedCard || !cardRef.current) return;

    const nextCardKey = tooltipCardKey;
    const nextCardName = placedCard.cardName;
    const nextRequestId = tooltipRequestIdRef.current + 1;
    tooltipRequestIdRef.current = nextRequestId;

    tooltipOpenTimeoutRef.current = window.setTimeout(() => {
      if (!cardRef.current) return;

      setTooltipPosition(getTooltipPosition(cardRef.current, nextCardKey));
      setTooltipDescription({
        cardKey: nextCardKey,
        status: 'loading',
        text: null,
      });

      void getShortConceptDescription(nextCardName)
        .then((description) => {
          if (tooltipRequestIdRef.current !== nextRequestId) return;

          setTooltipDescription({
            cardKey: nextCardKey,
            status: description ? 'ready' : 'empty',
            text: description,
          });
        })
        .catch(() => {
          if (tooltipRequestIdRef.current !== nextRequestId) return;

          setTooltipDescription({
            cardKey: nextCardKey,
            status: 'empty',
            text: null,
          });
        });
    }, 250);
  };

  useLayoutEffect(() => {
    if (!shouldShowPendingOverlay || !cardRef.current) {
      setPendingOverlayPosition(null);
      return;
    }

    const updatePendingOverlayPosition = () => {
      const rect = cardRef.current?.getBoundingClientRect();
      if (!rect) return;

      const overlayWidth = shouldShowPendingCrossOverlay
        ? 132
        : showPendingActions
          ? 30
          : 70;
      const overlayHeight = shouldShowPendingCrossOverlay
        ? showPendingCrossActions
          ? 92
          : 72
        : showPendingActions
          ? 62
          : 24;
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
  }, [
    pendingOverlayRefreshKey,
    shouldShowPendingCrossOverlay,
    shouldShowPendingOverlay,
    showPendingActions,
    showPendingCrossActions,
  ]);

  const handleConfirmPendingMove = () => {
    closeTooltip();
    onConfirmPendingMove?.();
  };

  const handleReturnPendingMove = () => {
    closeTooltip();
    onReturnPendingMove?.();
  };

  const handleApprovePendingCross = () => {
    closeTooltip();
    onApprovePendingCross?.();
  };

  const handleRejectPendingCross = () => {
    closeTooltip();
    onRejectPendingCross?.();
  };

  const handleOpenDictionary = () => {
    if (!placedCard) return;

    closeTooltip();
    onOpenDictionary?.(placedCard.cardName);
  };

  const handleCardPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;

    cardPointerStartRef.current = {
      x: event.clientX,
      y: event.clientY,
    };
  };

  const handleCardPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;

    const start = cardPointerStartRef.current;
    cardPointerStartRef.current = null;
    if (!placedCard || !start) return;

    const moveDistance = Math.hypot(event.clientX - start.x, event.clientY - start.y);
    if (moveDistance > 8) return;

    const now = Date.now();
    const lastClick = lastCardClickRef.current;
    const isDoubleClick =
      lastClick !== null &&
      lastClick.cardId === placedCard.id &&
      now - lastClick.time < 300 &&
      Math.hypot(event.clientX - lastClick.x, event.clientY - lastClick.y) <= 8;

    if (event.altKey || isDoubleClick) {
      event.preventDefault();
      event.stopPropagation();
      suppressNextCardClickRef.current = true;
      lastCardClickRef.current = null;
      handleOpenDictionary();
      return;
    }

    lastCardClickRef.current = {
      cardId: placedCard.id,
      time: now,
      x: event.clientX,
      y: event.clientY,
    };
  };

  const tooltipDescriptionText =
    tooltipDescription?.cardKey === tooltipCardKey
      ? tooltipDescription.status === 'loading'
        ? 'Загрузка описания...'
        : tooltipDescription.status === 'ready'
          ? tooltipDescription.text
          : 'Описание не найдено.'
      : 'Загрузка описания...';

  useEffect(
    () => () => {
      clearTooltipOpenTimeout();
      clearTooltipCloseTimeout();
      tooltipRequestIdRef.current += 1;
    },
    []
  );

  return (
    <div
      className={`cell ${isHighlighted ? 'highlighted' : ''} ${
        isPlayable ? 'playable' : ''
      } ${
        isLastPlaced ? 'last-placed' : ''
      } ${
        isCrossPending ? 'cross-pending-card' : ''
      } ${
        isCrossPendingCenter ? 'cross-pending-center' : ''
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
          } ${placedCard.status === 'pending' ? 'pending' : ''} ${
            isCrossPending ? 'cross-pending-card' : ''
          } ${isCrossPendingCenter ? 'cross-pending-center' : ''}`}
          onClick={(event) => {
            if (suppressNextCardClickRef.current) {
              event.preventDefault();
              event.stopPropagation();
              suppressNextCardClickRef.current = false;
            }
          }}
          onMouseEnter={scheduleTooltipOpen}
          onMouseLeave={scheduleTooltipClose}
          onPointerDown={handleCardPointerDown}
          onPointerUp={handleCardPointerUp}
          style={{ fontSize: `${getFontSize(placedCard.cardName)}px` }}
        >
          <span className="card-title" lang="ru">
            {placedCard.cardName}
          </span>
          {shouldShowTooltip &&
            createPortal(
              <div
                className={`card-tooltip ${getOwnerClassName(placedCard.playerId)}`}
                style={tooltipStyle}
              >
                <strong>{placedCard.cardName}</strong>
                <span>Владелец: {getOwnerLabel(placedCard.playerId)}</span>
                <p>{tooltipDescriptionText}</p>
                <span className="card-tooltip-hint">
                  Двойной клик или Alt+клик — справка
                </span>
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
                {shouldShowPendingCrossOverlay ? (
                  <div className="pending-cross-popover" aria-label="Решение по крестовине">
                    <strong>Крестовина</strong>
                    {showPendingCrossActions ? (
                      <>
                        <span>Одобрить бонус +5?</span>
                        <div className="pending-cross-actions">
                          <button
                            className="pending-cross-action confirm"
                            type="button"
                            title="Одобрить крестовину"
                            onClick={handleApprovePendingCross}
                          >
                            ✓
                          </button>
                          <button
                            className="pending-cross-action return"
                            type="button"
                            title="Не засчитать крестовину"
                            onClick={handleRejectPendingCross}
                          >
                            ↩
                          </button>
                        </div>
                      </>
                    ) : (
                      <span>
                        Ожидает решения {pendingCrossReviewerLabel ?? 'оппонента'}
                      </span>
                    )}
                  </div>
                ) : showPendingActions ? (
                  <div className="pending-card-actions" aria-label="Решение по карте">
                    <button
                      className="pending-card-action confirm"
                      type="button"
                      title="Подтвердить связь"
                      onClick={handleConfirmPendingMove}
                    >
                      ✓
                    </button>
                    <button
                      className="pending-card-action return"
                      type="button"
                      title="Вернуть карту"
                      onClick={handleReturnPendingMove}
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
