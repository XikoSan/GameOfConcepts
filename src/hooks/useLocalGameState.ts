import { useCallback, useState } from 'react';
import { applyGameAction } from '../gameActions';
import { initializeGame } from '../game';
import type { Coordinates, GameState, RegularCardName } from '../game';
import type { GameController } from './gameController';

export function useLocalGameState(): GameController {
  const [gameState, setGameState] = useState<GameState>(() => initializeGame());

  const handlePlaceCard = useCallback(
    (cardName: RegularCardName, coordinates: Coordinates) => {
      setGameState((prev) =>
        applyGameAction(prev, { type: 'placeCard', cardName, coordinates })
      );
    },
    []
  );

  const resetGame = useCallback(() => {
    setGameState((prev) => applyGameAction(prev, { type: 'resetGame' }));
  }, []);

  const handleConfirmCard = useCallback(() => {
    setGameState((prev) => applyGameAction(prev, { type: 'confirmCard' }));
  }, []);

  const handleReturnCard = useCallback(() => {
    setGameState((prev) => applyGameAction(prev, { type: 'returnCard' }));
  }, []);

  const handleApproveCross = useCallback(() => {
    setGameState((prev) => applyGameAction(prev, { type: 'approveCross' }));
  }, []);

  const handleRejectCross = useCallback(() => {
    setGameState((prev) => applyGameAction(prev, { type: 'rejectCross' }));
  }, []);

  return {
    gameState,
    mode: 'local',
    connectionStatus: 'local',
    error: null,
    localPlayerIndex: null,
    activePlayerIndex: gameState.currentPlayerIndex,
    placeCard: handlePlaceCard,
    confirmCard: handleConfirmCard,
    returnCard: handleReturnCard,
    approveCross: handleApproveCross,
    rejectCross: handleRejectCross,
    resetGame,
    startLocalGame: resetGame,
  };
}
