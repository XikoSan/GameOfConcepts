import type {
  Coordinates,
  GameState,
  PendingSemanticEdge,
  RegularCardName,
  SemanticRelation,
} from '../game';

export type GameMode = 'local' | 'multiplayer';
export type GameConnectionStatus = 'local' | 'connecting' | 'connected' | 'disconnected' | 'error';

export interface GameController {
  gameState: GameState;
  mode: GameMode;
  connectionStatus: GameConnectionStatus;
  error: string | null;
  localPlayerIndex: number | null;
  activePlayerIndex: number;
  placeCard: (cardName: RegularCardName, coordinates: Coordinates) => void;
  upsertSemanticEdge: (
    neighborCardInstanceId: string,
    relation: SemanticRelation,
    direction: PendingSemanticEdge['direction']
  ) => void;
  removeSemanticEdge: (neighborCardInstanceId: string) => void;
  submitSemanticMove: () => void;
  cancelPendingMove: () => void;
  confirmCard: () => void;
  returnCard: () => void;
  redrawHand: () => void;
  approveCross: () => void;
  rejectCross: () => void;
  resetGame: (playerCount?: number, deckId?: string) => void;
  startLocalGame: (playerCount?: number, deckId?: string) => void;
}
