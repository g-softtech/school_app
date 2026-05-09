import { FiAlertTriangle } from 'react-icons/fi';
import Modal from './Modal';

export default function ConfirmDialog({
  isOpen, onClose, onConfirm, loading,
  title = 'Confirm Action',
  message = 'Are you sure? This action cannot be undone.',
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger', // danger | warning | primary
}) {
  const btnClass = variant === 'danger'
    ? 'btn-danger'
    : variant === 'warning'
      ? 'bg-amber-500 hover:bg-amber-600 text-white font-medium py-2 px-5 rounded-xl transition-all duration-200 inline-flex items-center gap-2'
      : 'btn-primary';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm">
      <div className="space-y-5">
        <div className="flex items-start gap-4">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
            variant === 'danger' ? 'bg-red-100' : variant === 'warning' ? 'bg-amber-100' : 'bg-primary-100'
          }`}>
            <FiAlertTriangle size={20} className={
              variant === 'danger' ? 'text-red-500' : variant === 'warning' ? 'text-amber-600' : 'text-primary-600'
            } />
          </div>
          <p className="text-sm text-secondary-600 leading-relaxed pt-1.5">{message}</p>
        </div>
        <div className="flex gap-3 pt-1">
          <button onClick={onClose} className="btn-secondary flex-1" disabled={loading}>
            {cancelLabel}
          </button>
          <button onClick={onConfirm} className={`${btnClass} flex-1 justify-center`} disabled={loading}>
            {loading ? (
              <span className="flex items-center gap-2 justify-center">
                <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                Processing…
              </span>
            ) : confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}
