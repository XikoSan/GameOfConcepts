import {
  approvePendingCross,
  confirmPendingCard,
  initializeGame,
  placeCard,
  rejectPendingCross,
  returnPendingCard,
} from './game';
import type { Coordinates, GameState, RegularCardName } from './game';

export type GameAction =
  | { type: 'resetGame' }
  | {
      type: 'placeCard';
      cardName: RegularCardName;
      coordinates: Coordinates;
    }
  | { type: 'confirmCard' }
  | { type: 'returnCard' }
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

    case 'approveCross':
      return approvePendingCross(gameState);

    case 'rejectCross':
      return rejectPendingCross(gameState);
  }
}
