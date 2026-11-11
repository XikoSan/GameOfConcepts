import { useEffect, useRef, useState } from 'react';
import type { PointerEvent } from 'react';

interface Options {
  enabled: boolean;
  active: boolean;
  cards: string[];
  preferred?: string;
  onStart: (index: number, event: PointerEvent<HTMLDivElement>) => void;
  onEnd: () => void;
  onInfo: (index: number) => void;
}

// Capture the hand so a horizontal gesture can browse cards without lifting a finger.
export function useFanHand({ enabled, active, cards, preferred, onStart, onEnd, onInfo }: Options) {
  const [inspection, setInspection] = useState<{ index: number; name: string } | null>(null);
  const [dragging, setDragging] = useState(false);
  const suggestedIndex = preferred ? cards.indexOf(preferred) : -1;
  const inspected = inspection && cards[inspection.index] === inspection.name ? inspection.index : suggestedIndex >= 0 ? suggestedIndex : null;
  const gesture = useRef<{ id: number; index: number; name: string; x: number; y: number; moved: boolean; dragging: boolean; repeat: boolean } | null>(null);
  const end = useRef(onEnd);
  useEffect(() => { end.current = onEnd; }, [onEnd]);
  useEffect(() => () => {
    const wasDragging = gesture.current?.dragging;
    gesture.current = null;
    if (wasDragging) end.current();
  }, [enabled]);
  useEffect(() => {
    const reset = () => {
      const wasDragging = gesture.current?.dragging;
      gesture.current = null;
      setDragging(false);
      if (wasDragging) end.current();
    };
    window.addEventListener('blur', reset);
    window.addEventListener('resize', reset);
    return () => { window.removeEventListener('blur', reset); window.removeEventListener('resize', reset); };
  }, []);

  const inspect = (index: number) => setInspection({ index, name: cards[index] });
  const cancel = () => {
    const wasDragging = gesture.current?.dragging;
    gesture.current = null;
    setDragging(false);
    if (wasDragging) onEnd();
  };
  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!enabled || !event.isPrimary || event.button !== 0) return;
    const element = (event.target as HTMLElement).closest<HTMLElement>('[data-hand-index]');
    if (!element) return;
    const index = Number(element.dataset.handIndex);
    if (!cards[index]) return;
    gesture.current = { id: event.pointerId, index, name: cards[index], x: event.clientX, y: event.clientY,
      moved: false, dragging: false, repeat: inspected === index };
    inspect(index);
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const current = gesture.current;
    if (!enabled || !current || current.id !== event.pointerId || current.dragging) return;
    if (cards[current.index] !== current.name) { cancel(); return; }
    const dx = event.clientX - current.x, dy = event.clientY - current.y;
    if (Math.hypot(dx, dy) > 8) current.moved = true;
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
      return Math.abs(event.clientX - (ar.left + ar.width / 2)) - Math.abs(event.clientX - (br.left + br.width / 2));
    })[0];
    const index = Number(nearest?.dataset.handIndex);
    if (cards[index] && index !== current.index) {
      current.index = index; current.name = cards[index]; current.x = event.clientX; current.y = event.clientY;
      current.repeat = false;
      inspect(index);
    }
  };
  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const current = gesture.current;
    if (!enabled || !current || current.id !== event.pointerId) return;
    gesture.current = null;
    setDragging(false);
    if (current.dragging) {
      // The board extends beneath the hand; releasing there must cancel, not place a hidden card.
      if (event.clientY < event.currentTarget.getBoundingClientRect().top) {
        window.dispatchEvent(new CustomEvent('card-pointer-drop', { detail: {
          cardName: current.name, clientX: event.clientX, clientY: event.clientY - (event.pointerType === 'mouse' ? 0 : 44),
        } }));
      }
      onEnd();
      setInspection(null);
    } else if (!current.moved && current.repeat) onInfo(current.index);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  return { inspected, dragging, inspect, handlers: enabled ? {
    onPointerDown, onPointerMove, onPointerUp, onPointerCancel: cancel, onLostPointerCapture: cancel,
  } : {} };
}
