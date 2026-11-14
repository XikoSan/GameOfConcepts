// Deterministic teaching scenario. Prepared cards and opponent responses are tutorial constraints, not general legality rules.
import { initializeGame, placeCard, upsertPendingSemanticEdge, removePendingSemanticEdge, submitPendingSemanticMove, confirmPendingCard, returnPendingCard } from '../game';
import { EMOTIONS_DECK } from '../data/deckDefinitions';
import { RELATION_PRESETS } from '../scoring/semanticRelations';
import type { Coordinates, GameState, PendingSemanticEdge, SemanticRelation, RelationFamily } from '../types';

export type TrainingPhase = 'intro' | 'hand' | 'deck' | 'redraw' | 'place' | 'relation' | 'explain' | 'voting' | 'result' | 'score' | 'reminder' | 'log' | 'opponent' | 'opponent-result' | 'complete';
export interface TrainingState {
  scenarioVersion?: 2;
  game: GameState; phase: TrainingPhase; feedback: string; moves: number; selected: string | null;
  sawPath: boolean; sawNode: boolean; lastGain: number; lastExplanation: string; opponentAttempt: number; explainedReminder: boolean; opponentResultShown: boolean;
}
export type TrainingAction =
  | { type: 'begin' | 'restart' | 'cancel' | 'submit' | 'accept' | 'next' | 'explain' | 'approve-opponent' | 'reject-opponent' }
  | { type: 'select'; name: string }
  | { type: 'place'; name: string; position: Coordinates }
  | { type: 'relation'; neighbor: string; relation: SemanticRelation; direction: PendingSemanticEdge['direction'] }
  | { type: 'remove'; neighbor: string }
  | { type: 'hint'; text: string };

export const TRAINING_HAND = ['Радость', 'Грусть', 'Страх', 'Гнев', 'Интерес'];
export const TRAINING_RESERVE = ['Веселье', 'Уныние', 'Ужас', 'Раздражение', 'Увлечённость'];
export const TRAINING_NODE_CARD = 'Состояние';
const subtypes = Object.fromEntries(TRAINING_RESERVE.map((name, i) => [name, TRAINING_HAND[i]]));
const opposites: Record<string, string[]> = { Радость: ['Грусть', 'Уныние', 'Горе'], Грусть: ['Радость', 'Веселье', 'Приподнятость'], Страх: ['Спокойствие', 'Облегчение'], Гнев: ['Спокойствие', 'Нежность'], Интерес: ['Безразличие', 'Скука'] };
const opponentCards = [...new Set(Object.values(opposites).flat())];
function nextPlayerPhase(state: TrainingState): TrainingPhase {
  if (!state.explainedReminder) return 'reminder';
  return 'place';
}
const steps: Partial<Record<TrainingPhase, TrainingPhase>> = { intro: 'hand', hand: 'deck', deck: 'redraw', redraw: 'place', score: 'log', reminder: 'place' };
const offsets = [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 0, y: -1 }];

// A finite lesson vocabulary, not a semantic validator for ordinary matches.
export function isTrainingRelation(from: string, to: string, family: RelationFamily): boolean {
  if (family === 'kind') return (to === 'Эмоция' && TRAINING_HAND.includes(from)) || subtypes[from] === to ||
    (to === TRAINING_NODE_CARD && [...TRAINING_HAND, ...TRAINING_RESERVE, ...opponentCards].includes(from));
  if (family === 'opposite') return Boolean(opposites[from]?.includes(to) || opposites[to]?.includes(from));
  return false;
}

export function createTrainingState(): TrainingState {
  const neutral = EMOTIONS_DECK.neutralCards!.find(c => c.name === 'Эмоция')!;
  const game = initializeGame(2, { ...EMOTIONS_DECK, neutralCards: [neutral] }, 0);
  // This lesson deals a normally neutral concept as a player-owned center; ordinary decks stay unchanged.
  const nodeDefinition = EMOTIONS_DECK.neutralCards!.find(c => c.name === TRAINING_NODE_CARD)!;
  game.deckSnapshot = { ...game.deckSnapshot!, cards: [...game.deckSnapshot!.cards!, { ...nodeDefinition }],
    cardDefinitionIds: [...game.deckSnapshot!.cardDefinitionIds, nodeDefinition.id] };
  delete game.sharedDeck;
  game.players[0].cards = [...TRAINING_HAND];
  game.deck[0] = [...TRAINING_RESERVE].reverse();
  game.players[1].cards = opponentCards.slice(0, 5);
  game.deck[1] = opponentCards.slice(5);
  return { scenarioVersion: 2, game, phase: 'intro', feedback: '', moves: 0, selected: null, sawPath: false, sawNode: false, lastGain: 0, lastExplanation: '', opponentAttempt: 0, explainedReminder: false, opponentResultShown: false };
}

export function restoreTrainingState(saved?: TrainingState): TrainingState {
  if (!saved) return createTrainingState();
  if (saved.scenarioVersion === 2) return saved;
  // Old lessons taught a neutral-center node and cannot safely resume under the new scoring rule.
  return { ...createTrainingState(), feedback: 'Правило узла изменилось, поэтому сохранённое обучение начато заново. Теперь узел строится вокруг вашей новой карты.' };
}

export function suggestedTrainingMove(state: TrainingState) {
  const candidates = [];
  const cards = Object.values(state.game.board);
  const positions = new Map(cards.flatMap(card => offsets.map(offset => {
    const position = { x: card.coordinates.x + offset.x, y: card.coordinates.y + offset.y };
    return [`${position.x},${position.y}`, position] as const;
  })));
  for (const name of state.game.players[0].cards) {
      for (const position of positions.values()) {
        const placed = placeCard(state.game, name, position);
        if (placed === state.game) continue;
        let linked = placed;
        const connections: { neighbor: string; neighborId: string; relation: SemanticRelation; direction: PendingSemanticEdge['direction'] }[] = [];
        for (const neighbor of cards) {
          if (Math.abs(neighbor.coordinates.x - position.x) + Math.abs(neighbor.coordinates.y - position.y) !== 1) continue;
          for (const relation of RELATION_PRESETS) {
            if (relation.family !== 'kind') continue;
            const direction = isTrainingRelation(name, neighbor.cardName, relation.family) ? 'new-to-neighbor'
              : isTrainingRelation(neighbor.cardName, name, relation.family) ? 'neighbor-to-new' : null;
            if (!direction) continue;
            linked = upsertPendingSemanticEdge(linked, neighbor.id, relation, direction);
            connections.push({ neighbor: neighbor.cardName, neighborId: neighbor.id, relation, direction });
          }
        }
        if (!connections.length) continue;
        const score = linked.pendingMove?.scorePreview;
        const path = Boolean(score?.edges.some(e => e.pathBonus));
        const node = Boolean(score?.edges.some(e => e.nodeBonus));
        // Keep the single prepared center until a genuine multi-link node is available.
        if (name === TRAINING_NODE_CARD && (!state.sawPath || !node)) continue;
        const priority = (!state.sawPath && path ? 30 : 0) + (!state.sawNode && node ? 20 : 0);
        candidates.push({ name, neighbor: connections[0].neighbor, position, relation: connections[0].relation, connections, path, node, priority });
      }
  }
  return candidates.sort((a, b) => b.priority - a.priority)[0];
}

function opponentTurn(state: TrainingState): TrainingState {
  if (state.sawNode && state.sawPath) return { ...state, phase: 'complete', feedback: '' };
  const game = state.game;
  for (const neighbor of Object.values(game.board).filter(c => c.playerId === 0)) {
    const choices = (opposites[neighbor.cardName] ?? []).filter(name => [...game.players[1].cards, ...game.deck[1]].includes(name));
    for (let attempt = 0; attempt < choices.length; attempt++) {
    const name = choices[(state.opponentAttempt + attempt) % choices.length];
    // The scripted opponent draws its next prepared answer without changing its card pool.
    const hand = [...game.players[1].cards];
    const deck = [...game.deck[1]];
    if (!hand.includes(name)) {
      deck.splice(deck.indexOf(name), 1);
      const returned = hand.pop();
      if (returned) deck.push(returned);
      hand.push(name);
    }
    const prepared = { ...game, players: game.players.map((player, i) => i === 1 ? { ...player, cards: hand } : player), deck: game.deck.map((cards, i) => i === 1 ? deck : cards) };
    for (const offset of offsets) {
      const position = { x: neighbor.coordinates.x + offset.x, y: neighbor.coordinates.y + offset.y };
      // Leave opening cells around the neutral card available for independent player moves.
      const center = game.startCard.coordinates;
      if (Math.abs(position.x - center.x) + Math.abs(position.y - center.y) <= 1) continue;
      const placed = placeCard(prepared, name, position);
      if (placed === prepared) continue;
      const linked = upsertPendingSemanticEdge(placed, neighbor.id, RELATION_PRESETS.find(r => r.family === 'opposite')!, 'new-to-neighbor');
      const submitted = submitPendingSemanticMove(linked);
      if (submitted.pendingMove?.semanticStatus !== 'voting') continue;
      return { ...state, game: submitted, phase: 'opponent', feedback: state.opponentAttempt ? 'Соперник предлагает другую карту с тем же типом связи.' : '', lastExplanation: `«${name}» и «${neighbor.cardName}» противопоставлены по эмоциональному смыслу. Поэтому соперник выбрал «Противоположность».` };
    }
  }
  }
  // The scripted opponent can pass when it has exhausted its prepared answers.
  return { ...state, game: { ...game, currentPlayerIndex: 0 }, phase: nextPlayerPhase(state), feedback: 'У соперника закончились подготовленные ответы. Продолжите строить свой путь и узел.' };
}

export function trainingReducer(state: TrainingState, action: TrainingAction): TrainingState {
  const { game, phase } = state;
  switch (action.type) {
    case 'restart': return createTrainingState();
    case 'hint': return { ...state, feedback: action.text };
    case 'begin':
    case 'next': {
      if (steps[phase]) return { ...state, phase: steps[phase]!, feedback: '', explainedReminder: state.explainedReminder || phase === 'reminder' };
      if (phase === 'result') return state.moves === 1 ? { ...state, phase: 'score' } : opponentTurn(state);
      if (phase === 'log') return opponentTurn(state);
      if (phase === 'opponent-result') return { ...state, game: { ...game, currentPlayerIndex: 0 }, phase: nextPlayerPhase(state), feedback: '' };
      return state;
    }
    case 'select': return phase === 'place' && game.players[0].cards.includes(action.name) ? { ...state, selected: action.name, feedback: '' } : state;
    case 'place': {
      if (phase !== 'place' || !game.players[0].cards.includes(action.name)) return state;
      const next = placeCard(game, action.name, action.position);
      return next === game ? { ...state, feedback: 'Нужна свободная клетка рядом с картой на поле: сверху, снизу, слева или справа.' }
        : { ...state, game: next, phase: 'relation', feedback: '', selected: null };
    }
    case 'relation': return phase === 'relation' ? { ...state, game: upsertPendingSemanticEdge(game, action.neighbor, action.relation, action.direction), feedback: '' } : state;
    case 'remove': return phase === 'relation' ? { ...state, game: removePendingSemanticEdge(game, action.neighbor), feedback: '' } : state;
    case 'cancel': return phase === 'relation' || phase === 'explain' ? { ...state, game: returnPendingCard(game), phase: 'place', feedback: 'Карта возвращена в руку. Можно попробовать другой ход.' } : state;
    case 'submit': {
      if (phase !== 'relation') return state;
      if (!game.pendingMove?.semanticEdges?.length) return { ...state, feedback: 'Выберите хотя бы одну связь перед голосованием.' };
      if (game.pendingMove.cardName === TRAINING_NODE_CARD && !game.pendingMove.scorePreview?.edges.some(edge => edge.nodeBonus)) {
        return { ...state, feedback: 'Для учебного узла сделайте «Состояние» общим центром: свяжите с ним как минимум две соседние карты типом «Вид», направляя обе связи к «Состоянию». Можно отменить размещение и выбрать другую клетку.' };
      }
      return state.moves === 0 ? { ...state, phase: 'explain', feedback: '' } : { ...state, game: submitPendingSemanticMove(game), phase: 'voting', feedback: '' };
    }
    case 'explain': {
      if (phase !== 'explain') return state;
      const next = submitPendingSemanticMove(game);
      return next === game ? state : { ...state, game: next, phase: 'voting', feedback: '' };
    }
    case 'accept': {
      if (phase !== 'voting') return state;
      const pending = game.pendingMove!;
      const accepted = pending.semanticEdges?.length && pending.semanticEdges.every(edge => {
        const neighbor = Object.values(game.board).find(card => card.id === edge.neighborCardInstanceId);
        if (!neighbor) return false;
        const [from, to] = edge.direction === 'new-to-neighbor' ? [pending.cardName, neighbor.cardName] : [neighbor.cardName, pending.cardName];
        return isTrainingRelation(from, to, edge.relation.family);
      });
      if (!accepted) return { ...state, game: returnPendingCard(game), phase: 'place', feedback: 'Соперник отклонил ход: не все связи входят в подготовленные примеры. Карта вернулась в руку, очки не изменились. В обычной партии допустимость решают игроки по вашему обоснованию.' };
      // Draw a prepared subtype of the first played emotion, so every opening has a path continuation.
      const subtype = TRAINING_RESERVE.find(name => subtypes[name] === pending.cardName && game.deck[0].includes(name));
      let ready = subtype ? { ...game, deck: game.deck.map((cards, index) => index === 0 ? [...cards.filter(c => c !== subtype), subtype] : cards) } : game;
      // The opening chooses a prepared five-card reserve branch: its subtype plus a new node center.
      if (state.moves === 0 && subtype && ready.deck[0].length > 1) {
        ready = { ...ready, deck: ready.deck.map((cards, index) => index === 0 ? [TRAINING_NODE_CARD, ...cards.slice(1)] : cards) };
      }
      const previewPath = Boolean(ready.pendingMove?.scorePreview?.edges.some(edge => edge.pathBonus));
      if (previewPath && ready.deck[0].includes(TRAINING_NODE_CARD)) {
        ready = { ...ready, deck: ready.deck.map((cards, index) => index === 0 ? [...cards.filter(name => name !== TRAINING_NODE_CARD), TRAINING_NODE_CARD] : cards) };
      }
      const confirmed = confirmPendingCard(ready);
      const score = confirmed.logDetails?.[confirmed.log.length - 1]?.score.semanticScore;
      const path = Boolean(score?.edges.some(e => e.pathBonus));
      const node = Boolean(score?.edges.some(e => e.nodeBonus));
      const acceptedState: TrainingState = { ...state, game: confirmed, phase: 'result', feedback: '', opponentAttempt: 0, moves: state.moves + 1, lastGain: score?.total ?? 0,
        sawPath: state.sawPath || path, sawNode: state.sawNode || node, lastExplanation: '' };
      return state.moves === 0 ? acceptedState : opponentTurn(acceptedState);
    }
    case 'approve-opponent': {
      if (phase !== 'opponent') return state;
      const confirmed = confirmPendingCard(game);
      return { ...state, game: confirmed, phase: state.opponentResultShown ? nextPlayerPhase(state) : 'opponent-result', opponentResultShown: true, feedback: '' };
    }
    case 'reject-opponent': return phase === 'opponent' ? opponentTurn({ ...state, game: returnPendingCard(game), opponentAttempt: state.opponentAttempt + 1 }) : state;
  }
}
