import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateSemanticMoveScore } from '../src/scoring/calculateSemanticMoveScore';
import { initializeGame } from '../src/game';
import { applyAuthenticatedAction } from '../src/server/secureRoomActions';
import type { PlacedCard, SemanticEdge, SemanticRelation } from '../src/types';
import type { Room } from '../src/types/room';

const cause: SemanticRelation = { family: 'cause', fromRole: 'cause', toRole: 'effect' };
const card = (name: string, x: number, y: number): PlacedCard => ({
  id: name, cardName: name, coordinates: { x, y }, playerId: 0, status: 'confirmed', connections: [],
});

// Reproduce the reported blue-card corner without inferring edges from adjacency.
function fixture(reverseOrder = false) {
  const mood = card('Настроение', 0, 0);
  const smile = card('Улыбка', 0, 1);
  const fun = card('Веселье', 0, 2);
  const inspiration = card('Воодушевление', -1, 2);
  const sympathy = card('Симпатия', -1, 1);
  const accepted = (from: PlacedCard, to: PlacedCard): SemanticEdge => ({
    id: `${from.id}:${to.id}`, fromCardInstanceId: from.id, toCardInstanceId: to.id,
    fromPosition: from.coordinates, toPosition: to.coordinates, relation: cause,
    createdBySeatIndex: 0, createdAtMoveId: `old:${from.id}:${to.id}`, createdOrder: 0,
  });
  const neighbors = reverseOrder ? [inspiration, smile] : [smile, inspiration];
  return {
    board: Object.fromEntries([mood, smile, fun, inspiration, sympathy].map(c => [`${c.coordinates.x},${c.coordinates.y}`, c])),
    existingEdges: [accepted(mood, smile), accepted(smile, fun), accepted(inspiration, fun)],
    activeSeatIndex: 0,
    pendingMove: {
      moveId: 'sympathy', cardId: sympathy.id, position: sympathy.coordinates, placedBySeatIndex: 0,
      semanticEdges: neighbors.map((neighbor, createdOrder) => ({
        id: `new:${neighbor.id}`, neighborCardInstanceId: neighbor.id, neighborPosition: neighbor.coordinates,
        relation: cause, direction: 'new-to-neighbor' as const, createdOrder,
      })),
    },
  };
}

test('reported Sympathy corner: two paths and only the newly placed center give five points', () => {
  const input = fixture();
  const original = structuredClone(input);
  const result = calculateSemanticMoveScore(input);
  assert.deepEqual(result.edges.map(e => [e.baseScore, e.pathBonus, e.nodeBonus, e.total]), [[1, 1, 0, 2], [1, 1, 1, 3]]);
  assert.equal(result.total, 5);
  assert.equal(result.edges[0].explanation?.node, undefined);
  assert.equal(result.edges[1].explanation?.node?.center.id, 'Симпатия');
  assert.deepEqual(input, original);
});

test('reported Sympathy corner: reverse creation order gives five, even if the edge array is reordered', () => {
  const input = fixture(true);
  input.pendingMove.semanticEdges.reverse();
  const result = calculateSemanticMoveScore(input);
  assert.deepEqual(result.edges.map(e => [e.pendingEdgeId, e.pathBonus, e.nodeBonus, e.total]), [
    ['new:Воодушевление', 1, 0, 2], ['new:Улыбка', 1, 1, 3],
  ]);
  assert.equal(result.total, 5);
});

test('reported Sympathy corner: future or merely adjacent connections cannot supply path bonuses', () => {
  const input = fixture();
  input.existingEdges = input.existingEdges.slice(0, 1);
  const result = calculateSemanticMoveScore(input);
  assert.deepEqual(result.edges.map(e => [e.pathBonus, e.nodeBonus, e.total]), [[0, 0, 1], [0, 1, 2]]);
  assert.equal(result.total, 3);
});

function star(owners: (number | null)[], direction: 'new-to-neighbor' | 'neighbor-to-new' = 'new-to-neighbor', relation: SemanticRelation = cause) {
  const center = card('center', 0, 0);
  const coordinates = [[1, 0], [0, 1], [-1, 0], [0, -1]];
  const outer = owners.map((playerId, index) => ({ ...card(`outer-${index}`, ...coordinates[index] as [number, number]), playerId }));
  return { board: Object.fromEntries([center, ...outer].map(c => [`${c.coordinates.x},${c.coordinates.y}`, c])),
    existingEdges: [] as SemanticEdge[], activeSeatIndex: 0,
    pendingMove: { moveId: 'new-center', cardId: center.id, position: center.coordinates, placedBySeatIndex: 0,
      semanticEdges: outer.map((neighbor, createdOrder) => ({ id: `spoke-${createdOrder}`, neighborCardInstanceId: neighbor.id,
        neighborPosition: neighbor.coordinates, relation: { ...relation }, direction, createdOrder })) } };
}

test('new center awards each additional compatible spoke with any outer-card owners', () => {
  for (const direction of ['new-to-neighbor', 'neighbor-to-new'] as const) {
    for (const owners of [[0, 0, 0, 0], [1, 2, null, 0], [null, 1, 2, 3]]) {
      const input = star(owners, direction);
      const score = calculateSemanticMoveScore(input);
      assert.deepEqual(score.edges.map(edge => [edge.baseScore, edge.pathBonus, edge.nodeBonus]),
        [[1, 0, 0], [1, 0, 1], [1, 0, 1], [1, 0, 1]]);
      assert.equal(score.total, 7);
      for (const edge of score.edges.slice(1)) {
        assert.equal(edge.explanation!.node!.center.id, 'center');
        assert.equal(edge.explanation!.node!.center.ownerSeatIndex, 0);
        assert.equal(edge.explanation!.node!.direction, direction === 'new-to-neighbor' ? 'from-center' : 'toward-center');
      }
    }
  }
});

test('new-center nodes require matching relation family and direction', () => {
  const oppositeDirection = star([1, 2]);
  oppositeDirection.pendingMove.semanticEdges[1].direction = 'neighbor-to-new';
  const directionScore = calculateSemanticMoveScore(oppositeDirection);
  assert.deepEqual(directionScore.edges.map(edge => edge.nodeBonus), [0, 0]);
  assert.equal(directionScore.edges[1].pathBonus, 1);
  const differentFamily = star([1, 2]);
  differentFamily.pendingMove.semanticEdges[1].relation = { family: 'kind', fromRole: 'kind', toRole: 'general' };
  assert.deepEqual(calculateSemanticMoveScore(differentFamily).edges.map(edge => edge.nodeBonus), [0, 0]);
});

test('symmetric relations allow a new-center node regardless of edge orientation', () => {
  const input = star([1, null], 'new-to-neighbor', { family: 'opposite', symmetric: true });
  input.pendingMove.semanticEdges[1].direction = 'neighbor-to-new';
  const result = calculateSemanticMoveScore(input);
  assert.deepEqual(result.edges.map(edge => edge.nodeBonus), [0, 1]);
  assert.equal(result.edges[1].explanation!.node!.direction, 'symmetric');
  assert.equal(result.edges[1].explanation!.node!.center.id, 'center');
});

test('an old center grants no node even if it belongs to the active player', () => {
  for (const owner of [0, 1, null]) {
    const input = fixture();
    input.board['0,1'].playerId = owner;
    input.pendingMove.semanticEdges = input.pendingMove.semanticEdges.slice(0, 1);
    const result = calculateSemanticMoveScore(input);
    assert.equal(result.edges[0].nodeBonus, 0);
    assert.equal(result.edges[0].pathBonus, owner === 0 ? 1 : 0);
    assert.equal(result.edges[0].explanation!.node, undefined);
  }
});

test('a foreign or neutral newly placed center never grants a node to the active player', () => {
  for (const owner of [1, null]) {
    const input = star([0, 0]);
    input.board['0,0'].playerId = owner;
    assert.deepEqual(calculateSemanticMoveScore(input).edges.map(edge => edge.nodeBonus), [0, 0]);
  }
});

test('online voting recomputes Sympathy +5 and preserves previously recorded awards', () => {
  const input = fixture();
  const game = initializeGame(2, undefined, 0);
  const board = { ...input.board };
  delete board['-1,1'];
  game.board = board;
  game.semanticEdges = input.existingEdges;
  game.players[0].cards = ['Симпатия', 'Гнев'];
  game.scores = [9, 4];
  game.logDetails = { 0: { relations: ['Историческая связь'], score: { playerId: 0,
    cardName: 'Ранний ход', totalGained: 6, newTotalScore: 9,
    semanticScore: { total: 6, edges: [] } } } };
  game.log = ['Исторический ход'];
  const oldDetail = structuredClone(game.logDetails[0]);
  const players = [0, 1].map(seatIndex => ({ id: `p${seatIndex}`, seatIndex, nickname: `P${seatIndex}`,
    color: 'blue' as const, isHost: seatIndex === 0, connected: true, joinedAt: '' }));
  let room: Room = { id: 'sympathy-room', code: 'TEST', status: 'playing', player_1_id: 'p0', player_2_id: 'p1',
    host_player_id: 'p0', player_1_nickname: 'P0', player_2_nickname: 'P1', max_players: 2, players,
    turn_order: ['p0', 'p1'], current_turn_index: 0, game_state: game, version: 0, created_at: '', updated_at: '' };
  room = applyAuthenticatedAction(room, 'p0', { type: 'placeCard', cardName: 'Симпатия', coordinates: { x: -1, y: 1 } });
  const cardId = room.game_state.pendingMove!.cardId;
  for (const name of ['Улыбка', 'Воодушевление']) room = applyAuthenticatedAction(room, 'p0', {
    type: 'upsertSemanticEdge', neighborCardInstanceId: name, relation: cause, direction: 'new-to-neighbor',
  }, cardId);
  assert.equal(room.game_state.pendingMove!.scorePreview!.total, 5);
  room = applyAuthenticatedAction(room, 'p0', { type: 'submitSemanticMove' }, cardId);
  // A persisted or stale preview is not an authority for acceptance.
  room.game_state.pendingMove!.scorePreview!.total = 999;
  const accepted = applyAuthenticatedAction(room, 'p1', { type: 'confirmCard' }, cardId);
  assert.equal(accepted.game_state.pendingMove, null);
  assert.equal(accepted.game_state.scores[0], 14);
  assert.equal(accepted.game_state.scores[1], 4);
  const detail = Object.values(accepted.game_state.logDetails!).find(entry => entry.score.cardName === 'Симпатия')!;
  assert.equal(detail.score.totalGained, 5);
  assert.deepEqual(detail.score.semanticScore!.edges.map(edge => [edge.pathBonus, edge.nodeBonus]), [[1, 0], [1, 1]]);
  assert.equal(detail.score.semanticScore!.edges[1].explanation!.node!.center.id, cardId);
  assert.deepEqual(accepted.game_state.logDetails![0], oldDetail);
  assert.equal(accepted.current_turn_index, 1);
});
