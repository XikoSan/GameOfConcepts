import { createPortal } from 'react-dom';
import type { WordReorderPosition } from '../hooks/useFanHand';
import './WordReorderPreview.css';

export function WordReorderPreview({ position, playerColor }: {
  position: WordReorderPosition;
  playerColor: 'blue' | 'orange' | 'green' | 'purple';
}) {
  return createPortal(
    <div className={`word-reorder-preview player-${playerColor}`} aria-hidden="true" style={{
      left: position.x - position.offsetX,
      top: position.y - position.offsetY,
      width: position.width,
      height: position.height,
      fontSize: position.fontSize,
      transform: `translate(-50%, -50%) rotate(${position.tilt})`,
    }}>{position.name}</div>,
    document.body,
  );
}
