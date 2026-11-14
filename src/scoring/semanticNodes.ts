import type { BoardState } from './types';
import type { SemanticEdge } from '../types';
import { getNodeConnectivitySignature } from './semanticRelations';

const getOtherCardId = (edge: SemanticEdge, cardId: string): string | null => {
  if (edge.fromCardInstanceId === cardId) return edge.toCardInstanceId;
  if (edge.toCardInstanceId === cardId) return edge.fromCardInstanceId;
  return null;
};

const getCardOwner = (board: BoardState, cardId: string): number | null | undefined =>
  Object.values(board).find((card) => card.id === cardId)?.playerId;

export interface NodeContinuationCheck {
  continuesNode: boolean;
  centerCardId?: string;
  outerCardIds: string[];
  matchedEdgeIds: string[];
}

export function checkSemanticNodeContinuation(
  board: BoardState,
  edge: SemanticEdge,
  graphEdges: readonly SemanticEdge[],
  activeSeatIndex: number,
  newCardId: string,
): NodeContinuationCheck {
  const none: NodeContinuationCheck = { continuesNode: false, outerCardIds: [], matchedEdgeIds: [] };
  // Only the played card can earn a node bonus; an old endpoint never becomes this move's center.
  const centerCardId = newCardId;
  if (getCardOwner(board, centerCardId) !== activeSeatIndex) return none;
  const outerCardId = getOtherCardId(edge, centerCardId);
  if (!outerCardId || getCardOwner(board, outerCardId) === undefined) return none;
  const signature = getNodeConnectivitySignature(edge, centerCardId);
  if (!signature) return none;

  for (const graphEdge of graphEdges) {
    // Count only earlier spokes of this move, regardless of their outer cards' owners.
    if (graphEdge.createdAtMoveId !== edge.createdAtMoveId) continue;
    const graphOuterCardId = getOtherCardId(graphEdge, centerCardId);
    if (!graphOuterCardId || graphOuterCardId === outerCardId || getCardOwner(board, graphOuterCardId) === undefined) continue;
    if (getNodeConnectivitySignature(graphEdge, centerCardId) === signature) {
      return { continuesNode: true, centerCardId, outerCardIds: [graphOuterCardId, outerCardId], matchedEdgeIds: [graphEdge.id] };
    }
  }
  return none;
}

export function continuesSemanticNode(
  board: BoardState,
  edge: SemanticEdge,
  graphEdges: readonly SemanticEdge[],
  activeSeatIndex: number,
  newCardId: string,
): boolean {
  return checkSemanticNodeContinuation(board, edge, graphEdges, activeSeatIndex, newCardId).continuesNode;
}
