import type { RealtimeChannel } from '@supabase/supabase-js';
import { getSupabaseClient } from '../lib/supabaseClient';
import { ensureGuestIdentity, invokeRoomCommand } from '../lib/onlineAuth';
import { hasSupportedGameRelations } from '../scoring/semanticRelations';
import type { GameState } from '../game';
import type { GameAction } from '../gameActions';
import type { Room, MaxPlayers } from '../types/room';

export async function getRoomById(id:string): Promise<Room|null> {
 await ensureGuestIdentity();
 const {data,error}=await getSupabaseClient().from('rooms').select('*').eq('protocol_version',2).eq('id',id).maybeSingle();
 if(error)throw error; return data as Room|null;
}
export async function getAvailableRooms(playerId:string): Promise<Room[]> {
 void playerId; await ensureGuestIdentity();
 // RLS exposes waiting rooms and the caller's own active rooms only.
 const {data,error}=await getSupabaseClient().from('rooms').select('*').eq('protocol_version',2).in('status',['waiting','playing']).order('created_at',{ascending:false}).limit(50);
 if(error)throw error; return data as Room[];
}
export function createRoom(input:{playerId:string;nickname:string;maxPlayers:MaxPlayers;initialGameState:GameState}): Promise<Room> {
 return invokeRoomCommand({operation:'create',nickname:input.nickname,maxPlayers:input.maxPlayers,deckId:input.initialGameState.deckSnapshot?.sourceDeckId});
}
export function joinRoom(input:{code:string;playerId:string;nickname:string}): Promise<Room> {
 return invokeRoomCommand({operation:'join',code:input.code,nickname:input.nickname});
}
export function startRoomGame(input:{roomId:string;playerId:string}): Promise<Room> {
 return invokeRoomCommand({operation:'start',roomId:input.roomId});
}
export function deleteRoom(roomId:string,playerId:string): Promise<Room> {
 void playerId; return invokeRoomCommand({operation:'delete',roomId});
}
export function sendRoomAction(room:Room,action:GameAction): Promise<Room> {
 return invokeRoomCommand({operation:'action',roomId:room.id,expectedVersion:room.version,moveId:room.game_state.pendingMove?.cardId,action});
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
        if (import.meta.env.DEV) console.log('[room realtime update raw]', payload);
        if (import.meta.env.DEV) console.log('[room realtime update room]', payload.new);
        const nextRoom = payload.new as Room;
        if (!hasSupportedGameRelations(nextRoom.game_state)) {
          onStatusProblem?.();
          return;
        }
        onRoomUpdate(nextRoom);
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
        if (import.meta.env.DEV) console.log('[room realtime delete raw]', payload);
        // DELETE means every client must leave the online room locally.
        onRoomDelete?.();
      }
    )
    .subscribe((status, error) => {
      if (import.meta.env.DEV) console.log('[room realtime status]', { roomId, status, error });
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        console.warn('[room realtime status error]', { roomId, status, error });
        onStatusProblem?.();
      }
    });
}
