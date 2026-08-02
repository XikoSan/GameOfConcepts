import { useCallback, useEffect, useRef, useState } from 'react';
import type { DragEvent as ReactDragEvent } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { DictionaryModal } from './components/DictionaryModal';
import { DragPreviewLayer } from './components/DragPreviewLayer';
import { GameBoard } from './components/GameBoard';
import { Modal } from './components/Modal';
import { PlayerHand } from './components/PlayerHand';
import { RulesContent } from './components/RulesContent';
import {
  incrementCounter,
  printPerformanceReport,
  resetPerformanceReport,
} from './debug/performanceDiagnostics';
import { useGameState } from './hooks/useGameState';
import { usePlayerIdentity } from './hooks/usePlayerIdentity';
import {
  createRoom,
  deleteRoom,
  getAvailableRooms,
  getRoomById,
  joinRoom,
  subscribeToRoom,
} from './services/roomService';
import { initializeGame } from './game';
import {
  getDeckDefinitionById,
  MIXED_ALL_DECK,
  USER_SELECTABLE_DECKS,
} from './data/deckDefinitions';
import { createSemanticEdgeFromPending, formatSemanticRelation } from './scoring/semanticRelations';
import type {
  Coordinates,
  GameState,
  PendingMove,
  PendingSemanticEdge,
  RegularCardName,
} from './game';
import type { MaxPlayers, Room, RoomPlayer } from './types/room';
import './App.css';

const getPlayerLabel = (playerId: number) => `Игрок ${playerId + 1}`;

const getPendingMovePlayerIndex = (pendingMove: PendingMove | null) =>
  pendingMove?.playerIndex ?? pendingMove?.playerId ?? null;

const getPendingMoveReviewerIndex = (pendingMove: PendingMove | null) =>
  pendingMove?.reviewerIndex ?? pendingMove?.reviewerId ?? null;

const playerColors = ['blue', 'orange', 'green', 'purple'] as const;

const getPendingMoveVoteState = (
  pendingMove: PendingMove | null,
  playerId: string
) => {
  if (!pendingMove?.requiredVoters) {
    return {
      canVote: false,
      acceptedCount: 0,
      requiredCount: 0,
      statusLabel: 'ожидает',
    };
  }

  const votes = pendingMove.votes ?? {};
  const acceptedCount = pendingMove.requiredVoters.filter(
    (voterId) => votes[voterId] === 'accept'
  ).length;
  const requiredCount = pendingMove.requiredVoters.length;
  const majority = Math.floor(requiredCount / 2) + 1;
  const hasVoted = Boolean(votes[playerId]);

  return {
    canVote: pendingMove.requiredVoters.includes(playerId) && !hasVoted,
    acceptedCount,
    requiredCount,
    statusLabel: `✓ ${acceptedCount}/${requiredCount} · нужно ${majority}`,
  };
};

const getRoomPlayersForDisplay = (room: Room | null): RoomPlayer[] => {
  if (!room) return [];

  if (Array.isArray(room.players) && room.players.length > 0) {
    return [...room.players].sort((playerA, playerB) => playerA.seatIndex - playerB.seatIndex);
  }

  const players: RoomPlayer[] = [];

  if (room.player_1_id) {
    players.push({
      id: room.player_1_id,
      nickname: room.player_1_nickname?.trim() || 'Игрок 1',
      seatIndex: 0,
      color: 'blue',
      isHost: true,
      connected: true,
      joinedAt: room.created_at,
    });
  }

  if (room.player_2_id) {
    players.push({
      id: room.player_2_id,
      nickname: room.player_2_nickname?.trim() || 'Игрок 2',
      seatIndex: 1,
      color: 'orange',
      isHost: false,
      connected: true,
      joinedAt: room.created_at,
    });
  }

  return players;
};

const getLocalPlayersForDisplay = (gameState: GameState): RoomPlayer[] =>
  gameState.players.map((player) => ({
    id: `local-${player.playerId}`,
    nickname: `Игрок ${player.playerId + 1}`,
    seatIndex: player.playerId,
    color: playerColors[player.playerId] ?? 'blue',
    isHost: player.playerId === 0,
    connected: true,
    joinedAt: '',
  }));

const getAvailableRoomRoleLabel = (room: Room, playerId: string) => {
  const roomPlayers = getRoomPlayersForDisplay(room);
  const roomPlayer = roomPlayers.find((player) => player.id === playerId);
  if (roomPlayer) return `Вы ${roomPlayer.nickname}`;
  if (room.player_1_id === playerId) return 'Вы Игрок 1';
  if (room.player_2_id === playerId) return 'Вы Игрок 2';
  if (room.status === 'waiting' && roomPlayers.length < (room.max_players ?? 2)) {
    return 'Свободная комната';
  }
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

const isRoomHost = (room: Room | null, playerId: string) =>
  Boolean(room && (room.host_player_id ?? room.player_1_id) === playerId);

interface DragPreview {
  cardName: RegularCardName;
  initialX: number;
  initialY: number;
  playerColor: 'blue' | 'orange' | 'green' | 'purple';
}

type ActiveModal = 'new-game' | 'rules' | 'settings' | null;

const defaultInterfaceSettings = {
  showPlayableHighlights: true,
  showCardTooltips: true,
};

function App() {
  incrementCounter('render:App');
  // TEMP(MVP): Комнаты работают без авторизации, игрок определяется через
  // localStorage playerId.
  const { playerId, nickname: savedNickname, saveNickname } = usePlayerIdentity();
  const [selectedCard, setSelectedCard] = useState<RegularCardName | null>(null);
  const [dragPreview, setDragPreview] = useState<DragPreview | null>(null);
  const [activeModal, setActiveModal] = useState<ActiveModal>(null);
  const [resetCameraSignal, setResetCameraSignal] = useState(0);
  const [onlineRoom, setOnlineRoom] = useState<Room | null>(null);
  const [onlineError, setOnlineError] = useState<string | null>(null);
  const [isOnlineLoading, setIsOnlineLoading] = useState(false);
  const [availableRooms, setAvailableRooms] = useState<Room[]>([]);
  const [isRoomListLoading, setIsRoomListLoading] = useState(false);
  const [onlineNickname, setOnlineNickname] = useState(savedNickname);
  const [maxPlayers, setMaxPlayers] = useState<MaxPlayers>(2);
  const [localDeckId, setLocalDeckId] = useState(MIXED_ALL_DECK.id);
  const [onlineDeckId, setOnlineDeckId] = useState(MIXED_ALL_DECK.id);
  const [dictionaryTerm, setDictionaryTerm] = useState<string | null>(null);
  const [isDictionaryOpen, setIsDictionaryOpen] = useState(false);
  const [interfaceSettings, setInterfaceSettings] = useState(
    defaultInterfaceSettings
  );
  const roomSubscriptionRef = useRef<RealtimeChannel | null>(null);
  const onlineRoomRef = useRef<Room | null>(null);
  const activeCardDragRef = useRef(false);
  const {
    gameState,
    mode,
    localPlayerIndex,
    activePlayerIndex,
    error: gameControllerError,
    placeCard,
    upsertSemanticEdge,
    removeSemanticEdge,
    submitSemanticMove,
    cancelPendingMove,
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
  const canControlPlayer = (playerIndex: number) =>
    mode === 'local' || localPlayerIndex === playerIndex;
  const isOnlineTable = Boolean(onlineRoom);
  const bottomTablePlayerIndex: number | null = isOnlineTable
    ? localPlayerIndex
    : activePlayerIndex;
  const pendingMoveVoteState = getPendingMoveVoteState(
    gameState.pendingMove,
    playerId
  );
  const canReviewPendingMove =
    gameState.pendingMove?.semanticStatus === 'voting' &&
    (mode === 'local'
      ? true
      : Boolean(gameState.pendingMove) && pendingMoveVoteState.canVote);
  const pendingMovePlayerIndex = getPendingMovePlayerIndex(gameState.pendingMove);
  const pendingMoveReviewerIndex = getPendingMoveReviewerIndex(gameState.pendingMove);
  const showPendingWaitBadge =
    Boolean(gameState.pendingMove) &&
    !canReviewPendingMove &&
    (mode === 'multiplayer' ||
      (localPlayerIndex !== null && pendingMovePlayerIndex === localPlayerIndex));
  const roomList = getRoomList(availableRooms, onlineRoom);
  const onlinePlayers = getRoomPlayersForDisplay(onlineRoom);
  const localPlayers = getLocalPlayersForDisplay(gameState);
  const currentPlayerId = onlineRoom?.turn_order?.[onlineRoom.current_turn_index] ?? null;
  const isOnlineHost = isRoomHost(onlineRoom, playerId);
  const activeScoreIndex =
    gameState.pendingMove?.semanticStatus === 'defining-relations'
      ? pendingMovePlayerIndex ?? activePlayerIndex
      : mode === 'local'
        ? activePlayerIndex
        : pendingMoveReviewerIndex ?? activePlayerIndex;
  const scoreStateLabel =
    gameState.pendingMove?.semanticStatus === 'defining-relations'
      ? 'связи'
      : gameState.pendingMove
        ? 'решение'
        : 'ход';
  const canReviewPendingCross =
    mode === 'local' ||
    (localPlayerIndex !== null &&
      Boolean(gameState.pendingCross) &&
      activePlayerIndex === localPlayerIndex);
  const getSeatScore = (seatIndex: number) => gameState.scores?.[seatIndex] ?? 0;
  const pendingSemanticEdges = gameState.pendingMove?.semanticEdges ?? [];
  const pendingSemanticScore = gameState.pendingMove?.scorePreview;
  const isSubmittingSemanticMove = false;
  const canEditSemanticMove =
    Boolean(gameState.pendingMove) &&
    gameState.pendingMove?.semanticStatus === 'defining-relations' &&
    (mode === 'local' ||
      (localPlayerIndex !== null && pendingMovePlayerIndex === localPlayerIndex));
  const isPendingEdgeComplete = (edge: PendingSemanticEdge) =>
    Boolean(edge.relation) &&
    (edge.relation.family === 'opposite' || Boolean(edge.direction));
  const canSubmitRelations =
    canEditSemanticMove &&
    pendingSemanticEdges.length > 0 &&
    pendingSemanticEdges.every(isPendingEdgeComplete) &&
    !isSubmittingSemanticMove;
  const semanticSubmitHint =
    pendingSemanticEdges.length === 0
      ? 'Выберите минимум одну смысловую связь.'
      : pendingSemanticEdges.every(isPendingEdgeComplete)
        ? 'Ход готов к голосованию.'
        : 'Укажите тип и направление каждой выбранной связи.';

  const handlePlaceCard = (cardName: RegularCardName, coordinates: Coordinates) => {
    if (!selectedCard || hasPendingDecision) return;

    placeCard(cardName, coordinates);
  };

  const handleOpenDictionary = (term: string) => {
    setDictionaryTerm(term);
    setIsDictionaryOpen(true);
  };

  const getPendingSemanticEdgeScore = (pendingEdgeId: string) =>
    pendingSemanticScore?.edges.find((edge) => edge.pendingEdgeId === pendingEdgeId);

  const getSemanticEdgeLabel = (
    edge: PendingSemanticEdge
  ) => {
    const pendingMove = gameState.pendingMove;
    const pendingCard = pendingMove
      ? Object.values(gameState.board).find((card) => card.id === pendingMove.cardId)
      : null;
    if (!pendingMove || !pendingCard) return 'Связь';

    const semanticEdge = createSemanticEdgeFromPending(pendingMove, edge, pendingCard);
    const namesById = new Map(
      Object.values(gameState.board).map((card) => [card.id, card.cardName])
    );
    return formatSemanticRelation(semanticEdge, namesById);
  };

  const getValidatedOnlineNickname = (): string | null => {
    const nickname = onlineNickname.trim();

    if (!nickname) {
      setOnlineError('Введите никнейм.');
      return null;
    }

    if (nickname.length > 20) {
      setOnlineError('Никнейм слишком длинный.');
      return null;
    }

    saveNickname(nickname);
    setOnlineNickname(nickname);
    return nickname;
  };

  const handleStartCardDrag = (
    cardName: RegularCardName,
    playerColor: DragPreview['playerColor'],
    event: ReactDragEvent<HTMLDivElement>
  ) => {
    if (hasPendingDecision) return;

    resetPerformanceReport();
    incrementCounter('drag:start');
    incrementCounter('dom:getBoundingClientRect:drag-card-start');
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX || rect.left + rect.width / 2;
    const y = event.clientY || rect.top + rect.height / 2;

    activeCardDragRef.current = true;
    setSelectedCard(cardName);
    setDragPreview({
      cardName,
      initialX: x,
      initialY: y,
      playerColor,
    });
  };

  const handleCancelCardDrag = () => {
    if (!activeCardDragRef.current) return;

    activeCardDragRef.current = false;
    incrementCounter('drag:cancel');
    setSelectedCard(null);
    setDragPreview(null);
  };

  const handleResetCamera = () => {
    setResetCameraSignal((signal) => signal + 1);
  };

  const handleConfirmNewGame = () => {
    resetGame(maxPlayers, localDeckId);
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
    startLocalGame(maxPlayers, localDeckId);
    setSelectedCard(null);
    setDragPreview(null);
    setResetCameraSignal((signal) => signal + 1);
    setActiveModal(null);
  };

  const handleResetSettings = () => {
    setInterfaceSettings(defaultInterfaceSettings);
  };

  const getHandMeta = (playerIndex: number) => {
    if (!onlineRoom) {
      return {
        displayName: `Игрок ${playerIndex + 1}`,
        statusLabel: gameState.pendingMove
          ? 'Нужно решение'
          : activePlayerIndex === playerIndex
            ? 'Ход активен'
            : 'Ожидает',
      };
    }

    if (localPlayerIndex !== playerIndex) return {};

    const localPlayer = onlinePlayers.find((player) => player.id === playerId);
    const displayName =
      localPlayer?.nickname?.trim() ||
      (localPlayerIndex === null ? undefined : `Игрок ${localPlayerIndex + 1}`);
    const isPendingAuthor =
      gameState.pendingMove?.placedByPlayerId === playerId ||
      gameState.pendingMove?.placedBySeatIndex === playerIndex ||
      getPendingMovePlayerIndex(gameState.pendingMove) === playerIndex;
    let statusLabel = 'Ожидает';

    if (gameState.pendingMove && isPendingAuthor) {
      statusLabel = 'Ожидаем голоса';
    } else if (gameState.pendingMove && pendingMoveVoteState.canVote) {
      statusLabel = 'Нужно решение';
    } else if (activePlayerIndex === playerIndex && !hasPendingDecision) {
      statusLabel = 'Ход активен';
    }

    return {
      displayName,
      statusLabel,
    };
  };

  const loadAvailableRooms = useCallback(async () => {
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
  }, [playerId]);

  const handleOpenNewGameModal = () => {
    setActiveModal('new-game');
    void loadAvailableRooms();
  };

  const closeOnlineModal = () => {
    setActiveModal(null);
  };

  const syncOnlineRoom = useCallback(async (reason: string) => {
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
        console.warn('[online room missing]', {
          reason,
          currentVersion: currentRoom.version,
          fetchedVersion: null,
        });
        setOnlineRoom(null);
        setOnlineError('Комната удалена или недоступна.');
        void loadAvailableRooms();
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
  }, [loadAvailableRooms]);

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
    }, () => {
      console.warn('[app room deleted]', { roomId: room.id, code: room.code });
      setOnlineRoom(null);
      setOnlineError('Комната удалена.');
      void loadAvailableRooms();
    });
  };

  const handleManualSyncRoom = () => {
    void syncOnlineRoom('manual sync');
  };

  const handleDeleteOnlineRoom = async (targetRoom?: Room) => {
    const room = targetRoom ?? onlineRoom;
    if (!room || !isRoomHost(room, playerId)) return;

    const shouldDelete = window.confirm(
      'Удалить комнату? Все игроки потеряют доступ к партии.'
    );
    if (!shouldDelete) return;

    setIsOnlineLoading(true);
    setOnlineError(null);

    try {
      await deleteRoom(room.id, playerId);
      if (onlineRoomRef.current?.id === room.id) {
        setOnlineRoom(null);
      }
      void loadAvailableRooms();
    } catch (error) {
      console.error('[delete online room error]', error);
      setOnlineError(
        error instanceof Error
          ? `Не удалось удалить комнату: ${error.message}`
          : 'Не удалось удалить комнату.'
      );
    } finally {
      setIsOnlineLoading(false);
    }
  };

  const handleCreateOnlineRoom = async () => {
    const nickname = getValidatedOnlineNickname();
    if (!nickname) return;

    setIsOnlineLoading(true);
    setOnlineError(null);

    try {
      console.log('[create room click]');
      console.log('[create room playerId]', playerId);
      console.log('[create room nickname]', nickname);
      console.log('[create room maxPlayers]', maxPlayers);
      console.log('[create room deckId]', onlineDeckId);
      console.debug('[create room click debug]', {
        playerId,
        nickname,
        maxPlayers,
      });
      console.log('[create room env check]', {
        hasUrl: Boolean(import.meta.env.VITE_SUPABASE_URL),
        hasKey: Boolean(import.meta.env.VITE_SUPABASE_ANON_KEY),
      });
      const deckDefinition = getDeckDefinitionById(onlineDeckId) ?? MIXED_ALL_DECK;
      const initialGameState = initializeGame(maxPlayers, deckDefinition);
      console.log('[create room initialGameState]', initialGameState);
      // TODO(MVP): Пока UI комнаты не подключён к синхронизации ходов.
      const room = await createRoom({
        playerId,
        nickname,
        maxPlayers,
        initialGameState,
      });
      handleRoomConnected(room);
      // Modal visibility is controlled by explicit room actions; Realtime
      // updates must not close the room browser unexpectedly.
      closeOnlineModal();
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
    const nickname = getValidatedOnlineNickname();
    if (!nickname) return;

    setIsOnlineLoading(true);
    setOnlineError(null);

    try {
      const room = await getRoomById(roomId);
      if (!room) {
        setOnlineError('Комната не найдена.');
        return;
      }

      handleRoomConnected(room);
      closeOnlineModal();
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
    const nickname = getValidatedOnlineNickname();
    if (!nickname) return;

    setIsOnlineLoading(true);
    setOnlineError(null);

    try {
      const joinedRoom = await joinRoom({
        code: room.code,
        playerId,
        nickname,
      });
      handleRoomConnected(joinedRoom);
      closeOnlineModal();
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
    const clearDragState = () => {
      if (!activeCardDragRef.current) return;

      activeCardDragRef.current = false;
      incrementCounter('drag:end');
      setSelectedCard(null);
      setDragPreview(null);
      printPerformanceReport();
    };

    window.addEventListener('dragend', clearDragState);
    window.addEventListener('drop', clearDragState);
    window.addEventListener('mouseup', clearDragState);

    return () => {
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
  }, [onlineRoom, syncOnlineRoom]);

  useEffect(() => {
    if (!onlineRoom) return;

    console.debug('[game debug local hand]', {
      localPlayerId: playerId,
      localSeatIndex: localPlayerIndex,
      handsLength: gameState.players.length,
      decksLength: gameState.deck.length,
      scoresLength: gameState.scores.length,
      handLength:
        localPlayerIndex === null
          ? null
          : gameState.players[localPlayerIndex]?.cards.length,
      activePlayerId: currentPlayerId,
      activeSeatIndex: activePlayerIndex,
      turnOrder: onlineRoom.turn_order,
      currentTurnIndex: onlineRoom.current_turn_index,
    });
  }, [
    activePlayerIndex,
    currentPlayerId,
    gameState.deck.length,
    gameState.players,
    gameState.scores.length,
    localPlayerIndex,
    onlineRoom,
    playerId,
  ]);

  const renderPartyPanel = () => (
    <aside className="side-panel party-panel" aria-label="Панель партии">
      <section className="panel-section lobby-section">
        <div className="panel-title-row">
          <span className="panel-icon" aria-hidden="true">◇</span>
          <h1>Лобби</h1>
        </div>
      </section>

      <section className="panel-section players-score-section">
        <h2>Игроки</h2>
        {(onlineRoom ? onlinePlayers : localPlayers).map((player) => {
          const isActiveScore =
            currentPlayerId !== null
              ? currentPlayerId === player.id
              : activeScoreIndex === player.seatIndex;

          return (
            <div
              className={`score-row player-score-${player.color} ${isActiveScore ? 'active-score' : ''}`}
              key={player.id}
            >
              <span>
                {player.nickname}
                {onlineRoom && player.id === playerId && <small>вы</small>}
                {isActiveScore && <small>{scoreStateLabel}</small>}
              </span>
              <strong>{getSeatScore(player.seatIndex)}</strong>
            </div>
          );
        })}
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
  );

  const renderBoard = () => (
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
      pendingMoveStatusLabel={
        mode === 'multiplayer' ? pendingMoveVoteState.statusLabel : undefined
      }
      onConfirmPendingMove={confirmCard}
      onReturnPendingMove={returnCard}
      canReviewPendingCross={canReviewPendingCross}
      pendingCrossReviewerLabel={getPlayerLabel(activePlayerIndex)}
      onApprovePendingCross={approveCross}
      onRejectPendingCross={rejectCross}
      canEditSemanticMove={canEditSemanticMove}
      canSubmitSemanticMove={canSubmitRelations}
      onUpsertSemanticEdge={upsertSemanticEdge}
      onRemoveSemanticEdge={removeSemanticEdge}
      onSubmitSemanticMove={submitSemanticMove}
      onCancelPendingMove={cancelPendingMove}
    />
  );

  const renderSemanticMovePanel = () => {
    if (!gameState.pendingMove) return null;

    const isDefining = gameState.pendingMove.semanticStatus === 'defining-relations';
    const isVoting = gameState.pendingMove.semanticStatus === 'voting';

    return (
      <section className="semantic-move-panel" aria-label="Смысловые связи хода">
        <div className="semantic-move-header">
          <h2>{isDefining ? 'Связи хода' : 'Голосование'}</h2>
          <strong>+{pendingSemanticScore?.total ?? 0}</strong>
        </div>
        {isDefining && (
          <p className="semantic-move-note">
            {canEditSemanticMove
              ? semanticSubmitHint
              : 'Автор хода выбирает связи на поле.'}
          </p>
        )}
        {isVoting && (
          <div className="semantic-vote-summary">
            {(gameState.pendingMove.semanticEdges ?? []).map((edge) => {
              const score = getPendingSemanticEdgeScore(edge.id);
              return (
                <p key={edge.id}>
                  {getSemanticEdgeLabel(edge)}
                  <strong>+{score?.total ?? 1}</strong>
                </p>
              );
            })}
          </div>
        )}
      </section>
    );
  };

  const renderControlPanel = (showScoreHint = false) => (
    <aside className="side-panel control-panel" aria-label="Панель управления">
      <section className="panel-section control-title-section">
        <div className="panel-title-row">
          <span className="panel-icon" aria-hidden="true">◇</span>
          <h1>Управление</h1>
        </div>
      </section>

      {renderSemanticMovePanel()}

      <nav className="panel-actions" aria-label="Действия">
        <section className="action-group action-group-primary" aria-label="Партия">
          <h2>Партия</h2>
          <button className="action-button action-button-primary" type="button" onClick={handleOpenNewGameModal}>
            Онлайн игра
          </button>
          <button className="action-button action-button-secondary" type="button" onClick={onlineRoom ? handleStartLocalGame : handleConfirmNewGame}>
            Начать локально
          </button>
          {!onlineRoom && (
            <>
              <div className="max-players-picker" aria-label="Количество локальных игроков">
                <span>Игроков</span>
                {([2, 3, 4] as const).map((playersCount) => (
                  <button
                    className={maxPlayers === playersCount ? 'active' : ''}
                    key={playersCount}
                    onClick={() => setMaxPlayers(playersCount)}
                    type="button"
                  >
                    {playersCount}
                  </button>
                ))}
              </div>
              <label className="deck-select-field">
                <span>Колода</span>
                <select
                  onChange={(event) => setLocalDeckId(event.target.value)}
                  value={localDeckId}
                >
                  {USER_SELECTABLE_DECKS.map((deckDefinition) => (
                    <option key={deckDefinition.id} value={deckDefinition.id}>
                      {deckDefinition.name}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}
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
          {onlineRoom && isOnlineHost && (
            <button
              className="action-button action-button-quiet"
              disabled={isOnlineLoading}
              type="button"
              onClick={() => void handleDeleteOnlineRoom()}
            >
              Удалить комнату
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

      {showScoreHint && !gameState.pendingMove && (
        <section className="control-hint-card" aria-label="Памятка по очкам">
          <h3>Памятка</h3>
          <div className="control-hint-group">
            <strong>Очки</strong>
            <p>Связь: +1</p>
            <p>Путь: ещё +1</p>
            <p>Узел: ещё +1</p>
            <p>Максимум за связь: +3</p>
          </div>
          <div className="control-hint-group">
            <strong>База</strong>
            <p>Одинаковые слова рядом — нельзя</p>
            <p>Нужна минимум 1 связь</p>
            <p>Голосование: ✓ принять / ↩ вернуть</p>
          </div>
          <div className="control-hint-group">
            <strong>Типы связей</strong>
            <p>Вид</p>
            <p>Часть</p>
            <p>Причина</p>
            <p>Свойство</p>
            <p>Противоположность</p>
          </div>
        </section>
      )}
    </aside>
  );

  const renderPlayerHand = (
    playerIndex: number,
    className?: string,
    forceInactive = false
  ) => {
    const player = gameState.players[playerIndex];
    const deck = gameState.deck[playerIndex];
    if (!player || !deck) return null;
    const handMeta = getHandMeta(playerIndex);

    return (
      <PlayerHand
        playerNumber={playerIndex}
        cards={player.cards}
        deckCount={deck.length}
        selectedCard={
          activePlayerIndex === playerIndex && canControlPlayer(playerIndex)
            ? activeSelectedCard
            : null
        }
        isActive={
          !forceInactive &&
          activePlayerIndex === playerIndex &&
          !hasPendingDecision &&
          canControlPlayer(playerIndex)
        }
        className={className}
        displayName={handMeta.displayName}
        statusLabel={handMeta.statusLabel}
        onStartCardDrag={handleStartCardDrag}
        onCancelCardDrag={handleCancelCardDrag}
        onOpenDictionary={handleOpenDictionary}
      />
    );
  };

  return (
    <div className="app-container">
      <main className="game-table">
        <section className={`play-area ${isOnlineTable ? 'play-area-online' : ''}`} aria-label="Игровой стол">
          {isOnlineTable ? (
            <div className="online-game-shell">
              <header className="online-game-header">
                <h1>Цепочка размышлений</h1>
              </header>

              <div className="online-game-layout">
                {renderPartyPanel()}

                <div className="online-center-table">
                  <div className="board-section board-section-online">
                    {renderBoard()}
                  </div>
                  {/* Online renders only the local player's hand; opponent hands stay hidden in UI. */}
                  {bottomTablePlayerIndex !== null &&
                    renderPlayerHand(
                      bottomTablePlayerIndex,
                      'local-player-hand',
                      onlinePlayers.length < 2
                    )}
                  {onlinePlayers.length < 2 && (
                    <p className="online-waiting-note">Ожидание второго игрока</p>
                  )}
                </div>

                {renderControlPanel(true)}
              </div>
            </div>
          ) : (
            <>
              <div className="table-middle">
                {renderPartyPanel()}
                <div className="board-section">
                  {renderBoard()}
                </div>
                {renderControlPanel()}
              </div>

              {/* Local hot-seat shows one active hand so 2-4 players can pass the device around. */}
              {renderPlayerHand(activePlayerIndex)}
            </>
          )}
        </section>
      </main>
      {dragPreview && (
        <DragPreviewLayer
          cardName={dragPreview.cardName}
          initialX={dragPreview.initialX}
          initialY={dragPreview.initialY}
          playerColor={dragPreview.playerColor}
        />
      )}
      {activeModal === 'new-game' && (
        <Modal onClose={closeOnlineModal} title="Онлайн игра">
          <div className="new-game-modal">
            <section className="online-room-block">
              <label className="online-profile-field" htmlFor="online-nickname">
                <span>Никнейм</span>
                <input
                  id="online-nickname"
                  maxLength={20}
                  onChange={(event) => {
                    setOnlineNickname(event.target.value);
                    setOnlineError(null);
                  }}
                  placeholder="Как вас показывать за столом"
                  type="text"
                  value={onlineNickname}
                />
              </label>

              <div className="online-create-row">
                <div className="max-players-picker" aria-label="Количество игроков">
                  <span>Игроков</span>
                  {([2, 3, 4] as const).map((playersCount) => (
                    <button
                      className={maxPlayers === playersCount ? 'active' : ''}
                      key={playersCount}
                      onClick={() => setMaxPlayers(playersCount)}
                      type="button"
                    >
                      {playersCount}
                    </button>
                  ))}
                </div>
                <label className="deck-select-field">
                  <span>Колода</span>
                  <select
                    onChange={(event) => setOnlineDeckId(event.target.value)}
                    value={onlineDeckId}
                  >
                    {USER_SELECTABLE_DECKS.map((deckDefinition) => (
                      <option key={deckDefinition.id} value={deckDefinition.id}>
                        {deckDefinition.name}
                      </option>
                    ))}
                  </select>
                </label>
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
                    const listedRoomPlayers = getRoomPlayersForDisplay(room);
                    const isParticipant = listedRoomPlayers.some(
                      (player) => player.id === playerId
                    );
                    const listedMaxPlayers = room.max_players ?? 2;
                    const canDeleteListedRoom = isRoomHost(room, playerId);
                    const canJoinRoom =
                      room.status !== 'finished' &&
                      listedRoomPlayers.length < listedMaxPlayers;

                    return (
                      <div
                        className={`available-room-row ${isCurrentRoom ? 'current-room' : ''}`}
                        key={room.id}
                      >
                        <div>
                          <strong>
                            {room.code}
                          </strong>
                          <span>
                            {room.status} · {listedRoomPlayers.length} / {listedMaxPlayers}
                          </span>
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
                        {canDeleteListedRoom && (
                          <button
                            disabled={isOnlineLoading}
                            type="button"
                            onClick={() => void handleDeleteOnlineRoom(room)}
                          >
                            Удалить
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
            <button type="button" onClick={closeOnlineModal}>
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
