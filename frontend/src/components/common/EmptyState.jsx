/**
 * EmptyState — reusable empty state component
 * Usage: <EmptyState icon={FiFileText} title="No results" message="Upload results to get started" action={{ label: 'Upload', onClick: () => {} }} />
 */
export default function EmptyState({ icon: Icon, title, message, action, className = '' }) {
  return (
    <div className={`flex flex-col items-center justify-center py-16 px-6 text-center ${className}`}>
      {Icon && (
        <div className="w-16 h-16 bg-secondary-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Icon size={28} className="text-secondary-400" />
        </div>
      )}
      <p className="font-semibold text-secondary-700 text-base">{title}</p>
      {message && <p className="text-sm text-secondary-400 mt-1.5 max-w-xs">{message}</p>}
      {action && (
        <button onClick={action.onClick} className="btn-primary mt-5 text-sm">
          {action.label}
        </button>
      )}
    </div>
  );
}
