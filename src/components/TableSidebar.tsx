import { useEffect, useId, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useCompactTable } from '../hooks/useCompactTable';

interface Props {
  controls?: ReactNode;
  log: ReactNode;
  reminder: ReactNode;
  reveal?: 'log' | 'reminder' | null;
}

export function TableSidebar({ controls, log, reminder, reveal }: Props) {
  const compact = useCompactTable();
  const [opened, setOpened] = useState<'log' | 'reminder' | null>(null);
  const [dismissedReveal, setDismissedReveal] = useState<Props['reveal']>(null);
  const panel = (reveal !== dismissedReveal ? reveal : null) ?? opened;
  const id = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const close = () => { setOpened(null); setDismissedReveal(reveal); triggerRef.current?.focus(); };
  useEffect(() => {
    if (!compact || !panel) return;
    closeRef.current?.focus();
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setOpened(null); setDismissedReveal(reveal); triggerRef.current?.focus(); }
    };
    window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  }, [compact, panel, reveal]);

  if (!compact) return <aside className="turn-sidebar" aria-label="Управление партией и ходом">{controls}{log}{reminder}</aside>;
  return <>
    <nav className="mobile-sidebar-tabs" aria-label="Информация о партии">
      {(['log', 'reminder'] as const).map(name => <button key={name} type="button"
        className={`mobile-${name}-trigger`} aria-expanded={panel === name} aria-controls={id}
        onClick={event => { triggerRef.current = event.currentTarget; setDismissedReveal(reveal); setOpened(panel === name ? null : name); }}>
        {name === 'log' ? 'Лог' : 'Памятка'}
      </button>)}
    </nav>
    {panel && <button className="mobile-sidebar-dismiss" type="button" aria-label="Закрыть боковую панель" onClick={close} />}
    <aside id={id} className={`turn-sidebar mobile-sidebar ${panel ? 'is-open' : ''}`} inert={!panel}
      aria-hidden={!panel} aria-label={panel === 'log' ? 'Лог партии' : 'Памятка'}>
      <header className="mobile-sidebar-heading"><strong>{panel === 'log' ? 'Лог партии' : 'Памятка'}</strong>
        <button ref={closeRef} type="button" aria-label="Закрыть панель" onClick={close}>×</button>
      </header>
      {panel === 'log' ? <>{log}{controls}</> : reminder}
    </aside>
  </>;
}
