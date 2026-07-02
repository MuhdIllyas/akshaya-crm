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
      const headerRow = sheet.addRow(['Staff Name', 'Services', 'Service Charge (Profit)', 'Avg Rating', 'KPI Score (out of 100)', 'Suggested Bonus']);
      headerRow.font = { bold: true };
      
      // Data
      data.incentiveReport.forEach(row => {
        sheet.addRow([
          row.staff_name, 
          row.services_completed, 
          row.service_charge_earned, 
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

  // --- REPORT 13: Review Report ---
  if (reportIds.includes(13)) {
    if (data.reviewReport) {
      const sheet = workbook.addWorksheet('Customer Reviews');
      
      sheet.mergeCells('A1:G1');
      sheet.getCell('A1').value = 'Customer Reviews & Feedback';
      sheet.getCell('A1').font = { size: 16, bold: true };
      
      sheet.getCell('A3').value = 'Period:';
      sheet.getCell('B3').value = `${metadata.fromDate} to ${metadata.toDate}`;

      // Headers
      const headerRow = sheet.addRow(['Date', 'Customer Name', 'Phone', 'Service', 'Staff Handled', 'Service Rating', 'Staff Rating', 'Comments']);
      headerRow.font = { bold: true };
      
      // Data
      data.reviewReport.forEach(row => {
        sheet.addRow([
          new Date(row.date).toLocaleDateString('en-IN'), 
          row.customer_name, 
          row.phone,
          row.service_name,
          row.staff_name,
          row.service_rating,
          row.staff_rating || 'N/A',
          row.review_text
        ]);
      });
      
      // Formatting
      sheet.getColumn('A').width = 15;
      sheet.getColumn('B').width = 20;
      sheet.getColumn('D').width = 25;
      sheet.getColumn('H').width = 40; 
    }
  }

  // --- REPORT 14: Leave Report ---
  if (reportIds.includes(14)) {
    if (data.leaveReport) {
      const sheet = workbook.addWorksheet('Leave History');
      
      sheet.mergeCells('A1:H1');
      sheet.getCell('A1').value = 'Staff Leave Applications';
      sheet.getCell('A1').font = { size: 16, bold: true };
      
      sheet.getCell('A3').value = 'Period:';
      sheet.getCell('B3').value = `${metadata.fromDate} to ${metadata.toDate}`;

      // Headers
      const headerRow = sheet.addRow(['Applied On', 'Staff Name', 'Role', 'Leave Type', 'From Date', 'To Date', 'Days', 'Status', 'Reason']);
      headerRow.font = { bold: true };
      
      // Data
      data.leaveReport.forEach(row => {
        sheet.addRow([
          new Date(row.applied_date).toLocaleDateString('en-IN'), 
          row.staff_name, 
          row.role.toUpperCase(),
          row.leave_type,
          new Date(row.from_date).toLocaleDateString('en-IN'),
          new Date(row.to_date).toLocaleDateString('en-IN'),
          row.days_taken,
          row.status.toUpperCase(),
          row.reason
        ]);
      });
      
      // Formatting
      sheet.getColumn('B').width = 20;
      sheet.getColumn('I').width = 40; 
    }
  }

  // --- REPORT 16: Service Profit ---
  if (reportIds.includes(16)) {
    if (data.serviceProfit) {
      const sheet = workbook.addWorksheet('Service Profitability');
      
      sheet.mergeCells('A1:E1');
      sheet.getCell('A1').value = 'Service Profitability Analysis';
      sheet.getCell('A1').font = { size: 16, bold: true };
      
      sheet.getCell('A3').value = 'Period:';
      sheet.getCell('B3').value = `${metadata.fromDate} to ${metadata.toDate}`;

      // Headers
      const headerRow = sheet.addRow(['Service Name', 'Total Requests', 'Total Revenue', 'Govt/Dept Charges', 'Gross Profit']);
      headerRow.font = { bold: true };
      
      // Data
      data.serviceProfit.forEach(row => {
        sheet.addRow([
          row.service_name, 
          row.total_requests, 
          row.revenue_collected, 
          row.department_charges, 
          row.gross_profit
        ]);
      });
      
      // Formatting
      sheet.getColumn('A').width = 35;
      ['C', 'D', 'E'].forEach(col => sheet.getColumn(col).numFmt = '₹#,##0.00');
    }
  }

  // --- REPORT 17: Pending Services ---
  if (reportIds.includes(17)) {
    if (data.pendingServices) {
      const sheet = workbook.addWorksheet('Pending Applications');
      
      sheet.mergeCells('A1:G1');
      sheet.getCell('A1').value = 'Pending Service Applications';
      sheet.getCell('A1').font = { size: 16, bold: true };
      
      sheet.getCell('A3').value = 'Period:';
      sheet.getCell('B3').value = `${metadata.fromDate} to ${metadata.toDate}`;

      // Headers
      const headerRow = sheet.addRow(['Applied Date', 'Token', 'Customer Name', 'Contact', 'Service', 'Assigned Staff', 'Status', 'Days Pending']);
      headerRow.font = { bold: true };
      
      // Data
      data.pendingServices.forEach(row => {
        sheet.addRow([
          new Date(row.date).toLocaleDateString('en-IN'), 
          row.token_id,
          row.customer_name, 
          row.phone,
          row.service_name,
          row.assigned_staff,
          row.status.toUpperCase(),
          row.days_pending
        ]);
      });
      
      // Formatting
      sheet.getColumn('C').width = 20;
      sheet.getColumn('E').width = 30;
      sheet.getColumn('F').width = 20;
    }
  }

  // --- REPORT 18: Completed Services ---
  if (reportIds.includes(18)) {
    if (data.completedServicesReport) {
      const sheet = workbook.addWorksheet('Completed Applications');
      
      sheet.mergeCells('A1:G1');
      sheet.getCell('A1').value = 'Completed Service Applications';
      sheet.getCell('A1').font = { size: 16, bold: true };
      
      sheet.getCell('A3').value = 'Period:';
      sheet.getCell('B3').value = `${metadata.fromDate} to ${metadata.toDate}`;

      // Headers
      const headerRow = sheet.addRow(['Applied Date', 'Completed Date', 'Customer Name', 'Service', 'Staff Handled', 'Final Status', 'Turnaround (Days)']);
      headerRow.font = { bold: true };
      
      // Data
      data.completedServicesReport.forEach(row => {
        sheet.addRow([
          new Date(row.application_date).toLocaleDateString('en-IN'), 
          new Date(row.completion_date).toLocaleDateString('en-IN'), 
          row.customer_name, 
          row.service_name,
          row.assigned_staff,
          row.status.toUpperCase(),
          row.days_taken
        ]);
      });
      
      // Formatting
      sheet.getColumn('C').width = 25;
      sheet.getColumn('D').width = 30;
      sheet.getColumn('E').width = 20;
    }
  }

  // --- REPORT 19: Staff-wise Services ---
  if (reportIds.includes(19)) {
    if (data.staffWiseServices) {
      const sheet = workbook.addWorksheet('Staff Service Breakdown');
      
      sheet.mergeCells('A1:E1');
      sheet.getCell('A1').value = 'Staff-wise Services Breakdown';
      sheet.getCell('A1').font = { size: 16, bold: true };
      
      sheet.getCell('A3').value = 'Period:';
      sheet.getCell('B3').value = `${metadata.fromDate} to ${metadata.toDate}`;

      // Headers
      const headerRow = sheet.addRow(['Staff Name', 'Service Handled', 'Volume (Requests)', 'Revenue Collected', 'Gross Profit']);
      headerRow.font = { bold: true };
      
      // Data
      data.staffWiseServices.forEach(row => {
        sheet.addRow([
          row.staff_name, 
          row.service_name,
          row.total_requests,
          row.revenue_collected,
          row.gross_profit
        ]);
      });
      
      // Formatting
      sheet.getColumn('A').width = 25;
      sheet.getColumn('B').width = 35;
      ['D', 'E'].forEach(col => sheet.getColumn(col).numFmt = '₹#,##0.00');
    }
  }

  // --- REPORT 20: Service Time Analysis ---
  if (reportIds.includes(20)) {
    if (data.serviceTimeReport) {
      const sheet = workbook.addWorksheet('Service Time Analysis');
      
      sheet.mergeCells('A1:F1');
      sheet.getCell('A1').value = 'Service Turnaround Time (TAT) Analysis';
      sheet.getCell('A1').font = { size: 16, bold: true };
      
      sheet.getCell('A3').value = 'Period:';
      sheet.getCell('B3').value = `${metadata.fromDate} to ${metadata.toDate}`;

      // Headers
      const headerRow = sheet.addRow(['Service Name', 'Total Completed', 'Fastest Time (Hrs)', 'Slowest Time (Hrs)', 'Average Time (Hrs)', 'Average Time (Days)']);
      headerRow.font = { bold: true };
      
      // Data
      data.serviceTimeReport.forEach(row => {
        sheet.addRow([
          row.service_name, 
          row.total_requests,
          row.min_hours,
          row.max_hours,
          row.avg_hours,
          (row.avg_hours / 24).toFixed(1)
        ]);
      });
      
      // Formatting
      sheet.getColumn('A').width = 35;
    }
  }

  // --- REPORT 21: Customer Summary ---
  if (reportIds.includes(21)) {
    if (data.customerSummary) {
      const sheet = workbook.addWorksheet('Customer Summary');
      
      sheet.mergeCells('A1:F1');
      sheet.getCell('A1').value = 'Customer Activity & Statistics';
      sheet.getCell('A1').font = { size: 16, bold: true };
      
      sheet.getCell('A3').value = 'Period:';
      sheet.getCell('B3').value = `${metadata.fromDate} to ${metadata.toDate}`;

      // Headers
      const headerRow = sheet.addRow(['Customer Name', 'Phone Number', 'Profile Type', 'Visit Type', 'Services Count', 'Total Spent']);
      headerRow.font = { bold: true };
      
      // Data
      data.customerSummary.forEach(row => {
        sheet.addRow([
          row.customer_name, 
          row.phone,
          row.is_registered ? 'Portal Registered' : 'Walk-in',
          row.is_returning ? 'Returning' : 'New',
          row.total_services,
          row.total_spent
        ]);
      });
      
      // Formatting
      sheet.getColumn('A').width = 25;
      sheet.getColumn('B').width = 15;
      sheet.getColumn('C').width = 20;
      sheet.getColumn('D').width = 15;
      sheet.getColumn('F').numFmt = '₹#,##0.00';
    }
  }

  // --- REPORT 22: ✅ NEW CUSTOMERS ---
  if (reportIds.includes(22)) {
    if (data.newCustomers) {
      const sheet = workbook.addWorksheet('New Customers');
      
      sheet.mergeCells('A1:E1');
      sheet.getCell('A1').value = 'New Customers Acquired';
      sheet.getCell('A1').font = { size: 16, bold: true };
      
      sheet.getCell('A3').value = 'Period:';
      sheet.getCell('B3').value = `${metadata.fromDate} to ${metadata.toDate}`;

      // Headers
      const headerRow = sheet.addRow(['Customer Name', 'Phone Number', 'Profile Type', 'First Visit Date', 'Initial Spent']);
      headerRow.font = { bold: true };
      
      // Data
      data.newCustomers.forEach(row => {
        sheet.addRow([
          row.customer_name, 
          row.phone,
          row.is_registered ? 'Portal Registered' : 'Walk-in',
          new Date(row.first_visit).toLocaleDateString('en-IN'),
          row.total_spent
        ]);
      });
      
      // Formatting
      sheet.getColumn('A').width = 25;
      sheet.getColumn('B').width = 15;
      sheet.getColumn('C').width = 20;
      sheet.getColumn('E').numFmt = '₹#,##0.00';
    }
  }

  // --- REPORT 23: ✅ RETURNING CUSTOMERS (Shifted from 22) ---
  if (reportIds.includes(23)) {
    if (data.repeatCustomers) {
      const sheet = workbook.addWorksheet('Loyal Customers');
      
      sheet.mergeCells('A1:G1');
      sheet.getCell('A1').value = 'Returning Customers & Lifetime Value';
      sheet.getCell('A1').font = { size: 16, bold: true };
      
      sheet.getCell('A3').value = 'Period:';
      sheet.getCell('B3').value = `${metadata.fromDate} to ${metadata.toDate}`;

      // Headers
      const headerRow = sheet.addRow(['Customer Name', 'Phone Number', 'Profile Type', 'Lifetime Visits', 'Lifetime Spent', 'First Visit', 'Latest Visit']);
      headerRow.font = { bold: true };
      
      // Data
      data.repeatCustomers.forEach(row => {
        sheet.addRow([
          row.customer_name, 
          row.phone,
          row.is_registered ? 'Portal Registered' : 'Walk-in',
          row.lifetime_visits,
          row.lifetime_spent,
          new Date(row.first_visit).toLocaleDateString('en-IN'),
          new Date(row.latest_visit).toLocaleDateString('en-IN')
        ]);
      });
      
      // Formatting
      sheet.getColumn('A').width = 25;
      sheet.getColumn('B').width = 15;
      sheet.getColumn('E').numFmt = '₹#,##0.00';
      sheet.getColumn('F').width = 15;
      sheet.getColumn('G').width = 15;
    }
  }

  // --- REPORT 24: Customer Activity ---
  if (reportIds.includes(24)) {
    if (data.customerActivity) {
      const sheet = workbook.addWorksheet('Service History Log');
      
      sheet.mergeCells('A1:G1');
      sheet.getCell('A1').value = 'Customer Activity & Service History';
      sheet.getCell('A1').font = { size: 16, bold: true };
      
      sheet.getCell('A3').value = 'Period:';
      sheet.getCell('B3').value = `${metadata.fromDate} to ${metadata.toDate}`;

      // Headers
      const headerRow = sheet.addRow(['Date & Time', 'Token', 'Customer Name', 'Phone Number', 'Service Requested', 'Assigned Staff', 'Status', 'Amount']);
      headerRow.font = { bold: true };
      
      // Data
      data.customerActivity.forEach(row => {
        sheet.addRow([
          new Date(row.date).toLocaleString('en-IN'), 
          row.token_id,
          row.customer_name,
          row.phone,
          row.service_name,
          row.staff_name,
          row.status.toUpperCase(),
          row.amount
        ]);
      });
      
      // Formatting
      sheet.getColumn('A').width = 22;
      sheet.getColumn('C').width = 25;
      sheet.getColumn('E').width = 30;
      sheet.getColumn('H').numFmt = '₹#,##0.00';
    }
  }

  // --- REPORT 25: Customer Reviews ---
  if (reportIds.includes(25)) {
    if (data.customerFeedback) {
      const sheet = workbook.addWorksheet('Customer Ratings');
      
      sheet.mergeCells('A1:F1');
      sheet.getCell('A1').value = 'Customer Reviews & Ratings';
      sheet.getCell('A1').font = { size: 16, bold: true };
      
      sheet.getCell('A3').value = 'Period:';
      sheet.getCell('B3').value = `${metadata.fromDate} to ${metadata.toDate}`;

      // Headers
      const headerRow = sheet.addRow(['Date', 'Customer Name', 'Phone', 'Service Evaluated', 'Rating (Stars)', 'Customer Feedback']);
      headerRow.font = { bold: true };
      
      // Data
      data.customerFeedback.forEach(row => {
        sheet.addRow([
          new Date(row.date).toLocaleDateString('en-IN'), 
          row.customer_name,
          row.phone,
          row.service_name,
          row.service_rating,
          row.review_text
        ]);
      });
      
      // Formatting
      sheet.getColumn('A').width = 15;
      sheet.getColumn('B').width = 25;
      sheet.getColumn('D').width = 30;
      sheet.getColumn('F').width = 50; 
    }
  }

  // --- REPORT 26: Team Financials ---
  if (reportIds.includes(26)) {
    if (data.teamFinancials) {
      const sheet = workbook.addWorksheet('Team Financials');
      
      sheet.mergeCells('A1:F1');
      sheet.getCell('A1').value = 'Team Revenue & Profitability';
      sheet.getCell('A1').font = { size: 16, bold: true };
      
      sheet.getCell('A3').value = 'Period:';
      sheet.getCell('B3').value = `${metadata.fromDate} to ${metadata.toDate}`;

      // Headers
      const headerRow = sheet.addRow(['Team Name', 'Services Handled', 'Total Revenue', 'Gross Profit', 'Team Expenses', 'Net Team Profit']);
      headerRow.font = { bold: true };
      
      // Data
      data.teamFinancials.forEach(row => {
        sheet.addRow([
          row.team_name, 
          row.total_services,
          row.total_revenue,
          row.gross_profit,
          row.total_expenses,
          row.net_profit
        ]);
      });
      
      // Formatting
      sheet.getColumn('A').width = 25;
      ['C', 'D', 'E', 'F'].forEach(col => sheet.getColumn(col).numFmt = '₹#,##0.00');
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
        data.serviceRevenue.slice(0, 15).forEach(row => { 
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
          doc.text(`${row.staff_name} | Score: ${row.incentive_score}/100 | Profit: Rs. ${row.service_charge_earned} | Suggested Bonus: Rs. ${row.suggested_bonus}`);
        });
        doc.moveDown(2);
      }

      // --- REPORT 13: Review Report ---
      if (reportIds.includes(13) && data.reviewReport) {
        doc.fontSize(14).text('Customer Reviews & Feedback', { underline: true });
        doc.moveDown(1);
        
        doc.fontSize(9).fillColor('black');
        data.reviewReport.forEach(row => { 
          doc.text(`[${new Date(row.date).toLocaleDateString('en-IN')}] ${row.customer_name}: ${row.service_rating} Stars - "${row.review_text}" (Staff: ${row.staff_name})`);
          doc.moveDown(0.5);
        });
        doc.moveDown(2);
      }

      // --- REPORT 14: Leave Report ---
      if (reportIds.includes(14) && data.leaveReport) {
        doc.fontSize(14).text('Staff Leave Applications', { underline: true });
        doc.moveDown(1);
        
        doc.fontSize(9).fillColor('black');
        data.leaveReport.forEach(row => { 
          const from = new Date(row.from_date).toLocaleDateString('en-IN');
          const to = new Date(row.to_date).toLocaleDateString('en-IN');
          doc.text(`${row.staff_name} | ${row.leave_type} (${row.days_taken} Days: ${from} to ${to}) | Status: ${row.status.toUpperCase()}`);
        });
        doc.moveDown(2);
      }

      // --- REPORT 16: Service Profit ---
      if (reportIds.includes(16) && data.serviceProfit) {
        doc.fontSize(14).text('Service Profitability Analysis', { underline: true });
        doc.moveDown(1);
        
        doc.fontSize(9).fillColor('black');
        data.serviceProfit.forEach(row => { 
          doc.text(`${row.service_name} | Qty: ${row.total_requests} | Revenue: Rs. ${row.revenue_collected} | Profit: Rs. ${row.gross_profit}`);
        });
        doc.moveDown(2);
      }

      // --- REPORT 17: Pending Services ---
      if (reportIds.includes(17) && data.pendingServices) {
        doc.fontSize(14).text('Pending Service Applications', { underline: true });
        doc.moveDown(1);
        
        doc.fontSize(9).fillColor('black');
        data.pendingServices.forEach(row => { 
          doc.text(`[${new Date(row.date).toLocaleDateString('en-IN')}] ${row.customer_name} | ${row.service_name} | Pending: ${row.days_pending} Days | Staff: ${row.assigned_staff}`);
        });
        doc.moveDown(2);
      }

      // --- REPORT 18: Completed Services ---
      if (reportIds.includes(18) && data.completedServicesReport) {
        doc.fontSize(14).text('Completed Service Applications', { underline: true });
        doc.moveDown(1);
        
        doc.fontSize(9).fillColor('black');
        data.completedServicesReport.forEach(row => { 
          doc.text(`[${new Date(row.completion_date).toLocaleDateString('en-IN')}] ${row.customer_name} | ${row.service_name} | TAT: ${row.days_taken} Days | Staff: ${row.assigned_staff}`);
        });
        doc.moveDown(2);
      }

      // --- REPORT 19: Staff-wise Services ---
      if (reportIds.includes(19) && data.staffWiseServices) {
        doc.fontSize(14).text('Staff Service Breakdown', { underline: true });
        doc.moveDown(1);
        
        doc.fontSize(9).fillColor('black');
        let currentStaff = '';
        data.staffWiseServices.forEach(row => { 
          if (currentStaff !== row.staff_name) {
             doc.moveDown(0.5);
             doc.font('Helvetica-Bold').text(`-- ${row.staff_name} --`);
             doc.font('Helvetica');
             currentStaff = row.staff_name;
          }
          doc.text(`   ${row.service_name} | Qty: ${row.total_requests} | Profit: Rs. ${row.gross_profit}`);
        });
        doc.moveDown(2);
      }

      // --- REPORT 20: Service Time Analysis ---
      if (reportIds.includes(20) && data.serviceTimeReport) {
        doc.fontSize(14).text('Service Turnaround Time Analysis', { underline: true });
        doc.moveDown(1);
        
        doc.fontSize(9).fillColor('black');
        data.serviceTimeReport.forEach(row => { 
          const avgDays = (row.avg_hours / 24).toFixed(1);
          doc.text(`${row.service_name} | Qty: ${row.total_requests} | Avg Time: ${avgDays} Days (${row.avg_hours} Hrs)`);
        });
        doc.moveDown(2);
      }

      // --- REPORT 21: Customer Summary ---
      if (reportIds.includes(21) && data.customerSummary) {
        doc.fontSize(14).text('Customer Activity Summary', { underline: true });
        doc.moveDown(1);
        
        doc.fontSize(9).fillColor('black');
        data.customerSummary.forEach(row => { 
          const type = row.is_registered ? '(Registered)' : '(Walk-in)';
          const visit = row.is_returning ? '[Returning]' : '[New]';
          doc.text(`${row.customer_name} ${type} ${visit} | Phone: ${row.phone} | Services: ${row.total_services} | Spent: Rs. ${row.total_spent}`);
        });
        doc.moveDown(2);
      }

      // --- REPORT 22: ✅ NEW CUSTOMERS ---
      if (reportIds.includes(22) && data.newCustomers) {
        doc.fontSize(14).text('New Customers Acquired', { underline: true });
        doc.moveDown(1);
        
        doc.fontSize(9).fillColor('black');
        data.newCustomers.forEach(row => { 
          const first = new Date(row.first_visit).toLocaleDateString('en-IN');
          const type = row.is_registered ? '(Registered)' : '(Walk-in)';
          doc.text(`${row.customer_name} ${type} | Phone: ${row.phone} | First Visit: ${first} | Spent: Rs. ${row.total_spent}`);
        });
        doc.moveDown(2);
      }

      // --- REPORT 23: ✅ RETURNING CUSTOMERS (Shifted from 22) ---
      if (reportIds.includes(23) && data.repeatCustomers) {
        doc.fontSize(14).text('Returning Customers (Loyalty & LTV)', { underline: true });
        doc.moveDown(1);
        
        doc.fontSize(9).fillColor('black');
        data.repeatCustomers.forEach(row => { 
          const first = new Date(row.first_visit).toLocaleDateString('en-IN');
          const latest = new Date(row.latest_visit).toLocaleDateString('en-IN');
          doc.text(`${row.customer_name} (${row.phone}) | Visits: ${row.lifetime_visits} | Spent: Rs. ${row.lifetime_spent} | Active: ${first} to ${latest}`);
        });
        doc.moveDown(2);
      }

      // --- REPORT 24: Customer Activity ---
      if (reportIds.includes(24) && data.customerActivity) {
        doc.fontSize(14).text('Customer Activity & Service History', { underline: true });
        doc.moveDown(1);
        
        doc.fontSize(9).fillColor('black');
        data.customerActivity.forEach(row => { 
          const dateStr = new Date(row.date).toLocaleString('en-IN');
          doc.text(`[${dateStr}] ${row.customer_name} (${row.phone}) | ${row.service_name} | Status: ${row.status.toUpperCase()} | Rs. ${row.amount}`);
        });
        doc.moveDown(2);
      }

      // --- REPORT 25: Customer Reviews ---
      if (reportIds.includes(25) && data.customerFeedback) {
        doc.fontSize(14).text('Customer Reviews & Ratings', { underline: true });
        doc.moveDown(1);
        
        doc.fontSize(9).fillColor('black');
        data.customerFeedback.forEach(row => { 
          const dateStr = new Date(row.date).toLocaleDateString('en-IN');
          doc.text(`[${dateStr}] ${row.customer_name}: ${row.service_rating} Stars - "${row.review_text}"`);
          doc.moveDown(0.5);
        });
        doc.moveDown(2);
      }

      // --- REPORT 26: Team Financials ---
      if (reportIds.includes(26) && data.teamFinancials) {
        doc.fontSize(14).text('Team Revenue & Profitability', { underline: true });
        doc.moveDown(1);
        
        doc.fontSize(9).fillColor('black');
        data.teamFinancials.forEach(row => { 
          doc.text(`${row.team_name} | Services: ${row.total_services} | Rev: Rs. ${row.total_revenue} | Exp: Rs. ${row.total_expenses} | Net: Rs. ${row.net_profit}`);
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