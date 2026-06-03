import { useState, useCallback } from 'react';
import { initializeGame, placeCard } from '../game';
import type { CardName, Coordinates, GameState } from '../game';

export function useGameState() {
  const [gameState, setGameState] = useState<GameState>(() => initializeGame());

  const handlePlaceCard = useCallback(
    (cardName: CardName, coordinates: Coordinates) => {
      setGameState((prev) => placeCard(prev, cardName, coordinates));
    },
    []
  );

  const resetGame = useCallback(() => {
    setGameState(initializeGame());
  }, []);

  return {
    gameState,
    placeCard: handlePlaceCard,
    resetGame,
  };
}
