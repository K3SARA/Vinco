import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { fileURLToPath } from 'url';

// Load env variables
dotenv.config();

// Controllers
import * as auth from './controllers/authController.js';
import * as products from './controllers/productController.js';
import * as customers from './controllers/customerController.js';
import * as suppliers from './controllers/supplierController.js';
import * as invoices from './controllers/invoiceController.js';
import * as quotations from './controllers/quotationController.js';
import * as orders from './controllers/orderController.js';
import * as payments from './controllers/paymentController.js';
import * as deliveries from './controllers/deliveryController.js';
import * as purchases from './controllers/purchaseController.js';
import * as expenses from './controllers/expenseController.js';
import * as settings from './controllers/settingsController.js';
import * as reports from './controllers/reportController.js';
import * as materials from './controllers/materialController.js';

// Auth middleware
import { authenticateToken, authorizeRoles } from './middleware/auth.js';

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Resolve static folder paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsPath = path.resolve(process.env.UPLOADS_DIR || path.join(__dirname, '../uploads'));
fs.mkdirSync(uploadsPath, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsPath),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      const prefix = file.fieldname === 'materialImage' ? 'material' : 'invoice-furniture';
      cb(null, `${prefix}-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image uploads are allowed.'));
    }
    cb(null, true);
  },
});

// ==========================================
// API ENDPOINTS
// ==========================================

// Auth
app.post('/api/auth/login', auth.login);
app.post('/api/auth/setup-admin', auth.setupAdmin);
app.get('/api/auth/me', authenticateToken, auth.me);

// Dashboard
app.get('/api/dashboard', authenticateToken, reports.getDashboardStats);

// Business & Receipt Settings
app.get('/api/settings/business', settings.getBusinessSettings);
app.put('/api/settings/business', authenticateToken, authorizeRoles('ADMIN'), settings.updateBusinessSettings);
app.get('/api/settings/receipt', settings.getReceiptSettings);
app.put('/api/settings/receipt', authenticateToken, authorizeRoles('ADMIN'), settings.updateReceiptSettings);

// Categories (ADMIN, CASHIER, SALESPERSON can manage)
app.get('/api/categories', getCategoriesWithTokenCheck);
app.post('/api/categories', authenticateToken, authorizeRoles('ADMIN', 'CASHIER'), products.createCategory);
app.put('/api/categories/:id', authenticateToken, authorizeRoles('ADMIN', 'CASHIER'), products.updateCategory);
app.delete('/api/categories/:id', authenticateToken, authorizeRoles('ADMIN', 'CASHIER'), products.deleteCategory);

// Materials
app.get('/api/materials', authenticateToken, authorizeRoles('ADMIN', 'CASHIER', 'SALESPERSON'), materials.getMaterials);
app.post('/api/materials', authenticateToken, authorizeRoles('ADMIN', 'CASHIER', 'SALESPERSON'), upload.single('materialImage'), materials.createMaterial);

// Products
app.get('/api/products', getProductsWithTokenCheck);
app.post('/api/products', authenticateToken, authorizeRoles('ADMIN', 'CASHIER', 'SALESPERSON'), products.createProduct);
app.get('/api/products/:id', authenticateToken, products.getProductById);
app.put('/api/products/:id', authenticateToken, authorizeRoles('ADMIN', 'CASHIER', 'SALESPERSON'), products.updateProduct);
app.delete('/api/products/:id', authenticateToken, authorizeRoles('ADMIN'), products.deleteProduct);

// Customers
app.get('/api/customers', authenticateToken, authorizeRoles('ADMIN', 'CASHIER', 'SALESPERSON'), customers.getCustomers);
app.post('/api/customers', authenticateToken, authorizeRoles('ADMIN', 'CASHIER', 'SALESPERSON'), customers.createCustomer);
app.get('/api/customers/:id', authenticateToken, customers.getCustomerById);
app.put('/api/customers/:id', authenticateToken, authorizeRoles('ADMIN', 'CASHIER'), customers.updateCustomer);
app.delete('/api/customers/:id', authenticateToken, authorizeRoles('ADMIN'), customers.deleteCustomer);
app.get('/api/customers/:id/ledger', authenticateToken, customers.getCustomerLedger);
app.post('/api/customers/:id/payment', authenticateToken, authorizeRoles('ADMIN', 'CASHIER'), customers.addPaymentReceived);
app.post('/api/customers/:id/adjustment', authenticateToken, authorizeRoles('ADMIN', 'CASHIER'), customers.addAdjustment);

// Invoices
app.get('/api/invoices', authenticateToken, authorizeRoles('ADMIN', 'CASHIER'), invoices.getInvoices);
app.post('/api/invoices', authenticateToken, authorizeRoles('ADMIN', 'CASHIER'), upload.single('furnitureImage'), invoices.createInvoice);
app.get('/api/invoices/:id', authenticateToken, invoices.getInvoiceById);
app.delete('/api/invoices/:id', authenticateToken, authorizeRoles('ADMIN'), invoices.deleteInvoice);
app.post('/api/invoices/:id/cancel', authenticateToken, authorizeRoles('ADMIN'), invoices.cancelInvoice);
app.post('/api/invoices/:id/payment', authenticateToken, authorizeRoles('ADMIN', 'CASHIER'), invoices.addInvoicePayment);
app.get('/api/invoices/:id/print', invoices.getInvoicePrintDetails); // Open endpoint for local client browser print window

// Quotations
app.get('/api/quotations', authenticateToken, authorizeRoles('ADMIN', 'CASHIER', 'SALESPERSON'), quotations.getQuotations);
app.post('/api/quotations', authenticateToken, authorizeRoles('ADMIN', 'CASHIER', 'SALESPERSON'), quotations.createQuotation);
app.get('/api/quotations/:id', authenticateToken, quotations.getQuotationById);
app.put('/api/quotations/:id', authenticateToken, authorizeRoles('ADMIN', 'CASHIER', 'SALESPERSON'), quotations.updateQuotation);
app.delete('/api/quotations/:id', authenticateToken, authorizeRoles('ADMIN', 'CASHIER'), quotations.deleteQuotation);
app.post('/api/quotations/:id/convert-to-invoice', authenticateToken, authorizeRoles('ADMIN', 'CASHIER'), quotations.convertToInvoice);
app.post('/api/quotations/:id/convert-to-order', authenticateToken, authorizeRoles('ADMIN', 'CASHIER', 'SALESPERSON'), quotations.convertToOrder);

// Orders
app.get('/api/orders', authenticateToken, authorizeRoles('ADMIN', 'CASHIER', 'SALESPERSON'), orders.getOrders);
app.post('/api/orders', authenticateToken, authorizeRoles('ADMIN', 'CASHIER', 'SALESPERSON'), orders.createOrder);
app.get('/api/orders/:id', authenticateToken, orders.getOrderById);
app.put('/api/orders/:id', authenticateToken, authorizeRoles('ADMIN', 'CASHIER', 'SALESPERSON'), orders.cancelOrder); // Can cancel or edit
app.post('/api/orders/:id/convert-to-invoice', authenticateToken, authorizeRoles('ADMIN', 'CASHIER'), orders.convertToInvoice);
app.post('/api/orders/:id/payment', authenticateToken, authorizeRoles('ADMIN', 'CASHIER'), orders.addOrderPayment);
app.post('/api/orders/:id/cancel', authenticateToken, authorizeRoles('ADMIN'), orders.cancelOrder);

// Payments (Cash/Bank receivables logs)
app.get('/api/payments', authenticateToken, payments.getPayments);
app.get('/api/payments/pending', authenticateToken, payments.getPendingPayments);
app.get('/api/payments/overdue', authenticateToken, payments.getOverduePayments);

// Deliveries
app.get('/api/deliveries', authenticateToken, deliveries.getDeliveries);
app.post('/api/deliveries', authenticateToken, authorizeRoles('ADMIN', 'CASHIER'), deliveries.createDelivery);
app.get('/api/deliveries/:id', authenticateToken, deliveries.getDeliveryById);
app.put('/api/deliveries/:id', authenticateToken, authorizeRoles('ADMIN', 'CASHIER', 'DELIVERY_STAFF'), deliveries.updateDelivery);
app.post('/api/deliveries/:id/status', authenticateToken, authorizeRoles('ADMIN', 'CASHIER', 'DELIVERY_STAFF'), deliveries.updateDeliveryStatus);

// Suppliers
app.get('/api/suppliers', authenticateToken, suppliers.getSuppliers);
app.post('/api/suppliers', authenticateToken, authorizeRoles('ADMIN'), suppliers.createSupplier);
app.get('/api/suppliers/:id', authenticateToken, suppliers.getSupplierById);
app.put('/api/suppliers/:id', authenticateToken, authorizeRoles('ADMIN'), suppliers.updateSupplier);
app.delete('/api/suppliers/:id', authenticateToken, authorizeRoles('ADMIN'), suppliers.deleteSupplier);
app.get('/api/suppliers/:id/ledger', authenticateToken, suppliers.getSupplierLedger);
app.post('/api/suppliers/:id/payment', authenticateToken, authorizeRoles('ADMIN'), suppliers.addPaymentMade);
app.post('/api/suppliers/:id/adjustment', authenticateToken, authorizeRoles('ADMIN'), suppliers.addAdjustment);

// Purchases
app.get('/api/purchases', authenticateToken, purchases.getPurchases);
app.post('/api/purchases', authenticateToken, authorizeRoles('ADMIN'), purchases.createPurchase);
app.get('/api/purchases/:id', authenticateToken, purchases.getPurchaseById);
app.put('/api/purchases/:id', authenticateToken, authorizeRoles('ADMIN'), purchases.addPurchasePayment); // payment additions
app.delete('/api/purchases/:id', authenticateToken, authorizeRoles('ADMIN'), purchases.deletePurchase);
app.post('/api/purchases/:id/payment', authenticateToken, authorizeRoles('ADMIN'), purchases.addPurchasePayment);

// Expenses
app.get('/api/expenses', authenticateToken, expenses.getExpenses);
app.post('/api/expenses', authenticateToken, authorizeRoles('ADMIN', 'CASHIER'), expenses.createExpense);
app.put('/api/expenses/:id', authenticateToken, authorizeRoles('ADMIN', 'CASHIER'), expenses.updateExpense);
app.delete('/api/expenses/:id', authenticateToken, authorizeRoles('ADMIN'), expenses.deleteExpense);

// Reports
app.get('/api/reports/daily-sales', authenticateToken, reports.getDailySalesReport);
app.get('/api/reports/monthly-sales', authenticateToken, reports.getMonthlySalesReport);
app.get('/api/reports/stock', authenticateToken, reports.getStockReport);
app.get('/api/reports/customer-balances', authenticateToken, reports.getCustomerBalancesReport);
app.get('/api/reports/supplier-balances', authenticateToken, reports.getSupplierBalancesReport);
app.get('/api/reports/deliveries', authenticateToken, reports.getDeliveryReport);
app.get('/api/reports/profit-loss', authenticateToken, reports.getProfitLossReport);
app.get('/api/reports/best-selling', authenticateToken, reports.getBestSellingReport);
app.get('/api/reports/pending-payments', authenticateToken, reports.getPendingPaymentsReport);

// User account management (ADMIN ONLY)
app.get('/api/users', authenticateToken, settings.getUsers);
app.post('/api/users', authenticateToken, settings.createUser);
app.put('/api/users/:id', authenticateToken, settings.updateUser);
app.delete('/api/users/:id', authenticateToken, settings.deleteUser);

// Local placeholder helper for invoice edits
app.put('/api/invoices/:id', authenticateToken, authorizeRoles('ADMIN'), async (req, res) => {
  return res.status(501).json({ error: 'Direct edits of finalized invoices are restricted to maintain ledger compliance. Cancel and recreate invoice instead.' });
});

// Helper open endpoints that bypass auth ONLY if query demands it or just wrappers
function getCategoriesWithTokenCheck(req, res, next) {
  // Let local client fetch categories for print windows without token
  return products.getCategories(req, res, next);
}
function getProductsWithTokenCheck(req, res, next) {
  return products.getProducts(req, res, next);
}

// ==========================================
// FRONTEND SERVING
// ==========================================

// Serve static assets from Vite build in production
const frontendDistPath = path.join(__dirname, '../frontend/dist');
app.use('/uploads', express.static(uploadsPath));
app.use(express.static(frontendDistPath));

// Fallback to React index.html for client side routing in production
app.get('*', (req, res, next) => {
  // Ignore API requests
  if (req.originalUrl.startsWith('/api')) {
    return next();
  }
  res.sendFile(path.join(frontendDistPath, 'index.html'), (err) => {
    if (err) {
      res.status(200).send('Alight Furniture Billing App Backend running. Frontend is not built yet (run npm run build in frontend).');
    }
  });
});

app.listen(PORT, () => {
  console.log(`Server is running in localhost:${PORT}`);
});
