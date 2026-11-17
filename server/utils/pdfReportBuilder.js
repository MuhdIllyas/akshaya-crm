import PDFDocument from 'pdfkit';

// ==========================================
// THEME (matches the app: navy + teal)
// ==========================================
const C = {
  navy: '#1e3a5f',      // navy-700: table headers
  navyDark: '#172a45',  // navy-800: page header band, titles
  navyLight: '#f0f4f8', // navy-50: zebra rows, card fill
  navyLine: '#d9e2ec',  // navy-100: borders
  teal: '#14b8a6',      // teal-500: accents
  tealDark: '#0d9488',  // teal-600
  text: '#172a45',
  muted: '#64748b',
  line: '#e2e8f0',
  zebra: '#f0f4f8',
  green: '#0d9488',
  red: '#dc2626',
};
// Accent colours, used in turn for cards and chart bars
const PALETTE = ['#1e3a5f', '#14b8a6', '#3b6ea5', '#f59e0b', '#0d9488', '#829ab1', '#5eead4', '#2c5282'];

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
// SUMMARIES  (cards + bar charts instead of one row per record)
// summary(rows) → { cards: [{label, value}], charts: [{title, items: [{label, value}], f}], table?: {title, cols, rows} }
// Reports with a summary show it in place of the full list, unless `alsoList` is set.
// ==========================================
const groupBy = (rows, keyFn, valFn = () => 1) => {
  const map = new Map();
  for (const r of rows) {
    const k = keyFn(r) || '-';
    map.set(k, (map.get(k) || 0) + num(valFn(r)));
  }
  return [...map].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
};
// Keep the biggest n-1 bars and fold the rest into "Others"
const topN = (items, n = 8) => {
  if (items.length <= n) return items;
  const rest = items.slice(n - 1);
  return [...items.slice(0, n - 1), { label: `Others (${rest.length})`, value: rest.reduce((a, r) => a + r.value, 0) }];
};
const sumOf = (rows, k) => rows.reduce((a, r) => a + num(r[k]), 0);
// "Land Tax - Land Tax Payment (100 - 500)" → "Land Tax"
const mainService = (name) => String(name || 'Other').split(' - ')[0].trim();

REPORTS[18].summary = (rows) => {
  const customers = new Set(rows.map((r) => (r.phone && r.phone !== 'N/A' ? r.phone : r.customer_name))).size;
  const staff = new Set(rows.map((r) => r.assigned_staff)).size;
  const avgTat = rows.length ? sumOf(rows, 'days_taken') / rows.length : 0;
  return {
    cards: [
      { label: 'Services Completed', value: int(rows.length) },
      { label: 'Customers Served', value: int(customers) },
      { label: 'Staff Involved', value: int(staff) },
      { label: 'Avg Turnaround', value: `${avgTat.toFixed(1)} days` },
    ],
    charts: [
      { title: 'Completed by Service', items: topN(groupBy(rows, (r) => mainService(r.service_name))), f: int },
      { title: 'Completed by Staff', items: topN(groupBy(rows, (r) => r.assigned_staff)), f: int },
    ],
  };
};

REPORTS[21].summary = (rows) => {
  const spent = sumOf(rows, 'total_spent');
  const returning = rows.filter((r) => r.is_returning);
  const fresh = rows.filter((r) => !r.is_returning);
  const registered = rows.filter((r) => r.is_registered).length;
  return {
    cards: [
      { label: 'Customers', value: int(rows.length) },
      { label: 'New', value: int(fresh.length) },
      { label: 'Returning', value: int(returning.length) },
      { label: 'Total Spent', value: money(spent) },
      { label: 'Avg per Customer', value: money(rows.length ? Math.round(spent / rows.length) : 0) },
    ],
    charts: [
      {
        title: 'Customers',
        items: [
          { label: 'New', value: fresh.length },
          { label: 'Returning', value: returning.length },
          { label: 'Registered', value: registered },
          { label: 'Walk-in', value: rows.length - registered },
        ],
        f: int,
      },
      {
        title: 'Spend',
        items: [
          { label: 'New customers', value: sumOf(fresh, 'total_spent') },
          { label: 'Returning customers', value: sumOf(returning, 'total_spent') },
        ],
        f: money,
      },
    ],
    table: {
      title: 'Top 5 Customers',
      rows: [...rows].sort((a, b) => num(b.total_spent) - num(a.total_spent)).slice(0, 5),
      cols: REPORTS[21].cols.filter((c) => c.h !== 'Phone'),
    },
  };
};

REPORTS[10].summary = (rows) => {
  const working = rows.filter((r) => num(r.total_services) > 0);
  return {
    cards: [
      { label: 'Staff with Services', value: `${working.length} of ${rows.length}` },
      { label: 'Services Completed', value: int(sumOf(rows, 'total_services')) },
      { label: 'Revenue', value: money(sumOf(rows, 'total_revenue')) },
      { label: 'Gross Profit', value: money(sumOf(rows, 'gross_profit')) },
    ],
    charts: [
      { title: 'Services by Staff', items: topN(working.map((r) => ({ label: r.staff_name, value: num(r.total_services) })).sort((a, b) => b.value - a.value)), f: int },
      { title: 'Gross Profit by Staff', items: topN(working.map((r) => ({ label: r.staff_name, value: num(r.gross_profit) })).sort((a, b) => b.value - a.value)), f: money },
    ],
  };
};
REPORTS[10].alsoList = true; // one row per staff member: short enough to keep

REPORTS[9].summary = (rows) => {
  const count = (s) => rows.filter((r) => r.status === s).length;
  const late = rows.filter((r) => num(r.late_minutes) > 0);
  return {
    cards: [
      { label: 'Present', value: int(count('present')) },
      { label: 'Absent', value: int(count('absent')) },
      { label: 'On Leave', value: int(count('leave') + count('on_leave')) },
      { label: 'Late', value: int(late.length) },
    ],
    charts: [
      { title: 'Attendance', items: groupBy(rows, (r) => upper(r.status)), f: int },
      { title: 'Late Arrivals (minutes)', items: topN(late.map((r) => ({ label: r.staff_name, value: num(r.late_minutes) })).sort((a, b) => b.value - a.value)), f: int },
    ],
  };
};
REPORTS[9].alsoList = true;

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
      amountReceived: num(financials.today?.amountReceived), // already a whole-period figure
      revenueCollected: sum('revenueCollected'),
      grossProfit: sum('grossProfit'),
      operatingExpenses: sum('operatingExpenses'),
      netProfit: sum('netProfit'),
    };
  }
  const t = financials.today || {};
  return {
    amountReceived: num(t.amountReceived),
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
      doc.rect(0, 0, doc.page.width, 78).fill(C.navyDark);
      doc.rect(0, 78, doc.page.width, 4).fill(C.teal);
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

      // ---------- Section title with a teal marker ----------
      function sectionTitle(title, small = false) {
        const y = doc.y;
        const size = small ? 10 : 13;
        doc.rect(left, y + 1, small ? 3 : 4, size).fill(small ? C.navy : C.teal);
        doc.font('Helvetica-Bold').fontSize(size).fillColor(C.navyDark).text(title, left + 10, y);
        doc.x = left;
      }

      // ---------- KPI cards (one row) ----------
      function drawCards(cards, cardH = 58) {
        ensureSpace(cardH + 18);
        const gap = 12;
        const cardW = (contentWidth() - gap * (cards.length - 1)) / cards.length;
        const y0 = doc.y;
        cards.forEach((c, i) => {
          const x = left + i * (cardW + gap);
          const accent = PALETTE[i % PALETTE.length];
          doc.roundedRect(x, y0, cardW, cardH, 6).fillAndStroke('#FFFFFF', C.navyLine);
          // Coloured strip down the left edge
          doc.save();
          doc.roundedRect(x, y0, cardW, cardH, 6).clip();
          doc.rect(x, y0, 5, cardH).fill(accent);
          doc.restore();
          doc.fillColor(C.muted).font('Helvetica').fontSize(9)
            .text(c.label.toUpperCase(), x + 16, y0 + 12, { width: cardW - 28, lineBreak: false });
          doc.fillColor(c.color || C.text).font('Helvetica-Bold').fontSize(cards.length > 4 ? 13 : 16)
            .text(c.value, x + 16, y0 + (cardH > 52 ? 30 : 27), { width: cardW - 28, lineBreak: false });
        });
        doc.y = y0 + cardH + 18;
        doc.fillColor(C.text);
      }

      // ---------- Horizontal bar charts, two side by side ----------
      function drawCharts(charts) {
        const gap = 24;
        const perRow = 2;
        const chartW = (contentWidth() - gap * (perRow - 1)) / perRow;
        const barH = 12;
        const rowH = 18;

        for (let i = 0; i < charts.length; i += perRow) {
          const group = charts.slice(i, i + perRow);
          const maxItems = Math.max(1, ...group.map((c) => c.items.length));
          const blockH = 20 + maxItems * rowH + 8;
          ensureSpace(blockH);
          const y0 = doc.y;

          group.forEach((chart, j) => {
            const x0 = left + j * (chartW + gap);
            doc.font('Helvetica-Bold').fontSize(10).fillColor(C.text)
              .text(chart.title, x0, y0, { width: chartW, lineBreak: false });

            if (chart.items.length === 0) {
              doc.font('Helvetica-Oblique').fontSize(8).fillColor(C.muted)
                .text('No data for this period.', x0, y0 + 22, { width: chartW, lineBreak: false });
              return;
            }

            const labelW = chartW * 0.34;
            const valueW = chartW * 0.2;
            const barMaxW = chartW - labelW - valueW - 12;
            const max = Math.max(...chart.items.map((it) => num(it.value)), 0) || 1;

            chart.items.forEach((it, k) => {
              const y = y0 + 20 + k * rowH;
              doc.font('Helvetica').fontSize(8).fillColor(C.text)
                .text(text(it.label), x0, y + 2, { width: labelW - 6, height: barH, ellipsis: true, lineBreak: false });
              const bx = x0 + labelW;
              doc.roundedRect(bx, y, barMaxW, barH, 3).fill(C.navyLight);
              const w = Math.max(num(it.value) > 0 ? 4 : 0, (num(it.value) / max) * barMaxW);
              if (w > 0) doc.roundedRect(bx, y, w, barH, 3).fill(PALETTE[k % PALETTE.length]);
              doc.font('Helvetica-Bold').fontSize(8).fillColor(C.text)
                .text(chart.f ? chart.f(it.value) : String(it.value), bx + barMaxW + 6, y + 2, { width: valueW, align: 'right', lineBreak: false });
            });
          });

          doc.y = y0 + blockH;
        }
        doc.moveDown(0.5);
        doc.fillColor(C.text);
      }

      // ---------- Financial KPI cards ----------
      const totals = (ids.includes(1) || ids.includes(2)) ? getPeriodTotals(data.financials) : null;
      if (totals) {
        drawCards([
          { label: 'Revenue', value: money(totals.amountReceived) },
          { label: 'Billed', value: money(totals.revenueCollected) },
          { label: 'Gross Profit', value: money(totals.grossProfit) },
          { label: 'Operating Expenses', value: money(totals.operatingExpenses) },
          { label: 'Net Profit', value: money(totals.netProfit), color: totals.netProfit >= 0 ? C.green : C.red },
        ]);

        // Day-by-day trend (only when the period has more than one day)
        const trend = data.financials?.periodTrend || [];
        if (trend.length > 1) {
          drawTable(
            'Financial Trend',
            [
              { h: 'Date', k: 'label', w: 2 },
              { h: 'Billed', k: 'revenueCollected', w: 2, f: money, r: true },
              { h: 'Gross Profit', k: 'grossProfit', w: 2, f: money, r: true },
              { h: 'Operating Expenses', k: 'operatingExpenses', w: 2, f: money, r: true },
              { h: 'Net Profit', k: 'netProfit', w: 2, f: money, r: true },
            ],
            trend
          );
        }
      }

      // ---------- Table renderer ----------
      function drawTable(title, cols, allRows, opts = {}) {
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
          doc.rect(left, y0, contentWidth(), h).fill(C.navy);
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
        sectionTitle(title, opts.small);
        if (!opts.small) {
          doc.font('Helvetica').fontSize(8).fillColor(C.muted)
            .text(`${allRows.length} record${allRows.length === 1 ? '' : 's'}`, left, doc.y + 1);
        }
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
            doc.font('Helvetica').fontSize(fontSize); // the header leaves the font bold
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
        if (!cfg.summary || rows.length === 0) {
          drawTable(cfg.title, cfg.cols, rows);
          return;
        }

        const s = cfg.summary(rows);
        // Keep the title, cards and first row of charts on one page
        const firstCharts = (s.charts || []).slice(0, 2);
        const chartH = firstCharts.length ? 28 + Math.max(...firstCharts.map((c) => Math.max(1, c.items.length))) * 18 : 0;
        ensureSpace(36 + (s.cards?.length ? 68 : 0) + chartH);
        sectionTitle(cfg.title);
        doc.font('Helvetica').fontSize(8).fillColor(C.muted)
          .text(`Summary of ${rows.length} record${rows.length === 1 ? '' : 's'}`, left, doc.y + 1);
        doc.moveDown(0.6);
        if (s.cards?.length) drawCards(s.cards, 50);
        if (s.charts?.length) drawCharts(s.charts);
        if (s.table) drawTable(s.table.title, s.table.cols, s.table.rows, { small: true });
        if (cfg.alsoList) drawTable(`${cfg.title} - Details`, cfg.cols, rows, { small: true });
        doc.moveDown(0.5);
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

  const card = (label, value, color = '#172a45') => `
    <td style="width:20%;padding:6px;">
      <div style="background:#f0f4f8;border:1px solid #d9e2ec;border-left:4px solid #14b8a6;border-radius:8px;padding:12px;">
        <div style="font-size:11px;color:#6B7280;text-transform:uppercase;letter-spacing:.5px;">${label}</div>
        <div style="font-size:18px;font-weight:bold;color:${color};margin-top:4px;">${value}</div>
      </div>
    </td>`;

  const cards = totals ? `
    <table role="presentation" style="width:100%;border-collapse:collapse;margin:16px 0;"><tr>
      ${card('Revenue', money(totals.amountReceived))}
      ${card('Billed', money(totals.revenueCollected))}
      ${card('Gross Profit', money(totals.grossProfit))}
      ${card('Expenses', money(totals.operatingExpenses))}
      ${card('Net Profit', money(totals.netProfit), totals.netProfit >= 0 ? '#0d9488' : '#dc2626')}
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
    <div style="background:#172a45;border-bottom:4px solid #14b8a6;color:#fff;padding:18px 20px;">
      <div style="font-size:18px;font-weight:bold;">${esc(scheduleName)}</div>
      <div style="font-size:12px;opacity:.9;margin-top:4px;">Period: ${esc(metadata.fromDate)} to ${esc(metadata.toDate)}</div>
    </div>
    <div style="padding:16px 20px;color:#172a45;">
      <p style="margin:0 0 4px;font-size:14px;">Hello,</p>
      <p style="margin:0;font-size:14px;color:#374151;">Your automated report is ready. A summary is below and the full report is attached as a PDF.</p>
      ${cards}
      ${sections ? `<table role="presentation" style="width:100%;border-collapse:collapse;font-size:13px;margin-top:8px;">${sections}</table>` : ''}
      <p style="margin:20px 0 0;font-size:12px;color:#6B7280;">- Akshaya Sahayi</p>
    </div>
  </div>`;
};