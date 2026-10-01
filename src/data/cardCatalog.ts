export type CardDifficulty = 'easy' | 'medium' | 'hard';

export interface CardDefinition {
  id: string;
  name: string;
  description?: string;
  image?: string;
  difficulty?: CardDifficulty;
  enabled?: boolean;
}

export interface CatalogValidationIssue {
  type:
    | 'duplicate-id'
    | 'duplicate-name'
    | 'empty-id'
    | 'empty-name'
    | 'missing-difficulty';
  message: string;
  cardIds?: string[];
}

export interface CatalogStats {
  total: number;
  enabled: number;
  disabled: number;
  classified: number;
  unclassified: number;
  byDifficulty: Record<CardDifficulty, number>;
}

export const EMPTY_DIFFICULTY_COUNTS: Record<CardDifficulty, number> = {
  easy: 0,
  medium: 0,
  hard: 0,
};

// The catalog is editable content, not a game deck.
// Decks are built from its enabled definitions at game creation time.
export const CARD_CATALOG: readonly CardDefinition[] = [
  { id: 'family', name: 'Семья', difficulty: 'medium', enabled: true },
  { id: 'society', name: 'Общество', difficulty: 'medium', enabled: true },
  { id: 'state', name: 'Государство', difficulty: 'medium', enabled: true },
  { id: 'power', name: 'Власть', difficulty: 'medium', enabled: true },
  { id: 'law', name: 'Закон', difficulty: 'medium', enabled: true },
  { id: 'rule', name: 'Правило', difficulty: 'medium', enabled: true },
  { id: 'norm', name: 'Норма', difficulty: 'medium', enabled: true },
  { id: 'education', name: 'Образование', difficulty: 'medium', enabled: true },
  { id: 'science', name: 'Наука', difficulty: 'medium', enabled: true },
  { id: 'culture', name: 'Культура', difficulty: 'medium', enabled: true },
  { id: 'tradition', name: 'Традиция', difficulty: 'medium', enabled: true },
  { id: 'religion', name: 'Религия', difficulty: 'medium', enabled: true },
  { id: 'art', name: 'Искусство', difficulty: 'medium', enabled: true },
  { id: 'language', name: 'Язык', difficulty: 'medium', enabled: true },
  { id: 'information', name: 'Информация', difficulty: 'medium', enabled: true },
  { id: 'knowledge', name: 'Знание', difficulty: 'medium', enabled: true },
  { id: 'memory', name: 'Память', difficulty: 'medium', enabled: true },
  { id: 'communication', name: 'Общение', difficulty: 'medium', enabled: true },
  { id: 'research', name: 'Исследование', difficulty: 'medium', enabled: true },
  { id: 'evidence', name: 'Доказательство', difficulty: 'medium', enabled: true },
  { id: 'technology', name: 'Технология', difficulty: 'medium', enabled: true },
  { id: 'invention', name: 'Изобретение', difficulty: 'medium', enabled: true },
  { id: 'organization', name: 'Организация', difficulty: 'medium', enabled: true },
  { id: 'team', name: 'Команда', difficulty: 'medium', enabled: true },
  { id: 'market', name: 'Рынок', difficulty: 'medium', enabled: true },
  { id: 'money', name: 'Деньги', difficulty: 'medium', enabled: true },
  { id: 'labor', name: 'Труд', difficulty: 'medium', enabled: true },
  { id: 'profession', name: 'Профессия', difficulty: 'medium', enabled: true },
  { id: 'production', name: 'Производство', difficulty: 'medium', enabled: true },
  { id: 'trade', name: 'Торговля', difficulty: 'medium', enabled: true },
  { id: 'competition', name: 'Конкуренция', difficulty: 'medium', enabled: true },
  { id: 'cooperation', name: 'Сотрудничество', difficulty: 'medium', enabled: true },
  { id: 'conflict', name: 'Конфликт', difficulty: 'medium', enabled: true },
  { id: 'contract', name: 'Договор', difficulty: 'medium', enabled: true },
  { id: 'trust', name: 'Доверие', difficulty: 'medium', enabled: true },
  { id: 'reputation', name: 'Репутация', difficulty: 'medium', enabled: true },
  { id: 'responsibility', name: 'Ответственность', difficulty: 'medium', enabled: true },
  { id: 'decision', name: 'Решение', difficulty: 'medium', enabled: true },
  { id: 'risk', name: 'Риск', difficulty: 'medium', enabled: true },
  { id: 'safety', name: 'Безопасность', difficulty: 'medium', enabled: true },
  { id: 'consciousness', name: 'Сознание', difficulty: 'hard', enabled: true },
  { id: 'identity', name: 'Идентичность', difficulty: 'hard', enabled: true },
  { id: 'worldview', name: 'Мировоззрение', difficulty: 'hard', enabled: true },
  { id: 'interpretation', name: 'Интерпретация', difficulty: 'hard', enabled: true },
  { id: 'truth', name: 'Истина', difficulty: 'hard', enabled: true },
  { id: 'objectivity', name: 'Объективность', difficulty: 'hard', enabled: true },
  { id: 'meaning', name: 'Смысл', difficulty: 'hard', enabled: true },
  { id: 'uncertainty', name: 'Неопределённость', difficulty: 'hard', enabled: true },
  { id: 'freedom', name: 'Свобода', difficulty: 'hard', enabled: true },
  { id: 'justice', name: 'Справедливость', difficulty: 'hard', enabled: true },
  { id: 'value', name: 'Ценность', difficulty: 'hard', enabled: true },
  { id: 'morality', name: 'Мораль', difficulty: 'hard', enabled: true },
  { id: 'equality', name: 'Равенство', difficulty: 'hard', enabled: true },
  { id: 'legitimacy', name: 'Легитимность', difficulty: 'hard', enabled: true },
  { id: 'order', name: 'Порядок', difficulty: 'hard', enabled: true },
  { id: 'chaos', name: 'Хаос', difficulty: 'hard', enabled: true },
  { id: 'necessity', name: 'Необходимость', difficulty: 'hard', enabled: true },
  { id: 'ideology', name: 'Идеология', difficulty: 'hard', enabled: true },
  { id: 'purpose', name: 'Цель', difficulty: 'hard', enabled: true },
  { id: 'progress', name: 'Прогресс', difficulty: 'hard', enabled: true },
];

export const START_CARD_CATALOG: readonly CardDefinition[] = [
  { id: 'start-society', name: 'Общество', difficulty: 'medium' },
  { id: 'start-system', name: 'Система', difficulty: 'hard' },
  { id: 'start-change', name: 'Изменение', difficulty: 'medium' },
];

export const CARD_NAMES = getEnabledCards(CARD_CATALOG).map((card) => card.name);
export const START_CARD_NAMES = getEnabledCards(START_CARD_CATALOG).map(
  (card) => card.name
);

const normalizeCardId = (value: string) => value.trim();
const normalizeCardName = (value: string) => value.trim().toLocaleLowerCase('ru-RU');

export function getEnabledCards(
  catalog: readonly CardDefinition[]
): CardDefinition[] {
  return catalog.filter((card) => card.enabled !== false);
}

export function validateCardCatalog(
  catalog: readonly CardDefinition[]
): CatalogValidationIssue[] {
  const issues: CatalogValidationIssue[] = [];
  const ids = new Map<string, CardDefinition[]>();
  const names = new Map<string, CardDefinition[]>();

  catalog.forEach((card) => {
    const id = normalizeCardId(card.id);
    const name = normalizeCardName(card.name);

    if (!id) {
      issues.push({
        type: 'empty-id',
        message: `Card "${card.name}" has an empty id.`,
      });
    } else {
      ids.set(id, [...(ids.get(id) ?? []), card]);
    }

    if (!name) {
      issues.push({
        type: 'empty-name',
        message: `Card "${card.id}" has an empty name.`,
        cardIds: [card.id],
      });
    } else {
      names.set(name, [...(names.get(name) ?? []), card]);
    }

    if (!card.difficulty) {
      issues.push({
        type: 'missing-difficulty',
        message: `Card "${card.id}" has no difficulty.`,
        cardIds: [card.id],
      });
    }
  });

  ids.forEach((cards, id) => {
    if (cards.length <= 1) return;
    issues.push({
      type: 'duplicate-id',
      message: `Card catalog contains duplicate id "${id}".`,
      cardIds: cards.map((card) => card.id),
    });
  });

  names.forEach((cards, normalizedName) => {
    if (cards.length <= 1) return;
    issues.push({
      type: 'duplicate-name',
      message: `Card catalog contains duplicate normalized name "${normalizedName}".`,
      cardIds: cards.map((card) => card.id),
    });
  });

  return issues;
}

export function getCatalogStats(
  catalog: readonly CardDefinition[]
): CatalogStats {
  return catalog.reduce<CatalogStats>(
    (stats, card) => {
      const isEnabled = card.enabled !== false;
      const hasDifficulty = Boolean(card.difficulty);

      stats.total += 1;
      if (isEnabled) stats.enabled += 1;
      else stats.disabled += 1;
      if (hasDifficulty) stats.classified += 1;
      else stats.unclassified += 1;

      if (isEnabled && card.difficulty) {
        stats.byDifficulty[card.difficulty] += 1;
      }

      return stats;
    },
    {
      total: 0,
      enabled: 0,
      disabled: 0,
      classified: 0,
      unclassified: 0,
      byDifficulty: { ...EMPTY_DIFFICULTY_COUNTS },
    }
  );
}

export function getCardDefinitionIdsByNames(
  names: readonly string[],
  catalog: readonly CardDefinition[] = CARD_CATALOG
): string[] {
  const idsByName = new Map(
    catalog.map((card) => [normalizeCardName(card.name), card.id])
  );

  return names
    .map((name) => idsByName.get(normalizeCardName(name)))
    .filter((id): id is string => Boolean(id));
}

export function getCardDefinitionIdByName(
  name: string,
  catalog: readonly CardDefinition[] = CARD_CATALOG
): string | undefined {
  return catalog.find((card) => normalizeCardName(card.name) === normalizeCardName(name))?.id;
}

if (import.meta.env.DEV) {
  const issues = validateCardCatalog(CARD_CATALOG);
  const stats = getCatalogStats(CARD_CATALOG);

  if (issues.length > 0) {
    console.warn('[card catalog validation]', issues);
  }

  // The 40/40/20 check validates the first curated release,
  // not a permanent catalog-size invariant.
  if (
    stats.total !== 100 ||
    stats.enabled !== 100 ||
    stats.byDifficulty.easy !== 40 ||
    stats.byDifficulty.medium !== 40 ||
    stats.byDifficulty.hard !== 20 ||
    stats.unclassified !== 0
  ) {
    console.warn('[card catalog distribution]', stats);
  }
}
