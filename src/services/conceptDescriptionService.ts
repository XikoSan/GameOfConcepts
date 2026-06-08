const WIKIPEDIA_SUMMARY_URL = 'https://ru.wikipedia.org/api/rest_v1/page/summary/';
const WIKIPEDIA_API_URL = 'https://ru.wikipedia.org/w/api.php';
const WIKIPEDIA_SEARCH_URL = 'https://ru.wikipedia.org/w/index.php';

export interface ConceptSummary {
  title: string;
  extract: string;
  url: string;
  source: 'wikipedia';
}

const summaryCache = new Map<string, ConceptSummary | null>();
const shortDescriptionCache = new Map<string, string | null>();

const normalizeConceptKey = (value: string) => value.trim().toLocaleLowerCase('ru-RU');

const compactText = (value: string) => value.replace(/\s+/g, ' ').trim();

export const getWikipediaSearchUrl = (term: string) => {
  const url = new URL(WIKIPEDIA_SEARCH_URL);
  url.searchParams.set('search', term.trim());
  return url.toString();
};

function truncateDescription(value: string, maxLength = 210): string {
  const text = compactText(value);
  if (text.length <= maxLength) return text;

  const sentenceMatch = text.slice(0, maxLength).match(/^(.{80,}?[.!?])(\s|$)/);
  if (sentenceMatch) return sentenceMatch[1];

  return `${text.slice(0, maxLength).trim()}...`;
}

async function fetchWikipediaSummary(title: string): Promise<ConceptSummary | null> {
  const response = await fetch(`${WIKIPEDIA_SUMMARY_URL}${encodeURIComponent(title)}`);
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`Wikipedia ответила с ошибкой ${response.status}.`);
  }

  const data = (await response.json()) as {
    title?: string;
    extract?: string;
    content_urls?: {
      desktop?: {
        page?: string;
      };
    };
  };

  if (!data.title || !data.extract?.trim()) return null;

  return {
    title: data.title,
    extract: compactText(data.extract),
    url:
      data.content_urls?.desktop?.page ??
      `https://ru.wikipedia.org/wiki/${encodeURIComponent(data.title.replaceAll(' ', '_'))}`,
    source: 'wikipedia',
  };
}

async function searchWikipedia(term: string): Promise<string | null> {
  const url = new URL(WIKIPEDIA_API_URL);
  Object.entries({
    action: 'opensearch',
    format: 'json',
    origin: '*',
    namespace: '0',
    limit: '5',
    search: term,
  }).forEach(([key, value]) => url.searchParams.set(key, value));

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Wikipedia search ответил с ошибкой ${response.status}.`);
  }

  const [, titles] = (await response.json()) as [string, string[], string[], string[]];
  return titles[0] ?? null;
}

export async function getConceptSummary(term: string): Promise<ConceptSummary | null> {
  const normalizedTerm = term.trim();
  if (!normalizedTerm) return null;

  console.log('[concept summary start]', normalizedTerm);
  const cacheKey = normalizeConceptKey(normalizedTerm);
  if (summaryCache.has(cacheKey)) {
    return summaryCache.get(cacheKey) ?? null;
  }

  const exactSummary = await fetchWikipediaSummary(normalizedTerm);
  if (exactSummary) {
    console.log('[concept summary result]', {
      title: exactSummary.title,
      hasExtract: true,
      source: exactSummary.source,
    });
    summaryCache.set(cacheKey, exactSummary);
    return exactSummary;
  }

  const fallbackTitle = await searchWikipedia(normalizedTerm);
  const fallbackSummary = fallbackTitle
    ? await fetchWikipediaSummary(fallbackTitle)
    : null;

  console.log(
    '[concept summary result]',
    fallbackSummary
      ? {
          title: fallbackSummary.title,
          hasExtract: true,
          source: fallbackSummary.source,
        }
      : null
  );
  summaryCache.set(cacheKey, fallbackSummary);

  return fallbackSummary;
}

export async function getShortConceptDescription(term: string): Promise<string | null> {
  const normalizedTerm = term.trim();
  if (!normalizedTerm) return null;

  const cacheKey = normalizeConceptKey(normalizedTerm);
  if (shortDescriptionCache.has(cacheKey)) {
    return shortDescriptionCache.get(cacheKey) ?? null;
  }

  const summary = await getConceptSummary(normalizedTerm);
  const description = summary ? truncateDescription(summary.extract) : null;
  shortDescriptionCache.set(cacheKey, description);

  return description;
}
