import type { RealtimeChannel } from '@supabase/supabase-js';
import { getSupabaseClient } from '../lib/supabaseClient';
import type { GameState } from '../game';
import type { Room } from '../types/room';

const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const ROOM_CODE_LENGTH = 5;

export function generateRoomCode(): string {
  return Array.from({ length: ROOM_CODE_LENGTH }, () =>
    ROOM_CODE_ALPHABET[Math.floor(Math.random() * ROOM_CODE_ALPHABET.length)]
  ).join('');
}

export async function getRoomByCode(code: string): Promise<Room | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('rooms')
    .select('*')
    .eq('code', code.toUpperCase())
    .maybeSingle<Room>();

  if (error) {
    throw error;
  }

  return data;
}

export async function getRoomById(roomId: string): Promise<Room | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('rooms')
    .select('*')
    .eq('id', roomId)
    .maybeSingle<Room>();

  if (error) {
    throw error;
  }

  return data;
}

export async function getOpenRooms(): Promise<Room[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('rooms')
    .select('*')
    .eq('status', 'waiting')
    .order('created_at', { ascending: false })
    .limit(20)
    .returns<Room[]>();

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function getPlayerRooms(playerId: string): Promise<Room[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('rooms')
    .select('*')
    .in('status', ['waiting', 'playing'])
    .or(`player_1_id.eq.${playerId},player_2_id.eq.${playerId}`)
    .order('updated_at', { ascending: false })
    .limit(20)
    .returns<Room[]>();

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function getAvailableRooms(playerId: string): Promise<Room[]> {
  // TEMP(MVP): Список доступных комнат основан на localStorage playerId, без авторизации.
  // FIXME(MVP): waiting-комнаты публичны для всех пользователей с доступом к приложению.
  const [playerRooms, openRooms] = await Promise.all([
    getPlayerRooms(playerId),
    getOpenRooms(),
  ]);
  const roomsById = new Map<string, Room>();

  [...playerRooms, ...openRooms].forEach((room) => {
    roomsById.set(room.id, room);
  });

  return Array.from(roomsById.values()).sort(
    (roomA, roomB) =>
      new Date(roomB.updated_at).getTime() - new Date(roomA.updated_at).getTime()
  );
}

export async function createRoom(
  playerId: string,
  initialGameState: GameState
): Promise<Room> {
  console.log('[roomService createRoom input]', {
    playerId,
    hasInitialGameState: Boolean(initialGameState),
  });
  const supabase = getSupabaseClient();
  const roomCode = generateRoomCode();
  console.log('[roomService createRoom before insert]', {
    code: roomCode,
    status: 'waiting',
  });

  // TODO(MVP): Сейчас весь gameState хранится в JSONB. Позже нужно разделить
  // публичное состояние и приватные данные игроков.
  // FIXME(MVP): Рука оппонента технически доступна в клиенте через gameState.
  // Для настоящего мультиплеера нужна серверная валидация.
  const { data, error } = await supabase
    .from('rooms')
    .insert({
      code: roomCode,
      status: 'waiting',
      player_1_id: playerId,
      game_state: initialGameState,
    })
    .select('*')
    .single<Room>();

  console.log('[roomService createRoom result]', { data, error });

  if (error) {
    console.error('[supabase createRoom error]', error);
    throw error;
  }

  return data;
}

export async function joinRoom(code: string, playerId: string): Promise<Room> {
  const supabase = getSupabaseClient();
  const room = await getRoomByCode(code);

  if (!room) {
    throw new Error('Room not found.');
  }

  if (room.player_1_id === playerId || room.player_2_id === playerId) {
    return room;
  }

  if (room.player_2_id) {
    throw new Error('Room is already full.');
  }

  const { data, error } = await supabase
    .from('rooms')
    .update({
      player_2_id: playerId,
      status: 'playing',
      updated_at: new Date().toISOString(),
    })
    .eq('id', room.id)
    .is('player_2_id', null)
    .select('*')
    .single<Room>();

  if (error) {
    throw error;
  }

  return data;
}

export async function updateRoomGameState(
  roomId: string,
  nextGameState: GameState,
  currentVersion: number
): Promise<Room> {
  const supabase = getSupabaseClient();

  // FIXME(MVP): Одновременные действия двух клиентов могут конфликтовать.
  // Version снижает риск, но позже нужна серверная валидация actions.
  // TODO(MVP): Сейчас весь gameState хранится в JSONB. Позже нужно разделить
  // публичное состояние и приватные данные игроков.
  const { data, error } = await supabase
    .from('rooms')
    .update({
      game_state: nextGameState,
      version: currentVersion + 1,
      updated_at: new Date().toISOString(),
    })
    .eq('id', roomId)
    .eq('version', currentVersion)
    .select('*')
    .maybeSingle<Room>();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error('Room update conflict. Please reload the latest room state.');
  }

  return data;
}

export function subscribeToRoom(
  roomId: string,
  onRoomUpdate: (room: Room) => void,
  onStatusProblem?: () => void
): RealtimeChannel {
  const supabase = getSupabaseClient();

  return supabase
    .channel(`room:${roomId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'rooms',
        filter: `id=eq.${roomId}`,
      },
      (payload) => {
        console.log('[room realtime update raw]', payload);
        console.log('[room realtime update room]', payload.new);
        onRoomUpdate(payload.new as Room);
      }
    )
    .subscribe((status, error) => {
      console.log('[room realtime status]', { roomId, status, error });
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        console.warn('[room realtime status error]', { roomId, status, error });
        onStatusProblem?.();
      }
    });
}
