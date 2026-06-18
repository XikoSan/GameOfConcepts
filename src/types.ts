import {
  CARD_NAMES,
  START_CARD_NAMES,
  type CardDefinition,
  type CardDifficulty,
} from './data/cardCatalog';

/** Regular concept cards that can appear in player hands and decks. */
export { CARD_NAMES, START_CARD_NAMES };
export type { CardDefinition, CardDifficulty };

export type RegularCardName = string;
export type StartCardName = string;
export type CardName = RegularCardName | StartCardName;
export const CARDS = CARD_NAMES;

/** Integer grid coordinates on the conceptual board. */
export interface Coordinates {
  x: number;
  y: number;
}

export interface GameCard {
  instanceId: string;
  definitionId: string;
  name: RegularCardName;
}

/**
 * Board card keyed by coordinates in GameState.board.
 * playerId is a stable seat index; null is the neutral start card.
 */
export interface PlacedCard {
  id: string;
  definitionId?: string;
  cardName: CardName;
  coordinates: Coordinates;
  playerId: number | null;
  /** Pending cards are visible on the board but are not final until voting resolves. */
  status: 'confirmed' | 'pending';
  /** A card can belong to only one approved cross. */
  crossId?: string;
  connections: string[];
}

/**
 * Shared confirmation state for a placed card.
 * In online mode voter keys are playerId strings; in local mode they are seatIndex values.
 */
export interface PendingMove {
  id?: string;
  cardId: string;
  cardName: RegularCardName;
  /** Seat index that placed the card in the original two-player flow. */
  playerIndex: number;
  /** Legacy single-reviewer seat; multiplayer voting uses requiredVoters instead. */
  reviewerIndex: number;
  playerId?: number;
  reviewerId?: number;
  /** Original hand/deck seat for returning the card if the move is rejected. */
  fromSeatIndex?: number;
  /** Online player id that authored the move; this player never votes on it. */
  placedByPlayerId?: string;
  /** Source of truth for scoring and card return ownership. */
  placedBySeatIndex?: number;
  position?: Coordinates;
  /** Voters excluding the author; playerId strings online, seat indexes local. */
  requiredVoters?: Array<string | number>;
  votes?: Record<string, 'accept' | 'reject'>;
  status?: 'voting';
  createdAt?: string;
}

/** Approved cross bonus; playerId is the seat that receives the +5 points. */
export interface Cross {
  id: string;
  centerX: number;
  centerY: number;
  playerId: number;
  cardNames: CardName[];
  points: 5;
}

/** Cross awaiting a separate bonus decision after the underlying move is confirmed. */
export interface PendingCross {
  centerX: number;
  centerY: number;
  playerId: number;
  cardIds: string[];
  cardNames: CardName[];
  centerCardName: CardName;
  points: 5;
}

/** Points gained by a single confirmed move, stored for readable turn logs. */
export interface TurnScoreResult {
  playerId: number;
  cardName: CardName;
  basePoints: number;
  adjacencyBonus: number;
  chainBonus: number;
  crossBonus: number;
  activePlayerTotal: number;
  neighborCount: number;
  neighborOwnerAwards: Record<number, number>;
  totalGained: number;
  newTotalScore: number;
}

/** Pure spatial scoring result for one accepted placement. */
export interface MoveScoreResult {
  placementScore: number;
  adjacencyScore: number;
  chainScore: number;
  crossScore: number;
  activePlayerTotal: number;
  neighborOwnerAwards: Record<number, number>;
  neighborCount: number;
}

export interface GameDeckSnapshot {
  sourceDeckId: string;
  cardDefinitionIds: string[];
  createdAt?: string;
}

/** Player hand indexed by the same stable seat index as deck and scores. */
export interface PlayerHand {
  playerId: number;
  cards: RegularCardName[];
}

/**
 * Complete game state that can be stored locally or serialized to rooms.game_state.
 * Arrays are indexed by stable seatIndex/playerId values, not by UI position.
 */
export interface GameState {
  /** Coordinate-keyed board map: "x,y" -> placed card. */
  board: Record<string, PlacedCard>;
  players: PlayerHand[];
  /** Active seat index in local game state; online derives the active seat from room turn_order. */
  currentPlayerIndex: number;
  deck: RegularCardName[][];
  /** A running game owns a fixed deck snapshot; later catalog edits affect only new games. */
  deckSnapshot?: GameDeckSnapshot;
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

/** Visible board bounds used for rendering optimizations. */
export interface BoardBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}
