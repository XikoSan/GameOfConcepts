import { EMOTIONS_GLOSSARY } from '../data/glossaryEmotions';
import { DISCUSSION_GLOSSARY } from '../data/glossaryDiscussion';
import type { GlossaryEntry } from '../data/glossaryTypes';

export interface ConceptSummary {
  title: string;
  extract: string;
  additionalMeanings: readonly string[];
  sources: GlossaryEntry['sources'];
  source: 'glossary';
}

export const CONCEPT_GLOSSARY: readonly GlossaryEntry[] = [...EMOTIONS_GLOSSARY, ...DISCUSSION_GLOSSARY];
export const normalizeConceptKey = (value: string) => value.normalize('NFC').trim().toLocaleLowerCase('ru-RU').replaceAll('ё', 'е').replace(/\s+/g, ' ');
const byId = new Map(CONCEPT_GLOSSARY.map(entry => [entry.definitionId, entry]));
const byName = new Map(CONCEPT_GLOSSARY.flatMap(entry =>
  [entry.term, ...(entry.aliases ?? [])].map(name => [normalizeConceptKey(name), entry] as const)));

export function getWikipediaSearchUrl(term: string) {
  const url = new URL('https://ru.wikipedia.org/w/index.php');
  url.searchParams.set('search', term.trim());
  return url.toString();
}

export function getLocalConceptSummary(term: string, definitionId?: string): ConceptSummary | null {
  // Saved cards use stable ids; names also support free lookup and older snapshots.
  const entry = (definitionId ? byId.get(definitionId) : undefined) ?? byName.get(normalizeConceptKey(term));
  return entry ? {
    title: entry.term, extract: entry.definition, additionalMeanings: entry.meanings ?? [],
    sources: entry.sources, source: 'glossary',
  } : null;
}

// Keep the async API for callers with cancellation guards. No network request is needed.
export async function getConceptSummary(term: string, definitionId?: string): Promise<ConceptSummary | null> {
  return getLocalConceptSummary(term, definitionId);
}

export async function getShortConceptDescription(term: string): Promise<string | null> {
  const summary = getLocalConceptSummary(term);
  if (!summary) return null;
  const text = summary.extract.replace(/\s+/g, ' ').trim();
  if (text.length <= 210) return text;
  const sentence = text.slice(0, 210).match(/^(.{40,}?[.!?])(?:\s|$)/);
  return sentence?.[1] ?? `${text.slice(0, 210).trim()}…`;
}
