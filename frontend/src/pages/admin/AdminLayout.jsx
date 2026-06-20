import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { formatCurrency, formatDateTime } from '../../utils/helpers';
import api from '../../api/client';

const SIDEBAR_TABS = [
  { id: 'dashboard', label: 'Dashboard', icon: '📊' },
  { id: 'inventory', label: 'Inventory', icon: '📦' },
  { id: 'pos', label: 'POS Terminal', icon: '📠' },
  { id: 'kitchen', label: 'Kitchen', icon: '🍳' },
  { id: 'settings', label: 'Settings', icon: '⚙️' },
];

const SETTINGS_SUBTABS = [
  { id: 'products', label: 'Products', icon: '🍰' },
  { id: 'categories', label: 'Categories', icon: '📂' },
  { id: 'coupons', label: 'Coupons', icon: '🎟️' },
  { id: 'promotions', label: 'Promotions', icon: '🏷️' },
  { id: 'loyalty', label: 'Loyalty', icon: '⭐' },
  { id: 'users', label: 'Users', icon: '👥' },
  { id: 'venue', label: 'Venue Settings', icon: '🏢' },
];

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const toast = useToast();
  
  const [activeTab, setActiveTab] = useState('dashboard');
  const [activeSubTab, setActiveSubTab] = useState('orders'); // orders, tables, history
  const [activeSettingsTab, setActiveSettingsTab] = useState('venue');

  const handleTabClick = (tabId) => {
    if (tabId === 'pos') {
      window.location.href = '/cashier';
    } else if (tabId === 'kitchen') {
      window.location.href = '/kds';
    } else {
      setActiveTab(tabId);
    }
  };

  return (
    <div className="app-container">
      {/* Sidebar */}
      <aside className="app-sidebar">
        <div className="sidebar-brand">
          <h2>Cafe Premium</h2>
          <span>Terminal #01</span>
        </div>

        <nav className="sidebar-nav">
          {SIDEBAR_TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab.id)}
              className={`sidebar-link ${activeTab === tab.id ? 'active' : ''}`}
            >
              <span>{tab.icon}</span> {tab.label}
            </button>
          ))}
        </nav>

        <div className="sidebar-btn-container">
          <button className="btn btn-primary btn-block" onClick={() => window.location.href = '/cashier'} style={{ height: 48, borderRadius: 12 }}>
            <span style={{ fontSize: 18, marginRight: 6 }}>+</span> New Order
          </button>
        </div>

        <footer className="sidebar-footer">
          <button className="sidebar-footer-item">
            <span>❓</span> Support
          </button>
          <button className="sidebar-footer-item" onClick={() => { logout(); window.location.href = '/login'; }}>
            <span>🚪</span> Logout
          </button>
        </footer>
      </aside>

      {/* Main Panel */}
      <main className="app-main">
        {/* Topbar */}
        <header className="app-topbar">
          <div>
            <h1 className="topbar-title" style={{ textTransform: 'capitalize' }}>{activeTab}</h1>
          </div>

          <div className="topbar-tabs">
            <button className={`topbar-tab-btn ${activeSubTab === 'orders' ? 'active' : ''}`} onClick={() => setActiveSubTab('orders')}>Orders</button>
            <button className={`topbar-tab-btn ${activeSubTab === 'tables' ? 'active' : ''}`} onClick={() => setActiveSubTab('tables')}>Tables</button>
            <button className={`topbar-tab-btn ${activeSubTab === 'history' ? 'active' : ''}`} onClick={() => setActiveSubTab('history')}>History</button>
          </div>

          <div className="topbar-actions">
            <div className="topbar-search-wrapper">
              <span className="topbar-search-icon">🔍</span>
              <input type="text" className="topbar-search" placeholder="Search orders..." />
            </div>
            <button className="topbar-icon-btn">🔄</button>
            <button className="topbar-icon-btn">🔔</button>
            <div className="topbar-profile">
              <img src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=80&h=80&fit=crop&q=80" alt="Avatar" className="topbar-avatar" />
              <span className="topbar-profile-name">Alex Rivera</span>
            </div>
          </div>
        </header>

        {/* Content Panel */}
        <div className="app-content">
          {activeTab === 'dashboard' && <DashboardView toast={toast} />}
          {activeTab === 'inventory' && <InventoryView toast={toast} />}
          {activeTab === 'settings' && (
            <div className="animate-fade-in">
              <div className="flex gap-4 mb-6" style={{ overflowX: 'auto', paddingBottom: 4 }}>
                {SETTINGS_SUBTABS.map(tab => (
                  <button
                    key={tab.id}
                    className={`btn btn-sm ${activeSettingsTab === tab.id ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={() => setActiveSettingsTab(tab.id)}
                    style={{ borderRadius: 'var(--radius-full)' }}
                  >
                    {tab.icon} {tab.label}
                  </button>
                ))}
              </div>
              <div className="mt-4">
                {activeSettingsTab === 'products' && <ProductsView toast={toast} />}
                {activeSettingsTab === 'categories' && <CategoriesView toast={toast} />}
                {activeSettingsTab === 'coupons' && <CouponsView toast={toast} />}
                {activeSettingsTab === 'promotions' && <PromotionsView toast={toast} />}
                {activeSettingsTab === 'loyalty' && <LoyaltyView toast={toast} />}
                {activeSettingsTab === 'users' && <UsersView toast={toast} />}
                {activeSettingsTab === 'venue' && <SettingsView toast={toast} />}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

// ===== DASHBOARD =====
function DashboardView({ toast }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      const result = await api.get('/admin/dashboard');
      setData(result);
    } catch (e) {
      console.log('API offline, using premium mock dashboard metrics');
      setData({
        today_revenue: 24592.00,
        today_orders: 18,
        total_tables: 24,
        total_customers: 1204,
        low_stock_items: [
          { id: 1, product_name: 'Espresso Beans', current_stock: '2kg' }
        ],
        recent_orders: [
          { id: 1, order_number: 'ORD-1042', source: 'cashier', total: 84.20, status: 'paid', table_number: '03' }
        ]
      });
    }
  };

  if (!data) return <div className="loading-overlay"><div className="spinner spinner-lg"></div></div>;

  return (
    <div className="animate-fade-in">
      {/* KPI Cards Row */}
      <div className="grid-cols-3 mb-8">
        <div className="widget-kpi">
          <div className="widget-kpi-info">
            <h4>Total Revenue</h4>
            <div className="kpi-value">${data.today_revenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
            <div className="kpi-subtext" style={{ color: 'var(--color-success)' }}>📈 +12.5% from yesterday</div>
          </div>
          <div className="widget-kpi-icon-box" style={{ background: '#d1fae5', color: '#065f46' }}>💵</div>
        </div>

        <div className="widget-kpi">
          <div className="widget-kpi-info">
            <h4>Active Tables</h4>
            <div className="kpi-value">{data.today_orders} / {data.total_tables || 24}</div>
            <div className="kpi-subtext" style={{ color: 'var(--color-primary)' }}>
              <div style={{ width: '100px', height: 6, background: '#e2e8f0', borderRadius: 3, marginTop: 6, overflow: 'hidden' }}>
                <div style={{ width: '75%', height: '100%', background: '#4f46e5' }}></div>
              </div>
              <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>75% Capacity Reached</span>
            </div>
          </div>
          <div className="widget-kpi-icon-box" style={{ background: '#fee2e2', color: '#991b1b' }}>🪑</div>
        </div>

        <div className="widget-kpi">
          <div className="widget-kpi-info">
            <h4>Total Customers</h4>
            <div className="kpi-value">{data.total_customers.toLocaleString()}</div>
            <div className="kpi-subtext" style={{ color: '#4f46e5' }}>👤 +42 new registrations today</div>
          </div>
          <div className="widget-kpi-icon-box" style={{ background: '#e0e7ff', color: '#4338ca' }}>👥</div>
        </div>
      </div>

      {/* Rows Grid */}
      <div className="grid-cols-3 mb-8">
        {/* Sales Trends Chart Card */}
        <div className="card" style={{ gridColumn: 'span 2', minHeight: 320 }}>
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="font-bold text-lg">Sales Trends</h3>
              <p className="text-muted text-xs">Weekly performance overview</p>
            </div>
            <div className="flex gap-1" style={{ background: '#f1f5f9', padding: 2, borderRadius: 8 }}>
              <button className="btn btn-sm btn-primary" style={{ borderRadius: 6 }}>Week</button>
              <button className="btn btn-sm btn-ghost" style={{ border: 'none', borderRadius: 6 }}>Month</button>
            </div>
          </div>
          {/* Simple Vector Mock Chart matching screenshot */}
          <div style={{ height: 200, position: 'relative', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', padding: '0 20px' }}>
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 1, background: '#e2e8f0' }}></div>
            {[
              { day: 'Mon', h: 40 }, { day: 'Tue', h: 65 }, { day: 'Wed', h: 50 },
              { day: 'Thu', h: 85, active: true }, { day: 'Fri', h: 70 }, { day: 'Sat', h: 90 }, { day: 'Sun', h: 60 }
            ].map((d, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                <div style={{
                  width: 32,
                  height: `${d.h * 1.5}px`,
                  background: d.active ? 'linear-gradient(to top, #1e1b4b, #3b82f6)' : '#e2e8f0',
                  borderRadius: '6px 6px 0 0',
                  transition: 'height 0.5s'
                }}></div>
                <span className="text-xs font-semibold mt-2" style={{ color: d.active ? '#1e1b4b' : 'var(--text-muted)' }}>{d.day}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Revenue Breakdown */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <h3 className="font-bold text-lg mb-2">Revenue Breakdown</h3>
          <p className="text-muted text-xs mb-6">By category</p>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, flex: 1 }}>
            {[
              { name: 'Coffee & Drinks', amt: 12400, max: 15000, color: '#1e1b4b' },
              { name: 'Breakfast/Food', amt: 8200, max: 15000, color: '#854d0e' },
              { name: 'Bakery', amt: 3992, max: 15000, color: '#ea580c' }
            ].map((cat, i) => (
              <div key={i}>
                <div className="flex justify-between text-sm font-semibold mb-1">
                  <span>{cat.name}</span>
                  <span>${cat.amt.toLocaleString()}</span>
                </div>
                <div style={{ width: '100%', height: 8, background: '#f1f5f9', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ width: `${(cat.amt / cat.max) * 100}%`, height: '100%', background: cat.color }}></div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ background: '#e0e7ff', borderRadius: 12, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, marginTop: 'auto' }}>
            <span style={{ fontSize: 24 }}>⭐</span>
            <div>
              <span className="text-xs text-muted block">Top Product Today</span>
              <strong className="text-sm" style={{ color: '#1e1b4b' }}>Oat Milk Latte</strong>
            </div>
            <span className="font-bold text-lg" style={{ marginLeft: 'auto', color: '#1e1b4b' }}>142</span>
          </div>
        </div>
      </div>

      {/* Row 3 Grid: Active Tables & Activity Feed */}
      <div className="grid-cols-3">
        {/* Active Tables List */}
        <div className="card" style={{ gridColumn: 'span 2' }}>
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold text-lg">Active Tables</h3>
            <button className="btn btn-ghost btn-sm" onClick={() => window.location.href = '/cashier'}>View All ➔</button>
          </div>
          <div className="grid-cols-2" style={{ gap: 16 }}>
            {[
              { t: 'Table 01', status: 'Occupied', color: '#1e1b4b', bill: 42.50, icon: '🍴' },
              { t: 'Table 02', status: 'Available', color: 'var(--text-muted)', bill: 0.00, icon: '✓' },
              { t: 'Table 03', status: 'Occupied', color: '#1e1b4b', bill: 128.00, icon: '🍴' },
              { t: 'Table 04', status: 'Closing', color: '#9a3412', bill: 84.20, icon: '⏳' }
            ].map((tbl, i) => (
              <div key={i} className="card" style={{ display: 'flex', alignItems: 'center', justifyItems: 'space-between', padding: 16, border: tbl.bill > 0 ? '1px solid #c7d2fe' : '1px solid var(--border-color)' }}>
                <div style={{ flex: 1 }}>
                  <span className="text-xs text-muted block uppercase font-bold">{tbl.t}</span>
                  <strong className="text-base" style={{ color: tbl.bill > 0 ? '#1e1b4b' : 'var(--text-muted)' }}>{tbl.icon} {tbl.status}</strong>
                </div>
                <div className="text-right">
                  <span className="text-xs text-muted block">Current Bill</span>
                  <strong className="text-base" style={{ color: '#1e1b4b' }}>${tbl.bill.toFixed(2)}</strong>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="card">
          <h3 className="font-bold text-lg mb-6">Recent Activity</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {[
              { icon: '💵', title: 'New Sale #1042', desc: 'Table 03 • $84.20', time: '2 minutes ago', bg: '#d1fae5' },
              { icon: '📦', title: 'Stock Alert', desc: '"Espresso Beans" is low', time: '15 minutes ago', bg: '#e0f2fe' },
              { icon: '👤', title: 'Manager Login', desc: 'Alex Rivera signed in', time: '1 hour ago', bg: '#ffedd5' },
              { icon: '⭐', title: 'New Loyalty Member', desc: 'Sarah J. joined program', time: '3 hours ago', bg: '#f3e8ff' }
            ].map((act, i) => (
              <div key={i} className="flex gap-3 items-start">
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: act.bg, display: 'flex', alignItems: 'center', justifyCenter: 'center', fontSize: 16, flexShrink: 0, justifyContent: 'center' }}>
                  {act.icon}
                </div>
                <div>
                  <h4 className="text-sm font-bold">{act.title}</h4>
                  <p className="text-xs text-secondary">{act.desc}</p>
                  <span className="text-xs text-muted block mt-1" style={{ fontSize: 10 }}>{act.time}</span>
                </div>
              </div>
            ))}
          </div>
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
    try {
      const [p, c] = await Promise.all([api.get('/admin/products'), api.get('/admin/categories')]);
      setProducts(p); setCategories(c);
    } catch(e) {
      setProducts([]); setCategories([]);
    }
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
        <h3 className="text-xl font-bold">Product Catalog</h3>
        <button className="btn btn-primary btn-sm" onClick={() => setShowModal(true)}>+ Add Product</button>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th><th>Category</th><th>Price</th><th>Tax %</th><th>Status</th>
            </tr>
          </thead>
          <tbody>
            {products.map(p => (
              <tr key={p.id}>
                <td className="font-bold">{p.name}</td>
                <td><span className="badge badge-info">{p.category_name}</span></td>
                <td>{formatCurrency(p.price)}</td>
                <td>{p.tax_percent}%</td>
                <td><span className={`badge badge-${p.is_active ? 'success' : 'muted'}`}>{p.is_active ? 'Active' : 'Inactive'}</span></td>
              </tr>
            ))}
            {products.length === 0 && (
              <tr><td colSpan="5" className="text-center text-muted py-6">No products found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-backdrop">
          <div className="modal">
            <div className="modal-header">
              <h3 className="modal-title">Add Product</h3>
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

// ===== CATEGORIES =====
function CategoriesView({ toast }) {
  const [categories, setCategories] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', color_hex: '#3b82f6', display_order: 0 });

  useEffect(() => { load(); }, []);
  const load = async () => {
    try {
      setCategories(await api.get('/admin/categories'));
    } catch(e) {}
  };

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
        <h3 className="text-xl font-bold">Categories</h3>
        <button className="btn btn-primary btn-sm" onClick={() => setShowModal(true)}>+ Add Category</button>
      </div>

      <div className="grid-cols-3">
        {categories.map(c => (
          <div key={c.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 12, height: 40, borderRadius: 6, background: c.color_hex }}></div>
            <div>
              <strong className="text-sm block">{c.name}</strong>
              <span className="text-xs text-muted">Order: {c.display_order}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ===== INVENTORY =====
function InventoryView({ toast }) {
  const [items, setItems] = useState([]);
  const [view, setView] = useState('items');

  useEffect(() => { load(); }, []);
  const load = async () => {
    try {
      setItems(await api.get('/inventory/items'));
    } catch(e) {
      setItems([
        { id: 1, product_name: 'Espresso Beans', sku: 'ESP-BEANS-01', current_stock: 4.5, reorder_level: 5.0, is_low_stock: true }
      ]);
    }
  };

  return (
    <div className="animate-fade-in">
      <h2 className="text-xl font-bold mb-6">Stock Inventory</h2>
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="data-table">
          <thead>
            <tr><th>Product</th><th>SKU</th><th>Stock Level</th><th>Reorder Level</th><th>Status</th></tr>
          </thead>
          <tbody>
            {items.map(item => (
              <tr key={item.id}>
                <td className="font-bold">{item.product_name}</td>
                <td className="text-muted">{item.sku}</td>
                <td className="font-bold">{item.current_stock}</td>
                <td>{item.reorder_level}</td>
                <td>
                  <span className={`badge badge-${item.is_low_stock ? 'danger' : 'success'}`}>
                    {item.is_low_stock ? 'Low Stock' : 'In Stock'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ===== COUPONS =====
function CouponsView({ toast }) {
  return <div>🎟️ Coupon management available under Venue Settings.</div>;
}

// ===== PROMOTIONS =====
function PromotionsView({ toast }) {
  return <div>🏷️ Promotion configuration.</div>;
}

// ===== LOYALTY =====
function LoyaltyView({ toast }) {
  return <div>⭐ Loyalty ledger & reward options.</div>;
}

// ===== USERS =====
function UsersView({ toast }) {
  return <div>👥 Users and roles.</div>;
}

// ===== SETTINGS =====
function SettingsView({ toast }) {
  return <div>🏢 General Venue Settings & custom configurations.</div>;
}
