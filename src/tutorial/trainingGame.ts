import { initializeGame, placeCard, upsertPendingSemanticEdge, removePendingSemanticEdge, submitPendingSemanticMove, confirmPendingCard, returnPendingCard } from '../game';
import { EMOTIONS_DECK } from '../data/deckDefinitions';
import type { Coordinates, GameState, PendingSemanticEdge, SemanticRelation } from '../types';

export type TrainingPhase = 'intro' | 'place' | 'relation' | 'voting' | 'complete';
export interface TrainingState { game: GameState; phase: TrainingPhase; feedback: string }
export type TrainingAction =
  | { type: 'begin' | 'restart' | 'cancel' | 'submit' | 'accept' }
  | { type: 'place'; name: string; position: Coordinates }
  | { type: 'relation'; neighbor: string; relation: SemanticRelation; direction: PendingSemanticEdge['direction'] }
  | { type: 'remove'; neighbor: string }
  | { type: 'hint'; text: string };

export function createTrainingState(): TrainingState {
  const neutral = EMOTIONS_DECK.neutralCards!.find(c => c.name === 'Эмоция')!;
  const game = initializeGame(2, { ...EMOTIONS_DECK, neutralCards: [neutral] }, 0);
  const hand = ['Радость', 'Грусть', 'Страх', 'Интерес', 'Спокойствие'];
  const remaining = game.deckSnapshot!.cards!.map(c => c.name).filter(name => !hand.includes(name));
  // The tutorial owns its state; never reuse the active local/online snapshot.
  game.players[0].cards = hand;
  game.deck[0] = remaining;
  return { game, phase: 'intro', feedback: '' };
}

export function trainingReducer(state: TrainingState, action: TrainingAction): TrainingState {
  const { game, phase } = state;
  switch (action.type) {
    case 'restart': return createTrainingState();
    case 'hint': return { ...state, feedback: action.text };
    case 'begin': return phase === 'intro' ? { ...state, phase: 'place', feedback: '' } : state;
    case 'place': {
      if (phase !== 'place') return state;
      if (action.name !== 'Радость') return { ...state, feedback: 'Для первого примера возьмите «Радость».' };
      const next = placeCard(game, action.name, action.position);
      return next === game ? { ...state, feedback: 'Выберите свободную клетку рядом с «Эмоцией», по стороне.' }
        : { game: next, phase: 'relation', feedback: '' };
    }
    case 'relation': {
      if (phase !== 'relation') return state;
      if (action.relation.family !== 'kind' || action.direction !== 'new-to-neighbor') {
        return { ...state, feedback: 'В этом примере радость — вид эмоции. Выберите «Вид», затем «Радость». Нажмите на связь ещё раз, если окно закрылось.' };
      }
      return { ...state, game: upsertPendingSemanticEdge(game, action.neighbor, action.relation, action.direction), feedback: '' };
    }
    case 'remove': return phase === 'relation' ? { ...state, game: removePendingSemanticEdge(game, action.neighbor), feedback: '' } : state;
    case 'cancel': return phase === 'relation' ? { game: returnPendingCard(game), phase: 'place', feedback: 'Карта снова в руке. Попробуйте ещё раз.' } : state;
    case 'submit': {
      if (phase !== 'relation') return state;
      const next = submitPendingSemanticMove(game);
      return next === game ? { ...state, feedback: 'Сначала сохраните связь «Радость — вид эмоции».' }
        : { game: next, phase: 'voting', feedback: '' };
    }
    case 'accept': {
      if (phase !== 'voting') return state;
      return { game: confirmPendingCard(game), phase: 'complete', feedback: '' };
    }
  }
}
