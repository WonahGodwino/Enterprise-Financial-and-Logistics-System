// backend/src/utils/exportUtils.js
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

class ExportUtils {
  /**
   * Export data to Excel
   */
  async exportToExcel(data, options = {}) {
    const {
      sheetName = 'Sheet1',
      columns = [],
      filename = `export_${Date.now()}.xlsx`
    } = options;

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(sheetName);

    // Add columns
    if (columns.length > 0) {
      worksheet.columns = columns;
    } else if (data.length > 0) {
      // Auto-generate columns from first data item
      worksheet.columns = Object.keys(data[0]).map(key => ({
        header: key.charAt(0).toUpperCase() + key.slice(1),
        key: key,
        width: 20
      }));
    }

    // Add rows
    worksheet.addRows(data);

    // Style header row
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    };

    // Generate file
    const filePath = path.join(__dirname, '../../exports', filename);
    await workbook.xlsx.writeFile(filePath);

    return {
      filename,
      path: filePath,
      url: `/exports/${filename}`
    };
  }

  /**
   * Export data to CSV
   */
  exportToCSV(data, options = {}) {
    const {
      headers = [],
      filename = `export_${Date.now()}.csv`,
      delimiter = ','
    } = options;

    let csvContent = '';

    // Add headers
    if (headers.length > 0) {
      csvContent += headers.join(delimiter) + '\n';
    } else if (data.length > 0) {
      csvContent += Object.keys(data[0]).join(delimiter) + '\n';
    }

    // Add rows
    data.forEach(row => {
      const values = Object.values(row).map(value => {
        if (typeof value === 'string' && value.includes(delimiter)) {
          return `"${value}"`;
        }
        return value;
      });
      csvContent += values.join(delimiter) + '\n';
    });

    const filePath = path.join(__dirname, '../../exports', filename);
    fs.writeFileSync(filePath, csvContent);

    return {
      filename,
      path: filePath,
      url: `/exports/${filename}`
    };
  }

  /**
   * Export to PDF
   */
  async exportToPDF(data, options = {}) {
    const {
      title = 'Export Report',
      filename = `export_${Date.now()}.pdf`,
      orientation = 'portrait'
    } = options;

    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: 'A4',
          layout: orientation,
          margin: 50
        });

        const filePath = path.join(__dirname, '../../exports', filename);
        const stream = fs.createWriteStream(filePath);
        doc.pipe(stream);

        // Add title
        doc.fontSize(20).text(title, { align: 'center' });
        doc.moveDown();
        doc.fontSize(10).text(`Generated: ${new Date().toLocaleString()}`, { align: 'right' });
        doc.moveDown();

        // Add data as table
        if (Array.isArray(data) && data.length > 0) {
          this.addTableToPDF(doc, data);
        } else if (typeof data === 'object') {
          this.addObjectToPDF(doc, data);
        }

        doc.end();

        stream.on('finish', () => {
          resolve({
            filename,
            path: filePath,
            url: `/exports/${filename}`
          });
        });

        stream.on('error', reject);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Add table to PDF
   */
  addTableToPDF(doc, data) {
    const headers = Object.keys(data[0]);
    const columnWidth = (doc.page.width - 100) / headers.length;

    // Draw headers
    let y = doc.y;
    headers.forEach((header, i) => {
      doc.rect(50 + (i * columnWidth), y, columnWidth, 20).stroke();
      doc.text(
        header.charAt(0).toUpperCase() + header.slice(1),
        50 + (i * columnWidth) + 5,
        y + 5,
        { width: columnWidth - 10, align: 'left' }
      );
    });

    y += 20;

    // Draw rows
    data.forEach((row, rowIndex) => {
      if (y > doc.page.height - 50) {
        doc.addPage();
        y = 50;
      }

      headers.forEach((header, colIndex) => {
        doc.rect(50 + (colIndex * columnWidth), y, columnWidth, 20).stroke();
        doc.text(
          String(row[header] || ''),
          50 + (colIndex * columnWidth) + 5,
          y + 5,
          { width: columnWidth - 10, align: 'left' }
        );
      });

      y += 20;
    });
  }

  /**
   * Add object to PDF
   */
  addObjectToPDF(doc, obj, indent = 0) {
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'object' && value !== null) {
        doc.text(`${' '.repeat(indent)}${key}:`);
        this.addObjectToPDF(doc, value, indent + 2);
      } else {
        doc.text(`${' '.repeat(indent)}${key}: ${value}`);
      }
    }
  }

  /**
   * Export to JSON
   */
  exportToJSON(data, options = {}) {
    const {
      filename = `export_${Date.now()}.json`,
      pretty = true
    } = options;

    const jsonContent = pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data);
    const filePath = path.join(__dirname, '../../exports', filename);
    
    fs.writeFileSync(filePath, jsonContent);

    return {
      filename,
      path: filePath,
      url: `/exports/${filename}`
    };
  }

  /**
   * Export multiple formats
   */
  async exportMultiFormat(data, formats = ['csv'], options = {}) {
    const results = {};

    for (const format of formats) {
      switch (format.toLowerCase()) {
        case 'excel':
        case 'xlsx':
          results.excel = await this.exportToExcel(data, options);
          break;
        case 'csv':
          results.csv = this.exportToCSV(data, options);
          break;
        case 'pdf':
          results.pdf = await this.exportToPDF(data, options);
          break;
        case 'json':
          results.json = this.exportToJSON(data, options);
          break;
      }
    }

    return results;
  }

  /**
   * Clean old exports
   */
  cleanOldExports(maxAge = 24 * 60 * 60 * 1000) { // 24 hours default
    const exportDir = path.join(__dirname, '../../exports');
    
    if (!fs.existsSync(exportDir)) {
      return;
    }

    const files = fs.readdirSync(exportDir);
    const now = Date.now();

    files.forEach(file => {
      const filePath = path.join(exportDir, file);
      const stats = fs.statSync(filePath);
      const age = now - stats.mtimeMs;

      if (age > maxAge) {
        fs.unlinkSync(filePath);
      }
    });
  }
}

module.exports = new ExportUtils();