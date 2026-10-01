import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { TrainingPhase } from '../tutorial/trainingGame';

interface Props {
  phase: TrainingPhase; ready: boolean; feedback: string; dragging: boolean;
  onBegin: () => void; onClose: () => void;
}

export function TrainingHint({ phase, ready, feedback, dragging, onBegin, onClose }: Props) {
  const box = useRef<HTMLElement>(null);
  const arrow = useRef<HTMLSpanElement>(null);
  const ring = useRef<HTMLDivElement>(null);
  const [message, setMessage] = useState('');
  useEffect(() => {
    let frame = 0, lastMessage = '';
    const find = (selector: string, text?: string) => Array.from(document.querySelectorAll<HTMLElement>(selector))
      .find(el => !el.closest('[inert]') && (!text || el.textContent?.trim() === text));
    const update = () => {
      let target: HTMLElement | undefined;
      let text: string;
      const editor = find('.semantic-relation-popover');
      if (phase === 'intro') {
        target = find('.training-session .card-in-cell', 'Эмоция');
        text = 'Это нейтральная карта. Она не принадлежит игрокам. Начните строить связи рядом с ней.';
      } else if (phase === 'place') {
        target = find('.training-session .card', 'Радость');
        text = 'Перетащите «Радость» на подсвеченную клетку рядом с «Эмоцией». Можно просто нажать на клетку.';
      } else if (phase === 'relation' && editor) {
        const kind = find('.semantic-popover-chips button', 'Вид');
        const source = find('.semantic-popover-source button', 'Радость');
        if (kind?.getAttribute('aria-pressed') !== 'true') {
          target = kind; text = 'Выберите «Вид»: радость — вид эмоции.';
        } else if (source?.getAttribute('aria-pressed') !== 'true') {
          target = source; text = 'Выберите «Радость»: она является видом эмоции. Так вы задаёте направление связи.';
        } else {
          target = find('.semantic-popover-primary'); text = 'Всё верно: радость — вид эмоции. Добавьте связь.';
        }
      } else if (phase === 'relation') {
        target = ready ? find('.semantic-submit-popover button', 'На голосование')
          : find('.training-session button[aria-label="Связь между Радость и Эмоция"]');
        text = ready ? 'Связь выбрана. Отправьте её на голосование.' : 'Нажмите «+» между картами, чтобы выбрать связь.';
      } else if (phase === 'voting') {
        target = find('.training-session .card-in-cell', 'Радость');
        text = 'Учебный соперник рассматривает связь. В обычной партии решение принимают остальные игроки.';
      } else {
        target = find('.training-session .player-score-total');
        text = 'Связь принята: +1 очко. В руку пришла новая карта, ход перешёл сопернику. Подробности хода — в логе справа.';
      }
      if (text !== lastMessage) { lastMessage = text; setMessage(text); }
      const hint = box.current, pointer = arrow.current, outline = ring.current;
      if (hint && pointer && outline) {
        const rect = target?.getBoundingClientRect();
        const visible = rect && rect.width > 0 && rect.bottom > 0 && rect.top < innerHeight && rect.right > 0 && rect.left < innerWidth && !dragging;
        hint.style.visibility = visible ? 'visible' : 'hidden';
        outline.style.visibility = visible ? 'visible' : 'hidden';
        if (visible && rect) {
          // Keep the hint outside the editor, leaving all relation controls accessible.
          const bounds = phase === 'relation' && editor ? editor.getBoundingClientRect() : rect;
          const w = hint.offsetWidth, h = hint.offsetHeight, gap = 14, margin = 10;
          const cx = (rect.left + rect.right) / 2, cy = (rect.top + rect.bottom) / 2;
          const candidates = [
            { side: 'top', x: cx - w / 2, y: bounds.top - h - gap },
            { side: 'bottom', x: cx - w / 2, y: bounds.bottom + gap },
            { side: 'right', x: bounds.right + gap, y: cy - h / 2 },
            { side: 'left', x: bounds.left - w - gap, y: cy - h / 2 },
          ];
          const overflow = (p: typeof candidates[number]) => Math.max(0, margin - p.x) + Math.max(0, p.x + w + margin - innerWidth) + Math.max(0, margin - p.y) + Math.max(0, p.y + h + margin - innerHeight);
          const chosen = candidates.sort((a, b) => overflow(a) - overflow(b))[0];
          const x = Math.max(margin, Math.min(chosen.x, innerWidth - w - margin));
          const y = Math.max(margin, Math.min(chosen.y, innerHeight - h - margin));
          hint.style.left = x + 'px'; hint.style.top = y + 'px'; hint.dataset.side = chosen.side;
          const vertical = chosen.side === 'top' || chosen.side === 'bottom';
          pointer.style.left = vertical ? Math.max(16, Math.min(w - 24, cx - x - 5)) + 'px' : '';
          pointer.style.top = vertical ? '' : Math.max(16, Math.min(h - 24, cy - y - 5)) + 'px';
          Object.assign(outline.style, { left: rect.left - 3 + 'px', top: rect.top - 3 + 'px', width: rect.width + 6 + 'px', height: rect.height + 6 + 'px' });
        }
      }
      frame = requestAnimationFrame(update);
    };
    frame = requestAnimationFrame(update);
    return () => cancelAnimationFrame(frame);
  }, [phase, ready, dragging]);

  return createPortal(<>
    <div ref={ring} className="training-target-ring" aria-hidden="true" />
    <section ref={box} className="training-guide" aria-label="Подсказка обучения">
      <span ref={arrow} className="training-guide-arrow" aria-hidden="true" />
      <button className="training-close" type="button" onClick={onClose} aria-label="Выйти из обучения">×</button>
      <div aria-live="polite" aria-atomic="true"><p>{message}</p>
        {feedback && <p className="training-feedback">{feedback}</p>}
      </div>
      {phase === 'intro' && <button className="training-primary" onClick={onBegin}>Далее</button>}
      {phase === 'complete' && <button className="training-primary" onClick={onClose}>Вернуться к игре</button>}
    </section>
  </>, document.body);
}
