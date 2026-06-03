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

export type CardName = (typeof CARD_NAMES)[number];
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
  playerId: number;
  connections: string[];
}

// Рука игрока
export interface PlayerHand {
  playerId: number;
  cards: CardName[];
}

// Состояние игры
export interface GameState {
  board: Record<string, PlacedCard>;
  players: [PlayerHand, PlayerHand];
  currentPlayerIndex: 0 | 1;
  deck: [CardName[], CardName[]];
  gameOver: boolean;
}

// Границы видимого поля (для оптимизации рендеринга)
export interface BoardBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}
