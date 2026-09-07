// src/pages/SuperAdminAttendance.jsx
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
  FiChevronLeft, FiChevronRight, FiMapPin, FiMove,
  FiGlobe, FiTarget, FiLayers, FiGrid, FiZap, FiInfo
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
  getSalaryData,
  updateSalary,
  sendSalary,
  bulkSendSalaries,
  getCalendarData,
  addCalendarEvent,
  createSalary,
  updateCalendarEvent,
  getStaffSchedules,
  getAutoCalc,
  getLeaves,
  updateSalaryByCenter,
  sendSalaryByCenter,
  bulkSendSalariesByCenter,
  updateLeaveByCenter,
  deleteCalendarEventByCenter
} from '/src/services/salaryService';
import { getWalletsByCentre } from '@/services/walletService';
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
  componentDidCatch(error, info) { console.error('Error in SuperAdminAttendance:', error, info); }
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

const getCurrentMonth = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

const formatMonthForDisplay = (monthStr) => {
  if (!monthStr) return '';
  const [year, month] = monthStr.split('-');
  const date = new Date(parseInt(year), parseInt(month) - 1, 1);
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
};

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

// ---------------------------------------------------------------------
// UI Components
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

// UPDATED PROFESSIONAL CENTER CARD DESIGN
const CenterCard = ({ center, isSelected, onClick }) => {
  // Generate different color schemes based on center ID for visual variety
  const colorSchemes = [
    { primary: 'from-blue-500 to-indigo-600', secondary: 'bg-blue-50', accent: 'text-blue-600' },
    { primary: 'from-emerald-500 to-teal-600', secondary: 'bg-emerald-50', accent: 'text-emerald-600' },
    { primary: 'from-purple-500 to-violet-600', secondary: 'bg-purple-50', accent: 'text-purple-600' },
    { primary: 'from-amber-500 to-orange-600', secondary: 'bg-amber-50', accent: 'text-amber-600' },
  ];
  
  const colorIndex = center.id % colorSchemes.length;
  const colors = colorSchemes[colorIndex];
  
  return (
    <motion.div 
      whileHover={{ y: -3, scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={`relative rounded-xl overflow-hidden cursor-pointer transition-all duration-300 ${
        isSelected 
          ? 'ring-2 ring-indigo-500 ring-opacity-50 shadow-lg' 
          : 'shadow-md hover:shadow-lg border border-gray-200'
      }`}
    >
      {/* Main content */}
      <div className="bg-white p-5">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-lg ${colors.secondary} shadow-sm`}>
              <FiGrid className={`h-5 w-5 ${colors.accent}`} />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 text-base mb-1">{center.name}</h3>
              <div className="flex items-center gap-1">
                <span className="text-xs text-gray-500">
                  ID: {center.id}
                </span>
                <span className="text-gray-400 mx-1">•</span>
                <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${colors.secondary} ${colors.accent}`}>
                  Active
                </span>
              </div>
            </div>
          </div>
          
          {isSelected && (
            <div className="flex items-center justify-center w-6 h-6 bg-indigo-100 rounded-full">
              <FiCheckCircle className="h-4 w-4 text-indigo-600" />
            </div>
          )}
        </div>
        
        {/* Stats grid - more compact */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="text-center">
            <div className="flex flex-col items-center">
              <div className="p-1.5 bg-gray-100 rounded-lg mb-1">
                <FiUsers className="h-3.5 w-3.5 text-gray-600" />
              </div>
              <span className="text-xs text-gray-500 mb-0.5">Staff</span>
              <p className="text-base font-bold text-gray-900">{center.staffCount || 0}</p>
            </div>
          </div>
          
          <div className="text-center">
            <div className="flex flex-col items-center">
              <div className="p-1.5 bg-emerald-100 rounded-lg mb-1">
                <FiUserCheck className="h-3.5 w-3.5 text-emerald-600" />
              </div>
              <span className="text-xs text-gray-500 mb-0.5">Active</span>
              <p className="text-base font-bold text-emerald-600">{center.activeStaff || 0}</p>
            </div>
          </div>
          
          <div className="text-center">
            <div className="flex flex-col items-center">
              <div className="p-1.5 bg-amber-100 rounded-lg mb-1">
                <FiDollarSign className="h-3.5 w-3.5 text-amber-600" />
              </div>
              <span className="text-xs text-gray-500 mb-0.5">Payroll</span>
              <p className="text-base font-bold text-gray-900">₹{(Number(center.totalSalary) || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
            </div>
          </div>
        </div>
        
        {/* Footer - simplified */}
        <div className="pt-3 border-t border-gray-100">
          <div className="flex items-center justify-between">
            <div className="text-xs text-gray-500">
              Created: {new Date(center.createdAt).toLocaleDateString('en-IN', { 
                day: 'numeric', 
                month: 'short' 
              })}
            </div>
            <button className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded transition-colors ${
              isSelected 
                ? 'bg-indigo-50 text-indigo-600' 
                : 'text-gray-600 hover:text-gray-900'
            }`}>
              <span>Select</span>
              <FiChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
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
        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${record.status === 'present' ? 'bg-emerald-50 text-emerald-700' : record.status.includes('leave') ? 'bg-amber-50 text-amber-700' : record.status === 'absent' ? 'bg-red-50 text-red-700' : 'bg-gray-50 text-gray-700'}`}>
          {record.status === 'present' ? 'Present' : record.status.includes('leave') ? 'Leave' : record.status === 'absent' ? 'Absent' : 'Weekend'}
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
// MAIN COMPONENT - SUPER ADMIN
// ---------------------------------------------------------------------
const SuperAdminAttendance = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [centers, setCenters] = useState([]);
  const [selectedCenter, setSelectedCenter] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth());
  const [selectedSalaryMonth, setSelectedSalaryMonth] = useState(getCurrentMonth());
  const [selectedLeaveMonth, setSelectedLeaveMonth] = useState(getCurrentMonth());
  const [wallets, setWallets] = useState([]);
  const [selectedWalletId, setSelectedWalletId] = useState("");
  const [walletLoading, setWalletLoading] = useState(false);
  
  // Data states
  const [centerStaff, setCenterStaff] = useState({});
  const [centerAttendance, setCenterAttendance] = useState({});
  const [centerLeaves, setCenterLeaves] = useState({});
  const [centerSalaries, setCenterSalaries] = useState({});
  const [centerCalendars, setCenterCalendars] = useState({});
  const [pendingLeaves, setPendingLeaves] = useState({});
  
  // Modal states
  const [showAttendanceEditModal, setShowAttendanceEditModal] = useState(false);
  const [showLeaveActionModal, setShowLeaveActionModal] = useState(false);
  const [showSalaryEditModal, setShowSalaryEditModal] = useState(false);
  const [showCreateSalaryModal, setShowCreateSalaryModal] = useState(false);
  const [showCalendarModal, setShowCalendarModal] = useState(false);
  
  const [selectedAttendance, setSelectedAttendance] = useState(null);
  const [selectedLeave, setSelectedLeave] = useState(null);
  const [selectedSalary, setSelectedSalary] = useState(null);
  
  // Form states
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
  const [calendarEdit, setCalendarEdit] = useState({ date: '', type: 'working', description: '', centre_id: '' });
  const [autoCalc, setAutoCalc] = useState({
    working_days: 0,
    present_days: 0,
    total_hours: 0,
  });
  
  const [loading, setLoading] = useState(true);
  const monthOptions = useMemo(() => generateMonthOptions(), []);

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


  const groupAttendance = (attendance, staffList) => {
  const map = new Map();

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
        raw: [],
        lateMinutes: 0,
        extraMinutes: 0,
      });
    }

    const entry = map.get(key);

    if (!entry.punch_in || rec.punch_in < entry.punch_in)
      entry.punch_in = rec.punch_in;

    if (rec.punch_out && (!entry.punch_out || rec.punch_out > entry.punch_out))
      entry.punch_out = rec.punch_out;

    entry.raw.push(rec);
  });

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

// -------------------------------------------------------------
// NEW: GROUP ATTENDANCE BY DATE
// -------------------------------------------------------------
const groupAttendanceByDate = (attendance, staffList) => {
  // First, group by Staff-Day to get normalized daily stats
  const staffDaySummaries = groupAttendance(attendance, staffList);

  // Next, group those summaries by Date
  const dateMap = new Map();

  staffDaySummaries.forEach(record => {
    const d = normalizeDate(record.date);
    if (!dateMap.has(d)) {
      dateMap.set(d, {
        date: d,
        presentCount: 0,
        absentCount: 0,
        leaveCount: 0,
        totalLateHours: 0,
        totalExtraHours: 0,
        records: []
      });
    }

    const group = dateMap.get(d);
    
    if (record.status === 'present') group.presentCount++;
    else if (record.status === 'absent') group.absentCount++;
    else if (record.status?.includes('leave')) group.leaveCount++;

    group.totalLateHours += Number(record.lateHours) || 0;
    group.totalExtraHours += Number(record.extraHours) || 0;

    group.records.push(record);
  });

  return Array.from(dateMap.values()).sort((a, b) => new Date(b.date) - new Date(a.date));
};

const DailyAttendanceRow = ({ dateGroup, onEdit }) => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <tr className="border-b border-gray-200 hover:bg-gray-50 cursor-pointer transition-colors" onClick={() => setOpen(!open)}>
        <td className="py-4 px-6">
          <p className="text-sm font-bold text-gray-900">
            {new Date(dateGroup.date).toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
          </p>
        </td>
        <td className="py-4 px-6">
          <span className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs font-bold shadow-sm">
            {dateGroup.presentCount} Present
          </span>
        </td>
        <td className="py-4 px-6">
          <div className="flex space-x-2">
            {dateGroup.absentCount > 0 && <span className="px-2 py-1 bg-red-100 text-red-800 rounded text-xs font-bold">{dateGroup.absentCount} Absent</span>}
            {dateGroup.leaveCount > 0 && <span className="px-2 py-1 bg-amber-100 text-amber-800 rounded text-xs font-bold">{dateGroup.leaveCount} Leave</span>}
            {dateGroup.absentCount === 0 && dateGroup.leaveCount === 0 && <span className="text-gray-400 text-sm">-</span>}
          </div>
        </td>
        <td className="py-4 px-6">
          <p className="text-sm font-bold text-amber-600">{dateGroup.totalLateHours > 0 ? `${dateGroup.totalLateHours.toFixed(2)}h` : '-'}</p>
        </td>
        <td className="py-4 px-6">
          <p className="text-sm font-bold text-purple-600">{dateGroup.totalExtraHours > 0 ? `${dateGroup.totalExtraHours.toFixed(2)}h` : '-'}</p>
        </td>
        <td className="py-4 px-6 text-right">
          <button className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
            {open ? <FiChevronUp className="h-5 w-5" /> : <FiChevronDown className="h-5 w-5" />}
          </button>
        </td>
      </tr>

      <AnimatePresence>
        {open && (
          <tr>
            <td colSpan={6} className="p-0">
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="bg-slate-50 border-b border-gray-200 overflow-hidden shadow-inner"
              >
                <div className="p-4 lg:px-8">
                  <table className="w-full bg-white rounded-xl overflow-hidden border border-gray-200 shadow-sm">
                    <thead className="bg-gray-100 border-b border-gray-200">
                      <tr>
                        <th className="py-3 px-4 text-left text-xs font-bold text-gray-600 uppercase">Staff</th>
                        <th className="py-3 px-4 text-left text-xs font-bold text-gray-600 uppercase">Status</th>
                        <th className="py-3 px-4 text-left text-xs font-bold text-gray-600 uppercase">Punch In</th>
                        <th className="py-3 px-4 text-left text-xs font-bold text-gray-600 uppercase">Punch Out</th>
                        <th className="py-3 px-4 text-left text-xs font-bold text-gray-600 uppercase">Hours</th>
                        <th className="py-3 px-4 text-left text-xs font-bold text-gray-600 uppercase">Deviations</th>
                        <th className="py-3 px-4 text-center text-xs font-bold text-gray-600 uppercase">Edit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {dateGroup.records.sort((a,b) => a.staff_name.localeCompare(b.staff_name)).map(record => (
                        <tr key={record.staff_id} className="hover:bg-blue-50/30 transition-colors">
                          <td className="py-3 px-4">
                            <div className="font-bold text-gray-900 text-sm">{record.staff_name}</div>
                            {record.schedule && (
                              <div className="text-[11px] text-gray-500 font-medium mt-0.5">
                                Shift: {record.schedule.start_time.substring(0,5)} - {record.schedule.end_time.substring(0,5)}
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-1 rounded text-xs font-bold uppercase tracking-wider ${
                              record.status === 'present' ? 'bg-emerald-100 text-emerald-800'
                                : record.status?.includes('leave') ? 'bg-amber-100 text-amber-800'
                                : record.status === 'absent' ? 'bg-red-100 text-red-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}>
                              {record.status === 'present' ? 'Present'
                                : record.status?.includes('leave') ? 'Leave'
                                : record.status === 'absent' ? 'Absent' : 'Weekend'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-sm font-medium text-gray-700">{record.punch_in || '-'}</td>
                          <td className="py-3 px-4 text-sm font-medium text-gray-700">{record.punch_out || '-'}</td>
                          <td className="py-3 px-4 text-sm font-black text-gray-900">{Number(record.hours) > 0 ? `${Number(record.hours).toFixed(2)}h` : '-'}</td>
                          <td className="py-3 px-4">
                            <div className="flex flex-col space-y-1">
                              {record.lateHours > 0 && <span className="text-[11px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-bold w-max">Late: {record.lateHours}h</span>}
                              {record.extraHours > 0 && <span className="text-[11px] px-1.5 py-0.5 rounded bg-purple-100 text-purple-800 font-bold w-max">Extra: {record.extraHours}h</span>}
                              {record.lateHours === 0 && record.extraHours === 0 && <span className="text-gray-400 text-sm">-</span>}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <button
                              onClick={(e) => { e.stopPropagation(); onEdit(record.raw[0]); }}
                              className="p-1.5 text-indigo-600 hover:bg-indigo-100 rounded transition-colors"
                              title="Edit Attendance"
                            >
                              <FiEdit className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            </td>
          </tr>
        )}
      </AnimatePresence>
    </>
  );
};

  // ------------------- LOAD DATA -------------------
  useEffect(() => {
    const loadCenters = async () => {
      try {
        setLoading(true);
        // Get all centers, passing the dynamically selected month
        const response = await axios.get(
          `${import.meta.env.VITE_API_URL}/api/salary/centers`,
          { 
            params: { month: selectedMonth }, // 🔥 Pass the month payload
            headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } 
          }
        );
        
        const centersData = response.data;
        setCenters(centersData);
        
        // Select first center by default (will safely ignore if one is already selected)
        if (centersData.length > 0 && !selectedCenter) {
          setSelectedCenter(centersData[0]);
        }
      } catch (error) {
        console.error('Error loading centers:', error);
        toast.error('Failed to load centers');
      } finally {
        setLoading(false);
      }
    };
    
    loadCenters();
  }, [selectedMonth]); // 🔥 Re-trigger whenever the global month dropdown changes

  // Load center-specific data
  useEffect(() => {
    if (!selectedCenter) return;

    const loadCenterData = async () => {
      try {
        setLoading(true);
        
        // Load staff for this center
        const staffResponse = await axios.get(
          `${import.meta.env.VITE_API_URL}/api/salary/centers/${selectedCenter.id}/staff`,
          { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
        );
        setCenterStaff(prev => ({ ...prev, [selectedCenter.id]: staffResponse.data }));
        
        // Load attendance for this center
        const attendanceResponse = await axios.get(
          `${import.meta.env.VITE_API_URL}/api/salary/centers/${selectedCenter.id}/attendance`,
          { 
            params: { month: selectedMonth },
            headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } 
          }
        );
        setCenterAttendance(prev => ({ ...prev, [selectedCenter.id]: attendanceResponse.data }));
        
        // Load leaves for this center
        const leavesResponse = await axios.get(
          `${import.meta.env.VITE_API_URL}/api/salary/centers/${selectedCenter.id}/leaves`,
          { 
            params: { month: selectedLeaveMonth },
            headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } 
          }
        );
        setCenterLeaves(prev => ({ ...prev, [selectedCenter.id]: leavesResponse.data }));
        
        // Load pending leaves for this center
        const pendingLeavesResponse = await axios.get(
          `${import.meta.env.VITE_API_URL}/api/salary/centers/${selectedCenter.id}/leaves/pending`,
          { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
        );
        setPendingLeaves(prev => ({ ...prev, [selectedCenter.id]: pendingLeavesResponse.data }));
        
        // Load calendar for this center
        const calendarResponse = await axios.get(
          `${import.meta.env.VITE_API_URL}/api/salary/centers/${selectedCenter.id}/calendar`,
          { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
        );
        setCenterCalendars(prev => ({ ...prev, [selectedCenter.id]: calendarResponse.data }));

        const staffWithSchedules = await Promise.all(
          staffResponse.data.map(async (staff) => {
            try {
              const schedules = await getStaffSchedules(staff.id);
              return { ...staff, schedules };
            } catch {
              return { ...staff, schedules: [] };
            }
          })
        );

        setCenterStaff(prev => ({
          ...prev,
          [selectedCenter.id]: staffWithSchedules
        }));
        
      } catch (error) {
        console.error('Error loading center data:', error);
        toast.error(`Failed to load data for ${selectedCenter.name}`);
      } finally {
        setLoading(false);
      }
    };
    
    loadCenterData();
  }, [selectedCenter, selectedMonth, selectedSalaryMonth, selectedLeaveMonth]);

  // Update salaryEdit month when salary month changes
  useEffect(() => {
    setSalaryEdit(prev => ({
      ...prev,
      month: selectedSalaryMonth
    }));
  }, [selectedSalaryMonth]);

  useEffect(() => {
    if (salaryEdit.staff_id && salaryEdit.month && selectedCenter) {
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
  }, [salaryEdit.staff_id, salaryEdit.month, selectedCenter]);

  //for centre select - wallet load
  useEffect(() => {
  if (!selectedCenter) return;

  const loadWallets = async () => {
    try {
      setWalletLoading(true);
      const data = await getWalletsByCentre(selectedCenter.id);
      setWallets(data);
      setSelectedWalletId(data[0]?.id || "");
    } catch {
      toast.error("Failed to load wallets for center");
    } finally {
      setWalletLoading(false);
    }
  };

  loadWallets();
}, [selectedCenter]);


  // ------------------- ATTENDANCE FUNCTIONS -------------------
  const handleEditAttendance = (rec) => {
    setSelectedAttendance(rec);
    setAttendanceEdit({ 
      punch_in: rec.punch_in || '', 
      punch_out: rec.punch_out || '', 
      breaks: rec.breaks || '', 
      status: rec.status || 'present' 
    });
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
    const data = { 
      ...attendanceEdit, 
      hours: calculateHours(attendanceEdit.punch_in, attendanceEdit.punch_out) 
    };
    
    try {
      const upd = await updateAttendance(selectedAttendance.id, data);
      
      // Update local state
      if (selectedCenter) {
        setCenterAttendance(prev => ({
          ...prev,
          [selectedCenter.id]: prev[selectedCenter.id].map(i => i.id === selectedAttendance.id ? upd : i)
        }));
      }
      
      setShowAttendanceEditModal(false); 
      setSelectedAttendance(null);
      toast.success('Attendance updated');
    } catch { 
      toast.error('Failed to update attendance'); 
    }
  };

  // ------------------- LEAVE FUNCTIONS -------------------
  const handleLeaveAction = async (id, action) => {
    try { 
      const upd = await updateLeaveByCenter(selectedCenter.id, id, action); 
      
      // Update local state
      if (selectedCenter) {
        // Update leaves
        setCenterLeaves(prev => ({
          ...prev,
          [selectedCenter.id]: prev[selectedCenter.id].map(l => l.id === id ? upd : l)
        }));
        
        // Update pending leaves
        setPendingLeaves(prev => ({
          ...prev,
          [selectedCenter.id]: prev[selectedCenter.id].filter(l => l.id !== id)
        }));
      }
      
      setShowLeaveActionModal(false); 
      setSelectedLeave(null); 
      toast.success(`Leave ${action}`); 
    } catch { 
      toast.error(`Failed to ${action} leave`); 
    }
  };

  // --- NEW PAYROLL ENGINE STATES ---
  const [salaryRuns, setSalaryRuns] = useState([]);
  const [selectedRun, setSelectedRun] = useState(null);
  const [runRecords, setRunRecords] = useState([]);
  const [showRunModal, setShowRunModal] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [showStructuresModal, setShowStructuresModal] = useState(false);
  const [salaryStructures, setSalaryStructures] = useState([]);
  
  const [newRunData, setNewRunData] = useState({
    payroll_month: getCurrentMonth(),
    calendar_days: 0,
    sundays: 0,
    dl_days: 1,
    other_offdays: 0,
    is_loading: false
  });

  // Auto-fetch calendar stats when the modal opens or the month/center changes
  useEffect(() => {
    const fetchPreview = async () => {
      if (!showRunModal || !selectedCenter) return;
      setNewRunData(prev => ({ ...prev, is_loading: true }));
      try {
        const params = { month: newRunData.payroll_month, centre_id: selectedCenter.id };
        const res = await axios.get(`${import.meta.env.VITE_API_URL}/api/salary/run-preview`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
          params
        });
        
        setNewRunData(prev => ({
          ...prev,
          calendar_days: res.data.calendar_days,
          sundays: res.data.sundays,
          dl_days: res.data.dl_days,
          other_offdays: res.data.other_offdays,
          is_loading: false
        }));
      } catch (err) {
        setNewRunData(prev => ({ ...prev, is_loading: false }));
      }
    };
    fetchPreview();
  }, [newRunData.payroll_month, showRunModal, selectedCenter]);

  // ------------------- PAYROLL LIFECYCLE HANDLERS -------------------
  const fetchSalaryRuns = async () => {
    if (!selectedCenter) return;
    try {
      const params = { centre_id: selectedCenter.id };
      const res = await axios.get(`${import.meta.env.VITE_API_URL}/api/salary/runs`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        params
      });
      setSalaryRuns(res.data);
    } catch (err) { console.error("Error fetching runs:", err); }
  };

  useEffect(() => {
    if (activeTab === 'salary' && selectedCenter) fetchSalaryRuns();
  }, [activeTab, selectedCenter]);

  const fetchSalaryStructures = async () => {
    if (!selectedCenter) return toast.error("Select a center first");
    try {
      const res = await axios.get(`${import.meta.env.VITE_API_URL}/api/salary/structures`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        params: { centre_id: selectedCenter.id }
      });
      setSalaryStructures(res.data);
      setShowStructuresModal(true);
    } catch (err) { toast.error("Failed to load payroll configurations"); }
  };

  const handleUpdateStructureInput = (staffId, field, value) => {
    setSalaryStructures(prev => prev.map(s => s.staff_id === staffId ? { ...s, [field]: value } : s));
  };

  const handleSaveStructure = async (staffId) => {
    const struct = salaryStructures.find(s => s.staff_id === staffId);
    try {
      await axios.put(`${import.meta.env.VITE_API_URL}/api/salary/structures/${staffId}`, {
        basic_salary: struct.basic_salary,
        hourly_service_revenue_target: struct.hourly_service_revenue_target,
        ta: struct.ta,
        fa: struct.fa
      }, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
      toast.success(`${struct.staff_name}'s payroll config updated!`);
    } catch (err) { toast.error("Failed to update structure"); }
  };

  const handleCreateRun = async () => {
    try {
      const payload = { ...newRunData, centre_id: selectedCenter.id };
      const res = await axios.post(`${import.meta.env.VITE_API_URL}/api/salary/runs`, payload, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setSalaryRuns([res.data, ...salaryRuns]);
      setShowRunModal(false);
      toast.success("Draft Run Created. Ready to Generate.");
    } catch (err) { toast.error(err.response?.data?.error || "Failed to create run."); }
  };

  const handleGenerateRun = async (runId) => {
    const toastId = toast.loading("Calculating payroll...");
    try {
      await axios.post(`${import.meta.env.VITE_API_URL}/api/salary/runs/${runId}/generate`, {}, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      toast.update(toastId, { render: "Payroll Generated!", type: "success", isLoading: false, autoClose: 3000 });
      fetchSalaryRuns();
    } catch (err) { toast.update(toastId, { render: err.response?.data?.error || "Generation failed", type: "error", isLoading: false, autoClose: 5000 }); }
  };

  const handleDeleteRun = async (runId) => {
    if (!window.confirm("Delete this payroll run?")) return;
    try {
      await axios.delete(`${import.meta.env.VITE_API_URL}/api/salary/runs/${runId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      toast.success("Run deleted successfully");
      fetchSalaryRuns();
    } catch (err) { toast.error(err.response?.data?.error || "Failed to delete run"); }
  };

  const handleReviewRun = async (run) => {
    setSelectedRun(run);
    try {
      const res = await axios.get(`${import.meta.env.VITE_API_URL}/api/salary/runs/${run.id}/records`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setRunRecords(res.data);
      setShowReviewModal(true);
    } catch (err) { toast.error("Failed to load records"); }
  };

  const handleUpdateDeduction = async (recordId, newDeduction) => {
    try {
      const res = await axios.put(`${import.meta.env.VITE_API_URL}/api/salary/records/${recordId}`, { deductions: newDeduction }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setRunRecords(prev => prev.map(r => r.id === recordId ? { ...r, deductions: res.data.deductions, net_pay: res.data.net_pay } : r));
      toast.success("Deduction updated");
    } catch (err) { toast.error("Update failed"); }
  };

  const handleUpdateNetPay = async (recordId, newNetPay) => {
    try {
      const res = await axios.put(`${import.meta.env.VITE_API_URL}/api/salary/records/${recordId}/override-net-pay`, { net_pay: newNetPay }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setRunRecords(prev => prev.map(r => r.id === recordId ? { ...r, net_pay: res.data.net_pay } : r));
      toast.success("Final Net Pay adjusted!");
    } catch (err) { toast.error(err.response?.data?.error || "Failed to update Net Pay"); }
  };

  const handleUpdateWorkedHours = async (recordId, newHours) => {
    try {
      const res = await axios.put(`${import.meta.env.VITE_API_URL}/api/salary/records/${recordId}/override-hours`, { override_hours: newHours }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setRunRecords(prev => prev.map(r => r.id === recordId ? { ...r, ...res.data } : r));
      toast.success("Hours overridden and salary recalculated!");
    } catch (err) { toast.error(err.response?.data?.error || "Failed to update hours"); }
  };

  const handleFinalizeRun = async () => {
    if (!window.confirm("Lock payroll? This prevents future recalculations.")) return;
    try {
      await axios.post(`${import.meta.env.VITE_API_URL}/api/salary/runs/${selectedRun.id}/finalize`, {}, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      toast.success("Payroll Finalized!");
      setShowReviewModal(false);
      fetchSalaryRuns();
    } catch (err) { toast.error("Failed to finalize"); }
  };

  const handlePayRecord = async (recordId) => {
    if (!selectedWalletId) return toast.error("Please select a wallet to debit from");
    try {
      await axios.post(`${import.meta.env.VITE_API_URL}/api/salary/records/${recordId}/pay`, { wallet_id: selectedWalletId }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setRunRecords(prev => prev.map(r => r.id === recordId ? { ...r, payment_status: 'paid' } : r));
      toast.success("Payment issued successfully");
    } catch (err) { toast.error(err.response?.data?.error || "Payment failed"); }
  };

  // ------------------- CALENDAR FUNCTIONS -------------------
  const handleAddCalendarEvent = async () => {
    if (!calendarEdit.date || !calendarEdit.type) return toast.error('Date and type are required');
    if (!selectedCenter) return toast.error('Please select a center first');
    
    try { 
      const ev = await addCalendarEvent({ 
        ...calendarEdit, 
        centre_id: selectedCenter.id 
      }); 
      
      // Update local state
      setCenterCalendars(prev => ({
        ...prev,
        [selectedCenter.id]: [...(prev[selectedCenter.id] || []), ev]
      }));
      
      setShowCalendarModal(false); 
      setCalendarEdit({ date: '', type: 'working', description: '', centre_id: '' }); 
      toast.success('Calendar event added'); 
    } catch { 
      toast.error('Failed to add calendar event'); 
    }
  };

  const handleEditCalendarEvent = (ev) => {
    setCalendarEdit({ 
      date: ev.date, 
      type: ev.type, 
      description: ev.description || '',
      centre_id: selectedCenter.id 
    });
    setShowCalendarModal(true);
  };

  const handleUpdateCalendarEvent = async (id, ev) => {
    try { 
      const upd = await updateCalendarEvent(id, ev); 
      // Update local state
      if (selectedCenter) {
        setCenterCalendars(prev => ({
          ...prev,
          [selectedCenter.id]: prev[selectedCenter.id].map(e => e.id === id ? upd : e)
        }));
      }
    } catch { 
      toast.error('Failed to update calendar event'); 
    }
  };

  const handleDeleteCalendarEvent = async (ev) => {
    if (window.confirm('Delete this calendar event?')) {
      try { 
        await deleteCalendarEventByCenter(selectedCenter.id,ev.id); 
        
        // Update local state
        if (selectedCenter) {
          setCenterCalendars(prev => ({
            ...prev,
            [selectedCenter.id]: prev[selectedCenter.id].filter(e => e.id !== ev.id)
          }));
        }
        
        toast.success('Calendar event deleted'); 
      } catch { 
        toast.error('Failed to delete calendar event'); 
      }
    }
  };

  // ------------------- CALCULATE STATS -------------------
  const stats = useMemo(() => {
    if (!selectedCenter || !centerStaff[selectedCenter.id]) {
      return {
        totalStaff: 0,
        activeStaff: 0,
        presentToday: 0,
        onLeaveToday: 0,
        totalSalary: 0,
        attendanceRate: 0,
        todayLateHours: 0,
        todayExtraHours: 0
      };
    }
    
    const staff = centerStaff[selectedCenter.id] || [];
    const attendance = centerAttendance[selectedCenter.id] || [];
    const today = new Date().toISOString().split('T')[0];
    const todayAtt = attendance.filter(a => normalizeDate(a.date) === today);
    
    const total = staff.length;
    const active = staff.filter(s => s.status === 'Active').length;
    const presentStaffIds = new Set(todayAtt.filter(a => a.status === 'present').map(a => a.staff_id));
    const present = presentStaffIds.size;
    const leave = todayAtt.filter(a => a.status.includes('leave')).length;
    const absent = todayAtt.filter(a => a.status === 'absent').length;
    // Calculate total base salary from the active staff list (Matches Admin view)
    const totalSal = staff.reduce((sum, st) => sum + (Number(st.salary) || 0), 0);
      
    let lateH = 0, extraH = 0, recWithSch = 0;
    todayAtt.forEach(r => {
      if (r.status === 'present') {
        const st = staff.find(s => s.id === r.staff_id);
        if (st) {
          const dev = calculateScheduleDeviations(r, st);
          if (dev.hasSchedule) { 
            lateH += dev.lateHours; 
            extraH += dev.extraHours; 
            recWithSch++; 
          }
        }
      }
    });
    
    return {
      totalStaff: total,
      activeStaff: active,
      presentToday: present,
      onLeaveToday: leave,
      totalSalary: Math.round(totalSal),
      attendanceRate: total ? Math.round((present / total) * 100) : 0,
      todayLateHours: Number(lateH.toFixed(2)),
      todayExtraHours: Number(extraH.toFixed(2))
    };
  }, [selectedCenter, centerStaff, centerAttendance, centerSalaries, selectedSalaryMonth]);

  // ------------------- RENDER -------------------
  if (loading && !selectedCenter) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 bg-purple-500 rounded-xl flex items-center justify-center">
                <FiGlobe className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Super Admin Dashboard</h1>
                <p className="text-gray-600">Multi-center attendance, salary, and leave management</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <select 
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                value={selectedMonth}
                onChange={e => setSelectedMonth(e.target.value)}
              >
                {monthOptions.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              <button className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
                <FiDownload className="h-4 w-4" />
                <span>Export</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Center Selection */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900">Select Center</h2>
            <p className="text-sm text-gray-600">{centers.length} centers available</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {centers.map(center => (
              <CenterCard 
                key={center.id}
                center={center}
                isSelected={selectedCenter?.id === center.id}
                onClick={() => setSelectedCenter(center)}
              />
            ))}
          </div>
        </div>

        {selectedCenter && (
          <>
            {/* Center Header */}
            <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">{selectedCenter.name}</h2>
                  <p className="text-gray-600">Managing data for selected center</p>
                </div>
                <div className="flex items-center space-x-3">
                  <span className={`px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-sm font-medium`}>
                    Active
                  </span>
                  <span className="text-sm text-gray-500">
                    Created: {new Date(selectedCenter.createdAt).toLocaleDateString('en-IN')}
                  </span>
                </div>
              </div>
            </div>

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

            {/* Dashboard Tab */}
            {activeTab === 'dashboard' && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                  <StatCard title="Total Staff" value={stats.totalStaff} subtitle={`${stats.activeStaff} active`} icon={FiUsers} color="bg-indigo-500" />
                  <StatCard title="Present Today" value={stats.presentToday} subtitle={`${stats.attendanceRate}% attendance`} icon={FiUserCheck} color="bg-emerald-500" />
                  <StatCard title="Late Hours Today" value={stats.todayLateHours} subtitle="Total late time" icon={FiUserX} color="bg-amber-500" />
                  <StatCard title="Extra Hours Today" value={stats.todayExtraHours} subtitle="Total overtime" icon={FiTrendingUp} color="bg-purple-500" />
                </div>

                <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-gray-900 flex items-center space-x-2">
                      <FiAlertCircle className="h-5 w-5 text-amber-600" />
                      <span>Pending Leave Applications</span>
                    </h3>
                    <span className="px-2.5 py-1 bg-amber-100 text-amber-800 rounded-full text-xs font-medium">
                      {(pendingLeaves[selectedCenter.id] || []).length} pending
                    </span>
                  </div>
                  <div className="space-y-3">
                    {(pendingLeaves[selectedCenter.id] || []).slice(0, 3).map(l => (
                      <div key={l.id} className="flex items-center justify-between py-3 border-b border-gray-100">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{l.staff_name}</p>
                          <p className="text-xs text-gray-500">
                            {l.type} • {new Date(l.from_date).toLocaleDateString('en-IN')} - {new Date(l.to_date).toLocaleDateString('en-IN')}
                          </p>
                        </div>
                        <button 
                          onClick={() => { 
                            setSelectedLeave(l); 
                            setShowLeaveActionModal(true); 
                          }} 
                          className="px-3 py-1 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm"
                        >
                          Review
                        </button>
                      </div>
                    ))}
                    {(pendingLeaves[selectedCenter.id] || []).length === 0 && (
                      <p className="text-sm text-gray-500 text-center py-4">No pending leave applications</p>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* Attendance Tab */}
            {activeTab === 'attendance' && (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
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

                {/* GROUPED BY DATE TABLE */}
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200 bg-gray-50">
                        <th className="py-3 px-6 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Date</th>
                        <th className="py-3 px-6 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Present</th>
                        <th className="py-3 px-6 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Absent / Leave</th>
                        <th className="py-3 px-6 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Total Late</th>
                        <th className="py-3 px-6 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Total Extra</th>
                        <th className="py-3 px-6 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Action</th>
                       </tr>
                    </thead>
                    <tbody>
                      {groupAttendanceByDate(
                        centerAttendance[selectedCenter.id] || [],
                        centerStaff[selectedCenter.id] || []
                      ).map(dateGroup => (
                        <DailyAttendanceRow 
                          key={dateGroup.date} 
                          dateGroup={dateGroup} 
                          onEdit={handleEditAttendance} 
                        />
                      ))}
                    </tbody>
                  </table>

                  {(centerAttendance[selectedCenter.id] || []).length === 0 && (
                    <div className="text-center py-8">
                      <FiFileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-500">No attendance records found for {formatMonthForDisplay(selectedMonth)}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Leave Tab */}
            {activeTab === 'leave' && (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="p-6 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-bold text-gray-900">Leave Management</h2>
                    <div className="flex items-center space-x-3">
                      <select 
                        className="border border-gray-300 rounded-lg px-3 py-2" 
                        value={selectedLeaveMonth} 
                        onChange={e => setSelectedLeaveMonth(e.target.value)}
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
                        {(pendingLeaves[selectedCenter.id] || []).length}
                      </span>
                    </p>
                    <p className="text-sm text-gray-600">
                      Showing all leave applications for: <span className="font-semibold">{formatMonthForDisplay(selectedLeaveMonth)}</span>
                    </p>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200 bg-gray-50">
                        <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase">Staff</th>
                        <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                        <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase">From Date</th>
                        <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase">To Date</th>
                        <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase">Reason</th>
                        <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                        <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase">Applied On</th>
                        <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(centerLeaves[selectedCenter.id] || []).map(l => (
                        <LeaveApplicationRow key={l.id} application={l} handleLeaveAction={handleLeaveAction} />
                      ))}
                    </tbody>
                  </table>
                  
                  {(centerLeaves[selectedCenter.id] || []).length === 0 && (
                    <div className="text-center py-8">
                      <FiFileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-500">No leave applications found for {formatMonthForDisplay(selectedLeaveMonth)}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* NEW PAYROLL BATCH UI */}
            {activeTab === 'salary' && (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="p-6 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">Payroll Runs</h2>
                    <p className="text-gray-500 text-sm mt-1">Manage monthly salary calculations and batches.</p>
                  </div>
                  <div className="flex items-center space-x-3">
                    <button 
                      onClick={fetchSalaryStructures} 
                      className="flex items-center space-x-2 px-4 py-2 border border-gray-300 text-gray-700 bg-white rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
                    >
                      <FiSettings className="h-4 w-4" /><span>Payroll Config</span>
                    </button>
                    <button 
                      onClick={() => setShowRunModal(true)} 
                      className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
                    >
                      <FiPlus className="h-4 w-4" /><span>Create New Run</span>
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200 bg-white">
                        <th className="py-3 px-6 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Payroll Month</th>
                        <th className="py-3 px-6 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Target Days</th>
                        <th className="py-3 px-6 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                        <th className="py-3 px-6 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                        <th className="py-3 px-6 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {salaryRuns.map((run) => (
                        <tr key={run.id} className="hover:bg-gray-50 transition-colors">
                          <td className="py-4 px-6 font-bold text-gray-900">{formatMonthForDisplay(run.payroll_month.substring(0,7))}</td>
                          <td className="py-4 px-6 text-sm text-gray-600">{run.days_targeted} days</td>
                          <td className="py-4 px-6 text-sm text-gray-600">{new Date(run.created_at).toLocaleDateString('en-IN')}</td>
                          <td className="py-4 px-6">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                              run.status === 'finalized' ? 'bg-emerald-100 text-emerald-800' : 
                              run.status === 'generated' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'
                            }`}>
                              {run.status}
                            </span>
                          </td>
                          <td className="py-4 px-6 text-right">
                            <div className="flex items-center justify-end space-x-2">
                              {run.status === 'draft' ? (
                                <button onClick={() => handleGenerateRun(run.id)} className="text-sm px-4 py-2 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg font-medium transition">
                                  Generate
                                </button>
                              ) : (
                                <button onClick={() => handleReviewRun(run)} className="text-sm px-4 py-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg font-medium transition">
                                  Review & Pay
                                </button>
                              )}
                              
                              {run.status !== 'finalized' && (
                                <button 
                                  onClick={() => handleDeleteRun(run.id)} 
                                  className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                                  title="Delete Run"
                                >
                                  <FiTrash2 className="h-5 w-5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                      {salaryRuns.length === 0 && (
                        <tr>
                          <td colSpan="5" className="py-12 text-center text-gray-500">
                            <FiFileText className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                            No payroll runs found for {selectedCenter.name}.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Calendar Tab */}
              {activeTab === 'calendar' && selectedCenter && (
                <CalendarView
                  centerId={selectedCenter.id}
                  calendarData={centerCalendars[selectedCenter.id] || []}
                  leavesData={centerLeaves[selectedCenter.id] || []}
                  onAddEvent={(centreId) => {
                    setCalendarEdit({
                      date: '',
                      type: 'working',
                      description: '',
                      centre_id: centreId
                    });
                    setShowCalendarModal(true);
                  }}
                  onEditEvent={handleEditCalendarEvent}
                  onDeleteEvent={handleDeleteCalendarEvent}
                  onUpdateEvent={handleUpdateCalendarEvent}
                />
              )}
          </>
        )}

        {/* No Center Selected */}
        {!selectedCenter && centers.length > 0 && (
          <div className="text-center py-12">
            <FiGrid className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-gray-900 mb-2">Select a Center</h3>
            <p className="text-gray-600">Please select a center from the list above to view and manage data.</p>
          </div>
        )}

        {!selectedCenter && centers.length === 0 && (
          <div className="text-center py-12">
            <FiGrid className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-gray-900 mb-2">No Centers Found</h3>
            <p className="text-gray-600">There are no centers available to manage.</p>
          </div>
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

      {/* Create Run Modal (Preview & Override) */}
      <AnimatePresence>
        {showRunModal && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-4 z-50">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white rounded-xl p-6 max-w-md w-full shadow-2xl">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold text-gray-900">Initiate Payroll Batch</h3>
                <button onClick={() => setShowRunModal(false)} className="p-2 hover:bg-gray-100 rounded-lg"><FiX /></button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Select Payroll Month</label>
                  <select value={newRunData.payroll_month} onChange={e => setNewRunData({...newRunData, payroll_month: e.target.value})} className="w-full border-gray-300 rounded-lg p-3 bg-gray-50 text-gray-900 font-medium focus:ring-2 focus:ring-indigo-500 outline-none">
                    {monthOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                  </select>
                </div>
                
                {newRunData.is_loading ? (
                  <div className="py-8 text-center text-gray-500"><FiRefreshCw className="animate-spin h-6 w-6 mx-auto mb-2" /> Syncing with Calendar...</div>
                ) : (
                  <>
                    <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-100 mt-4">
                    <p className="text-sm text-indigo-800 font-medium mb-3">
                        <FiCalendar className="inline mr-2" />
                        Evaluating performance for <strong className="uppercase">{formatMonthForDisplay(newRunData.payroll_month)}</strong>. Values synced from calendar.
                      </p>
                      <div className="grid grid-cols-2 gap-4">
                        <div><label className="block text-xs font-bold text-indigo-900 mb-1">Calendar Days</label><input type="number" value={newRunData.calendar_days} onChange={e => setNewRunData({...newRunData, calendar_days: e.target.value})} className="w-full border-indigo-200 rounded-lg p-2 bg-white font-semibold" /></div>
                        <div><label className="block text-xs font-bold text-indigo-900 mb-1">Duty Leaves (DL)</label><input type="number" value={newRunData.dl_days} onChange={e => setNewRunData({...newRunData, dl_days: e.target.value})} className="w-full border-indigo-200 rounded-lg p-2 bg-white font-semibold" /></div>
                        <div><label className="block text-xs font-bold text-indigo-900 mb-1">Sundays</label><input type="number" value={newRunData.sundays} onChange={e => setNewRunData({...newRunData, sundays: e.target.value})} className="w-full border-indigo-200 rounded-lg p-2 bg-white font-semibold" /></div>
                        <div><label className="block text-xs font-bold text-indigo-900 mb-1">Other Offdays</label><input type="number" value={newRunData.other_offdays} onChange={e => setNewRunData({...newRunData, other_offdays: e.target.value})} className="w-full border-indigo-200 rounded-lg p-2 bg-white font-semibold" /></div>
                      </div>
                    </div>
                    
                    <div className="pt-2 text-right text-base font-black text-gray-900 flex justify-between items-center">
                      <span className="text-sm text-gray-500 font-medium">Final Target Working Days:</span>
                      <span className="bg-gray-100 px-3 py-1 rounded-md border border-gray-200">
                        {Number(newRunData.calendar_days) - (Number(newRunData.sundays) + Number(newRunData.dl_days) + Number(newRunData.other_offdays))} Days
                      </span>
                    </div>
                  </>
                )}
              </div>
              <button 
                onClick={handleCreateRun} 
                disabled={newRunData.is_loading}
                className="w-full mt-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-bold transition shadow-sm disabled:opacity-50"
              >
                Create Batch
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Review & Pay Data Grid Modal */}
      <AnimatePresence>
        {showReviewModal && selectedRun && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-4 z-50">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="bg-white rounded-xl w-full max-w-[95vw] max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
              <div className="p-6 border-b border-gray-200 flex justify-between items-center bg-gray-50 shrink-0">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Payroll Review: {formatMonthForDisplay(selectedRun.payroll_month.substring(0,7))}</h3>
                  <p className="text-sm text-gray-500 mt-1">Status: <span className="uppercase font-bold text-indigo-600 ml-1">{selectedRun.status}</span></p>
                </div>
                <div className="flex items-center space-x-4">
                  {selectedRun.status === 'generated' && (
                    <button onClick={handleFinalizeRun} className="px-5 py-2.5 bg-emerald-600 text-white font-medium rounded-lg hover:bg-emerald-700 shadow-sm transition">
                      Lock & Finalize Payroll
                    </button>
                  )}
                  {selectedRun.status === 'finalized' && (
                    <div className="flex items-center space-x-2 border-l border-gray-300 pl-4">
                      <select value={selectedWalletId} onChange={(e) => setSelectedWalletId(e.target.value)} className="border-gray-300 rounded-lg p-2.5 text-sm bg-white shadow-sm">
                        <option value="">-- Select Disbursement Wallet --</option>
                        {wallets.map((w) => <option key={w.id} value={w.id}>{w.name} (₹{w.balance})</option>)}
                      </select>
                    </div>
                  )}
                  <button onClick={() => setShowReviewModal(false)} className="p-2.5 text-gray-500 hover:bg-gray-200 rounded-lg transition"><FiX className="h-6 w-6" /></button>
                </div>
              </div>

              <div className="overflow-auto grow p-0">
                <table className="w-full text-sm text-left whitespace-nowrap">
                  <thead className="text-xs text-gray-500 uppercase bg-gray-100 border-b border-gray-200 sticky top-0 z-20">
                    <tr>
                      <th className="py-3 px-4 sticky left-0 bg-gray-100 z-30 border-r border-gray-200" rowSpan="2">Staff Name</th>
                      <th className="py-2 px-4 text-center border-b border-r border-gray-200 bg-blue-50/50" colSpan="2">Base Rates (₹)</th>
                      <th className="py-2 px-4 text-center border-b border-r border-gray-200" colSpan="3">Hours Performance</th>
                      <th className="py-2 px-4 text-center border-b border-r border-gray-200 bg-emerald-50/50" colSpan="3">Service Charge Earned</th>
                      <th className="py-2 px-4 text-center border-b border-r border-gray-200 bg-indigo-50/30" colSpan="7">Earnings Breakdown (₹)</th>
                      {/* REORDERED & FIXED HEADERS */}
                      <th className="py-3 px-4 text-right align-bottom border-r border-gray-200" rowSpan="2">Deductions</th>
                      <th className="py-3 px-4 text-right align-bottom border-r border-gray-200" rowSpan="2">Payment</th>
                      <th className="py-3 px-4 text-right align-bottom border-r border-gray-200" rowSpan="2">Net Pay</th>
                      <th className="py-3 px-4 text-center align-bottom" rowSpan="2">Action</th>
                    </tr>
                    <tr>
                      <th className="py-2 px-3 border-l border-gray-200 bg-blue-50/50">Per Day</th>
                      <th className="py-2 px-3 border-r border-gray-200 bg-blue-50/50">Per Hour</th>
                      <th className="py-2 px-3">Target</th>
                      <th className="py-2 px-3">Worked</th>
                      <th className="py-2 px-3 border-r border-gray-200">%</th>
                      <th className="py-2 px-3 bg-emerald-50/50">Target</th>
                      <th className="py-2 px-3 bg-emerald-50/50">Actual Earned</th>
                      <th className="py-2 px-3 border-r border-gray-200 bg-emerald-50/50">Col %</th>
                      <th className="py-2 px-3 text-indigo-600">Bonus %</th>
                      <th className="py-2 px-3">Basic Pay</th>
                      <th className="py-2 px-3">Bonus</th>
                      <th className="py-2 px-3">Offday Pay</th>
                      <th className="py-2 px-3">TA</th>
                      <th className="py-2 px-3">FA</th>
                      <th className="py-2 px-3 border-r border-gray-200">Total Gross</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {[...runRecords]
                      .sort((a, b) => (a.staff_name || "").localeCompare(b.staff_name || ""))
                      .map((r) => {
                      
                      const basicSalary = Number(r.snapshot_basic_salary || r.basic_pay || 0);
                      const calendarDays = Number(selectedRun.calendar_days || 30);
                      const basicPayPerDay = calendarDays > 0 ? basicSalary / calendarDays : 0;
                      
                      const dailyHours = Number(r.snapshot_daily_hours || 9);
                      const basicPayPerHour = dailyHours > 0 ? basicPayPerDay / dailyHours : 0;
                      
                      const ta = Number(r.ta_pay || r.ta || 0);
                      const fa = Number(r.fa_pay || r.fa || 0);
                      const off = Number(r.paid_offdays || 0);
                      
                      const workPct = Number(r.working_hours_percent || 0);
                      const isFull = workPct >= 100;
                      const offdaysCount = Number(selectedRun.sundays || 0) + Number(selectedRun.dl_days || 0) + Number(selectedRun.other_offdays || 0);
                      const surplus = Math.max(0, Number(r.achieved_service_revenue || 0) - Number(r.total_monthly_target || 0));

                      const basicTooltip = `${Number(r.total_worked_hours || 0).toFixed(1)} Worked Hrs × ₹${basicPayPerHour.toFixed(2)}/hr`;
                      const bonusTooltip = `${Number(r.bonus_percent || 0).toFixed(1)}% × ₹${surplus.toLocaleString()} (Surplus Service Charge)`;
                      const offdayTooltip = isFull 
                          ? `${offdaysCount} Offdays × ₹${basicPayPerDay.toFixed(2)}/day\n(100%+ attendance)` 
                          : `${offdaysCount} Offdays × ₹${basicPayPerDay.toFixed(2)}/day × ${workPct.toFixed(1)}%\n(Prorated due to <100% attendance)`;
                      const taTooltip = isFull ? "100%+ attendance (Full TA)" : `Prorated at ${workPct.toFixed(1)}% attendance`;
                      const faTooltip = isFull ? "100%+ attendance (Full FA)" : `Prorated at ${workPct.toFixed(1)}% attendance`;
                      
                      return (
                        <tr key={r.id} className="hover:bg-gray-50 transition-colors bg-white group">
                          <td className="py-3 px-4 sticky left-0 bg-white group-hover:bg-gray-50 shadow-[1px_0_0_0_#e5e7eb] z-10 border-r border-gray-100">
                            <div className="font-bold text-gray-900">{r.staff_name}</div>
                            <div className="text-[11px] text-indigo-600 font-bold mt-0.5 uppercase tracking-wider">
                              Shift: {Number(r.snapshot_daily_hours || 9).toFixed(1)}h / Day
                            </div>
                          </td>
                          <td className="py-3 px-3 text-blue-700 font-medium bg-blue-50/20 border-l border-gray-100">₹{basicPayPerDay.toFixed(2)}</td>
                          <td className="py-3 px-3 text-blue-700 font-medium bg-blue-50/20 border-r border-gray-100">₹{basicPayPerHour.toFixed(2)}</td>
                          <td className="py-3 px-3 text-gray-500">{Number(r.total_targeted_hours || 0).toFixed(1)}h</td>
                          
                          <td className="py-2 px-3 bg-blue-50/10">
                            {selectedRun.status === 'generated' ? (
                              <div className="flex items-center">
                                <input 
                                  type="number" 
                                  defaultValue={Number(r.total_worked_hours || 0).toFixed(1)}
                                  onBlur={(e) => handleUpdateWorkedHours(r.id, e.target.value)}
                                  className="w-20 text-right p-1.5 border border-blue-200 rounded text-blue-700 font-bold text-sm focus:ring-1 focus:ring-blue-500 bg-white shadow-sm"
                                  step="0.1"
                                />
                                <span className="ml-1 text-gray-500 text-xs font-medium">h</span>
                              </div>
                            ) : (
                              <span className="font-medium text-gray-900 block px-1">{Number(r.total_worked_hours || 0).toFixed(1)}h</span>
                            )}
                          </td>
                          
                          <td className="py-3 px-3 border-r border-gray-100"><span className={`font-bold ${Number(r.working_hours_percent || 0) >= 100 ? 'text-emerald-600' : 'text-amber-600'}`}>{Number(r.working_hours_percent || 0).toFixed(1)}%</span></td>
                          <td className="py-3 px-3 text-gray-500">₹{Number(r.total_monthly_target || 0).toLocaleString()}</td>
                          <td className="py-3 px-3 font-medium text-gray-900">₹{Number(r.achieved_service_revenue || 0).toLocaleString()}</td>
                          <td className="py-3 px-3 border-r border-gray-100 bg-emerald-50/30"><span className={`font-bold ${Number(r.revenue_percent || 0) >= 100 ? 'text-emerald-600' : 'text-amber-600'}`}>{Number(r.revenue_percent || 0).toFixed(1)}%</span></td>
                          <td className="py-3 px-3 text-indigo-600 font-bold bg-indigo-50/50">{Number(r.bonus_percent || 0).toFixed(1)}%</td>
                          <td className="py-3 px-3 text-gray-700">
                            <div className="flex items-center justify-between cursor-help" title={basicTooltip}>
                              <span>₹{Number(r.basic_pay || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                              <FiInfo className="h-3.5 w-3.5 text-gray-400 hover:text-indigo-500" />
                            </div>
                          </td>
                          <td className="py-3 px-3 text-emerald-600 font-bold">
                            <div className="flex items-center justify-between cursor-help" title={bonusTooltip}>
                              <span>₹{Number(r.bonus || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                              <FiInfo className="h-3.5 w-3.5 text-emerald-400 hover:text-emerald-600" />
                            </div>
                          </td>
                          <td className="py-3 px-3 text-gray-700">
                            <div className="flex items-center justify-between cursor-help" title={offdayTooltip}>
                              <span>₹{off.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                              <FiInfo className="h-3.5 w-3.5 text-gray-400 hover:text-indigo-500" />
                            </div>
                          </td>
                          <td className="py-3 px-3 text-gray-700">
                            <div className="flex items-center justify-between cursor-help" title={taTooltip}>
                              <span>₹{ta.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                              <FiInfo className="h-3.5 w-3.5 text-gray-400 hover:text-indigo-500" />
                            </div>
                          </td>
                          <td className="py-3 px-3 text-gray-700">
                            <div className="flex items-center justify-between cursor-help" title={faTooltip}>
                              <span>₹{fa.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                              <FiInfo className="h-3.5 w-3.5 text-gray-400 hover:text-indigo-500" />
                            </div>
                          </td>
                          <td className="py-3 px-3 font-bold text-gray-900 border-r border-gray-100 bg-gray-50/50">
                            ₹{Number(r.full_pay || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          
                          {/* 1. DEDUCTIONS (Editable) */}
                          <td className="py-2 px-3 border-r border-gray-100 bg-red-50/20">
                            {selectedRun.status === 'generated' ? (
                              <input 
                                type="number" 
                                defaultValue={r.deductions}
                                onBlur={(e) => handleUpdateDeduction(r.id, e.target.value)}
                                className="w-24 text-right p-1.5 border border-red-200 rounded text-red-700 font-medium text-sm focus:ring-1 focus:ring-red-500"
                              />
                            ) : (
                              <span className="text-red-600 font-medium block text-right pr-2">₹{Number(r.deductions || 0).toLocaleString()}</span>
                            )}
                          </td>
                          
                          {/* 2. PAYMENT (Calculated: Total Gross - Deductions) */}
                          <td className="py-3 px-3 text-right font-bold text-gray-900 border-r border-gray-100 bg-gray-50/50">
                            ₹{(Number(r.full_pay || 0) - Number(r.deductions || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>

                          {/* 3. NET PAY (Final Admin Override) */}
                          <td className="py-2 px-3 text-right bg-emerald-50/30 border-r border-gray-100">
                            {selectedRun.status === 'generated' ? (
                              <div className="flex items-center justify-end">
                                <span className="text-gray-500 font-bold mr-1">₹</span>
                                <input 
                                  type="number" 
                                  defaultValue={Number(r.net_pay || 0).toFixed(0)}
                                  onBlur={(e) => handleUpdateNetPay(r.id, e.target.value)}
                                  className="w-24 text-right p-1.5 border border-emerald-200 rounded text-emerald-700 font-black text-base focus:ring-1 focus:ring-emerald-500 bg-white shadow-sm"
                                />
                              </div>
                            ) : (
                              <span className="font-black text-gray-900 text-base block px-2">₹{Number(r.net_pay || 0).toLocaleString()}</span>
                            )}
                          </td>
                          
                          {/* 4. ACTION (Status / Issue Pay Button) */}
                          <td className="py-3 px-4 text-center bg-gray-50/50">
                            {r.payment_status === 'paid' ? (
                              <span className="px-3 py-1.5 bg-emerald-100 text-emerald-800 rounded-md text-xs font-bold">Paid</span>
                            ) : selectedRun.status === 'finalized' ? (
                              <button onClick={() => handlePayRecord(r.id)} className="px-4 py-1.5 bg-indigo-600 text-white hover:bg-indigo-700 rounded-md text-xs font-bold transition shadow-sm">
                                Issue Pay
                              </button>
                            ) : (
                              <span className="text-xs text-gray-400 font-medium">Pending Finalization</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Payroll Configuration Modal (Bulk Editor) */}
      <AnimatePresence>
        {showStructuresModal && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-4 z-50">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white rounded-xl w-full max-w-5xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
              <div className="p-6 border-b border-gray-200 flex justify-between items-center bg-gray-50 shrink-0">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Staff Payroll Configuration</h3>
                  <p className="text-sm text-gray-500 mt-1">Set Base Salary, Target Revenue, TA, and FA per staff member.</p>
                </div>
                <button onClick={() => setShowStructuresModal(false)} className="p-2.5 text-gray-500 hover:bg-gray-200 rounded-lg transition"><FiX className="h-6 w-6" /></button>
              </div>
              
              <div className="overflow-auto grow p-0">
                <table className="w-full text-sm text-left whitespace-nowrap">
                  <thead className="text-xs text-gray-500 uppercase bg-gray-100 border-b border-gray-200 sticky top-0 z-20">
                    <tr>
                      <th className="py-3 px-4 sticky left-0 bg-gray-100 z-30 border-r border-gray-200 shadow-[1px_0_0_0_#e5e7eb]">Staff Name</th>
                      <th className="py-3 px-4">Basic Salary (₹)</th>
                      <th className="py-3 px-4">Hourly Target (₹)</th>
                      <th className="py-3 px-4">TA (₹)</th>
                      <th className="py-3 px-4">FA (₹)</th>
                      <th className="py-3 px-4 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {salaryStructures.map((s) => (
                      <tr key={s.staff_id} className="hover:bg-gray-50 bg-white">
                        <td className="py-3 px-4 font-bold text-gray-900 sticky left-0 bg-white border-r border-gray-100 shadow-[1px_0_0_0_#f3f4f6]">
                          {s.staff_name}
                        </td>
                        <td className="py-3 px-4">
                          <input type="number" value={s.basic_salary} onChange={e => handleUpdateStructureInput(s.staff_id, 'basic_salary', e.target.value)} className="w-32 border border-gray-300 rounded p-2 focus:ring-indigo-500 focus:outline-none" />
                        </td>
                        <td className="py-3 px-4">
                          <input type="number" value={s.hourly_service_revenue_target} onChange={e => handleUpdateStructureInput(s.staff_id, 'hourly_service_revenue_target', e.target.value)} className="w-32 border border-gray-300 rounded p-2 focus:ring-indigo-500 focus:outline-none" />
                        </td>
                        <td className="py-3 px-4">
                          <input type="number" value={s.ta} onChange={e => handleUpdateStructureInput(s.staff_id, 'ta', e.target.value)} className="w-24 border border-gray-300 rounded p-2 focus:ring-indigo-500 focus:outline-none" />
                        </td>
                        <td className="py-3 px-4">
                          <input type="number" value={s.fa} onChange={e => handleUpdateStructureInput(s.staff_id, 'fa', e.target.value)} className="w-24 border border-gray-300 rounded p-2 focus:ring-indigo-500 focus:outline-none" />
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button onClick={() => handleSaveStructure(s.staff_id)} className="px-4 py-2 bg-indigo-50 text-indigo-700 font-bold rounded-lg hover:bg-indigo-100 transition shadow-sm border border-indigo-200">
                            Save
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
                <h3 className="text-lg font-bold text-gray-900">Add Calendar Event</h3>
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

export default SuperAdminAttendance;
