import {
  EMPTY_DIFFICULTY_COUNTS,
  getEnabledCards,
  type CardDefinition,
  type CardDifficulty,
} from '../data/cardCatalog';
import type {
  DeckDefinition,
  DeckMixRatio,
} from '../data/deckDefinitions';

export interface BuildDeckOptions {
  targetSize?: number;
}

export interface BuiltDeck {
  definitionId: string;
  cardDefinitionIds: string[];
  cards: CardDefinition[];
  totalCards: number;
  countsByDifficulty: Record<CardDifficulty, number>;
}

export interface DeckValidationIssue {
  type:
    | 'duplicate-deck-id'
    | 'unknown-card-id'
    | 'duplicate-card-id'
    | 'empty-custom-deck'
    | 'invalid-target-size'
    | 'invalid-ratio';
  message: string;
}

export interface DeckCapacityCheck {
  valid: boolean;
  requiredCards: number;
  availableCards: number;
  message?: string;
}

type CardsByDifficulty = Record<CardDifficulty, CardDefinition[]>;

const DIFFICULTIES: readonly CardDifficulty[] = ['easy', 'medium', 'hard'];

const getEmptyCardsByDifficulty = (): CardsByDifficulty => ({
  easy: [],
  medium: [],
  hard: [],
});

const getCountsByDifficulty = (
  cards: readonly CardDefinition[]
): Record<CardDifficulty, number> =>
  cards.reduce(
    (counts, card) => {
      if (card.difficulty) counts[card.difficulty] += 1;
      return counts;
    },
    { ...EMPTY_DIFFICULTY_COUNTS }
  );

const getEnabledClassifiedCardsByDifficulty = (
  catalog: readonly CardDefinition[]
): CardsByDifficulty =>
  getEnabledCards(catalog).reduce((cardsByDifficulty, card) => {
    if (card.difficulty) {
      cardsByDifficulty[card.difficulty] = [
        ...cardsByDifficulty[card.difficulty],
        card,
      ];
    }

    return cardsByDifficulty;
  }, getEmptyCardsByDifficulty());

const createBuiltDeck = (
  definitionId: string,
  cards: readonly CardDefinition[]
): BuiltDeck => ({
  definitionId,
  cardDefinitionIds: cards.map((card) => card.id),
  cards: [...cards],
  totalCards: cards.length,
  countsByDifficulty: getCountsByDifficulty(cards),
});

function validateTargetSize(
  targetSize: number | undefined,
  definitionId: string
): DeckValidationIssue[] {
  if (typeof targetSize !== 'number') return [];

  return Number.isInteger(targetSize) && targetSize > 0
    ? []
    : [
        {
          type: 'invalid-target-size',
          message: `Deck "${definitionId}" has invalid target size "${targetSize}".`,
        },
      ];
}

function validateRatio(
  ratio: DeckMixRatio,
  definitionId: string
): DeckValidationIssue[] {
  const weights = DIFFICULTIES.map((difficulty) => ratio[difficulty]);
  const hasOnlyValidWeights = weights.every(
    (weight) => Number.isFinite(weight) && weight >= 0
  );
  const hasPositiveWeight = weights.some((weight) => weight > 0);

  return hasOnlyValidWeights && hasPositiveWeight
    ? []
    : [
        {
          type: 'invalid-ratio',
          message: `Deck "${definitionId}" has invalid mixed ratio.`,
        },
      ];
}

export function validateDeckDefinition(
  definition: DeckDefinition,
  catalog: readonly CardDefinition[]
): DeckValidationIssue[] {
  const issues: DeckValidationIssue[] = [];
  const enabledCardsById = new Map(
    getEnabledCards(catalog).map((card) => [card.id, card])
  );
  const cardsByDifficulty = getEnabledClassifiedCardsByDifficulty(catalog);

  if (definition.source.type === 'custom') {
    const seenCardIds = new Set<string>();

    if (definition.source.cardIds.length === 0) {
      issues.push({
        type: 'empty-custom-deck',
        message: `Deck "${definition.id}" contains no cards.`,
      });
    }

    definition.source.cardIds.forEach((cardId) => {
      if (!enabledCardsById.has(cardId)) {
        issues.push({
          type: 'unknown-card-id',
          message: `Deck "${definition.id}" references unknown or disabled card id "${cardId}".`,
        });
      }

      if (seenCardIds.has(cardId)) {
        issues.push({
          type: 'duplicate-card-id',
          message: `Deck "${definition.id}" contains duplicate card id "${cardId}".`,
        });
      }

      seenCardIds.add(cardId);
    });
  }

  if (definition.source.type === 'difficulty') {
    if (cardsByDifficulty[definition.source.difficulty].length === 0) {
      issues.push({
        type: 'unknown-card-id',
        message: `Deck "${definition.id}" contains no enabled ${definition.source.difficulty} cards.`,
      });
    }
  }

  if (definition.source.type === 'mixed-ratio') {
    issues.push(...validateRatio(definition.source.ratio, definition.id));
    issues.push(...validateTargetSize(definition.source.targetSize, definition.id));
  }

  return issues;
}

export function validateDeckDefinitions(
  definitions: readonly DeckDefinition[],
  catalog: readonly CardDefinition[]
): DeckValidationIssue[] {
  const issues = definitions.flatMap((definition) =>
    validateDeckDefinition(definition, catalog)
  );
  const ids = new Map<string, number>();

  definitions.forEach((definition) => {
    ids.set(definition.id, (ids.get(definition.id) ?? 0) + 1);
  });

  ids.forEach((count, id) => {
    if (count <= 1) return;
    issues.push({
      type: 'duplicate-deck-id',
      message: `Deck definitions contain duplicate id "${id}".`,
    });
  });

  return issues;
}

const assertValidDeck = (
  definition: DeckDefinition,
  catalog: readonly CardDefinition[]
) => {
  const issues = validateDeckDefinition(definition, catalog);
  if (issues.length > 0) {
    throw new Error(issues[0].message);
  }
};

const takeTargetSize = (
  cards: readonly CardDefinition[],
  targetSize: number | undefined,
  definition: DeckDefinition
) => {
  if (targetSize === undefined) return [...cards];
  if (targetSize > cards.length) {
    throw new Error(
      `Deck "${definition.id}" requires ${targetSize} cards, but only ${cards.length} matching cards are available.`
    );
  }

  return cards.slice(0, targetSize);
};

const getMixedRatioTargetSize = (
  definition: DeckDefinition,
  options?: BuildDeckOptions
): number | undefined => {
  if (definition.source.type !== 'mixed-ratio') return options?.targetSize;
  return options?.targetSize ?? definition.source.targetSize;
};

function allocateMixedRatioCounts(
  cardsByDifficulty: CardsByDifficulty,
  ratio: DeckMixRatio,
  targetSize: number
): Record<CardDifficulty, number> {
  const totalWeight = DIFFICULTIES.reduce(
    (total, difficulty) => total + ratio[difficulty],
    0
  );
  const allocation = { ...EMPTY_DIFFICULTY_COUNTS };
  const remainders = DIFFICULTIES.map((difficulty) => {
    const exact = (targetSize * ratio[difficulty]) / totalWeight;
    const count = Math.min(
      Math.floor(exact),
      cardsByDifficulty[difficulty].length
    );
    allocation[difficulty] = count;
    return { difficulty, remainder: exact - Math.floor(exact) };
  });
  let remaining = targetSize - DIFFICULTIES.reduce(
    (total, difficulty) => total + allocation[difficulty],
    0
  );

  while (remaining > 0) {
    const availableDifficulty = [...remainders]
      .sort((a, b) => b.remainder - a.remainder)
      .find(
        ({ difficulty }) =>
          allocation[difficulty] < cardsByDifficulty[difficulty].length
      )?.difficulty;

    if (!availableDifficulty) break;

    allocation[availableDifficulty] += 1;
    remaining -= 1;
  }

  return allocation;
}

export function buildDeck(
  catalog: readonly CardDefinition[],
  definition: DeckDefinition,
  options?: BuildDeckOptions
): BuiltDeck {
  assertValidDeck(definition, catalog);

  const enabledCards = getEnabledCards(catalog);

  if (definition.source.type === 'difficulty') {
    const difficulty = definition.source.difficulty;
    const matchingCards = enabledCards.filter(
      (card) => card.difficulty === difficulty
    );
    const cards = takeTargetSize(matchingCards, options?.targetSize, definition);

    return createBuiltDeck(definition.id, cards);
  }

  if (definition.source.type === 'mixed-all') {
    const cards = enabledCards.filter((card) => Boolean(card.difficulty));

    return createBuiltDeck(definition.id, cards);
  }

  if (definition.source.type === 'mixed-ratio') {
    const cardsByDifficulty = getEnabledClassifiedCardsByDifficulty(catalog);
    const availableCards = DIFFICULTIES.flatMap(
      (difficulty) => cardsByDifficulty[difficulty]
    );
    const targetSize = getMixedRatioTargetSize(definition, options);

    if (targetSize === undefined) {
      return createBuiltDeck(definition.id, availableCards);
    }

    if (targetSize > availableCards.length) {
      throw new Error(
        `Deck "${definition.id}" requires ${targetSize} cards, but only ${availableCards.length} matching cards are available.`
      );
    }

    const allocation = allocateMixedRatioCounts(
      cardsByDifficulty,
      definition.source.ratio,
      targetSize
    );
    const cards = DIFFICULTIES.flatMap((difficulty) =>
      cardsByDifficulty[difficulty].slice(0, allocation[difficulty])
    );

    return createBuiltDeck(definition.id, cards);
  }

  const cardsById = new Map(enabledCards.map((card) => [card.id, card]));
  const cards = definition.source.cardIds.map((cardId) => {
    const card = cardsById.get(cardId);
    if (!card) throw new Error(`Deck "${definition.id}" references unknown card id "${cardId}".`);
    return card;
  });

  return createBuiltDeck(definition.id, cards);
}

export function getDeckStats(
  builtDeck: BuiltDeck
): {
  total: number;
  byDifficulty: Record<CardDifficulty, number>;
} {
  return {
    total: builtDeck.totalCards,
    byDifficulty: { ...builtDeck.countsByDifficulty },
  };
}

export function validateDeckCapacity(
  deckSize: number,
  playerCount: number,
  handSize: number
): DeckCapacityCheck {
  const requiredCards = playerCount * handSize;
  const valid = deckSize >= requiredCards;

  return {
    valid,
    requiredCards,
    availableCards: deckSize,
    message: valid
      ? undefined
      : `В выбранной колоде недостаточно карт для ${playerCount} игроков. Нужно минимум ${requiredCards}, доступно ${deckSize}.`,
  };
}
