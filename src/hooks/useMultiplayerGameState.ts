import { useCallback, useMemo, useState } from 'react';
import { applyGameAction } from '../gameActions';
import { updateRoomGameState } from '../services/roomService';
import type { Coordinates, GameState, RegularCardName } from '../game';
import type { GameAction } from '../gameActions';
import type { Room } from '../types/room';
import type { GameController } from './gameController';

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
): 0 | 1 | null => {
  if (!room) return null;
  if (room.player_1_id === localPlayerId) return 0;
  if (room.player_2_id === localPlayerId) return 1;
  return null;
};

const getPendingMovePlayerIndex = (pendingMove: Room['game_state']['pendingMove']) =>
  pendingMove?.playerIndex ?? pendingMove?.playerId ?? null;

const getPendingMoveReviewerIndex = (pendingMove: Room['game_state']['pendingMove']) =>
  pendingMove?.reviewerIndex ?? pendingMove?.reviewerId ?? null;

function getActionBlockReason(
  room: Room,
  localPlayerIndex: 0 | 1 | null,
  action: GameAction
): string | null {
  if (localPlayerIndex === null) return `${action.type}: localPlayerIndex is null`;

  const gameState = room.game_state;

  switch (action.type) {
    case 'placeCard':
      return gameState.currentPlayerIndex === localPlayerIndex
        ? null
        : 'placeCard: localPlayerIndex is not currentPlayerIndex';

    case 'confirmCard':
    case 'returnCard':
      if (!gameState.pendingMove) return `${action.type}: no pendingMove`;
      return getPendingMoveReviewerIndex(gameState.pendingMove) === localPlayerIndex
        ? null
        : `${action.type}: localPlayerIndex is not reviewerIndex`;

    case 'approveCross':
    case 'rejectCross':
      if (!gameState.pendingCross) return `${action.type}: no pendingCross`;
      return gameState.currentPlayerIndex === localPlayerIndex
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
      console.log('[online before]', room.game_state);

      // TODO(MVP): Сейчас весь gameState синхронизируется целиком через JSONB.
      // FIXME(MVP): Руки и колоды обоих игроков доступны клиенту через gameState.
      // TODO(MVP): Позже действия должны валидироваться сервером.
      const nextGameState = applyGameAction(room.game_state, action);
      console.log('[online after]', nextGameState);
      console.log('[online pendingMove]', {
        pendingMove: nextGameState.pendingMove,
        localPlayerIndex,
        pendingMovePlayerIndex: getPendingMovePlayerIndex(nextGameState.pendingMove),
        pendingMoveReviewerIndex: getPendingMoveReviewerIndex(nextGameState.pendingMove),
      });

      try {
        setError(null);
        const updatedRoom = await updateRoomGameState(
          room.id,
          nextGameState,
          room.version
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

  const gameState = room?.game_state ?? fallbackGameState;

  return {
    gameState,
    mode: 'multiplayer',
    connectionStatus: room?.status === 'playing' ? 'connected' : 'disconnected',
    error,
    localPlayerIndex,
    activePlayerIndex: gameState.currentPlayerIndex,
    placeCard: (cardName: RegularCardName, coordinates: Coordinates) => {
      void dispatchAction({ type: 'placeCard', cardName, coordinates });
    },
    confirmCard: () => {
      void dispatchAction({ type: 'confirmCard' });
    },
    returnCard: () => {
      void dispatchAction({ type: 'returnCard' });
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
