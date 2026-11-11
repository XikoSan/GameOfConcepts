// Action boundary for game mutations. Client validation prevents UI mistakes; it is not server authorization for online rooms.
import {
  approvePendingCross,
  confirmPendingCard,
  initializeGame,
  placeCard,
  removePendingSemanticEdge,
  rejectPendingCross,
  redrawPlayerHand,
  returnPendingCard,
  submitPendingSemanticMove,
  upsertPendingSemanticEdge,
  passTurn,
  requestFinish,
  voteFinish,
} from './game';
import type {
  Coordinates,
  GameState,
  PendingSemanticEdge,
  RegularCardName,
  SemanticRelation,
} from './game';

export type GameAction =
  | { type: 'resetGame' }
  | {
      type: 'placeCard';
      cardName: RegularCardName;
      coordinates: Coordinates;
    }
  | { type: 'confirmCard' }
  | { type: 'returnCard' }
  | { type: 'redrawHand'; playerIndex?: number }
  | { type: 'passTurn'; playerIndex?: number }
  | { type: 'requestFinish'; playerIndex?: number }
  | { type: 'voteFinish'; playerIndex?: number; accept: boolean; finishId?: string }
  | {
      type: 'upsertSemanticEdge';
      neighborCardInstanceId: string;
      relation: SemanticRelation;
      direction: PendingSemanticEdge['direction'];
    }
  | {
      type: 'removeSemanticEdge';
      neighborCardInstanceId: string;
    }
  | { type: 'submitSemanticMove' }
  | { type: 'cancelPendingMove' }
  | { type: 'approveCross' }
  | { type: 'rejectCross' };

export function applyGameAction(
  gameState: GameState,
  action: GameAction,
  turnOrder?: number[]
): GameState {
  // Online callers must pass through applyAuthenticatedAction before persistence.
  if (action.type !== 'resetGame' && (gameState.gameOver || (gameState.pendingFinish && action.type !== 'voteFinish'))) return gameState;
  switch (action.type) {
    case 'resetGame':
      return initializeGame();

    case 'placeCard':
      return placeCard(gameState, action.cardName, action.coordinates);

    case 'confirmCard':
      return confirmPendingCard(gameState, turnOrder);

    case 'passTurn':
      return passTurn(gameState, action.playerIndex, turnOrder);

    case 'requestFinish':
      return requestFinish(gameState, action.playerIndex);

    case 'voteFinish':
      return action.playerIndex === undefined ? gameState : voteFinish(gameState, action.playerIndex, action.accept, action.finishId);

    case 'returnCard':
      return returnPendingCard(gameState);

    case 'redrawHand':
      return redrawPlayerHand(
        gameState,
        action.playerIndex ?? gameState.currentPlayerIndex
      );

    case 'upsertSemanticEdge':
      return upsertPendingSemanticEdge(
        gameState,
        action.neighborCardInstanceId,
        action.relation,
        action.direction
      );

    case 'removeSemanticEdge':
      return removePendingSemanticEdge(gameState, action.neighborCardInstanceId);

    case 'submitSemanticMove':
      return submitPendingSemanticMove(gameState);

    case 'cancelPendingMove':
      return returnPendingCard(gameState);

    case 'approveCross':
      return approvePendingCross(gameState);

    case 'rejectCross':
      return rejectPendingCross(gameState);
  }
}
