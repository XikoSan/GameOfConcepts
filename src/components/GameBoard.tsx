import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { canPlaceCard } from '../game';
import type { GameState, Coordinates, RegularCardName } from '../game';
import { Cell } from './Cell';
import './GameBoard.css';

interface GameBoardProps {
  gameState: GameState;
  selectedCard: RegularCardName | null;
  onPlaceCard: (cardName: RegularCardName, coordinates: Coordinates) => void;
  onFinishDrag: () => void;
  showPlayableHighlights: boolean;
  showTooltips: boolean;
  canReviewPendingMove: boolean;
  showPendingWaitBadge: boolean;
  pendingMoveStatusLabel?: string;
  onConfirmPendingMove: () => void;
  onReturnPendingMove: () => void;
  canReviewPendingCross: boolean;
  pendingCrossReviewerLabel: string;
  onApprovePendingCross: () => void;
  onRejectPendingCross: () => void;
}

interface CameraState {
  offsetX: number;
  offsetY: number;
  zoom: number;
}

interface ViewportSize {
  width: number;
  height: number;
}

const GRID_MIN = -40;
const GRID_MAX = 40;
const GRID_SIZE = GRID_MAX - GRID_MIN + 1;
const CELL_SIZE = 56;
const MIN_ZOOM = 0.6;
const MAX_ZOOM = 1;
const ZOOM_STEP = 0.1;

const getCellCenter = (coordinates: Coordinates) => ({
  x: (coordinates.x - GRID_MIN) * CELL_SIZE + CELL_SIZE / 2,
  y: (coordinates.y - GRID_MIN) * CELL_SIZE + CELL_SIZE / 2,
});

const getCenteredCamera = (coordinates: Coordinates): CameraState => {
  const center = getCellCenter(coordinates);

  return {
    offsetX: -center.x,
    offsetY: -center.y,
    zoom: MAX_ZOOM,
  };
};

const getCameraCenterCoordinates = (camera: CameraState): Coordinates => {
  const centerX = -camera.offsetX / camera.zoom;
  const centerY = -camera.offsetY / camera.zoom;

  return {
    x: Math.round(centerX / CELL_SIZE + GRID_MIN),
    y: Math.round(centerY / CELL_SIZE + GRID_MIN),
  };
};

export const GameBoard: React.FC<GameBoardProps> = ({
  gameState,
  selectedCard,
  onPlaceCard,
  onFinishDrag,
  showPlayableHighlights,
  showTooltips,
  canReviewPendingMove,
  showPendingWaitBadge,
  pendingMoveStatusLabel,
  onConfirmPendingMove,
  onReturnPendingMove,
  canReviewPendingCross,
  pendingCrossReviewerLabel,
  onApprovePendingCross,
  onRejectPendingCross,
}) => {
  const [camera, setCamera] = useState<CameraState>(() =>
    getCenteredCamera(gameState.startCard.coordinates)
  );
  const [viewport, setViewport] = useState<ViewportSize>({ width: 0, height: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    isDragging: boolean;
    lastX: number;
    lastY: number;
  }>({
    isDragging: false,
    lastX: 0,
    lastY: 0,
  });

  const handleCellClick = useCallback(
    (x: number, y: number) => {
      const coordinates = { x, y };
      if (selectedCard && canPlaceCard(gameState, coordinates, selectedCard)) {
        onPlaceCard(selectedCard, coordinates);
      }
    },
    [gameState, selectedCard, onPlaceCard]
  );

  const getDropCoordinates = useCallback(
    (event: React.DragEvent<HTMLDivElement>): Coordinates | null => {
      const container = containerRef.current;
      if (!container) return null;

      const rect = container.getBoundingClientRect();
      const viewportCenterX = (viewport.width || rect.width) / 2;
      const viewportCenterY = (viewport.height || rect.height) / 2;
      const pointerX = event.clientX - rect.left;
      const pointerY = event.clientY - rect.top;
      const worldX = (pointerX - viewportCenterX - camera.offsetX) / camera.zoom;
      const worldY = (pointerY - viewportCenterY - camera.offsetY) / camera.zoom;
      const x = Math.floor(worldX / CELL_SIZE) + GRID_MIN;
      const y = Math.floor(worldY / CELL_SIZE) + GRID_MIN;

      if (x < GRID_MIN || x > GRID_MAX || y < GRID_MIN || y > GRID_MAX) {
        return null;
      }

      return { x, y };
    },
    [camera.offsetX, camera.offsetY, camera.zoom, viewport.height, viewport.width]
  );

  const handleDragOver = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      if (!selectedCard) return;

      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
    },
    [selectedCard]
  );

  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      if (!selectedCard) return;

      const coordinates = getDropCoordinates(event);
      if (coordinates && canPlaceCard(gameState, coordinates, selectedCard)) {
        onPlaceCard(selectedCard, coordinates);
      }
      onFinishDrag();
    },
    [gameState, getDropCoordinates, onFinishDrag, onPlaceCard, selectedCard]
  );

  const handleWheel = useCallback((event: React.WheelEvent<HTMLDivElement>) => {
    event.preventDefault();

    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const viewportCenterX = (viewport.width || rect.width) / 2;
    const viewportCenterY = (viewport.height || rect.height) / 2;
    const pointerX = event.clientX - rect.left;
    const pointerY = event.clientY - rect.top;
    const direction = event.deltaY > 0 ? -1 : 1;

    setCamera((currentCamera) => {
      const nextZoom = Math.min(
        MAX_ZOOM,
        Math.max(MIN_ZOOM, currentCamera.zoom + direction * ZOOM_STEP)
      );
      const worldX =
        (pointerX - viewportCenterX - currentCamera.offsetX) / currentCamera.zoom;
      const worldY =
        (pointerY - viewportCenterY - currentCamera.offsetY) / currentCamera.zoom;

      return {
        offsetX: pointerX - viewportCenterX - worldX * nextZoom,
        offsetY: pointerY - viewportCenterY - worldY * nextZoom,
        zoom: nextZoom,
      };
    });
  }, [viewport.height, viewport.width]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateViewportSize = () => {
      setViewport({
        width: container.clientWidth,
        height: container.clientHeight,
      });
    };

    updateViewportSize();
    const resizeObserver = new ResizeObserver(updateViewportSize);
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  useEffect(() => {
    console.log('Neutral start card coordinates:', gameState.startCard.coordinates);
  }, [gameState.startCard.id, gameState.startCard.coordinates]);

  useEffect(() => {
    console.log('Camera center coordinates:', getCameraCenterCoordinates(camera));
  }, [camera]);

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (selectedCard || event.button !== 0) return;

      dragRef.current = {
        isDragging: true,
        lastX: event.clientX,
        lastY: event.clientY,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [selectedCard]
  );

  const handlePointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag.isDragging) return;

    const deltaX = event.clientX - drag.lastX;
    const deltaY = event.clientY - drag.lastY;
    dragRef.current = {
      isDragging: true,
      lastX: event.clientX,
      lastY: event.clientY,
    };
    setCamera((currentCamera) => ({
      ...currentCamera,
      offsetX: currentCamera.offsetX + deltaX,
      offsetY: currentCamera.offsetY + deltaY,
    }));
  }, []);

  const handlePointerUp = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    dragRef.current.isDragging = false;
    event.currentTarget.releasePointerCapture(event.pointerId);
  }, []);

  const boardStyle = {
    gridTemplateColumns: `repeat(${GRID_SIZE}, var(--cell-size))`,
    gridTemplateRows: `repeat(${GRID_SIZE}, var(--cell-size))`,
    '--cell-size': `${CELL_SIZE}px`,
    transform: `translate(${viewport.width / 2 + camera.offsetX}px, ${
      viewport.height / 2 + camera.offsetY
    }px) scale(${camera.zoom})`,
  } as CSSProperties;
  const pendingOverlayRefreshKey = `${camera.offsetX}:${camera.offsetY}:${camera.zoom}:${viewport.width}:${viewport.height}`;
  const pendingCrossCardIds = new Set(gameState.pendingCross?.cardIds ?? []);
  const pendingCrossCenterKey = gameState.pendingCross
    ? `${gameState.pendingCross.centerX},${gameState.pendingCross.centerY}`
    : null;
  const tooltipScopeKey = gameState.pendingCross
    ? gameState.pendingCross.cardIds.join('|')
    : 'no-pending-cross';

  return (
    <div
      className={`game-board-container ${selectedCard ? '' : 'can-pan'}`}
      ref={containerRef}
      onWheel={handleWheel}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <div
        className="game-board"
        style={boardStyle}
      >
        {Array.from({ length: GRID_SIZE * GRID_SIZE }).map((_, index) => {
          const y = GRID_MIN + Math.floor(index / GRID_SIZE);
          const x = GRID_MIN + (index % GRID_SIZE);
          const key = `${x},${y}`;
          const placedCard = gameState.board[key];
          const coordinates = { x, y };
          const isPlayable =
            showPlayableHighlights &&
            selectedCard !== null &&
            canPlaceCard(gameState, coordinates, selectedCard);
          const isCrossPending =
            Boolean(placedCard) && pendingCrossCardIds.has(placedCard.id);
          const isCrossPendingCenter = key === pendingCrossCenterKey;

          return (
            <Cell
              key={`${x}-${y}`}
              placedCard={placedCard}
              onCellClick={() => handleCellClick(x, y)}
              isHighlighted={showPlayableHighlights && selectedCard !== null}
              isPlayable={isPlayable}
              isLastPlaced={placedCard?.id === gameState.lastPlacedCardId}
              showTooltip={showTooltips}
              showPendingActions={
                placedCard?.status === 'pending' && canReviewPendingMove
              }
              showPendingWaitBadge={
                placedCard?.status === 'pending' && showPendingWaitBadge
              }
              pendingMoveStatusLabel={pendingMoveStatusLabel}
              onConfirmPendingMove={onConfirmPendingMove}
              onReturnPendingMove={onReturnPendingMove}
              pendingOverlayRefreshKey={pendingOverlayRefreshKey}
              isCrossPending={isCrossPending}
              isCrossPendingCenter={isCrossPendingCenter}
              showPendingCrossActions={canReviewPendingCross}
              pendingCrossReviewerLabel={pendingCrossReviewerLabel}
              onApprovePendingCross={onApprovePendingCross}
              onRejectPendingCross={onRejectPendingCross}
              tooltipScopeKey={tooltipScopeKey}
            />
          );
        })}
      </div>
    </div>
  );
};
