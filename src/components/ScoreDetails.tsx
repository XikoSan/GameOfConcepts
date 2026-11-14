import { useId, useState } from 'react';
import { createPortal } from 'react-dom';
import type { RelationFamily, SemanticEdgeScore, SemanticMoveScore } from '../types';
import { getRelationFamilyLabel } from '../scoring/semanticRelations';
import { getScoreDetailRows } from './scoreDetailRows';
import { Modal } from './Modal';
import './ScoreDetails.css';

const familyBadges: Partial<Record<RelationFamily, string>> = {
  kind: 'Вид', part: 'Часть', cause: 'Прич.', property: 'Свойст.', opposite: 'Против.',
};

export function ScoreDetails({ score, relation }: { score: SemanticEdgeScore; relation?: string }) {
  return <MoveScoreDetails score={{ edges: [score], total: score.total }} relations={[relation]} />;
}

export function MoveScoreDetails({ score, relations }: {
  score: SemanticMoveScore;
  relations?: readonly (string | undefined)[];
}) {
  const rows = getScoreDetailRows(score.edges, relations);
  return <div className="score-details move-score-details">
    <ul className="score-detail-rows" aria-label="Начисления очков">
      {rows.map((row, index) => <li key={row.id} className={`score-detail-row${index > 0 && rows[index - 1].kind !== row.kind ? ' score-detail-group-start' : ''}`}>
        <strong className="score-detail-points">+{row.points}</strong>
        <span className="score-detail-kind">{row.kind}</span>
        <span className="score-detail-content">
          {row.family && <abbr className={`score-detail-family score-detail-family-${row.family}`}
            title={getRelationFamilyLabel(row.family)} aria-label={`Тип связи: ${getRelationFamilyLabel(row.family)}`}>
            {familyBadges[row.family] ?? getRelationFamilyLabel(row.family)}
          </abbr>}
          {row.cards ? <span className="score-detail-chain">{row.cards.map((card, cardIndex) => <span className="score-detail-chain-part" key={`${card.id}-${cardIndex}`}>
            {cardIndex > 0 && <span className="score-detail-arrow">{row.arrows?.[cardIndex - 1]} </span>}{card.name}
          </span>)}</span> : <span className="score-detail-missing">{row.fallback}</span>}
        </span>
      </li>)}
    </ul>
  </div>;
}

export function ScoreHelpButton({ score, onOpenChange }: { score: SemanticEdgeScore | SemanticMoveScore; onOpenChange?: (open: boolean) => void }) {
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);
  const id = useId();
  const close = () => { setPortalRoot(null); onOpenChange?.(false); };
  return <>
    <button type="button" className="score-help-button" aria-label="Показать расчёт очков" aria-haspopup="dialog" aria-expanded={Boolean(portalRoot)} aria-controls={portalRoot ? id : undefined}
      onClick={event => { event.stopPropagation(); setPortalRoot(event.currentTarget.closest<HTMLElement>('.app-container') ?? document.body); onOpenChange?.(true); }}>?</button>
    {portalRoot && createPortal(<Modal title={`Расчёт очков · +${score.total}`} onClose={close} trapFocus>
      <div id={id} className="score-explanation-dialog">
        {'edges' in score ? <MoveScoreDetails score={score} /> : <ScoreDetails score={score} />}
        <button type="button" className="score-details-back" onClick={close}>Вернуться к связям</button>
      </div>
    </Modal>, portalRoot)}
  </>;
}
