import React, { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "react-toastify";
import axios from "axios";
import {
  FiClock, FiCalendar, FiDollarSign, FiLogOut, FiLogIn, FiTrendingUp, FiTrendingDown,
  FiCheckCircle, FiAlertCircle, FiRefreshCw, FiDownload, FiPlus, FiHome, FiBriefcase,
  FiCoffee, FiFileText, FiX, FiUserCheck, FiTarget, FiChevronDown, FiArrowRight,
} from "react-icons/fi";
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement, PointElement,
  ArcElement, Title, Tooltip, Legend, Filler,
} from "chart.js";
import { Bar, Line, Doughnut } from "react-chartjs-2";
import {
  getStaffList, getAllAttendance, getSalaryData, getLeaves, submitLeave, postAttendance, postBreak, getCalendarData,
} from "/src/services/salaryService";
import CalendarView from "/src/components/CalendarView";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Title, Tooltip, Legend, Filler);
ChartJS.defaults.color = "#64748b";

/* ---------- Helpers ---------- */
const IST = "Asia/Kolkata";

// 'YYYY-MM-DD' in IST for any date value (a plain date string is used as it is)
const ymd = (v) => {
  if (!v) return "";
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-CA", { timeZone: IST });
};
const todayYmd = () => ymd(new Date());
const currentMonthStr = () => todayYmd().slice(0, 7);
const nowHM = () =>
  new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: IST });

const utcFromYmd = (s) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d || 1));
};
const formatDate = (v) => {
  const s = ymd(v);
  return s ? utcFromYmd(s).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }) : "—";
};
const formatDay = (v) => {
  const s = ymd(v);
  return s ? utcFromYmd(s).toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short", timeZone: "UTC" }) : "—";
};
const monthLabel = (m) =>
  m ? utcFromYmd(`${m}-01`).toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" }) : "";
const monthShort = (m) =>
  m ? utcFromYmd(`${m}-01`).toLocaleDateString("en-IN", { month: "short", year: "numeric", timeZone: "UTC" }) : "";
const addMonths = (m, n) => {
  const [y, mo] = m.split("-").map(Number);
  const d = new Date(Date.UTC(y, mo - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
};
const generateMonthOptions = () => {
  const cur = currentMonthStr();
  const out = [];
  for (let i = -12; i <= 3; i += 1) {
    const value = addMonths(cur, i);
    out.push({ value, label: i === 0 ? `${monthLabel(value)} (Current)` : i > 0 ? `${monthLabel(value)} (Future)` : monthLabel(value) });
  }
  return out;
};

const inr = (n) => `₹${Math.round(Number(n) || 0).toLocaleString("en-IN")}`;
const toList = (res, ...keys) => {
  if (Array.isArray(res)) return res;
  for (const k of ["data", ...keys]) if (Array.isArray(res?.[k])) return res[k];
  return [];
};
const csvCell = (v) => {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const titleCase = (s) => (s ? String(s).split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ") : "Unknown");
const toMinutes = (t) => {
  const [h, m] = String(t || "").split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};
const isPublished = (s) => ["sent", "viewed"].includes(s?.status);
const targetHours = (s) => Number(s.working_days) * Number(s.snapshot_daily_hours) || 0;
// punch times are IST wall-clock times, so pin the offset (the browser's own zone is irrelevant)
const istStamp = (day, time) => `${day}T${String(time).slice(0, 5)}:00+05:30`;
const sinceText = (since, nowMs) => {
  if (!since) return "—";
  const ms = nowMs - new Date(since).getTime();
  if (!(ms >= 0)) return "0h 0m";
  return `${Math.floor(ms / 3600000)}h ${Math.floor((ms % 3600000) / 60000)}m`;
};
const isLeaveStatus = (s) => typeof s === "string" && s.includes("leave");

const STATUS = {
  present: { label: "Present", chip: "bg-emerald-50 text-emerald-700 ring-emerald-200", dot: "bg-emerald-500" },
  weekend: { label: "Weekend", chip: "bg-slate-100 text-slate-600 ring-slate-200", dot: "bg-slate-400" },
  absent: { label: "Absent", chip: "bg-rose-50 text-rose-700 ring-rose-200", dot: "bg-rose-500" },
};
const statusMeta = (s) => {
  if (STATUS[s]) return STATUS[s];
  if (isLeaveStatus(s)) return { label: titleCase(s), chip: "bg-amber-50 text-amber-700 ring-amber-200", dot: "bg-amber-500" };
  if (!s) return STATUS.absent;
  return { label: titleCase(s), chip: "bg-slate-100 text-slate-600 ring-slate-200", dot: "bg-slate-400" };
};
const LEAVE_STATUS = {
  approved: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  rejected: "bg-rose-50 text-rose-700 ring-rose-200",
};

const TABS = [
  { id: "dashboard", label: "Dashboard", icon: FiHome },
  { id: "attendance", label: "Attendance", icon: FiCheckCircle },
  { id: "leave", label: "Leave", icon: FiCoffee },
  { id: "calendar", label: "Calendar", icon: FiCalendar },
  { id: "schedule", label: "My schedule", icon: FiClock },
  { id: "planner", label: "Goal planner", icon: FiTarget },
  { id: "payslips", label: "Payslips", icon: FiFileText },
];
const MONTH_TABS = ["dashboard", "attendance", "planner"];

const inputCls =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 transition focus:border-transparent focus:outline-none focus:ring-2 focus:ring-navy-500/40 disabled:bg-slate-50 disabled:text-slate-400";
const btnPrimary =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-navy-700 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-navy-800 disabled:cursor-not-allowed disabled:opacity-50";
const btnGhost =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-navy-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50";

/* ---------- Small components ---------- */
class ErrorBoundary extends React.Component {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error, info) { console.error("Error in StaffAttendance:", error, info); }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 text-center">
          <h3 className="text-lg font-bold text-rose-600">Something went wrong</h3>
          <p className="text-slate-600">Please refresh the page or contact support.</p>
        </div>
      );
    }
    return this.props.children;
  }
}

const Chip = ({ cls, dot, children }) => (
  <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${cls}`}>
    {dot && <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />}
    {children}
  </span>
);
const StatusChip = ({ status }) => {
  const m = statusMeta(status);
  return <Chip cls={m.chip} dot={m.dot}>{m.label}</Chip>;
};
const LeaveChip = ({ status }) => (
  <Chip cls={LEAVE_STATUS[status] || "bg-amber-50 text-amber-700 ring-amber-200"}>{titleCase(status || "pending")}</Chip>
);

const Card = ({ title, icon: Icon, action, children, className = "" }) => (
  <div className={`rounded-2xl border border-slate-200 bg-white p-5 ${className}`}>
    {(title || action) && (
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
          {Icon && <Icon className="h-4 w-4 text-navy-700" />} {title}
        </h3>
        {action}
      </div>
    )}
    {children}
  </div>
);

const Empty = ({ icon: Icon = FiFileText, children }) => (
  <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
    <Icon className="mb-3 h-10 w-10 text-slate-300" />
    <p className="text-sm text-slate-500">{children}</p>
  </div>
);

const Modal = ({ onClose, children, width = "max-w-md" }) => {
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog" aria-modal="true"
    >
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12 }}
        className={`max-h-[90vh] w-full ${width} overflow-y-auto rounded-2xl bg-white shadow-xl`}
      >
        {children}
      </motion.div>
    </motion.div>
  );
};

const ModalHeader = ({ title, subtitle, onClose }) => (
  <div className="mb-5 flex items-start justify-between gap-3">
    <div>
      <h3 className="text-lg font-bold text-slate-900">{title}</h3>
      {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
    </div>
    <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100" aria-label="Close"><FiX className="h-5 w-5" /></button>
  </div>
);

const Field = ({ label, htmlFor, error, hint, children }) => (
  <div>
    <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-slate-700">{label}</label>
    {children}
    {error ? <p className="mt-1 text-xs text-rose-600">{error}</p> : hint ? <p className="mt-1 text-xs text-slate-400">{hint}</p> : null}
  </div>
);

const SelectWrap = ({ children }) => (
  <div className="relative">
    <FiChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
    {children}
  </div>
);

const MonthSelect = ({ value, onChange, options, label = "Month" }) => (
  <SelectWrap>
    <select value={value} onChange={(e) => onChange(e.target.value)} aria-label={label} className="appearance-none rounded-xl border border-slate-200 bg-white py-2.5 pl-3.5 pr-9 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-navy-500/40">
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  </SelectWrap>
);

/* ---------- Charts ---------- */
const AttendanceTrendChart = ({ attendance }) => {
  const days = useMemo(() => {
    const byDay = new Map();
    attendance.forEach((a) => {
      const d = ymd(a.date);
      if (d) byDay.set(d, (byDay.get(d) || 0) + (Number(a.hours) || 0));
    });
    return [...byDay.entries()].filter(([, h]) => h > 0).sort((a, b) => a[0].localeCompare(b[0])).slice(-7);
  }, [attendance]);

  const data = {
    labels: days.map(([d]) => formatDay(d)),
    datasets: [{
      label: "Work hours", data: days.map(([, h]) => Number(h.toFixed(2))),
      borderColor: "#1e3a5f", backgroundColor: "rgba(30,58,95,0.1)", pointBackgroundColor: "#1e3a5f", tension: 0.25, fill: true,
    }],
  };
  const options = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: { y: { beginAtZero: true, suggestedMax: 10, ticks: { callback: (v) => `${v}h` }, grid: { color: "#f1f5f9" } }, x: { grid: { display: false } } },
  };
  return (
    <Card title="Recent work hours" icon={FiTrendingUp}>
      <div className="h-60">{days.length ? <Line data={data} options={options} /> : <Empty>No hours recorded yet</Empty>}</div>
    </Card>
  );
};

const AttendanceMixChart = ({ stats, month }) => {
  const total = stats.presentDays + stats.leaveDays + stats.absentDays;
  const data = {
    labels: ["Present", "Leave", "Absent"],
    datasets: [{ data: [stats.presentDays, stats.leaveDays, stats.absentDays], backgroundColor: ["#10b981", "#f59e0b", "#f43f5e"], borderWidth: 0 }],
  };
  const options = { maintainAspectRatio: false, cutout: "62%", plugins: { legend: { position: "right", labels: { usePointStyle: true, boxWidth: 8 } } } };
  return (
    <Card title={`Attendance mix · ${monthShort(month)}`} icon={FiCheckCircle}>
      <div className="h-60">{total ? <Doughnut data={data} options={options} /> : <Empty>No attendance for this month</Empty>}</div>
    </Card>
  );
};

const SalaryTrendChart = ({ salaries }) => {
  const rows = useMemo(
    () => salaries.filter(isPublished).slice().sort((a, b) => a.month.localeCompare(b.month)).slice(-6),
    [salaries]
  );
  const data = {
    labels: rows.map((r) => monthShort(r.month)),
    datasets: [{ label: "Net salary", data: rows.map((r) => Number(r.net_salary) || 0), backgroundColor: "#1e3a5f", borderRadius: 6, maxBarThickness: 42 }],
  };
  const options = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => ` ${inr(c.parsed.y)}` } } },
    scales: { y: { beginAtZero: true, ticks: { callback: (v) => `₹${Number(v).toLocaleString("en-IN")}` }, grid: { color: "#f1f5f9" } }, x: { grid: { display: false } } },
  };
  return (
    <Card title="Salary trend (last 6 months)" icon={FiDollarSign}>
      <div className="h-60">{rows.length ? <Bar data={data} options={options} /> : <Empty>No salary records yet</Empty>}</div>
    </Card>
  );
};

/* ---------- Goal planner ---------- */
const bonusPctFor = (slabs, workPct, revPct) => {
  let bonus = 0;
  for (const slab of slabs) {
    if (workPct >= Number(slab.min_working_hours_pct) && revPct >= Number(slab.min_collection_pct)) bonus = Number(slab.bonus_pct);
  }
  return bonus;
};

// Same maths as before, gathered in one place
const computePlanner = (config, { plannedLeaves, projectedRevenue, targetSalary, targetLeaves }) => {
  const calendarDays = Number(config.month_stats.calendar_days) || 1;
  const targetDays = Number(config.month_stats.target_working_days) || 0;
  const offDays = Number(config.month_stats.sundays || 0) + Number(config.month_stats.dl_days || 0) + Number(config.month_stats.other_offdays || 0);
  const basic = Number(config.structure.basic_salary) || 0;
  const ta = Number(config.structure.ta) || 0;
  const fa = Number(config.structure.fa) || 0;
  const dailyHours = Number(config.daily_hours) || 0;
  const slabs = Array.isArray(config.slabs) ? config.slabs : [];

  const dailyRate = basic / calendarDays;
  const hourRate = dailyHours > 0 ? dailyRate / dailyHours : 0;
  const goalHours = targetDays * dailyHours;
  const goalRevenue = goalHours * (Number(config.structure.hourly_service_revenue_target) || 0);
  const pct = (a, b) => (b > 0 ? (a / b) * 100 : 0);

  // earned so far
  const mtdRevenue = Number(config.mtd_actuals.achieved_revenue) || 0;
  const mtdHours = Number(config.mtd_actuals.worked_hours) || 0;
  const mtdWorkPct = pct(mtdHours, goalHours);
  const mtdBonusPct = bonusPctFor(slabs, mtdWorkPct, pct(mtdRevenue, goalRevenue));
  const mtdTotal =
    mtdHours * hourRate + offDays * (mtdWorkPct / 100) * dailyRate + ta * (mtdWorkPct / 100) + fa * (mtdWorkPct / 100) +
    (mtdBonusPct / 100) * Math.max(0, mtdRevenue - goalRevenue);

  // prorated base pay for a given number of leaves
  const base = (leaves) => {
    const hours = Math.max(0, targetDays - leaves) * dailyHours;
    const workPct = pct(hours, goalHours);
    const full = workPct >= 100;
    const basicPay = hours * hourRate;
    const offPay = full ? offDays * dailyRate : offDays * (workPct / 100) * dailyRate;
    const taPay = full ? ta : ta * (workPct / 100);
    const faPay = full ? fa : fa * (workPct / 100);
    return { hours, workPct, total: basicPay + offPay + taPay + faPay };
  };

  // predict
  const p = base(plannedLeaves);
  const pBonusPct = bonusPctFor(slabs, p.workPct, pct(projectedRevenue, goalRevenue));
  const pSurplus = Math.max(0, projectedRevenue - goalRevenue);
  const pBonus = (pBonusPct / 100) * pSurplus;

  // reverse
  const t = base(targetLeaves);
  const requiredBonus = targetSalary - t.total;
  let requiredRevenue = goalRevenue;
  if (requiredBonus > 0 && goalRevenue > 0) {
    const valid = slabs
      .filter((s) => t.workPct >= Number(s.min_working_hours_pct) && Number(s.bonus_pct) > 0)
      .sort((a, b) => Number(a.min_collection_pct) - Number(b.min_collection_pct));
    let hit = null;
    for (const slab of valid) {
      const candidate = goalRevenue + requiredBonus / (Number(slab.bonus_pct) / 100);
      const candidatePct = (candidate / goalRevenue) * 100;
      if (candidatePct >= Number(slab.min_collection_pct) && (slab.max_collection_pct === null || candidatePct < Number(slab.max_collection_pct))) {
        requiredRevenue = candidate; hit = slab; break;
      }
    }
    if (!hit && valid.length > 0) {
      const top = valid[valid.length - 1];
      requiredRevenue = goalRevenue + requiredBonus / (Number(top.bonus_pct) / 100);
    }
  }

  return {
    targetDays, goalRevenue, mtdRevenue, mtdHours, mtdTotal,
    pBase: p.total, pBonusPct, pBonus, pSurplus, pTotal: p.total + pBonus,
    tBase: t.total, requiredBonus, requiredRevenue,
  };
};

const SalaryPlanner = ({ month }) => {
  const [config, setConfig] = useState(null);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [mode, setMode] = useState("predict");
  const [plannedLeaves, setPlannedLeaves] = useState(0);
  const [projectedRevenue, setProjectedRevenue] = useState(0);
  const [targetSalary, setTargetSalary] = useState(0);
  const [targetLeaves, setTargetLeaves] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setConfig(null);
    setError(false);
    axios
      .get(`${import.meta.env.VITE_API_URL}/api/salary/my-planner-config`, {
        params: { month },
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      })
      .then((res) => {
        if (cancelled) return;
        const d = res.data;
        setConfig(d);
        setProjectedRevenue(Number(d.mtd_actuals.achieved_revenue) || 0);
        setTargetSalary(Number(d.structure.basic_salary) + Number(d.structure.ta) + Number(d.structure.fa));
        setPlannedLeaves(0);
        setTargetLeaves(0);
      })
      .catch((err) => { if (!cancelled) { console.error(err); setError(true); } });
    return () => { cancelled = true; };
  }, [month, reloadKey]);

  if (error) {
    return (
      <Card>
        <Empty icon={FiAlertCircle}>Could not load the planner.</Empty>
        <div className="pb-4 text-center"><button type="button" onClick={() => setReloadKey((k) => k + 1)} className={btnGhost}><FiRefreshCw /> Retry</button></div>
      </Card>
    );
  }
  if (!config) return <div className="h-72 animate-pulse rounded-2xl bg-white" />;

  const r = computePlanner(config, { plannedLeaves, projectedRevenue, targetSalary, targetLeaves });
  const sliderMax = Math.ceil(Math.max(r.goalRevenue * 3, r.mtdRevenue * 1.5, 5000) / 500) * 500;
  const left = r.requiredRevenue - r.mtdRevenue;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
      <div className="mb-6 flex flex-col gap-4 border-b border-slate-100 pb-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Salary & goal planner</h2>
          <p className="mt-1 text-sm text-slate-500">{monthLabel(month)} · {r.targetDays} target days · base target {inr(r.goalRevenue)}</p>
        </div>
        <div className="flex items-center gap-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-800">Earned till date</p>
            <p className="text-2xl font-bold tabular-nums text-emerald-600">{inr(r.mtdTotal)}</p>
          </div>
          <div className="border-l border-emerald-200 pl-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-800">Hours</p>
            <p className="text-sm font-bold tabular-nums text-emerald-700">{r.mtdHours.toFixed(1)}h</p>
          </div>
        </div>
        <div className="inline-flex rounded-xl bg-slate-100 p-1" role="tablist" aria-label="Planner mode">
          {[["predict", "Predict payout"], ["target", "Hit my goal"]].map(([id, label]) => (
            <button key={id} type="button" role="tab" aria-selected={mode === id} onClick={() => setMode(id)} className={`rounded-lg px-4 py-2 text-sm font-medium transition ${mode === id ? "bg-white text-navy-700 shadow-sm" : "text-slate-500"}`}>{label}</button>
          ))}
        </div>
      </div>

      {mode === "predict" ? (
        <div className="grid gap-8 lg:grid-cols-2">
          <div className="space-y-7">
            <div>
              <div className="mb-2 flex justify-between text-sm"><label htmlFor="pl-leaves" className="font-medium text-slate-700">Planned leaves (unpaid)</label><span className="font-bold text-rose-600">{plannedLeaves} {plannedLeaves === 1 ? "day" : "days"}</span></div>
              <input id="pl-leaves" type="range" min="0" max={r.targetDays} value={plannedLeaves} onChange={(e) => setPlannedLeaves(Number(e.target.value))} className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-slate-200 accent-rose-500" />
            </div>
            <div>
              <div className="mb-2 flex justify-between text-sm"><label htmlFor="pl-rev" className="font-medium text-slate-700">Expected total service charge</label><span className="font-bold text-navy-700">{inr(projectedRevenue)}</span></div>
              <input id="pl-rev" type="range" min="0" max={sliderMax} step="500" value={projectedRevenue} onChange={(e) => setProjectedRevenue(Number(e.target.value))} className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-slate-200 accent-navy-700" />
              <div className="mt-2 flex justify-between text-xs font-medium">
                <span className="text-slate-400">So far: {inr(r.mtdRevenue)}</span>
                {r.pSurplus > 0 && <span className="text-emerald-600">+{inr(r.pSurplus)} surplus</span>}
              </div>
            </div>
          </div>
          <div className="flex flex-col justify-between rounded-xl border border-slate-100 bg-slate-50 p-5">
            <div>
              <h3 className="mb-3 border-b border-slate-200 pb-2 text-sm font-semibold text-slate-800">Payout breakdown</h3>
              <div className="space-y-2.5 text-sm text-slate-600">
                <div className="flex justify-between"><span>Base pay & allowances</span><span className="font-medium tabular-nums text-slate-900">{inr(r.pBase)}</span></div>
                <div className="flex justify-between"><span>Performance bonus ({r.pBonusPct}%)</span><span className="font-semibold tabular-nums text-emerald-600">+{inr(r.pBonus)}</span></div>
              </div>
            </div>
            <div className="mt-4 flex items-end justify-between border-t border-slate-200 pt-4">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Projected net pay</span>
              <span className="text-3xl font-bold tabular-nums text-emerald-600">{inr(r.pTotal)}</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid gap-8 lg:grid-cols-2">
          <div className="space-y-6">
            <Field label="My target salary (net pay)" htmlFor="pl-target">
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-semibold text-slate-500">₹</span>
                <input id="pl-target" type="number" min="0" value={targetSalary} onChange={(e) => setTargetSalary(Number(e.target.value) || 0)} className={`${inputCls} pl-8 text-base font-semibold`} />
              </div>
            </Field>
            <div>
              <div className="mb-2 flex justify-between text-sm"><label htmlFor="pl-tleaves" className="font-medium text-slate-700">Planned leaves</label><span className="font-bold text-rose-600">{targetLeaves} {targetLeaves === 1 ? "day" : "days"}</span></div>
              <input id="pl-tleaves" type="range" min="0" max={r.targetDays} value={targetLeaves} onChange={(e) => setTargetLeaves(Number(e.target.value))} className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-slate-200 accent-rose-500" />
            </div>
          </div>
          <div className="flex flex-col justify-between rounded-xl border border-emerald-100 bg-emerald-50 p-5">
            <div>
              <h3 className="mb-3 border-b border-emerald-200 pb-2 text-sm font-semibold text-emerald-900">How to hit {inr(targetSalary)}</h3>
              <div className="space-y-2.5 text-sm text-emerald-800">
                <div className="flex justify-between"><span>Guaranteed base payout</span><span className="font-semibold tabular-nums">{inr(r.tBase)}</span></div>
                <div className="flex justify-between"><span>Required bonus</span><span className="font-semibold tabular-nums">{r.requiredBonus > 0 ? inr(r.requiredBonus) : "None needed"}</span></div>
              </div>
            </div>
            <div className="mt-4 border-t border-emerald-200 pt-4">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-emerald-700">Required total service charge</span>
              <div className="flex flex-wrap items-end justify-between gap-2">
                <span className="text-3xl font-bold tabular-nums text-emerald-700">{inr(r.requiredRevenue)}</span>
                <span className={`rounded-lg bg-white px-2.5 py-1 text-sm font-semibold shadow-sm ${left > 0 ? "text-rose-600" : "text-emerald-600"}`}>{left > 0 ? `${inr(left)} left this month` : "Goal hit!"}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* ---------- Payslip PDF ---------- */
const loadLogo = (doc, url) =>
  new Promise((resolve) => {
    const img = new Image();
    const timer = setTimeout(resolve, 4000);
    img.crossOrigin = "Anonymous";
    img.onload = () => {
      try { doc.addImage(img, "PNG", 14, 12, 22, 22); } catch (e) { console.warn("Could not add logo to PDF", e); }
      clearTimeout(timer);
      resolve();
    };
    img.onerror = () => { clearTimeout(timer); resolve(); };
    img.src = url;
  });

const buildPayslip = async (salary) => {
  const doc = new jsPDF("p", "mm", "a4");
  const centreName = salary.centre_name || "AKSHAYA CRM";
  const centreAddress = salary.centre_address || "Official Payslip Statement";

  if (salary.centre_logo) {
    const logoUrl = salary.centre_logo.startsWith("http") ? salary.centre_logo : `${import.meta.env.VITE_API_URL}${salary.centre_logo}`;
    await loadLogo(doc, logoUrl);
  }

  doc.setFontSize(22);
  doc.setTextColor(30, 58, 95);
  doc.setFont(undefined, "bold");
  doc.text(centreName.toUpperCase(), 105, 22, { align: "center" });

  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.setFont(undefined, "normal");
  const splitAddress = doc.splitTextToSize(centreAddress, 140);
  doc.text(splitAddress, 105, 29, { align: "center" });

  const headerBottomY = 32 + splitAddress.length * 4;
  doc.setDrawColor(30, 58, 95);
  doc.setLineWidth(0.5);
  doc.line(14, headerBottomY, 196, headerBottomY);

  const infoStartY = headerBottomY + 8;
  doc.setFontSize(10);
  doc.setTextColor(40, 40, 40);
  doc.text(`Employee Name: ${salary.staff_name || "N/A"}`, 14, infoStartY);
  doc.text(`Employee ID: ${salary.employee_id || "N/A"}`, 14, infoStartY + 7);
  doc.text(`Department: ${salary.department || "N/A"}`, 14, infoStartY + 14);
  doc.text(`Salary Month: ${monthShort(salary.month)}`, 196, infoStartY, { align: "right" });
  doc.text(`Target Hours: ${targetHours(salary).toFixed(1)}h`, 196, infoStartY + 7, { align: "right" });
  doc.text(`Worked Hours: ${Number(salary.total_worked_hours).toFixed(1)}h`, 196, infoStartY + 14, { align: "right" });

  const rs = (v) => `Rs ${Number(v || 0).toLocaleString("en-IN")}`;
  autoTable(doc, {
    startY: infoStartY + 22,
    head: [["Earnings & Deductions", "Amount"]],
    body: [
      ["Basic Pay (Hours Worked)", rs(salary.basic)],
      ["Offday Pay (Prorated)", rs(salary.offday_pay)],
      ["Travel Allowance (TA)", rs(salary.ta)],
      ["Food Allowance (FA)", rs(salary.fa)],
      ["Service Charge Bonus", `+ ${rs(salary.bonus)}`],
      ["Deductions / Advances", `- ${rs(salary.deductions)}`],
    ],
    theme: "striped",
    headStyles: { fillColor: [30, 58, 95], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [249, 250, 251] },
    styles: { fontSize: 10, cellPadding: 6 },
    columnStyles: { 0: { fontStyle: "normal" }, 1: { halign: "right", fontStyle: "bold" } },
    willDrawCell: (data) => {
      if (data.section !== "body") return;
      if (data.row.index === 4 && data.column.index === 1) data.cell.styles.textColor = [5, 150, 105];
      if (data.row.index === 5) data.cell.styles.textColor = [220, 38, 38];
    },
  });

  const finalY = doc.lastAutoTable.finalY + 10;
  doc.setFillColor(243, 244, 246);
  doc.rect(14, finalY, 182, 12, "F");
  doc.setFontSize(12);
  doc.setTextColor(40, 40, 40);
  doc.setFont(undefined, "bold");
  doc.text("Net Salary Payable", 18, finalY + 8);
  doc.setFontSize(14);
  doc.setTextColor(5, 150, 105);
  doc.text(rs(salary.net_salary), 192, finalY + 8, { align: "right" });

  doc.setFontSize(9);
  doc.setTextColor(150, 150, 150);
  doc.setFont(undefined, "normal");
  doc.text("This is a system generated document and does not require a physical signature.", 105, finalY + 30, { align: "center" });
  doc.text(`${centreName} • Generated on ${formatDate(new Date())}`, 105, finalY + 36, { align: "center" });

  doc.save(`Payslip_${(salary.staff_name || "Staff").replace(/\s+/g, "_")}_${salary.month}.pdf`);
};

/* ========== MAIN COMPONENT ========== */
const StaffAttendance = () => {
  const curMonth = currentMonthStr();

  const [activeTab, setActiveTab] = useState(() => {
    const t = new URLSearchParams(window.location.search).get("tab");
    return TABS.some((x) => x.id === t) ? t : "dashboard";
  });
  useEffect(() => {
    try {
      const url = new URL(window.location);
      url.searchParams.set("tab", activeTab);
      window.history.replaceState({}, "", url);
    } catch { /* ignore */ }
  }, [activeTab]);

  const [staff, setStaff] = useState(null);
  const [monthData, setMonthData] = useState({}); // 'YYYY-MM' -> attendance records
  const [loadError, setLoadError] = useState(false);
  const [allSalaryData, setAllSalaryData] = useState([]);
  const [leaveApplications, setLeaveApplications] = useState([]);
  const [leavesLoading, setLeavesLoading] = useState(true);
  const [calendarEvents, setCalendarEvents] = useState([]);
  const [ready, setReady] = useState(false);

  const [selectedMonth, setSelectedMonth] = useState(curMonth);
  const [selectedLeaveMonth, setSelectedLeaveMonth] = useState(curMonth);
  const monthOptions = useMemo(() => generateMonthOptions(), []);

  const [showPunchModal, setShowPunchModal] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [showBreakModal, setShowBreakModal] = useState(false);
  const [punchForm, setPunchForm] = useState({ punch_type: "in", time: "", date: todayYmd(), breaks: "" });
  const [breakForm, setBreakForm] = useState({ attendance_id: null, break_time: "" });
  const [newLeave, setNewLeave] = useState({ type: "casual_leave", from_date: "", to_date: "", reason: "", leave_duration: "full", leave_time: "" });
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const attReq = useRef({});
  const leaveReq = useRef(0);

  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  /* ---- data loading ---- */
  const loadMonth = async (month) => {
    const id = (attReq.current[month] || 0) + 1;
    attReq.current[month] = id;
    try {
      const data = toList(await getAllAttendance(month));
      if (attReq.current[month] !== id) return;
      setMonthData((p) => ({ ...p, [month]: data }));
      setLoadError(false);
    } catch (error) {
      if (attReq.current[month] !== id) return;
      console.error("Error fetching attendance:", error);
      setMonthData((p) => ({ ...p, [month]: p[month] || [] }));
      setLoadError(true);
      toast.error(error.response?.data?.error || "Failed to load attendance.");
    }
  };

  useEffect(() => { loadMonth(selectedMonth); }, [selectedMonth]);

  useEffect(() => {
    (async () => {
      const [staffRes, calRes, salRes] = await Promise.allSettled([getStaffList(), getCalendarData(), getSalaryData()]);
      if (staffRes.status === "fulfilled") setStaff(toList(staffRes.value)[0] || null);
      else toast.error(staffRes.reason?.response?.data?.error || "Failed to load data. Please try again.");
      if (calRes.status === "fulfilled") setCalendarEvents(toList(calRes.value));
      else console.error("Failed to load calendar", calRes.reason);
      if (salRes.status === "fulfilled") setAllSalaryData(toList(salRes.value));
      else { console.error(salRes.reason); toast.error("Failed to load salary history"); }
      setReady(true);
    })();
  }, []);

  useEffect(() => {
    const id = ++leaveReq.current;
    setLeavesLoading(true);
    getLeaves(selectedLeaveMonth)
      .then((res) => { if (id === leaveReq.current) setLeaveApplications(toList(res)); })
      .catch((error) => {
        if (id !== leaveReq.current) return;
        console.error("Error fetching leave applications:", error);
        toast.error("Failed to load leave applications.");
      })
      .finally(() => { if (id === leaveReq.current) setLeavesLoading(false); });
  }, [selectedLeaveMonth]);

  const attendance = monthData[selectedMonth];
  const attendanceRows = useMemo(
    () => (attendance || []).slice().sort((a, b) => ymd(b.date).localeCompare(ymd(a.date))),
    [attendance]
  );
  const initialLoading = !ready || monthData[curMonth] === undefined;

  /* ---- punch status (always from today's records, whichever month is shown) ---- */
  const today = todayYmd();
  const punch = useMemo(() => {
    const todays = (monthData[curMonth] || []).filter((a) => ymd(a.date) === today);
    const open = todays.find((r) => r.punch_in && !r.punch_out);
    if (open) return { status: "in", since: istStamp(today, open.punch_in), at: open.punch_in };
    const last = todays
      .filter((r) => r.punch_out)
      .sort((a, b) => toMinutes(a.punch_out) - toMinutes(b.punch_out))
      .pop();
    return last ? { status: "out", since: istStamp(today, last.punch_out), at: last.punch_out } : { status: "out", since: null, at: null };
  }, [monthData, curMonth, today]);

  const stats = useMemo(() => {
    const rows = attendance || [];
    const uniqueDays = (pred) => new Set(rows.filter(pred).map((a) => ymd(a.date))).size;
    const presentDays = uniqueDays((a) => a.status === "present");
    const leaveDays = uniqueDays((a) => isLeaveStatus(a.status));
    const absentDays = uniqueDays((a) => a.status === "absent");
    const totalHours = rows.reduce((s, a) => s + (Number(a.hours) || 0), 0);
    const published = allSalaryData.filter(isPublished).slice().sort((a, b) => b.month.localeCompare(a.month));
    const latest = published[0];
    const prev = published[1];
    const currentSalary = latest ? Number(latest.net_salary) : 0;
    const previousSalary = prev ? Number(prev.net_salary) : 0;
    let growth = 0;
    if (previousSalary > 0 && currentSalary > 0) growth = Number((((currentSalary - previousSalary) / previousSalary) * 100).toFixed(1));
    else if (currentSalary > 0) growth = 100;
    else if (previousSalary > 0) growth = -100;
    return {
      presentDays, leaveDays, absentDays,
      totalHours: totalHours.toFixed(1),
      avgHours: presentDays > 0 ? (totalHours / presentDays).toFixed(1) : "0.0",
      currentSalary, currentSalaryMonth: latest?.month || "", growth, published,
    };
  }, [attendance, allSalaryData]);

  /* ---- actions ---- */
  const upsertRecord = (month, record) =>
    setMonthData((p) => {
      const list = p[month] || [];
      const exists = record.id !== undefined && list.some((r) => r.id === record.id);
      return { ...p, [month]: exists ? list.map((r) => (r.id === record.id ? record : r)) : [record, ...list] };
    });

  const openPunch = (type) => {
    setFormError("");
    setPunchForm((f) => ({ ...f, punch_type: type, time: nowHM(), date: todayYmd(), breaks: "" }));
    setShowPunchModal(true);
  };

  const handlePunchSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    const currentTime = nowHM();
    const finalTime = punchForm.punch_type === "out" ? currentTime : punchForm.time || currentTime;
    if (punchForm.punch_type === "in" && Math.abs(toMinutes(nowHM()) - toMinutes(finalTime)) > 30) {
      setFormError("Punch-in time must be within 30 minutes of the current time.");
      return;
    }
    setFormError("");
    setSubmitting(true);
    try {
      const date = todayYmd();
      const response = await postAttendance({ ...punchForm, time: finalTime, date });
      upsertRecord(date.slice(0, 7), response);
      setShowPunchModal(false);
      setPunchForm({ punch_type: "in", time: "", date, breaks: "" });
      toast.success(`Punch ${punchForm.punch_type === "in" ? "in" : "out"} recorded!`);
    } catch (error) {
      console.error("Error recording punch:", error);
      toast.error(error.response?.data?.error || "Failed to record punch.");
    } finally {
      setSubmitting(false);
    }
  };

  const openBreak = (record) => {
    setFormError("");
    setBreakForm({ attendance_id: record.id || `${record.staff_id}-${record.date}`, break_time: "" });
    setShowBreakModal(true);
  };

  const handleBreakSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    const m = /^(\d{2}:\d{2})-(\d{2}:\d{2})$/.exec(breakForm.break_time.trim());
    if (!m) { setFormError("Use the format HH:MM-HH:MM, e.g. 13:00-14:00."); return; }
    if (toMinutes(m[1]) >= toMinutes(m[2])) { setFormError("Break end time must be after the start time."); return; }
    setFormError("");
    setSubmitting(true);
    try {
      const response = await postBreak({ ...breakForm, break_time: breakForm.break_time.trim() });
      setMonthData((p) => Object.fromEntries(Object.entries(p).map(([k, list]) => [k, list.map((r) => (r.id === response.id ? response : r))])));
      setShowBreakModal(false);
      setBreakForm({ attendance_id: null, break_time: "" });
      toast.success("Break recorded successfully!");
    } catch (error) {
      console.error("Error recording break:", error);
      toast.error(error.response?.data?.error || `Failed to record break: ${error.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const openLeave = () => { setFormError(""); setShowLeaveModal(true); };

  const handleLeaveSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    if (!newLeave.type || !newLeave.from_date || !newLeave.to_date || !newLeave.reason.trim()) { setFormError("All leave fields are required."); return; }
    if (newLeave.to_date < newLeave.from_date) { setFormError("To date cannot be before the from date."); return; }
    if (newLeave.leave_duration === "half" && !newLeave.leave_time) { setFormError("Choose morning or afternoon for a half day."); return; }
    setFormError("");
    setSubmitting(true);
    try {
      const application = await submitLeave({ ...newLeave, reason: newLeave.reason.trim() });
      const month = ymd(application.from_date).slice(0, 7);
      if (month === selectedLeaveMonth) setLeaveApplications((prev) => [application, ...prev]);
      else toast.info(`Application submitted for ${monthLabel(month)}. Switch month to view.`);
      setShowLeaveModal(false);
      setNewLeave({ type: "casual_leave", from_date: "", to_date: "", reason: "", leave_duration: "full", leave_time: "" });
      toast.success("Leave application submitted!");
    } catch (error) {
      console.error("Error submitting leave:", error);
      toast.error(error.response?.data?.error || error.message || "Failed to submit leave application.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownloadPayslip = async (salary) => {
    setDownloadingId(salary.id ?? salary.month);
    try {
      await buildPayslip(salary);
      toast.success("Payslip downloaded!");
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast.error("Failed to generate PDF.");
    } finally {
      setDownloadingId(null);
    }
  };

  const exportAttendance = () => {
    if (attendanceRows.length === 0) { toast.info("Nothing to export"); return; }
    const lines = [
      ["Date", "Punch in", "Punch out", "Breaks", "Status", "Hours"],
      ...attendanceRows.map((a) => [ymd(a.date), a.punch_in || "", a.punch_out || "", a.breaks || "", statusMeta(a.status).label, Number(a.hours) > 0 ? Number(a.hours).toFixed(2) : ""]),
    ].map((r) => r.map(csvCell).join(","));
    const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `attendance-${selectedMonth}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const refreshAll = () => { loadMonth(selectedMonth); };

  /* ---- render helpers (functions, so they never remount) ---- */
  const renderRowActions = (r) =>
    !r.punch_in || r.punch_out ? null : (
      <div className="flex items-center gap-1.5">
        <button type="button" onClick={() => { setFormError(""); setPunchForm((f) => ({ ...f, punch_type: "out", time: nowHM(), date: todayYmd(), breaks: "" })); setShowPunchModal(true); }} className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 px-2.5 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50">
          <FiLogOut className="h-3.5 w-3.5" /> Punch out
        </button>
        <button type="button" onClick={() => openBreak(r)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-navy-700 hover:bg-slate-50">
          <FiCoffee className="h-3.5 w-3.5" /> Add break
        </button>
      </div>
    );

  const timeCell = (t, Icon, tone) =>
    t ? (
      <span className="inline-flex items-center gap-1.5 text-sm text-slate-800"><Icon className={`h-4 w-4 ${tone}`} /> {t}</span>
    ) : (
      <span className="text-sm text-slate-300">—</span>
    );

  const leaveTypeLabel = (a) => (
    <>
      <p className="text-sm font-medium text-slate-900">{titleCase(a.type)}</p>
      <p className="mt-0.5 text-xs text-slate-500">{a.leave_duration === "half" ? `Half day${a.leave_time ? ` (${a.leave_time})` : ""}` : "Full day"}</p>
    </>
  );

  /* ---- sections ---- */
  const tiles = [
    { label: "Present days", value: stats.presentDays, sub: `In ${monthShort(selectedMonth)}`, icon: FiUserCheck, tone: "bg-emerald-50 text-emerald-600" },
    { label: "Total hours", value: `${stats.totalHours}h`, sub: `Worked in ${monthShort(selectedMonth)}`, icon: FiClock, tone: "bg-sky-50 text-sky-600" },
    { label: "Avg. hours / day", value: `${stats.avgHours}h`, sub: `In ${monthShort(selectedMonth)}`, icon: FiTrendingUp, tone: "bg-violet-50 text-violet-600" },
    { label: "Latest salary", value: stats.currentSalary ? inr(stats.currentSalary) : "N/A", sub: stats.currentSalaryMonth ? monthShort(stats.currentSalaryMonth) : "No salary data", icon: FiDollarSign, tone: "bg-amber-50 text-amber-600", trend: stats.currentSalary ? stats.growth : undefined },
  ];

  const recent = attendanceRows.slice(0, 5);
  const overview = stats.published.slice(0, 3);

  const dashboard = (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.label} className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4">
            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${t.tone}`}><t.icon className="h-5 w-5" /></span>
            <span className="min-w-0">
              <span className="block truncate text-xs text-slate-500">{t.label}</span>
              <span className="block truncate text-xl font-bold tabular-nums text-slate-900">{t.value}</span>
              <span className="block truncate text-xs text-slate-400">{t.sub}</span>
              {t.trend !== undefined && t.trend !== 0 && (
                <span className={`mt-0.5 inline-flex items-center gap-1 text-xs font-medium ${t.trend > 0 ? "text-emerald-600" : "text-rose-600"}`}>
                  {t.trend > 0 ? <FiTrendingUp className="h-3 w-3" /> : <FiTrendingDown className="h-3 w-3" />}
                  {t.trend > 0 ? "+" : ""}{t.trend}% vs previous
                </span>
              )}
            </span>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <AttendanceTrendChart attendance={attendance || []} />
        <AttendanceMixChart stats={stats} month={selectedMonth} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Recent attendance" icon={FiBriefcase} action={<button type="button" onClick={() => setActiveTab("attendance")} className="inline-flex items-center gap-1 text-xs font-medium text-navy-700 hover:underline">View all <FiArrowRight className="h-3 w-3" /></button>}>
          {recent.length === 0 ? <p className="py-6 text-center text-sm text-slate-400">No records this month</p> : (
            <ul className="divide-y divide-slate-100">
              {recent.map((r) => (
                <li key={r.id || `${r.staff_id}-${r.date}`} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900">{formatDay(r.date)}</p>
                    <p className="text-xs text-slate-500">
                      {r.punch_in && r.punch_out ? `${r.punch_in} – ${r.punch_out}` : r.punch_in ? `In at ${r.punch_in}` : "Not punched"}
                    </p>
                    {r.breaks && <p className="text-xs text-slate-400">Breaks: {r.breaks}</p>}
                  </div>
                  {Number(r.hours) > 0 ? <span className="shrink-0 text-sm font-semibold tabular-nums text-slate-700">{Number(r.hours).toFixed(2)}h</span> : <StatusChip status={r.status} />}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Salary overview" icon={FiDollarSign} action={<button type="button" onClick={() => setActiveTab("payslips")} className="inline-flex items-center gap-1 text-xs font-medium text-navy-700 hover:underline">Payslips <FiArrowRight className="h-3 w-3" /></button>}>
          {overview.length === 0 ? <p className="py-6 text-center text-sm text-slate-400">No salary records yet</p> : (
            <ul className="divide-y divide-slate-100">
              {overview.map((s) => (
                <li key={`${s.staff_id}-${s.month}`} className="flex items-center justify-between gap-3 py-2.5">
                  <div>
                    <p className="text-sm font-medium text-slate-900">{monthShort(s.month)}</p>
                    <p className="text-xs text-slate-500">{Number(s.total_worked_hours).toFixed(1)}h / {targetHours(s)}h</p>
                  </div>
                  <p className="text-sm font-bold tabular-nums text-emerald-600">{inr(s.net_salary)}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Leave status" icon={FiCalendar} action={<button type="button" onClick={() => setActiveTab("leave")} className="inline-flex items-center gap-1 text-xs font-medium text-navy-700 hover:underline">View all <FiArrowRight className="h-3 w-3" /></button>}>
          {leaveApplications.length === 0 ? <p className="py-6 text-center text-sm text-slate-400">No leave applications</p> : (
            <ul className="divide-y divide-slate-100">
              {leaveApplications.slice(0, 3).map((l) => (
                <li key={l.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900">{titleCase(l.type)}</p>
                    <p className="text-xs text-slate-500">{formatDate(l.from_date)} – {formatDate(l.to_date)}</p>
                  </div>
                  <LeaveChip status={l.status} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );

  const attendanceTab = (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="flex flex-col gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Attendance history</h2>
          <p className="text-sm text-slate-500">{monthLabel(selectedMonth)}</p>
        </div>
        <button type="button" onClick={exportAttendance} className={btnGhost}><FiDownload /> Export CSV</button>
      </div>
      {attendance === undefined ? (
        <div className="space-y-2 p-5">{[0, 1, 2, 3, 4].map((i) => <div key={i} className="h-10 animate-pulse rounded-lg bg-slate-100" />)}</div>
      ) : attendanceRows.length === 0 ? (
        <Empty>No attendance records found for {monthLabel(selectedMonth)}</Empty>
      ) : (
        <>
          <ul className="divide-y divide-slate-100 md:hidden">
            {attendanceRows.map((r) => (
              <li key={r.id || `${r.staff_id}-${r.date}`} className={`p-4 ${ymd(r.date) === today ? "bg-sky-50/40" : ""}`}>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-slate-900">{formatDay(r.date)}</p>
                  <StatusChip status={r.status} />
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
                  {timeCell(r.punch_in, FiLogIn, "text-emerald-500")}
                  {timeCell(r.punch_out, FiLogOut, "text-rose-500")}
                  <span className="text-sm font-medium tabular-nums text-slate-700">{Number(r.hours) > 0 ? `${Number(r.hours).toFixed(2)}h` : ""}</span>
                </div>
                {r.breaks && <p className="mt-1 text-xs text-slate-500">Breaks: {r.breaks}</p>}
                {r.punch_in && !r.punch_out && <div className="mt-3">{renderRowActions(r)}</div>}
              </li>
            ))}
          </ul>
          <div className="hidden overflow-x-auto md:block">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Date</th><th className="px-4 py-3">Punch in</th><th className="px-4 py-3">Punch out</th>
                  <th className="px-4 py-3">Breaks</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Hours</th><th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {attendanceRows.map((r) => (
                  <tr key={r.id || `${r.staff_id}-${r.date}`} className={ymd(r.date) === today ? "bg-sky-50/40" : "hover:bg-slate-50"}>
                    <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-900">{formatDay(r.date)}</td>
                    <td className="px-4 py-3">{timeCell(r.punch_in, FiLogIn, "text-emerald-500")}</td>
                    <td className="px-4 py-3">{timeCell(r.punch_out, FiLogOut, "text-rose-500")}</td>
                    <td className="px-4 py-3 text-slate-600">{r.breaks || "—"}</td>
                    <td className="px-4 py-3"><StatusChip status={r.status} /></td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums text-slate-800">{Number(r.hours) > 0 ? `${Number(r.hours).toFixed(2)}h` : "—"}</td>
                    <td className="px-4 py-3">{renderRowActions(r)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );

  const leaveTab = (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="flex flex-col gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-bold text-slate-900">Leave applications</h2>
        <div className="flex flex-wrap items-center gap-2">
          <MonthSelect value={selectedLeaveMonth} onChange={setSelectedLeaveMonth} options={monthOptions} label="Leave month" />
          <button type="button" onClick={openLeave} className={btnPrimary}><FiPlus /> Apply leave</button>
        </div>
      </div>
      {leavesLoading ? (
        <div className="space-y-2 p-5">{[0, 1, 2].map((i) => <div key={i} className="h-10 animate-pulse rounded-lg bg-slate-100" />)}</div>
      ) : leaveApplications.length === 0 ? (
        <Empty>No leave applications found for {monthLabel(selectedLeaveMonth)}</Empty>
      ) : (
        <>
          <ul className="divide-y divide-slate-100 md:hidden">
            {leaveApplications.map((a) => (
              <li key={a.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>{leaveTypeLabel(a)}</div>
                  <LeaveChip status={a.status} />
                </div>
                <p className="mt-2 text-sm text-slate-600">{formatDate(a.from_date)} – {formatDate(a.to_date)}</p>
                <p className="mt-1 text-sm text-slate-700">{a.reason}</p>
                <p className="mt-1 text-xs text-slate-400">Applied {formatDate(a.applied_date)}</p>
              </li>
            ))}
          </ul>
          <div className="hidden overflow-x-auto md:block">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                <tr><th className="px-4 py-3">Type</th><th className="px-4 py-3">From</th><th className="px-4 py-3">To</th><th className="px-4 py-3">Reason</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Applied on</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {leaveApplications.map((a) => (
                  <tr key={a.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">{leaveTypeLabel(a)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-700">{formatDate(a.from_date)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-700">{formatDate(a.to_date)}</td>
                    <td className="max-w-xs px-4 py-3 text-slate-700">{a.reason}</td>
                    <td className="px-4 py-3"><LeaveChip status={a.status} /></td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-500">{formatDate(a.applied_date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );

  const scheduleTab = (
    <div className="rounded-2xl border border-slate-200 bg-white">
      <div className="border-b border-slate-100 p-5">
        <h2 className="text-lg font-bold text-slate-900">My shift schedule</h2>
        <p className="text-sm text-slate-500">Your current and past working hours.</p>
      </div>
      <div className="p-5">
        {staff?.schedules && staff.schedules.length > 0 ? (
          <div className="space-y-4">
            {staff.schedules.map((s, idx) => (
              <div key={idx} className={`rounded-xl border p-4 ${idx === 0 ? "border-navy-500/30 bg-sky-50/50" : "border-slate-200 bg-slate-50"}`}>
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                  <Chip cls={idx === 0 ? "bg-navy-700 text-white ring-navy-700" : "bg-slate-200 text-slate-600 ring-slate-200"}>{idx === 0 ? "Current schedule" : "Past schedule"}</Chip>
                  <span className="text-sm text-slate-600">Effective {formatDate(s.effective_from)}{s.effective_to ? ` to ${formatDate(s.effective_to)}` : " – present"}</span>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {[["Punch in", s.start_time], ["Punch out", s.end_time], ["Standard hours", `${s.standard_hours}h`]].map(([label, value]) => (
                    <div key={label} className="rounded-lg border border-slate-100 bg-white p-3 text-center">
                      <p className="mb-1 text-[11px] uppercase tracking-wide text-slate-500">{label}</p>
                      <p className="text-lg font-bold tabular-nums text-slate-900 sm:text-xl">{value}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <Empty icon={FiClock}>No schedule information assigned yet.</Empty>
        )}
      </div>
    </div>
  );

  const payslipsTab = (
    <div className="space-y-6">
      <SalaryTrendChart salaries={allSalaryData} />
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 p-5">
          <h2 className="text-lg font-bold text-slate-900">My payslips</h2>
          <p className="text-sm text-slate-500">Download your monthly salary statements.</p>
        </div>
        {stats.published.length === 0 ? (
          <Empty>No payslips are available for download yet.</Empty>
        ) : (
          <>
            <ul className="divide-y divide-slate-100 md:hidden">
              {stats.published.map((s) => (
                <li key={s.id ?? s.month} className="flex items-center justify-between gap-3 p-4">
                  <div>
                    <p className="text-sm font-medium text-slate-900">{monthLabel(s.month)}</p>
                    <p className="text-xs text-slate-500">{Number(s.total_worked_hours).toFixed(1)}h / {targetHours(s)}h</p>
                    <p className="mt-1 text-sm font-bold tabular-nums text-emerald-600">{inr(s.net_salary)}</p>
                  </div>
                  <button type="button" onClick={() => handleDownloadPayslip(s)} disabled={downloadingId === (s.id ?? s.month)} className={btnGhost}>
                    {downloadingId === (s.id ?? s.month) ? <FiRefreshCw className="animate-spin" /> : <FiDownload />} PDF
                  </button>
                </li>
              ))}
            </ul>
            <div className="hidden overflow-x-auto md:block">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                  <tr><th className="px-5 py-3">Salary month</th><th className="px-5 py-3">Hours worked</th><th className="px-5 py-3 text-right">Net amount</th><th className="px-5 py-3">Status</th><th className="px-5 py-3 text-right">Action</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {stats.published.map((s) => (
                    <tr key={s.id ?? s.month} className="hover:bg-slate-50">
                      <td className="px-5 py-3 font-medium text-slate-900">{monthLabel(s.month)}</td>
                      <td className="px-5 py-3 text-slate-600">{Number(s.total_worked_hours).toFixed(1)}h / {targetHours(s)}h</td>
                      <td className="px-5 py-3 text-right font-bold tabular-nums text-emerald-600">{inr(s.net_salary)}</td>
                      <td className="px-5 py-3"><Chip cls="bg-emerald-50 text-emerald-700 ring-emerald-200" dot="bg-emerald-500">Paid</Chip></td>
                      <td className="px-5 py-3 text-right">
                        <button type="button" onClick={() => handleDownloadPayslip(s)} disabled={downloadingId === (s.id ?? s.month)} className={btnGhost}>
                          {downloadingId === (s.id ?? s.month) ? <><FiRefreshCw className="animate-spin" /> Preparing…</> : <><FiDownload /> Download PDF</>}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );

  if (initialLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-indigo-50 p-4 sm:p-6">
        <div className="w-full animate-pulse space-y-4">
          <div className="h-10 w-80 rounded-lg bg-white" />
          <div className="h-24 rounded-2xl bg-white" />
          <div className="h-12 rounded-xl bg-white" />
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <div key={i} className="h-24 rounded-xl bg-white" />)}</div>
          <div className="h-72 rounded-2xl bg-white" />
        </div>
      </div>
    );
  }

  const punchedIn = punch.status === "in";

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-indigo-50 p-4 sm:p-6">
        <div className="w-full">
          {/* Header */}
          <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 md:text-3xl">Attendance & Salary</h1>
              <p className="mt-1 text-sm text-slate-500">Your attendance, leave applications and payslips</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {MONTH_TABS.includes(activeTab) && <MonthSelect value={selectedMonth} onChange={setSelectedMonth} options={monthOptions} />}
              <button type="button" onClick={refreshAll} className={btnGhost}><FiRefreshCw /> Refresh</button>
            </div>
          </div>

          {loadError && (
            <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              <span className="flex items-center gap-2"><FiAlertCircle className="h-4 w-4" /> Could not load attendance.</span>
              <button type="button" onClick={refreshAll} className="font-medium underline">Retry</button>
            </div>
          )}

          {/* Today / punch card */}
          <div className="mb-6 flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${punchedIn ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-500"}`}>
                {punchedIn ? <FiLogIn className="h-6 w-6" /> : <FiLogOut className="h-6 w-6" />}
              </span>
              <div>
                <p className="text-xs text-slate-500">Today · {formatDate(today)}</p>
                <p className="text-lg font-bold text-slate-900">{punchedIn ? "Punched in" : "Punched out"}</p>
                <p className="text-sm text-slate-500">
                  {punch.at ? `${punchedIn ? "Since" : "Out at"} ${punch.at} · ${sinceText(punch.since, nowMs)} ${punchedIn ? "elapsed" : "ago"}` : "No punch recorded today"}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => openPunch("in")} disabled={punchedIn} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40">
                <FiLogIn /> Punch in
              </button>
              <button type="button" onClick={() => openPunch("out")} disabled={!punchedIn} className="inline-flex items-center justify-center gap-2 rounded-xl bg-rose-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-40">
                <FiLogOut /> Punch out
              </button>
              <button type="button" onClick={openLeave} className={btnPrimary}><FiCalendar /> Apply leave</button>
            </div>
          </div>

          {/* Tabs */}
          <div className="mb-6 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-1.5" role="tablist" aria-label="Sections">
            <div className="flex gap-1">
              {TABS.map((t) => (
                <button
                  key={t.id} type="button" role="tab" aria-selected={activeTab === t.id} onClick={() => setActiveTab(t.id)}
                  className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition ${activeTab === t.id ? "bg-navy-700 text-white" : "text-slate-600 hover:bg-slate-100"}`}
                >
                  <t.icon className="h-4 w-4" /> {t.label}
                </button>
              ))}
            </div>
          </div>

          {activeTab === "dashboard" && dashboard}
          {activeTab === "attendance" && attendanceTab}
          {activeTab === "leave" && leaveTab}
          {activeTab === "calendar" && (
            <CalendarView
              calendarData={calendarEvents}
              leavesData={leaveApplications}
              userRole="staff"
              onAddEvent={() => toast.info("Only admins can add calendar events.")}
              onEditEvent={() => {}}
              onDeleteEvent={() => {}}
              onUpdateEvent={() => {}}
            />
          )}
          {activeTab === "schedule" && scheduleTab}
          {activeTab === "planner" && <SalaryPlanner month={selectedMonth} />}
          {activeTab === "payslips" && payslipsTab}
        </div>

        <AnimatePresence>
          {showPunchModal && (
            <Modal key="punch" onClose={() => !submitting && setShowPunchModal(false)}>
              <form onSubmit={handlePunchSubmit} noValidate className="p-5 sm:p-6">
                <ModalHeader title="Record punch" subtitle={formatDate(today)} onClose={() => setShowPunchModal(false)} />
                <div className="space-y-4">
                  <Field label="Punch type" htmlFor="pu-type">
                    <SelectWrap>
                      <select id="pu-type" value={punchForm.punch_type} onChange={(e) => setPunchForm((p) => ({ ...p, punch_type: e.target.value }))} className={`${inputCls} appearance-none pr-9`}>
                        <option value="in">Punch in</option>
                        <option value="out">Punch out</option>
                      </select>
                    </SelectWrap>
                  </Field>
                  {punchForm.punch_type === "in" ? (
                    <Field label="Time" htmlFor="pu-time" hint="Must be within 30 minutes of the current time.">
                      <input id="pu-time" type="time" value={punchForm.time} onChange={(e) => setPunchForm((p) => ({ ...p, time: e.target.value }))} className={inputCls} />
                    </Field>
                  ) : (
                    <>
                      <Field label="Time" hint="Punch-out always uses the current time.">
                        <p className="rounded-lg bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-800">{nowHM()}</p>
                      </Field>
                      <Field label="Breaks (optional)" htmlFor="pu-breaks" hint="For example 13:00-14:00">
                        <input id="pu-breaks" type="text" value={punchForm.breaks} onChange={(e) => setPunchForm((p) => ({ ...p, breaks: e.target.value }))} placeholder="13:00-14:00" className={inputCls} />
                      </Field>
                    </>
                  )}
                </div>
                {formError && <p className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{formError}</p>}
                <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <button type="button" onClick={() => setShowPunchModal(false)} disabled={submitting} className={btnGhost}>Cancel</button>
                  <button type="submit" disabled={submitting || (punchForm.punch_type === "in" && !punchForm.time)} className={btnPrimary}>
                    {submitting ? <><FiRefreshCw className="animate-spin" /> Saving…</> : "Record punch"}
                  </button>
                </div>
              </form>
            </Modal>
          )}

          {showBreakModal && (
            <Modal key="break" onClose={() => !submitting && setShowBreakModal(false)}>
              <form onSubmit={handleBreakSubmit} noValidate className="p-5 sm:p-6">
                <ModalHeader title="Record break" onClose={() => setShowBreakModal(false)} />
                <Field label="Break time" htmlFor="br-time" hint="Format HH:MM-HH:MM, for example 13:00-14:00">
                  <input id="br-time" type="text" autoFocus value={breakForm.break_time} onChange={(e) => setBreakForm((p) => ({ ...p, break_time: e.target.value }))} placeholder="13:00-14:00" className={inputCls} />
                </Field>
                {formError && <p className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{formError}</p>}
                <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <button type="button" onClick={() => setShowBreakModal(false)} disabled={submitting} className={btnGhost}>Cancel</button>
                  <button type="submit" disabled={submitting || !breakForm.break_time} className={btnPrimary}>
                    {submitting ? <><FiRefreshCw className="animate-spin" /> Saving…</> : "Record break"}
                  </button>
                </div>
              </form>
            </Modal>
          )}

          {showLeaveModal && (
            <Modal key="leave" onClose={() => !submitting && setShowLeaveModal(false)}>
              <form onSubmit={handleLeaveSubmit} noValidate className="p-5 sm:p-6">
                <ModalHeader title="Apply for leave" onClose={() => setShowLeaveModal(false)} />
                <div className="space-y-4">
                  <Field label="Leave type" htmlFor="lv-type">
                    <SelectWrap>
                      <select id="lv-type" value={newLeave.type} onChange={(e) => setNewLeave((p) => ({ ...p, type: e.target.value }))} className={`${inputCls} appearance-none pr-9`}>
                        <option value="casual_leave">Casual leave</option>
                        <option value="sick_leave">Sick leave</option>
                        <option value="earned_leave">Earned leave</option>
                        <option value="maternity_leave">Maternity leave</option>
                        <option value="paternity_leave">Paternity leave</option>
                        <option value="emergency_leave">Emergency leave</option>
                      </select>
                    </SelectWrap>
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Duration" htmlFor="lv-dur">
                      <SelectWrap>
                        <select id="lv-dur" value={newLeave.leave_duration} onChange={(e) => setNewLeave((p) => ({ ...p, leave_duration: e.target.value, leave_time: e.target.value === "full" ? "" : p.leave_time }))} className={`${inputCls} appearance-none pr-9`}>
                          <option value="full">Full day</option>
                          <option value="half">Half day</option>
                        </select>
                      </SelectWrap>
                    </Field>
                    {newLeave.leave_duration === "half" && (
                      <Field label="Time segment" htmlFor="lv-seg">
                        <SelectWrap>
                          <select id="lv-seg" value={newLeave.leave_time} onChange={(e) => setNewLeave((p) => ({ ...p, leave_time: e.target.value }))} className={`${inputCls} appearance-none pr-9`}>
                            <option value="">Select…</option>
                            <option value="Morning">Morning</option>
                            <option value="Afternoon">Afternoon</option>
                          </select>
                        </SelectWrap>
                      </Field>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="From date" htmlFor="lv-from">
                      <input id="lv-from" type="date" value={newLeave.from_date} onChange={(e) => setNewLeave((p) => ({ ...p, from_date: e.target.value }))} className={inputCls} />
                    </Field>
                    <Field label="To date" htmlFor="lv-to">
                      <input id="lv-to" type="date" min={newLeave.from_date || undefined} value={newLeave.to_date} onChange={(e) => setNewLeave((p) => ({ ...p, to_date: e.target.value }))} className={inputCls} />
                    </Field>
                  </div>
                  <Field label="Reason" htmlFor="lv-reason">
                    <textarea id="lv-reason" rows={4} value={newLeave.reason} onChange={(e) => setNewLeave((p) => ({ ...p, reason: e.target.value }))} placeholder="Please give a reason for your leave…" className={inputCls} />
                  </Field>
                </div>
                {formError && <p className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{formError}</p>}
                <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <button type="button" onClick={() => setShowLeaveModal(false)} disabled={submitting} className={btnGhost}>Cancel</button>
                  <button type="submit" disabled={submitting} className={btnPrimary}>
                    {submitting ? <><FiRefreshCw className="animate-spin" /> Submitting…</> : "Submit application"}
                  </button>
                </div>
              </form>
            </Modal>
          )}
        </AnimatePresence>
      </div>
    </ErrorBoundary>
  );
};

export default StaffAttendance;