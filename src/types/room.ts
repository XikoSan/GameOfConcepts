import type { GameState } from '../game';

export type RoomStatus = 'waiting' | 'playing' | 'finished';
export type MaxPlayers = 2 | 3 | 4;
export type PlayerColor = 'blue' | 'orange' | 'green' | 'purple';

/**
 * Participant identity inside an online room.
 * seatIndex is stable game identity; it indexes hands, decks, scores, and card ownership.
 */
export interface RoomPlayer {
  id: string;
  nickname: string;
  seatIndex: number;
  color: PlayerColor;
  isHost: boolean;
  connected: boolean;
  joinedAt: string;
}

/**
 * Supabase room row. The canonical multiplayer state is the server row:
 * turn_order/current_turn_index decide whose turn it is, while game_state stores the board.
 */
export interface Room {
  id: string;
  code: string;
  status: RoomStatus;
  player_1_id: string;
  player_2_id: string | null;
  host_player_id: string | null;
  player_1_nickname: string | null;
  player_2_nickname: string | null;
  max_players: MaxPlayers;
  players: RoomPlayer[];
  /** Ordered player ids; current_turn_index points into this array, not directly to a seatIndex. */
  turn_order: string[];
  current_turn_index: number;
  // TODO(MVP): Сейчас весь gameState хранится в JSONB. Позже нужно разделить
  // публичное состояние и приватные данные игроков.
  // FIXME(MVP): Рука оппонента технически доступна в клиенте через gameState.
  // Для настоящего мультиплеера нужна серверная валидация.
  game_state: GameState;
  version: number;
  created_at: string;
  updated_at: string;
}
