// backend/src/utils/reportGenerators.js
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const ChartJS = require('chart.js');
const { createCanvas } = require('canvas');

class ReportGenerators {
  /**
   * Generate expense report
   */
  async generateExpenseReport(data, options = {}) {
    const {
      format = 'excel',
      startDate,
      endDate,
      summary = true
    } = options;

    switch (format) {
      case 'excel':
        return await this.generateExpenseExcel(data, options);
      case 'pdf':
        return await this.generateExpensePDF(data, options);
      case 'csv':
        return this.generateExpenseCSV(data, options);
      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  }

  /**
   * Generate expense report in Excel
   */
  async generateExpenseExcel(data, options) {
    const workbook = new ExcelJS.Workbook();
    
    // Summary sheet
    const summarySheet = workbook.addWorksheet('Summary');
    this.addExpenseSummary(summarySheet, data.summary);

    // Details sheet
    const detailsSheet = workbook.addWorksheet('Details');
    this.addExpenseDetails(detailsSheet, data.details);

    // Category breakdown sheet
    const categorySheet = workbook.addWorksheet('By Category');
    this.addCategoryBreakdown(categorySheet, data.byCategory);

    // Chart sheet
    const chartSheet = workbook.addWorksheet('Charts');
    await this.addExpenseCharts(chartSheet, data);

    return workbook;
  }

  /**
   * Add expense summary to sheet
   */
  addExpenseSummary(sheet, summary) {
    sheet.columns = [
      { header: 'Metric', key: 'metric', width: 30 },
      { header: 'Value', key: 'value', width: 20 }
    ];

    const rows = [
      { metric: 'Total Expenses', value: summary.total },
      { metric: 'Average per Day', value: summary.averagePerDay },
      { metric: 'Highest Category', value: summary.highestCategory },
      { metric: 'Total Transactions', value: summary.transactionCount },
      { metric: 'Period Start', value: summary.periodStart },
      { metric: 'Period End', value: summary.periodEnd }
    ];

    sheet.addRows(rows);

    // Style
    sheet.getRow(1).font = { bold: true };
    sheet.getColumn('value').numFmt = '$#,##0.00';
  }

  /**
   * Add expense details to sheet
   */
  addExpenseDetails(sheet, details) {
    sheet.columns = [
      { header: 'Date', key: 'date', width: 15 },
      { header: 'Category', key: 'category', width: 20 },
      { header: 'Description', key: 'description', width: 40 },
      { header: 'Amount', key: 'amount', width: 15 },
      { header: 'Vehicle', key: 'vehicle', width: 15 },
      { header: 'Driver', key: 'driver', width: 20 },
      { header: 'Status', key: 'status', width: 15 }
    ];

    sheet.addRows(details);

    // Style
    sheet.getRow(1).font = { bold: true };
    sheet.getColumn('amount').numFmt = '$#,##0.00';
  }

  /**
   * Add category breakdown
   */
  addCategoryBreakdown(sheet, byCategory) {
    sheet.columns = [
      { header: 'Category', key: 'category', width: 25 },
      { header: 'Total Amount', key: 'amount', width: 20 },
      { header: 'Percentage', key: 'percentage', width: 15 },
      { header: 'Transaction Count', key: 'count', width: 18 }
    ];

    const total = Object.values(byCategory).reduce((sum, cat) => sum + cat.amount, 0);

    const rows = Object.entries(byCategory).map(([category, data]) => ({
      category,
      amount: data.amount,
      percentage: (data.amount / total * 100).toFixed(2) + '%',
      count: data.count
    }));

    sheet.addRows(rows);

    // Style
    sheet.getRow(1).font = { bold: true };
    sheet.getColumn('amount').numFmt = '$#,##0.00';
  }

  /**
   * Add charts to Excel sheet
   */
  async addExpenseCharts(sheet, data) {
    // Create chart using chart.js
    const canvas = createCanvas(800, 400);
    const ctx = canvas.getContext('2d');

    // Category distribution chart
    const chart = new ChartJS(ctx, {
      type: 'pie',
      data: {
        labels: Object.keys(data.byCategory),
        datasets: [{
          data: Object.values(data.byCategory).map(c => c.amount),
          backgroundColor: [
            '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF'
          ]
        }]
      }
    });

    // Add image to sheet
    const imageId = sheet.workbook.addImage({
      buffer: canvas.toBuffer(),
      extension: 'png'
    });

    sheet.addImage(imageId, {
      tl: { col: 0, row: 0 },
      ext: { width: 800, height: 400 }
    });
  }

  /**
   * Generate expense report in PDF
   */
  async generateExpensePDF(data, options) {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    
    // Title
    doc.fontSize(20).text('Expense Report', { align: 'center' });
    doc.moveDown();
    
    // Period
    doc.fontSize(12).text(`Period: ${options.startDate} to ${options.endDate}`, { align: 'right' });
    doc.moveDown();

    // Summary
    doc.fontSize(16).text('Summary');
    doc.moveDown(0.5);
    
    const summaryY = doc.y;
    this.addPDFSummary(doc, data.summary, summaryY);

    // Details table
    doc.addPage();
    doc.fontSize(16).text('Transaction Details');
    doc.moveDown(0.5);
    
    this.addPDFTable(doc, data.details, [
      { header: 'Date', width: 80 },
      { header: 'Category', width: 100 },
      { header: 'Description', width: 150 },
      { header: 'Amount', width: 80 }
    ]);

    return doc;
  }

  /**
   * Add summary to PDF
   */
  addPDFSummary(doc, summary, startY) {
    const items = [
      ['Total Expenses:', `$${summary.total.toFixed(2)}`],
      ['Average per Day:', `$${summary.averagePerDay.toFixed(2)}`],
      ['Total Transactions:', summary.transactionCount.toString()],
      ['Highest Category:', summary.highestCategory]
    ];

    let y = startY;
    items.forEach(([label, value]) => {
      doc.font('Helvetica-Bold').text(label, 50, y);
      doc.font('Helvetica').text(value, 200, y);
      y += 20;
    });
  }

  /**
   * Add table to PDF
   */
  addPDFTable(doc, data, columns) {
    let y = doc.y;
    const startX = 50;

    // Headers
    doc.font('Helvetica-Bold');
    let x = startX;
    columns.forEach(col => {
      doc.text(col.header, x, y);
      x += col.width;
    });

    y += 20;
    doc.font('Helvetica');

    // Rows
    data.forEach(row => {
      if (y > doc.page.height - 50) {
        doc.addPage();
        y = 50;
      }

      x = startX;
      columns.forEach(col => {
        doc.text(row[col.header.toLowerCase()] || '', x, y, {
          width: col.width - 10
        });
        x += col.width;
      });

      y += 20;
    });
  }

  /**
   * Generate expense report in CSV
   */
  generateExpenseCSV(data, options) {
    const rows = [];
    
    // Headers
    rows.push(['Date', 'Category', 'Description', 'Amount', 'Vehicle', 'Driver', 'Status'].join(','));

    // Data
    data.details.forEach(row => {
      rows.push([
        row.date,
        `"${row.category}"`,
        `"${row.description}"`,
        row.amount,
        `"${row.vehicle}"`,
        `"${row.driver}"`,
        row.status
      ].join(','));
    });

    return rows.join('\n');
  }

  /**
   * Generate fuel consumption report
   */
  async generateFuelReport(data, options) {
    // Similar structure to expense report but with fuel-specific data
    // Implementation would follow similar pattern
  }

  /**
   * Generate vehicle utilization report
   */
  async generateVehicleUtilizationReport(data, options) {
    // Implementation for vehicle utilization
  }

  /**
   * Generate maintenance report
   */
  async generateMaintenanceReport(data, options) {
    // Implementation for maintenance
  }

  /**
   * Generate driver performance report
   */
  async generateDriverPerformanceReport(data, options) {
    // Implementation for driver performance
  }
}

module.exports = new ReportGenerators();