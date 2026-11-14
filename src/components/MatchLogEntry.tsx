import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { GameState } from '../types';
import { getHistoricalMoveScore } from '../scoring/scoreExplanations';
import { MoveScoreDetails } from './ScoreDetails';

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
  const pinned = useRef(false);
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
  const closeSoon = () => { keepOpen(); if (!pinned.current) timer.current = setTimeout(() => setPosition(null), 180); };
  const open = () => {
    keepOpen();
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    const width = Math.min(460, window.innerWidth - 24);
    setPosition({
      left: Math.max(12, Math.min(window.innerWidth - width - 12, rect.left - width - 10)),
      top: Math.max(12, rect.top),
    });
  };
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  useEffect(() => {
    if (!position) return;
    const close = () => { pinned.current = false; setPosition(null); };
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
      onClick={() => { pinned.current = true; open(); }}>
      <span className={`log-player log-player-${seat}`}>{name}</span>
      <span className="log-card">{card}</span><strong>+{total}</strong>
    </button>
    {position && createPortal(<section id={id} role="dialog" aria-label="Подробности хода"
      ref={element => {
        if (!element) return;
        const anchorTop = buttonRef.current?.getBoundingClientRect().top ?? position.top;
        element.style.top = `${Math.max(12, Math.min(anchorTop, window.innerHeight - element.getBoundingClientRect().height - 12))}px`;
      }}
      className="log-detail-popover" style={position} onMouseEnter={keepOpen} onMouseLeave={closeSoon}
      onFocus={keepOpen} onBlur={closeSoon}>
      <header><strong>{name} · {card}</strong><span className="log-detail-total">+{total}</span><button type="button" aria-label="Закрыть подробности" onClick={() => { pinned.current = false; setPosition(null); }}>×</button></header>
      {historicalScore?.edges.length ? <MoveScoreDetails score={historicalScore}
        relations={historicalScore.edges.map(edge => {
          const index = detail?.score.semanticScore?.edges.findIndex(saved => saved.pendingEdgeId === edge.pendingEdgeId) ?? -1;
          return index >= 0 ? detail?.relations[index] : undefined;
        })} />
        : detail?.relations.length ? detail.relations.map((relation, index) => <p className="log-edge-detail" key={index}>{relation}</p>)
          : <p>Для этого хода сохранён только итог. Подробности доступны для новых ходов.</p>}
    </section>, document.body)}
  </li>;
}
