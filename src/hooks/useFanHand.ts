import { useEffect, useRef, useState } from 'react';
import type { PointerEvent } from 'react';
import { getCardDragLift, getDragBoardCellSize } from '../components/cardDragPosition';

interface Options {
  enabled: boolean;
  active: boolean;
  cards: string[];
  preferred?: string;
  onStart: (index: number, event: PointerEvent<HTMLDivElement>) => void;
  onEnd: () => void;
  onInfo: (index: number) => void;
  onReorderStart?: () => void;
  onReorder?: (fromIndex: number, toIndex: number) => void;
  onReorderEnd?: (commit: boolean) => void;
}

export interface WordReorderPosition {
  index: number;
  name: string;
  x: number;
  y: number;
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
  fontSize: string;
  tilt: string;
  areaHeight: number;
}

// Capture the hand so a horizontal gesture can browse cards without lifting a finger.
export function useFanHand({ enabled, active, cards, preferred, onStart, onEnd, onInfo, onReorderStart, onReorder, onReorderEnd }: Options) {
  const [inspection, setInspection] = useState<{ index: number; name: string } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [reordering, setReordering] = useState<WordReorderPosition | null>(null);
  const suggestedIndex = preferred ? cards.indexOf(preferred) : -1;
  const inspected = inspection ? (cards[inspection.index] === inspection.name ? inspection.index : null) : suggestedIndex >= 0 ? suggestedIndex : null;
  const gesture = useRef<{ id: number; index: number; name: string; x: number; y: number; moved: boolean; dragging: boolean; infoOpened: boolean; reordering: boolean; lastTarget: number | null; label: Omit<WordReorderPosition, 'index' | 'name' | 'x' | 'y'> } | null>(null);
  const pressTimer = useRef<number | null>(null);
  const info = useRef({ onInfo, cards });
  useEffect(() => { info.current = { onInfo, cards }; }, [onInfo, cards]);
  const clearPress = () => {
    if (pressTimer.current !== null) window.clearTimeout(pressTimer.current);
    pressTimer.current = null;
  };
  const end = useRef(onEnd);
  const finishReorder = useRef(onReorderEnd);
  useEffect(() => { end.current = onEnd; }, [onEnd]);
  useEffect(() => { finishReorder.current = onReorderEnd; }, [onReorderEnd]);
  useEffect(() => {
    const reset = () => {
      clearPress();
      const wasDragging = gesture.current?.dragging;
      const wasReordering = gesture.current?.reordering;
      gesture.current = null;
      setDragging(false);
      setReordering(null);
      setInspection({ index: -1, name: '' });
      if (wasDragging) end.current();
      if (wasReordering) finishReorder.current?.(false);
    };
    const hidden = () => { if (document.hidden) reset(); };
    window.addEventListener('blur', reset);
    window.addEventListener('resize', reset);
    document.addEventListener('visibilitychange', hidden);
    return () => {
      window.removeEventListener('blur', reset);
      window.removeEventListener('resize', reset);
      document.removeEventListener('visibilitychange', hidden);
      reset();
    };
  }, [enabled, active]);

  const inspect = (index: number) => setInspection({ index, name: cards[index] });
  const cancel = () => {
    clearPress();
    const wasDragging = gesture.current?.dragging;
    const wasReordering = gesture.current?.reordering;
    gesture.current = null;
    setDragging(false);
    setReordering(null);
    setInspection({ index: -1, name: '' });
    if (wasDragging) onEnd();
    if (wasReordering) onReorderEnd?.(false);
  };
  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!enabled || !event.isPrimary || event.button !== 0) return;
    const element = (event.target as HTMLElement).closest<HTMLElement>('[data-hand-index]');
    if (!element) return;
    const index = Number(element.dataset.handIndex);
    if (!cards[index]) return;
    clearPress();
    const hand = event.currentTarget;
    const label = element.querySelector<HTMLElement>('.card-title') ?? element;
    const bounds = label.getBoundingClientRect();
    const labelStyle = getComputedStyle(label);
    const press = { id: event.pointerId, index, name: cards[index], x: event.clientX, y: event.clientY,
      moved: false, dragging: false, infoOpened: false, reordering: false, lastTarget: null,
      label: {
        offsetX: event.clientX - bounds.left - bounds.width / 2,
        offsetY: event.clientY - bounds.top - bounds.height / 2,
        width: label.offsetWidth,
        height: label.offsetHeight,
        fontSize: labelStyle.fontSize,
        tilt: labelStyle.getPropertyValue('--word-tilt').trim() || '0deg',
        areaHeight: hand.getBoundingClientRect().height,
      },
    };
    gesture.current = press;
    pressTimer.current = window.setTimeout(() => {
      pressTimer.current = null;
      if (gesture.current !== press || press.moved || press.dragging || press.infoOpened ||
          info.current.cards[press.index] !== press.name || !hand.isConnected || hand.closest('[inert]')) return;
      press.infoOpened = true;
      setInspection({ index: -1, name: '' });
      info.current.onInfo(press.index);
    }, 650);
    inspect(index);
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const current = gesture.current;
    if (!enabled || !current || current.id !== event.pointerId || current.dragging || current.infoOpened) return;
    if (cards[current.index] !== current.name) { cancel(); return; }
    const dx = event.clientX - current.x, dy = event.clientY - current.y;
    if (Math.hypot(dx, dy) > 8) { current.moved = true; clearPress(); }
    const handBounds = event.currentTarget.getBoundingClientRect();
    const scattered = event.currentTarget.classList.contains('word-hand');
    if (scattered && current.moved) {
      if (active && event.clientY < handBounds.top - 12) {
        current.dragging = true;
        if (current.reordering) { onReorderEnd?.(true); current.reordering = false; }
        setReordering(null);
        setDragging(true);
        window.dispatchEvent(new CustomEvent('card-info-close'));
        onStart(current.index, event);
        return;
      }
      const inside = event.clientX >= handBounds.left && event.clientX <= handBounds.right &&
        event.clientY >= handBounds.top && event.clientY <= handBounds.bottom;
      if (!current.reordering && !inside) return;
      if (!current.reordering) { current.reordering = true; onReorderStart?.(); }
      setReordering({ index: current.index, name: current.name, x: event.clientX, y: event.clientY, ...current.label });
      const distance = (rect: Pick<DOMRect, 'left' | 'right' | 'top' | 'bottom'>) => Math.hypot(
        Math.max(rect.left - event.clientX, 0, event.clientX - rect.right),
        Math.max(rect.top - event.clientY, 0, event.clientY - rect.bottom),
      );
      // Hit-test final layout slots, not their animated screen positions: moving neighbours must not steal the drop target.
      const nearest = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('.word-hand-slot')).map(slot => {
        const left = handBounds.left + event.currentTarget.clientLeft + slot.offsetLeft;
        const top = handBounds.top + event.currentTarget.clientTop + slot.offsetTop;
        return {
          index: Number(slot.querySelector<HTMLElement>('[data-hand-index]')?.dataset.handIndex),
          rect: { left, top, right: left + slot.offsetWidth, bottom: top + slot.offsetHeight },
        };
      }).sort((a, b) => distance(a.rect) - distance(b.rect))[0];
      const targetIndex = nearest?.index ?? -1;
      if (!nearest || targetIndex === current.index || distance(nearest.rect) > 10) {
        current.lastTarget = null;
      } else if (targetIndex !== current.lastTarget) {
        current.lastTarget = targetIndex;
        onReorder?.(current.index, targetIndex);
      }
      return;
    }
    if (dy < -18 && Math.abs(dy) > Math.abs(dx) && active) {
      current.dragging = true;
      setDragging(true);
      window.dispatchEvent(new CustomEvent('card-info-close'));
      onStart(current.index, event);
      return;
    }
    if (Math.abs(dx) <= 8) return;
    const elements = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('[data-hand-index]'));
    const nearest = elements.sort((a, b) => {
      const ar = a.getBoundingClientRect(), br = b.getBoundingClientRect();
      if (scattered) {
        // Scattered words occupy different rows; a matching x alone must not select another row.
        const distance = (rect: DOMRect) => Math.hypot(
          Math.max(rect.left - event.clientX, 0, event.clientX - rect.right),
          Math.max(rect.top - event.clientY, 0, event.clientY - rect.bottom),
        );
        return distance(ar) - distance(br);
      }
      return Math.abs(event.clientX - (ar.left + ar.width / 2)) - Math.abs(event.clientX - (br.left + br.width / 2));
    })[0];
    const index = Number(nearest?.dataset.handIndex);
    if (cards[index] && index !== current.index) {
      current.index = index; current.name = cards[index]; current.x = event.clientX; current.y = event.clientY;
      inspect(index);
    }
  };
  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const current = gesture.current;
    if (!enabled || !current || current.id !== event.pointerId) return;
    clearPress();
    gesture.current = null;
    setDragging(false);
    setReordering(null);
    setInspection({ index: -1, name: '' });
    if (current.reordering) {
      const bounds = event.currentTarget.getBoundingClientRect();
      onReorderEnd?.(event.clientX >= bounds.left && event.clientX <= bounds.right && event.clientY >= bounds.top && event.clientY <= bounds.bottom);
    } else if (current.dragging && !current.infoOpened) {
      // The board extends beneath the hand; releasing there must cancel, not place a hidden card.
      if (event.clientY < event.currentTarget.getBoundingClientRect().top) {
        window.dispatchEvent(new CustomEvent('card-pointer-drop', { detail: {
          cardName: current.name, clientX: event.clientX, clientY: event.clientY - getCardDragLift(event.pointerType, true, getDragBoardCellSize(event.currentTarget.ownerDocument)),
        } }));
      }
      onEnd();
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  return { inspected, dragging, reordering: enabled && reordering && cards[reordering.index] === reordering.name ? reordering : null, inspect, handlers: enabled ? {
    onPointerDown, onPointerMove, onPointerUp, onPointerCancel: cancel,
    onLostPointerCapture: () => { if (gesture.current) cancel(); },
  } : {} };
}
