import React from 'react';
import { formatCurrency, formatDate } from '../../utils/helpers';

const PrintableReceipt = ({ receipt }) => {
  if (!receipt) return null;

  return (
    <div className="receipt-container" style={{ padding: '32px', maxWidth: '480px', margin: '0 auto', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ textAlign: 'center', borderBottom: '2px solid #C9A227', paddingBottom: '12px', marginBottom: '16px' }}>
        <div style={{ fontSize: '22px', fontWeight: '800', color: '#1F2937' }}>SmartSchool</div>
        <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>Official Payment Receipt</div>
      </div>
      
      <div style={{ textAlign: 'center', marginBottom: '12px' }}>
        <span style={{ display: 'inline-block', background: '#C9A227', color: 'white', padding: '3px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: '600' }}>
          ✓ PAYMENT CONFIRMED
        </span>
      </div>
      
      <div style={{ fontSize: '28px', fontWeight: '800', color: '#15803d', textAlign: 'center', margin: '20px 0' }}>
        {formatCurrency(receipt.summary?.totalPaid || receipt.amount || 0)}
      </div>
      
      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '16px' }}>
        <tbody>
          <tr><td style={tdStyleLeft}>Receipt No.</td><td style={tdStyleRight}>{receipt.receiptNo || receipt.receiptNumber || '—'}</td></tr>
          <tr><td style={tdStyleLeft}>Student</td><td style={tdStyleRight}>{receipt.student?.fullName || receipt.studentName || '—'}</td></tr>
          {(receipt.student?.admissionNo || receipt.admissionNumber) && <tr><td style={tdStyleLeft}>Adm. No.</td><td style={tdStyleRight}>{receipt.student?.admissionNo || receipt.admissionNumber}</td></tr>}
          <tr><td style={tdStyleLeft}>Class</td><td style={tdStyleRight}>{receipt.class?.name || '—'}</td></tr>
          <tr><td style={tdStyleLeft}>Term</td><td style={{ ...tdStyleRight, textTransform: 'capitalize' }}>{receipt.term?.term || receipt.term ? `${receipt.term?.term || receipt.term} Term` : '—'}</td></tr>
          <tr><td style={tdStyleLeft}>Session</td><td style={tdStyleRight}>{receipt.term?.session || receipt.session || '—'}</td></tr>
          <tr><td style={tdStyleLeft}>Method</td><td style={{ ...tdStyleRight, textTransform: 'capitalize' }}>{(receipt.method || receipt.paymentMethod || '').replace('_',' ') || '—'}</td></tr>
          <tr><td style={tdStyleLeft}>Date Paid</td><td style={tdStyleRight}>{receipt.createdAt || receipt.paidAt ? formatDate(receipt.createdAt || receipt.paidAt) : '—'}</td></tr>
        </tbody>
      </table>

      {receipt.items && receipt.items.length > 0 && (
        <div style={{ marginTop: '24px' }}>
          <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#4b5563', borderBottom: '1px solid #e5e7eb', paddingBottom: '4px', marginBottom: '8px' }}>Allocations</div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              {receipt.allocations?.map((alloc, idx) => {
                const item = receipt.items.find(i => i.itemId === alloc.itemId) || { name: 'Fee Item' };
                return (
                  <tr key={idx}>
                    <td style={{ ...tdStyleLeft, padding: '4px 0' }}>{item.name}</td>
                    <td style={{ ...tdStyleRight, padding: '4px 0' }}>{formatCurrency(alloc.amount)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      
      {receipt.summary && (
        <div style={{ marginTop: '20px', padding: '12px', background: '#f9fafb', borderRadius: '8px', fontSize: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span style={{ color: '#6b7280' }}>Total Billed:</span>
            <span style={{ fontWeight: '600' }}>{formatCurrency(receipt.summary.totalAmount)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span style={{ color: '#6b7280' }}>Balance Before:</span>
            <span style={{ fontWeight: '600' }}>{formatCurrency(receipt.summary.balanceBefore)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span style={{ color: '#6b7280' }}>Payment:</span>
            <span style={{ fontWeight: '600', color: '#15803d' }}>{formatCurrency(receipt.summary.totalPaid)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '4px', borderTop: '1px solid #e5e7eb' }}>
            <span style={{ color: '#6b7280', fontWeight: 'bold' }}>Balance After:</span>
            <span style={{ fontWeight: 'bold', color: receipt.summary.balanceAfter > 0 ? '#ef4444' : '#15803d' }}>{formatCurrency(receipt.summary.balanceAfter)}</span>
          </div>
        </div>
      )}
      
      <div style={{ textAlign: 'center', fontSize: '11px', color: '#9ca3af', marginTop: '20px', borderTop: '1px solid #e5e7eb', paddingTop: '12px' }}>
        <p>Thank you for your payment. Keep this receipt for your records.</p>
        <p>SmartSchool Management System</p>
        {receipt.snapshotHash && <p style={{ fontSize: '9px', marginTop: '4px', opacity: 0.5 }}>Hash: {receipt.snapshotHash.substring(0, 16)}...</p>}
      </div>
    </div>
  );
};

const tdStyleLeft = {
  padding: '8px 4px',
  borderBottom: '1px solid #f3f4f6',
  fontSize: '13px',
  color: '#6b7280'
};

const tdStyleRight = {
  padding: '8px 4px',
  borderBottom: '1px solid #f3f4f6',
  fontSize: '13px',
  fontWeight: '600',
  textAlign: 'right'
};

export default PrintableReceipt;
