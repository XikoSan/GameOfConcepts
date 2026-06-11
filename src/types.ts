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
  playerId: number | null;
  status: 'confirmed' | 'pending';
  crossId?: string;
  connections: string[];
}

export interface PendingMove {
  id?: string;
  cardId: string;
  cardName: RegularCardName;
  playerIndex: number;
  reviewerIndex: number;
  playerId?: number;
  reviewerId?: number;
  fromSeatIndex?: number;
  placedByPlayerId?: string;
  placedBySeatIndex?: number;
  position?: Coordinates;
  requiredVoters?: string[];
  votes?: Record<string, 'accept' | 'reject'>;
  status?: 'voting';
  createdAt?: string;
}

export interface Cross {
  id: string;
  centerX: number;
  centerY: number;
  playerId: number;
  cardNames: CardName[];
  points: 5;
}

export interface PendingCross {
  centerX: number;
  centerY: number;
  playerId: number;
  cardIds: string[];
  cardNames: CardName[];
  centerCardName: CardName;
  points: 5;
}

export interface TurnScoreResult {
  playerId: number;
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
  playerId: number;
  cards: RegularCardName[];
}

// Состояние игры
export interface GameState {
  board: Record<string, PlacedCard>;
  players: PlayerHand[];
  currentPlayerIndex: number;
  deck: RegularCardName[][];
  startCard: PlacedCard;
  lastPlacedCardId: string | null;
  pendingMove: PendingMove | null;
  pendingCross: PendingCross | null;
  pendingTurnScore: TurnScoreResult | null;
  crosses: Cross[];
  scores: number[];
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
