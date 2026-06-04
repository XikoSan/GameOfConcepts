import { useEffect, useState } from 'react';
import type { DragEvent } from 'react';
import { GameBoard } from './components/GameBoard';
import { PlayerHand } from './components/PlayerHand';
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

function App() {
  const [selectedCard, setSelectedCard] = useState<RegularCardName | null>(null);
  const [dragPreview, setDragPreview] = useState<DragPreview | null>(null);
  const { gameState, placeCard, confirmPendingCard, returnPendingCard } = useGameState();
  const activeSelectedCard = gameState.pendingMove ? null : selectedCard;

  const handlePlaceCard = (cardName: RegularCardName, coordinates: Coordinates) => {
    if (!selectedCard || gameState.pendingMove) return;

    placeCard(cardName, coordinates);
  };

  const handleStartCardDrag = (
    cardName: RegularCardName,
    playerColor: DragPreview['playerColor'],
    event: DragEvent<HTMLDivElement>
  ) => {
    if (gameState.pendingMove) return;

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
            isActive={gameState.currentPlayerIndex === 1 && !gameState.pendingMove}
            onMoveCardDrag={handleMoveCardDrag}
            onStartCardDrag={handleStartCardDrag}
            onCancelCardDrag={handleCancelCardDrag}
          />

          <div className="table-middle">
            <div className="board-section">
              <GameBoard
                key={gameState.startCard.id}
                gameState={gameState}
                selectedCard={activeSelectedCard}
                onPlaceCard={handlePlaceCard}
                onFinishDrag={handleCancelCardDrag}
              />
            </div>

            <aside className="side-panel" aria-label="Панель лобби">
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

              <nav className="panel-actions" aria-label="Действия">
                <button type="button">Новая игра</button>
                <button type="button">Сброс камеры</button>
                <button type="button">Правила</button>
                <button type="button">Настройки</button>
              </nav>
            </aside>
          </div>

          <PlayerHand
            playerNumber={0}
            cards={gameState.players[0].cards}
            deckCount={gameState.deck[0].length}
            selectedCard={gameState.currentPlayerIndex === 0 ? activeSelectedCard : null}
            isActive={gameState.currentPlayerIndex === 0 && !gameState.pendingMove}
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
    </div>
  );
}

export default App;
