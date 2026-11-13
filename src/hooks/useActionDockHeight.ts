import { useLayoutEffect } from 'react';

// Side controls stay above both the raised hand and the content-sized move editor.
export function useActionDockHeight(dock: HTMLElement | null) {
  useLayoutEffect(() => {
    const tray = dock?.closest<HTMLElement>('.table-hand-tray');
    const workspace = tray?.closest<HTMLElement>('.table-workspace');
    if (!tray || !workspace) return;
    const update = () => workspace.style.setProperty('--mobile-overlay-height', `${tray.getBoundingClientRect().height}px`);
    const observer = new ResizeObserver(update);
    observer.observe(tray);
    update();
    return () => { observer.disconnect(); workspace.style.removeProperty('--mobile-overlay-height'); };
  }, [dock]);
}
