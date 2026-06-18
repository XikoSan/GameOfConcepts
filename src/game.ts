import { CARD_NAMES, START_CARD_NAMES } from './types';
import {
  CARD_CATALOG,
  START_CARD_CATALOG,
  getCardDefinitionIdByName,
} from './data/cardCatalog';
import { MIXED_ALL_DECK, type DeckDefinition } from './data/deckDefinitions';
import { buildDeck, validateDeckCapacity } from './decks/deckBuilder';
import type {
  CardName,
  Coordinates,
  Cross,
  GameState,
  MoveScoreResult,
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
const PLACEMENT_SCORE = 1;
const NEIGHBOR_OWNER_SCORE = 1;
const SAME_NAME_PLACEMENT_WARNING = 'Нельзя ставить одинаковые понятия рядом.';

function shuffleCards(cards: RegularCardName[]): RegularCardName[] {
  const result = [...cards];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function getCardNamesByDefinitionIds(cardDefinitionIds: readonly string[]) {
  const cardsById = new Map(CARD_CATALOG.map((card) => [card.id, card.name]));
  return cardDefinitionIds
    .map((cardId) => cardsById.get(cardId))
    .filter((cardName): cardName is RegularCardName => Boolean(cardName));
}

export function createPlayerDeckFromSnapshot(
  deckSnapshot: GameState['deckSnapshot'],
  playerId: number
): { player: PlayerHand; deck: RegularCardName[] } | null {
  if (!deckSnapshot) return null;

  // Joining players receive a deck from the room snapshot,
  // not from the client's current catalog.
  const cardNames = getCardNamesByDefinitionIds(deckSnapshot.cardDefinitionIds);
  if (cardNames.length < HAND_SIZE) return null;

  const deck = shuffleCards(cardNames);
  const player = {
    playerId,
    cards: deck.splice(0, HAND_SIZE),
  };

  return { player, deck };
}

export function initializeGame(
  playerCount = 2,
  deckDefinition: DeckDefinition = MIXED_ALL_DECK
): GameState {
  const normalizedPlayerCount = Math.min(Math.max(playerCount, 2), 4);
  const builtDeck = buildDeck(CARD_CATALOG, deckDefinition);
  const capacity = validateDeckCapacity(builtDeck.totalCards, 1, HAND_SIZE);
  if (!capacity.valid) {
    throw new Error(capacity.message);
  }
  const deckTemplate = builtDeck.cards.map((card) => card.name);
  // Hands, decks, scores, and card ownership are all indexed by this stable seat count.
  const decks = Array.from({ length: normalizedPlayerCount }, () =>
    shuffleCards(deckTemplate)
  );
  const players = decks.map((deck, playerId) => ({
    playerId,
    cards: deck.splice(0, HAND_SIZE),
  }));
  const startCardName =
    START_CARD_NAMES[Math.floor(Math.random() * START_CARD_NAMES.length)];
  const startCard: PlacedCard = {
    id: `start_card_${Date.now()}_${Math.random()}`,
    definitionId: getCardDefinitionIdByName(startCardName, START_CARD_CATALOG),
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
    players,
    currentPlayerIndex: 0,
    deck: decks,
    // A deck id is configuration; the snapshot is the immutable
    // card composition owned by the running game.
    deckSnapshot: {
      sourceDeckId: deckDefinition.id,
      cardDefinitionIds: builtDeck.cardDefinitionIds,
      createdAt: new Date().toISOString(),
    },
    startCard,
    lastPlacedCardId: startCard.id,
    pendingMove: null,
    pendingCross: null,
    pendingTurnScore: null,
    crosses: [],
    scores: Array.from({ length: normalizedPlayerCount }, () => 0),
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

export function hasSameNameOrthogonalNeighbor(
  board: GameState['board'],
  coordinates: Coordinates,
  cardName: CardName
): boolean {
  return getAdjacentCoordinates(coordinates).some((adjacentCoordinates) => {
    const adjacentCard = board[getBoardKey(adjacentCoordinates)];
    return adjacentCard?.cardName === cardName;
  });
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

function getPlayerLabel(playerId: number): string {
  return `Игрок ${playerId + 1}`;
}

function getPendingMovePlayerIndex(pendingMove: PendingMove): number | null {
  return pendingMove.playerIndex ?? pendingMove.playerId ?? null;
}

function getPendingMoveReviewerIndex(pendingMove: PendingMove): number | null {
  return pendingMove.reviewerIndex ?? pendingMove.reviewerId ?? null;
}

function isPlacedAnchor(card: PlacedCard): boolean {
  return card.playerId === null || card.status === 'confirmed';
}

function isConfirmedPlayerCard(
  card: PlacedCard | undefined,
  playerId: number
): boolean {
  return card?.status === 'confirmed' && card.playerId === playerId;
}

function isConfirmedCard(card: PlacedCard | undefined): card is PlacedCard {
  return card !== undefined && card.status === 'confirmed';
}

function getConfirmedAdjacentCards(
  board: GameState['board'],
  coordinates: Coordinates
): PlacedCard[] {
  return getAdjacentCoordinates(coordinates)
    .map((adjacentCoordinates) => board[getBoardKey(adjacentCoordinates)])
    .filter(isConfirmedCard);
}

export function getActiveAdjacencyScore(neighborCount: number): number {
  if (neighborCount <= 0) return 0;
  if (neighborCount === 1) return 1;

  // The first neighbor is worth 1 point; placements with two or more
  // neighbors reward the active player with 2 points per neighbor.
  return Math.min(neighborCount, 4) * 2;
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
  playerId: number,
  direction: 'horizontal' | 'vertical'
): number {
  // Count each straight line once by starting only at cells without a same-color predecessor.
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

interface ScoreBreakdown {
  chainBonus: number;
}

function getScoreBreakdown(board: GameState['board'], playerId: number): ScoreBreakdown {
  const chainBonus =
    getChainBonusForPlayer(board, playerId, 'horizontal') +
    getChainBonusForPlayer(board, playerId, 'vertical');

  return {
    chainBonus,
  };
}

function ensureScoreCapacity(scores: number[], playerCount: number): number[] {
  const nextScores = [...scores];

  while (nextScores.length < playerCount) {
    nextScores.push(0);
  }

  return nextScores;
}

export function calculateMoveScore(
  boardBefore: GameState['board'],
  boardAfter: GameState['board'],
  placedCard: PlacedCard,
  playerId: number,
  crossScore = 0
): MoveScoreResult {
  const adjacentCards = getConfirmedAdjacentCards(boardAfter, placedCard.coordinates);
  const neighborOwnerAwards = adjacentCards.reduce<Record<number, number>>(
    (awards, neighbor) => {
      if (neighbor.playerId === null) return awards;

      // Each adjacent card also awards 1 point to its actual owner,
      // independently of the active player's adjacency bonus.
      awards[neighbor.playerId] =
        (awards[neighbor.playerId] ?? 0) + NEIGHBOR_OWNER_SCORE;
      return awards;
    },
    {}
  );
  const chainScore =
    getScoreBreakdown(boardAfter, playerId).chainBonus -
    getScoreBreakdown(boardBefore, playerId).chainBonus;
  const placementScore = PLACEMENT_SCORE;
  const adjacencyScore = getActiveAdjacencyScore(adjacentCards.length);
  const activePlayerTotal =
    placementScore + adjacencyScore + chainScore + crossScore;

  return {
    placementScore,
    adjacencyScore,
    chainScore,
    crossScore,
    activePlayerTotal,
    neighborOwnerAwards,
    neighborCount: adjacentCards.length,
  };
}

function createTurnScoreResult(
  playerId: number,
  cardName: CardName,
  moveScore: MoveScoreResult,
  newTotalScore: number
): TurnScoreResult {
  const ownNeighborAward = moveScore.neighborOwnerAwards[playerId] ?? 0;
  const totalGained = moveScore.activePlayerTotal + ownNeighborAward;

  return {
    playerId,
    cardName,
    basePoints: moveScore.placementScore,
    adjacencyBonus: moveScore.adjacencyScore,
    chainBonus: moveScore.chainScore,
    crossBonus: moveScore.crossScore,
    activePlayerTotal: moveScore.activePlayerTotal,
    neighborCount: moveScore.neighborCount,
    neighborOwnerAwards: moveScore.neighborOwnerAwards,
    totalGained,
    newTotalScore,
  };
}

function formatTurnScoreLog(
  turnScore: TurnScoreResult,
  options?: { crossRejected?: boolean }
): string {
  const ownerAwards = Object.entries(turnScore.neighborOwnerAwards)
    .filter(([seatIndex]) => Number(seatIndex) !== turnScore.playerId)
    .map(([seatIndex, award]) => `${getPlayerLabel(Number(seatIndex))} +${award}`);
  const crossRejectedText = options?.crossRejected
    ? '\nКрестовина не засчитана.'
    : '';
  const ownerAwardText = ownerAwards.length
    ? `\nЗа соседние карты: ${ownerAwards.join(', ')}.`
    : '';

  return `${getPlayerLabel(turnScore.playerId)} сыграл карту «${turnScore.cardName}». +${turnScore.totalGained}.${ownerAwardText}${crossRejectedText}`;
}

function getCrossMajorityPlayerId(cards: PlacedCard[]): number | null {
  const counts = new Map<number, number>();

  cards.forEach((card) => {
    if (card.playerId === null) return;
    counts.set(card.playerId, (counts.get(card.playerId) ?? 0) + 1);
  });

  const sortedCounts = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  if (!sortedCounts[0]) return null;
  if (sortedCounts[1] && sortedCounts[1][1] === sortedCounts[0][1]) return null;

  return sortedCounts[0][0];
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
          // Neutral cards count for adjacency, but never for cross ownership or eligibility.
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

  // TODO(rules): Define the official end-of-game condition for exhausted decks.
  if (newCards.length < HAND_SIZE && drawnCard) {
    newCards.push(drawnCard);
  }

  return newCards;
}

export function canPlaceCard(
  gameState: GameState,
  coordinates: Coordinates,
  cardName?: CardName
): boolean {
  if (gameState.pendingMove || gameState.pendingCross) return false;

  const key = getBoardKey(coordinates);
  if (gameState.board[key]) return false;
  if (
    cardName &&
    hasSameNameOrthogonalNeighbor(gameState.board, coordinates, cardName)
  ) {
    return false;
  }

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

  if (!canPlaceCard(gameState, coordinates, cardName)) {
    if (hasSameNameOrthogonalNeighbor(gameState.board, coordinates, cardName)) {
      // TODO(MVP): Show this placement validation reason in the game UI.
      console.warn(SAME_NAME_PLACEMENT_WARNING);
    }
    return gameState;
  }

  const currentPlayer = gameState.players[gameState.currentPlayerIndex];
  const cardIndex = currentPlayer.cards.indexOf(cardName);

  if (cardIndex === -1) {
    return gameState;
  }

  const placedCard: PlacedCard = {
    id: `card_${Date.now()}_${Math.random()}`,
    definitionId: getCardDefinitionIdByName(cardName),
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
  });

  const playerIndex = gameState.currentPlayerIndex;
  // This reviewer is kept for the legacy/two-player action path; multiplayer hooks
  // replace it with turn_order-based requiredVoters before persisting the move.
  const reviewerIndex = (playerIndex + 1) % gameState.players.length;

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
  });
  const newDeck = gameState.deck.map((deck, index) => {
    if (
      index === playerIndex &&
      newPlayers[index].cards.length > gameState.players[index].cards.length
    ) {
      return deck.slice(0, -1);
    }
    return deck;
  });
  const confirmedPlacedCard = Object.values(newBoard).find((card) => card.id === cardId);
  const pendingCross = confirmedPlacedCard
    ? findPendingCrossCandidate(newBoard, confirmedPlacedCard)
    : null;
  const moveScore = confirmedPlacedCard
    ? calculateMoveScore(
        gameState.board,
        newBoard,
        confirmedPlacedCard,
        playerIndex
      )
    : null;
  const nextScores = ensureScoreCapacity(
    gameState.scores,
    gameState.players.length
  );

  if (moveScore) {
    nextScores[playerIndex] =
      (nextScores[playerIndex] ?? 0) + moveScore.activePlayerTotal;

    Object.entries(moveScore.neighborOwnerAwards).forEach(([seatKey, award]) => {
      const seatIndex = Number(seatKey);
      nextScores[seatIndex] = (nextScores[seatIndex] ?? 0) + award;
    });
  }

  if (import.meta.env.DEV && moveScore) {
    console.debug('[move score]', {
      placedBySeatIndex: playerIndex,
      neighborCount: moveScore.neighborCount,
      placementScore: moveScore.placementScore,
      adjacencyScore: moveScore.adjacencyScore,
      chainScore: moveScore.chainScore,
      crossScore: moveScore.crossScore,
      activePlayerTotal: moveScore.activePlayerTotal,
      neighborOwnerAwards: moveScore.neighborOwnerAwards,
      scoresBefore: gameState.scores,
      scoresAfter: nextScores,
    });
  }

  const turnScore = moveScore
    ? createTurnScoreResult(playerIndex, cardName, moveScore, nextScores[playerIndex])
    : null;

  return {
    ...gameState,
    board: newBoard,
    players: newPlayers,
    deck: newDeck,
    pendingMove: null,
    pendingCross,
    pendingTurnScore: pendingCross ? turnScore : null,
    scores: nextScores,
    currentPlayerIndex: reviewerIndex,
    log: pendingCross || !turnScore
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
  });

  return {
    ...gameState,
    board: newBoard,
    players: newPlayers,
    pendingMove: null,
    pendingTurnScore: null,
    scores: ensureScoreCapacity(gameState.scores, gameState.players.length),
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
  const newScores = ensureScoreCapacity(gameState.scores, gameState.players.length);
  newScores[playerId] = (newScores[playerId] ?? 0) + cross.points;

  return {
    ...gameState,
    board: newBoard,
    crosses: newCrosses,
    pendingCross: null,
    pendingTurnScore: null,
    scores: newScores,
    log: [
      ...gameState.log,
      ...(gameState.pendingTurnScore
        ? [formatTurnScoreLog(gameState.pendingTurnScore)]
        : []),
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
    scores: ensureScoreCapacity(gameState.scores, gameState.players.length),
    log: [
      ...gameState.log,
      ...(gameState.pendingTurnScore
        ? [formatTurnScoreLog(gameState.pendingTurnScore)]
        : []),
      `${getPlayerLabel(reviewerId)} не одобрил крестовину ${getPlayerLabel(playerId)}`,
    ],
  };
}
