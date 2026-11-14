import test from 'node:test';
import assert from 'node:assert/strict';
import { EMOTIONS_PLAY_CARDS, EMOTIONS_NEUTRAL_CARDS } from '../src/data/emotionsCatalog';
import { DISCUSSION_PLAY_CARDS, DISCUSSION_NEUTRAL_CARDS } from '../src/data/discussionCatalog';
import { CONCEPT_GLOSSARY, getConceptSummary, getLocalConceptSummary, getShortConceptDescription, normalizeConceptKey } from '../src/services/conceptDescriptionService';

test('every selectable playing and neutral card has an explicit offline glossary entry', () => {
  const cards = [...EMOTIONS_PLAY_CARDS, ...EMOTIONS_NEUTRAL_CARDS, ...DISCUSSION_PLAY_CARDS, ...DISCUSSION_NEUTRAL_CARDS];
  assert.equal(CONCEPT_GLOSSARY.length, cards.length);
  assert.equal(new Set(CONCEPT_GLOSSARY.map(entry => entry.definitionId)).size, cards.length);
  const byId = new Map(CONCEPT_GLOSSARY.map(entry => [entry.definitionId, entry]));
  for (const card of cards) {
    const entry = byId.get(card.id);
    assert.ok(entry, `Missing ${card.id} / ${card.name}`);
    assert.equal(entry.term, card.name);
    assert.ok(entry.definition.trim().length >= 35, `Empty definition for ${card.name}`);
    assert.ok(entry.sources.length, `No references for ${card.name}`);
    for (const source of entry.sources) {
      const url = new URL(source.url);
      assert.equal(url.protocol, 'https:');
      assert.ok(['ru.wiktionary.org', 'ru.wikipedia.org'].includes(url.hostname));
      assert.ok(url.pathname.startsWith('/wiki/') && url.pathname.length > 6);
      assert.equal(url.search, '', 'Reference must point at an explicit article, not a search');
    }
    const result = getLocalConceptSummary(card.name, card.id);
    assert.equal(result?.extract, entry.definition);
    assert.equal(getLocalConceptSummary(card.name)?.extract, entry.definition);
  }
});

test('glossary lookups cannot silently collide across aliases or normalized names', () => {
  const terms = new Map<string, string>();
  for (const entry of CONCEPT_GLOSSARY) for (const name of [entry.term, ...(entry.aliases ?? [])]) {
    const key = normalizeConceptKey(name);
    assert.ok(!terms.has(key) || terms.get(key) === entry.definitionId, `Ambiguous glossary name: ${name}`);
    terms.set(key, entry.definitionId);
  }
  assert.deepEqual(getLocalConceptSummary('  УВЛЕЧЕННОСТЬ  '), getLocalConceptSummary('Увлечённость'));
  assert.equal(getLocalConceptSummary('Новое название из снимка', 'discussion-neutral-power')?.title, 'Власть');
});

test('all glossary definitions work offline and unknown words never trigger a search fallback', async () => {
  const originalFetch = globalThis.fetch;
  let requests = 0;
  globalThis.fetch = async () => { requests++; throw Error('Offline'); };
  try {
    for (const entry of CONCEPT_GLOSSARY) assert.equal((await getConceptSummary(entry.term))?.extract, entry.definition);
    for (const term of ['', '   ', 'Бодрость (фильм)', 'Неизвестное понятие xyz']) assert.equal(await getConceptSummary(term), null);
    assert.ok((await getConceptSummary('Бодрость'))?.extract);
    assert.ok((await getConceptSummary('Увлечённость'))?.extract);
    assert.ok((await getShortConceptDescription('Бодрость'))!.length <= 211);
    assert.equal(requests, 0);
  } finally { globalThis.fetch = originalFetch; }
});
