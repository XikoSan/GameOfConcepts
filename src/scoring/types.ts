import type {
  Coordinates,
  GameState,
  PendingMove,
  SemanticEdge,
  SemanticMoveScore,
} from '../types';

export type BoardState = GameState['board'];

export interface PendingMoveDraft {
  moveId: string;
  cardId: string;
  position: Coordinates;
  placedBySeatIndex: number;
  semanticEdges: NonNullable<PendingMove['semanticEdges']>;
}

export interface CalculateSemanticMoveScoreArgs {
  board: BoardState;
  existingEdges: readonly SemanticEdge[];
  pendingMove: PendingMoveDraft;
  activeSeatIndex: number;
}

export type { SemanticMoveScore };
