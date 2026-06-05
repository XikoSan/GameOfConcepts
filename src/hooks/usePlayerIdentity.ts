import { useMemo } from 'react';

const PLAYER_ID_STORAGE_KEY = 'game-of-concepts-player-id';

function getOrCreatePlayerId(): string {
  const existingPlayerId = localStorage.getItem(PLAYER_ID_STORAGE_KEY);

  if (existingPlayerId) {
    return existingPlayerId;
  }

  const playerId = crypto.randomUUID();
  localStorage.setItem(PLAYER_ID_STORAGE_KEY, playerId);

  return playerId;
}

export function usePlayerIdentity(): string {
  // TEMP(MVP): Для MVP используем localStorage playerId вместо авторизации.
  return useMemo(() => getOrCreatePlayerId(), []);
}
