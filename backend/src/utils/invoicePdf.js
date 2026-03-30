import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { createHash } from 'crypto';
import { fileURLToPath } from 'url';
import prisma from '../config/database.js';
import bwipjs from 'bwip-js';
import QRCode from 'qrcode';

const formatMoney = (value) => `NGN ${Number(value || 0).toLocaleString(undefined, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
})}`;

const formatDate = (value) => {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('en-NG', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

const formatDateISO = (value) => {
  if (!value) return '';
  return new Date(value).toISOString().split('T')[0];
};

const buildAddressLines = (entity = {}) => {
  const lines = [];
  if (entity.address) lines.push(entity.address);
  
  const location = [entity.city, entity.state, entity.country].filter(Boolean).join(', ');
  if (location) lines.push(location);
  
  return lines;
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendRoot = path.resolve(__dirname, '../../');

const getInitials = (name = '') => {
  const tokens = String(name).trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return 'MC';
  if (tokens.length === 1) return tokens[0].slice(0, 2).toUpperCase();
  return `${tokens[0][0]}${tokens[1][0]}`.toUpperCase();
};

const resolveLogoPath = () => {
  const configured = process.env.INVOICE_LOGO_PATH ? path.resolve(process.env.INVOICE_LOGO_PATH) : null;
  const candidates = [
    configured,
    path.join(backendRoot, 'uploads', 'images', 'logo.png'),
    path.join(backendRoot, 'uploads', 'images', 'logo.jpg'),
    path.join(backendRoot, 'uploads', 'images', 'logo.jpeg'),
    path.join(backendRoot, 'uploads', 'images', 'logo.webp'),
  ].filter(Boolean);

  return candidates.find((candidate) => fs.existsSync(candidate)) || null;
};

const drawLogo = (doc, companyName, x, y, size) => {
  const logoPath = resolveLogoPath();

  if (logoPath) {
    try {
      // Add subtle shadow effect behind logo
      doc.save();
      doc.roundedRect(x - 1, y - 1, size + 2, size + 2, 12)
         .fillColor('#f0f0f0')
         .fill();
      doc.restore();
      doc.image(logoPath, x, y, { fit: [size, size], align: 'center', valign: 'center' });
      return true;
    } catch (error) {
      console.error('Error loading logo:', error);
    }
  }

  // Premium gradient-like effect for initials
  doc.save();
  doc.roundedRect(x, y, size, size, 12)
     .fillColor('#1a2b3c')  // Deep navy blue
     .fill();
  doc.restore();
  
  doc.fillColor('#ffffff')
    .font('Helvetica-Bold')
    .fontSize(22)
    .text(initials, x, y + (size - 22) / 2, {
      width: size,
      align: 'center',
    });
  return false;
};

/**
 * Generate invoice data string for barcode encoding
 */
const generateInvoiceDataString = (invoice, companyName) => {
  const items = invoice.items || [];
  const itemsSummary = items.map(item => 
    `${item.quantity}x${item.description?.substring(0,10)}`
  ).join('|');
  
  const dataString = [
    'INV',
    invoice.invoiceNumber,
    formatDateISO(invoice.issueDate),
    formatDateISO(invoice.dueDate),
    invoice.customer?.id || '',
    invoice.totalAmount,
    invoice.status || 'DRAFT',
    itemsSummary,
    companyName
  ].join('|');
  
  const checksum = createHash('md5')
    .update(dataString)
    .digest('hex')
    .substring(0, 8)
    .toUpperCase();
  
  return `${dataString}|${checksum}`;
};

/**
 * Generate multiple barcode formats for the invoice
 */
const generateBarcodes = async (invoice, companyName) => {
  const barcodes = {};
  const invoiceData = generateInvoiceDataString(invoice, companyName);
  
  try {
    const code128Buffer = await new Promise((resolve, reject) => {
      bwipjs.toBuffer({
        bcid: 'code128',
        text: invoice.invoiceNumber,
        scale: 3,
        height: 10,
        includetext: true,
        textxalign: 'center',
        textsize: 8,
        backgroundcolor: 'ffffff',
        barcolor: '1a2b3c',
      }, (err, buffer) => {
        if (err) reject(err);
        else resolve(buffer);
      });
    });
    barcodes.code128 = code128Buffer;
    
    const qrCodeBuffer = await QRCode.toBuffer(invoiceData, {
      errorCorrectionLevel: 'H',
      margin: 1,
      width: 150,
      color: {
        dark: '#1a2b3c',
        light: '#ffffff'
      }
    });
    barcodes.qrcode = qrCodeBuffer;
    
    const pdf417Buffer = await new Promise((resolve, reject) => {
      bwipjs.toBuffer({
        bcid: 'pdf417',
        text: invoiceData,
        scale: 2,
        rows: 10,
        columns: 5,
        height: 5,
        includetext: false,
        backgroundcolor: 'ffffff',
        barcolor: '1a2b3c',
      }, (err, buffer) => {
        if (err) reject(err);
        else resolve(buffer);
      });
    });
    barcodes.pdf417 = pdf417Buffer;
    
  } catch (error) {
    console.error('Error generating barcodes:', error);
  }
  
  return barcodes;
};

/**
 * Draw barcodes on the invoice
 */
const drawBarcodes = async (doc, invoice, companyName, startY) => {
  const barcodes = await generateBarcodes(invoice, companyName);
  const pageLeft = 50;
  const pageWidth = 495;
  
  // Elegant barcode section with subtle gradient
  doc.save();
  doc.rect(pageLeft, startY - 15, pageWidth, 140)
     .fillColor('#f5f7fa')  // Light blue-gray background
     .fill();
  doc.restore();
  
  // Decorative top border
  doc.save();
  doc.rect(pageLeft, startY - 15, pageWidth, 4)
     .fillColor('#1a2b3c')
     .fill();
  doc.restore();
  
  let currentX = pageLeft + 25;
  
  // 1. Code128 (Invoice Number)
  if (barcodes.code128) {
    doc.fillColor('#1a2b3c')
      .font('Helvetica-Bold')
      .fontSize(9)
      .text('INVOICE NUMBER', currentX, startY, { width: 130, align: 'center' });
    
    doc.image(barcodes.code128, currentX, startY + 15, { 
      width: 130,
      height: 35
    });
    
    doc.font('Helvetica')
      .fontSize(8)
      .fillColor('#4a5568')
      .text(invoice.invoiceNumber, currentX, startY + 55, { 
        width: 130, 
        align: 'center' 
      });
    
    // Add subtle border
    doc.save();
    doc.rect(currentX - 5, startY - 5, 140, 75)
       .lineWidth(0.5)
       .strokeColor('#e2e8f0')
       .stroke();
    doc.restore();
    
    currentX += 155;
  }
  
  // 2. QR Code (Full Data)
  if (barcodes.qrcode) {
    doc.fillColor('#1a2b3c')
      .font('Helvetica-Bold')
      .fontSize(9)
      .text('VERIFICATION QR', currentX, startY, { width: 130, align: 'center' });
    
    doc.image(barcodes.qrcode, currentX + 15, startY + 10, {
      width: 100,
      height: 100
    });
    
    doc.font('Helvetica')
      .fontSize(7)
      .fillColor('#4a5568')
      .text('Scan to verify', currentX, startY + 115, { 
        width: 130, 
        align: 'center' 
      });
    
    doc.save();
    doc.rect(currentX - 5, startY - 5, 140, 135)
       .lineWidth(0.5)
       .strokeColor('#e2e8f0')
       .stroke();
    doc.restore();
    
    currentX += 155;
  }
  
  // 3. PDF417 (Backup/Detailed Data)
  if (barcodes.pdf417) {
    doc.fillColor('#1a2b3c')
      .font('Helvetica-Bold')
      .fontSize(9)
      .text('DETAILED DATA', currentX, startY, { width: 130, align: 'center' });
    
    doc.image(barcodes.pdf417, currentX, startY + 20, {
      width: 130,
      height: 45
    });
    
    doc.font('Helvetica')
      .fontSize(7)
      .fillColor('#4a5568')
      .text('Complete invoice data', currentX, startY + 70, { 
        width: 130, 
        align: 'center' 
      });
    
    doc.save();
    doc.rect(currentX - 5, startY - 5, 140, 95)
       .lineWidth(0.5)
       .strokeColor('#e2e8f0')
       .stroke();
    doc.restore();
  }
  
  // Verification badge
  doc.save();
  doc.rect(pageLeft + pageWidth - 120, startY + 95, 100, 20)
     .fillColor('#10b981')
     .fill();
  doc.restore();
  
  doc.fillColor('#ffffff')
    .font('Helvetica-Bold')
    .fontSize(8)
    .text('✓ DIGITALLY VERIFIED', pageLeft + pageWidth - 120, startY + 100, {
      width: 100,
      align: 'center'
    });
  
  return startY + 135;
};

export const generateInvoicePdfBuffer = async (invoice) => new Promise(async (resolve, reject) => {
  const doc = new PDFDocument({ 
    size: 'A4', 
    margin: 50,
    bufferPages: true,
    info: {
      Title: `Invoice ${invoice.invoiceNumber}`,
      Author: 'Mapsi Group',
      Subject: 'Invoice',
      Keywords: 'invoice, billing, barcode, qrcode',
      Creator: 'Mapsi Group Invoice Generator'
    }
  });
  
  const chunks = [];
  doc.on('data', (chunk) => chunks.push(chunk));
  doc.on('end', () => resolve(Buffer.concat(chunks)));
  doc.on('error', reject);

  // Get customer name
  const customerName = invoice.customer?.companyName
    || [invoice.customer?.firstName, invoice.customer?.lastName].filter(Boolean).join(' ')
    || invoice.customer?.email
    || 'N/A';

  // Get company details
  const mainCompany = await prisma.subsidiary.findFirst({
    where: { code: 'MAIN' },
    select: {
      name: true,
      address: true,
      city: true,
      state: true,
      country: true,
      phone: true,
      email: true,
    },
  }).catch(() => null);

  const primaryCompanyName = mainCompany?.name || 'Mapsi Group';
  const mainAddressLines = buildAddressLines(mainCompany || {});
  const subsidiaryName = invoice.subsidiary?.name || '';
  const showSubsidiaryInHeader = Boolean(
    subsidiaryName
    && subsidiaryName.trim().toLowerCase() !== primaryCompanyName.trim().toLowerCase()
  );

  // Page dimensions
  const pageLeft = 50;
  const pageWidth = 495;
  const pageRight = pageLeft + pageWidth;
  const pageBottom = 750;

  // ===== PROFESSIONAL HEADER SECTION =====
  doc.save();
  // Premium gradient header (navy to steel blue)
  const gradient = doc.linearGradient(pageLeft, 40, pageLeft, 160);
  gradient.stop(0, '#1a2b3c');  // Deep navy
  gradient.stop(1, '#2c3e50');  // Steel blue
  
  doc.rect(pageLeft, 40, pageWidth, 120)
     .fill(gradient);
  doc.restore();

  // Add subtle pattern overlay
  doc.save();
  doc.rect(pageLeft, 40, pageWidth, 120)
     .fillOpacity(0.1)
     .fillColor('#ffffff')
     .fill();
  doc.restore();
  doc.fillOpacity(1);

  // Logo/Initials with premium styling
  const logoSize = 65;
  const logoX = pageLeft + 20;
  const logoY = 47;
  
  // Logo background glow effect
  doc.save();
  doc.roundedRect(logoX - 2, logoY - 2, logoSize + 4, logoSize + 4, 14)
     .fillColor('#ffffff')
     .fill();
  doc.restore();
  
  drawLogo(doc, primaryCompanyName, logoX, logoY, logoSize);

  // Company name with gold accent
  const companyInfoX = logoX + logoSize + 25;
  const companyInfoWidth = 250;
  
  doc.fillColor('#ffffff')
    .font('Helvetica-Bold')
    .fontSize(28)
    .text(primaryCompanyName, companyInfoX, 52, {
      width: companyInfoWidth,
    });

  if (showSubsidiaryInHeader) {
    doc.font('Helvetica')
      .fontSize(11)
      .fillColor('#a0b8d4')  // Light steel blue
      .text(subsidiaryName, companyInfoX, 88, {
        width: companyInfoWidth,
      });
  }

  if (mainAddressLines.length > 0) {
    doc.font('Helvetica')
      .fontSize(9)
      .fillColor('#a0b8d4')
      .text(mainAddressLines.join('\n'), companyInfoX, showSubsidiaryInHeader ? 105 : 95, {
        width: companyInfoWidth,
        lineGap: 2,
        characterSpacing: 0.3
      });
  }

  // Invoice metadata with gold accents - FIXED POSITIONING
  const metaX = pageRight - 210;
  const metaWidth = 200;
  
  doc.fillColor('#ffffff')
    .font('Helvetica-Bold')
    .fontSize(22)
    .text('INVOICE', metaX, 47, {
      width: metaWidth,
      align: 'right',
      characterSpacing: 1
    });

  // Add gold separator line
  doc.save();
  doc.rect(metaX, 80, metaWidth, 1)
     .fillColor('#c9a84b')  // Gold
     .fill();
  doc.restore();

  // FIXED: Added "Due Date" to metadata to ensure it appears inside header
  const metaDetails = [
    { label: 'Invoice No:', value: invoice.invoiceNumber },
    { label: 'Version:', value: invoice.version || 1 },
    { label: 'Status:', value: invoice.status?.toUpperCase() || 'DRAFT' },
    { label: 'Issue Date:', value: formatDate(invoice.issueDate) },
    { label: 'Due Date:', value: formatDate(invoice.dueDate) },
  ];

  let metaY = 95;
  doc.font('Helvetica').fontSize(9);
  
  metaDetails.forEach((detail, index) => {
    const y = metaY + (index * 16);
    
    doc.fillColor('#a0b8d4')
      .text(detail.label, metaX, y, { 
        width: 85, 
        align: 'left' 
      });
    
    doc.fillColor('#ffffff')
      .font('Helvetica-Bold')
      .text(detail.value, metaX + 90, y, { 
        width: metaWidth - 90, 
        align: 'right' 
      });
    
    doc.font('Helvetica');
  });

  // ===== BILL TO & COMPANY SECTION =====
  doc.y = 180;
  
  // Add decorative element
  doc.save();
  doc.rect(pageLeft, 175, 3, 40)
     .fillColor('#c9a84b')  // Gold accent
     .fill();
  doc.restore();
  
  // Bill To section
  const billToX = pageLeft + 15;
  const billToWidth = 250;
  
  doc.fillColor('#1a2b3c')
    .font('Helvetica-Bold')
    .fontSize(13)
    .text('BILL TO', billToX, doc.y);
  
  doc.font('Helvetica')
    .fontSize(11)
    .fillColor('#2d3748')
    .text(customerName, billToX, doc.y + 22, { 
      width: billToWidth,
      lineGap: 5
    });

  // FIXED: Reduced spacing between customer name and email
  let contactY = doc.y + 22 + 20; // Fixed spacing instead of dynamic calculation
  if (invoice.customer?.email || invoice.customer?.phone) {
    doc.fontSize(10)
      .fillColor('#4a5568');
    
    if (invoice.customer?.email) {
      // FIXED: Using simple text without special characters that might cause & symbol
      doc.text(`Email: ${invoice.customer.email}`, billToX, contactY);
      contactY += 14;
    }
    if (invoice.customer?.phone) {
      doc.text(`Phone: ${invoice.customer.phone}`, billToX, contactY);
    }
  }

  // Company details on right with gold accent - FIXED EMAIL DISPLAY
  if (mainCompany) {
    const companyDetailsX = pageRight - 200;
    
    doc.fillColor('#1a2b3c')
      .font('Helvetica-Bold')
      .fontSize(13)
      .text('FROM', companyDetailsX, 180, { align: 'right' });
    
    doc.font('Helvetica')
      .fontSize(10)
      .fillColor('#2d3748')
      .text(primaryCompanyName, companyDetailsX, 202, { 
        width: 190,
        align: 'right',
        lineGap: 3
      });

    let companyContactY = 202 + 18; // Fixed spacing
    
    // FIXED: Using "Email:" and "Phone:" labels instead of special characters
    if (mainCompany.email) {
      doc.fontSize(9)
        .fillColor('#4a5568')
        .text(`Email: ${mainCompany.email}`, companyDetailsX, companyContactY, {
          width: 190,
          align: 'right',
        });
      companyContactY += 14;
    }
    
    if (mainCompany.phone) {
      doc.fontSize(9)
        .fillColor('#4a5568')
        .text(`Phone: ${mainCompany.phone}`, companyDetailsX, companyContactY, {
          width: 190,
          align: 'right',
        });
    }
  }

  // ===== ITEMS TABLE =====
  const tableTop = 320; // Adjusted to account for fixed spacing
  
  // Table header with premium styling
  doc.save();
  doc.rect(pageLeft, tableTop - 18, pageWidth, 30)
     .fillColor('#1a2b3c')
     .fill();
  doc.restore();
  
  doc.save();
  doc.rect(pageLeft, tableTop - 18, 3, 30)
     .fillColor('#c9a84b')  // Gold accent
     .fill();
  doc.restore();
  
  const colDescription = pageLeft + 15;
  const colQty = 350;
  const colUnitPrice = 400;
  const colTotal = 470;
  
  doc.fillColor('#ffffff')
    .font('Helvetica-Bold')
    .fontSize(10)
    .text('DESCRIPTION', colDescription, tableTop - 10)
    .text('QTY', colQty, tableTop - 10, { width: 40, align: 'right' })
    .text('UNIT PRICE', colUnitPrice, tableTop - 10, { width: 65, align: 'right' })
    .text('TOTAL', colTotal, tableTop - 10, { width: 70, align: 'right' });

  // Table rows
  let rowY = tableTop + 12;
  const items = invoice.items || [];
  
  if (items.length === 0) {
    doc.font('Helvetica')
      .fontSize(10)
      .fillColor('#6b7280')
      .text('No items', colDescription, rowY);
    rowY += 30;
  } else {
    items.forEach((item, index) => {
      const safeQty = Number(item.quantity || 1);
      const safeDescription = item.description || 'Service';
      const description = `${index + 1}. ${safeDescription}`;
      
      // Alternate row backgrounds with subtle colors
      if (index % 2 === 0) {
        doc.save();
        doc.rect(pageLeft, rowY - 6, pageWidth, 24)
           .fillColor('#f8fafc')  // Very light blue-gray
           .fill();
        doc.restore();
      }
      
      doc.font('Helvetica')
        .fontSize(10)
        .fillColor('#1a2b3c')
        .text(description, colDescription, rowY, { 
          width: colQty - colDescription - 20,
          lineGap: 3
        })
        .text(String(safeQty), colQty, rowY, { 
          width: 40, 
          align: 'right' 
        })
        .text(formatMoney(item.unitPrice), colUnitPrice, rowY, { 
          width: 65, 
          align: 'right' 
        })
        .text(formatMoney(item.totalPrice), colTotal, rowY, { 
          width: 70, 
          align: 'right' 
        });

      rowY += 24;
    });
  }

  // Table bottom line with gold accent
  doc.save();
  doc.rect(pageLeft, rowY - 8, pageWidth, 2)
     .fillColor('#e2e8f0')
     .fill();
  doc.restore();
  
  doc.save();
  doc.rect(pageLeft, rowY - 8, 100, 2)
     .fillColor('#c9a84b')
     .fill();
  doc.restore();

  // ===== TOTALS SECTION =====
  const totalsX = 330;
  const totalsWidth = 215;
  const labelX = totalsX;
  const valueX = totalsX + 120;
  let totalsY = rowY + 10;

  const totals = [
    { label: 'Subtotal', value: invoice.subtotal },
    { label: 'Tax', value: invoice.taxAmount },
    { label: 'Discount', value: invoice.discountAmount, highlight: invoice.discountAmount > 0 },
  ];

  totals.forEach((item) => {
    if (item.highlight) {
      doc.fillColor('#dc2626');
    } else {
      doc.fillColor('#4a5568');
    }
    
    doc.font('Helvetica')
      .fontSize(10)
      .text(item.label, labelX, totalsY)
      .text(formatMoney(item.value), valueX, totalsY, { 
        width: totalsWidth - 120, 
        align: 'right' 
      });
    totalsY += 20;
  });

  // Grand Total with gold background
  totalsY += 5;
  doc.save();
  doc.rect(labelX - 5, totalsY - 5, 180, 28)
     .fillColor('#f8f2e5')  // Light gold background
     .fill();
  doc.restore();
  
  doc.fillColor('#1a2b3c')
    .font('Helvetica-Bold')
    .fontSize(14)
    .text('GRAND TOTAL', labelX, totalsY)
    .text(formatMoney(invoice.totalAmount), valueX, totalsY, { 
      width: totalsWidth - 120, 
      align: 'right' 
    });

  // Payment Info
  totalsY += 35;
  doc.fillColor('#4a5568')
    .font('Helvetica')
    .fontSize(10)
    .text('Amount Paid', labelX, totalsY)
    .text(formatMoney(invoice.amountPaid), valueX, totalsY, { 
      width: totalsWidth - 120, 
      align: 'right' 
    });

  totalsY += 20;
  
  // Balance Due with color coding
  const balanceColor = invoice.balanceDue > 0 ? '#059669' : '#1a2b3c';
  doc.font('Helvetica-Bold')
    .fontSize(12)
    .fillColor(balanceColor)
    .text('BALANCE DUE', labelX, totalsY)
    .text(formatMoney(invoice.balanceDue), valueX, totalsY, { 
      width: totalsWidth - 120, 
      align: 'right' 
    });

  // ===== BARCODE SECTION =====
  const barcodeStartY = totalsY + 35;
  
  if (barcodeStartY < pageBottom - 150) {
    const newY = await drawBarcodes(doc, invoice, primaryCompanyName, barcodeStartY);
    
    // ===== NOTES SECTION =====
    if (invoice.notes) {
      const notesY = newY + 15;
      if (notesY < pageBottom - 40) {
        // Notes header with gold accent
        doc.save();
        doc.rect(pageLeft, notesY - 5, 80, 2)
           .fillColor('#c9a84b')
           .fill();
        doc.restore();
        
        doc.fillColor('#1a2b3c')
          .font('Helvetica-Bold')
          .fontSize(11)
          .text('NOTES', pageLeft, notesY);
        
        doc.font('Helvetica')
          .fontSize(9)
          .fillColor('#4a5568')
          .text(invoice.notes, pageLeft, notesY + 18, {
            width: pageWidth - 200,
            lineGap: 4
          });
      }
    }
  }

  // ===== PROFESSIONAL FOOTER =====
  const footerY = pageBottom;
  
  // Decorative footer line
  doc.save();
  doc.rect(pageLeft, footerY - 20, pageWidth, 1)
     .fillColor('#e2e8f0')
     .fill();
  doc.restore();
  
  doc.save();
  doc.rect(pageLeft, footerY - 20, 150, 2)
     .fillColor('#c9a84b')
     .fill();
  doc.restore();
  
  // Footer text
  doc.fillColor('#4a5568')
    .font('Helvetica')
    .fontSize(8)
    .text(
      `Thank you for your business.`,
      pageLeft,
      footerY - 10,
      { width: pageWidth, align: 'center' }
    );

  doc.fillColor('#1a2b3c')
    .font('Helvetica-Bold')
    .fontSize(9)
    .text(
      primaryCompanyName,
      pageLeft,
      footerY,
      { width: pageWidth, align: 'center' }
    );

  // Verification badge in footer
  doc.save();
  doc.rect(pageLeft + pageWidth - 120, footerY - 5, 100, 18)
     .fillColor('#1a2b3c')
     .fill();
  doc.restore();
  
  doc.fillColor('#ffffff')
    .fontSize(7)
    .text(
      'VERIFIED INVOICE',
      pageLeft + pageWidth - 120,
      footerY,
      { width: 100, align: 'center' }
    );

  doc.fontSize(6)
    .fillColor('#ffffff')
    .text(
      'Scan QR to verify',
      pageLeft + pageWidth - 120,
      footerY + 8,
      { width: 100, align: 'center' }
    );

  doc.end();
});