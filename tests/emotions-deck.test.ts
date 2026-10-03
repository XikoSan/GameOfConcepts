import test from 'node:test';
import assert from 'node:assert/strict';
import { CARD_CATALOG } from '../src/data/cardCatalog';
import { EMOTIONS_PLAY_CARDS, EMOTIONS_NEUTRAL_CARDS } from '../src/data/emotionsCatalog';
import { DEFAULT_DECK, EMOTIONS_DECK, USER_SELECTABLE_DECKS, DECK_DEFINITIONS, MIXED_ALL_DECK } from '../src/data/deckDefinitions';
import { buildDeck, validateDeckDefinitions } from '../src/decks/deckBuilder';
import { initializeGame, createPlayerDeckFromSnapshot, placeCard, upsertPendingSemanticEdge, submitPendingSemanticMove, confirmPendingCard } from '../src/game';
import { getRelationPresets, isSymmetricRelation, hasSupportedGameRelations } from '../src/scoring/semanticRelations';
import { calculateSemanticMoveScore } from '../src/scoring/calculateSemanticMoveScore';
import type { GameState, PlacedCard, SemanticEdge, SemanticRelation } from '../src/types';

const neutralNames = ["Переживание", "Состояние", "Реакция", "Чувство", "Эмоция"].sort();
const playingNames = ["Безнадёжность", "Безразличие", "Безутешность", "Бодрость", "Веселье", "Вздох", "Волнение", "Воодушевление", "Вялость", "Гнев", "Горе", "Грусть", "Дрожь", "Дружелюбие", "Интерес", "Испуг", "Истома", "Крик", "Ласка", "Любовь", "Надежда", "Напряжение", "Наслаждение", "Настроение", "Нежность", "Ненависть", "Неприязнь", "Неудовольствие", "Облегчение", "Объятие", "Отношение", "Отчаяние", "Ощущение", "Плач", "Подавленность", "Поцелуй", "Привязанность", "Приподнятость", "Радость", "Разбитость", "Раздражение", "Симпатия", "Скука", "Слёзы", "Смех", "Сострадание", "Спокойствие", "Страдание", "Страх", "Тревога", "Увлечённость", "Удовольствие", "Ужас", "Улыбка", "Умиление", "Уныние", "Усталость"].sort();

test('Revised catalog is separate; all existing standard decks keep their composition', () => {
  assert.equal(CARD_CATALOG.length, 60);
  assert.ok(!USER_SELECTABLE_DECKS.some(d => d.id === 'mixed-all'));
  assert.equal(initializeGame().deckSnapshot?.sourceDeckId, DEFAULT_DECK.id);
  assert.equal(EMOTIONS_PLAY_CARDS.length, 57);
  assert.deepEqual(USER_SELECTABLE_DECKS.map(d => d.id), ["emotions"]);
  assert.deepEqual(validateDeckDefinitions(DECK_DEFINITIONS, CARD_CATALOG), []);
  assert.deepEqual(buildDeck(CARD_CATALOG, EMOTIONS_DECK).cards.map(c => c.name).sort(), playingNames);
  assert.deepEqual(EMOTIONS_NEUTRAL_CARDS.map(c => c.name).sort(), neutralNames);
  assert.ok(playingNames.every(name => !neutralNames.includes(name)));
  for (const [id, expected] of [['medium', 40], ['hard', 20], ['mixed-all', 60]] as const) {
    const def = DECK_DEFINITIONS.find(d => d.id === id)!;
    const deck = buildDeck(CARD_CATALOG, def);
    assert.equal(deck.totalCards, expected);
    assert.ok(deck.cardDefinitionIds.every(id => !id.startsWith('emotion-')));
  }
});

test('two to four players each receive a complete personal deck and a dedicated neutral start', () => {
  const seen = new Set<string>();
  for (let i = 0; i < 80; i++) {
    const count = 2 + i % 3;
    const state = initializeGame(count, EMOTIONS_DECK);
    seen.add(state.startCard.cardName);
    assert.ok(neutralNames.includes(state.startCard.cardName));
    assert.equal(state.startCard.playerId, null);
    assert.equal(Object.keys(state.board).length, 1);
    assert.equal(state.players.length, count);
    for (let p = 0; p < count; p++) {
      assert.equal(state.players[p].cards.length, 5);
      assert.equal(state.deck[p].length, 52);
      assert.deepEqual([...state.players[p].cards, ...state.deck[p]].sort(), playingNames);
    }
  }
  assert.ok(seen.size > 1);
});

test('snapshots survive JSON serialization, new joins, and starting an online lobby', () => {
  const original = initializeGame(2, EMOTIONS_DECK);
  const snapshot = JSON.parse(JSON.stringify(original.deckSnapshot));
  // Simulate a changed catalog: saved names, not current catalog metadata, remain authoritative.
  snapshot.cards[0].name = 'Сохранённое понятие';
  const joined = createPlayerDeckFromSnapshot(snapshot, 3)!;
  assert.equal(joined.player.playerId, 3);
  assert.ok([...joined.player.cards, ...joined.deck].includes('Сохранённое понятие'));
  const started = initializeGame(4, MIXED_ALL_DECK, 2, snapshot);
  assert.equal(started.currentPlayerIndex, 2);
  assert.equal(started.deckSnapshot?.sourceDeckId, 'emotions');
  assert.deepEqual(started.deckSnapshot?.relationFamilies, EMOTIONS_DECK.relationFamilies);
  assert.ok(neutralNames.includes(started.startCard.cardName));
  assert.equal(started.deckSnapshot?.cards?.[0].name, 'Сохранённое понятие');
  assert.notEqual(started.deckSnapshot?.cards?.[0], snapshot.cards[0]);
  const classic = initializeGame(2, MIXED_ALL_DECK);
  const legacy = { sourceDeckId: 'mixed-all', cardDefinitionIds: classic.deckSnapshot!.cardDefinitionIds };
  assert.equal(getRelationPresets(legacy).length, 5);
  assert.equal(createPlayerDeckFromSnapshot(legacy, 2)!.deck.length, 55);
});

function pending(state: GameState): GameState {
  return placeCard(state, state.players[0].cards[0], { x: 8, y: 7 });
}

test('retired relations and malformed roles are rejected', () => {
  const state = pending(initializeGame(2, EMOTIONS_DECK, 0));
  assert.ok(hasSupportedGameRelations(state));
  const presets = getRelationPresets(state.deckSnapshot);
  assert.equal(presets.length, 5);
  const cause = presets.find(r => r.family === 'cause')!;
  const malformed = { ...cause, fromRole: 'property', toRole: 'property-bearer' } as SemanticRelation;
  assert.equal(upsertPendingSemanticEdge(state, state.startCard.id, malformed, 'new-to-neighbor'), state);
  const good = upsertPendingSemanticEdge(state, state.startCard.id, cause, 'new-to-neighbor');
  const bad = structuredClone(good);
  bad.pendingMove!.semanticEdges![0].relation = malformed;
  assert.equal(submitPendingSemanticMove(bad), bad);
  assert.equal(hasSupportedGameRelations(bad), false);
  bad.pendingMove!.semanticStatus = 'voting';
  assert.equal(confirmPendingCard(bad), bad);
  const retired = structuredClone(state);
  retired.deckSnapshot!.sourceDeckId = 'everyday';
  assert.equal(hasSupportedGameRelations(retired), false);
  retired.deckSnapshot!.sourceDeckId = 'emotions';
  retired.deckSnapshot!.relationFamilies = ['helps'] as unknown as NonNullable<GameState['deckSnapshot']>['relationFamilies'];
  assert.equal(hasSupportedGameRelations(retired), false);
});

test('all five types can be configured on a pending move, accepted, scored and logged', () => {
  for (const relation of getRelationPresets(initializeGame(2, EMOTIONS_DECK).deckSnapshot)) {
    let state = pending(initializeGame(2, EMOTIONS_DECK, 0));
    state = upsertPendingSemanticEdge(state, state.startCard.id, relation, 'new-to-neighbor');
    assert.equal(state.pendingMove!.scorePreview!.total, 1);
    state = confirmPendingCard(submitPendingSemanticMove(state));
    assert.equal(state.pendingMove, null);
    assert.equal(state.scores[0], 1);
    assert.equal(state.players[0].cards.length, 5);
    assert.equal(state.semanticEdges![0].relation.family, relation.family);
    assert.ok(Object.values(state.board).filter(c => c.playerId !== null).every(c => c.definitionId?.startsWith('emotion-')));
    assert.ok(state.log.length > 0);
  }
});

function card(id: string, x: number, y: number, owner: number | null = 0): PlacedCard {
  return { id, cardName: id, coordinates: { x, y }, playerId: owner, status: 'confirmed', connections: [] };
}
function edge(a: PlacedCard, b: PlacedCard, relation: SemanticRelation): SemanticEdge {
  return { id: a.id + b.id, fromCardInstanceId: a.id, toCardInstanceId: b.id, fromPosition: a.coordinates,
    toPosition: b.coordinates, relation, createdBySeatIndex: 0, createdAtMoveId: 'old', createdOrder: 0 };
}
function score(relation: SemanticRelation, neutralCenter = false) {
  const a = card('a', 0, 0), b = card('b', 1, 0, neutralCenter ? null : 0);
  const n = card('n', 1, 1), c = card('c', 2, 0);
  const board = Object.fromEntries([a,b,n,c].map(c => [`${c.coordinates.x},${c.coordinates.y}`, c]));
  return calculateSemanticMoveScore({ board, existingEdges: [edge(a,b,relation), edge(b,n,relation)], activeSeatIndex: 0,
    pendingMove: { moveId: 'new', cardId: c.id, position: c.coordinates, placedBySeatIndex: 0,
      semanticEdges: [{ id: 'pending', neighborCardInstanceId: b.id, neighborPosition: b.coordinates, relation,
        direction: 'neighbor-to-new', createdOrder: 0 }] } });
}

test('classic families keep path and node direction semantics and the +3 cap', () => {
  for (const relation of getRelationPresets(initializeGame(2, EMOTIONS_DECK).deckSnapshot)) {
    const result = score(relation);
    assert.equal(result.total, 3, relation.family);
    assert.equal(result.edges[0].pathBonus, 1);
    assert.equal(result.edges[0].nodeBonus, 1);
    const withNeutral = score(relation, true);
    assert.equal(withNeutral.edges[0].pathBonus, 0);
    assert.equal(withNeutral.edges[0].nodeBonus, 1);
  }
  const opposite = getRelationPresets().find(r => r.family === 'opposite')!;
  assert.ok(isSymmetricRelation(opposite));
});
