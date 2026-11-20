import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { getSupabaseClient } from '../lib/supabaseClient';
const key='gameOfConcepts.nickname';
export interface LocalPlayerIdentity { playerId:string; user:User | null | undefined; nickname:string; saveNickname:(nickname:string)=>void }
export function usePlayerIdentity(): LocalPlayerIdentity {
 const [user,setUser]=useState<User | null>();
 const [nickname,setNickname]=useState(()=>{try{return localStorage.getItem(key)??'';}catch{return '';}});
 useEffect(()=>{
  let live=true;
  try {
   const client=getSupabaseClient();
   // INITIAL_SESSION and later refresh/sign-in events share one source of identity.
   const {data}=client.auth.onAuthStateChange((_event,session)=>{if(live)setUser(session?.user??null);});
   return ()=>{live=false;data.subscription.unsubscribe();};
  } catch { return ()=>{live=false;}; }
 },[]);
 return {playerId:user?.id??'',user,nickname,saveNickname:(value)=>{setNickname(value);try{localStorage.setItem(key,value);}catch{/* Keep nickname for this session. */}}};
}
