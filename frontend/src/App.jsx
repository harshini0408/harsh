import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { CartProvider } from './contexts/CartContext';
import { ToastProvider } from './contexts/ToastContext';

// Auth
import StaffLogin from './pages/auth/StaffLogin';

// Customer (QR self-order)
import ScanLanding from './pages/customer/ScanLanding';
import MenuBrowse from './pages/customer/MenuBrowse';
import Cart from './pages/customer/Cart';
import Checkout from './pages/customer/Checkout';
import OrderStatus from './pages/customer/OrderStatus';

// Cashier
import CashierLayout from './pages/cashier/CashierLayout';

// Admin
import AdminLayout from './pages/admin/AdminLayout';

// KDS
import KDSBoard from './pages/kds/KDSBoard';

function ProtectedRoute({ children, allowedRoles }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading-overlay"><div className="spinner spinner-lg"></div></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

function AppRoutes() {
  return (
    <Routes>
      {/* Auth */}
      <Route path="/login" element={<StaffLogin />} />

      {/* Customer Self-Order (QR) */}
      <Route path="/order/:qrToken" element={<ScanLanding />} />
      <Route path="/order/:qrToken/menu" element={
        <CartProvider><MenuBrowse /></CartProvider>
      } />
      <Route path="/order/:qrToken/cart" element={
        <CartProvider><Cart /></CartProvider>
      } />
      <Route path="/order/:qrToken/checkout" element={
        <CartProvider><Checkout /></CartProvider>
      } />
      <Route path="/order-status/:orderId" element={<OrderStatus />} />

      {/* Cashier POS */}
      <Route path="/cashier/*" element={
        <ProtectedRoute allowedRoles={['cashier', 'superadmin']}>
          <CartProvider><CashierLayout /></CartProvider>
        </ProtectedRoute>
      } />

      {/* Admin */}
      <Route path="/admin/*" element={
        <ProtectedRoute allowedRoles={['superadmin']}>
          <AdminLayout />
        </ProtectedRoute>
      } />

      {/* KDS */}
      <Route path="/kds" element={<KDSBoard />} />

      {/* Default redirect */}
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <AppRoutes />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
