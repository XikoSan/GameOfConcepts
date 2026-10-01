import test from 'node:test';
import assert from 'node:assert/strict';
import { createTrainingState, trainingReducer } from '../src/tutorial/trainingGame';
import { RELATION_PRESETS } from '../src/scoring/semanticRelations';

const kind = RELATION_PRESETS.find(r => r.family === 'kind')!;
function placed() {
  let state = trainingReducer(createTrainingState(), { type: 'begin' });
  const { x, y } = state.game.startCard.coordinates;
  state = trainingReducer(state, { type: 'place', name: 'Радость', position: { x: x + 1, y } });
  return state;
}
test('training owns fresh state and conserves the real deck composition', () => {
  const a = createTrainingState(), b = createTrainingState();
  assert.equal(a.game.startCard.cardName, 'Эмоция');
  assert.equal(a.game.startCard.playerId, null);
  assert.equal(a.game.players[0].cards.length, 5);
  assert.deepEqual([...a.game.players[0].cards, ...a.game.deck[0]].sort(), a.game.deckSnapshot!.cards!.map(c => c.name).sort());
  a.game.players[0].cards.pop();
  assert.equal(b.game.players[0].cards.length, 5);
  assert.equal(b.game.scores[0], 0);
});
test('wrong card, diagonal placement, relation type and direction cannot advance the lesson', () => {
  let state = trainingReducer(createTrainingState(), { type: 'begin' });
  const { x, y } = state.game.startCard.coordinates;
  state = trainingReducer(state, { type: 'place', name: 'Страх', position: { x: x + 1, y } });
  assert.equal(state.phase, 'place');
  state = trainingReducer(state, { type: 'place', name: 'Радость', position: { x: x + 1, y: y + 1 } });
  assert.equal(state.phase, 'place');
  state = placed();
  state = trainingReducer(state, { type: 'submit' });
  assert.equal(state.phase, 'relation');
  for (const [relation, direction] of [[RELATION_PRESETS[2], 'new-to-neighbor'], [kind, 'neighbor-to-new']] as const) {
    state = trainingReducer(state, { type: 'relation', neighbor: state.game.startCard.id, relation, direction });
    assert.equal(state.game.pendingMove!.semanticEdges!.length, 0);
    assert.ok(state.feedback);
  }
});
test('accepted tutorial move awards exactly one point, refills the hand and creates a real log', () => {
  let state = placed();
  state = trainingReducer(state, { type: 'relation', neighbor: state.game.startCard.id, relation: kind, direction: 'new-to-neighbor' });
  state = trainingReducer(state, { type: 'submit' });
  assert.equal(state.phase, 'voting');
  assert.equal(state.game.scores[0], 0);
  state = trainingReducer(state, { type: 'accept' });
  assert.equal(state.phase, 'complete');
  assert.equal(state.game.scores[0], 1);
  assert.equal(state.game.currentPlayerIndex, 1);
  assert.equal(state.game.players[0].cards.length, 5);
  assert.equal(state.game.deck[0].length, 51);
  assert.equal(state.game.logDetails?.[state.game.log.length - 1].score.totalGained, 1);
  assert.equal(trainingReducer(state, { type: 'accept' }), state);
});
test('cancel restores the hand and restart during voting cannot leak an old acceptance', () => {
  let state = placed();
  state = trainingReducer(state, { type: 'cancel' });
  assert.equal(state.phase, 'place');
  assert.equal(Object.keys(state.game.board).length, 1);
  assert.equal(state.game.players[0].cards.length, 5);
  state = placed();
  state = trainingReducer(state, { type: 'relation', neighbor: state.game.startCard.id, relation: kind, direction: 'new-to-neighbor' });
  state = trainingReducer(state, { type: 'submit' });
  state = trainingReducer(state, { type: 'restart' });
  assert.equal(state.phase, 'intro');
  assert.equal(trainingReducer(state, { type: 'accept' }), state);
  assert.equal(state.game.log.length, 0);
  assert.equal(state.game.scores[0], 0);
});
