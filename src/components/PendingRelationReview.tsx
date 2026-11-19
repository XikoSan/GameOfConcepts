import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { SemanticEdge } from '../types';
import { formatSemanticRelation, getRelationFamilyLabel, isSymmetricRelation } from '../scoring/semanticRelations';
import { Modal } from './Modal';
import './PendingRelationReview.css';

interface Props {
  edge: SemanticEdge;
  namesById: Map<string, string>;
  className?: string;
  style?: CSSProperties;
  onPreviewChange?: (edgeId: string | null) => void;
  children: ReactNode;
}

/** A submitted relation is inspectable by every seat, without exposing editor actions. */
export function PendingRelationReview({ edge, namesById, className, style, onPreviewChange, children }: Props) {
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const previewActive = hovered || focused || Boolean(portalRoot);
  useEffect(() => {
    if (!previewActive || !onPreviewChange) return;
    onPreviewChange(edge.id);
    return () => onPreviewChange(null);
  }, [edge.id, onPreviewChange, previewActive]);
  const symmetric = isSymmetricRelation(edge.relation);
  const from = namesById.get(edge.fromCardInstanceId) ?? 'Карта';
  const to = namesById.get(edge.toCardInstanceId) ?? 'Карта';
  const label = formatSemanticRelation(edge, namesById);
  return <>
    <button type="button" className={`${className ?? ''}${previewActive && onPreviewChange ? ' relation-preview-active' : ''}`} style={style}
      aria-label={`Посмотреть связь: ${label}`} aria-haspopup="dialog" aria-expanded={Boolean(portalRoot)}
      title={`Посмотреть связь: ${label}`}
      onPointerEnter={event => {
        if (event.pointerType !== 'touch') setHovered(true);
      }}
      onPointerLeave={() => setHovered(false)}
      onFocus={event => setFocused(event.currentTarget.matches(':focus-visible'))}
      onBlur={() => setFocused(false)}
      onPointerDown={event => event.stopPropagation()}
      onClick={event => {
        event.stopPropagation();
        setPortalRoot(event.currentTarget.closest<HTMLElement>('.app-container') ?? document.body);
      }}>{children}</button>
    {portalRoot && createPortal(
      <Modal title="Связь на голосовании" onClose={() => setPortalRoot(null)} trapFocus>
        <div className="pending-relation-review">
          <dl><dt>Тип связи</dt><dd>{getRelationFamilyLabel(edge.relation.family)}</dd>
            <dt>{symmetric ? 'Симметричная связь' : 'Направление'}</dt>
            <dd className="pending-relation-direction">{from} {symmetric ? '↔' : '→'} {to}</dd></dl>
          <p>{label}</p>
          {symmetric && <p>У этой связи нет отдельного направления: порядок карт не важен.</p>}
          <p className="pending-relation-note">Связь отправлена на голосование. Изменить её сейчас нельзя.</p>
        </div>
      </Modal>
    , portalRoot)}
  </>;
}
