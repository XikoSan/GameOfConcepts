import test from 'node:test';
import assert from 'node:assert/strict';
import { initializeGame, placeCard, upsertPendingSemanticEdge, submitPendingSemanticMove, confirmPendingCard, returnPendingCard, requestFinish, voteFinish, redrawPlayerHand } from '../src/game';
import { diagnosticSnapshot, localDiagnosticTransition, classifyDiagnosticTransition, DIAGNOSTIC_RETENTION_MS, type LocalDiagnosticState, type DiagnosticEvent } from '../src/diagnostics/archive';
import { pruneDiagnosticQueue, DIAGNOSTIC_EVENT_MAX_BYTES, DIAGNOSTIC_QUEUE_MAX_BYTES } from '../src/diagnostics/queuePolicy';

const metadata = { runId: 'run-1', at: '2026-11-13T08:00:00.000Z', clientVersion: 'test' };
const base = (): LocalDiagnosticState => ({ game: initializeGame(2, undefined, 0), enabled: false, revision: 0, events: [] });
function proposal() {
  let game = initializeGame(2, undefined, 0);
  game = placeCard(game, game.players[0].cards[0], { x: 8, y: 7 });
  game = upsertPendingSemanticEdge(game, game.startCard.id, { family: 'cause', fromRole: 'cause', toRole: 'effect' }, 'new-to-neighbor');
  return submitPendingSemanticMove(game);
}

test('diagnostics allowlist keeps public board, ordered edges and score evidence without private state', () => {
  const game = confirmPendingCard(proposal());
  const state = Object.assign(game, { nickname: 'PRIVATE-NAME', token: 'PRIVATE-TOKEN', speech: 'PRIVATE-SPEECH' });
  Object.assign(state.players[0], { nickname: 'PRIVATE-NAME' });
  state.players[0].cards = ['PRIVATE-HAND'];
  state.sharedDeck = ['PRIVATE-DRAW-ORDER'];
  Object.assign(state.startCard, { token: 'PRIVATE-CARD-TOKEN' });
  const snapshot = diagnosticSnapshot(state);
  const encoded = JSON.stringify(snapshot);
  assert.ok(!encoded.includes('PRIVATE-'));
  assert.equal(snapshot.board.length, 2);
  assert.equal(snapshot.semanticEdges.length, 1);
  assert.equal(snapshot.drawPileCount, 1);
  assert.equal(snapshot.playerCount, 2);
  assert.equal(snapshot.logDetails[0].semanticScore.edges[0].explanation?.relation, game.logDetails![0].relations[0]);
  assert.ok(!Object.hasOwn(snapshot, 'players'));
  assert.ok(!Object.hasOwn(snapshot, 'sharedDeck'));
});

test('diagnostics omit pending voter identities while preserving counts and selected edges', () => {
  const game = proposal();
  game.pendingMove!.votes = { 'PRIVATE-ACTOR-ID': 'accept' };
  game.pendingMove!.placedByPlayerId = 'PRIVATE-AUTHOR-ID';
  const snapshot = diagnosticSnapshot(game);
  assert.ok(!JSON.stringify(snapshot).includes('PRIVATE-'));
  assert.deepEqual(snapshot.pendingMove!.voteCounts, { accept: 1, reject: 0, required: 1 });
  assert.equal(snapshot.pendingMove!.semanticEdges[0].createdOrder, 0);
  assert.equal(snapshot.pendingMove!.semanticEdges[0].direction, 'new-to-neighbor');
});

test('local diagnostics stay disabled before explicit start and reducer retries are pure/idempotent', () => {
  const original = base();
  const started = localDiagnosticTransition(original, original.game, metadata, 'start');
  assert.equal(original.events.length, 0);
  assert.equal(original.enabled, false);
  assert.equal(started.events[0].event_type, 'start');
  assert.deepEqual(localDiagnosticTransition(original, original.game, metadata, 'start'), started);
  const hiddenChange = localDiagnosticTransition(original, proposal(), metadata);
  assert.equal(hiddenChange.events.length, 0);
  const submitted = localDiagnosticTransition(started, proposal(), metadata);
  assert.equal(submitted.events.at(-1)!.event_type, 'submitted');
  assert.equal(submitted.events.at(-1)!.event_id, 'run-1:2');
  assert.deepEqual(JSON.parse(JSON.stringify(submitted.events)), submitted.events);
  const restored = localDiagnosticTransition(original, confirmPendingCard(proposal()), { ...metadata, runId: 'resume-run' }, 'resume');
  assert.equal(restored.events[0].event_type, 'resume');
  assert.equal(restored.events[0].snapshot.logDetails.length, 1);
});

test('diagnostic transition classification captures accept/reject/cancel/redraw and finish decisions', () => {
  const pending = proposal();
  assert.equal(classifyDiagnosticTransition(pending, confirmPendingCard(pending)), 'accepted');
  assert.equal(classifyDiagnosticTransition(pending, returnPendingCard(pending)), 'rejected');
  const defining = { ...pending, pendingMove: { ...pending.pendingMove!, semanticStatus: 'defining-relations' as const } };
  assert.equal(classifyDiagnosticTransition(defining, returnPendingCard(defining)), 'cancelled');
  const game = initializeGame(2, undefined, 0);
  assert.equal(classifyDiagnosticTransition(game, redrawPlayerHand(game, 0)), 'redraw');
  const finish = requestFinish(game, 0);
  assert.equal(classifyDiagnosticTransition(game, finish), 'finish_proposed');
  assert.equal(classifyDiagnosticTransition(finish, voteFinish(finish, 1, false, finish.pendingFinish!.id)), 'finish_declined');
  assert.equal(classifyDiagnosticTransition(finish, voteFinish(finish, 1, true, finish.pendingFinish!.id)), 'finished');
  assert.equal(classifyDiagnosticTransition(game, game), null);
});

test('diagnostic queue expires at exactly thirty days, deduplicates retries and preserves current events', () => {
  const event = localDiagnosticTransition(base(), initializeGame(), metadata, 'start').events[0];
  const now = Date.parse(metadata.at);
  const old = { ...event, event_id: 'old', occurred_at: new Date(now - DIAGNOSTIC_RETENTION_MS).toISOString() };
  const future = { ...event, event_id: 'future', occurred_at: new Date(now + 300001).toISOString() };
  assert.deepEqual(pruneDiagnosticQueue([old, future, event, structuredClone(event)], now), [event]);
  const serialized = JSON.parse(JSON.stringify(event)) as DiagnosticEvent;
  assert.deepEqual(pruneDiagnosticQueue([serialized], now), [event]);
});

test('diagnostic queue bounds UTF-8 bytes and event count without discarding an ordinary late full snapshot', () => {
  const event = localDiagnosticTransition(base(), confirmPendingCard(proposal()), metadata, 'resume').events[0];
  const now = Date.parse(metadata.at);
  const many = Array.from({ length: 260 }, (_, index) => ({ ...event, event_id: String(index) }));
  const retained = pruneDiagnosticQueue(many, now);
  assert.equal(retained.length, 240);
  assert.equal(retained.at(-1)!.event_id, '259');
  assert.ok(new TextEncoder().encode(JSON.stringify(retained)).byteLength <= DIAGNOSTIC_QUEUE_MAX_BYTES);
  const oversize = { ...event, event_id: 'too-large', client_version: 'Я'.repeat(DIAGNOSTIC_EVENT_MAX_BYTES / 2) };
  assert.ok(new TextEncoder().encode(JSON.stringify(oversize)).byteLength > DIAGNOSTIC_EVENT_MAX_BYTES);
  assert.deepEqual(pruneDiagnosticQueue([oversize, event], now), [event]);
});
