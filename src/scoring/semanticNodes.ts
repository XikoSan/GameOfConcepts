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

export interface SemanticMoveNode {
  centerCardId: string;
  awardEdgeId: string;
  spokes: { edge: SemanticEdge; outerCardId: string }[];
}

export function findSemanticMoveNode(
  board: BoardState,
  moveEdges: readonly SemanticEdge[],
  activeSeatIndex: number,
  centerCardId: string,
): SemanticMoveNode | undefined {
  if (getCardOwner(board, centerCardId) !== activeSeatIndex) return;
  const groups = new Map<string, SemanticMoveNode['spokes']>();
  let node: SemanticMoveNode | undefined;
  for (const edge of moveEdges) {
    const outerCardId = getOtherCardId(edge, centerCardId);
    const signature = getNodeConnectivitySignature(edge, centerCardId);
    if (!signature || !outerCardId || getCardOwner(board, outerCardId) === undefined) continue;
    const spokes = groups.get(signature) ?? [];
    if (spokes.some(spoke => spoke.outerCardId === outerCardId)) continue;
    spokes.push({ edge, outerCardId });
    groups.set(signature, spokes);
    // The first pair earns the only award; later spokes still appear in its explanation.
    if (!node && spokes.length === 2) {
      node = { centerCardId, awardEdgeId: edge.id, spokes };
    }
  }
  return node;
}
