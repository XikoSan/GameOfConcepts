import { getSupabaseClient } from './supabaseClient';
let pending: Promise<string> | null = null;
// One shared session prevents concurrent room/telemetry requests creating different guests.
export async function ensureGuestIdentity(): Promise<string> {
 if (pending) return pending;
 pending = (async () => {
  const client=getSupabaseClient();
  const {data,error}=await client.auth.getSession();
  if (error) throw error;
  if (data.session) return data.session.user.id;
  const result=await client.auth.signInAnonymously();
  if (result.error || !result.data.user) throw Error('Не удалось войти гостем. Проверьте соединение и попробуйте ещё раз.');
  return result.data.user.id;
 })();
 try { return await pending; } finally { pending=null; }
}
export async function invokeRoomCommand<T>(body: Record<string, unknown>): Promise<T> {
 await ensureGuestIdentity();
 const {data,error}=await getSupabaseClient().functions.invoke('room-command',{body});
 if (error) {
  let message='Не удалось выполнить команду. Проверьте соединение.';
  if (error.context instanceof Response) {
   try { const reply=await error.context.json(); if (typeof reply.error==='string') message=reply.error; } catch { /* Generic error for non-JSON responses. */ }
  }
  throw Error(message);
 }
 return data as T;
}
