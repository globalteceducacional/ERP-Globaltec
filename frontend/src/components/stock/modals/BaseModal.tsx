import { ReactNode } from 'react';

interface BaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  maxWidth?: string;
  showCloseButton?: boolean;
}

export function BaseModal({
  isOpen,
  onClose,
  title,
  children,
  maxWidth = 'max-w-2xl',
  showCloseButton = true,
}: BaseModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-2 sm:p-4 overflow-y-auto">
      <div className={`bg-neutral border border-white/20 rounded-xl shadow-2xl ${maxWidth} w-full max-h-[90vh] overflow-y-auto`}>
        <div className="sticky top-0 bg-neutral border-b border-white/20 px-4 sm:px-8 py-4 sm:py-6 flex items-center justify-between z-10">
          <h2 className="text-lg sm:text-2xl font-bold">{title}</h2>
          {showCloseButton && (
            <button
              onClick={onClose}
              className="text-white/50 hover:text-white transition-colors text-xl sm:text-2xl"
            >
              ✕
            </button>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}
