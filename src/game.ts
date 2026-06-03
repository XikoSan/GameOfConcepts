import { CARD_NAMES } from './types';
import type { CardName, Coordinates, GameState, PlacedCard, PlayerHand } from './types';

export { CARD_NAMES };
export type { CardName, Coordinates, GameState, PlacedCard, PlayerHand };

export function initializeGame(): GameState {
  const shuffle = (arr: CardName[]): CardName[] => {
    const result = [...arr];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  };

  const deck0 = shuffle([...CARD_NAMES]);
  const deck1 = shuffle([...CARD_NAMES]);

  const hand0 = deck0.splice(0, 4);
  const hand1 = deck1.splice(0, 4);

  return {
    board: {},
    players: [
      { playerId: 0, cards: hand0 },
      { playerId: 1, cards: hand1 },
    ],
    currentPlayerIndex: 0,
    deck: [deck0, deck1],
    gameOver: false,
  };
}

function getUpdatedHand(
  cards: CardName[],
  deck: CardName[],
  playedCardIndex: number
): CardName[] {
  const newCards = [...cards];
  newCards.splice(playedCardIndex, 1);

  const drawnCard = deck.at(-1);
  if (newCards.length < 4 && drawnCard) {
    newCards.push(drawnCard);
  }

  return newCards;
}

export function placeCard(
  gameState: GameState,
  cardName: CardName,
  coordinates: Coordinates
): GameState {
  const newBoard = { ...gameState.board };
  const key = `${coordinates.x},${coordinates.y}`;

  if (newBoard[key]) {
    return gameState;
  }

  const currentPlayer = gameState.players[gameState.currentPlayerIndex];
  const cardIndex = currentPlayer.cards.indexOf(cardName);

  if (cardIndex === -1) {
    return gameState;
  }

  const placedCard: PlacedCard = {
    id: `card_${Date.now()}_${Math.random()}`,
    cardName,
    coordinates,
    playerId: gameState.currentPlayerIndex,
    connections: [],
  };

  newBoard[key] = placedCard;

  const newPlayers = gameState.players.map((player, index) => {
    if (index === gameState.currentPlayerIndex) {
      return {
        ...player,
        cards: getUpdatedHand(player.cards, gameState.deck[index], cardIndex),
      };
    }

    return player;
  }) as GameState['players'];

  const newDeck = gameState.deck.map((d, idx) => {
    if (idx === gameState.currentPlayerIndex) {
      return d.slice(0, -1);
    }
    return d;
  }) as GameState['deck'];

  return {
    ...gameState,
    board: newBoard,
    players: newPlayers,
    deck: newDeck,
    currentPlayerIndex: gameState.currentPlayerIndex === 0 ? 1 : 0,
  };
}
