import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateSemanticMoveScore } from '../src/scoring/calculateSemanticMoveScore';
import type { PlacedCard, SemanticEdge, SemanticRelation } from '../src/types';

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

test('reported Sympathy corner: two distinct path/node overlaps legitimately give six points', () => {
  const input = fixture();
  const original = structuredClone(input);
  const result = calculateSemanticMoveScore(input);
  assert.deepEqual(result.edges.map(e => [e.baseScore, e.pathBonus, e.nodeBonus, e.total]), [[1, 1, 1, 3], [1, 1, 1, 3]]);
  assert.equal(result.total, 6);
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
  assert.deepEqual(result.edges.map(e => [e.pathBonus, e.nodeBonus, e.total]), [[0, 1, 2], [0, 1, 2]]);
  assert.equal(result.total, 4);
});
