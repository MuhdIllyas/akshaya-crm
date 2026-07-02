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

  // --- REPORT 4: Expense Report ---
  if (reportIds.includes(4)) {
    if (data.expenseReport) {
      const sheet = workbook.addWorksheet('Expense Breakdown');
      
      sheet.mergeCells('A1:C1');
      sheet.getCell('A1').value = 'Category-wise Expenses';
      sheet.getCell('A1').font = { size: 16, bold: true };
      
      sheet.getCell('A3').value = 'Period:';
      sheet.getCell('B3').value = `${metadata.fromDate} to ${metadata.toDate}`;

      // Headers
      const headerRow = sheet.addRow(['Expense Category', 'Total Transactions', 'Total Amount']);
      headerRow.font = { bold: true };
      
      // Data
      data.expenseReport.forEach(row => {
        sheet.addRow([row.category, row.transactions, row.amount]);
      });
      
      // Formatting
      sheet.getColumn('A').width = 30;
      sheet.getColumn('C').numFmt = '₹#,##0.00';
    }
  }

  // --- REPORT 6: Cash Flow ---
  if (reportIds.includes(6)) {
    if (data.cashFlow) {
      const sheet = workbook.addWorksheet('Cash Flow');
      
      sheet.mergeCells('A1:D1');
      sheet.getCell('A1').value = 'Daily Cash Flow Report';
      sheet.getCell('A1').font = { size: 16, bold: true };
      
      sheet.getCell('A3').value = 'Period:';
      sheet.getCell('B3').value = `${metadata.fromDate} to ${metadata.toDate}`;

      // Headers
      const headerRow = sheet.addRow(['Date', 'Cash Inflow (Credit)', 'Cash Outflow (Debit)', 'Net Flow']);
      headerRow.font = { bold: true };
      
      // Data
      data.cashFlow.forEach(row => {
        sheet.addRow([row.date, row.inflow, row.outflow, row.net_flow]);
      });
      
      // Formatting
      sheet.getColumn('A').width = 15;
      ['B', 'C', 'D'].forEach(col => sheet.getColumn(col).numFmt = '₹#,##0.00');
    }
  }

  // --- REPORT 7: Ledger Report ---
  if (reportIds.includes(7)) {
    if (data.ledger) {
      const sheet = workbook.addWorksheet('General Ledger');
      
      sheet.mergeCells('A1:E1');
      sheet.getCell('A1').value = 'General Ledger Transactions';
      sheet.getCell('A1').font = { size: 16, bold: true };
      
      sheet.getCell('A3').value = 'Period:';
      sheet.getCell('B3').value = `${metadata.fromDate} to ${metadata.toDate}`;

      // Headers
      const headerRow = sheet.addRow(['Date & Time', 'Wallet', 'Transaction Type', 'Category', 'Amount']);
      headerRow.font = { bold: true };
      
      // Data
      data.ledger.forEach(row => {
        sheet.addRow([
          new Date(row.date).toLocaleString('en-IN'), 
          row.wallet, 
          row.type.toUpperCase(), 
          row.category, 
          row.amount
        ]);
      });
      
      // Formatting
      sheet.getColumn('A').width = 22;
      sheet.getColumn('B').width = 15;
      sheet.getColumn('C').width = 18;
      sheet.getColumn('D').width = 25;
      sheet.getColumn('E').numFmt = '₹#,##0.00';
    }
  }

  // --- REPORT 8: Pending Collections ---
  if (reportIds.includes(8)) {
    if (data.pendingCollections) {
      const sheet = workbook.addWorksheet('Pending Collections');
      
      sheet.mergeCells('A1:F1');
      sheet.getCell('A1').value = 'Pending Customer Payments';
      sheet.getCell('A1').font = { size: 16, bold: true };
      
      sheet.getCell('A3').value = 'Period:';
      sheet.getCell('B3').value = `${metadata.fromDate} to ${metadata.toDate}`;

      // Headers
      const headerRow = sheet.addRow(['Date', 'Customer Name', 'Phone', 'Service', 'Total Charges', 'Balance Due']);
      headerRow.font = { bold: true };
      
      // Data
      data.pendingCollections.forEach(row => {
        sheet.addRow([
          new Date(row.date).toLocaleDateString('en-IN'), 
          row.customer_name, 
          row.phone, 
          row.service_name, 
          row.total_charges, 
          row.balance_due
        ]);
      });
      
      // Formatting
      sheet.getColumn('A').width = 15;
      sheet.getColumn('B').width = 25;
      sheet.getColumn('C').width = 15;
      sheet.getColumn('D').width = 30;
      sheet.getColumn('E').numFmt = '₹#,##0.00';
      sheet.getColumn('F').numFmt = '₹#,##0.00';
    }
  }

  // --- REPORT 9: Attendance Report ---
  if (reportIds.includes(9)) {
    if (data.attendanceReport) {
      const sheet = workbook.addWorksheet('Staff Attendance');
      
      sheet.mergeCells('A1:F1');
      sheet.getCell('A1').value = 'Staff Attendance Log';
      sheet.getCell('A1').font = { size: 16, bold: true };
      
      sheet.getCell('A3').value = 'Period:';
      sheet.getCell('B3').value = `${metadata.fromDate} to ${metadata.toDate}`;

      // Headers
      const headerRow = sheet.addRow(['Date', 'Staff Name', 'Status', 'Check-In', 'Check-Out', 'Late (Mins)']);
      headerRow.font = { bold: true };
      
      // Data
      data.attendanceReport.forEach(row => {
        sheet.addRow([
          new Date(row.date).toLocaleDateString('en-IN'), 
          row.staff_name, 
          row.status.toUpperCase(), 
          row.check_in, 
          row.check_out, 
          row.late_minutes
        ]);
      });
      
      // Formatting
      sheet.getColumn('A').width = 15;
      sheet.getColumn('B').width = 25;
      sheet.getColumn('C').width = 15;
    }
  }

  // --- REPORT 10: Staff Performance ---
  if (reportIds.includes(10)) {
    if (data.performanceReport) {
      const sheet = workbook.addWorksheet('Staff Performance');
      
      sheet.mergeCells('A1:E1');
      sheet.getCell('A1').value = 'Staff Productivity & Revenue';
      sheet.getCell('A1').font = { size: 16, bold: true };
      
      sheet.getCell('A3').value = 'Period:';
      sheet.getCell('B3').value = `${metadata.fromDate} to ${metadata.toDate}`;

      // Headers
      const headerRow = sheet.addRow(['Staff Name', 'Role', 'Services Completed', 'Total Revenue', 'Gross Profit']);
      headerRow.font = { bold: true };
      
      // Data
      data.performanceReport.forEach(row => {
        sheet.addRow([
          row.staff_name, 
          row.role.toUpperCase(), 
          row.total_services, 
          row.total_revenue, 
          row.gross_profit
        ]);
      });
      
      // Formatting
      sheet.getColumn('A').width = 25;
      sheet.getColumn('B').width = 15;
      sheet.getColumn('D').numFmt = '₹#,##0.00';
      sheet.getColumn('E').numFmt = '₹#,##0.00';
    }
  }

  // --- REPORT 11: Salary Report ---
  if (reportIds.includes(11)) {
    if (data.salaryReport) {
      const sheet = workbook.addWorksheet('Payroll Summary');
      
      sheet.mergeCells('A1:G1');
      sheet.getCell('A1').value = 'Staff Payroll Summary';
      sheet.getCell('A1').font = { size: 16, bold: true };
      
      sheet.getCell('A3').value = 'Period:';
      sheet.getCell('B3').value = `${metadata.fromDate} to ${metadata.toDate}`;

      // Headers
      const headerRow = sheet.addRow(['Month', 'Staff Name', 'Attendance', 'Basic Pay', 'Allowances', 'Deductions', 'Net Salary', 'Status']);
      headerRow.font = { bold: true };
      
      // Data
      data.salaryReport.forEach(row => {
        sheet.addRow([
          row.month, 
          row.staff_name, 
          `${row.present_days}/${row.working_days} Days`, 
          row.basic, 
          row.total_allowances, 
          row.deductions, 
          row.net_salary,
          row.status.toUpperCase()
        ]);
      });
      
      // Formatting
      sheet.getColumn('B').width = 25;
      ['D', 'E', 'F', 'G'].forEach(col => sheet.getColumn(col).numFmt = '₹#,##0.00');
    }
  }

  // --- REPORT 12: Incentive Report ---
  if (reportIds.includes(12)) {
    if (data.incentiveReport) {
      const sheet = workbook.addWorksheet('Incentive Planner');
      
      sheet.mergeCells('A1:F1');
      sheet.getCell('A1').value = 'Staff KPI & Incentive Suggestions';
      sheet.getCell('A1').font = { size: 16, bold: true };
      
      sheet.getCell('A3').value = 'Period:';
      sheet.getCell('B3').value = `${metadata.fromDate} to ${metadata.toDate}`;

      // Headers
      const headerRow = sheet.addRow(['Staff Name', 'Services', 'Amount Collected', 'Avg Rating', 'KPI Score (out of 100)', 'Suggested Bonus']);
      headerRow.font = { bold: true };
      
      // Data
      data.incentiveReport.forEach(row => {
        sheet.addRow([
          row.staff_name, 
          row.services_completed, 
          row.collected_amount, 
          row.avg_staff_rating > 0 ? `${row.avg_staff_rating} Stars` : 'No Rating', 
          row.incentive_score, 
          row.suggested_bonus
        ]);
      });
      
      // Formatting
      sheet.getColumn('A').width = 25;
      sheet.getColumn('C').numFmt = '₹#,##0.00';
      sheet.getColumn('F').numFmt = '₹#,##0.00';
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

      // --- REPORT 4: Expense Report ---
      if (reportIds.includes(4) && data.expenseReport) {
        doc.fontSize(14).text('Expense Breakdown by Category', { underline: true });
        doc.moveDown(1);
        
        doc.fontSize(10);
        data.expenseReport.forEach(row => { 
          doc.text(`${row.category}: ${row.transactions} transactions | Total: Rs. ${row.amount}`);
        });
        doc.moveDown(2);
      }

      // --- REPORT 6: Cash Flow ---
      if (reportIds.includes(6) && data.cashFlow) {
        doc.fontSize(14).text('Daily Cash Flow Report', { underline: true });
        doc.moveDown(1);
        
        doc.fontSize(10);
        data.cashFlow.forEach(row => { 
          doc.text(`${row.date} | Inflow: Rs. ${row.inflow} | Outflow: Rs. ${row.outflow} | Net: Rs. ${row.net_flow}`);
        });
        doc.moveDown(2);
      }

      // --- REPORT 7: Ledger Report ---
      if (reportIds.includes(7) && data.ledger) {
        doc.fontSize(14).text('General Ledger Transactions', { underline: true });
        doc.moveDown(0.5);
        
        if (data.ledger.length > 100) {
            doc.fontSize(8).fillColor('gray').text(`(Showing first 100 of ${data.ledger.length} transactions. Export to Excel for full ledger.)`);
        }
        doc.moveDown(1);
        
        doc.fontSize(9).fillColor('black');
        data.ledger.slice(0, 100).forEach(row => { 
          const dateStr = new Date(row.date).toLocaleString('en-IN');
          doc.text(`${dateStr} | ${row.wallet} | ${row.type.toUpperCase()} | ${row.category} | Rs. ${row.amount}`);
        });
        doc.moveDown(2);
      }

      // --- REPORT 8: Pending Collections ---
      if (reportIds.includes(8) && data.pendingCollections) {
        doc.fontSize(14).text('Pending Customer Payments', { underline: true });
        doc.moveDown(0.5);
        
        if (data.pendingCollections.length > 100) {
            doc.fontSize(8).fillColor('gray').text(`(Showing top 100 highest balances. Export to Excel for full list.)`);
        }
        doc.moveDown(1);
        
        doc.fontSize(9).fillColor('black');
        data.pendingCollections.slice(0, 100).forEach(row => { 
          doc.text(`${row.customer_name} (${row.phone}) | ${row.service_name} | Due: Rs. ${row.balance_due}`);
        });
        doc.moveDown(2);
      }

      // --- REPORT 9: Staff Attendance ---
      if (reportIds.includes(9) && data.attendanceReport) {
        doc.fontSize(14).text('Staff Attendance Log', { underline: true });
        doc.moveDown(0.5);
        
        if (data.attendanceReport.length > 100) {
            doc.fontSize(8).fillColor('gray').text(`(Showing top 100 records. Export to Excel for full attendance log.)`);
        }
        doc.moveDown(1);
        
        doc.fontSize(9).fillColor('black');
        data.attendanceReport.slice(0, 100).forEach(row => { 
          const dateStr = new Date(row.date).toLocaleDateString('en-IN');
          doc.text(`${dateStr} | ${row.staff_name} | ${row.status.toUpperCase()} | In: ${row.check_in} | Late: ${row.late_minutes}m`);
        });
        doc.moveDown(2);
      }

      // --- REPORT 10: Staff Performance ---
      if (reportIds.includes(10) && data.performanceReport) {
        doc.fontSize(14).text('Staff Productivity & Revenue', { underline: true });
        doc.moveDown(1);
        
        doc.fontSize(9).fillColor('black');
        data.performanceReport.forEach(row => { 
          doc.text(`${row.staff_name} (${row.role}) | Services: ${row.total_services} | Revenue: Rs. ${row.total_revenue} | Profit: Rs. ${row.gross_profit}`);
        });
        doc.moveDown(2);
      }

      // --- REPORT 11: Salary Report ---
      if (reportIds.includes(11) && data.salaryReport) {
        doc.fontSize(14).text('Staff Payroll Summary', { underline: true });
        doc.moveDown(1);
        
        doc.fontSize(9).fillColor('black');
        data.salaryReport.forEach(row => { 
          doc.text(`[${row.month}] ${row.staff_name} | Net: Rs. ${row.net_salary} | Status: ${row.status.toUpperCase()}`);
        });
        doc.moveDown(2);
      }

      // --- REPORT 12: Incentive Report ---
      if (reportIds.includes(12) && data.incentiveReport) {
        doc.fontSize(14).text('Staff KPI & Incentive Planner', { underline: true });
        doc.moveDown(1);
        
        doc.fontSize(9).fillColor('black');
        data.incentiveReport.forEach(row => { 
          doc.text(`${row.staff_name} | Score: ${row.incentive_score}/100 | Collected: Rs. ${row.collected_amount} | Suggested Bonus: Rs. ${row.suggested_bonus}`);
        });
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