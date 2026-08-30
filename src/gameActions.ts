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
  action: GameAction
): GameState {
  // TODO(MVP): In multiplayer mode this action should be validated server-side
  // before the resulting GameState is persisted to the room.
  switch (action.type) {
    case 'resetGame':
      return initializeGame();

    case 'placeCard':
      return placeCard(gameState, action.cardName, action.coordinates);

    case 'confirmCard':
      return confirmPendingCard(gameState);

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
