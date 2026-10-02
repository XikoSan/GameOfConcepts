import type { ReactNode } from 'react';
import { TableReminder } from './TableReminder';
import { useEffect, useReducer, useRef, useState } from 'react';
import { createTrainingState, trainingReducer } from '../tutorial/trainingGame';
import { GameBoard } from './GameBoard';
import { PlayerHand } from './PlayerHand';
import { DragPreviewLayer } from './DragPreviewLayer';
import { MatchLogEntry } from './MatchLogEntry';
import './TrainingGame.css';
import { TrainingHint } from './TrainingHint';
import localSetupImage from '../assets/tutorial/start-local.png';
import onlineSetupImage from '../assets/tutorial/start-online.png';

const noop = () => {};
interface TrainingGameProps {
  onClose: () => void; controls: ReactNode; onOpenRules: () => void; onOpenSettings: () => void;
}

export function TrainingGame(props: TrainingGameProps) {
  const [showSetup, setShowSetup] = useState(true);
  const [setupMode, setSetupMode] = useState<'local' | 'online'>('local');
  const nextButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!showSetup) return;
    const previous = document.activeElement as HTMLElement | null;
    nextButton.current?.focus();
    return () => previous?.focus();
  }, [showSetup]);
  return <>
    <TrainingTable {...props} paused={showSetup} />
    {showSetup && <div className="training-start-screen" role="dialog" aria-modal="true" aria-labelledby="training-start-title"
    onKeyDown={event => {
      if (event.key === 'Escape') props.onClose();
      if (event.key === 'Tab') {
        const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button'));
        const first = buttons[0], last = buttons.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    }}>
    <section className="training-start-panel">
      <header><h2 id="training-start-title">Добро пожаловать в обучение</h2>
        <button type="button" className="training-start-close" onClick={props.onClose} aria-label="Выйти из обучения">×</button>
      </header>
      <p className="training-start-summary">Для начала игры нужно выбрать тему колоды, количество игроков и имена участников.</p>
      <div id="training-setup-panel" className="training-start-examples" aria-label={setupMode === 'local' ? 'Запуск локальной игры' : 'Подключение онлайн'}>
        {setupMode === 'local' ? <figure className="training-example-local">
          <div className="training-start-image"><img src={localSetupImage} alt="Окно локальной игры: количество игроков, выбор колоды и имена участников" /></div>
        </figure> : <figure className="training-example-online">
          <div className="training-start-image training-start-image-online"><img src={onlineSetupImage} alt="Окно онлайн-игры: никнейм, количество игроков, колода и список доступных комнат" /></div>
          <figcaption className="training-room-note">Узнайте у друга название комнаты, найдите её в списке и нажмите «Подключиться».</figcaption>
        </figure>}
      </div>
      <footer className="training-start-footer">
        <div className="training-mode-switch" role="group" aria-label="Режим игры">
          <button type="button" aria-pressed={setupMode === 'local'} aria-controls="training-setup-panel" onClick={() => setSetupMode('local')}>Локально</button>
          <button type="button" aria-pressed={setupMode === 'online'} aria-controls="training-setup-panel" onClick={() => setSetupMode('online')}>Онлайн</button>
        </div>
        <button ref={nextButton} type="button" className="training-primary" onClick={() => setShowSetup(false)}>К игре</button>
      </footer>
    </section>
  </div>}
  </>;

}

function TrainingTable({ onClose, controls, onOpenRules, onOpenSettings, paused }: TrainingGameProps & { paused: boolean }) {
  const [state, dispatch] = useReducer(trainingReducer, undefined, createTrainingState);
  const [camera, setCamera] = useState(0);
  const [drag, setDrag] = useState<{ cardName: string; initialX: number; initialY: number; playerColor: 'blue' | 'orange' | 'green' | 'purple' } | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const { game, phase, feedback } = state;
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
    if (phase !== 'voting') return;
    const timer = window.setTimeout(() => dispatch({ type: 'accept' }), 1800);
    return () => window.clearTimeout(timer);
  }, [phase]);

  return <div ref={root} inert={paused} aria-hidden={paused ? true : undefined} className="training-session" role="dialog" aria-modal="true" aria-label="Учебная партия">
    <main className="game-table"><section className="play-area" aria-label="Игровой стол">
      <header className="table-status-bar">
        <div className="table-players" aria-label="Игроки и счёт">
          {['Вы', 'Учебный соперник'].map((name, index) => <div key={name}
            className={`score-row player-score-${index === 0 ? 'blue' : 'orange'} ${game.currentPlayerIndex === index ? 'active-score' : ''}`}>
            <div className="player-score-content"><div className="player-score-points">
              <strong className="player-score-total">{game.scores[index]}</strong>
              {index === 0 && phase === 'complete' && <span className="player-score-gain">+1</span>}
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
            selectedCard={phase === 'place' ? 'Радость' : null}
            onPlaceCard={(name, position) => { setDrag(null); dispatch({ type: 'place', name, position }); }}
            onFinishDrag={() => setDrag(null)} showPlayableHighlights={phase === 'place'} showTooltips={false}
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
        <div className="table-hand-tray" aria-label="Ваша учебная рука">
          <PlayerHand playerNumber={0} cards={game.players[0].cards} deckCount={game.deck[0].length}
            selectedCard={phase === 'place' ? 'Радость' : null} isActive={phase === 'place'} displayName="Вы"
            onStartCardDrag={(cardName, playerColor, event) => {
              if (cardName !== 'Радость') { event.preventDefault(); dispatch({ type: 'hint', text: 'Сейчас попробуем ход с картой «Радость».' }); return; }
              setDrag({ cardName, playerColor, initialX: event.clientX, initialY: event.clientY });
            }}
            onCancelCardDrag={() => setDrag(null)}
            onOpenDictionary={() => dispatch({ type: 'hint', text: 'В обычной игре здесь открывается справка. Сейчас попробуем сыграть «Радость».' })} />
          <div className="hand-actions"><button className="action-button action-button-quiet hand-redraw-button" type="button" disabled aria-label="Пересдать руку" title="В первом учебном ходе используем подготовленную руку">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 7v5h-5M4 17v-5h5"/><path d="M6.1 7a7 7 0 0 1 11.6-1L20 9M4 15l2.3 3A7 7 0 0 0 17.9 17"/></svg>
          </button><p className="hand-redraw-caption">Пересдача руки</p></div>
        </div>
      </div>
      <aside className="turn-sidebar" aria-label="Управление партией и ходом">
        {controls}
        <section className="sidebar-log" aria-label="Лог партии"><h3>Лог партии</h3>
          {game.log.length ? <ol className="match-log">{game.log.map((event, index) => <MatchLogEntry key={index} event={event} detail={game.logDetails?.[index]} names={['Вы', 'Учебный соперник']} />)}</ol> : <p>Принятые ходы появятся здесь.</p>}
        </section>
        <TableReminder snapshot={game.deckSnapshot} />
      </aside>
      </div>
    </section></main>
    {!paused && <TrainingHint phase={phase} ready={ready} feedback={feedback} dragging={Boolean(drag)} onBegin={() => dispatch({ type: 'begin' })} onClose={onClose} />}
    {drag && <DragPreviewLayer {...drag} />}
  </div>;
}
