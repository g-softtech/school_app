/**
 * ReportCard.jsx — Canonical report card component.
 *
 * This is the SINGLE source of truth for report card rendering.
 * It performs ZERO calculations — all values come from the backend.
 *
 * Props:
 *   student  — { userId: { name }, admissionNumber, classId: { name, section } }
 *   results  — [{ subjectId: { name }, ca, exam, total, grade, remark }]
 *   summary  — { totalSubjects, average, passed, failed, attendance: { ... } }
 *   term     — string
 *   session  — string
 *   loading  — boolean
 */

const GRADE_BG = {
  A1: 'bg-green-100 text-green-700',
  B2: 'bg-green-100 text-green-700',
  B3: 'bg-green-100 text-green-700',
  C4: 'bg-blue-100 text-blue-700',
  C5: 'bg-blue-100 text-blue-700',
  C6: 'bg-blue-100 text-blue-700',
  D7: 'bg-amber-100 text-amber-700',
  E8: 'bg-amber-100 text-amber-700',
  F9: 'bg-red-100 text-red-600',
};

const PASS_GRADES = ['A1', 'B2', 'B3', 'C4', 'C5', 'C6'];

export default function ReportCard({ student, results = [], summary = null, term, session, loading = false }) {
  const termLabel = term ? term.charAt(0).toUpperCase() + term.slice(1) + ' Term' : '';
  const className = student?.classId
    ? `${student.classId.name || ''} ${student.classId.section || ''}`.trim()
    : '';

  // ── Loading skeleton ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="card h-20 animate-pulse bg-secondary-50" />
          ))}
        </div>
        <div className="card h-24 animate-pulse bg-secondary-50" />
        <div className="card p-0 overflow-hidden">
          <div className="p-5 border-b border-secondary-100 h-16 animate-pulse bg-secondary-50" />
          <div className="p-6 space-y-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-10 bg-secondary-50 rounded-lg animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Summary stat cards ─────────────────────────────────────────────── */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Subjects',  value: summary.totalSubjects, color: 'text-secondary-800' },
            { label: 'Average',   value: `${summary.average}%`, color: 'text-blue-600' },
            { label: 'Passed',    value: summary.passed,        color: 'text-green-600' },
            { label: 'Failed',    value: summary.failed,        color: 'text-red-500' },
          ].map((s) => (
            <div key={s.label} className="card text-center">
              <p className="text-xs text-secondary-500 mb-1">{s.label}</p>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Attendance Summary ─────────────────────────────────────────────── */}
      {summary?.attendance && (
        <div className="card">
          <h3 className="text-sm font-semibold text-secondary-800 mb-3 border-b border-secondary-100 pb-2">
            Attendance Summary
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-xs text-secondary-500 mb-1">Valid Days</p>
              <p className="text-xl font-bold text-secondary-800">{summary.attendance.validDays}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-secondary-500 mb-1">Days Present</p>
              <p className="text-xl font-bold text-green-600">
                {summary.attendance.presentDays + summary.attendance.lateDays}
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-secondary-500 mb-1">Days Absent</p>
              <p className="text-xl font-bold text-red-500">{summary.attendance.absentDays}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-secondary-500 mb-1">Attendance</p>
              <p className="text-xl font-bold text-blue-600">
                {summary.attendance.attendancePercentage}%
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Results table ──────────────────────────────────────────────────── */}
      <div className="card overflow-hidden p-0 max-w-[100vw]">
        {/* Student info header */}
        <div className="p-5 border-b border-secondary-100">
          {student && (
            <div>
              <h2 className="font-bold text-secondary-800">{student.userId?.name || '—'}</h2>
              <p className="text-sm text-secondary-500">
                {student.admissionNumber}
                {className && ` · ${className}`}
                {termLabel && ` · ${termLabel}`}
                {session && ` · ${session}`}
              </p>
              {summary && (
                <div className="flex flex-wrap gap-3 mt-2 text-sm text-secondary-600">
                  <span>Total Subjects: <b>{summary.totalSubjects}</b></span>
                  <span>Average: <b className="text-blue-600">{summary.average}%</b></span>
                  <span className="text-green-700">Passed: <b>{summary.passed}</b></span>
                  <span className="text-red-600">Failed: <b>{summary.failed}</b></span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Table */}
        {results.length === 0 ? (
          <p className="text-center text-secondary-400 py-12 text-sm">
            No results found for this term and session
          </p>
        ) : (
          <div className="overflow-x-auto w-full">
            <table className="w-full text-sm min-w-[600px]">
              <thead>
                <tr className="bg-secondary-50">
                  {['#', 'Subject', 'CA (40)', 'Exam (60)', 'Total (100)', 'Grade', 'Remark'].map((h) => (
                    <th
                      key={h}
                      className={`py-3 text-xs font-semibold text-secondary-500 uppercase tracking-wide ${
                        h === '#' || h === 'Subject' || h === 'Remark'
                          ? 'text-left px-5'
                          : 'text-center px-3'
                      }`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-secondary-50">
                {results.map((r, i) => (
                  <tr key={r._id || i} className="hover:bg-secondary-50 transition-colors">
                    <td className="px-5 py-3 text-secondary-400 text-xs">{i + 1}</td>
                    <td className="px-5 py-3 font-medium text-secondary-800">
                      {r.subjectId?.name || r.subjectName || '—'}
                    </td>
                    <td className="px-3 py-3 text-center text-secondary-700">{r.ca ?? '—'}</td>
                    <td className="px-3 py-3 text-center text-secondary-700">{r.exam ?? '—'}</td>
                    <td className="px-3 py-3 text-center font-bold text-secondary-800">{r.total ?? '—'}</td>
                    <td className="px-3 py-3 text-center">
                      <span
                        className={`inline-block text-xs font-bold px-2 py-0.5 rounded-full ${
                          GRADE_BG[r.grade] || 'bg-secondary-100 text-secondary-600'
                        }`}
                      >
                        {r.grade || '—'}
                      </span>
                    </td>
                    <td
                      className={`px-5 py-3 text-sm ${
                        PASS_GRADES.includes(r.grade) ? 'text-green-700' : 'text-red-600'
                      }`}
                    >
                      {r.remark || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
