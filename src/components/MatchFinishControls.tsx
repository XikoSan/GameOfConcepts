import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { getPassAvailability, isDrawPileExhausted, type GameState } from '../game';
import { Modal } from './Modal';
import { MatchResultsDialog } from './MatchResultsDialog';
import './MatchFinishControls.css';

interface MatchFinishControlsProps {
  game: GameState;
  players: { seatIndex: number; nickname: string; color?: string }[];
  localPlayerIndex: number | null;
  online: boolean;
  active: boolean;
  enabled: boolean;
  modalRoot: HTMLElement | null;
  error: string | null;
  onPass: () => void | Promise<void>;
  onRequestFinish: () => void | Promise<void>;
  onVote: (accept: boolean) => void | Promise<void>;
  onNewGame: () => void;
  onMenu: () => void;
}

export function MatchFinishControls({ game, players, localPlayerIndex, online, active, enabled, modalRoot,
  error, onPass, onRequestFinish, onVote, onNewGame, onMenu }: MatchFinishControlsProps) {
  const [confirmation, setConfirmation] = useState<'pass' | 'finish' | null>(null);
  const [hiddenVoteId, setHiddenVoteId] = useState<string | null>(null);
  const [resultHidden, setResultHidden] = useState(false);
  const [busy, setBusy] = useState(false);
  const [attemptedAction, setAttemptedAction] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const resultsButtonRef = useRef<HTMLButtonElement>(null);
  const closeResults = () => {
    setResultHidden(true);
    window.requestAnimationFrame(() => resultsButtonRef.current?.focus());
  };
  const pending = game.pendingFinish;
  const exhausted = isDrawPileExhausted(game);
  const actingSeat = online ? localPlayerIndex : game.currentPlayerIndex;
  const availability = getPassAvailability(game, actingSeat ?? -1);
  const canRequest = enabled && !game.gameOver && !pending && !game.pendingMove && !game.pendingCross &&
    !exhausted && actingSeat === game.currentPlayerIndex;
  const playerName = (seat: number) => players.find(player => player.seatIndex === seat)?.nickname || `Игрок ${seat + 1}`;
  const nextVoter = pending
    ? game.players.findIndex((_, seat) => !Object.hasOwn(pending.votes, String(seat)))
    : -1;
  const voter = online ? localPlayerIndex : nextVoter;
  const canVote = Boolean(pending && voter !== null && voter >= 0 && !Object.hasOwn(pending.votes, String(voter)));
  const passLimit = game.players.length - 1;
  const passWillFinish = (game.consecutivePasses ?? 0) + 1 >= passLimit;
  const visibleError = actionError || (attemptedAction ? error : null);

  const runAction = async (action: () => void | Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setAttemptedAction(true);
    setActionError(null);
    try {
      await action();
      setConfirmation(null);
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : 'Не удалось выполнить действие. Повторите попытку.');
    } finally {
      setBusy(false);
    }
  };
  const openConfirmation = (value: 'pass' | 'finish') => {
    setAttemptedAction(false);
    setActionError(null);
    setConfirmation(value);
  };
  const errorMessage = visibleError && <p className="match-finish-error" role="alert">{visibleError}</p>;

  return <>
    <div className="match-finish-tools">
      {game.gameOver ? <button ref={resultsButtonRef} type="button" onClick={() => setResultHidden(false)}>Итоги партии</button>
        : pending ? <button type="button" onClick={() => setHiddenVoteId(null)}>Голосование о завершении</button>
          : exhausted ? <button type="button" disabled={!enabled || !availability.canPass || busy} title={availability.reason || 'Пропустить ход'} onClick={() => openConfirmation('pass')}>Пас</button>
            : <button type="button" disabled={!canRequest || busy} title={canRequest ? 'Предложить всем игрокам завершить партию' : 'Доступно в свой ход, после завершения текущих решений'} onClick={() => openConfirmation('finish')}>Завершить по согласию</button>}
      {visibleError && !confirmation && !pending && !game.gameOver && errorMessage}
    </div>
    {modalRoot && createPortal(<>
    {active && confirmation && !pending && !game.gameOver && <Modal title={confirmation === 'pass' ? 'Спасовать?' : 'Завершить по согласию?'} onClose={() => { if (!busy) setConfirmation(null); }}>
      <div className="match-finish-dialog">
        {confirmation === 'pass' ? <>
          <p>Колода закончилась. Пас передаёт ход без розыгрыша карты.</p>
          <p>{game.players.length === 2 ? 'Вдвоём один пас сразу завершает партию.' : `${passLimit} паса подряд завершают партию: оставшийся игрок не получает одиночного хода. Принятый ход сбрасывает серию пасов.`}</p>
          <p><strong>{passWillFinish ? 'Этот пас завершит партию. Победитель определяется по текущим очкам.' : `Пасов подряд сейчас: ${game.consecutivePasses ?? 0} из ${passLimit}.`}</strong></p>
        </> : <p>Предложить закончить партию сейчас и сравнить набранные очки? Нужно согласие всех игроков. Если кто-то откажется, партия продолжится с текущего хода.</p>}
        {errorMessage}
        <div className="modal-actions">
          <button type="button" disabled={busy} onClick={() => setConfirmation(null)}>Отмена</button>
          <button type="button" disabled={!enabled || busy || (confirmation === 'pass' ? !availability.canPass : !canRequest)} onClick={() => void runAction(confirmation === 'pass' ? onPass : onRequestFinish)}>{busy ? 'Отправка…' : confirmation === 'pass' ? 'Подтвердить пас' : 'Предложить завершение'}</button>
        </div>
      </div>
    </Modal>}
    {active && pending && hiddenVoteId !== pending.id && !game.gameOver && <Modal title="Завершить партию?" onClose={() => setHiddenVoteId(pending.id)}>
      <div className="match-finish-dialog">
        <p><strong>{playerName(pending.requestedBy)}</strong> предлагает завершить партию по текущему счёту. Нужно согласие всех игроков; любой отказ возвращает игру к текущему ходу.</p>
        <ul className="match-finish-voters">{players.map(player => <li key={player.seatIndex}><span>{player.nickname}</span><strong>{pending.votes[String(player.seatIndex)] === true ? 'Согласен' : 'Ожидаем'}</strong></li>)}</ul>
        {canVote ? <p aria-live="polite">{online ? 'Ваше решение' : `Голосует: ${playerName(voter!)}`}</p> : <p role="status">Ваше согласие учтено. Ожидаем остальных игроков.</p>}
        {errorMessage}
        {canVote && <div className="modal-actions" key={voter}>
          <button type="button" disabled={busy} onClick={() => void runAction(() => onVote(false))}>Продолжить партию</button>
          <button type="button" disabled={busy} onClick={() => void runAction(() => onVote(true))}>{busy ? 'Отправка…' : 'Согласен завершить'}</button>
        </div>}
      </div>
    </Modal>}
    {game.gameOver && <MatchResultsDialog
      game={game} players={players} open={active && !resultHidden}
      onClose={closeResults} onMenu={onMenu} onNewGame={onNewGame}
    />}
    </>, modalRoot)}
  </>;
}
