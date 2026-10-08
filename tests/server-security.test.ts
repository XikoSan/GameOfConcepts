import test from 'node:test';
import assert from 'node:assert/strict';
import { initializeGame } from '../src/game';
import { applyAuthenticatedAction as act } from '../src/server/secureRoomActions';
import { getRelationPresets } from '../src/scoring/semanticRelations';
import type { Room } from '../src/types/room';
function fixture(count: 2 | 3 | 4 = 2): Room {
 const players=Array.from({length:count},(_,seatIndex)=>({id:`p${seatIndex}`,seatIndex,nickname:`P${seatIndex}`,color:'blue' as const,isHost:seatIndex===0,connected:true,joinedAt:''}));
 return {id:'room',code:'TEST',status:'playing',player_1_id:'p0',player_2_id:'p1',host_player_id:'p0',player_1_nickname:'P0',player_2_nickname:'P1',max_players:count,players,turn_order:players.map(p=>p.id),current_turn_index:0,game_state:initializeGame(count,undefined,0),version:0,created_at:'',updated_at:''};
}
function proposal(count: 2 | 3 | 4 = 2) {
 let room=fixture(count);
 room=act(room,'p0',{type:'placeCard',cardName:room.game_state.players[0].cards[0],coordinates:{x:8,y:7}});
 const id=room.game_state.pendingMove!.cardId;
 room=act(room,'p0',{type:'upsertSemanticEdge',neighborCardInstanceId:room.game_state.startCard.id,relation:getRelationPresets(room.game_state.deckSnapshot)[0],direction:'new-to-neighbor'},id);
 return act(room,'p0',{type:'submitSemanticMove'},id);
}
test('server rejects outsiders, wrong turn, forged cards and reset',()=>{
 const room=fixture(); const action={type:'placeCard' as const,cardName:room.game_state.players[0].cards[0],coordinates:{x:8,y:7}};
 assert.throws(()=>act(room,'outsider',action)); assert.throws(()=>act(room,'p1',action));
 assert.throws(()=>act(room,'p0',{...action,cardName:'not in hand'}));
 assert.throws(()=>act(room,'p0',{...action,coordinates:{x:8.5,y:7}}));
 assert.throws(()=>act(room,'p0',{type:'resetGame'})); assert.equal(room.version,0);
});
test('server computes accepted score and rejects author or stale votes',()=>{
 const room=proposal(); const id=room.game_state.pendingMove!.cardId;
 assert.throws(()=>act(room,'p0',{type:'confirmCard'},id));
 assert.throws(()=>act(room,'p1',{type:'confirmCard'},'old'));
 const result=act(room,'p1',{type:'confirmCard'},id);
 assert.equal(result.game_state.pendingMove,null); assert.equal(result.game_state.scores[0],1); assert.equal(result.current_turn_index,1);
 assert.throws(()=>act(result,'p1',{type:'confirmCard'},id));
});
test('four-player majority excludes duplicate votes; rejection keeps author turn',()=>{
 const room=proposal(4); const id=room.game_state.pendingMove!.cardId;
 const one=act(room,'p1',{type:'confirmCard'},id); assert.ok(one.game_state.pendingMove);
 assert.throws(()=>act(one,'p1',{type:'confirmCard'},id));
 const two=act(one,'p2',{type:'returnCard'},id);
 const result=act(two,'p3',{type:'returnCard'},id);
 assert.equal(result.game_state.pendingMove,null); assert.equal(result.current_turn_index,0);
 assert.equal(result.game_state.scores[0],0); assert.equal(result.game_state.players[0].cards.length,5);
});
