import type { CardDifficulty } from './cardCatalog';

export type DeckKind = 'preset' | 'custom';

export interface DeckMixRatio {
  easy: number;
  medium: number;
  hard: number;
}

export type DeckSource =
  | {
      type: 'difficulty';
      difficulty: CardDifficulty;
    }
  | {
      type: 'mixed-all';
    }
  | {
      type: 'mixed-ratio';
      ratio: DeckMixRatio;
      targetSize?: number;
    }
  | {
      type: 'custom';
      cardIds: readonly string[];
    };

export interface DeckDefinition {
  id: string;
  name: string;
  kind: DeckKind;
  description?: string;
  source: DeckSource;
  enabled?: boolean;
}

// Values are relative weights, not fixed counts or required percentages.
export const DEFAULT_MIX_RATIO: DeckMixRatio = {
  easy: 40,
  medium: 40,
  hard: 20,
};

export const EASY_DECK: DeckDefinition = {
  id: 'easy',
  name: 'Простая',
  kind: 'preset',
  source: {
    type: 'difficulty',
    difficulty: 'easy',
  },
};

export const MEDIUM_DECK: DeckDefinition = {
  id: 'medium',
  name: 'Средняя',
  kind: 'preset',
  source: {
    type: 'difficulty',
    difficulty: 'medium',
  },
};

export const HARD_DECK: DeckDefinition = {
  id: 'hard',
  name: 'Сложная',
  kind: 'preset',
  source: {
    type: 'difficulty',
    difficulty: 'hard',
  },
};

export const MIXED_ALL_DECK: DeckDefinition = {
  id: 'mixed-all',
  name: 'Смешанная',
  kind: 'preset',
  description: 'Все активные классифицированные карты каталога.',
  source: {
    type: 'mixed-all',
  },
};

// Standard difficulty decks are derived from catalog metadata;
// their size must never be duplicated as a constant.
export const USER_SELECTABLE_DECKS: readonly DeckDefinition[] = [
  EASY_DECK,
  MEDIUM_DECK,
  HARD_DECK,
  MIXED_ALL_DECK,
];

// Custom decks reference stable definition ids so catalog metadata
// can change without duplicating full card objects.
export const DECK_DEFINITIONS: readonly DeckDefinition[] = [
  ...USER_SELECTABLE_DECKS,
  {
    id: 'mixed-50',
    name: 'Смешанная 50',
    kind: 'preset',
    description: 'Пример будущей колоды на 50 карт по относительным весам 40/40/20.',
    source: {
      type: 'mixed-ratio',
      ratio: DEFAULT_MIX_RATIO,
      targetSize: 50,
    },
  },
  {
    id: 'social-test',
    name: 'Социальные понятия',
    kind: 'custom',
    source: {
      type: 'custom',
      cardIds: ['state', 'market', 'family', 'power'],
    },
  },
];

export function getDeckDefinitionById(deckId: string): DeckDefinition | null {
  return DECK_DEFINITIONS.find((definition) => definition.id === deckId) ?? null;
}
