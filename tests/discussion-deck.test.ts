import test from 'node:test';
import assert from 'node:assert/strict';
import { CARD_CATALOG, validateCardCatalog } from '../src/data/cardCatalog';
import { DISCUSSION_PLAY_CARDS, DISCUSSION_NEUTRAL_CARDS } from '../src/data/discussionCatalog';
import { DISCUSSION_DECK, EMOTIONS_DECK, getDeckDefinitionById, USER_SELECTABLE_DECKS } from '../src/data/deckDefinitions';
import { buildDeck, validateDeckDefinitions } from '../src/decks/deckBuilder';
import { initializeGame } from '../src/game';

const playingNames = [
  'Политика', 'Протест', 'Справедливость', 'Равенство', 'Неравенство', 'Легитимность',
  'Данные', 'Объективность', 'Интерпретация', 'Исследование', 'Экспертиза', 'Технология', 'Приватность',
  'Искусство', 'Традиция', 'Мировоззрение', 'Прогресс', 'Реформа', 'Устойчивость',
  'Идентичность', 'Цель', 'Привычка', 'Убеждение', 'Свобода', 'Зависимость',
  'Общение', 'Доверие', 'Солидарность', 'Сотрудничество', 'Договор', 'Сообщество', 'Дискриминация',
  'Труд', 'Производство', 'Собственность', 'Долг', 'Цена', 'Обмен',
].sort();
const neutralNames = [
  'Решение', 'Знание', 'Отношения', 'Культура', 'Изменение', 'Власть', 'Ценность', 'Общество',
].sort();

test('discussion deck exposes exactly the curated 38 playing cards and 8 separate neutral cards', () => {
  assert.ok(USER_SELECTABLE_DECKS.some((deck) => deck.id === DISCUSSION_DECK.id));
  assert.equal(getDeckDefinitionById('discussion'), DISCUSSION_DECK);
  assert.equal(DISCUSSION_DECK.name, 'Дискуссионная');
  assert.deepEqual(DISCUSSION_PLAY_CARDS.map((card) => card.name).sort(), playingNames);
  assert.deepEqual(DISCUSSION_NEUTRAL_CARDS.map((card) => card.name).sort(), neutralNames);
  assert.deepEqual(validateCardCatalog([...DISCUSSION_PLAY_CARDS, ...DISCUSSION_NEUTRAL_CARDS])
    .filter((issue) => issue.type !== 'missing-difficulty'), []);
  assert.deepEqual(validateDeckDefinitions([DISCUSSION_DECK], CARD_CATALOG), []);
  assert.deepEqual(buildDeck(CARD_CATALOG, DISCUSSION_DECK).cards.map((card) => card.name).sort(), playingNames);
  assert.ok(playingNames.every((name) => !neutralNames.includes(name)));
});

test('discussion games use the shared deck and preserve their own card snapshot', () => {
  const game = initializeGame(4, DISCUSSION_DECK, 0);
  assert.equal(game.sharedDeck?.length, 18);
  assert.deepEqual([...game.players.flatMap((player) => player.cards), ...game.sharedDeck!].sort(), playingNames);
  assert.ok(neutralNames.includes(game.startCard.cardName));
  assert.equal(game.startCard.playerId, null);
  assert.equal(game.deckSnapshot?.sourceDeckId, 'discussion');
  assert.deepEqual(game.deckSnapshot?.neutralCards?.map((card) => card.name).sort(), neutralNames);

  const savedSnapshot = JSON.parse(JSON.stringify(game.deckSnapshot));
  const restored = initializeGame(2, EMOTIONS_DECK, 0, savedSnapshot);
  assert.equal(restored.deckSnapshot?.sourceDeckId, 'discussion');
  assert.ok(neutralNames.includes(restored.startCard.cardName));
  assert.deepEqual([...restored.players.flatMap((player) => player.cards), ...restored.sharedDeck!].sort(), playingNames);
});
