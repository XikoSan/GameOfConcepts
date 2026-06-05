import type { GameState } from '../game';

export type RoomStatus = 'waiting' | 'playing' | 'finished';

export interface Room {
  id: string;
  code: string;
  status: RoomStatus;
  player_1_id: string;
  player_2_id: string | null;
  // TODO(MVP): Сейчас весь gameState хранится в JSONB. Позже нужно разделить
  // публичное состояние и приватные данные игроков.
  // FIXME(MVP): Рука оппонента технически доступна в клиенте через gameState.
  // Для настоящего мультиплеера нужна серверная валидация.
  game_state: GameState;
  version: number;
  created_at: string;
  updated_at: string;
}
