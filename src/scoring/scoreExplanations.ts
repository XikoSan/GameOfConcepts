import type { GameState, PendingSemanticEdge, SemanticEdge, SemanticMoveScore } from '../types';
import { calculateSemanticMoveScore } from './calculateSemanticMoveScore';
import { isRelationAllowed } from './semanticRelations';
import { isSemanticEdgeGeometryValid } from './semanticPaths';

/** Preserve recorded awards; recover old witnesses only from a complete, ordered accepted history. */
export function getHistoricalMoveScore(game: GameState, logIndex: number): SemanticMoveScore | undefined {
  const detail = game.logDetails?.[logIndex];
  const recorded = detail?.score.semanticScore;
  if (!detail || !recorded || !recorded.edges.length || recorded.edges.every(edge => edge.explanation)) return recorded;
  const graph = game.semanticEdges;
  if (!graph || !game.logDetails) return recorded;
  const byId = new Map(graph.map(edge => [edge.id, edge]));
  if (byId.size !== graph.length || graph.some(edge => !isSemanticEdgeGeometryValid(game.board, edge) ||
    !isRelationAllowed(edge.relation, game.deckSnapshot))) return recorded;

  const seen = new Set<string>();
  const before: SemanticEdge[] = [];
  const history = Object.entries(game.logDetails).map(([index, entry]) => ({ index: Number(index), entry }))
    .sort((a, b) => a.index - b.index);
  for (const { index, entry } of history) {
    if (!Number.isSafeInteger(index) || index < 0) return recorded;
    const awards = entry.score.semanticScore?.edges;
    if (!awards) continue;
    const moveEdges: SemanticEdge[] = [];
    for (const award of awards) {
      const edge = byId.get(award.pendingEdgeId);
      if (!edge || seen.has(edge.id) || edge.createdBySeatIndex !== entry.score.playerId) return recorded;
      seen.add(edge.id);
      moveEdges.push(edge);
    }
    if (index < logIndex) before.push(...moveEdges.sort((a, b) => a.createdOrder - b.createdOrder));
  }
  // Unattributed edges might have existed before the move. Do not substitute a future board for history.
  if (seen.size !== graph.length) return recorded;
  const target = recorded.edges.map(award => byId.get(award.pendingEdgeId)!);
  if (target.some(edge => edge.createdAtMoveId !== target[0].createdAtMoveId)) return recorded;
  const endpoints = [target[0].fromCardInstanceId, target[0].toCardInstanceId];
  const candidates = endpoints.filter(id => target.every(edge => edge.fromCardInstanceId === id || edge.toCardInstanceId === id))
    .map(id => Object.values(game.board).find(card => card.id === id))
    .filter(card => card?.playerId === detail.score.playerId && card.cardName === detail.score.cardName);
  if (candidates.length !== 1 || !candidates[0]) return recorded;
  const placed = candidates[0];
  const semanticEdges: PendingSemanticEdge[] = target.map(edge => {
    const outgoing = edge.fromCardInstanceId === placed.id;
    return { id: edge.id, neighborCardInstanceId: outgoing ? edge.toCardInstanceId : edge.fromCardInstanceId,
      neighborPosition: { ...(outgoing ? edge.toPosition : edge.fromPosition) }, relation: { ...edge.relation },
      direction: outgoing ? 'new-to-neighbor' : 'neighbor-to-new', createdOrder: edge.createdOrder };
  });
  if (new Set(semanticEdges.map(edge => edge.createdOrder)).size !== semanticEdges.length) return recorded;
  const atMove = new Set([placed.id, game.startCard.id, ...before.flatMap(edge => [edge.fromCardInstanceId, edge.toCardInstanceId]),
    ...target.flatMap(edge => [edge.fromCardInstanceId, edge.toCardInstanceId])]);
  const board = Object.fromEntries(Object.entries(game.board).filter(([, card]) => atMove.has(card.id)));
  const calculated = calculateSemanticMoveScore({ board, existingEdges: before, activeSeatIndex: detail.score.playerId,
    pendingMove: { moveId: target[0].createdAtMoveId, cardId: placed.id, position: placed.coordinates,
      placedBySeatIndex: detail.score.playerId, semanticEdges } });
  const calculatedById = new Map(calculated.edges.map(edge => [edge.pendingEdgeId, edge]));
  if (calculated.total !== recorded.total || calculated.total !== detail.score.totalGained ||
    recorded.edges.some(award => {
      const expected = calculatedById.get(award.pendingEdgeId);
      return !expected || expected.baseScore !== award.baseScore || expected.pathBonus !== award.pathBonus ||
        expected.nodeBonus !== award.nodeBonus || expected.total !== award.total;
    })) return recorded;
  return { ...recorded, edges: recorded.edges.map(award => award.explanation ? award
    : { ...award, explanation: calculatedById.get(award.pendingEdgeId)?.explanation }) };
}
