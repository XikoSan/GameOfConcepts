import React from 'react';
import './MenuBoardPreview.css';

/**
 * Небольшой декоративный снимок игрового поля для меню.
 * Он не подключён к состоянию партии и не принимает ввод: меню должно
 * показывать знакомую поверхность игры, не создавая второй игровой стол.
 */
const tiles = [
  { name: 'Эмоция', x: 50, y: 16, owner: 'neutral' },
  { name: 'Радость', x: 24, y: 42, owner: 'blue' },
  { name: 'Улыбка', x: 50, y: 42, owner: 'orange' },
  { name: 'Веселье', x: 24, y: 68, owner: 'green' },
  { name: 'Симпатия', x: 50, y: 68, owner: 'blue' },
  { name: 'Надежда', x: 76, y: 16, owner: 'purple' },
  { name: 'Доверие', x: 76, y: 42, owner: 'green' },
  { name: 'Общество', x: 76, y: 68, owner: 'orange' },
];

export const MenuBoardPreview: React.FC = () => (
  <div className="menu-board-preview" aria-hidden="true">
    <div className="menu-board-atmosphere" />
    <div className="menu-board-stage">
      <div className="menu-board-grid" />
      <svg className="menu-board-links" viewBox="0 0 100 100" preserveAspectRatio="none">
        <path d="M24 42 L50 42 M24 42 L24 68 M50 42 L76 42 M50 42 L50 68 M76 16 L76 42 M50 68 L76 68 M50 16 L50 42" />
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
