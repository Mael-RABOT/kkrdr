import { useEffect, useRef, type ReactNode } from 'react';

/** A centered popup on the native <dialog>: Escape and a click on the backdrop close it. */
export default function Modal({ onClose, className, children }: { onClose: () => void; className?: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
    return () => d?.close();
  }, []);

  return (
    <dialog
      ref={ref}
      className={`card modal${className ? ` ${className}` : ''}`}
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
