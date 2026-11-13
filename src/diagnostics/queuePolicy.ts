import type { DiagnosticEvent } from './archive';
import { DIAGNOSTIC_EVENT_TYPES, DIAGNOSTIC_RETENTION_MS } from './archive';

export const DIAGNOSTIC_QUEUE_MAX_BYTES = 10 * 1024 * 1024;
export const DIAGNOSTIC_EVENT_MAX_BYTES = 1024 * 1024;
const bytes = (value: unknown) => new TextEncoder().encode(JSON.stringify(value)).byteLength;

export function pruneDiagnosticQueue(events: DiagnosticEvent[], now = Date.now()): DiagnosticEvent[] {
  const seen = new Set<string>();
  const result = events.filter(event => {
    if (!event || typeof event !== 'object') return false;
    const at = Date.parse(event.occurred_at), identity = `${event.session_id}:${event.event_id}`;
    if (!Number.isFinite(at) || at <= now - DIAGNOSTIC_RETENTION_MS || at > now + 300000 ||
      event.source !== 'local' || !DIAGNOSTIC_EVENT_TYPES.includes(event.event_type) || !event.snapshot ||
      !event.session_id || !event.event_id || seen.has(identity) || bytes(event) > DIAGNOSTIC_EVENT_MAX_BYTES) return false;
    seen.add(identity); return true;
  }).slice(-240);
  while (bytes(result) > DIAGNOSTIC_QUEUE_MAX_BYTES) result.shift();
  return result;
}
