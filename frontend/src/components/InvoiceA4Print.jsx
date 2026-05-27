import React from 'react';

const money = (value) => `Rs. ${Number(value || 0).toLocaleString()}`;

const formatDate = (value) => {
  if (!value) return '';
  return new Date(value).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
};

const paymentStatusLabel = (status) => {
  switch (status) {
    case 'PAID':
      return 'Fully Paid';
    case 'PARTIAL':
      return 'Partially Paid';
    case 'CREDIT':
      return 'Credit Sale';
    case 'CANCELLED':
      return 'Cancelled';
    default:
      return status || '';
  }
};

const uploadedAssetUrl = (path) => {
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path;
  return `${import.meta.env.DEV ? 'http://localhost:5000' : ''}${path}`;
};

export default function InvoiceA4Print({ printDetails }) {
  const business = printDetails?.business || {};
  const invoice = printDetails?.invoice || {};
  const customer = invoice.customer || {};
  const items = invoice.items || [];
  const installments = invoice.installments || [];
  const furnitureImageUrl = uploadedAssetUrl(invoice.furnitureImage);

  return (
    <div className="invoice-a4-page bg-white text-stone-950 font-sans">
      <div className="invoice-a4-header">
        <div className="invoice-a4-letterhead">
          <div className="invoice-a4-brand-mark" aria-hidden="true">
            <span />
            <span />
          </div>
          <div className="invoice-a4-logo-frame">
            <img
              src="/logo.png"
              alt="Alight Furniture & Timbers"
              className="invoice-a4-logo"
            />
          </div>
          <div className="invoice-a4-brand-copy">
            <strong>ALIGHT FURNITURE & TIMBERS</strong>
            <span>Decorate your Home with Furniture</span>
          </div>
          <div className="invoice-a4-header-block" aria-hidden="true" />
        </div>
        <div className="invoice-a4-business-line">
          <span>{business.address || '360/1 Kolonnawa Road, Gothatuwa'}</span>
          <span>{business.phone1 || '0757553555'}{business.phone2 ? ` / ${business.phone2}` : ' / 0777307292'}</span>
          <span>Reg No: {business.taxNumber || 'PV00321054'}</span>
        </div>
      </div>

      <div className="invoice-a4-title-row">
        <div>
          <p className="invoice-a4-kicker">Furniture & Timber Sales Invoice</p>
          <h1>TAX INVOICE</h1>
        </div>
        <div className="invoice-a4-number">{invoice.invoiceNumber}</div>
      </div>

      <div className="invoice-a4-info-grid">
        <section className="invoice-a4-panel">
          <h2>Bill To</h2>
          <p className="invoice-a4-customer-name">{customer.name}</p>
          <p>{customer.address}</p>
          <p>Phone: {customer.phone}</p>
        </section>

        <section className="invoice-a4-panel">
          <h2>Invoice Details</h2>
          <dl className="invoice-a4-details">
            <dt>Invoice No</dt>
            <dd>{invoice.invoiceNumber}</dd>
            <dt>Date</dt>
            <dd>{formatDate(invoice.date)}</dd>
            <dt>Salesperson</dt>
            <dd>{invoice.salesperson || 'System Admin'}</dd>
            <dt>Status</dt>
            <dd className="invoice-a4-status">{paymentStatusLabel(invoice.paymentStatus)}</dd>
          </dl>
        </section>
      </div>

      <table className="invoice-a4-table">
        <thead>
          <tr>
            <th className="code">SKU / Code</th>
            <th>Product Description</th>
            <th className="amount">Unit Price</th>
            <th className="qty">Qty</th>
            <th className="amount">Discount</th>
            <th className="amount">Line Total</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id || item.productCode}>
              <td className="code">{item.productCode}</td>
              <td>
                <strong>{item.productName}</strong>
                {item.materialName && (
                  <span className="invoice-a4-material">
                    {item.materialImage && (
                      <img src={uploadedAssetUrl(item.materialImage)} alt={item.materialName} />
                    )}
                    Material: {item.materialName}
                  </span>
                )}
                {item.warrantyPeriod && item.warrantyPeriod !== 'No Warranty' && (
                  <span className="invoice-a4-muted">Warranty: {item.warrantyPeriod}</span>
                )}
              </td>
              <td className="amount">{money(item.unitPrice)}</td>
              <td className="qty">{item.quantity}</td>
              <td className="amount">{Number(item.discount || 0) > 0 ? `- ${money(item.discount)}` : money(0)}</td>
              <td className="amount strong">{money(item.lineTotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {furnitureImageUrl && (
        <section className="invoice-a4-furniture-photo">
          <h2>Furniture Included</h2>
          <img src={furnitureImageUrl} alt="Furniture included in this invoice" />
        </section>
      )}

      <div className="invoice-a4-summary-grid">
        <section className="invoice-a4-panel invoice-a4-payment">
          <h2>Payment Summary</h2>
          <p><strong>{invoice.paymentMethod}</strong> received: <strong>{money(invoice.paidAmount)}</strong></p>
          <p className={Number(invoice.balanceAmount || 0) > 0 ? 'invoice-a4-due' : 'invoice-a4-paid'}>
            Outstanding balance: {money(invoice.balanceAmount)}
          </p>
          {installments.length > 0 && (
            <div className="invoice-a4-installments">
              <h3>Installment Plan</h3>
              {installments.map((inst, idx) => (
                <div key={inst.id || idx}>
                  <span>Installment {idx + 1} ({formatDate(inst.dueDate)})</span>
                  <strong>{money(inst.installmentAmount)}</strong>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="invoice-a4-totals">
          <div>
            <span>Subtotal</span>
            <strong>{money(invoice.subtotal)}</strong>
          </div>
          {Number(invoice.discount || 0) > 0 && (
            <div>
              <span>Discount</span>
              <strong>- {money(invoice.discount)}</strong>
            </div>
          )}
          {Number(invoice.deliveryCharge || 0) > 0 && (
            <div>
              <span>Delivery Charge</span>
              <strong>{money(invoice.deliveryCharge)}</strong>
            </div>
          )}
          {Number(invoice.installationCharge || 0) > 0 && (
            <div>
              <span>Installation Charge</span>
              <strong>{money(invoice.installationCharge)}</strong>
            </div>
          )}
          <div className="grand">
            <span>Grand Total</span>
            <strong>{money(invoice.grandTotal)}</strong>
          </div>
          <div>
            <span>Amount Paid ({invoice.paymentMethod})</span>
            <strong>{money(invoice.paidAmount)}</strong>
          </div>
          <div className="balance">
            <span>Balance Due</span>
            <strong>{money(invoice.balanceAmount)}</strong>
          </div>
        </section>
      </div>

      <section className="invoice-a4-terms">
        <h2>Terms & Warranty</h2>
        <p>
          Warranties cover manufacturing faults only. Physical damage is not covered under warranty terms.
          Goods once sold are not refundable. Warranty is valid only with the original invoice.
        </p>
        {business.receiptFooterText && <p>{business.receiptFooterText}</p>}
      </section>

      <div className="invoice-a4-signatures">
        <span>Authorized Signature</span>
        <span>Customer Signature</span>
      </div>
    </div>
  );
}
