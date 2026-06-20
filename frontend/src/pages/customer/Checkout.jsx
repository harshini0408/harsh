import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCart } from '../../contexts/CartContext';
import { formatCurrency } from '../../utils/helpers';
import api from '../../api/client';

export default function Checkout() {
  const { qrToken } = useParams();
  const navigate = useNavigate();
  const { items, total, clear } = useCart();
  const [phone, setPhone] = useState('');
  const [customer, setCustomer] = useState(null);
  const [name, setName] = useState('');
  const [step, setStep] = useState('phone'); // phone, confirm
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const lookupCustomer = async () => {
    if (phone.length < 10) return setError('Enter a valid phone number');
    setLoading(true);
    setError('');
    try {
      const result = await api.post('/auth/customer/lookup', { mobile_number: phone });
      if (result) {
        setCustomer(result);
        setStep('confirm');
      } else {
        // New customer
        setStep('confirm');
        setCustomer(null);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const placeOrder = async () => {
    setLoading(true);
    setError('');
    try {
      // Register/find customer
      let customerId = customer?.id;
      if (!customerId) {
        const reg = await api.post('/auth/customer/register', {
          name: name || 'Guest',
          mobile_number: phone,
        });
        customerId = reg.id;
      }

      // Get session
      const session = JSON.parse(sessionStorage.getItem('selfOrderSession') || '{}');

      // Create order
      const order = await api.post('/orders', {
        source: 'self_order',
        table_id: session.table_id || null,
        table_session_id: session.session_id || null,
        customer_id: customerId,
        items: items.map(i => ({
          product_id: i.product_id,
          quantity: i.quantity,
        })),
      });

      // Auto send to kitchen
      await api.post(`/orders/${order.id}/send-to-kitchen`);

      clear();
      navigate(`/order-status/${order.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/order/${qrToken}/cart`)}>
          ← Back
        </button>
        <h1 className="text-lg font-bold">Checkout</h1>
        <div></div>
      </div>

      <div style={styles.content}>
        {step === 'phone' && (
          <div className="animate-fade-in">
            <div className="card" style={{ padding: 'var(--space-8)' }}>
              <h2 className="text-xl font-bold mb-2">Enter Your Phone</h2>
              <p className="text-secondary text-sm mb-6">
                We'll use this to track your order and loyalty credits
              </p>

              <div className="input-group mb-4">
                <label>Phone Number</label>
                <input
                  type="tel"
                  className="input"
                  placeholder="Enter 10-digit number"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  maxLength={15}
                />
              </div>

              {error && <p className="text-danger text-sm mb-4">{error}</p>}

              <button
                className="btn btn-primary btn-lg btn-block"
                onClick={lookupCustomer}
                disabled={loading || phone.length < 10}
              >
                {loading ? 'Looking up...' : 'Continue'}
              </button>
            </div>
          </div>
        )}

        {step === 'confirm' && (
          <div className="animate-fade-in">
            {customer ? (
              <div className="card mb-4">
                <div className="flex items-center gap-3">
                  <div style={{
                    width: 48, height: 48, borderRadius: '50%',
                    background: 'linear-gradient(135deg, var(--color-success), #059669)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'white', fontWeight: 700,
                  }}>
                    {customer.name[0]?.toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-semibold">Welcome back, {customer.name}!</h3>
                    <p className="text-secondary text-sm">{customer.mobile_number}</p>
                  </div>
                </div>
                {!customer.is_guest && (
                  <div className="flex items-center gap-2 mt-4" style={{
                    padding: 'var(--space-3)', background: 'rgba(245, 158, 11, 0.1)',
                    borderRadius: 'var(--radius-md)',
                  }}>
                    <span>⭐</span>
                    <span className="text-sm font-medium">
                      {customer.loyalty_credits} loyalty credits
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div className="card mb-4">
                <h3 className="font-semibold mb-4">New Customer</h3>
                <div className="input-group">
                  <label>Your Name</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="Enter your name"
                    value={name}
                    onChange={e => setName(e.target.value)}
                  />
                </div>
              </div>
            )}

            {/* Order Summary */}
            <div className="card mb-4">
              <h3 className="font-semibold mb-4">Order Summary</h3>
              {items.map(item => (
                <div key={item.product_id} className="flex justify-between mb-2">
                  <span className="text-sm">{item.quantity}× {item.name}</span>
                  <span className="text-sm">{formatCurrency(item.price * item.quantity)}</span>
                </div>
              ))}
              <div style={{ borderTop: '1px solid var(--border-color)', marginTop: 'var(--space-3)', paddingTop: 'var(--space-3)' }}
                className="flex justify-between">
                <span className="font-bold">Total</span>
                <span className="font-bold text-accent">{formatCurrency(total)}</span>
              </div>
            </div>

            {error && <p className="text-danger text-sm mb-4">{error}</p>}

            <button
              className="btn btn-success btn-xl btn-block"
              onClick={placeOrder}
              disabled={loading}
            >
              {loading ? 'Placing Order...' : 'Confirm & Send to Kitchen'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: { minHeight: '100vh', background: 'var(--bg-primary)' },
  header: {
    padding: 'var(--space-4) var(--space-5)',
    borderBottom: '1px solid var(--border-color)',
    background: 'var(--bg-glass)', backdropFilter: 'blur(20px)',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    position: 'sticky', top: 0, zIndex: 10,
  },
  content: { padding: 'var(--space-5)' },
};
