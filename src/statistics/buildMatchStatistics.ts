import type { GameState, PlacedCard, RelationFamily, SemanticEdge } from '../types';
import { areOrthogonalNeighbors, formatSemanticRelation, getRelationFamilyLabel,
  getRelationPresets, isRelationAllowed } from '../scoring/semanticRelations';

export interface RelationUsage {
  family: RelationFamily;
  label: string;
  count: number;
}

export interface MoveStatistics {
  logIndex: number;
  seatIndex: number;
  cardName: string;
  total: number;
  base: number | null;
  pathBonus: number | null;
  nodeBonus: number | null;
  relations: string[];
}

export interface PlayerStatistics {
  seatIndex: number;
  moveCount: number;
  edgeCount: number | null;
  relations: RelationUsage[];
  favoriteFamilies: RelationFamily[];
  pathBonus: number | null;
  nodeBonus: number | null;
  bestMoves: MoveStatistics[];
}

export interface CentralCardStatistics {
  id: string;
  name: string;
  ownerSeatIndex: number | null;
  edgeCount: number;
  relations: string[];
}

export interface MatchStatistics {
  graphAvailable: boolean;
  historyAvailable: boolean;
  moveCount: number;
  edgeCount: number | null;
  relations: RelationUsage[];
  players: PlayerStatistics[];
  bestMoves: MoveStatistics[];
  centralCards: CentralCardStatistics[];
  pathBonus: number | null;
  nodeBonus: number | null;
}

export type MatchStatisticsInput = Pick<GameState, 'board' | 'players' | 'semanticEdges' |
  'logDetails' | 'scores' | 'deckSnapshot' | 'scoringVersion'>;

function bestMoves(moves: MoveStatistics[]): MoveStatistics[] {
  if (!moves.length) return [];
  const maximum = Math.max(...moves.map((move) => move.total));
  return moves.filter((move) => move.total === maximum);
}

function edgeSignature(edge: SemanticEdge, includeMetadata = true): string {
  const endpoints = [edge.fromCardInstanceId, edge.toCardInstanceId];
  if (edge.relation.family === 'opposite') endpoints.sort();
  return JSON.stringify([endpoints, edge.relation.family, ...(includeMetadata ? [edge.createdBySeatIndex,
    edge.createdAtMoveId, edge.createdOrder] : [])]);
}

export function buildMatchStatistics(game: MatchStatisticsInput): MatchStatistics {
  const cards = Object.values(game.board).filter((card) => card.status === 'confirmed');
  const ownedCards = cards.filter((card) => card.playerId !== null);
  const seats = game.players.map((_, seat) => seat);
  const validSeat = (seat: number) => Number.isInteger(seat) && seats.includes(seat);
  const cardsById = new Map(cards.map((card) => [card.id, card]));
  const namesById = new Map(cards.map((card) => [card.id, card.cardName]));
  const families = [...new Set(getRelationPresets(game.deckSnapshot).map((relation) => relation.family))];
  const edges: SemanticEdge[] = [];
  const edgesById = new Map<string, SemanticEdge>();
  const signatures = new Map<string, SemanticEdge>();
  let graphAvailable = Array.isArray(game.semanticEdges) && cardsById.size === cards.length &&
    ownedCards.every((card) => validSeat(card.playerId!));

  for (const edge of game.semanticEdges ?? []) {
    const from = cardsById.get(edge.fromCardInstanceId);
    const to = cardsById.get(edge.toCardInstanceId);
    if (!from || !to || from.id === to.id || !edge.id || !edge.createdAtMoveId ||
      !validSeat(edge.createdBySeatIndex) ||
      (from.playerId !== edge.createdBySeatIndex && to.playerId !== edge.createdBySeatIndex) ||
      !edge.relation || !isRelationAllowed(edge.relation, game.deckSnapshot) ||
      !Number.isInteger(edge.createdOrder) || edge.createdOrder < 0 ||
      from.coordinates.x !== edge.fromPosition?.x || from.coordinates.y !== edge.fromPosition?.y ||
      to.coordinates.x !== edge.toPosition?.x || to.coordinates.y !== edge.toPosition?.y ||
      !areOrthogonalNeighbors(from.coordinates, to.coordinates)) {
      graphAvailable = false;
      continue;
    }
    const signature = edgeSignature(edge);
    const previousId = edgesById.get(edge.id);
    if (previousId && edgeSignature(previousId) !== signature) {
      graphAvailable = false;
      continue;
    }
    const logicalSignature = edgeSignature(edge, false);
    const previousEdge = signatures.get(logicalSignature);
    if (previousEdge) {
      if (previousEdge.createdBySeatIndex !== edge.createdBySeatIndex ||
        previousEdge.createdAtMoveId !== edge.createdAtMoveId) graphAvailable = false;
      edgesById.set(edge.id, previousEdge);
      continue;
    }
    signatures.set(logicalSignature, edge);
    edgesById.set(edge.id, edge);
    edges.push(edge);
  }

  const groups = new Map<string, SemanticEdge[]>();
  for (const edge of edges) {
    const group = groups.get(edge.createdAtMoveId) ?? [];
    group.push(edge);
    groups.set(edge.createdAtMoveId, group);
  }
  // Every accepted card creates exactly one move group; absent groups are missing data.
  if (groups.size !== ownedCards.length || ownedCards.some((card) =>
    !edges.some((edge) => edge.createdBySeatIndex === card.playerId &&
      (edge.fromCardInstanceId === card.id || edge.toCardInstanceId === card.id)))) graphAvailable = false;

  const usage = (source: SemanticEdge[]): RelationUsage[] => families.map((family) => ({
    family, label: getRelationFamilyLabel(family), count: source.filter((edge) => edge.relation.family === family).length,
  }));
  const moves: MoveStatistics[] = [];
  const seenCards = new Set(cards.filter((card) => card.playerId === null).map((card) => card.id));
  const seenEdges = new Set<string>();
  const seenGroups = new Set<string>();
  const runningScores = seats.map(() => 0);
  let historyAvailable = graphAvailable;

  for (const [key, detail] of Object.entries(game.logDetails ?? {}).sort(([a], [b]) => Number(a) - Number(b))) {
    const logIndex = Number(key);
    const score = detail?.score;
    const semantic = score?.semanticScore;
    if (!Number.isInteger(logIndex) || logIndex < 0 || !score || !validSeat(score.playerId) ||
      !semantic || !Array.isArray(semantic.edges) || !semantic.edges.length ||
      !Number.isInteger(score.totalGained) || score.totalGained < 1 || semantic.total !== score.totalGained) {
      historyAvailable = false;
      continue;
    }
    const moveEdges: SemanticEdge[] = [];
    let base = 0;
    let pathBonus = 0;
    let nodeBonus = 0;
    let valid = true;
    for (const award of semantic.edges) {
      const edge = edgesById.get(award.pendingEdgeId);
      if (!edge || seenEdges.has(edge.id) || edge.createdBySeatIndex !== score.playerId ||
        award.baseScore !== 1 || ![0, 1].includes(award.pathBonus) || ![0, 1].includes(award.nodeBonus) ||
        award.total !== award.baseScore + award.pathBonus + award.nodeBonus) {
        valid = false;
        continue;
      }
      seenEdges.add(edge.id);
      moveEdges.push(edge);
      base += award.baseScore;
      pathBonus += award.pathBonus;
      nodeBonus += award.nodeBonus;
    }
    const moveId = moveEdges[0]?.createdAtMoveId;
    const group = moveId ? groups.get(moveId) : undefined;
    if (!moveId || !group || seenGroups.has(moveId) || group.length !== moveEdges.length ||
      moveEdges.some((edge) => edge.createdAtMoveId !== moveId) ||
      (score.edgeCount !== undefined && score.edgeCount !== moveEdges.length) ||
      base + pathBonus + nodeBonus !== score.totalGained) valid = false;

    // Recover identity from edge ids and chronological coverage, never from card names.
    const newIds = new Set(moveEdges.flatMap((edge) => [edge.fromCardInstanceId, edge.toCardInstanceId])
      .filter((id) => !seenCards.has(id)));
    const card: PlacedCard | undefined = newIds.size === 1 ? cardsById.get([...newIds][0]) : undefined;
    if (!card || card.playerId !== score.playerId || card.cardName !== score.cardName ||
      moveEdges.some((edge) => edge.fromCardInstanceId !== card.id && edge.toCardInstanceId !== card.id)) valid = false;
    runningScores[score.playerId] += score.totalGained;
    if (score.newTotalScore !== runningScores[score.playerId]) valid = false;
    if (!valid) historyAvailable = false;
    if (card) seenCards.add(card.id);
    if (moveId) seenGroups.add(moveId);
    moves.push({ logIndex, seatIndex: score.playerId, cardName: score.cardName,
      total: score.totalGained, base, pathBonus, nodeBonus,
      relations: valid ? moveEdges.map((edge) => formatSemanticRelation(edge, namesById)) : detail.relations ?? [],
    });
  }
  if (seenEdges.size !== edges.length || seenCards.size !== cards.length || moves.length !== ownedCards.length ||
    seats.some((seat) => !Number.isFinite(game.scores[seat]) || game.scores[seat] !== runningScores[seat]) ||
    game.scores.some((score, seat) => !Number.isFinite(score) || score !== (runningScores[seat] ?? 0))) historyAvailable = false;

  const knownMoves = historyAvailable ? moves : [];
  const sumBonus = (source: MoveStatistics[], bonus: 'pathBonus' | 'nodeBonus') =>
    historyAvailable ? source.reduce((sum, move) => sum + (move[bonus] ?? 0), 0) : null;
  const central = graphAvailable ? cards.map((card): CentralCardStatistics => {
    const incident = edges.filter((edge) => edge.fromCardInstanceId === card.id || edge.toCardInstanceId === card.id);
    return { id: card.id, name: card.cardName, ownerSeatIndex: card.playerId, edgeCount: incident.length,
      relations: incident.map((edge) => formatSemanticRelation(edge, namesById)) };
  }) : [];
  const maxDegree = Math.max(0, ...central.map((card) => card.edgeCount));

  return {
    graphAvailable, historyAvailable, moveCount: ownedCards.length,
    edgeCount: graphAvailable ? edges.length : null,
    relations: graphAvailable ? usage(edges) : [],
    players: seats.map((seatIndex) => {
      const playerEdges = edges.filter((edge) => edge.createdBySeatIndex === seatIndex);
      const relations = graphAvailable ? usage(playerEdges) : [];
      const maximum = Math.max(0, ...relations.map((relation) => relation.count));
      const playerMoves = knownMoves.filter((move) => move.seatIndex === seatIndex);
      return { seatIndex, moveCount: ownedCards.filter((card) => card.playerId === seatIndex).length,
        edgeCount: graphAvailable ? playerEdges.length : null, relations,
        favoriteFamilies: relations.filter((relation) => maximum > 0 && relation.count === maximum).map((relation) => relation.family),
        pathBonus: sumBonus(playerMoves, 'pathBonus'), nodeBonus: sumBonus(playerMoves, 'nodeBonus'),
        bestMoves: bestMoves(playerMoves) };
    }),
    bestMoves: bestMoves(knownMoves),
    centralCards: central.filter((card) => maxDegree > 0 && card.edgeCount === maxDegree),
    pathBonus: sumBonus(knownMoves, 'pathBonus'), nodeBonus: sumBonus(knownMoves, 'nodeBonus'),
  };
}
