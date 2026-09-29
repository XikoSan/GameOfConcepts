import { useEffect } from 'react';
import type { ReactNode } from 'react';
import './Modal.css';

interface ModalProps {
  title: string;
  headerActions?: ReactNode;
  children: ReactNode;
  onClose: () => void;
  closeOnOverlayClick?: boolean;
}

export function Modal({
  title,
  headerActions,
  children,
  onClose,
  closeOnOverlayClick = true,
}: ModalProps) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  return (
    <div
      className="modal-overlay"
      onMouseDown={closeOnOverlayClick ? onClose : undefined}
      role="presentation"
    >
      <section
        className="modal-window"
        aria-modal="true"
        aria-labelledby="modal-title"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
      >
        <header className="modal-header">
          <h2 id="modal-title">{title}</h2>
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
