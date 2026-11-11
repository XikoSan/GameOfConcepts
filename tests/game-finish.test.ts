import test from 'node:test';
import assert from 'node:assert/strict';
import { initializeGame, getPassAvailability, resolveEmptyHands, canPlaceCard, placeCard, redrawPlayerHand,
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
  const placed = placeCard(game, game.players[game.currentPlayerIndex].cards[0], { x: 8, y: 7 });
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
  test(`${count} players: empty hands automatically pass and stop before the sole player gets another turn`, () => {
    const game = exhausted(count);
    game.players.forEach((player, index) => { if (index < count - 1) player.cards = []; });
    const result = resolveEmptyHands(game);
    assert.equal(result.gameOver, true);
    assert.equal(result.consecutivePasses, count - 1);
    assert.equal(result.currentPlayerIndex, count - 2);
    assert.equal(result.log.length, count - 1);
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

test('drawing the last shared card triggers automatic empty-hand passes after scoring', () => {
  const game = exhausted(3);
  game.sharedDeck = ['last-card'];
  game.players[1].cards = [];
  game.players[2].cards = [];
  const accepted = confirmPendingCard(proposal(game));
  assert.equal(accepted.sharedDeck?.length, 0);
  assert.ok(accepted.players[0].cards.includes('last-card'));
  assert.equal(accepted.scores[0], 1);
  assert.equal(accepted.gameOver, true);
  assert.equal(accepted.consecutivePasses, 2);
});

test('last accepted card ends before the sole nonempty hand can play, even across the turn-order boundary', () => {
  const game = exhausted(4);
  game.players[0].cards = game.players[0].cards.slice(0, 1);
  game.players[1].cards = [];
  game.players[2].cards = [];
  const accepted = confirmPendingCard(proposal(game));
  assert.equal(accepted.gameOver, true);
  assert.equal(accepted.players.filter(player => player.cards.length).length, 1);
  assert.equal(accepted.scores[0], 1);
  assert.equal(act(accepted, { type: 'placeCard', cardName: accepted.players[3].cards[0], coordinates: { x: 7, y: 8 } }), accepted);
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
