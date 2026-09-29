import type { CardDefinition, CardDifficulty } from './cardCatalog';
import type { RelationFamily } from '../types';
import { EVERYDAY_CARD_CATALOG, EVERYDAY_PLAY_CARD_IDS, EVERYDAY_NEUTRAL_CARDS } from './everydayCatalog';

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
  catalog?: readonly CardDefinition[];
  neutralCards?: readonly CardDefinition[];
  relationFamilies?: readonly RelationFamily[];
}

// Values are relative weights, not fixed counts or required percentages.
export const DEFAULT_MIX_RATIO: DeckMixRatio = {
  easy: 40,
  medium: 40,
  hard: 20,
};

// TODO: Remove this legacy deck when it is no longer needed for tests.
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

export const EVERYDAY_DECK: DeckDefinition = {
  id: 'everyday',
  name: 'Простые понятия',
  kind: 'preset',
  description: '40 игровых понятий, 3 нейтральные карты и шесть типов связей.',
  source: { type: 'custom', cardIds: EVERYDAY_PLAY_CARD_IDS },
  catalog: EVERYDAY_CARD_CATALOG,
  neutralCards: EVERYDAY_NEUTRAL_CARDS,
  relationFamilies: ['characteristic', 'contrast', 'variety', 'helps', 'causes', 'regulates'],
};

// Standard difficulty decks are derived from catalog metadata;
// their size must never be duplicated as a constant.
export const USER_SELECTABLE_DECKS: readonly DeckDefinition[] = [
  EVERYDAY_DECK,
  MEDIUM_DECK,
  HARD_DECK,
];

export const DEFAULT_DECK = EVERYDAY_DECK;

// Custom decks reference stable definition ids so catalog metadata
// can change without duplicating full card objects.
export const DECK_DEFINITIONS: readonly DeckDefinition[] = [
  ...USER_SELECTABLE_DECKS,
  // Keep hidden decks available for existing games and internal use.
  EASY_DECK,
  MIXED_ALL_DECK,
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
