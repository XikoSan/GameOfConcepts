import { useState, useCallback } from 'react';
import {
  confirmPendingCard,
  initializeGame,
  placeCard,
  returnPendingCard,
} from '../game';
import type { Coordinates, GameState, RegularCardName } from '../game';

export function useGameState() {
  const [gameState, setGameState] = useState<GameState>(() => initializeGame());

  const handlePlaceCard = useCallback(
    (cardName: RegularCardName, coordinates: Coordinates) => {
      setGameState((prev) => placeCard(prev, cardName, coordinates));
    },
    []
  );

  const resetGame = useCallback(() => {
    setGameState(initializeGame());
  }, []);

  const handleConfirmPendingCard = useCallback(() => {
    setGameState((prev) => confirmPendingCard(prev));
  }, []);

  const handleReturnPendingCard = useCallback(() => {
    setGameState((prev) => returnPendingCard(prev));
  }, []);

  return {
    gameState,
    placeCard: handlePlaceCard,
    confirmPendingCard: handleConfirmPendingCard,
    returnPendingCard: handleReturnPendingCard,
    resetGame,
  };
}
