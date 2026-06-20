import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../../api/client';
import { KITCHEN_STATUS_LABELS, KITCHEN_STATUS_COLORS } from '../../utils/helpers';

export default function OrderStatus() {
  const { orderId } = useParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadOrder();
    // Poll every 5 seconds for status updates
    const interval = setInterval(loadOrder, 5000);
    return () => clearInterval(interval);
  }, [orderId]);

  const loadOrder = async () => {
    try {
      const data = await api.get(`/orders/${orderId}`);
      setOrder(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <div className="loading-overlay"><div className="spinner spinner-lg"></div></div>
      </div>
    );
  }

  if (!order) {
    return (
      <div style={styles.container}>
        <div style={styles.center}>
          <h2>Order not found</h2>
        </div>
      </div>
    );
  }

  const allCompleted = order.items.every(i => i.kitchen_status === 'completed');

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 className="text-lg font-bold">Order #{order.order_number}</h1>
        <span className={`badge badge-${order.status === 'paid' ? 'success' : 'primary'}`}>
          {order.status === 'paid' ? 'Paid' : order.status === 'sent_to_kitchen' ? 'In Kitchen' : order.status}
        </span>
      </div>

      <div style={styles.content}>
        {/* Status Banner */}
        <div className="card animate-fade-in" style={{
          background: allCompleted
            ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(16, 185, 129, 0.05))'
            : 'linear-gradient(135deg, rgba(59, 130, 246, 0.15), rgba(59, 130, 246, 0.05))',
          textAlign: 'center',
          padding: 'var(--space-8)',
        }}>
          <span style={{ fontSize: 48 }}>{allCompleted ? '✅' : '👨‍🍳'}</span>
          <h2 className="text-xl font-bold mt-4">
            {allCompleted ? 'Your order is ready!' : 'Your order is being prepared'}
          </h2>
          <p className="text-secondary mt-4">
            {allCompleted ? 'Please collect your order from the counter.' : 'We\'ll update you as each item is ready.'}
          </p>
        </div>

        {/* Items Progress */}
        <div className="mt-6">
          <h3 className="font-semibold mb-4">Order Items</h3>
          {order.items.map(item => (
            <div key={item.id} className="card mb-3" style={{
              padding: 'var(--space-4)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <div className="flex items-center gap-3">
                <span className="text-lg">{item.kitchen_status === 'completed' ? '✅' : item.kitchen_status === 'preparing' ? '🔥' : '⏳'}</span>
                <div>
                  <h4 className="font-medium text-sm">{item.product_name}</h4>
                  <p className="text-muted text-xs">Qty: {item.quantity}</p>
                </div>
              </div>
              <span className={`badge badge-${KITCHEN_STATUS_COLORS[item.kitchen_status]}`}>
                {KITCHEN_STATUS_LABELS[item.kitchen_status]}
              </span>
            </div>
          ))}
        </div>

        {/* Loyalty credits earned */}
        {order.status === 'paid' && order.loyalty_credits_earned > 0 && (
          <div className="card mt-6 animate-bounce-in" style={{
            background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.15), rgba(245, 158, 11, 0.05))',
            textAlign: 'center',
          }}>
            <span style={{ fontSize: 32 }}>⭐</span>
            <h3 className="font-bold mt-4">
              You earned {order.loyalty_credits_earned} loyalty credit{order.loyalty_credits_earned > 1 ? 's' : ''}!
            </h3>
            <p className="text-secondary text-sm mt-4">Keep earning to redeem free drinks!</p>
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
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    background: 'var(--bg-glass)', backdropFilter: 'blur(20px)',
  },
  content: { padding: 'var(--space-5)' },
  center: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    minHeight: '70vh',
  },
};
