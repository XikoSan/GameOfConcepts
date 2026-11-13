import test from 'node:test';
import assert from 'node:assert/strict';
import { initializeGame, placeCard, upsertPendingSemanticEdge } from '../src/game';
import { getRelationPresets } from '../src/scoring/semanticRelations';
import { previewSemanticEdgeScore } from '../src/components/previewSemanticEdgeScore';

function pendingGame() {
  const game = initializeGame(2, undefined, 0);
  return placeCard(game, game.players[0].cards[0], { x: 8, y: 7 });
}

test('unsaved relation preview shows a score before adding the first edge without mutating the move', () => {
  const game = pendingGame();
  const original = structuredClone(game);
  const kind = getRelationPresets(game.deckSnapshot).find(relation => relation.family === 'kind')!;
  const result = previewSemanticEdgeScore(game, game.startCard.id, kind, 'new-to-neighbor');
  assert.equal(result?.total, 1);
  assert.ok(result?.explanation?.relation.includes(' — вид '));
  assert.deepEqual(game, original);
  assert.equal(game.pendingMove?.semanticEdges?.length, 0);
});

test('preview follows unsaved family and direction instead of the previously saved relation', () => {
  let game = pendingGame();
  const presets = getRelationPresets(game.deckSnapshot);
  const kind = presets.find(relation => relation.family === 'kind')!;
  const cause = presets.find(relation => relation.family === 'cause')!;
  game = upsertPendingSemanticEdge(game, game.startCard.id, kind, 'new-to-neighbor');
  const original = structuredClone(game);
  const preview = previewSemanticEdgeScore(game, game.startCard.id, cause, 'neighbor-to-new');
  const savedEdge = game.pendingMove!.semanticEdges![0];
  assert.equal(preview?.pendingEdgeId, savedEdge.id);
  assert.equal(preview?.explanation?.edge.from.id, game.startCard.id);
  assert.equal(preview?.explanation?.edge.to.id, game.pendingMove!.cardId);
  assert.equal(preview?.explanation?.edge.relation.family, 'cause');
  assert.deepEqual(game, original);
});
