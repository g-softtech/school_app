import { useEffect, useRef } from 'react';
import { FiX } from 'react-icons/fi';

const SIZES = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
};

export default function Modal({ isOpen, onClose, title, children, size = 'md' }) {
  const contentRef = useRef(null);

  // Lock scroll
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape' && isOpen) onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm modal-overlay"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        ref={contentRef}
        className={`relative bg-white rounded-2xl shadow-2xl w-full ${SIZES[size]} max-h-[90vh] flex flex-col modal-content`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-secondary-100 flex-shrink-0">
          <h3 className="text-base font-semibold text-secondary-800 pr-4">{title}</h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-secondary-100 text-secondary-400 hover:text-secondary-600 transition-colors flex-shrink-0"
            aria-label="Close"
          >
            <FiX size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-5">
          {children}
        </div>
      </div>
    </div>
  );
}
