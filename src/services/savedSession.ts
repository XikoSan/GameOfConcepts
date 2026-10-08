// Versioned local save format, distinct from the application release version. Preserve this schema across app updates or add an explicit migration.
import type { GameState } from '../game';
import type { TrainingState } from '../tutorial/trainingGame';

export type SavedSession = { version: 1; names: string[] } & (
  { kind: 'local'; game: GameState } | { kind: 'training'; training: TrainingState }
);
const key = 'game:session:v1';
export function readSavedSession(): SavedSession | null {
  try {
    const saved = JSON.parse(localStorage.getItem(key) || 'null') as SavedSession | null;
    if (!saved || saved.version !== 1 || !Array.isArray(saved.names) || !saved.names.every(name => typeof name === 'string')) return null;
    if (saved.kind !== 'local' && saved.kind !== 'training') return null;
    const game = saved.kind === 'local' ? saved.game : saved.training?.game;
    if (!game || !game.board || !game.startCard || !Array.isArray(game.players) || game.players.length < 2 || game.players.length > 4 || !game.players.every(player => Array.isArray(player.cards)) || !Array.isArray(game.deck) || game.deck.length !== game.players.length || !Array.isArray(game.scores) || !Array.isArray(game.log) || !Array.isArray(game.crosses)) return null;
    if (game.sharedDeck !== undefined && (!Array.isArray(game.sharedDeck) || !game.sharedDeck.every(card => typeof card === 'string'))) return null;
    if (saved.kind === 'training' && !['intro','hand','deck','redraw','place','relation','explain','voting','result','score','reminder','log','opponent','opponent-result','complete'].includes(saved.training.phase)) return null;
    return saved;
  } catch { return null; }
}
export function writeSavedSession(session: SavedSession | null) {
  if (session) localStorage.setItem(key, JSON.stringify(session));
  else localStorage.removeItem(key);
}
