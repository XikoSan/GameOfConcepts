import { useState } from 'react';
import { GameBoard } from './components/GameBoard';
import { GameStatus } from './components/GameStatus';
import { PlayerHand } from './components/PlayerHand';
import { useGameState } from './hooks/useGameState';
import type { CardName, Coordinates } from './game';
import './App.css';

function App() {
  const [selectedCard, setSelectedCard] = useState<CardName | null>(null);
  const { gameState, placeCard } = useGameState();

  const handlePlaceCard = (cardName: CardName, coordinates: Coordinates) => {
    if (!selectedCard) return;

    placeCard(cardName, coordinates);
    setSelectedCard(null);
  };

  const currentPlayer = gameState.players[gameState.currentPlayerIndex];

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>🎮 Смыслы - MVP</h1>
        <GameStatus
          currentPlayerIndex={gameState.currentPlayerIndex}
          totalPlacedCards={Object.keys(gameState.board).length}
        />
        <p>Колода Игрока 1: {gameState.deck[0].length}</p>
        <p>Колода Игрока 2: {gameState.deck[1].length}</p>
      </header>

      <main className="app-main">
        <GameBoard
          gameState={gameState}
          selectedCard={selectedCard}
          onPlaceCard={handlePlaceCard}
        />

        <div className="players-section">
          <PlayerHand
            playerNumber={gameState.currentPlayerIndex}
            cards={currentPlayer.cards}
            selectedCard={selectedCard}
            onSelectCard={setSelectedCard}
          />
        </div>
      </main>
    </div>
  );
}

export default App;
