import { useEffect, type ReactNode } from 'react';

interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  width?: number;
}

/** Modal acessivel simples (Esc fecha, fundo clicavel fecha). */
export default function Modal({ open, title, onClose, children, width }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="modal-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="modal" style={width ? { width: `min(${width}px, 100%)` } : undefined} role="dialog" aria-modal="true" aria-label={title}>
        <div className="row-between mb-2">
          <h3 className="card-title" style={{ marginBottom: 0 }}>
            {title}
          </h3>
          <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Fechar">
            Fechar
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
