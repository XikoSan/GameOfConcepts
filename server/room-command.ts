import { createClient } from '@supabase/supabase-js';
import { initializeGame } from '../src/game';
import { USER_SELECTABLE_DECKS } from '../src/data/deckDefinitions';
import { applyAuthenticatedAction } from '../src/server/secureRoomActions';
import type { GameAction } from '../src/gameActions';
import type { Room, RoomPlayer } from '../src/types/room';

declare const Deno: { env: { get(key: string): string | undefined }; serve(handler: (request: Request) => Promise<Response>): void };
const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } });
const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Content-Type': 'application/json' };
const nickname = (value: unknown) => {
  if (typeof value !== 'string' || !value.trim() || value.length > 40) throw Error('Имя должно содержать от 1 до 40 символов.');
  return value.trim();
};
const player = (id: string, name: string, seat: number): RoomPlayer => ({ id, nickname: name, seatIndex: seat,
  color: (['blue','orange','green','purple'] as const)[seat], isHost: seat === 0, connected: true, joinedAt: new Date().toISOString() });

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers });
  if (request.method !== 'POST') return new Response('{}', { status: 405, headers });
  try {
    const token = request.headers.get('Authorization')?.replace(/^Bearer /i, '');
    if (!token) return new Response('{"error":"Требуется гостевой вход."}', { status: 401, headers });
    // Verify the JWT on the Auth server; never trust a user id supplied by the caller.
    const { data: identity, error: authError } = await admin.auth.getUser(token);
    if (authError || !identity.user) return new Response('{"error":"Войдите гостем повторно."}', { status: 401, headers });
    const actor = identity.user.id;
    // Enforce a byte limit while reading, including requests without Content-Length.
    const reader = request.body?.getReader();
    if (!reader) throw Error('Пустой запрос.');
    const decoder = new TextDecoder();
    let raw = ''; let size = 0;
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > 12000) { await reader.cancel(); throw Error('Запрос слишком большой.'); }
      raw += decoder.decode(chunk.value, { stream: true });
    }
    raw += decoder.decode();
    const body = JSON.parse(raw);
    if (!body || typeof body !== 'object') throw Error('Неверный запрос.');
    const operation = body.operation;
    if (!['create','join','start','delete','action'].includes(operation)) throw Error('Неизвестная команда.');
    const { error: limitError } = await admin.rpc('consume_game_quota', { actor, category: operation === 'create' ? 'create' : 'action' });
    if (limitError) return new Response('{"error":"Слишком много запросов. Подождите немного."}', { status: 429, headers });
    if (operation === 'create') {
      const name = nickname(body.nickname);
      if (![2,3,4].includes(body.maxPlayers)) throw Error('Можно выбрать от 2 до 4 игроков.');
      const deck = USER_SELECTABLE_DECKS.find(deck => deck.id === body.deckId);
      if (!deck) throw Error('Колода недоступна.');
      const game = initializeGame(body.maxPlayers, deck, 0);
      const room = { code: crypto.randomUUID().replaceAll('-','').slice(0,8).toUpperCase(), status: 'waiting',
        player_1_id: actor, host_player_id: actor, player_1_nickname: name, max_players: body.maxPlayers,
        players: [player(actor,name,0)], turn_order: [actor], current_turn_index: 0, game_state: game, version: 0, protocol_version: 2 };
      const { data, error } = await admin.from('rooms').insert(room).select('*').single();
      if (error) throw Error('Не удалось создать комнату.');
      return Response.json(data, { headers });
    }
    // Retry only CAS conflicts. A vote is tied to cardId; it must never move to a later proposal.
    for (let attempt = 0; attempt < 4; attempt++) {
      let query = admin.from('rooms').select('*').eq('protocol_version', 2);
      if (operation === 'join') {
        if (typeof body.code !== 'string' || !/^[A-Z0-9]{5,8}$/i.test(body.code)) throw Error('Неверный код комнаты.');
        query = query.eq('code', body.code.toUpperCase());
      } else {
        if (typeof body.roomId !== 'string' || !/^[0-9a-f-]{36}$/i.test(body.roomId)) throw Error('Неверная комната.');
        query = query.eq('id', body.roomId);
      }
      const { data, error } = await query.single();
      if (error || !data) throw Error('Комната не найдена или создана в старой версии.');
      const room = data as Room;
      let next = room;
      if (operation === 'join') {
        const name = nickname(body.nickname);
        const member = room.players.find(p => p.id === actor);
        if (!member && (room.status !== 'waiting' || room.players.length >= room.max_players)) throw Error('Комната заполнена или партия уже началась.');
        if (room.status === 'finished') throw Error('Партия завершена.');
        const seat = [0,1,2,3].find(i => i < room.max_players && !room.players.some(p => p.seatIndex === i));
        const players = member ? room.players.map(p => p.id === actor ? { ...p, nickname: name, connected: true } : p) : [...room.players, player(actor,name,seat!)];
        next = { ...room, players, turn_order: member ? room.turn_order : [...room.turn_order, actor], version: room.version + 1 };
        const ownSeat = member?.seatIndex ?? seat;
        if (ownSeat === 1) { next.player_2_id = actor; next.player_2_nickname = name; }
        if (ownSeat === 0) next.player_1_nickname = name;
      } else if (operation === 'start') {
        if (room.host_player_id !== actor || room.status !== 'waiting' || room.players.length !== room.max_players) throw Error('Начать игру может хозяин после подключения всех игроков.');
        const turn = Math.floor(Math.random() * room.turn_order.length);
        const seat = room.players.find(p => p.id === room.turn_order[turn])!.seatIndex;
        next = { ...room, status: 'playing', current_turn_index: turn, version: room.version + 1,
          game_state: initializeGame(room.max_players, USER_SELECTABLE_DECKS.find(d => d.id === room.game_state.deckSnapshot?.sourceDeckId)!, seat, room.game_state.deckSnapshot) };
      } else if (operation === 'delete') {
        if (room.host_player_id !== actor) throw Error('Удалять комнату может только хозяин.');
        const result = await admin.from('rooms').delete().eq('id',room.id).eq('version',room.version).select('*').maybeSingle();
        if (result.error) throw Error('Не удалось удалить комнату.');
        if (result.data) return Response.json(result.data, { headers });
        continue;
      } else {
        if (!body.action || typeof body.action.type !== 'string') throw Error('Неверное действие.');
        const vote = ['confirmCard','returnCard'].includes(body.action.type);
        if (!vote && body.expectedVersion !== room.version) throw Error('Состояние комнаты изменилось. Повторите действие.');
        next = applyAuthenticatedAction(room, actor, body.action as GameAction, body.moveId);
      }
      const { id: _id, created_at: _created, ...patch } = next;
      void _id; void _created;
      const result = await admin.from('rooms').update({ ...patch, updated_at: new Date().toISOString() }).eq('id',room.id).eq('version',room.version).select('*').maybeSingle();
      if (result.error) throw Error('Не удалось сохранить действие.');
      if (result.data) return Response.json(result.data, { headers });
    }
    throw Error('Состояние комнаты изменилось. Повторите действие.');
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Ошибка запроса.' }, { status: 400, headers });
  }
});
