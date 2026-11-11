import { applyGameAction, type GameAction } from '../gameActions';
import type { Room } from '../types/room';
import { getRelationPresets, isRelationAllowed } from '../scoring/semanticRelations';

// This module runs on the server too. Never accept scores, votes or a replacement state from a client.
export function applyAuthenticatedAction(room: Room, actor: string, action: GameAction, expectedMoveId?: string): Room {
  const member = room.players.find(player => player.id === actor);
  if (!member || room.status !== 'playing') throw Error('Нет доступа к действиям в этой партии.');
  if (room.game_state.gameOver) throw Error('Партия завершена.');
  const activeId = room.turn_order[room.current_turn_index];
  const active = room.players.find(player => player.id === activeId);
  if (!active) throw Error('Неверная очередь ходов.');
  const turnOrder = room.turn_order.map(id => {
    const player = room.players.find(member => member.id === id);
    if (!player) throw Error('Неверная очередь ходов.');
    return player.seatIndex;
  });
  let game = { ...room.game_state, currentPlayerIndex: active.seatIndex };
  const pending = game.pendingMove;
  const turn = room.current_turn_index;
  if (game.pendingFinish && action.type !== 'voteFinish') throw Error('Дождитесь решения о завершении партии.');
  if (action.type === 'voteFinish') {
    if (!game.pendingFinish || action.finishId !== game.pendingFinish.id || typeof action.accept !== 'boolean') throw Error('Это предложение о завершении уже изменилось.');
    const before = game;
    // Identity comes exclusively from the authenticated actor, never the payload seat.
    game = applyGameAction(game, { type: 'voteFinish', playerIndex: member.seatIndex, accept: action.accept, finishId: action.finishId }, turnOrder);
    if (game === before) throw Error('Голос недоступен или уже учтён.');
  } else if (action.type === 'confirmCard' || action.type === 'returnCard') {
    if (!pending || pending.semanticStatus !== 'voting' || expectedMoveId !== pending.cardId) throw Error('Этот ход уже изменился.');
    const author = room.players.find(player => player.seatIndex === pending.playerIndex)?.id;
    const voters = room.turn_order.filter(id => id !== author);
    if (actor === author || !voters.includes(actor) || pending.votes?.[actor]) throw Error('Голос недоступен или уже учтён.');
    const votes = { ...pending.votes, [actor]: action.type === 'confirmCard' ? 'accept' as const : 'reject' as const };
    game = { ...game, pendingMove: { ...pending, requiredVoters: voters, votes } };
    const accepts = voters.filter(id => votes[id] === 'accept').length;
    const remaining = voters.filter(id => !votes[id]).length;
    const majority = Math.floor(voters.length / 2) + 1;
    if (accepts >= majority) {
      game = applyGameAction(game, { type: 'confirmCard' }, turnOrder);
    } else if (accepts + remaining < majority) {
      game = applyGameAction(game, { type: 'returnCard' });
    }
  } else {
    if (actor !== activeId) throw Error('Сейчас ход другого игрока.');
    if (!['placeCard', 'redrawHand', 'upsertSemanticEdge', 'removeSemanticEdge', 'submitSemanticMove', 'cancelPendingMove', 'passTurn', 'requestFinish'].includes(action.type)) throw Error('Неизвестное действие.');
    if (pending?.semanticStatus === 'voting') throw Error('Дождитесь голосования.');
    if (action.type === 'placeCard') {
      const c = action.coordinates;
      if (!c || !Number.isSafeInteger(c.x) || !Number.isSafeInteger(c.y) || Math.abs(c.x) > 10000 || Math.abs(c.y) > 10000 || typeof action.cardName !== 'string' || !game.players[member.seatIndex].cards.includes(action.cardName)) throw Error('Недопустимая карта или клетка.');
      if (pending) throw Error('Сначала завершите текущий ход.');
    } else if (action.type === 'redrawHand') {
      action = { type: 'redrawHand', playerIndex: member.seatIndex };
    } else if (action.type === 'passTurn' || action.type === 'requestFinish') {
      action = { type: action.type, playerIndex: member.seatIndex };
    } else {
      if (!pending || pending.playerIndex !== member.seatIndex || expectedMoveId !== pending.cardId) throw Error('Этот ход уже изменился.');
      if (action.type === 'upsertSemanticEdge') {
        if (!action.relation || !isRelationAllowed(action.relation, game.deckSnapshot) || !['new-to-neighbor','neighbor-to-new'].includes(action.direction)) throw Error('Недопустимая связь.');
        // Keep only canonical roles; ignore additional client-supplied relation fields.
        action = { ...action, relation: getRelationPresets(game.deckSnapshot).find(preset => preset.family === (action as Extract<GameAction, {type: 'upsertSemanticEdge'}>).relation.family)! };
      }
    }
    const before = game;
    game = applyGameAction(game, action, turnOrder);
    if (game === before) throw Error('Действие нарушает правила игры.');
    if (game.pendingMove && ['placeCard','submitSemanticMove'].includes(action.type)) {
      const reviewer = room.players.find(player => player.id === room.turn_order[(turn + 1) % room.turn_order.length])!;
      game = { ...game, pendingMove: { ...game.pendingMove, placedByPlayerId: actor,
        placedBySeatIndex: member.seatIndex, requiredVoters: room.turn_order.filter(id => id !== actor),
        votes: {}, reviewerIndex: reviewer.seatIndex, reviewerId: reviewer.seatIndex } };
    }
  }
  const nextTurn = turnOrder.indexOf(game.currentPlayerIndex);
  return { ...room, game_state: game, current_turn_index: nextTurn, version: room.version + 1 };
}
