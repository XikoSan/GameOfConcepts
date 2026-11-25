// Path evidence and the first qualifying node pair follow the order of the new edges.
import type { SemanticEdge, SemanticEdgeScore } from '../types';
import { endMeasure, startMeasure } from '../debug/performanceDiagnostics';
import { findSemanticMoveNode } from './semanticNodes';
import { checkSemanticPathContinuation, isSemanticEdgeGeometryValid } from './semanticPaths';
import { createScoreExplanation } from './scoreEvidence';
import { createSemanticEdgeFromPending } from './semanticRelations';
import type { CalculateSemanticMoveScoreArgs, SemanticMoveScore } from './types';

export function calculateSemanticMoveScore({
  board,
  existingEdges,
  pendingMove,
  activeSeatIndex,
}: CalculateSemanticMoveScoreArgs): SemanticMoveScore {
  const measureStart = startMeasure();
  const placedCard = board[`${pendingMove.position.x},${pendingMove.position.y}`];
  if (!placedCard || placedCard.id !== pendingMove.cardId) {
    endMeasure('scoring:calculateSemanticMoveScore', measureStart);
    return { edges: [], total: 0 };
  }

  const graphEdges: SemanticEdge[] = [...existingEdges];
  const moveEdges = [...pendingMove.semanticEdges]
    .sort((a, b) => a.createdOrder - b.createdOrder)
    .map(pendingEdge => {
      const semanticEdge = createSemanticEdgeFromPending(
        {
          moveId: pendingMove.moveId,
          cardId: pendingMove.cardId,
          cardName: placedCard.cardName,
          playerIndex: pendingMove.placedBySeatIndex,
          reviewerIndex: pendingMove.placedBySeatIndex,
          placedBySeatIndex: pendingMove.placedBySeatIndex,
          position: pendingMove.position,
          semanticEdges: pendingMove.semanticEdges,
        },
        pendingEdge,
        placedCard
      );
      return { pendingEdge, semanticEdge, isValidGeometry: isSemanticEdgeGeometryValid(board, semanticEdge) };
    });
  const node = findSemanticMoveNode(board, moveEdges.filter(item => item.isValidGeometry).map(item => item.semanticEdge),
    activeSeatIndex, pendingMove.cardId);
  const scores = moveEdges.map<SemanticEdgeScore>(({ pendingEdge, semanticEdge, isValidGeometry }) => {
    const pathCheck = isValidGeometry ? checkSemanticPathContinuation(board, semanticEdge, graphEdges, activeSeatIndex)
      : { continuesPath: false, reason: 'no-compatible-edge' as const, matchedEdgeIds: [] };
    const continuesPath = pathCheck.continuesPath;
    const nodeAward = node?.awardEdgeId === semanticEdge.id ? node : undefined;
    const continuesNode = Boolean(nodeAward);
    const pathBonus = continuesPath ? 1 : 0;
    const nodeBonus = continuesNode ? 1 : 0;
    const total = (1 + pathBonus + nodeBonus) as 1 | 2 | 3;
    const explanation = isValidGeometry ? createScoreExplanation(board, semanticEdge, graphEdges, pathCheck, nodeAward) : undefined;

    if (isValidGeometry) {
      graphEdges.push(semanticEdge);
    }

    return {
      pendingEdgeId: pendingEdge.id,
      baseScore: 1,
      pathBonus,
      nodeBonus,
      total,
      continuesPath,
      continuesNode,
      ...(explanation ? { explanation } : {}),
    };
  });

  const result = {
    edges: scores,
    total: scores.reduce((total, edge) => total + edge.total, 0),
  };
  endMeasure('scoring:calculateSemanticMoveScore', measureStart);
  return result;
}
