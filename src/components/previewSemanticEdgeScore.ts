import type { GameState, PendingSemanticEdge, SemanticRelation } from '../types';
import { calculateSemanticMoveScore } from '../scoring/calculateSemanticMoveScore';

// Preview the exact insertion order without creating a saved edge or changing game state.
export function previewSemanticEdgeScore(game: GameState, neighborId: string, relation: SemanticRelation, direction: PendingSemanticEdge['direction']) {
  const pending = game.pendingMove;
  if (!pending) return undefined;
  const cards = Object.values(game.board);
  const placed = cards.find(card => card.id === pending.cardId);
  const neighbor = cards.find(card => card.id === neighborId);
  if (!placed || !neighbor) return undefined;
  const edges = pending.semanticEdges ?? [];
  const existing = edges.find(edge => edge.neighborCardInstanceId === neighborId);
  const draft: PendingSemanticEdge = {
    id: existing?.id ?? `preview:${pending.cardId}:${neighborId}`,
    neighborPosition: neighbor.coordinates, neighborCardInstanceId: neighborId, relation, direction,
    createdOrder: existing?.createdOrder ?? edges.length,
  };
  const score = calculateSemanticMoveScore({
    board: game.board, existingEdges: game.semanticEdges ?? [], activeSeatIndex: pending.placedBySeatIndex ?? pending.playerIndex,
    pendingMove: { moveId: pending.moveId ?? pending.id ?? pending.cardId, cardId: pending.cardId, position: placed.coordinates,
      placedBySeatIndex: pending.placedBySeatIndex ?? pending.playerIndex,
      semanticEdges: existing ? edges.map(edge => edge.id === existing.id ? draft : edge) : [...edges, draft] },
  });
  return score.edges.find(edge => edge.pendingEdgeId === draft.id);
}
