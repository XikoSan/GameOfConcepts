import { useState } from 'react';
import { createPortal } from 'react-dom';
import type { ConceptSummary } from '../services/conceptDescriptionService';
import { FeedbackForm } from './FeedbackForm';
import { Modal } from './Modal';
import './ConceptReferences.css';

export function ConceptMeanings({ summary }: { summary: ConceptSummary }) {
  return summary.additionalMeanings.length ? <section className="concept-other-meanings">
    <h4>Другие значения</h4><ul>{summary.additionalMeanings.map(meaning => <li key={meaning}>{meaning}</li>)}</ul>
  </section> : null;
}

export function ConceptReferences({ term, summary }: { term: string; summary: ConceptSummary | null }) {
  const [reportRoot, setReportRoot] = useState<HTMLElement | null>(null);
  return <div className="concept-references">
    {summary && <div className="concept-source-links" aria-label="Подробнее о понятии">
      {summary.sources.map(source => <a key={source.url} href={source.url} target="_blank" rel="noreferrer">{source.label}</a>)}
    </div>}
    <button type="button" className="concept-report-button" onClick={event => {
      event.stopPropagation();
      setReportRoot(event.currentTarget.closest<HTMLElement>('.app-container') ?? document.body);
    }}>Сообщить об ошибке в справке</button>
    {reportRoot && createPortal(<Modal title="Ошибка в справке" onClose={() => setReportRoot(null)} trapFocus>
      <div className="concept-report-dialog"><FeedbackForm initialDescription={`Ошибка в справке: «${term}».\n\nЧто нужно исправить:\n`} /></div>
    </Modal>, reportRoot)}
  </div>;
}
