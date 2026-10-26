import { useEffect, useRef, type ReactNode } from 'react';

/**
 * A centered popup on the native <dialog>: Escape and a click on the backdrop close it.
 * It opens focused on the element marked `data-autofocus`, or on itself: React's autoFocus runs
 * while the dialog is still closed, and showModal() would otherwise pick the first link or button.
 */
export default function Modal({ onClose, className, children }: { onClose: () => void; className?: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) {
      d.showModal();
      (d.querySelector<HTMLElement>('[data-autofocus]') ?? d).focus();
    }
    return () => d?.close();
  }, []);

  return (
    <dialog
      ref={ref}
      className={`card modal${className ? ` ${className}` : ''}`}
      tabIndex={-1}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => e.target === ref.current && onClose()}
    >
      {children}
    </dialog>
  );
}
