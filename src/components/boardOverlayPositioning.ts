export type BoardOverlayId = 'card-info' | 'relation-editor' | 'pending-actions';

export type OverlayPlacement =
  | 'right'
  | 'left'
  | 'top'
  | 'bottom'
  | 'right-shifted'
  | 'left-shifted';

export interface OverlayRect {
  left: number;
  top: number;
  width: number;
  height: number;
  right: number;
  bottom: number;
}

interface CalculateBoardOverlayPositionArgs {
  anchorRect: OverlayRect;
  overlaySize: {
    width: number;
    height: number;
  };
  boardRect: OverlayRect;
  occupiedRects: OverlayRect[];
  preferredPlacements: OverlayPlacement[];
  safePadding?: number;
}

export const toOverlayRect = (rect: DOMRect | OverlayRect): OverlayRect => ({
  left: rect.left,
  top: rect.top,
  width: rect.width,
  height: rect.height,
  right: rect.right,
  bottom: rect.bottom,
});

const createRect = (
  left: number,
  top: number,
  width: number,
  height: number
): OverlayRect => ({
  left,
  top,
  width,
  height,
  right: left + width,
  bottom: top + height,
});

const getIntersectionArea = (firstRect: OverlayRect, secondRect: OverlayRect) => {
  const width = Math.max(
    0,
    Math.min(firstRect.right, secondRect.right) - Math.max(firstRect.left, secondRect.left)
  );
  const height = Math.max(
    0,
    Math.min(firstRect.bottom, secondRect.bottom) - Math.max(firstRect.top, secondRect.top)
  );

  return width * height;
};

const getOverflowArea = (rect: OverlayRect, bounds: OverlayRect) => {
  const leftOverflow = Math.max(0, bounds.left - rect.left);
  const rightOverflow = Math.max(0, rect.right - bounds.right);
  const topOverflow = Math.max(0, bounds.top - rect.top);
  const bottomOverflow = Math.max(0, rect.bottom - bounds.bottom);

  return (
    (leftOverflow + rightOverflow) * rect.height +
    (topOverflow + bottomOverflow) * rect.width
  );
};

const clampPosition = (
  rect: OverlayRect,
  bounds: OverlayRect,
  safePadding: number
): OverlayRect => {
  const minLeft = bounds.left + safePadding;
  const maxLeft = bounds.right - rect.width - safePadding;
  const minTop = bounds.top + safePadding;
  const maxTop = bounds.bottom - rect.height - safePadding;
  const left = maxLeft < minLeft
    ? minLeft
    : Math.min(maxLeft, Math.max(minLeft, rect.left));
  const top = maxTop < minTop
    ? minTop
    : Math.min(maxTop, Math.max(minTop, rect.top));

  return createRect(left, top, rect.width, rect.height);
};

const getPlacementRect = (
  placement: OverlayPlacement,
  anchorRect: OverlayRect,
  overlaySize: CalculateBoardOverlayPositionArgs['overlaySize'],
  gap: number
) => {
  const centeredTop = anchorRect.top + anchorRect.height / 2 - overlaySize.height / 2;
  const centeredLeft = anchorRect.left + anchorRect.width / 2 - overlaySize.width / 2;

  if (placement === 'left') {
    return createRect(
      anchorRect.left - overlaySize.width - gap,
      centeredTop,
      overlaySize.width,
      overlaySize.height
    );
  }

  if (placement === 'top') {
    return createRect(
      centeredLeft,
      anchorRect.top - overlaySize.height - gap,
      overlaySize.width,
      overlaySize.height
    );
  }

  if (placement === 'bottom') {
    return createRect(
      centeredLeft,
      anchorRect.bottom + gap,
      overlaySize.width,
      overlaySize.height
    );
  }

  if (placement === 'right-shifted') {
    return createRect(
      anchorRect.right + gap,
      anchorRect.bottom + gap,
      overlaySize.width,
      overlaySize.height
    );
  }

  if (placement === 'left-shifted') {
    return createRect(
      anchorRect.left - overlaySize.width - gap,
      anchorRect.bottom + gap,
      overlaySize.width,
      overlaySize.height
    );
  }

  return createRect(
    anchorRect.right + gap,
    centeredTop,
    overlaySize.width,
    overlaySize.height
  );
};

export function calculateBoardOverlayPosition({
  anchorRect,
  overlaySize,
  boardRect,
  occupiedRects,
  preferredPlacements,
  safePadding = 10,
}: CalculateBoardOverlayPositionArgs) {
  const bounds = createRect(
    boardRect.left + safePadding,
    boardRect.top + safePadding,
    Math.max(0, boardRect.width - safePadding * 2),
    Math.max(0, boardRect.height - safePadding * 2)
  );
  const gap = 12;
  let bestRect: OverlayRect | null = null;
  let bestScore = Number.POSITIVE_INFINITY;

  preferredPlacements.forEach((placement, index) => {
    const candidateRect = clampPosition(
      getPlacementRect(placement, anchorRect, overlaySize, gap),
      bounds,
      0
    );
    const occupiedArea = occupiedRects.reduce(
      (totalArea, occupiedRect) => totalArea + getIntersectionArea(candidateRect, occupiedRect),
      0
    );
    const overflowArea = getOverflowArea(candidateRect, bounds);
    const distanceFromAnchor =
      Math.abs(candidateRect.left - anchorRect.left) +
      Math.abs(candidateRect.top - anchorRect.top);
    const score = occupiedArea * 20 + overflowArea * 30 + distanceFromAnchor * 0.01 + index;

    if (score < bestScore) {
      bestScore = score;
      bestRect = candidateRect;
    }
  });

  return bestRect ?? createRect(anchorRect.right + gap, anchorRect.top, overlaySize.width, overlaySize.height);
}
