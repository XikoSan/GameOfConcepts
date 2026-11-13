import type { GameState, SemanticEdgeScore } from '../types';

export const DIAGNOSTIC_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
export const DIAGNOSTIC_EVENT_TYPES = ['start', 'resume', 'submitted', 'accepted', 'rejected', 'cancelled', 'vote', 'pass', 'redraw', 'finish_proposed', 'finish_vote', 'finish_declined', 'finished', 'room_deleted'] as const;
export type DiagnosticEventType = typeof DIAGNOSTIC_EVENT_TYPES[number];
export interface DiagnosticEvent {
  source: 'local'; session_id: string; event_id: string; event_type: DiagnosticEventType;
  occurred_at: string; client_version: string; snapshot: ReturnType<typeof diagnosticSnapshot>;
}
const text = (value: unknown, max = 250) => typeof value === 'string' ? value.slice(0, max) : null;
const number = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? value : null;
const object = (value: unknown): Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const array = (value: unknown) => Array.isArray(value) ? value : [];
const cardEvidence = (value: unknown) => { const v = object(value); return { id: text(v.id), name: text(v.name, 200), ownerSeatIndex: number(v.ownerSeatIndex) }; };
const relation = (value: unknown) => { const v = object(value); return { family: text(v.family, 30), fromRole: text(v.fromRole, 40), toRole: text(v.toRole, 40), symmetric: v.symmetric === true }; };
const evidenceEdge = (value: unknown) => { const v = object(value); return { id: text(v.id), from: cardEvidence(v.from), to: cardEvidence(v.to), relation: relation(v.relation), label: text(v.label, 500) }; };

// Future score fields must not silently upload profiles or hands.
function explanation(value: unknown) {
  const v = object(value);
  if (v.version !== 1) return null;
  const path = object(v.path), node = object(v.node);
  return { version: 1, relation: text(v.relation, 500), edge: evidenceEdge(v.edge),
    path: v.path ? { cards: array(path.cards).slice(0, 512).map(cardEvidence), edges: array(path.edges).slice(0, 512).map(evidenceEdge), sharedCardId: text(path.sharedCardId) } : null,
    node: v.node ? { center: cardEvidence(node.center), outerCards: array(node.outerCards).slice(0, 512).map(cardEvidence), direction: text(node.direction, 30), edges: array(node.edges).slice(0, 512).map(evidenceEdge) } : null };
}
const score = (value: SemanticEdgeScore) => ({ pendingEdgeId: text(value.pendingEdgeId), baseScore: number(value.baseScore),
  pathBonus: number(value.pathBonus), nodeBonus: number(value.nodeBonus), total: number(value.total),
  explanation: explanation((value as SemanticEdgeScore & { explanation?: unknown }).explanation) });
const moveScore = (value: unknown) => { const v = object(value); return { total: number(v.total), edges: array(v.edges).slice(0, 2048).map(edge => score(edge as SemanticEdgeScore)) }; };

export function diagnosticSnapshot(game: GameState) {
  const pending = game.pendingMove, finish = game.pendingFinish;
  const votes = Object.values(pending?.votes ?? {});
  return {
    formatVersion: 1, scoringVersion: number(game.scoringVersion), playerCount: game.players.length,
    currentPlayerIndex: number(game.currentPlayerIndex), startCardId: text(game.startCard.id),
    drawPileCount: game.sharedDeck?.length ?? game.deck.reduce((sum, cards) => sum + cards.length, 0),
    deck: game.deckSnapshot ? { sourceDeckId: text(game.deckSnapshot.sourceDeckId),
      cardDefinitionIds: game.deckSnapshot.cardDefinitionIds.slice(0, 512).map(id => text(id)),
      cards: (game.deckSnapshot.cards ?? []).slice(0, 512).map(card => ({ id: text(card.id), name: text(card.name, 200), difficulty: text(card.difficulty, 30) })),
      neutralCards: (game.deckSnapshot.neutralCards ?? []).slice(0, 512).map(card => ({ id: text(card.id), name: text(card.name, 200) })),
      relationFamilies: game.deckSnapshot.relationFamilies?.slice(0, 10).map(family => text(family, 30)) } : null,
    board: Object.values(game.board).slice(0, 512).map(card => ({ id: text(card.id), definitionId: text(card.definitionId), cardName: text(card.cardName, 200),
      x: number(card.coordinates.x), y: number(card.coordinates.y), playerId: number(card.playerId), status: text(card.status, 30) })),
    semanticEdges: (game.semanticEdges ?? []).slice(0, 2048).map(edge => ({ id: text(edge.id), fromCardInstanceId: text(edge.fromCardInstanceId), toCardInstanceId: text(edge.toCardInstanceId),
      relation: relation(edge.relation), createdBySeatIndex: number(edge.createdBySeatIndex), createdAtMoveId: text(edge.createdAtMoveId), createdOrder: number(edge.createdOrder) })),
    scores: game.scores.slice(0, 4).map(number),
    redrawUsed: Array.from({ length: game.players.length }, (_, seat) => game.handRedrawUsedByPlayerId?.[seat] === true),
    logDetails: Object.entries(game.logDetails ?? {}).slice(-512).map(([index, detail]) => ({ index: number(Number(index)), playerId: number(detail.score.playerId),
      cardName: text(detail.score.cardName, 200), totalGained: number(detail.score.totalGained), newTotalScore: number(detail.score.newTotalScore), semanticScore: moveScore(detail.score.semanticScore) })),
    pendingMove: pending ? { cardId: text(pending.cardId), moveId: text(pending.moveId ?? pending.cardId), cardName: text(pending.cardName, 200),
      placedBySeatIndex: number(pending.placedBySeatIndex ?? pending.playerIndex), semanticStatus: text(pending.semanticStatus, 40),
      semanticEdges: (pending.semanticEdges ?? []).slice(0, 4).map(edge => ({ id: text(edge.id), neighborCardInstanceId: text(edge.neighborCardInstanceId), relation: relation(edge.relation), direction: text(edge.direction, 30), createdOrder: number(edge.createdOrder) })),
      scorePreview: moveScore(pending.scorePreview), voteCounts: { accept: votes.filter(v => v === 'accept').length, reject: votes.filter(v => v === 'reject').length, required: pending.requiredVoters?.length ?? Math.max(0, game.players.length - 1) } } : null,
    pendingFinish: finish ? { id: text(finish.id), requestedBy: number(finish.requestedBy), votes: game.players.map((_, seat) => typeof finish.votes[String(seat)] === 'boolean' ? finish.votes[String(seat)] : null) } : null,
    gameOver: game.gameOver === true, endReason: text(game.endReason, 40), consecutivePasses: number(game.consecutivePasses) ?? 0,
  };
}

export function classifyDiagnosticTransition(before: GameState, after: GameState): DiagnosticEventType | null {
  if (before === after) return null;
  if (!before.gameOver && after.gameOver) return 'finished';
  if (!before.pendingFinish && after.pendingFinish) return 'finish_proposed';
  if (before.pendingFinish && !after.pendingFinish) return 'finish_declined';
  if (JSON.stringify(before.pendingFinish?.votes) !== JSON.stringify(after.pendingFinish?.votes)) return 'finish_vote';
  if ((after.semanticEdges?.length ?? 0) > (before.semanticEdges?.length ?? 0)) return 'accepted';
  if (before.pendingMove && !after.pendingMove) return before.pendingMove.semanticStatus === 'voting' ? 'rejected' : 'cancelled';
  if (after.pendingMove?.semanticStatus === 'voting' && before.pendingMove?.semanticStatus !== 'voting') return 'submitted';
  if (before.pendingMove?.semanticStatus === 'voting' && JSON.stringify(before.pendingMove.votes) !== JSON.stringify(after.pendingMove?.votes)) return 'vote';
  if ((before.consecutivePasses ?? 0) !== (after.consecutivePasses ?? 0)) return 'pass';
  if (JSON.stringify(before.handRedrawUsedByPlayerId) !== JSON.stringify(after.handRedrawUsedByPlayerId)) return 'redraw';
  return null;
}
export interface LocalDiagnosticState { game: GameState; enabled: boolean; revision: number; events: DiagnosticEvent[] }
export function localDiagnosticTransition(state: LocalDiagnosticState, next: GameState, meta: { runId: string; at: string; clientVersion: string }, explicit?: 'start' | 'resume'): LocalDiagnosticState {
  if (state.game === next && !explicit) return state;
  const enabled = state.enabled || Boolean(explicit);
  const type = explicit ?? (enabled ? classifyDiagnosticTransition(state.game, next) : null);
  if (!type) return { ...state, game: next, enabled };
  const revision = state.revision + 1;
  const event: DiagnosticEvent = { source: 'local', session_id: next.startCard.id, event_id: `${meta.runId}:${revision}`,
    event_type: type, occurred_at: meta.at, client_version: meta.clientVersion, snapshot: diagnosticSnapshot(next) };
  return { game: next, enabled, revision, events: [...state.events, event].slice(-240) };
}
