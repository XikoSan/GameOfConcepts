import type { SemanticEdge, SemanticScoreCard, SemanticScoreEvidenceEdge, SemanticScoreExplanation } from '../types';
import type { BoardState } from './types';
import type { PathContinuationCheck } from './semanticPaths';
import type { SemanticMoveNode } from './semanticNodes';
import { formatSemanticRelation, isSymmetricRelation } from './semanticRelations';

export function createScoreExplanation(
  board: BoardState,
  edge: SemanticEdge,
  graphEdges: readonly SemanticEdge[],
  pathCheck: PathContinuationCheck,
  node?: SemanticMoveNode,
): SemanticScoreExplanation | undefined {
  const cards = new Map(Object.values(board).map(card => [card.id, card]));
  const names = new Map([...cards].map(([id, card]) => [id, card.cardName]));
  const card = (id: string): SemanticScoreCard | undefined => {
    const placed = cards.get(id);
    return placed && { id, name: placed.cardName, ownerSeatIndex: placed.playerId };
  };
  const evidence = (source: SemanticEdge): SemanticScoreEvidenceEdge | undefined => {
    const from = card(source.fromCardInstanceId), to = card(source.toCardInstanceId);
    return from && to && { id: source.id, from, to, relation: { ...source.relation }, label: formatSemanticRelation(source, names) };
  };
  const newEdge = evidence(edge);
  if (!newEdge) return undefined;
  const explanation: SemanticScoreExplanation = { version: 1, relation: newEdge.label, edge: newEdge };
  const pathEdge = graphEdges.find(item => item.id === pathCheck.matchedEdgeIds[0]);
  const shared = pathCheck.sharedCardInstanceId;
  if (pathCheck.continuesPath && pathEdge && shared) {
    const previous = evidence(pathEdge);
    if (previous) {
      if (isSymmetricRelation(edge.relation)) {
        const previousOuter = card(pathEdge.fromCardInstanceId === shared ? pathEdge.toCardInstanceId : pathEdge.fromCardInstanceId);
        const nextOuter = card(edge.fromCardInstanceId === shared ? edge.toCardInstanceId : edge.fromCardInstanceId);
        const middle = card(shared);
        if (previousOuter && nextOuter && middle) explanation.path = {
          cards: [previousOuter, middle, nextOuter], edges: [previous, newEdge], sharedCardId: shared,
        };
      } else if (edge.toCardInstanceId === pathEdge.fromCardInstanceId) {
        explanation.path = { cards: [newEdge.from, newEdge.to, previous.to], edges: [newEdge, previous], sharedCardId: shared };
      } else {
        explanation.path = { cards: [previous.from, newEdge.from, newEdge.to], edges: [previous, newEdge], sharedCardId: shared };
      }
    }
  }
  if (node) {
    const center = card(node.centerCardId);
    const outerCards = node.spokes.map(spoke => card(spoke.outerCardId));
    const edges = node.spokes.map(spoke => evidence(spoke.edge));
    if (center && outerCards.every(value => value !== undefined) && edges.every(value => value !== undefined)) explanation.node = {
      center, outerCards,
      direction: isSymmetricRelation(edge.relation) ? 'symmetric'
        : edge.toCardInstanceId === center.id ? 'toward-center' : 'from-center',
      edges,
    };
  }
  return explanation;
}
