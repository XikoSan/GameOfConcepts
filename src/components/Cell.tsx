import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { CSSProperties } from 'react';
import {
  endMeasure,
  incrementCounter,
  startMeasure,
} from '../debug/performanceDiagnostics';
import type { CardRelationLabel } from '../scoring/semanticRelations';
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
import {
  calculateBoardOverlayPosition,
  type OverlayRect,
  toOverlayRect,
} from './boardOverlayPositioning';
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
  pendingMoveStatusLabel?: string;
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
  semanticRelationLabels?: CardRelationLabel[];
  isRelationHighlighted?: boolean;
  boardRect?: OverlayRect | null;
  occupiedOverlayRects?: OverlayRect[];
  onCardInfoRectChange?: (rect: OverlayRect | null) => void;
  onRelationEnter?: (cardInstanceId: string) => void;
  onRelationLeave?: () => void;
}

const getFontSize = (cardName: string) => {
  if (cardName.length <= 5) return 10;
  if (cardName.length <= 10) return 9;
  return 8;
};

const getOwnerLabel = (playerId: PlacedCard['playerId']) => {
  if (playerId !== null) return `Игрок ${playerId + 1}`;
  return 'Нейтральная карта';
};

const getOwnerClassName = (playerId: PlacedCard['playerId']) => {
  if (playerId !== null) return `player-${playerId}`;
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
  isExpanded = false,
  boardRect?: OverlayRect | null,
  occupiedOverlayRects: OverlayRect[] = [],
  measuredSize?: { width: number; height: number }
): PopoverPosition => {
  const measureStart = startMeasure();
  incrementCounter('dom:getBoundingClientRect:card-info-anchor');
  const rect = element.getBoundingClientRect();
  const popoverWidth =
    measuredSize?.width ?? (mode === 'pinned' ? (isExpanded ? 640 : 340) : 300);
  const popoverHeight =
    measuredSize?.height ?? (mode === 'pinned' ? (isExpanded ? 620 : 460) : 210);
  const width = Math.min(popoverWidth, window.innerWidth - 24);
  const height = Math.min(popoverHeight, window.innerHeight - 24);
  const viewportRect =
    boardRect ??
    toOverlayRect(new DOMRect(0, 0, window.innerWidth, window.innerHeight));
  const overlayRect = calculateBoardOverlayPosition({
    anchorRect: toOverlayRect(rect),
    overlaySize: { width, height },
    boardRect: viewportRect,
    occupiedRects: occupiedOverlayRects,
    preferredPlacements: [
      'right',
      'left',
      'bottom',
      'top',
      'right-shifted',
      'left-shifted',
    ],
    safePadding: 8,
  });
  endMeasure('overlay:position:card-info', measureStart);

  return { left: overlayRect.left, top: overlayRect.top, cardKey };
};

const arePopoverPositionsEqual = (
  firstPosition: PopoverPosition | null,
  secondPosition: PopoverPosition | null
) => {
  if (!firstPosition || !secondPosition) return firstPosition === secondPosition;

  return (
    firstPosition.cardKey === secondPosition.cardKey &&
    Math.abs(firstPosition.left - secondPosition.left) < 0.5 &&
    Math.abs(firstPosition.top - secondPosition.top) < 0.5
  );
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
  pendingMoveStatusLabel,
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
  semanticRelationLabels = [],
  isRelationHighlighted = false,
  boardRect,
  occupiedOverlayRects = [],
  onCardInfoRectChange,
  onRelationEnter,
  onRelationLeave,
}) => {
  incrementCounter('render:Cell');
  const [popoverMode, setPopoverMode] = useState<PopoverStateMode>('hidden');
  const [popoverPosition, setPopoverPosition] = useState<PopoverPosition | null>(null);
  const [popoverSummary, setPopoverSummary] =
    useState<PopoverSummaryState | null>(null);
  const [isPopoverExpanded, setIsPopoverExpanded] = useState(false);
  const [isPopoverPlacementReady, setIsPopoverPlacementReady] = useState(false);
  const [pendingOverlayPosition, setPendingOverlayPosition] =
    useState<PendingOverlayPosition | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const popoverOpenTimeoutRef = useRef<number | null>(null);
  const popoverCloseTimeoutRef = useRef<number | null>(null);
  const popoverRequestIdRef = useRef(0);
  const popoverMeasuredSizeRef = useRef<{ width: number; height: number } | null>(null);
  const onCardInfoRectChangeRef = useRef(onCardInfoRectChange);
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

  useEffect(() => {
    onCardInfoRectChangeRef.current = onCardInfoRectChange;
  }, [onCardInfoRectChange]);

  const setNextPopoverPosition = useCallback((nextPosition: PopoverPosition | null) => {
    setPopoverPosition((currentPosition) =>
      arePopoverPositionsEqual(currentPosition, nextPosition)
        ? currentPosition
        : nextPosition
    );
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
    setIsPopoverPlacementReady(false);
    popoverMeasuredSizeRef.current = null;
    onCardInfoRectChangeRef.current?.(null);
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
    setIsPopoverPlacementReady(false);
    loadSummary(nextCardKey, nextCardName, nextRequestId);

    popoverOpenTimeoutRef.current = window.setTimeout(() => {
      if (!cardRef.current || popoverRequestIdRef.current !== nextRequestId) return;

      setNextPopoverPosition(
        getPopoverPosition(
          cardRef.current,
          nextCardKey,
          'tooltip',
          false,
          boardRect,
          occupiedOverlayRects
        )
      );
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
          setNextPopoverPosition(null);
          setIsPopoverExpanded(false);
          setIsPopoverPlacementReady(false);
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

  const openPinnedPopover = (event: React.MouseEvent<HTMLDivElement>) => {
    event.stopPropagation();

    clearPopoverTimers();

    if (!showTooltip || !tooltipCardKey || !placedCard || !cardRef.current) return;

    const nextRequestId = popoverRequestIdRef.current + 1;
    popoverRequestIdRef.current = nextRequestId;
    setIsPopoverExpanded(false);
    setIsPopoverPlacementReady(false);
    loadSummary(tooltipCardKey, placedCard.cardName, nextRequestId);
    setNextPopoverPosition(
      getPopoverPosition(
        cardRef.current,
        tooltipCardKey,
        'pinned',
        false,
        boardRect,
        occupiedOverlayRects
      )
    );
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
  };

  const handleCardPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.stopPropagation();
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
    setNextPopoverPosition(
      getPopoverPosition(
        cardRef.current,
        tooltipCardKey,
        'pinned',
        false,
        boardRect,
        occupiedOverlayRects,
        popoverMeasuredSizeRef.current ?? undefined
      )
    );
    setPopoverMode('pinning');
    setIsPopoverExpanded(false);
    setIsPopoverPlacementReady(false);

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

      incrementCounter('dom:getBoundingClientRect:pending-card-overlay-anchor');
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

  const handleConfirmPendingMove = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    closePopover();
    onConfirmPendingMove?.();
  };

  const handleReturnPendingMove = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    closePopover();
    onReturnPendingMove?.();
  };

  const handleApprovePendingCross = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    closePopover();
    onApprovePendingCross?.();
  };

  const handleRejectPendingCross = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    closePopover();
    onRejectPendingCross?.();
  };

  const handleTogglePopoverExpanded = () => {
    setIsPopoverExpanded((current) => {
      const nextExpanded = !current;
      if (cardRef.current && tooltipCardKey) {
        setNextPopoverPosition(
          getPopoverPosition(
            cardRef.current,
            tooltipCardKey,
            'pinned',
            nextExpanded,
            boardRect,
            occupiedOverlayRects,
            popoverMeasuredSizeRef.current ?? undefined
          )
        );
      }
      return nextExpanded;
    });
  };

  const handleCardInfoMeasured = (rect: DOMRect) => {
    const wasPlacementReady = isPopoverPlacementReady;
    const measuredSize = { width: rect.width, height: rect.height };
    popoverMeasuredSizeRef.current = measuredSize;
    incrementCounter('overlay:initial-measure');
    incrementCounter('overlay:card-info-initial-measure');
    onCardInfoRectChangeRef.current?.(toOverlayRect(rect));

    if (!cardRef.current || !tooltipCardKey || !activePopoverMode) return;

    setNextPopoverPosition(
      getPopoverPosition(
        cardRef.current,
        tooltipCardKey,
        activePopoverMode,
        isPopoverExpanded,
        boardRect,
        occupiedOverlayRects,
        measuredSize
      )
    );
    if (!wasPlacementReady) {
      incrementCounter('overlay:place-new');
      incrementCounter('overlay:reveal');
      setIsPopoverPlacementReady(true);
    }
  };

  useEffect(() => {
    if (!shouldShowTooltip || !cardRef.current || !tooltipCardKey || !activePopoverMode) {
      return;
    }

    const animationFrameId = window.requestAnimationFrame(() => {
      incrementCounter('raf:card-info-reposition');
      if (!cardRef.current) return;

      setNextPopoverPosition(
        getPopoverPosition(
          cardRef.current,
          tooltipCardKey,
          activePopoverMode,
          isPopoverExpanded,
          boardRect,
          occupiedOverlayRects,
          popoverMeasuredSizeRef.current ?? undefined
        )
      );
    });

    return () => window.cancelAnimationFrame(animationFrameId);
  }, [
    activePopoverMode,
    boardRect,
    isPopoverExpanded,
    occupiedOverlayRects,
    pendingOverlayRefreshKey,
    setNextPopoverPosition,
    shouldShowTooltip,
    tooltipCardKey,
  ]);

  useEffect(() => {
    const handleOtherPopover = (event: Event) => {
      if (!(event instanceof CustomEvent)) return;
      if (event.detail?.cardKey !== popoverStateRef.current.cardKey) closePopover();
    };

    const handleGlobalClose = () => closePopover();
    const handlePinnedClose = () => {
      if (
        popoverStateRef.current.mode === 'pinning' ||
        popoverStateRef.current.mode === 'pinned'
      ) {
        closePopover();
      }
    };

    window.addEventListener('card-info-popover-open', handleOtherPopover);
    window.addEventListener('card-info-popover-pinned', handleOtherPopover);
    window.addEventListener('card-info-close', handleGlobalClose);
    window.addEventListener('card-info-close-pinned', handlePinnedClose);

    return () => {
      window.removeEventListener('card-info-popover-open', handleOtherPopover);
      window.removeEventListener('card-info-popover-pinned', handleOtherPopover);
      window.removeEventListener('card-info-close', handleGlobalClose);
      window.removeEventListener('card-info-close-pinned', handlePinnedClose);
    };
  }, [closePopover]);

  useEffect(
    () => () => {
      clearPopoverTimers();
      popoverRequestIdRef.current += 1;
      onCardInfoRectChangeRef.current?.(null);
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
        isRelationHighlighted ? 'relation-highlighted' : ''
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
          onPointerDown={handleCardPointerDown}
          onClick={openPinnedPopover}
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
                isPlacementReady={isPopoverPlacementReady}
                mode={activePopoverMode}
                onClose={closePopover}
                onMeasuredRect={handleCardInfoMeasured}
                onPointerEnter={handlePopoverPointerEnter}
                onRelationEnter={onRelationEnter}
                onRelationLeave={onRelationLeave}
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
                semanticRelations={semanticRelationLabels}
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
                  <span className="pending-card-badge">
                    {pendingMoveStatusLabel ?? 'ожидает'}
                  </span>
                )}
              </div>,
              document.body
            )}
        </div>
      )}
    </div>
  );
};
