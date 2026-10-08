import { createClient } from "npm:@supabase/supabase-js@2.107.0";
//#region src/data/cardCatalog.ts
const EMPTY_DIFFICULTY_COUNTS = {
	easy: 0,
	medium: 0,
	hard: 0
};
const CARD_CATALOG = [
	{
		id: "family",
		name: "Семья",
		difficulty: "medium",
		enabled: true
	},
	{
		id: "society",
		name: "Общество",
		difficulty: "medium",
		enabled: true
	},
	{
		id: "state",
		name: "Государство",
		difficulty: "medium",
		enabled: true
	},
	{
		id: "power",
		name: "Власть",
		difficulty: "medium",
		enabled: true
	},
	{
		id: "law",
		name: "Закон",
		difficulty: "medium",
		enabled: true
	},
	{
		id: "rule",
		name: "Правило",
		difficulty: "medium",
		enabled: true
	},
	{
		id: "norm",
		name: "Норма",
		difficulty: "medium",
		enabled: true
	},
	{
		id: "education",
		name: "Образование",
		difficulty: "medium",
		enabled: true
	},
	{
		id: "science",
		name: "Наука",
		difficulty: "medium",
		enabled: true
	},
	{
		id: "culture",
		name: "Культура",
		difficulty: "medium",
		enabled: true
	},
	{
		id: "tradition",
		name: "Традиция",
		difficulty: "medium",
		enabled: true
	},
	{
		id: "religion",
		name: "Религия",
		difficulty: "medium",
		enabled: true
	},
	{
		id: "art",
		name: "Искусство",
		difficulty: "medium",
		enabled: true
	},
	{
		id: "language",
		name: "Язык",
		difficulty: "medium",
		enabled: true
	},
	{
		id: "information",
		name: "Информация",
		difficulty: "medium",
		enabled: true
	},
	{
		id: "knowledge",
		name: "Знание",
		difficulty: "medium",
		enabled: true
	},
	{
		id: "memory",
		name: "Память",
		difficulty: "medium",
		enabled: true
	},
	{
		id: "communication",
		name: "Общение",
		difficulty: "medium",
		enabled: true
	},
	{
		id: "research",
		name: "Исследование",
		difficulty: "medium",
		enabled: true
	},
	{
		id: "evidence",
		name: "Доказательство",
		difficulty: "medium",
		enabled: true
	},
	{
		id: "technology",
		name: "Технология",
		difficulty: "medium",
		enabled: true
	},
	{
		id: "invention",
		name: "Изобретение",
		difficulty: "medium",
		enabled: true
	},
	{
		id: "organization",
		name: "Организация",
		difficulty: "medium",
		enabled: true
	},
	{
		id: "team",
		name: "Команда",
		difficulty: "medium",
		enabled: true
	},
	{
		id: "market",
		name: "Рынок",
		difficulty: "medium",
		enabled: true
	},
	{
		id: "money",
		name: "Деньги",
		difficulty: "medium",
		enabled: true
	},
	{
		id: "labor",
		name: "Труд",
		difficulty: "medium",
		enabled: true
	},
	{
		id: "profession",
		name: "Профессия",
		difficulty: "medium",
		enabled: true
	},
	{
		id: "production",
		name: "Производство",
		difficulty: "medium",
		enabled: true
	},
	{
		id: "trade",
		name: "Торговля",
		difficulty: "medium",
		enabled: true
	},
	{
		id: "competition",
		name: "Конкуренция",
		difficulty: "medium",
		enabled: true
	},
	{
		id: "cooperation",
		name: "Сотрудничество",
		difficulty: "medium",
		enabled: true
	},
	{
		id: "conflict",
		name: "Конфликт",
		difficulty: "medium",
		enabled: true
	},
	{
		id: "contract",
		name: "Договор",
		difficulty: "medium",
		enabled: true
	},
	{
		id: "trust",
		name: "Доверие",
		difficulty: "medium",
		enabled: true
	},
	{
		id: "reputation",
		name: "Репутация",
		difficulty: "medium",
		enabled: true
	},
	{
		id: "responsibility",
		name: "Ответственность",
		difficulty: "medium",
		enabled: true
	},
	{
		id: "decision",
		name: "Решение",
		difficulty: "medium",
		enabled: true
	},
	{
		id: "risk",
		name: "Риск",
		difficulty: "medium",
		enabled: true
	},
	{
		id: "safety",
		name: "Безопасность",
		difficulty: "medium",
		enabled: true
	},
	{
		id: "consciousness",
		name: "Сознание",
		difficulty: "hard",
		enabled: true
	},
	{
		id: "identity",
		name: "Идентичность",
		difficulty: "hard",
		enabled: true
	},
	{
		id: "worldview",
		name: "Мировоззрение",
		difficulty: "hard",
		enabled: true
	},
	{
		id: "interpretation",
		name: "Интерпретация",
		difficulty: "hard",
		enabled: true
	},
	{
		id: "truth",
		name: "Истина",
		difficulty: "hard",
		enabled: true
	},
	{
		id: "objectivity",
		name: "Объективность",
		difficulty: "hard",
		enabled: true
	},
	{
		id: "meaning",
		name: "Смысл",
		difficulty: "hard",
		enabled: true
	},
	{
		id: "uncertainty",
		name: "Неопределённость",
		difficulty: "hard",
		enabled: true
	},
	{
		id: "freedom",
		name: "Свобода",
		difficulty: "hard",
		enabled: true
	},
	{
		id: "justice",
		name: "Справедливость",
		difficulty: "hard",
		enabled: true
	},
	{
		id: "value",
		name: "Ценность",
		difficulty: "hard",
		enabled: true
	},
	{
		id: "morality",
		name: "Мораль",
		difficulty: "hard",
		enabled: true
	},
	{
		id: "equality",
		name: "Равенство",
		difficulty: "hard",
		enabled: true
	},
	{
		id: "legitimacy",
		name: "Легитимность",
		difficulty: "hard",
		enabled: true
	},
	{
		id: "order",
		name: "Порядок",
		difficulty: "hard",
		enabled: true
	},
	{
		id: "chaos",
		name: "Хаос",
		difficulty: "hard",
		enabled: true
	},
	{
		id: "necessity",
		name: "Необходимость",
		difficulty: "hard",
		enabled: true
	},
	{
		id: "ideology",
		name: "Идеология",
		difficulty: "hard",
		enabled: true
	},
	{
		id: "purpose",
		name: "Цель",
		difficulty: "hard",
		enabled: true
	},
	{
		id: "progress",
		name: "Прогресс",
		difficulty: "hard",
		enabled: true
	}
];
const START_CARD_CATALOG = [
	{
		id: "start-society",
		name: "Общество",
		difficulty: "medium"
	},
	{
		id: "start-system",
		name: "Система",
		difficulty: "hard"
	},
	{
		id: "start-change",
		name: "Изменение",
		difficulty: "medium"
	}
];
getEnabledCards(CARD_CATALOG).map((card) => card.name);
getEnabledCards(START_CARD_CATALOG).map((card) => card.name);
const normalizeCardName = (value) => value.trim().toLocaleLowerCase("ru-RU");
function getEnabledCards(catalog) {
	return catalog.filter((card) => card.enabled !== false);
}
function getCardDefinitionIdByName(name, catalog = CARD_CATALOG) {
	return catalog.find((card) => normalizeCardName(card.name) === normalizeCardName(name))?.id;
}
//#endregion
//#region src/data/emotionsCatalog.ts
const EMOTIONS_PLAY_CARDS = [
	{
		"id": "emotion-ru-115",
		"name": "Безнадёжность",
		"enabled": true
	},
	{
		"id": "emotion-ru-164",
		"name": "Безразличие",
		"enabled": true
	},
	{
		"id": "emotion-ru-113",
		"name": "Безутешность",
		"enabled": true
	},
	{
		"id": "emotion-ru-197",
		"name": "Бодрость",
		"enabled": true
	},
	{
		"id": "emotion-ru-002",
		"name": "Веселье",
		"enabled": true
	},
	{
		"id": "emotion-ru-266",
		"name": "Вздох",
		"enabled": true
	},
	{
		"id": "emotion-ru-078",
		"name": "Волнение",
		"enabled": true
	},
	{
		"id": "emotion-ru-014",
		"name": "Воодушевление",
		"enabled": true
	},
	{
		"id": "emotion-ru-200",
		"name": "Вялость",
		"enabled": true
	},
	{
		"id": "emotion-ru-130",
		"name": "Гнев",
		"enabled": true
	},
	{
		"id": "emotion-ru-101",
		"name": "Горе",
		"enabled": true
	},
	{
		"id": "emotion-ru-094",
		"name": "Грусть",
		"enabled": true
	},
	{
		"id": "emotion-ru-267",
		"name": "Дрожь",
		"enabled": true
	},
	{
		"id": "emotion-ru-233",
		"name": "Дружелюбие",
		"enabled": true
	},
	{
		"id": "emotion-ru-074",
		"name": "Интерес",
		"enabled": true
	},
	{
		"id": "emotion-ru-089",
		"name": "Испуг",
		"enabled": true
	},
	{
		"id": "emotion-ru-282",
		"name": "Истома",
		"description": "Приятное ощущение лёгкой усталости.",
		"enabled": true
	},
	{
		"id": "emotion-ru-265",
		"name": "Крик",
		"enabled": true
	},
	{
		"id": "emotion-ru-271",
		"name": "Ласка",
		"enabled": true
	},
	{
		"id": "emotion-ru-024",
		"name": "Любовь",
		"enabled": true
	},
	{
		"id": "emotion-ru-051",
		"name": "Надежда",
		"enabled": true
	},
	{
		"id": "emotion-ru-195",
		"name": "Напряжение",
		"enabled": true
	},
	{
		"id": "emotion-ru-007",
		"name": "Наслаждение",
		"enabled": true
	},
	{
		"id": "emotion-ru-171",
		"name": "Настроение",
		"description": "Общий эмоциональный фон человека.",
		"enabled": true
	},
	{
		"id": "emotion-ru-021",
		"name": "Нежность",
		"enabled": true
	},
	{
		"id": "emotion-ru-138",
		"name": "Ненависть",
		"enabled": true
	},
	{
		"id": "emotion-ru-142",
		"name": "Неприязнь",
		"enabled": true
	},
	{
		"id": "emotion-ru-128",
		"name": "Неудовольствие",
		"enabled": true
	},
	{
		"id": "emotion-ru-064",
		"name": "Облегчение",
		"enabled": true
	},
	{
		"id": "emotion-ru-269",
		"name": "Объятие",
		"enabled": true
	},
	{
		"id": "emotion-attitude",
		"name": "Отношение",
		"description": "Эмоциональное отношение к кому-либо или чему-либо.",
		"enabled": true
	},
	{
		"id": "emotion-ru-114",
		"name": "Отчаяние",
		"enabled": true
	},
	{
		"id": "emotion-ru-172",
		"name": "Ощущение",
		"description": "Непосредственно чувствуемое телесное состояние.",
		"enabled": true
	},
	{
		"id": "emotion-ru-261",
		"name": "Плач",
		"enabled": true
	},
	{
		"id": "emotion-ru-110",
		"name": "Подавленность",
		"enabled": true
	},
	{
		"id": "emotion-ru-270",
		"name": "Поцелуй",
		"enabled": true
	},
	{
		"id": "emotion-ru-031",
		"name": "Привязанность",
		"enabled": true
	},
	{
		"id": "emotion-ru-016",
		"name": "Приподнятость",
		"enabled": true
	},
	{
		"id": "emotion-ru-001",
		"name": "Радость",
		"enabled": true
	},
	{
		"id": "emotion-ru-201",
		"name": "Разбитость",
		"enabled": true
	},
	{
		"id": "emotion-ru-125",
		"name": "Раздражение",
		"enabled": true
	},
	{
		"id": "emotion-ru-027",
		"name": "Симпатия",
		"enabled": true
	},
	{
		"id": "emotion-ru-162",
		"name": "Скука",
		"enabled": true
	},
	{
		"id": "emotion-ru-262",
		"name": "Слёзы",
		"enabled": true
	},
	{
		"id": "emotion-ru-260",
		"name": "Смех",
		"enabled": true
	},
	{
		"id": "emotion-ru-038",
		"name": "Сострадание",
		"enabled": true
	},
	{
		"id": "emotion-ru-058",
		"name": "Спокойствие",
		"enabled": true
	},
	{
		"id": "emotion-ru-103",
		"name": "Страдание",
		"enabled": true
	},
	{
		"id": "emotion-ru-087",
		"name": "Страх",
		"enabled": true
	},
	{
		"id": "emotion-ru-082",
		"name": "Тревога",
		"enabled": true
	},
	{
		"id": "emotion-ru-077",
		"name": "Увлечённость",
		"enabled": true
	},
	{
		"id": "emotion-ru-006",
		"name": "Удовольствие",
		"enabled": true
	},
	{
		"id": "emotion-ru-090",
		"name": "Ужас",
		"enabled": true
	},
	{
		"id": "emotion-ru-259",
		"name": "Улыбка",
		"enabled": true
	},
	{
		"id": "emotion-ru-022",
		"name": "Умиление",
		"enabled": true
	},
	{
		"id": "emotion-ru-096",
		"name": "Уныние",
		"enabled": true
	},
	{
		"id": "emotion-ru-198",
		"name": "Усталость",
		"enabled": true
	}
];
const EMOTIONS_NEUTRAL_CARDS = [
	{
		"id": "emotion-ru-170",
		"name": "Переживание",
		"description": "Субъективно проживаемое душевное состояние.",
		"enabled": true
	},
	{
		"id": "emotion-state",
		"name": "Состояние",
		"description": "Текущее психическое или психофизическое состояние человека.",
		"enabled": true
	},
	{
		"id": "emotion-response",
		"name": "Реакция",
		"description": "Эмоциональный или выразительный ответ человека на воздействие.",
		"enabled": true
	},
	{
		"id": "emotion-ru-169",
		"name": "Чувство",
		"description": "Душевное состояние или эмоциональное отношение.",
		"enabled": true
	},
	{
		"id": "emotion-ru-168",
		"name": "Эмоция",
		"description": "Переживание, выражающее отношение к происходящему.",
		"enabled": true
	}
];
const EMOTIONS_DECK = {
	id: "emotions",
	name: "Эмоции и чувства",
	kind: "preset",
	description: `${EMOTIONS_PLAY_CARDS.length} игральных и ${EMOTIONS_NEUTRAL_CARDS.length} нейтральных карт.`,
	source: {
		type: "custom",
		cardIds: EMOTIONS_PLAY_CARDS.map((card) => card.id)
	},
	catalog: EMOTIONS_PLAY_CARDS,
	neutralCards: EMOTIONS_NEUTRAL_CARDS,
	relationFamilies: [
		"kind",
		"part",
		"cause",
		"property",
		"opposite"
	]
};
const USER_SELECTABLE_DECKS = [EMOTIONS_DECK];
const DEFAULT_DECK = EMOTIONS_DECK;
[...USER_SELECTABLE_DECKS];
//#endregion
//#region src/decks/deckBuilder.ts
const DIFFICULTIES = [
	"easy",
	"medium",
	"hard"
];
const getEmptyCardsByDifficulty = () => ({
	easy: [],
	medium: [],
	hard: []
});
const getCountsByDifficulty = (cards) => cards.reduce((counts, card) => {
	if (card.difficulty) counts[card.difficulty] += 1;
	return counts;
}, { ...EMPTY_DIFFICULTY_COUNTS });
const getEnabledClassifiedCardsByDifficulty = (catalog) => getEnabledCards(catalog).reduce((cardsByDifficulty, card) => {
	if (card.difficulty) cardsByDifficulty[card.difficulty] = [...cardsByDifficulty[card.difficulty], card];
	return cardsByDifficulty;
}, getEmptyCardsByDifficulty());
const createBuiltDeck = (definitionId, cards) => ({
	definitionId,
	cardDefinitionIds: cards.map((card) => card.id),
	cards: [...cards],
	totalCards: cards.length,
	countsByDifficulty: getCountsByDifficulty(cards)
});
function validateTargetSize(targetSize, definitionId) {
	if (typeof targetSize !== "number") return [];
	return Number.isInteger(targetSize) && targetSize > 0 ? [] : [{
		type: "invalid-target-size",
		message: `Deck "${definitionId}" has invalid target size "${targetSize}".`
	}];
}
function validateRatio(ratio, definitionId) {
	const weights = DIFFICULTIES.map((difficulty) => ratio[difficulty]);
	const hasOnlyValidWeights = weights.every((weight) => Number.isFinite(weight) && weight >= 0);
	const hasPositiveWeight = weights.some((weight) => weight > 0);
	return hasOnlyValidWeights && hasPositiveWeight ? [] : [{
		type: "invalid-ratio",
		message: `Deck "${definitionId}" has invalid mixed ratio.`
	}];
}
function validateDeckDefinition(definition, catalog) {
	catalog = definition.catalog ?? catalog;
	const issues = [];
	const enabledCardsById = new Map(getEnabledCards(catalog).map((card) => [card.id, card]));
	const cardsByDifficulty = getEnabledClassifiedCardsByDifficulty(catalog);
	if (definition.source.type === "custom") {
		const seenCardIds = /* @__PURE__ */ new Set();
		if (definition.source.cardIds.length === 0) issues.push({
			type: "empty-custom-deck",
			message: `Deck "${definition.id}" contains no cards.`
		});
		definition.source.cardIds.forEach((cardId) => {
			if (!enabledCardsById.has(cardId)) issues.push({
				type: "unknown-card-id",
				message: `Deck "${definition.id}" references unknown or disabled card id "${cardId}".`
			});
			if (seenCardIds.has(cardId)) issues.push({
				type: "duplicate-card-id",
				message: `Deck "${definition.id}" contains duplicate card id "${cardId}".`
			});
			seenCardIds.add(cardId);
		});
	}
	if (definition.source.type === "difficulty") {
		if (cardsByDifficulty[definition.source.difficulty].length === 0) issues.push({
			type: "unknown-card-id",
			message: `Deck "${definition.id}" contains no enabled ${definition.source.difficulty} cards.`
		});
	}
	if (definition.source.type === "mixed-ratio") {
		issues.push(...validateRatio(definition.source.ratio, definition.id));
		issues.push(...validateTargetSize(definition.source.targetSize, definition.id));
	}
	return issues;
}
const assertValidDeck = (definition, catalog) => {
	const issues = validateDeckDefinition(definition, catalog);
	if (issues.length > 0) throw new Error(issues[0].message);
};
const takeTargetSize = (cards, targetSize, definition) => {
	if (targetSize === void 0) return [...cards];
	if (targetSize > cards.length) throw new Error(`Deck "${definition.id}" requires ${targetSize} cards, but only ${cards.length} matching cards are available.`);
	return cards.slice(0, targetSize);
};
const getMixedRatioTargetSize = (definition, options) => {
	if (definition.source.type !== "mixed-ratio") return options?.targetSize;
	return options?.targetSize ?? definition.source.targetSize;
};
function allocateMixedRatioCounts(cardsByDifficulty, ratio, targetSize) {
	const totalWeight = DIFFICULTIES.reduce((total, difficulty) => total + ratio[difficulty], 0);
	const allocation = { ...EMPTY_DIFFICULTY_COUNTS };
	const remainders = DIFFICULTIES.map((difficulty) => {
		const exact = targetSize * ratio[difficulty] / totalWeight;
		allocation[difficulty] = Math.min(Math.floor(exact), cardsByDifficulty[difficulty].length);
		return {
			difficulty,
			remainder: exact - Math.floor(exact)
		};
	});
	let remaining = targetSize - DIFFICULTIES.reduce((total, difficulty) => total + allocation[difficulty], 0);
	while (remaining > 0) {
		const availableDifficulty = [...remainders].sort((a, b) => b.remainder - a.remainder).find(({ difficulty }) => allocation[difficulty] < cardsByDifficulty[difficulty].length)?.difficulty;
		if (!availableDifficulty) break;
		allocation[availableDifficulty] += 1;
		remaining -= 1;
	}
	return allocation;
}
function buildDeck(catalog, definition, options) {
	catalog = definition.catalog ?? catalog;
	assertValidDeck(definition, catalog);
	const enabledCards = getEnabledCards(catalog);
	if (definition.source.type === "difficulty") {
		const difficulty = definition.source.difficulty;
		const cards = takeTargetSize(enabledCards.filter((card) => card.difficulty === difficulty), options?.targetSize, definition);
		return createBuiltDeck(definition.id, cards);
	}
	if (definition.source.type === "mixed-all") {
		const cards = enabledCards.filter((card) => Boolean(card.difficulty));
		return createBuiltDeck(definition.id, cards);
	}
	if (definition.source.type === "mixed-ratio") {
		const cardsByDifficulty = getEnabledClassifiedCardsByDifficulty(catalog);
		const availableCards = DIFFICULTIES.flatMap((difficulty) => cardsByDifficulty[difficulty]);
		const targetSize = getMixedRatioTargetSize(definition, options);
		if (targetSize === void 0) return createBuiltDeck(definition.id, availableCards);
		if (targetSize > availableCards.length) throw new Error(`Deck "${definition.id}" requires ${targetSize} cards, but only ${availableCards.length} matching cards are available.`);
		const allocation = allocateMixedRatioCounts(cardsByDifficulty, definition.source.ratio, targetSize);
		const cards = DIFFICULTIES.flatMap((difficulty) => cardsByDifficulty[difficulty].slice(0, allocation[difficulty]));
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
function validateDeckCapacity(deckSize, playerCount, handSize) {
	const requiredCards = playerCount * handSize;
	const valid = deckSize >= requiredCards;
	return {
		valid,
		requiredCards,
		availableCards: deckSize,
		message: valid ? void 0 : `В выбранной колоде недостаточно карт для ${playerCount} игроков. Нужно минимум ${requiredCards}, доступно ${deckSize}.`
	};
}
//#endregion
//#region src/scoring/semanticRelations.ts
const RELATION_PRESETS = [
	{
		family: "kind",
		fromRole: "kind",
		toRole: "general"
	},
	{
		family: "part",
		fromRole: "part",
		toRole: "whole"
	},
	{
		family: "cause",
		fromRole: "cause",
		toRole: "effect"
	},
	{
		family: "property",
		fromRole: "property",
		toRole: "property-bearer"
	},
	{
		family: "opposite",
		symmetric: true
	}
];
const ALL_RELATION_PRESETS = RELATION_PRESETS;
function isSymmetricRelation(relation) {
	return relation.family === "opposite";
}
function getRelationPresets(snapshot) {
	if (!snapshot?.relationFamilies) return RELATION_PRESETS;
	return snapshot.relationFamilies.flatMap((family) => {
		const preset = ALL_RELATION_PRESETS.find((relation) => relation.family === family);
		return preset ? [preset] : [];
	});
}
function isRelationAllowed(relation, snapshot) {
	const preset = getRelationPresets(snapshot).find((item) => item.family === relation.family);
	if (!preset) return false;
	if (isSymmetricRelation(preset)) return isSymmetricRelation(relation) && relation.symmetric === true;
	return !isSymmetricRelation(relation) && relation.fromRole === preset.fromRole && relation.toRole === preset.toRole;
}
function getPathConnectivitySignature(edge) {
	if (isSymmetricRelation(edge.relation)) return `${edge.relation.family}:symmetric`;
	return `${edge.relation.family}:${edge.relation.fromRole}->${edge.relation.toRole}`;
}
function getNodeConnectivitySignature(edge, centerCardInstanceId) {
	if (edge.fromCardInstanceId !== centerCardInstanceId && edge.toCardInstanceId !== centerCardInstanceId) return null;
	if (isSymmetricRelation(edge.relation)) return `${edge.relation.family}:symmetric-node`;
	const centerRole = edge.fromCardInstanceId === centerCardInstanceId ? edge.relation.fromRole : edge.relation.toRole;
	const outerRole = edge.fromCardInstanceId === centerCardInstanceId ? edge.relation.toRole : edge.relation.fromRole;
	return `${edge.relation.family}:center=${centerRole}:outer=${outerRole}`;
}
function getBoardKey$1(coordinates) {
	return `${coordinates.x},${coordinates.y}`;
}
function createSemanticEdgeFromPending(pendingMove, pendingEdge, placedCard) {
	const moveId = pendingMove.moveId ?? pendingMove.id ?? pendingMove.cardId;
	const placedBySeatIndex = pendingMove.placedBySeatIndex ?? pendingMove.playerIndex ?? pendingMove.playerId ?? 0;
	if (pendingEdge.direction === "neighbor-to-new") return {
		id: pendingEdge.id,
		fromCardInstanceId: pendingEdge.neighborCardInstanceId,
		toCardInstanceId: placedCard.id,
		fromPosition: pendingEdge.neighborPosition,
		toPosition: placedCard.coordinates,
		relation: pendingEdge.relation,
		createdBySeatIndex: placedBySeatIndex,
		createdAtMoveId: moveId,
		createdOrder: pendingEdge.createdOrder
	};
	return {
		id: pendingEdge.id,
		fromCardInstanceId: placedCard.id,
		toCardInstanceId: pendingEdge.neighborCardInstanceId,
		fromPosition: placedCard.coordinates,
		toPosition: pendingEdge.neighborPosition,
		relation: pendingEdge.relation,
		createdBySeatIndex: placedBySeatIndex,
		createdAtMoveId: moveId,
		createdOrder: pendingEdge.createdOrder
	};
}
function formatSemanticRelation(edge, namesById) {
	const fromName = namesById.get(edge.fromCardInstanceId) ?? "Карта";
	const toName = namesById.get(edge.toCardInstanceId) ?? "Карта";
	if (edge.relation.family === "kind") return `${fromName} — вид ${toName}`;
	if (edge.relation.family === "part") return `${fromName} — часть ${toName}`;
	if (edge.relation.family === "cause") return `${fromName} — причина ${toName}`;
	if (edge.relation.family === "property") return `${fromName} — свойство ${toName}`;
	return `${fromName} противоположна ${toName}`;
}
//#endregion
//#region src/scoring/semanticNodes.ts
const getOtherCardId = (edge, cardId) => {
	if (edge.fromCardInstanceId === cardId) return edge.toCardInstanceId;
	if (edge.toCardInstanceId === cardId) return edge.fromCardInstanceId;
	return null;
};
const getCardOwner$1 = (board, cardId) => Object.values(board).find((card) => card.id === cardId)?.playerId;
function continuesSemanticNode(board, edge, graphEdges, activeSeatIndex) {
	return [edge.fromCardInstanceId, edge.toCardInstanceId].some((centerCardId) => {
		const outerCardId = getOtherCardId(edge, centerCardId);
		if (!outerCardId || getCardOwner$1(board, outerCardId) !== activeSeatIndex) return false;
		const signature = getNodeConnectivitySignature(edge, centerCardId);
		if (!signature) return false;
		return graphEdges.some((graphEdge) => {
			const graphOuterCardId = getOtherCardId(graphEdge, centerCardId);
			if (!graphOuterCardId || graphOuterCardId === outerCardId) return false;
			if (getCardOwner$1(board, graphOuterCardId) !== activeSeatIndex) return false;
			return getNodeConnectivitySignature(graphEdge, centerCardId) === signature;
		});
	});
}
//#endregion
//#region src/scoring/semanticPaths.ts
const getCardOwner = (board, cardId) => Object.values(board).find((card) => card.id === cardId)?.playerId;
const getSharedCardForSequence = (edge, candidateEdge) => {
	if (isSymmetricRelation(edge.relation)) return [edge.fromCardInstanceId, edge.toCardInstanceId].find((cardId) => cardId === candidateEdge.fromCardInstanceId || cardId === candidateEdge.toCardInstanceId) ?? null;
	if (edge.fromCardInstanceId === candidateEdge.toCardInstanceId) return edge.fromCardInstanceId;
	if (edge.toCardInstanceId === candidateEdge.fromCardInstanceId) return edge.toCardInstanceId;
	return null;
};
const getCandidateTerminalCardId = (candidateEdge, sharedCardInstanceId) => candidateEdge.fromCardInstanceId === sharedCardInstanceId ? candidateEdge.toCardInstanceId : candidateEdge.fromCardInstanceId;
function checkSemanticPathContinuation(board, edge, graphEdges, activeSeatIndex) {
	const fromOwner = getCardOwner(board, edge.fromCardInstanceId);
	const toOwner = getCardOwner(board, edge.toCardInstanceId);
	const signature = getPathConnectivitySignature(edge);
	if (fromOwner !== activeSeatIndex && toOwner !== activeSeatIndex) return {
		continuesPath: false,
		reason: "new-card-not-owned",
		matchedEdgeIds: []
	};
	let sawCompatibleConnectivity = false;
	let sawDirectionMismatch = false;
	let sawSharedCardNotOwned = false;
	for (const graphEdge of graphEdges) {
		if (getPathConnectivitySignature(graphEdge) !== signature) continue;
		sawCompatibleConnectivity = true;
		const sharedCardInstanceId = getSharedCardForSequence(edge, graphEdge);
		if (!sharedCardInstanceId) {
			sawDirectionMismatch = true;
			continue;
		}
		const sharedCardOwnerSeatIndex = getCardOwner(board, sharedCardInstanceId);
		getCardOwner(board, getCandidateTerminalCardId(graphEdge, sharedCardInstanceId));
		const continuesPath = sharedCardOwnerSeatIndex === activeSeatIndex;
		const reason = continuesPath ? "continues-path" : "shared-card-not-owned";
		if (continuesPath) return {
			continuesPath: true,
			reason,
			sharedCardInstanceId,
			matchedEdgeIds: [graphEdge.id]
		};
		sawSharedCardNotOwned = true;
	}
	return {
		continuesPath: false,
		reason: sawSharedCardNotOwned ? "shared-card-not-owned" : sawDirectionMismatch ? "direction-mismatch" : sawCompatibleConnectivity ? "direction-mismatch" : graphEdges.length > 0 ? "connectivity-mismatch" : "no-compatible-edge",
		matchedEdgeIds: []
	};
}
function continuesSemanticPath(board, edge, graphEdges, activeSeatIndex) {
	return checkSemanticPathContinuation(board, edge, graphEdges, activeSeatIndex).continuesPath;
}
function isSemanticEdgeGeometryValid(board, edge) {
	const fromCard = board[getBoardKey$1(edge.fromPosition)];
	const toCard = board[getBoardKey$1(edge.toPosition)];
	return fromCard?.id === edge.fromCardInstanceId && toCard?.id === edge.toCardInstanceId;
}
//#endregion
//#region src/scoring/calculateSemanticMoveScore.ts
function calculateSemanticMoveScore({ board, existingEdges, pendingMove, activeSeatIndex }) {
	const placedCard = board[`${pendingMove.position.x},${pendingMove.position.y}`];
	if (!placedCard || placedCard.id !== pendingMove.cardId) return {
		edges: [],
		total: 0
	};
	const graphEdges = [...existingEdges];
	const scores = [...pendingMove.semanticEdges].sort((a, b) => a.createdOrder - b.createdOrder).map((pendingEdge) => {
		const semanticEdge = createSemanticEdgeFromPending({
			moveId: pendingMove.moveId,
			cardId: pendingMove.cardId,
			cardName: placedCard.cardName,
			playerIndex: pendingMove.placedBySeatIndex,
			reviewerIndex: pendingMove.placedBySeatIndex,
			placedBySeatIndex: pendingMove.placedBySeatIndex,
			position: pendingMove.position,
			semanticEdges: pendingMove.semanticEdges
		}, pendingEdge, placedCard);
		const isValidGeometry = isSemanticEdgeGeometryValid(board, semanticEdge);
		const continuesPath = isValidGeometry && continuesSemanticPath(board, semanticEdge, graphEdges, activeSeatIndex);
		const continuesNode = isValidGeometry && continuesSemanticNode(board, semanticEdge, graphEdges, activeSeatIndex);
		const pathBonus = continuesPath ? 1 : 0;
		const nodeBonus = continuesNode ? 1 : 0;
		const total = 1 + pathBonus + nodeBonus;
		if (isValidGeometry) graphEdges.push(semanticEdge);
		return {
			pendingEdgeId: pendingEdge.id,
			baseScore: 1,
			pathBonus,
			nodeBonus,
			total,
			continuesPath,
			continuesNode
		};
	});
	return {
		edges: scores,
		total: scores.reduce((total, edge) => total + edge.total, 0)
	};
}
//#endregion
//#region src/game.ts
const BOARD_CENTER = {
	x: 7,
	y: 7
};
const HAND_SIZE = 5;
const SCORING_VERSION = 3;
const SAME_NAME_PLACEMENT_WARNING = "Нельзя ставить одинаковые понятия рядом.";
function getRandomStartingPlayerIndex(playerCount, randomSource = Math.random) {
	const normalizedPlayerCount = Math.max(1, Math.floor(playerCount));
	return Math.min(normalizedPlayerCount - 1, Math.floor(randomSource() * normalizedPlayerCount));
}
function shuffleCards(cards) {
	const result = [...cards];
	for (let i = result.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[result[i], result[j]] = [result[j], result[i]];
	}
	return result;
}
function getSnapshotCards(snapshot, fallbackCatalog = CARD_CATALOG) {
	const cardsById = new Map((snapshot.cards ?? fallbackCatalog).map((card) => [card.id, card]));
	return snapshot.cardDefinitionIds.map((id) => {
		const card = cardsById.get(id);
		if (!card) throw new Error(`Карта «${id}» из сохранённой колоды недоступна.`);
		return { ...card };
	});
}
function initializeGame(playerCount = 2, deckDefinition = DEFAULT_DECK, startingPlayerIndex, existingSnapshot) {
	const normalizedPlayerCount = Math.min(Math.max(playerCount, 2), 4);
	const normalizedStartingPlayerIndex = typeof startingPlayerIndex === "number" ? Math.min(Math.max(Math.floor(startingPlayerIndex), 0), normalizedPlayerCount - 1) : getRandomStartingPlayerIndex(normalizedPlayerCount);
	const cards = existingSnapshot ? getSnapshotCards(existingSnapshot, deckDefinition.catalog ?? CARD_CATALOG) : buildDeck(CARD_CATALOG, deckDefinition).cards;
	const neutralCards = (existingSnapshot?.neutralCards ?? deckDefinition.neutralCards ?? START_CARD_CATALOG).filter((card) => card.enabled !== false);
	if (!neutralCards.length) throw new Error("В выбранной колоде нет нейтральных карт.");
	const relationFamilies = existingSnapshot?.relationFamilies ?? deckDefinition.relationFamilies ?? getRelationPresets().map((relation) => relation.family);
	const snapshot = {
		sourceDeckId: existingSnapshot?.sourceDeckId ?? deckDefinition.id,
		cardDefinitionIds: cards.map((card) => card.id),
		cards: cards.map((card) => ({ ...card })),
		neutralCards: neutralCards.map((card) => ({ ...card })),
		relationFamilies: [...relationFamilies],
		createdAt: existingSnapshot?.createdAt ?? (/* @__PURE__ */ new Date()).toISOString()
	};
	if (!relationFamilies.length || getRelationPresets(snapshot).length !== relationFamilies.length) throw new Error("Набор связей выбранной колоды недоступен.");
	const capacity = validateDeckCapacity(cards.length, normalizedPlayerCount, HAND_SIZE);
	if (!capacity.valid) throw new Error(capacity.message);
	const sharedDeck = shuffleCards(cards.map((card) => card.name));
	const players = Array.from({ length: normalizedPlayerCount }, (_, playerId) => ({
		playerId,
		cards: sharedDeck.splice(-5)
	}));
	const decks = players.map(() => []);
	const startDefinition = neutralCards[Math.floor(Math.random() * neutralCards.length)];
	const startCardName = startDefinition.name;
	const startCard = {
		id: `start_card_${Date.now()}_${Math.random()}`,
		definitionId: startDefinition.id,
		cardName: startCardName,
		coordinates: BOARD_CENTER,
		playerId: null,
		status: "confirmed",
		connections: []
	};
	return {
		board: { [`${BOARD_CENTER.x},${BOARD_CENTER.y}`]: startCard },
		players,
		currentPlayerIndex: normalizedStartingPlayerIndex,
		deck: decks,
		sharedDeck,
		deckSnapshot: snapshot,
		handRedrawUsedByPlayerId: Object.fromEntries(players.map((player) => [player.playerId, false])),
		startCard,
		lastPlacedCardId: startCard.id,
		pendingMove: null,
		pendingCross: null,
		pendingTurnScore: null,
		crosses: [],
		semanticEdges: [],
		scoringVersion: SCORING_VERSION,
		scores: Array.from({ length: normalizedPlayerCount }, () => 0),
		log: [],
		gameOver: false
	};
}
function getBoardKey(coordinates) {
	return `${coordinates.x},${coordinates.y}`;
}
function getAdjacentCoordinates(coordinates) {
	return [
		{
			x: coordinates.x,
			y: coordinates.y - 1
		},
		{
			x: coordinates.x,
			y: coordinates.y + 1
		},
		{
			x: coordinates.x - 1,
			y: coordinates.y
		},
		{
			x: coordinates.x + 1,
			y: coordinates.y
		}
	];
}
function hasSameNameOrthogonalNeighbor(board, coordinates, cardName) {
	return getAdjacentCoordinates(coordinates).some((adjacentCoordinates) => {
		return board[getBoardKey(adjacentCoordinates)]?.cardName === cardName;
	});
}
function getPlayerLabel(playerId) {
	return `Игрок ${playerId + 1}`;
}
function getPendingMovePlayerIndex(pendingMove) {
	return pendingMove.playerIndex ?? pendingMove.playerId ?? null;
}
function getPendingMoveReviewerIndex(pendingMove) {
	return pendingMove.reviewerIndex ?? pendingMove.reviewerId ?? null;
}
function isPlacedAnchor(card) {
	return card.playerId === null || card.status === "confirmed";
}
function ensureScoreCapacity(scores, playerCount) {
	const nextScores = [...scores];
	while (nextScores.length < playerCount) nextScores.push(0);
	return nextScores;
}
function createTurnScoreResult(playerId, cardName, semanticScore, newTotalScore) {
	return {
		playerId,
		cardName,
		semanticScore,
		edgeCount: semanticScore.edges.length,
		totalGained: semanticScore.total,
		newTotalScore
	};
}
function formatTurnScoreLog(turnScore) {
	return `${getPlayerLabel(turnScore.playerId)} сыграл «${turnScore.cardName}». ${turnScore.edgeCount ?? 0} связи, +${turnScore.totalGained}.`;
}
function drawToHand(cards, deck) {
	const newCards = [...cards];
	const drawnCard = deck.at(-1);
	if (newCards.length < HAND_SIZE && drawnCard) newCards.push(drawnCard);
	return newCards;
}
function getHandRedrawAvailability(gameState, playerIndex) {
	if (gameState.gameOver) return {
		canRedraw: false,
		reason: "Партия завершена."
	};
	if (gameState.pendingMove || gameState.pendingCross) return {
		canRedraw: false,
		reason: "Пересдача доступна только до розыгрыша карты."
	};
	if (gameState.currentPlayerIndex !== playerIndex) return {
		canRedraw: false,
		reason: "Пересдача доступна только в свой ход."
	};
	if (gameState.handRedrawUsedByPlayerId?.[playerIndex]) return {
		canRedraw: false,
		reason: "Пересдача уже использована."
	};
	const currentHandSize = gameState.players[playerIndex]?.cards.length ?? 0;
	const deckSize = (gameState.sharedDeck ?? gameState.deck[playerIndex])?.length ?? 0;
	if (currentHandSize <= 0) return {
		canRedraw: false,
		reason: "В руке нет карт для пересдачи."
	};
	if (deckSize < currentHandSize) return {
		canRedraw: false,
		reason: "В колоде недостаточно карт для полной пересдачи."
	};
	return { canRedraw: true };
}
function redrawPlayerHand(gameState, playerIndex) {
	if (!getHandRedrawAvailability(gameState, playerIndex).canRedraw) return gameState;
	const oldHand = gameState.players[playerIndex].cards;
	const handSize = oldHand.length;
	const currentDeck = gameState.sharedDeck ?? gameState.deck[playerIndex];
	const newHand = currentDeck.slice(-handSize);
	const remainingDeck = currentDeck.slice(0, -handSize);
	const nextDeckForPlayer = [...oldHand, ...remainingDeck];
	return {
		...gameState,
		players: gameState.players.map((player, index) => index === playerIndex ? {
			...player,
			cards: newHand
		} : player),
		sharedDeck: gameState.sharedDeck !== void 0 ? nextDeckForPlayer : void 0,
		deck: gameState.sharedDeck !== void 0 ? gameState.deck : gameState.deck.map((deck, index) => index === playerIndex ? nextDeckForPlayer : deck),
		handRedrawUsedByPlayerId: {
			...gameState.handRedrawUsedByPlayerId ?? {},
			[playerIndex]: true
		}
	};
}
function getSemanticEdges(gameState) {
	return gameState.semanticEdges ?? [];
}
function getMoveId(pendingMove) {
	return pendingMove.moveId ?? pendingMove.id ?? pendingMove.cardId;
}
function getPlacedCardForPendingMove(board, pendingMove) {
	return Object.values(board).find((card) => card.id === pendingMove.cardId) ?? null;
}
function getPendingMovePosition(board, pendingMove) {
	return pendingMove.position ?? getPlacedCardForPendingMove(board, pendingMove)?.coordinates ?? null;
}
function getPhysicalSemanticNeighbors(gameState, pendingMove = gameState.pendingMove) {
	if (!pendingMove) return [];
	const position = getPendingMovePosition(gameState.board, pendingMove);
	if (!position) return [];
	return getAdjacentCoordinates(position).map((coordinates) => gameState.board[getBoardKey(coordinates)]).filter((card) => Boolean(card) && card.status === "confirmed");
}
function getPendingScorePreview(gameState, pendingMove) {
	const position = getPendingMovePosition(gameState.board, pendingMove);
	const placedBySeatIndex = pendingMove.placedBySeatIndex ?? getPendingMovePlayerIndex(pendingMove);
	if (!position || placedBySeatIndex === null || !pendingMove.semanticEdges?.length) return {
		edges: [],
		total: 0
	};
	return calculateSemanticMoveScore({
		board: gameState.board,
		existingEdges: getSemanticEdges(gameState),
		pendingMove: {
			moveId: getMoveId(pendingMove),
			cardId: pendingMove.cardId,
			position,
			placedBySeatIndex,
			semanticEdges: pendingMove.semanticEdges
		},
		activeSeatIndex: placedBySeatIndex
	});
}
function upsertPendingSemanticEdge(gameState, neighborCardInstanceId, relation, direction) {
	if (!gameState.pendingMove) return gameState;
	if (gameState.pendingMove.semanticStatus === "voting") return gameState;
	if (!isRelationAllowed(relation, gameState.deckSnapshot)) return gameState;
	if (direction !== "new-to-neighbor" && direction !== "neighbor-to-new") return gameState;
	const neighbor = getPhysicalSemanticNeighbors(gameState).find((card) => card.id === neighborCardInstanceId);
	if (!neighbor) return gameState;
	const currentEdges = gameState.pendingMove.semanticEdges ?? [];
	const existingEdge = currentEdges.find((edge) => edge.neighborCardInstanceId === neighborCardInstanceId);
	const nextEdge = {
		id: existingEdge?.id ?? `edge_${Date.now()}_${Math.random()}`,
		neighborPosition: neighbor.coordinates,
		neighborCardInstanceId,
		relation,
		direction,
		createdOrder: existingEdge?.createdOrder ?? currentEdges.length
	};
	const semanticEdges = existingEdge ? currentEdges.map((edge) => edge.id === existingEdge.id ? nextEdge : edge) : [...currentEdges, nextEdge];
	const pendingMove = {
		...gameState.pendingMove,
		semanticStatus: "defining-relations",
		semanticEdges
	};
	return {
		...gameState,
		pendingMove: {
			...pendingMove,
			scorePreview: getPendingScorePreview(gameState, pendingMove)
		}
	};
}
function removePendingSemanticEdge(gameState, neighborCardInstanceId) {
	if (!gameState.pendingMove) return gameState;
	if (gameState.pendingMove.semanticStatus === "voting") return gameState;
	const semanticEdges = (gameState.pendingMove.semanticEdges ?? []).filter((edge) => edge.neighborCardInstanceId !== neighborCardInstanceId).map((edge, index) => ({
		...edge,
		createdOrder: index
	}));
	const pendingMove = {
		...gameState.pendingMove,
		semanticEdges
	};
	return {
		...gameState,
		pendingMove: {
			...pendingMove,
			scorePreview: getPendingScorePreview(gameState, pendingMove)
		}
	};
}
function submitPendingSemanticMove(gameState) {
	if (!gameState.pendingMove) return gameState;
	if (!gameState.pendingMove.semanticEdges?.length) return gameState;
	if (!gameState.pendingMove.semanticEdges.every((edge) => isRelationAllowed(edge.relation, gameState.deckSnapshot) && (edge.direction === "new-to-neighbor" || edge.direction === "neighbor-to-new"))) return gameState;
	const scorePreview = getPendingScorePreview(gameState, gameState.pendingMove);
	if (scorePreview.total <= 0) return gameState;
	return {
		...gameState,
		pendingMove: {
			...gameState.pendingMove,
			semanticStatus: "voting",
			status: "voting",
			scorePreview
		}
	};
}
function canPlaceCard(gameState, coordinates, cardName) {
	if (gameState.pendingMove || gameState.pendingCross) return false;
	const key = getBoardKey(coordinates);
	if (gameState.board[key]) return false;
	if (cardName && hasSameNameOrthogonalNeighbor(gameState.board, coordinates, cardName)) return false;
	return getAdjacentCoordinates(coordinates).some((adjacentCoordinates) => {
		const adjacentCard = gameState.board[getBoardKey(adjacentCoordinates)];
		return adjacentCard ? isPlacedAnchor(adjacentCard) : false;
	});
}
function placeCard(gameState, cardName, coordinates) {
	const newBoard = { ...gameState.board };
	const key = getBoardKey(coordinates);
	if (!canPlaceCard(gameState, coordinates, cardName)) {
		if (hasSameNameOrthogonalNeighbor(gameState.board, coordinates, cardName)) console.warn(SAME_NAME_PLACEMENT_WARNING);
		return gameState;
	}
	const cardIndex = gameState.players[gameState.currentPlayerIndex].cards.indexOf(cardName);
	if (cardIndex === -1) return gameState;
	const placedCard = {
		id: `card_${Date.now()}_${Math.random()}`,
		definitionId: getCardDefinitionIdByName(cardName, gameState.deckSnapshot?.cards ?? CARD_CATALOG),
		cardName,
		coordinates,
		playerId: gameState.currentPlayerIndex,
		status: "pending",
		connections: []
	};
	newBoard[key] = placedCard;
	const newPlayers = gameState.players.map((player, index) => {
		if (index === gameState.currentPlayerIndex) return {
			...player,
			cards: player.cards.filter((_, cardPosition) => cardPosition !== cardIndex)
		};
		return player;
	});
	const playerIndex = gameState.currentPlayerIndex;
	const moveId = `move_${Date.now()}_${Math.random()}`;
	const reviewerIndex = (playerIndex + 1) % gameState.players.length;
	return {
		...gameState,
		board: newBoard,
		players: newPlayers,
		pendingMove: {
			id: moveId,
			moveId,
			cardId: placedCard.id,
			cardName,
			playerIndex,
			reviewerIndex,
			playerId: playerIndex,
			reviewerId: reviewerIndex,
			placedBySeatIndex: playerIndex,
			position: coordinates,
			status: "defining-relations",
			semanticStatus: "defining-relations",
			semanticEdges: [],
			scorePreview: {
				edges: [],
				total: 0
			}
		},
		lastPlacedCardId: placedCard.id
	};
}
function confirmPendingCard(gameState) {
	if (!gameState.pendingMove) return gameState;
	if (gameState.pendingMove.semanticStatus !== "voting") return gameState;
	if (!gameState.pendingMove.semanticEdges?.length) return gameState;
	if (!gameState.pendingMove.semanticEdges.every((edge) => isRelationAllowed(edge.relation, gameState.deckSnapshot) && (edge.direction === "new-to-neighbor" || edge.direction === "neighbor-to-new"))) return gameState;
	const { cardId, cardName } = gameState.pendingMove;
	const playerIndex = getPendingMovePlayerIndex(gameState.pendingMove);
	const reviewerIndex = getPendingMoveReviewerIndex(gameState.pendingMove);
	if (playerIndex === null || reviewerIndex === null) return gameState;
	const newBoard = Object.fromEntries(Object.entries(gameState.board).map(([key, card]) => [key, card.id === cardId ? {
		...card,
		status: "confirmed"
	} : card]));
	const newPlayers = gameState.players.map((player, index) => {
		if (index !== playerIndex) return player;
		return {
			...player,
			cards: drawToHand(player.cards, gameState.sharedDeck ?? gameState.deck[index])
		};
	});
	const newDeck = gameState.deck.map((deck, index) => {
		if (index === playerIndex && newPlayers[index].cards.length > gameState.players[index].cards.length) return deck.slice(0, -1);
		return deck;
	});
	const confirmedPlacedCard = Object.values(newBoard).find((card) => card.id === cardId);
	if (!confirmedPlacedCard) return gameState;
	const scorePreview = getPendingScorePreview({
		...gameState,
		board: newBoard
	}, gameState.pendingMove);
	const acceptedSemanticEdges = gameState.pendingMove.semanticEdges.map((edge) => createSemanticEdgeFromPending(gameState.pendingMove, edge, confirmedPlacedCard));
	const nextScores = ensureScoreCapacity(gameState.scores, gameState.players.length);
	nextScores[playerIndex] = (nextScores[playerIndex] ?? 0) + scorePreview.total;
	const turnScore = createTurnScoreResult(playerIndex, cardName, scorePreview, nextScores[playerIndex]);
	return {
		...gameState,
		board: newBoard,
		players: newPlayers,
		deck: gameState.sharedDeck !== void 0 ? gameState.deck : newDeck,
		sharedDeck: gameState.sharedDeck !== void 0 ? newPlayers[playerIndex].cards.length > gameState.players[playerIndex].cards.length ? gameState.sharedDeck.slice(0, -1) : gameState.sharedDeck : void 0,
		pendingMove: null,
		pendingCross: null,
		pendingTurnScore: null,
		semanticEdges: [...getSemanticEdges(gameState), ...acceptedSemanticEdges],
		scores: nextScores,
		currentPlayerIndex: reviewerIndex,
		log: [...gameState.log, formatTurnScoreLog(turnScore)],
		logDetails: {
			...gameState.logDetails,
			[gameState.log.length]: {
				score: turnScore,
				relations: acceptedSemanticEdges.map((edge) => formatSemanticRelation(edge, new Map(Object.values(newBoard).map((card) => [card.id, card.cardName]))))
			}
		}
	};
}
function returnPendingCard(gameState) {
	if (!gameState.pendingMove) return gameState;
	const { cardId, cardName } = gameState.pendingMove;
	const playerIndex = getPendingMovePlayerIndex(gameState.pendingMove);
	if (playerIndex === null) return gameState;
	const cardEntry = Object.entries(gameState.board).find(([, card]) => card.id === cardId);
	if (!cardEntry) return gameState;
	const [cardKey] = cardEntry;
	const newBoard = { ...gameState.board };
	delete newBoard[cardKey];
	const newPlayers = gameState.players.map((player, index) => {
		if (index !== playerIndex || player.cards.length >= HAND_SIZE) return player;
		return {
			...player,
			cards: [...player.cards, cardName]
		};
	});
	return {
		...gameState,
		board: newBoard,
		players: newPlayers,
		pendingMove: null,
		pendingTurnScore: null,
		scores: ensureScoreCapacity(gameState.scores, gameState.players.length),
		currentPlayerIndex: playerIndex,
		lastPlacedCardId: gameState.startCard.id
	};
}
function approvePendingCross(gameState) {
	return {
		...gameState,
		pendingCross: null,
		pendingTurnScore: null
	};
}
function rejectPendingCross(gameState) {
	return {
		...gameState,
		pendingCross: null,
		pendingTurnScore: null
	};
}
//#endregion
//#region src/gameActions.ts
function applyGameAction(gameState, action) {
	switch (action.type) {
		case "resetGame": return initializeGame();
		case "placeCard": return placeCard(gameState, action.cardName, action.coordinates);
		case "confirmCard": return confirmPendingCard(gameState);
		case "returnCard": return returnPendingCard(gameState);
		case "redrawHand": return redrawPlayerHand(gameState, action.playerIndex ?? gameState.currentPlayerIndex);
		case "upsertSemanticEdge": return upsertPendingSemanticEdge(gameState, action.neighborCardInstanceId, action.relation, action.direction);
		case "removeSemanticEdge": return removePendingSemanticEdge(gameState, action.neighborCardInstanceId);
		case "submitSemanticMove": return submitPendingSemanticMove(gameState);
		case "cancelPendingMove": return returnPendingCard(gameState);
		case "approveCross": return approvePendingCross(gameState);
		case "rejectCross": return rejectPendingCross(gameState);
	}
}
//#endregion
//#region src/server/secureRoomActions.ts
function applyAuthenticatedAction(room, actor, action, expectedMoveId) {
	const member = room.players.find((player) => player.id === actor);
	if (!member || room.status !== "playing") throw Error("Нет доступа к действиям в этой партии.");
	const activeId = room.turn_order[room.current_turn_index];
	const active = room.players.find((player) => player.id === activeId);
	if (!active) throw Error("Неверная очередь ходов.");
	let game = {
		...room.game_state,
		currentPlayerIndex: active.seatIndex
	};
	const pending = game.pendingMove;
	let turn = room.current_turn_index;
	if (action.type === "confirmCard" || action.type === "returnCard") {
		if (!pending || pending.semanticStatus !== "voting" || expectedMoveId !== pending.cardId) throw Error("Этот ход уже изменился.");
		const author = room.players.find((player) => player.seatIndex === pending.playerIndex)?.id;
		const voters = room.turn_order.filter((id) => id !== author);
		if (actor === author || !voters.includes(actor) || pending.votes?.[actor]) throw Error("Голос недоступен или уже учтён.");
		const votes = {
			...pending.votes,
			[actor]: action.type === "confirmCard" ? "accept" : "reject"
		};
		game = {
			...game,
			pendingMove: {
				...pending,
				requiredVoters: voters,
				votes
			}
		};
		const accepts = voters.filter((id) => votes[id] === "accept").length;
		const remaining = voters.filter((id) => !votes[id]).length;
		const majority = Math.floor(voters.length / 2) + 1;
		if (accepts >= majority) {
			game = applyGameAction(game, { type: "confirmCard" });
			turn = (turn + 1) % room.turn_order.length;
		} else if (accepts + remaining < majority) game = applyGameAction(game, { type: "returnCard" });
	} else {
		if (actor !== activeId) throw Error("Сейчас ход другого игрока.");
		if (![
			"placeCard",
			"redrawHand",
			"upsertSemanticEdge",
			"removeSemanticEdge",
			"submitSemanticMove",
			"cancelPendingMove"
		].includes(action.type)) throw Error("Неизвестное действие.");
		if (pending?.semanticStatus === "voting") throw Error("Дождитесь голосования.");
		if (action.type === "placeCard") {
			const c = action.coordinates;
			if (!c || !Number.isSafeInteger(c.x) || !Number.isSafeInteger(c.y) || Math.abs(c.x) > 1e4 || Math.abs(c.y) > 1e4 || typeof action.cardName !== "string" || !game.players[member.seatIndex].cards.includes(action.cardName)) throw Error("Недопустимая карта или клетка.");
			if (pending) throw Error("Сначала завершите текущий ход.");
		} else if (action.type === "redrawHand") action = {
			type: "redrawHand",
			playerIndex: member.seatIndex
		};
		else {
			if (!pending || pending.playerIndex !== member.seatIndex || expectedMoveId !== pending.cardId) throw Error("Этот ход уже изменился.");
			if (action.type === "upsertSemanticEdge") {
				if (!action.relation || !isRelationAllowed(action.relation, game.deckSnapshot) || !["new-to-neighbor", "neighbor-to-new"].includes(action.direction)) throw Error("Недопустимая связь.");
				action = {
					...action,
					relation: getRelationPresets(game.deckSnapshot).find((preset) => preset.family === action.relation.family)
				};
			}
		}
		const before = game;
		game = applyGameAction(game, action);
		if (game === before) throw Error("Действие нарушает правила игры.");
		if (game.pendingMove && ["placeCard", "submitSemanticMove"].includes(action.type)) {
			const reviewer = room.players.find((player) => player.id === room.turn_order[(turn + 1) % room.turn_order.length]);
			game = {
				...game,
				pendingMove: {
					...game.pendingMove,
					placedByPlayerId: actor,
					placedBySeatIndex: member.seatIndex,
					requiredVoters: room.turn_order.filter((id) => id !== actor),
					votes: {},
					reviewerIndex: reviewer.seatIndex,
					reviewerId: reviewer.seatIndex
				}
			};
		}
	}
	const nextSeat = room.players.find((player) => player.id === room.turn_order[turn]).seatIndex;
	return {
		...room,
		game_state: {
			...game,
			currentPlayerIndex: nextSeat
		},
		current_turn_index: turn,
		version: room.version + 1
	};
}
//#endregion
//#region server/room-command.ts
const admin = createClient(Deno.env.get("SUPABASE_URL"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"), { auth: {
	persistSession: false,
	autoRefreshToken: false
} });
const headers = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
	"Content-Type": "application/json"
};
const nickname = (value) => {
	if (typeof value !== "string" || !value.trim() || value.length > 40) throw Error("Имя должно содержать от 1 до 40 символов.");
	return value.trim();
};
const player = (id, name, seat) => ({
	id,
	nickname: name,
	seatIndex: seat,
	color: [
		"blue",
		"orange",
		"green",
		"purple"
	][seat],
	isHost: seat === 0,
	connected: true,
	joinedAt: (/* @__PURE__ */ new Date()).toISOString()
});
Deno.serve(async (request) => {
	if (request.method === "OPTIONS") return new Response("ok", { headers });
	if (request.method !== "POST") return new Response("{}", {
		status: 405,
		headers
	});
	try {
		const token = request.headers.get("Authorization")?.replace(/^Bearer /i, "");
		if (!token) return new Response("{\"error\":\"Требуется гостевой вход.\"}", {
			status: 401,
			headers
		});
		const { data: identity, error: authError } = await admin.auth.getUser(token);
		if (authError || !identity.user) return new Response("{\"error\":\"Войдите гостем повторно.\"}", {
			status: 401,
			headers
		});
		const actor = identity.user.id;
		const reader = request.body?.getReader();
		if (!reader) throw Error("Пустой запрос.");
		const decoder = new TextDecoder();
		let raw = "";
		let size = 0;
		while (true) {
			const chunk = await reader.read();
			if (chunk.done) break;
			size += chunk.value.byteLength;
			if (size > 12e3) {
				await reader.cancel();
				throw Error("Запрос слишком большой.");
			}
			raw += decoder.decode(chunk.value, { stream: true });
		}
		raw += decoder.decode();
		const body = JSON.parse(raw);
		if (!body || typeof body !== "object") throw Error("Неверный запрос.");
		const operation = body.operation;
		if (![
			"create",
			"join",
			"start",
			"delete",
			"action"
		].includes(operation)) throw Error("Неизвестная команда.");
		const { error: limitError } = await admin.rpc("consume_game_quota", {
			actor,
			category: operation === "create" ? "create" : "action"
		});
		if (limitError) return new Response("{\"error\":\"Слишком много запросов. Подождите немного.\"}", {
			status: 429,
			headers
		});
		if (operation === "create") {
			const name = nickname(body.nickname);
			if (![
				2,
				3,
				4
			].includes(body.maxPlayers)) throw Error("Можно выбрать от 2 до 4 игроков.");
			const deck = USER_SELECTABLE_DECKS.find((deck) => deck.id === body.deckId);
			if (!deck) throw Error("Колода недоступна.");
			const game = initializeGame(body.maxPlayers, deck, 0);
			const room = {
				code: crypto.randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase(),
				status: "waiting",
				player_1_id: actor,
				host_player_id: actor,
				player_1_nickname: name,
				max_players: body.maxPlayers,
				players: [player(actor, name, 0)],
				turn_order: [actor],
				current_turn_index: 0,
				game_state: game,
				version: 0,
				protocol_version: 2
			};
			const { data, error } = await admin.from("rooms").insert(room).select("*").single();
			if (error) throw Error("Не удалось создать комнату.");
			return Response.json(data, { headers });
		}
		for (let attempt = 0; attempt < 4; attempt++) {
			let query = admin.from("rooms").select("*").eq("protocol_version", 2);
			if (operation === "join") {
				if (typeof body.code !== "string" || !/^[A-Z0-9]{5,8}$/i.test(body.code)) throw Error("Неверный код комнаты.");
				query = query.eq("code", body.code.toUpperCase());
			} else {
				if (typeof body.roomId !== "string" || !/^[0-9a-f-]{36}$/i.test(body.roomId)) throw Error("Неверная комната.");
				query = query.eq("id", body.roomId);
			}
			const { data, error } = await query.single();
			if (error || !data) throw Error("Комната не найдена или создана в старой версии.");
			const room = data;
			let next = room;
			if (operation === "join") {
				const name = nickname(body.nickname);
				const member = room.players.find((p) => p.id === actor);
				if (!member && (room.status !== "waiting" || room.players.length >= room.max_players)) throw Error("Комната заполнена или партия уже началась.");
				if (room.status === "finished") throw Error("Партия завершена.");
				const seat = [
					0,
					1,
					2,
					3
				].find((i) => i < room.max_players && !room.players.some((p) => p.seatIndex === i));
				const players = member ? room.players.map((p) => p.id === actor ? {
					...p,
					nickname: name,
					connected: true
				} : p) : [...room.players, player(actor, name, seat)];
				next = {
					...room,
					players,
					turn_order: member ? room.turn_order : [...room.turn_order, actor],
					version: room.version + 1
				};
				const ownSeat = member?.seatIndex ?? seat;
				if (ownSeat === 1) {
					next.player_2_id = actor;
					next.player_2_nickname = name;
				}
				if (ownSeat === 0) next.player_1_nickname = name;
			} else if (operation === "start") {
				if (room.host_player_id !== actor || room.status !== "waiting" || room.players.length !== room.max_players) throw Error("Начать игру может хозяин после подключения всех игроков.");
				const turn = Math.floor(Math.random() * room.turn_order.length);
				const seat = room.players.find((p) => p.id === room.turn_order[turn]).seatIndex;
				next = {
					...room,
					status: "playing",
					current_turn_index: turn,
					version: room.version + 1,
					game_state: initializeGame(room.max_players, USER_SELECTABLE_DECKS.find((d) => d.id === room.game_state.deckSnapshot?.sourceDeckId), seat, room.game_state.deckSnapshot)
				};
			} else if (operation === "delete") {
				if (room.host_player_id !== actor) throw Error("Удалять комнату может только хозяин.");
				const result = await admin.from("rooms").delete().eq("id", room.id).eq("version", room.version).select("*").maybeSingle();
				if (result.error) throw Error("Не удалось удалить комнату.");
				if (result.data) return Response.json(result.data, { headers });
				continue;
			} else {
				if (!body.action || typeof body.action.type !== "string") throw Error("Неверное действие.");
				if (!["confirmCard", "returnCard"].includes(body.action.type) && body.expectedVersion !== room.version) throw Error("Состояние комнаты изменилось. Повторите действие.");
				next = applyAuthenticatedAction(room, actor, body.action, body.moveId);
			}
			const { id: _id, created_at: _created, ...patch } = next;
			const result = await admin.from("rooms").update({
				...patch,
				updated_at: (/* @__PURE__ */ new Date()).toISOString()
			}).eq("id", room.id).eq("version", room.version).select("*").maybeSingle();
			if (result.error) throw Error("Не удалось сохранить действие.");
			if (result.data) return Response.json(result.data, { headers });
		}
		throw Error("Состояние комнаты изменилось. Повторите действие.");
	} catch (error) {
		return Response.json({ error: error instanceof Error ? error.message : "Ошибка запроса." }, {
			status: 400,
			headers
		});
	}
});
//#endregion
