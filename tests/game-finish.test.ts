import test from 'node:test';
import assert from 'node:assert/strict';
import { initializeGame, getPassAvailability, getFinalTurnPlayerIndex, resolveEmptyHands, canPlaceCard, placeCard, redrawPlayerHand,
  confirmPendingCard, returnPendingCard, upsertPendingSemanticEdge, submitPendingSemanticMove } from '../src/game';
import { applyGameAction as act, type GameAction } from '../src/gameActions';
import { applyAuthenticatedAction as serverAct } from '../src/server/secureRoomActions';
import { getRelationPresets } from '../src/scoring/semanticRelations';
import type { GameState } from '../src/game';
import type { Room } from '../src/types/room';

function exhausted(count = 2): GameState {
  return { ...initializeGame(count, undefined, 0), sharedDeck: [] };
}
function proposal(game: GameState): GameState {
  const { x, y } = game.startCard.coordinates;
  const coordinates = [{ x: x + 1, y }, { x: x - 1, y }, { x, y: y + 1 }, { x, y: y - 1 }]
    .find(cell => canPlaceCard(game, cell));
  assert.ok(coordinates, 'proposal fixture needs a free neighbor of the neutral card');
  const placed = placeCard(game, game.players[game.currentPlayerIndex].cards[0], coordinates);
  const linked = upsertPendingSemanticEdge(placed, placed.startCard.id,
    getRelationPresets(placed.deckSnapshot)[0], 'new-to-neighbor');
  return submitPendingSemanticMove(linked);
}
function roomFor(game: GameState, order = game.players.map((_, seat) => seat)): Room {
  const players = game.players.map((_, seatIndex) => ({ id: `p${seatIndex}`, seatIndex, nickname: `P${seatIndex}`,
    color: 'blue' as const, isHost: seatIndex === 0, connected: true, joinedAt: '' }));
  return { id: 'room', code: 'TEST', status: 'playing', player_1_id: 'p0', player_2_id: 'p1',
    host_player_id: 'p0', player_1_nickname: 'P0', player_2_nickname: 'P1',
    max_players: players.length as 2 | 3 | 4, players, turn_order: order.map(seat => `p${seat}`),
    current_turn_index: order.indexOf(game.currentPlayerIndex), game_state: game, version: 0, created_at: '', updated_at: '' };
}

for (const count of [2, 3, 4]) {
  test(`${count} players: N-1 consecutive passes end immediately without a solo turn`, () => {
    let game = exhausted(count);
    game.scores = Array(count).fill(7);
    for (let pass = 1; pass <= count - 1; pass++) {
      game = act(game, { type: 'passTurn' });
      assert.equal(game.gameOver, pass === count - 1);
      assert.equal(game.consecutivePasses, pass);
    }
    assert.equal(game.currentPlayerIndex, count - 2);
    assert.equal(game.endReason, 'consecutive-passes');
    assert.deepEqual(game.scores, Array(count).fill(7), 'ties and every current score survive the ending');
    assert.equal(act(game, { type: 'passTurn' }), game);
  });
  test(`${count} players: empty hands give the sole player one final turn`, () => {
    const game = exhausted(count);
    game.players.forEach((player, index) => { if (index < count - 1) player.cards = []; });
    const result = resolveEmptyHands(game);
    assert.equal(result.gameOver, false);
    assert.equal(result.consecutivePasses, 0);
    assert.equal(result.currentPlayerIndex, count - 1);
    assert.equal(getFinalTurnPlayerIndex(result), count - 1);
    const accepted = confirmPendingCard(proposal(result));
    assert.equal(accepted.gameOver, true);
    assert.equal(accepted.endReason, 'final-turn');
    assert.equal(accepted.players[count - 1].cards.length, result.players[count - 1].cards.length - 1);
    assert.ok(accepted.players[count - 1].cards.length > 0, 'only one card is played, not the whole sole hand');
    assert.equal(accepted.scores[count - 1], 1);
  });
  test(`${count} players: passing the final turn ends immediately`, () => {
    const game = exhausted(count);
    game.players.forEach((player, index) => { if (index < count - 1) player.cards = []; });
    const ready = resolveEmptyHands(game);
    const finished = act(ready, { type: 'passTurn' });
    assert.equal(finished.gameOver, true);
    assert.equal(finished.endReason, 'final-turn');
    assert.deepEqual(finished.players, ready.players);
    assert.deepEqual(finished.scores, ready.scores);
  });
  test(`${count} players: all empty finishes immediately without manufactured passes`, () => {
    const game = exhausted(count);
    game.players.forEach(player => { player.cards = []; });
    const result = resolveEmptyHands(game);
    assert.equal(result.gameOver, true);
    assert.equal(result.endReason, 'empty-hands');
    assert.equal(result.consecutivePasses, 0);
  });
  test(`${count} players: early ending requires every seat's consent`, () => {
    let game = act(initializeGame(count, undefined, 0), { type: 'requestFinish' });
    assert.deepEqual(game.pendingFinish?.votes, { '0': true });
    for (let seat = 1; seat < count; seat++) {
      game = act(game, { type: 'voteFinish', playerIndex: seat, accept: true });
      assert.equal(game.gameOver, seat === count - 1);
    }
    assert.equal(game.pendingFinish, null);
    assert.equal(game.endReason, 'agreement');
  });
}

test('pass availability rejects reserve, wrong seat, a pending card and finish voting', () => {
  const fresh = initializeGame(3, undefined, 0);
  assert.equal(getPassAvailability(fresh, 0).canPass, false);
  assert.equal(getPassAvailability(exhausted(3), 1).canPass, false);
  const pending = proposal(exhausted(3));
  assert.equal(getPassAvailability(pending, 0).canPass, false);
  assert.equal(act(pending, { type: 'passTurn' }), pending);
  const finish = act(fresh, { type: 'requestFinish' });
  assert.equal(getPassAvailability(finish, 0).canPass, false);
});

test('accepted move resets the pass streak; cancellation and rejection do not count as passes', () => {
  let game = act(exhausted(4), { type: 'passTurn' });
  game = proposal(game);
  const cancelled = act(game, { type: 'cancelPendingMove' });
  assert.equal(cancelled.consecutivePasses, 1);
  assert.equal(cancelled.currentPlayerIndex, 1);
  const rejected = returnPendingCard(game);
  assert.equal(rejected.consecutivePasses, 1);
  assert.equal(rejected.currentPlayerIndex, 1);
  const accepted = confirmPendingCard(game);
  assert.equal(accepted.consecutivePasses, 0);
  assert.equal(accepted.currentPlayerIndex, 2);
  assert.equal(accepted.scores[1], 1);
});

test('drawing the last shared card gives the sole remaining hand one final turn after scoring', () => {
  const game = exhausted(3);
  game.sharedDeck = ['last-card'];
  game.players[1].cards = [];
  game.players[2].cards = [];
  const accepted = confirmPendingCard(proposal(game));
  assert.equal(accepted.sharedDeck?.length, 0);
  assert.ok(accepted.players[0].cards.includes('last-card'));
  assert.equal(accepted.scores[0], 1);
  assert.equal(accepted.gameOver, false);
  assert.equal(accepted.currentPlayerIndex, 0);
  assert.equal(getFinalTurnPlayerIndex(accepted), 0);
  assert.equal(accepted.consecutivePasses, 0);
  const finalProposal = proposal(accepted);
  const expectedTotal = accepted.scores[0] + finalProposal.pendingMove!.scorePreview!.total;
  const finished = confirmPendingCard(finalProposal);
  assert.equal(finished.gameOver, true);
  assert.equal(finished.endReason, 'final-turn');
  assert.equal(finished.scores[0], expectedTotal);
});

test('last accepted card preserves one final move for the sole hand across the turn-order boundary', () => {
  const game = exhausted(4);
  game.players[0].cards = game.players[0].cards.slice(0, 1);
  game.players[1].cards = [];
  game.players[2].cards = [];
  const accepted = confirmPendingCard(proposal(game));
  assert.equal(accepted.gameOver, false);
  assert.equal(accepted.players.filter(player => player.cards.length).length, 1);
  assert.equal(accepted.scores[0], 1);
  assert.equal(accepted.currentPlayerIndex, 3);
  const finished = confirmPendingCard(proposal(accepted));
  assert.equal(finished.gameOver, true);
  assert.equal(finished.endReason, 'final-turn');
  assert.equal(finished.scores[3], 1);
  assert.equal(act(finished, { type: 'placeCard', cardName: finished.players[3].cards[0], coordinates: { x: 7, y: 8 } }), finished);
});

test('two last cards: [1,1] becomes [0,1], then the final accepted card scores and ends with empty hands', () => {
  const game = exhausted();
  game.players.forEach(player => { player.cards = player.cards.slice(0, 1); });
  const first = confirmPendingCard(proposal(game));
  assert.deepEqual(first.players.map(player => player.cards.length), [0, 1]);
  assert.equal(first.gameOver, false);
  assert.equal(first.currentPlayerIndex, 1);
  const pending = proposal(first);
  assert.deepEqual(pending.players.map(player => player.cards.length), [0, 0]);
  assert.equal(getFinalTurnPlayerIndex(pending), 1, 'the proposed card still belongs to its author until acceptance');
  const restored = JSON.parse(JSON.stringify(pending)) as GameState;
  const finished = confirmPendingCard(restored);
  assert.equal(finished.gameOver, true);
  assert.equal(finished.endReason, 'empty-hands');
  assert.deepEqual(finished.scores, [1, 1]);
});

test('rejecting or cancelling a final attempt preserves the final turn after serialization', () => {
  const game = exhausted();
  game.players[0].cards = [];
  game.players[1].cards = game.players[1].cards.slice(0, 1);
  const ready = resolveEmptyHands(game);
  for (const action of ['returnCard', 'cancelPendingMove'] as const) {
    const pending = JSON.parse(JSON.stringify(proposal(ready))) as GameState;
    const retry = act(pending, { type: action });
    assert.equal(retry.gameOver, false, action);
    assert.equal(retry.currentPlayerIndex, 1, action);
    assert.equal(getFinalTurnPlayerIndex(retry), 1, action);
    assert.equal(retry.players[1].cards.length, 1, action);
    assert.deepEqual(retry.scores, [0, 0], action);
    assert.equal(confirmPendingCard(proposal(retry)).gameOver, true, action);
  }
});

test('finish request requires active seat, nonempty pile, no pending move; rejection resumes unchanged turn', () => {
  const fresh = initializeGame(4, undefined, 0);
  assert.equal(act(fresh, { type: 'requestFinish', playerIndex: 2 }), fresh);
  const empty = exhausted(4);
  assert.equal(act(empty, { type: 'requestFinish' }), empty);
  const pending = proposal(fresh);
  assert.equal(act(pending, { type: 'requestFinish' }), pending);
  const requested = act(fresh, { type: 'requestFinish' });
  const rejected = act(requested, { type: 'voteFinish', playerIndex: 2, accept: false });
  assert.equal(rejected.gameOver, false);
  assert.equal(rejected.pendingFinish, null);
  assert.equal(rejected.currentPlayerIndex, 0);
  assert.deepEqual(rejected.scores, fresh.scores);
  assert.deepEqual(rejected.players, fresh.players);
});

test('finish votes block card mutations; final state blocks direct functions and reducer actions', () => {
  const requested = act(initializeGame(2, undefined, 0), { type: 'requestFinish' });
  const finished = act(requested, { type: 'voteFinish', playerIndex: 1, accept: true });
  for (const game of [requested, finished]) {
    const actions: GameAction[] = [
      { type: 'placeCard', cardName: game.players[0].cards[0], coordinates: { x: 8, y: 7 } },
      { type: 'redrawHand' }, { type: 'passTurn' }, { type: 'requestFinish' }, { type: 'cancelPendingMove' },
      { type: 'confirmCard' }, { type: 'returnCard' }, { type: 'submitSemanticMove' },
      { type: 'approveCross' }, { type: 'rejectCross' },
    ];
    for (const action of actions) assert.equal(act(game, action), game, action.type);
    assert.equal(canPlaceCard(game, { x: 8, y: 7 }), false);
    assert.equal(placeCard(game, game.players[0].cards[0], { x: 8, y: 7 }), game);
    assert.equal(redrawPlayerHand(game, 0), game);
  }
});

test('legacy saves without new fields retain default pass count and existing scores', () => {
  const game = exhausted(3);
  delete game.consecutivePasses; delete game.pendingFinish;
  game.scores = [9, 9, 2];
  const next = act(game, { type: 'passTurn' });
  assert.equal(next.consecutivePasses, 1);
  assert.deepEqual(next.scores, [9, 9, 2]);
  assert.equal(next.gameOver, false);
});

test('online pass and automatic skips follow shuffled turn_order', () => {
  const game = exhausted(4);
  game.players[2].cards = [];
  const room = roomFor(game, [0, 2, 3, 1]);
  const next = serverAct(room, 'p0', { type: 'passTurn', playerIndex: 3 });
  assert.equal(next.game_state.consecutivePasses, 2);
  assert.equal(next.game_state.currentPlayerIndex, 3);
  assert.equal(next.current_turn_index, 2);
  assert.deepEqual(next.turn_order, room.turn_order);
  const finished = serverAct(next, 'p3', { type: 'passTurn' });
  assert.equal(finished.game_state.gameOver, true);
  assert.equal(finished.current_turn_index, 2);
  assert.throws(() => serverAct(finished, 'p3', { type: 'passTurn' }));
});

test('online accepted move preserves shuffled order and skips empty seats exactly once', () => {
  const game = exhausted(4);
  game.players[2].cards = [];
  const proposed = proposal(game);
  const room = roomFor(proposed, [0, 2, 3, 1]);
  const id = proposed.pendingMove!.cardId;
  const one = serverAct(room, 'p1', { type: 'confirmCard' }, id);
  const result = serverAct(one, 'p2', { type: 'confirmCard' }, id);
  assert.equal(result.game_state.scores[0], 1);
  assert.equal(result.game_state.consecutivePasses, 1);
  assert.equal(result.game_state.currentPlayerIndex, 3);
  assert.equal(result.current_turn_index, 2);
});

test('online shuffled order keeps one final turn, empty-handed voters and authoritative final scoring', () => {
  const game = exhausted(4);
  game.players[0].cards = game.players[0].cards.slice(0, 1);
  game.players[1].cards = [];
  game.players[2].cards = [];
  const pending = proposal(game);
  const order = [0, 2, 3, 1];
  let room = roomFor(pending, order);
  const firstId = pending.pendingMove!.cardId;
  room = serverAct(room, 'p1', { type: 'confirmCard' }, firstId);
  room = serverAct(room, 'p2', { type: 'confirmCard' }, firstId);
  assert.equal(room.game_state.gameOver, false);
  assert.equal(room.game_state.currentPlayerIndex, 3);
  assert.equal(room.current_turn_index, 2);
  assert.deepEqual(room.turn_order, ['p0', 'p2', 'p3', 'p1']);
  assert.equal(room.game_state.players.filter(player => player.cards.length).length, 1);
  assert.throws(() => serverAct(room, 'p0', { type: 'passTurn' }), /Сейчас ход другого игрока/);
  const finalProposal = proposal(room.game_state);
  room = { ...room, game_state: finalProposal };
  const finalId = finalProposal.pendingMove!.cardId;
  assert.throws(() => serverAct(room, 'outsider', { type: 'confirmCard' }, finalId));
  assert.throws(() => serverAct(room, 'p3', { type: 'confirmCard' }, finalId));
  const oneVote = serverAct(room, 'p0', { type: 'confirmCard' }, finalId);
  assert.equal(oneVote.game_state.gameOver, false, 'one of three other players is not a majority');
  assert.equal(oneVote.game_state.scores[3], 0);
  assert.throws(() => serverAct(oneVote, 'p0', { type: 'confirmCard' }, finalId));
  const restored = JSON.parse(JSON.stringify(oneVote)) as Room;
  const finished = serverAct(restored, 'p2', { type: 'confirmCard' }, finalId);
  assert.equal(finished.game_state.gameOver, true);
  assert.equal(finished.game_state.endReason, 'final-turn');
  assert.equal(finished.game_state.scores[3], 1);
  assert.ok(finished.game_state.players[3].cards.length > 0, 'the server permits one final move, not solo play until empty');
  assert.throws(() => serverAct(finished, 'p1', { type: 'confirmCard' }, finalId));
  assert.throws(() => serverAct(finished, 'p3', { type: 'passTurn' }));
});

test('online final turn can be declined and retried or ended by its own pass', () => {
  const game = exhausted(3);
  game.players[0].cards = [];
  game.players[1].cards = [];
  const ready = resolveEmptyHands(game, [1, 2, 0]);
  const pending = proposal(ready);
  let room = roomFor(pending, [1, 2, 0]);
  room = serverAct(room, 'p0', { type: 'returnCard' }, pending.pendingMove!.cardId);
  assert.equal(room.game_state.gameOver, false);
  assert.equal(room.game_state.currentPlayerIndex, 2);
  assert.equal(getFinalTurnPlayerIndex(room.game_state), 2);
  assert.equal(room.game_state.scores[2], 0);
  const finished = serverAct(room, 'p2', { type: 'passTurn', playerIndex: 0 });
  assert.equal(finished.game_state.gameOver, true);
  assert.equal(finished.game_state.endReason, 'final-turn');
  assert.deepEqual(finished.game_state.scores, [0, 0, 0]);
});

test('online finish authorization ignores forged seat, rejects duplicate/stale votes and outsiders', () => {
  const room = roomFor(initializeGame(3, undefined, 0));
  assert.throws(() => serverAct(room, 'p1', { type: 'requestFinish' }));
  assert.throws(() => serverAct(room, 'p1', { type: 'passTurn' }));
  const requested = serverAct(room, 'p0', { type: 'requestFinish', playerIndex: 2 });
  const finishId = requested.game_state.pendingFinish!.id;
  assert.equal(requested.game_state.pendingFinish!.requestedBy, 0);
  assert.throws(() => serverAct(requested, 'outsider', { type: 'voteFinish', accept: true, finishId }));
  assert.throws(() => serverAct(requested, 'p1', { type: 'voteFinish', accept: true, finishId: 'old' }));
  assert.throws(() => serverAct(requested, 'p0', { type: 'redrawHand' }));
  const voted = serverAct(requested, 'p1', { type: 'voteFinish', playerIndex: 2, accept: true, finishId });
  assert.deepEqual(voted.game_state.pendingFinish!.votes, { '0': true, '1': true });
  assert.throws(() => serverAct(voted, 'p1', { type: 'voteFinish', accept: true, finishId }));
  const finished = serverAct(voted, 'p2', { type: 'voteFinish', accept: true, finishId });
  assert.equal(finished.game_state.gameOver, true);
  assert.equal(finished.status, 'playing', 'finished game remains available to room reconnection');
  assert.throws(() => serverAct(finished, 'p0', { type: 'redrawHand' }));
});

test('a vote for a rejected finish proposal cannot leak into a later proposal', () => {
  let room = serverAct(roomFor(initializeGame(3, undefined, 0)), 'p0', { type: 'requestFinish' });
  const finishId = room.game_state.pendingFinish!.id;
  room = serverAct(room, 'p1', { type: 'voteFinish', accept: false, finishId });
  room = serverAct(room, 'p0', { type: 'requestFinish' });
  assert.notEqual(room.game_state.pendingFinish!.id, finishId);
  assert.throws(() => serverAct(room, 'p2', { type: 'voteFinish', accept: true, finishId }));
});
