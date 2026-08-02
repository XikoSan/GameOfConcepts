import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { incrementCounter } from '../debug/performanceDiagnostics';
import type {
  PendingSemanticEdge,
  PlacedCard,
  SemanticRelation,
} from '../game';
import type { RelationFamily, SemanticEdgeScore } from '../types';
import {
  RELATION_PRESETS,
  formatSemanticRelation,
  getRelationDirectionQuestion,
  getRelationFamilyLabel,
} from '../scoring/semanticRelations';
import './SemanticRelationPopover.css';

interface SemanticRelationPopoverProps {
  pendingCard: PlacedCard;
  neighborCard: PlacedCard;
  selectedEdge?: PendingSemanticEdge;
  selectedScore?: SemanticEdgeScore;
  position: {
    left: number;
    top: number;
  };
  onClose: () => void;
  onDelete: () => void;
  onMeasuredRect?: (rect: DOMRect) => void;
  onSave: (
    relation: SemanticRelation,
    direction: PendingSemanticEdge['direction']
  ) => void;
}

const getRelationByFamily = (family: RelationFamily) =>
  RELATION_PRESETS.find((relation) => relation.family === family) ?? RELATION_PRESETS[0];

export function SemanticRelationPopover({
  pendingCard,
  neighborCard,
  selectedEdge,
  selectedScore,
  position,
  onClose,
  onDelete,
  onMeasuredRect,
  onSave,
}: SemanticRelationPopoverProps) {
  incrementCounter('render:SemanticRelationPopover');
  const popoverRef = useRef<HTMLDivElement>(null);
  const onMeasuredRectRef = useRef(onMeasuredRect);
  const [selectedFamily, setSelectedFamily] = useState<RelationFamily | null>(
    selectedEdge?.relation.family ?? null
  );
  const [sourceCardId, setSourceCardId] = useState<string | null>(() => {
    if (!selectedEdge) return null;
    if (selectedEdge.relation.family === 'opposite') return pendingCard.id;
    return selectedEdge.direction === 'new-to-neighbor'
      ? pendingCard.id
      : neighborCard.id;
  });
  const selectedRelation = selectedFamily ? getRelationByFamily(selectedFamily) : null;
  const isOpposite = selectedRelation?.family === 'opposite';
  const direction =
    sourceCardId === neighborCard.id ? 'neighbor-to-new' : 'new-to-neighbor';
  const isReady = Boolean(selectedRelation && (isOpposite || sourceCardId));
  const namesById = useMemo(
    () =>
      new Map([
        [pendingCard.id, pendingCard.cardName],
        [neighborCard.id, neighborCard.cardName],
      ]),
    [neighborCard.cardName, neighborCard.id, pendingCard.cardName, pendingCard.id]
  );
  const previewText =
    selectedRelation && isReady
      ? formatSemanticRelation(
          {
            relation: selectedRelation,
            fromCardInstanceId: direction === 'new-to-neighbor' ? pendingCard.id : neighborCard.id,
            toCardInstanceId: direction === 'new-to-neighbor' ? neighborCard.id : pendingCard.id,
          },
          namesById
        )
      : 'Выберите тип связи';
  const style = {
    left: `${position.left}px`,
    top: `${position.top}px`,
  } satisfies CSSProperties;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    onMeasuredRectRef.current = onMeasuredRect;
  }, [onMeasuredRect]);

  useEffect(() => {
    const popoverElement = popoverRef.current;
    if (!popoverElement) return;

    let animationFrameId = 0;
    const measure = () => {
      window.cancelAnimationFrame(animationFrameId);
      incrementCounter('raf:relation-editor-measure');
      animationFrameId = window.requestAnimationFrame(() => {
        incrementCounter('dom:getBoundingClientRect:relation-editor');
        onMeasuredRectRef.current?.(popoverElement.getBoundingClientRect());
      });
    };
    const resizeObserver = new ResizeObserver(measure);

    measure();
    incrementCounter('resize-observer:relation-editor-created');
    resizeObserver.observe(popoverElement);

    return () => {
      window.cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
    };
  }, []);

  const handleFamilySelect = (family: RelationFamily) => {
    setSelectedFamily(family);
    setSourceCardId(family === 'opposite' ? pendingCard.id : null);
  };

  const handleSave = () => {
    if (!selectedRelation || !isReady) return;
    onSave(selectedRelation, selectedRelation.family === 'opposite' ? 'new-to-neighbor' : direction);
  };

  return (
    <div
      ref={popoverRef}
      className="semantic-relation-popover"
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
      role="dialog"
      style={style}
    >
      <header>
        <strong>{pendingCard.cardName} — {neighborCard.cardName}</strong>
        <button type="button" onClick={onClose}>Закрыть</button>
      </header>

      <section>
        <span>Тип связи</span>
        <div
          className="semantic-popover-chips"
          role="group"
          aria-label={`Тип связи между ${pendingCard.cardName} и ${neighborCard.cardName}`}
        >
          {RELATION_PRESETS.map((relation) => (
            <button
              aria-pressed={selectedFamily === relation.family}
              className={selectedFamily === relation.family ? 'active' : ''}
              key={relation.family}
              type="button"
              onClick={() => handleFamilySelect(relation.family)}
            >
              {getRelationFamilyLabel(relation.family)}
            </button>
          ))}
        </div>
      </section>

      {selectedRelation && !isOpposite && (
        <section>
          <span>{getRelationDirectionQuestion(selectedRelation.family)}</span>
          <div
            className="semantic-popover-source"
            role="group"
            aria-label={getRelationDirectionQuestion(selectedRelation.family)}
          >
            {[pendingCard, neighborCard].map((card) => (
              <button
                aria-pressed={sourceCardId === card.id}
                className={sourceCardId === card.id ? 'active' : ''}
                key={card.id}
                type="button"
                onClick={() => setSourceCardId(card.id)}
              >
                {card.cardName}
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="semantic-popover-preview">
        <span>{previewText}</span>
        {selectedScore && (
          <small>
            +1 связь
            {selectedScore.continuesPath ? ', +1 путь' : ''}
            {selectedScore.continuesNode ? ', +1 узел' : ''}
            . Итого +{selectedScore.total}
          </small>
        )}
      </section>

      <footer>
        <button
          className="semantic-popover-primary"
          disabled={!isReady}
          type="button"
          onClick={handleSave}
        >
          {selectedEdge ? 'Сохранить' : 'Добавить связь'}
        </button>
        {selectedEdge ? (
          <button type="button" onClick={onDelete}>Удалить связь</button>
        ) : (
          <button type="button" onClick={onClose}>Отмена</button>
        )}
      </footer>
    </div>
  );
}
