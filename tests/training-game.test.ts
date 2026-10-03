import test from 'node:test';
import assert from 'node:assert/strict';
import { createTrainingState, trainingReducer, suggestedTrainingMove, TRAINING_HAND, TRAINING_RESERVE, type TrainingState } from '../src/tutorial/trainingGame';
import { RELATION_PRESETS } from '../src/scoring/semanticRelations';
const kind = RELATION_PRESETS.find(r => r.family === 'kind')!;
const advance = (state: TrainingState) => {
  for (let i = 0; i < 15 && !['place', 'complete'].includes(state.phase); i++) {
    state = trainingReducer(state, { type: state.phase === 'opponent' ? 'approve-opponent' : 'next' });
  }
  return state;
};
function opening(name = 'Радость', x = 1, y = 0) {
  let state = advance(createTrainingState());
  const center = state.game.startCard.coordinates;
  state = trainingReducer(state, { type: 'place', name, position: { x: center.x + x, y: center.y + y } });
  return trainingReducer(state, { type: 'relation', neighbor: state.game.startCard.id, relation: kind, direction: 'new-to-neighbor' });
}
function submit(state: TrainingState) {
  state = trainingReducer(state, { type: 'submit' });
  if (state.moves === 0) {
    assert.equal(state.phase, 'explain');
    state = trainingReducer(state, { type: 'explain' });
  }
  assert.equal(state.phase, 'voting');
  return trainingReducer(state, { type: 'accept' });
}
test('isolated five-card hand and five-card reserve, interface walkthrough before placing', () => {
  const state = createTrainingState(), other = createTrainingState();
  assert.deepEqual(state.game.players[0].cards, TRAINING_HAND);
  assert.deepEqual([...state.game.deck[0]].sort(), [...TRAINING_RESERVE].sort());
  assert.equal(state.game.startCard.playerId, null);
  assert.equal(trainingReducer(state, { type: 'place', name: 'Радость', position: { x: 1, y: 0 } }), state);
  state.game.players[0].cards.pop();
  assert.equal(other.game.players[0].cards.length, 5);
});
test('rejects unsupported relation at voting, restores hand and leaves score unchanged', () => {
  let state = opening();
  state = trainingReducer(state, { type: 'relation', neighbor: state.game.startCard.id, relation: kind, direction: 'neighbor-to-new' });
  state = submit(state);
  assert.equal(state.phase, 'place');
  assert.equal(state.game.scores[0], 0);
  assert.equal(state.game.players[0].cards.length, 5);
  assert.equal(state.game.log.length, 0);
});
test('requires explanation step, scores real move, draws matching subtype and switches turn', () => {
  const placed = opening();
  assert.equal(trainingReducer(placed, { type: 'accept' }), placed);
  const state = submit(placed);
  assert.equal(state.phase, 'result');
  assert.equal(state.game.scores[0], 1);
  assert.equal(state.game.currentPlayerIndex, 1);
  assert.ok(state.game.players[0].cards.includes('Веселье'));
  assert.equal(state.game.deck[0].length, 4);
  assert.equal(state.game.log.length, 1);
});
test('all five openings and four placements lead to a real node and personal path', () => {
  for (const name of TRAINING_HAND) for (const [x, y] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    let state = advance(submit(opening(name, x, y)));
    for (let i = 0; i < 8 && state.phase !== 'complete'; i++) {
      assert.equal(state.phase, 'place');
      const move = suggestedTrainingMove(state);
      assert.ok(move, `No continuation for ${name}: ${state.phase}`);
      const neighbor = Object.values(state.game.board).find(c => c.cardName === move.neighbor)!;
      state = trainingReducer(state, { type: 'place', name: move.name, position: move.position });
      state = trainingReducer(state, { type: 'relation', neighbor: neighbor.id, relation: move.relation, direction: 'new-to-neighbor' });
      state = advance(submit(state));
    }
    assert.equal(state.phase, 'complete', name);
    assert.equal(state.sawPath, true);
    assert.equal(state.sawNode, true);
    assert.ok(state.game.scores[1] > 0);
    assert.ok(state.game.log.length >= 4);
  }
});
test('cancel and restart preserve isolation; late acceptance cannot affect restarted lesson', () => {
  let state = trainingReducer(opening(), { type: 'cancel' });
  assert.equal(state.game.players[0].cards.length, 5);
  assert.equal(Object.keys(state.game.board).length, 1);
  state = trainingReducer(state, { type: 'restart' });
  assert.equal(trainingReducer(state, { type: 'accept' }), state);
  assert.equal(state.phase, 'intro');
});
test('one invalid edge rejects the entire proposal even when the first edge is valid', () => {
  let state = opening();
  const first = state.game.pendingMove!.semanticEdges![0];
  state = { ...state, game: { ...state.game, pendingMove: { ...state.game.pendingMove!, semanticEdges: [first, { ...first, id: 'invalid-extra', direction: 'neighbor-to-new', createdOrder: 1 }] } } };
  state = submit(state);
  assert.equal(state.phase, 'place');
  assert.equal(state.game.scores[0], 0);
  assert.equal(state.game.log.length, 0);
});
test('rejected opponent cards cycle without scoring, then acceptance resumes the lesson', () => {
  for (const name of TRAINING_HAND) {
    let state = submit(opening(name));
    for (let i = 0; i < 10 && state.phase !== 'opponent'; i++) state = trainingReducer(state, { type: 'next' });
    assert.equal(state.phase, 'opponent');
    const cards = [];
    const originalBoardSize = Object.keys(state.game.board).length;
    const originalLogSize = state.game.log.length;
    for (let i = 0; i < 7; i++) {
      cards.push(state.game.pendingMove!.cardName);
      assert.equal(state.game.pendingMove!.semanticEdges![0].relation.family, 'opposite');
      state = trainingReducer(state, { type: 'reject-opponent' });
      assert.equal(state.phase, 'opponent');
      assert.equal(state.game.scores[1], 0);
      assert.equal(state.game.log.length, originalLogSize);
      assert.equal(Object.keys(state.game.board).length, originalBoardSize);
      assert.equal(state.game.currentPlayerIndex, 1);
      assert.notEqual(state.game.pendingMove!.cardName, cards.at(-1));
    }
    assert.ok(new Set(cards).size >= 2);
    assert.ok(cards.slice(1).includes(cards[0]));
    state = trainingReducer(state, { type: 'approve-opponent' });
    assert.equal(state.phase, 'opponent-result');
    state = trainingReducer(state, { type: 'next' });
    assert.equal(state.phase, 'reminder');
    state = trainingReducer(state, { type: 'next' });
    assert.equal(state.phase, 'place');
    assert.equal(state.game.currentPlayerIndex, 0);
    assert.ok(suggestedTrainingMove(state));
  }
});
