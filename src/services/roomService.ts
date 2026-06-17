import type { RealtimeChannel } from '@supabase/supabase-js';
import { getSupabaseClient } from '../lib/supabaseClient';
import { initializeGame } from '../game';
import type { GameState } from '../game';
import type { MaxPlayers, PlayerColor, Room, RoomPlayer } from '../types/room';

const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const ROOM_CODE_LENGTH = 5;
const ROOM_PLAYER_COLORS: PlayerColor[] = ['blue', 'orange', 'green', 'purple'];
const ALLOW_LEGACY_ROOM_FALLBACK = false;
const ROOM_SCHEMA_ERROR_MESSAGE =
  'База данных не обновлена. Нужно применить миграцию rooms для multiplayer-полей и обновить schema cache.';

interface CreateRoomInput {
  playerId: string;
  nickname: string;
  maxPlayers: MaxPlayers;
  initialGameState: GameState;
}

interface JoinRoomInput {
  code: string;
  playerId: string;
  nickname: string;
}

interface StartRoomGameInput {
  roomId: string;
  playerId: string;
}

type RoomInsertPayload = Record<string, unknown>;

function stripUndefined<T extends RoomInsertPayload>(input: T): T {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined)
  ) as T;
}

function isSchemaMismatchError(error: unknown) {
  if (!error || typeof error !== 'object') return false;

  const maybeError = error as { message?: string; code?: string };
  const message = maybeError.message ?? '';
  return (
    maybeError.code === 'PGRST204' ||
    message.includes('Could not find') ||
    (message.includes('column') && message.includes('does not exist')) ||
    message.includes('schema cache')
  );
}

const getRoomMaxPlayers = (room: Room): MaxPlayers => room.max_players ?? 2;

const isCompatibleMultiplayerRoom = (room: Room) =>
  typeof room.max_players === 'number' &&
  Array.isArray(room.players) &&
  Array.isArray(room.turn_order) &&
  typeof room.current_turn_index === 'number';

const getRoomPlayers = (room: Room): RoomPlayer[] => {
  if (Array.isArray(room.players) && room.players.length > 0) {
    return room.players;
  }

  const restoredPlayers: RoomPlayer[] = [];
  const joinedAt = room.created_at;

  if (room.player_1_id) {
    restoredPlayers.push({
      id: room.player_1_id,
      nickname: room.player_1_nickname?.trim() || 'Игрок 1',
      seatIndex: 0,
      color: 'blue',
      isHost: true,
      connected: true,
      joinedAt,
    });
  }

  if (room.player_2_id) {
    restoredPlayers.push({
      id: room.player_2_id,
      nickname: room.player_2_nickname?.trim() || 'Игрок 2',
      seatIndex: 1,
      color: 'orange',
      isHost: false,
      connected: true,
      joinedAt,
    });
  }

  return restoredPlayers;
};

const getNextSeatIndex = (players: RoomPlayer[], maxPlayers: MaxPlayers) => {
  const occupiedSeats = new Set(players.map((player) => player.seatIndex));

  for (let seatIndex = 0; seatIndex < maxPlayers; seatIndex += 1) {
    if (!occupiedSeats.has(seatIndex)) return seatIndex;
  }

  return null;
};

const getRoomPlayerColor = (seatIndex: number): PlayerColor =>
  ROOM_PLAYER_COLORS[seatIndex] ?? 'blue';

const getRoomDebugSnapshot = (room: Room, players = getRoomPlayers(room)) => ({
  maxPlayers: getRoomMaxPlayers(room),
  roomPlayersLength: players.length,
  roomPlayers: players.map((player) => ({
    id: player.id,
    nickname: player.nickname,
    seatIndex: player.seatIndex,
  })),
  gameStatePlayersLength: room.game_state.players.length,
  handsLength: room.game_state.players.length,
  decksLength: room.game_state.deck.length,
  scoresLength: room.game_state.scores.length,
  turnOrder: room.turn_order ?? [],
  currentTurnIndex: room.current_turn_index ?? 0,
});

const normalizePlayerCount = (playerCount: number) =>
  Math.min(Math.max(playerCount, 2), 4);

function ensureGameStateCapacity(
  gameState: GameState,
  requiredCount: number
): GameState {
  const normalizedCount = normalizePlayerCount(requiredCount);
  const currentPlayers = Array.isArray(gameState.players) ? gameState.players : [];
  const currentDeck = Array.isArray(gameState.deck) ? gameState.deck : [];
  const currentScores = Array.isArray(gameState.scores) ? gameState.scores : [];

  // Room rows may be created or resumed with fewer seats than max_players.
  // Grow seat-indexed arrays, but never shrink them because existing card ownership may point there.
  console.debug('[room debug capacity before]', {
    requiredCount: normalizedCount,
    gameStatePlayersLength: currentPlayers.length,
    handsLength: currentPlayers.length,
    decksLength: currentDeck.length,
    scoresLength: currentScores.length,
  });

  if (
    currentPlayers.length >= normalizedCount &&
    currentDeck.length >= normalizedCount &&
    currentScores.length >= normalizedCount
  ) {
    console.debug('[room debug capacity after]', {
      requiredCount: normalizedCount,
      gameStatePlayersLength: currentPlayers.length,
      handsLength: currentPlayers.length,
      decksLength: currentDeck.length,
      scoresLength: currentScores.length,
    });
    return gameState;
  }

  const fallbackGameState = initializeGame(normalizedCount);
  const players = Array.from({ length: normalizedCount }, (_, index) =>
    currentPlayers[index] ?? fallbackGameState.players[index]
  );
  const deck = Array.from({ length: normalizedCount }, (_, index) =>
    currentDeck[index] ?? fallbackGameState.deck[index]
  );
  const scores = Array.from({ length: normalizedCount }, (_, index) =>
    currentScores[index] ?? 0
  );

  const nextGameState = {
    ...gameState,
    players,
    deck,
    scores,
  };

  console.debug('[room debug capacity after]', {
    requiredCount: normalizedCount,
    gameStatePlayersLength: nextGameState.players.length,
    handsLength: nextGameState.players.length,
    decksLength: nextGameState.deck.length,
    scoresLength: nextGameState.scores.length,
  });

  return nextGameState;
}

const getNextTurnOrder = (room: Room, players: RoomPlayer[], playerId: string) => {
  // turn_order is independent from players[] order so reconnects and nickname updates
  // cannot silently change who moves next.
  const sortedPlayerIds = [...players]
    .sort((playerA, playerB) => playerA.seatIndex - playerB.seatIndex)
    .map((player) => player.id);
  const existingTurnOrder = room.turn_order?.filter((id) =>
    sortedPlayerIds.includes(id)
  ) ?? [];
  const baseTurnOrder =
    existingTurnOrder.length > 0
      ? [
          ...existingTurnOrder,
          ...sortedPlayerIds.filter((id) => !existingTurnOrder.includes(id)),
        ]
      : sortedPlayerIds;

  return baseTurnOrder.includes(playerId)
    ? baseTurnOrder
    : [...baseTurnOrder, playerId];
};

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
  // This is the authoritative server snapshot used after reconnects and version conflicts.
  // null means the room was deleted, hidden by policy, or never existed.
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
    .in('status', ['waiting', 'playing'])
    .order('created_at', { ascending: false })
    .limit(20)
    .returns<Room[]>();

  if (error) {
    throw error;
  }

  return (data ?? []).filter(isCompatibleMultiplayerRoom);
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

  return (data ?? []).filter(isCompatibleMultiplayerRoom);
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

export async function createRoom({
  playerId,
  nickname,
  maxPlayers,
  initialGameState,
}: CreateRoomInput): Promise<Room> {
  // Clamp to the supported prototype range; game arrays and color slots are seat-indexed 0..3.
  const normalizedMaxPlayers = normalizePlayerCount(
    Number(maxPlayers) || 2
  ) as MaxPlayers;
  console.log('[roomService createRoom input]', {
    playerId,
    nickname,
    maxPlayers: normalizedMaxPlayers,
    hasInitialGameState: Boolean(initialGameState),
  });
  console.debug('[createRoom maxPlayers]', {
    inputMaxPlayers: maxPlayers,
    normalizedMaxPlayers,
  });
  const supabase = getSupabaseClient();
  const roomCode = generateRoomCode();
  const now = new Date().toISOString();
  const hostPlayer: RoomPlayer = {
    id: playerId,
    nickname,
    seatIndex: 0,
    color: 'blue',
    isHost: true,
    connected: true,
    joinedAt: now,
  };

  // New rooms must be born with players, turn_order, and game_state together.
  // Creating a legacy row would leave clients unable to resolve seats or current turn.
  console.log('[roomService createRoom before insert]', {
    code: roomCode,
    status: 'waiting',
    maxPlayers: normalizedMaxPlayers,
    handsLength: initialGameState.players.length,
    decksLength: initialGameState.deck.length,
    scoresLength: initialGameState.scores.length,
    turnOrder: [playerId],
  });
  console.debug('[room debug create]', {
    maxPlayers: normalizedMaxPlayers,
    roomPlayersLength: 1,
    roomPlayers: [
      {
        id: hostPlayer.id,
        nickname: hostPlayer.nickname,
        seatIndex: hostPlayer.seatIndex,
      },
    ],
    gameStatePlayersLength: initialGameState.players.length,
    handsLength: initialGameState.players.length,
    decksLength: initialGameState.deck.length,
    scoresLength: initialGameState.scores.length,
    turnOrder: [playerId],
    currentTurnIndex: 0,
  });
  console.debug('[capacity debug before create]', {
    maxPlayers: normalizedMaxPlayers,
    playersLength: initialGameState.players.length,
    deckLength: initialGameState.deck.length,
    scoresLength: initialGameState.scores.length,
  });
  const nextGameState = ensureGameStateCapacity(
    initialGameState,
    normalizedMaxPlayers
  );
  console.debug('[capacity debug after create]', {
    maxPlayers: normalizedMaxPlayers,
    playersLength: nextGameState.players.length,
    deckLength: nextGameState.deck.length,
    scoresLength: nextGameState.scores.length,
  });

  // Keep the full state in JSONB for the MVP; privacy and validation move server-side later.
  // TODO(MVP): Сейчас весь gameState хранится в JSONB. Позже нужно разделить
  // публичное состояние и приватные данные игроков.
  // FIXME(MVP): Рука оппонента технически доступна в клиенте через gameState.
  // Для настоящего мультиплеера нужна серверная валидация.
  const fullPayload = stripUndefined({
    code: roomCode,
    status: 'waiting',
    player_1_id: playerId,
    host_player_id: playerId,
    player_1_nickname: nickname,
    max_players: normalizedMaxPlayers,
    players: [hostPlayer],
    turn_order: [playerId],
    current_turn_index: 0,
    version: 0,
    game_state: nextGameState,
  });
  console.debug('[createRoom debug payload]', fullPayload);

  const insertRoom = async (payload: RoomInsertPayload) => {
    const cleanPayload = stripUndefined(payload);
    console.debug('[createRoom debug insert payload]', cleanPayload);
    // .select().single() returns the inserted server row with defaults, ids, and timestamps.
    // The client should not continue from a locally guessed room shape.
    const { data, error, status, statusText } = await supabase
      .from('rooms')
      .insert(cleanPayload)
      .select()
      .single<Room>();

    console.log('[roomService createRoom result]', {
      data,
      error,
      status,
      statusText,
    });
    console.debug('[createRoom debug supabase result]', {
      data,
      error,
      status,
      statusText,
    });

    if (error) {
      console.error('[supabase createRoom error]', error);
      console.error('[createRoom debug error]', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });
      throw error;
    }

    return data;
  };

  try {
    return await insertRoom(fullPayload);
  } catch (error) {
    if (!isSchemaMismatchError(error)) {
      throw error;
    }

    const schemaError =
      error && typeof error === 'object'
        ? (error as {
            code?: string;
            message?: string;
            details?: string;
            hint?: string;
          })
        : null;
    console.error('[createRoom schema error]', {
      message: schemaError?.message,
      details: schemaError?.details,
      hint: schemaError?.hint,
      code: schemaError?.code,
      raw: error,
    });
    console.debug('[createRoom legacy fallback disabled]', {
      allowLegacyRoomFallback: ALLOW_LEGACY_ROOM_FALLBACK,
    });
    // Legacy fallback is intentionally disabled: old two-player rows break 2-4 player
    // turn_order, stable seats, and multiplayer voting invariants.
    throw new Error(ROOM_SCHEMA_ERROR_MESSAGE, { cause: error });
  }
}

export async function joinRoom({
  code,
  playerId,
  nickname,
}: JoinRoomInput): Promise<Room> {
  const supabase = getSupabaseClient();
  const room = await getRoomByCode(code);

  if (!room) {
    throw new Error('Room not found.');
  }

  if (room.status === 'finished') {
    throw new Error('Игра уже завершена.');
  }

  const maxPlayers = getRoomMaxPlayers(room);
  const players = getRoomPlayers(room);
  console.debug('[room debug join before]', getRoomDebugSnapshot(room, players));
  // A reconnecting browser keeps its previous seat; seat indexes must not be recomputed
  // from array position because players[] can be patched or sorted independently.
  const existingPlayer = players.find((player) => player.id === playerId);
  let nextPlayers: RoomPlayer[];
  let joinedSeatIndex = existingPlayer?.seatIndex ?? null;

  if (existingPlayer) {
    nextPlayers = players.map((player) =>
      player.id === playerId
        ? { ...player, nickname, connected: true }
        : player
    );
  } else {
    if (players.length >= maxPlayers) {
      throw new Error('Комната заполнена.');
    }

    // Pick the first free seat, not players.length, so gaps left by old/disconnected
    // entries do not shift ownership of hands, decks, scores, or cards.
    const seatIndex = getNextSeatIndex(players, maxPlayers);
    if (seatIndex === null) {
      throw new Error('Комната заполнена.');
    }

    joinedSeatIndex = seatIndex;
    nextPlayers = [
      ...players,
      {
        id: playerId,
        nickname,
        seatIndex,
        color: getRoomPlayerColor(seatIndex),
        isHost: false,
        connected: true,
        joinedAt: new Date().toISOString(),
      },
    ];
  }
  const requiredPlayerCount = Math.max(
    maxPlayers,
    ...nextPlayers.map((player) => player.seatIndex + 1)
  );
  const nextGameState = ensureGameStateCapacity(room.game_state, requiredPlayerCount);
  const nextTurnOrder = getNextTurnOrder(room, nextPlayers, playerId);

  // TODO(MVP): Для production лучше вынести joinRoom в Postgres RPC с row lock
  // или transaction, чтобы два одновременных входа не перетёрли players[].
  const { data, error } = await supabase
    .from('rooms')
    .update({
      players: nextPlayers,
      turn_order: nextTurnOrder,
      ...(joinedSeatIndex === 0
        ? { player_1_id: playerId, player_1_nickname: nickname }
        : {}),
      ...(joinedSeatIndex === 1
        ? { player_2_id: playerId, player_2_nickname: nickname }
        : {}),
      game_state: nextGameState,
      status:
        room.status === 'waiting' && nextPlayers.length >= 2
          ? 'playing'
          : room.status,
      updated_at: new Date().toISOString(),
    })
    .eq('id', room.id)
    .select('*')
    .single<Room>();

  if (error) {
    throw error;
  }

  console.debug('[room debug join after]', getRoomDebugSnapshot(data));
  return data;
}

export async function startRoomGame({
  roomId,
  playerId,
}: StartRoomGameInput): Promise<Room> {
  const supabase = getSupabaseClient();
  const room = await getRoomById(roomId);

  if (!room) {
    throw new Error('Комната не найдена.');
  }

  const players = getRoomPlayers(room).sort(
    (playerA, playerB) => playerA.seatIndex - playerB.seatIndex
  );
  const hostPlayerId = room.host_player_id ?? players.find((player) => player.isHost)?.id;

  if (hostPlayerId !== playerId) {
    throw new Error('Начать партию может только host.');
  }

  if (room.status !== 'waiting') {
    throw new Error('Партия уже началась.');
  }

  if (players.length < 2) {
    throw new Error('Нужно минимум 2 игрока.');
  }

  const turnOrder = players.map((player) => player.id);
  const gameState = initializeGame(players.length);

  const { data, error } = await supabase
    .from('rooms')
    .update({
      game_state: gameState,
      turn_order: turnOrder,
      current_turn_index: 0,
      status: 'playing',
      updated_at: new Date().toISOString(),
    })
    .eq('id', room.id)
    .eq('status', 'waiting')
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
  currentVersion: number,
  nextCurrentTurnIndex?: number
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
      ...(typeof nextCurrentTurnIndex === 'number'
        ? { current_turn_index: nextCurrentTurnIndex }
        : {}),
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

export async function deleteRoom(roomId: string, playerId: string): Promise<Room> {
  const supabase = getSupabaseClient();
  const room = await getRoomById(roomId);

  if (!room) {
    throw new Error('Комната не найдена.');
  }

  // host_player_id is the new authority; player_1_id fallback keeps older rows deletable.
  const hostPlayerId = room.host_player_id ?? room.player_1_id;
  if (hostPlayerId !== playerId) {
    throw new Error('Удалить комнату может только создатель.');
  }

  const { data, error } = await supabase
    .from('rooms')
    .delete()
    // Always filter by room id so host permission never becomes a broad delete.
    .eq('id', roomId)
    .select()
    .single<Room>();

  if (error) {
    console.error('[deleteRoom error]', {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    });
    throw error;
  }

  return data;
}

export function subscribeToRoom(
  roomId: string,
  onRoomUpdate: (room: Room) => void,
  onStatusProblem?: () => void,
  onRoomDelete?: () => void
): RealtimeChannel {
  const supabase = getSupabaseClient();

  return supabase
    .channel(`room:${roomId}`)
    // Realtime only delivers row changes; rooms.game_state remains the source of truth.
    // Clients replace their room snapshot instead of applying separate local patches.
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
    .on(
      'postgres_changes',
      {
        event: 'DELETE',
        schema: 'public',
        table: 'rooms',
        filter: `id=eq.${roomId}`,
      },
      (payload) => {
        console.log('[room realtime delete raw]', payload);
        // DELETE means every client must leave the online room locally.
        onRoomDelete?.();
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
