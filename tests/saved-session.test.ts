import test from 'node:test';
import assert from 'node:assert/strict';
import { initializeGame } from '../src/game';
import { createTrainingState, trainingReducer } from '../src/tutorial/trainingGame';
import { readSavedSession, writeSavedSession, type SavedSession } from '../src/services/savedSession';

test('local and training saves survive serialization with their current game state', () => {
  const values = new Map<string, string>();
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  }});
  try {
    const sessions: SavedSession[] = [
      { version: 1, kind: 'local', names: ['Анна', 'Игорь', 'Ася'], game: initializeGame(3) },
      { version: 1, kind: 'training', names: ['Анна'], training: trainingReducer(createTrainingState(), { type: 'next' }) },
    ];
    for (const session of sessions) {
      writeSavedSession(session);
      const restored = readSavedSession();
      assert.deepEqual(restored, JSON.parse(JSON.stringify(session)));
      if (restored?.kind === 'training') assert.equal(trainingReducer(restored.training, { type: 'next' }).phase, 'deck');
    }
    writeSavedSession(null);
    assert.equal(readSavedSession(), null);
    for (const invalid of ['{broken', '{"version":2}', '{"version":1,"kind":"local","names":[],"game":{}}']) {
      values.set('game:session:v1', invalid);
      assert.equal(readSavedSession(), null);
    }
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
      getItem() { throw new Error('Storage unavailable'); },
      setItem() { throw new Error('Storage unavailable'); },
    }});
    assert.equal(readSavedSession(), null);
    assert.throws(() => writeSavedSession(sessions[0]), /Storage unavailable/);
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  }
});
