import { useEffect, useRef, useState } from 'react';

interface Props {
  onMenu: () => void;
  onRules: () => void;
  onSettings: () => void;
}

export function TableMenu({ onMenu, onRules, onSettings }: Props) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setOpen(false); root.current?.querySelector('button')?.focus(); }
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);
  const run = (action: () => void) => { setOpen(false); action(); };
  return <nav ref={root} className={`table-menu ${open ? 'is-open' : ''}`} aria-label="Меню игры">
    <button className="table-menu-toggle" type="button" aria-expanded={open} onClick={() => setOpen(value => !value)}>Меню</button>
    <div className="table-menu-items">
      <button className="table-menu-tutorial" type="button" onClick={() => run(onMenu)}>В меню</button>
      <button className="table-menu-rules" type="button" onClick={() => run(onRules)}>Правила</button>
      <button className="table-menu-settings" type="button" onClick={() => run(onSettings)}>Настройки</button>
    </div>
  </nav>;
}
