import prisma from '../config/database.js';

/**
 * Generate a unique customer code
 * Format: [PREFIX]-[YYYYMMDD]-[HHMMSS]-[RANDOM6]
 * Example: ORG-20260315-143022-7F3D2A
 */
export const generateCustomerCode = async (type) => {
  const prefix = type === 'ORGANIZATION' ? 'ORG' : 'IND';
  
  // Get current date and time components
  const now = new Date();
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD
  const timePart = now.toISOString().slice(11, 19).replace(/:/g, ''); // HHMMSS
  
  // Generate random hex string (6 characters = 16.7 million possibilities)
  const randomPart = Math.random().toString(16).substring(2, 8).toUpperCase();
  
  // Combine all parts
  const customerCode = `${prefix}-${datePart}-${timePart}-${randomPart}`;
  
  // Verify uniqueness in database (optional but recommended)
  const existing = await prisma.customer.findUnique({
    where: { code: customerCode }
  }).catch(() => null);
  
  // If collision occurs (extremely rare), recursively generate new one
  if (existing) {
    return generateCustomerCode(type);
  }
  
  return customerCode;
};

/**
 * Generate a unique invoice number.
 * Keep it compact so it fits cleanly across UI, PDFs, and printouts.
 * Format: INV-[YYMMDD]-[RANDOM5]
 * Example: INV-260315-A7F3K
 */
export const generateInvoiceNumber = async () => {
  const now = new Date();
  const datePart = now.toISOString().slice(2, 10).replace(/-/g, ''); // YYMMDD

  // Base36 gives a short alphanumeric suffix with good entropy.
  const randomPart = Math.random().toString(36).substring(2, 7).toUpperCase();

  const invoiceNumber = `INV-${datePart}-${randomPart}`;
  
  // Verify uniqueness in database
  const existing = await prisma.invoice.findUnique({
    where: { invoiceNumber }
  }).catch(() => null);
  
  if (existing) {
    return generateInvoiceNumber();
  }
  
  return invoiceNumber;
};

/**
 * Generate a unique payment reference
 * Format: PAY-[YYYYMMDD]-[HHMMSS]-[RANDOM8]
 * Example: PAY-20260315-143022-9B4F2D7E
 */
export const generatePaymentReference = async () => {
  const now = new Date();
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD
  const timePart = now.toISOString().slice(11, 19).replace(/:/g, ''); // HHMMSS
  
  // Generate random hex string (8 characters = 4.3 billion possibilities)
  const randomPart = Math.random().toString(16).substring(2, 10).toUpperCase();
  
  const paymentReference = `PAY-${datePart}-${timePart}-${randomPart}`;
  
  // Verify uniqueness in database
  const existing = await prisma.payment.findUnique({
    where: { reference: paymentReference }
  }).catch(() => null);
  
  if (existing) {
    return generatePaymentReference();
  }
  
  return paymentReference;
};

/**
 * Alternative: Generate code with nanosecond precision using process.hrtime()
 * For systems requiring maximum uniqueness guarantees
 */
export const generateHighPrecisionCode = (prefix, type = 'generic') => {
  const now = new Date();
  
  // Get high-resolution time (nanoseconds)
  const hrTime = process.hrtime();
  const nanoTime = hrTime[0] * 1e9 + hrTime[1];
  
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
  const timePart = now.toISOString().slice(11, 19).replace(/:/g, '');
  const nanoPart = nanoTime.toString().slice(-8); // Last 8 digits of nanoseconds
  const randomPart = Math.random().toString(36).substring(2, 6).toUpperCase();
  
  return `${prefix}-${datePart}-${timePart}-${nanoPart}-${randomPart}`;
};

// Batch generation utility for creating multiple codes at once
export const generateBatchCodes = async (type, count = 1) => {
  const codes = [];
  const generator = type === 'invoice' ? generateInvoiceNumber :
                   type === 'payment' ? generatePaymentReference :
                   () => generateCustomerCode(type);
  
  for (let i = 0; i < count; i++) {
    // Add small delay to ensure timestamp uniqueness
    if (i > 0) await new Promise(resolve => setTimeout(resolve, 1));
    codes.push(await generator());
  }
  
  return codes;
};