import React from 'react';
import './MenuBoardPreview.css';

/**
 * Небольшой декоративный снимок игрового поля для меню.
 * Он не подключён к состоянию партии и не принимает ввод: меню должно
 * показывать знакомую поверхность игры, не создавая второй игровой стол.
 */
const tiles = [
  { name: 'Эмоция', x: 50, y: 30, owner: 'neutral' },
  { name: 'Радость', x: 32, y: 48, owner: 'blue' },
  { name: 'Улыбка', x: 50, y: 48, owner: 'orange' },
  { name: 'Веселье', x: 32, y: 66, owner: 'green' },
  { name: 'Симпатия', x: 50, y: 66, owner: 'blue' },
  { name: 'Надежда', x: 68, y: 30, owner: 'purple' },
  { name: 'Доверие', x: 68, y: 48, owner: 'green' },
  { name: 'Общество', x: 68, y: 66, owner: 'orange' },
];

export const MenuBoardPreview: React.FC = () => (
  <div className="menu-board-preview" aria-hidden="true">
    <div className="menu-board-atmosphere" />
    <div className="menu-board-stage">
      <div className="menu-board-grid" />
      <svg className="menu-board-links" viewBox="0 0 100 100" preserveAspectRatio="none">
        <path d="M32 48 L50 48 M32 48 L32 66 M50 48 L68 48 M50 48 L50 66 M68 30 L68 48 M50 66 L68 66 M50 30 L50 48" />
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
