// src/pages/AdminAttendance.jsx
import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import {
  FiClock, FiCalendar, FiDollarSign, FiUser, FiLogOut, FiLogIn,
  FiTrendingUp, FiBarChart2, FiPieChart, FiCheckCircle, FiAlertCircle,
  FiRefreshCw, FiDownload, FiPlus, FiEdit, FiTrash2, FiSend,
  FiHome, FiBriefcase, FiCoffee, FiHeart, FiFileText, FiSettings,
  FiChevronDown, FiChevronUp, FiFilter, FiSearch, FiX, FiArrowRight,
  FiClock as FiTime, FiUserCheck, FiUserX, FiWatch, FiUsers,
  FiEye, FiCheck, FiXCircle, FiMenu, FiBell, FiMail, FiBarChart,
  FiPercent, FiDivide, FiX as FiMultiply, FiMinus, FiPlus as FiAdd,
  FiChevronLeft, FiChevronRight, FiMapPin, FiMove
} from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Bar, Line, Pie, Doughnut } from 'react-chartjs-2';
import { toast } from 'react-toastify';
import {
  getStaffList,
  getAllAttendance,
  updateAttendance,
  getPendingLeaves,
  updateLeave,
  getSalaryData,
  updateSalary,
  sendSalary,
  bulkSendSalaries,
  getCalendarData,
  addCalendarEvent,
  createSalary,
  updateCalendarEvent,
  deleteCalendarEvent,
  getStaffSchedules,
  getAutoCalc,
  getLeaves //
} from '/src/services/salaryService';
import { getWalletsForCentre } from '@/services/walletService';
import CalendarView from '@/components/CalendarView';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

// ---------------------------------------------------------------------
// Error Boundary
// ---------------------------------------------------------------------
class ErrorBoundary extends React.Component {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error, info) { console.error('Error in AdminAttendance:', error, info); }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 text-center">
          <h3 className="text-lg font-bold text-red-600">Something went wrong</h3>
          <p className="text-gray-600">Please try refreshing the page or contact support.</p>
        </div>
      );
    }
    return this.props.children;
  }
}

// ---------------------------------------------------------------------
// Date utilities
// ---------------------------------------------------------------------
const normalizeDate = (dateStr) => {
  try {
    if (!dateStr) return '';
    let date;
    if (dateStr instanceof Date) date = dateStr;
    else if (typeof dateStr === 'string' && dateStr.includes('GMT')) date = new Date(dateStr);
    else if (typeof dateStr === 'string' && dateStr.includes('T')) date = new Date(dateStr);
    else if (typeof dateStr === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) date = new Date(dateStr + 'T00:00:00');
    else date = new Date(dateStr);
    if (isNaN(date.getTime())) return '';
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  } catch (e) {
    console.error('Error normalizing date:', e);
    return '';
  }
};

// Helper function to get current month in YYYY-MM format
const getCurrentMonth = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

// Helper function to format month for display
const formatMonthForDisplay = (monthStr) => {
  if (!monthStr) return '';
  const [year, month] = monthStr.split('-');
  const date = new Date(parseInt(year), parseInt(month) - 1, 1);
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
};

// Helper function to generate month options (12 months back, current, and 3 months forward)
const generateMonthOptions = () => {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  
  const options = [];
  
  // Add 12 previous months
  for (let i = 12; i >= 1; i--) {
    const date = new Date(now);
    date.setMonth(now.getMonth() - i);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const value = `${year}-${month}`;
    const label = formatMonthForDisplay(value);
    options.push({ value, label });
  }
  
  // Add current month
  const currentValue = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
  options.push({ 
    value: currentValue, 
    label: `${formatMonthForDisplay(currentValue)} (Current)` 
  });
  
  // Add 3 future months
  for (let i = 1; i <= 3; i++) {
    const date = new Date(now);
    date.setMonth(now.getMonth() + i);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const value = `${year}-${month}`;
    const label = `${formatMonthForDisplay(value)} (Future)`;
    options.push({ value, label });
  }
  
  return options;
};

const timeToMinutes = (timeStr) => {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
};

const minutesToTime = (totalMinutes) => {
  if (totalMinutes <= 0) return '00:00';
  const h = Math.floor(totalMinutes / 60);
  const m = Math.round(totalMinutes % 60);
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
};

const findEffectiveSchedule = (staff, attendanceDate) => {
  if (!staff?.schedules?.length || !attendanceDate) return null;
  const nd = normalizeDate(attendanceDate);
  const sorted = [...staff.schedules].sort((a, b) => new Date(b.effective_from) - new Date(a.effective_from));
  return sorted.find(s => normalizeDate(s.effective_from) <= nd) || null;
};

const calculateScheduleDeviations = (record, staff) => {
  if (!record || !staff || record.status !== 'present') {
    return { lateHours: 0, extraHours: 0, lateMinutes: 0, extraMinutes: 0, lateTime: '00:00', extraTime: '00:00', hasSchedule: false };
  }
  const { punch_in, punch_out, date } = record;
  const schedule = findEffectiveSchedule(staff, date);
  if (!schedule?.start_time || !schedule?.end_time) {
    return { lateHours: 0, extraHours: 0, lateMinutes: 0, extraMinutes: 0, lateTime: '00:00', extraTime: '00:00', hasSchedule: false };
  }
  if (!punch_in || !punch_out) {
    return { lateHours: 0, extraHours: 0, lateMinutes: 0, extraMinutes: 0, lateTime: '00:00', extraTime: '00:00', hasSchedule: true, schedule };
  }
  const inM = timeToMinutes(punch_in);
  const outM = timeToMinutes(punch_out);
  const startM = timeToMinutes(schedule.start_time);
  const endM = timeToMinutes(schedule.end_time);
  const lateM = Math.max(0, inM - startM);
  const extraM = Math.max(0, outM - endM);
  return {
    lateHours: Number((lateM / 60).toFixed(2)),
    extraHours: Number((extraM / 60).toFixed(2)),
    lateMinutes: lateM,
    extraMinutes: extraM,
    lateTime: minutesToTime(lateM),
    extraTime: minutesToTime(extraM),
    hasSchedule: true,
    schedule
  };
};

const calculateDayDeviation = (firstIn, lastOut, schedule) => {
  if (!firstIn || !lastOut || !schedule?.start_time || !schedule?.end_time) {
    return { lateMinutes: 0, extraMinutes: 0 };
  }
  const inM = timeToMinutes(firstIn);
  const outM = timeToMinutes(lastOut);
  const startM = timeToMinutes(schedule.start_time);
  const endM = timeToMinutes(schedule.end_time);

  const lateM = Math.max(0, inM - startM);
  const extraM = Math.max(0, outM - endM);
  return { lateMinutes: lateM, extraMinutes: extraM };
};

/* -------------------------------------------------------------
   GROUP ATTENDANCE – ONE ROW PER STAFF PER DAY
   ------------------------------------------------------------- */
const groupAttendance = (attendance, staffList) => {
  const map = new Map(); // key = staff_id + date

  attendance.forEach((rec) => {
    const key = `${rec.staff_id}-${normalizeDate(rec.date)}`;
    if (!map.has(key)) {
      const staff = staffList.find(s => s.id === rec.staff_id);
      const schedule = findEffectiveSchedule(staff, rec.date);
      map.set(key, {
        staff_id: rec.staff_id,
        staff_name: rec.staff_name,
        date: rec.date,
        punch_in: rec.punch_in,
        punch_out: rec.punch_out,
        breaks: rec.breaks,
        status: rec.status,
        hours: rec.hours,
        schedule,
        raw: [],               // keep every punch for dropdown
        lateMinutes: 0,
        extraMinutes: 0,
      });
    }

    const entry = map.get(key);

    // first punch-in of the day
    if (!entry.punch_in || rec.punch_in < entry.punch_in) entry.punch_in = rec.punch_in;
    // last punch-out of the day
    if (rec.punch_out && (!entry.punch_out || rec.punch_out > entry.punch_out))
      entry.punch_out = rec.punch_out;

    entry.raw.push(rec);
  });

  // ---- ONE-TIME LATE/EXTRA CALCULATION ----
  return Array.from(map.values()).map(g => {
    const { lateMinutes, extraMinutes } = calculateDayDeviation(
      g.punch_in,
      g.punch_out,
      g.schedule
    );
    return {
      ...g,
      lateMinutes,
      extraMinutes,
      lateHours: Number((lateMinutes / 60).toFixed(2)),
      extraHours: Number((extraMinutes / 60).toFixed(2)),
      lateTime: minutesToTime(lateMinutes),
      extraTime: minutesToTime(extraMinutes),
    };
  });
};

/* -------------------------------------------------------------
   COLLAPSIBLE ROW (unchanged UI – only uses the aggregated values)
   ------------------------------------------------------------- */
const CollapsibleAttendanceRow = ({ group, staffList, onEdit }) => {
  const [open, setOpen] = useState(false);
  const staff = staffList.find(s => s.id === group.staff_id);
  const fmt = (t) => t ? t.split(':').slice(0, 2).join(':') : '';

  return (
    <>
      {/* ---- MAIN ROW ---- */}
      <tr
        className="border-b border-gray-200 hover:bg-gray-50 cursor-pointer"
        onClick={() => setOpen(!open)}
      >
        <td className="py-4 px-4">
          <p className="text-sm font-medium text-gray-900">{group.staff_name}</p>
          <p className="text-xs text-gray-500">{group.staff_id}</p>
          {group.schedule && (
            <p className="text-xs text-gray-400 cursor-help"
               title={`Effective from: ${new Date(group.schedule.effective_from).toLocaleDateString()}`}>
              Schedule: {fmt(group.schedule.start_time)} - {fmt(group.schedule.end_time)}
            </p>
          )}
        </td>
        <td className="py-4 px-4">
          <p className="text-sm text-gray-900">
            {new Date(group.date).toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short' })}
          </p>
        </td>
        <td className="py-4 px-4">
          <div className="flex items-center space-x-2">
            {group.punch_in ? (
              <>
                <FiLogIn className="h-4 w-4 text-emerald-500" />
                <span className="text-sm text-gray-900">{group.punch_in}</span>
                {group.lateMinutes > 0 && (
                  <span className="px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded text-xs"
                        title={`Late by ${group.lateTime}`}>
                    +{group.lateTime}
                  </span>
                )}
              </>
            ) : <span className="text-sm text-gray-400">-</span>}
          </div>
        </td>
        <td className="py-4 px-4">
          <div className="flex items-center space-x-2">
            {group.punch_out ? (
              <>
                <FiLogOut className="h-4 w-4 text-red-500" />
                <span className="text-sm text-gray-900">{group.punch_out}</span>
                {group.extraMinutes > 0 && (
                  <span className="px-1.5 py-0.5 bg-purple-100 text-purple-800 rounded text-xs"
                        title={`Extra ${group.extraTime}`}>
                    +{group.extraTime}
                  </span>
                )}
              </>
            ) : <span className="text-sm text-gray-400">-</span>}
          </div>
        </td>
        <td className="py-4 px-4"><p className="text-sm text-gray-900">{group.breaks || '-'}</p></td>
        <td className="py-4 px-4">
          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
            group.status === 'present' ? 'bg-emerald-50 text-emerald-700'
              : group.status.includes('leave') ? 'bg-amber-50 text-amber-700'
              : group.status === 'absent' ? 'bg-red-50 text-red-700'
              : 'bg-gray-50 text-gray-700'
          }`}>
            {group.status === 'present' ? 'Present'
              : group.status.includes('leave') ? 'Leave'
              : group.status === 'absent' ? 'Absent' : 'Weekend'}
          </span>
        </td>
        <td className="py-4 px-4">
          <p className="text-sm font-medium text-gray-900">
            {Number(group.hours) > 0 ? `${Number(group.hours).toFixed(2)}h` : '-'}
          </p>
        </td>
        <td className="py-4 px-4">
          <div className="flex flex-col space-y-1">
            {group.lateHours > 0 && (
              <span className="text-xs text-amber-600 font-medium"
                    title={`Late ${group.lateHours}h`}>Late: {group.lateHours}h</span>
            )}
            {group.extraHours > 0 && (
              <span className="text-xs text-purple-600 font-medium"
                    title={`Extra ${group.extraHours}h`}>Extra: {group.extraHours}h</span>
            )}
          </div>
        </td>
        <td className="py-4 px-4">
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(group); }}
            className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg"
          >
            <FiEdit className="h-4 w-4" />
          </button>
        </td>
      </tr>

      {/* ---- EXPANDED ROW – RAW PUNCHES ---- */}
      {open && (
        <tr>
          <td colSpan={9} className="p-0">
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: 'auto' }}
              exit={{ height: 0 }}
              className="bg-gray-50 border-t border-gray-200"
            >
              <table className="w-full">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="py-2 px-4 text-left text-xs font-medium text-gray-600">Punch In</th>
                    <th className="py-2 px-4 text-left text-xs font-medium text-gray-600">Punch Out</th>
                    <th className="py-2 px-4 text-left text-xs font-medium text-gray-600">Late</th>
                    <th className="py-2 px-4 text-left text-xs font-medium text-gray-600">Extra</th>
                  </tr>
                </thead>
                <tbody>
                  {group.raw.map((r, i) => {
                    // we **don't** recalculate late/extra here – just show "-"
                    return (
                      <tr key={i} className="border-b border-gray-200">
                        <td className="py-2 px-4 text-sm">{r.punch_in || '-'}</td>
                        <td className="py-2 px-4 text-sm">{r.punch_out || '-'}</td>
                        <td className="py-2 px-4 text-sm">-</td>
                        <td className="py-2 px-4 text-sm">-</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </motion.div>
          </td>
        </tr>
      )}
    </>
  );
};

// ---------------------------------------------------------------------
// UI components
// ---------------------------------------------------------------------
const StatCard = ({ title, value, icon: Icon, color, subtitle, trend }) => (
  <motion.div whileHover={{ y: -2 }} className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-lg transition-all duration-300">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
        <p className="text-2xl font-bold text-gray-900 mb-1">{value}</p>
        <p className="text-sm text-gray-500">{subtitle}</p>
        {trend && <p className={`text-xs font-medium ${trend > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{trend > 0 ? '+' : ''}{trend}% from last month</p>}
      </div>
      <div className={`p-3 rounded-xl ${color}`}><Icon className="h-6 w-6 text-white" /></div>
    </div>
  </motion.div>
);

const DepartmentDistributionChart = ({ staff }) => {
  const dept = staff.reduce((a, s) => { a[s.department] = (a[s.department] || 0) + 1; return a; }, {});
  const data = {
    labels: Object.keys(dept),
    datasets: [{
      data: Object.values(dept),
      backgroundColor: ['rgba(99,102,241,0.8)', 'rgba(16,185,129,0.8)', 'rgba(245,158,11,0.8)', 'rgba(239,68,68,0.8)'],
      borderColor: ['rgb(99,102,241)', 'rgb(16,185,129)', 'rgb(245,158,11)', 'rgb(239,68,68)'],
      borderWidth: 2
    }]
  };
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'right' },
    },
  };
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900">Staff by Department</h3>
        <FiPieChart className="h-5 w-5 text-indigo-600" />
      </div>
      <div className="h-64 relative">
        <Doughnut data={data} options={options} />
      </div>
    </div>
  );
};

const AttendanceOverviewChart = ({ attendance }) => {
  const today = new Date().toISOString().split('T')[0];
  const todayAtt = attendance.filter(a => normalizeDate(a.date) === today);

  const present = new Set(
    todayAtt.filter(a => a.status === 'present').map(a => a.staff_id)
  ).size;

  const leave = todayAtt.filter(a => a.status.includes('leave')).length;
  const absent = todayAtt.filter(a => a.status === 'absent').length;

  const data = {
    labels: ['Present', 'On Leave', 'Absent'],
    datasets: [{
      label: 'Today\'s Attendance',
      data: [present, leave, absent],
      backgroundColor: ['rgba(16,185,129,0.8)', 'rgba(245,158,11,0.8)', 'rgba(239,68,68,0.8)'],
      borderColor: ['rgb(16,185,129)', 'rgb(245,158,11)', 'rgb(239,68,68)'],
      borderWidth: 2
    }]
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900">Today's Attendance</h3>
        <FiBarChart2 className="h-5 w-5 text-indigo-600" />
      </div>
      <div className="h-64">
        <Bar
          data={data}
          options={{
            responsive: true,
            plugins: {
              legend: { position: 'top' },
              title: { display: true, text: "Today's Attendance" }
            }
          }}
        />
      </div>
    </div>
  );
};

const StaffMonthlyStats = ({ staff, attendance, selectedMonth }) => {
  const formatTimeDisplay = (t) => t ? t.split(':').slice(0, 2).join(':') : '';
  const stats = useMemo(() => {
    const att = attendance.filter(a => a.staff_id === staff.id && normalizeDate(a.date).startsWith(selectedMonth));
    const present = att.filter(a => a.status === 'present');
    if (!present.length) return { totalWorkingHours: 0, avgWorkingHours: 0, avgPunchIn: 'N/A', avgPunchOut: 'N/A', totalPresentDays: 0, lateCount: 0, totalLateHours: 0, totalExtraHours: 0, avgLateTime: '00:00', avgExtraTime: '00:00', daysWithSchedule: 0 };
    const totalH = present.reduce((s, d) => s + (Number(d.hours) || 0), 0);
    const avgH = totalH / present.length;
    const inMins = present.filter(d => d.punch_in).map(d => timeToMinutes(d.punch_in));
    const outMins = present.filter(d => d.punch_out).map(d => timeToMinutes(d.punch_out));
    const avgIn = inMins.length ? minutesToTime(inMins.reduce((s, m) => s + m, 0) / inMins.length) : 'N/A';
    const avgOut = outMins.length ? minutesToTime(outMins.reduce((s, m) => s + m, 0) / outMins.length) : 'N/A';
    let lateM = 0, extraM = 0, lateDays = 0, schedDays = 0;
    present.forEach(d => {
      const dev = calculateScheduleDeviations(d, staff);
      if (dev.hasSchedule) {
        lateM += dev.lateMinutes; extraM += dev.extraMinutes; schedDays++;
        if (dev.lateMinutes > 0) lateDays++;
      }
    });
    return {
      totalWorkingHours: Number(totalH.toFixed(2)),
      avgWorkingHours: Number(avgH.toFixed(2)),
      avgPunchIn: avgIn,
      avgPunchOut: avgOut,
      totalPresentDays: present.length,
      lateCount: lateDays,
      totalLateHours: Number((lateM / 60).toFixed(2)),
      totalExtraHours: Number((extraM / 60).toFixed(2)),
      avgLateTime: lateDays ? minutesToTime(lateM / lateDays) : '00:00',
      avgExtraTime: schedDays ? minutesToTime(extraM / schedDays) : '00:00',
      daysWithSchedule: schedDays
    };
  }, [staff, attendance, selectedMonth]);

  const curSch = staff.schedules?.length ? staff.schedules.sort((a, b) => new Date(b.effective_from) - new Date(a.effective_from))[0] : null;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow">
      <div className="flex items-center space-x-3 mb-4">
        {staff.photo ? <img src={staff.photo} alt={staff.name} className="w-10 h-10 rounded-full object-cover border border-gray-200" /> :
          <div className="w-10 h-10 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full flex items-center justify-center"><span className="text-white font-medium text-sm">{staff.name.split(' ').map(n => n[0]).join('')}</span></div>}
        <div>
          <p className="font-medium text-gray-900">{staff.name}</p>
          <p className="text-sm text-gray-500">{staff.position}</p>
          {curSch && <p className="text-xs text-gray-400">Current: {formatTimeDisplay(curSch.start_time)} - {formatTimeDisplay(curSch.end_time)}</p>}
        </div>
        <div className="ml-auto">
          <p className="text-xs text-gray-400">{stats.daysWithSchedule}/{stats.totalPresentDays} days with schedule</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="text-center p-2 bg-blue-50 rounded-lg"><p className="text-xs text-gray-600">Total Hours</p><p className="font-bold text-blue-700">{stats.totalWorkingHours}h</p></div>
        <div className="text-center p-2 bg-green-50 rounded-lg"><p className="text-xs text-gray-600">Avg Hours/Day</p><p className="font-bold text-green-700">{stats.avgWorkingHours}h</p></div>
        <div className="text-center p-2 bg-amber-50 rounded-lg"><p className="text-xs text-gray-600">Late Hours</p><p className="font-bold text-amber-700">{stats.totalLateHours}h</p></div>
        <div className="text-center p-2 bg-purple-50 rounded-lg"><p className="text-xs text-gray-600">Extra Hours</p><p className="font-bold text-purple-700">{stats.totalExtraHours}h</p></div>
      </div>
      <div className="flex justify-between items-center mt-3 pt-3 border-t border-gray-100">
        <span className="text-xs text-gray-500">{stats.totalPresentDays} days ({stats.daysWithSchedule} with schedule)</span>
        {stats.lateCount > 0 && <span className="px-2 py-1 bg-amber-100 text-amber-800 rounded-full text-xs">{stats.lateCount} late</span>}
      </div>
    </div>
  );
};

const MonthlyStats = ({ attendance, selectedMonth, staffList }) => {
  const stats = useMemo(() => {
    const monthAtt = attendance.filter(a => normalizeDate(a.date).startsWith(selectedMonth));
    const present = monthAtt.filter(a => a.status === 'present');
    if (!present.length) return { totalWorkingHours: 0, avgWorkingHours: 0, avgPunchIn: 'N/A', avgPunchOut: 'N/A', totalPresentDays: 0, totalLateHours: 0, totalExtraHours: 0, totalLateDays: 0, daysWithSchedule: 0 };
    const totalH = present.reduce((s, d) => s + (Number(d.hours) || 0), 0);
    const avgH = totalH / present.length;
    const inMins = present.filter(d => d.punch_in).map(d => timeToMinutes(d.punch_in));
    const outMins = present.filter(d => d.punch_out).map(d => timeToMinutes(d.punch_out));
    const avgIn = inMins.length ? minutesToTime(inMins.reduce((s, m) => s + m, 0) / inMins.length) : 'N/A';
    const avgOut = outMins.length ? minutesToTime(outMins.reduce((s, m) => s + m, 0) / outMins.length) : 'N/A';
    let lateM = 0, extraM = 0, lateDays = 0, schedDays = 0;
    present.forEach(d => {
      const staff = staffList.find(s => s.id === d.staff_id);
      if (staff) {
        const dev = calculateScheduleDeviations(d, staff);
        if (dev.hasSchedule) { lateM += dev.lateMinutes; extraM += dev.extraMinutes; schedDays++; if (dev.lateMinutes > 0) lateDays++; }
      }
    });
    return {
      totalWorkingHours: Number(totalH.toFixed(2)),
      avgWorkingHours: Number(avgH.toFixed(2)),
      avgPunchIn: avgIn,
      avgPunchOut: avgOut,
      totalPresentDays: present.length,
      totalLateHours: Number((lateM / 60).toFixed(2)),
      totalExtraHours: Number((extraM / 60).toFixed(2)),
      totalLateDays: lateDays,
      daysWithSchedule: schedDays
    };
  }, [attendance, selectedMonth, staffList]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <div className="bg-white rounded-lg border border-gray-200 p-4"><div className="flex items-center justify-between"><div><p className="text-sm font-medium text-gray-600">Total Working Hours</p><p className="text-2xl font-bold text-gray-900">{stats.totalWorkingHours}h</p></div><FiClock className="h-8 w-8 text-blue-500" /></div></div>
      <div className="bg-white rounded-lg border border-gray-200 p-4"><div className="flex items-center justify-between"><div><p className="text-sm font-medium text-gray-600">Avg. Working Hours/Day</p><p className="text-2xl font-bold text-gray-900">{stats.avgWorkingHours}h</p></div><FiTrendingUp className="h-8 w-8 text-green-500" /></div></div>
      <div className="bg-white rounded-lg border border-gray-200 p-4"><div className="flex items-center justify-between"><div><p className="text-sm font-medium text-gray-600">Total Late Hours</p><p className="text-2xl font-bold text-gray-900">{stats.totalLateHours}h</p><p className="text-xs text-gray-500">{stats.totalLateDays} late days</p></div><FiUserX className="h-8 w-8 text-amber-500" /></div></div>
      <div className="bg-white rounded-lg border border-gray-200 p-4"><div className="flex items-center justify-between"><div><p className="text-sm font-medium text-gray-600">Total Extra Hours</p><p className="text-2xl font-bold text-gray-900">{stats.totalExtraHours}h</p><p className="text-xs text-gray-500">Overtime</p></div><FiTrendingUp className="h-8 w-8 text-purple-500" /></div></div>
    </div>
  );
};

const AttendanceRow = ({ record, staffList, onEdit }) => {
  const staff = staffList.find(s => s.id === record.staff_id);
  const dev = calculateScheduleDeviations(record, staff);
  const fmt = (t) => t ? t.split(':').slice(0, 2).join(':') : '';
  return (
    <tr className="border-b border-gray-200 hover:bg-gray-50 transition-colors">
      <td className="py-4 px-4">
        <p className="text-sm font-medium text-gray-900">{record.staff_name}</p>
        <p className="text-xs text-gray-500">{record.staff_id}</p>
        {dev.schedule && <p className="text-xs text-gray-400 cursor-help" title={`Effective from: ${new Date(dev.schedule.effective_from).toLocaleDateString()}`}>Schedule: {fmt(dev.schedule.start_time)} - {fmt(dev.schedule.end_time)}</p>}
      </td>
      <td className="py-4 px-4"><p className="text-sm text-gray-900">{new Date(record.date).toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short' })}</p></td>
      <td className="py-4 px-4">
        <div className="flex items-center space-x-2">
          {record.punch_in ? (<><FiLogIn className="h-4 w-4 text-emerald-500" /><span className="text-sm text-gray-900">{record.punch_in}</span>{dev.lateMinutes > 0 && <span className="px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded text-xs" title={`Late by ${dev.lateTime}`}>+{dev.lateTime}</span>}</>) : <span className="text-sm text-gray-400">-</span>}
        </div>
      </td>
      <td className="py-4 px-4">
        <div className="flex items-center space-x-2">
          {record.punch_out ? (<><FiLogOut className="h-4 w-4 text-red-500" /><span className="text-sm text-gray-900">{record.punch_out}</span>{dev.extraMinutes > 0 && <span className="px-1.5 py-0.5 bg-purple-100 text-purple-800 rounded text-xs" title={`Extra ${dev.extraTime}`}>+{dev.extraTime}</span>}</>) : <span className="text-sm text-gray-400">-</span>}
        </div>
      </td>
      <td className="py-4 px-4"><p className="text-sm text-gray-900">{record.breaks || '-'}</p></td>
      <td className="py-4 px-4">
        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${record.status === 'present' ? 'bg-emerald-50 text-emerald-700' : record.status === 'sick_leave' ? 'bg-amber-50 text-amber-700' : record.status === 'absent' ? 'bg-red-50 text-red-700' : 'bg-gray-50 text-gray-700'}`}>
          {record.status === 'present' ? 'Present' : record.status === 'sick_leave' ? 'Sick Leave' : record.status === 'absent' ? 'Absent' : 'Weekend'}
        </span>
      </td>
      <td className="py-4 px-4"><p className="text-sm font-medium text-gray-900">{Number(record.hours) > 0 ? `${Number(record.hours).toFixed(2)}h` : '-'}</p></td>
      <td className="py-4 px-4">
        <div className="flex flex-col space-y-1">
          {dev.lateHours > 0 && <span className="text-xs text-amber-600 font-medium" title={`Late ${dev.lateHours}h`}>Late: {dev.lateHours}h</span>}
          {dev.extraHours > 0 && <span className="text-xs text-purple-600 font-medium" title={`Extra ${dev.extraHours}h`}>Extra: {dev.extraHours}h</span>}
          {!dev.hasSchedule && <span className="text-xs text-gray-400">No schedule</span>}
        </div>
      </td>
      <td className="py-4 px-4"><button onClick={() => onEdit(record)} className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg"><FiEdit className="h-4 w-4" /></button></td>
    </tr>
  );
};

// MODIFIED LeaveApplicationRow to show status and action buttons only for 'pending'
const LeaveApplicationRow = ({ application, handleLeaveAction }) => (
  <tr className="border-b border-gray-200 hover:bg-gray-50 transition-colors">
    <td className="py-4 px-4"><p className="text-sm font-medium text-gray-900">{application.staff_name}</p><p className="text-xs text-gray-500">{application.department}</p></td>
    <td className="py-4 px-4"><p className="text-sm text-gray-900">{application.type}</p></td>
    <td className="py-4 px-4"><p className="text-sm text-gray-900">{new Date(application.from_date).toLocaleDateString('en-IN')}</p></td>
    <td className="py-4 px-4"><p className="text-sm text-gray-900">{new Date(application.to_date).toLocaleDateString('en-IN')}</p></td>
    <td className="py-4 px-4"><p className="text-sm text-gray-900">{application.reason}</p></td>
    <td className="py-4 px-4">
      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
        application.status === 'approved' ? 'bg-emerald-50 text-emerald-700'
          : application.status === 'rejected' ? 'bg-red-50 text-red-700'
          : 'bg-amber-50 text-amber-700'
      }`}>
        {application.status.charAt(0).toUpperCase() + application.status.slice(1)}
      </span>
    </td>
    <td className="py-4 px-4"><p className="text-sm text-gray-600">{new Date(application.applied_date).toLocaleDateString('en-IN')}</p></td>
    <td className="py-4 px-4">
      {application.status === 'pending' ? (
        <div className="flex items-center space-x-2">
          <button onClick={() => handleLeaveAction(application.id, 'approved')} className="px-3 py-1 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm"><FiCheck className="h-4 w-4" /></button>
          <button onClick={() => handleLeaveAction(application.id, 'rejected')} className="px-3 py-1 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm"><FiX className="h-4 w-4" /></button>
        </div>
      ) : (
        <span className="text-sm text-gray-400">-</span>
      )}
    </td>
  </tr>
);

const SalaryRow = ({ salary, onSendToStaff, handleEditSalary }) => (
  <tr className="border-b border-gray-200 hover:bg-gray-50 transition-colors">
    <td className="py-4 px-4"><p className="text-sm font-medium text-gray-900">{salary.staff_name}</p></td>
    <td className="py-4 px-4"><p className="text-sm font-medium text-gray-900">{salary.month}</p></td>
    <td className="py-4 px-4"><p className="text-sm text-gray-900">₹{Number(salary.basic).toLocaleString()}</p></td>
    <td className="py-4 px-4"><p className="text-sm text-gray-900">₹{Number(salary.hra).toLocaleString()}</p></td>
    <td className="py-4 px-4"><p className="text-sm text-gray-900">₹{Number(salary.ta).toLocaleString()}</p></td>
    <td className="py-4 px-4"><p className="text-sm text-gray-900">₹{Number(salary.other_allowances).toLocaleString()}</p></td>
    <td className="py-4 px-4"><p className="text-sm text-red-600">-₹{Number(salary.deductions).toLocaleString()}</p></td>
    <td className="py-4 px-4"><p className="text-sm text-gray-900">{salary.present_days}/{salary.working_days}</p></td>
    <td className="py-4 px-4"><p className="text-sm text-gray-900">{Number(salary.total_hours).toFixed(2)}h</p></td>
    <td className="py-4 px-4"><p className="text-sm font-bold text-emerald-600">₹{Number(salary.net_salary).toLocaleString()}</p></td>
    <td className="py-4 px-4">
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${salary.status === 'sent' ? 'bg-emerald-100 text-emerald-700' : salary.status === 'viewed' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
        {salary.status === 'sent' ? 'Sent' : salary.status === 'viewed' ? 'Viewed' : 'Pending'}
      </span>
    </td>
    <td className="py-4 px-4">
      <div className="flex items-center space-x-2">
        <button onClick={() => handleEditSalary(salary)} className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg"><FiEdit className="h-4 w-4" /></button>
        <button onClick={() => onSendToStaff(salary)} disabled={salary.status === 'sent'} className={`p-2 rounded-lg ${salary.status === 'sent' ? 'text-gray-400 cursor-not-allowed' : 'text-green-600 hover:bg-green-50'}`}><FiSend className="h-4 w-4" /></button>
      </div>
    </td>
  </tr>
);

// ---------------------------------------------------------------------
// MAIN COMPONENT
// ---------------------------------------------------------------------
const AdminAttendance = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [staffList, setStaffList] = useState([]);
  const [allAttendance, setAllAttendance] = useState([]);
  const [pendingLeaves, setPendingLeaves] = useState([]);
  const [allLeaves, setAllLeaves] = useState([]); // Added state for all leaves
  const [salaryData, setSalaryData] = useState([]);
  const [calendarData, setCalendarData] = useState([]);
  const [showAttendanceEditModal, setShowAttendanceEditModal] = useState(false);
  const [showLeaveActionModal, setShowLeaveActionModal] = useState(false);
  const [showSalaryEditModal, setShowSalaryEditModal] = useState(false);
  const [showCreateSalaryModal, setShowCreateSalaryModal] = useState(false);
  const [showCalendarModal, setShowCalendarModal] = useState(false);
  const [selectedAttendance, setSelectedAttendance] = useState(null);
  const [selectedLeave, setSelectedLeave] = useState(null);
  const [selectedSalary, setSelectedSalary] = useState(null);
  const [wallets, setWallets] = useState([]);          
  const [selectedWalletId, setSelectedWalletId] = useState(""); 
  const [walletLoading, setWalletLoading] = useState(false);
  
  // Dynamic month states
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth());
  const [selectedSalaryMonth, setSelectedSalaryMonth] = useState(getCurrentMonth());
  const [selectedLeaveMonth, setSelectedLeaveMonth] = useState(getCurrentMonth()); // Added month state for leaves
  
  // Generate month options
  const monthOptions = useMemo(() => generateMonthOptions(), []);
  
  const [attendanceEdit, setAttendanceEdit] = useState({ punch_in: '', punch_out: '', breaks: '', status: 'present' });
  const [salaryEdit, setSalaryEdit] = useState({ 
    staff_id: '', 
    month: getCurrentMonth(), 
    basic: '', 
    hra: '', 
    ta: '', 
    other_allowances: '', 
    deductions: '', 
    working_days: '', 
    present_days: '', 
    additional_components: [] 
  });
  const [newComponent, setNewComponent] = useState({ name: '', amount: '', operation: 'addition', base: 'basic' });
  const [calendarEdit, setCalendarEdit] = useState({ date: '', type: 'working', description: '' });

  // Helper functions for salary operations
  const getOperationColor = (operation) => {
    const colors = {
      addition: 'bg-emerald-100 text-emerald-700',
      subtraction: 'bg-rose-100 text-rose-700',
      multiplication: 'bg-blue-100 text-blue-700',
      division: 'bg-purple-100 text-purple-700',
      percentage: 'bg-amber-100 text-amber-700'
    };
    return colors[operation] || 'bg-gray-100 text-gray-700';
  };

  const getOperationIcon = (operation) => {
    const icons = {
      addition: <FiAdd className="h-3 w-3" />,
      subtraction: <FiMinus className="h-3 w-3" />,
      multiplication: <FiMultiply className="h-3 w-3" />,
      division: <FiDivide className="h-3 w-3" />,
      percentage: <FiPercent className="h-3 w-3" />
    };
    return icons[operation] || <FiPlus className="h-3 w-3" />;
  };

  const handleAddComponent = () => {
    if (!newComponent.name || !newComponent.amount) return;
    setSalaryEdit(prev => ({
      ...prev,
      additional_components: [...prev.additional_components, { ...newComponent }]
    }));
    setNewComponent({ name: '', amount: '', operation: 'addition', base: 'basic' });
  };

  const handleRemoveComponent = (index) => {
    setSalaryEdit(prev => ({
      ...prev,
      additional_components: prev.additional_components.filter((_, i) => i !== index)
    }));
  };

  const [autoCalc, setAutoCalc] = useState({
    working_days: 0,
    present_days: 0,
    total_hours: 0,
  });

  const debitSalaryFromWallet = async (walletId, amount, staffName, month) => {
  try {
    await axios.post(
      `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/wallet/debit-salary`,
      { wallet_id: walletId, amount, staff_name: staffName, month },
      { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
    );
  } catch (err) {
    console.error('Wallet debit failed:', err);
    throw err; // let the caller show toast
  }
};

  // ------------------- STATS -------------------
  const stats = useMemo(() => {
    const total = staffList.length;
    const active = staffList.filter(s => s.status === 'Active').length;
    const today = new Date().toISOString().split('T')[0];
    const todayAtt = allAttendance.filter(a => normalizeDate(a.date) === today);

    const presentStaffIds = new Set(
      todayAtt.filter(a => a.status === 'present').map(a => a.staff_id)
      );
  const present = presentStaffIds.size;

    const leave = todayAtt.filter(a => a.status.includes('leave')).length;
    const absent = todayAtt.filter(a => a.status === 'absent').length;
    const totalSal = staffList.reduce((s, st) => s + (Number(st.salary) || 0), 0);
      let lateH = 0, extraH = 0, recWithSch = 0;
      todayAtt.forEach(r => {
      if (r.status === 'present') {
        const st = staffList.find(s => s.id === r.staff_id);
        if (st) {
          const dev = calculateScheduleDeviations(r, st);
          if (dev.hasSchedule) { lateH += dev.lateHours; extraH += dev.extraHours; recWithSch++; }
        }
      }
    });
    return {
      totalStaff: total, activeStaff: active, presentToday: present, onLeaveToday: leave,
      totalSalary: Math.round(totalSal), attendanceRate: total ? Math.round((present / total) * 100) : 0,
      todayLateHours: Number(lateH.toFixed(2)), todayExtraHours: Number(extraH.toFixed(2)),
      todayRecordsWithSchedule: recWithSch
    };
  }, [staffList, allAttendance]);

  // ------------------- FETCH DATA -------------------
  useEffect(() => {
    const load = async () => {
      try {
        const staffRaw = await getStaffList();
        const staff = await Promise.all(staffRaw.map(async s => ({
          ...s,
          schedules: await getStaffSchedules(s.id).catch(() => [])
        })));
        setStaffList(staff);
        const att = await getAllAttendance(selectedMonth);
        setAllAttendance(att);
        const leaves = await getPendingLeaves();
        setPendingLeaves(leaves);
        const allL = await getLeaves(selectedLeaveMonth); // Fetch all leaves for the current leave month
        setAllLeaves(allL); //
        const sal = await getSalaryData(selectedSalaryMonth);
        setSalaryData(sal);
        const cal = await getCalendarData();
        setCalendarData(cal);
      } catch { toast.error('Failed to load data'); }
    };
    load();
  }, []);

  useEffect(() => { 
    if (selectedMonth) {
      getAllAttendance(selectedMonth)
        .then(setAllAttendance)
        .catch(() => toast.error('Failed to load attendance'));
    }
  }, [selectedMonth]);
  
  useEffect(() => { 
    if (selectedSalaryMonth) {
      getSalaryData(selectedSalaryMonth)
        .then(setSalaryData)
        .catch(() => toast.error('Failed to load salary data'));
    }
  }, [selectedSalaryMonth]);
  
  // New effect to load all leaves when the month changes
  useEffect(() => {
    if (selectedLeaveMonth) {
      getLeaves(selectedLeaveMonth)
        .then(setAllLeaves)
        .catch(() => toast.error('Failed to load leave history'));
    }
  }, [selectedLeaveMonth]);
  // End of new effect

  useEffect(() => {
    if (salaryEdit.staff_id && salaryEdit.month) {
      getAutoCalc(salaryEdit.staff_id, salaryEdit.month)
        .then(data => {
          setAutoCalc(data);
          setSalaryEdit(prev => ({
            ...prev,
            working_days: data.working_days.toString(),
            present_days: data.present_days.toString(),
            total_hours: data.total_hours,
          }));
        })
        .catch(() => toast.error('Failed to load auto-calc'));
    }
  }, [salaryEdit.staff_id, salaryEdit.month]);

  // Update salaryEdit month when salary month changes
  useEffect(() => {
    setSalaryEdit(prev => ({
      ...prev,
      month: selectedSalaryMonth
    }));
  }, [selectedSalaryMonth]);

  useEffect(() => {
    const loadWallets = async () => {
      try {
        setWalletLoading(true);
        const data = await getWalletsForCentre();
        setWallets(data);
        // optionally pre-select the first wallet
        if (data.length > 0 && !selectedWalletId) {
          setSelectedWalletId(data[0].id);
        }
      } catch (err) {
        toast.error("Failed to load wallets");
        console.error(err);
      } finally {
        setWalletLoading(false);
      }
    };

    loadWallets();
  }, []); 

  // ------------------- ATTENDANCE -------------------
  const handleEditAttendance = (rec) => {
    setSelectedAttendance(rec);
    setAttendanceEdit({ punch_in: rec.punch_in || '', punch_out: rec.punch_out || '', breaks: rec.breaks || '', status: rec.status || 'present' });
    setShowAttendanceEditModal(true);
  };
  const calculateHours = (inT, outT) => {
    if (!inT || !outT) return 0;
    const [ih, im] = inT.split(':').map(Number);
    const [oh, om] = outT.split(':').map(Number);
    let h = oh - ih, m = om - im;
    if (m < 0) { h--; m += 60; }
    return Number(h + m / 60).toFixed(2);
  };
  const handleSaveAttendance = async () => {
    const data = { ...attendanceEdit, hours: calculateHours(attendanceEdit.punch_in, attendanceEdit.punch_out) };
    try {
      const upd = await updateAttendance(selectedAttendance.id, data);
      setAllAttendance(p => p.map(i => i.id === selectedAttendance.id ? upd : i));
      setShowAttendanceEditModal(false); setSelectedAttendance(null);
      toast.success('Attendance updated');
    } catch { toast.error('Failed'); }
  };

  // ------------------- CALENDAR -------------------
  const handleUpdateCalendarEvent = async (id, ev) => {
    try { const upd = await updateCalendarEvent(id, ev); setCalendarData(p => p.map(e => e.id === id ? upd : e)); }
    catch { throw new Error(); }
  };
  const handleDeleteCalendarEvent = async (ev) => {
    if (window.confirm('Delete?')) {
      try { await deleteCalendarEvent(ev.id); setCalendarData(p => p.filter(e => e.id !== ev.id)); toast.success('Deleted'); }
      catch { toast.error('Failed'); }
    }
  };

  // ------------------- LEAVE -------------------
  const handleLeaveAction = async (id, act) => {
    try { 
      const upd = await updateLeave(id, act); 
      setPendingLeaves(p => p.filter(l => l.id !== id)); 
      // Update allLeaves state on action
      setAllLeaves(p => p.map(l => l.id === id ? upd : l)); 
      setShowLeaveActionModal(false); 
      setSelectedLeave(null); 
      toast.success(`Leave ${act}`); 
    }
    catch { toast.error(`Failed`); }
  };

  // ------------------- SALARY -------------------
  const handleEditSalary = (s) => {
    setSelectedSalary(s);
    setSalaryEdit({ ...s, additional_components: s.additional_components || [] });
    setShowSalaryEditModal(true);
  };
  const calculateWithOperations = (base, comps) => {
    let res = Number(base) || 0;
    comps.forEach(c => {
      const amt = Number(c.amount) || 0;
      switch (c.operation) {
        case 'addition': res += amt; break;
        case 'subtraction': res -= amt; break;
        case 'multiplication': res = (c.base === 'basic' ? Number(salaryEdit.basic) : res) * amt; break;
        case 'division': res = amt !== 0 ? (c.base === 'basic' ? Number(salaryEdit.basic) : res) / amt : res; break;
        case 'percentage': res += ((c.base === 'basic' ? Number(salaryEdit.basic) : res) * amt) / 100; break;
      }
    });
    return Number(res.toFixed(2));
  };
  const handleSaveSalary = async () => {
  const base = Number(salaryEdit.basic) + Number(salaryEdit.hra) + Number(salaryEdit.ta) + Number(salaryEdit.other_allowances);
  const net = calculateWithOperations(base, salaryEdit.additional_components) - Number(salaryEdit.deductions);

  const upd = {
    ...salaryEdit,
    net_salary: Number(net.toFixed(2)),
    total_hours: autoCalc.total_hours,
    working_days: autoCalc.working_days,
    present_days: autoCalc.present_days,
  };

  try {
    const saved = await updateSalary(selectedSalary.id, upd);
    setSalaryData(p => p.map(i => i.id === selectedSalary.id ? saved : i));
    setShowSalaryEditModal(false); setSelectedSalary(null);
    toast.success('Salary updated');
  } catch {
    toast.error('Failed');
  }
};
  const handleCreateSalary = async () => {
  // Validation
  if (!salaryEdit.staff_id) return toast.error("Please select a staff member");
  if (!salaryEdit.month) return toast.error("Month is required");
  if (!salaryEdit.basic || salaryEdit.basic <= 0) return toast.error("Basic salary is required");
  if (!selectedWalletId) return toast.error("Please select a wallet to debit from");

  const base = Number(salaryEdit.basic) + Number(salaryEdit.hra || 0) + Number(salaryEdit.ta || 0) + Number(salaryEdit.other_allowances || 0);
  const netAfterComponents = calculateWithOperations(base, salaryEdit.additional_components || []);
  const netSalary = netAfterComponents - Number(salaryEdit.deductions || 0);

  const payload = {
    staff_id: Number(salaryEdit.staff_id),
    month: salaryEdit.month,
    basic: Number(salaryEdit.basic),
    hra: Number(salaryEdit.hra || 0),
    ta: Number(salaryEdit.ta || 0),
    other_allowances: Number(salaryEdit.other_allowances || 0),
    deductions: Number(salaryEdit.deductions || 0),
    net_salary: Number(netSalary.toFixed(2)),
    working_days: Number(autoCalc.working_days),
    present_days: Number(autoCalc.present_days),
    total_hours: Number(autoCalc.total_hours),
  };

  try {
    // Step 1: Create salary
    const createdSalary = await createSalary(payload);
    setSalaryData(prev => [...prev, createdSalary]);

    // Step 2: Try to debit wallet (but don't crash if it fails)
    try {
      await axios.post(
        `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/wallet/debit-salary`,
        {
          wallet_id: selectedWalletId,
          amount: netSalary,
          salary_id: createdSalary.id,
          month: salaryEdit.month
        },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`
          }
        }
      );

      // Success: Both salary created AND wallet debited
      toast.success(`Salary created and ₹${netSalary.toLocaleString()} debited successfully!`);

    } catch (walletError) {
      console.error("Wallet debit failed:", walletError);
      // Salary created, but wallet failed → warn user
      toast.warn(
        `Salary created successfully, but wallet debit failed: ${walletError.response?.data?.error || walletError.message}`
      );
    }

    // Always close modal on success
    setShowCreateSalaryModal(false);
    setSelectedWalletId("");
    setSalaryEdit({
      staff_id: '',
      month: getCurrentMonth(),
      basic: '',
      hra: '',
      ta: '',
      other_allowances: '',
      deductions: '',
      working_days: '',
      present_days: '',
      additional_components: []
    });

  } catch (err) {
    console.error("Salary creation failed:", err);
    toast.error(
      err.response?.data?.error || 
      "Failed to create salary. Please try again."
    );
  }
};
  const handleSendToStaff = async (s) => {
    try { const upd = await sendSalary(s.id); setSalaryData(p => p.map(i => i.id === s.id ? upd : i)); toast.success('Sent'); }
    catch { toast.error('Failed'); }
  };
  const handleSendSalary = async () => {
    const pending = salaryData.filter(s => s.month === selectedSalaryMonth && s.status === 'pending');
    if (!pending.length) return toast.warn('No pending');
    const ct = toast.info(
      <div><p>Send {pending.length}?</p><div className="mt-2 flex justify-end gap-2">
        <button onClick={async () => { toast.dismiss(ct); try { const list = await bulkSendSalaries(selectedSalaryMonth); setSalaryData(list); toast.success('Sent'); } catch { toast.error('Failed'); } }} className="px-3 py-1 bg-green-500 text-white rounded">Yes</button>
        <button onClick={() => toast.dismiss(ct)} className="px-3 py-1 bg-gray-400 text-white rounded">Cancel</button>
      </div></div>,
      { autoClose: false, closeOnClick: false }
    );
  };
  const handleAddCalendarEvent = async () => {
    if (!calendarEdit.date || !calendarEdit.type) return toast.error('Required');
    try { const ev = await addCalendarEvent(calendarEdit); setCalendarData(p => [...p, ev]); setShowCalendarModal(false); setCalendarEdit({ date: '', type: 'working', description: '' }); toast.success('Added'); }
    catch { toast.error('Failed'); }
  };
  const handleEditCalendarEvent = (ev) => {
    setCalendarEdit({ date: ev.date, type: ev.type, description: ev.description || '' });
    setShowCalendarModal(true);
  };

  // ------------------- RENDER -------------------
  return (
    <ErrorBoundary>
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 bg-indigo-500 rounded-xl flex items-center justify-center"><FiUsers className="h-5 w-5 text-white" /></div>
              <div><h1 className="text-xl font-bold text-gray-900">Salary and Attendance Management</h1><p className="text-gray-600">Managing attendance and salary calculations for your center</p></div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Tabs */}
        <div className="bg-white rounded-xl border border-gray-200 p-2 mb-8">
          <nav className="flex space-x-1">
            {[
              { id: 'dashboard', label: 'Dashboard', icon: FiHome },
              { id: 'attendance', label: 'Attendance', icon: FiClock },
              { id: 'leave', label: 'Leave Management', icon: FiCalendar },
              { id: 'salary', label: 'Salary Management', icon: FiDollarSign },
              { id: 'calendar', label: 'Working Days', icon: FiCalendar },
            ].map(t => {
              const Icon = t.icon;
              return (
                <button key={t.id} onClick={() => setActiveTab(t.id)} className={`flex items-center space-x-2 px-4 py-3 rounded-lg font-medium transition-colors ${activeTab === t.id ? 'bg-indigo-50 text-indigo-600' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'}`}>
                  <Icon className="h-4 w-4" /><span>{t.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Dashboard */}
        {activeTab === 'dashboard' && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <StatCard title="Total Staff" value={stats.totalStaff} subtitle={`${stats.activeStaff} active`} icon={FiUsers} color="bg-indigo-500" />
              <StatCard title="Present Today" value={stats.presentToday} subtitle={`${stats.attendanceRate}% attendance`} icon={FiUserCheck} color="bg-emerald-500" />
              <StatCard title="Late Hours Today" value={stats.todayLateHours} subtitle="Total late time" icon={FiUserX} color="bg-amber-500" />
              <StatCard title="Extra Hours Today" value={stats.todayExtraHours} subtitle="Total overtime" icon={FiTrendingUp} color="bg-purple-500" />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              <DepartmentDistributionChart staff={staffList} />
              <AttendanceOverviewChart attendance={allAttendance} />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h3 className="font-semibold text-gray-900 mb-4 flex items-center space-x-2"><FiPlus className="h-5 w-5 text-indigo-600" /><span>Quick Actions</span></h3>
                <div className="space-y-3">
                  <button className="w-full flex items-center space-x-2 px-4 py-3 border border-gray-200 rounded-lg hover:bg-gray-50"><FiDownload className="h-4 w-4 text-gray-600" /><span className="text-sm font-medium">Export Reports</span></button>
                  <button className="w-full flex items-center space-x-2 px-4 py-3 border border-gray-200 rounded-lg hover:bg-gray-50"><FiSettings className="h-4 w-4 text-gray-600" /><span className="text-sm font-medium">System Settings</span></button>
                </div>
              </div>
              <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-900 flex items-center space-x-2"><FiAlertCircle className="h-5 w-5 text-amber-600" /><span>Pending Leave Applications</span></h3>
                  <span className="px-2.5 py-1 bg-amber-100 text-amber-800 rounded-full text-xs font-medium">{pendingLeaves.length} pending</span>
                </div>
                <div className="space-y-3">
                  {pendingLeaves.slice(0, 3).map(l => (
                    <div key={l.id} className="flex items-center justify-between py-3 border-b border-gray-100">
                      <div><p className="text-sm font-medium text-gray-900">{l.staff_name}</p><p className="text-xs text-gray-500">{l.type} • {new Date(l.from_date).toLocaleDateString('en-IN')} - {new Date(l.to_date).toLocaleDateString('en-IN')}</p></div>
                      <button onClick={() => { setSelectedLeave(l); setShowLeaveActionModal(true); }} className="px-3 py-1 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm">Review</button>
                    </div>
                  ))}
                  {pendingLeaves.length === 0 && <p className="text-sm text-gray-500 text-center py-4">No pending leave applications</p>}
                </div>
              </div>
            </div>
          </>
        )}

        {/* Attendance Tab - GROUPED + COLLAPSIBLE */}
      {activeTab === 'attendance' && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {/* Header */}
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">Attendance Management</h2>
                <div className="flex items-center space-x-3">
                  <select 
                    className="border border-gray-300 rounded-lg px-3 py-2" 
                    value={selectedMonth} 
                    onChange={e => setSelectedMonth(e.target.value)}
                  >
                    {monthOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <button className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
                    <FiDownload className="h-4 w-4" /><span>Export</span>
                  </button>
                </div>
              </div>
              <div className="mt-4">
                <p className="text-sm text-gray-600">
                  Viewing attendance for: <span className="font-semibold">{formatMonthForDisplay(selectedMonth)}</span>
                </p>
              </div>
            </div>

            {/* Monthly Stats */}
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Monthly Statistics for {formatMonthForDisplay(selectedMonth)}
              </h3>
              <MonthlyStats attendance={allAttendance} selectedMonth={selectedMonth} staffList={staffList} />
            </div>

            {/* Individual Stats */}
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Individual Staff Statistics</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {staffList.map(s => <StaffMonthlyStats key={s.id} staff={s} attendance={allAttendance} selectedMonth={selectedMonth} />)}
              </div>
            </div>

            {/* GROUPED TABLE */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase">Staff</th>
                    <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase">Punch In</th>
                    <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase">Punch Out</th>
                    <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase">Breaks</th>
                    <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase">Hours</th>
                    <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase">Schedule Deviations</th>
                    <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {groupAttendance(allAttendance, staffList).map(g => (
                    <CollapsibleAttendanceRow key={`${g.staff_id}-${g.date}`} group={g} staffList={staffList} onEdit={handleEditAttendance} />
                  ))}
                </tbody>
              </table>

              {allAttendance.length === 0 && (
                <div className="text-center py-8">
                  <FiFileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">No attendance records found for {formatMonthForDisplay(selectedMonth)}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Leave Tab - MODIFIED */}
        {activeTab === 'leave' && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">Leave Management</h2>
                <div className="flex items-center space-x-3">
                  <select 
                    className="border border-gray-300 rounded-lg px-3 py-2" 
                    value={selectedLeaveMonth} //
                    onChange={e => setSelectedLeaveMonth(e.target.value)} //
                  >
                    {monthOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="mt-4">
                <p className="text-lg font-semibold text-gray-900 mb-2">
                  Pending Applications: 
                  <span className="px-2.5 py-1 ml-2 bg-amber-100 text-amber-800 rounded-full text-sm font-medium">
                    {pendingLeaves.length}
                  </span>
                </p>
                <p className="text-sm text-gray-600">
                  Showing all leave applications for: <span className="font-semibold">{formatMonthForDisplay(selectedLeaveMonth)}</span>
                </p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr className="border-b border-gray-200 bg-gray-50">
                  <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase">Staff</th>
                  <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                  <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase">From Date</th>
                  <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase">To Date</th>
                  <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase">Reason</th>
                  <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase">Applied On</th>
                  <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr></thead>
                <tbody>
                  {allLeaves.map(l => ( // Changed to render allLeaves
                    <LeaveApplicationRow key={l.id} application={l} handleLeaveAction={handleLeaveAction} />
                  ))}
                </tbody>
              </table>
              
              {allLeaves.length === 0 && (
                <div className="text-center py-8">
                  <FiFileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">No leave applications found for {formatMonthForDisplay(selectedLeaveMonth)}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Salary Tab */}
        {activeTab === 'salary' && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">Salary Management</h2>
                <div className="flex items-center space-x-3">
                  <select 
                    className="border border-gray-300 rounded-lg px-3 py-2" 
                    value={selectedSalaryMonth} 
                    onChange={e => setSelectedSalaryMonth(e.target.value)}
                  >
                    {monthOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <button onClick={handleSendSalary} className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"><FiSend className="h-4 w-4" /><span>Send Salaries</span></button>
                  <button onClick={() => { 
                    setSalaryEdit({ 
                      staff_id: '', 
                      month: selectedSalaryMonth, 
                      basic: '', 
                      hra: '', 
                      ta: '', 
                      other_allowances: '', 
                      deductions: '', 
                      working_days: '', 
                      present_days: '', 
                      additional_components: [] 
                    }); 
                    setShowCreateSalaryModal(true); 
                  }} className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"><FiPlus className="h-4 w-4" /><span>Create Salary</span></button>
                  <button onClick={() => setShowCalendarModal(true)} className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"><FiCalendar className="h-4 w-4" /><span>Manage Working Days</span></button>
                </div>
              </div>
              <div className="mt-4">
                <p className="text-sm text-gray-600 mb-4">
                  Managing salaries for: <span className="font-semibold">{formatMonthForDisplay(selectedSalaryMonth)}</span>
                </p>
                <div className="grid grid-cols-4 gap-4">
                  <div className="bg-blue-50 rounded-lg p-4"><p className="text-sm text-blue-600 font-medium">Total Payroll</p><p className="text-xl font-bold text-blue-900">₹{salaryData.filter(s=>s.month===selectedSalaryMonth).reduce((a,s)=>a+Number(s.net_salary),0).toLocaleString()}</p></div>
                  <div className="bg-green-50 rounded-lg p-4"><p className="text-sm text-green-600 font-medium">Sent</p><p className="text-xl font-bold text-green-900">{salaryData.filter(s=>s.month===selectedSalaryMonth && s.status==='sent').length}</p></div>
                  <div className="bg-amber-50 rounded-lg p-4"><p className="text-sm text-amber-600 font-medium">Pending</p><p className="text-xl font-bold text-amber-900">{salaryData.filter(s=>s.month===selectedSalaryMonth && s.status==='pending').length}</p></div>
                  <div className="bg-purple-50 rounded-lg p-4"><p className="text-sm text-purple-600 font-medium">Staff</p><p className="text-xl font-bold text-purple-900">{salaryData.filter(s=>s.month===selectedSalaryMonth).length}</p></div>
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr className="border-b border-gray-200 bg-gray-50">
                  <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase">Staff</th>
                  <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase">Month</th>
                  <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase">Basic</th>
                  <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase">HRA</th>
                  <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase">TA</th>
                  <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase">Other Allowances</th>
                  <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase">Deductions</th>
                  <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase">Days</th>
                  <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase">Total Hours</th>
                  <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase">Net Salary</th>
                  <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr></thead>
                <tbody>
                  {salaryData
                    .filter(salary => salary.month === selectedSalaryMonth)
                    .map(salary => (
                      <SalaryRow key={`${salary.staff_id}-${salary.month}`} salary={salary} onSendToStaff={handleSendToStaff} handleEditSalary={handleEditSalary} />
                    ))}
                </tbody>
              </table>
              {salaryData.filter(s => s.month === selectedSalaryMonth).length === 0 && (
                <div className="text-center py-8">
                  <FiFileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">No salary records found for {formatMonthForDisplay(selectedSalaryMonth)}</p>
                </div>
              )}
            </div>
          </div>
        )}
        {activeTab === 'calendar' && (
          <CalendarView
            calendarData={calendarData}
            leavesData={allLeaves}
            onAddEvent={() => setShowCalendarModal(true)}
            onEditEvent={handleEditCalendarEvent}
            onDeleteEvent={handleDeleteCalendarEvent}
            onUpdateEvent={handleUpdateCalendarEvent}
          />
        )}
      </div>

      {/* ==================== ALL MODALS ==================== */}

      {/* Attendance Edit Modal */}
      <AnimatePresence>
        {showAttendanceEditModal && selectedAttendance && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white rounded-xl p-6 max-w-md w-full"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-gray-900">Edit Attendance</h3>
                <button
                  onClick={() => {
                    setShowAttendanceEditModal(false);
                    setSelectedAttendance(null);
                  }}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <FiX className="h-5 w-5 text-gray-600" />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Punch In Time</label>
                  <input
                    type="time"
                    value={attendanceEdit.punch_in}
                    onChange={e => setAttendanceEdit(prev => ({ ...prev, punch_in: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Punch Out Time</label>
                  <input
                    type="time"
                    value={attendanceEdit.punch_out}
                    onChange={e => setAttendanceEdit(prev => ({ ...prev, punch_out: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Break Time</label>
                  <input
                    type="text"
                    value={attendanceEdit.breaks}
                    onChange={e => setAttendanceEdit(prev => ({ ...prev, breaks: e.target.value }))}
                    placeholder="e.g., 13:00-14:00"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                  <select
                    value={attendanceEdit.status}
                    onChange={e => setAttendanceEdit(prev => ({ ...prev, status: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="present">Present</option>
                    <option value="sick_leave">Sick Leave</option>
                    <option value="casual_leave">Casual Leave</option>
                    <option value="absent">Absent</option>
                  </select>
                </div>
              </div>
              <div className="flex space-x-3 mt-6">
                <button
                  onClick={() => {
                    setShowAttendanceEditModal(false);
                    setSelectedAttendance(null);
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveAttendance}
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  Save Changes
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showSalaryEditModal && selectedSalary && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white rounded-xl p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-gray-900">Edit Salary - {selectedSalary.staff_name}</h3>
                <button
                  onClick={() => {
                    setShowSalaryEditModal(false);
                    setSelectedSalary(null);
                  }}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <FiX className="h-5 w-5 text-gray-600" />
                </button>
              </div>
              <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                <h4 className="font-semibold text-gray-900 mb-2">Salary Distribution Status</h4>
                <div className="flex items-center space-x-4 text-sm">
                  <span
                    className={`px-3 py-1 rounded-full font-medium ${
                      selectedSalary.status === 'sent' ? 'bg-emerald-100 text-emerald-700'
                        : selectedSalary.status === 'viewed'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-amber-100 text-amber-700'
                    }`}
                  >
                    Status:{' '}
                    {selectedSalary.status === 'sent'
                      ? 'Sent to Staff'
                      : selectedSalary.status === 'viewed'
                      ? 'Viewed by Staff'
                      : 'Pending'}
                  </span>
                  {selectedSalary.sent_date && (
                    <span className="text-gray-600">
                      Sent on: {new Date(selectedSalary.sent_date).toLocaleDateString('en-IN')}
                    </span>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Basic Salary</label>
                  <input
                    type="number"
                    value={salaryEdit.basic}
                    onChange={e => setSalaryEdit(prev => ({ ...prev, basic: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">HRA</label>
                  <input
                    type="number"
                    value={salaryEdit.hra}
                    onChange={e => setSalaryEdit(prev => ({ ...prev, hra: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Travel Allowance</label>
                  <input
                    type="number"
                    value={salaryEdit.ta}
                    onChange={e => setSalaryEdit(prev => ({ ...prev, ta: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Other Allowances</label>
                  <input
                    type="number"
                    value={salaryEdit.other_allowances}
                    onChange={e => setSalaryEdit(prev => ({ ...prev, other_allowances: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Deductions</label>
                  <input
                    type="number"
                    value={salaryEdit.deductions}
                    onChange={e => setSalaryEdit(prev => ({ ...prev, deductions: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Working Days</label>
                  <input
                    type="number"
                    value={salaryEdit.working_days}
                    onChange={e => setSalaryEdit(prev => ({ ...prev, working_days: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Present Days</label>
                  <input
                    type="number"
                    value={salaryEdit.present_days}
                    onChange={e => setSalaryEdit(prev => ({ ...prev, present_days: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Wallet (Debit from)</label>
                  <select
                    value={selectedWalletId}
                    onChange={(e) => setSelectedWalletId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">-- Select Wallet --</option>
                    {wallets.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name} – ₹{Number(w.balance).toLocaleString()}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="mb-6">
                <h4 className="font-semibold text-gray-900 mb-4">Advanced Salary Components</h4>
                <div className="space-y-3 mb-4">
                  {salaryEdit.additional_components.map((component, index) => (
                    <div key={index} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getOperationColor(component.operation)}`}>
                        {getOperationIcon(component.operation)}
                      </span>
                      <span className="flex-1 text-sm font-medium">{component.name}</span>
                      <span className="text-sm">
                        {component.operation === 'percentage' ? `${component.amount}%` : component.amount}
                        {component.base && component.base !== 'basic' && ` of ${component.base}`}
                      </span>
                      <button
                        onClick={() => handleRemoveComponent(index)}
                        className="p-1 text-rose-600 hover:bg-rose-50 rounded"
                      >
                        <FiX className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-12 gap-2 mb-3">
                  <div className="col-span-4">
                    <input
                      type="text"
                      placeholder="Component name"
                      value={newComponent.name}
                      onChange={e => setNewComponent(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                    />
                  </div>
                  <div className="col-span-2">
                    <input
                      type="number"
                      placeholder="Value"
                      value={newComponent.amount}
                      onChange={e => setNewComponent(prev => ({ ...prev, amount: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                    />
                  </div>
                  <div className="col-span-3">
                    <select
                      value={newComponent.operation}
                      onChange={e => setNewComponent(prev => ({ ...prev, operation: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                    >
                      <option value="addition">Addition (+)</option>
                      <option value="subtraction">Subtraction (-)</option>
                      <option value="multiplication">Multiplication (×)</option>
                      <option value="division">Division (÷)</option>
                      <option value="percentage">Percentage (%)</option>
                    </select>
                  </div>
                  <div className="col-span-2">
                    <select
                      value={newComponent.base}
                      onChange={e => setNewComponent(prev => ({ ...prev, base: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                    >
                      <option value="basic">Basic</option>
                      <option value="current">Current Total</option>
                    </select>
                  </div>
                  <div className="col-span-1">
                    <button
                      onClick={handleAddComponent}
                      className="w-full px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm"
                    >
                      <FiPlus className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <h4 className="font-semibold text-gray-900 mb-3">Salary Preview</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex justify-between">
                    <span>Basic + HRA + TA + Allowances:</span>
                    <span>
                      ₹{(Number(salaryEdit.basic) + Number(salaryEdit.hra) + Number(salaryEdit.ta) + Number(salaryEdit.other_allowances)).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>After Components:</span>
                    <span>
                      ₹{calculateWithOperations(
                        Number(salaryEdit.basic) + Number(salaryEdit.hra) + Number(salaryEdit.ta) + Number(salaryEdit.other_allowances),
                        salaryEdit.additional_components
                      ).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>After Deductions:</span>
                    <span className="font-bold text-emerald-600">
                      ₹{(calculateWithOperations(
                        Number(salaryEdit.basic) + Number(salaryEdit.hra) + Number(salaryEdit.ta) + Number(salaryEdit.other_allowances),
                        salaryEdit.additional_components
                      ) - Number(salaryEdit.deductions)).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex space-x-3">
                <button
                  onClick={() => {
                    setShowSalaryEditModal(false);
                    setSelectedSalary(null);
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveSalary}
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  Save Salary
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Create Salary Modal */}
      <AnimatePresence>
        {showCreateSalaryModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white rounded-xl p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-gray-900">Create New Salary</h3>
                <button
                  onClick={() => setShowCreateSalaryModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <FiX className="h-5 w-5 text-gray-600" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Staff Member</label>
                  <select
                    value={salaryEdit.staff_id}
                    onChange={e => setSalaryEdit(prev => ({ ...prev, staff_id: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Select Staff</option>
                    {staffList.map(staff => (
                      <option key={staff.id} value={staff.id}>
                        {staff.name} ({staff.employeeId})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Month</label>
                  <select
                    value={salaryEdit.month}
                    onChange={e => setSalaryEdit(prev => ({ ...prev, month: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {monthOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Wallet (Debit from)</label>
                  {walletLoading ? (
                    <p className="text-sm text-gray-500">Loading wallets…</p>
                  ) : wallets.length === 0 ? (
                    <p className="text-sm text-red-600">No wallets available</p>
                  ) : (
                    <select
                      value={selectedWalletId}
                      onChange={(e) => setSelectedWalletId(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      required
                    >
                      <option value="">-- Select Wallet --</option>
                      {wallets.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.name} ({w.wallet_type}) – ₹{Number(w.balance).toLocaleString()} bal.
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Basic Salary</label>
                  <input
                    type="number"
                    value={salaryEdit.basic}
                    onChange={e => setSalaryEdit(prev => ({ ...prev, basic: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">HRA</label>
                  <input
                    type="number"
                    value={salaryEdit.hra}
                    onChange={e => setSalaryEdit(prev => ({ ...prev, hra: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Travel Allowance</label>
                  <input
                    type="number"
                    value={salaryEdit.ta}
                    onChange={e => setSalaryEdit(prev => ({ ...prev, ta: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Other Allowances</label>
                  <input
                    type="number"
                    value={salaryEdit.other_allowances}
                    onChange={e => setSalaryEdit(prev => ({ ...prev, other_allowances: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Deductions</label>
                  <input
                    type="number"
                    value={salaryEdit.deductions}
                    onChange={e => setSalaryEdit(prev => ({ ...prev, deductions: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Working Days (auto)</label>
                  <input
                    type="text"
                    value={autoCalc.working_days}
                    readOnly
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Present Days (auto)</label>
                  <input
                    type="text"
                    value={autoCalc.present_days}
                    readOnly
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Total Hours (auto)</label>
                  <input
                    type="text"
                    value={autoCalc.total_hours}
                    readOnly
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
                  />
                </div>
              </div>
              <div className="mb-6">
                <h4 className="font-semibold text-gray-900 mb-4">Advanced Salary Components</h4>
                <div className="space-y-3 mb-4">
                  {salaryEdit.additional_components.map((component, index) => (
                    <div key={index} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getOperationColor(component.operation)}`}>
                        {getOperationIcon(component.operation)}
                      </span>
                      <span className="flex-1 text-sm font-medium">{component.name}</span>
                      <span className="text-sm">
                        {component.operation === 'percentage' ? `${component.amount}%` : component.amount}
                        {component.base && component.base !== 'basic' && ` of ${component.base}`}
                      </span>
                      <button
                        onClick={() => handleRemoveComponent(index)}
                        className="p-1 text-rose-600 hover:bg-rose-50 rounded"
                      >
                        <FiX className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-12 gap-2 mb-3">
                  <div className="col-span-4">
                    <input
                      type="text"
                      placeholder="Component name"
                      value={newComponent.name}
                      onChange={e => setNewComponent(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                    />
                  </div>
                  <div className="col-span-2">
                    <input
                      type="number"
                      placeholder="Value"
                      value={newComponent.amount}
                      onChange={e => setNewComponent(prev => ({ ...prev, amount: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                    />
                  </div>
                  <div className="col-span-3">
                    <select
                      value={newComponent.operation}
                      onChange={e => setNewComponent(prev => ({ ...prev, operation: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                    >
                      <option value="addition">Addition (+)</option>
                      <option value="subtraction">Subtraction (-)</option>
                      <option value="multiplication">Multiplication (×)</option>
                      <option value="division">Division (÷)</option>
                      <option value="percentage">Percentage (%)</option>
                    </select>
                  </div>
                  <div className="col-span-2">
                    <select
                      value={newComponent.base}
                      onChange={e => setNewComponent(prev => ({ ...prev, base: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                    >
                      <option value="basic">Basic</option>
                      <option value="current">Current Total</option>
                    </select>
                  </div>
                  <div className="col-span-1">
                    <button
                      onClick={handleAddComponent}
                      className="w-full px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm"
                    >
                      <FiPlus className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <h4 className="font-semibold text-gray-900 mb-3">Salary Preview</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex justify-between">
                    <span>Basic + HRA + TA + Allowances:</span>
                    <span>
                      ₹{(Number(salaryEdit.basic) + Number(salaryEdit.hra) + Number(salaryEdit.ta) + Number(salaryEdit.other_allowances)).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>After Components:</span>
                    <span>
                      ₹{calculateWithOperations(
                        Number(salaryEdit.basic) + Number(salaryEdit.hra) + Number(salaryEdit.ta) + Number(salaryEdit.other_allowances),
                        salaryEdit.additional_components
                      ).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>After Deductions:</span>
                    <span className="font-bold text-emerald-600">
                      ₹{(calculateWithOperations(
                        Number(salaryEdit.basic) + Number(salaryEdit.hra) + Number(salaryEdit.ta) + Number(salaryEdit.other_allowances),
                        salaryEdit.additional_components
                      ) - Number(salaryEdit.deductions)).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex space-x-3">
                <button
                  onClick={() => setShowCreateSalaryModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateSalary}
                  disabled={!salaryEdit.staff_id || !salaryEdit.month || !salaryEdit.basic || !salaryEdit.working_days || !salaryEdit.present_days}
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Create Salary
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Calendar Event Modal */}
      <AnimatePresence>
        {showCalendarModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white rounded-xl p-6 max-w-md w-full"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-gray-900">Add Working Day/Holiday</h3>
                <button
                  onClick={() => setShowCalendarModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <FiX className="h-5 w-5 text-gray-600" />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Date</label>
                  <input
                    type="date"
                    value={calendarEdit.date}
                    onChange={e => setCalendarEdit(prev => ({ ...prev, date: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Type</label>
                  <select
                    value={calendarEdit.type}
                    onChange={e => setCalendarEdit(prev => ({ ...prev, type: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="working">Working Day</option>
                    <option value="holiday">Holiday</option>
                    <option value="weekend">Weekend</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                  <input
                    type="text"
                    value={calendarEdit.description}
                    onChange={e => setCalendarEdit(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="e.g., New Year, Republic Day"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
              <div className="flex space-x-3 mt-6">
                <button
                  onClick={() => setShowCalendarModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddCalendarEvent}
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  Add to Calendar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Leave Action Modal */}
      <AnimatePresence>
        {showLeaveActionModal && selectedLeave && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white rounded-xl p-6 max-w-md w-full"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900">Review Leave Application</h3>
                <button
                  onClick={() => {
                    setShowLeaveActionModal(false);
                    setSelectedLeave(null);
                  }}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <FiX className="h-5 w-5 text-gray-600" />
                </button>
              </div>
              <div className="space-y-4 mb-6">
                <div>
                  <p className="text-sm font-medium text-gray-700">Staff Member</p>
                  <p className="text-gray-900">{selectedLeave.staff_name}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700">Leave Type</p>
                  <p className="text-gray-900">{selectedLeave.type}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-gray-700">From Date</p>
                    <p className="text-gray-900">{new Date(selectedLeave.from_date).toLocaleDateString('en-IN')}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-700">To Date</p>
                    <p className="text-gray-900">{new Date(selectedLeave.to_date).toLocaleDateString('en-IN')}</p>
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700">Reason</p>
                  <p className="text-gray-900">{selectedLeave.reason}</p>
                </div>
              </div>
              <div className="flex space-x-3">
                <button
                  onClick={() => handleLeaveAction(selectedLeave.id, 'rejected')}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Reject
                </button>
                <button
                  onClick={() => handleLeaveAction(selectedLeave.id, 'approved')}
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  Approve
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </ErrorBoundary>
  );
};

export default AdminAttendance;