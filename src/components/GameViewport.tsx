import './GameViewport.css';

// A stable browsing context keeps pointer coordinates and body portals in the
// same landscape viewport, including when the outer phone screen is portrait.
export function GameViewport() {
  return <iframe className="game-viewport" title="Игра понятий" src={window.location.href}
    allow="autoplay; fullscreen" />;
}
