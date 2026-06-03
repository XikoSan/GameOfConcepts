import React, { useCallback } from 'react';
import type { CardName, GameState, Coordinates } from '../game';
import { Cell } from './Cell';
import './GameBoard.css';

interface GameBoardProps {
  gameState: GameState;
  selectedCard: CardName | null;
  onPlaceCard: (cardName: CardName, coordinates: Coordinates) => void;
  boardSize?: number;
}

const BOARD_SIZE = 15;

export const GameBoard: React.FC<GameBoardProps> = ({
  gameState,
  selectedCard,
  onPlaceCard,
  boardSize = BOARD_SIZE,
}) => {
  const handleCellClick = useCallback(
    (x: number, y: number) => {
      if (selectedCard) {
        onPlaceCard(selectedCard, { x, y });
      }
    },
    [selectedCard, onPlaceCard]
  );

  return (
    <div className="game-board-container">
      <div
        className="game-board"
        style={{
          gridTemplateColumns: `repeat(${boardSize}, 1fr)`,
          gridTemplateRows: `repeat(${boardSize}, 1fr)`,
        }}
      >
        {Array.from({ length: boardSize * boardSize }).map((_, index) => {
          const y = Math.floor(index / boardSize);
          const x = index % boardSize;
          const key = `${x},${y}`;
          const placedCard = gameState.board[key];

          return (
            <Cell
              key={`${x}-${y}`}
              placedCard={placedCard}
              onCellClick={() => handleCellClick(x, y)}
              isHighlighted={selectedCard !== null}
            />
          );
        })}
      </div>
    </div>
  );
};
