import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import { ROLE_GROUPS } from './utils/roles';

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
import CustomOrders from './pages/CustomOrders';
import MaterialsStock from './pages/MaterialsStock';

const guard = (element, roles) => (
  <ProtectedRoute allowedRoles={roles}>
    {element}
  </ProtectedRoute>
);

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
            <Route path="products" element={guard(<Products />, ROLE_GROUPS.SALES_DESK)} />
            
            {/* Customer & Receivable Ledger Modules */}
            <Route path="customers" element={guard(<Customers />, ROLE_GROUPS.SALES_DESK)} />
            
            {/* POS Billing Screen */}
            <Route path="billing" element={guard(<Billing />, ROLE_GROUPS.CASH_DESK)} />
            
            {/* Transaction Ledger Auditing */}
            <Route path="invoices" element={guard(<Invoices />, ROLE_GROUPS.CASH_DESK)} />
            
            {/* Proposals & Custom Reservation Pipelines */}
            <Route path="quotations" element={guard(<Quotations />, ROLE_GROUPS.SALES_DESK)} />
            <Route path="custom-orders" element={guard(<CustomOrders />, ROLE_GROUPS.SALES_DESK)} />
            <Route path="orders" element={guard(<Orders />, ROLE_GROUPS.SALES_DESK)} />
            <Route path="deliveries" element={guard(<Deliveries />, ROLE_GROUPS.DELIVERY_DESK)} />
            <Route path="materials-stock" element={guard(<MaterialsStock />, ROLE_GROUPS.SALES_DESK)} />
            
            {/* Supplier & Payables Modules */}
            <Route path="suppliers" element={guard(<Suppliers />, ROLE_GROUPS.ADMIN_ONLY)} />
            <Route path="purchases" element={guard(<Purchases />, ROLE_GROUPS.ADMIN_ONLY)} />
            
            {/* Operating Overheads Ledger */}
            <Route path="expenses" element={guard(<Expenses />, ROLE_GROUPS.CASH_DESK)} />
            <Route path="carpenters" element={guard(<Carpenters />, ROLE_GROUPS.CASH_DESK)} />
            
            {/* Analytical Performance Reports */}
            <Route path="reports" element={guard(<Reports />, ROLE_GROUPS.ADMIN_ONLY)} />
            
            {/* Control Panel Settings */}
            <Route path="settings" element={guard(<Settings />, ROLE_GROUPS.ADMIN_ONLY)} />

            {/* fallback redirects */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
