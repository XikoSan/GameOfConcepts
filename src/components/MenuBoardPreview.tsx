import React from 'react';
import './MenuBoardPreview.css';

/**
 * Небольшой декоративный снимок игрового поля для меню.
 * Он не подключён к состоянию партии и не принимает ввод: меню должно
 * показывать знакомую поверхность игры, не создавая второй игровой стол.
 */
const tiles = [
  { name: 'Эмоция', owner: 'neutral' },
  { name: 'Радость', owner: 'blue' },
  { name: 'Улыбка', owner: 'orange' },
  { name: 'Веселье', owner: 'green' },
  { name: 'Симпатия', owner: 'blue' },
  { name: 'Надежда', owner: 'purple' },
  { name: 'Доверие', owner: 'green' },
  { name: 'Общество', owner: 'orange' },
];

export const MenuBoardPreview: React.FC = () => (
  <div className="menu-board-preview" aria-hidden="true">
    <div className="menu-board-atmosphere" />
    <div className="menu-board-stage">
      <div className="menu-board-grid" />
      <svg className="menu-board-links" viewBox="0 0 100 100" preserveAspectRatio="none">
        <path className="menu-board-link-mobile" d="M50 18 V82 M18 50 H82" />
        <path className="menu-board-link-desktop" d="M36 48 L50 48 M36 48 L36 66 M50 48 L64 48 M50 48 L50 66 M64 30 L64 48 M50 66 L64 66 M50 30 L50 48" />
      </svg>
      {tiles.map((tile, index) => (
        <span
          className={`menu-board-tile menu-board-tile-${tile.owner} menu-board-tile-position-${index + 1}`}
          key={tile.name}
        >
          <span>{tile.name}</span>
        </span>
      ))}
    </div>
  </div>
);
