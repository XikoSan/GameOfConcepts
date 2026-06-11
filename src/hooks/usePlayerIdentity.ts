import { useMemo } from 'react';

const PLAYER_ID_STORAGE_KEY = 'game-of-concepts-player-id';
const PLAYER_ID_STORAGE_KEY_V2 = 'gameOfConcepts.playerId';
const NICKNAME_STORAGE_KEY = 'gameOfConcepts.nickname';

export interface LocalPlayerIdentity {
  playerId: string;
  nickname: string;
  saveNickname: (nickname: string) => void;
}

function getOrCreatePlayerId(): string {
  const existingPlayerId =
    localStorage.getItem(PLAYER_ID_STORAGE_KEY_V2) ??
    localStorage.getItem(PLAYER_ID_STORAGE_KEY);

  if (existingPlayerId) {
    localStorage.setItem(PLAYER_ID_STORAGE_KEY_V2, existingPlayerId);
    return existingPlayerId;
  }

  const playerId = crypto.randomUUID();
  localStorage.setItem(PLAYER_ID_STORAGE_KEY_V2, playerId);

  return playerId;
}

function getNickname(): string {
  return localStorage.getItem(NICKNAME_STORAGE_KEY) ?? '';
}

function saveNickname(nickname: string) {
  localStorage.setItem(NICKNAME_STORAGE_KEY, nickname);
}

export function usePlayerIdentity(): LocalPlayerIdentity {
  // TEMP(MVP): Для MVP используем localStorage playerId вместо авторизации.
  return useMemo(
    () => ({
      playerId: getOrCreatePlayerId(),
      nickname: getNickname(),
      saveNickname,
    }),
    []
  );
}
