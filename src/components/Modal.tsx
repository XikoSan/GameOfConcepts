import { useEffect, useId, useRef } from 'react';
import type { ReactNode } from 'react';
import './Modal.css';

interface ModalProps {
  title: string;
  headerActions?: ReactNode;
  children: ReactNode;
  onClose: () => void;
  closeOnOverlayClick?: boolean;
  trapFocus?: boolean;
}

export function Modal({
  title,
  headerActions,
  children,
  onClose,
  closeOnOverlayClick = true,
  trapFocus = false,
}: ModalProps) {
  const titleId = useId();
  const overlayRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!trapFocus) return;
    const overlay = overlayRef.current;
    const dialog = dialogRef.current;
    if (!overlay || !dialog) return;
    const previous = document.activeElement;
    // Own only newly locked siblings. Nested layers must not restore another
    // layer's stale locks if both dialogs unmount in the same render.
    const siblings = Array.from(overlay.parentElement?.children ?? [])
      .filter((element): element is HTMLElement => element instanceof HTMLElement && element !== overlay && !element.inert);
    siblings.forEach(element => { element.inert = true; });
    const focusable = () => Array.from(dialog.querySelectorAll<HTMLElement>(
      'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), summary, [tabindex="0"]'
    )).filter(element => element.getClientRects().length > 0);
    (focusable()[0] ?? dialog).focus();
    const cycleFocus = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const elements = focusable();
      const first = elements[0] ?? dialog;
      const last = elements.at(-1) ?? dialog;
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialog)) {
        event.preventDefault();
        first.focus();
      }
    };
    dialog.addEventListener('keydown', cycleFocus);
    return () => {
      dialog.removeEventListener('keydown', cycleFocus);
      siblings.forEach(element => { element.inert = false; });
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
    };
  }, [trapFocus]);
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      // A detail panel can sit above another modal. Only the active layer closes.
      const layers = Array.from(document.querySelectorAll('.modal-overlay'))
        .filter(element => !element.closest('[inert]'));
      if (layers.at(-1) === overlayRef.current) onClose();
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  return (
    <div
      ref={overlayRef}
      className="modal-overlay"
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
      onMouseDown={(event) => {
        event.stopPropagation();
        if (closeOnOverlayClick) onClose();
      }}
      role="presentation"
    >
      <section
        ref={dialogRef}
        tabIndex={-1}
        className="modal-window"
        aria-modal="true"
        aria-labelledby={titleId}
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
      >
        <header className="modal-header">
          <h2 id={titleId}>{title}</h2>
          {headerActions}
          <button
            aria-label="Закрыть"
            className="modal-close-button"
            onClick={onClose}
            type="button"
          >
            ×
          </button>
        </header>
        <div className="modal-content">{children}</div>
      </section>
    </div>
  );
}
