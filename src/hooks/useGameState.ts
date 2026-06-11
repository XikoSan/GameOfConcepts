import { useEffect } from 'react';
import { useLocalGameState } from './useLocalGameState';
import { useMultiplayerGameState } from './useMultiplayerGameState';
import type { Room } from '../types/room';

interface UseGameStateOptions {
  room?: Room | null;
  localPlayerId?: string | null;
  onError?: (message: string) => void;
  onRoomUpdate?: (room: Room) => void;
}

export function useGameState({
  room = null,
  localPlayerId = null,
  onError,
  onRoomUpdate,
}: UseGameStateOptions = {}) {
  const localController = useLocalGameState();
  const multiplayerController = useMultiplayerGameState({
    room,
    fallbackGameState: localController.gameState,
    localPlayerId: localPlayerId ?? '',
    onError,
    onRoomUpdate,
  });
  const shouldUseMultiplayer = Boolean(room && localPlayerId);

  useEffect(() => {
    console.log('[useGameState room changed]', {
      code: room?.code,
      version: room?.version,
      pendingMove: room?.game_state?.pendingMove,
      localPlayerId,
      localSeatIndex: multiplayerController.localPlayerIndex,
      handsLength: room?.game_state?.players.length,
      handLength:
        multiplayerController.localPlayerIndex === null
          ? null
          : room?.game_state?.players[multiplayerController.localPlayerIndex]?.cards
              .length,
      board: room?.game_state?.board,
    });
  }, [localPlayerId, multiplayerController.localPlayerIndex, room?.code, room?.game_state, room?.version]);

  // TODO(MVP): Сейчас фасад выбирает режим по наличию комнаты. Позже
  // здесь появится полноценный выбор local/multiplayer и восстановление сессии.
  if (!shouldUseMultiplayer || !room || !localPlayerId) {
    return localController;
  }

  return {
    ...multiplayerController,
    startLocalGame: localController.resetGame,
  };
}
