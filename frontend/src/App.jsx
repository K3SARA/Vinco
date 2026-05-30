import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';

// Pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Products from './pages/Products';
import Customers from './pages/Customers';
import Billing from './pages/Billing';
import Invoices from './pages/Invoices';
import Quotations from './pages/Quotations';
import Orders from './pages/Orders';
import Deliveries from './pages/Deliveries';
import Suppliers from './pages/Suppliers';
import Purchases from './pages/Purchases';
import Expenses from './pages/Expenses';
import Carpenters from './pages/Carpenters';
import Reports from './pages/Reports';
import Settings from './pages/Settings';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public Auth Endpoint */}
          <Route path="/login" element={<Login />} />

          {/* Secure Admin/Cashier Dashboard Shell */}
          <Route 
            path="/" 
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            {/* Dashboard Default Index */}
            <Route index element={<Dashboard />} />
            
            {/* Inventory Modules */}
            <Route path="products" element={<Products />} />
            
            {/* Customer & Receivable Ledger Modules */}
            <Route path="customers" element={<Customers />} />
            
            {/* POS Billing Screen */}
            <Route path="billing" element={<Billing />} />
            
            {/* Transaction Ledger Auditing */}
            <Route path="invoices" element={<Invoices />} />
            
            {/* Proposals & Custom Reservation Pipelines */}
            <Route path="quotations" element={<Quotations />} />
            <Route path="orders" element={<Orders />} />
            <Route path="deliveries" element={<Deliveries />} />
            
            {/* Supplier & Payables Modules */}
            <Route path="suppliers" element={<Suppliers />} />
            <Route path="purchases" element={<Purchases />} />
            
            {/* Operating Overheads Ledger */}
            <Route path="expenses" element={<Expenses />} />
            <Route path="carpenters" element={<Carpenters />} />
            
            {/* Analytical Performance Reports */}
            <Route path="reports" element={<Reports />} />
            
            {/* Control Panel Settings */}
            <Route path="settings" element={<Settings />} />

            {/* fallback redirects */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
