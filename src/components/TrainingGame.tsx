// Training UI over the scripted training controller. Reuse core move/scoring rules while keeping the teaching sequence separate from ordinary games.
import type { ReactNode } from 'react';
import { TableReminder } from './TableReminder';
import { useEffect, useReducer, useRef, useState } from 'react';
import { createTrainingState, trainingReducer, type TrainingState } from '../tutorial/trainingGame';
import { GameBoard } from './GameBoard';
import { PlayerHand } from './PlayerHand';
import { DragPreviewLayer } from './DragPreviewLayer';
import { MatchLogEntry } from './MatchLogEntry';
import './TrainingGame.css';
import { TrainingHint } from './TrainingHint';
import { TableSidebar } from './TableSidebar';
import { useCompactTable } from '../hooks/useCompactTable';

const noop = () => {};
interface TrainingGameProps {
  initialState?: TrainingState; onStateChange?: (state: TrainingState) => void;
  onClose: () => void; controls: ReactNode; onOpenRules: () => void; onOpenSettings: () => void; paused?: boolean; playerName?: string;
}

export function TrainingGame({ onClose, controls, onOpenRules, onOpenSettings, paused = false, playerName = 'Вы', initialState, onStateChange }: TrainingGameProps) {
  const [state, dispatch] = useReducer(trainingReducer, initialState, saved => saved ?? createTrainingState());
  useEffect(() => { onStateChange?.(state); }, [state, onStateChange]);
  const [camera, setCamera] = useState(0);
  const compact = useCompactTable();
  const [actionDock, setActionDock] = useState<HTMLDivElement | null>(null);
  const [drag, setDrag] = useState<{ cardName: string; initialX: number; initialY: number; playerColor: 'blue' | 'orange' | 'green' | 'purple' } | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const { game, phase, selected } = state;
  const ready = Boolean(game.pendingMove?.semanticEdges?.length);

  useEffect(() => {
    if (paused) return;
    const previous = document.activeElement as HTMLElement | null;
    document.querySelector<HTMLButtonElement>('.training-primary')?.focus();
    // Include board popovers: these are rendered in a portal outside the dialog.
    const trap = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const buttons = Array.from(document.querySelectorAll<HTMLElement>(
        '.training-session button, .training-guide button, .semantic-submit-popover button, .semantic-relation-popover button, .log-detail-popover button'
      )).filter(el => !el.closest('[inert]') && !el.hasAttribute('disabled') && el.getClientRects().length > 0);
      const first = buttons[0], last = buttons.at(-1);
      if (!first || !last) return;
      if (event.shiftKey && (document.activeElement === first || !buttons.includes(document.activeElement as HTMLElement))) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !buttons.includes(document.activeElement as HTMLElement))) {
        event.preventDefault(); first.focus();
      }
    };
    document.addEventListener('keydown', trap);
    return () => { document.removeEventListener('keydown', trap); previous?.focus(); };
  }, [paused]);

  useEffect(() => {
    if (phase !== 'voting' || paused) return;
    const timer = window.setTimeout(() => dispatch({ type: 'accept' }), 7000 / 3);
    return () => window.clearTimeout(timer);
  }, [phase, paused]);

  return <div ref={root} inert={paused} aria-hidden={paused ? true : undefined} className="training-session" role="dialog" aria-modal="true" aria-label="Учебная партия">
    <main className="game-table"><section className="play-area" aria-label="Игровой стол">
      <header className="table-status-bar">
        <div className="table-players" aria-label="Игроки и счёт">
          {[playerName, 'Учебный соперник'].map((name, index) => <div key={name}
            className={`score-row player-score-${index === 0 ? 'blue' : 'orange'} ${game.currentPlayerIndex === index ? 'active-score' : ''}`}>
            <div className="player-score-content"><div className="player-score-points">
              <strong className="player-score-total">{game.scores[index]}</strong>
            </div><div className="player-score-identity"><span className="player-score-name">{name}</span>
              {game.currentPlayerIndex === index && <small className="player-score-status">ХОД</small>}
            </div></div>
          </div>)}
        </div>
        <nav className="table-menu" aria-label="Меню игры">
          <button className="table-menu-tutorial" type="button" onClick={onClose}>Меню</button>
          <button className="table-menu-rules" type="button" onClick={onOpenRules}>Правила</button>
          <button className="table-menu-settings" type="button" onClick={onOpenSettings}>Настройки</button>
        </nav>
      </header>
      <div className="table-workspace"><div className="table-center">
        <div className="board-section">
          <GameBoard gameState={game} resetCameraSignal={camera}
            actionDock={compact && phase !== 'explain' && phase !== 'opponent' ? actionDock : null}
            selectedCard={phase === 'place' ? (selected ?? drag?.cardName ?? null) : null}
            onPlaceCard={(name, position) => { setDrag(null); dispatch({ type: 'place', name, position }); }}
            onFinishDrag={() => setDrag(null)} showPlayableHighlights={phase === 'place'} showTooltips={true}
            canReviewPendingMove={false} showPendingWaitBadge={false}
            onConfirmPendingMove={noop} onReturnPendingMove={noop} canReviewPendingCross={false}
            pendingCrossReviewerLabel="" onApprovePendingCross={noop} onRejectPendingCross={noop}
            canEditSemanticMove={phase === 'relation'} canSubmitSemanticMove={phase === 'relation' && ready}
            onUpsertSemanticEdge={(neighbor, relation, direction) => dispatch({ type: 'relation', neighbor, relation, direction })}
            onRemoveSemanticEdge={neighbor => dispatch({ type: 'remove', neighbor })}
            onSubmitSemanticMove={() => dispatch({ type: 'submit' })} onCancelPendingMove={() => dispatch({ type: 'cancel' })} />
          <div className="board-tools"><button className="center-board-button" type="button" onClick={() => setCamera(v => v + 1)} aria-label="Центрировать поле">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><circle cx="12" cy="12" r="6"/><path d="M12 2v4m0 12v4M2 12h4m12 0h4"/><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/></svg>
          </button></div>

        </div>
        <div className={`table-hand-tray ${compact && game.pendingMove ? 'has-mobile-actions' : ''}`} aria-label="Ваша учебная рука">
          <div className="mobile-action-dock" ref={setActionDock} />
          <PlayerHand playerNumber={0} cards={game.players[0].cards} deckCount={game.deck[0].length}
            selectedCard={phase === 'place' ? (selected ?? null) : null} isActive={phase === 'place'} displayName={playerName}
            onStartCardDrag={(cardName, playerColor, event) => {
              if (phase !== 'place') { event.preventDefault(); return; }
              dispatch({ type: 'select', name: cardName }); setDrag({ cardName, playerColor, initialX: event.clientX, initialY: event.clientY });
            }}
            onCancelCardDrag={() => setDrag(null)}
            onOpenDictionary={name => dispatch({ type: 'select', name })} />
          <div className="hand-actions"><button className="action-button action-button-quiet hand-redraw-button" type="button" disabled aria-label="Пересдать руку" title="Пересдача руки отключена на протяжении обучения">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 7v5h-5M4 17v-5h5"/><path d="M6.1 7a7 7 0 0 1 11.6-1L20 9M4 15l2.3 3A7 7 0 0 0 17.9 17"/></svg>
          </button><p className="hand-redraw-caption">Пересдача руки</p></div>
        </div>
      </div>
      <TableSidebar controls={controls} log={<section className="sidebar-log" aria-label="Лог партии"><h3>Лог партии</h3>
          {game.log.length ? <ol className="match-log">{game.log.map((event, index) => <MatchLogEntry key={index} event={event} detail={game.logDetails?.[index]} names={[playerName, 'Учебный соперник']} />)}</ol> : <p>Принятые ходы появятся здесь.</p>}
        </section>} reminder={<TableReminder snapshot={game.deckSnapshot} />} />
      </div>
    </section></main>
    {!paused && <TrainingHint actionDock={compact ? actionDock : null} state={state} dragging={Boolean(drag)} dispatch={dispatch} onClose={onClose} />}
    {drag && <DragPreviewLayer {...drag} />}
  </div>;
}
