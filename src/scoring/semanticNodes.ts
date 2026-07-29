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

export function continuesSemanticNode(
  board: BoardState,
  edge: SemanticEdge,
  graphEdges: readonly SemanticEdge[],
  activeSeatIndex: number
): boolean {
  const possibleCenters = [edge.fromCardInstanceId, edge.toCardInstanceId];

  return possibleCenters.some((centerCardId) => {
    const outerCardId = getOtherCardId(edge, centerCardId);
    if (!outerCardId || getCardOwner(board, outerCardId) !== activeSeatIndex) {
      return false;
    }

    const signature = getNodeConnectivitySignature(edge, centerCardId);
    if (!signature) return false;

    return graphEdges.some((graphEdge) => {
      const graphOuterCardId = getOtherCardId(graphEdge, centerCardId);
      if (!graphOuterCardId || graphOuterCardId === outerCardId) return false;
      if (getCardOwner(board, graphOuterCardId) !== activeSeatIndex) return false;

      return getNodeConnectivitySignature(graphEdge, centerCardId) === signature;
    });
  });
}
