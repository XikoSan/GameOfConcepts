import { CARD_NAMES, START_CARD_NAMES } from './types';
import type {
  CardName,
  Coordinates,
  GameState,
  PendingMove,
  PlacedCard,
  PlayerHand,
  RegularCardName,
} from './types';

export { CARD_NAMES, START_CARD_NAMES };
export type {
  CardName,
  Coordinates,
  GameState,
  PendingMove,
  PlacedCard,
  PlayerHand,
  RegularCardName,
};

const BOARD_CENTER: Coordinates = { x: 7, y: 7 };
const HAND_SIZE = 5;
const ADJACENCY_BONUS_BY_NEIGHBOR_COUNT = [0, 1, 4, 6, 8] as const;

export function initializeGame(): GameState {
  const shuffle = (arr: RegularCardName[]): RegularCardName[] => {
    const result = [...arr];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  };

  const deck0 = shuffle([...CARD_NAMES]);
  const deck1 = shuffle([...CARD_NAMES]);

  const hand0 = deck0.splice(0, HAND_SIZE);
  const hand1 = deck1.splice(0, HAND_SIZE);
  const startCardName =
    START_CARD_NAMES[Math.floor(Math.random() * START_CARD_NAMES.length)];
  const startCard: PlacedCard = {
    id: `start_card_${Date.now()}_${Math.random()}`,
    cardName: startCardName,
    coordinates: BOARD_CENTER,
    playerId: null,
    status: 'confirmed',
    connections: [],
  };
  const startCardKey = `${BOARD_CENTER.x},${BOARD_CENTER.y}`;

  return {
    board: {
      [startCardKey]: startCard,
    },
    players: [
      { playerId: 0, cards: hand0 },
      { playerId: 1, cards: hand1 },
    ],
    currentPlayerIndex: 0,
    deck: [deck0, deck1],
    startCard,
    lastPlacedCardId: startCard.id,
    pendingMove: null,
    scores: [0, 0],
    log: [],
    gameOver: false,
  };
}

function getBoardKey(coordinates: Coordinates): string {
  return `${coordinates.x},${coordinates.y}`;
}

function getAdjacentCoordinates(coordinates: Coordinates): Coordinates[] {
  return [
    { x: coordinates.x, y: coordinates.y - 1 },
    { x: coordinates.x, y: coordinates.y + 1 },
    { x: coordinates.x - 1, y: coordinates.y },
    { x: coordinates.x + 1, y: coordinates.y },
  ];
}

function getPlayerLabel(playerId: 0 | 1): string {
  return playerId === 0 ? 'Игрок 1' : 'Игрок 2';
}

function isPlacedAnchor(card: PlacedCard): boolean {
  return card.playerId === null || card.status === 'confirmed';
}

function isConfirmedPlayerCard(
  card: PlacedCard | undefined,
  playerId: 0 | 1
): boolean {
  return card?.status === 'confirmed' && card.playerId === playerId;
}

function isConfirmedOtherColorCard(
  card: PlacedCard | undefined,
  playerId: 0 | 1
): boolean {
  return card?.status === 'confirmed' && card.playerId !== playerId;
}

function getAdjacencyBonus(
  board: GameState['board'],
  card: PlacedCard,
  playerId: 0 | 1
): number {
  const otherColorNeighborCount = getAdjacentCoordinates(card.coordinates).filter(
    (coordinates) => isConfirmedOtherColorCard(board[getBoardKey(coordinates)], playerId)
  ).length;

  return ADJACENCY_BONUS_BY_NEIGHBOR_COUNT[otherColorNeighborCount];
}

function getChainBonusForLineLength(lineLength: number): number {
  let remainingLength = lineLength;
  let bonus = 0;

  while (remainingLength >= 9) {
    bonus += 4;
    remainingLength -= 9;
  }

  if (remainingLength >= 7) return bonus + 3;
  if (remainingLength >= 5) return bonus + 2;
  if (remainingLength >= 3) return bonus + 1;

  return bonus;
}

function getChainBonusForPlayer(
  board: GameState['board'],
  playerId: 0 | 1,
  direction: 'horizontal' | 'vertical'
): number {
  return Object.values(board).reduce((bonus, card) => {
    if (!isConfirmedPlayerCard(card, playerId)) return bonus;

    const previousCoordinates =
      direction === 'horizontal'
        ? { x: card.coordinates.x - 1, y: card.coordinates.y }
        : { x: card.coordinates.x, y: card.coordinates.y - 1 };

    if (isConfirmedPlayerCard(board[getBoardKey(previousCoordinates)], playerId)) {
      return bonus;
    }

    let lineLength = 0;
    let currentCoordinates = card.coordinates;

    while (isConfirmedPlayerCard(board[getBoardKey(currentCoordinates)], playerId)) {
      lineLength += 1;
      currentCoordinates =
        direction === 'horizontal'
          ? { x: currentCoordinates.x + 1, y: currentCoordinates.y }
          : { x: currentCoordinates.x, y: currentCoordinates.y + 1 };
    }

    return bonus + getChainBonusForLineLength(lineLength);
  }, 0);
}

function getPlayerScore(board: GameState['board'], playerId: 0 | 1): number {
  const confirmedCards = Object.values(board).filter((card) =>
    isConfirmedPlayerCard(card, playerId)
  );
  const baseScore = confirmedCards.length;
  const adjacencyBonus = confirmedCards.reduce(
    (bonus, card) => bonus + getAdjacencyBonus(board, card, playerId),
    0
  );
  const chainBonus =
    getChainBonusForPlayer(board, playerId, 'horizontal') +
    getChainBonusForPlayer(board, playerId, 'vertical');

  return baseScore + adjacencyBonus + chainBonus;
}

function calculateScores(board: GameState['board']): GameState['scores'] {
  return [getPlayerScore(board, 0), getPlayerScore(board, 1)];
}

function drawToHand(
  cards: RegularCardName[],
  deck: RegularCardName[]
): RegularCardName[] {
  const newCards = [...cards];
  const drawnCard = deck.at(-1);

  if (newCards.length < HAND_SIZE && drawnCard) {
    newCards.push(drawnCard);
  }

  return newCards;
}

export function canPlaceCard(gameState: GameState, coordinates: Coordinates): boolean {
  if (gameState.pendingMove) return false;

  const key = getBoardKey(coordinates);
  if (gameState.board[key]) return false;

  return getAdjacentCoordinates(coordinates).some((adjacentCoordinates) => {
    const adjacentCard = gameState.board[getBoardKey(adjacentCoordinates)];
    return adjacentCard ? isPlacedAnchor(adjacentCard) : false;
  });
}

export function placeCard(
  gameState: GameState,
  cardName: RegularCardName,
  coordinates: Coordinates
): GameState {
  const newBoard = { ...gameState.board };
  const key = getBoardKey(coordinates);

  if (!canPlaceCard(gameState, coordinates)) {
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
    status: 'pending',
    connections: [],
  };

  newBoard[key] = placedCard;

  const newPlayers = gameState.players.map((player, index) => {
    if (index === gameState.currentPlayerIndex) {
      return {
        ...player,
        cards: player.cards.filter((_, cardPosition) => cardPosition !== cardIndex),
      };
    }

    return player;
  }) as GameState['players'];

  const reviewerId = gameState.currentPlayerIndex === 0 ? 1 : 0;

  return {
    ...gameState,
    board: newBoard,
    players: newPlayers,
    pendingMove: {
      cardId: placedCard.id,
      cardName,
      playerId: gameState.currentPlayerIndex,
      reviewerId,
    },
    lastPlacedCardId: placedCard.id,
  };
}

export function confirmPendingCard(gameState: GameState): GameState {
  if (!gameState.pendingMove) return gameState;

  const { cardId, cardName, playerId, reviewerId } = gameState.pendingMove;
  const newBoard = Object.fromEntries(
    Object.entries(gameState.board).map(([key, card]) => [
      key,
      card.id === cardId ? { ...card, status: 'confirmed' as const } : card,
    ])
  );
  const newPlayers = gameState.players.map((player, index) => {
    if (index !== playerId) return player;

    return {
      ...player,
      cards: drawToHand(player.cards, gameState.deck[index]),
    };
  }) as GameState['players'];
  const newDeck = gameState.deck.map((deck, index) => {
    if (
      index === playerId &&
      newPlayers[index].cards.length > gameState.players[index].cards.length
    ) {
      return deck.slice(0, -1);
    }
    return deck;
  }) as GameState['deck'];

  return {
    ...gameState,
    board: newBoard,
    players: newPlayers,
    deck: newDeck,
    pendingMove: null,
    scores: calculateScores(newBoard),
    currentPlayerIndex: reviewerId,
    log: [...gameState.log, `${getPlayerLabel(playerId)} сыграл карту ${cardName}.`],
  };
}

export function returnPendingCard(gameState: GameState): GameState {
  if (!gameState.pendingMove) return gameState;

  const { cardId, cardName, playerId } = gameState.pendingMove;
  const cardEntry = Object.entries(gameState.board).find(
    ([, card]) => card.id === cardId
  );
  if (!cardEntry) return gameState;

  const [cardKey] = cardEntry;
  const newBoard = { ...gameState.board };
  delete newBoard[cardKey];

  const newPlayers = gameState.players.map((player, index) => {
    if (index !== playerId || player.cards.length >= HAND_SIZE) return player;

    return {
      ...player,
      cards: [...player.cards, cardName],
    };
  }) as GameState['players'];

  return {
    ...gameState,
    board: newBoard,
    players: newPlayers,
    pendingMove: null,
    scores: calculateScores(newBoard),
    currentPlayerIndex: playerId,
    lastPlacedCardId: gameState.startCard.id,
  };
}
