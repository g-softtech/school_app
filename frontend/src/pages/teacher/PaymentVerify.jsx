/**
 * PaymentVerify.jsx
 * Handles the Paystack callback redirect.
 * URL: /payment/verify?reference=xxx&trxref=xxx
 * Calls backend to verify + mark payment as paid, then redirects to parent portal.
 */
import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { FiCheckCircle, FiAlertCircle, FiLoader } from 'react-icons/fi';
import api from '../services/api';

export default function PaymentVerify() {
  const [params]   = useSearchParams();
  const navigate   = useNavigate();
  const [status,   setStatus]  = useState('verifying'); // verifying | success | failed
  const [message,  setMessage] = useState('');

  useEffect(() => {
    const reference = params.get('reference') || params.get('trxref');
    if (!reference) { setStatus('failed'); setMessage('No payment reference found.'); return; }

    api.get(`/payments/verify/${reference}`)
      .then((res) => {
        if (res.data.success) {
          setStatus('success');
          setMessage(res.data.message || 'Payment confirmed successfully!');
          // Redirect to parent payments after 3 seconds
          setTimeout(() => navigate('/parent/payments', { replace: true }), 3000);
        } else {
          setStatus('failed');
          setMessage(res.data.message || 'Payment could not be verified.');
        }
      })
      .catch((err) => {
        setStatus('failed');
        setMessage(err.response?.data?.message || 'Verification failed. Please contact support.');
      });
  }, [params, navigate]);

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-xl p-10 max-w-md w-full text-center space-y-5">
        {status === 'verifying' && (
          <>
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
              <FiLoader className="text-blue-500 animate-spin" size={32} />
            </div>
            <h2 className="text-xl font-bold text-secondary-800">Verifying Payment…</h2>
            <p className="text-secondary-500 text-sm">Please wait while we confirm your payment with Paystack.</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <FiCheckCircle className="text-green-600" size={32} />
            </div>
            <h2 className="text-xl font-bold text-secondary-800">Payment Confirmed!</h2>
            <p className="text-secondary-500 text-sm">{message}</p>
            <p className="text-xs text-secondary-400">Redirecting you to your payments page…</p>
            <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-500 rounded-full animate-spin mx-auto" />
          </>
        )}

        {status === 'failed' && (
          <>
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto">
              <FiAlertCircle className="text-red-500" size={32} />
            </div>
            <h2 className="text-xl font-bold text-secondary-800">Verification Failed</h2>
            <p className="text-secondary-500 text-sm">{message}</p>
            <button onClick={() => navigate('/parent/payments', { replace: true })} className="btn-primary mx-auto">
              Go to Payments
            </button>
          </>
        )}
      </div>
    </div>
  );
}
