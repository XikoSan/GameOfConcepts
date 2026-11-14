import type { RelationFamily, SemanticEdgeScore, SemanticScoreCard } from '../types';
import { isSymmetricRelation } from '../scoring/semanticRelations';

export interface ScoreDetailRow {
  id: string;
  kind: 'Связь' | 'Путь' | 'Узел';
  points: number;
  family?: RelationFamily;
  cards?: readonly SemanticScoreCard[];
  arrows?: readonly string[];
  fallback?: string;
}

/** Render only recorded awards; missing historical witnesses must never be guessed. */
export function getScoreDetailRows(scores: readonly SemanticEdgeScore[], relations: readonly (string | undefined)[] = []): ScoreDetailRow[] {
  const rows: ScoreDetailRow[] = [];
  for (const kind of ['Связь', 'Путь', 'Узел'] as const) {
    scores.forEach((score, index) => {
      const evidence = score.explanation;
      const family = evidence?.edge.relation.family;
      const id = `${score.pendingEdgeId}-${kind}`;
      if (kind === 'Связь' && score.baseScore) {
        rows.push({ id, kind, points: score.baseScore, family,
          ...(evidence ? { cards: [evidence.edge.from, evidence.edge.to], arrows: [isSymmetricRelation(evidence.edge.relation) ? '↔' : '→'] }
            : { fallback: relations[index] ?? 'Подробности связи не сохранились' }) });
      }
      if (kind === 'Путь' && score.pathBonus) {
        const path = evidence?.path;
        rows.push({ id, kind, points: score.pathBonus, family,
          ...(path ? { cards: path.cards, arrows: path.edges.map(edge => isSymmetricRelation(edge.relation) ? '↔' : '→') }
            : { fallback: 'Подробности пути не сохранились' }) });
      }
      if (kind === 'Узел' && score.nodeBonus) {
        const node = evidence?.node;
        rows.push({ id, kind, points: score.nodeBonus, family,
          ...(node && node.outerCards.length >= 2
            ? { cards: [node.outerCards[0], node.center, node.outerCards[1]],
                arrows: node.direction === 'toward-center' ? ['→', '←'] : node.direction === 'from-center' ? ['←', '→'] : ['↔', '↔'] }
            : { fallback: 'Подробности узла не сохранились' }) });
      }
    });
  }
  return rows;
}
