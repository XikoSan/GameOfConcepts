// Доступные карты в колоде
export const CARD_NAMES = [
  'Сознание',
  'Труд',
  'Деньги',
  'Культура',
  'Эволюция',
  'Государство',
  'Человек',
  'Страх',
  'Информация',
  'Власть',
  'Биология',
  'Свобода',
  'Семья',
  'Искусство',
  'Наука',
  'Язык',
  'Ценность',
  'Рынок',
  'Память',
  'Игра',
];

export const START_CARD_NAMES = [
  'Человек',
  'Общество',
  'Мир',
  'Система',
  'Изменение',
];

export type RegularCardName = (typeof CARD_NAMES)[number];
export type StartCardName = (typeof START_CARD_NAMES)[number];
export type CardName = RegularCardName | StartCardName;
export const CARDS = CARD_NAMES;

// Координаты на бесконечном поле (целые числа)
export interface Coordinates {
  x: number;
  y: number;
}

// Карта, размещённая на доске
export interface PlacedCard {
  id: string;
  cardName: CardName;
  coordinates: Coordinates;
  playerId: 0 | 1 | null;
  status: 'confirmed' | 'pending';
  crossId?: string;
  connections: string[];
}

export interface PendingMove {
  cardId: string;
  cardName: RegularCardName;
  playerIndex: 0 | 1;
  reviewerIndex: 0 | 1;
  playerId?: 0 | 1;
  reviewerId?: 0 | 1;
}

export interface Cross {
  id: string;
  centerX: number;
  centerY: number;
  playerId: 0 | 1;
  cardNames: CardName[];
  points: 5;
}

export interface PendingCross {
  centerX: number;
  centerY: number;
  playerId: 0 | 1;
  cardIds: string[];
  cardNames: CardName[];
  centerCardName: CardName;
  points: 5;
}

export interface TurnScoreResult {
  playerId: 0 | 1;
  cardName: CardName;
  basePoints: number;
  adjacencyBonus: number;
  chainBonus: number;
  crossBonus: number;
  totalGained: number;
  newTotalScore: number;
}

// Рука игрока
export interface PlayerHand {
  playerId: 0 | 1;
  cards: RegularCardName[];
}

// Состояние игры
export interface GameState {
  board: Record<string, PlacedCard>;
  players: [PlayerHand, PlayerHand];
  currentPlayerIndex: 0 | 1;
  deck: [RegularCardName[], RegularCardName[]];
  startCard: PlacedCard;
  lastPlacedCardId: string | null;
  pendingMove: PendingMove | null;
  pendingCross: PendingCross | null;
  pendingTurnScore: TurnScoreResult | null;
  crosses: Cross[];
  scores: [number, number];
  log: string[];
  gameOver: boolean;
}

// Границы видимого поля (для оптимизации рендеринга)
export interface BoardBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}
