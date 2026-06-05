import type { Coordinates, GameState, RegularCardName } from '../game';

export type GameMode = 'local' | 'multiplayer';
export type GameConnectionStatus = 'local' | 'connecting' | 'connected' | 'disconnected' | 'error';

export interface GameController {
  gameState: GameState;
  mode: GameMode;
  connectionStatus: GameConnectionStatus;
  error: string | null;
  localPlayerIndex: 0 | 1 | null;
  activePlayerIndex: 0 | 1;
  placeCard: (cardName: RegularCardName, coordinates: Coordinates) => void;
  confirmCard: () => void;
  returnCard: () => void;
  approveCross: () => void;
  rejectCross: () => void;
  resetGame: () => void;
  startLocalGame: () => void;
}
