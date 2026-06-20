import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCart } from '../../contexts/CartContext';
import { formatCurrency } from '../../utils/helpers';
import api from '../../api/client';

export default function MenuBrowse() {
  const { qrToken } = useParams();
  const navigate = useNavigate();
  const { addItem, itemCount, total } = useCart();
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [activeCategory, setActiveCategory] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMenu();
  }, []);

  const loadMenu = async () => {
    try {
      const [cats, prods] = await Promise.all([
        api.get('/admin/categories'),
        api.get('/admin/products'),
      ]);
      const activeCats = cats.filter(c => c.is_active);
      const activeProds = prods.filter(p => p.is_active);
      setCategories(activeCats);
      setProducts(activeProds);
      if (activeCats.length > 0) setActiveCategory(activeCats[0].id);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = activeCategory
    ? products.filter(p => p.category_id === activeCategory)
    : products;

  if (loading) {
    return (
      <div style={styles.container}>
        <div className="loading-overlay"><div className="spinner spinner-lg"></div></div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h1 className="text-xl font-bold">☕ Menu</h1>
      </div>

      {/* Category Tabs */}
      <div style={styles.categoryTabs}>
        {categories.map(cat => (
          <button
            key={cat.id}
            className={`btn btn-sm ${activeCategory === cat.id ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setActiveCategory(cat.id)}
            style={{ borderRadius: 'var(--radius-full)' }}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {/* Products Grid */}
      <div style={styles.productsGrid}>
        {filteredProducts.map(product => (
          <div key={product.id} className="card card-interactive" style={styles.productCard}>
            <div style={{
              ...styles.productImage,
              background: product.image_url
                ? `url(${product.image_url}) center/cover`
                : `linear-gradient(135deg, ${categories.find(c => c.id === product.category_id)?.color_hex || '#3b82f6'}40, ${categories.find(c => c.id === product.category_id)?.color_hex || '#3b82f6'}20)`,
            }}>
              {!product.image_url && <span style={{ fontSize: 32 }}>☕</span>}
            </div>
            <div style={styles.productInfo}>
              <h3 className="font-semibold text-sm">{product.name}</h3>
              {product.description && (
                <p className="text-muted text-xs truncate">{product.description}</p>
              )}
              <div className="flex items-center justify-between mt-4">
                <span className="font-bold text-accent">{formatCurrency(product.price)}</span>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => addItem({
                    product_id: product.id,
                    name: product.name,
                    price: product.price,
                    tax_percent: product.tax_percent,
                    image_url: product.image_url,
                  })}
                >
                  + Add
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Floating Cart Bar */}
      {itemCount > 0 && (
        <div style={styles.cartBar} className="animate-slide-up">
          <div>
            <span className="font-bold">{itemCount} item{itemCount > 1 ? 's' : ''}</span>
            <span className="text-secondary"> · </span>
            <span className="font-bold text-accent">{formatCurrency(total)}</span>
          </div>
          <button
            className="btn btn-primary"
            onClick={() => navigate(`/order/${qrToken}/cart`)}
          >
            View Cart →
          </button>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    background: 'var(--bg-primary)',
    paddingBottom: 100,
  },
  header: {
    padding: 'var(--space-4) var(--space-5)',
    borderBottom: '1px solid var(--border-color)',
    background: 'var(--bg-glass)',
    backdropFilter: 'blur(20px)',
    position: 'sticky',
    top: 0,
    zIndex: 10,
  },
  categoryTabs: {
    display: 'flex',
    gap: 'var(--space-2)',
    padding: 'var(--space-3) var(--space-5)',
    overflowX: 'auto',
    borderBottom: '1px solid var(--border-color)',
    background: 'var(--bg-secondary)',
  },
  productsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
    gap: 'var(--space-4)',
    padding: 'var(--space-4) var(--space-5)',
  },
  productCard: {
    padding: 0,
    overflow: 'hidden',
    cursor: 'pointer',
  },
  productImage: {
    height: 120,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  productInfo: {
    padding: 'var(--space-3)',
  },
  cartBar: {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    background: 'var(--bg-glass)',
    backdropFilter: 'blur(20px)',
    border: '1px solid var(--border-color)',
    borderBottom: 'none',
    borderRadius: 'var(--radius-xl) var(--radius-xl) 0 0',
    padding: 'var(--space-4) var(--space-5)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 20,
  },
};
