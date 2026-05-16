/**
 * reportCardHelper.js
 * Generates a multi-student class report card PDF using a print window.
 *
 * Usage:
 *   generateClassReportCard({ className, students, term, session });
 *
 * Each student: { name, admissionNumber, results: [{subjectName, ca, exam, total, grade, remark}] }
 */

const GRADE_COLOR = (grade) => {
  if (['A1','B2','B3'].includes(grade)) return '#15803d';
  if (['C4','C5','C6'].includes(grade)) return '#1d4ed8';
  if (['D7','E8'].includes(grade))      return '#b45309';
  return '#dc2626';
};

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }) : '—';

function buildStudentCard(student, index, className, term, session) {
  // Safely extract values — handle both direct props and nested objects
  const studentName = student.name
    || student.userId?.name
    || student.studentName
    || 'Unknown';

  const admNo = student.admissionNumber
    || student.admNo
    || '—';

  const cls = student.className
    || className
    || (student.classId ? `${student.classId.name || ''} ${student.classId.section || ''}`.trim() : '—');

  const termLabel = term
    ? term.charAt(0).toUpperCase() + term.slice(1) + ' Term'
    : '';

  const results = student.results || [];

  // Summary
  const PASS = ['A1','B2','B3','C4','C5','C6'];
  const passed = results.filter(r => PASS.includes(r.grade)).length;
  const failed  = results.length - passed;
  const avg     = results.length > 0
    ? (results.reduce((s, r) => s + (Number(r.total) || 0), 0) / results.length).toFixed(1)
    : '0.0';

  const rows = results.map((r, i) => `
    <tr style="background:${i % 2 === 0 ? '#fff' : '#f9fafb'}">
      <td style="padding:7px 12px;border:1px solid #e5e7eb;font-size:12px">${r.subjectName || r.subject || '—'}</td>
      <td style="padding:7px 12px;border:1px solid #e5e7eb;font-size:12px;text-align:center">${r.ca ?? '—'}</td>
      <td style="padding:7px 12px;border:1px solid #e5e7eb;font-size:12px;text-align:center">${r.exam ?? '—'}</td>
      <td style="padding:7px 12px;border:1px solid #e5e7eb;font-size:12px;font-weight:700;text-align:center">${r.total ?? '—'}</td>
      <td style="padding:7px 12px;border:1px solid #e5e7eb;font-size:12px;text-align:center;color:${GRADE_COLOR(r.grade)};font-weight:700">${r.grade || '—'}</td>
      <td style="padding:7px 12px;border:1px solid #e5e7eb;font-size:12px;color:${GRADE_COLOR(r.grade)}">${r.remark || '—'}</td>
    </tr>
  `).join('');

  return `
    <div class="card" style="${index > 0 ? 'page-break-before:always;' : ''}">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #C9A227;padding-bottom:10px;margin-bottom:14px">
        <div>
          <div style="font-size:20px;font-weight:800;color:#1F2937">SmartSchool</div>
          <div style="font-size:11px;color:#6b7280;margin-top:2px">Academic Report Card</div>
        </div>
        <div style="background:#C9A227;color:white;padding:4px 14px;border-radius:20px;font-size:12px;font-weight:600">
          ${termLabel} · ${session || ''}
        </div>
      </div>

      <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:12px 16px;margin-bottom:14px;display:flex;gap:24px;flex-wrap:wrap">
        <div>
          <div style="font-size:9px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px">Student</div>
          <div style="font-size:15px;font-weight:700;color:#1F2937;margin-top:2px">${studentName}</div>
        </div>
        <div>
          <div style="font-size:9px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px">Admission No.</div>
          <div style="font-size:13px;font-weight:600;color:#1F2937;margin-top:2px">${admNo}</div>
        </div>
        <div>
          <div style="font-size:9px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px">Class</div>
          <div style="font-size:13px;font-weight:600;color:#1F2937;margin-top:2px">${cls}</div>
        </div>
        <div>
          <div style="font-size:9px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px">Average</div>
          <div style="font-size:16px;font-weight:700;color:#1d4ed8;margin-top:2px">${avg}%</div>
        </div>
        <div>
          <div style="font-size:9px;color:#15803d;text-transform:uppercase;letter-spacing:0.5px">Passed</div>
          <div style="font-size:16px;font-weight:700;color:#15803d;margin-top:2px">${passed}</div>
        </div>
        <div>
          <div style="font-size:9px;color:#dc2626;text-transform:uppercase;letter-spacing:0.5px">Failed</div>
          <div style="font-size:16px;font-weight:700;color:#dc2626;margin-top:2px">${failed}</div>
        </div>
      </div>

      ${results.length === 0
        ? '<p style="text-align:center;color:#9ca3af;padding:20px;font-size:13px">No results recorded for this term.</p>'
        : `<table style="width:100%;border-collapse:collapse">
            <thead>
              <tr style="background:#1F2937;color:white">
                <th style="padding:9px 12px;text-align:left;font-size:11px;font-weight:600;text-transform:uppercase">Subject</th>
                <th style="padding:9px 12px;text-align:center;font-size:11px;font-weight:600">CA (40)</th>
                <th style="padding:9px 12px;text-align:center;font-size:11px;font-weight:600">Exam (60)</th>
                <th style="padding:9px 12px;text-align:center;font-size:11px;font-weight:600">Total</th>
                <th style="padding:9px 12px;text-align:center;font-size:11px;font-weight:600">Grade</th>
                <th style="padding:9px 12px;text-align:left;font-size:11px;font-weight:600">Remark</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>`
      }

      <div style="margin-top:16px;display:flex;justify-content:space-between;font-size:10px;color:#9ca3af;border-top:1px solid #e5e7eb;padding-top:10px">
        <span>Generated: ${fmtDate(new Date())}</span>
        <span>SmartSchool Management System</span>
      </div>
    </div>
  `;
}

export function generateClassReportCard({ className, students = [], term, session }) {
  if (!students.length) {
    alert('No student data to generate report cards for.');
    return;
  }

  const cards = students
    .map((s, i) => buildStudentCard(s, i, className, term, session))
    .join('');

  const html = `<!DOCTYPE html><html><head>
    <title>Report Cards — ${className} · ${term} Term · ${session}</title>
    <style>
      @media print {
        body { margin: 0; }
        .no-print { display: none !important; }
        .card { page-break-inside: avoid; }
      }
      * { box-sizing: border-box; }
      body { font-family: Arial, sans-serif; padding: 24px; background: #f9fafb; color: #111; }
      .card { background: white; border-radius: 12px; padding: 22px; margin-bottom: 28px; box-shadow: 0 1px 4px rgba(0,0,0,0.08); }
      .controls { text-align:center; margin-bottom: 22px; }
      .btn { display:inline-block; padding:10px 28px; background:#C9A227; color:white; border:none; border-radius:8px; cursor:pointer; font-size:14px; font-weight:600; margin:0 6px; }
    </style>
  </head><body>
    <div class="controls no-print">
      <button class="btn" onclick="window.print()">🖨️ Print All Report Cards</button>
      <span style="font-size:13px;color:#6b7280;margin-left:10px">
        ${students.length} student${students.length !== 1 ? 's' : ''} · ${className} · ${term ? term.charAt(0).toUpperCase() + term.slice(1) + ' Term' : ''} · ${session || ''}
      </span>
    </div>
    ${cards}
  </body></html>`;

  const win = window.open('', '_blank', 'width=960,height=700');
  if (!win) {
    alert('Please allow popups for this site to generate report cards.');
    return;
  }
  win.document.write(html);
  win.document.close();
  win.focus();
}

export function generateSingleReportCard({ student, results, term, session }) {
  const className = student?.classId
    ? `${student.classId.name || ''} ${student.classId.section || ''}`.trim()
    : '';

  generateClassReportCard({
    className,
    students: [{
      name:            student?.userId?.name || student?.name || 'Unknown',
      admissionNumber: student?.admissionNumber || '—',
      results: (results || []).map(r => ({
        subjectName: r.subjectId?.name || r.subjectName || '—',
        ca:    r.ca,
        exam:  r.exam,
        total: r.total,
        grade: r.grade,
        remark: r.remark,
      })),
    }],
    term,
    session,
  });
}
