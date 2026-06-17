import { useCallback, useState } from 'react';
import { applyGameAction } from '../gameActions';
import { initializeGame } from '../game';
import type { Coordinates, GameState, RegularCardName } from '../game';
import type { GameController } from './gameController';

type LocalVote = 'accept' | 'reject';

// Local mode supports the same 2-4 player limits as online, but all state stays in memory.
const normalizePlayerCount = (playerCount?: number) =>
  Math.min(4, Math.max(2, Number(playerCount) || 2));

const getLocalRequiredVoters = (gameState: GameState) => {
  const placedBySeatIndex =
    gameState.pendingMove?.placedBySeatIndex ??
    gameState.pendingMove?.playerIndex ??
    null;

  if (placedBySeatIndex === null) return [];

  // Local voters are seat indexes because there is no room playerId or Supabase identity.
  return gameState.players
    .map((player) => player.playerId)
    .filter((seatIndex) => seatIndex !== placedBySeatIndex);
};

const getNextLocalVoter = (gameState: GameState): number | null => {
  if (!gameState.pendingMove) return null;

  const requiredVoters =
    gameState.pendingMove.requiredVoters?.map(Number) ?? getLocalRequiredVoters(gameState);
  const votes = gameState.pendingMove.votes ?? {};
  const nextVoter = requiredVoters.find((seatIndex) => !votes[String(seatIndex)]);

  return typeof nextVoter === 'number' ? nextVoter : null;
};

const getVoteResolution = (requiredVoters: number[], votes: Record<string, LocalVote>) => {
  const totalVoters = requiredVoters.length;
  // Match online majority semantics: resolve as soon as acceptance wins or cannot win.
  const majority = Math.floor(totalVoters / 2) + 1;
  const acceptCount = requiredVoters.filter(
    (seatIndex) => votes[String(seatIndex)] === 'accept'
  ).length;
  const rejectCount = requiredVoters.filter(
    (seatIndex) => votes[String(seatIndex)] === 'reject'
  ).length;
  const votedCount = acceptCount + rejectCount;
  const remainingCount = totalVoters - votedCount;

  return {
    acceptedByMajority: acceptCount >= majority,
    rejectedByMajority: rejectCount >= majority,
    acceptImpossible: acceptCount + remainingCount < majority,
  };
};

const withLocalPendingVote = (gameState: GameState): GameState => {
  if (!gameState.pendingMove) return gameState;

  const placedBySeatIndex =
    gameState.pendingMove.placedBySeatIndex ?? gameState.pendingMove.playerIndex;
  const requiredVoters = getLocalRequiredVoters(gameState);

  // Enrich the legacy pendingMove shape with the same voting metadata used online.
  // This keeps confirmation UI and scoring paths aligned across modes.
  return {
    ...gameState,
    pendingMove: {
      ...gameState.pendingMove,
      id: gameState.pendingMove.id ?? gameState.pendingMove.cardId,
      fromSeatIndex: placedBySeatIndex,
      placedBySeatIndex,
      position:
        gameState.pendingMove.position ??
        Object.values(gameState.board).find(
          (card) => card.id === gameState.pendingMove?.cardId
        )?.coordinates,
      requiredVoters,
      votes: {},
      status: 'voting',
      createdAt: gameState.pendingMove.createdAt ?? new Date().toISOString(),
    },
  };
};

export function useLocalGameState(): GameController {
  const [localPlayerCount, setLocalPlayerCount] = useState(2);
  const [gameState, setGameState] = useState<GameState>(() => initializeGame(2));

  const handlePlaceCard = useCallback(
    (cardName: RegularCardName, coordinates: Coordinates) => {
      setGameState((prev) =>
        withLocalPendingVote(
          applyGameAction(prev, { type: 'placeCard', cardName, coordinates })
        )
      );
    },
    []
  );

  const resetGame = useCallback((playerCount = localPlayerCount) => {
    const normalizedPlayerCount = normalizePlayerCount(playerCount);
    setLocalPlayerCount(normalizedPlayerCount);
    setGameState(initializeGame(normalizedPlayerCount));
  }, [localPlayerCount]);

  const voteOnPendingMove = useCallback((vote: LocalVote) => {
    setGameState((prev) => {
      if (!prev.pendingMove) return prev;

      const nextVoter = getNextLocalVoter(prev);
      if (nextVoter === null) return prev;

      const requiredVoters =
        prev.pendingMove.requiredVoters?.map(Number) ?? getLocalRequiredVoters(prev);
      const votes = {
        ...(prev.pendingMove.votes ?? {}),
        [String(nextVoter)]: vote,
      };
      const pendingMove = {
        ...prev.pendingMove,
        requiredVoters,
        votes,
        status: 'voting' as const,
      };
      const resolution = getVoteResolution(requiredVoters, votes);

      if (resolution.acceptedByMajority) {
        return applyGameAction({ ...prev, pendingMove }, { type: 'confirmCard' });
      }

      if (resolution.rejectedByMajority || resolution.acceptImpossible) {
        return applyGameAction({ ...prev, pendingMove }, { type: 'returnCard' });
      }

      return {
        ...prev,
        pendingMove,
      };
    });
  }, []);

  const handleConfirmCard = useCallback(() => {
    voteOnPendingMove('accept');
  }, [voteOnPendingMove]);

  const handleReturnCard = useCallback(() => {
    voteOnPendingMove('reject');
  }, [voteOnPendingMove]);

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
    // During pendingMove the active local participant is the next voter, so only one
    // hand is shown while hot-seat players pass the device around.
    activePlayerIndex: getNextLocalVoter(gameState) ?? gameState.currentPlayerIndex,
    placeCard: handlePlaceCard,
    confirmCard: handleConfirmCard,
    returnCard: handleReturnCard,
    approveCross: handleApproveCross,
    rejectCross: handleRejectCross,
    resetGame,
    startLocalGame: resetGame,
  };
}
