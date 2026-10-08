// Application composition: menus, session lifecycle and local/online UI routing. Game rules live in game.ts and scoring/, not in modal handlers.
import { readSavedSession, writeSavedSession, type SavedSession } from './services/savedSession';
import type { TrainingState } from './tutorial/trainingGame';
import { Capacitor } from '@capacitor/core';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { DragEvent as ReactDragEvent, PointerEvent as ReactPointerEvent } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { FeedbackForm } from './components/FeedbackForm';
import { DictionaryModal } from './components/DictionaryModal';
import { DragPreviewLayer } from './components/DragPreviewLayer';
import { GameBoard } from './components/GameBoard';
import { MatchLogEntry } from './components/MatchLogEntry';
import { Modal } from './components/Modal';
import { PlayerHand } from './components/PlayerHand';
import { TableSidebar } from './components/TableSidebar';
import { useCompactTable } from './hooks/useCompactTable';
import { RulesContent } from './components/RulesContent';
import { MusicControls, MusicSettings } from './components/MusicSettings';
import { useBackgroundMusic } from './hooks/useBackgroundMusic';
import { TableReminder } from './components/TableReminder';
import packageInfo from '../package.json';
import './MainMenu.css';
import { TrainingGame } from './components/TrainingGame';
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
  startRoomGame,
  subscribeToRoom,
} from './services/roomService';
import { getHandRedrawAvailability, initializeGame } from './game';
import { isSymmetricRelation } from './scoring/semanticRelations';
import {
  getDeckDefinitionById,
  DEFAULT_DECK,
  USER_SELECTABLE_DECKS,
} from './data/deckDefinitions';
import type {
  Coordinates,
  GameState,
  PendingMove,
  PendingSemanticEdge,
  RegularCardName,
} from './game';
import type { MaxPlayers, Room, RoomPlayer } from './types/room';
import './App.css';
import './TableTheme.css';
import './MobileTable.css';

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
  if (pendingMove?.semanticStatus !== 'voting' || !pendingMove.requiredVoters) {
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

const getLocalPlayersForDisplay = (gameState: GameState, names: string[]): RoomPlayer[] =>
  gameState.players.map((player) => ({
    id: `local-${player.playerId}`,
    nickname: names[player.playerId] || `Игрок ${player.playerId + 1}`,
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

const getDeckDisplayName = (deckId?: string) =>
  getDeckDefinitionById(deckId ?? '')?.name ?? DEFAULT_DECK.name;

interface DragPreview {
  cardName: RegularCardName;
  initialX: number;
  initialY: number;
  playerColor: 'blue' | 'orange' | 'green' | 'purple';
}

type ActiveModal = 'feedback' | 'local-game' | 'new-game' | 'rules' | 'settings' | 'tutorial' | 'leave-game' | null;

const defaultInterfaceSettings = {
  showPlayableHighlights: true,
  showCardTooltips: true,
};

function App() {
  const musicAudioRef = useRef<HTMLAudioElement>(null);
  const menuMusicStarted = useRef(Capacitor.isNativePlatform());
  const music = useBackgroundMusic(musicAudioRef);
  incrementCounter('render:App');
  // TEMP(MVP): Комнаты работают без авторизации, игрок определяется через
  // Identity comes from the authenticated guest session.
  const { playerId, nickname: savedNickname, saveNickname } = usePlayerIdentity();
  const [selectedCard, setSelectedCard] = useState<RegularCardName | null>(null);
  const compactTable = useCompactTable();
  const [actionDock, setActionDock] = useState<HTMLDivElement | null>(null);
  const [dragPreview, setDragPreview] = useState<DragPreview | null>(null);
  const [showMainMenu, setShowMainMenu] = useState(true);
  const [savedSession, setSavedSession] = useState(readSavedSession);
  const [saveError, setSaveError] = useState('');
  const [trainingInitialState, setTrainingInitialState] = useState<TrainingState>();
  const trainingSnapshot = useRef<TrainingState | null>(null);
  const rememberTrainingState = useCallback((state: TrainingState) => { trainingSnapshot.current = state; }, []);
  const [activeModal, setActiveModal] = useState<ActiveModal>(null);
  const [trainingSetup, setTrainingSetup] = useState(false);
  const [trainingRunning, setTrainingRunning] = useState(false);
  const [resetCameraSignal, setResetCameraSignal] = useState(0);
  const [onlineRoom, setOnlineRoom] = useState<Room | null>(null);
  const [onlineError, setOnlineError] = useState<string | null>(null);
  const [isOnlineLoading, setIsOnlineLoading] = useState(false);
  const [availableRooms, setAvailableRooms] = useState<Room[]>([]);
  const [isRoomListLoading, setIsRoomListLoading] = useState(false);
  const [onlineNickname, setOnlineNickname] = useState(savedNickname);
  const [maxPlayers, setMaxPlayers] = useState<MaxPlayers>(2);
  const [localNameDrafts, setLocalNameDrafts] = useState<string[]>(['', '', '', '']);
  const [localPlayerNames, setLocalPlayerNames] = useState<string[]>([]);
  const [localDeckId, setLocalDeckId] = useState(DEFAULT_DECK.id);
  const [onlineDeckId, setOnlineDeckId] = useState(DEFAULT_DECK.id);
  const [dictionaryTerm, setDictionaryTerm] = useState<string | null>(null);
  const [isDictionaryOpen, setIsDictionaryOpen] = useState(false);
  const [isRedrawConfirmOpen, setIsRedrawConfirmOpen] = useState(false);
  const [interfaceSettings, setInterfaceSettings] = useState(
    defaultInterfaceSettings
  );
  const roomSubscriptionRef = useRef<RealtimeChannel | null>(null);
  const onlineRoomRef = useRef<Room | null>(null);
  const activeCardDragRef = useRef(false);
  const matchLogRef = useRef<HTMLOListElement>(null);
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
    redrawHand,
    approveCross,
    rejectCross,
    resetGame,
    startLocalGame,
    restoreLocalGame,
  } = useGameState({
    room: onlineRoom,
    localPlayerId: playerId,
    onError: setOnlineError,
    onRoomUpdate: setOnlineRoom,
  });
  // Preserve original indexes: saved move details are keyed by log position.
  const moveLog = gameState.log.map((event, index) => ({ event, index }))
    .filter(({ event, index }) => gameState.logDetails?.[index]?.score || /^Игрок (\d+) сыграл «(.+)»\. .*\+(\d+)\.$/.test(event));
  const latestLogEntry = moveLog.at(-1)?.event;
  useEffect(() => {
    const log = matchLogRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [moveLog.length, latestLogEntry, showMainMenu]);

  const hasPendingDecision = Boolean(gameState.pendingMove || gameState.pendingCross);
  const activeSelectedCard = hasPendingDecision ? null : selectedCard;
  const canControlPlayer = (playerIndex: number) =>
    mode === 'local' || localPlayerIndex === playerIndex;
  const isOnlineGameStarted = onlineRoom?.status === 'playing';
  const startMusic = music.start;
  useEffect(() => {
    if (isOnlineGameStarted) startMusic();
  }, [isOnlineGameStarted, onlineRoom?.id, startMusic]);
  const isOnlineTable = isOnlineGameStarted;
  const canUseGameActions = !onlineRoom || isOnlineGameStarted;
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
    gameState.pendingMove?.semanticStatus === 'voting' &&
    !canReviewPendingMove &&
    (mode === 'multiplayer' ||
      (localPlayerIndex !== null && pendingMovePlayerIndex === localPlayerIndex));
  const roomList = getRoomList(availableRooms, onlineRoom);
  const onlinePlayers = getRoomPlayersForDisplay(onlineRoom);
  const onlineMaxPlayers = onlineRoom?.max_players ?? maxPlayers;
  const localPlayers = getLocalPlayersForDisplay(gameState, localPlayerNames);
  const currentPlayerId = onlineRoom?.turn_order?.[onlineRoom.current_turn_index] ?? null;
  const isOnlineHost = isRoomHost(onlineRoom, playerId);
  const activeHandRedrawAvailability = getHandRedrawAvailability(
    { ...gameState, currentPlayerIndex: activePlayerIndex },
    activePlayerIndex
  );
  const activeHandRedrawUsed =
    gameState.handRedrawUsedByPlayerId?.[activePlayerIndex] ?? false;
  const canUseHandRedraw =
    canControlPlayer(activePlayerIndex) &&
    canUseGameActions &&
    !hasPendingDecision &&
    !(onlineRoom && onlinePlayers.length < 2) &&
    activeHandRedrawAvailability.canRedraw;
  const handRedrawDisabledReason =
    onlineRoom && onlinePlayers.length < 2
      ? 'Пересдача доступна после начала онлайн-партии.'
      : activeHandRedrawAvailability.reason;
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
  const isSubmittingSemanticMove = false;
  const canEditSemanticMove =
    Boolean(gameState.pendingMove) &&
    gameState.pendingMove?.semanticStatus === 'defining-relations' &&
    (mode === 'local' ||
      (localPlayerIndex !== null && pendingMovePlayerIndex === localPlayerIndex));
  const isPendingEdgeComplete = (edge: PendingSemanticEdge) =>
    Boolean(edge.relation) &&
    (isSymmetricRelation(edge.relation) || Boolean(edge.direction));
  const canSubmitRelations =
    canEditSemanticMove &&
    pendingSemanticEdges.length > 0 &&
    pendingSemanticEdges.every(isPendingEdgeComplete) &&
    !isSubmittingSemanticMove;
  const handlePlaceCard = (cardName: RegularCardName, coordinates: Coordinates) => {
    if (!selectedCard || hasPendingDecision) return;

    setIsRedrawConfirmOpen(false);
    placeCard(cardName, coordinates);
  };

  const handleOpenDictionary = (term: string) => {
    setDictionaryTerm(term);
    setIsDictionaryOpen(true);
  };

  const handleRedrawHand = () => {
    if (activeCardDragRef.current) return;

    setIsRedrawConfirmOpen(false);
    redrawHand();
    setSelectedCard(null);
    setDragPreview(null);
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
    event: ReactDragEvent<HTMLDivElement> | ReactPointerEvent<HTMLDivElement>
  ) => {
    if (hasPendingDecision) return;

    resetPerformanceReport();
    incrementCounter('drag:start');
    incrementCounter('dom:getBoundingClientRect:drag-card-start');
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX || rect.left + rect.width / 2;
    const y = event.clientY || rect.top + rect.height / 2;

    activeCardDragRef.current = true;
    setIsRedrawConfirmOpen(false);
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
    setShowMainMenu(false);
    setLocalPlayerNames(localNameDrafts.slice(0, maxPlayers).map((name) => name.trim()));
    resetGame(maxPlayers, localDeckId);
    music.start();
    setSelectedCard(null);
    setDragPreview(null);
    setResetCameraSignal((signal) => signal + 1);
    setActiveModal(null);
  };

  const handleStartLocalGame = () => {
    setShowMainMenu(false);
    setLocalPlayerNames(localNameDrafts.slice(0, maxPlayers).map((name) => name.trim()));
    // TEMP(MVP): Выход из онлайн-комнаты пока только локальный, без удаления
    // комнаты из Supabase.
    roomSubscriptionRef.current?.unsubscribe();
    roomSubscriptionRef.current = null;
    setOnlineRoom(null);
    setOnlineError(null);
    startLocalGame(maxPlayers, localDeckId);
    music.start();
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
        displayName: localPlayerNames[playerIndex] || `Игрок ${playerIndex + 1}`,
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
      statusLabel = gameState.pendingMove.semanticStatus === 'defining-relations'
        ? 'Выбор связей'
        : 'Ожидаем голоса';
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

    if (import.meta.env.DEV) console.log('[online polling fetch]', {
      reason,
      roomId: currentRoom.id,
      currentVersion: currentRoom.version,
    });

    try {
      const fetchedRoom = await getRoomById(currentRoom.id);
      if (import.meta.env.DEV) console.log('[manual sync room]', { reason, room: fetchedRoom });

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
        if (import.meta.env.DEV) console.log('[online polling update applied]', {
          reason,
          previousVersion: currentRoom.version,
          nextVersion: fetchedRoom.version,
        });
        setOnlineRoom(fetchedRoom);
        return;
      }

      if (import.meta.env.DEV) console.log('[online polling no changes]', {
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
    if (room.status === 'playing') {
      setShowMainMenu(false);
      setActiveModal(null);
    } else {
      setActiveModal('new-game');
    }
    roomSubscriptionRef.current = subscribeToRoom(room.id, (updatedRoom) => {
      if (import.meta.env.DEV) console.log('[app room update]', {
        code: updatedRoom.code,
        version: updatedRoom.version,
        pendingMove: updatedRoom.game_state.pendingMove,
        board: updatedRoom.game_state.board,
      });
      setOnlineRoom(updatedRoom);
      if (updatedRoom.status === 'playing') {
        setActiveModal(null);
      }
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
      if (import.meta.env.DEV) console.log('[create room click]');
      if (import.meta.env.DEV) console.log('[create room playerId]', playerId);
      if (import.meta.env.DEV) console.log('[create room nickname]', nickname);
      if (import.meta.env.DEV) console.log('[create room maxPlayers]', maxPlayers);
      if (import.meta.env.DEV) console.log('[create room deckId]', onlineDeckId);
      if (import.meta.env.DEV) console.debug('[create room click debug]', {
        playerId,
        nickname,
        maxPlayers,
      });
      if (import.meta.env.DEV) console.log('[create room env check]', {
        hasUrl: Boolean(import.meta.env.VITE_SUPABASE_URL),
        hasKey: Boolean(import.meta.env.VITE_SUPABASE_ANON_KEY),
      });
      const deckDefinition = getDeckDefinitionById(onlineDeckId) ?? DEFAULT_DECK;
      const initialGameState = initializeGame(maxPlayers, deckDefinition, 0);
      if (import.meta.env.DEV) console.log('[create room initialGameState]', initialGameState);
      // TODO(MVP): Пока UI комнаты не подключён к синхронизации ходов.
      const room = await createRoom({
        playerId,
        nickname,
        maxPlayers,
        initialGameState,
      });
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
      if (room.status === 'playing') closeOnlineModal();
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
      if (joinedRoom.status === 'playing') closeOnlineModal();
      void loadAvailableRooms();
    } catch (error) {
      setOnlineError(
        error instanceof Error ? error.message : 'Не удалось войти в комнату.'
      );
    } finally {
      setIsOnlineLoading(false);
    }
  };

  const handleStartOnlineGame = async () => {
    if (!onlineRoom || !isOnlineHost) return;

    const currentPlayers = getRoomPlayersForDisplay(onlineRoom);
    if (currentPlayers.length !== (onlineRoom.max_players ?? 2)) {
      setOnlineError(
        `Нужно дождаться всех игроков: ${currentPlayers.length} / ${onlineRoom.max_players ?? 2}.`
      );
      return;
    }

    setIsOnlineLoading(true);
    setOnlineError(null);

    try {
      const startedRoom = await startRoomGame({
        roomId: onlineRoom.id,
        playerId,
      });
      handleRoomConnected(startedRoom);
      closeOnlineModal();
    } catch (error) {
      setOnlineError(
        error instanceof Error ? error.message : 'Не удалось начать игру.'
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
    if (onlineRoom?.status !== 'playing' || activeModal !== 'new-game') return;

    const closeTimer = window.setTimeout(() => {
      setShowMainMenu(false);
      setActiveModal(null);
    }, 0);

    return () => window.clearTimeout(closeTimer);
  }, [activeModal, onlineRoom?.status]);

  useEffect(() => {
    if (!onlineRoom) return;

    if (import.meta.env.DEV) console.debug('[game debug local hand]', {
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

  const renderPlayers = () => (
    <div className="table-players" aria-label="Игроки и счёт">
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
              <div className="player-score-content">
                <div className="player-score-points">
                  <strong className="player-score-total" title="Общий счёт">{getSeatScore(player.seatIndex)}</strong>
                </div>
                <div className="player-score-identity">
                  <span className="player-score-name" title={player.nickname}>{player.nickname}</span>
                  {isActiveScore && <small className="player-score-status">{scoreStateLabel}</small>}
                </div>
              </div>
            </div>
          );
        })}
    </div>
  );

  const renderBoard = () => (
    <GameBoard
      actionDock={compactTable ? actionDock : null}
      key={gameState.startCard.id}
      resetCameraSignal={resetCameraSignal}
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
      pendingCrossReviewerLabel={!onlineRoom ? localPlayerNames[activePlayerIndex] || getPlayerLabel(activePlayerIndex) : getPlayerLabel(activePlayerIndex)}
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

  const renderHandActions = () => (<div className="hand-actions">
          <button
            className="action-button action-button-quiet hand-redraw-button"
            aria-label={activeHandRedrawUsed ? "Пересдача использована" : "Пересдать руку"}
            disabled={!canUseHandRedraw}
            title={
              canUseHandRedraw
                ? 'Пересдать всю руку'
                : activeHandRedrawUsed
                  ? 'Пересдача уже использована.'
                  : handRedrawDisabledReason
            }
            type="button"
            onClick={() => setIsRedrawConfirmOpen(true)}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M20 7v5h-5M4 17v-5h5" />
              <path d="M6.1 7a7 7 0 0 1 11.6-1L20 9M4 15l2.3 3A7 7 0 0 0 17.9 17" />
            </svg>
          </button>
          <p className="hand-redraw-caption">Пересдача руки</p>

  </div>);

  const renderControlPanel = () => onlineRoom ? (
    <aside className="side-panel control-panel" aria-label="Панель управления">
      <nav className="panel-actions" aria-label="Действия">
        {onlineRoom && <section className="action-group" aria-label="Инструменты">
          <h2>Инструменты</h2>
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
        </section>}


      </nav>


    </aside>
  ) : null;

  const renderPlayerHand = (
    playerIndex: number,
    className?: string,
    forceInactive = false
  ) => {
    const player = gameState.players[playerIndex];
    const deck = gameState.sharedDeck ?? gameState.deck[playerIndex];
    if (!player || !deck) return null;
    const handMeta = getHandMeta(playerIndex);
    const isControllableActiveHand =
      !forceInactive &&
      canUseGameActions &&
      activePlayerIndex === playerIndex &&
      !hasPendingDecision &&
      canControlPlayer(playerIndex);

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
        isActive={isControllableActiveHand}
        className={className}
        displayName={handMeta.displayName}
        statusLabel={handMeta.statusLabel}
        onStartCardDrag={handleStartCardDrag}
        onCancelCardDrag={handleCancelCardDrag}
        onOpenDictionary={handleOpenDictionary}
      />
    );
  };

  const startMenuMusic = () => {
    if (menuMusicStarted.current) return;
    menuMusicStarted.current = true;
    music.start();
  };

  const openMainMenu = () => {
    setTrainingRunning(false);
    music.select('music-for-manatees');
    setSelectedCard(null);
    setDragPreview(null);
    setActiveModal(null);
    // Rooms keep their game state on the server; local state stays in its controller.
    roomSubscriptionRef.current?.unsubscribe();
    roomSubscriptionRef.current = null;
    onlineRoomRef.current = null;
    setOnlineRoom(null);
    setShowMainMenu(true);
  };

  const requestMainMenu = () => { setSaveError(''); setActiveModal('leave-game'); };
  const leaveGame = (save: boolean) => {
    if (onlineRoom) { openMainMenu(); return; }
    try {
      const session: SavedSession | null = save ? (trainingRunning && trainingSnapshot.current
        ? { version: 1, kind: 'training', training: trainingSnapshot.current, names: [localNameDrafts[0].trim() || 'Вы'] }
        : { version: 1, kind: 'local', game: gameState, names: localPlayerNames }) : null;
      writeSavedSession(session);
      setSavedSession(session);
      openMainMenu();
    } catch { setSaveError('Не удалось сохранить партию. Освободите место на устройстве или останьтесь в игре.'); }
  };
  const resumeSavedGame = () => {
    if (!savedSession) return;
    if (savedSession.kind === 'training') {
      setTrainingInitialState(savedSession.training);
      setLocalNameDrafts([savedSession.names[0] || 'Вы', 'Учебный соперник', '', '']);
      setTrainingRunning(true);
      setActiveModal('tutorial');
    } else {
      restoreLocalGame(savedSession.game);
      setLocalPlayerNames(savedSession.names);
      setActiveModal(null);
      setResetCameraSignal(value => value + 1);
    }
    setShowMainMenu(false);
  };

  return (
    <div className="app-container">
      <audio ref={musicAudioRef} src={music.activeTrack.src} preload="none" hidden loop={showMainMenu && activeModal !== 'tutorial'} onEnded={() => { if (!showMainMenu || activeModal === 'tutorial') music.skip(1); }} onPlaying={music.loaded} onError={music.failed} />
      {!showMainMenu && <main className="game-table" inert={trainingRunning} aria-hidden={trainingRunning ? true : undefined}>
        <section className={`play-area ${isOnlineTable ? 'play-area-online' : ''}`} aria-label="Игровой стол">
          <header className="table-status-bar">
            {renderPlayers()}
            <nav className="table-menu" aria-label="Меню игры">
              <button className="table-menu-tutorial" type="button" onClick={requestMainMenu}>Меню</button>
              <button className="table-menu-rules" type="button" onClick={() => { setActiveModal('rules'); }}>Правила</button>
              <button className="table-menu-settings" type="button" onClick={() => { setActiveModal('settings'); }}>Настройки</button>
            </nav>
          </header>
          <div className="table-workspace">
            <div className="table-center">
              <div className="board-section">
                {renderBoard()}
                <div className="board-tools">
                  <button className="center-board-button" type="button" onClick={handleResetCamera} aria-label="Центрировать поле" title="Центрировать поле">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                      <circle cx="12" cy="12" r="6" />
                      <path d="M12 2v4m0 12v4M2 12h4m12 0h4" />
                      <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
                    </svg>
                  </button>
                </div>
              </div>
              <div className={`table-hand-tray ${compactTable && gameState.pendingMove ? 'has-mobile-actions' : ''}`}>
                <div className="mobile-action-dock" ref={setActionDock} />
                {/* Online keeps the local hand; hot-seat follows the active player. */}
                {isOnlineTable
                  ? bottomTablePlayerIndex !== null && renderPlayerHand(bottomTablePlayerIndex, undefined, onlinePlayers.length < 2)
                  : renderPlayerHand(activePlayerIndex)}
                {renderHandActions()}
              </div>
              {isOnlineTable && onlinePlayers.length < 2 && <p className="online-waiting-note">Ожидание второго игрока</p>}
            </div>
            <TableSidebar controls={renderControlPanel()} log={<section className="sidebar-log" aria-label="Лог партии">
                <h3>Лог партии</h3>
                {moveLog.length > 0 ? (
                  <ol className="match-log" ref={matchLogRef}>
                    {moveLog.map(({ event, index }) => <MatchLogEntry key={`${index}-${event}`} event={event} detail={gameState.logDetails?.[index]} names={onlineRoom ? Array.from({ length: 4 }, (_, seat) => onlinePlayers.find((player) => player.seatIndex === seat)?.nickname || `Игрок ${seat + 1}`) : localPlayerNames} />)}
                  </ol>
                ) : <p>Принятые ходы появятся здесь.</p>}
              </section>} reminder={<TableReminder snapshot={gameState.deckSnapshot} />} />
          </div>
        </section>
      </main>}
      {showMainMenu && activeModal !== 'tutorial' && <main className="main-menu" aria-label="Главное меню" inert={activeModal !== null}
        onPointerDownCapture={event => { if (event.button === 0) startMenuMusic(); }}
        onKeyDownCapture={event => { if (event.key === 'Enter' || event.key === ' ') startMenuMusic(); }}>
        <h1>Игра понятий</h1>
        <nav className="main-menu-actions" aria-label="Главное меню">
          <div className="main-menu-row">
            <button type="button" onClick={() => { setLocalNameDrafts(['', '', '', '']); setActiveModal('local-game'); }}>Локальная игра</button>
            <button type="button" onClick={handleOpenNewGameModal}>Онлайн игра</button>
          </div>
          <div className="main-menu-row main-menu-learning">
            <button className="main-menu-training" type="button" onClick={() => { setTrainingSetup(true); setMaxPlayers(2); setLocalDeckId(DEFAULT_DECK.id); setLocalNameDrafts(['', 'Учебный соперник', '', '']); setActiveModal('local-game'); }}>Обучение</button>
            {savedSession && <button type="button" onClick={resumeSavedGame}>{savedSession.kind === 'training' ? 'Продолжить обучение' : 'Продолжить игру'}</button>}
          </div>
          <div className="main-menu-row">
            <button type="button" onClick={() => setActiveModal('rules')}>Правила</button>
            <button type="button" onClick={() => setActiveModal('settings')}>Настройки</button>
          </div>
        </nav>
        <footer className="main-menu-footer">
          <button className="feedback-link" type="button" onClick={() => setActiveModal('feedback')}>Обратная связь</button>
          <span>Версия {packageInfo.version}</span>
        </footer>
      </main>}
      {dragPreview && (
        <DragPreviewLayer
          cardName={dragPreview.cardName}
          initialX={dragPreview.initialX}
          initialY={dragPreview.initialY}
          playerColor={dragPreview.playerColor}
        />
      )}
      {activeModal === 'feedback' && <Modal title="Обратная связь" onClose={() => setActiveModal(null)}><FeedbackForm /></Modal>}
      {activeModal === 'local-game' && (
        <>
          {trainingSetup && <aside className="training-local-annotation-window" aria-label="Пояснение к обучению"><h2>Добро пожаловать в обучение</h2><p>Для того чтобы начать локальную игру, нужно выбрать количество игроков, тему игральной колоды и ввести никнеймы.</p><div className="training-local-callout">В обучении параметры заданы заранее. Введите свой никнейм и начните партию.</div></aside>}
          <Modal onClose={() => { setTrainingSetup(false); setLocalNameDrafts(['', '', '', '']); setActiveModal(null); }} title="Локальная игра">
          <div className="control-panel local-game-setup">
            <div className="local-game-options">
              <div className="max-players-picker" aria-label="Количество локальных игроков">
                <span>Игроков</span>
                {([2, 3, 4] as const).map((playersCount) => (
                  <button
                    className={maxPlayers === playersCount ? 'active' : ''}
                    aria-pressed={maxPlayers === playersCount}
                    key={playersCount}
                    onClick={() => setMaxPlayers(playersCount)} disabled={trainingSetup}
                    type="button"
                  >
                    {playersCount}
                  </button>
                ))}
              </div>
              <label className="deck-select-field">
                <span>Колода</span>
                <select
                  disabled={trainingSetup}
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
            </div>
            <fieldset className="local-player-names">
              <legend>Имена игроков</legend>
              {Array.from({ length: maxPlayers }, (_, index) => (
                <label className={`local-player-name local-player-name-${index}`} key={index}>
                  <span>Игрок {index + 1}</span>
                  <input
                    type="text"
                    value={trainingSetup && index === 1 ? 'Учебный соперник' : localNameDrafts[index]}
                    placeholder={`Игрок ${index + 1}`}
                    maxLength={24}
                    autoComplete="off"
                    disabled={trainingSetup && index === 1}
                    onChange={(event) => setLocalNameDrafts((names) => names.map((name, seat) => seat === index ? event.target.value : name))}
                  />
                </label>
              ))}
            </fieldset>
            <button className="action-button action-button-primary" type="button" onClick={() => { if (trainingSetup) { setTrainingInitialState(undefined); trainingSnapshot.current = null; setTrainingSetup(false); setTrainingRunning(true); setShowMainMenu(false); setActiveModal('tutorial'); } else if (onlineRoom) { handleStartLocalGame(); } else { handleConfirmNewGame(); } }}>
              Начать партию
            </button>
          </div>
          </Modal>
        </>
      )}
      {activeModal === 'new-game' && (
        <Modal onClose={closeOnlineModal} title="Онлайн игра">
          <div className="new-game-modal">
            {onlineRoom?.status === 'waiting' ? (
              <section className="online-lobby">
                <div className="online-lobby-header">
                  <div>
                    <span>Лобби</span>
                    <h3>{onlineRoom.code}</h3>
                  </div>
                  <strong>{onlinePlayers.length} / {onlineMaxPlayers}</strong>
                </div>

                <div className="online-lobby-players">
                  {Array.from({ length: onlineMaxPlayers }, (_, seatIndex) => {
                    const player = onlinePlayers.find(
                      (roomPlayer) => roomPlayer.seatIndex === seatIndex
                    );

                    return (
                      <div
                        className={`online-lobby-player ${player ? `player-${seatIndex}` : 'empty'}`}
                        key={seatIndex}
                      >
                        <span aria-hidden="true">{player ? '●' : '○'}</span>
                        <strong>
                          {player?.nickname?.trim() || 'Ожидание игрока...'}
                        </strong>
                        {player?.isHost && <small>хост</small>}
                        {player?.id === playerId && <small>вы</small>}
                      </div>
                    );
                  })}
                </div>

                <div className="online-lobby-settings">
                  <h3>Параметры</h3>
                  <p>Игроков: {onlineMaxPlayers}</p>
                  <p>
                    Сложность: {getDeckDisplayName(onlineRoom.game_state.deckSnapshot?.sourceDeckId)}
                  </p>
                </div>

                <div className="online-lobby-actions">
                  {isOnlineHost && onlinePlayers.length === onlineMaxPlayers ? (
                    <button
                      className="action-button action-button-primary"
                      disabled={isOnlineLoading}
                      type="button"
                      onClick={() => void handleStartOnlineGame()}
                    >
                      Начать игру
                    </button>
                  ) : onlinePlayers.length < onlineMaxPlayers ? (
                    <p>Ожидание игроков: {onlinePlayers.length} / {onlineMaxPlayers}</p>
                  ) : (
                    <p>Ожидание запуска игры хостом</p>
                  )}
                  {isOnlineHost && (
                    <button
                      className="action-button action-button-quiet"
                      disabled={isOnlineLoading}
                      type="button"
                      onClick={() => void handleDeleteOnlineRoom()}
                    >
                      Удалить комнату
                    </button>
                  )}
                </div>
              </section>
            ) : (
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
                    aria-pressed={maxPlayers === playersCount}
                      key={playersCount}
                      onClick={() => setMaxPlayers(playersCount)}
                      type="button"
                    >
                      {playersCount}
                    </button>
                  ))}
                </div>
                <label className="deck-select-field">
                  <span>Сложность</span>
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
                    const isWaitingForPlayers = room.status === 'waiting';
                    const canJoinRoom =
                      isWaitingForPlayers &&
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
            )}

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
      {trainingRunning && <TrainingGame initialState={trainingInitialState} onStateChange={rememberTrainingState} playerName={localNameDrafts[0].trim() || 'Вы'} paused={activeModal !== 'tutorial' && activeModal !== null} onClose={requestMainMenu} controls={null}
        onOpenRules={() => setActiveModal('rules')} onOpenSettings={() => setActiveModal('settings')} />}
      {isRedrawConfirmOpen && canUseHandRedraw && !showMainMenu && activeModal === null && (
        <Modal title="Пересдать руку?" onClose={() => setIsRedrawConfirmOpen(false)}>
          <div className="redraw-confirm-dialog">
            <p>Заменить всю руку? Пересдачу можно использовать один раз за партию.</p>
            <div className="control-redraw-actions">
              <button type="button" onClick={handleRedrawHand}>Пересдать</button>
              <button type="button" onClick={() => setIsRedrawConfirmOpen(false)}>Отмена</button>
            </div>
          </div>
        </Modal>
      )}
      {activeModal === 'leave-game' && <Modal title="Вернуться в меню?" onClose={() => setActiveModal(trainingRunning ? 'tutorial' : null)}>
        <p>{onlineRoom ? 'Партия сохранена в комнате. Вы сможете вернуться к ней через список онлайн-комнат.' : 'Сохраните текущую партию, чтобы продолжить позже, или завершите её без сохранения.'}</p>
        {saveError && <p role="alert">{saveError}</p>}
        <div className="modal-actions leave-game-actions">
          <button type="button" onClick={() => setActiveModal(trainingRunning ? 'tutorial' : null)}>Остаться в игре</button>
          {!onlineRoom && <button type="button" onClick={() => leaveGame(false)}>Завершить партию</button>}
          <button className="save-game-button" type="button" onClick={() => leaveGame(true)}>{onlineRoom ? 'В меню' : 'Сохранить и выйти'}</button>
        </div>
      </Modal>}
      {activeModal === 'rules' && (
        <Modal onClose={() => setActiveModal(null)} title="Правила">
          <RulesContent deckSnapshot={gameState.deckSnapshot} />
        </Modal>
      )}
      {activeModal === 'settings' && (
        <Modal onClose={() => setActiveModal(null)} title="Настройки" headerActions={<MusicControls music={music} />}>
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
          <MusicSettings music={music} />
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
