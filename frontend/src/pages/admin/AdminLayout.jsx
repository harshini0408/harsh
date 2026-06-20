import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { formatCurrency, formatDateTime } from '../../utils/helpers';
import api from '../../api/client';

const TABS = [
  { id: 'dashboard', label: 'Dashboard', icon: '📊' },
  { id: 'products', label: 'Products', icon: '🍰' },
  { id: 'categories', label: 'Categories', icon: '📂' },
  { id: 'inventory', label: 'Inventory', icon: '📦' },
  { id: 'coupons', label: 'Coupons', icon: '🎟️' },
  { id: 'promotions', label: 'Promotions', icon: '🏷️' },
  { id: 'loyalty', label: 'Loyalty', icon: '⭐' },
  { id: 'users', label: 'Users', icon: '👥' },
  { id: 'settings', label: 'Settings', icon: '⚙️' },
];

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const toast = useToast();
  const [activeTab, setActiveTab] = useState('dashboard');

  return (
    <div style={styles.root}>
      {/* Sidebar */}
      <div style={styles.sidebar}>
        <div style={styles.sidebarHeader}>
          <span style={{ fontSize: 28 }}>☕</span>
          <h2 className="font-bold text-lg">Cafe POS</h2>
          <span className="badge badge-primary" style={{ fontSize: '0.6rem' }}>Admin</span>
        </div>

        <nav style={styles.nav}>
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                ...styles.navItem,
                background: activeTab === tab.id ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                color: activeTab === tab.id ? 'var(--color-primary)' : 'var(--text-secondary)',
                borderLeft: activeTab === tab.id ? '3px solid var(--color-primary)' : '3px solid transparent',
              }}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>

        <div style={styles.sidebarFooter}>
          <div className="text-sm text-secondary truncate">{user?.name}</div>
          <button className="btn btn-ghost btn-sm" onClick={() => { logout(); window.location.href = '/login'; }}>
            Logout
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div style={styles.main}>
        {activeTab === 'dashboard' && <DashboardView toast={toast} />}
        {activeTab === 'products' && <ProductsView toast={toast} />}
        {activeTab === 'categories' && <CategoriesView toast={toast} />}
        {activeTab === 'inventory' && <InventoryView toast={toast} />}
        {activeTab === 'coupons' && <CouponsView toast={toast} />}
        {activeTab === 'promotions' && <PromotionsView toast={toast} />}
        {activeTab === 'loyalty' && <LoyaltyView toast={toast} />}
        {activeTab === 'users' && <UsersView toast={toast} />}
        {activeTab === 'settings' && <SettingsView toast={toast} />}
      </div>
    </div>
  );
}

// ===== DASHBOARD =====
function DashboardView({ toast }) {
  const [data, setData] = useState(null);

  useEffect(() => { loadDashboard(); }, []);
  const loadDashboard = async () => {
    try { setData(await api.get('/admin/dashboard')); }
    catch (e) { toast.error('Failed to load dashboard'); }
  };

  if (!data) return <div className="loading-overlay"><div className="spinner spinner-lg"></div></div>;

  return (
    <div className="animate-fade-in">
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>

      <div className="grid grid-4 gap-4 mb-6">
        {[
          { label: "Today's Revenue", value: formatCurrency(data.today_revenue), color: 'var(--color-success)' },
          { label: "Today's Orders", value: data.today_orders, color: 'var(--color-primary)' },
          { label: 'Avg Order Value', value: formatCurrency(data.avg_order_value), color: 'var(--color-secondary)' },
          { label: 'Total Orders', value: data.total_orders, color: 'var(--color-info)' },
        ].map((stat, i) => (
          <div key={i} className="card" style={{ borderLeft: `3px solid ${stat.color}` }}>
            <p className="text-secondary text-sm">{stat.label}</p>
            <p className="text-2xl font-bold mt-4" style={{ color: stat.color }}>{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-2 gap-4">
        {/* Low Stock */}
        <div className="card">
          <h3 className="font-bold mb-4">⚠️ Low Stock Alerts</h3>
          {data.low_stock_items.length === 0 ? (
            <p className="text-secondary text-sm">All items are well-stocked!</p>
          ) : (
            data.low_stock_items.map(item => (
              <div key={item.id} className="flex justify-between py-2" style={{ borderBottom: '1px solid var(--border-color)' }}>
                <span className="text-sm">{item.product_name}</span>
                <span className="badge badge-danger">{item.current_stock} left</span>
              </div>
            ))
          )}
        </div>

        {/* Recent Orders */}
        <div className="card">
          <h3 className="font-bold mb-4">Recent Orders</h3>
          {data.recent_orders.map(order => (
            <div key={order.id} className="flex justify-between py-2" style={{ borderBottom: '1px solid var(--border-color)' }}>
              <div>
                <span className="text-sm font-medium">{order.order_number}</span>
                <span className="text-xs text-muted ml-2">{order.source}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm">{formatCurrency(order.total)}</span>
                <span className={`badge badge-${order.status === 'paid' ? 'success' : order.status === 'sent_to_kitchen' ? 'warning' : 'muted'}`}>
                  {order.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ===== PRODUCTS =====
function ProductsView({ toast }) {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', category_id: '', price: '', tax_percent: '0', description: '' });

  useEffect(() => { load(); }, []);
  const load = async () => {
    const [p, c] = await Promise.all([api.get('/admin/products'), api.get('/admin/categories')]);
    setProducts(p); setCategories(c);
  };

  const save = async () => {
    try {
      await api.post('/admin/products', {
        ...form, category_id: parseInt(form.category_id),
        price: parseFloat(form.price), tax_percent: parseFloat(form.tax_percent),
      });
      toast.success('Product created');
      setShowModal(false); setForm({ name: '', category_id: '', price: '', tax_percent: '0', description: '' });
      load();
    } catch (e) { toast.error(e.message); }
  };

  return (
    <div className="animate-fade-in">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Products</h1>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Add Product</button>
      </div>

      <div className="card">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th><th>Category</th><th>Price</th><th>Tax %</th><th>Active</th><th>Loyalty</th>
            </tr>
          </thead>
          <tbody>
            {products.map(p => (
              <tr key={p.id}>
                <td className="font-medium">{p.name}</td>
                <td><span className="badge badge-info">{p.category_name}</span></td>
                <td>{formatCurrency(p.price)}</td>
                <td>{p.tax_percent}%</td>
                <td><span className={`badge badge-${p.is_active ? 'success' : 'muted'}`}>{p.is_active ? 'Yes' : 'No'}</span></td>
                <td>{p.is_loyalty_reward && <span className="badge badge-warning">⭐ Reward</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Add Product</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="input-group">
                <label>Name</label>
                <input className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="input-group">
                <label>Category</label>
                <select className="input" value={form.category_id} onChange={e => setForm({ ...form, category_id: e.target.value })}>
                  <option value="">Select</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="input-group">
                <label>Price</label>
                <input className="input" type="number" step="0.01" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} />
              </div>
              <div className="input-group">
                <label>Tax %</label>
                <input className="input" type="number" step="0.01" value={form.tax_percent} onChange={e => setForm({ ...form, tax_percent: e.target.value })} />
              </div>
              <div className="input-group">
                <label>Description</label>
                <textarea className="input" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={save}>Create Product</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ===== CATEGORIES =====
function CategoriesView({ toast }) {
  const [categories, setCategories] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', color_hex: '#3b82f6', display_order: 0 });

  useEffect(() => { load(); }, []);
  const load = async () => setCategories(await api.get('/admin/categories'));

  const save = async () => {
    try {
      await api.post('/admin/categories', { ...form, display_order: parseInt(form.display_order) });
      toast.success('Category created');
      setShowModal(false); setForm({ name: '', color_hex: '#3b82f6', display_order: 0 });
      load();
    } catch (e) { toast.error(e.message); }
  };

  return (
    <div className="animate-fade-in">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Categories</h1>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Add Category</button>
      </div>

      <div className="grid grid-3 gap-4">
        {categories.map(c => (
          <div key={c.id} className="card" style={{ borderLeft: `4px solid ${c.color_hex}` }}>
            <div className="flex items-center gap-3">
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: c.color_hex }}></div>
              <div>
                <h3 className="font-bold">{c.name}</h3>
                <p className="text-muted text-xs">Order: {c.display_order}</p>
              </div>
            </div>
            <span className={`badge badge-${c.is_active ? 'success' : 'muted'} mt-4`}>
              {c.is_active ? 'Active' : 'Inactive'}
            </span>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Add Category</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="input-group">
                <label>Name</label>
                <input className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="input-group">
                <label>Color</label>
                <input type="color" value={form.color_hex} onChange={e => setForm({ ...form, color_hex: e.target.value })} />
              </div>
              <div className="input-group">
                <label>Display Order</label>
                <input className="input" type="number" value={form.display_order} onChange={e => setForm({ ...form, display_order: e.target.value })} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={save}>Create</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ===== INVENTORY =====
function InventoryView({ toast }) {
  const [items, setItems] = useState([]);
  const [movements, setMovements] = useState([]);
  const [view, setView] = useState('items');

  useEffect(() => { load(); }, []);
  const load = async () => {
    const [i, m] = await Promise.all([api.get('/inventory/items'), api.get('/inventory/stock-movements')]);
    setItems(i); setMovements(m);
  };

  return (
    <div className="animate-fade-in">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Inventory</h1>
        <div className="flex gap-2">
          <button className={`btn btn-sm ${view === 'items' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setView('items')}>Stock Levels</button>
          <button className={`btn btn-sm ${view === 'movements' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setView('movements')}>Movements</button>
        </div>
      </div>

      {view === 'items' && (
        <div className="card">
          <table className="data-table">
            <thead>
              <tr><th>Product</th><th>SKU</th><th>Stock</th><th>Reorder Level</th><th>Status</th></tr>
            </thead>
            <tbody>
              {items.map(item => (
                <tr key={item.id}>
                  <td className="font-medium">{item.product_name}</td>
                  <td className="text-muted">{item.sku}</td>
                  <td className="font-bold">{item.current_stock}</td>
                  <td>{item.reorder_level}</td>
                  <td>
                    <span className={`badge badge-${item.is_low_stock ? 'danger' : 'success'}`}>
                      {item.is_low_stock ? '⚠️ Low' : '✓ OK'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {view === 'movements' && (
        <div className="card">
          <table className="data-table">
            <thead>
              <tr><th>Product</th><th>Type</th><th>Qty</th><th>Note</th><th>Date</th></tr>
            </thead>
            <tbody>
              {movements.map(m => (
                <tr key={m.id}>
                  <td>{m.product_name}</td>
                  <td><span className={`badge badge-${m.movement_type === 'sale_out' ? 'danger' : m.movement_type === 'purchase_in' ? 'success' : 'warning'}`}>{m.movement_type}</span></td>
                  <td className="font-bold">{m.quantity}</td>
                  <td className="text-muted text-xs">{m.note}</td>
                  <td className="text-xs">{formatDateTime(m.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ===== COUPONS =====
function CouponsView({ toast }) {
  const [coupons, setCoupons] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ code: '', discount_type: 'percent', value: '' });

  useEffect(() => { load(); }, []);
  const load = async () => setCoupons(await api.get('/admin/coupons'));

  const save = async () => {
    try {
      await api.post('/admin/coupons', { ...form, value: parseFloat(form.value) });
      toast.success('Coupon created');
      setShowModal(false); load();
    } catch (e) { toast.error(e.message); }
  };

  return (
    <div className="animate-fade-in">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Coupons</h1>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Add Coupon</button>
      </div>
      <div className="card">
        <table className="data-table">
          <thead><tr><th>Code</th><th>Type</th><th>Value</th><th>Used</th><th>Active</th></tr></thead>
          <tbody>
            {coupons.map(c => (
              <tr key={c.id}>
                <td className="font-bold">{c.code}</td>
                <td><span className="badge badge-info">{c.discount_type}</span></td>
                <td>{c.discount_type === 'percent' ? `${c.value}%` : formatCurrency(c.value)}</td>
                <td>{c.used_count}{c.max_uses ? `/${c.max_uses}` : ''}</td>
                <td><span className={`badge badge-${c.is_active ? 'success' : 'muted'}`}>{c.is_active ? 'Yes' : 'No'}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Add Coupon</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="input-group">
                <label>Code</label>
                <input className="input" value={form.code} onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })} />
              </div>
              <div className="input-group">
                <label>Discount Type</label>
                <select className="input" value={form.discount_type} onChange={e => setForm({ ...form, discount_type: e.target.value })}>
                  <option value="percent">Percentage</option>
                  <option value="fixed">Fixed Amount</option>
                </select>
              </div>
              <div className="input-group">
                <label>Value</label>
                <input className="input" type="number" value={form.value} onChange={e => setForm({ ...form, value: e.target.value })} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={save}>Create</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ===== PROMOTIONS =====
function PromotionsView({ toast }) {
  const [promos, setPromos] = useState([]);
  useEffect(() => { load(); }, []);
  const load = async () => setPromos(await api.get('/admin/promotions'));

  return (
    <div className="animate-fade-in">
      <h1 className="text-2xl font-bold mb-6">Promotions</h1>
      <div className="card">
        <table className="data-table">
          <thead><tr><th>Name</th><th>Scope</th><th>Discount</th><th>Active</th></tr></thead>
          <tbody>
            {promos.map(p => (
              <tr key={p.id}>
                <td className="font-medium">{p.name}</td>
                <td><span className="badge badge-info">{p.scope}</span></td>
                <td>{p.discount_type === 'percent' ? `${p.value}%` : formatCurrency(p.value)}</td>
                <td><span className={`badge badge-${p.is_active ? 'success' : 'muted'}`}>{p.is_active ? 'Yes' : 'No'}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
        {promos.length === 0 && <p className="text-center text-muted p-6">No promotions yet</p>}
      </div>
    </div>
  );
}

// ===== LOYALTY =====
function LoyaltyView({ toast }) {
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [ledger, setLedger] = useState([]);

  const searchCustomers = async () => {
    const result = await api.get(`/admin/customers?q=${search}`);
    setCustomers(result);
  };

  const viewLedger = async (customerId) => {
    const data = await api.get(`/customers/${customerId}/loyalty`);
    setSelectedCustomer(data);
    setLedger(data.ledger);
  };

  return (
    <div className="animate-fade-in">
      <h1 className="text-2xl font-bold mb-6">Loyalty Oversight</h1>

      <div className="flex gap-3 mb-6">
        <input className="input" placeholder="Search by name or phone" value={search} onChange={e => setSearch(e.target.value)} style={{ flex: 1 }} />
        <button className="btn btn-primary" onClick={searchCustomers}>Search</button>
      </div>

      {customers.length > 0 && !selectedCustomer && (
        <div className="card mb-4">
          <table className="data-table">
            <thead><tr><th>Name</th><th>Phone</th><th>Guest</th><th>Credits</th><th></th></tr></thead>
            <tbody>
              {customers.map(c => (
                <tr key={c.id}>
                  <td className="font-medium">{c.name}</td>
                  <td>{c.mobile_number}</td>
                  <td><span className={`badge badge-${c.is_guest ? 'warning' : 'success'}`}>{c.is_guest ? 'Guest' : 'Registered'}</span></td>
                  <td className="font-bold">{c.loyalty_credits}</td>
                  <td><button className="btn btn-ghost btn-sm" onClick={() => viewLedger(c.id)}>View →</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedCustomer && (
        <div className="animate-slide-up">
          <div className="flex items-center gap-3 mb-4">
            <button className="btn btn-ghost btn-sm" onClick={() => setSelectedCustomer(null)}>← Back</button>
            <h2 className="font-bold">{selectedCustomer.customer_name}</h2>
            <span className="badge badge-warning">⭐ {selectedCustomer.loyalty_credits} credits</span>
          </div>
          <div className="card">
            <h3 className="font-bold mb-4">Loyalty Ledger</h3>
            <table className="data-table">
              <thead><tr><th>Type</th><th>Delta</th><th>Balance After</th><th>Note</th><th>Date</th></tr></thead>
              <tbody>
                {ledger.map(entry => (
                  <tr key={entry.id}>
                    <td><span className={`badge badge-${entry.entry_type === 'earn' ? 'success' : entry.entry_type === 'redeem' ? 'danger' : 'warning'}`}>{entry.entry_type}</span></td>
                    <td className={`font-bold ${entry.credits_delta > 0 ? 'text-success' : 'text-danger'}`}>
                      {entry.credits_delta > 0 ? '+' : ''}{entry.credits_delta}
                    </td>
                    <td>{entry.balance_after}</td>
                    <td className="text-muted text-xs">{entry.note}</td>
                    <td className="text-xs">{formatDateTime(entry.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {ledger.length === 0 && <p className="text-center text-muted p-4">No ledger entries</p>}
          </div>
        </div>
      )}
    </div>
  );
}

// ===== USERS =====
function UsersView({ toast }) {
  const [users, setUsers] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', mobile_number: '', password: '', role: 'cashier' });

  useEffect(() => { load(); }, []);
  const load = async () => setUsers(await api.get('/admin/users'));

  const save = async () => {
    try {
      await api.post('/admin/users', form);
      toast.success('User created');
      setShowModal(false); setForm({ name: '', email: '', mobile_number: '', password: '', role: 'cashier' });
      load();
    } catch (e) { toast.error(e.message); }
  };

  return (
    <div className="animate-fade-in">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Users</h1>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Add User</button>
      </div>
      <div className="card">
        <table className="data-table">
          <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Role</th><th>Active</th></tr></thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id}>
                <td className="font-medium">{u.name}</td>
                <td className="text-muted">{u.email}</td>
                <td>{u.mobile_number}</td>
                <td><span className={`badge badge-${u.role === 'superadmin' ? 'danger' : u.role === 'cashier' ? 'primary' : 'warning'}`}>{u.role}</span></td>
                <td><span className={`badge badge-${u.is_active ? 'success' : 'muted'}`}>{u.is_active ? 'Yes' : 'No'}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Add User</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="input-group">
                <label>Name</label>
                <input className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="input-group">
                <label>Email</label>
                <input className="input" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="input-group">
                <label>Mobile</label>
                <input className="input" value={form.mobile_number} onChange={e => setForm({ ...form, mobile_number: e.target.value })} />
              </div>
              <div className="input-group">
                <label>Password</label>
                <input className="input" type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
              </div>
              <div className="input-group">
                <label>Role</label>
                <select className="input" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
                  <option value="cashier">Cashier</option>
                  <option value="inventory_manager">Inventory Manager</option>
                  <option value="superadmin">Super Admin</option>
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={save}>Create User</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ===== SETTINGS =====
function SettingsView({ toast }) {
  const [settings, setSettings] = useState(null);
  const [floors, setFloors] = useState([]);
  const [floorName, setFloorName] = useState('');
  const [tableName, setTableName] = useState('');
  const [tableFloor, setTableFloor] = useState('');
  const [tableSeats, setTableSeats] = useState(2);

  useEffect(() => { load(); }, []);
  const load = async () => {
    const [s, f] = await Promise.all([api.get('/admin/venue-settings'), api.get('/admin/floors')]);
    setSettings(s); setFloors(f);
  };

  const saveSettings = async () => {
    try {
      await api.put('/admin/venue-settings', settings);
      toast.success('Settings saved');
    } catch (e) { toast.error(e.message); }
  };

  const addFloor = async () => {
    if (!floorName) return;
    await api.post('/admin/floors', { name: floorName });
    setFloorName('');
    toast.success('Floor added');
    load();
  };

  const addTable = async () => {
    if (!tableName || !tableFloor) return;
    await api.post('/admin/tables', { floor_id: parseInt(tableFloor), table_number: tableName, seats: tableSeats });
    setTableName('');
    toast.success('Table added');
    load();
  };

  if (!settings) return <div className="loading-overlay"><div className="spinner"></div></div>;

  return (
    <div className="animate-fade-in">
      <h1 className="text-2xl font-bold mb-6">Venue Settings</h1>

      <div className="grid grid-2 gap-4">
        <div className="card">
          <h3 className="font-bold mb-4">General</h3>
          <div className="input-group mb-4">
            <label>Venue Name</label>
            <input className="input" value={settings.venue_name} onChange={e => setSettings({ ...settings, venue_name: e.target.value })} />
          </div>
          <div className="input-group mb-4">
            <label>Currency Symbol</label>
            <input className="input" value={settings.currency_symbol} onChange={e => setSettings({ ...settings, currency_symbol: e.target.value })} />
          </div>
          <div className="input-group mb-4">
            <label>Tax Label</label>
            <input className="input" value={settings.tax_label} onChange={e => setSettings({ ...settings, tax_label: e.target.value })} />
          </div>
          <button className="btn btn-primary" onClick={saveSettings}>Save Settings</button>
        </div>

        <div className="card">
          <h3 className="font-bold mb-4">Loyalty Program</h3>
          <div className="flex items-center gap-3 mb-4">
            <label className="text-sm">Enabled</label>
            <input type="checkbox" checked={settings.loyalty_enabled} onChange={e => setSettings({ ...settings, loyalty_enabled: e.target.checked })} />
          </div>
          <div className="input-group mb-4">
            <label>Rupees per Credit</label>
            <input className="input" type="number" value={settings.loyalty_rupees_per_credit} onChange={e => setSettings({ ...settings, loyalty_rupees_per_credit: parseInt(e.target.value) })} />
          </div>
          <div className="input-group mb-4">
            <label>Credits for Reward</label>
            <input className="input" type="number" value={settings.loyalty_credits_for_reward} onChange={e => setSettings({ ...settings, loyalty_credits_for_reward: parseInt(e.target.value) })} />
          </div>
        </div>

        <div className="card">
          <h3 className="font-bold mb-4">Floors</h3>
          <div className="flex gap-2 mb-4">
            <input className="input" placeholder="Floor name" value={floorName} onChange={e => setFloorName(e.target.value)} style={{ flex: 1 }} />
            <button className="btn btn-primary btn-sm" onClick={addFloor}>Add</button>
          </div>
          {floors.map(f => (
            <div key={f.id} className="flex items-center justify-between py-2" style={{ borderBottom: '1px solid var(--border-color)' }}>
              <span className="font-medium">{f.name}</span>
              <span className="badge badge-info">{f.tables.length} tables</span>
            </div>
          ))}
        </div>

        <div className="card">
          <h3 className="font-bold mb-4">Tables</h3>
          <div className="flex gap-2 mb-2">
            <select className="input" value={tableFloor} onChange={e => setTableFloor(e.target.value)} style={{ flex: 1 }}>
              <option value="">Floor</option>
              {floors.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
            <input className="input" placeholder="Number" value={tableName} onChange={e => setTableName(e.target.value)} style={{ width: 80 }} />
            <input className="input" type="number" placeholder="Seats" value={tableSeats} onChange={e => setTableSeats(parseInt(e.target.value))} style={{ width: 70 }} />
            <button className="btn btn-primary btn-sm" onClick={addTable}>Add</button>
          </div>
          {floors.map(f => f.tables.map(t => (
            <div key={t.id} className="flex items-center justify-between py-2" style={{ borderBottom: '1px solid var(--border-color)' }}>
              <span className="text-sm">{f.name} / T{t.table_number}</span>
              <span className="text-xs text-muted">{t.seats} seats · QR: {t.qr_token.substring(0, 8)}...</span>
            </div>
          )))}
        </div>
      </div>
    </div>
  );
}

const styles = {
  root: { display: 'flex', minHeight: '100vh', background: 'var(--bg-primary)' },
  sidebar: {
    width: 240, background: 'var(--bg-secondary)', borderRight: '1px solid var(--border-color)',
    display: 'flex', flexDirection: 'column', position: 'sticky', top: 0, height: '100vh',
  },
  sidebarHeader: {
    padding: 'var(--space-5)', borderBottom: '1px solid var(--border-color)',
    display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap',
  },
  nav: { flex: 1, padding: 'var(--space-3) 0', overflowY: 'auto' },
  navItem: {
    width: '100%', display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
    padding: 'var(--space-3) var(--space-5)', border: 'none', cursor: 'pointer',
    fontFamily: 'inherit', fontSize: 'var(--text-sm)', fontWeight: 500,
    transition: 'all var(--transition-fast)',
  },
  sidebarFooter: {
    padding: 'var(--space-4) var(--space-5)', borderTop: '1px solid var(--border-color)',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  },
  main: { flex: 1, padding: 'var(--space-6) var(--space-8)', overflowY: 'auto' },
};
