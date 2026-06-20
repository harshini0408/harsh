import { useParams, useNavigate } from 'react-router-dom';
import { useCart } from '../../contexts/CartContext';
import { formatCurrency } from '../../utils/helpers';

export default function Cart() {
  const { qrToken } = useParams();
  const navigate = useNavigate();
  const { items, updateQuantity, removeItem, subtotal, taxTotal, total, itemCount } = useCart();

  if (items.length === 0) {
    return (
      <div style={styles.container}>
        <div style={styles.empty} className="animate-fade-in">
          <span style={{ fontSize: 64 }}>🛒</span>
          <h2 className="text-xl font-bold mt-6">Your cart is empty</h2>
          <p className="text-secondary mt-4">Add some items from the menu!</p>
          <button
            className="btn btn-primary btn-lg mt-6"
            onClick={() => navigate(`/order/${qrToken}/menu`)}
          >
            Browse Menu
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/order/${qrToken}/menu`)}>
          ← Back
        </button>
        <h1 className="text-lg font-bold">Your Cart</h1>
        <span className="badge badge-primary">{itemCount}</span>
      </div>

      {/* Items */}
      <div style={styles.items}>
        {items.map(item => (
          <div key={item.product_id} className="card" style={styles.cartItem}>
            <div className="flex items-center gap-3" style={{ flex: 1 }}>
              <div style={{
                width: 48, height: 48, borderRadius: 'var(--radius-md)',
                background: 'linear-gradient(135deg, var(--color-primary), var(--color-secondary))',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 20, flexShrink: 0,
              }}>☕</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h3 className="font-semibold text-sm truncate">{item.name}</h3>
                <p className="text-accent text-sm">{formatCurrency(item.price)}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="qty-stepper">
                <button onClick={() => updateQuantity(item.product_id, item.quantity - 1)}>−</button>
                <div className="qty-value">{item.quantity}</div>
                <button onClick={() => updateQuantity(item.product_id, item.quantity + 1)}>+</button>
              </div>
              <span className="font-bold text-sm" style={{ minWidth: 70, textAlign: 'right' }}>
                {formatCurrency(item.price * item.quantity)}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Summary */}
      <div className="card" style={styles.summary}>
        <div className="flex justify-between mb-2">
          <span className="text-secondary">Subtotal</span>
          <span>{formatCurrency(subtotal)}</span>
        </div>
        <div className="flex justify-between mb-4">
          <span className="text-secondary">Tax</span>
          <span>{formatCurrency(taxTotal)}</span>
        </div>
        <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: 'var(--space-3)' }}
          className="flex justify-between">
          <span className="font-bold text-lg">Total</span>
          <span className="font-bold text-lg text-accent">{formatCurrency(total)}</span>
        </div>
      </div>

      <div style={{ padding: '0 var(--space-5) var(--space-8)' }}>
        <button
          className="btn btn-success btn-xl btn-block"
          onClick={() => navigate(`/order/${qrToken}/checkout`)}
        >
          Proceed to Checkout
        </button>
      </div>
    </div>
  );
}

const styles = {
  container: { minHeight: '100vh', background: 'var(--bg-primary)' },
  header: {
    padding: 'var(--space-4) var(--space-5)',
    borderBottom: '1px solid var(--border-color)',
    background: 'var(--bg-glass)',
    backdropFilter: 'blur(20px)',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    position: 'sticky', top: 0, zIndex: 10,
  },
  items: {
    padding: 'var(--space-4) var(--space-5)',
    display: 'flex', flexDirection: 'column', gap: 'var(--space-3)',
  },
  cartItem: {
    padding: 'var(--space-3) var(--space-4)',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    gap: 'var(--space-3)', flexWrap: 'wrap',
  },
  empty: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', minHeight: '70vh', textAlign: 'center',
    padding: 'var(--space-8)',
  },
  summary: {
    margin: '0 var(--space-5) var(--space-4)',
  },
};
