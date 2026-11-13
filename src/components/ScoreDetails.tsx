import { useId, useState } from 'react';
import { createPortal } from 'react-dom';
import type { SemanticEdgeScore, SemanticMoveScore } from '../types';
import { isSymmetricRelation } from '../scoring/semanticRelations';
import { Modal } from './Modal';
import './ScoreDetails.css';

export function ScoreDetails({ score, relation }: { score: SemanticEdgeScore; relation?: string }) {
  const evidence = score.explanation;
  const path = evidence?.path;
  const node = evidence?.node;
  return <div className="score-details">
    {(evidence?.relation || relation) && <p className="score-details-relation">{evidence?.relation ?? relation}</p>}
    <div className="score-details-formula"><strong>+{score.total}</strong><span>Связь +{score.baseScore} · Путь +{score.pathBonus} · Узел +{score.nodeBonus}</span></div>
    <section><h4>Связь +{score.baseScore}</h4><p>За выбранную смысловую связь.</p></section>
    <section>
      <h4>Путь +{score.pathBonus}</h4>
      {path ? <><p className="score-details-chain">{path.cards.map(card => card.name).join(path.edges[0] && isSymmetricRelation(path.edges[0].relation) ? ' ↔ ' : ' → ')}</p><p>Продолжение проходит через вашу карту «{path.cards.find(card => card.id === path.sharedCardId)?.name}».</p></>
        : <p>{score.pathBonus ? 'Подробности пути для этого хода не сохранились.' : 'Эта связь не продолжает ваш путь того же типа и направления.'}</p>}
    </section>
    <section>
      <h4>Узел +{score.nodeBonus}</h4>
      {node ? <><p>Центр — «{node.center.name}».</p><ul>{node.edges.map(edge => <li key={edge.id}>{edge.label}</li>)}</ul><p>{node.direction === 'symmetric' ? 'Ваши внешние карты связаны с общим центром одним типом.' : node.direction === 'toward-center' ? 'Связи от ваших внешних карт направлены к общему центру.' : 'Связи от общего центра направлены к вашим внешним картам.'}</p></>
        : <p>{score.nodeBonus ? 'Подробности узла для этого хода не сохранились.' : 'Эта связь не продолжает узел с вашими внешними картами.'}</p>}
    </section>
  </div>;
}

export function MoveScoreDetails({ score }: { score: SemanticMoveScore }) {
  return <div className="move-score-details">
    {score.edges.map(edge => <ScoreDetails key={edge.pendingEdgeId} score={edge} />)}
    <p className="move-score-total">Всего за ход <strong>+{score.total}</strong></p>
  </div>;
}

export function ScoreHelpButton({ score, onOpenChange }: { score: SemanticEdgeScore | SemanticMoveScore; onOpenChange?: (open: boolean) => void }) {
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);
  const id = useId();
  const close = () => { setPortalRoot(null); onOpenChange?.(false); };
  return <>
    <button type="button" className="score-help-button" aria-label="Показать расчёт очков" aria-haspopup="dialog" aria-expanded={Boolean(portalRoot)} aria-controls={portalRoot ? id : undefined}
      onClick={event => { event.stopPropagation(); setPortalRoot(event.currentTarget.closest<HTMLElement>('.app-container') ?? document.body); onOpenChange?.(true); }}>?</button>
    {portalRoot && createPortal(<Modal title="Расчёт очков" onClose={close} trapFocus>
      <div id={id} className="score-explanation-dialog">
        {'edges' in score ? <MoveScoreDetails score={score} /> : <ScoreDetails score={score} />}
        <p className="score-details-preview-note">Это предварительный расчёт. Очки начислятся после принятия хода. Связи учитываются в порядке добавления.</p>
        <button type="button" className="score-details-back" onClick={close}>Вернуться к связям</button>
      </div>
    </Modal>, portalRoot)}
  </>;
}
