import PDFDocument from 'pdfkit';

// ==========================================
// THEME (matches the dashboard: indigo / gray)
// ==========================================
const C = {
  indigo: '#4F46E5',
  indigoLight: '#EEF2FF',
  text: '#111827',
  muted: '#6B7280',
  line: '#E5E7EB',
  zebra: '#F9FAFB',
  green: '#059669',
  red: '#DC2626',
};

const TZ = 'Asia/Kolkata';
const MAX_ROWS = 150;

// ==========================================
// FORMATTERS (all dates shown in IST)
// ==========================================
const num = (v) => Number(v) || 0;
const money = (v) => `Rs. ${num(v).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const int = (v) => num(v).toLocaleString('en-IN');

const toDate = (v) => {
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
};
const date = (v) => {
  const d = toDate(v);
  return d ? d.toLocaleDateString('en-IN', { timeZone: TZ }) : (v ?? '-');
};
const datetime = (v) => {
  const d = toDate(v);
  return d ? d.toLocaleString('en-IN', { timeZone: TZ }) : (v ?? '-');
};
const upper = (v) => (v ? String(v).toUpperCase() : '-');
const text = (v) => (v === null || v === undefined || v === '' ? '-' : String(v));
const stars = (v) => (num(v) > 0 ? `${num(v)} Stars` : '-');

// ==========================================
// REPORT CONFIG  (one entry per report section)
// col: { h: header, k: key | get: fn(row), w: relative width, f: formatter, r: right-align }
// ==========================================
const REPORTS = {
  3: {
    title: 'Revenue by Services', key: 'serviceRevenue',
    cols: [
      { h: 'Service', k: 'service_name', w: 4 },
      { h: 'Requests', k: 'total_requests', w: 1.2, f: int, r: true },
      { h: 'Revenue', k: 'revenue_collected', w: 2, f: money, r: true },
      { h: 'Dept Charges', k: 'department_charges', w: 2, f: money, r: true },
      { h: 'Gross Profit', k: 'gross_profit', w: 2, f: money, r: true },
    ],
  },
  16: {
    title: 'Service Profitability', key: 'serviceProfit',
    cols: [
      { h: 'Service', k: 'service_name', w: 4 },
      { h: 'Requests', k: 'total_requests', w: 1.2, f: int, r: true },
      { h: 'Revenue', k: 'revenue_collected', w: 2, f: money, r: true },
      { h: 'Dept Charges', k: 'department_charges', w: 2, f: money, r: true },
      { h: 'Gross Profit', k: 'gross_profit', w: 2, f: money, r: true },
    ],
  },
  4: {
    title: 'Expenses by Category', key: 'expenseReport',
    cols: [
      { h: 'Category', k: 'category', w: 4 },
      { h: 'Transactions', k: 'transactions', w: 1.5, f: int, r: true },
      { h: 'Amount', k: 'amount', w: 2, f: money, r: true },
    ],
  },
  6: {
    title: 'Daily Cash Flow', key: 'cashFlow',
    cols: [
      { h: 'Date', k: 'date', w: 2, f: date },
      { h: 'Inflow', k: 'inflow', w: 2, f: money, r: true },
      { h: 'Outflow', k: 'outflow', w: 2, f: money, r: true },
      { h: 'Net Flow', k: 'net_flow', w: 2, f: money, r: true },
    ],
  },
  7: {
    title: 'General Ledger', key: 'ledger',
    cols: [
      { h: 'Date & Time', k: 'date', w: 2.5, f: datetime },
      { h: 'Wallet', k: 'wallet', w: 2 },
      { h: 'Type', k: 'type', w: 1.2, f: upper },
      { h: 'Category', k: 'category', w: 2.5 },
      { h: 'Amount', k: 'amount', w: 2, f: money, r: true },
    ],
  },
  8: {
    title: 'Pending Customer Payments', key: 'pendingCollections',
    cols: [
      { h: 'Date', k: 'date', w: 1.5, f: date },
      { h: 'Customer', k: 'customer_name', w: 2.5 },
      { h: 'Phone', k: 'phone', w: 2 },
      { h: 'Service', k: 'service_name', w: 3 },
      { h: 'Total', k: 'total_charges', w: 1.8, f: money, r: true },
      { h: 'Balance Due', k: 'balance_due', w: 1.8, f: money, r: true },
    ],
  },
  9: {
    title: 'Staff Attendance', key: 'attendanceReport',
    cols: [
      { h: 'Date', k: 'date', w: 1.5, f: date },
      { h: 'Staff', k: 'staff_name', w: 3 },
      { h: 'Status', k: 'status', w: 1.5, f: upper },
      { h: 'Check-In', k: 'check_in', w: 1.5 },
      { h: 'Check-Out', k: 'check_out', w: 1.5 },
      { h: 'Late (min)', k: 'late_minutes', w: 1.2, f: int, r: true },
    ],
  },
  10: {
    title: 'Staff Performance', key: 'performanceReport',
    cols: [
      { h: 'Staff', k: 'staff_name', w: 3 },
      { h: 'Role', k: 'role', w: 1.5, f: upper },
      { h: 'Services', k: 'total_services', w: 1.3, f: int, r: true },
      { h: 'Revenue', k: 'total_revenue', w: 2, f: money, r: true },
      { h: 'Gross Profit', k: 'gross_profit', w: 2, f: money, r: true },
    ],
  },
  11: {
    title: 'Staff Payroll Summary', key: 'salaryReport',
    cols: [
      { h: 'Month', k: 'month', w: 1.3 },
      { h: 'Staff', k: 'staff_name', w: 2.5 },
      { h: 'Attendance', get: (r) => `${r.present_days}/${r.working_days} Days`, w: 1.6 },
      { h: 'Basic', k: 'basic', w: 1.6, f: money, r: true },
      { h: 'Allowances', k: 'total_allowances', w: 1.6, f: money, r: true },
      { h: 'Deductions', k: 'deductions', w: 1.6, f: money, r: true },
      { h: 'Net Salary', k: 'net_salary', w: 1.7, f: money, r: true },
      { h: 'Status', k: 'status', w: 1.2, f: upper },
    ],
  },
  12: {
    title: 'Staff KPI & Incentive Planner', key: 'incentiveReport',
    cols: [
      { h: 'Staff', k: 'staff_name', w: 3 },
      { h: 'Services', k: 'services_completed', w: 1.2, f: int, r: true },
      { h: 'Service Charge', k: 'service_charge_earned', w: 2, f: money, r: true },
      { h: 'Avg Rating', k: 'avg_staff_rating', w: 1.5, f: stars },
      { h: 'KPI (/100)', k: 'incentive_score', w: 1.3, f: int, r: true },
      { h: 'Suggested Bonus', k: 'suggested_bonus', w: 2, f: money, r: true },
    ],
  },
  13: {
    title: 'Customer Reviews & Feedback', key: 'reviewReport',
    cols: [
      { h: 'Date', k: 'date', w: 1.5, f: date },
      { h: 'Customer', k: 'customer_name', w: 2.2 },
      { h: 'Service', k: 'service_name', w: 2.5 },
      { h: 'Staff', k: 'staff_name', w: 2 },
      { h: 'Rating', k: 'service_rating', w: 1, f: int },
      { h: 'Comments', k: 'review_text', w: 4 },
    ],
  },
  14: {
    title: 'Staff Leave Applications', key: 'leaveReport',
    cols: [
      { h: 'Applied', k: 'applied_date', w: 1.5, f: date },
      { h: 'Staff', k: 'staff_name', w: 2.3 },
      { h: 'Type', k: 'leave_type', w: 1.5 },
      { h: 'From', k: 'from_date', w: 1.5, f: date },
      { h: 'To', k: 'to_date', w: 1.5, f: date },
      { h: 'Days', k: 'days_taken', w: 0.9, f: int, r: true },
      { h: 'Status', k: 'status', w: 1.3, f: upper },
      { h: 'Reason', k: 'reason', w: 3 },
    ],
  },
  17: {
    title: 'Pending Service Applications', key: 'pendingServices',
    cols: [
      { h: 'Applied', k: 'date', w: 1.5, f: date },
      { h: 'Token', k: 'token_id', w: 1.3 },
      { h: 'Customer', k: 'customer_name', w: 2.3 },
      { h: 'Phone', k: 'phone', w: 1.8 },
      { h: 'Service', k: 'service_name', w: 3 },
      { h: 'Staff', k: 'assigned_staff', w: 2 },
      { h: 'Status', k: 'status', w: 1.4, f: upper },
      { h: 'Days Pending', k: 'days_pending', w: 1.7, f: int, r: true },
    ],
  },
  18: {
    title: 'Completed Service Applications', key: 'completedServicesReport',
    cols: [
      { h: 'Applied', k: 'application_date', w: 1.5, f: date },
      { h: 'Completed', k: 'completion_date', w: 1.5, f: date },
      { h: 'Customer', k: 'customer_name', w: 2.3 },
      { h: 'Service', k: 'service_name', w: 3 },
      { h: 'Staff', k: 'assigned_staff', w: 2 },
      { h: 'Status', k: 'status', w: 1.4, f: upper },
      { h: 'TAT (Days)', k: 'days_taken', w: 1.1, f: int, r: true },
    ],
  },
  19: {
    title: 'Staff-wise Services', key: 'staffWiseServices',
    cols: [
      { h: 'Staff', k: 'staff_name', w: 2.5 },
      { h: 'Service', k: 'service_name', w: 3.5 },
      { h: 'Requests', k: 'total_requests', w: 1.2, f: int, r: true },
      { h: 'Revenue', k: 'revenue_collected', w: 2, f: money, r: true },
      { h: 'Gross Profit', k: 'gross_profit', w: 2, f: money, r: true },
    ],
  },
  20: {
    title: 'Service Turnaround Time', key: 'serviceTimeReport',
    cols: [
      { h: 'Service', k: 'service_name', w: 3.5 },
      { h: 'Completed', k: 'total_requests', w: 1.3, f: int, r: true },
      { h: 'Fastest (Hrs)', k: 'min_hours', w: 1.4, f: int, r: true },
      { h: 'Slowest (Hrs)', k: 'max_hours', w: 1.4, f: int, r: true },
      { h: 'Avg (Hrs)', k: 'avg_hours', w: 1.3, f: int, r: true },
      { h: 'Avg (Days)', get: (r) => (num(r.avg_hours) / 24).toFixed(1), w: 1.3, r: true },
    ],
  },
  21: {
    title: 'Customer Activity Summary', key: 'customerSummary',
    cols: [
      { h: 'Customer', k: 'customer_name', w: 2.8 },
      { h: 'Phone', k: 'phone', w: 2 },
      { h: 'Profile', get: (r) => (r.is_registered ? 'Registered' : 'Walk-in'), w: 1.5 },
      { h: 'Visit', get: (r) => (r.is_returning ? 'Returning' : 'New'), w: 1.4 },
      { h: 'Services', k: 'total_services', w: 1.2, f: int, r: true },
      { h: 'Total Spent', k: 'total_spent', w: 2, f: money, r: true },
    ],
  },
  22: {
    title: 'New Customers', key: 'newCustomers',
    cols: [
      { h: 'Customer', k: 'customer_name', w: 3 },
      { h: 'Phone', k: 'phone', w: 2 },
      { h: 'Profile', get: (r) => (r.is_registered ? 'Registered' : 'Walk-in'), w: 1.5 },
      { h: 'First Visit', k: 'first_visit', w: 1.6, f: date },
      { h: 'Spent', k: 'total_spent', w: 2, f: money, r: true },
    ],
  },
  23: {
    title: 'Returning Customers (Loyalty & LTV)', key: 'repeatCustomers',
    cols: [
      { h: 'Customer', k: 'customer_name', w: 2.8 },
      { h: 'Phone', k: 'phone', w: 2 },
      { h: 'Visits', k: 'lifetime_visits', w: 1, f: int, r: true },
      { h: 'Lifetime Spent', k: 'lifetime_spent', w: 2, f: money, r: true },
      { h: 'First Visit', k: 'first_visit', w: 1.6, f: date },
      { h: 'Latest Visit', k: 'latest_visit', w: 1.6, f: date },
    ],
  },
  24: {
    title: 'Customer Service History', key: 'customerActivity',
    cols: [
      { h: 'Date & Time', k: 'date', w: 2.3, f: datetime },
      { h: 'Token', k: 'token_id', w: 1.2 },
      { h: 'Customer', k: 'customer_name', w: 2.2 },
      { h: 'Service', k: 'service_name', w: 3 },
      { h: 'Staff', k: 'staff_name', w: 2 },
      { h: 'Status', k: 'status', w: 1.4, f: upper },
      { h: 'Amount', k: 'amount', w: 1.6, f: money, r: true },
    ],
  },
  25: {
    title: 'Customer Reviews & Ratings', key: 'customerFeedback',
    cols: [
      { h: 'Date', k: 'date', w: 1.5, f: date },
      { h: 'Customer', k: 'customer_name', w: 2.3 },
      { h: 'Service', k: 'service_name', w: 3 },
      { h: 'Rating', k: 'service_rating', w: 1, f: int },
      { h: 'Feedback', k: 'review_text', w: 5 },
    ],
  },
  26: {
    title: 'Team Revenue & Profitability', key: 'teamFinancials',
    cols: [
      { h: 'Team', k: 'team_name', w: 3 },
      { h: 'Services', k: 'total_services', w: 1.2, f: int, r: true },
      { h: 'Revenue', k: 'total_revenue', w: 2, f: money, r: true },
      { h: 'Gross Profit', k: 'gross_profit', w: 2, f: money, r: true },
      { h: 'Expenses', k: 'total_expenses', w: 2, f: money, r: true },
      { h: 'Net Profit', k: 'net_profit', w: 2, f: money, r: true },
    ],
  },
  27: {
    title: 'Team Performance', key: 'teamPerformance',
    cols: [
      { h: 'Team', k: 'team_name', w: 3 },
      { h: 'Members', k: 'active_members', w: 1.2, f: int, r: true },
      { h: 'Services', k: 'total_services', w: 1.3, f: int, r: true },
      { h: 'Avg TAT (Hrs)', k: 'avg_tat_hours', w: 1.5, f: int, r: true },
      { h: 'Avg Rating', k: 'avg_rating', w: 1.5, f: stars },
    ],
  },
  28: {
    title: 'Team Contribution', key: 'teamContribution',
    cols: [
      { h: 'Team', k: 'team_name', w: 2.3 },
      { h: 'Staff', k: 'staff_name', w: 2.5 },
      { h: 'Role', k: 'role', w: 1.4, f: upper },
      { h: 'Services', k: 'services_completed', w: 1.2, f: int, r: true },
      { h: 'Revenue', k: 'revenue_generated', w: 2, f: money, r: true },
      { h: 'Profit', k: 'gross_profit', w: 2, f: money, r: true },
    ],
  },
};

// Report 15 is the same dataset as report 3
REPORTS[15] = REPORTS[3];

// ==========================================
// HELPERS
// ==========================================
const getPeriodTotals = (financials) => {
  if (!financials) return null;
  const trend = Array.isArray(financials.periodTrend) ? financials.periodTrend : [];

  // For multi-day periods, sum the whole period (financials.today is only the last day)
  if (trend.length > 0) {
    const sum = (k) => trend.reduce((a, r) => a + num(r[k]), 0);
    return {
      revenueCollected: sum('revenueCollected'),
      grossProfit: sum('grossProfit'),
      operatingExpenses: sum('operatingExpenses'),
      netProfit: sum('netProfit'),
    };
  }
  const t = financials.today || {};
  return {
    revenueCollected: num(t.revenueCollected),
    grossProfit: num(t.grossProfit),
    operatingExpenses: num(t.operatingExpenses),
    netProfit: num(t.netProfit),
  };
};

const uniqueSections = (reportIds) => {
  const seen = new Set();
  const out = [];
  for (const id of reportIds) {
    const cfg = REPORTS[id];
    if (!cfg || seen.has(cfg.title)) continue;
    seen.add(cfg.title);
    out.push(cfg);
  }
  return out;
};

// ==========================================
// PDF BUILDER
// ==========================================
export const buildPDF = (reportData, reportIds, options = {}) => {
  return new Promise((resolve, reject) => {
    try {
      const { metadata, data } = reportData;
      const ids = (reportIds || []).map(Number);
      const reportTitle = options.title || 'Akshaya CRM Business Report';

      const doc = new PDFDocument({
        size: 'A4',
        layout: 'landscape',
        margin: 36,
        bufferPages: true,
      });
      const buffers = [];
      doc.on('data', (b) => buffers.push(b));
      doc.on('end', () => resolve(Buffer.concat(buffers)));

      const left = doc.page.margins.left;
      const contentWidth = () => doc.page.width - doc.page.margins.left - doc.page.margins.right;
      const bottomLimit = () => doc.page.height - doc.page.margins.bottom;
      const ensureSpace = (h) => { if (doc.y + h > bottomLimit()) doc.addPage(); };

      // ---------- Header band ----------
      doc.rect(0, 0, doc.page.width, 78).fill(C.indigo);
      doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(20)
        .text(reportTitle, left, 20, { width: contentWidth(), lineBreak: false });
      doc.font('Helvetica').fontSize(10)
        .text(`Period: ${metadata.fromDate} to ${metadata.toDate}`, left, 48, { continued: false, lineBreak: false });
      doc.text(
        `Generated: ${new Date(metadata.generatedAt || Date.now()).toLocaleString('en-IN', { timeZone: TZ })} IST`,
        left, 48, { width: contentWidth(), align: 'right', lineBreak: false }
      );
      doc.y = 96;
      doc.fillColor(C.text);

      // ---------- Financial KPI cards ----------
      const totals = (ids.includes(1) || ids.includes(2)) ? getPeriodTotals(data.financials) : null;
      if (totals) {
        const cards = [
          { label: 'Revenue Collected', value: money(totals.revenueCollected), color: C.text },
          { label: 'Gross Profit', value: money(totals.grossProfit), color: C.text },
          { label: 'Operating Expenses', value: money(totals.operatingExpenses), color: C.text },
          { label: 'Net Profit', value: money(totals.netProfit), color: totals.netProfit >= 0 ? C.green : C.red },
        ];
        const gap = 12;
        const cardW = (contentWidth() - gap * (cards.length - 1)) / cards.length;
        const cardH = 58;
        const y0 = doc.y;
        cards.forEach((c, i) => {
          const x = left + i * (cardW + gap);
          doc.roundedRect(x, y0, cardW, cardH, 6).fillAndStroke(C.indigoLight, C.line);
          doc.fillColor(C.muted).font('Helvetica').fontSize(9)
            .text(c.label.toUpperCase(), x + 12, y0 + 12, { width: cardW - 24, lineBreak: false });
          doc.fillColor(c.color).font('Helvetica-Bold').fontSize(16)
            .text(c.value, x + 12, y0 + 30, { width: cardW - 24, lineBreak: false });
        });
        doc.y = y0 + cardH + 18;
        doc.fillColor(C.text);

        // Day-by-day trend (only when the period has more than one day)
        const trend = data.financials?.periodTrend || [];
        if (trend.length > 1) {
          drawTable(
            'Financial Trend',
            [
              { h: 'Date', k: 'label', w: 2 },
              { h: 'Revenue Collected', k: 'revenueCollected', w: 2, f: money, r: true },
              { h: 'Gross Profit', k: 'grossProfit', w: 2, f: money, r: true },
              { h: 'Operating Expenses', k: 'operatingExpenses', w: 2, f: money, r: true },
              { h: 'Net Profit', k: 'netProfit', w: 2, f: money, r: true },
            ],
            trend
          );
        }
      }

      // ---------- Table renderer ----------
      function drawTable(title, cols, allRows) {
        const rows = allRows.slice(0, MAX_ROWS);
        const totalW = cols.reduce((a, c) => a + c.w, 0);
        const widths = cols.map((c) => (c.w / totalW) * contentWidth());
        const padX = 5;
        const padY = 4;
        const fontSize = 8;

        const cellText = (col, row) => {
          const raw = col.get ? col.get(row) : row[col.k];
          return col.f ? String(col.f(raw)) : text(raw);
        };

        const drawHeader = () => {
          const h = 22;
          const y0 = doc.y; // capture: doc.y moves after every doc.text()
          doc.rect(left, y0, contentWidth(), h).fill(C.indigo);
          let x = left;
          doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(fontSize);
          cols.forEach((c, i) => {
            doc.text(c.h.toUpperCase(), x + padX, y0 + 7, {
              width: widths[i] - padX * 2, align: c.r ? 'right' : 'left', lineBreak: false,
            });
            x += widths[i];
          });
          doc.y = y0 + h;
          doc.fillColor(C.text);
        };

        // Section title
        ensureSpace(60);
        doc.font('Helvetica-Bold').fontSize(13).fillColor(C.text).text(title, left, doc.y);
        doc.font('Helvetica').fontSize(8).fillColor(C.muted)
          .text(`${allRows.length} record${allRows.length === 1 ? '' : 's'}`, left, doc.y + 1);
        doc.moveDown(0.5);
        doc.fillColor(C.text);

        if (allRows.length === 0) {
          const yE = doc.y;
          doc.roundedRect(left, yE, contentWidth(), 30, 4).fillAndStroke(C.zebra, C.line);
          doc.fillColor(C.muted).font('Helvetica-Oblique').fontSize(9)
            .text('No data for this period.', left, yE + 10, { width: contentWidth(), align: 'center', lineBreak: false });
          doc.y = yE + 42;
          doc.fillColor(C.text);
          return;
        }

        ensureSpace(22 + 24);
        drawHeader();

        rows.forEach((row, idx) => {
          const cells = cols.map((c) => cellText(c, row));
          doc.font('Helvetica').fontSize(fontSize);
          const heights = cells.map((t, i) => doc.heightOfString(t, { width: widths[i] - padX * 2 }));
          const rowH = Math.max(...heights) + padY * 2;

          if (doc.y + rowH > bottomLimit()) {
            doc.addPage();
            drawHeader(); // repeat header on every new page
          }

          const y = doc.y;
          if (idx % 2 === 1) doc.rect(left, y, contentWidth(), rowH).fill(C.zebra);
          doc.fillColor(C.text);
          let x = left;
          cells.forEach((t, i) => {
            doc.text(t, x + padX, y + padY, { width: widths[i] - padX * 2, align: cols[i].r ? 'right' : 'left' });
            x += widths[i];
          });
          doc.moveTo(left, y + rowH).lineTo(left + contentWidth(), y + rowH).lineWidth(0.5).strokeColor(C.line).stroke();
          doc.y = y + rowH;
        });

        if (allRows.length > MAX_ROWS) {
          doc.moveDown(0.4);
          doc.font('Helvetica-Oblique').fontSize(8).fillColor(C.muted)
            .text(`Showing the first ${MAX_ROWS} of ${allRows.length} records. Export from the dashboard for the full list.`, left, doc.y);
          doc.fillColor(C.text);
        }
        doc.moveDown(1.5);
      }

      // ---------- Report sections ----------
      uniqueSections(ids).forEach((cfg) => {
        const rows = Array.isArray(data[cfg.key]) ? data[cfg.key] : [];
        drawTable(cfg.title, cfg.cols, rows);
      });

      // ---------- Footer with page numbers ----------
      const range = doc.bufferedPageRange();
      for (let i = 0; i < range.count; i++) {
        doc.switchToPage(range.start + i);
        const oldBottom = doc.page.margins.bottom;
        doc.page.margins.bottom = 0; // allow drawing in the margin without creating a new page
        doc.font('Helvetica').fontSize(8).fillColor(C.muted);
        doc.text('Akshaya Sahayi - Automated Report', left, doc.page.height - 24, { lineBreak: false });
        doc.text(`Page ${i + 1} of ${range.count}`, left, doc.page.height - 24, {
          width: contentWidth(), align: 'right', lineBreak: false,
        });
        doc.page.margins.bottom = oldBottom;
      }

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};

// ==========================================
// HTML EMAIL BODY (summary cards shown inside the email itself)
// ==========================================
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export const buildEmailHTML = (reportData, reportIds, scheduleName = 'Report') => {
  const { metadata, data } = reportData;
  const ids = (reportIds || []).map(Number);
  const totals = (ids.includes(1) || ids.includes(2)) ? getPeriodTotals(data.financials) : null;

  const card = (label, value, color = '#111827') => `
    <td style="width:25%;padding:6px;">
      <div style="background:#EEF2FF;border:1px solid #E5E7EB;border-radius:8px;padding:12px;">
        <div style="font-size:11px;color:#6B7280;text-transform:uppercase;letter-spacing:.5px;">${label}</div>
        <div style="font-size:18px;font-weight:bold;color:${color};margin-top:4px;">${value}</div>
      </div>
    </td>`;

  const cards = totals ? `
    <table role="presentation" style="width:100%;border-collapse:collapse;margin:16px 0;"><tr>
      ${card('Revenue Collected', money(totals.revenueCollected))}
      ${card('Gross Profit', money(totals.grossProfit))}
      ${card('Expenses', money(totals.operatingExpenses))}
      ${card('Net Profit', money(totals.netProfit), totals.netProfit >= 0 ? '#059669' : '#DC2626')}
    </tr></table>` : '';

  const sections = uniqueSections(ids).map((cfg) => {
    const count = Array.isArray(data[cfg.key]) ? data[cfg.key].length : 0;
    return `<tr>
      <td style="padding:8px 12px;border-bottom:1px solid #E5E7EB;">${esc(cfg.title)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #E5E7EB;text-align:right;color:#6B7280;">${count} record${count === 1 ? '' : 's'}</td>
    </tr>`;
  }).join('');

  return `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:640px;margin:0 auto;border:1px solid #E5E7EB;border-radius:10px;overflow:hidden;">
    <div style="background:#4F46E5;color:#fff;padding:18px 20px;">
      <div style="font-size:18px;font-weight:bold;">${esc(scheduleName)}</div>
      <div style="font-size:12px;opacity:.9;margin-top:4px;">Period: ${esc(metadata.fromDate)} to ${esc(metadata.toDate)}</div>
    </div>
    <div style="padding:16px 20px;color:#111827;">
      <p style="margin:0 0 4px;font-size:14px;">Hello,</p>
      <p style="margin:0;font-size:14px;color:#374151;">Your automated report is ready. A summary is below and the full report is attached as a PDF.</p>
      ${cards}
      ${sections ? `<table role="presentation" style="width:100%;border-collapse:collapse;font-size:13px;margin-top:8px;">${sections}</table>` : ''}
      <p style="margin:20px 0 0;font-size:12px;color:#6B7280;">- Akshaya Sahayi</p>
    </div>
  </div>`;
};