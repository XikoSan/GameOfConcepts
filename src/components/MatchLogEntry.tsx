import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { GameState } from '../types';
import { getHistoricalMoveScore } from '../scoring/scoreExplanations';
import { ScoreDetails } from './ScoreDetails';

interface Props {
  event: string;
  detail: NonNullable<GameState['logDetails']>[number] | undefined;
  names: string[];
  game?: GameState;
  logIndex?: number;
}

export function MatchLogEntry({ event, detail, names, game, logIndex }: Props) {
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const id = useId();
  const legacy = /^Игрок (\d+) сыграл «(.+)»\. .*\+(\d+)\.$/.exec(event);
  const seat = detail?.score.playerId ?? (legacy ? Number(legacy[1]) - 1 : null);
  const name = seat === null ? '' : names[seat] || `Игрок ${seat + 1}`;
  const card = detail?.score.cardName ?? legacy?.[2];
  const total = detail?.score.totalGained ?? Number(legacy?.[3] ?? 0);
  const historicalScore = useMemo(() => game && logIndex !== undefined
    ? getHistoricalMoveScore(game, logIndex) : detail?.score.semanticScore,
  [detail, game, logIndex]);
  const keepOpen = () => { if (timer.current) clearTimeout(timer.current); };
  const closeSoon = () => { keepOpen(); timer.current = setTimeout(() => setPosition(null), 180); };
  const open = () => {
    keepOpen();
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    const width = Math.min(430, window.innerWidth - 24);
    const height = Math.min(620, window.innerHeight - 24);
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
    const outside = (e: PointerEvent) => {
      if (!(e.target instanceof Element) || (!e.target.closest('.log-detail-popover') && !buttonRef.current?.contains(e.target))) close();
    };
    const scroll = (e: Event) => {
      if (!(e.target instanceof Element) || !e.target.closest('.log-detail-popover')) close();
    };
    window.addEventListener('keydown', escape);
    window.addEventListener('pointerdown', outside);
    window.addEventListener('resize', close);
    window.addEventListener('scroll', scroll, true);
    return () => {
      window.removeEventListener('keydown', escape);
      window.removeEventListener('pointerdown', outside);
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
        const savedScore = detail.score.semanticScore?.edges[index];
        const score = historicalScore?.edges.find(edge => edge.pendingEdgeId === savedScore?.pendingEdgeId) ?? savedScore;
        return <div className="log-edge-detail" key={index}>
          {score ? <ScoreDetails score={score} relation={relation.replace(' — характеристика понятия «', ' — характеристика «')} /> : <p>{relation}</p>}
        </div>;
      }) : <p>Для этого хода сохранён только итог. Подробности доступны для новых ходов.</p>}
      <footer>Всего за ход <strong>+{total}</strong></footer>
    </section>, document.body)}
  </li>;
}
