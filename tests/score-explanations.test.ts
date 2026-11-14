import test from 'node:test';
import assert from 'node:assert/strict';
import { initializeGame } from '../src/game';
import { calculateSemanticMoveScore } from '../src/scoring/calculateSemanticMoveScore';
import { getHistoricalMoveScore } from '../src/scoring/scoreExplanations';
import type { PlacedCard, SemanticEdge, SemanticEdgeScore, SemanticRelation } from '../src/types';

const cause: SemanticRelation = { family: 'cause', fromRole: 'cause', toRole: 'effect' };
const opposite: SemanticRelation = { family: 'opposite', symmetric: true };
const card = (id: string, name: string, x: number, y: number, owner = 0): PlacedCard => ({
  id, cardName: name, coordinates: { x, y }, playerId: owner, status: 'confirmed', connections: [],
});
const accepted = (a: PlacedCard, b: PlacedCard, relation: SemanticRelation = cause): SemanticEdge => ({
  id: `${a.id}-${b.id}`, fromCardInstanceId: a.id, toCardInstanceId: b.id,
  fromPosition: { ...a.coordinates }, toPosition: { ...b.coordinates }, relation: { ...relation },
  createdBySeatIndex: 0, createdAtMoveId: `old-${a.id}-${b.id}`, createdOrder: 0,
});

function sympathy(reverse = false) {
  const mood = card('mood', 'Настроение', 0, 0), smile = card('smile', 'Улыбка', 0, 1);
  const fun = card('fun', 'Веселье', 0, 2), inspiration = card('inspiration', 'Воодушевление', -1, 2);
  const placed = card('sympathy', 'Симпатия', -1, 1);
  const targets = reverse ? [inspiration, smile] : [smile, inspiration];
  return { board: Object.fromEntries([mood, smile, fun, inspiration, placed].map(c => [`${c.coordinates.x},${c.coordinates.y}`, c])),
    existingEdges: [accepted(mood, smile), accepted(smile, fun), accepted(inspiration, fun)], activeSeatIndex: 0,
    pendingMove: { moveId: 'sympathy-move', cardId: placed.id, position: placed.coordinates, placedBySeatIndex: 0,
      semanticEdges: targets.map((neighbor, createdOrder) => ({ id: `new-${neighbor.id}`, neighborPosition: neighbor.coordinates,
        neighborCardInstanceId: neighbor.id, relation: cause, direction: 'new-to-neighbor' as const, createdOrder })) } };
}

test('score explanations freeze two actual paths and only Sympathy as the node center for +5', () => {
  const input = sympathy();
  const original = structuredClone(input);
  const score = calculateSemanticMoveScore(input);
  assert.equal(score.total, 5);
  const [first, second] = score.edges.map(edge => edge.explanation!);
  assert.equal(first.relation, 'Симпатия — причина Улыбка');
  assert.deepEqual(first.path!.cards.map(c => c.name), ['Симпатия', 'Улыбка', 'Веселье']);
  assert.equal(first.path!.sharedCardId, 'smile');
  assert.equal(first.node, undefined);
  assert.deepEqual(second.path!.cards.map(c => c.name), ['Симпатия', 'Воодушевление', 'Веселье']);
  assert.equal(second.node!.center.name, 'Симпатия');
  assert.equal(second.node!.direction, 'from-center');
  assert.deepEqual(second.node!.edges.map(edge => edge.id), ['new-smile', 'new-inspiration']);
  assert.deepEqual(input, original);
  input.board['0,1'].cardName = 'Переименовано';
  input.pendingMove.semanticEdges[0].relation = { ...cause, fromRole: 'cause' };
  assert.equal(first.path!.cards[1].name, 'Улыбка');
  assert.deepEqual(JSON.parse(JSON.stringify(score)), score);
});

test('score explanations follow creation order and do not promise a node before its first edge', () => {
  const score = calculateSemanticMoveScore(sympathy(true));
  assert.equal(score.total, 5);
  assert.equal(score.edges[0].nodeBonus, 0);
  assert.equal(score.edges[0].explanation!.node, undefined);
  assert.equal(score.edges[1].explanation!.node!.center.id, 'sympathy');
});

test('symmetric witnesses show a three-card path but do not reward its old middle as a node', () => {
  const a = card('a', 'A', 0, 0), b = card('b', 'B', 1, 0), n = card('n', 'N', 1, 1);
  const board = Object.fromEntries([a, b, n].map(c => [`${c.coordinates.x},${c.coordinates.y}`, c]));
  const result = calculateSemanticMoveScore({ board, existingEdges: [accepted(a, b, opposite)], activeSeatIndex: 0,
    pendingMove: { moveId: 'new', cardId: n.id, position: n.coordinates, placedBySeatIndex: 0,
      semanticEdges: [{ id: 'new-nb', neighborCardInstanceId: b.id, neighborPosition: b.coordinates,
        relation: opposite, direction: 'new-to-neighbor', createdOrder: 0 }] } });
  assert.equal(result.total, 2);
  assert.deepEqual(result.edges[0].explanation!.path!.cards.map(c => c.name), ['A', 'B', 'N']);
  assert.equal(result.edges[0].explanation!.node, undefined);
});

test('a foreign internal card supplies neither a path witness nor an old-center node', () => {
  const input = sympathy();
  input.board['0,1'].playerId = 1;
  input.pendingMove.semanticEdges = input.pendingMove.semanticEdges.slice(0, 1);
  const result = calculateSemanticMoveScore(input);
  assert.equal(result.total, 1);
  assert.equal(result.edges[0].explanation!.path, undefined);
  assert.equal(result.edges[0].explanation!.node, undefined);
});

function historical() {
  const input = sympathy();
  const score = calculateSemanticMoveScore(input);
  const game = initializeGame(2, undefined, 0);
  game.board = input.board;
  const placed = game.board['-1,1'];
  const edges = input.pendingMove.semanticEdges.map(pending => ({
    id: pending.id, fromCardInstanceId: placed.id, toCardInstanceId: pending.neighborCardInstanceId,
    fromPosition: placed.coordinates, toPosition: pending.neighborPosition, relation: cause,
    createdBySeatIndex: 0, createdAtMoveId: input.pendingMove.moveId, createdOrder: pending.createdOrder,
  }));
  game.semanticEdges = [...input.existingEdges, ...edges];
  game.logDetails = {};
  input.existingEdges.forEach((edge, index) => {
    const award: SemanticEdgeScore = { pendingEdgeId: edge.id, baseScore: 1, pathBonus: 0, nodeBonus: 0, total: 1,
      continuesPath: false, continuesNode: false };
    game.logDetails![index] = { relations: [], score: { playerId: 0, cardName: edge.fromCardInstanceId,
      totalGained: 1, newTotalScore: index + 1, semanticScore: { total: 1, edges: [award] } } };
  });
  game.logDetails[3] = { relations: score.edges.map(edge => edge.explanation!.relation), score: {
    playerId: 0, cardName: 'Симпатия', totalGained: 5, newTotalScore: 8,
    semanticScore: { ...score, edges: score.edges.map(({ explanation: _explanation, ...award }) => { void _explanation; return award; }) },
  } };
  return { game, score };
}

test('complete legacy history recovers witnesses from earlier edges without changing recorded points', () => {
  const { game, score } = historical();
  const original = structuredClone(game);
  assert.deepEqual(getHistoricalMoveScore(game, 3), score);
  assert.deepEqual(game, original);
});

test('incomplete or inconsistent legacy history retains unknown witnesses instead of using a future board', () => {
  for (const change of ['missing-history', 'future-edges', 'wrong-score', 'duplicate-edge', 'missing-card', 'missing-move']) {
    const { game } = historical();
    const recorded = game.logDetails![3].score.semanticScore!;
    if (change === 'missing-history') delete game.logDetails![0];
    if (change === 'future-edges') {
      game.logDetails![4] = game.logDetails![1]; delete game.logDetails![1];
    }
    if (change === 'wrong-score') recorded.edges[0].pathBonus = 0;
    if (change === 'duplicate-edge') game.semanticEdges!.push({ ...game.semanticEdges![0] });
    if (change === 'missing-card') delete game.board['0,2'];
    if (change === 'missing-move') game.semanticEdges![4].createdAtMoveId = 'different-move';
    assert.equal(getHistoricalMoveScore(game, 3), recorded, change);
    assert.ok(recorded.edges.every(edge => !edge.explanation), change);
  }
});

test('persisted explanations are used unchanged when later cards or labels change', () => {
  const { game, score } = historical();
  game.logDetails![3].score.semanticScore = score;
  game.board['0,2'].cardName = 'Later label';
  game.semanticEdges = [];
  assert.equal(getHistoricalMoveScore(game, 3), score);
  assert.equal(score.edges[0].explanation!.path!.cards[2].name, 'Веселье');
  assert.equal(getHistoricalMoveScore(game, 99), undefined);
});

test('historical six-point awards are not rewritten by the new-center rule', () => {
  const { game } = historical();
  const detail = game.logDetails![3];
  const oldScore = detail.score.semanticScore!;
  oldScore.edges[0] = { ...oldScore.edges[0], nodeBonus: 1, continuesNode: true, total: 3 };
  oldScore.total = 6;
  detail.score.totalGained = 6;
  detail.score.newTotalScore = 9;
  const original = structuredClone(game);
  assert.equal(getHistoricalMoveScore(game, 3), oldScore);
  assert.equal(oldScore.total, 6);
  assert.ok(oldScore.edges.every(edge => !edge.explanation));
  assert.deepEqual(game, original);
});
