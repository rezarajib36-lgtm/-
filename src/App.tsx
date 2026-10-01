/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { CartProvider } from './context/CartContext';
import CustomerLayout from './layouts/CustomerLayout';
import MenuPage from './pages/customer/MenuPage';
import CartPage from './pages/customer/CartPage';
import CheckoutPage from './pages/customer/CheckoutPage';
import OrderConfirmationPage from './pages/customer/OrderConfirmationPage';

// Admin Imports
import AdminLayout from './layouts/AdminLayout';
import AdminDashboardPage from './pages/admin/AdminDashboardPage';
import AdminMenuPage from './pages/admin/AdminMenuPage';
import AdminQRPage from './pages/admin/AdminQRPage';
import AdminOrdersPage from './pages/admin/AdminOrdersPage';
import AdminExpensesPage from './pages/admin/AdminExpensesPage';
import AdminSettingsPage from './pages/admin/AdminSettingsPage';

export default function App() {
  return (
    <CartProvider>
      <BrowserRouter>
        <Routes>
          {/* অ্যাডমিন রাউটসমূহ */}
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<AdminDashboardPage />} />
            <Route path="orders" element={<AdminOrdersPage />} />
            <Route path="expenses" element={<AdminExpensesPage />} />
            <Route path="menu" element={<AdminMenuPage />} />
            <Route path="qr" element={<AdminQRPage />} />
            <Route path="settings" element={<AdminSettingsPage />} />
          </Route>

          {/* কাস্টমার রাউটসমূহ */}
          <Route element={<CustomerLayout />}>
            <Route path="/" element={<MenuPage />} />
            <Route path="/menu" element={<MenuPage />} />
            <Route path="/delivery" element={<MenuPage />} />
            <Route path="/dine-in" element={<MenuPage />} />
            <Route path="/ilisher-bari" element={<MenuPage />} />
            <Route path="/ilisher-bari/menu" element={<MenuPage />} />
            <Route path="/ilisher-bari-menu" element={<MenuPage />} />
            <Route path="/table/:tableId" element={<MenuPage />} />
            <Route path="/tables/:tableId" element={<MenuPage />} />
            <Route path="/cart" element={<CartPage />} />
            <Route path="/checkout" element={<CheckoutPage />} />
            <Route path="/order-confirmation" element={<OrderConfirmationPage />} />
            {/* Fallback to MenuPage for any unknown customer route */}
            <Route path="*" element={<MenuPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </CartProvider>
  );
}
