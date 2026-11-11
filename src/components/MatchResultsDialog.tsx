import { useId, useMemo, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { getDeckDefinitionById } from '../data/deckDefinitions';
import { getRelationFamilyLabel, formatRelationCount } from '../scoring/semanticRelations';
import {
  buildMatchStatistics,
  type CentralCardStatistics,
  type MoveStatistics,
  type RelationUsage,
} from '../statistics/buildMatchStatistics';
import type { GameState } from '../types';
import { Modal } from './Modal';
import './MatchResultsDialog.css';

interface MatchResultsPlayer {
  seatIndex: number;
  nickname: string;
  color?: string;
}

interface MatchResultsDialogProps {
  game: GameState;
  players: MatchResultsPlayer[];
  open: boolean;
  onClose: () => void;
  onMenu: () => void;
  onNewGame: () => void;
}

const seatColors: Record<string, string> = {
  blue: '#6ea6d4',
  orange: '#d69a55',
  green: '#79c889',
  purple: '#b89bea',
};

function ResultsDetails({ label, children, className = '', color }: {
  label: string;
  children: ReactNode;
  className?: string;
  color?: string;
}) {
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);
  const id = useId();
  return <>
    <button type="button" className={className} style={{ color }} aria-haspopup="dialog"
      aria-expanded={Boolean(portalRoot)} aria-controls={portalRoot ? id : undefined}
      onClick={event => setPortalRoot(event.currentTarget.closest<HTMLElement>('.app-container') ?? document.body)}>
      {label}
    </button>
    {portalRoot && createPortal(
      <Modal title={label} onClose={() => setPortalRoot(null)} trapFocus>
        <div id={id} className="match-results match-results-popup">{children}</div>
      </Modal>, portalRoot)}
  </>;
}

function metric(value: number | null | undefined, bonus = false) {
  return value == null ? '—' : `${bonus ? '+' : ''}${value}`;
}

function RelationList({ relations }: { relations: string[] }) {
  return relations.length ? <ul className="match-results-relations">
    {relations.map((relation, index) => <li key={index}>{relation}</li>)}
  </ul> : <p className="match-results-muted">Сведения о связях не сохранились.</p>;
}

function RelationChart({ relations, available }: { relations: RelationUsage[]; available: boolean }) {
  if (!available) return <p className="match-results-muted">Сведения о принятых связях недоступны.</p>;
  const maximum = Math.max(0, ...relations.map(relation => relation.count));
  if (!maximum) return <p className="match-results-muted">В партии нет принятых связей.</p>;
  return <dl className="match-results-chart">
    {relations.map(relation => <div className="match-results-chart-row" key={relation.family}>
      <dt>{relation.label}</dt>
      <dd>
        <span className="match-results-bar" aria-hidden="true">
          <span style={{ width: `${relation.count / maximum * 100}%` }} />
        </span>
        <span>{relation.count}</span>
      </dd>
    </div>)}
  </dl>;
}

function MoveDetails({ move, player }: { move: MoveStatistics; player: MatchResultsPlayer }) {
  return <div className="match-results-move">
    <div className="match-results-feature">
      <strong>{move.cardName}</strong><strong>{metric(move.total, true)}</strong>
    </div>
    <span className="match-results-player-name" style={{ color: seatColors[player.color ?? ''] ?? player.color }}>
      {player.nickname}
    </span>
    <p className="match-results-breakdown">За связи: {metric(move.base)} · За пути: {metric(move.pathBonus, true)} · За узлы: {metric(move.nodeBonus, true)}</p>
    <ResultsDetails className="match-results-details" label="Связи этого хода">
      <RelationList relations={move.relations} />
    </ResultsDetails>
  </div>;
}

function BestMoves({ moves, available, playerForSeat }: {
  moves: MoveStatistics[];
  available: boolean;
  playerForSeat: (seat: number) => MatchResultsPlayer;
}) {
  if (!available) return <p className="match-results-muted">История ходов неполна. Лучший ход недоступен.</p>;
  if (!moves.length) return <p className="match-results-muted">В партии нет принятых ходов.</p>;
  return <>
    <MoveDetails move={moves[0]} player={playerForSeat(moves[0].seatIndex)} />
    {moves.length > 1 && <ResultsDetails className="match-results-details" label={`Другие ходы с таким результатом (${moves.length - 1})`}>
      {moves.slice(1).map(move => <MoveDetails key={move.logIndex} move={move} player={playerForSeat(move.seatIndex)} />)}
    </ResultsDetails>}
  </>;
}

function CentralCard({ card, playerForSeat }: {
  card: CentralCardStatistics;
  playerForSeat: (seat: number) => MatchResultsPlayer;
}) {
  return <div className="match-results-central">
    <strong className="match-results-concept">{card.name}</strong>
    <span className="match-results-owner">{card.ownerSeatIndex === null
      ? <span className="match-results-neutral">Нейтральная карта</span>
      : playerForSeat(card.ownerSeatIndex).nickname}</span>
    <ResultsDetails className="match-results-details" label={`${formatRelationCount(card.edgeCount)} · посмотреть список`}>
      <RelationList relations={card.relations} />
    </ResultsDetails>
  </div>;
}

export function MatchResultsDialog({ game, players, open, onClose, onMenu, onNewGame }: MatchResultsDialogProps) {
  const [section, setSection] = useState<'overview' | 'players'>('overview');
  const { board, players: gamePlayers, semanticEdges, logDetails, scores, deckSnapshot, scoringVersion } = game;
  const statistics = useMemo(() => open ? buildMatchStatistics({
    board, players: gamePlayers, semanticEdges, logDetails, scores, deckSnapshot, scoringVersion,
  }) : null, [open, board, gamePlayers, semanticEdges, logDetails, scores, deckSnapshot, scoringVersion]);

  if (!open || !statistics) return null;

  const playerForSeat = (seat: number): MatchResultsPlayer => players.find(player => player.seatIndex === seat)
    ?? { seatIndex: seat, nickname: `Игрок ${seat + 1}` };
  const standings = statistics.players.map(player => ({
    ...playerForSeat(player.seatIndex),
    score: scores[player.seatIndex],
  })).sort((a, b) => (b.score ?? -Infinity) - (a.score ?? -Infinity) || a.seatIndex - b.seatIndex);
  const leaders = standings.filter(player => player.score !== undefined && player.score === standings[0]?.score);
  const deckName = deckSnapshot ? getDeckDefinitionById(deckSnapshot.sourceDeckId)?.name ?? 'Сохранённая колода' : 'Колода не указана';
  const hasUnavailableData = !statistics.graphAvailable || !statistics.historyAvailable;

  return <Modal title="Итоги партии" onClose={onClose} trapFocus>
    <div className="match-results">
      <div className="match-results-body">
        <div className="match-results-intro">
          <h3 className="match-results-winner">{leaders.length === 1
            ? `Победитель — ${leaders[0].nickname}`
            : leaders.length > 1 ? `Ничья: ${leaders.map(player => player.nickname).join(', ')}` : 'Итоговый счёт недоступен'}</h3>
          <p className="match-results-meta">{deckName} · Принятых ходов: {statistics.moveCount} · Связей: {metric(statistics.edgeCount)}</p>
          <ol className="match-results-scores" aria-label="Итоговый счёт">
            {standings.map(player => <li key={player.seatIndex} style={{ color: seatColors[player.color ?? ''] ?? player.color }}>
              <span>{player.nickname}</span><strong>{metric(player.score)}</strong>
            </li>)}
          </ol>
        </div>
        <div className="match-results-sections" role="group" aria-label="Раздел статистики">
          <button type="button" aria-pressed={section === 'overview'} onClick={() => setSection('overview')}>Обзор</button>
          <button type="button" aria-pressed={section === 'players'} onClick={() => setSection('players')}>По игрокам</button>
        </div>
        {hasUnavailableData && <p className="match-results-notice">Часть сведений в сохранении отсутствует или неполна. Недоступные показатели отмечены прочерком; итоговый счёт взят из партии.</p>}
        {statistics.moveCount === 0 && <p className="match-results-empty">В партии нет принятых ходов.</p>}
        {section === 'overview' ? <div className="match-results-grid">
          <section className="match-results-panel">
            <h3>Какие связи использовали</h3>
            <RelationChart relations={statistics.relations} available={statistics.graphAvailable} />
          </section>
          <section className="match-results-panel">
            <h3>Самый результативный ход</h3>
            <BestMoves moves={statistics.bestMoves} available={statistics.historyAvailable} playerForSeat={playerForSeat} />
          </section>
          <section className="match-results-panel">
            <h3>Главное понятие партии</h3>
            <p className="match-results-caption">Больше всего принятых связей</p>
            {!statistics.graphAvailable ? <p className="match-results-muted">Сведения о принятых связях недоступны.</p>
              : !statistics.centralCards.length ? <p className="match-results-muted">Нет принятых связей для выбора главного понятия.</p>
                : <>
                  <CentralCard card={statistics.centralCards[0]} playerForSeat={playerForSeat} />
                  {statistics.centralCards.length > 1 && <ResultsDetails className="match-results-details" label={`Другие понятия с таким числом связей (${statistics.centralCards.length - 1})`}>
                    {statistics.centralCards.slice(1).map(card => <CentralCard key={card.id} card={card} playerForSeat={playerForSeat} />)}
                  </ResultsDetails>}
                </>}
          </section>
          <section className="match-results-panel">
            <h3>Бонусы за конструкции</h3>
            <dl className="match-results-bonuses">
              <div><dt>За продолжение путей</dt><dd>{metric(statistics.pathBonus, true)}</dd></div>
              <div><dt>За участие в узлах</dt><dd>{metric(statistics.nodeBonus, true)}</dd></div>
            </dl>
            <p className="match-results-caption">Бонусные очки за всю партию</p>
          </section>
        </div> : <div className="match-results-table-wrap">
          <table className="match-results-table">
            <caption>Сравнение игроков. Нажмите на имя, чтобы раскрыть детали.</caption>
            <thead><tr><th scope="col">Игрок</th><th scope="col">Счёт</th><th scope="col">Ходы</th><th scope="col">Связи</th><th scope="col">Любимый тип</th><th scope="col">Типов</th><th scope="col">За пути</th><th scope="col">За узлы</th></tr></thead>
            <tbody>{statistics.players.map(player => {
              const identity = playerForSeat(player.seatIndex);
              return <tr key={player.seatIndex}>
                  <th scope="row"><ResultsDetails label={identity.nickname} color={seatColors[identity.color ?? ''] ?? identity.color}>
                    <div className="match-results-player-details">
                      <section><h4>Принятые связи</h4><RelationChart relations={player.relations} available={statistics.graphAvailable} /></section>
                      <section><h4>Лучший ход игрока</h4><BestMoves moves={player.bestMoves} available={statistics.historyAvailable} playerForSeat={playerForSeat} /></section>
                    </div>
                  </ResultsDetails></th>
                  <td className="match-results-score">{metric(scores[player.seatIndex])}</td>
                  <td>{player.moveCount}</td><td>{metric(player.edgeCount)}</td>
                  <td>{!statistics.graphAvailable ? '—' : player.favoriteFamilies.length ? player.favoriteFamilies.map(getRelationFamilyLabel).join(', ') : 'Нет связей'}</td>
                  <td>{statistics.graphAvailable ? `${player.relations.filter(relation => relation.count > 0).length} из ${player.relations.length}` : '—'}</td>
                  <td>{metric(player.pathBonus, true)}</td><td>{metric(player.nodeBonus, true)}</td>
                </tr>;
            })}</tbody>
          </table>
        </div>}
      </div>
      <footer className="match-results-footer">
        <button type="button" onClick={onClose}>Закрыть</button>
        <div><button type="button" onClick={onMenu}>В меню</button><button className="match-results-primary" type="button" onClick={onNewGame}>Новая партия</button></div>
      </footer>
    </div>
  </Modal>;
}
