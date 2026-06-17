import { renderToString } from 'react-dom/server';
import ReportCard from '../components/common/ReportCard';

export const printReportCards = (cardsData = [], title = 'Print Report Cards') => {
  const win = window.open('', '_blank');
  if (!win) {
    alert('Please allow popups to print report cards.');
    return;
  }
  
  // Grab stylesheets
  const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
    .map(s => s.outerHTML)
    .join('\n');

  // Render each report card to HTML string
  const htmlContent = cardsData.map((data, index) => {
    const componentHtml = renderToString(
      <ReportCard 
        student={data.student}
        results={data.results}
        summary={data.summary}
        term={data.term}
        session={data.session}
        loading={false}
      />
    );
    
    // Add page break between cards
    return `
      <div class="print-page ${index > 0 ? 'page-break' : ''}">
        ${componentHtml}
      </div>
    `;
  }).join('');

  win.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>${title}</title>
        ${styles}
        <style>
          @media print {
            body { background: white; margin: 0; padding: 0; }
            .page-break { page-break-before: always; }
            .no-print { display: none !important; }
            .print-page { padding: 0; }
          }
          body { background: #f9fafb; padding: 20px; font-family: Inter, sans-serif; }
          .print-container { max-width: 900px; margin: 0 auto; }
          .print-page { margin-bottom: 40px; }
        </style>
      </head>
      <body>
        <div class="no-print" style="text-align: center; margin-bottom: 20px;">
          <button onclick="window.print()" style="padding: 10px 20px; background: #C9A227; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: bold;">
            🖨️ Print / Save PDF
          </button>
        </div>
        <div class="print-container">
          ${htmlContent}
        </div>
      </body>
    </html>
  `);
  win.document.close();
  
  win.onload = () => {
    win.focus();
    // Auto print
    setTimeout(() => win.print(), 500);
  };
};
