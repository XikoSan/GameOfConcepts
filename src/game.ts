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
  PendingCross,
  PendingMove,
  PendingSemanticEdge,
  PlacedCard,
  PlayerHand,
  RegularCardName,
  SemanticEdge,
  SemanticRelation,
  SemanticMoveScore,
  TurnScoreResult,
} from './types';
import { calculateSemanticMoveScore } from './scoring/calculateSemanticMoveScore';
import { createSemanticEdgeFromPending } from './scoring/semanticRelations';

export { CARD_NAMES, START_CARD_NAMES };
export type {
  CardName,
  Coordinates,
  Cross,
  GameState,
  PendingCross,
  PendingMove,
  PendingSemanticEdge,
  PlacedCard,
  PlayerHand,
  RegularCardName,
  SemanticEdge,
  SemanticMoveScore,
  SemanticRelation,
  TurnScoreResult,
};

const BOARD_CENTER: Coordinates = { x: 7, y: 7 };
const HAND_SIZE = 5;
const SCORING_VERSION = 3;
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
    semanticEdges: [],
    scoringVersion: SCORING_VERSION,
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

function ensureScoreCapacity(scores: number[], playerCount: number): number[] {
  const nextScores = [...scores];

  while (nextScores.length < playerCount) {
    nextScores.push(0);
  }

  return nextScores;
}

function createTurnScoreResult(
  playerId: number,
  cardName: CardName,
  semanticScore: NonNullable<PendingMove['scorePreview']>,
  newTotalScore: number
): TurnScoreResult {
  return {
    playerId,
    cardName,
    semanticScore,
    edgeCount: semanticScore.edges.length,
    totalGained: semanticScore.total,
    newTotalScore,
  };
}

function formatTurnScoreLog(turnScore: TurnScoreResult): string {
  return `${getPlayerLabel(turnScore.playerId)} сыграл «${turnScore.cardName}». ${turnScore.edgeCount ?? 0} связи, +${turnScore.totalGained}.`;
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

function getSemanticEdges(gameState: GameState): SemanticEdge[] {
  return gameState.semanticEdges ?? [];
}

function getMoveId(pendingMove: PendingMove): string {
  return pendingMove.moveId ?? pendingMove.id ?? pendingMove.cardId;
}

function getPlacedCardForPendingMove(
  board: GameState['board'],
  pendingMove: PendingMove
): PlacedCard | null {
  return Object.values(board).find((card) => card.id === pendingMove.cardId) ?? null;
}

function getPendingMovePosition(
  board: GameState['board'],
  pendingMove: PendingMove
): Coordinates | null {
  return (
    pendingMove.position ??
    getPlacedCardForPendingMove(board, pendingMove)?.coordinates ??
    null
  );
}

export function getPhysicalSemanticNeighbors(
  gameState: GameState,
  pendingMove = gameState.pendingMove
): PlacedCard[] {
  if (!pendingMove) return [];
  const position = getPendingMovePosition(gameState.board, pendingMove);
  if (!position) return [];

  return getAdjacentCoordinates(position)
    .map((coordinates) => gameState.board[getBoardKey(coordinates)])
    .filter((card): card is PlacedCard => Boolean(card) && card.status === 'confirmed');
}

function getPendingScorePreview(
  gameState: GameState,
  pendingMove: PendingMove
) {
  const position = getPendingMovePosition(gameState.board, pendingMove);
  const placedBySeatIndex =
    pendingMove.placedBySeatIndex ?? getPendingMovePlayerIndex(pendingMove);

  if (!position || placedBySeatIndex === null || !pendingMove.semanticEdges?.length) {
    return { edges: [], total: 0 };
  }

  return calculateSemanticMoveScore({
    board: gameState.board,
    existingEdges: getSemanticEdges(gameState),
    pendingMove: {
      moveId: getMoveId(pendingMove),
      cardId: pendingMove.cardId,
      position,
      placedBySeatIndex,
      semanticEdges: pendingMove.semanticEdges,
    },
    activeSeatIndex: placedBySeatIndex,
  });
}

export function upsertPendingSemanticEdge(
  gameState: GameState,
  neighborCardInstanceId: string,
  relation: SemanticRelation,
  direction: PendingSemanticEdge['direction']
): GameState {
  if (!gameState.pendingMove) return gameState;
  if (gameState.pendingMove.semanticStatus === 'voting') return gameState;

  const neighbor = getPhysicalSemanticNeighbors(gameState).find(
    (card) => card.id === neighborCardInstanceId
  );
  if (!neighbor) return gameState;

  const currentEdges = gameState.pendingMove.semanticEdges ?? [];
  const existingEdge = currentEdges.find(
    (edge) => edge.neighborCardInstanceId === neighborCardInstanceId
  );
  const nextEdge: PendingSemanticEdge = {
    id: existingEdge?.id ?? `edge_${Date.now()}_${Math.random()}`,
    neighborPosition: neighbor.coordinates,
    neighborCardInstanceId,
    relation,
    direction,
    createdOrder: existingEdge?.createdOrder ?? currentEdges.length,
  };
  const semanticEdges = existingEdge
    ? currentEdges.map((edge) => (edge.id === existingEdge.id ? nextEdge : edge))
    : [...currentEdges, nextEdge];
  const pendingMove = {
    ...gameState.pendingMove,
    semanticStatus: 'defining-relations' as const,
    semanticEdges,
  };

  return {
    ...gameState,
    pendingMove: {
      ...pendingMove,
      scorePreview: getPendingScorePreview(gameState, pendingMove),
    },
  };
}

export function removePendingSemanticEdge(
  gameState: GameState,
  neighborCardInstanceId: string
): GameState {
  if (!gameState.pendingMove) return gameState;
  if (gameState.pendingMove.semanticStatus === 'voting') return gameState;

  const semanticEdges = (gameState.pendingMove.semanticEdges ?? [])
    .filter((edge) => edge.neighborCardInstanceId !== neighborCardInstanceId)
    .map((edge, index) => ({ ...edge, createdOrder: index }));
  const pendingMove = {
    ...gameState.pendingMove,
    semanticEdges,
  };

  return {
    ...gameState,
    pendingMove: {
      ...pendingMove,
      scorePreview: getPendingScorePreview(gameState, pendingMove),
    },
  };
}

export function submitPendingSemanticMove(gameState: GameState): GameState {
  if (!gameState.pendingMove) return gameState;
  if (!gameState.pendingMove.semanticEdges?.length) return gameState;

  const scorePreview = getPendingScorePreview(gameState, gameState.pendingMove);
  if (scorePreview.total <= 0) return gameState;

  return {
    ...gameState,
    pendingMove: {
      ...gameState.pendingMove,
      semanticStatus: 'voting',
      status: 'voting',
      scorePreview,
    },
  };
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
  const moveId = `move_${Date.now()}_${Math.random()}`;
  // This reviewer is kept for the legacy/two-player action path; multiplayer hooks
  // replace it with turn_order-based requiredVoters before persisting the move.
  const reviewerIndex = (playerIndex + 1) % gameState.players.length;

  return {
    ...gameState,
    board: newBoard,
    players: newPlayers,
    pendingMove: {
      id: moveId,
      moveId,
      cardId: placedCard.id,
      cardName,
      playerIndex,
      reviewerIndex,
      playerId: playerIndex,
      reviewerId: reviewerIndex,
      placedBySeatIndex: playerIndex,
      position: coordinates,
      status: 'defining-relations',
      semanticStatus: 'defining-relations',
      semanticEdges: [],
      scorePreview: { edges: [], total: 0 },
    },
    lastPlacedCardId: placedCard.id,
  };
}

export function confirmPendingCard(gameState: GameState): GameState {
  if (!gameState.pendingMove) return gameState;
  if (gameState.pendingMove.semanticStatus !== 'voting') return gameState;
  if (!gameState.pendingMove.semanticEdges?.length) return gameState;

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
  if (!confirmedPlacedCard) return gameState;

  const scorePreview = getPendingScorePreview(
    { ...gameState, board: newBoard },
    gameState.pendingMove
  );
  const acceptedSemanticEdges = gameState.pendingMove.semanticEdges.map((edge) =>
    createSemanticEdgeFromPending(gameState.pendingMove as PendingMove, edge, confirmedPlacedCard)
  );
  const nextScores = ensureScoreCapacity(
    gameState.scores,
    gameState.players.length
  );
  nextScores[playerIndex] = (nextScores[playerIndex] ?? 0) + scorePreview.total;

  if (import.meta.env.DEV) {
    console.debug('[semantic move score]', {
      moveId: gameState.pendingMove.moveId,
      placedBySeatIndex: playerIndex,
      edgeCount: scorePreview.edges.length,
      scorePreview,
      scoresBefore: gameState.scores,
      scoresAfter: nextScores,
    });
  }

  const turnScore = createTurnScoreResult(
    playerIndex,
    cardName,
    scorePreview,
    nextScores[playerIndex]
  );

  return {
    ...gameState,
    board: newBoard,
    players: newPlayers,
    deck: newDeck,
    pendingMove: null,
    pendingCross: null,
    pendingTurnScore: null,
    semanticEdges: [...getSemanticEdges(gameState), ...acceptedSemanticEdges],
    scores: nextScores,
    currentPlayerIndex: reviewerIndex,
    log: [...gameState.log, formatTurnScoreLog(turnScore)],
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
  return {
    ...gameState,
    pendingCross: null,
    pendingTurnScore: null,
  };
}

export function rejectPendingCross(gameState: GameState): GameState {
  return {
    ...gameState,
    pendingCross: null,
    pendingTurnScore: null,
  };
}
