import { useCallback, useEffect, useMemo, useState } from 'react';
import { applyGameAction } from '../gameActions';
import { getRoomById, updateRoomGameState } from '../services/roomService';
import type {
  Coordinates,
  GameState,
  PendingSemanticEdge,
  RegularCardName,
  SemanticRelation,
} from '../game';
import type { GameAction } from '../gameActions';
import type { Room } from '../types/room';
import type { GameController } from './gameController';

type PendingMoveVote = 'accept' | 'reject';

interface UseMultiplayerGameStateOptions {
  room: Room | null;
  fallbackGameState: GameState;
  localPlayerId: string;
  onError?: (message: string) => void;
  onRoomUpdate?: (room: Room) => void;
}

const getLocalPlayerIndex = (
  room: Room | null,
  localPlayerId: string
): number | null => {
  if (!room) return null;
  // Resolve by stable playerId first; visual order and players[] index are not game identity.
  const roomPlayer = room.players?.find((player) => player.id === localPlayerId);
  if (roomPlayer) return roomPlayer.seatIndex;
  if (room.player_1_id === localPlayerId) return 0;
  if (room.player_2_id === localPlayerId) return 1;
  return null;
};

const getCurrentRoomPlayerId = (room: Room): string | null =>
  room.turn_order?.[room.current_turn_index] ?? null;

// current_turn_index selects a playerId inside turn_order.
// Resolve that id back to a seat before reading hands, decks, scores, or ownership.
const getCurrentRoomSeatIndex = (room: Room): number =>
  room.players?.find((player) => player.id === getCurrentRoomPlayerId(room))
    ?.seatIndex ?? room.game_state.currentPlayerIndex;

const getTurnIndexForSeatIndex = (
  room: Room,
  seatIndex: number
): number | undefined => {
  const playerId = room.players?.find((player) => player.seatIndex === seatIndex)?.id;
  if (!playerId) return undefined;

  const turnIndex = room.turn_order?.indexOf(playerId) ?? -1;
  return turnIndex >= 0 ? turnIndex : undefined;
};

const getSeatIndexForTurnIndex = (
  room: Room,
  turnIndex: number
): number | undefined => {
  const playerId = room.turn_order?.[turnIndex];
  if (!playerId) return undefined;
  return room.players?.find((player) => player.id === playerId)?.seatIndex;
};

const getNextTurnIndex = (room: Room): number | undefined => {
  if (!room.turn_order?.length) return undefined;
  // Keep turn rotation tied to the room's turn_order length, not the old two-player modulo.
  return (room.current_turn_index + 1) % room.turn_order.length;
};

// Online room turn data is authoritative; sync the embedded GameState before applying actions.
const syncGameStateToRoomTurn = (room: Room): GameState => ({
  ...room.game_state,
  currentPlayerIndex: getCurrentRoomSeatIndex(room),
});

const syncPendingMoveToTurnOrder = (
  room: Room,
  gameState: GameState,
  action: GameAction
): GameState => {
  if (
    !['placeCard', 'submitSemanticMove'].includes(action.type) ||
    !gameState.pendingMove
  ) {
    return gameState;
  }

  if (
    action.type === 'submitSemanticMove' &&
    gameState.pendingMove.semanticStatus !== 'voting'
  ) {
    return gameState;
  }

  const nextTurnIndex = getNextTurnIndex(room);
  if (nextTurnIndex === undefined) return gameState;

  const reviewerIndex = getSeatIndexForTurnIndex(room, nextTurnIndex);
  if (reviewerIndex === undefined) return gameState;
  const placedByPlayerId = getCurrentRoomPlayerId(room);
  // The author is excluded from voting; every other playerId in turn_order is required.
  const requiredVoters = room.turn_order.filter(
    (playerId) => playerId !== placedByPlayerId
  );

  if (requiredVoters.length === 0) {
    console.warn('[online pendingMove voting]', {
      reason: 'requiredVoters is empty',
      turnOrder: room.turn_order,
      placedByPlayerId,
    });
  }

  return {
    ...gameState,
    pendingMove: {
      ...gameState.pendingMove,
      id: gameState.pendingMove.id ?? gameState.pendingMove.cardId,
      fromSeatIndex: gameState.pendingMove.fromSeatIndex ?? gameState.pendingMove.playerIndex,
      placedByPlayerId: placedByPlayerId ?? undefined,
      placedBySeatIndex:
        gameState.pendingMove.placedBySeatIndex ?? gameState.pendingMove.playerIndex,
      position:
        gameState.pendingMove.position ??
        Object.values(gameState.board).find(
          (card) => card.id === gameState.pendingMove?.cardId
        )?.coordinates,
      requiredVoters,
      votes: action.type === 'submitSemanticMove' ? {} : gameState.pendingMove.votes,
      status: action.type === 'submitSemanticMove' ? 'voting' : gameState.pendingMove.status,
      createdAt: gameState.pendingMove.createdAt ?? new Date().toISOString(),
      reviewerIndex,
      reviewerId: reviewerIndex,
    },
  };
};

const getNextCurrentTurnIndex = (
  room: Room,
  nextGameState: GameState,
  action: GameAction
): number | undefined => {
  if (action.type === 'confirmCard') return getNextTurnIndex(room);
  if (action.type === 'approveCross' || action.type === 'rejectCross') {
    return getTurnIndexForSeatIndex(room, nextGameState.currentPlayerIndex);
  }
  if (action.type === 'returnCard') {
    return getTurnIndexForSeatIndex(room, nextGameState.currentPlayerIndex);
  }

  return room.current_turn_index;
};

const getPendingMovePlayerIndex = (pendingMove: Room['game_state']['pendingMove']) =>
  pendingMove?.playerIndex ?? pendingMove?.playerId ?? null;

const getPendingMoveReviewerIndex = (pendingMove: Room['game_state']['pendingMove']) =>
  pendingMove?.reviewerIndex ?? pendingMove?.reviewerId ?? null;

const getPendingMoveRequiredVoters = (
  room: Room,
  pendingMove: Room['game_state']['pendingMove']
) => {
  if (!pendingMove) return [];
  if (Array.isArray(pendingMove.requiredVoters)) return pendingMove.requiredVoters;

  // Older pendingMove objects may lack requiredVoters; reconstruct from turn_order
  // while still excluding the move author.
  const placedByPlayerId =
    pendingMove.placedByPlayerId ??
    room.players?.find(
      (player) =>
        player.seatIndex ===
        (pendingMove.placedBySeatIndex ?? getPendingMovePlayerIndex(pendingMove))
    )?.id;

  return room.turn_order.filter((playerId) => playerId !== placedByPlayerId);
};

const getPendingMoveVoteCounts = (
  room: Room,
  pendingMove: Room['game_state']['pendingMove']
) => {
  const requiredVoters = getPendingMoveRequiredVoters(room, pendingMove);
  const votes = pendingMove?.votes ?? {};
  const acceptedCount = requiredVoters.filter(
    (playerId) => votes[playerId] === 'accept'
  ).length;
  const rejectCount = requiredVoters.filter(
    (playerId) => votes[playerId] === 'reject'
  ).length;
  const requiredCount = requiredVoters.length;
  // Majority is among non-author voters: 1 of 1, 2 of 2, or 2 of 3.
  // Once accepting is impossible, reject immediately so pendingMove cannot hang.
  const majority = Math.floor(requiredCount / 2) + 1;
  const votedCount = acceptedCount + rejectCount;
  const remainingCount = requiredCount - votedCount;
  const acceptedByMajority = acceptedCount >= majority;
  const rejectedByMajority = rejectCount >= majority;
  const acceptImpossible = acceptedCount + remainingCount < majority;

  return {
    acceptedCount,
    rejectCount,
    requiredCount,
    majority,
    votedCount,
    remainingCount,
    acceptedByMajority,
    rejectedByMajority,
    acceptImpossible,
  };
};

const ensureScoreCapacity = (scores: number[], maxPlayers: number) => {
  const nextScores = [...scores];

  while (nextScores.length < maxPlayers) {
    nextScores.push(0);
  }

  return nextScores;
};

function getActionBlockReason(
  room: Room,
  localPlayerIndex: number | null,
  action: GameAction
): string | null {
  if (room.status === 'finished' && action.type !== 'resetGame') {
    return `${action.type}: room is not playing`;
  }

  if (localPlayerIndex === null) return `${action.type}: localPlayerIndex is null`;

  const gameState = room.game_state;
  const currentSeatIndex = getCurrentRoomSeatIndex(room);

  switch (action.type) {
    case 'placeCard':
      if ((room.players?.length ?? 0) < 2) {
        return 'placeCard: waiting for at least two players';
      }

      return currentSeatIndex === localPlayerIndex
        ? null
        : 'placeCard: localPlayerIndex is not currentPlayerIndex';

    case 'confirmCard':
    case 'returnCard':
      if (!gameState.pendingMove) return `${action.type}: no pendingMove`;
      if (gameState.pendingMove.semanticStatus !== 'voting') {
        return `${action.type}: pendingMove is not voting`;
      }
      if (gameState.pendingMove.requiredVoters) {
        const localPlayerId = room.players?.find(
          (player) => player.seatIndex === localPlayerIndex
        )?.id;
        if (!localPlayerId) return `${action.type}: localPlayerId not found`;
        if (!gameState.pendingMove.requiredVoters.includes(localPlayerId)) {
          return `${action.type}: local player is not a required voter`;
        }
        if (gameState.pendingMove.votes?.[localPlayerId]) {
          return `${action.type}: local player already voted`;
        }
        return null;
      }
      return getPendingMoveReviewerIndex(gameState.pendingMove) === localPlayerIndex
        ? null
        : `${action.type}: localPlayerIndex is not reviewerIndex`;

    case 'upsertSemanticEdge':
    case 'removeSemanticEdge':
    case 'submitSemanticMove':
    case 'cancelPendingMove':
      if (!gameState.pendingMove) return `${action.type}: no pendingMove`;
      if (gameState.pendingMove.semanticStatus === 'voting') {
        return `${action.type}: pendingMove is already voting`;
      }
      return getPendingMovePlayerIndex(gameState.pendingMove) === localPlayerIndex
        ? null
        : `${action.type}: localPlayerIndex is not move author`;

    case 'approveCross':
    case 'rejectCross':
      if (!gameState.pendingCross) return `${action.type}: no pendingCross`;
      return currentSeatIndex === localPlayerIndex
        ? null
        : `${action.type}: localPlayerIndex is not cross reviewer`;

    case 'resetGame':
      return null;
  }
}

export function useMultiplayerGameState({
  room,
  fallbackGameState,
  localPlayerId,
  onError,
  onRoomUpdate,
}: UseMultiplayerGameStateOptions): GameController {
  const [error, setError] = useState<string | null>(null);
  const localPlayerIndex = useMemo(
    () => getLocalPlayerIndex(room, localPlayerId),
    [localPlayerId, room]
  );

  useEffect(() => {
    if (!room) return;

    console.debug('[game debug multiplayer state]', {
      maxPlayers: room.max_players,
      roomPlayersLength: room.players?.length ?? 0,
      roomPlayers: room.players?.map((player) => ({
        id: player.id,
        nickname: player.nickname,
        seatIndex: player.seatIndex,
      })),
      gameStatePlayersLength: room.game_state.players.length,
      handsLength: room.game_state.players.length,
      decksLength: room.game_state.deck.length,
      scoresLength: room.game_state.scores.length,
      turnOrder: room.turn_order,
      currentTurnIndex: room.current_turn_index,
      localPlayerId,
      localSeatIndex: localPlayerIndex,
      localHandLength:
        localPlayerIndex === null
          ? null
          : room.game_state.players[localPlayerIndex]?.cards.length,
      activePlayerId: getCurrentRoomPlayerId(room),
      activeSeatIndex: getCurrentRoomSeatIndex(room),
    });
  }, [localPlayerId, localPlayerIndex, room]);

  const reportError = useCallback(
    (message: string) => {
      setError(message);
      onError?.(message);
    },
    [onError]
  );

  const dispatchAction = useCallback(
    async (action: GameAction) => {
      if (!room) {
        console.warn('[online action blocked]', 'no active room');
        return;
      }

      const blockReason = getActionBlockReason(room, localPlayerIndex, action);
      if (blockReason) {
        console.warn('[online action blocked]', blockReason, {
          action,
          currentPlayerIndex: room.game_state.currentPlayerIndex,
          localPlayerIndex,
          pendingMovePlayerIndex: getPendingMovePlayerIndex(room.game_state.pendingMove),
          pendingMoveReviewerIndex: getPendingMoveReviewerIndex(
            room.game_state.pendingMove
          ),
          pendingMove: room.game_state.pendingMove,
          pendingCross: room.game_state.pendingCross,
        });
        reportError('Это действие недоступно для вашей роли.');
        return;
      }

      console.log('[online action]', action);
      const currentGameState = syncGameStateToRoomTurn(room);
      console.log('[online before]', currentGameState);

      // TODO(MVP): Сейчас весь gameState синхронизируется целиком через JSONB.
      // FIXME(MVP): Руки и колоды обоих игроков доступны клиенту через gameState.
      // TODO(MVP): Позже действия должны валидироваться сервером.
      const nextGameState = syncPendingMoveToTurnOrder(
        room,
        applyGameAction(currentGameState, action),
        action
      );
      console.log('[online after]', nextGameState);
      console.log('[online pendingMove]', {
        pendingMove: nextGameState.pendingMove,
        localPlayerIndex,
        pendingMovePlayerIndex: getPendingMovePlayerIndex(nextGameState.pendingMove),
        pendingMoveReviewerIndex: getPendingMoveReviewerIndex(nextGameState.pendingMove),
      });

      try {
        setError(null);
        // The room row stores turn position separately from game_state so all clients
        // agree on the same active player after the JSONB update lands.
        const nextCurrentTurnIndex = getNextCurrentTurnIndex(room, nextGameState, action);
        const updatedRoom = await updateRoomGameState(
          room.id,
          nextGameState,
          room.version,
          nextCurrentTurnIndex
        );
        console.log('[online update result]', updatedRoom);
        onRoomUpdate?.(updatedRoom);
      } catch (actionError) {
        const message =
          actionError instanceof Error &&
          actionError.message.includes('Room update conflict')
            ? 'Состояние комнаты изменилось. Повторите действие.'
            : actionError instanceof Error
              ? actionError.message
              : 'Не удалось обновить состояние комнаты.';

        reportError(message);
      }
    },
    [localPlayerIndex, onRoomUpdate, reportError, room]
  );

  const voteOnPendingMove = useCallback(
    async (vote: PendingMoveVote) => {
      if (!room) {
        console.warn('[online vote blocked]', 'no active room');
        return;
      }

      if (localPlayerIndex === null) {
        console.warn('[online vote blocked]', 'localPlayerIndex is null');
        reportError('Это действие недоступно для вашей роли.');
        return;
      }

      try {
        setError(null);
        const latestRoom = await getRoomById(room.id);
        if (!latestRoom) {
          console.warn('[online vote blocked]', 'room not found');
          reportError('Комната не найдена.');
          return;
        }

        if (latestRoom.status === 'finished') {
          console.warn('[online vote blocked]', 'room is finished');
          reportError('Партия уже завершена.');
          return;
        }

        const latestPendingMove = latestRoom.game_state.pendingMove;
        if (!latestPendingMove) {
          console.warn('[online vote blocked]', 'no pendingMove');
          return;
        }
        if (latestPendingMove.semanticStatus !== 'voting') {
          console.warn('[online vote blocked]', 'pendingMove is not voting');
          return;
        }

        const localRoomPlayer = latestRoom.players?.find(
          (player) => player.id === localPlayerId
        );
        if (!localRoomPlayer) {
          console.warn('[online vote blocked]', 'local player is not in room');
          reportError('Это действие недоступно для вашей роли.');
          return;
        }

        const placedByPlayerId =
          latestPendingMove.placedByPlayerId ??
          latestRoom.players?.find(
            (player) =>
              player.seatIndex ===
              (latestPendingMove.placedBySeatIndex ??
                getPendingMovePlayerIndex(latestPendingMove))
          )?.id;

        if (placedByPlayerId === localPlayerId) {
          console.warn('[online vote blocked]', 'author cannot vote');
          reportError('Нельзя голосовать за свой ход.');
          return;
        }

        const requiredVoters = getPendingMoveRequiredVoters(
          latestRoom,
          latestPendingMove
        );
        if (!requiredVoters.includes(localPlayerId)) {
          console.warn('[online vote blocked]', 'local player is not required voter', {
            localPlayerId,
            requiredVoters,
          });
          reportError('Это действие недоступно для вашей роли.');
          return;
        }

        const currentVotes = latestPendingMove.votes ?? {};
        if (currentVotes[localPlayerId]) {
          console.warn('[online vote blocked]', 'local player already voted', {
            localPlayerId,
            vote: currentVotes[localPlayerId],
          });
          return;
        }

        const nextVotes = {
          // Merge into the latest server votes to reduce overwrites from near-simultaneous clicks.
          ...currentVotes,
          [localPlayerId]: vote,
        };
        const pendingMoveWithVote = {
          ...latestPendingMove,
          requiredVoters,
          votes: nextVotes,
          status: 'voting' as const,
        };
        const voteState = getPendingMoveVoteCounts(latestRoom, pendingMoveWithVote);
        const latestGameState = syncGameStateToRoomTurn(latestRoom);
        let nextGameState: GameState;
        let nextCurrentTurnIndex = latestRoom.current_turn_index;

        console.log('[online pendingMove vote]', {
          vote,
          localPlayerId,
          requiredVoters,
          votes: nextVotes,
          acceptCount: voteState.acceptedCount,
          rejectCount: voteState.rejectCount,
          remainingCount: voteState.remainingCount,
          majority: voteState.majority,
          acceptedByMajority: voteState.acceptedByMajority,
          rejectedByMajority: voteState.rejectedByMajority,
          acceptImpossible: voteState.acceptImpossible,
        });

        if (voteState.acceptedByMajority) {
          // Scoring belongs to the seat that placed the card, not the reviewer who cast
          // the deciding vote or the currently rendered local player.
          const scoringSeatIndex =
            latestPendingMove.placedBySeatIndex ??
            getPendingMovePlayerIndex(latestPendingMove);
          const scoreBefore =
            scoringSeatIndex === null
              ? undefined
              : latestGameState.scores?.[scoringSeatIndex];
          nextGameState = applyGameAction(
            {
              ...latestGameState,
              pendingMove: pendingMoveWithVote,
            },
            { type: 'confirmCard' }
          );
          nextCurrentTurnIndex =
            getNextTurnIndex(latestRoom) ?? latestRoom.current_turn_index;
          const nextActiveSeatIndex =
            getSeatIndexForTurnIndex(latestRoom, nextCurrentTurnIndex) ??
            nextGameState.currentPlayerIndex;
          const nextScores = ensureScoreCapacity(
            nextGameState.scores ?? [],
            latestRoom.max_players
          );
          nextGameState = {
            ...nextGameState,
            currentPlayerIndex: nextActiveSeatIndex,
            scores: nextScores,
          };
          console.debug('[score debug accepted move]', {
            placedByPlayerId: latestPendingMove.placedByPlayerId,
            placedBySeatIndex: scoringSeatIndex,
            scoreBefore,
            scoreAfter:
              scoringSeatIndex === null ? undefined : nextScores[scoringSeatIndex],
            scoresLength: nextScores.length,
            scores: nextScores,
          });
        } else if (voteState.rejectedByMajority || voteState.acceptImpossible) {
          // Rejected cards return to the author and the turn stays with that same seat.
          nextGameState = applyGameAction(
            {
              ...latestGameState,
              pendingMove: pendingMoveWithVote,
            },
            { type: 'returnCard' }
          );
          const authorSeatIndex =
            latestPendingMove.placedBySeatIndex ??
            getPendingMovePlayerIndex(latestPendingMove);
          nextCurrentTurnIndex =
            authorSeatIndex === null
              ? latestRoom.current_turn_index
              : getTurnIndexForSeatIndex(latestRoom, authorSeatIndex) ??
                latestRoom.current_turn_index;
        } else {
          nextGameState = {
            ...latestGameState,
            pendingMove: pendingMoveWithVote,
          };
        }

        const updatedRoom = await updateRoomGameState(
          latestRoom.id,
          nextGameState,
          latestRoom.version,
          nextCurrentTurnIndex
        );
        console.log('[online vote update result]', updatedRoom);
        onRoomUpdate?.(updatedRoom);
      } catch (voteError) {
        const message =
          voteError instanceof Error &&
          voteError.message.includes('Room update conflict')
            ? 'Состояние комнаты изменилось. Повторите действие.'
            : voteError instanceof Error
              ? voteError.message
              : 'Не удалось отправить голос.';

        reportError(message);
      }
    },
    [localPlayerId, localPlayerIndex, onRoomUpdate, reportError, room]
  );

  const gameState = room?.game_state ?? fallbackGameState;
  const activePlayerIndex = room ? getCurrentRoomSeatIndex(room) : gameState.currentPlayerIndex;

  return {
    gameState,
    mode: 'multiplayer',
    connectionStatus: room?.status === 'playing' ? 'connected' : 'disconnected',
    error,
    localPlayerIndex,
    activePlayerIndex,
    placeCard: (cardName: RegularCardName, coordinates: Coordinates) => {
      void dispatchAction({ type: 'placeCard', cardName, coordinates });
    },
    upsertSemanticEdge: (
      neighborCardInstanceId: string,
      relation: SemanticRelation,
      direction: PendingSemanticEdge['direction']
    ) => {
      void dispatchAction({
        type: 'upsertSemanticEdge',
        neighborCardInstanceId,
        relation,
        direction,
      });
    },
    removeSemanticEdge: (neighborCardInstanceId: string) => {
      void dispatchAction({ type: 'removeSemanticEdge', neighborCardInstanceId });
    },
    submitSemanticMove: () => {
      void dispatchAction({ type: 'submitSemanticMove' });
    },
    cancelPendingMove: () => {
      void dispatchAction({ type: 'cancelPendingMove' });
    },
    confirmCard: () => {
      void voteOnPendingMove('accept');
    },
    returnCard: () => {
      void voteOnPendingMove('reject');
    },
    approveCross: () => {
      void dispatchAction({ type: 'approveCross' });
    },
    rejectCross: () => {
      void dispatchAction({ type: 'rejectCross' });
    },
    resetGame: () => {
      void dispatchAction({ type: 'resetGame' });
    },
    startLocalGame: () => undefined,
  };
}
