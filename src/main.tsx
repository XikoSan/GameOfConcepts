import { StrictMode } from 'react'
import { Capacitor } from '@capacitor/core'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { GameViewport } from './components/GameViewport'

document.documentElement.classList.toggle('native-app', Capacitor.isNativePlatform());

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {!Capacitor.isNativePlatform() && window.self === window.top ? <GameViewport /> : <App />}
  </StrictMode>,
)
