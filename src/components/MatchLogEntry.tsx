import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { GameState } from '../types';

interface Props {
  event: string;
  detail: NonNullable<GameState['logDetails']>[number] | undefined;
  names: string[];
}

export function MatchLogEntry({ event, detail, names }: Props) {
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const id = useId();
  const legacy = /^Игрок (\d+) сыграл «(.+)»\. .*\+(\d+)\.$/.exec(event);
  const seat = detail?.score.playerId ?? (legacy ? Number(legacy[1]) - 1 : null);
  const name = seat === null ? '' : names[seat] || `Игрок ${seat + 1}`;
  const card = detail?.score.cardName ?? legacy?.[2];
  const total = detail?.score.totalGained ?? Number(legacy?.[3] ?? 0);
  const keepOpen = () => { if (timer.current) clearTimeout(timer.current); };
  const closeSoon = () => { keepOpen(); timer.current = setTimeout(() => setPosition(null), 180); };
  const open = () => {
    keepOpen();
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    const width = Math.min(340, window.innerWidth - 24);
    const height = Math.min(420, window.innerHeight * 0.65);
    setPosition({
      left: Math.max(12, Math.min(window.innerWidth - width - 12, rect.left - width - 10)),
      top: Math.max(12, Math.min(rect.top, window.innerHeight - height - 12)),
    });
  };
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  useEffect(() => {
    if (!position) return;
    const close = () => setPosition(null);
    const escape = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    const scroll = (e: Event) => {
      if (!(e.target instanceof Element) || !e.target.closest('.log-detail-popover')) close();
    };
    window.addEventListener('keydown', escape);
    window.addEventListener('resize', close);
    window.addEventListener('scroll', scroll, true);
    return () => {
      window.removeEventListener('keydown', escape);
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', scroll, true);
    };
  }, [position]);

  if (!card) return null;
  return <li>
    <button ref={buttonRef} className="log-move-entry" type="button"
      aria-expanded={Boolean(position)} aria-controls={position ? id : undefined}
      onMouseEnter={open} onMouseLeave={closeSoon} onFocus={open} onBlur={closeSoon}
      onClick={open}>
      <span className={`log-player log-player-${seat}`}>{name}</span>
      <span className="log-card">{card}</span><strong>+{total}</strong>
    </button>
    {position && createPortal(<section id={id} role="dialog" aria-label="Подробности хода"
      className="log-detail-popover" style={position} onMouseEnter={keepOpen} onMouseLeave={closeSoon}
      onFocus={keepOpen} onBlur={closeSoon}>
      <header><strong>{name} · {card}</strong><button type="button" aria-label="Закрыть подробности" onClick={() => setPosition(null)}>×</button></header>
      {detail ? detail.relations.map((relation, index) => {
        const score = detail.score.semanticScore?.edges[index];
        return <div className="log-edge-detail" key={index}>
          <p>{relation.replace(' — характеристика понятия «', ' — характеристика «')}</p>
          {score && <small>Связь 1{score.pathBonus ? ' · Путь +1' : ''}{score.nodeBonus ? ' · Узел +1' : ''}<b>+{score.total}</b></small>}
        </div>;
      }) : <p>Для этого хода сохранён только итог. Подробности доступны для новых ходов.</p>}
      <footer>Всего за ход <strong>+{total}</strong></footer>
    </section>, document.body)}
  </li>;
}
