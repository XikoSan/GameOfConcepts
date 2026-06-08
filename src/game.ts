import { CARD_NAMES, START_CARD_NAMES } from './types';
import type {
  CardName,
  Coordinates,
  Cross,
  GameState,
  PendingCross,
  PendingMove,
  PlacedCard,
  PlayerHand,
  RegularCardName,
  TurnScoreResult,
} from './types';

export { CARD_NAMES, START_CARD_NAMES };
export type {
  CardName,
  Coordinates,
  Cross,
  GameState,
  PendingCross,
  PendingMove,
  PlacedCard,
  PlayerHand,
  RegularCardName,
  TurnScoreResult,
};

const BOARD_CENTER: Coordinates = { x: 7, y: 7 };
const HAND_SIZE = 5;
const ADJACENCY_BONUS_PER_ENEMY_NEIGHBOR = 2;

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
    pendingCross: null,
    pendingTurnScore: null,
    crosses: [],
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

function getCrossArmCoordinates(center: Coordinates): Coordinates[] {
  return [
    center,
    { x: center.x, y: center.y - 1 },
    { x: center.x, y: center.y + 1 },
    { x: center.x - 1, y: center.y },
    { x: center.x + 1, y: center.y },
  ];
}

function getPlayerLabel(playerId: 0 | 1): string {
  return playerId === 0 ? 'Игрок 1' : 'Игрок 2';
}

function getPendingMovePlayerIndex(pendingMove: PendingMove): 0 | 1 | null {
  return pendingMove.playerIndex ?? pendingMove.playerId ?? null;
}

function getPendingMoveReviewerIndex(pendingMove: PendingMove): 0 | 1 | null {
  return pendingMove.reviewerIndex ?? pendingMove.reviewerId ?? null;
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
  const enemyNeighborCount = getAdjacentCoordinates(card.coordinates).filter(
    (coordinates) => isConfirmedOtherColorCard(board[getBoardKey(coordinates)], playerId)
  ).length;

  return enemyNeighborCount * ADJACENCY_BONUS_PER_ENEMY_NEIGHBOR;
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

function getCrossBonus(crosses: Cross[], playerId: 0 | 1): number {
  return crosses.reduce(
    (bonus, cross) => (cross.playerId === playerId ? bonus + cross.points : bonus),
    0
  );
}

interface ScoreBreakdown {
  basePoints: number;
  adjacencyBonus: number;
  chainBonus: number;
  crossBonus: number;
  total: number;
}

function getScoreBreakdown(
  board: GameState['board'],
  crosses: Cross[],
  playerId: 0 | 1
): ScoreBreakdown {
  const confirmedCards = Object.values(board).filter((card) =>
    isConfirmedPlayerCard(card, playerId)
  );
  const basePoints = confirmedCards.length;
  const adjacencyBonus = confirmedCards.reduce(
    (bonus, card) => bonus + getAdjacencyBonus(board, card, playerId),
    0
  );
  const chainBonus =
    getChainBonusForPlayer(board, playerId, 'horizontal') +
    getChainBonusForPlayer(board, playerId, 'vertical');
  const crossBonus = getCrossBonus(crosses, playerId);

  return {
    basePoints,
    adjacencyBonus,
    chainBonus,
    crossBonus,
    total: basePoints + adjacencyBonus + chainBonus + crossBonus,
  };
}

function calculateScores(
  board: GameState['board'],
  crosses: Cross[]
): GameState['scores'] {
  return [
    getScoreBreakdown(board, crosses, 0).total,
    getScoreBreakdown(board, crosses, 1).total,
  ];
}

function getChainLabelByBonus(chainBonus: number): string {
  if (chainBonus === 1) return 'цепочка в 3';
  if (chainBonus === 2) return 'цепочка в 5';
  if (chainBonus === 3) return 'цепочка в 7';
  if (chainBonus === 4) return 'цепочка в 9';
  return 'цепочка';
}

function createTurnScoreResult(
  playerId: 0 | 1,
  cardName: CardName,
  before: ScoreBreakdown,
  after: ScoreBreakdown,
  crossBonus = 0
): TurnScoreResult {
  const basePoints = after.basePoints - before.basePoints;
  const adjacencyBonus = after.adjacencyBonus - before.adjacencyBonus;
  const chainBonus = after.chainBonus - before.chainBonus;
  const totalGained = basePoints + adjacencyBonus + chainBonus + crossBonus;

  return {
    playerId,
    cardName,
    basePoints,
    adjacencyBonus,
    chainBonus,
    crossBonus,
    totalGained,
    newTotalScore: after.total + crossBonus,
  };
}

function formatTurnScoreLog(
  turnScore: TurnScoreResult,
  options?: { crossRejected?: boolean }
): string {
  const scoreParts: string[] = [];

  if (turnScore.basePoints > 0) scoreParts.push(`+${turnScore.basePoints} карта`);
  if (turnScore.adjacencyBonus > 0) {
    scoreParts.push(`+${turnScore.adjacencyBonus} соседство`);
  }
  if (turnScore.chainBonus > 0) {
    scoreParts.push(`+${turnScore.chainBonus} ${getChainLabelByBonus(turnScore.chainBonus)}`);
  }
  if (turnScore.crossBonus > 0) scoreParts.push(`+${turnScore.crossBonus} крестовина`);
  if (options?.crossRejected) scoreParts.push('Крестовина не засчитана');

  return `${getPlayerLabel(turnScore.playerId)} сыграл карту «${turnScore.cardName}».\n${scoreParts.join(
    ', '
  )}. Итог ${turnScore.totalGained}.`;
}

function getCrossMajorityPlayerId(cards: PlacedCard[]): 0 | 1 | null {
  let playerOneCards = 0;
  let playerTwoCards = 0;

  cards.forEach((card) => {
    if (card.playerId === 0) playerOneCards += 1;
    if (card.playerId === 1) playerTwoCards += 1;
  });

  if (playerOneCards > playerTwoCards) return 0;
  if (playerTwoCards > playerOneCards) return 1;
  return null;
}

function findPendingCrossCandidate(
  board: GameState['board'],
  placedCard: PlacedCard
): PendingCross | null {
  const { coordinates } = placedCard;
  const potentialCenters = [
    coordinates,
    { x: coordinates.x, y: coordinates.y - 1 },
    { x: coordinates.x, y: coordinates.y + 1 },
    { x: coordinates.x - 1, y: coordinates.y },
    { x: coordinates.x + 1, y: coordinates.y },
  ];

  for (const center of potentialCenters) {
    const crossCards = getCrossArmCoordinates(center).map(
      (crossCoordinates) => board[getBoardKey(crossCoordinates)]
    );

    if (
      crossCards.every(
        (card): card is PlacedCard =>
          Boolean(card) &&
          card.status === 'confirmed' &&
          card.playerId !== null &&
          !card.crossId
      )
    ) {
      const centerCard = board[getBoardKey(center)];
      if (!centerCard) continue;

      const playerId = getCrossMajorityPlayerId(crossCards);
      if (playerId === null) continue;

      // TODO: add UI for choosing between several valid cross candidates.
      return {
        centerX: center.x,
        centerY: center.y,
        playerId,
        cardIds: crossCards.map((card) => card.id),
        cardNames: crossCards.map((card) => card.cardName),
        centerCardName: centerCard.cardName,
        points: 5,
      };
    }
  }

  return null;
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
  if (gameState.pendingMove || gameState.pendingCross) return false;

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

  const playerIndex = gameState.currentPlayerIndex;
  const reviewerIndex = playerIndex === 0 ? 1 : 0;

  return {
    ...gameState,
    board: newBoard,
    players: newPlayers,
    pendingMove: {
      cardId: placedCard.id,
      cardName,
      playerIndex,
      reviewerIndex,
      playerId: playerIndex,
      reviewerId: reviewerIndex,
    },
    lastPlacedCardId: placedCard.id,
  };
}

export function confirmPendingCard(gameState: GameState): GameState {
  if (!gameState.pendingMove) return gameState;

  const { cardId, cardName } = gameState.pendingMove;
  const playerIndex = getPendingMovePlayerIndex(gameState.pendingMove);
  const reviewerIndex = getPendingMoveReviewerIndex(gameState.pendingMove);

  if (playerIndex === null || reviewerIndex === null) return gameState;

  const scoreBefore = getScoreBreakdown(gameState.board, gameState.crosses, playerIndex);
  const newBoard = Object.fromEntries(
    Object.entries(gameState.board).map(([key, card]) => [
      key,
      card.id === cardId ? { ...card, status: 'confirmed' as const } : card,
    ])
  );
  const newPlayers = gameState.players.map((player, index) => {
    if (index !== playerIndex) return player;

    return {
      ...player,
      cards: drawToHand(player.cards, gameState.deck[index]),
    };
  }) as GameState['players'];
  const newDeck = gameState.deck.map((deck, index) => {
    if (
      index === playerIndex &&
      newPlayers[index].cards.length > gameState.players[index].cards.length
    ) {
      return deck.slice(0, -1);
    }
    return deck;
  }) as GameState['deck'];
  const confirmedPlacedCard = Object.values(newBoard).find((card) => card.id === cardId);
  const pendingCross = confirmedPlacedCard
    ? findPendingCrossCandidate(newBoard, confirmedPlacedCard)
    : null;
  const scoreAfter = getScoreBreakdown(newBoard, gameState.crosses, playerIndex);
  const turnScore = createTurnScoreResult(playerIndex, cardName, scoreBefore, scoreAfter);

  return {
    ...gameState,
    board: newBoard,
    players: newPlayers,
    deck: newDeck,
    pendingMove: null,
    pendingCross,
    pendingTurnScore: pendingCross ? turnScore : null,
    scores: calculateScores(newBoard, gameState.crosses),
    currentPlayerIndex: reviewerIndex,
    log: pendingCross
      ? gameState.log
      : [...gameState.log, formatTurnScoreLog(turnScore)],
  };
}

export function returnPendingCard(gameState: GameState): GameState {
  if (!gameState.pendingMove) return gameState;

  const { cardId, cardName } = gameState.pendingMove;
  const playerIndex = getPendingMovePlayerIndex(gameState.pendingMove);

  if (playerIndex === null) return gameState;

  const cardEntry = Object.entries(gameState.board).find(
    ([, card]) => card.id === cardId
  );
  if (!cardEntry) return gameState;

  const [cardKey] = cardEntry;
  const newBoard = { ...gameState.board };
  delete newBoard[cardKey];

  const newPlayers = gameState.players.map((player, index) => {
    if (index !== playerIndex || player.cards.length >= HAND_SIZE) return player;

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
    pendingTurnScore: null,
    scores: calculateScores(newBoard, gameState.crosses),
    currentPlayerIndex: playerIndex,
    lastPlacedCardId: gameState.startCard.id,
  };
}

export function approvePendingCross(gameState: GameState): GameState {
  if (!gameState.pendingCross) return gameState;

  const { cardIds, centerX, centerY, cardNames, playerId } = gameState.pendingCross;
  const reviewerId = gameState.currentPlayerIndex;
  const cross: Cross = {
    id: `cross_${Date.now()}_${Math.random()}`,
    centerX,
    centerY,
    playerId,
    cardNames,
    points: 5,
  };
  const cardIdsInCross = new Set(cardIds);
  const newBoard = Object.fromEntries(
    Object.entries(gameState.board).map(([key, card]) => [
      key,
      cardIdsInCross.has(card.id) ? { ...card, crossId: cross.id } : card,
    ])
  ) as GameState['board'];
  const newCrosses = [...gameState.crosses, cross];
  const newScores = calculateScores(newBoard, newCrosses);

  return {
    ...gameState,
    board: newBoard,
    crosses: newCrosses,
    pendingCross: null,
    pendingTurnScore: null,
    scores: newScores,
    log: [
      ...gameState.log,
      `${getPlayerLabel(reviewerId)} одобрил крестовину ${getPlayerLabel(playerId)}: +5 очков`,
    ],
  };
}

export function rejectPendingCross(gameState: GameState): GameState {
  if (!gameState.pendingCross) return gameState;
  const { playerId } = gameState.pendingCross;
  const reviewerId = gameState.currentPlayerIndex;

  return {
    ...gameState,
    pendingCross: null,
    pendingTurnScore: null,
    scores: calculateScores(gameState.board, gameState.crosses),
    log: [
      ...gameState.log,
      `${getPlayerLabel(reviewerId)} не одобрил крестовину ${getPlayerLabel(playerId)}`,
    ],
  };
}
