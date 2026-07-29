import { useState } from 'react';
import type { CSSProperties, MouseEvent } from 'react';
import {
  formatRelationCount,
  type CardRelationLabel,
} from '../scoring/semanticRelations';
import type { ConceptSummary } from '../services/conceptDescriptionService';
import './CardInfoPopover.css';

export type CardInfoPopoverMode = 'tooltip' | 'pinned';
export type CardInfoStatus = 'loading' | 'ready' | 'empty' | 'error';

interface CardInfoPopoverProps {
  cardName: string;
  className: string;
  isExpanded: boolean;
  mode: CardInfoPopoverMode;
  onClose: () => void;
  onPointerEnter?: () => void;
  onRelationEnter?: (cardInstanceId: string) => void;
  onRelationLeave?: () => void;
  onToggleExpanded: () => void;
  ownerLabel: string;
  position: {
    left: number;
    top: number;
  };
  semanticRelations?: CardRelationLabel[];
  status: CardInfoStatus;
  summary: ConceptSummary | null;
  wiktionaryUrl: string;
}

const COMPACT_TEXT_LENGTH = 220;

function getCompactText(value: string): string {
  const text = value.replace(/\s+/g, ' ').trim();
  if (text.length <= COMPACT_TEXT_LENGTH) return text;

  const sentenceMatch = text
    .slice(0, COMPACT_TEXT_LENGTH)
    .match(/^(.{80,}?[.!?])(\s|$)/);

  return sentenceMatch
    ? sentenceMatch[1]
    : `${text.slice(0, COMPACT_TEXT_LENGTH).trim()}...`;
}

function getBodyText(status: CardInfoStatus, summary: ConceptSummary | null): string {
  if (status === 'loading') return 'Загрузка описания...';
  if (status === 'error' || status === 'empty' || !summary) return 'Описание не найдено.';
  return summary.extract;
}

export function CardInfoPopover({
  cardName,
  className,
  isExpanded,
  mode,
  onClose,
  onPointerEnter,
  onRelationEnter,
  onRelationLeave,
  onToggleExpanded,
  ownerLabel,
  position,
  semanticRelations = [],
  status,
  summary,
  wiktionaryUrl,
}: CardInfoPopoverProps) {
  const [relationsExpanded, setRelationsExpanded] = useState(false);
  const fullText = getBodyText(status, summary);
  const isLongDescription = status === 'ready' && fullText.length > COMPACT_TEXT_LENGTH;
  const visibleText =
    mode === 'tooltip' || !isExpanded ? getCompactText(fullText) : fullText;
  const style = {
    left: `${position.left}px`,
    top: `${position.top}px`,
  } satisfies CSSProperties;
  const relationCountText = formatRelationCount(semanticRelations.length);

  const handleToggleRelations = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    setRelationsExpanded((current) => !current);
  };

  return (
    <div
      className={`card-info-popover card-info-popover-${mode} ${className} ${
        isExpanded ? 'expanded' : ''
      }`}
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
      onPointerEnter={onPointerEnter}
      role={mode === 'pinned' ? 'dialog' : 'tooltip'}
      style={style}
    >
      <div className="card-info-header">
        <div>
          <strong>{cardName}</strong>
          <div className="card-info-meta">
            <span>{ownerLabel}</span>
            {semanticRelations.length > 0 && (
              <button
                aria-expanded={relationsExpanded}
                className="card-info-relation-count"
                type="button"
                onClick={handleToggleRelations}
                onPointerDown={(event) => event.stopPropagation()}
              >
                {relationCountText} {relationsExpanded ? '▴' : '▾'}
              </button>
            )}
          </div>
        </div>
        {mode === 'pinned' && (
          <button type="button" onClick={onClose}>
            Закрыть
          </button>
        )}
      </div>

      <p>{visibleText}</p>

      {relationsExpanded && semanticRelations.length > 0 && (
        <section className="card-info-relations" aria-label="Смысловые связи карты">
          <strong>Связи</strong>
          <ul>
            {semanticRelations.map((relationLabel) => (
              <li key={relationLabel.edgeId}>
                <button
                  type="button"
                  title={relationLabel.fullText}
                  onPointerEnter={() =>
                    onRelationEnter?.(relationLabel.otherCardInstanceId)
                  }
                  onPointerLeave={() => onRelationLeave?.()}
                  onFocus={() => onRelationEnter?.(relationLabel.otherCardInstanceId)}
                  onBlur={() => onRelationLeave?.()}
                >
                  {relationLabel.fullText}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {mode === 'tooltip' ? (
        <span className="card-info-hint">Наведите на подсказку, чтобы закрепить</span>
      ) : (
        <div className="card-info-actions">
          {isLongDescription && (
            <button type="button" onClick={onToggleExpanded}>
              {isExpanded ? 'Свернуть' : 'Развернуть'}
            </button>
          )}
          <a href={wiktionaryUrl} rel="noreferrer" target="_blank">
            Викисловарь
          </a>
        </div>
      )}
    </div>
  );
}
