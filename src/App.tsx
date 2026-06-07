import { useEffect, useRef, useState } from 'react';
import type { DragEvent as ReactDragEvent, FormEvent } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { GameBoard } from './components/GameBoard';
import { Modal } from './components/Modal';
import { PlayerHand } from './components/PlayerHand';
import { RulesContent } from './components/RulesContent';
import { useGameState } from './hooks/useGameState';
import { usePlayerIdentity } from './hooks/usePlayerIdentity';
import {
  createRoom,
  getRoomById,
  joinRoom,
  subscribeToRoom,
} from './services/roomService';
import { initializeGame } from './game';
import type { Coordinates, PendingMove, RegularCardName } from './game';
import type { Room } from './types/room';
import './App.css';

const getPlayerLabel = (playerId: 0 | 1) => (playerId === 0 ? 'Игрок 1' : 'Игрок 2');

const getRoomRoleLabel = (room: Room | null, playerId: string) => {
  if (!room) return 'зритель/неизвестно';
  if (room.player_1_id === playerId) return 'Игрок 1';
  if (room.player_2_id === playerId) return 'Игрок 2';
  return 'зритель/неизвестно';
};

const getPendingMovePlayerIndex = (pendingMove: PendingMove | null) =>
  pendingMove?.playerIndex ?? pendingMove?.playerId ?? null;

const getPendingMoveReviewerIndex = (pendingMove: PendingMove | null) =>
  pendingMove?.reviewerIndex ?? pendingMove?.reviewerId ?? null;

interface DragPreview {
  cardName: RegularCardName;
  playerColor: 'blue' | 'orange';
  x: number;
  y: number;
}

type ActiveModal = 'new-game' | 'rules' | 'settings' | null;

const defaultInterfaceSettings = {
  showPlayableHighlights: true,
  showCardTooltips: true,
};

function App() {
  // TEMP(MVP): Комнаты работают без авторизации, игрок определяется через
  // localStorage playerId.
  const playerId = usePlayerIdentity();
  const [selectedCard, setSelectedCard] = useState<RegularCardName | null>(null);
  const [dragPreview, setDragPreview] = useState<DragPreview | null>(null);
  const [activeModal, setActiveModal] = useState<ActiveModal>(null);
  const [resetCameraSignal, setResetCameraSignal] = useState(0);
  const [onlineRoom, setOnlineRoom] = useState<Room | null>(null);
  const [joinCode, setJoinCode] = useState('');
  const [onlineError, setOnlineError] = useState<string | null>(null);
  const [isOnlineLoading, setIsOnlineLoading] = useState(false);
  const [interfaceSettings, setInterfaceSettings] = useState(
    defaultInterfaceSettings
  );
  const roomSubscriptionRef = useRef<RealtimeChannel | null>(null);
  const onlineRoomRef = useRef<Room | null>(null);
  const {
    gameState,
    mode,
    connectionStatus,
    localPlayerIndex,
    error: gameControllerError,
    placeCard,
    confirmCard,
    returnCard,
    approveCross,
    rejectCross,
    resetGame,
    startLocalGame,
  } = useGameState({
    room: onlineRoom,
    localPlayerId: playerId,
    onError: setOnlineError,
    onRoomUpdate: setOnlineRoom,
  });
  const hasPendingDecision = Boolean(gameState.pendingMove || gameState.pendingCross);
  const activeSelectedCard = hasPendingDecision ? null : selectedCard;
  const canControlPlayer = (playerIndex: 0 | 1) =>
    mode === 'local' || localPlayerIndex === playerIndex;
  const canReviewPendingMove =
    mode === 'local' ||
    (localPlayerIndex !== null &&
      getPendingMoveReviewerIndex(gameState.pendingMove) === localPlayerIndex);
  const pendingMovePlayerIndex = getPendingMovePlayerIndex(gameState.pendingMove);
  const pendingMoveReviewerIndex = getPendingMoveReviewerIndex(gameState.pendingMove);
  const canReviewPendingCross =
    mode === 'local' ||
    (localPlayerIndex !== null &&
      Boolean(gameState.pendingCross) &&
      gameState.currentPlayerIndex === localPlayerIndex);

  const handlePlaceCard = (cardName: RegularCardName, coordinates: Coordinates) => {
    if (!selectedCard || hasPendingDecision) return;

    placeCard(cardName, coordinates);
  };

  const handleStartCardDrag = (
    cardName: RegularCardName,
    playerColor: DragPreview['playerColor'],
    event: ReactDragEvent<HTMLDivElement>
  ) => {
    if (hasPendingDecision) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX || rect.left + rect.width / 2;
    const y = event.clientY || rect.top + rect.height / 2;

    setSelectedCard(cardName);
    setDragPreview({
      cardName,
      playerColor,
      x,
      y,
    });
  };

  const handleMoveCardDrag = (event: ReactDragEvent<HTMLDivElement>) => {
    if (event.clientX === 0 && event.clientY === 0) return;

    setDragPreview((preview) =>
      preview ? { ...preview, x: event.clientX, y: event.clientY } : preview
    );
  };

  const handleCancelCardDrag = () => {
    setSelectedCard(null);
    setDragPreview(null);
  };

  const handleResetCamera = () => {
    setResetCameraSignal((signal) => signal + 1);
  };

  const handleConfirmNewGame = () => {
    resetGame();
    setSelectedCard(null);
    setDragPreview(null);
    setResetCameraSignal((signal) => signal + 1);
    setActiveModal(null);
  };

  const handleStartLocalGame = () => {
    // TEMP(MVP): Выход из онлайн-комнаты пока только локальный, без удаления
    // комнаты из Supabase.
    roomSubscriptionRef.current?.unsubscribe();
    roomSubscriptionRef.current = null;
    setOnlineRoom(null);
    setOnlineError(null);
    startLocalGame();
    setSelectedCard(null);
    setDragPreview(null);
    setResetCameraSignal((signal) => signal + 1);
    setActiveModal(null);
  };

  const handleResetSettings = () => {
    setInterfaceSettings(defaultInterfaceSettings);
  };

  const syncOnlineRoom = async (reason: string) => {
    const currentRoom = onlineRoomRef.current;
    if (!currentRoom) return;

    console.log('[online polling fetch]', {
      reason,
      roomId: currentRoom.id,
      currentVersion: currentRoom.version,
    });

    try {
      const fetchedRoom = await getRoomById(currentRoom.id);
      console.log('[manual sync room]', { reason, room: fetchedRoom });

      if (!fetchedRoom) {
        console.warn('[online polling no changes]', {
          reason,
          currentVersion: currentRoom.version,
          fetchedVersion: null,
        });
        return;
      }

      if (fetchedRoom.version > currentRoom.version) {
        console.log('[online polling update applied]', {
          reason,
          previousVersion: currentRoom.version,
          nextVersion: fetchedRoom.version,
        });
        setOnlineRoom(fetchedRoom);
        return;
      }

      console.log('[online polling no changes]', {
        reason,
        currentVersion: currentRoom.version,
        fetchedVersion: fetchedRoom.version,
      });
    } catch (error) {
      console.error('[online polling fetch error]', { reason, error });
    }
  };

  const handleRoomConnected = (room: Room) => {
    roomSubscriptionRef.current?.unsubscribe();
    setOnlineRoom(room);
    setOnlineError(null);
    roomSubscriptionRef.current = subscribeToRoom(room.id, (updatedRoom) => {
      console.log('[app room update]', {
        code: updatedRoom.code,
        version: updatedRoom.version,
        pendingMove: updatedRoom.game_state.pendingMove,
        board: updatedRoom.game_state.board,
      });
      setOnlineRoom(updatedRoom);
    }, () => {
      void syncOnlineRoom('realtime status problem');
    });
  };

  const handleManualSyncRoom = () => {
    void syncOnlineRoom('manual sync');
  };

  const handleCreateOnlineRoom = async () => {
    setIsOnlineLoading(true);
    setOnlineError(null);

    try {
      console.log('[create room click]');
      console.log('[create room playerId]', playerId);
      console.log('[create room env check]', {
        hasUrl: Boolean(import.meta.env.VITE_SUPABASE_URL),
        hasKey: Boolean(import.meta.env.VITE_SUPABASE_ANON_KEY),
      });
      const initialGameState = initializeGame();
      console.log('[create room initialGameState]', initialGameState);
      // TODO(MVP): Пока UI комнаты не подключён к синхронизации ходов.
      const room = await createRoom(playerId, initialGameState);
      handleRoomConnected(room);
    } catch (error) {
      console.error('[create room error]', error);
      if (error instanceof Error) {
        console.error('[create room error message]', error.message);
        console.error('[create room error stack]', error.stack);
      }
      setOnlineError(
        error instanceof Error
          ? `Не удалось создать комнату: ${error.message}`
          : 'Не удалось создать комнату.'
      );
    } finally {
      setIsOnlineLoading(false);
    }
  };

  const handleJoinOnlineRoom = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedCode = joinCode.trim().toUpperCase();

    if (!normalizedCode) {
      setOnlineError('Введите код комнаты.');
      return;
    }

    setIsOnlineLoading(true);
    setOnlineError(null);

    try {
      // TODO(MVP): Пока UI комнаты не подключён к синхронизации ходов.
      const room = await joinRoom(normalizedCode, playerId);
      handleRoomConnected(room);
      setJoinCode(normalizedCode);
    } catch (error) {
      setOnlineError(
        error instanceof Error ? error.message : 'Не удалось войти в комнату.'
      );
    } finally {
      setIsOnlineLoading(false);
    }
  };

  useEffect(() => {
    const updateDragPreviewPosition = (event: globalThis.DragEvent) => {
      if (event.clientX === 0 && event.clientY === 0) return;

      setDragPreview((preview) =>
        preview ? { ...preview, x: event.clientX, y: event.clientY } : preview
      );
    };

    const clearDragState = () => {
      setSelectedCard(null);
      setDragPreview(null);
    };

    window.addEventListener('dragover', updateDragPreviewPosition);
    window.addEventListener('dragend', clearDragState);
    window.addEventListener('drop', clearDragState);
    window.addEventListener('mouseup', clearDragState);

    return () => {
      window.removeEventListener('dragover', updateDragPreviewPosition);
      window.removeEventListener('dragend', clearDragState);
      window.removeEventListener('drop', clearDragState);
      window.removeEventListener('mouseup', clearDragState);
    };
  }, []);

  useEffect(() => {
    onlineRoomRef.current = onlineRoom;
  }, [onlineRoom]);

  useEffect(() => {
    return () => {
      roomSubscriptionRef.current?.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!onlineRoom) return;

    // TEMP(MVP): Realtime остаётся основным каналом, polling нужен как страховка
    // при сетевых сбоях WebSocket/QUIC.
    const pollingId = window.setInterval(() => {
      void syncOnlineRoom('polling');
    }, 4000);

    return () => {
      window.clearInterval(pollingId);
    };
  }, [onlineRoom]);

  return (
    <div className="app-container">
      <main className="game-table">
        <section className="play-area" aria-label="Игровой стол">
          <PlayerHand
            playerNumber={1}
            cards={gameState.players[1].cards}
            deckCount={gameState.deck[1].length}
            hideCards={mode === 'multiplayer' && localPlayerIndex !== 1}
            selectedCard={
              gameState.currentPlayerIndex === 1 && canControlPlayer(1)
                ? activeSelectedCard
                : null
            }
            isActive={
              gameState.currentPlayerIndex === 1 &&
              !hasPendingDecision &&
              canControlPlayer(1)
            }
            onMoveCardDrag={handleMoveCardDrag}
            onStartCardDrag={handleStartCardDrag}
            onCancelCardDrag={handleCancelCardDrag}
          />

          <div className="table-middle">
            <aside className="side-panel party-panel" aria-label="Панель партии">
              <section className="panel-section lobby-section">
                <div className="panel-title-row">
                  <span className="panel-icon" aria-hidden="true">◇</span>
                  <h1>Лобби прототипа</h1>
                  <span className="lobby-tag">#001</span>
                </div>
              </section>

              <section className="panel-section session-section">
                {mode === 'local' ? (
                  <div className="session-summary">
                    <span>Режим</span>
                    <strong>локальная игра</strong>
                  </div>
                ) : (
                  <div className="session-summary">
                    <span>Онлайн</span>
                    <strong>Код: {onlineRoom?.code ?? '-'}</strong>
                    <small>Роль: {getRoomRoleLabel(onlineRoom, playerId)}</small>
                    <small>
                      Статус:{' '}
                      {connectionStatus === 'connected'
                        ? 'connected'
                        : onlineRoom?.status ?? connectionStatus}
                    </small>
                  </div>
                )}
              </section>

              <section className="panel-section players-score-section">
                <h2>Игроки</h2>
                <div className="score-row player-score-blue">
                  <span>Игрок 1</span>
                  <strong>{gameState.scores[0]}</strong>
                </div>
                <div className="score-row player-score-orange">
                  <span>Игрок 2</span>
                  <strong>{gameState.scores[1]}</strong>
                </div>
              </section>

              <section className="panel-section log-section">
                <h2>Лог партии</h2>
                <div className="log-placeholder">
                  {gameState.log.length > 0 ? (
                    <ol className="match-log">
                      {gameState.log.map((event, index) => (
                        <li key={`${event}-${index}`}>{event}</li>
                      ))}
                    </ol>
                  ) : (
                    <>
                      <span className="log-icon" aria-hidden="true">✧</span>
                      <p>События партии появятся здесь.</p>
                      <small>Заглушка под будущий журнал ходов.</small>
                    </>
                  )}
                </div>
              </section>
            </aside>

            <div className="board-section">
              <GameBoard
                key={`${gameState.startCard.id}-${resetCameraSignal}`}
                gameState={gameState}
                selectedCard={activeSelectedCard}
                onPlaceCard={handlePlaceCard}
                onFinishDrag={handleCancelCardDrag}
                showPlayableHighlights={interfaceSettings.showPlayableHighlights}
                showTooltips={interfaceSettings.showCardTooltips}
              />
            </div>

            <aside className="side-panel control-panel" aria-label="Панель управления">
              <section className="panel-section control-title-section">
                <div className="panel-title-row">
                  <span className="panel-icon" aria-hidden="true">◇</span>
                  <h1>Управление</h1>
                </div>
              </section>

              {gameState.pendingMove && (
                <section className="panel-section confirmation-section">
                  <h2>Подтверждение</h2>
                  {canReviewPendingMove ? (
                    <>
                      <p>
                        {getPlayerLabel(pendingMovePlayerIndex ?? 0)} сыграл карту{' '}
                        <strong>{gameState.pendingMove.cardName}</strong>. Подтвердить связь?
                      </p>
                      <small>
                        Решение принимает{' '}
                        {getPlayerLabel(pendingMoveReviewerIndex ?? 1)}.
                      </small>
                      <div className="confirmation-actions">
                        <button type="button" onClick={confirmCard}>
                          Подтвердить
                        </button>
                        <button type="button" onClick={returnCard}>
                          Вернуть карту
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <p>
                        {getPlayerLabel(pendingMovePlayerIndex ?? 0)} сыграл карту{' '}
                        <strong>{gameState.pendingMove.cardName}</strong>.
                      </p>
                      <small>
                        Ожидание подтверждения от{' '}
                        {pendingMoveReviewerIndex !== null
                          ? getPlayerLabel(pendingMoveReviewerIndex)
                          : 'оппонента'}
                        .
                      </small>
                    </>
                  )}
                </section>
              )}

              {gameState.pendingCross && (
                <section className="panel-section confirmation-section">
                  <h2>Крестовина</h2>
                  <p>
                    Образована крестовина вокруг карты{' '}
                    <strong>{gameState.pendingCross.centerCardName}</strong>. Засчитать +5
                    очков?
                  </p>
                  <small>
                    Бонус получит {getPlayerLabel(gameState.pendingCross.playerId)}.
                  </small>
                  <div className="confirmation-actions">
                    <button
                      disabled={!canReviewPendingCross}
                      type="button"
                      onClick={approveCross}
                    >
                      Засчитать +5
                    </button>
                    <button
                      disabled={!canReviewPendingCross}
                      type="button"
                      onClick={rejectCross}
                    >
                      Не засчитывать
                    </button>
                  </div>
                </section>
              )}

              <nav className="panel-actions" aria-label="Действия">
                <button type="button" onClick={() => setActiveModal('new-game')}>
                  Новая игра
                </button>
                <button type="button" onClick={handleResetCamera}>
                  Сброс позиции
                </button>
                {onlineRoom && (
                  <button type="button" onClick={handleManualSyncRoom}>
                    Синхронизировать
                  </button>
                )}
                <button type="button" onClick={() => setActiveModal('rules')}>
                  Правила
                </button>
                <button type="button" onClick={() => setActiveModal('settings')}>
                  Настройки
                </button>
              </nav>
            </aside>
          </div>

          <PlayerHand
            playerNumber={0}
            cards={gameState.players[0].cards}
            deckCount={gameState.deck[0].length}
            hideCards={mode === 'multiplayer' && localPlayerIndex !== 0}
            selectedCard={
              gameState.currentPlayerIndex === 0 && canControlPlayer(0)
                ? activeSelectedCard
                : null
            }
            isActive={
              gameState.currentPlayerIndex === 0 &&
              !hasPendingDecision &&
              canControlPlayer(0)
            }
            onMoveCardDrag={handleMoveCardDrag}
            onStartCardDrag={handleStartCardDrag}
            onCancelCardDrag={handleCancelCardDrag}
          />
        </section>
      </main>
      {dragPreview && (
        <div
          className="drag-card-preview"
          style={{
            left: `${dragPreview.x}px`,
            top: `${dragPreview.y}px`,
          }}
        >
          <div className={`drag-card-preview-card player-${dragPreview.playerColor}`}>
            {dragPreview.cardName}
          </div>
        </div>
      )}
      {activeModal === 'new-game' && (
        <Modal onClose={() => setActiveModal(null)} title="Новая игра">
          <div className="new-game-modal">
            <section className="online-room-block">
              <h3>Локальная игра</h3>
              <div className="modal-actions inline-actions">
                <button type="button" onClick={onlineRoom ? handleStartLocalGame : handleConfirmNewGame}>
                  Начать локально
                </button>
              </div>
            </section>

            <section className="online-room-block">
              <h3>Онлайн</h3>
              <form className="online-join-row" onSubmit={handleJoinOnlineRoom}>
                <label htmlFor="room-code">Код комнаты</label>
                <input
                  autoComplete="off"
                  id="room-code"
                  maxLength={8}
                  onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
                  placeholder="A7K2Q"
                  value={joinCode}
                />
                <button disabled={isOnlineLoading} type="submit">
                  Войти
                </button>
              </form>
              <div className="modal-actions inline-actions">
                <button
                  disabled={isOnlineLoading}
                  type="button"
                  onClick={handleCreateOnlineRoom}
                >
                  Создать
                </button>
              </div>
            </section>

            {onlineRoom && (
              <section className="online-room-state compact-room-state" aria-label="Состояние комнаты">
                <h3>Текущая комната</h3>
                <div>
                  <span>Код</span>
                  <strong>{onlineRoom.code}</strong>
                </div>
                <div>
                  <span>Статус</span>
                  <strong>{onlineRoom.status}</strong>
                </div>
                <div>
                  <span>Роль</span>
                  <strong>{getRoomRoleLabel(onlineRoom, playerId)}</strong>
                </div>
              </section>
            )}

            {(onlineError || gameControllerError) && (
              <p className="online-room-error">{onlineError ?? gameControllerError}</p>
            )}
          </div>
          <div className="modal-actions">
            <button type="button" onClick={() => setActiveModal(null)}>
              Закрыть
            </button>
          </div>
        </Modal>
      )}
      {activeModal === 'rules' && (
        <Modal onClose={() => setActiveModal(null)} title="Правила">
          <RulesContent />
          <div className="modal-actions">
            <button type="button" onClick={() => setActiveModal(null)}>
              Закрыть
            </button>
          </div>
        </Modal>
      )}
      {activeModal === 'settings' && (
        <Modal onClose={() => setActiveModal(null)} title="Настройки">
          <div className="settings-row">
            <label htmlFor="show-playable-highlights">
              Показывать подсветку допустимых клеток
            </label>
            <input
              checked={interfaceSettings.showPlayableHighlights}
              id="show-playable-highlights"
              onChange={(event) =>
                setInterfaceSettings((settings) => ({
                  ...settings,
                  showPlayableHighlights: event.target.checked,
                }))
              }
              type="checkbox"
            />
          </div>
          <div className="settings-row">
            <label htmlFor="show-card-tooltips">Показывать tooltip карт</label>
            <input
              checked={interfaceSettings.showCardTooltips}
              id="show-card-tooltips"
              onChange={(event) =>
                setInterfaceSettings((settings) => ({
                  ...settings,
                  showCardTooltips: event.target.checked,
                }))
              }
              type="checkbox"
            />
          </div>
          <div className="modal-actions">
            <button type="button" onClick={handleResetSettings}>
              Сбросить настройки
            </button>
            <button type="button" onClick={() => setActiveModal(null)}>
              Закрыть
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

export default App;
