import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  rulesExamples,
  getRulesSectionsForDeck,
  rulesTabs,
} from '../rulesText';
import type { GameDeckSnapshot } from '../types';
import type { RulesBlock, RulesExampleId } from '../rulesText';

const getExampleById = (id: RulesExampleId) =>
  rulesExamples.find((example) => example.id === id);

function RulesExampleBlock({ id }: { id: RulesExampleId }) {
  const example = getExampleById(id);

  if (!example) return null;

  return (
    <figure className={`rules-example rules-example--${id}`}>
      {id === 'accepted-connection' && example.imageSrc ? (
        <div className="rules-connection-scores">
          <img alt={example.alt} src={example.imageSrc} />
          <span className="rules-connection-score rules-connection-score--top" aria-label="Связь Государство — Общество: 1 очко">+1</span>
          <span className="rules-connection-score rules-connection-score--bottom" aria-label="Связь Сотрудничество — Общество: 1 очко">+1</span>
        </div>
      ) : id === 'chain' && example.imageSrc ? (
        <div className="rules-path-example">
          <div className="rules-connection-scores">
            <img alt={example.alt} src={example.imageSrc} />
            <span className="rules-connection-score rules-connection-score--top" aria-label="Сотрудничество — причина общества: 1 очко">↑ +1</span>
            <span className="rules-connection-score rules-connection-score--bottom" aria-label="Безопасность — причина сотрудничества: 2 очка, включая бонус пути">↑ +2</span>
          </div>
          <div className="rules-path-annotations">
            <p>Сотрудничество — причина общества</p>
            <p><strong>Новая связь</strong><br />Безопасность — причина сотрудничества</p>
          </div>
        </div>
      ) : id === 'cross' && example.imageSrc ? (
        <div className="rules-node-example">
          <div className="rules-node-crop">
            <img alt={example.alt} src={example.imageSrc} />
            <span className="rules-node-mark rules-node-mark--left" aria-label="Безопасность — причина власти: 2 очка">+2</span>
            <span className="rules-node-mark rules-node-mark--right" aria-label="Безопасность — причина языка: 2 очка">+2</span>
            <span className="rules-node-mark rules-node-mark--bottom" aria-label="Безопасность — причина закона: 2 очка">+2</span>
          </div>
          <div className="rules-node-annotations">
            <p>Безопасность — причина.<br />Окружающие понятия — следствия.<br />Карта в центре может быть вашей, чужой или нейтральной.</p>
          </div>
        </div>
      ) : example.imageSrc ? (
        <img alt={example.alt} src={example.imageSrc} />
      ) : (
        <div className="rules-example-placeholder">Скриншот будет добавлен позже</div>
      )}
      <figcaption>{example.caption}</figcaption>
    </figure>
  );
}

function RulesTable({ block }: { block: Extract<RulesBlock, { type: 'table' }> }) {
  return (
    <div className="rules-table-wrap">
      <table className="rules-table">
        <thead>
          <tr>
            {block.headers.map((header) => (
              <th key={header}>{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {block.rows.map((row) => (
            <tr key={row.join('-')}>
              {row.map((cell) => (
                <td key={cell}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RulesBlockView({ block }: { block: RulesBlock }) {
  if (block.type === 'paragraph') return <p>{block.text}</p>;

  if (block.type === 'details') {
    return (
      <section className="rules-subsection">
        <h4>{block.title}</h4>
        <div className="rules-subsection-body">
          {block.blocks.map((nestedBlock, index) => (
            <RulesBlockView
              block={nestedBlock}
              key={`${block.title}-${nestedBlock.type}-${index}`}
            />
          ))}
        </div>
      </section>
    );
  }

  if (block.type === 'steps') {
    return (
      <ol>
        {block.items.map((item) => <li key={item}>{item}</li>)}
      </ol>
    );
  }

  if (block.type === 'emphasis') {
    return <p className="rules-emphasis">{block.text}</p>;
  }

  if (block.type === 'card') {
    return <p className="rule-card">{block.text}</p>;
  }

  if (block.type === 'list') {
    return (
      <ul>
        {block.items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    );
  }

  if (block.type === 'table') return <RulesTable block={block} />;

  return <RulesExampleBlock id={block.id} />;
}

export function RulesContent({ deckSnapshot }: { deckSnapshot?: GameDeckSnapshot }) {
  const [activeTabIndex, setActiveTabIndex] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const container = root.current;
    if (!container) return;
    container.querySelectorAll<HTMLElement>('.rules-main, .rules-body, .rules-section-inner').forEach(element => { element.scrollTop = 0; });
    container.scrollTop = 0;
    const modal = container.closest('.modal-content');
    if (modal) modal.scrollTop = 0;
  }, [activeTabIndex]);
  const activeTab = rulesTabs[activeTabIndex];
  const activeSectionTitles = activeTab.sectionTitles;
  const activeSections = useMemo(
    () =>
      getRulesSectionsForDeck(deckSnapshot?.neutralCards?.map((card) => card.name)).filter((section) =>
        activeSectionTitles.includes(section.title)
      ),
    [activeSectionTitles, deckSnapshot]
  );
  return (
    <div ref={root} className="rules-content">
      <aside className="rules-sidebar" aria-label="Навигация по правилам">
        <p className="rules-sidebar-label">Разделы</p>
        <div className="rules-tabs" role="tablist" aria-label="Разделы правил">
          {rulesTabs.map((tab, index) => (
            <button
              aria-selected={index === activeTabIndex}
              className={index === activeTabIndex ? 'active' : ''}
              key={tab.title}
              onClick={() => setActiveTabIndex(index)}
              role="tab"
              type="button"
            >
              <span className="rules-tab-title">{tab.title}</span>
            </button>
          ))}
        </div>
      </aside>

      <main className="rules-main" role="tabpanel" aria-label={activeTab.title}>
        <div className="rules-body">
          <div className="rules-section-inner rules-active-panel">
            {activeSections.map((section) => (
              <section className="rules-section" key={section.title}>
                {activeSections.length > 1 && (
                  <h2 className="rules-section-title">{section.title}</h2>
                )}
                {section.blocks.map((block, index) => (
                  <RulesBlockView
                    block={block}
                    key={`${section.title}-${block.type}-${index}`}
                  />
                ))}
              </section>
            ))}
          </div>
        </div>
      </main>

    </div>
  );
}
