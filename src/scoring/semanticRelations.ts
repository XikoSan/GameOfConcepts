import type {
  Coordinates,
  GameDeckSnapshot,
  GameState,
  PendingMove,
  PendingSemanticEdge,
  PlacedCard,
  RelationFamily,
  SemanticEdge,
  SemanticRelation,
} from '../types';

export const RELATION_FAMILY_LABELS: Record<RelationFamily, string> = {
  kind: 'Вид',
  part: 'Часть',
  cause: 'Причина',
  property: 'Свойство',
  opposite: 'Противоположность',
};

export const RELATION_PRESETS: SemanticRelation[] = [
  { family: 'kind', fromRole: 'kind', toRole: 'general' },
  { family: 'part', fromRole: 'part', toRole: 'whole' },
  { family: 'cause', fromRole: 'cause', toRole: 'effect' },
  { family: 'property', fromRole: 'property', toRole: 'property-bearer' },
  { family: 'opposite', symmetric: true },
];

export const ALL_RELATION_PRESETS: readonly SemanticRelation[] = RELATION_PRESETS;

export function isSymmetricRelation(
  relation: SemanticRelation
): relation is Extract<SemanticRelation, { symmetric: true }> {
  return relation.family === 'opposite';
}

export function getRelationPresets(snapshot?: GameDeckSnapshot): readonly SemanticRelation[] {
  if (!snapshot?.relationFamilies) return RELATION_PRESETS;
  return snapshot.relationFamilies.flatMap((family) => {
    const preset = ALL_RELATION_PRESETS.find((relation) => relation.family === family);
    return preset ? [preset] : [];
  });
}

export function isRelationAllowed(relation: SemanticRelation, snapshot?: GameDeckSnapshot): boolean {
  const preset = getRelationPresets(snapshot).find((item) => item.family === relation.family);
  if (!preset) return false;
  if (isSymmetricRelation(preset)) return isSymmetricRelation(relation) && relation.symmetric === true;
  return !isSymmetricRelation(relation) &&
    relation.fromRole === preset.fromRole && relation.toRole === preset.toRole;
}

// Unsupported saved relations must not be silently reinterpreted under new rules.
export function hasSupportedGameRelations(state: GameState): boolean {
  const families = state.deckSnapshot?.relationFamilies;
  if (state.deckSnapshot?.sourceDeckId === 'everyday') return false;
  if (families && (!families.length || families.some((family) =>
    !RELATION_PRESETS.some((preset) => preset.family === family)))) return false;
  return [...(state.semanticEdges ?? []), ...(state.pendingMove?.semanticEdges ?? [])]
    .every((edge) => isRelationAllowed(edge.relation, state.deckSnapshot));
}

const ROLE_LABELS: Record<string, string> = {
  kind: 'вид',
  general: 'общее',
  part: 'часть',
  whole: 'целое',
  cause: 'причина',
  effect: 'следствие',
  property: 'свойство',
  'property-bearer': 'карта',
};

export function getRelationFamilyLabel(family: RelationFamily): string {
  return RELATION_FAMILY_LABELS[family];
}

export function getRelationRoleLabel(role: string): string {
  return ROLE_LABELS[role] ?? role;
}

export function getRelationDirectionQuestion(family: RelationFamily): string {
  if (family === 'kind') return 'Что является видом?';
  if (family === 'part') return 'Что является частью?';
  if (family === 'cause') return 'Что является причиной?';
  if (family === 'property') return 'Что является свойством?';
  return '';
}

export function getPathConnectivitySignature(edge: SemanticEdge): string {
  if (isSymmetricRelation(edge.relation)) return `${edge.relation.family}:symmetric`;

  return `${edge.relation.family}:${edge.relation.fromRole}->${edge.relation.toRole}`;
}

export function getNodeConnectivitySignature(
  edge: SemanticEdge,
  centerCardInstanceId: string
): string | null {
  if (
    edge.fromCardInstanceId !== centerCardInstanceId &&
    edge.toCardInstanceId !== centerCardInstanceId
  ) {
    return null;
  }

  if (isSymmetricRelation(edge.relation)) return `${edge.relation.family}:symmetric-node`;

  const centerRole =
    edge.fromCardInstanceId === centerCardInstanceId
      ? edge.relation.fromRole
      : edge.relation.toRole;
  const outerRole =
    edge.fromCardInstanceId === centerCardInstanceId
      ? edge.relation.toRole
      : edge.relation.fromRole;

  return `${edge.relation.family}:center=${centerRole}:outer=${outerRole}`;
}

export function areOrthogonalNeighbors(
  a: Coordinates,
  b: Coordinates
): boolean {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y) === 1;
}

export function getBoardKey(coordinates: Coordinates): string {
  return `${coordinates.x},${coordinates.y}`;
}

export function createSemanticEdgeFromPending(
  pendingMove: PendingMove,
  pendingEdge: PendingSemanticEdge,
  placedCard: PlacedCard
): SemanticEdge {
  const moveId = pendingMove.moveId ?? pendingMove.id ?? pendingMove.cardId;
  const placedBySeatIndex =
    pendingMove.placedBySeatIndex ?? pendingMove.playerIndex ?? pendingMove.playerId ?? 0;

  if (pendingEdge.direction === 'neighbor-to-new') {
    return {
      id: pendingEdge.id,
      fromCardInstanceId: pendingEdge.neighborCardInstanceId,
      toCardInstanceId: placedCard.id,
      fromPosition: pendingEdge.neighborPosition,
      toPosition: placedCard.coordinates,
      relation: pendingEdge.relation,
      createdBySeatIndex: placedBySeatIndex,
      createdAtMoveId: moveId,
      createdOrder: pendingEdge.createdOrder,
    };
  }

  return {
    id: pendingEdge.id,
    fromCardInstanceId: placedCard.id,
    toCardInstanceId: pendingEdge.neighborCardInstanceId,
    fromPosition: placedCard.coordinates,
    toPosition: pendingEdge.neighborPosition,
    relation: pendingEdge.relation,
    createdBySeatIndex: placedBySeatIndex,
    createdAtMoveId: moveId,
    createdOrder: pendingEdge.createdOrder,
  };
}

export function formatSemanticRelation(
  edge: Pick<SemanticEdge, 'relation' | 'fromCardInstanceId' | 'toCardInstanceId'>,
  namesById: Map<string, string>
): string {
  const fromName = namesById.get(edge.fromCardInstanceId) ?? 'Карта';
  const toName = namesById.get(edge.toCardInstanceId) ?? 'Карта';
  if (edge.relation.family === 'kind') return `${fromName} — вид ${toName}`;
  if (edge.relation.family === 'part') return `${fromName} — часть ${toName}`;
  if (edge.relation.family === 'cause') {
    return `${fromName} — причина ${toName}`;
  }
  if (edge.relation.family === 'property') return `${fromName} — свойство ${toName}`;
  return `${fromName} противоположна ${toName}`;
}

export interface CardRelationLabel {
  edgeId: string;
  familyLabel: string;
  direction: 'outgoing' | 'incoming' | 'symmetric';
  otherCardInstanceId: string;
  otherCardName: string;
  compactText: string;
  fullText: string;
}

export function formatRelationForCard(
  edge: Pick<SemanticEdge, 'id' | 'relation' | 'fromCardInstanceId' | 'toCardInstanceId'>,
  cardInstanceId: string,
  namesById: Map<string, string>
): CardRelationLabel | null {
  const fullText = formatSemanticRelation(edge, namesById);
  const familyLabel = getRelationFamilyLabel(edge.relation.family);

  if (isSymmetricRelation(edge.relation)) {
    const otherCardId =
      edge.fromCardInstanceId === cardInstanceId
        ? edge.toCardInstanceId
        : edge.fromCardInstanceId;
    const otherCardName = namesById.get(otherCardId) ?? 'Карта';

    return {
      edgeId: edge.id,
      familyLabel,
      direction: 'symmetric',
      otherCardInstanceId: otherCardId,
      otherCardName,
      compactText: `${familyLabel} ↔ ${otherCardName}`,
      fullText,
    };
  }

  if (edge.fromCardInstanceId === cardInstanceId) {
    const otherCardName = namesById.get(edge.toCardInstanceId) ?? 'Карта';

    return {
      edgeId: edge.id,
      familyLabel,
      direction: 'outgoing',
      otherCardInstanceId: edge.toCardInstanceId,
      otherCardName,
      compactText: `${familyLabel} → ${otherCardName}`,
      fullText,
    };
  }

  if (edge.toCardInstanceId === cardInstanceId) {
    const otherCardName = namesById.get(edge.fromCardInstanceId) ?? 'Карта';

    return {
      edgeId: edge.id,
      familyLabel,
      direction: 'incoming',
      otherCardInstanceId: edge.fromCardInstanceId,
      otherCardName,
      compactText: `${familyLabel} ← ${otherCardName}`,
      fullText,
    };
  }

  return null;
}

export function formatRelationCount(count: number): string {
  const lastTwoDigits = count % 100;
  const lastDigit = count % 10;

  if (lastTwoDigits >= 11 && lastTwoDigits <= 14) return `${count} связей`;
  if (lastDigit === 1) return `${count} связь`;
  if (lastDigit >= 2 && lastDigit <= 4) return `${count} связи`;
  return `${count} связей`;
}
