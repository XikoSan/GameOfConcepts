const WIKTIONARY_API_URL = 'https://ru.wiktionary.org/w/api.php';
const WIKTIONARY_PAGE_URL = 'https://ru.wiktionary.org/wiki/';

export interface DictionarySearchResult {
  title: string;
  url: string;
  description?: string;
}

export interface DictionaryEntry {
  title: string;
  description: string | null;
  extract: string;
  url: string;
}

const lookupCache = new Map<string, DictionaryEntry | null>();
const entryCache = new Map<string, DictionaryEntry | null>();
const shortDescriptionCache = new Map<string, string | null>();

const normalizeDictionaryKey = (value: string) => value.trim().toLocaleLowerCase('ru-RU');

const getWiktionaryUrl = (title: string) =>
  `${WIKTIONARY_PAGE_URL}${encodeURIComponent(title.replaceAll(' ', '_'))}`;

export const getWiktionarySearchUrl = (term: string) => {
  const url = new URL('https://ru.wiktionary.org/w/index.php');
  url.searchParams.set('search', term.trim());
  return url.toString();
};

const compactText = (value: string) => value.replace(/\s+/g, ' ').trim();

function createWiktionaryUrl(params: Record<string, string>): URL {
  const url = new URL(WIKTIONARY_API_URL);
  Object.entries({
    format: 'json',
    origin: '*',
    ...params,
  }).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  return url;
}

async function fetchWiktionary<T>(
  params: Record<string, string>
): Promise<T> {
  const url = createWiktionaryUrl(params);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Викисловарь ответил с ошибкой ${response.status}.`);
  }

  return response.json() as Promise<T>;
}

export async function searchWiktionary(
  term: string
): Promise<DictionarySearchResult[]> {
  const normalizedTerm = term.trim();
  if (!normalizedTerm) return [];

  const data = await fetchWiktionary<[string, string[], string[], string[]]>(
    {
      action: 'opensearch',
      namespace: '0',
      limit: '5',
      search: normalizedTerm,
    }
  );
  const [, titles, descriptions, urls] = data;
  const results = titles.map((title, index) => ({
    title,
    description: descriptions[index] || undefined,
    url: urls[index] || getWiktionaryUrl(title),
  }));

  return results;
}

interface WiktionaryParseResponse {
  error?: {
    code?: string;
    info?: string;
  };
  parse?: {
    title?: string;
    displaytitle?: string;
    wikitext?: {
      '*': string;
    };
  };
}

async function parseWiktionaryPage(title: string): Promise<DictionaryEntry | null> {
  const normalizedTitle = title.trim();
  if (!normalizedTitle) return null;

  const cacheKey = normalizeDictionaryKey(normalizedTitle);
  if (entryCache.has(cacheKey)) {
    return entryCache.get(cacheKey) ?? null;
  }

  const data = await fetchWiktionary<WiktionaryParseResponse>(
    {
      action: 'parse',
      page: normalizedTitle,
      prop: 'wikitext|displaytitle',
    }
  );
  const wikitext = data.parse?.wikitext?.['*'] ?? '';

  if (data.error || !data.parse?.title || !wikitext.trim()) {
    entryCache.set(cacheKey, null);
    return null;
  }

  const description = extractRussianDefinitionFromWikitext(wikitext);

  const entry: DictionaryEntry = {
    title: data.parse.title,
    description,
    extract:
      description ??
      'Статья найдена, но краткое описание не удалось извлечь.',
    url: getWiktionaryUrl(data.parse.title),
  };
  entryCache.set(cacheKey, entry);

  return entry;
}

function getRussianSection(wikitext: string): string {
  const russianHeading = wikitext.match(/^==\s*Русский\s*==\s*$/im);
  if (!russianHeading?.index) return wikitext;

  const afterHeading = wikitext.slice(russianHeading.index + russianHeading[0].length);
  const nextLanguageHeadingIndex = afterHeading.search(/^==[^=].*==\s*$/im);

  return nextLanguageHeadingIndex === -1
    ? afterHeading
    : afterHeading.slice(0, nextLanguageHeadingIndex);
}

function getMeaningSection(wikitext: string): string {
  const meaningHeading = wikitext.match(/^={2,5}\s*Значение\s*={2,5}\s*$/im);
  if (!meaningHeading?.index) return wikitext;

  const afterHeading = wikitext.slice(meaningHeading.index + meaningHeading[0].length);
  const nextHeadingIndex = afterHeading.search(/^={2,5}[^=].*={2,5}\s*$/im);

  return nextHeadingIndex === -1 ? afterHeading : afterHeading.slice(0, nextHeadingIndex);
}

function stripTemplates(value: string): string {
  let result = value;

  for (let index = 0; index < 6; index += 1) {
    const nextResult = result.replace(/\{\{[^{}]*\}\}/g, '');
    if (nextResult === result) break;
    result = nextResult;
  }

  return result;
}

function cleanWikiDefinition(value: string): string {
  return compactText(
    stripTemplates(value)
      .replace(/<ref\b[^>]*>[\s\S]*?<\/ref>/gi, '')
      .replace(/<[^>]+>/g, '')
      .replace(/\[\[([^|\]]+)\|([^\]]+)\]\]/g, '$2')
      .replace(/\[\[([^\]]+)\]\]/g, '$1')
      .replace(/\[https?:\/\/[^\s\]]+\s?([^\]]*)\]/g, '$1')
      .replace(/'{2,}/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/^[:;*\s]+/, '')
      .replace(/\s+([,.;:!?])/g, '$1')
  );
}

export function extractRussianDefinitionFromWikitext(wikitext: string): string | null {
  const russianSection = getRussianSection(wikitext);
  const meaningSection = getMeaningSection(russianSection);
  const definitionLine =
    meaningSection
      .split('\n')
      .map((line) => line.trim())
      .find((line) => /^#(?![:*#])\s*\S/.test(line)) ??
    russianSection
      .split('\n')
      .map((line) => line.trim())
      .find((line) => /^#(?![:*#])\s*\S/.test(line));

  if (!definitionLine) return null;

  const definition = cleanWikiDefinition(definitionLine.replace(/^#+\s*/, ''));
  if (definition.length < 8) return null;

  return truncateDescription(definition, 260);
}

export async function getWiktionaryEntry(
  title: string
): Promise<DictionaryEntry | null> {
  return parseWiktionaryPage(title);
}

export async function lookupWiktionary(term: string): Promise<DictionaryEntry | null> {
  const normalizedTerm = term.trim();
  if (!normalizedTerm) return null;

  console.log('[wiktionary lookup start]', normalizedTerm);
  const cacheKey = normalizeDictionaryKey(normalizedTerm);
  if (lookupCache.has(cacheKey)) {
    const cachedEntry = lookupCache.get(cacheKey) ?? null;
    console.log('[wiktionary lookup result]', {
      title: cachedEntry?.title ?? null,
      hasDescription: Boolean(cachedEntry?.description),
      cached: true,
    });
    return cachedEntry;
  }

  try {
    const exactEntry = await parseWiktionaryPage(normalizedTerm);
    if (exactEntry) {
      lookupCache.set(cacheKey, exactEntry);
      console.log('[wiktionary lookup result]', {
        title: exactEntry.title,
        hasDescription: Boolean(exactEntry.description),
      });
      return exactEntry;
    }

    const [firstResult] = await searchWiktionary(normalizedTerm);
    if (!firstResult) {
      lookupCache.set(cacheKey, null);
      console.log('[wiktionary lookup result]', null);
      return null;
    }

    const entry = await parseWiktionaryPage(firstResult.title);
    lookupCache.set(cacheKey, entry);
    console.log('[wiktionary lookup result]', {
      title: entry?.title ?? null,
      hasDescription: Boolean(entry?.description),
    });

    return entry;
  } catch (error) {
    console.error('[wiktionary lookup failed]', error);
    throw error;
  }
}

function truncateDescription(value: string, maxLength = 210): string {
  const text = compactText(value);
  if (text.length <= maxLength) return text;

  const sentenceMatch = text.slice(0, maxLength).match(/^(.{80,}?[.!?])(\s|$)/);
  if (sentenceMatch) return sentenceMatch[1];

  return `${text.slice(0, maxLength).trim()}...`;
}

export async function getShortWiktionaryDescription(
  term: string
): Promise<string | null> {
  const normalizedTerm = term.trim();
  if (!normalizedTerm) return null;

  const cacheKey = normalizeDictionaryKey(normalizedTerm);
  if (shortDescriptionCache.has(cacheKey)) {
    return shortDescriptionCache.get(cacheKey) ?? null;
  }

  const entry = await lookupWiktionary(normalizedTerm);
  const description = entry?.description
    ? truncateDescription(entry.description, 210)
    : null;
  shortDescriptionCache.set(cacheKey, description);

  return description;
}
