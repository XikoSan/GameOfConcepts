import type { Coordinates } from '../types';

export interface BoardCamera {
  offsetX: number;
  offsetY: number;
  zoom: number;
}

interface FitViewport {
  width: number;
  height: number;
  visibleHeight: number;
  originY: number;
  compact?: boolean;
}

// A real bounding box handles chains and branches; the count cap also keeps sparse small boards readable.
export function fitBoardCamera(coordinates: readonly Coordinates[], viewport: FitViewport): BoardCamera {
  const points = coordinates.length ? coordinates : [{ x: 0, y: 0 }];
  const minX = Math.min(...points.map(point => point.x));
  const maxX = Math.max(...points.map(point => point.x));
  const minY = Math.min(...points.map(point => point.y));
  const maxY = Math.max(...points.map(point => point.y));
  const cellSize = 96;
  const gridMin = -40;
  const centerX = ((minX + maxX) / 2 - gridMin + .5) * cellSize;
  const centerY = ((minY + maxY) / 2 - gridMin + .5) * cellSize;
  const visibleHeight = Math.max(1, Math.min(viewport.height, viewport.visibleHeight));
  // Phones start with five visible columns; further growth can still zoom out.
  const countCap = viewport.compact
    ? Math.max(1, viewport.width) / (5 * cellSize) / Math.pow(Math.max(1, points.length / 5), .14)
    : 1.28 / Math.pow(points.length, .14);
  const fitZoom = Math.min(
    Math.max(1, viewport.width - (viewport.compact ? 0 : 24)) / ((maxX - minX + 3) * cellSize),
    Math.max(1, visibleHeight - 24) / ((maxY - minY + 3) * cellSize),
  );
  const zoom = Math.max(.001, Math.min(countCap, fitZoom));
  return {
    offsetX: -centerX * zoom,
    offsetY: visibleHeight / 2 - viewport.originY - centerY * zoom,
    zoom,
  };
}
