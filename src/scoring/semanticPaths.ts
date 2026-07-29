import type { BoardState } from './types';
import type { SemanticEdge } from '../types';
import { getBoardKey, getPathConnectivitySignature } from './semanticRelations';

const getCardOwner = (board: BoardState, cardId: string): number | null | undefined =>
  Object.values(board).find((card) => card.id === cardId)?.playerId;

export type PathCheckReason =
  | 'continues-path'
  | 'no-compatible-edge'
  | 'connectivity-mismatch'
  | 'direction-mismatch'
  | 'shared-card-not-owned'
  | 'new-card-not-owned';

export interface PathContinuationCheck {
  continuesPath: boolean;
  reason: PathCheckReason;
  sharedCardInstanceId?: string;
  matchedEdgeIds: string[];
}

const getSharedCardForSequence = (
  edge: SemanticEdge,
  candidateEdge: SemanticEdge
): string | null => {
  if (edge.relation.family === 'opposite') {
    const edgeCardIds = [edge.fromCardInstanceId, edge.toCardInstanceId];
    return (
      edgeCardIds.find(
        (cardId) =>
          cardId === candidateEdge.fromCardInstanceId ||
          cardId === candidateEdge.toCardInstanceId
      ) ?? null
    );
  }

  if (edge.fromCardInstanceId === candidateEdge.toCardInstanceId) {
    return edge.fromCardInstanceId;
  }

  if (edge.toCardInstanceId === candidateEdge.fromCardInstanceId) {
    return edge.toCardInstanceId;
  }

  return null;
};

const getCandidateTerminalCardId = (
  candidateEdge: SemanticEdge,
  sharedCardInstanceId: string
) =>
  candidateEdge.fromCardInstanceId === sharedCardInstanceId
    ? candidateEdge.toCardInstanceId
    : candidateEdge.fromCardInstanceId;

const logPathCheck = (payload: {
  activeSeatIndex: number;
  newEdge: SemanticEdge;
  candidateEdge?: SemanticEdge;
  sharedCardInstanceId?: string;
  sharedCardOwnerSeatIndex?: number | null;
  terminalCardOwnerSeatIndex?: number | null;
  connectivitySignature: string;
  continuesPath: boolean;
  reason: PathCheckReason;
}) => {
  if (!import.meta.env.DEV) return;
  console.debug('[semantic path check]', payload);
};

export function checkSemanticPathContinuation(
  board: BoardState,
  edge: SemanticEdge,
  graphEdges: readonly SemanticEdge[],
  activeSeatIndex: number
): PathContinuationCheck {
  const fromOwner = getCardOwner(board, edge.fromCardInstanceId);
  const toOwner = getCardOwner(board, edge.toCardInstanceId);
  const signature = getPathConnectivitySignature(edge);

  if (fromOwner !== activeSeatIndex && toOwner !== activeSeatIndex) {
    logPathCheck({
      activeSeatIndex,
      newEdge: edge,
      connectivitySignature: signature,
      continuesPath: false,
      reason: 'new-card-not-owned',
    });
    return {
      continuesPath: false,
      reason: 'new-card-not-owned',
      matchedEdgeIds: [],
    };
  }

  let sawCompatibleConnectivity = false;
  let sawDirectionMismatch = false;
  let sawSharedCardNotOwned = false;

  for (const graphEdge of graphEdges) {
    if (getPathConnectivitySignature(graphEdge) !== signature) continue;
    sawCompatibleConnectivity = true;

    const sharedCardInstanceId = getSharedCardForSequence(edge, graphEdge);
    if (!sharedCardInstanceId) {
      sawDirectionMismatch = true;
      logPathCheck({
        activeSeatIndex,
        newEdge: edge,
        candidateEdge: graphEdge,
        connectivitySignature: signature,
        continuesPath: false,
        reason: 'direction-mismatch',
      });
      continue;
    }

    const sharedCardOwnerSeatIndex = getCardOwner(board, sharedCardInstanceId);
    const terminalCardOwnerSeatIndex = getCardOwner(
      board,
      getCandidateTerminalCardId(graphEdge, sharedCardInstanceId)
    );
    const continuesPath = sharedCardOwnerSeatIndex === activeSeatIndex;
    const reason: PathCheckReason = continuesPath
      ? 'continues-path'
      : 'shared-card-not-owned';

    logPathCheck({
      activeSeatIndex,
      newEdge: edge,
      candidateEdge: graphEdge,
      sharedCardInstanceId,
      sharedCardOwnerSeatIndex,
      terminalCardOwnerSeatIndex,
      connectivitySignature: signature,
      continuesPath,
      reason,
    });

    if (continuesPath) {
      return {
        continuesPath: true,
        reason,
        sharedCardInstanceId,
        matchedEdgeIds: [graphEdge.id],
      };
    }

    sawSharedCardNotOwned = true;
  }

  return {
    continuesPath: false,
    reason: sawSharedCardNotOwned
      ? 'shared-card-not-owned'
      : sawDirectionMismatch
        ? 'direction-mismatch'
        : sawCompatibleConnectivity
          ? 'direction-mismatch'
          : graphEdges.length > 0
            ? 'connectivity-mismatch'
            : 'no-compatible-edge',
    matchedEdgeIds: [],
  };
}

export function continuesSemanticPath(
  board: BoardState,
  edge: SemanticEdge,
  graphEdges: readonly SemanticEdge[],
  activeSeatIndex: number
): boolean {
  return checkSemanticPathContinuation(
    board,
    edge,
    graphEdges,
    activeSeatIndex
  ).continuesPath;
}

export function isSemanticEdgeGeometryValid(
  board: BoardState,
  edge: SemanticEdge
): boolean {
  const fromCard = board[getBoardKey(edge.fromPosition)];
  const toCard = board[getBoardKey(edge.toPosition)];

  return (
    fromCard?.id === edge.fromCardInstanceId &&
    toCard?.id === edge.toCardInstanceId
  );
}
