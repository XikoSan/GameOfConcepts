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
  connections: string[];
}

export interface PendingMove {
  cardId: string;
  cardName: RegularCardName;
  playerId: 0 | 1;
  reviewerId: 0 | 1;
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
