import type { DiagnosticEvent } from './archive';
import { ensureGuestIdentity } from '../lib/onlineAuth';
import { getSupabaseClient } from '../lib/supabaseClient';
import { pruneDiagnosticQueue } from './queuePolicy';
const key = 'game:diagnostics:pending:v1';
let queue: DiagnosticEvent[] | null = null;
let running = false;
function readQueue() {
  if (queue === null) {
    try { const saved: unknown = JSON.parse(localStorage.getItem(key) ?? '[]'); queue = pruneDiagnosticQueue(Array.isArray(saved) ? saved : []); }
    catch { queue = []; }
  }
  return queue;
}
function persist() { try { localStorage.setItem(key, JSON.stringify(readQueue())); } catch { /* A full device must not prevent a move. */ } }
export function enqueueDiagnostics(events: DiagnosticEvent[]) { queue = pruneDiagnosticQueue([...readQueue(), ...events]); persist(); void flushDiagnostics(); }
export async function flushDiagnostics() {
  if (running || !navigator.onLine) return;
  queue = pruneDiagnosticQueue(readQueue()); persist();
  if (!queue.length) return;
  running = true;
  try {
    await ensureGuestIdentity();
    while (readQueue().length) {
      const batch = readQueue().slice(0, 1);
      const { error } = await getSupabaseClient().rpc('record_local_diagnostics', { events: batch });
      if (error) break;
      const sent = new Set(batch.map(event => `${event.session_id}:${event.event_id}`));
      queue = readQueue().filter(event => !sent.has(`${event.session_id}:${event.event_id}`)); persist();
    }
  } catch { /* Retry the same event ids after reconnect or the next timer. */ }
  finally { running = false; }
}
