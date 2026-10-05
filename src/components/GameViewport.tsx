import { useEffect, useRef } from 'react';
import './GameViewport.css';

// Keep one browsing context so rotation never restarts the current match.
export function GameViewport() {
  const frame = useRef<HTMLIFrameElement>(null);
  const cleanup = useRef<(() => void) | undefined>(undefined);
  useEffect(() => () => cleanup.current?.(), []);
  const connect = () => {
    cleanup.current?.();
    const element = frame.current;
    const child = element?.contentDocument;
    if (!element || !child) return;
    let requested = false;
    const fit = () => {
      const viewport = window.visualViewport;
      const editing = child.activeElement?.matches('input, textarea, [contenteditable="true"]') ?? false;
      element.classList.toggle('is-editing', editing);
      child.documentElement.classList.toggle('keyboard-editing', editing);
      element.style.setProperty('--visible-width', (viewport?.width ?? innerWidth) + 'px');
      element.style.setProperty('--visible-height', (viewport?.height ?? innerHeight) + 'px');
      element.style.setProperty('--visible-top', (viewport?.offsetTop ?? 0) + 'px');
      if (editing) child.activeElement?.scrollIntoView({ block: 'nearest' });
    };
    const enter = async (event: MouseEvent) => {
      const target = event.target as Element;
      const button = target.closest('button');
      if (requested || !matchMedia('(pointer: coarse)').matches || !button?.closest('.main-menu-actions') ||
          !/Локальная игра|Онлайн игра|Обучение|Продолжить/.test(button.textContent ?? '')) return;
      const orientation = screen.orientation as ScreenOrientation & { lock?: (value: string) => Promise<void> };
      if (!orientation.lock || !document.documentElement.requestFullscreen) return;
      requested = true;
      try {
        await document.documentElement.requestFullscreen();
        await orientation.lock('landscape');
      } catch {
        // Unsupported browsers retain the CSS landscape layout.
        requested = false;
      }
    };
    child.addEventListener('click', enter);
    const onFocusIn = (event: FocusEvent) => { if ((event.target as Element).matches('input, textarea, [contenteditable="true"]')) fit(); };
    child.addEventListener('focusin', onFocusIn);
    const afterBlur = () => window.setTimeout(fit, 200);
    child.addEventListener('focusout', afterBlur);
    window.visualViewport?.addEventListener('resize', fit);
    window.visualViewport?.addEventListener('scroll', fit);
    window.addEventListener('resize', fit);
    fit();
    cleanup.current = () => {
      child.removeEventListener('click', enter);
      child.removeEventListener('focusin', onFocusIn);
      child.removeEventListener('focusout', afterBlur);
      window.visualViewport?.removeEventListener('resize', fit);
      window.visualViewport?.removeEventListener('scroll', fit);
      window.removeEventListener('resize', fit);
    };
  };
  return <iframe ref={frame} onLoad={connect} className="game-viewport" title="Игра понятий" src={window.location.href}
    allow="autoplay; fullscreen" />;
}
