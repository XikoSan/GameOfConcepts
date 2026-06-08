import { useMemo, useState } from 'react';
import {
  rulesExamples,
  rulesScoreSubsections,
  rulesSections,
  rulesTabs,
} from '../rulesText';
import type { RulesBlock, RulesExampleId } from '../rulesText';

const getExampleById = (id: RulesExampleId) =>
  rulesExamples.find((example) => example.id === id);

function RulesExampleBlock({ id }: { id: RulesExampleId }) {
  const example = getExampleById(id);

  if (!example) return null;

  return (
    <figure className="rules-example">
      {example.imageSrc ? (
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

export function RulesContent() {
  const [activeTabIndex, setActiveTabIndex] = useState(0);
  const [activeScoreSubsectionIndex, setActiveScoreSubsectionIndex] = useState(0);
  const activeTab = rulesTabs[activeTabIndex];
  const activeScoreSubsection = rulesScoreSubsections[activeScoreSubsectionIndex];
  const isScoringTab = activeTab.title === 'Подсчёт очков';
  const activeSectionTitles =
    isScoringTab
      ? activeScoreSubsection.sectionTitles
      : activeTab.sectionTitles;
  const activeSections = useMemo(
    () =>
      rulesSections.filter((section) =>
        activeSectionTitles.includes(section.title)
      ),
    [activeSectionTitles]
  );
  return (
    <div className="rules-content">
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
            {tab.title}
          </button>
        ))}
      </div>

      <div className={`rules-body ${isScoringTab ? 'rules-body--scoring' : ''}`}>
        <div
          className={`rules-section-inner rules-active-panel ${
            isScoringTab ? 'rules-active-panel--scoring' : ''
          }`}
          role="tabpanel"
        >
          {!isScoringTab && <h1>{activeTab.title}</h1>}
          {isScoringTab && (
            <div
              className="rules-subtabs"
              role="tablist"
              aria-label="Подразделы подсчёта очков"
            >
              {rulesScoreSubsections.map((subsection, index) => (
                <button
                  aria-selected={index === activeScoreSubsectionIndex}
                  className={index === activeScoreSubsectionIndex ? 'active' : ''}
                  key={subsection.title}
                  onClick={() => setActiveScoreSubsectionIndex(index)}
                  role="tab"
                  type="button"
                >
                  {subsection.title}
                </button>
              ))}
            </div>
          )}
          {activeSections.map((section) => (
            <section className="rules-section" key={section.title}>
              <h2>{section.title}</h2>
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

    </div>
  );
}
