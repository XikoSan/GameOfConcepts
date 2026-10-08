// Device outbox for accepted local edges. Retry is at-least-once; the database unique key makes retransmission idempotent.
import { getSupabaseClient } from '../lib/supabaseClient';
import type { AcceptedRelationSample } from './acceptedRelations';

const storageKey = 'game:accepted-relations:pending:v1';
let running = false;
let pending: AcceptedRelationSample[] | null = null;
const keyOf = (sample: AcceptedRelationSample) => sample.session_id + ':' + sample.edge_id;
function queue(): AcceptedRelationSample[] {
  if (pending === null) {
    try {
      const saved: unknown = JSON.parse(localStorage.getItem(storageKey) ?? '[]');
      pending = Array.isArray(saved) ? saved.filter(item => item && typeof item.session_id === 'string' && typeof item.edge_id === 'string') : [];
    } catch { pending = []; }
  }
  return pending;
}
function persist() {
  try { localStorage.setItem(storageKey, JSON.stringify(queue())); }
  catch { console.warn('Не удалось сохранить очередь связей на устройстве.'); }
}
export function enqueueAcceptedRelations(samples: AcceptedRelationSample[]) {
  const existing = new Set(queue().map(keyOf));
  for (const sample of samples) {
    if (existing.has(keyOf(sample))) continue;
    queue().push(sample);
    existing.add(keyOf(sample));
  }
  persist();
  void flushAcceptedRelations();
}
export async function flushAcceptedRelations() {
  if (running || !navigator.onLine || !queue().length) return;
  running = true;
  try {
    const client = getSupabaseClient();
    while (queue().length) {
      const batch = queue().slice(0, 50);
      const { error } = await client.rpc('record_local_relations', { samples: batch });
      if (error) break;
      const sent = new Set(batch.map(keyOf));
      pending = queue().filter(sample => !sent.has(keyOf(sample)));
      persist();
    }
  } catch { /* Retry on the next timer or connection event. */ }
  finally { running = false; }
}
