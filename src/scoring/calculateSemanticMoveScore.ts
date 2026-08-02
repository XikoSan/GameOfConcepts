import type { SemanticEdge, SemanticEdgeScore } from '../types';
import { endMeasure, startMeasure } from '../debug/performanceDiagnostics';
import { continuesSemanticNode } from './semanticNodes';
import { continuesSemanticPath, isSemanticEdgeGeometryValid } from './semanticPaths';
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
  const scores = [...pendingMove.semanticEdges]
    .sort((a, b) => a.createdOrder - b.createdOrder)
    .map<SemanticEdgeScore>((pendingEdge) => {
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
      const isValidGeometry = isSemanticEdgeGeometryValid(board, semanticEdge);
      const continuesPath =
        isValidGeometry &&
        continuesSemanticPath(board, semanticEdge, graphEdges, activeSeatIndex);
      const continuesNode =
        isValidGeometry &&
        continuesSemanticNode(board, semanticEdge, graphEdges, activeSeatIndex);
      const pathBonus = continuesPath ? 1 : 0;
      const nodeBonus = continuesNode ? 1 : 0;
      const total = (1 + pathBonus + nodeBonus) as 1 | 2 | 3;

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
      };
    });

  const result = {
    edges: scores,
    total: scores.reduce((total, edge) => total + edge.total, 0),
  };
  endMeasure('scoring:calculateSemanticMoveScore', measureStart);
  return result;
}
