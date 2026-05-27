/**
 * Helper to calculate customer balance after transactions.
 * Customer Balance = previousBalance + debit - credit
 * Debit = Invoices / Sales / Order Reserves (Customer owes us more)
 * Credit = Payments received / Advances (Customer owes us less)
 */
export function calculateCustomerBalanceAfter(previousBalance, debit, credit) {
  return Number((previousBalance + debit - credit).toFixed(2));
}

/**
 * Helper to calculate supplier payable balance after transactions.
 * Supplier Balance = previousBalance + credit - debit
 * Credit = Purchases (We owe supplier more)
 * Debit = Payments made to supplier (We owe supplier less)
 */
export function calculateSupplierBalanceAfter(previousBalance, debit, credit) {
  return Number((previousBalance + credit - debit).toFixed(2));
}
