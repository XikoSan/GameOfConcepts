import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import type { CSSProperties } from 'react';
import { canPlaceCard, getPhysicalSemanticNeighbors } from '../game';
import {
  endMeasure,
  incrementCounter,
  startMeasure,
} from '../debug/performanceDiagnostics';
import type {
  Coordinates,
  GameState,
  PendingSemanticEdge,
  PlacedCard,
  RegularCardName,
  SemanticEdge,
  SemanticRelation,
} from '../game';
import { formatRelationForCard } from '../scoring/semanticRelations';
import { Cell } from './Cell';
import { SemanticRelationPopover } from './SemanticRelationPopover';
import {
  calculateBoardOverlayPosition,
  type BoardOverlayId,
  type OverlayRect,
  toOverlayRect,
} from './boardOverlayPositioning';
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
  canEditSemanticMove: boolean;
  canSubmitSemanticMove: boolean;
  onUpsertSemanticEdge: (
    neighborCardInstanceId: string,
    relation: SemanticRelation,
    direction: PendingSemanticEdge['direction']
  ) => void;
  onRemoveSemanticEdge: (neighborCardInstanceId: string) => void;
  onSubmitSemanticMove: () => void;
  onCancelPendingMove: () => void;
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

const pluralizeRelation = (count: number) => {
  const lastTwoDigits = count % 100;
  const lastDigit = count % 10;

  if (lastTwoDigits >= 11 && lastTwoDigits <= 14) return 'связей';
  if (lastDigit === 1) return 'связь';
  if (lastDigit >= 2 && lastDigit <= 4) return 'связи';
  return 'связей';
};

const getRelationIndicator = (
  pendingCard: PlacedCard,
  neighbor: PlacedCard,
  edge?: PendingSemanticEdge
) => {
  if (!edge) return '+';
  if (edge.relation.family === 'opposite') return '↔';

  const fromPending = edge.direction === 'new-to-neighbor';
  const deltaX = neighbor.coordinates.x - pendingCard.coordinates.x;
  const deltaY = neighbor.coordinates.y - pendingCard.coordinates.y;

  if (deltaX > 0) return fromPending ? '→' : '←';
  if (deltaX < 0) return fromPending ? '←' : '→';
  if (deltaY > 0) return fromPending ? '↓' : '↑';
  return fromPending ? '↑' : '↓';
};

const getRelationOverlayClassName = (
  pendingCard: PlacedCard,
  neighbor: PlacedCard
) => {
  const deltaX = neighbor.coordinates.x - pendingCard.coordinates.x;
  const deltaY = neighbor.coordinates.y - pendingCard.coordinates.y;

  if (deltaX !== 0) return 'horizontal';
  return deltaY > 0 ? 'vertical-down' : 'vertical-up';
};

const getAcceptedRelationLabelsByCardId = (
  boardCards: PlacedCard[],
  semanticEdges: readonly SemanticEdge[] = []
) => {
  const namesById = new Map(boardCards.map((card) => [card.id, card.cardName]));
  const cardsById = new Map(boardCards.map((card) => [card.id, card]));
  const labelsById = new Map<
    string,
    NonNullable<ReturnType<typeof formatRelationForCard>>[]
  >();

  semanticEdges.forEach((edge) => {
    [edge.fromCardInstanceId, edge.toCardInstanceId].forEach((cardId) => {
      const label = formatRelationForCard(edge, cardId, namesById);
      if (!label) return;

      const labels = labelsById.get(cardId) ?? [];
      labels.push(label);
      labelsById.set(cardId, labels);
    });
  });

  labelsById.forEach((labels, cardId) => {
    const currentCard = cardsById.get(cardId);
    if (!currentCard) return;

    labels.sort((a, b) => {
      const cardA = cardsById.get(a.otherCardInstanceId);
      const cardB = cardsById.get(b.otherCardInstanceId);
      const getOrder = (card?: PlacedCard) => {
        if (!card) return 10;
        const dx = card.coordinates.x - currentCard.coordinates.x;
        const dy = card.coordinates.y - currentCard.coordinates.y;
        if (dy < 0) return 0;
        if (dx > 0) return 1;
        if (dy > 0) return 2;
        if (dx < 0) return 3;
        return 10;
      };

      const orderDelta = getOrder(cardA) - getOrder(cardB);
      if (orderDelta !== 0) return orderDelta;
      return a.edgeId.localeCompare(b.edgeId);
    });
  });

  return labelsById;
};

const getPendingMoveKey = (pendingMove: GameState['pendingMove']) =>
  pendingMove?.moveId ?? pendingMove?.id ?? pendingMove?.cardId ?? null;

const getOverlaySize = (
  rect: OverlayRect | undefined,
  fallbackSize: { width: number; height: number }
) => ({
  width: rect?.width ?? fallbackSize.width,
  height: rect?.height ?? fallbackSize.height,
});

const areOverlayRectsEqual = (
  firstRect: OverlayRect | null | undefined,
  secondRect: OverlayRect | null | undefined
) => {
  if (!firstRect || !secondRect) return firstRect === secondRect;

  const threshold = 0.5;

  return (
    Math.abs(firstRect.left - secondRect.left) < threshold &&
    Math.abs(firstRect.top - secondRect.top) < threshold &&
    Math.abs(firstRect.width - secondRect.width) < threshold &&
    Math.abs(firstRect.height - secondRect.height) < threshold
  );
};

const getOccupiedOverlayRects = (
  overlayRects: Partial<Record<BoardOverlayId, OverlayRect>>,
  ignoredIds: BoardOverlayId[] = []
) =>
  (Object.entries(overlayRects) as Array<[BoardOverlayId, OverlayRect]>)
    .filter(([id]) => !ignoredIds.includes(id))
    .map(([, rect]) => rect);

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
  canEditSemanticMove,
  canSubmitSemanticMove,
  onUpsertSemanticEdge,
  onRemoveSemanticEdge,
  onSubmitSemanticMove,
  onCancelPendingMove,
}) => {
  incrementCounter('render:GameBoard');
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
  const [activeRelationEditor, setActiveRelationEditor] = useState<{
    moveId: string;
    neighborCardInstanceId: string;
  } | null>(null);
  const [highlightedRelationCardId, setHighlightedRelationCardId] =
    useState<string | null>(null);
  const [boardViewportRect, setBoardViewportRect] = useState<OverlayRect | null>(null);
  const [overlayRects, setOverlayRects] = useState<
    Partial<Record<BoardOverlayId, OverlayRect>>
  >({});
  const [pendingActionsElement, setPendingActionsElement] =
    useState<HTMLDivElement | null>(null);
  const previousRelationEditorRectRef = useRef<OverlayRect | null>(null);
  const previousPendingActionsRectRef = useRef<OverlayRect | null>(null);

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

      incrementCounter('dom:getBoundingClientRect:drop-coordinates');
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

      incrementCounter('drag:board-dragover');
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
    },
    [selectedCard]
  );

  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      if (!selectedCard) return;

      incrementCounter('drag:board-drop');
      const coordinates = getDropCoordinates(event);
      if (coordinates && canPlaceCard(gameState, coordinates, selectedCard)) {
        onPlaceCard(selectedCard, coordinates);
      }
      onFinishDrag();
    },
    [gameState, getDropCoordinates, onFinishDrag, onPlaceCard, selectedCard]
  );

  const handleBoardClick = useCallback(() => {
    setHighlightedRelationCardId(null);
    window.dispatchEvent(new CustomEvent('card-info-close-pinned'));
  }, []);

  const handleWheel = useCallback((event: React.WheelEvent<HTMLDivElement>) => {
    event.preventDefault();

    const container = containerRef.current;
    if (!container) return;

    incrementCounter('dom:getBoundingClientRect:wheel');
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
      incrementCounter('resize-observer:board');
      incrementCounter('dom:getBoundingClientRect:board-viewport');
      const rect = container.getBoundingClientRect();
      const nextViewport = {
        width: container.clientWidth,
        height: container.clientHeight,
      };
      const nextViewportRect = toOverlayRect(rect);

      setViewport((currentViewport) =>
        currentViewport.width === nextViewport.width &&
        currentViewport.height === nextViewport.height
          ? currentViewport
          : nextViewport
      );
      setBoardViewportRect((currentRect) =>
        areOverlayRectsEqual(currentRect, nextViewportRect)
          ? currentRect
          : nextViewportRect
      );
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

      incrementCounter('pan:pointerdown');
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

    incrementCounter('pan:pointermove');
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
    incrementCounter('pan:pointerup');
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
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
  const boardCards = useMemo(() => Object.values(gameState.board), [gameState.board]);
  const pendingMove = gameState.pendingMove;
  const pendingCard = pendingMove
    ? boardCards.find((card) => card.id === pendingMove.cardId)
    : null;
  const semanticNeighbors = useMemo(
    () => getPhysicalSemanticNeighbors(gameState),
    [gameState]
  );
  const pendingSemanticEdges = pendingMove?.semanticEdges ?? [];
  const pendingSemanticScore = pendingMove?.scorePreview;
  const relationLabelsByCardId = useMemo(
    () => {
      const startTime = startMeasure();
      const labels = getAcceptedRelationLabelsByCardId(boardCards, gameState.semanticEdges);
      endMeasure('derive:relation-labels', startTime);
      return labels;
    },
    [boardCards, gameState.semanticEdges]
  );
  const activeRelationEditorForCurrentMove =
    activeRelationEditor &&
    pendingMove &&
    getPendingMoveKey(pendingMove) === activeRelationEditor.moveId &&
    pendingMove.semanticStatus === 'defining-relations'
      ? activeRelationEditor
      : null;
  const activeRelationNeighbor = activeRelationEditorForCurrentMove
    ? semanticNeighbors.find(
        (neighbor) =>
          neighbor.id === activeRelationEditorForCurrentMove.neighborCardInstanceId
      )
    : null;
  const activeRelationEdge = activeRelationNeighbor
    ? pendingSemanticEdges.find(
        (edge) => edge.neighborCardInstanceId === activeRelationNeighbor.id
      )
    : undefined;
  const activeRelationScore = activeRelationEdge
    ? pendingSemanticScore?.edges.find((edge) => edge.pendingEdgeId === activeRelationEdge.id)
    : undefined;

  const setBoardOverlayRect = useCallback(
    (id: BoardOverlayId, rect: OverlayRect | null) => {
      setOverlayRects((currentRects) => {
        if (areOverlayRectsEqual(currentRects[id], rect)) {
          incrementCounter('overlay:geometrySkippedAsEqual');
          return currentRects;
        }

        incrementCounter('overlay:updateGeometry');
        const nextRects = { ...currentRects };
        if (rect) {
          nextRects[id] = rect;
        } else {
          delete nextRects[id];
        }
        return nextRects;
      });
    },
    []
  );

  const cardInfoOccupiedRects = useMemo(
    () => getOccupiedOverlayRects(overlayRects, ['card-info']),
    [overlayRects]
  );
  const relationEditorOccupiedRects = useMemo(
    () =>
      getOccupiedOverlayRects(overlayRects, [
        'relation-editor',
        'card-info',
        'pending-actions',
      ]),
    [overlayRects]
  );
  const pendingActionsOccupiedRects = useMemo(
    () => getOccupiedOverlayRects(overlayRects, ['pending-actions', 'card-info']),
    [overlayRects]
  );

  const handleCardInfoRectChange = useCallback(
    (rect: OverlayRect | null) => {
      setBoardOverlayRect('card-info', rect);
    },
    [setBoardOverlayRect]
  );

  const handleRelationEnter = useCallback((cardInstanceId: string) => {
    setHighlightedRelationCardId(cardInstanceId);
  }, []);

  const handleRelationLeave = useCallback(() => {
    setHighlightedRelationCardId(null);
  }, []);

  const handleRelationEditorMeasured = useCallback(
    (rect: DOMRect) => {
      setBoardOverlayRect('relation-editor', toOverlayRect(rect));
    },
    [setBoardOverlayRect]
  );

  useEffect(() => {
    if (activeRelationEditorForCurrentMove) return;

    const animationFrameId = window.requestAnimationFrame(() => {
      incrementCounter('raf:clear-relation-editor-rect');
      setBoardOverlayRect('relation-editor', null);
    });

    return () => window.cancelAnimationFrame(animationFrameId);
  }, [activeRelationEditorForCurrentMove, setBoardOverlayRect]);

  useEffect(() => {
    if (!pendingActionsElement) {
      const animationFrameId = window.requestAnimationFrame(() => {
        setBoardOverlayRect('pending-actions', null);
      });

      return () => window.cancelAnimationFrame(animationFrameId);
    }

    let animationFrameId = 0;
    const measure = () => {
      window.cancelAnimationFrame(animationFrameId);
      incrementCounter('raf:pending-actions-measure');
      animationFrameId = window.requestAnimationFrame(() => {
        incrementCounter('dom:getBoundingClientRect:pending-actions');
        setBoardOverlayRect(
          'pending-actions',
          toOverlayRect(pendingActionsElement.getBoundingClientRect())
        );
      });
    };
    const resizeObserver = new ResizeObserver(measure);

    measure();
    incrementCounter('resize-observer:pending-actions-created');
    resizeObserver.observe(pendingActionsElement);

    return () => {
      window.cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
      setBoardOverlayRect('pending-actions', null);
    };
  }, [pendingActionsElement, setBoardOverlayRect]);

  const getCellViewportRect = (coordinates: Coordinates): OverlayRect | null => {
    if (!boardViewportRect) return null;

    const cellLeft =
      boardViewportRect.left +
      viewport.width / 2 +
      camera.offsetX +
      (coordinates.x - GRID_MIN) * CELL_SIZE * camera.zoom;
    const cellTop =
      boardViewportRect.top +
      viewport.height / 2 +
      camera.offsetY +
      (coordinates.y - GRID_MIN) * CELL_SIZE * camera.zoom;
    const cellSize = CELL_SIZE * camera.zoom;

    return {
      left: cellLeft,
      top: cellTop,
      width: cellSize,
      height: cellSize,
      right: cellLeft + cellSize,
      bottom: cellTop + cellSize,
    };
  };

  const getRelationAnchorRect = (neighbor: PlacedCard): OverlayRect | null => {
    if (!pendingCard) return null;

    const pendingRect = getCellViewportRect(pendingCard.coordinates);
    const neighborRect = getCellViewportRect(neighbor.coordinates);
    if (!pendingRect || !neighborRect) return null;

    const left = (pendingRect.left + neighborRect.left) / 2;
    const top = (pendingRect.top + neighborRect.top) / 2;

    return {
      left,
      top,
      width: CELL_SIZE * camera.zoom,
      height: CELL_SIZE * camera.zoom,
      right: left + CELL_SIZE * camera.zoom,
      bottom: top + CELL_SIZE * camera.zoom,
    };
  };

  const openRelationEditor = (neighbor: PlacedCard) => {
    if (!pendingMove || !canEditSemanticMove) return;
    const moveId = getPendingMoveKey(pendingMove);
    if (!moveId) return;

    setActiveRelationEditor({
      moveId,
      neighborCardInstanceId: neighbor.id,
    });
  };

  const handleSaveRelation = (
    neighborCardInstanceId: string,
    relation: SemanticRelation,
    direction: PendingSemanticEdge['direction']
  ) => {
    onUpsertSemanticEdge(neighborCardInstanceId, relation, direction);
    setBoardOverlayRect('relation-editor', null);
    setActiveRelationEditor(null);
  };

  const handleRemoveRelation = (neighborCardInstanceId: string) => {
    onRemoveSemanticEdge(neighborCardInstanceId);
    setBoardOverlayRect('relation-editor', null);
    setActiveRelationEditor(null);
  };

  const handleSubmitSemanticMove = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (activeRelationEditor) return;
    window.dispatchEvent(new CustomEvent('card-info-close'));
    onSubmitSemanticMove();
  };

  const handleCancelSemanticMove = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    window.dispatchEvent(new CustomEvent('card-info-close'));
    setBoardOverlayRect('relation-editor', null);
    setActiveRelationEditor(null);
    onCancelPendingMove();
  };

  const relationAnchorRect = activeRelationNeighbor
    ? getRelationAnchorRect(activeRelationNeighbor)
    : null;
  const relationEditorRect =
    relationAnchorRect && boardViewportRect
      ? (() => {
          const startTime = startMeasure();
          const rect = calculateBoardOverlayPosition({
            anchorRect: relationAnchorRect,
            overlaySize: getOverlaySize(overlayRects['relation-editor'], {
              width: 330,
              height: 340,
            }),
            boardRect: boardViewportRect,
            occupiedRects: relationEditorOccupiedRects,
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
          endMeasure('overlay:position:relation-editor', startTime);
          return rect;
        })()
      : null;
  const pendingActionsAnchorRect = pendingCard
    ? getCellViewportRect(pendingCard.coordinates)
    : null;
  const pendingActionsRect =
    pendingActionsAnchorRect && boardViewportRect
      ? (() => {
          const startTime = startMeasure();
          incrementCounter('overlay:pending-position-calculated');
          const rect = calculateBoardOverlayPosition({
            anchorRect: pendingActionsAnchorRect,
            overlaySize: getOverlaySize(overlayRects['pending-actions'], {
              width: 126,
              height: 92,
            }),
            boardRect: boardViewportRect,
            occupiedRects: pendingActionsOccupiedRects,
            preferredPlacements: ['right', 'left', 'top', 'bottom'],
            safePadding: 8,
          });
          incrementCounter('overlay:pending-position-applied');
          endMeasure('overlay:position:pending-actions', startTime);
          return rect;
        })()
      : null;

  useEffect(() => {
    if (!activeRelationEditorForCurrentMove || !relationEditorRect) {
      previousRelationEditorRectRef.current = null;
      return;
    }

    const previousRect = previousRelationEditorRectRef.current;
    if (previousRect && !areOverlayRectsEqual(previousRect, relationEditorRect)) {
      incrementCounter('overlay:relation-editor-moved');
    }
    previousRelationEditorRectRef.current = relationEditorRect;
  }, [activeRelationEditorForCurrentMove, relationEditorRect]);

  useEffect(() => {
    if (!pendingActionsRect) {
      previousPendingActionsRectRef.current = null;
      return;
    }

    const previousRect = previousPendingActionsRectRef.current;
    if (previousRect && !areOverlayRectsEqual(previousRect, pendingActionsRect)) {
      incrementCounter('overlay:pending-moved');
    } else {
      incrementCounter('overlay:pending-move-skipped');
    }
    previousPendingActionsRectRef.current = pendingActionsRect;
  }, [pendingActionsRect]);

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
      onClick={handleBoardClick}
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
              semanticRelationLabels={
                placedCard ? relationLabelsByCardId.get(placedCard.id) ?? [] : []
              }
              isRelationHighlighted={placedCard?.id === highlightedRelationCardId}
              boardRect={boardViewportRect}
              occupiedOverlayRects={cardInfoOccupiedRects}
              onCardInfoRectChange={handleCardInfoRectChange}
              onRelationEnter={handleRelationEnter}
              onRelationLeave={handleRelationLeave}
            />
          );
        })}
        {pendingCard &&
          pendingMove?.semanticStatus === 'defining-relations' &&
          semanticNeighbors.map((neighbor) => {
            const selectedEdge = pendingSemanticEdges.find(
              (edge) => edge.neighborCardInstanceId === neighbor.id
            );
            const pendingCenter = getCellCenter(pendingCard.coordinates);
            const neighborCenter = getCellCenter(neighbor.coordinates);
            const left = (pendingCenter.x + neighborCenter.x) / 2;
            const top = (pendingCenter.y + neighborCenter.y) / 2;

            return (
              <button
                aria-label={`Связь между ${pendingCard.cardName} и ${neighbor.cardName}`}
                className={`semantic-board-link ${
                  selectedEdge ? 'defined' : ''
                } ${getRelationOverlayClassName(pendingCard, neighbor)}`}
                disabled={!canEditSemanticMove}
                key={neighbor.id}
                onClick={(event) => {
                  event.stopPropagation();
                  openRelationEditor(neighbor);
                }}
                onPointerDown={(event) => event.stopPropagation()}
                style={{ left: `${left}px`, top: `${top}px` }}
                title={selectedEdge ? 'Изменить связь' : 'Добавить связь'}
                type="button"
              >
                {getRelationIndicator(pendingCard, neighbor, selectedEdge)}
              </button>
            );
          })}
        {pendingCard &&
          pendingMove?.semanticStatus === 'voting' &&
          semanticNeighbors.map((neighbor) => {
            const selectedEdge = pendingSemanticEdges.find(
              (edge) => edge.neighborCardInstanceId === neighbor.id
            );
            if (!selectedEdge) return null;

            const pendingCenter = getCellCenter(pendingCard.coordinates);
            const neighborCenter = getCellCenter(neighbor.coordinates);
            const left = (pendingCenter.x + neighborCenter.x) / 2;
            const top = (pendingCenter.y + neighborCenter.y) / 2;

            return (
              <span
                className={`semantic-board-link defined readonly ${getRelationOverlayClassName(
                  pendingCard,
                  neighbor
                )}`}
                key={neighbor.id}
                style={{ left: `${left}px`, top: `${top}px` }}
                title="Связь на голосовании"
              >
                {getRelationIndicator(pendingCard, neighbor, selectedEdge)}
              </span>
            );
          })}
      </div>
      {pendingCard &&
        pendingMove?.semanticStatus === 'defining-relations' &&
        pendingActionsRect &&
        createPortal(
          <div
            ref={setPendingActionsElement}
            className="semantic-submit-popover"
            onClick={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
            style={{
              left: `${pendingActionsRect.left}px`,
              top: `${pendingActionsRect.top}px`,
            }}
          >
            <strong>
              {pendingSemanticEdges.length} {pluralizeRelation(pendingSemanticEdges.length)} · +
              {pendingSemanticScore?.total ?? 0}
            </strong>
            <button
              disabled={!canSubmitSemanticMove || Boolean(activeRelationEditor)}
              type="button"
              onClick={handleSubmitSemanticMove}
            >
              На голосование
            </button>
            <button type="button" onClick={handleCancelSemanticMove}>
              Отменить
            </button>
          </div>,
          document.body
        )}
      {pendingCard &&
        activeRelationEditorForCurrentMove &&
        activeRelationNeighbor &&
        relationEditorRect &&
        createPortal(
          <SemanticRelationPopover
            neighborCard={activeRelationNeighbor}
            pendingCard={pendingCard}
            position={relationEditorRect}
            selectedEdge={activeRelationEdge}
            selectedScore={activeRelationScore}
            onClose={() => {
              setBoardOverlayRect('relation-editor', null);
              setActiveRelationEditor(null);
            }}
            onDelete={() => handleRemoveRelation(activeRelationNeighbor.id)}
            onMeasuredRect={handleRelationEditorMeasured}
            onSave={(relation, direction) =>
              handleSaveRelation(activeRelationNeighbor.id, relation, direction)
            }
          />,
          document.body
        )}
    </div>
  );
};
