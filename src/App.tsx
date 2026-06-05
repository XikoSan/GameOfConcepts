import { useEffect, useState } from 'react';
import type { DragEvent } from 'react';
import { GameBoard } from './components/GameBoard';
import { Modal } from './components/Modal';
import { PlayerHand } from './components/PlayerHand';
import { RulesContent } from './components/RulesContent';
import { useGameState } from './hooks/useGameState';
import type { Coordinates, RegularCardName } from './game';
import './App.css';

const getPlayerLabel = (playerId: 0 | 1) => (playerId === 0 ? 'Игрок 1' : 'Игрок 2');

interface DragPreview {
  cardName: RegularCardName;
  playerColor: 'blue' | 'orange';
  x: number;
  y: number;
}

type ActiveModal = 'new-game' | 'rules' | 'settings' | null;

const defaultInterfaceSettings = {
  showPlayableHighlights: true,
  showCardTooltips: true,
};

function App() {
  const [selectedCard, setSelectedCard] = useState<RegularCardName | null>(null);
  const [dragPreview, setDragPreview] = useState<DragPreview | null>(null);
  const [activeModal, setActiveModal] = useState<ActiveModal>(null);
  const [resetCameraSignal, setResetCameraSignal] = useState(0);
  const [interfaceSettings, setInterfaceSettings] = useState(
    defaultInterfaceSettings
  );
  const {
    gameState,
    placeCard,
    confirmPendingCard,
    returnPendingCard,
    approvePendingCross,
    rejectPendingCross,
    resetGame,
  } = useGameState();
  const hasPendingDecision = Boolean(gameState.pendingMove || gameState.pendingCross);
  const activeSelectedCard = hasPendingDecision ? null : selectedCard;

  const handlePlaceCard = (cardName: RegularCardName, coordinates: Coordinates) => {
    if (!selectedCard || hasPendingDecision) return;

    placeCard(cardName, coordinates);
  };

  const handleStartCardDrag = (
    cardName: RegularCardName,
    playerColor: DragPreview['playerColor'],
    event: DragEvent<HTMLDivElement>
  ) => {
    if (hasPendingDecision) return;

    setSelectedCard(cardName);
    setDragPreview({
      cardName,
      playerColor,
      x: event.clientX,
      y: event.clientY,
    });
  };

  const handleMoveCardDrag = (event: DragEvent<HTMLDivElement>) => {
    if (event.clientX === 0 && event.clientY === 0) return;

    setDragPreview((preview) =>
      preview ? { ...preview, x: event.clientX, y: event.clientY } : preview
    );
  };

  const handleCancelCardDrag = () => {
    setSelectedCard(null);
    setDragPreview(null);
  };

  const handleResetCamera = () => {
    setResetCameraSignal((signal) => signal + 1);
  };

  const handleConfirmNewGame = () => {
    resetGame();
    setSelectedCard(null);
    setDragPreview(null);
    setResetCameraSignal((signal) => signal + 1);
    setActiveModal(null);
  };

  const handleResetSettings = () => {
    setInterfaceSettings(defaultInterfaceSettings);
  };

  useEffect(() => {
    const clearDragState = () => {
      setSelectedCard(null);
      setDragPreview(null);
    };

    window.addEventListener('dragend', clearDragState);
    window.addEventListener('drop', clearDragState);
    window.addEventListener('mouseup', clearDragState);

    return () => {
      window.removeEventListener('dragend', clearDragState);
      window.removeEventListener('drop', clearDragState);
      window.removeEventListener('mouseup', clearDragState);
    };
  }, []);

  return (
    <div className="app-container">
      <main className="game-table">
        <section className="play-area" aria-label="Игровой стол">
          <PlayerHand
            playerNumber={1}
            cards={gameState.players[1].cards}
            deckCount={gameState.deck[1].length}
            selectedCard={gameState.currentPlayerIndex === 1 ? activeSelectedCard : null}
            isActive={gameState.currentPlayerIndex === 1 && !hasPendingDecision}
            onMoveCardDrag={handleMoveCardDrag}
            onStartCardDrag={handleStartCardDrag}
            onCancelCardDrag={handleCancelCardDrag}
          />

          <div className="table-middle">
            <aside className="side-panel party-panel" aria-label="Панель партии">
              <section className="panel-section lobby-section">
                <div className="panel-title-row">
                  <span className="panel-icon" aria-hidden="true">◇</span>
                  <h1>Лобби прототипа</h1>
                  <span className="lobby-tag">#001</span>
                </div>
              </section>

              <section className="panel-section players-score-section">
                <h2>Игроки</h2>
                <div className="score-row player-score-blue">
                  <span>Игрок 1</span>
                  <strong>{gameState.scores[0]}</strong>
                </div>
                <div className="score-row player-score-orange">
                  <span>Игрок 2</span>
                  <strong>{gameState.scores[1]}</strong>
                </div>
              </section>

              <section className="panel-section log-section">
                <h2>Лог партии</h2>
                <div className="log-placeholder">
                  {gameState.log.length > 0 ? (
                    <ol className="match-log">
                      {gameState.log.map((event, index) => (
                        <li key={`${event}-${index}`}>{event}</li>
                      ))}
                    </ol>
                  ) : (
                    <>
                      <span className="log-icon" aria-hidden="true">✧</span>
                      <p>События партии появятся здесь.</p>
                      <small>Заглушка под будущий журнал ходов.</small>
                    </>
                  )}
                </div>
              </section>
            </aside>

            <div className="board-section">
              <GameBoard
                key={`${gameState.startCard.id}-${resetCameraSignal}`}
                gameState={gameState}
                selectedCard={activeSelectedCard}
                onPlaceCard={handlePlaceCard}
                onFinishDrag={handleCancelCardDrag}
                showPlayableHighlights={interfaceSettings.showPlayableHighlights}
                showTooltips={interfaceSettings.showCardTooltips}
              />
            </div>

            <aside className="side-panel control-panel" aria-label="Панель управления">
              <section className="panel-section control-title-section">
                <div className="panel-title-row">
                  <span className="panel-icon" aria-hidden="true">◇</span>
                  <h1>Управление</h1>
                </div>
              </section>

              {gameState.pendingMove && (
                <section className="panel-section confirmation-section">
                  <h2>Подтверждение</h2>
                  <p>
                    {getPlayerLabel(gameState.pendingMove.playerId)} сыграл карту{' '}
                    <strong>{gameState.pendingMove.cardName}</strong>. Подтвердить связь?
                  </p>
                  <small>
                    Решение принимает {getPlayerLabel(gameState.pendingMove.reviewerId)}.
                  </small>
                  <div className="confirmation-actions">
                    <button type="button" onClick={confirmPendingCard}>
                      Подтвердить
                    </button>
                    <button type="button" onClick={returnPendingCard}>
                      Вернуть карту
                    </button>
                  </div>
                </section>
              )}

              {gameState.pendingCross && (
                <section className="panel-section confirmation-section">
                  <h2>Крестовина</h2>
                  <p>
                    Образована крестовина вокруг карты{' '}
                    <strong>{gameState.pendingCross.centerCardName}</strong>. Засчитать +5
                    очков?
                  </p>
                  <small>
                    Бонус получит {getPlayerLabel(gameState.pendingCross.playerId)}.
                  </small>
                  <div className="confirmation-actions">
                    <button type="button" onClick={approvePendingCross}>
                      Засчитать +5
                    </button>
                    <button type="button" onClick={rejectPendingCross}>
                      Не засчитывать
                    </button>
                  </div>
                </section>
              )}

              <nav className="panel-actions" aria-label="Действия">
                <button type="button" onClick={() => setActiveModal('new-game')}>
                  Новая игра
                </button>
                <button type="button" onClick={handleResetCamera}>
                  Сброс позиции
                </button>
                <button type="button" onClick={() => setActiveModal('rules')}>
                  Правила
                </button>
                <button type="button" onClick={() => setActiveModal('settings')}>
                  Настройки
                </button>
              </nav>
            </aside>
          </div>

          <PlayerHand
            playerNumber={0}
            cards={gameState.players[0].cards}
            deckCount={gameState.deck[0].length}
            selectedCard={gameState.currentPlayerIndex === 0 ? activeSelectedCard : null}
            isActive={gameState.currentPlayerIndex === 0 && !hasPendingDecision}
            onMoveCardDrag={handleMoveCardDrag}
            onStartCardDrag={handleStartCardDrag}
            onCancelCardDrag={handleCancelCardDrag}
          />
        </section>
      </main>
      {dragPreview && (
        <div
          className="drag-card-preview"
          style={{
            left: `${dragPreview.x}px`,
            top: `${dragPreview.y}px`,
          }}
        >
          <div className={`drag-card-preview-card player-${dragPreview.playerColor}`}>
            {dragPreview.cardName}
          </div>
        </div>
      )}
      {activeModal === 'new-game' && (
        <Modal
          closeOnOverlayClick={false}
          onClose={() => setActiveModal(null)}
          title="Новая игра"
        >
          <p>Начать новую игру? Текущая партия будет сброшена.</p>
          <div className="modal-actions">
            <button type="button" onClick={handleConfirmNewGame}>
              Начать заново
            </button>
            <button type="button" onClick={() => setActiveModal(null)}>
              Отмена
            </button>
          </div>
        </Modal>
      )}
      {activeModal === 'rules' && (
        <Modal onClose={() => setActiveModal(null)} title="Правила">
          <RulesContent />
          <div className="modal-actions">
            <button type="button" onClick={() => setActiveModal(null)}>
              Закрыть
            </button>
          </div>
        </Modal>
      )}
      {activeModal === 'settings' && (
        <Modal onClose={() => setActiveModal(null)} title="Настройки">
          <div className="settings-row">
            <label htmlFor="show-playable-highlights">
              Показывать подсветку допустимых клеток
            </label>
            <input
              checked={interfaceSettings.showPlayableHighlights}
              id="show-playable-highlights"
              onChange={(event) =>
                setInterfaceSettings((settings) => ({
                  ...settings,
                  showPlayableHighlights: event.target.checked,
                }))
              }
              type="checkbox"
            />
          </div>
          <div className="settings-row">
            <label htmlFor="show-card-tooltips">Показывать tooltip карт</label>
            <input
              checked={interfaceSettings.showCardTooltips}
              id="show-card-tooltips"
              onChange={(event) =>
                setInterfaceSettings((settings) => ({
                  ...settings,
                  showCardTooltips: event.target.checked,
                }))
              }
              type="checkbox"
            />
          </div>
          <div className="modal-actions">
            <button type="button" onClick={handleResetSettings}>
              Сбросить настройки
            </button>
            <button type="button" onClick={() => setActiveModal(null)}>
              Закрыть
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

export default App;
