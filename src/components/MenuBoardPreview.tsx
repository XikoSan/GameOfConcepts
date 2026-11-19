import React from 'react';
import './MenuBoardPreview.css';

/**
 * Небольшой декоративный снимок игрового поля для меню.
 * Он не подключён к состоянию партии и не принимает ввод: меню должно
 * показывать знакомую поверхность игры, не создавая второй игровой стол.
 */
const tiles = [
  { name: 'Эмоция', x: 50, y: 30, owner: 'neutral' },
  { name: 'Радость', x: 32, y: 50, owner: 'blue' },
  { name: 'Улыбка', x: 50, y: 50, owner: 'orange' },
  { name: 'Веселье', x: 32, y: 70, owner: 'green' },
  { name: 'Симпатия', x: 50, y: 70, owner: 'blue' },
  { name: 'Надежда', x: 68, y: 30, owner: 'purple' },
  { name: 'Доверие', x: 68, y: 50, owner: 'green' },
  { name: 'Общество', x: 68, y: 70, owner: 'orange' },
];

export const MenuBoardPreview: React.FC = () => (
  <div className="menu-board-preview" aria-hidden="true">
    <div className="menu-board-atmosphere" />
    <div className="menu-board-stage">
      <div className="menu-board-grid" />
      <svg className="menu-board-links" viewBox="0 0 100 100" preserveAspectRatio="none">
        <path d="M32 40 L50 40 M32 60 L32 70 M50 40 L68 40 M50 60 L50 70 M68 40 L68 50 M50 70 L68 70" />
      </svg>
      {tiles.map((tile) => (
        <span
          className={`menu-board-tile menu-board-tile-${tile.owner}`}
          key={`${tile.name}-${tile.x}-${tile.y}`}
          style={{ left: `${tile.x}%`, top: `${tile.y}%` }}
        >
          <span>{tile.name}</span>
        </span>
      ))}
    </div>
  </div>
);
