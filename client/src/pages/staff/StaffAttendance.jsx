import React, { useState, useEffect, useMemo } from 'react';
import {
  FiClock, FiCalendar, FiDollarSign, FiUser, FiLogOut, FiLogIn,
  FiTrendingUp, FiBarChart2, FiPieChart, FiCheckCircle, FiAlertCircle,
  FiRefreshCw, FiDownload, FiPlus, FiEdit, FiTrash2, FiSend,
  FiHome, FiBriefcase, FiCoffee, FiFileText, FiSettings,
  FiChevronDown, FiChevronUp, FiFilter, FiSearch, FiX, FiArrowRight,
  FiClock as FiTime, FiUserCheck, FiUserX, FiWatch
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
  getSalaryData,
  getLeaves,
  submitLeave,
  postAttendance,
  postBreak, getCalendarData
} from '/src/services/salaryService';
import CalendarView from '/src/components/CalendarView';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

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
// UTILITY FUNCTIONS
// ---------------------------------------------------------------------

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
  
  for (let i = 12; i >= 1; i--) {
    const date = new Date(now);
    date.setMonth(now.getMonth() - i);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const value = `${year}-${month}`;
    const label = formatMonthForDisplay(value);
    options.push({ value, label });
  }
  
  const currentValue = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
  options.push({ 
    value: currentValue, 
    label: `${formatMonthForDisplay(currentValue)} (Current)` 
  });
  
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

class ErrorBoundary extends React.Component {
  state = { hasError: false };

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error in StaffAttendance:', error, errorInfo);
  }

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

const normalizeDate = (dateStr) => {
  const d = new Date(dateStr);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatElapsedTime = (lastPunchTime) => {
  if (!lastPunchTime) return 'N/A';
  const now = new Date();
  const diffMs = now - new Date(lastPunchTime);
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  return `${diffHours}h ${diffMinutes}m`;
};

const validatePunchInTime = (time) => {
  if (!time) return false;
  const now = new Date();
  const [hours, minutes] = time.split(':').map(Number);
  
  const punchMinutes = hours * 60 + minutes;
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  
  // Allow a 30-minute buffer for network/device lag
  return Math.abs(currentMinutes - punchMinutes) <= 30;
};

const getMonthName = (monthStr) => {
  const [year, month] = monthStr.split('-').map(Number);
  const date = new Date(year, month - 1);
  return date.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
};

const StatCard = ({ title, value, icon: Icon, color, subtitle, trend }) => (
  <motion.div
    whileHover={{ y: -2 }}
    className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-lg transition-all duration-300"
  >
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
        <p className="text-2xl font-bold text-gray-900 mb-1">{value}</p>
        <p className="text-sm text-gray-500">{subtitle}</p>
        {trend !== undefined && (
          <p className={`text-xs font-medium ${trend > 0 ? 'text-emerald-600' : trend < 0 ? 'text-rose-600' : 'text-gray-600'}`}>
            {trend > 0 ? '+' : ''}{trend}% from previous month
          </p>
        )}
      </div>
      <div className={`p-3 rounded-xl ${color}`}>
        <Icon className="h-6 w-6 text-white" />
      </div>
    </div>
  </motion.div>
);

const PunchStatusCard = ({ punchStatus, lastPunchTime }) => (
  <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6 flex items-center justify-between">
    <div>
      <p className="text-sm font-medium text-gray-600">Punch Status</p>
      <p className="text-xl font-bold text-gray-900">
        {punchStatus === 'in' ? 'Punched In' : 'Punched Out'}
      </p>
      <p className="text-sm text-gray-500">
        {punchStatus === 'in' ? 'Time In (Elapsed)' : 'Time Out (Since)'}: {formatElapsedTime(lastPunchTime)}
      </p>
    </div>
    <div className={`p-3 rounded-xl ${punchStatus === 'in' ? 'bg-emerald-500' : 'bg-rose-500'}`}>
      {punchStatus === 'in' ? (
        <FiLogIn className="h-6 w-6 text-white" />
      ) : (
        <FiLogOut className="h-6 w-6 text-white" />
      )}
    </div>
  </div>
);

const AttendanceTrendChart = ({ attendance }) => {
  const relevantAttendance = useMemo(() => {
    const sorted = attendance.slice().sort((a, b) => new Date(a.date) - new Date(b.date));
    return sorted.slice(-7);
  }, [attendance]);

  const data = {
    labels: relevantAttendance.map(a => new Date(a.date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric' })),
    datasets: [
      {
        label: 'Work Hours',
        data: relevantAttendance.map(a => Number(a.hours) || 0),
        borderColor: 'rgb(99, 102, 241)',
        backgroundColor: 'rgba(99, 102, 241, 0.1)',
        tension: 0.4,
        fill: true,
      },
    ],
  };
  const options = {
    responsive: true,
    plugins: {
      legend: { position: 'top' },
      title: { display: true, text: 'Recent Work Hours Trend' },
    },
    scales: {
      y: {
        beginAtZero: true,
        max: 10,
        title: { display: true, text: 'Hours' },
      },
    },
  };
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900">Recent Trend</h3>
        <FiTrendingUp className="h-5 w-5 text-indigo-600" />
      </div>
      <div className="h-64">
        <Line data={data} options={options} />
      </div>
    </div>
  );
};

const AttendanceDistributionChart = ({ attendance, selectedMonth }) => {
  const currentMonthAttendance = attendance.filter(a => normalizeDate(a.date).startsWith(selectedMonth));
  
  const presentDays = [...new Set(currentMonthAttendance.filter(a => a.status === 'present').map(a => normalizeDate(a.date)))].length;
  const leaveDays = [...new Set(currentMonthAttendance.filter(a => a.status.includes('leave')).map(a => normalizeDate(a.date)))].length;
  const absentDays = [...new Set(currentMonthAttendance.filter(a => a.status === 'absent').map(a => normalizeDate(a.date)))].length;
  
  const data = {
    labels: ['Present', 'Leave', 'Absent/Unrecorded'],
    datasets: [
      {
        data: [presentDays, leaveDays, absentDays > 0 ? absentDays : 0],
        backgroundColor: ['rgba(16, 185, 129, 0.8)', 'rgba(245, 158, 11, 0.8)', 'rgba(239, 68, 68, 0.8)'],
        borderColor: ['rgb(16, 185, 129)', 'rgb(245, 158, 11)', 'rgb(239, 68, 68)'],
        borderWidth: 2,
      },
    ],
  };
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { position: 'right' } },
  };
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900">Attendance Distribution ({getMonthName(selectedMonth)})</h3>
        <FiPieChart className="h-5 w-5 text-indigo-600" />
      </div>
      <div className="h-64 relative">
        <Doughnut data={data} options={options} />
      </div>
    </div>
  );
};

const MonthlySalaryChart = ({ allSalaryData }) => {
  const sortedData = useMemo(() => {
    return allSalaryData
      .slice()
      .sort((a, b) => a.month.localeCompare(b.month))
      .filter(s => ['sent', 'viewed'].includes(s.status))
      .slice(-6);
  }, [allSalaryData]);
  const data = {
    labels: sortedData.map(item => getMonthName(item.month)),
    datasets: [
      {
        label: 'Net Salary',
        data: sortedData.map(item => Number(item.net_salary) || 0),
        backgroundColor: 'rgba(16, 185, 129, 0.8)',
        borderColor: 'rgb(16, 185, 129)',
        borderWidth: 2,
      },
    ],
  };
  const options = {
    responsive: true,
    plugins: {
      legend: { position: 'top' },
      title: { display: true, text: 'Salary Trend (Last 6 Months)' }
    },
    scales: {
      y: {
        beginAtZero: true,
        title: { display: true, text: 'Amount (₹)' }
      },
    },
  };
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900">Salary Trend</h3>
        <FiBarChart2 className="h-5 w-5 text-indigo-600" />
      </div>
      <div className="h-64">
        <Bar data={data} options={options} />
      </div>
    </div>
  );
};

const StaffAttendance = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [staff, setStaff] = useState(null);
  const [attendance, setAttendance] = useState([]);
  const [salaryData, setSalaryData] = useState([]);
  const [allSalaryData, setAllSalaryData] = useState([]);
  const [leaveApplications, setLeaveApplications] = useState([]);
  const [showPunchModal, setShowPunchModal] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [showBreakModal, setShowBreakModal] = useState(false);
  
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth());
  const [selectedLeaveMonth, setSelectedLeaveMonth] = useState(getCurrentMonth());
  
  const monthOptions = useMemo(() => generateMonthOptions(), []);

  const [punchForm, setPunchForm] = useState({
    punch_type: 'in',
    time: '',
    date: normalizeDate(new Date()),
    breaks: ''
  });
  const [breakForm, setBreakForm] = useState({
    attendance_id: null,
    break_time: ''
  });
  const [newLeave, setNewLeave] = useState({
    type: 'casual_leave',
    from_date: '',
    to_date: '',
    reason: '',
    leave_duration: 'full', 
    leave_time: ''          
  });
  
  const [punchStatus, setPunchStatus] = useState('out');
  const [lastPunchTime, setLastPunchTime] = useState(null);
  const [elapsedTime, setElapsedTime] = useState('N/A');

  const [calendarEvents, setCalendarEvents] = useState([]);

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedTime(formatElapsedTime(lastPunchTime));
    }, 60000);
    return () => clearInterval(interval);
  }, [lastPunchTime]);

  const fetchAllSalaryData = async () => {
    try {
      const allSalaries = await getSalaryData();
      setAllSalaryData(allSalaries);
      return allSalaries;
    } catch (error) {
      console.error('Error fetching all salary data:', error);
      toast.error('Failed to load salary history');
      return [];
    }
  };
  
  const fetchLeaveApplications = async (month) => {
    try {
      const leaves = await getLeaves(month);
      setLeaveApplications(leaves);
    } catch (error) {
      console.error('Error fetching leave applications:', error);
      toast.error('Failed to load leave applications.');
    }
  };

  const checkPunchStatus = (attendanceData) => {
    const today = normalizeDate(new Date());
    const todayRecords = attendanceData.filter(a => normalizeDate(a.date) === today);
    
    const openRecord = todayRecords.find(r => r.punch_in && !r.punch_out);

    if (openRecord) {
      setPunchStatus('in');
      setLastPunchTime(`${today}T${openRecord.punch_in}`);
    } else {
      setPunchStatus('out');
      const lastClosedRecord = todayRecords
        .filter(r => r.punch_out)
        .sort((a, b) => {
          const timeA = a.punch_out.split(':').map(Number);
          const timeB = b.punch_out.split(':').map(Number);
          return (timeA[0] * 60 + timeA[1]) - (timeB[0] * 60 + timeB[1]);
        })
        .pop();
      setLastPunchTime(lastClosedRecord?.punch_out ? `${today}T${lastClosedRecord.punch_out}` : null);
    }
  };

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const staffData = await getStaffList();
        setStaff(staffData[0]);
        
        const currentMonth = getCurrentMonth();
        const attendanceData = await getAllAttendance(currentMonth);
        setAttendance(attendanceData);

        // Fetch calendar data
        try {
          const calData = await getCalendarData(); 
          setCalendarEvents(calData);
        } catch (e) {
          console.error("Failed to load calendar", e);
        }
        
        const allSalaries = await fetchAllSalaryData();
        const currentMonthSalary = allSalaries.filter(s => s.month === currentMonth && ['sent', 'viewed'].includes(s.status));
        setSalaryData(currentMonthSalary);
        
        await fetchLeaveApplications(currentMonth);
        
        checkPunchStatus(attendanceData);

      } catch (error) {
        console.error('Error fetching initial data:', error);
        toast.error(error.response?.data?.error || 'Failed to load data. Please try again.');
      }
    };
    fetchInitialData();
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      if (!selectedMonth) return;
      try {
        const attendanceData = await getAllAttendance(selectedMonth);
        setAttendance(attendanceData);
        
        const currentMonthSalary = allSalaryData.filter(s => s.month === selectedMonth && ['sent', 'viewed'].includes(s.status));
        setSalaryData(currentMonthSalary);
        
        const today = normalizeDate(new Date());
        if (selectedMonth === today.slice(0, 7)) {
          checkPunchStatus(attendanceData);
        } else {
          setPunchStatus('out');
          setLastPunchTime(null);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
        toast.error(error.response?.data?.error || 'Failed to load data.');
      }
    };
    fetchData();
  }, [selectedMonth, allSalaryData]);

  useEffect(() => {
    if (activeTab === 'leave' && selectedLeaveMonth) {
      fetchLeaveApplications(selectedLeaveMonth);
    }
  }, [selectedLeaveMonth, activeTab]);

  // Update punch status when attendance changes for current month
  useEffect(() => {
    const today = normalizeDate(new Date());
    if (selectedMonth === today.slice(0, 7)) {
      checkPunchStatus(attendance);
    }
  }, [attendance, selectedMonth]);

  const stats = useMemo(() => {
    try {
      const currentMonthAttendance = attendance.filter(a => normalizeDate(a.date).startsWith(selectedMonth));
      
      const presentDays = [...new Set(currentMonthAttendance.filter(a => a.status === 'present').map(a => normalizeDate(a.date)))].length;
      const totalHours = currentMonthAttendance.reduce((sum, a) => sum + (Number(a.hours) || 0), 0);
      const avgHours = presentDays > 0 ? Number((totalHours / presentDays).toFixed(1)) : 0;
      const leaveDays = [...new Set(currentMonthAttendance.filter(a => a.status.includes('leave')).map(a => normalizeDate(a.date)))].length;

      const sortedSalaries = allSalaryData
        .filter(s => ['sent', 'viewed'].includes(s.status))
        .slice()
        .sort((a, b) => b.month.localeCompare(a.month));
      
      const latestSalaryRecord = sortedSalaries[0];
      const previousSalaryRecord = sortedSalaries[1];

      const currentSalary = latestSalaryRecord ? Number(latestSalaryRecord.net_salary) : 0;
      const previousSalary = previousSalaryRecord ? Number(previousSalaryRecord.net_salary) : 0;
      const currentSalaryMonth = latestSalaryRecord ? latestSalaryRecord.month : '';

      let salaryGrowth = 0;
      if (previousSalary > 0 && currentSalary > 0) {
        salaryGrowth = Number(((currentSalary - previousSalary) / previousSalary * 100).toFixed(1));
      } else if (currentSalary > 0 && previousSalary === 0) {
        salaryGrowth = 100;
      } else if (currentSalary === 0 && previousSalary > 0) {
        salaryGrowth = -100;
      }

      return {
        presentDays,
        totalHours: Number(totalHours).toFixed(1),
        avgHours,
        leaveDays,
        currentSalary,
        currentSalaryMonth,
        salaryGrowth,
      };
    } catch (error) {
      console.error('Error calculating stats:', error);
      return {
        presentDays: 0,
        totalHours: '0.0',
        avgHours: '0.0',
        leaveDays: 0,
        currentSalary: 0,
        currentSalaryMonth: '',
        salaryGrowth: 0,
      };
    }
  }, [attendance, allSalaryData, selectedMonth]);

  const handlePunchSubmit = async () => {
    try {
      const now = new Date();
      
      // 1. Get current time in local format (HH:mm) - using padStart for reliability
      const currentHH = String(now.getHours()).padStart(2, '0');
      const currentMM = String(now.getMinutes()).padStart(2, '0');
      const currentTime = `${currentHH}:${currentMM}`;
      
      // 2. Get normalized current date (YYYY-MM-DD)
      const currentDate = normalizeDate(now);
  
      // 3. Determine the actual time to send
      // For 'out', we ALWAYS force the current local time.
      // For 'in', we use the manual form time if provided, otherwise current time.
      const finalTime = punchForm.punch_type === 'out' 
        ? currentTime 
        : (punchForm.time || currentTime);
  
      // 4. Validate for Punch In against a 30-minute buffer (to match backend)
      if (punchForm.punch_type === 'in') {
        if (!validatePunchInTime(finalTime)) {
          toast.error('Punch-in time must be within 30 minutes of current time.');
          return;
        }
      }
  
      // 5. Construct the payload
      const punchData = {
        ...punchForm,
        time: finalTime,
        date: currentDate 
      };
  
      const response = await postAttendance(punchData);
  
      // 6. Update attendance state
      setAttendance(prev => {
        const isPunchOut = response.punch_out !== null;
        if (isPunchOut) {
          // Update the existing record with punch-out data
          return prev.map(a => (a.id === response.id ? response : a));
        } else {
          // Add new punch-in record if it doesn't exist
          const existingIds = new Set(prev.map(r => r.id));
          return !existingIds.has(response.id) ? [response, ...prev] : prev;
        }
      });
  
      // 7. Update Punch Status UI directly from the response
      if (response.punch_in && !response.punch_out) {
        setPunchStatus('in');
        setLastPunchTime(`${currentDate}T${response.punch_in}`);
      } else if (response.punch_out) {
        setPunchStatus('out');
        setLastPunchTime(`${currentDate}T${response.punch_out}`);
      }
  
      // 8. Cleanup and UI feedback
      setShowPunchModal(false);
      setPunchForm({ 
        punch_type: 'in', 
        time: '', 
        date: currentDate, 
        breaks: '' 
      });
      
      toast.success(`Punch ${punchData.punch_type === 'in' ? 'In' : 'Out'} recorded!`);
      
    } catch (error) {
      console.error('Error recording punch:', error);
      // This displays the exact error message sent by the backend (e.g., "Time mismatch")
      const serverError = error.response?.data?.error || 'Failed to record punch.';
      toast.error(serverError);
    }
  };

  const handleBreakSubmit = async () => {
    try {
      if (!/^\d{2}:\d{2}-\d{2}:\d{2}$/.test(breakForm.break_time)) {
        throw new Error('Invalid break time format. Use HH:MM-HH:MM');
      }
      
      const response = await postBreak(breakForm);
      
      setAttendance(prev => prev.map(item => (item.id === response.id ? response : item)));
      setShowBreakModal(false);
      setBreakForm({ attendance_id: null, break_time: '' });
      toast.success('Break recorded successfully!');
    } catch (error) {
      console.error('Error recording break:', error);
      toast.error(error.response?.data?.error || 'Failed to record break: ' + error.message);
    }
  };

  const handleLeaveSubmit = async () => {
    try {
      if (!newLeave.type || !newLeave.from_date || !newLeave.to_date || !newLeave.reason) {
        throw new Error('All leave fields are required');
      }
      const newApplication = await submitLeave(newLeave);
      
      const newLeaveMonth = normalizeDate(newApplication.from_date).slice(0, 7);
      if (newLeaveMonth === selectedLeaveMonth) {
        setLeaveApplications(prev => [newApplication, ...prev]);
      } else {
        toast.info(`Application submitted for ${formatMonthForDisplay(newLeaveMonth)}. Switch month to view.`);
      }
      
      setShowLeaveModal(false);
      setNewLeave({ type: 'casual_leave', from_date: '', to_date: '', reason: '', leave_duration: 'full', leave_time: '' });
      toast.success('Leave application submitted!');
    } catch (error) {
      console.error('Error submitting leave:', error);
      toast.error(error.response?.data?.error || error.message || 'Failed to submit leave application.');
    }
  };

  const handleDownloadPayslip = async (salary) => {
    toast.info("Generating Payslip PDF...");
    
    // Create a temporary hidden div to hold the payslip design
    const payslipDiv = document.createElement("div");
    payslipDiv.id = "payslip-pdf-container";
    payslipDiv.style.width = "800px";
    payslipDiv.style.padding = "40px";
    payslipDiv.style.backgroundColor = "white";
    payslipDiv.style.position = "absolute";
    payslipDiv.style.left = "-9999px"; // Keep it off-screen
    
    payslipDiv.innerHTML = `
      <div style="font-family: Arial, sans-serif; color: #333;">
        <div style="text-align: center; border-bottom: 2px solid #4f46e5; padding-bottom: 20px; margin-bottom: 30px;">
          <h1 style="color: #4f46e5; margin: 0; font-size: 28px;">AKSHAYA CRM</h1>
          <p style="margin: 5px 0 0 0; color: #666; font-size: 14px;">Official Payslip Statement</p>
        </div>
        
        <div style="display: flex; justify-content: space-between; margin-bottom: 30px;">
          <div>
            <p><strong>Employee Name:</strong> ${staff?.name || 'N/A'}</p>
            <p><strong>Employee ID:</strong> ${staff?.employeeId || 'N/A'}</p>
            <p><strong>Department:</strong> ${staff?.department || 'N/A'}</p>
          </div>
          <div style="text-align: right;">
            <p><strong>Salary Month:</strong> ${getMonthName(salary.month)}</p>
            <p><strong>Working Days:</strong> ${salary.working_days}</p>
            <p><strong>Present Days:</strong> ${salary.present_days}</p>
          </div>
        </div>

        <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
          <thead>
            <tr style="background-color: #f3f4f6;">
              <th style="padding: 12px; border: 1px solid #d1d5db; text-align: left;">Earnings</th>
              <th style="padding: 12px; border: 1px solid #d1d5db; text-align: right;">Amount (₹)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="padding: 12px; border: 1px solid #d1d5db;">Basic Salary</td>
              <td style="padding: 12px; border: 1px solid #d1d5db; text-align: right;">${Number(salary.basic).toLocaleString('en-IN')}</td>
            </tr>
            <tr>
              <td style="padding: 12px; border: 1px solid #d1d5db;">HRA</td>
              <td style="padding: 12px; border: 1px solid #d1d5db; text-align: right;">${Number(salary.hra).toLocaleString('en-IN')}</td>
            </tr>
            <tr>
              <td style="padding: 12px; border: 1px solid #d1d5db;">Other Allowances</td>
              <td style="padding: 12px; border: 1px solid #d1d5db; text-align: right;">${Number(salary.other_allowances).toLocaleString('en-IN')}</td>
            </tr>
            <tr>
              <td style="padding: 12px; border: 1px solid #d1d5db; color: #dc2626;"><strong>Deductions</strong></td>
              <td style="padding: 12px; border: 1px solid #d1d5db; text-align: right; color: #dc2626;">-${Number(salary.deductions).toLocaleString('en-IN')}</td>
            </tr>
            <tr style="background-color: #f3f4f6; font-weight: bold;">
              <td style="padding: 12px; border: 1px solid #d1d5db; font-size: 16px;">Net Salary Payable</td>
              <td style="padding: 12px; border: 1px solid #d1d5db; text-align: right; font-size: 16px; color: #059669;">₹${Number(salary.net_salary).toLocaleString('en-IN')}</td>
            </tr>
          </tbody>
        </table>
        
        <div style="margin-top: 50px; text-align: center; color: #888; font-size: 12px;">
          <p>This is a system generated document and does not require a physical signature.</p>
          <p>Generated on ${new Date().toLocaleDateString('en-IN')}</p>
        </div>
      </div>
    `;

    document.body.appendChild(payslipDiv);

    try {
      const canvas = await html2canvas(payslipDiv, { scale: 2 });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Payslip_${staff?.name.replace(/\s+/g, '_')}_${salary.month}.pdf`);
      toast.success("Payslip downloaded successfully!");
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast.error("Failed to generate PDF. Please try again.");
    } finally {
      document.body.removeChild(payslipDiv); // Clean up
    }
  };

  const AttendanceRow = ({ record }) => (
    <tr key={record.id || `${record.staff_id}-${record.date}`} className="border-b border-gray-200 hover:bg-gray-50 transition-colors">
      <td className="py-4 px-4">
        <p className="text-sm font-medium text-gray-900">
          {new Date(record.date).toLocaleDateString('en-IN', {
            weekday: 'short',
            day: '2-digit',
            month: 'short'
          })}
        </p>
      </td>
      <td className="py-4 px-4">
        <div className="flex items-center space-x-2">
          {record.punch_in ? (
            <>
              <FiLogIn className="h-4 w-4 text-emerald-500" />
              <span className="text-sm text-gray-900">{record.punch_in}</span>
            </>
          ) : (
            <span className="text-sm text-gray-400">-</span>
          )}
        </div>
      </td>
      <td className="py-4 px-4">
        <div className="flex items-center space-x-2">
          {record.punch_out ? (
            <>
              <FiLogOut className="h-4 w-4 text-rose-500" />
              <span className="text-sm text-gray-900">{record.punch_out}</span>
            </>
          ) : (
            <span className="text-sm text-gray-400">-</span>
          )}
        </div>
      </td>
      <td className="py-4 px-4">
        <p className="text-sm text-gray-900">{record.breaks || '-'}</p>
      </td>
      <td className="py-4 px-4">
        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
          record.status === 'present' ? 'bg-emerald-50 text-emerald-700' :
          record.status === 'sick_leave' ? 'bg-amber-50 text-amber-700' :
          record.status === 'weekend' ? 'bg-gray-50 text-gray-700' :
          record.status === 'casual_leave' ? 'bg-amber-50 text-amber-700' :
          record.status === 'earned_leave' ? 'bg-amber-50 text-amber-700' :
          record.status === 'maternity_leave' ? 'bg-amber-50 text-amber-700' :
          record.status === 'paternity_leave' ? 'bg-amber-50 text-amber-700' :
          record.status === 'emergency_leave' ? 'bg-amber-50 text-amber-700' :
          'bg-rose-50 text-rose-700'
        }`}>
          {record.status === 'present' ? 'Present' :
           record.status === 'sick_leave' ? 'Sick Leave' :
           record.status === 'weekend' ? 'Weekend' :
           record.status === 'casual_leave' ? 'Casual Leave' :
           record.status === 'earned_leave' ? 'Earned Leave' :
           record.status === 'maternity_leave' ? 'Maternity Leave' :
           record.status === 'paternity_leave' ? 'Paternity Leave' :
           record.status === 'emergency_leave' ? 'Emergency Leave' : 'Absent'}
        </span>
      </td>
      <td className="py-4 px-4">
        <p className="text-sm font-medium text-gray-900">{Number(record.hours) > 0 ? `${Number(record.hours).toFixed(2)}h` : '-'}</p>
      </td>
      <td className="py-4 px-4">
        {!record.punch_out && (
          <button
            onClick={() => {
              setPunchForm({ ...punchForm, punch_type: 'out', time: '', date: record.date });
              setShowPunchModal(true);
            }}
            className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
          >
            <FiLogOut className="h-4 w-4" />
          </button>
        )}
      </td>
      <td className="py-4 px-4">
        {!record.punch_out && (
          <button
            onClick={() => {
              setBreakForm({ attendance_id: record.id || `${record.staff_id}-${record.date}`, break_time: '' });
              setShowBreakModal(true);
            }}
            className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
          >
            <FiCoffee className="h-4 w-4" />
          </button>
        )}
      </td>
    </tr>
  );

const LeaveApplicationRow = ({ application }) => {
    // Helper to format 'casual_leave' to 'Casual Leave'
    const formatLeaveType = (type) => {
      if (!type) return 'Unknown';
      return type.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    };

    return (
      <tr key={application.id} className="border-b border-gray-200 hover:bg-gray-50 transition-colors">
        <td className="py-4 px-4">
          <p className="text-sm font-medium text-gray-900">{formatLeaveType(application.type)}</p>
          <div className="mt-1">
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium ${
              application.leave_duration === 'half' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
            }`}>
              {application.leave_duration === 'half' 
                ? `Half Day ${application.leave_time ? `(${application.leave_time})` : ''}` 
                : 'Full Day'}
            </span>
          </div>
        </td>
        <td className="py-4 px-4">
        <p className="text-sm text-gray-900">
          {new Date(application.from_date).toLocaleDateString('en-IN')}
        </p>
      </td>
      <td className="py-4 px-4">
        <p className="text-sm text-gray-900">
          {new Date(application.to_date).toLocaleDateString('en-IN')}
        </p>
      </td>
      <td className="py-4 px-4">
        <p className="text-sm text-gray-900">{application.reason}</p>
      </td>
      <td className="py-4 px-4">
        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
          application.status === 'approved' ? 'bg-emerald-50 text-emerald-700' :
          application.status === 'rejected' ? 'bg-rose-50 text-rose-700' :
          'bg-amber-50 text-amber-700'
        }`}>
          {application.status.charAt(0).toUpperCase() + application.status.slice(1)}
        </span>
      </td>
      <td className="py-4 px-4">
        <p className="text-sm text-gray-600">
          {new Date(application.applied_date).toLocaleDateString('en-IN')}
        </p>
      </td>
    </tr>
  );
};

  const SalaryRow = ({ salary }) => (
    <tr key={`${salary.staff_id}-${salary.month}`} className="border-b border-gray-200 hover:bg-gray-50 transition-colors">
      <td className="py-4 px-4">
        <p className="text-sm font-medium text-gray-900">{getMonthName(salary.month)}</p>
      </td>
      <td className="py-4 px-4">
        <p className="text-sm text-gray-900">₹{Number(salary.basic).toLocaleString('en-IN')}</p>
      </td>
      <td className="py-4 px-4">
        <p className="text-sm text-gray-900">₹{Number(salary.hra).toLocaleString('en-IN')}</p>
      </td>
      <td className="py-4 px-4">
        <p className="text-sm text-gray-900">₹{Number(salary.other_allowances).toLocaleString('en-IN')}</p>
      </td>
      <td className="py-4 px-4">
        <p className="text-sm text-rose-600">-₹{Number(salary.deductions).toLocaleString('en-IN')}</p>
      </td>
      <td className="py-4 px-4">
        <p className="text-sm font-bold text-emerald-600">₹{Number(salary.net_salary).toLocaleString('en-IN')}</p>
      </td>
      <td className="py-4 px-4">
        <p className="text-sm text-gray-900">{salary.present_days}/{salary.working_days}</p>
      </td>
      <td className="py-4 px-4">
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
          salary.status === 'sent' ? 'bg-emerald-100 text-emerald-700' :
          salary.status === 'viewed' ? 'bg-blue-100 text-blue-700' :
          'bg-amber-100 text-amber-700'
        }`}>
          {salary.status.charAt(0).toUpperCase() + salary.status.slice(1)}
        </span>
      </td>
    </tr>
  );

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white border-b border-gray-200 sticky top-0 z-30">
          <div className="max-w-7xl mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="w-10 h-10 bg-indigo-500 rounded-xl flex items-center justify-center">
                  <FiUser className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-gray-900">Attendance & Salary Management</h1>
                  <p className="text-gray-600">View Attendance , Salary and Leave Applications </p>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-6 py-8">
          <PunchStatusCard punchStatus={punchStatus} lastPunchTime={lastPunchTime} />
          <div className="flex flex-wrap gap-4 mb-8">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
                onClick={() => {
                  const now = new Date();
                  const timeStr = now.toTimeString().split(' ')[0].substring(0, 5);
                  setPunchForm({ 
                    ...punchForm, 
                    punch_type: 'in', 
                    time: timeStr, 
                    date: normalizeDate(now) 
                  });
                  setShowPunchModal(true);
                }}
              className="flex items-center space-x-2 px-6 py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors"
              disabled={punchStatus === 'in'}
            >
              <FiLogIn className="h-5 w-5" />
              <span>Punch In</span>
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
                onClick={() => {
                  const now = new Date();
                  const timeStr = now.toTimeString().split(' ')[0].substring(0, 5);
                  setPunchForm({ 
                    ...punchForm, 
                    punch_type: 'out', 
                    time: timeStr, 
                    date: normalizeDate(now) 
                  });
                  setShowPunchModal(true);
                }}
              className="flex items-center space-x-2 px-6 py-3 bg-rose-600 text-white rounded-xl hover:bg-rose-700 transition-colors"
              disabled={punchStatus === 'out'}
            >
              <FiLogOut className="h-5 w-5" />
              <span>Punch Out</span>
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setShowLeaveModal(true)}
              className="flex items-center space-x-2 px-6 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors"
            >
              <FiCalendar className="h-5 w-5" />
              <span>Apply Leave</span>
            </motion.button>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-2 mb-8">
            <nav className="flex space-x-1 overflow-x-auto custom-scrollbar pb-2">
              {[
                { id: 'dashboard', label: 'Dashboard', icon: FiHome },
                { id: 'attendance', label: 'Attendance', icon: FiCheckCircle },
                { id: 'leave', label: 'Leave', icon: FiCoffee },
                { id: 'calendar', label: 'Calendar', icon: FiCalendar },
                { id: 'schedule', label: 'My Schedule', icon: FiClock },
                { id: 'payslips', label: 'Payslips', icon: FiFileText }
              ].map(tab => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center space-x-2 px-4 py-3 rounded-lg font-medium transition-colors whitespace-nowrap ${
                      activeTab === tab.id
                        ? 'bg-indigo-50 text-indigo-600'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>
          <div className="space-y-8">
            {activeTab === 'dashboard' && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                  <StatCard
                    title="Present Days"
                    value={stats.presentDays}
                    subtitle={`In ${getMonthName(selectedMonth)}`}
                    icon={FiUserCheck}
                    color="bg-emerald-500"
                  />
                  <StatCard
                    title="Total Hours"
                    value={`${stats.totalHours}h`}
                    subtitle={`Worked in ${getMonthName(selectedMonth)}`}
                    icon={FiClock}
                    color="bg-blue-500"
                  />
                  <StatCard
                    title="Avg. Hours/Day"
                    value={`${stats.avgHours}h`}
                    subtitle={`In ${getMonthName(selectedMonth)}`}
                    icon={FiTrendingUp}
                    color="bg-purple-500"
                  />
                  <StatCard
                    title="Latest Salary"
                    value={stats.currentSalary ? `₹${stats.currentSalary.toLocaleString('en-IN')}` : 'N/A'}
                    subtitle={stats.currentSalaryMonth ? getMonthName(stats.currentSalaryMonth) : 'No salary data'}
                    icon={FiDollarSign}
                    color="bg-amber-500"
                    trend={stats.salaryGrowth}
                  />
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                  <AttendanceTrendChart attendance={attendance} />
                  <AttendanceDistributionChart attendance={attendance} selectedMonth={selectedMonth} />
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="bg-white rounded-xl border border-gray-200 p-6">
                    <h3 className="font-semibold text-gray-900 mb-4 flex items-center space-x-2">
                      <FiBriefcase className="h-5 w-5 text-indigo-600" />
                      <span>Recent Attendance</span>
                    </h3>
                    <div className="space-y-3">
                      {attendance.slice(0, 5).map(record => (
                        <div key={record.id || `${record.staff_id}-${record.date}`} className="flex items-center justify-between py-2">
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {new Date(record.date).toLocaleDateString('en-IN', {
                                weekday: 'short',
                                day: '2-digit',
                                month: 'short'
                              })}
                            </p>
                            <p className="text-xs text-gray-500">
                              {record.punch_in && record.punch_out ? `${record.punch_in} - ${record.punch_out}` : 'Not punched'}
                            </p>
                            {record.breaks && (
                              <p className="text-xs text-gray-500">Breaks: {record.breaks}</p>
                            )}
                          </div>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            record.status === 'present' ? 'bg-emerald-50 text-emerald-700' :
                            record.status === 'sick_leave' ? 'bg-amber-50 text-amber-700' :
                            'bg-gray-50 text-gray-700'
                          }`}>
                            {Number(record.hours) > 0 ? `${Number(record.hours).toFixed(2)}h` : record.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="bg-white rounded-xl border border-gray-200 p-6">
                    <h3 className="font-semibold text-gray-900 mb-4 flex items-center space-x-2">
                      <FiDollarSign className="h-5 w-5 text-indigo-600" />
                      <span>Salary Overview</span>
                    </h3>
                    <div className="space-y-4">
                      {allSalaryData.slice(0, 3).map(salary => (
                        <div key={`${salary.staff_id}-${salary.month}`} className="flex items-center justify-between py-2">
                          <div>
                            <p className="text-sm font-medium text-gray-900">{getMonthName(salary.month)}</p>
                            <p className="text-xs text-gray-500">
                              {salary.present_days}/{salary.working_days} days
                            </p>
                          </div>
                          <p className="text-sm font-bold text-emerald-600">
                            ₹{Number(salary.net_salary).toLocaleString('en-IN')}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="bg-white rounded-xl border border-gray-200 p-6">
                    <h3 className="font-semibold text-gray-900 mb-4 flex items-center space-x-2">
                      <FiCalendar className="h-5 w-5 text-indigo-600" />
                      <span>Leave Status</span>
                    </h3>
                    <div className="space-y-3">
                      {leaveApplications.slice(0, 3).map(leave => (
                        <div key={leave.id} className="flex items-center justify-between py-2">
                          <div>
                            <p className="text-sm font-medium text-gray-900">{leave.type}</p>
                            <p className="text-xs text-gray-500">
                              {new Date(leave.from_date).toLocaleDateString('en-IN')} - {new Date(leave.to_date).toLocaleDateString('en-IN')}
                            </p>
                          </div>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            leave.status === 'approved' ? 'bg-emerald-50 text-emerald-700' :
                            leave.status === 'rejected' ? 'bg-rose-50 text-rose-700' :
                            'bg-amber-50 text-amber-700'
                          }`}>
                            {leave.status.charAt(0).toUpperCase() + leave.status.slice(1)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            )}
            {activeTab === 'attendance' && (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="p-6 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-bold text-gray-900">Attendance History</h2>
                    <div className="flex items-center space-x-3">
                      <select
                        className="border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        value={selectedMonth}
                        onChange={e => setSelectedMonth(e.target.value)}
                      >
                        {monthOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <button className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                        <FiDownload className="h-4 w-4" />
                        <span>Export</span>
                      </button>
                    </div>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200 bg-gray-50">
                        <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                        <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Punch In</th>
                        <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Punch Out</th>
                        <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Breaks</th>
                        <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                        <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Hours</th>
                        <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Punch Out</th>
                        <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Add Break</th>
                      </tr>
                    </thead>
                    <tbody>
                      {attendance.map(record => (
                        <AttendanceRow key={record.id || `${record.staff_id}-${record.date}`} record={record} />
                      ))}
                    </tbody>
                  </table>
                  {attendance.length === 0 && (
                    <div className="text-center py-8">
                      <FiFileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-500">No attendance records found for {formatMonthForDisplay(selectedMonth)}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
            {activeTab === 'salary' && (
              <>
                <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold text-gray-900">Salary Details</h2>
                    <select
                      className="border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      value={selectedMonth}
                      onChange={e => setSelectedMonth(e.target.value)}
                    >
                      {monthOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                      <option value="">All Months</option>
                    </select>
                  </div>
                </div>
                <MonthlySalaryChart allSalaryData={allSalaryData} />
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mt-6">
                  <div className="p-6 border-b border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-900">Salary Breakdown</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-gray-200 bg-gray-50">
                          <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase">Month</th>
                          <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase">Basic</th>
                          <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase">HRA</th>
                          <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase">Allowances</th>
                          <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase">Deductions</th>
                          <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase">Net Salary</th>
                          <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase">Days</th>
                          <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(selectedMonth 
                          ? allSalaryData.filter(s => s.month === selectedMonth) 
                          : allSalaryData
                          )
                          .map(salary => (
                            <SalaryRow key={`${salary.staff_id}-${salary.month}`} salary={salary} />
                          ))
                        }
                      </tbody>
                    </table>
                    {allSalaryData.length === 0 && (
                      <div className="text-center py-8">
                        <FiFileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                        <p className="text-gray-500">No salary records found</p>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
            {activeTab === 'leave' && (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="p-6 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-bold text-gray-900">Leave Applications</h2>
                    <div className="flex items-center space-x-3">
                      <select
                        className="border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        value={selectedLeaveMonth}
                        onChange={e => setSelectedLeaveMonth(e.target.value)}
                      >
                        {monthOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => setShowLeaveModal(true)}
                        className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                      >
                        <FiPlus className="h-4 w-4" />
                        <span>Apply Leave</span>
                      </button>
                    </div>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200 bg-gray-50">
                        <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                        <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">From Date</th>
                        <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">To Date</th>
                        <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reason</th>
                        <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                        <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Applied On</th>
                      </tr>
                    </thead>
                    <tbody>
                      {leaveApplications.map(application => (
                        <LeaveApplicationRow key={application.id} application={application} />
                      ))}
                    </tbody>
                  </table>
                  {leaveApplications.length === 0 && (
                    <div className="text-center py-8">
                      <FiFileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-500">No leave applications found for {formatMonthForDisplay(selectedLeaveMonth)}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
            {activeTab === 'calendar' && (
              <div className="fade-in">
                <CalendarView
                  calendarData={calendarEvents}
                  leavesData={leaveApplications}
                  userRole="staff" // Hides the edit/delete/drag-and-drop features intended for admins
                  onAddEvent={() => toast.info("Only admins can add calendar events.")}
                  onEditEvent={() => {}}
                  onDeleteEvent={() => {}}
                  onUpdateEvent={() => {}}
                />
              </div>
            )}
            {activeTab === 'schedule' && (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden fade-in">
                <div className="p-6 border-b border-gray-200">
                  <h2 className="text-xl font-bold text-gray-900">My Shift Schedule</h2>
                  <p className="text-gray-500 text-sm mt-1">Your current and historical working hours.</p>
                </div>
                <div className="p-6">
                  {staff?.schedules && staff.schedules.length > 0 ? (
                    <div className="space-y-4">
                      {staff.schedules.map((schedule, idx) => (
                        <div key={idx} className={`p-4 rounded-xl border ${idx === 0 ? 'bg-indigo-50 border-indigo-200' : 'bg-gray-50 border-gray-200'}`}>
                          <div className="flex items-center justify-between mb-4">
                            <span className={`px-3 py-1 rounded-full text-xs font-bold ${idx === 0 ? 'bg-indigo-200 text-indigo-800' : 'bg-gray-200 text-gray-700'}`}>
                              {idx === 0 ? 'Current Active Schedule' : 'Past Schedule'}
                            </span>
                            <span className="text-sm font-medium text-gray-600">
                              Effective: {new Date(schedule.effective_from).toLocaleDateString('en-IN')} 
                              {schedule.effective_to ? ` to ${new Date(schedule.effective_to).toLocaleDateString('en-IN')}` : ' - Present'}
                            </span>
                          </div>
                          <div className="grid grid-cols-3 gap-4">
                            <div className="bg-white p-3 rounded-lg border border-gray-100 text-center">
                              <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Punch In Time</p>
                              <p className="text-xl font-bold text-gray-900">{schedule.start_time}</p>
                            </div>
                            <div className="bg-white p-3 rounded-lg border border-gray-100 text-center">
                              <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Punch Out Time</p>
                              <p className="text-xl font-bold text-gray-900">{schedule.end_time}</p>
                            </div>
                            <div className="bg-white p-3 rounded-lg border border-gray-100 text-center">
                              <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Standard Hours</p>
                              <p className="text-xl font-bold text-gray-900">{schedule.standard_hours}h</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <FiClock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-500">No schedule information assigned yet.</p>
                    </div>
                  )}
                </div>
              </div>
            )}
            {activeTab === 'payslips' && (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden fade-in">
                <div className="p-6 border-b border-gray-200 flex justify-between items-center">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">My Payslips</h2>
                    <p className="text-gray-500 text-sm mt-1">Download your monthly salary statements.</p>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="py-4 px-6 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Salary Month</th>
                        <th className="py-4 px-6 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Days (Present/Total)</th>
                        <th className="py-4 px-6 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Net Amount</th>
                        <th className="py-4 px-6 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                        <th className="py-4 px-6 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {allSalaryData.filter(s => ['sent', 'viewed'].includes(s.status)).length === 0 ? (
                        <tr>
                          <td colSpan="5" className="py-12 text-center text-gray-500">
                            <FiFileText className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                            No payslips are currently available for download.
                          </td>
                        </tr>
                      ) : (
                        allSalaryData
                          .filter(s => ['sent', 'viewed'].includes(s.status))
                          .sort((a, b) => b.month.localeCompare(a.month))
                          .map((salary) => (
                            <tr key={salary.id} className="hover:bg-gray-50 transition-colors">
                              <td className="py-4 px-6 font-medium text-gray-900">
                                {getMonthName(salary.month)}
                              </td>
                              <td className="py-4 px-6 text-sm text-gray-600">
                                {salary.present_days} / {salary.working_days}
                              </td>
                              <td className="py-4 px-6 font-bold text-emerald-600">
                                ₹{Number(salary.net_salary).toLocaleString('en-IN')}
                              </td>
                              <td className="py-4 px-6">
                                <span className="px-2.5 py-1 bg-green-100 text-green-700 text-xs font-bold rounded-full">
                                  Issued
                                </span>
                              </td>
                              <td className="py-4 px-6 text-right">
                                <button 
                                  onClick={() => handleDownloadPayslip(salary)}
                                  className="inline-flex items-center px-4 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 hover:text-indigo-800 rounded-lg text-sm font-semibold transition-colors"
                                >
                                  <FiDownload className="mr-2 h-4 w-4" />
                                  Download PDF
                                </button>
                              </td>
                            </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
          <AnimatePresence>
            {showPunchModal && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="bg-white rounded-xl p-6 max-w-md w-full"
                >
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-bold text-gray-900">Record Punch</h3>
                    <button
                      onClick={() => setShowPunchModal(false)}
                      className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <FiX className="h-5 w-5 text-gray-600" />
                    </button>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Punch Type</label>
                      <select
                        value={punchForm.punch_type}
                        onChange={e => setPunchForm(prev => ({ ...prev, punch_type: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="in">Punch In</option>
                        <option value="out">Punch Out</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Time</label>
                      {punchForm.punch_type === 'in' ? (
                        <input
                          type="time"
                          value={punchForm.time}
                          onChange={e => setPunchForm(prev => ({ ...prev, time: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      ) : (
                        <p className="text-sm text-gray-900">{new Date().toTimeString().split(' ')[0].substring(0, 5)}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Date</label>
                      <input
                        type="date"
                        value={punchForm.date}
                        onChange={e => setPunchForm(prev => ({ ...prev, date: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        disabled
                      />
                    </div>
                    {punchForm.punch_type === 'out' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Breaks (e.g., 13:00-14:00)</label>
                        <input
                          type="text"
                          value={punchForm.breaks}
                          onChange={e => setPunchForm(prev => ({ ...prev, breaks: e.target.value }))}
                          placeholder="e.g., 13:00-14:00"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                    )}
                  </div>
                  <div className="flex space-x-3 mt-6">
                    <button
                      onClick={() => setShowPunchModal(false)}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handlePunchSubmit}
                      disabled={punchForm.punch_type === 'in' && !punchForm.time}
                      className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Record Punch
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>
          <AnimatePresence>
            {showBreakModal && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="bg-white rounded-xl p-6 max-w-md w-full"
                >
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-bold text-gray-900">Record Break</h3>
                    <button
                      onClick={() => setShowBreakModal(false)}
                      className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <FiX className="h-5 w-5 text-gray-600" />
                    </button>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Break Time (e.g., 13:00-14:00)</label>
                      <input
                        type="text"
                        value={breakForm.break_time}
                        onChange={e => setBreakForm(prev => ({ ...prev, break_time: e.target.value }))}
                        placeholder="e.g., 13:00-14:00"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                  <div className="flex space-x-3 mt-6">
                    <button
                      onClick={() => setShowBreakModal(false)}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleBreakSubmit}
                      disabled={!breakForm.break_time}
                      className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Record Break
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>
          <AnimatePresence>
            {showLeaveModal && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="bg-white rounded-xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto"
                >
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-bold text-gray-900">Apply for Leave</h3>
                    <button
                      onClick={() => setShowLeaveModal(false)}
                      className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <FiX className="h-5 w-5 text-gray-600" />
                    </button>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Leave Type</label>
                      <select
                        value={newLeave.type}
                        onChange={e => setNewLeave(prev => ({ ...prev, type: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="casual_leave">Casual Leave</option>
                        <option value="sick_leave">Sick Leave</option>
                        <option value="earned_leave">Earned Leave</option>
                        <option value="maternity_leave">Maternity Leave</option>
                        <option value="paternity_leave">Paternity Leave</option>
                        <option value="emergency_leave">Emergency Leave</option>
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-4 mt-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Duration</label>
                        <select
                          value={newLeave.leave_duration}
                          onChange={e => setNewLeave(prev => ({ ...prev, leave_duration: e.target.value, leave_time: e.target.value === 'full' ? '' : prev.leave_time }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                          <option value="full">Full Day</option>
                          <option value="half">Half Day</option>
                        </select>
                      </div>
                      
                      {newLeave.leave_duration === 'half' && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Time Segment</label>
                          <select
                            value={newLeave.leave_time}
                            onChange={e => setNewLeave(prev => ({ ...prev, leave_time: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          >
                            <option value="">Select Time...</option>
                            <option value="Morning">Morning</option>
                            <option value="Afternoon">Afternoon</option>
                          </select>
                        </div>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">From Date</label>
                        <input
                          type="date"
                          value={newLeave.from_date}
                          onChange={e => setNewLeave(prev => ({ ...prev, from_date: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">To Date</label>
                        <input
                          type="date"
                          value={newLeave.to_date}
                          onChange={e => setNewLeave(prev => ({ ...prev, to_date: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Reason</label>
                      <textarea
                        value={newLeave.reason}
                        onChange={e => setNewLeave(prev => ({ ...prev, reason: e.target.value }))}
                        rows={4}
                        placeholder="Please provide a reason for your leave application..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                  <div className="flex space-x-3 mt-6">
                    <button
                      onClick={() => setShowLeaveModal(false)}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleLeaveSubmit}
                      disabled={!newLeave.type || !newLeave.from_date || !newLeave.to_date || !newLeave.reason}
                      className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Submit Application
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </ErrorBoundary>
  );
};

export default StaffAttendance;
