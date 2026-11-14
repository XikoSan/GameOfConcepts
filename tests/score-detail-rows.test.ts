import test from 'node:test';
import assert from 'node:assert/strict';
import type { SemanticEdgeScore, SemanticScoreCard, SemanticScoreExplanation } from '../src/types';
import { getScoreDetailRows } from '../src/components/scoreDetailRows';

const card = (id: string): SemanticScoreCard => ({ id, name: id, ownerSeatIndex: 0 });
const edge = (id: string, from: string, to: string) => ({ id, from: card(from), to: card(to),
  relation: { family: 'cause', fromRole: 'cause', toRole: 'effect' } as const, label: `${from} → ${to}` });
const award = (id: string, explanation?: SemanticScoreExplanation): SemanticEdgeScore => ({
  pendingEdgeId: id, baseScore: 1, pathBonus: 1, nodeBonus: 1, total: 3,
  continuesPath: true, continuesNode: true, explanation,
});

test('compact score rows retain each award, actual directed paths and converging/diverging node arrows', () => {
  for (const direction of ['toward-center', 'from-center', 'symmetric'] as const) {
    const first = edge('first', 'Симпатия', 'Улыбка');
    const previous = edge('previous', 'Улыбка', 'Веселье');
    const explanation: SemanticScoreExplanation = { version: 1, edge: first, relation: first.label,
      path: { cards: [first.from, first.to, previous.to], edges: [first, previous], sharedCardId: 'Улыбка' },
      node: { center: card('Симпатия'), outerCards: [card('Улыбка'), card('Воодушевление')],
        direction, edges: [first, edge('second', 'Симпатия', 'Воодушевление')] } };
    const rows = getScoreDetailRows([award('first', explanation)]);
    assert.deepEqual(rows.map(row => row.kind), ['Связь', 'Путь', 'Узел']);
    assert.equal(rows.reduce((total, row) => total + row.points, 0), 3);
    assert.deepEqual(rows[0].cards?.map(value => value.name), ['Симпатия', 'Улыбка']);
    assert.deepEqual(rows[1].cards?.map(value => value.name), ['Симпатия', 'Улыбка', 'Веселье']);
    assert.deepEqual(rows[1].arrows, ['→', '→']);
    assert.deepEqual(rows[2].cards?.map(value => value.name), ['Улыбка', 'Симпатия', 'Воодушевление']);
    assert.deepEqual(rows[2].arrows, direction === 'toward-center' ? ['→', '←'] : direction === 'from-center' ? ['←', '→'] : ['↔', '↔']);
  }
});

test('compact rows omit zero bonuses but retain unknown historical bonuses without fabricated cards', () => {
  const ordinary = { ...award('ordinary'), pathBonus: 0 as const, nodeBonus: 0 as const, total: 1 as const };
  const rows = getScoreDetailRows([ordinary, award('legacy')], ['Смех — причина Радость', 'Симпатия — причина Улыбка']);
  assert.deepEqual(rows.map(row => row.kind), ['Связь', 'Связь', 'Путь', 'Узел']);
  assert.equal(rows.reduce((sum, row) => sum + row.points, 0), 4);
  assert.equal(rows[0].fallback, 'Смех — причина Радость');
  assert.ok(rows.every(row => row.cards === undefined));
  assert.match(rows[2].fallback!, /не сохранились/);
  assert.match(rows[3].fallback!, /не сохранились/);
});

test('symmetric relation and path remain bidirectional in compact rows', () => {
  const first = { ...edge('a-b', 'A', 'B'), relation: { family: 'opposite', symmetric: true } as const };
  const next = { ...edge('b-c', 'B', 'C'), relation: first.relation };
  const rows = getScoreDetailRows([award('a-b', { version: 1, edge: first, relation: first.label,
    path: { cards: [first.from, first.to, next.to], edges: [first, next], sharedCardId: 'B' } })]);
  assert.deepEqual(rows[0].arrows, ['↔']);
  assert.deepEqual(rows[1].arrows, ['↔', '↔']);
});
