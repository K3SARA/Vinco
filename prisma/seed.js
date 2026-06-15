import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // 1. Users
  const salt = await bcrypt.genSalt(10);
  const adminPassword = await bcrypt.hash('admin123', salt);
  const cashierPassword = await bcrypt.hash('cashier123', salt);
  const salesPassword = await bcrypt.hash('sales123', salt);
  const deliveryPassword = await bcrypt.hash('delivery123', salt);

  const users = [
    { username: 'admin', password: adminPassword, role: 'ADMIN', name: 'System Admin' },
    { username: 'cashier', password: cashierPassword, role: 'CASHIER', name: 'Nimal Silva (Cashier)' },
    { username: 'sales', password: salesPassword, role: 'SALESPERSON', name: 'Kamal Perera (Sales)' },
    { username: 'delivery', password: deliveryPassword, role: 'DELIVERY_STAFF', name: 'Rohan de Silva (Delivery)' },
  ];

  for (const user of users) {
    await prisma.user.upsert({
      where: { username: user.username },
      update: {},
      create: user,
    });
  }
  console.log('Users seeded.');

  // 2. Business Settings
  await prisma.businessSettings.upsert({
    where: { id: 'default' },
    update: {},
    create: {
      id: 'default',
      shopName: 'Vinco Furniture',
      ownerName: 'Mr. Navin',
      address: 'No 120, Kandy Road, Moratuwa, Sri Lanka',
      phone1: '077 123 4567',
      phone2: '011 224 4668',
      email: 'info@vincofurniture.lk',
      website: 'www.vincofurniture.lk',
      taxNumber: 'VAT-1234567-7',
      invoicePrefix: 'INV-',
      quotationPrefix: 'QTN-',
      orderPrefix: 'ORD-',
      currency: 'LKR',
      receiptFooterText: 'Goods once sold are not refundable.\nWarranty valid only with original invoice.\nThank you for shopping with us.',
    },
  });
  console.log('Business Settings seeded.');

  // 3. Receipt Settings
  await prisma.receiptSettings.upsert({
    where: { id: 'default' },
    update: {},
    create: {
      id: 'default',
      showLogo: true,
      showShopName: true,
      showAddress: true,
      showPhone: true,
      showEmail: true,
      showTaxNumber: true,
      showCustomerName: true,
      showCustomerPhone: true,
      showCustomerAddress: true,
      showSalesperson: true,
      showProductCode: true,
      showProductImage: false,
      showWarranty: true,
      showDeliveryDetails: true,
      showPaymentDetails: true,
      showBalanceAmount: true,
      showSignatureArea: true,
      showFooterNote: true,
    },
  });
  console.log('Receipt Settings seeded.');

  // 4. Categories
  const categoriesList = [
    { name: 'Sofa', slug: 'sofa' },
    { name: 'Bed', slug: 'bed' },
    { name: 'Dining Table', slug: 'dining-table' },
    { name: 'Chair', slug: 'chair' },
    { name: 'Cupboard', slug: 'cupboard' },
    { name: 'Wardrobe', slug: 'wardrobe' },
    { name: 'Mattress', slug: 'mattress' },
    { name: 'Dressing Table', slug: 'dressing-table' },
    { name: 'Office Furniture', slug: 'office-furniture' },
    { name: 'Custom Made', slug: 'custom-made' },
    { name: 'Accessories', slug: 'accessories' },
    { name: 'Other', slug: 'other' },
  ];

  const categories = {};
  for (const cat of categoriesList) {
    const createdCat = await prisma.category.upsert({
      where: { name: cat.name },
      update: {},
      create: cat,
    });
    categories[cat.name] = createdCat;
  }
  console.log('Categories seeded.');

  // 5. Products
  const productsList = [
    {
      code: 'SOF-001',
      name: 'Teak L-Shape Luxury Sofa',
      categoryId: categories['Sofa'].id,
      material: 'Teak Wood & Fabric',
      size: '8ft x 6ft',
      color: 'Warm Brown & Beige',
      brand: 'Vinco Craft',
      supplier: 'Timber Masters Ltd',
      costPrice: 95000,
      sellingPrice: 155000,
      stockQty: 8,
      minStockAlert: 2,
      warrantyPeriod: '5 Years',
      description: 'Handcrafted luxury teak wood L-shape sofa set with high-density foam cushions.',
      status: 'Active',
    },
    {
      code: 'BED-001',
      name: 'King Size Mahogany Box Bed',
      categoryId: categories['Bed'].id,
      material: 'Mahogany Wood',
      size: '6ft x 6.5ft',
      color: 'Dark Cherry Mahogany',
      brand: 'Vinco Craft',
      supplier: 'Timber Masters Ltd',
      costPrice: 75000,
      sellingPrice: 125000,
      stockQty: 4,
      minStockAlert: 1,
      warrantyPeriod: '10 Years',
      description: 'Solid mahogany box bed with storage drawers and headboard.',
      status: 'Active',
    },
    {
      code: 'DNT-001',
      name: '6-Seater Teak Dining Table Set',
      categoryId: categories['Dining Table'].id,
      material: 'Teak Wood & Glass',
      size: '5.5ft x 3.5ft',
      color: 'Teak Natural',
      brand: 'Moratuwa Woodworks',
      supplier: 'Moratuwa Lumber Inc.',
      costPrice: 60000,
      sellingPrice: 98000,
      stockQty: 3,
      minStockAlert: 1,
      warrantyPeriod: '3 Years',
      description: 'Elegant teak dining table with a 10mm tempered glass top and 6 cushioned matching chairs.',
      status: 'Active',
    },
    {
      code: 'CHR-001',
      name: 'Wooden Verandah Easy Chair',
      categoryId: categories['Chair'].id,
      material: 'Teak Wood & Rattan',
      size: 'Standard Lounge',
      color: 'Teak Honey',
      brand: 'Vinco Craft',
      supplier: 'Timber Masters Ltd',
      costPrice: 12000,
      sellingPrice: 19500,
      stockQty: 15,
      minStockAlert: 4,
      warrantyPeriod: '1 Year',
      description: 'Classic Sri Lankan verandah easy chair with rattan back and arms.',
      status: 'Active',
    },
    {
      code: 'MAT-001',
      name: 'Spring Time Orthopaedic Mattress 8"',
      categoryId: categories['Mattress'].id,
      material: 'Pocket Spring & Latex',
      size: '72" x 72" x 8"',
      color: 'White',
      brand: 'Arpico',
      supplier: 'Arpico Distributors',
      costPrice: 42000,
      sellingPrice: 65000,
      stockQty: 12,
      minStockAlert: 3,
      warrantyPeriod: '10 Years',
      description: 'Orthopaedic pocket spring mattress with organic latex comfort layer.',
      status: 'Active',
    },
  ];

  const products = [];
  for (const prod of productsList) {
    const createdProd = await prisma.product.upsert({
      where: { code: prod.code },
      update: {},
      create: prod,
    });
    products.push(createdProd);
  }
  console.log('Products seeded.');

  // 6. Customer
  const customer = await prisma.customer.upsert({
    where: { phone: '0779988776' },
    update: {},
    create: {
      name: 'Amara Perera',
      phone: '0779988776',
      address: 'No 24/B, Flower Road, Colombo 03',
      email: 'amara.perera@gmail.com',
      openingBalance: 0.0,
      currentBalance: 0.0,
      notes: 'Prefers Teak and natural finishes. Reputable customer.',
      status: 'Active',
    },
  });
  console.log('Customer seeded.');

  // 7. Supplier
  const supplier = await prisma.supplier.upsert({
    where: { phone: '0112233445' },
    update: {},
    create: {
      name: 'Timber Masters Ltd',
      phone: '0112233445',
      address: 'Industrial Zone, Moratuwa',
      email: 'sales@timbermasters.lk',
      openingBalance: 0.0,
      currentBalance: 0.0,
      notes: 'Primary teak and mahogany supplier.',
      status: 'Active',
    },
  });
  console.log('Supplier seeded.');

  // 8. Create a sample Purchase (Increases stock, updates supplier ledger)
  const purchaseNo = 'PUR-2026-0001';
  const checkPurchase = await prisma.purchase.findUnique({
    where: { purchaseNumber: purchaseNo },
  });

  if (!checkPurchase) {
    const p1 = products[0]; // Teak L-Shape Sofa
    const purchaseQty = 5;
    const costTotal = p1.costPrice * purchaseQty;
    const purchaseGrandTotal = costTotal + 3000 + 1000; // subtotal + transport + loading
    const paidAmt = 50000;
    const balAmt = purchaseGrandTotal - paidAmt;

    const purchase = await prisma.purchase.create({
      data: {
        purchaseNumber: purchaseNo,
        supplierId: supplier.id,
        date: new Date(),
        subtotal: costTotal,
        transportCost: 3000,
        loadingCost: 1000,
        otherCost: 0,
        grandTotal: purchaseGrandTotal,
        paidAmount: paidAmt,
        balanceAmount: balAmt,
        paymentStatus: 'PARTIAL',
        notes: 'Initial stock purchase of Teak L-Shape Sofa sets.',
        items: {
          create: {
            productId: p1.id,
            productCode: p1.code,
            productName: p1.name,
            quantity: purchaseQty,
            costPrice: p1.costPrice,
            lineTotal: costTotal,
          },
        },
      },
    });

    // Update Product Stock
    await prisma.product.update({
      where: { id: p1.id },
      data: { stockQty: { increment: purchaseQty } },
    });

    // Update Stock Movement
    await prisma.stockMovement.create({
      data: {
        productId: p1.id,
        movementType: 'PURCHASE_IN',
        referenceType: 'PURCHASE',
        referenceId: purchase.id,
        quantityIn: purchaseQty,
        quantityOut: 0,
        balanceAfter: p1.stockQty + purchaseQty,
        description: `Purchased ${purchaseQty} units of Teak Sofa. Purchase: ${purchaseNo}`,
      },
    });

    // Supplier Ledger - Grand Total Credit
    await prisma.supplierLedger.create({
      data: {
        supplierId: supplier.id,
        transactionType: 'PURCHASE',
        referenceNo: purchaseNo,
        description: 'Inventory Purchase - Grand Total',
        debit: 0,
        credit: purchaseGrandTotal,
        balanceAfter: supplier.currentBalance + purchaseGrandTotal,
      },
    });

    // Supplier Ledger - Paid Amount Debit
    if (paidAmt > 0) {
      await prisma.supplierLedger.create({
        data: {
          supplierId: supplier.id,
          transactionType: 'PAYMENT',
          referenceNo: purchaseNo,
          description: 'Payment made on Purchase',
          debit: paidAmt,
          credit: 0,
          balanceAfter: supplier.currentBalance + purchaseGrandTotal - paidAmt,
        },
      });

      // Supplier Payment
      await prisma.supplierPayment.create({
        data: {
          paymentNumber: 'SPAY-2026-0001',
          supplierId: supplier.id,
          purchaseId: purchase.id,
          date: new Date(),
          amount: paidAmt,
          paymentMethod: 'Bank Transfer',
          referenceNumber: 'TXN99887766',
          notes: 'Advance paid for sofa delivery.',
        },
      });
    }

    // Update Supplier currentBalance
    await prisma.supplier.update({
      where: { id: supplier.id },
      data: { currentBalance: { increment: balAmt } },
    });

    console.log('Sample purchase seeded.');
  }

  // 9. Create a sample Invoice (Decreases stock, updates customer ledger)
  const invoiceNo = 'INV-2026-0001';
  const checkInvoice = await prisma.invoice.findUnique({
    where: { invoiceNumber: invoiceNo },
  });

  if (!checkInvoice) {
    const p2 = products[1]; // King Size Mahogany Bed
    const saleQty = 1;
    const subtotalAmt = p2.sellingPrice * saleQty;
    const invDiscount = 5000;
    const delCharge = 2500;
    const instCharge = 1000;
    const invGrandTotal = subtotalAmt - invDiscount + delCharge + instCharge;
    const paidAmt = 60000;
    const balAmt = invGrandTotal - paidAmt;

    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber: invoiceNo,
        customerId: customer.id,
        customerPhone: customer.phone,
        customerAddress: customer.address,
        salesperson: 'Kamal Perera (Sales)',
        subtotal: subtotalAmt,
        discount: invDiscount,
        deliveryCharge: delCharge,
        installationCharge: instCharge,
        grandTotal: invGrandTotal,
        paidAmount: paidAmt,
        balanceAmount: balAmt,
        paymentMethod: 'Cash',
        paymentStatus: 'PARTIAL',
        notes: 'Customer bought solid Mahogany box bed. Scheduled delivery.',
        items: {
          create: {
            productId: p2.id,
            productCode: p2.code,
            productName: p2.name,
            quantity: saleQty,
            unitPrice: p2.sellingPrice,
            discount: 0,
            lineTotal: subtotalAmt,
            warrantyPeriod: p2.warrantyPeriod,
          },
        },
      },
      include: {
        items: true,
      },
    });

    // Reduce Product Stock
    await prisma.product.update({
      where: { id: p2.id },
      data: { stockQty: { decrement: saleQty } },
    });

    // Stock Movement
    await prisma.stockMovement.create({
      data: {
        productId: p2.id,
        movementType: 'SALE_OUT',
        referenceType: 'INVOICE',
        referenceId: invoice.id,
        quantityIn: 0,
        quantityOut: saleQty,
        balanceAfter: p2.stockQty - saleQty,
        description: `Sold ${saleQty} units. Invoice: ${invoiceNo}`,
      },
    });

    // Customer Ledger - Debit for Grand Total
    await prisma.customerLedger.create({
      data: {
        customerId: customer.id,
        transactionType: 'INVOICE',
        referenceNo: invoiceNo,
        description: 'Invoice Sale - Grand Total',
        debit: invGrandTotal,
        credit: 0,
        balanceAfter: customer.currentBalance + invGrandTotal,
      },
    });

    // Customer Ledger - Credit for Paid Amount
    if (paidAmt > 0) {
      await prisma.customerLedger.create({
        data: {
          customerId: customer.id,
          transactionType: 'PAYMENT',
          referenceNo: invoiceNo,
          description: 'Payment received on Invoice',
          debit: 0,
          credit: paidAmt,
          balanceAfter: customer.currentBalance + invGrandTotal - paidAmt,
        },
      });

      // Customer Payment Record
      await prisma.payment.create({
        data: {
          paymentNumber: 'PAY-2026-0001',
          customerId: customer.id,
          invoiceId: invoice.id,
          date: new Date(),
          amount: paidAmt,
          paymentMethod: 'Cash',
          notes: 'Paid cash at counter.',
        },
      });
    }

    // Update Customer currentBalance
    const finalCustomer = await prisma.customer.update({
      where: { id: customer.id },
      data: { currentBalance: { increment: balAmt } },
    });

    // Create a Delivery Schedule
    await prisma.delivery.create({
      data: {
        deliveryNumber: 'DEL-2026-0001',
        invoiceId: invoice.id,
        customerName: customer.name,
        phone: customer.phone,
        address: customer.address,
        deliveryDate: new Date(Date.now() + 24 * 60 * 60 * 1000 * 2), // 2 days later
        deliveryTime: 'Morning (10:00 AM - 1:00 PM)',
        driverName: 'Rohan de Silva',
        vehicleNumber: 'WP LG-4455',
        deliveryCharge: delCharge,
        deliveryStatus: 'Scheduled',
        notes: 'Be careful with polished finish. Bring helpers for loading.',
      },
    });

    // Create Warranty entry
    const invItem = invoice.items[0];
    await prisma.warranty.create({
      data: {
        invoiceItemId: invItem.id,
        productId: p2.id,
        customerId: customer.id,
        startDate: new Date(),
        endDate: new Date(Date.now() + 365 * 10 * 24 * 60 * 60 * 1000), // 10 years
        period: p2.warrantyPeriod || '10 Years',
        status: 'Active',
        notes: 'Structure warranty only.',
      },
    });

    console.log('Sample invoice seeded.');
  }

  // 10. Create a sample Quotation
  const qtnNo = 'QTN-2026-0001';
  const checkQuotation = await prisma.quotation.findUnique({
    where: { quotationNumber: qtnNo },
  });

  if (!checkQuotation) {
    const p3 = products[2]; // 6-Seater Teak Dining Table
    const qty = 1;
    const totalAmt = p3.sellingPrice * qty;

    await prisma.quotation.create({
      data: {
        quotationNumber: qtnNo,
        customerId: customer.id,
        subtotal: totalAmt,
        discount: 3000,
        deliveryCharge: 1500,
        installationCharge: 500,
        totalAmount: totalAmt - 3000 + 1500 + 500,
        validUntil: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days valid
        notes: 'Teak Natural polish. Special discount applied for recurring client.',
        status: 'Sent',
        items: {
          create: {
            productId: p3.id,
            productCode: p3.code,
            productName: p3.name,
            quantity: qty,
            unitPrice: p3.sellingPrice,
            discount: 0,
            lineTotal: totalAmt,
          },
        },
      },
    });
    console.log('Sample quotation seeded.');
  }

  // 11. Create a sample Order
  const ordNo = 'ORD-2026-0001';
  const checkOrder = await prisma.order.findUnique({
    where: { orderNumber: ordNo },
  });

  if (!checkOrder) {
    const p4 = products[3]; // Wooden Easy Chair
    const qty = 2;
    const subtotalAmt = p4.sellingPrice * qty;
    const advancePaid = 10000;
    const orderTotal = subtotalAmt; // 19500 * 2 = 39000
    const balAmt = orderTotal - advancePaid;

    const order = await prisma.order.create({
      data: {
        orderNumber: ordNo,
        customerId: customer.id,
        orderDate: new Date(),
        expectedDeliveryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 1 week
        subtotal: subtotalAmt,
        discount: 0,
        deliveryCharge: 0,
        installationCharge: 0,
        totalAmount: orderTotal,
        advancePayment: advancePaid,
        balanceAmount: balAmt,
        orderStatus: 'Pending',
        deliveryStatus: 'Not Scheduled',
        notes: 'Needs custom cushion covers in Maroon color.',
        items: {
          create: {
            productId: p4.id,
            productCode: p4.code,
            productName: p4.name,
            quantity: qty,
            unitPrice: p4.sellingPrice,
            discount: 0,
            lineTotal: subtotalAmt,
          },
        },
      },
    });

    // Update Customer Ledger (Debit for order, Credit for advance payment)
    const currentCust = await prisma.customer.findUnique({
      where: { id: customer.id },
    });

    await prisma.customerLedger.create({
      data: {
        customerId: customer.id,
        transactionType: 'ORDER',
        referenceNo: ordNo,
        description: 'Customer Order Reserve',
        debit: orderTotal,
        credit: 0,
        balanceAfter: currentCust.currentBalance + orderTotal,
      },
    });

    await prisma.customerLedger.create({
      data: {
        customerId: customer.id,
        transactionType: 'PAYMENT',
        referenceNo: ordNo,
        description: 'Order Advance Payment',
        debit: 0,
        credit: advancePaid,
        balanceAfter: currentCust.currentBalance + orderTotal - advancePaid,
      },
    });

    await prisma.customer.update({
      where: { id: customer.id },
      data: { currentBalance: { increment: balAmt } },
    });

    // Create general payment allocation record
    await prisma.payment.create({
      data: {
        paymentNumber: 'PAY-2026-0002',
        customerId: customer.id,
        orderId: order.id,
        date: new Date(),
        amount: advancePaid,
        paymentMethod: 'Cash',
        notes: 'Order advance payment.',
      },
    });

    console.log('Sample order seeded.');
  }

  // 12. Create a sample Expense
  await prisma.expense.create({
    data: {
      date: new Date(),
      expenseType: 'STAFF_SALARY',
      amount: 45000,
      paidTo: 'Nimal Silva & Staff',
      paymentMethod: 'Bank Transfer',
      description: 'Mid-month staff advance salary payout.',
    },
  });
  await prisma.expense.create({
    data: {
      date: new Date(),
      expenseType: 'DELIVERY_FUEL',
      amount: 8500,
      paidTo: 'Ceypetco Fuel Station',
      paymentMethod: 'Cash',
      description: 'Diesel for WP LG-4455 delivery truck.',
    },
  });
  console.log('Sample expenses seeded.');

  console.log('Database seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
