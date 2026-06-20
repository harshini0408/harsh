import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../api/client';

export default function ScanLanding() {
  const { qrToken } = useParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('loading'); // loading, occupied, creating, error
  const [error, setError] = useState('');

  useEffect(() => {
    checkTable();
  }, [qrToken]);

  const checkTable = async () => {
    try {
      const result = await api.get(`/tables/${qrToken}/status`);
      if (result.occupied) {
        setStatus('occupied');
      } else {
        // Open a session
        setStatus('creating');
        try {
          const session = await api.post(`/tables/${qrToken}/session`);
          // Store session info
          sessionStorage.setItem('selfOrderSession', JSON.stringify(session));
          navigate(`/order/${qrToken}/menu`);
        } catch (err) {
          if (err.status === 409) {
            setStatus('occupied');
          } else {
            setError(err.message);
            setStatus('error');
          }
        }
      }
    } catch (err) {
      setError(err.message || 'Failed to check table status');
      setStatus('error');
    }
  };

  if (status === 'loading' || status === 'creating') {
    return (
      <div style={styles.container}>
        <div className="animate-bounce-in" style={styles.card}>
          <div className="spinner spinner-lg" style={{ margin: '0 auto' }}></div>
          <p className="text-secondary mt-4">
            {status === 'loading' ? 'Checking table...' : 'Setting up your session...'}
          </p>
        </div>
      </div>
    );
  }

  if (status === 'occupied') {
    return (
      <div style={styles.container}>
        <div className="animate-bounce-in" style={styles.card}>
          <div style={styles.iconBlock}>
            <span style={{ fontSize: 48 }}>🚫</span>
          </div>
          <h1 className="text-2xl font-bold" style={{ marginTop: 'var(--space-6)' }}>
            Table Already Occupied
          </h1>
          <p className="text-secondary" style={{ marginTop: 'var(--space-3)', maxWidth: 300 }}>
            This table currently has an active session. Please ask the staff for assistance.
          </p>
          <button
            className="btn btn-ghost btn-lg mt-6"
            onClick={() => window.location.reload()}
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div className="animate-bounce-in" style={styles.card}>
        <div style={styles.iconBlock}>
          <span style={{ fontSize: 48 }}>⚠️</span>
        </div>
        <h1 className="text-2xl font-bold mt-6">Something went wrong</h1>
        <p className="text-secondary mt-4">{error}</p>
        <button
          className="btn btn-primary btn-lg mt-6"
          onClick={() => { setStatus('loading'); checkTable(); }}
        >
          Retry
        </button>
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #0a0e1a, #1a1a2e)',
    padding: 'var(--space-6)',
    textAlign: 'center',
  },
  card: {
    background: 'var(--bg-card)',
    backdropFilter: 'blur(20px)',
    border: '1px solid var(--border-color)',
    borderRadius: 'var(--radius-xl)',
    padding: 'var(--space-12) var(--space-8)',
    maxWidth: 400,
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  iconBlock: {
    width: 100, height: 100, borderRadius: '50%',
    background: 'rgba(244, 63, 94, 0.1)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
};
