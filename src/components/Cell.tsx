import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { CSSProperties } from 'react';
import type { PlacedCard } from '../game';
import {
  getConceptSummary,
  type ConceptSummary,
} from '../services/conceptDescriptionService';
import { getWiktionarySearchUrl } from '../services/dictionaryService';
import {
  CardInfoPopover,
  type CardInfoPopoverMode,
  type CardInfoStatus,
} from './CardInfoPopover';
import './Cell.css';

type PopoverStateMode = 'hidden' | 'tooltip' | 'pinning' | 'pinned';

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

interface PopoverPosition {
  left: number;
  top: number;
  cardKey: string;
}

interface PopoverSummaryState {
  cardKey: string;
  status: CardInfoStatus;
  summary: ConceptSummary | null;
}

interface PendingOverlayPosition {
  left: number;
  top: number;
  placeActionsOnLeft: boolean;
}

const getPopoverPosition = (
  element: HTMLElement,
  cardKey: string,
  mode: CardInfoPopoverMode,
  isExpanded = false
): PopoverPosition => {
  const rect = element.getBoundingClientRect();
  const popoverWidth =
    mode === 'pinned' ? (isExpanded ? 640 : 340) : 300;
  const popoverHeight =
    mode === 'pinned' ? (isExpanded ? 620 : 460) : 210;
  const width = Math.min(popoverWidth, window.innerWidth - 24);
  const height = Math.min(popoverHeight, window.innerHeight - 24);
  const offset = 12;
  const hasRoomOnRight = rect.right + offset + width <= window.innerWidth - 12;
  const preferredLeft = hasRoomOnRight
    ? rect.right + offset
    : rect.left - width - offset;
  const left = Math.min(window.innerWidth - width - 12, Math.max(12, preferredLeft));
  const top = Math.min(
    window.innerHeight - height - 12,
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
}) => {
  const [popoverMode, setPopoverMode] = useState<PopoverStateMode>('hidden');
  const [popoverPosition, setPopoverPosition] = useState<PopoverPosition | null>(null);
  const [popoverSummary, setPopoverSummary] =
    useState<PopoverSummaryState | null>(null);
  const [isPopoverExpanded, setIsPopoverExpanded] = useState(false);
  const [pendingOverlayPosition, setPendingOverlayPosition] =
    useState<PendingOverlayPosition | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const popoverOpenTimeoutRef = useRef<number | null>(null);
  const popoverCloseTimeoutRef = useRef<number | null>(null);
  const popoverRequestIdRef = useRef(0);
  const popoverStateRef = useRef<{
    mode: PopoverStateMode;
    cardKey: string | null;
  }>({
    mode: 'hidden',
    cardKey: null,
  });
  const shouldShowPendingMoveOverlay =
    placedCard?.status === 'pending' && (showPendingActions || showPendingWaitBadge);
  const shouldShowPendingCrossOverlay = Boolean(placedCard) && isCrossPendingCenter;
  const shouldShowPendingOverlay =
    shouldShowPendingMoveOverlay || shouldShowPendingCrossOverlay;
  const tooltipCardKey = placedCard
    ? `${placedCard.id}:${placedCard.status}:${placedCard.crossId ?? 'none'}:${placedCard.cardName}:${placedCard.playerId}:${tooltipScopeKey}`
    : null;
  const activePopoverMode =
    popoverMode === 'hidden' ? null : popoverMode === 'pinning' ? 'pinned' : popoverMode;
  const shouldShowTooltip =
    showTooltip &&
    activePopoverMode &&
    popoverPosition &&
    popoverPosition.cardKey === tooltipCardKey &&
    placedCard;
  const pendingOverlayStyle = pendingOverlayPosition
    ? ({
        left: `${pendingOverlayPosition.left}px`,
        top: `${pendingOverlayPosition.top}px`,
      } satisfies CSSProperties)
    : undefined;

  const clearPopoverTimers = useCallback(() => {
    if (popoverOpenTimeoutRef.current !== null) {
      window.clearTimeout(popoverOpenTimeoutRef.current);
      popoverOpenTimeoutRef.current = null;
    }

    if (popoverCloseTimeoutRef.current !== null) {
      window.clearTimeout(popoverCloseTimeoutRef.current);
      popoverCloseTimeoutRef.current = null;
    }
  }, []);

  const closePopover = useCallback(() => {
    clearPopoverTimers();
    popoverRequestIdRef.current += 1;
    popoverStateRef.current = {
      mode: 'hidden',
      cardKey: null,
    };
    setPopoverMode('hidden');
    setPopoverPosition(null);
    setIsPopoverExpanded(false);
  }, [clearPopoverTimers]);

  const loadSummary = (cardKey: string, cardName: string, requestId: number) => {
    setPopoverSummary({
      cardKey,
      status: 'loading',
      summary: null,
    });

    void getConceptSummary(cardName)
      .then((summary) => {
        if (popoverRequestIdRef.current !== requestId) return;

        setPopoverSummary({
          cardKey,
          status: summary ? 'ready' : 'empty',
          summary,
        });
      })
      .catch(() => {
        if (popoverRequestIdRef.current !== requestId) return;

        setPopoverSummary({
          cardKey,
          status: 'error',
          summary: null,
        });
      });
  };

  const schedulePopoverOpen = () => {
    clearPopoverTimers();

    if (!showTooltip || !tooltipCardKey || !placedCard || !cardRef.current) return;

    const nextCardKey = tooltipCardKey;
    const nextCardName = placedCard.cardName;
    const nextRequestId = popoverRequestIdRef.current + 1;
    popoverRequestIdRef.current = nextRequestId;
    setIsPopoverExpanded(false);
    loadSummary(nextCardKey, nextCardName, nextRequestId);

    popoverOpenTimeoutRef.current = window.setTimeout(() => {
      if (!cardRef.current || popoverRequestIdRef.current !== nextRequestId) return;

      setPopoverPosition(getPopoverPosition(cardRef.current, nextCardKey, 'tooltip'));
      popoverStateRef.current = {
        mode: 'tooltip',
        cardKey: nextCardKey,
      };
      setPopoverMode('tooltip');
      popoverOpenTimeoutRef.current = null;
      window.dispatchEvent(
        new CustomEvent('card-info-popover-open', {
          detail: { cardKey: nextCardKey },
        })
      );
    }, 250);
  };

  const schedulePopoverClose = () => {
    if (popoverOpenTimeoutRef.current !== null) {
      window.clearTimeout(popoverOpenTimeoutRef.current);
      popoverOpenTimeoutRef.current = null;
    }

    setPopoverMode((currentMode) => {
      if (currentMode === 'pinning' || currentMode === 'pinned') return currentMode;

      if (popoverCloseTimeoutRef.current !== null) {
        window.clearTimeout(popoverCloseTimeoutRef.current);
      }

      popoverCloseTimeoutRef.current = window.setTimeout(() => {
        popoverCloseTimeoutRef.current = null;

        if (
          popoverStateRef.current.mode !== 'pinning' &&
          popoverStateRef.current.mode !== 'pinned'
        ) {
          popoverRequestIdRef.current += 1;
          popoverStateRef.current = {
            mode: 'hidden',
            cardKey: null,
          };
          setPopoverPosition(null);
          setIsPopoverExpanded(false);
          setPopoverMode('hidden');
        }
      }, 140);

      return currentMode;
    });
  };

  const handleCardPointerEnter = () => {
    if (
      (popoverStateRef.current.mode === 'pinning' ||
        popoverStateRef.current.mode === 'pinned') &&
      popoverStateRef.current.cardKey === tooltipCardKey
    ) {
      return;
    }

    schedulePopoverOpen();
  };

  const handleCardPointerLeave = () => {
    schedulePopoverClose();
  };

  const handlePopoverPointerEnter = () => {
    clearPopoverTimers();

    if (
      popoverStateRef.current.mode !== 'tooltip' ||
      !cardRef.current ||
      !tooltipCardKey
    ) {
      return;
    }

    popoverStateRef.current = {
      mode: 'pinning',
      cardKey: tooltipCardKey,
    };
    setPopoverPosition(getPopoverPosition(cardRef.current, tooltipCardKey, 'pinned'));
    setPopoverMode('pinning');
    setIsPopoverExpanded(false);

    window.requestAnimationFrame(() => {
      if (popoverStateRef.current.cardKey !== tooltipCardKey) return;

      popoverStateRef.current = {
        mode: 'pinned',
        cardKey: tooltipCardKey,
      };
      setPopoverMode('pinned');
      window.dispatchEvent(
        new CustomEvent('card-info-popover-pinned', {
          detail: { cardKey: tooltipCardKey },
        })
      );
    });
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
    closePopover();
    onConfirmPendingMove?.();
  };

  const handleReturnPendingMove = () => {
    closePopover();
    onReturnPendingMove?.();
  };

  const handleApprovePendingCross = () => {
    closePopover();
    onApprovePendingCross?.();
  };

  const handleRejectPendingCross = () => {
    closePopover();
    onRejectPendingCross?.();
  };

  const handleTogglePopoverExpanded = () => {
    setIsPopoverExpanded((current) => {
      const nextExpanded = !current;
      if (cardRef.current && tooltipCardKey) {
        setPopoverPosition(
          getPopoverPosition(cardRef.current, tooltipCardKey, 'pinned', nextExpanded)
        );
      }
      return nextExpanded;
    });
  };

  useEffect(() => {
    const handleOtherPopover = (event: Event) => {
      if (!(event instanceof CustomEvent)) return;
      if (event.detail?.cardKey !== popoverStateRef.current.cardKey) closePopover();
    };

    const handleGlobalClose = () => closePopover();

    window.addEventListener('card-info-popover-open', handleOtherPopover);
    window.addEventListener('card-info-popover-pinned', handleOtherPopover);
    window.addEventListener('card-info-close', handleGlobalClose);

    return () => {
      window.removeEventListener('card-info-popover-open', handleOtherPopover);
      window.removeEventListener('card-info-popover-pinned', handleOtherPopover);
      window.removeEventListener('card-info-close', handleGlobalClose);
    };
  }, [closePopover]);

  useEffect(
    () => () => {
      clearPopoverTimers();
      popoverRequestIdRef.current += 1;
    },
    [clearPopoverTimers]
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
          onPointerEnter={handleCardPointerEnter}
          onPointerLeave={handleCardPointerLeave}
          style={{ fontSize: `${getFontSize(placedCard.cardName)}px` }}
        >
          <span className="card-title" lang="ru">
            {placedCard.cardName}
          </span>
          {shouldShowTooltip &&
            activePopoverMode &&
            popoverPosition &&
            createPortal(
              <CardInfoPopover
                cardName={placedCard.cardName}
                className={getOwnerClassName(placedCard.playerId)}
                isExpanded={isPopoverExpanded}
                mode={activePopoverMode}
                onClose={closePopover}
                onPointerEnter={handlePopoverPointerEnter}
                onToggleExpanded={handleTogglePopoverExpanded}
                ownerLabel={getOwnerLabel(placedCard.playerId)}
                position={popoverPosition}
                status={
                  popoverSummary?.cardKey === tooltipCardKey
                    ? popoverSummary.status
                    : 'loading'
                }
                summary={
                  popoverSummary?.cardKey === tooltipCardKey
                    ? popoverSummary.summary
                    : null
                }
                wiktionaryUrl={getWiktionarySearchUrl(placedCard.cardName)}
              />,
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
