import { useEffect, useState } from 'react';
import {
  getConceptSummary,
  getWikipediaSearchUrl,
} from '../services/conceptDescriptionService';
import type { ConceptSummary } from '../services/conceptDescriptionService';
import { getWiktionarySearchUrl } from '../services/dictionaryService';
import { Modal } from './Modal';
import './DictionaryModal.css';

interface DictionaryModalProps {
  initialTerm: string;
  onClose: () => void;
}

const MAX_EXTRACT_LENGTH = 2200;

const getVisibleExtract = (extract: string) =>
  extract.length > MAX_EXTRACT_LENGTH
    ? `${extract.slice(0, MAX_EXTRACT_LENGTH).trim()}...`
    : extract;

export function DictionaryModal({ initialTerm, onClose }: DictionaryModalProps) {
  const [query, setQuery] = useState(initialTerm);
  const [conceptSummary, setConceptSummary] = useState<ConceptSummary | null>(null);
  const [isLoading, setIsLoading] = useState(Boolean(initialTerm.trim()));
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(Boolean(initialTerm.trim()));

  const runSearch = async (term: string) => {
    const normalizedTerm = term.trim();
    if (!normalizedTerm) {
      setConceptSummary(null);
      setError('Введите слово или понятие для поиска.');
      setHasSearched(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    setHasSearched(true);

    try {
      const nextSummary = await getConceptSummary(normalizedTerm);
      setConceptSummary(nextSummary);
    } catch (searchError) {
      setConceptSummary(null);
      setError(
        searchError instanceof Error
          ? searchError.message
          : 'Не удалось получить справку по понятию.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let isCancelled = false;
    const normalizedTerm = initialTerm.trim();

    if (!normalizedTerm) return undefined;

    getConceptSummary(normalizedTerm)
      .then((nextSummary) => {
        if (!isCancelled) {
          setConceptSummary(nextSummary);
        }
      })
      .catch((searchError: unknown) => {
        if (!isCancelled) {
          setConceptSummary(null);
          setError(
            searchError instanceof Error
              ? searchError.message
              : 'Не удалось получить справку по понятию.'
          );
        }
      })
      .finally(() => {
        if (!isCancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [initialTerm]);

  const visibleConceptExtract = conceptSummary
    ? getVisibleExtract(conceptSummary.extract)
    : '';
  const isConceptExtractTrimmed = Boolean(
    conceptSummary && conceptSummary.extract.length > MAX_EXTRACT_LENGTH
  );
  const currentTerm = query.trim() || initialTerm.trim();
  const wikipediaSearchUrl = getWikipediaSearchUrl(currentTerm);
  const wiktionarySearchUrl = getWiktionarySearchUrl(currentTerm);

  return (
    <Modal onClose={onClose} title="Справка по понятию">
      <div className="dictionary-modal">
        <form
          className="dictionary-search"
          onSubmit={(event) => {
            event.preventDefault();
            void runSearch(query);
          }}
        >
          <input
            aria-label="Слово для поиска"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Введите слово"
            type="search"
            value={query}
          />
          <button disabled={isLoading} type="submit">
            Найти
          </button>
        </form>

        {isLoading && <p className="dictionary-state">Ищу справку по понятию...</p>}
        {error && <p className="dictionary-error">{error}</p>}

        {!isLoading && !error && hasSearched && (
          <div className="dictionary-result-grid">
            <article className="dictionary-entry dictionary-source-card">
              <span className="dictionary-source-label">Описание понятия</span>
              {conceptSummary ? (
                <>
                  <h3>{conceptSummary.title}</h3>
                  <div className="dictionary-extract">
                    <p>{visibleConceptExtract}</p>
                  </div>
                  <a href={conceptSummary.url} rel="noreferrer" target="_blank">
                    {isConceptExtractTrimmed
                      ? 'Открыть полную статью в Wikipedia'
                      : 'Открыть в Wikipedia'}
                  </a>
                </>
              ) : (
                <>
                  <p className="dictionary-state compact">Описание понятия не найдено.</p>
                  <a href={wikipediaSearchUrl} rel="noreferrer" target="_blank">
                    Найти в Wikipedia
                  </a>
                </>
              )}
            </article>

            <article className="dictionary-entry dictionary-source-card">
              <span className="dictionary-source-label">Викисловарь</span>
              <p className="dictionary-note">
                Словарная статья может содержать значения, формы слова и этимологию.
              </p>
              <a href={wiktionarySearchUrl} rel="noreferrer" target="_blank">
                Открыть в Викисловаре
              </a>
            </article>
          </div>
        )}
      </div>
    </Modal>
  );
}
