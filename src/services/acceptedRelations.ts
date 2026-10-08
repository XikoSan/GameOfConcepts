// Explicit collection allowlist: accepted card endpoints and semantic direction only. Do not serialize the whole game or player profiles here.
import type { GameState } from '../game';

export interface AcceptedRelationSample {
  session_id: string; edge_id: string; move_id: string; deck_id: string;
  from_name: string; to_name: string; from_definition_id: string | null; to_definition_id: string | null;
  family: string; from_role: string | null; to_role: string | null;
}

export function getAcceptedRelationSamples(game: GameState): AcceptedRelationSample[] {
  const cards = new Map(Object.values(game.board).map(card => [card.id, card]));
  return (game.semanticEdges ?? []).flatMap(edge => {
    const from = cards.get(edge.fromCardInstanceId), to = cards.get(edge.toCardInstanceId);
    if (!from || !to || from.status !== 'confirmed' || to.status !== 'confirmed') return [];
    return [{ session_id: game.startCard.id, edge_id: edge.id, move_id: edge.createdAtMoveId,
      deck_id: game.deckSnapshot?.sourceDeckId ?? 'unknown',
      from_name: from.cardName, to_name: to.cardName,
      from_definition_id: from.definitionId ?? null, to_definition_id: to.definitionId ?? null,
      family: edge.relation.family,
      from_role: 'fromRole' in edge.relation ? edge.relation.fromRole : null,
      to_role: 'toRole' in edge.relation ? edge.relation.toRole : null }];
  });
}
