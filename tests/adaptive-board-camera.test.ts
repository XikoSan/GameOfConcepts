import test from 'node:test';
import assert from 'node:assert/strict';
import { fitBoardCamera } from '../src/components/adaptiveBoardCamera';
import type { Coordinates } from '../src/types';

const desktop = { width: 1280, height: 700, visibleHeight: 700, originY: 350, compact: false };
const phone = { width: 390, height: 800, visibleHeight: 600, originY: 312, compact: true };
const cross = [{ x: 0, y: 0 }, { x: 0, y: -1 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 1, y: 0 }];
const rectangle = Array.from({ length: 20 }, (_, i) => ({ x: i % 5, y: Math.floor(i / 5) }));

function assertFits(points: Coordinates[], viewport = phone) {
  const camera = fitBoardCamera(points, viewport);
  const xs = points.map(point => point.x), ys = points.map(point => point.y);
  // Include a free grid cell on every side so the next move has visible room.
  const left = viewport.width / 2 + camera.offsetX + (Math.min(...xs) + 40 - 1) * 96 * camera.zoom;
  const right = viewport.width / 2 + camera.offsetX + (Math.max(...xs) + 40 + 2) * 96 * camera.zoom;
  const top = viewport.originY + camera.offsetY + (Math.min(...ys) + 40 - 1) * 96 * camera.zoom;
  const bottom = viewport.originY + camera.offsetY + (Math.max(...ys) + 40 + 2) * 96 * camera.zoom;
  const horizontalPadding = viewport.compact ? 0 : 12;
  assert.ok(left >= horizontalPadding - 1e-9 && right <= viewport.width - horizontalPadding + 1e-9);
  assert.ok(top >= 12 - 1e-9 && bottom <= viewport.visibleHeight - 12 + 1e-9);
  assert.ok(Math.abs((left + right) / 2 - viewport.width / 2) < 1e-9);
  assert.ok(Math.abs((top + bottom) / 2 - viewport.visibleHeight / 2) < 1e-9);
  return camera;
}

test('board camera scales progressively for one, five and twenty cards', () => {
  for (const viewport of [desktop, phone]) {
    const one = assertFits([{ x: 0, y: 0 }], viewport);
    const five = assertFits(cross, viewport);
    const twenty = assertFits(rectangle, viewport);
    assert.ok(one.zoom >= five.zoom && five.zoom > twenty.zoom);
    if (!viewport.compact) assert.ok(one.zoom > five.zoom);
  }
});

test('compact board starts at exactly five columns without changing the desktop scale', () => {
  for (const width of [320, 390, 430, 768]) {
    const viewport = { ...phone, width, visibleHeight: 900, height: 1000 };
    for (const points of [[{ x: 0, y: 0 }], cross]) {
      const camera = assertFits(points, viewport);
      assert.ok(Math.abs(width / (96 * camera.zoom) - 5) < 1e-9);
    }
  }
  assert.equal(fitBoardCamera([{ x: 0, y: 0 }], desktop).zoom, 1.28);
  const twenty = assertFits(rectangle);
  assert.ok(phone.width / (96 * twenty.zoom) > 5);
});

test('board camera fits broad and tall layouts beyond the old zoom limit', () => {
  const line = Array.from({ length: 20 }, (_, x) => ({ x, y: 0 }));
  assert.ok(assertFits(line).zoom < .6);
  assert.ok(assertFits(line.map(({ x, y }) => ({ x: y, y: x }))).zoom < .6);
  assertFits([{ x: -40, y: -40 }, { x: 40, y: 40 }], { ...phone, width: 320 });
});

test('board camera centers actual layout and keeps it above the portrait hand', () => {
  const points = rectangle.map(point => ({ x: point.x + 11, y: point.y - 8 }));
  const camera = assertFits(points);
  const fullHeight = fitBoardCamera(points, { ...phone, visibleHeight: phone.height });
  const centerY = phone.originY + camera.offsetY + (40 - 8 + 2) * 96 * camera.zoom;
  assert.ok(Math.abs(centerY - phone.visibleHeight / 2) < 1e-9);
  assert.notEqual(camera.offsetY, fullHeight.offsetY);
});

test('board camera has a finite fallback before measuring the viewport', () => {
  const camera = fitBoardCamera([], { width: 0, height: 0, visibleHeight: 0, originY: 0 });
  assert.ok(Object.values(camera).every(Number.isFinite));
  assert.ok(camera.zoom > 0);
});
