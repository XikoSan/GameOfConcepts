import { useEffect, useState } from 'react';
import { getSupabaseClient } from '../lib/supabaseClient';
const key='gameOfConcepts.nickname';
export interface LocalPlayerIdentity { playerId:string; nickname:string; saveNickname:(nickname:string)=>void }
export function usePlayerIdentity(): LocalPlayerIdentity {
 const [playerId,setPlayerId]=useState('');
 const [nickname,setNickname]=useState(()=>{try{return localStorage.getItem(key)??'';}catch{return '';}});
 useEffect(()=>{
  let live=true;
  try {
   const client=getSupabaseClient();
   // INITIAL_SESSION and later refresh/sign-in events share one source of identity.
   const {data}=client.auth.onAuthStateChange((_event,session)=>{if(live)setPlayerId(session?.user.id??'');});
   return ()=>{live=false;data.subscription.unsubscribe();};
  } catch { return ()=>{live=false;}; }
 },[]);
 return {playerId,nickname,saveNickname:(value)=>{setNickname(value);try{localStorage.setItem(key,value);}catch{/* Keep nickname for this session. */}}};
}
