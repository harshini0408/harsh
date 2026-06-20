import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useCart } from '../../contexts/CartContext';
import { useToast } from '../../contexts/ToastContext';
import { formatCurrency, ORDER_STATUS_LABELS } from '../../utils/helpers';
import api from '../../api/client';

export default function CashierLayout() {
  const { user, logout } = useAuth();
  const toast = useToast();
  const { items, addItem, removeItem, updateQuantity, clear, subtotal, taxTotal, total, itemCount } = useCart();

  const [view, setView] = useState('floor'); // floor, order, payment
  const [tables, setTables] = useState([]);
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [activeCategory, setActiveCategory] = useState(null);
  const [selectedTable, setSelectedTable] = useState(null);
  const [currentOrder, setCurrentOrder] = useState(null);
  const [customer, setCustomer] = useState(null);
  const [phoneSearch, setPhoneSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState(null);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [amountReceived, setAmountReceived] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [tablesData, catsData, prodsData, pmData] = await Promise.all([
        api.get('/cashier/tables'),
        api.get('/admin/categories'),
        api.get('/admin/products'),
        api.get('/admin/payment-methods'),
      ]);
      setTables(tablesData);
      setCategories(catsData.filter(c => c.is_active));
      setProducts(prodsData.filter(p => p.is_active));
      setPaymentMethods(pmData.filter(pm => pm.is_enabled));
      if (catsData.length > 0) setActiveCategory(catsData[0].id);
    } catch (err) {
      toast.error('Failed to load data');
    }
  };

  const openTable = async (table) => {
    if (table.has_active_session) {
      setSelectedTable(table);
      setView('order');
      return;
    }
    try {
      await api.post(`/cashier/tables/${table.id}/session`);
      toast.success(`Table ${table.table_number} opened`);
      setSelectedTable({ ...table, has_active_session: true, session_opened_by: 'cashier' });
      setView('order');
      loadData();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const lookupCustomer = async () => {
    if (phoneSearch.length < 10) return;
    try {
      const result = await api.post('/auth/customer/lookup', { mobile_number: phoneSearch });
      if (result) {
        setCustomer(result);
        toast.success(`Customer found: ${result.name}`);
      } else {
        // Create guest
        const reg = await api.post('/auth/customer/register', {
          name: 'Walk-in Customer',
          mobile_number: phoneSearch,
        });
        setCustomer(reg);
        toast.info('New customer created');
      }
    } catch (err) {
      toast.error(err.message);
    }
  };

  const sendToKitchen = async () => {
    if (items.length === 0) return toast.error('Add items first');
    setLoading(true);
    try {
      // Create order
      const order = await api.post('/orders', {
        source: 'cashier',
        table_id: selectedTable?.id,
        table_session_id: selectedTable?.session_id,
        customer_id: customer?.id,
        items: items.map(i => ({ product_id: i.product_id, quantity: i.quantity })),
      });

      // Send to kitchen
      const sent = await api.post(`/orders/${order.id}/send-to-kitchen`);
      setCurrentOrder(sent);
      toast.success(`Order ${sent.order_number} sent to kitchen!`);
      setShowConfirm(false);
      setView('payment');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const redeemLoyalty = async () => {
    if (!currentOrder || !customer) return;
    try {
      const result = await api.post(`/orders/${currentOrder.id}/redeem-loyalty?customer_id=${customer.id}`);
      toast.success(result.message);
      setCustomer(prev => ({ ...prev, loyalty_credits: result.new_balance }));
      // Reload order
      const updated = await api.get(`/orders/${currentOrder.id}`);
      setCurrentOrder(updated);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const processPayment = async () => {
    if (!currentOrder || !paymentMethod) return;
    setLoading(true);
    try {
      const result = await api.post(`/orders/${currentOrder.id}/pay`, {
        payment_method_id: paymentMethod.id,
        amount: currentOrder.total,
        amount_received: paymentMethod.type === 'cash' ? parseFloat(amountReceived) || currentOrder.total : null,
      });

      toast.success(`Payment successful! ${result.loyalty_credits_earned > 0 ? `Customer earned ${result.loyalty_credits_earned} credits` : ''}`);
      clear();
      setCurrentOrder(null);
      setCustomer(null);
      setSelectedTable(null);
      setPhoneSearch('');
      setView('floor');
      loadData();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const backToFloor = () => {
    clear();
    setCurrentOrder(null);
    setCustomer(null);
    setSelectedTable(null);
    setPhoneSearch('');
    setView('floor');
  };

  const filteredProducts = activeCategory
    ? products.filter(p => p.category_id === activeCategory)
    : products;

  const changeDue = paymentMethod?.type === 'cash' && amountReceived
    ? Math.max(0, parseFloat(amountReceived) - (currentOrder?.total || 0))
    : 0;

  return (
    <div style={styles.root}>
      {/* Top Bar */}
      <div style={styles.topBar}>
        <div className="flex items-center gap-3">
          <span style={{ fontSize: 24 }}>☕</span>
          <h1 className="text-lg font-bold">Cafe POS</h1>
          {selectedTable && (
            <span className="badge badge-primary">Table {selectedTable.table_number}</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-secondary text-sm">{user?.name}</span>
          <span className="badge badge-info">{user?.role}</span>
          <button className="btn btn-ghost btn-sm" onClick={() => { logout(); window.location.href = '/login'; }}>
            Logout
          </button>
        </div>
      </div>

      {/* Floor View */}
      {view === 'floor' && (
        <div style={styles.floorView} className="animate-fade-in">
          <h2 className="text-xl font-bold mb-6">Floor View</h2>
          <div style={styles.tableGrid}>
            {tables.map(table => (
              <div
                key={table.id}
                className="card card-interactive"
                style={{
                  ...styles.tableCard,
                  borderColor: table.has_active_session
                    ? (table.session_opened_by === 'cashier' ? 'var(--color-primary)' : 'var(--color-secondary)')
                    : 'var(--color-success)',
                }}
                onClick={() => openTable(table)}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold">T{table.table_number}</span>
                  <span className={`status-dot ${table.has_active_session ? (table.session_opened_by === 'cashier' ? 'cashier' : 'customer') : 'free'}`}></span>
                </div>
                <p className="text-muted text-xs">{table.seats} seats</p>
                <p className="text-xs mt-4" style={{
                  color: table.has_active_session ? 'var(--color-warning)' : 'var(--color-success)',
                }}>
                  {table.has_active_session
                    ? `${table.session_opened_by === 'cashier' ? '👤 Staff' : '📱 QR'}`
                    : '✓ Available'}
                </p>
              </div>
            ))}
          </div>

          {/* Legend */}
          <div className="flex gap-6 mt-6">
            <div className="flex items-center gap-2 text-sm">
              <span className="status-dot free"></span> Available
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="status-dot cashier"></span> Staff Opened
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="status-dot customer"></span> QR Customer
            </div>
          </div>
        </div>
      )}

      {/* Order Builder */}
      {view === 'order' && (
        <div style={styles.orderView} className="animate-fade-in">
          {/* Left: Product Grid */}
          <div style={styles.productPanel}>
            {/* Category tabs */}
            <div style={styles.catTabs}>
              {categories.map(cat => (
                <button
                  key={cat.id}
                  className={`btn btn-sm ${activeCategory === cat.id ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => setActiveCategory(cat.id)}
                  style={{ borderRadius: 'var(--radius-full)', flexShrink: 0 }}
                >
                  {cat.name}
                </button>
              ))}
            </div>

            <div style={styles.prodGrid}>
              {filteredProducts.map(prod => (
                <div
                  key={prod.id}
                  className="card card-interactive"
                  style={styles.prodCard}
                  onClick={() => addItem({
                    product_id: prod.id, name: prod.name,
                    price: prod.price, tax_percent: prod.tax_percent,
                  })}
                >
                  <div style={{
                    width: '100%', height: 60, borderRadius: 'var(--radius-sm)',
                    background: `linear-gradient(135deg, ${categories.find(c => c.id === prod.category_id)?.color_hex || '#3b82f6'}40, transparent)`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    marginBottom: 'var(--space-2)', fontSize: 24,
                  }}>☕</div>
                  <h4 className="font-medium text-xs truncate">{prod.name}</h4>
                  <p className="text-accent font-bold text-sm">{formatCurrency(prod.price)}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Cart Panel */}
          <div style={styles.cartPanel}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold">Current Order</h3>
              <button className="btn btn-ghost btn-sm" onClick={backToFloor}>← Floor</button>
            </div>

            {/* Customer Lookup */}
            <div className="mb-4">
              <div className="flex gap-2">
                <input
                  type="tel"
                  className="input"
                  placeholder="Customer phone"
                  value={phoneSearch}
                  onChange={e => setPhoneSearch(e.target.value)}
                  style={{ flex: 1 }}
                />
                <button className="btn btn-primary btn-sm" onClick={lookupCustomer}>Find</button>
              </div>
              {customer && (
                <div className="flex items-center gap-2 mt-2" style={{
                  padding: 'var(--space-2) var(--space-3)',
                  background: 'rgba(16, 185, 129, 0.1)',
                  borderRadius: 'var(--radius-sm)',
                }}>
                  <span className="text-xs font-medium">{customer.name}</span>
                  {!customer.is_guest && (
                    <span className="badge badge-warning" style={{ fontSize: '0.65rem' }}>
                      ⭐ {customer.loyalty_credits}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Cart Items */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {items.length === 0 ? (
                <div className="text-center text-muted" style={{ padding: 'var(--space-8)' }}>
                  <p>Tap products to add</p>
                </div>
              ) : (
                items.map(item => (
                  <div key={item.product_id} style={styles.cartItem}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p className="text-sm font-medium truncate">{item.name}</p>
                      <p className="text-xs text-muted">{formatCurrency(item.price)} each</p>
                    </div>
                    <div className="qty-stepper">
                      <button onClick={() => updateQuantity(item.product_id, item.quantity - 1)}>−</button>
                      <div className="qty-value">{item.quantity}</div>
                      <button onClick={() => updateQuantity(item.product_id, item.quantity + 1)}>+</button>
                    </div>
                    <span className="text-sm font-bold" style={{ minWidth: 60, textAlign: 'right' }}>
                      {formatCurrency(item.price * item.quantity)}
                    </span>
                  </div>
                ))
              )}
            </div>

            {/* Totals */}
            <div style={styles.totals}>
              <div className="flex justify-between text-sm text-secondary">
                <span>Subtotal</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm text-secondary">
                <span>Tax</span>
                <span>{formatCurrency(taxTotal)}</span>
              </div>
              <div className="flex justify-between font-bold text-lg" style={{ marginTop: 'var(--space-2)' }}>
                <span>Total</span>
                <span className="text-accent">{formatCurrency(total)}</span>
              </div>
            </div>

            <button
              className="btn btn-success btn-lg btn-block"
              onClick={() => setShowConfirm(true)}
              disabled={items.length === 0}
            >
              🍳 Send to Kitchen ({itemCount} items)
            </button>
          </div>
        </div>
      )}

      {/* Payment View */}
      {view === 'payment' && currentOrder && (
        <div style={styles.paymentView} className="animate-fade-in">
          <div style={{ maxWidth: 500, margin: '0 auto' }}>
            <div className="card mb-4">
              <h2 className="text-xl font-bold mb-4">Payment — {currentOrder.order_number}</h2>
              <div className="flex justify-between mb-2">
                <span className="text-secondary">Order Total</span>
                <span className="font-bold text-xl text-accent">{formatCurrency(currentOrder.total)}</span>
              </div>
              {customer && !customer.is_guest && customer.loyalty_credits >= 50 && (
                <button className="btn btn-warning btn-block mt-4" onClick={redeemLoyalty}>
                  ⭐ Redeem 50 Credits for Free Drink
                </button>
              )}
            </div>

            <div className="card mb-4">
              <h3 className="font-semibold mb-4">Payment Method</h3>
              <div className="flex gap-3">
                {paymentMethods.map(pm => (
                  <button
                    key={pm.id}
                    className={`btn ${paymentMethod?.id === pm.id ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={() => setPaymentMethod(pm)}
                    style={{ flex: 1 }}
                  >
                    {pm.type === 'cash' ? '💵' : pm.type === 'upi' ? '📱' : '💳'} {pm.display_name}
                  </button>
                ))}
              </div>

              {paymentMethod?.type === 'cash' && (
                <div className="mt-4">
                  <div className="input-group">
                    <label>Amount Received</label>
                    <input
                      type="number"
                      className="input"
                      value={amountReceived}
                      onChange={e => setAmountReceived(e.target.value)}
                      placeholder={`Min: ${formatCurrency(currentOrder.total)}`}
                    />
                  </div>
                  {changeDue > 0 && (
                    <div className="flex justify-between mt-4 text-lg">
                      <span className="font-semibold">Change Due</span>
                      <span className="font-bold text-success">{formatCurrency(changeDue)}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            <button
              className="btn btn-success btn-xl btn-block"
              onClick={processPayment}
              disabled={!paymentMethod || loading}
            >
              {loading ? 'Processing...' : '✓ Complete Payment'}
            </button>
            <button className="btn btn-ghost btn-block mt-4" onClick={backToFloor}>
              Back to Floor
            </button>
          </div>
        </div>
      )}

      {/* Confirm Dialog */}
      {showConfirm && (
        <div className="modal-backdrop" onClick={() => setShowConfirm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">⚠️ Send to Kitchen?</h3>
              <button className="modal-close" onClick={() => setShowConfirm(false)}>×</button>
            </div>
            <div className="modal-body">
              <p>You are about to send <strong>{itemCount} items</strong> to the kitchen.</p>
              <p className="text-warning text-sm font-semibold mt-4">
                ⚠️ This cannot be undone. Stock will be deducted immediately.
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowConfirm(false)}>Cancel</button>
              <button className="btn btn-success" onClick={sendToKitchen} disabled={loading}>
                {loading ? 'Sending...' : 'Confirm & Send'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  root: { minHeight: '100vh', background: 'var(--bg-primary)', display: 'flex', flexDirection: 'column' },
  topBar: {
    padding: 'var(--space-3) var(--space-5)',
    borderBottom: '1px solid var(--border-color)',
    background: 'var(--bg-glass)', backdropFilter: 'blur(20px)',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  },
  floorView: { padding: 'var(--space-6) var(--space-8)', flex: 1 },
  tableGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
    gap: 'var(--space-4)',
  },
  tableCard: {
    padding: 'var(--space-4)', cursor: 'pointer',
    borderWidth: 2, borderStyle: 'solid',
  },
  orderView: {
    display: 'flex', flex: 1, overflow: 'hidden',
  },
  productPanel: {
    flex: 1, display: 'flex', flexDirection: 'column',
    borderRight: '1px solid var(--border-color)',
  },
  catTabs: {
    display: 'flex', gap: 'var(--space-2)',
    padding: 'var(--space-3) var(--space-4)',
    overflowX: 'auto', borderBottom: '1px solid var(--border-color)',
  },
  prodGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
    gap: 'var(--space-3)', padding: 'var(--space-4)',
    overflowY: 'auto', flex: 1,
  },
  prodCard: { padding: 'var(--space-3)', cursor: 'pointer', textAlign: 'center' },
  cartPanel: {
    width: 360, display: 'flex', flexDirection: 'column',
    padding: 'var(--space-4)', background: 'var(--bg-secondary)',
  },
  cartItem: {
    display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
    padding: 'var(--space-3) 0',
    borderBottom: '1px solid var(--border-color)',
  },
  totals: {
    padding: 'var(--space-3) 0', marginBottom: 'var(--space-3)',
    borderTop: '1px solid var(--border-color)',
  },
  paymentView: { flex: 1, padding: 'var(--space-8)', overflowY: 'auto' },
};
