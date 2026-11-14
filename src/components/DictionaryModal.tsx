import { useEffect, useState } from 'react';
import {
  getConceptSummary,
  getWikipediaSearchUrl,
} from '../services/conceptDescriptionService';
import type { ConceptSummary } from '../services/conceptDescriptionService';
import { getWiktionarySearchUrl } from '../services/dictionaryService';
import { Modal } from './Modal';
import { ConceptMeanings, ConceptReferences } from './ConceptReferences';
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
  const [searchedTerm, setSearchedTerm] = useState(initialTerm.trim());
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
    setSearchedTerm(normalizedTerm);
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
  const currentTerm = conceptSummary?.title ?? searchedTerm;
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
              <span className="dictionary-source-label">Словарь игры · доступен без интернета</span>
              {conceptSummary ? (
                <>
                  <h3>{conceptSummary.title}</h3>
                  <div className="dictionary-extract">
                    <p>{visibleConceptExtract}</p>
                    <ConceptMeanings summary={conceptSummary} />
                  </div>
                  {isConceptExtractTrimmed && <p>Показано сокращённое описание.</p>}
                  <ConceptReferences term={conceptSummary.title} summary={conceptSummary} />
                </>
              ) : (
                <>
                  <p className="dictionary-state compact">Этого понятия пока нет в словаре игры. Можно самостоятельно поискать его во внешних источниках.</p>
                  <ConceptReferences term={currentTerm} summary={null} />
                  <a href={wikipediaSearchUrl} rel="noreferrer" target="_blank">
                    Найти в Википедии
                  </a>
                </>
              )}
            </article>

            <article className="dictionary-entry dictionary-source-card">
              <span className="dictionary-source-label">{conceptSummary ? 'О значениях' : 'Викисловарь'}</span>
              <p className="dictionary-note">
                {conceptSummary ? 'Справка помогает разобраться в понятии. Она не ограничивает обсуждение одним толкованием: выбранную связь оценивают участники партии.' : 'Словарная статья может содержать значения, формы слова и этимологию.'}
              </p>
              {!conceptSummary && <a href={wiktionarySearchUrl} rel="noreferrer" target="_blank">Найти в Викисловаре</a>}
              {conceptSummary && <p className="dictionary-note">Ссылки на источники находятся рядом с определением. Они откроются во внешнем браузере и требуют интернета.</p>}
            </article>
          </div>
        )}
      </div>
    </Modal>
  );
}
