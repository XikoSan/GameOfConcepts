import test from 'node:test';
import assert from 'node:assert/strict';
import { subscribeAfterAuthentication } from '../src/lib/subscribeAfterAuthentication';

function deferred() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((accept, decline) => { resolve = accept; reject = decline; });
  return { promise, resolve, reject };
}

const settle = () => new Promise<void>(resolve => setImmediate(resolve));

test('room subscription waits for session and Realtime JWT before opening the channel', async () => {
  const session = deferred();
  const realtimeAuth = deferred();
  const events: string[] = [];
  const subscription = subscribeAfterAuthentication(async () => {
    await session.promise;
    events.push('setAuth');
    await realtimeAuth.promise;
  }, () => {
    events.push('subscribe');
    return { unsubscribe: () => { events.push('unsubscribe'); } };
  }, error => { throw error; });
  await settle();
  assert.deepEqual(events, []);
  session.resolve();
  await settle();
  assert.deepEqual(events, ['setAuth'], 'a loaded session does not imply that Realtime is authenticated');
  realtimeAuth.resolve();
  await settle();
  assert.deepEqual(events, ['setAuth', 'subscribe']);
  subscription.unsubscribe();
  subscription.unsubscribe();
  assert.deepEqual(events, ['setAuth', 'subscribe', 'unsubscribe']);
});

test('leaving a room during Realtime authentication never creates a late channel', async () => {
  const authentication = deferred();
  let channels = 0;
  const subscription = subscribeAfterAuthentication(() => authentication.promise, () => {
    channels++;
    return { unsubscribe: () => { channels--; } };
  }, error => { throw error; });
  subscription.unsubscribe();
  authentication.resolve();
  await settle();
  assert.equal(channels, 0);
});

test('switching rooms while authentication is pending subscribes only to the current room', async () => {
  const authentication = deferred();
  const rooms: string[] = [];
  const create = (room: string) => subscribeAfterAuthentication(() => authentication.promise, () => {
    rooms.push(room);
    return { unsubscribe: () => { rooms.splice(rooms.indexOf(room), 1); } };
  }, error => { throw error; });
  const previous = create('previous');
  previous.unsubscribe();
  const current = create('current');
  authentication.resolve();
  await settle();
  assert.deepEqual(rooms, ['current']);
  current.unsubscribe();
  assert.deepEqual(rooms, []);
});

test('authentication failures report a sync problem without joining anonymously or reviving a closed room', async () => {
  const failure = new Error('session expired');
  const errors: unknown[] = [];
  let channels = 0;
  const create = (authentication: Promise<void>) => subscribeAfterAuthentication(() => authentication, () => {
    channels++;
    return { unsubscribe: () => { channels--; } };
  }, error => { errors.push(error); });
  create(Promise.reject(failure));
  await settle();
  assert.deepEqual(errors, [failure]);
  assert.equal(channels, 0);
  const late = deferred();
  const closed = create(late.promise);
  closed.unsubscribe();
  late.reject(failure);
  await settle();
  assert.deepEqual(errors, [failure]);
  assert.equal(channels, 0);
});
