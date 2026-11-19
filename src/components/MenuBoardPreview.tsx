import React from 'react';
import './MenuBoardPreview.css';

/**
 * Небольшой декоративный снимок игрового поля для меню.
 * Он не подключён к состоянию партии и не принимает ввод: меню должно
 * показывать знакомую поверхность игры, не создавая второй игровой стол.
 */
const tiles = [
  { name: 'Эмоция', x: 48, y: 42, owner: 'neutral' },
  { name: 'Радость', x: 40, y: 42, owner: 'blue' },
  { name: 'Улыбка', x: 40, y: 50, owner: 'orange' },
  { name: 'Веселье', x: 40, y: 58, owner: 'green' },
  { name: 'Симпатия', x: 48, y: 58, owner: 'blue' },
  { name: 'Надежда', x: 56, y: 42, owner: 'purple' },
  { name: 'Доверие', x: 56, y: 50, owner: 'green' },
  { name: 'Общество', x: 56, y: 58, owner: 'orange' },
];

export const MenuBoardPreview: React.FC = () => (
  <div className="menu-board-preview" aria-hidden="true">
    <div className="menu-board-grid" />
    <svg className="menu-board-links" viewBox="0 0 100 100" preserveAspectRatio="none">
      <path d="M40 46 L48 46 M40 54 L40 58 M48 46 L56 46 M48 54 L48 58 M56 46 L56 54 M48 58 L56 58" />
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
);
