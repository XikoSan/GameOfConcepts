import test from 'node:test';
import assert from 'node:assert/strict';
import { initializeGame, placeCard, upsertPendingSemanticEdge, submitPendingSemanticMove, confirmPendingCard, returnPendingCard } from '../src/game';
import { getRelationPresets } from '../src/scoring/semanticRelations';
import { getAcceptedRelationSamples } from '../src/services/acceptedRelations';

test('collection includes only accepted edges with their semantic direction, without player names', () => {
  const game = initializeGame(2, undefined, 0);
  const move = upsertPendingSemanticEdge(placeCard(game, game.players[0].cards[0], {x:8,y:7}), game.startCard.id, getRelationPresets(game.deckSnapshot)[0], 'neighbor-to-new');
  assert.deepEqual(getAcceptedRelationSamples(move), []);
  assert.deepEqual(getAcceptedRelationSamples(returnPendingCard(move)), []);
  const accepted = confirmPendingCard(submitPendingSemanticMove(move));
  const samples = getAcceptedRelationSamples(accepted);
  assert.equal(samples.length, 1);
  assert.equal(samples[0].from_name, game.startCard.cardName);
  assert.equal(samples[0].to_name, game.players[0].cards[0]);
  assert.equal(samples[0].family, 'kind');
  assert.deepEqual(getAcceptedRelationSamples(JSON.parse(JSON.stringify(accepted))), samples);
  assert.deepEqual(Object.keys(samples[0]).sort(), ['session_id','edge_id','move_id','deck_id','from_name','to_name','from_definition_id','to_definition_id','family','from_role','to_role'].sort());
});
