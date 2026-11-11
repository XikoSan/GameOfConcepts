import test from 'node:test';
import assert from 'node:assert/strict';
import { initializeGame, placeCard, upsertPendingSemanticEdge, submitPendingSemanticMove, confirmPendingCard } from '../src/game';
import { buildMatchStatistics } from '../src/statistics/buildMatchStatistics';
import { getRelationPresets } from '../src/scoring/semanticRelations';
import type { GameState, PlacedCard, SemanticEdge, SemanticEdgeScore, SemanticRelation } from '../src/types';

const kind: SemanticRelation = { family: 'kind', fromRole: 'kind', toRole: 'general' };
const opposite: SemanticRelation = { family: 'opposite', symmetric: true };
const part: SemanticRelation = { family: 'part', fromRole: 'part', toRole: 'whole' };

function card(id: string, name: string, playerId: number | null, x: number, y: number): PlacedCard {
  return { id, cardName: name, playerId, coordinates: { x, y }, status: 'confirmed', connections: [] };
}

function fixture(count = 2): GameState {
  const game = initializeGame(count, undefined, 0);
  const n = card('neutral', 'Основа', null, 0, 0);
  const a = card('a', 'Повтор', 0, 1, 0);
  const b = card('b', 'Второе', 1, 0, 1);
  const c = card('c', 'Повтор', 0, 1, 1);
  const d = card('d', 'Четвёртое', 1, 2, 1);
  game.board = Object.fromEntries([n, a, b, c, d].map((item) => [`${item.coordinates.x},${item.coordinates.y}`, item]));
  game.startCard = n;
  game.deckSnapshot = undefined;
  game.semanticEdges = [];
  game.logDetails = {};
  game.log = [];
  game.scores = Array(count).fill(0);
  const addMove = (logIndex: number, placed: PlacedCard, relations: [PlacedCard, SemanticRelation, 0 | 1, 0 | 1][]) => {
    const awards: SemanticEdgeScore[] = [];
    for (const [index, [neighbor, relation, pathBonus, nodeBonus]] of relations.entries()) {
      const edge: SemanticEdge = { id: `e${logIndex}-${index}`, fromCardInstanceId: placed.id,
        toCardInstanceId: neighbor.id, fromPosition: placed.coordinates, toPosition: neighbor.coordinates,
        relation, createdBySeatIndex: placed.playerId!, createdAtMoveId: `m${logIndex}`, createdOrder: index };
      game.semanticEdges!.push(edge);
      awards.push({ pendingEdgeId: edge.id, baseScore: 1, pathBonus, nodeBonus,
        total: (1 + pathBonus + nodeBonus) as 1 | 2 | 3, continuesPath: !!pathBonus, continuesNode: !!nodeBonus });
    }
    const total = awards.reduce((sum, award) => sum + award.total, 0);
    game.scores[placed.playerId!] += total;
    game.logDetails![logIndex] = { score: { playerId: placed.playerId!, cardName: placed.cardName,
      totalGained: total, newTotalScore: game.scores[placed.playerId!], edgeCount: awards.length,
      semanticScore: { edges: awards, total } }, relations: ['Сохранённое описание'] };
    game.log.push('Принятый ход');
  };
  addMove(0, a, [[n, kind, 0, 0]]);
  addMove(2, b, [[n, part, 0, 0]]);
  addMove(4, c, [[a, kind, 1, 0], [b, opposite, 0, 0]]);
  addMove(7, d, [[c, opposite, 1, 1]]);
  game.gameOver = true;
  return game;
}

test('statistics: complete history preserves recorded bonuses, tied best moves and stable seat ownership', () => {
  const game = fixture(4);
  const original = structuredClone(game);
  const result = buildMatchStatistics(game);
  assert.equal(result.graphAvailable, true);
  assert.equal(result.historyAvailable, true);
  assert.equal(result.moveCount, 4);
  assert.equal(result.edgeCount, 5);
  assert.equal(result.pathBonus, 2);
  assert.equal(result.nodeBonus, 1);
  assert.deepEqual(result.bestMoves.map((move) => move.logIndex), [4, 7]);
  assert.deepEqual(result.bestMoves.map((move) => [move.base, move.pathBonus, move.nodeBonus]), [[2, 1, 0], [1, 1, 1]]);
  assert.deepEqual(result.players.map((player) => player.moveCount), [2, 2, 0, 0]);
  assert.deepEqual(result.players.map((player) => player.edgeCount), [3, 2, 0, 0]);
  assert.deepEqual(result.players[0].favoriteFamilies, ['kind']);
  assert.deepEqual(result.players[1].favoriteFamilies, ['part', 'opposite']);
  assert.deepEqual(result.players[2].favoriteFamilies, []);
  assert.equal(result.players[2].pathBonus, 0);
  assert.match(result.bestMoves[0].relations[0], /Повтор — вид Повтор/);
  assert.deepEqual(game, original, 'the selector must not mutate the saved match');
});

test('statistics: central cards use instance ids and include the neutral card with stable tie ordering', () => {
  const game = fixture();
  const first = buildMatchStatistics(game);
  assert.deepEqual(first.centralCards.map((item) => item.id), ['c']);
  assert.equal(first.centralCards[0].edgeCount, 3);
  delete game.board['2,1'];
  game.semanticEdges!.pop();
  delete game.logDetails![7];
  game.scores[1] = 1;
  const tied = buildMatchStatistics(game);
  assert.equal(tied.historyAvailable, true);
  assert.deepEqual(tied.centralCards.map((item) => item.id), ['neutral', 'a', 'b', 'c']);
  assert.equal(tied.centralCards[0].ownerSeatIndex, null);
  assert.deepEqual(tied.centralCards.filter((item) => item.name === 'Повтор').map((item) => item.id), ['a', 'c']);
});

test('statistics: modern empty matches expose real zeros without inventing winners', () => {
  for (const count of [2, 3, 4]) {
    const result = buildMatchStatistics(initializeGame(count, undefined, 0));
    assert.equal(result.graphAvailable, true);
    assert.equal(result.historyAvailable, true);
    assert.equal(result.moveCount, 0);
    assert.equal(result.edgeCount, 0);
    assert.equal(result.pathBonus, 0);
    assert.equal(result.nodeBonus, 0);
    assert.deepEqual(result.bestMoves, []);
    assert.deepEqual(result.centralCards, []);
    assert.ok(result.relations.every((relation) => relation.count === 0));
  }
});

test('statistics: legacy saves without graph or history expose unknown bonuses and edges', () => {
  for (const game of [fixture(), initializeGame(2, undefined, 0)]) {
    delete game.semanticEdges;
    delete game.logDetails;
    const result = buildMatchStatistics(game);
    assert.equal(result.graphAvailable, false);
    assert.equal(result.historyAvailable, false);
    assert.equal(result.edgeCount, null);
    assert.equal(result.pathBonus, null);
    assert.equal(result.nodeBonus, null);
    assert.deepEqual(result.bestMoves, []);
    assert.deepEqual(result.centralCards, []);
    assert.ok(result.players.every((player) => player.edgeCount === null && player.pathBonus === null));
  }
});

for (const missing of ['all history', 'one move', 'one award', 'one card', 'score', 'running score', 'owner', 'card name', 'move group', 'duplicate award', 'bonus'] as const) {
  test(`statistics: incomplete ${missing} hides historical awards while keeping the valid graph`, () => {
    const game = fixture();
    const detail = game.logDetails![4].score;
    switch (missing) {
      case 'all history': delete game.logDetails; break;
      case 'one move': delete game.logDetails![2]; break;
      case 'one award': detail.semanticScore!.edges.pop(); break;
      case 'one card': delete game.logDetails![7]; game.scores[1] = 1; break;
      case 'score': game.scores[0]++; break;
      case 'running score': detail.newTotalScore++; break;
      case 'owner': detail.playerId = 1; break;
      case 'card name': detail.cardName = 'Другая карта'; break;
      case 'move group': game.semanticEdges![3].createdAtMoveId = 'm7'; break;
      case 'duplicate award': detail.semanticScore!.edges.push(detail.semanticScore!.edges[0]); break;
      case 'bonus': detail.semanticScore!.edges[0].pathBonus = undefined as unknown as 0; break;
    }
    const result = buildMatchStatistics(game);
    assert.equal(result.graphAvailable, true);
    assert.equal(result.historyAvailable, false);
    assert.equal(result.edgeCount, 5);
    assert.equal(result.pathBonus, null);
    assert.deepEqual(result.bestMoves, []);
    assert.ok(result.players.every((player) => player.nodeBonus === null));
  });
}

test('statistics: exact duplicate edges and reversed symmetric duplicates are counted once', () => {
  const game = fixture();
  game.semanticEdges!.push(structuredClone(game.semanticEdges![0]));
  const symmetric = game.semanticEdges![3];
  game.semanticEdges!.push({ ...symmetric, id: 'reverse-duplicate',
    createdOrder: 99,
    fromCardInstanceId: symmetric.toCardInstanceId, toCardInstanceId: symmetric.fromCardInstanceId,
    fromPosition: symmetric.toPosition, toPosition: symmetric.fromPosition });
  const result = buildMatchStatistics(game);
  assert.equal(result.graphAvailable, true);
  assert.equal(result.historyAvailable, true);
  assert.equal(result.edgeCount, 5);
  assert.equal(result.relations.find((relation) => relation.family === 'opposite')!.count, 2);
  assert.equal(result.centralCards[0].edgeCount, 3);
});

test('statistics: logical duplicate edges cannot be reassigned to another move or author', () => {
  for (const changed of [{ createdAtMoveId: 'another-move' }, { createdBySeatIndex: 1 }]) {
    const game = fixture();
    const symmetric = game.semanticEdges![3];
    game.semanticEdges!.push({ ...symmetric, id: 'other-copy', ...changed });
    const result = buildMatchStatistics(game);
    assert.equal(result.graphAvailable, false);
    assert.equal(result.edgeCount, null);
  }
});

test('statistics: extra score slots do not make phantom player authors valid', () => {
  const game = fixture();
  game.scores.push(0);
  game.semanticEdges![0].createdBySeatIndex = 2;
  assert.equal(buildMatchStatistics(game).graphAvailable, false);
  assert.equal(buildMatchStatistics(game).players.length, 2);
});

for (const broken of ['author', 'foreign author', 'endpoint', 'pending endpoint', 'conflicting id', 'relation', 'geometry', 'missing edge', 'duplicate card id'] as const) {
  test(`statistics: invalid graph ${broken} does not produce misleading metrics`, () => {
    const game = fixture();
    switch (broken) {
      case 'author': game.semanticEdges![0].createdBySeatIndex = 90; break;
      case 'foreign author': game.semanticEdges![0].createdBySeatIndex = 1; break;
      case 'endpoint': game.semanticEdges![0].toCardInstanceId = 'missing'; break;
      case 'pending endpoint': game.board['1,0'].status = 'pending'; break;
      case 'conflicting id': game.semanticEdges!.push({ ...game.semanticEdges![0], relation: part }); break;
      case 'relation': game.semanticEdges![0].relation = { family: 'old-cross' } as unknown as SemanticRelation; break;
      case 'geometry': game.semanticEdges![0].fromPosition = { x: 90, y: 90 }; break;
      case 'missing edge': game.semanticEdges!.splice(0, 1); break;
      case 'duplicate card id': game.board['1,0'].id = 'b'; break;
    }
    const result = buildMatchStatistics(game);
    assert.equal(result.graphAvailable, false);
    assert.equal(result.historyAvailable, false);
    assert.equal(result.edgeCount, null);
    assert.deepEqual(result.relations, []);
    assert.deepEqual(result.centralCards, []);
  });
}

test('statistics: pending cards, pass logs and finish votes do not count as accepted moves', () => {
  const game = fixture();
  game.board['3,1'] = { ...card('pending', 'Ожидает', 0, 3, 1), status: 'pending' };
  game.log.push('Пас', 'Голосование о завершении');
  const result = buildMatchStatistics(game);
  assert.equal(result.historyAvailable, true);
  assert.equal(result.moveCount, 4);
});

test('statistics: deck relation availability determines the displayed family rows', () => {
  const game = initializeGame(2, undefined, 0);
  game.deckSnapshot = { sourceDeckId: 'test', cardDefinitionIds: [], relationFamilies: ['opposite', 'kind'] };
  assert.deepEqual(buildMatchStatistics(game).relations.map((item) => item.family), ['opposite', 'kind']);
  game.scores[0] = 1;
  assert.equal(buildMatchStatistics(game).historyAvailable, false, 'missing points are not a zero historical bonus');
});

test('statistics: a real accepted move round-trips local and serialized online state', () => {
  let game = initializeGame(3, undefined, 0);
  game = placeCard(game, game.players[0].cards[0], { x: 8, y: 7 });
  game = upsertPendingSemanticEdge(game, game.startCard.id, getRelationPresets(game.deckSnapshot)[0], 'new-to-neighbor');
  game = confirmPendingCard(submitPendingSemanticMove(game));
  const result = buildMatchStatistics(game);
  assert.equal(result.historyAvailable, true);
  assert.equal(result.moveCount, 1);
  assert.equal(result.edgeCount, 1);
  assert.equal(result.bestMoves[0].total, game.scores[0]);
  assert.deepEqual(buildMatchStatistics(JSON.parse(JSON.stringify(game))), result);
});
