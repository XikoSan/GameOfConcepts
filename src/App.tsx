import { useEffect, useRef, useState } from 'react';
import type { DragEvent as ReactDragEvent } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { DictionaryModal } from './components/DictionaryModal';
import { GameBoard } from './components/GameBoard';
import { Modal } from './components/Modal';
import { PlayerHand } from './components/PlayerHand';
import { RulesContent } from './components/RulesContent';
import { useGameState } from './hooks/useGameState';
import { usePlayerIdentity } from './hooks/usePlayerIdentity';
import {
  createRoom,
  getAvailableRooms,
  getRoomById,
  joinRoom,
  subscribeToRoom,
} from './services/roomService';
import { initializeGame } from './game';
import type { Coordinates, PendingMove, RegularCardName } from './game';
import type { Room } from './types/room';
import './App.css';

const getPlayerLabel = (playerId: 0 | 1) => (playerId === 0 ? 'Игрок 1' : 'Игрок 2');

const getPendingMovePlayerIndex = (pendingMove: PendingMove | null) =>
  pendingMove?.playerIndex ?? pendingMove?.playerId ?? null;

const getPendingMoveReviewerIndex = (pendingMove: PendingMove | null) =>
  pendingMove?.reviewerIndex ?? pendingMove?.reviewerId ?? null;

const getAvailableRoomRoleLabel = (room: Room, playerId: string) => {
  if (room.player_1_id === playerId) return 'Вы Игрок 1';
  if (room.player_2_id === playerId) return 'Вы Игрок 2';
  if (!room.player_2_id) return 'Свободная комната';
  return 'Недоступна';
};

const formatRoomUpdatedAt = (updatedAt: string) =>
  new Intl.DateTimeFormat('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
  }).format(new Date(updatedAt));

const getRoomList = (rooms: Room[], currentRoom: Room | null) => {
  const roomsById = new Map<string, Room>();

  if (currentRoom) {
    roomsById.set(currentRoom.id, currentRoom);
  }

  rooms.forEach((room) => {
    if (!roomsById.has(room.id)) {
      roomsById.set(room.id, room);
    }
  });

  return Array.from(roomsById.values());
};

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
  const [onlineError, setOnlineError] = useState<string | null>(null);
  const [isOnlineLoading, setIsOnlineLoading] = useState(false);
  const [availableRooms, setAvailableRooms] = useState<Room[]>([]);
  const [isRoomListLoading, setIsRoomListLoading] = useState(false);
  const [dictionaryTerm, setDictionaryTerm] = useState<string | null>(null);
  const [isDictionaryOpen, setIsDictionaryOpen] = useState(false);
  const [interfaceSettings, setInterfaceSettings] = useState(
    defaultInterfaceSettings
  );
  const roomSubscriptionRef = useRef<RealtimeChannel | null>(null);
  const onlineRoomRef = useRef<Room | null>(null);
  const {
    gameState,
    mode,
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
  const showPendingWaitBadge =
    Boolean(gameState.pendingMove) &&
    !canReviewPendingMove &&
    localPlayerIndex !== null &&
    pendingMovePlayerIndex === localPlayerIndex;
  const roomList = getRoomList(availableRooms, onlineRoom);
  const activeScoreIndex = pendingMoveReviewerIndex ?? gameState.currentPlayerIndex;
  const scoreStateLabel = gameState.pendingMove ? 'решение' : 'ход';
  const canReviewPendingCross =
    mode === 'local' ||
    (localPlayerIndex !== null &&
      Boolean(gameState.pendingCross) &&
      gameState.currentPlayerIndex === localPlayerIndex);

  const handlePlaceCard = (cardName: RegularCardName, coordinates: Coordinates) => {
    if (!selectedCard || hasPendingDecision) return;

    placeCard(cardName, coordinates);
  };

  const handleOpenDictionary = (term: string) => {
    setDictionaryTerm(term);
    setIsDictionaryOpen(true);
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

  const loadAvailableRooms = async () => {
    setIsRoomListLoading(true);
    setOnlineError(null);

    try {
      const rooms = await getAvailableRooms(playerId);
      setAvailableRooms(rooms);
    } catch (error) {
      setOnlineError(
        error instanceof Error ? error.message : 'Не удалось загрузить комнаты.'
      );
    } finally {
      setIsRoomListLoading(false);
    }
  };

  const handleOpenNewGameModal = () => {
    setActiveModal('new-game');
    void loadAvailableRooms();
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
      void loadAvailableRooms();
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

  const handleReturnToRoom = async (roomId: string) => {
    setIsOnlineLoading(true);
    setOnlineError(null);

    try {
      const room = await getRoomById(roomId);
      if (!room) {
        setOnlineError('Комната не найдена.');
        return;
      }

      handleRoomConnected(room);
      void loadAvailableRooms();
    } catch (error) {
      setOnlineError(
        error instanceof Error ? error.message : 'Не удалось вернуться в комнату.'
      );
    } finally {
      setIsOnlineLoading(false);
    }
  };

  const handleJoinListedRoom = async (room: Room) => {
    setIsOnlineLoading(true);
    setOnlineError(null);

    try {
      const joinedRoom = await joinRoom(room.code, playerId);
      handleRoomConnected(joinedRoom);
      void loadAvailableRooms();
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
            onOpenDictionary={handleOpenDictionary}
          />

          <div className="table-middle">
            <aside className="side-panel party-panel" aria-label="Панель партии">
              <section className="panel-section lobby-section">
                <div className="panel-title-row">
                  <span className="panel-icon" aria-hidden="true">◇</span>
                  <h1>Лобби</h1>
                </div>
              </section>

              <section className="panel-section players-score-section">
                <h2>Игроки</h2>
                <div className={`score-row player-score-blue ${activeScoreIndex === 0 ? 'active-score' : ''}`}>
                  <span>
                    Игрок 1
                    {activeScoreIndex === 0 && <small>{scoreStateLabel}</small>}
                  </span>
                  <strong>{gameState.scores[0]}</strong>
                </div>
                <div className={`score-row player-score-orange ${activeScoreIndex === 1 ? 'active-score' : ''}`}>
                  <span>
                    Игрок 2
                    {activeScoreIndex === 1 && <small>{scoreStateLabel}</small>}
                  </span>
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
                canReviewPendingMove={canReviewPendingMove}
                showPendingWaitBadge={showPendingWaitBadge}
                onConfirmPendingMove={confirmCard}
                onReturnPendingMove={returnCard}
                canReviewPendingCross={canReviewPendingCross}
                pendingCrossReviewerLabel={getPlayerLabel(gameState.currentPlayerIndex)}
                onApprovePendingCross={approveCross}
                onRejectPendingCross={rejectCross}
                onOpenDictionary={handleOpenDictionary}
              />
            </div>

            <aside className="side-panel control-panel" aria-label="Панель управления">
              <section className="panel-section control-title-section">
                <div className="panel-title-row">
                  <span className="panel-icon" aria-hidden="true">◇</span>
                  <h1>Управление</h1>
                </div>
              </section>

              <nav className="panel-actions" aria-label="Действия">
                <section className="action-group action-group-primary" aria-label="Партия">
                  <h2>Партия</h2>
                  <button className="action-button action-button-primary" type="button" onClick={handleOpenNewGameModal}>
                    Онлайн игра
                  </button>
                  <button className="action-button action-button-secondary" type="button" onClick={onlineRoom ? handleStartLocalGame : handleConfirmNewGame}>
                    Начать локально
                  </button>
                </section>

                <section className="action-group" aria-label="Инструменты">
                  <h2>Инструменты</h2>
                  <button className="action-button action-button-subtle" type="button" onClick={handleResetCamera}>
                    Сброс позиции
                  </button>
                  {onlineRoom && (
                    <button className="action-button action-button-subtle" type="button" onClick={handleManualSyncRoom}>
                      Синхронизировать
                    </button>
                  )}
                </section>

                <section className="action-group" aria-label="Справка">
                  <h2>Справка</h2>
                  <button className="action-button action-button-quiet" type="button" onClick={() => setActiveModal('rules')}>
                    Правила
                  </button>
                  <button className="action-button action-button-quiet" type="button" onClick={() => setActiveModal('settings')}>
                    Настройки
                  </button>
                </section>
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
            onOpenDictionary={handleOpenDictionary}
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
        <Modal onClose={() => setActiveModal(null)} title="Онлайн игра">
          <div className="new-game-modal">
            <section className="online-room-block">
              <div className="online-create-row">
                <button
                  disabled={isOnlineLoading}
                  type="button"
                  onClick={handleCreateOnlineRoom}
                >
                  Создать комнату
                </button>
              </div>

              <div className="available-rooms-header">
                <h3>Доступные комнаты</h3>
                <button
                  disabled={isRoomListLoading}
                  type="button"
                  onClick={loadAvailableRooms}
                >
                  Обновить список
                </button>
              </div>

              {roomList.length === 0 ? (
                <p className="available-rooms-empty">
                  {isRoomListLoading ? 'Загрузка комнат...' : 'Нет доступных комнат.'}
                </p>
              ) : (
                <div className="available-rooms-list">
                  {roomList.map((room) => {
                    const isCurrentRoom = onlineRoom?.id === room.id;
                    const isParticipant =
                      room.player_1_id === playerId || room.player_2_id === playerId;
                    const canJoinRoom = room.status === 'waiting' && !room.player_2_id;

                    return (
                      <div
                        className={`available-room-row ${isCurrentRoom ? 'current-room' : ''}`}
                        key={room.id}
                      >
                        <div>
                          <strong>
                            {room.code}
                          </strong>
                          <span>{room.status}</span>
                        </div>
                        <small>{getAvailableRoomRoleLabel(room, playerId)}</small>
                        <small>{formatRoomUpdatedAt(room.updated_at)}</small>
                        {isCurrentRoom ? (
                          <button disabled type="button">
                            Открыта
                          </button>
                        ) : isParticipant ? (
                          <button
                            disabled={isOnlineLoading}
                            type="button"
                            onClick={() => void handleReturnToRoom(room.id)}
                          >
                            Вернуться
                          </button>
                        ) : (
                          <button
                            disabled={isOnlineLoading || !canJoinRoom}
                            type="button"
                            onClick={() => void handleJoinListedRoom(room)}
                          >
                            Подключиться
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

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
      {isDictionaryOpen && dictionaryTerm && (
        <DictionaryModal
          initialTerm={dictionaryTerm}
          key={dictionaryTerm}
          onClose={() => setIsDictionaryOpen(false)}
        />
      )}
    </div>
  );
}

export default App;
