// Send intentions only. The server validates identity, turn, votes and scoring.
import { useCallback, useRef, useState } from 'react';
import { getRoomById, sendRoomAction } from '../services/roomService';
import type { Coordinates, GameState, PendingSemanticEdge, RegularCardName, SemanticRelation } from '../game';
import type { GameAction } from '../gameActions';
import type { Room } from '../types/room';
import type { GameController } from './gameController';
interface UseMultiplayerGameStateOptions {room:Room|null;fallbackGameState:GameState;localPlayerId:string;onError?:(message:string)=>void;onRoomUpdate?:(room:Room)=>void}
export function useMultiplayerGameState({room,fallbackGameState,localPlayerId,onError,onRoomUpdate}:UseMultiplayerGameStateOptions):GameController {
 const [error,setError]=useState<string|null>(null);
 const busy=useRef(false);
 const localPlayerIndex=room?.players.find(p=>p.id===localPlayerId)?.seatIndex??null;
 const reportError=useCallback((message:string)=>{setError(message);onError?.(message);},[onError]);
 const dispatchAction=useCallback(async(action:GameAction)=>{
  if(!room||busy.current)return;
  busy.current=true;
  try{setError(null);onRoomUpdate?.(await sendRoomAction(room,action));}
  catch(cause){
   reportError(cause instanceof Error?cause.message:'Не удалось отправить действие.');
   try{const fresh=await getRoomById(room.id);if(fresh)onRoomUpdate?.(fresh);}catch{/* Realtime reconnect will refresh the room. */}
  }finally{busy.current=false;}
 },[room,onRoomUpdate,reportError]);
 const gameState=room?.game_state??fallbackGameState;
 const activePlayerIndex=room?.players.find(p=>p.id===room.turn_order[room.current_turn_index])?.seatIndex??gameState.currentPlayerIndex;
  return {
    gameState,
    mode: 'multiplayer',
    connectionStatus: room?.status === 'playing' ? 'connected' : 'disconnected',
    error,
    localPlayerIndex,
    activePlayerIndex,
    placeCard: (cardName: RegularCardName, coordinates: Coordinates) => {
      void dispatchAction({ type: 'placeCard', cardName, coordinates });
    },
    redrawHand: () => {
      if (localPlayerIndex === null) {
        console.warn('[online action blocked]', 'redrawHand: localPlayerIndex is null');
        reportError('Это действие недоступно для вашей роли.');
        return;
      }

      void dispatchAction({ type: 'redrawHand', playerIndex: localPlayerIndex });
    },
    upsertSemanticEdge: (
      neighborCardInstanceId: string,
      relation: SemanticRelation,
      direction: PendingSemanticEdge['direction']
    ) => {
      void dispatchAction({
        type: 'upsertSemanticEdge',
        neighborCardInstanceId,
        relation,
        direction,
      });
    },
    removeSemanticEdge: (neighborCardInstanceId: string) => {
      void dispatchAction({ type: 'removeSemanticEdge', neighborCardInstanceId });
    },
    submitSemanticMove: () => {
      void dispatchAction({ type: 'submitSemanticMove' });
    },
    cancelPendingMove: () => {
      void dispatchAction({ type: 'cancelPendingMove' });
    },
    confirmCard: () => {
      void dispatchAction({type:'confirmCard'});
    },
    returnCard: () => {
      void dispatchAction({type:'returnCard'});
    },
    approveCross: () => {
      void dispatchAction({ type: 'approveCross' });
    },
    rejectCross: () => {
      void dispatchAction({ type: 'rejectCross' });
    },
    resetGame: () => {
      void dispatchAction({ type: 'resetGame' });
    },
    startLocalGame: () => undefined,
  };
}
