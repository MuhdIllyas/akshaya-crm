// src/pages/AdminAttendance.jsx
import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import axios from "axios";
import {
  FiClock, FiCalendar, FiDollarSign, FiLogOut, FiLogIn, FiTrendingUp, FiCheckCircle, FiAlertCircle,
  FiRefreshCw, FiDownload, FiPlus, FiEdit2, FiTrash2, FiHome, FiFileText, FiSettings, FiChevronDown,
  FiChevronUp, FiSearch, FiX, FiUsers, FiUserCheck, FiUserX, FiCheck, FiLock, FiPieChart, FiCoffee,
} from "react-icons/fi";
import { motion, AnimatePresence } from "framer-motion";
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement,
  Title, Tooltip, Legend, Filler,
} from "chart.js";
import { Doughnut } from "react-chartjs-2";
import { toast } from "react-toastify";
import {
  getStaffList, getAllAttendance, updateAttendance, getPendingLeaves, updateLeave, getCalendarData,
  addCalendarEvent, updateCalendarEvent, deleteCalendarEvent, getStaffSchedules, getLeaves,
} from "/src/services/salaryService";
import { getWalletsForCentre } from "@/services/walletService";
import CalendarView from "@/components/CalendarView";

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Title, Tooltip, Legend, Filler);
ChartJS.defaults.color = "#64748b";

/* ---------------------------------------------------------------------
   Date + time helpers (everything is India time, whatever the browser's zone is)
   --------------------------------------------------------------------- */
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
const utcFromYmd = (s) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d || 1));
};
const formatDate = (v) => {
  const s = ymd(v);
  return s ? utcFromYmd(s).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }) : "—";
};
const formatDayFull = (v) => {
  const s = ymd(v);
  return s ? utcFromYmd(s).toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }) : "—";
};
const monthLabel = (m) =>
  m ? utcFromYmd(`${m}-01`).toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" }) : "";
const addMonths = (m, n) => {
  const [y, mo] = m.split("-").map(Number);
  const d = new Date(Date.UTC(y, mo - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
};
// 12 months back, this month, 3 months ahead (same range as before)
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
const num0 = (n) => Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 });
const titleCase = (s) => (s ? String(s).split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ") : "Unknown");
const hm = (t) => (t ? String(t).slice(0, 5) : "—");
const isLeaveStatus = (s) => typeof s === "string" && s.includes("leave");
const initials = (name) => (name ? name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) : "?");
const csvCell = (v) => {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const downloadCsv = (filename, rows) => {
  const blob = new Blob([`﻿${rows.map((r) => r.map(csvCell).join(",")).join("\r\n")}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

// --- TIME CONVERTERS (HH:MM <-> Decimal) ---
const formatDecimalToHHMM = (decimalHours) => {
  if (!decimalHours || Number.isNaN(Number(decimalHours))) return "0:00";
  const n = Math.abs(Number(decimalHours));
  const h = Math.floor(n);
  const m = Math.round((n - h) * 60);
  return `${decimalHours < 0 ? "-" : ""}${h}:${m.toString().padStart(2, "0")}`;
};
const parseHHMMToDecimal = (timeStr) => {
  if (!timeStr) return 0;
  const str = String(timeStr).trim();
  if (str.includes(":")) {
    const [h, m] = str.split(":").map(Number);
    return Number(((h || 0) + (m || 0) / 60).toFixed(2));
  }
  return Number(str); // lets someone still type "180.5"
};
const timeToMinutes = (t) => {
  if (!t) return 0;
  const [h, m] = String(t).split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};
const minutesToTime = (total) => {
  if (total <= 0) return "00:00";
  const h = Math.floor(total / 60);
  const m = Math.round(total % 60);
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
};
const calculateHours = (inT, outT) => {
  if (!inT || !outT) return 0;
  const [ih, im] = inT.split(":").map(Number);
  const [oh, om] = outT.split(":").map(Number);
  let h = oh - ih;
  let m = om - im;
  if (m < 0) { h -= 1; m += 60; }
  return Number(h + m / 60).toFixed(2);
};

/* ---------------------------------------------------------------------
   Schedule + grouping logic (unchanged maths)
   --------------------------------------------------------------------- */
const findEffectiveSchedule = (staff, attendanceDate) => {
  if (!staff?.schedules?.length || !attendanceDate) return null;
  const nd = ymd(attendanceDate);
  const sorted = [...staff.schedules].sort((a, b) => new Date(b.effective_from) - new Date(a.effective_from));
  return sorted.find((s) => ymd(s.effective_from) <= nd) || null;
};

const calculateDayDeviation = (firstIn, lastOut, schedule) => {
  if (!firstIn || !lastOut || !schedule?.start_time || !schedule?.end_time) return { lateMinutes: 0, extraMinutes: 0 };
  const lateM = Math.max(0, timeToMinutes(firstIn) - timeToMinutes(schedule.start_time));
  const extraM = Math.max(0, timeToMinutes(lastOut) - timeToMinutes(schedule.end_time));
  return { lateMinutes: lateM, extraMinutes: extraM };
};

// one row per staff per day
const groupAttendance = (attendance, staffList) => {
  const map = new Map();
  attendance.forEach((rec) => {
    const key = `${rec.staff_id}-${ymd(rec.date)}`;
    if (!map.has(key)) {
      const staff = staffList.find((s) => s.id === rec.staff_id);
      map.set(key, {
        staff_id: rec.staff_id, staff_name: rec.staff_name, date: rec.date,
        punch_in: null, punch_out: null, status: rec.status,
        schedule: findEffectiveSchedule(staff, rec.date), raw: [], hours: 0,
      });
    }
    const entry = map.get(key);
    entry.raw.push(rec);
    entry.hours += Number(rec.hours) || 0;
    if (rec.punch_in && (!entry.punch_in || rec.punch_in < entry.punch_in)) entry.punch_in = rec.punch_in;
    if (rec.punch_out && (!entry.punch_out || rec.punch_out > entry.punch_out)) entry.punch_out = rec.punch_out;
  });

  return Array.from(map.values()).map((g) => {
    g.raw.sort((a, b) => timeToMinutes(a.punch_in) - timeToMinutes(b.punch_in) || Number(a.id || 0) - Number(b.id || 0));
    const { lateMinutes, extraMinutes } = calculateDayDeviation(g.punch_in, g.punch_out, g.schedule);
    return {
      ...g,
      hours: Number(g.hours.toFixed(2)),
      lateMinutes, extraMinutes,
      lateHours: Number((lateMinutes / 60).toFixed(2)),
      extraHours: Number((extraMinutes / 60).toFixed(2)),
      lateTime: minutesToTime(lateMinutes),
      extraTime: minutesToTime(extraMinutes),
      sessionCount: g.raw.length,
      breaks: g.raw.map((r) => r.breaks).filter(Boolean).join(", ") || null,
    };
  });
};

const groupAttendanceByDate = (attendance, staffList) => {
  const dateMap = new Map();
  groupAttendance(attendance, staffList).forEach((record) => {
    const d = ymd(record.date);
    if (!dateMap.has(d)) dateMap.set(d, { date: d, presentCount: 0, absentCount: 0, leaveCount: 0, totalLateHours: 0, totalExtraHours: 0, records: [] });
    const group = dateMap.get(d);
    if (record.status === "present") group.presentCount += 1;
    else if (record.status === "absent") group.absentCount += 1;
    else if (isLeaveStatus(record.status)) group.leaveCount += 1;
    group.totalLateHours += Number(record.lateHours) || 0;
    group.totalExtraHours += Number(record.extraHours) || 0;
    group.records.push(record);
  });
  dateMap.forEach((g) => g.records.sort((a, b) => (a.staff_name || "").localeCompare(b.staff_name || "")));
  return Array.from(dateMap.values()).sort((a, b) => b.date.localeCompare(a.date));
};

// Month figures from present records. Several punch sessions on one day count as ONE working day.
const computeMonthStats = (records, staffList) => {
  const present = records.filter((a) => a.status === "present");
  const empty = { totalWorkingHours: 0, avgWorkingHours: 0, totalPresentDays: 0, totalLateHours: 0, totalExtraHours: 0, lateDays: 0, schedDays: 0 };
  if (!present.length) return empty;
  const dailyMap = new Map();
  present.forEach((r) => {
    const key = `${r.staff_id}-${ymd(r.date)}`;
    if (!dailyMap.has(key)) dailyMap.set(key, []);
    dailyMap.get(key).push(r);
  });
  let totalH = 0, lateM = 0, extraM = 0, lateDays = 0, schedDays = 0;
  dailyMap.forEach((day) => {
    totalH += day.reduce((s, r) => s + (Number(r.hours) || 0), 0);
    const firstIn = day.filter((r) => r.punch_in).sort((a, b) => timeToMinutes(a.punch_in) - timeToMinutes(b.punch_in))[0]?.punch_in;
    const lastOut = day.filter((r) => r.punch_out).sort((a, b) => timeToMinutes(b.punch_out) - timeToMinutes(a.punch_out))[0]?.punch_out;
    const staff = staffList.find((s) => s.id === day[0].staff_id);
    const schedule = findEffectiveSchedule(staff, day[0].date);
    if (schedule) {
      schedDays += 1;
      const dev = calculateDayDeviation(firstIn, lastOut, schedule);
      lateM += dev.lateMinutes;
      extraM += dev.extraMinutes;
      if (dev.lateMinutes > 0) lateDays += 1;
    }
  });
  const days = dailyMap.size;
  return {
    totalWorkingHours: Number(totalH.toFixed(2)),
    avgWorkingHours: Number((days ? totalH / days : 0).toFixed(2)),
    totalPresentDays: days,
    totalLateHours: Number((lateM / 60).toFixed(2)),
    totalExtraHours: Number((extraM / 60).toFixed(2)),
    lateDays, schedDays,
  };
};

/* ---------------------------------------------------------------------
   Look + feel
   --------------------------------------------------------------------- */
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
  pending: "bg-amber-50 text-amber-700 ring-amber-200",
};
const RUN_STATUS = {
  finalized: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  generated: "bg-sky-50 text-sky-700 ring-sky-200",
  draft: "bg-slate-100 text-slate-600 ring-slate-200",
};
const TONES = {
  navy: "bg-slate-100 text-navy-700",
  emerald: "bg-emerald-50 text-emerald-600",
  amber: "bg-amber-50 text-amber-600",
  indigo: "bg-indigo-50 text-indigo-600",
};

const TABS = [
  { id: "dashboard", label: "Dashboard", icon: FiHome },
  { id: "attendance", label: "Attendance", icon: FiClock },
  { id: "leave", label: "Leave", icon: FiCoffee },
  { id: "salary", label: "Payroll", icon: FiDollarSign },
  { id: "calendar", label: "Working days", icon: FiCalendar },
];
const TAB_IDS = TABS.map((t) => t.id);

const inputCls =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 transition focus:border-transparent focus:outline-none focus:ring-2 focus:ring-navy-500/40 disabled:bg-slate-50 disabled:text-slate-400";
const btnPrimary =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-navy-700 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-navy-800 disabled:cursor-not-allowed disabled:opacity-50";
const btnGhost =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-navy-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50";
const btnDanger =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50";

class ErrorBoundary extends React.Component {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error, info) { console.error("Error in AdminAttendance:", error, info); }
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

const Stat = ({ label, value, sub, icon: Icon, tone = "navy" }) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-5">
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm text-slate-500">{label}</p>
        <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
        {sub && <p className="mt-0.5 text-xs text-slate-400">{sub}</p>}
      </div>
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${TONES[tone]}`}><Icon className="h-5 w-5" /></span>
    </div>
  </div>
);

const Empty = ({ icon: Icon = FiFileText, children }) => (
  <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
    <Icon className="mb-3 h-10 w-10 text-slate-300" />
    <p className="text-sm text-slate-500">{children}</p>
  </div>
);

const Skeleton = ({ rows = 4 }) => (
  <div className="space-y-2 p-5">{Array.from({ length: rows }).map((_, i) => <div key={i} className="h-12 animate-pulse rounded-lg bg-slate-100" />)}</div>
);

const modalStack = [];
const Modal = ({ onClose, children, width = "max-w-md" }) => {
  useEffect(() => {
    const token = {};
    modalStack.push(token);
    // Escape only closes the top-most dialog
    const onKey = (e) => { if (e.key === "Escape" && modalStack[modalStack.length - 1] === token) onClose(); };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      modalStack.splice(modalStack.indexOf(token), 1);
    };
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
        className={`max-h-[90vh] w-full ${width} overflow-y-auto rounded-2xl bg-white p-6 shadow-xl`}
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

const SearchBox = ({ value, onChange, placeholder }) => (
  <div className="relative">
    <FiSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
    <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder} className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-navy-500/40 sm:w-60" />
  </div>
);

const Avatar = ({ staff }) => {
  const [broken, setBroken] = useState(false);
  const src = staff.photo
    ? staff.photo.startsWith("http") || staff.photo.startsWith("data:")
      ? staff.photo
      : `${import.meta.env.VITE_API_URL || ""}${staff.photo.startsWith("/") ? "" : "/"}${staff.photo}`
    : null;
  if (src && !broken) {
    return <img src={src} alt={staff.name} onError={() => setBroken(true)} className="h-10 w-10 shrink-0 rounded-full border border-slate-200 object-cover" />;
  }
  return <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-navy-700 text-sm font-medium text-white">{initials(staff.name)}</span>;
};

const ConfirmModal = ({ title, message, confirmLabel = "Confirm", danger, busy, onConfirm, onClose }) => (
  <Modal onClose={onClose} width="max-w-sm">
    <ModalHeader title={title} onClose={onClose} />
    <p className="-mt-2 mb-6 text-sm text-slate-600">{message}</p>
    <div className="flex gap-3">
      <button type="button" onClick={onClose} className={`${btnGhost} flex-1`}>Cancel</button>
      <button type="button" onClick={onConfirm} disabled={busy} className={`${danger ? btnDanger : btnPrimary} flex-1`}>{busy ? "Working…" : confirmLabel}</button>
    </div>
  </Modal>
);

/* ---------------------------------------------------------------------
   Dashboard pieces
   --------------------------------------------------------------------- */
const NAVY_SCALE = ["#1e3a5f", "#3b6ea5", "#64a0d6", "#94b8d9", "#c3d4e6", "#0f1f3a"];

const DepartmentChart = ({ staff }) => {
  const dept = staff.reduce((a, s) => { const k = s.department || "Unassigned"; a[k] = (a[k] || 0) + 1; return a; }, {});
  const labels = Object.keys(dept);
  const data = {
    labels,
    datasets: [{ data: Object.values(dept), backgroundColor: labels.map((_, i) => NAVY_SCALE[i % NAVY_SCALE.length]), borderWidth: 0 }],
  };
  const options = { maintainAspectRatio: false, cutout: "62%", plugins: { legend: { position: "bottom", labels: { usePointStyle: true, boxWidth: 8 } } } };
  return (
    <Card title="Staff by department" icon={FiPieChart}>
      <div className="relative h-60">{labels.length ? <Doughnut data={data} options={options} /> : <Empty>No staff yet</Empty>}</div>
    </Card>
  );
};

const TodayChart = ({ today }) => {
  const total = today.present + today.leave + today.absent;
  const data = {
    labels: ["Present", "On leave", "Absent"],
    datasets: [{ data: [today.present, today.leave, today.absent], backgroundColor: ["#10b981", "#f59e0b", "#f43f5e"], borderWidth: 0 }],
  };
  const options = { maintainAspectRatio: false, cutout: "62%", plugins: { legend: { position: "bottom", labels: { usePointStyle: true, boxWidth: 8 } } } };
  return (
    <Card title="Today's attendance" icon={FiCheckCircle}>
      <div className="relative h-60">{total ? <Doughnut data={data} options={options} /> : <Empty>No attendance marked today</Empty>}</div>
    </Card>
  );
};

const StaffMonthCard = ({ staff, records, staffList }) => {
  const s = useMemo(() => computeMonthStats(records.filter((r) => r.staff_id === staff.id), staffList), [records, staff.id, staffList]);
  const cur = staff.schedules?.length ? [...staff.schedules].sort((a, b) => new Date(b.effective_from) - new Date(a.effective_from))[0] : null;
  const cell = (label, value, cls) => (
    <div className={`rounded-lg p-2 text-center ${cls}`}><p className="text-xs text-slate-500">{label}</p><p className="font-semibold">{value}</p></div>
  );
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="mb-3 flex items-center gap-3">
        <Avatar staff={staff} />
        <div className="min-w-0">
          <p className="truncate font-medium text-slate-900">{staff.name}</p>
          <p className="truncate text-xs text-slate-500">{staff.position || "—"}{cur ? ` · ${hm(cur.start_time)}–${hm(cur.end_time)}` : ""}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 text-sm">
        {cell("Total hours", `${s.totalWorkingHours}h`, "bg-slate-50 text-navy-700")}
        {cell("Avg / day", `${s.avgWorkingHours}h`, "bg-emerald-50 text-emerald-700")}
        {cell("Late", `${s.totalLateHours}h`, "bg-amber-50 text-amber-700")}
        {cell("Extra", `${s.totalExtraHours}h`, "bg-indigo-50 text-indigo-700")}
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500">
        <span>{s.totalPresentDays} {s.totalPresentDays === 1 ? "day" : "days"} · {s.schedDays} with schedule</span>
        {s.lateDays > 0 && <Chip cls="bg-amber-50 text-amber-700 ring-amber-200">{s.lateDays} late</Chip>}
      </div>
    </div>
  );
};

/* ---------------------------------------------------------------------
   Attendance list
   --------------------------------------------------------------------- */
const REC_GRID = "md:grid-cols-[minmax(0,1.5fr)_110px_minmax(0,1fr)_minmax(0,1fr)_70px_minmax(0,1fr)_44px]";

const RecordRow = ({ rec, onEdit }) => {
  const multi = rec.sessionCount > 1;
  return (
    <div className="px-4 py-3">
      <div className={`grid grid-cols-2 items-center gap-x-3 gap-y-2 ${REC_GRID}`}>
        <div className="col-span-2 min-w-0 md:col-span-1">
          <p className="truncate text-sm font-semibold text-slate-900">{rec.staff_name}</p>
          {rec.schedule && <p className="text-xs text-slate-400">Shift {hm(rec.schedule.start_time)}–{hm(rec.schedule.end_time)}</p>}
        </div>
        <div><StatusChip status={rec.status} /></div>
        <div className="text-sm text-slate-700">
          <span className="mr-1 text-xs text-slate-400 md:hidden">In</span>
          <FiLogIn className="mr-1 hidden h-3.5 w-3.5 text-emerald-500 md:inline" />{hm(rec.punch_in)}
          {rec.lateMinutes > 0 && <span className="ml-1.5 rounded bg-amber-50 px-1.5 py-0.5 text-xs text-amber-700" title={`Late by ${rec.lateTime}`}>+{rec.lateTime}</span>}
        </div>
        <div className="text-sm text-slate-700">
          <span className="mr-1 text-xs text-slate-400 md:hidden">Out</span>
          <FiLogOut className="mr-1 hidden h-3.5 w-3.5 text-rose-500 md:inline" />{hm(rec.punch_out)}
          {rec.extraMinutes > 0 && <span className="ml-1.5 rounded bg-indigo-50 px-1.5 py-0.5 text-xs text-indigo-700" title={`Extra ${rec.extraTime}`}>+{rec.extraTime}</span>}
        </div>
        <div className="text-sm font-semibold text-slate-900"><span className="mr-1 text-xs font-normal text-slate-400 md:hidden">Hours</span>{rec.hours > 0 ? `${rec.hours.toFixed(2)}h` : "—"}</div>
        <div className="flex flex-wrap gap-1 text-xs">
          {rec.lateHours > 0 && <span className="rounded bg-amber-50 px-1.5 py-0.5 font-medium text-amber-700">Late {rec.lateHours}h</span>}
          {rec.extraHours > 0 && <span className="rounded bg-indigo-50 px-1.5 py-0.5 font-medium text-indigo-700">Extra {rec.extraHours}h</span>}
          {!rec.lateHours && !rec.extraHours && <span className="text-slate-300">—</span>}
        </div>
        <div className="col-start-2 row-start-1 justify-self-end md:col-start-auto md:row-start-auto md:justify-self-center">
          {!multi && (
            <button type="button" onClick={() => onEdit(rec.raw[0])} className="rounded-lg p-2 text-navy-700 hover:bg-slate-100" title="Edit attendance" aria-label={`Edit ${rec.staff_name}`}><FiEdit2 className="h-4 w-4" /></button>
          )}
        </div>
      </div>
      {multi && (
        <div className="mt-2 space-y-1 rounded-xl bg-slate-50 p-2">
          {rec.raw.map((r, i) => (
            <div key={r.id || i} className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-xs text-slate-600">
              <span>Session {i + 1} · {hm(r.punch_in)} → {hm(r.punch_out)}{r.breaks ? ` · break ${r.breaks}` : ""}</span>
              <span className="flex items-center gap-1">
                <span className="font-medium text-slate-800">{Number(r.hours) > 0 ? `${Number(r.hours).toFixed(2)}h` : "—"}</span>
                <button type="button" onClick={() => onEdit(r)} className="rounded-lg p-1.5 text-navy-700 hover:bg-white" title="Edit this session" aria-label={`Edit session ${i + 1} of ${rec.staff_name}`}><FiEdit2 className="h-3.5 w-3.5" /></button>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const DayGroup = ({ group, today, onEdit }) => {
  const [open, setOpen] = useState(group.date === today);
  return (
    <div className="border-b border-slate-100 last:border-b-0">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3.5 text-left hover:bg-slate-50 sm:px-5">
        <span className="min-w-[10rem] text-sm font-semibold text-slate-900">
          {formatDayFull(group.date)} {group.date === today && <Chip cls="ml-1 bg-slate-100 text-navy-700 ring-slate-200">Today</Chip>}
        </span>
        <span className="flex flex-1 flex-wrap items-center gap-2">
          {(group.presentCount > 0 || (!group.absentCount && !group.leaveCount)) && <Chip cls={STATUS.present.chip} dot={STATUS.present.dot}>{group.presentCount} present</Chip>}
          {group.absentCount > 0 && <Chip cls={STATUS.absent.chip} dot={STATUS.absent.dot}>{group.absentCount} absent</Chip>}
          {group.leaveCount > 0 && <Chip cls="bg-amber-50 text-amber-700 ring-amber-200" dot="bg-amber-500">{group.leaveCount} leave</Chip>}
        </span>
        <span className="flex items-center gap-4 text-xs text-slate-500">
          <span>Late <b className="text-amber-600">{group.totalLateHours > 0 ? `${group.totalLateHours.toFixed(2)}h` : "—"}</b></span>
          <span>Extra <b className="text-indigo-600">{group.totalExtraHours > 0 ? `${group.totalExtraHours.toFixed(2)}h` : "—"}</b></span>
          {open ? <FiChevronUp className="h-4 w-4" /> : <FiChevronDown className="h-4 w-4" />}
        </span>
      </button>
      {open && (
        <div className="border-t border-slate-100 bg-slate-50/60">
          <div className={`hidden gap-x-3 px-4 pt-3 text-xs font-medium uppercase tracking-wide text-slate-400 md:grid ${REC_GRID}`}>
            <span>Staff</span><span>Status</span><span>Punch in</span><span>Punch out</span><span>Hours</span><span>Deviation</span><span />
          </div>
          <div className="divide-y divide-slate-100">
            {group.records.map((rec) => <RecordRow key={rec.staff_id} rec={rec} onEdit={onEdit} />)}
          </div>
        </div>
      )}
    </div>
  );
};

/* ---------------------------------------------------------------------
   Leave
   --------------------------------------------------------------------- */
const LeaveType = ({ l }) => (
  <>
    <p className="text-sm font-medium text-slate-900">{titleCase(l.type)}</p>
    <span className={`mt-1 inline-flex rounded px-2 py-0.5 text-[11px] font-medium ${l.leave_duration === "half" ? "bg-indigo-50 text-indigo-700" : "bg-slate-100 text-slate-600"}`}>
      {l.leave_duration === "half" ? `Half day${l.leave_time ? ` (${l.leave_time})` : ""}` : "Full day"}
    </span>
  </>
);
const LeaveActions = ({ l, busyId, onAction }) =>
  l.status === "pending" ? (
    <div className="flex gap-2">
      <button type="button" disabled={busyId === l.id} onClick={() => onAction(l.id, "approved")} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50" aria-label={`Approve ${l.staff_name}`}><FiCheck /> Approve</button>
      <button type="button" disabled={busyId === l.id} onClick={() => onAction(l.id, "rejected")} className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-50" aria-label={`Reject ${l.staff_name}`}><FiX /> Reject</button>
    </div>
  ) : <span className="text-sm text-slate-300">—</span>;

/* ---------------------------------------------------------------------
   MAIN
   --------------------------------------------------------------------- */
const NONE = []; // stable empty list so memo dependencies do not change on every render
const centreParam = () => new URLSearchParams(window.location.search).get("centre_id");
const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem("token")}` });
const api = (path) => `${import.meta.env.VITE_API_URL}/api/salary${path}`;

const AdminAttendance = () => {
  const [activeTab, setActiveTab] = useState(() => {
    const t = new URLSearchParams(window.location.search).get("tab");
    return TAB_IDS.includes(t) ? t : "dashboard";
  });
  useEffect(() => {
    const url = new URL(window.location);
    url.searchParams.set("tab", activeTab);
    window.history.replaceState({}, "", url);
  }, [activeTab]);

  const monthOptions = useMemo(() => generateMonthOptions(), []);
  const thisMonth = currentMonthStr();
  const today = todayYmd();

  const [selectedMonth, setSelectedMonth] = useState(thisMonth);
  const [selectedLeaveMonth, setSelectedLeaveMonth] = useState(thisMonth);

  const [staffList, setStaffList] = useState([]);
  const [attByMonth, setAttByMonth] = useState({}); // { 'YYYY-MM': records }
  const [pendingLeaves, setPendingLeaves] = useState([]);
  const [allLeaves, setAllLeaves] = useState([]);
  const [calendarData, setCalendarData] = useState([]);
  const [booting, setBooting] = useState(true);
  const [attLoading, setAttLoading] = useState(false);
  const [leaveLoading, setLeaveLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const allAttendance = attByMonth[selectedMonth] || NONE;
  const currentAttendance = attByMonth[thisMonth] || NONE;

  /* ---- loading ---- */
  const loadMonth = useCallback(async (month) => {
    try {
      const rows = await getAllAttendance(month);
      setAttByMonth((p) => ({ ...p, [month]: Array.isArray(rows) ? rows : [] }));
      return true;
    } catch {
      toast.error(`Could not load attendance for ${monthLabel(month)}`);
      return false;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setBooting(true);
      setLoadError(false);
      const [staffR, pendingR, calR] = await Promise.allSettled([
        getStaffList().then((raw) => Promise.all(raw.map(async (s) => ({ ...s, schedules: await getStaffSchedules(s.id).catch(() => []) })))),
        getPendingLeaves(),
        getCalendarData(),
      ]);
      if (cancelled) return;
      if (staffR.status === "fulfilled") setStaffList(staffR.value); else toast.error("Could not load staff");
      if (pendingR.status === "fulfilled") setPendingLeaves(pendingR.value); else toast.error("Could not load pending leave");
      if (calR.status === "fulfilled") setCalendarData(calR.value); else toast.error("Could not load the calendar");
      if (staffR.status === "rejected") setLoadError(true);
      setBooting(false);
    })();
    return () => { cancelled = true; };
  }, [reloadKey]);

  // the dashboard's "today" figures always need the current month, whichever month is on screen
  const currentMonthLoaded = useRef(false);
  useEffect(() => {
    let cancelled = false;
    setAttLoading(true);
    const jobs = [loadMonth(selectedMonth).then((ok) => { if (selectedMonth === thisMonth) currentMonthLoaded.current = ok; })];
    if (selectedMonth !== thisMonth && !currentMonthLoaded.current) jobs.push(loadMonth(thisMonth).then((ok) => { currentMonthLoaded.current = ok; }));
    Promise.all(jobs).then(() => { if (!cancelled) setAttLoading(false); });
    return () => { cancelled = true; };
  }, [selectedMonth, thisMonth, loadMonth, reloadKey]);

  useEffect(() => {
    let cancelled = false;
    setLeaveLoading(true);
    getLeaves(selectedLeaveMonth)
      .then((l) => { if (!cancelled) setAllLeaves(l); })
      .catch(() => { if (!cancelled) toast.error("Could not load leave history"); })
      .finally(() => { if (!cancelled) setLeaveLoading(false); });
    return () => { cancelled = true; };
  }, [selectedLeaveMonth, reloadKey]);

  const [wallets, setWallets] = useState([]);
  const [selectedWalletId, setSelectedWalletId] = useState("");
  useEffect(() => {
    getWalletsForCentre()
      .then((data) => { setWallets(data); setSelectedWalletId((cur) => cur || data[0]?.id || ""); })
      .catch((err) => console.error(err));
  }, [reloadKey]);

  /* ---- today's numbers (always from the current month, whatever month is on screen) ---- */
  const dash = useMemo(() => {
    const active = staffList.filter((s) => s.status === "Active");
    const todayAtt = currentAttendance.filter((a) => ymd(a.date) === today);
    const ids = (pred) => new Set(todayAtt.filter(pred).map((a) => a.staff_id));
    const present = ids((a) => a.status === "present").size;
    const leave = ids((a) => isLeaveStatus(a.status)).size;
    const absent = ids((a) => a.status === "absent").size;
    let lateH = 0;
    let extraH = 0;
    const byStaff = new Map();
    todayAtt.filter((r) => r.status === "present").forEach((r) => {
      if (!byStaff.has(r.staff_id)) byStaff.set(r.staff_id, []);
      byStaff.get(r.staff_id).push(r);
    });
    byStaff.forEach((records, staffId) => {
      const st = staffList.find((s) => s.id === staffId);
      if (!st) return;
      const firstIn = records.filter((r) => r.punch_in).sort((a, b) => timeToMinutes(a.punch_in) - timeToMinutes(b.punch_in))[0]?.punch_in;
      const lastOut = records.filter((r) => r.punch_out).sort((a, b) => timeToMinutes(b.punch_out) - timeToMinutes(a.punch_out))[0]?.punch_out;
      const schedule = findEffectiveSchedule(st, records[0].date);
      if (!schedule) return;
      const dev = calculateDayDeviation(firstIn, lastOut, schedule);
      lateH += dev.lateMinutes / 60;
      extraH += dev.extraMinutes / 60;
    });
    return {
      total: active.length, all: staffList.length, present, leave, absent,
      rate: active.length ? Math.round((present / active.length) * 100) : 0,
      lateH: Number(lateH.toFixed(2)), extraH: Number(extraH.toFixed(2)),
    };
  }, [staffList, currentAttendance, today]);

  /* ---- attendance tab ---- */
  const [search, setSearch] = useState("");
  const q = search.trim().toLowerCase();
  const monthRecords = useMemo(() => allAttendance.filter((a) => ymd(a.date).startsWith(selectedMonth)), [allAttendance, selectedMonth]);
  const monthStats = useMemo(() => computeMonthStats(monthRecords, staffList), [monthRecords, staffList]);
  const visibleRecords = useMemo(() => (q ? allAttendance.filter((a) => (a.staff_name || "").toLowerCase().includes(q)) : allAttendance), [allAttendance, q]);
  const dayGroups = useMemo(() => groupAttendanceByDate(visibleRecords, staffList), [visibleRecords, staffList]);
  const activeStaff = useMemo(() => staffList.filter((s) => s.status === "Active" && (!q || (s.name || "").toLowerCase().includes(q))), [staffList, q]);

  const exportAttendance = () => {
    if (!allAttendance.length) return toast.info("Nothing to export for this month");
    const rows = [["Staff", "Date", "Status", "Punch in", "Punch out", "Breaks", "Hours"]];
    [...allAttendance]
      .sort((a, b) => ymd(a.date).localeCompare(ymd(b.date)) || (a.staff_name || "").localeCompare(b.staff_name || ""))
      .forEach((r) => rows.push([r.staff_name, ymd(r.date), r.status, hm(r.punch_in) === "—" ? "" : hm(r.punch_in), hm(r.punch_out) === "—" ? "" : hm(r.punch_out), r.breaks || "", Number(r.hours) || 0]));
    downloadCsv(`attendance-${selectedMonth}.csv`, rows);
  };

  /* ---- attendance edit ---- */
  const [editRec, setEditRec] = useState(null);
  const [attendanceEdit, setAttendanceEdit] = useState({ punch_in: "", punch_out: "", breaks: "", status: "present" });
  const [attError, setAttError] = useState("");
  const [savingAtt, setSavingAtt] = useState(false);
  const openEditAttendance = (rec) => {
    setEditRec(rec);
    setAttError("");
    setAttendanceEdit({ punch_in: rec.punch_in || "", punch_out: rec.punch_out || "", breaks: rec.breaks || "", status: rec.status || "present" });
  };
  const saveAttendance = async (e) => {
    e.preventDefault();
    const { punch_in: pin, punch_out: pout } = attendanceEdit;
    if (pin && pout && timeToMinutes(pout) <= timeToMinutes(pin)) return setAttError("Punch out must be after punch in.");
    setAttError("");
    setSavingAtt(true);
    try {
      const upd = await updateAttendance(editRec.id, { ...attendanceEdit, hours: calculateHours(pin, pout) });
      setAttByMonth((prev) => Object.fromEntries(Object.entries(prev).map(([m, rows]) => [m, rows.map((i) => (i.id === editRec.id ? upd : i))])));
      setEditRec(null);
      toast.success("Attendance updated");
    } catch {
      toast.error("Could not update attendance");
    } finally {
      setSavingAtt(false);
    }
  };

  /* ---- leave ---- */
  const [leaveFilter, setLeaveFilter] = useState("all");
  const [selectedLeave, setSelectedLeave] = useState(null);
  const [leaveBusy, setLeaveBusy] = useState(null);
  const leaveCounts = useMemo(() => ({
    all: allLeaves.length,
    pending: allLeaves.filter((l) => l.status === "pending").length,
    approved: allLeaves.filter((l) => l.status === "approved").length,
    rejected: allLeaves.filter((l) => l.status === "rejected").length,
  }), [allLeaves]);
  const shownLeaves = leaveFilter === "all" ? allLeaves : allLeaves.filter((l) => l.status === leaveFilter);

  const handleLeaveAction = async (id, act) => {
    setLeaveBusy(id);
    try {
      const upd = await updateLeave(id, act);
      setPendingLeaves((p) => p.filter((l) => l.id !== id));
      setAllLeaves((p) => p.map((l) => (l.id === id ? { ...l, ...upd } : l)));
      setSelectedLeave(null);
      toast.success(`Leave ${act}`);
    } catch {
      toast.error(`Could not mark the leave as ${act}`);
    } finally {
      setLeaveBusy(null);
    }
  };

  /* ---- calendar ---- */
  const [showCalendarModal, setShowCalendarModal] = useState(false);
  const [calendarEdit, setCalendarEdit] = useState({ date: "", type: "working", description: "" });
  const [calError, setCalError] = useState("");
  const [savingCal, setSavingCal] = useState(false);
  const openCalendarModal = (ev) => {
    setCalError("");
    setCalendarEdit(ev ? { date: ev.date, type: ev.type, description: ev.description || "" } : { date: "", type: "working", description: "" });
    setShowCalendarModal(true);
  };
  const handleAddCalendarEvent = async (e) => {
    e.preventDefault();
    if (!calendarEdit.date) return setCalError("Choose a date.");
    setSavingCal(true);
    try {
      const ev = await addCalendarEvent(calendarEdit);
      setCalendarData((p) => [...p, ev]);
      setShowCalendarModal(false);
      toast.success("Calendar event saved");
    } catch {
      toast.error("Could not save the calendar event");
    } finally {
      setSavingCal(false);
    }
  };
  const handleUpdateCalendarEvent = async (id, ev) => {
    try {
      const upd = await updateCalendarEvent(id, ev);
      setCalendarData((p) => p.map((e) => (e.id === id ? upd : e)));
    } catch { toast.error("Could not update the event"); }
  };

  /* ---- confirm dialog ---- */
  const [confirm, setConfirm] = useState(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const runConfirm = async () => {
    setConfirmBusy(true);
    try { await confirm.onConfirm(); } finally { setConfirmBusy(false); setConfirm(null); }
  };

  const handleDeleteCalendarEvent = (ev) =>
    setConfirm({
      title: "Delete calendar event?", message: `${formatDate(ev.date)} will go back to its default day type.`, confirmLabel: "Delete", danger: true,
      onConfirm: async () => {
        try { await deleteCalendarEvent(ev.id); setCalendarData((p) => p.filter((e) => e.id !== ev.id)); toast.success("Event deleted"); }
        catch { toast.error("Could not delete the event"); }
      },
    });

  /* ---- payroll ---- */
  const [salaryRuns, setSalaryRuns] = useState([]);
  const [runsLoading, setRunsLoading] = useState(false);
  const [selectedRun, setSelectedRun] = useState(null);
  const [runRecords, setRunRecords] = useState([]);
  const [showRunModal, setShowRunModal] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [showStructuresModal, setShowStructuresModal] = useState(false);
  const [salaryStructures, setSalaryStructures] = useState([]);
  const [savingStructure, setSavingStructure] = useState(null);
  const [payingId, setPayingId] = useState(null);
  const [creatingRun, setCreatingRun] = useState(false);
  const [newRunData, setNewRunData] = useState({ payroll_month: thisMonth, calendar_days: 0, sundays: 0, dl_days: 1, other_offdays: 0, is_loading: false });

  useEffect(() => {
    if (!showRunModal) return undefined;
    let cancelled = false;
    setNewRunData((prev) => ({ ...prev, is_loading: true }));
    const params = { month: newRunData.payroll_month };
    if (centreParam()) params.centre_id = centreParam();
    axios.get(api("/run-preview"), { headers: authHeaders(), params })
      .then((res) => {
        if (cancelled) return;
        setNewRunData((prev) => ({ ...prev, calendar_days: res.data.calendar_days, sundays: res.data.sundays, dl_days: res.data.dl_days, other_offdays: res.data.other_offdays, is_loading: false }));
      })
      .catch(() => { if (!cancelled) setNewRunData((prev) => ({ ...prev, is_loading: false })); });
    return () => { cancelled = true; };
  }, [newRunData.payroll_month, showRunModal]);

  const fetchSalaryRuns = useCallback(async () => {
    setRunsLoading(true);
    try {
      const params = centreParam() ? { centre_id: centreParam() } : {};
      const res = await axios.get(api("/runs"), { headers: authHeaders(), params });
      setSalaryRuns(res.data);
    } catch (err) {
      console.error("Error fetching runs:", err);
      toast.error("Could not load payroll runs");
    } finally {
      setRunsLoading(false);
    }
  }, []);
  useEffect(() => { if (activeTab === "salary") fetchSalaryRuns(); }, [activeTab, fetchSalaryRuns, reloadKey]);

  const fetchSalaryStructures = async () => {
    try {
      const params = centreParam() ? { centre_id: centreParam() } : {};
      const res = await axios.get(api("/structures"), { headers: authHeaders(), params });
      setSalaryStructures(res.data);
      setShowStructuresModal(true);
    } catch { toast.error("Failed to load payroll configurations"); }
  };
  const handleUpdateStructureInput = (staffId, field, value) =>
    setSalaryStructures((prev) => prev.map((s) => (s.staff_id === staffId ? { ...s, [field]: value } : s)));
  const handleSaveStructure = async (staffId) => {
    const struct = salaryStructures.find((s) => s.staff_id === staffId);
    setSavingStructure(staffId);
    try {
      await axios.put(api(`/structures/${staffId}`), {
        basic_salary: struct.basic_salary, hourly_service_revenue_target: struct.hourly_service_revenue_target, ta: struct.ta, fa: struct.fa,
      }, { headers: authHeaders() });
      toast.success(`${struct.staff_name}'s payroll config updated`);
    } catch { toast.error("Failed to update structure"); }
    finally { setSavingStructure(null); }
  };

  const runTargetDays = Number(newRunData.calendar_days) - (Number(newRunData.sundays) + Number(newRunData.dl_days) + Number(newRunData.other_offdays));
  const handleCreateRun = async () => {
    setCreatingRun(true);
    try {
      // eslint-disable-next-line no-unused-vars
      const { is_loading, ...rest } = newRunData;
      const payload = {
        ...rest,
        calendar_days: Number(rest.calendar_days), sundays: Number(rest.sundays), dl_days: Number(rest.dl_days), other_offdays: Number(rest.other_offdays),
      };
      if (centreParam()) payload.centre_id = centreParam();
      const res = await axios.post(api("/runs"), payload, { headers: authHeaders() });
      setSalaryRuns((prev) => [res.data, ...prev]);
      setShowRunModal(false);
      toast.success("Draft run created. Ready to generate.");
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to create run. Ensure a centre is selected.");
    } finally { setCreatingRun(false); }
  };

  const handleGenerateRun = async (runId) => {
    const toastId = toast.loading("Calculating payroll...");
    try {
      await axios.post(api(`/runs/${runId}/generate`), {}, { headers: authHeaders() });
      toast.update(toastId, { render: "Payroll generated", type: "success", isLoading: false, autoClose: 3000 });
      fetchSalaryRuns();
    } catch (err) {
      toast.update(toastId, { render: err.response?.data?.error || "Generation failed", type: "error", isLoading: false, autoClose: 5000 });
    }
  };

  const handleDeleteRun = (run) =>
    setConfirm({
      title: "Delete this payroll run?", message: `${monthLabel(run.payroll_month.substring(0, 7))} will be removed. You can create it again from the calendar later.`,
      confirmLabel: "Delete run", danger: true,
      onConfirm: async () => {
        try { await axios.delete(api(`/runs/${run.id}`), { headers: authHeaders() }); toast.success("Payroll run deleted"); fetchSalaryRuns(); }
        catch (err) { toast.error(err.response?.data?.error || "Failed to delete run"); }
      },
    });

  const handleReviewRun = async (run) => {
    setSelectedRun(run);
    try {
      const res = await axios.get(api(`/runs/${run.id}/records`), { headers: authHeaders() });
      setRunRecords(res.data);
      setShowReviewModal(true);
    } catch { toast.error("Failed to load records"); }
  };

  const handleUpdateDeduction = async (recordId, newDeduction) => {
    try {
      const res = await axios.put(api(`/records/${recordId}`), { deductions: newDeduction }, { headers: authHeaders() });
      setRunRecords((prev) => prev.map((r) => (r.id === recordId ? { ...r, deductions: res.data.deductions, net_pay: res.data.net_pay } : r)));
      toast.success("Deduction updated");
      return true;
    } catch { toast.error("Update failed"); return false; }
  };
  const handleUpdateNetPay = async (recordId, newNetPay) => {
    try {
      const res = await axios.put(api(`/records/${recordId}/override-net-pay`), { net_pay: newNetPay }, { headers: authHeaders() });
      setRunRecords((prev) => prev.map((r) => (r.id === recordId ? { ...r, net_pay: res.data.net_pay } : r)));
      toast.success("Net pay adjusted");
      return true;
    } catch (err) { toast.error(err.response?.data?.error || "Failed to update net pay"); return false; }
  };
  const handleUpdateWorkedHours = async (recordId, newHours) => {
    try {
      const res = await axios.put(api(`/records/${recordId}/override-hours`), { override_hours: newHours }, { headers: authHeaders() });
      setRunRecords((prev) => prev.map((r) => (r.id === recordId ? { ...r, ...res.data } : r)));
      toast.success("Hours overridden and salary recalculated");
      return true;
    } catch (err) { toast.error(err.response?.data?.error || "Failed to update hours"); return false; }
  };

  const handleFinalizeRun = () =>
    setConfirm({
      title: "Lock this payroll?", message: "Finalizing locks the run and prevents any further recalculation. Payments can be issued afterwards.", confirmLabel: "Lock & finalize",
      onConfirm: async () => {
        try {
          await axios.post(api(`/runs/${selectedRun.id}/finalize`), {}, { headers: authHeaders() });
          toast.success("Payroll finalized");
          setShowReviewModal(false);
          fetchSalaryRuns();
        } catch { toast.error("Failed to finalize"); }
      },
    });

  const handlePayRecord = async (recordId) => {
    if (!selectedWalletId) return toast.error("Please select a wallet to debit from");
    if (payingId) return undefined;
    setPayingId(recordId);
    try {
      await axios.post(api(`/records/${recordId}/pay`), { wallet_id: selectedWalletId }, { headers: authHeaders() });
      setRunRecords((prev) => prev.map((r) => (r.id === recordId ? { ...r, payment_status: "paid" } : r)));
      toast.success("Payment issued successfully");
    } catch (err) { toast.error(err.response?.data?.error || "Payment failed"); }
    finally { setPayingId(null); }
    return undefined;
  };

  const reviewTotals = useMemo(() => ({
    net: runRecords.reduce((s, r) => s + (Number(r.net_pay) || 0), 0),
    paid: runRecords.filter((r) => r.payment_status === "paid").length,
  }), [runRecords]);

  /* ---------------------------------------------------------------------
     Render
     --------------------------------------------------------------------- */
  const refreshAll = () => { currentMonthLoaded.current = false; setAttByMonth({}); setReloadKey((k) => k + 1); };

  if (booting && !staffList.length) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-indigo-50 p-4 sm:p-6">
        <div className="w-full animate-pulse space-y-4">
          <div className="h-10 w-72 rounded-lg bg-white" />
          <div className="h-14 rounded-2xl bg-white" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <div key={i} className="h-28 rounded-2xl bg-white" />)}</div>
        </div>
      </div>
    );
  }

  const dashboard = (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Active staff" value={dash.total} sub={`${dash.all} on the roster`} icon={FiUsers} />
        <Stat label="Present today" value={dash.present} sub={`${dash.rate}% attendance`} icon={FiUserCheck} tone="emerald" />
        <Stat label="Late hours today" value={`${dash.lateH}h`} sub="Against schedule" icon={FiUserX} tone="amber" />
        <Stat label="Extra hours today" value={`${dash.extraH}h`} sub="Beyond schedule" icon={FiTrendingUp} tone="indigo" />
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <DepartmentChart staff={staffList} />
        <TodayChart today={dash} />
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card title="Shortcuts" icon={FiPlus}>
          <div className="space-y-2">
            <button type="button" onClick={() => setActiveTab("attendance")} className={`${btnGhost} w-full justify-start`}><FiClock /> Open attendance</button>
            <button type="button" onClick={() => setActiveTab("salary")} className={`${btnGhost} w-full justify-start`}><FiDollarSign /> Open payroll</button>
            <button type="button" onClick={() => setActiveTab("calendar")} className={`${btnGhost} w-full justify-start`}><FiCalendar /> Edit working days</button>
          </div>
        </Card>
        <Card
          className="lg:col-span-2" title="Pending leave applications" icon={FiAlertCircle}
          action={<Chip cls="bg-amber-50 text-amber-700 ring-amber-200">{pendingLeaves.length} pending</Chip>}
        >
          {pendingLeaves.length === 0 ? <Empty icon={FiCheckCircle}>No pending leave applications</Empty> : (
            <div className="divide-y divide-slate-100">
              {pendingLeaves.slice(0, 4).map((l) => (
                <div key={l.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">{l.staff_name}</p>
                    <p className="text-xs text-slate-500">{titleCase(l.type)} · {formatDate(l.from_date)} – {formatDate(l.to_date)}</p>
                  </div>
                  <button type="button" onClick={() => setSelectedLeave(l)} className={btnPrimary}>Review</button>
                </div>
              ))}
              {pendingLeaves.length > 4 && <button type="button" onClick={() => setActiveTab("leave")} className="pt-3 text-sm font-medium text-navy-700 hover:underline">View all {pendingLeaves.length}</button>}
            </div>
          )}
        </Card>
      </div>
    </div>
  );

  const attendanceTab = (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">Attendance for <b className="text-slate-800">{monthLabel(selectedMonth)}</b></p>
        <div className="flex flex-wrap items-center gap-2">
          <SearchBox value={search} onChange={setSearch} placeholder="Search staff" />
          <button type="button" onClick={exportAttendance} className={btnGhost}><FiDownload /> Export CSV</button>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Total working hours" value={`${monthStats.totalWorkingHours}h`} sub={`${monthStats.totalPresentDays} staff-days`} icon={FiClock} />
        <Stat label="Avg hours / day" value={`${monthStats.avgWorkingHours}h`} icon={FiTrendingUp} tone="emerald" />
        <Stat label="Total late hours" value={`${monthStats.totalLateHours}h`} sub={`${monthStats.lateDays} late days`} icon={FiUserX} tone="amber" />
        <Stat label="Total extra hours" value={`${monthStats.totalExtraHours}h`} sub="Overtime" icon={FiTrendingUp} tone="indigo" />
      </div>
      <div>
        <h3 className="mb-3 text-sm font-semibold text-slate-800">Individual staff statistics</h3>
        {activeStaff.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white"><Empty icon={FiUsers}>No active staff match.</Empty></div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {activeStaff.map((s) => <StaffMonthCard key={s.id} staff={s} records={monthRecords} staffList={staffList} />)}
          </div>
        )}
      </div>
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-5 py-4">
          <h3 className="text-sm font-semibold text-slate-800">Daily attendance</h3>
          <p className="text-xs text-slate-400">Open a day to see each person, edit a punch or review multiple sessions.</p>
        </div>
        {attLoading && !allAttendance.length ? <Skeleton /> : dayGroups.length === 0 ? (
          <Empty>{q ? "No records match your search." : `No attendance records found for ${monthLabel(selectedMonth)}`}</Empty>
        ) : dayGroups.map((g) => <DayGroup key={g.date} group={g} today={today} onEdit={openEditAttendance} />)}
      </div>
    </div>
  );

  const leaveTab = (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by status">
          {["all", "pending", "approved", "rejected"].map((f) => (
            <button key={f} type="button" onClick={() => setLeaveFilter(f)} aria-pressed={leaveFilter === f}
              className={`rounded-full px-3.5 py-1.5 text-sm font-medium ${leaveFilter === f ? "bg-navy-700 text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}>
              {titleCase(f)} <span className="opacity-70">{leaveCounts[f]}</span>
            </button>
          ))}
        </div>
        <MonthSelect value={selectedLeaveMonth} onChange={setSelectedLeaveMonth} options={monthOptions} label="Leave month" />
      </div>
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {leaveLoading && !allLeaves.length ? <Skeleton /> : shownLeaves.length === 0 ? (
          <Empty icon={FiCoffee}>No leave applications for {monthLabel(selectedLeaveMonth)}{leaveFilter !== "all" ? ` with status “${leaveFilter}”` : ""}</Empty>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-left">
                <thead className="bg-slate-50 text-xs font-medium uppercase tracking-wide text-slate-500">
                  <tr>{["Staff", "Type", "From", "To", "Reason", "Status", "Applied", "Actions"].map((h) => <th key={h} className="px-4 py-3">{h}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {shownLeaves.map((l) => (
                    <tr key={l.id} className="align-top hover:bg-slate-50">
                      <td className="px-4 py-3"><p className="text-sm font-medium text-slate-900">{l.staff_name}</p><p className="text-xs text-slate-500">{l.department}</p></td>
                      <td className="px-4 py-3"><LeaveType l={l} /></td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-700">{formatDate(l.from_date)}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-700">{formatDate(l.to_date)}</td>
                      <td className="max-w-xs px-4 py-3 text-sm text-slate-600">{l.reason}</td>
                      <td className="px-4 py-3"><Chip cls={LEAVE_STATUS[l.status] || LEAVE_STATUS.pending}>{titleCase(l.status)}</Chip></td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-500">{formatDate(l.applied_date)}</td>
                      <td className="px-4 py-3"><LeaveActions l={l} busyId={leaveBusy} onAction={handleLeaveAction} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="divide-y divide-slate-100 md:hidden">
              {shownLeaves.map((l) => (
                <div key={l.id} className="space-y-2 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div><p className="text-sm font-semibold text-slate-900">{l.staff_name}</p><p className="text-xs text-slate-500">{l.department}</p></div>
                    <Chip cls={LEAVE_STATUS[l.status] || LEAVE_STATUS.pending}>{titleCase(l.status)}</Chip>
                  </div>
                  <div><LeaveType l={l} /></div>
                  <p className="text-sm text-slate-700">{formatDate(l.from_date)} – {formatDate(l.to_date)}</p>
                  {l.reason && <p className="text-sm text-slate-500">{l.reason}</p>}
                  <LeaveActions l={l} busyId={leaveBusy} onAction={handleLeaveAction} />
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );

  const salaryTab = (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Payroll runs</h2>
          <p className="text-sm text-slate-500">Monthly salary calculations and batches.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={fetchSalaryStructures} className={btnGhost}><FiSettings /> Payroll config</button>
          <button type="button" onClick={() => setShowRunModal(true)} className={btnPrimary}><FiPlus /> New run</button>
        </div>
      </div>
      {runsLoading && !salaryRuns.length ? <Skeleton rows={3} /> : salaryRuns.length === 0 ? (
        <Empty>No payroll runs yet. Create your first batch above.</Empty>
      ) : (
        <div className="divide-y divide-slate-100">
          {salaryRuns.map((run) => (
            <div key={run.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 hover:bg-slate-50">
              <div className="min-w-[10rem]">
                <p className="font-semibold text-slate-900">{monthLabel(run.payroll_month.substring(0, 7))}</p>
                <p className="text-xs text-slate-500">{run.days_targeted} target days · created {formatDate(run.created_at)}</p>
              </div>
              <Chip cls={RUN_STATUS[run.status] || RUN_STATUS.draft}>{titleCase(run.status)}</Chip>
              <div className="flex items-center gap-2">
                {run.status === "draft" ? (
                  <button type="button" onClick={() => handleGenerateRun(run.id)} className={btnPrimary}>Generate</button>
                ) : (
                  <button type="button" onClick={() => handleReviewRun(run)} className={btnGhost}>Review &amp; pay</button>
                )}
                {run.status !== "finalized" && (
                  <button type="button" onClick={() => handleDeleteRun(run)} className="rounded-lg p-2.5 text-rose-500 hover:bg-rose-50" title="Delete run" aria-label={`Delete ${monthLabel(run.payroll_month.substring(0, 7))} run`}><FiTrash2 className="h-4 w-4" /></button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  /* ---- review grid ---- */
  const cellNum = (v) => num0(v);
  const reviewModal = showReviewModal && selectedRun && (
    <Modal key="review" width="max-w-[96vw]" onClose={() => setShowReviewModal(false)}>
      <div className="-m-6 flex max-h-[90vh] flex-col">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 p-5">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Payroll review · {monthLabel(selectedRun.payroll_month.substring(0, 7))}</h3>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500">
              <Chip cls={RUN_STATUS[selectedRun.status] || RUN_STATUS.draft}>{titleCase(selectedRun.status)}</Chip>
              <span>{runRecords.length} staff · net {inr(reviewTotals.net)} · {reviewTotals.paid}/{runRecords.length} paid</span>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {selectedRun.status === "generated" && <button type="button" onClick={handleFinalizeRun} className={btnPrimary}><FiLock /> Lock &amp; finalize</button>}
            {selectedRun.status === "finalized" && (
              <SelectWrap>
                <select value={selectedWalletId} onChange={(e) => setSelectedWalletId(e.target.value)} aria-label="Disbursement wallet" className="appearance-none rounded-xl border border-slate-200 bg-white py-2.5 pl-3.5 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-navy-500/40">
                  <option value="">{wallets.length ? "Select disbursement wallet" : "No wallets available"}</option>
                  {wallets.map((w) => <option key={w.id} value={w.id}>{w.name} ({inr(w.balance)})</option>)}
                </select>
              </SelectWrap>
            )}
            <button type="button" onClick={() => setShowReviewModal(false)} className="rounded-lg p-2.5 text-slate-500 hover:bg-slate-200" aria-label="Close"><FiX className="h-5 w-5" /></button>
          </div>
        </div>
        <div className="grow overflow-auto">
          <table className="w-full whitespace-nowrap text-left text-xs">
            <thead className="sticky top-0 z-20 bg-slate-100 text-[11px] uppercase text-slate-500">
              <tr>
                <th rowSpan="2" className="sticky left-0 z-30 border-r border-slate-200 bg-slate-100 px-3 py-2.5">Staff</th>
                <th colSpan="2" className="border-b border-r border-slate-200 bg-sky-50 px-2 py-1 text-center">Base rates (₹)</th>
                <th colSpan="3" className="border-b border-r border-slate-200 px-2 py-1 text-center">Hours</th>
                <th colSpan="3" className="border-b border-r border-slate-200 bg-emerald-50 px-2 py-1 text-center">Service charge (₹)</th>
                <th colSpan="7" className="border-b border-r border-slate-200 bg-slate-50 px-2 py-1 text-center">Earnings (₹)</th>
                <th rowSpan="2" className="border-r border-slate-200 px-3 py-2.5 text-right align-bottom">Deductions</th>
                <th rowSpan="2" className="border-r border-slate-200 px-3 py-2.5 text-right align-bottom">Payment</th>
                <th rowSpan="2" className="border-r border-slate-200 px-3 py-2.5 text-right align-bottom">Net pay</th>
                <th rowSpan="2" className="px-3 py-2.5 text-center align-bottom">Action</th>
              </tr>
              <tr>
                <th className="bg-sky-50 px-2 py-1.5">Day</th><th className="border-r border-slate-200 bg-sky-50 px-2 py-1.5">Hour</th>
                <th className="px-2 py-1.5">Target</th><th className="px-2 py-1.5">Worked</th><th className="border-r border-slate-200 px-2 py-1.5">%</th>
                <th className="bg-emerald-50 px-2 py-1.5">Target</th><th className="bg-emerald-50 px-2 py-1.5">Actual</th><th className="border-r border-slate-200 bg-emerald-50 px-2 py-1.5">Col %</th>
                <th className="px-2 py-1.5 text-navy-700">Bonus %</th><th className="px-2 py-1.5">Basic</th><th className="px-2 py-1.5">Bonus</th><th className="px-2 py-1.5">Offday</th><th className="px-2 py-1.5">TA</th><th className="px-2 py-1.5">FA</th><th className="border-r border-slate-200 px-2 py-1.5">Gross</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {[...runRecords].sort((a, b) => (a.staff_name || "").localeCompare(b.staff_name || "")).map((r, index) => {
                const basicSalary = Number(r.snapshot_basic_salary || r.basic_pay || 0);
                const calendarDays = Number(selectedRun.calendar_days || 30);
                const perDay = calendarDays > 0 ? basicSalary / calendarDays : 0;
                const dailyHours = Number(r.snapshot_daily_hours || 9);
                const perHour = dailyHours > 0 ? perDay / dailyHours : 0;
                const ta = Number(r.ta_pay || r.ta || 0);
                const fa = Number(r.fa_pay || r.fa || 0);
                const off = Number(r.paid_offdays || 0);
                const workPct = Number(r.working_hours_percent || 0);
                const offdaysCount = Number(selectedRun.sundays || 0) + Number(selectedRun.dl_days || 0) + Number(selectedRun.other_offdays || 0);
                const surplus = Math.max(0, Number(r.achieved_service_revenue || 0) - Number(r.total_monthly_target || 0));
                const basicTip = `${Number(r.total_worked_hours || 0).toFixed(1)} worked hrs × ₹${perHour.toFixed(2)}/hr`;
                const bonusTip = `${Number(r.bonus_percent || 0).toFixed(1)}% × ₹${surplus.toLocaleString()} (surplus service charge)`;
                const offTip = workPct >= 100 ? `${offdaysCount} offdays × ₹${perDay.toFixed(2)}/day` : `${offdaysCount} offdays × ₹${perDay.toFixed(2)}/day × ${workPct.toFixed(1)}%`;
                const editable = selectedRun.status === "generated";
                const rowBg = index % 2 === 0 ? "bg-white" : "bg-slate-50";
                const commit = (e, same, fn) => { if (same) return; fn().then((ok) => { if (!ok) e.target.value = e.target.defaultValue; }); };
                return (
                  <tr key={r.id} className={`group ${rowBg} hover:bg-slate-100/70`}>
                    <td className={`sticky left-0 z-10 border-r border-slate-100 px-3 py-2 shadow-[1px_0_0_0_#e2e8f0] ${rowBg} group-hover:bg-slate-100`}>
                      <div className="max-w-[150px] truncate font-semibold text-slate-900" title={r.staff_name}>{r.staff_name}</div>
                      <div className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-navy-700">Shift {dailyHours.toFixed(1)}h/d</div>
                    </td>
                    <td className="bg-sky-50/40 px-2 py-2 font-medium text-sky-800">{perDay.toFixed(0)}</td>
                    <td className="border-r border-slate-100 bg-sky-50/40 px-2 py-2 font-medium text-sky-800">{perHour.toFixed(0)}</td>
                    <td className="px-2 py-2 text-slate-500">{formatDecimalToHHMM(r.total_targeted_hours)}</td>
                    <td className="px-2 py-1.5">
                      {editable ? (
                        <input
                          key={`h-${r.id}-${r.total_worked_hours}`} type="text" defaultValue={formatDecimalToHHMM(r.total_worked_hours)} placeholder="HH:MM" aria-label={`Worked hours for ${r.staff_name}`}
                          onKeyDown={(e) => { if (e.key === "Enter") e.target.blur(); }}
                          onBlur={(e) => commit(e, e.target.value.trim() === formatDecimalToHHMM(r.total_worked_hours), () => handleUpdateWorkedHours(r.id, parseHHMMToDecimal(e.target.value)))}
                          className="w-16 rounded border border-slate-200 bg-white p-1 text-center text-xs font-semibold text-navy-700 focus:outline-none focus:ring-2 focus:ring-navy-500/40"
                        />
                      ) : <span className="block text-center font-medium text-slate-900">{formatDecimalToHHMM(r.total_worked_hours)}</span>}
                    </td>
                    <td className="border-r border-slate-100 px-2 py-2"><span className={`font-semibold ${workPct >= 100 ? "text-emerald-600" : "text-amber-600"}`}>{workPct.toFixed(0)}%</span></td>
                    <td className="px-2 py-2 text-slate-500">{Number(r.total_monthly_target || 0).toLocaleString()}</td>
                    <td className="px-2 py-2 font-medium text-slate-900">{Number(r.achieved_service_revenue || 0).toLocaleString()}</td>
                    <td className="border-r border-slate-100 bg-emerald-50/40 px-2 py-2"><span className={`font-semibold ${Number(r.revenue_percent || 0) >= 100 ? "text-emerald-600" : "text-amber-600"}`}>{Number(r.revenue_percent || 0).toFixed(0)}%</span></td>
                    <td className="bg-slate-50 px-2 py-2 font-semibold text-navy-700">{Number(r.bonus_percent || 0).toFixed(1)}%</td>
                    <td className="px-2 py-2 text-slate-700"><span className="cursor-help" title={basicTip}>{cellNum(r.basic_pay)}</span></td>
                    <td className="px-2 py-2 font-semibold text-emerald-600"><span className="cursor-help" title={bonusTip}>{cellNum(r.bonus)}</span></td>
                    <td className="px-2 py-2 text-slate-700"><span className="cursor-help" title={offTip}>{cellNum(off)}</span></td>
                    <td className="px-2 py-2 text-slate-700">{cellNum(ta)}</td>
                    <td className="px-2 py-2 text-slate-700">{cellNum(fa)}</td>
                    <td className="border-r border-slate-100 bg-slate-50 px-2 py-2 font-semibold text-slate-900">{cellNum(r.full_pay)}</td>
                    <td className="border-r border-slate-100 bg-rose-50/30 px-2 py-1.5 text-right">
                      {editable ? (
                        <input
                          key={`d-${r.id}-${r.deductions}`} type="number" defaultValue={r.deductions} aria-label={`Deductions for ${r.staff_name}`}
                          onKeyDown={(e) => { if (e.key === "Enter") e.target.blur(); }}
                          onBlur={(e) => commit(e, Number(e.target.value) === Number(r.deductions || 0), () => handleUpdateDeduction(r.id, e.target.value))}
                          className="w-16 rounded border border-rose-200 bg-white p-1 text-right text-xs font-medium text-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-300"
                        />
                      ) : <span className="block text-right font-medium text-rose-600">{Number(r.deductions || 0).toLocaleString()}</span>}
                    </td>
                    <td className="border-r border-slate-100 bg-slate-50 px-3 py-2 text-right font-semibold text-slate-900">{cellNum(Number(r.full_pay || 0) - Number(r.deductions || 0))}</td>
                    <td className="border-r border-slate-100 bg-emerald-50/40 px-2 py-1.5 text-right">
                      {editable ? (
                        <input
                          key={`n-${r.id}-${r.net_pay}`} type="number" defaultValue={Number(r.net_pay || 0).toFixed(0)} aria-label={`Net pay for ${r.staff_name}`}
                          onKeyDown={(e) => { if (e.key === "Enter") e.target.blur(); }}
                          onBlur={(e) => commit(e, Number(e.target.value) === Number(Number(r.net_pay || 0).toFixed(0)), () => handleUpdateNetPay(r.id, e.target.value))}
                          className="w-20 rounded border border-emerald-200 bg-white p-1 text-right text-sm font-bold text-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-300"
                        />
                      ) : <span className="block px-1 text-sm font-bold text-slate-900">{Number(r.net_pay || 0).toLocaleString()}</span>}
                    </td>
                    <td className="bg-slate-50 px-2 py-2 text-center">
                      {r.payment_status === "paid" ? (
                        <Chip cls="bg-emerald-50 text-emerald-700 ring-emerald-200">Paid</Chip>
                      ) : selectedRun.status === "finalized" ? (
                        <button type="button" disabled={Boolean(payingId)} onClick={() => handlePayRecord(r.id)} className="rounded-lg bg-navy-700 px-3 py-1 text-[11px] font-semibold text-white hover:bg-navy-800 disabled:opacity-50">{payingId === r.id ? "Paying…" : "Pay"}</button>
                      ) : <span className="text-[11px] text-slate-400">Pending</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </Modal>
  );

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-indigo-50 p-4 sm:p-6">
        <div className="w-full">
          <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 md:text-3xl">Attendance &amp; Salary</h1>
              <p className="mt-1 text-sm text-slate-500">Attendance, leave and payroll for your centre</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {activeTab === "attendance" && <MonthSelect value={selectedMonth} onChange={setSelectedMonth} options={monthOptions} />}
              <button type="button" onClick={refreshAll} className={btnGhost}><FiRefreshCw /> Refresh</button>
            </div>
          </div>

          {loadError && (
            <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              <span className="flex items-center gap-2"><FiAlertCircle className="h-4 w-4" /> Could not load the staff list.</span>
              <button type="button" onClick={refreshAll} className="font-medium underline">Retry</button>
            </div>
          )}

          <div className="mb-6 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-1.5" role="tablist" aria-label="Sections">
            <div className="flex gap-1">
              {TABS.map((t) => (
                <button key={t.id} type="button" role="tab" aria-selected={activeTab === t.id} onClick={() => setActiveTab(t.id)}
                  className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition ${activeTab === t.id ? "bg-navy-700 text-white" : "text-slate-600 hover:bg-slate-100"}`}>
                  <t.icon className="h-4 w-4" /> {t.label}
                </button>
              ))}
            </div>
          </div>

          {activeTab === "dashboard" && dashboard}
          {activeTab === "attendance" && attendanceTab}
          {activeTab === "leave" && leaveTab}
          {activeTab === "salary" && salaryTab}
          {activeTab === "calendar" && (
            <CalendarView
              calendarData={calendarData} leavesData={allLeaves}
              onAddEvent={() => openCalendarModal()} onEditEvent={openCalendarModal}
              onDeleteEvent={handleDeleteCalendarEvent} onUpdateEvent={handleUpdateCalendarEvent}
            />
          )}
        </div>
      </div>

      <AnimatePresence>
        {editRec && (
          <Modal key="edit" onClose={() => setEditRec(null)}>
            <ModalHeader title="Edit attendance" subtitle={`${editRec.staff_name || ""} · ${formatDate(editRec.date)}`} onClose={() => setEditRec(null)} />
            <form onSubmit={saveAttendance} noValidate className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Punch in" htmlFor="ae-in"><input id="ae-in" type="time" value={attendanceEdit.punch_in} onChange={(e) => setAttendanceEdit((p) => ({ ...p, punch_in: e.target.value }))} className={inputCls} /></Field>
                <Field label="Punch out" htmlFor="ae-out"><input id="ae-out" type="time" value={attendanceEdit.punch_out} onChange={(e) => setAttendanceEdit((p) => ({ ...p, punch_out: e.target.value }))} className={inputCls} /></Field>
              </div>
              <Field label="Break" htmlFor="ae-break" hint="For example 13:00-14:00"><input id="ae-break" value={attendanceEdit.breaks} onChange={(e) => setAttendanceEdit((p) => ({ ...p, breaks: e.target.value }))} placeholder="13:00-14:00" className={inputCls} /></Field>
              <Field label="Status" htmlFor="ae-status">
                <SelectWrap>
                  <select id="ae-status" value={attendanceEdit.status} onChange={(e) => setAttendanceEdit((p) => ({ ...p, status: e.target.value }))} className={`${inputCls} appearance-none pr-9`}>
                    <option value="present">Present</option>
                    <option value="sick_leave">Sick leave</option>
                    <option value="casual_leave">Casual leave</option>
                    <option value="absent">Absent</option>
                    {!["present", "sick_leave", "casual_leave", "absent"].includes(attendanceEdit.status) && <option value={attendanceEdit.status}>{titleCase(attendanceEdit.status)}</option>}
                  </select>
                </SelectWrap>
              </Field>
              <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">Hours: <b className="text-slate-900">{Number(calculateHours(attendanceEdit.punch_in, attendanceEdit.punch_out)).toFixed(2)}h</b></p>
              {attError && <p role="alert" className="text-sm text-rose-600">{attError}</p>}
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setEditRec(null)} className={`${btnGhost} flex-1`}>Cancel</button>
                <button type="submit" disabled={savingAtt} className={`${btnPrimary} flex-1`}>{savingAtt ? "Saving…" : "Save changes"}</button>
              </div>
            </form>
          </Modal>
        )}

        {selectedLeave && (
          <Modal key="leave" onClose={() => setSelectedLeave(null)}>
            <ModalHeader title="Review leave application" onClose={() => setSelectedLeave(null)} />
            <dl className="mb-6 space-y-3 text-sm">
              <div><dt className="text-slate-500">Staff member</dt><dd className="font-medium text-slate-900">{selectedLeave.staff_name}</dd></div>
              <div><dt className="text-slate-500">Leave type</dt><dd><LeaveType l={selectedLeave} /></dd></div>
              <div className="grid grid-cols-2 gap-3">
                <div><dt className="text-slate-500">From</dt><dd className="font-medium text-slate-900">{formatDate(selectedLeave.from_date)}</dd></div>
                <div><dt className="text-slate-500">To</dt><dd className="font-medium text-slate-900">{formatDate(selectedLeave.to_date)}</dd></div>
              </div>
              <div><dt className="text-slate-500">Reason</dt><dd className="text-slate-900">{selectedLeave.reason || "—"}</dd></div>
            </dl>
            <div className="flex gap-3">
              <button type="button" disabled={leaveBusy === selectedLeave.id} onClick={() => handleLeaveAction(selectedLeave.id, "rejected")} className={`${btnGhost} flex-1 !text-rose-600`}>Reject</button>
              <button type="button" disabled={leaveBusy === selectedLeave.id} onClick={() => handleLeaveAction(selectedLeave.id, "approved")} className={`${btnPrimary} flex-1`}>Approve</button>
            </div>
          </Modal>
        )}

        {showCalendarModal && (
          <Modal key="cal" onClose={() => setShowCalendarModal(false)}>
            <ModalHeader title="Calendar event" subtitle="Mark a day as working, holiday or weekend." onClose={() => setShowCalendarModal(false)} />
            <form onSubmit={handleAddCalendarEvent} noValidate className="space-y-4">
              <Field label="Date" htmlFor="ce-date" error={calError}><input id="ce-date" type="date" value={calendarEdit.date} onChange={(e) => { setCalError(""); setCalendarEdit((p) => ({ ...p, date: e.target.value })); }} className={inputCls} /></Field>
              <Field label="Type" htmlFor="ce-type">
                <SelectWrap>
                  <select id="ce-type" value={calendarEdit.type} onChange={(e) => setCalendarEdit((p) => ({ ...p, type: e.target.value }))} className={`${inputCls} appearance-none pr-9`}>
                    <option value="working">Working day</option><option value="holiday">Holiday</option><option value="weekend">Weekend</option>
                  </select>
                </SelectWrap>
              </Field>
              <Field label="Description" htmlFor="ce-desc"><input id="ce-desc" value={calendarEdit.description} onChange={(e) => setCalendarEdit((p) => ({ ...p, description: e.target.value }))} placeholder="e.g. Republic Day" className={inputCls} /></Field>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowCalendarModal(false)} className={`${btnGhost} flex-1`}>Cancel</button>
                <button type="submit" disabled={savingCal} className={`${btnPrimary} flex-1`}>{savingCal ? "Saving…" : "Save to calendar"}</button>
              </div>
            </form>
          </Modal>
        )}

        {showRunModal && (
          <Modal key="run" onClose={() => setShowRunModal(false)}>
            <ModalHeader title="New payroll run" subtitle="Day counts sync from the working-days calendar. Adjust them if needed." onClose={() => setShowRunModal(false)} />
            <div className="space-y-4">
              <Field label="Payroll month" htmlFor="run-month">
                <SelectWrap>
                  <select id="run-month" value={newRunData.payroll_month} onChange={(e) => setNewRunData((p) => ({ ...p, payroll_month: e.target.value }))} className={`${inputCls} appearance-none pr-9`}>
                    {monthOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </SelectWrap>
              </Field>
              {newRunData.is_loading ? (
                <div className="space-y-2"><div className="h-12 animate-pulse rounded-lg bg-slate-100" /><div className="h-12 animate-pulse rounded-lg bg-slate-100" /></div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-4">
                    {[["calendar_days", "Calendar days"], ["dl_days", "Duty leaves (DL)"], ["sundays", "Sundays"], ["other_offdays", "Other offdays"]].map(([k, label]) => (
                      <Field key={k} label={label} htmlFor={`run-${k}`}>
                        <input id={`run-${k}`} type="number" min="0" value={newRunData[k]} onChange={(e) => setNewRunData((p) => ({ ...p, [k]: e.target.value }))} className={inputCls} />
                      </Field>
                    ))}
                  </div>
                  <div className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3 text-sm">
                    <span className="text-slate-500">Target working days</span>
                    <b className={runTargetDays > 0 ? "text-slate-900" : "text-rose-600"}>{Number.isFinite(runTargetDays) ? runTargetDays : 0} days</b>
                  </div>
                  {!(runTargetDays > 0) && <p role="alert" className="text-xs text-rose-600">Target working days must be more than zero.</p>}
                </>
              )}
            </div>
            <button type="button" onClick={handleCreateRun} disabled={newRunData.is_loading || creatingRun || !(runTargetDays > 0)} className={`${btnPrimary} mt-6 w-full`}>{creatingRun ? "Creating…" : "Create run"}</button>
          </Modal>
        )}

        {reviewModal}

        {showStructuresModal && (
          <Modal key="struct" width="max-w-5xl" onClose={() => setShowStructuresModal(false)}>
            <ModalHeader title="Staff payroll configuration" subtitle="Base salary, hourly revenue target, TA and FA for each staff member." onClose={() => setShowStructuresModal(false)} />
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full whitespace-nowrap text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr><th className="px-4 py-3">Staff</th><th className="px-4 py-3">Basic salary (₹)</th><th className="px-4 py-3">Hourly target (₹)</th><th className="px-4 py-3">TA (₹)</th><th className="px-4 py-3">FA (₹)</th><th className="px-4 py-3 text-center">Action</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {salaryStructures.map((s) => (
                    <tr key={s.staff_id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-semibold text-slate-900">{s.staff_name}</td>
                      {[["basic_salary", "w-32"], ["hourly_service_revenue_target", "w-32"], ["ta", "w-24"], ["fa", "w-24"]].map(([f, w]) => (
                        <td key={f} className="px-4 py-2">
                          <input type="number" value={s[f] ?? ""} onChange={(e) => handleUpdateStructureInput(s.staff_id, f, e.target.value)} aria-label={`${f.replace(/_/g, " ")} for ${s.staff_name}`} className={`${w} rounded-lg border border-slate-200 p-2 focus:outline-none focus:ring-2 focus:ring-navy-500/40`} />
                        </td>
                      ))}
                      <td className="px-4 py-2 text-center"><button type="button" disabled={savingStructure === s.staff_id} onClick={() => handleSaveStructure(s.staff_id)} className={btnGhost}>{savingStructure === s.staff_id ? "Saving…" : "Save"}</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Modal>
        )}

        {confirm && <ConfirmModal key="confirm" {...confirm} busy={confirmBusy} onConfirm={runConfirm} onClose={() => setConfirm(null)} />}
      </AnimatePresence>
    </ErrorBoundary>
  );
};

export default AdminAttendance;