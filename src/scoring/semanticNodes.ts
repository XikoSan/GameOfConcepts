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
  activeSeatIndex: number
): NodeContinuationCheck {
  const possibleCenters = [edge.fromCardInstanceId, edge.toCardInstanceId];

  for (const centerCardId of possibleCenters) {
    const outerCardId = getOtherCardId(edge, centerCardId);
    if (!outerCardId || getCardOwner(board, outerCardId) !== activeSeatIndex) {
      continue;
    }

    const signature = getNodeConnectivitySignature(edge, centerCardId);
    if (!signature) continue;

    for (const graphEdge of graphEdges) {
      const graphOuterCardId = getOtherCardId(graphEdge, centerCardId);
      if (!graphOuterCardId || graphOuterCardId === outerCardId) continue;
      if (getCardOwner(board, graphOuterCardId) !== activeSeatIndex) continue;

      if (getNodeConnectivitySignature(graphEdge, centerCardId) === signature) {
        return { continuesNode: true, centerCardId, outerCardIds: [graphOuterCardId, outerCardId], matchedEdgeIds: [graphEdge.id] };
      }
    }
  }
  return { continuesNode: false, outerCardIds: [], matchedEdgeIds: [] };
}

export function continuesSemanticNode(
  board: BoardState,
  edge: SemanticEdge,
  graphEdges: readonly SemanticEdge[],
  activeSeatIndex: number
): boolean {
  return checkSemanticNodeContinuation(board, edge, graphEdges, activeSeatIndex).continuesNode;
}
