import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { GameViewport } from './components/GameViewport'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {window.self === window.top ? <GameViewport /> : <App />}
  </StrictMode>,
)
