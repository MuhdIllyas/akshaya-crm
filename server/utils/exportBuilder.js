import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';

// ==========================================
// EXCEL GENERATOR
// ==========================================
export const buildExcel = async (reportData, reportIds) => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Akshaya CRM';
  workbook.created = new Date();

  const { metadata, data } = reportData;

  // --- REPORT 1 & 2: Financial Summary & P&L ---
  if (reportIds.includes(1) || reportIds.includes(2)) {
    if (data.financials) {
      const sheet = workbook.addWorksheet('Financial Summary');
      
      // Title
      sheet.mergeCells('A1:B1');
      sheet.getCell('A1').value = 'Financial Summary & P&L';
      sheet.getCell('A1').font = { size: 16, bold: true };
      
      // Metadata
      sheet.getCell('A3').value = 'Date Generated:';
      sheet.getCell('B3').value = new Date(metadata.generatedAt).toLocaleDateString();
      sheet.getCell('A4').value = 'Period:';
      sheet.getCell('B4').value = `${metadata.fromDate} to ${metadata.toDate}`;

      // Today's Stats
      sheet.getCell('A6').value = "Today's Overview";
      sheet.getCell('A6').font = { bold: true };
      
      sheet.addRow(['Revenue Collected', data.financials.today.revenueCollected]);
      sheet.addRow(['Operating Expenses', data.financials.today.operatingExpenses]);
      sheet.addRow(['Net Profit', data.financials.today.netProfit]);
      
      // Format Currency
      sheet.getColumn('B').numFmt = '₹#,##0.00';
      sheet.getColumn('A').width = 25;
      sheet.getColumn('B').width = 15;
    }
  }

  // --- REPORT 3 & 15: Service Revenue ---
  if (reportIds.includes(3) || reportIds.includes(15)) {
    if (data.serviceRevenue) {
      const sheet = workbook.addWorksheet('Service Revenue');
      
      sheet.mergeCells('A1:E1');
      sheet.getCell('A1').value = 'Revenue by Services';
      sheet.getCell('A1').font = { size: 16, bold: true };
      
      sheet.getCell('A3').value = 'Period:';
      sheet.getCell('B3').value = `${metadata.fromDate} to ${metadata.toDate}`;

      // Headers
      const headerRow = sheet.addRow(['Service Name', 'Total Requests', 'Revenue Collected', 'Dept Charges', 'Gross Profit']);
      headerRow.font = { bold: true };
      
      // Data
      data.serviceRevenue.forEach(row => {
        sheet.addRow([row.service_name, row.total_requests, row.revenue_collected, row.department_charges, row.gross_profit]);
      });
      
      // Formatting
      sheet.getColumn('A').width = 30;
      sheet.getColumn('C').numFmt = '₹#,##0.00';
      sheet.getColumn('D').numFmt = '₹#,##0.00';
      sheet.getColumn('E').numFmt = '₹#,##0.00';
    }
  }

  // --- REPORT 9: Staff Attendance ---
  if (reportIds.includes(9)) {
    if (data.staff) {
      const sheet = workbook.addWorksheet('Staff Attendance');
      
      sheet.addRow(['Staff Attendance Report']);
      sheet.getCell('A1').font = { size: 14, bold: true };
      sheet.addRow([]); // Blank row
      
      sheet.addRow(['Metric', 'Value']);
      sheet.getRow(3).font = { bold: true };
      
      sheet.addRow(['Total Staff', data.staff.staff.total_staff]);
      sheet.addRow(['Present Today', data.staff.staff.present_today]);
      
      sheet.getColumn('A').width = 20;
    }
  }

  // Generate Buffer
  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
};

// ==========================================
// PDF GENERATOR
// ==========================================
export const buildPDF = (reportData, reportIds) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50 });
      const buffers = [];

      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdfData = Buffer.concat(buffers);
        resolve(pdfData);
      });

      const { metadata, data } = reportData;

      // Header
      doc.fontSize(20).text('Akshaya CRM Business Report', { align: 'center' });
      doc.moveDown();
      doc.fontSize(10).text(`Generated: ${new Date(metadata.generatedAt).toLocaleString()}`);
      doc.text(`Period: ${metadata.fromDate} to ${metadata.toDate}`);
      doc.moveDown(2);

      // --- REPORT 1 & 2: Financial Summary & P&L ---
      if ((reportIds.includes(1) || reportIds.includes(2)) && data.financials) {
        doc.fontSize(14).text('Financial Summary', { underline: true });
        doc.moveDown(0.5);
        
        doc.fontSize(12);
        doc.text(`Revenue Collected: Rs. ${data.financials.today.revenueCollected}`);
        doc.text(`Operating Expenses: Rs. ${data.financials.today.operatingExpenses}`);
        doc.text(`Net Profit: Rs. ${data.financials.today.netProfit}`);
        doc.moveDown(2);
      }

      // --- REPORT 3 & 15: Service Revenue ---
      if ((reportIds.includes(3) || reportIds.includes(15)) && data.serviceRevenue) {
        doc.fontSize(14).text('Service Revenue Breakdown', { underline: true });
        doc.moveDown(1);
        
        doc.fontSize(10);
        data.serviceRevenue.slice(0, 15).forEach(row => { // Show top 15 in PDF summary
          doc.text(`${row.service_name}: ${row.total_requests} requests | Rev: Rs. ${row.revenue_collected} | Profit: Rs. ${row.gross_profit}`);
        });
        doc.moveDown(2);
      }

      // --- REPORT 9: Staff Attendance ---
      if (reportIds.includes(9) && data.staff) {
        doc.fontSize(14).text('Staff Overview', { underline: true });
        doc.moveDown(0.5);
        
        doc.fontSize(12);
        doc.text(`Total Staff: ${data.staff.staff.total_staff}`);
        doc.text(`Present Today: ${data.staff.staff.present_today}`);
        doc.moveDown(2);
      }

      // Finalize the PDF
      doc.end();

    } catch (error) {
      reject(error);
    }
  });
};

// ==========================================
// CSV GENERATOR
// ==========================================
export const buildCSV = async (reportData, reportIds) => {
  // CSVs are flat, so they are best used for lists (like Transactions or Ledgers)
  // Here is a basic implementation that flattens the financial data
  
  const { data } = reportData;
  let csvString = "Category,Value\n";
  
  if (data.financials) {
    csvString += `Revenue Collected,${data.financials.today.revenueCollected}\n`;
    csvString += `Operating Expenses,${data.financials.today.operatingExpenses}\n`;
    csvString += `Net Profit,${data.financials.today.netProfit}\n`;
  }
  
  return Buffer.from(csvString, 'utf-8');
};