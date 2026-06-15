import React from 'react';

export default function Table({ columns, data, loading, emptyMessage = 'No data found', expandableRow }) {
  if (loading) return (
    <div className="card text-center py-16">
      <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-500 rounded-full animate-spin mx-auto mb-3" />
      <p className="text-sm text-secondary-500 font-medium animate-pulse">Loading data...</p>
    </div>
  );

  const emptyState = (
    <div className="text-center py-16 text-secondary-400">
      <svg className="w-12 h-12 mx-auto mb-4 text-secondary-300 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
      <p className="font-medium text-secondary-500">{emptyMessage}</p>
    </div>
  );

  return (
    <>
      {/* Desktop Table View */}
      <div className="hidden md:block table-wrapper bg-white rounded-2xl shadow-sm border border-secondary-100 overflow-hidden">
        <table className="table-base w-full">
          <thead className="table-head bg-secondary-50">
            <tr>{columns.map((c) => <th key={c.key} className="table-th text-left px-4 py-3 text-xs font-semibold text-secondary-500 uppercase tracking-wide border-b border-secondary-100">{c.label}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-secondary-50">
            {data.length === 0
              ? <tr><td colSpan={columns.length}>{emptyState}</td></tr>
              : data.map((row, i) => (
                  <React.Fragment key={i}>
                    <tr className="table-row hover:bg-secondary-50/50 transition-colors">
                      {columns.map((c) => (
                        <td key={c.key} className="table-td px-4 py-3">
                          {c.render ? c.render(row[c.key], row) : row[c.key] ?? '—'}
                        </td>
                      ))}
                    </tr>
                    {expandableRow && expandableRow(row)}
                  </React.Fragment>
                ))
            }
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-4">
        {data.length === 0 ? (
          <div className="card p-0">{emptyState}</div>
        ) : (
          data.map((row, i) => {
            const isAction = (c) => c.key === 'actions' || c.key === 'action' || c.label === '' || c.label?.toLowerCase() === 'actions' || c.label?.toLowerCase() === 'action';
            const dataCols = columns.filter(c => !isAction(c));
            const actionCols = columns.filter(c => isAction(c));
            
            return (
              <div key={i} className="card p-4 space-y-3">
                <div className="space-y-3">
                  {dataCols.map((c) => (
                    <div key={c.key} className="flex justify-between items-start gap-4 text-sm">
                      <span className="text-secondary-500 font-medium whitespace-nowrap">{c.label}</span>
                      <span className="text-secondary-800 text-right break-words min-w-0 flex-1 overflow-hidden">
                        {c.render ? c.render(row[c.key], row) : row[c.key] ?? '—'}
                      </span>
                    </div>
                  ))}
                </div>
                
                {expandableRow && (
                  <div className="pt-3 border-t border-secondary-100">
                    {expandableRow(row)}
                  </div>
                )}
                
                {actionCols.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-secondary-100 flex flex-wrap items-center justify-end gap-2 min-w-0 action-footer">
                    {actionCols.map(c => (
                      <div key={c.key} className="min-w-0 flex flex-wrap justify-end gap-2">
                        {c.render ? c.render(row[c.key], row) : row[c.key]}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </>
  );
}