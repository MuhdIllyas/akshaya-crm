import React, { useState, useEffect, useMemo } from 'react';
import {
  FiTrendingUp, FiTrendingDown, FiDollarSign, FiBriefcase,
  FiUsers, FiStar, FiCalendar, FiClock, FiAward, FiTarget,
  FiBarChart2, FiPieChart, FiCheckCircle, FiAlertCircle,
  FiRefreshCw, FiDownload, FiFilter, FiChevronRight, FiChevronLeft,
  FiUser, FiPhone, FiMail, FiMapPin, FiActivity, FiSmile,
  FiThumbsUp, FiThumbsDown, FiLoader, FiInfo, FiEye, FiZap, FiHeart, FiGift, FiX
} from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  ArcElement,
  RadialLinearScale,
  BarController,
  LineController
} from 'chart.js';
import { Doughnut, Chart as MixedChart } from 'react-chartjs-2';
import { toast } from 'react-toastify';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  ArcElement,
  RadialLinearScale,
  BarController,
  LineController
);

// Format currency
const formatCurrency = (amount) => {
  if (amount === undefined || amount === null) return '₹0';
  return `₹${Number(amount).toLocaleString('en-IN', {
    maximumFractionDigits: 0
  })}`;
};

// Format date (always in IST, whatever the device's time zone)
const formatDate = (date) => {
  if (!date) return '—';
  // a plain "YYYY-MM-DD" is a calendar day — show it as is
  const d = /^\d{4}-\d{2}-\d{2}$/.test(String(date))
    ? new Date(`${date}T00:00:00+05:30`)
    : new Date(date);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kolkata'
  });
};

// IST calendar day of a timestamp, "YYYY-MM-DD".
// (created_at.split('T')[0] is the UTC day: an entry at 01:24 IST opened the previous day's log)
const istDay = (ts) => {
  if (!ts) return null;
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
};

// Postgres NUMERIC arrives as a string ("0.02") — .toFixed() on it crashed the page
const fixed1 = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n.toFixed(1) : '0';
};

// Format time
const formatTime = (time) => {
  if (!time) return '—';
  return new Date(`2000-01-01T${time}`).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit'
  });
};

// "2026-09" -> "Sep"
const shortMonth = (ym) => {
  if (!ym) return '';
  const d = new Date(`${String(ym).slice(0, 7)}-01T12:00:00+05:30`);
  return Number.isNaN(d.getTime()) ? String(ym) : d.toLocaleDateString('en-IN', { month: 'short', timeZone: 'Asia/Kolkata' });
};

// "2026-10-14" -> "14 Oct"
const shortDay = (ymd) => {
  if (!ymd) return '';
  const d = new Date(`${ymd}T00:00:00+05:30`);
  return Number.isNaN(d.getTime()) ? String(ymd) : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', timeZone: 'Asia/Kolkata' });
};

// small "▲ 12% vs last period" pill
const TrendPill = ({ value, label = 'vs last period' }) => {
  if (value === undefined || value === null || Number.isNaN(Number(value))) return null;
  const up = Number(value) >= 0;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-semibold ${up ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
      {up ? <FiTrendingUp className="h-3 w-3" /> : <FiTrendingDown className="h-3 w-3" />}
      {Math.round(Math.abs(Number(value)))}% {label}
    </span>
  );
};

// Achievement Card Component
const AchievementCard = ({ achievement, index }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: index * 0.05 }}
    className={`bg-white rounded-xl border p-4 ${
      achievement.earned ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200'
    }`}
  >
    <div className="flex items-center space-x-3">
      <div className={`text-2xl ${achievement.earned ? 'opacity-100' : 'opacity-50'}`}>
        {achievement.icon}
      </div>
      <div className="flex-1">
        <h4 className={`font-semibold text-sm ${achievement.earned ? 'text-emerald-800' : 'text-slate-700'}`}>
          {achievement.name}
        </h4>
        <p className="text-xs text-slate-500">{achievement.description}</p>
        {!achievement.earned && achievement.progress !== undefined && (
          <div className="mt-2">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-slate-600">Progress</span>
              <span className="text-slate-600">{Math.round((achievement.progress / achievement.target) * 100)}%</span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-1.5">
              <div
                className="bg-navy-500 h-1.5 rounded-full"
                style={{ width: `${(achievement.progress / achievement.target) * 100}%` }}
              />
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {achievement.progress.toLocaleString()} / {achievement.target.toLocaleString()}
            </p>
          </div>
        )}
      </div>
      {achievement.earned && (
        <FiCheckCircle className="h-5 w-5 text-emerald-600" />
      )}
    </div>
  </motion.div>
);

// Main Staff Performance Component
const StaffPerformance = () => {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('month');
  const [customDateRange, setCustomDateRange] = useState({ from: '', to: '' }); // what's typed in the boxes
  const [appliedRange, setAppliedRange] = useState({ from: '', to: '' });       // what "Apply" confirmed
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [achievements, setAchievements] = useState(null);
  const [comparison, setComparison] = useState(null);
  const [serviceBreakdown, setServiceBreakdown] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [showDailyLog, setShowDailyLog] = useState(false);
  const [dailyLog, setDailyLog] = useState(null);
  const [staffInfo, setStaffInfo] = useState(null);
  // 🔥 NEW: separate loading flags so the Achievements/Services tabs can show
  // their own small spinner instead of blocking the whole page behind `loading`
  const [achievementsLoading, setAchievementsLoading] = useState(false);
  const [breakdownLoading, setBreakdownLoading] = useState(false);
  
  // Fetch staff info from JWT
  useEffect(() => {
    try {
      const token = localStorage.getItem('token');
      if (token) {
        const payload = JSON.parse(atob(token.split('.')[1]));
        setStaffInfo({
          id: payload.id,
          name: payload.name || payload.username,
          role: payload.role,
          centre_id: payload.centre_id
        });
      }
    } catch (err) {
      console.error('Error decoding token:', err);
    }
  }, []);
  
  // 🔥 FIXED: was 4 sequential `await fetch()` calls chained one after another,
  // with a single `loading` flag blocking the ENTIRE page (including tabs the
  // user isn't even on) until all 4 finished — total wait was the SUM of every
  // route's latency, dominated by achievements' 9 queries.
  // Now: only dashboard + compare (needed for the overview tab, which is what's
  // visible on load) are fetched, and fetched in parallel instead of in series.
  // achievements and service-breakdown are fetched lazily, on demand, only when
  // their own tab is opened (see the useEffect below) — each with its own small
  // loading flag so the rest of the page stays interactive while they load.
  // Same period / date range for every request on this page.
  // (The Services tab used to send no period at all, and "compare" ignored the custom range.)
  const buildPeriodParams = () => {
    const params = new URLSearchParams();
    if (period === 'custom' && appliedRange.from && appliedRange.to) {
      params.append('from', appliedRange.from);
      params.append('to', appliedRange.to);
      params.append('period', 'custom');
    } else {
      params.append('period', period === 'custom' ? 'month' : period);
    }
    return params;
  };

  const fetchPerformance = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const params = buildPeriodParams();

      const [dashboardResponse, comparisonResponse] = await Promise.all([
        fetch(
          `${import.meta.env.VITE_API_URL}/api/staffperformance/dashboard?${params.toString()}`,
          { headers: { Authorization: `Bearer ${token}` } }
        ),
        fetch(
          `${import.meta.env.VITE_API_URL}/api/staffperformance/compare?${params.toString()}`,
          { headers: { Authorization: `Bearer ${token}` } }
        )
      ]);
      
      if (!dashboardResponse.ok) throw new Error('Failed to fetch performance data');
      
      const result = await dashboardResponse.json();
      setData(result.data);
      
      if (comparisonResponse.ok) {
        const comparisonResult = await comparisonResponse.json();
        setComparison(comparisonResult.data);
      } else {
        setComparison(null); // don't keep showing the previous period's trend
      }
      
      // The date range just changed, so any previously-loaded service
      // breakdown is for the wrong period now — clear it so the Services
      // tab's effect below knows to refetch it next time it's opened.
      setServiceBreakdown(null);
      
    } catch (error) {
      console.error('Error fetching performance:', error);
      toast.error('Failed to load performance data');
    } finally {
      setLoading(false);
    }
  };
  
  // Lifetime stats — independent of the period filter, so fetch once and cache.
  const fetchAchievements = async () => {
    if (achievements || achievementsLoading) return;
    setAchievementsLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/api/staffperformance/achievements`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) {
        const result = await res.json();
        setAchievements(result.data);
      }
    } catch (error) {
      console.error('Error fetching achievements:', error);
      toast.error('Failed to load achievements');
    } finally {
      setAchievementsLoading(false);
    }
  };
  
  // Depends on the same period/date range as the dashboard — fetchPerformance
  // clears this on period change so it's re-fetched next time this tab opens.
  const fetchServiceBreakdown = async () => {
    if (breakdownLoading) return;
    setBreakdownLoading(true);
    try {
      const token = localStorage.getItem('token');
      const params = buildPeriodParams();
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/api/staffperformance/service-breakdown?${params.toString()}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) {
        const result = await res.json();
        setServiceBreakdown(result.data);
      }
    } catch (error) {
      console.error('Error fetching service breakdown:', error);
      toast.error('Failed to load service breakdown');
    } finally {
      setBreakdownLoading(false);
    }
  };
  
  const fetchDailyLog = async (date) => {
    if (!date) return;
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/staffperformance/daily-log?date=${date}`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      
      if (!response.ok) throw new Error('Failed to fetch daily log');
      
      const result = await response.json();
      setDailyLog(result.data);
      setShowDailyLog(true);
    } catch (error) {
      console.error('Error fetching daily log:', error);
      toast.error('Failed to load daily log');
    }
  };
  
  // Only refetch when the period changes, or when a custom range is applied.
  // (Typing into the date boxes used to refetch on every keystroke while the
  // period was still "This Month" etc.)
  useEffect(() => {
    if (staffInfo?.id) {
      fetchPerformance();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, appliedRange, staffInfo]);

  const applyCustomRange = () => {
    const { from, to } = customDateRange;
    if (!from || !to) {
      toast.error('Choose both a From and a To date');
      return;
    }
    if (from > to) {
      toast.error('From date must be on or before To date');
      return;
    }
    setPeriod('custom');
    setAppliedRange({ from, to });
    setShowDatePicker(false);
  };
  
  // 🔥 NEW: load each tab's data only when the user actually opens that tab,
  // instead of always fetching all 4 endpoints up front on page load.
  useEffect(() => {
    if (activeTab === 'achievements' && !achievements) {
      fetchAchievements();
    }
    if (activeTab === 'services' && !serviceBreakdown) {
      fetchServiceBreakdown();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);
  
  // Service charge per day (bars) + daily target (dashed line)
  const chargeChartData = useMemo(() => {
    if (!data?.daily_performance?.length) return null;
    const dayTarget = data?.target?.has_target ? Math.round(data.target.daily_target) : null;
    return {
      labels: data.daily_performance.map(d => shortDay(d.date)),
      datasets: [
        {
          type: 'bar',
          label: 'Service charge',
          data: data.daily_performance.map(d => d.service_charges),
          backgroundColor: 'rgba(59, 93, 143, 0.85)',
          hoverBackgroundColor: '#1e3a5f',
          borderRadius: 4,
          maxBarThickness: 28,
          order: 2,
        },
        ...(dayTarget ? [{
          type: 'line',
          label: 'Daily target',
          data: data.daily_performance.map(() => dayTarget),
          borderColor: '#f59e0b',
          borderDash: [6, 4],
          borderWidth: 1.5,
          pointRadius: 0,
          fill: false,
          order: 1,
        }] : [])
      ]
    };
  }, [data]);

  const chargeChartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    onClick: (_evt, elements) => {
      const idx = elements?.[0]?.index;
      const day = idx !== undefined ? data?.daily_performance?.[idx]?.date : null;
      if (day) fetchDailyLog(day);
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx) => `${ctx.dataset.label}: ${formatCurrency(ctx.raw)}`,
          afterBody: (items) => {
            const d = data?.daily_performance?.[items?.[0]?.dataIndex];
            return d ? `${d.services_count} service${d.services_count === 1 ? '' : 's'}` : '';
          }
        }
      }
    },
    scales: {
      y: { beginAtZero: true, grid: { color: '#f1f5f9' }, ticks: { font: { size: 10 }, callback: (v) => `₹${Number(v).toLocaleString('en-IN')}` } },
      x: { grid: { display: false }, ticks: { font: { size: 10 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 12 } }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [data]);

  // Category breakdown chart - FIXED: Added responsive wrapper with proper height
  const categoryChartData = useMemo(() => {
    if (!serviceBreakdown?.length) return null;
    
    const top5 = serviceBreakdown.filter(c => c.total_profit > 0).slice(0, 5);
    if (!top5.length) return null;
    const colors = ['#1e3a5f', '#10B981', '#F59E0B', '#E11D48', '#3b5d8f'];
    
    return {
      labels: top5.map(c => c.service_name),
      datasets: [{
        data: top5.map(c => c.total_profit),
        backgroundColor: colors,
        borderWidth: 0,
        hoverOffset: 10
      }]
    };
  }, [serviceBreakdown]);
  
  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: true,
    cutout: '60%',
    plugins: {
      legend: {
        position: 'bottom',
        labels: { font: { size: 10 }, boxWidth: 10 }
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            const label = context.label || '';
            const value = context.raw;
            const total = context.dataset.data.reduce((a, b) => a + b, 0);
            const percentage = ((value / total) * 100).toFixed(1);
            return `${label}: ${formatCurrency(value)} (${percentage}%)`;
          }
        }
      }
    }
  };
  
  const summary = data?.summary || {};
  const pending = data?.pending || {};
  const ratings = data?.ratings || {};
  const attendance = data?.attendance || {};
  const target = data?.target || {};
  const attention = data?.attention || {};

  // Top 3 days by service charge
  const bestDays = useMemo(() => (
    [...(data?.daily_performance || [])]
      .filter(d => d.service_charges > 0)
      .sort((a, b) => b.service_charges - a.service_charges)
      .slice(0, 3)
  ), [data]);

  // Where the service charges come from: top 4 services + the rest
  const chargeShare = useMemo(() => {
    const cats = (data?.category_breakdown || []).filter(c => c.total_profit > 0);
    const total = cats.reduce((sum, c) => sum + c.total_profit, 0);
    if (!total) return { total: 0, parts: [] };
    const top = cats.slice(0, 4).map(c => ({ name: c.service_name, value: c.total_profit }));
    const rest = cats.slice(4).reduce((sum, c) => sum + c.total_profit, 0);
    if (rest > 0) top.push({ name: 'Others', value: rest });
    return { total, parts: top.map(p => ({ ...p, pct: (p.value / total) * 100 })) };
  }, [data]);
  const shareColors = ['bg-navy-700', 'bg-navy-500', 'bg-sky-400', 'bg-emerald-500', 'bg-slate-300'];
  const periodProfitChange = comparison?.metrics?.profit?.change;

  // "Needs your attention" rows (only things that need action)
  const attentionItems = [];
  if (attention.overdue_count > 0) attentionItems.push({
    key: 'overdue', tone: 'rose',
    title: `${attention.overdue_count} overdue payment${attention.overdue_count === 1 ? '' : 's'}`,
    sub: `${formatCurrency(attention.overdue_amount)} to collect`,
    action: 'Collect', to: '/dashboard/staff/pending_payments'
  });
  const notOverdueCount = Math.max((attention.pending_count || 0) - (attention.overdue_count || 0), 0);
  if (notOverdueCount > 0) attentionItems.push({
    key: 'pending', tone: 'amber',
    title: `${notOverdueCount} payment${notOverdueCount === 1 ? '' : 's'} pending`,
    sub: `${formatCurrency(Math.max((attention.pending_amount || 0) - (attention.overdue_amount || 0), 0))} still to collect`,
    action: 'View', to: '/dashboard/staff/pending_payments'
  });
  if (attention.deliveries_late > 0) attentionItems.push({
    key: 'late', tone: 'rose',
    title: `${attention.deliveries_late} application${attention.deliveries_late === 1 ? '' : 's'} past delivery date`,
    sub: 'Update the status or inform the customer',
    action: 'Track', to: '/dashboard/staff/track_service'
  });
  if (attention.deliveries_soon > 0) attentionItems.push({
    key: 'soon', tone: 'amber',
    title: `${attention.deliveries_soon} deliver${attention.deliveries_soon === 1 ? 'y' : 'ies'} due in 3 days`,
    sub: 'Keep these on track',
    action: 'Track', to: '/dashboard/staff/track_service'
  });
  if (attention.expiring_7d > 0) attentionItems.push({
    key: 'expiry', tone: 'amber',
    title: `${attention.expiring_7d} expir${attention.expiring_7d === 1 ? 'y' : 'ies'} in the next 7 days`,
    sub: 'Call customers about renewal',
    action: 'Calendar', to: '/dashboard/staff/calendar'
  });
  const toneBox = { rose: 'bg-rose-50 text-rose-700', amber: 'bg-amber-50 text-amber-700', slate: 'bg-slate-50 text-slate-700' };
  const onPace = target.has_target && target.projected >= target.monthly_target;
  
  const tabs = [
    { id: 'overview', label: 'Overview', icon: FiBarChart2 },
    { id: 'services', label: 'Services', icon: FiBriefcase },
    { id: 'achievements', label: 'Achievements', icon: FiAward },
    { id: 'attendance', label: 'Attendance', icon: FiClock }
  ];
  
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
        <div className="px-6 py-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-gradient-to-br from-navy-500 to-navy-700 rounded-xl flex items-center justify-center shadow-lg">
                <FiTrendingUp className="text-white h-6 w-6" />
              </div>
              <div>
                <h1 className="font-bold text-slate-900 text-2xl">My Performance Dashboard</h1>
                <p className="text-slate-600 flex items-center text-sm">
                  <FiBriefcase className="h-3 w-3 mr-1" />
                  Track your service charges, target and customer satisfaction
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              {/* Period Selector */}
              <div className="relative">
                <button
                  onClick={() => setShowDatePicker(!showDatePicker)}
                  className="flex items-center space-x-2 px-4 py-2 border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors"
                >
                  <FiCalendar className="h-4 w-4 text-slate-500" />
                  <span className="text-sm">
                    {period === 'today' && 'Today'}
                    {period === 'week' && 'This Week'}
                    {period === 'month' && 'This Month'}
                    {period === 'quarter' && 'This Quarter'}
                    {period === 'year' && 'This Year'}
                    {period === 'custom' && 'Custom Range'}
                  </span>
                  <FiChevronRight className="h-4 w-4 text-slate-500 transform rotate-90" />
                </button>
                
                <AnimatePresence>
                  {showDatePicker && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setShowDatePicker(false)} />
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className="absolute top-full mt-2 right-0 bg-white border border-slate-200 rounded-xl shadow-lg z-50 w-64"
                      >
                        <div className="p-3">
                          <button
                            onClick={() => { setPeriod('today'); setShowDatePicker(false); }}
                            className={`w-full text-left px-3 py-2 rounded-xl text-sm ${period === 'today' ? 'bg-slate-100 text-navy-700' : 'hover:bg-slate-50'}`}
                          >
                            Today
                          </button>
                          <button
                            onClick={() => { setPeriod('week'); setShowDatePicker(false); }}
                            className={`w-full text-left px-3 py-2 rounded-xl text-sm ${period === 'week' ? 'bg-slate-100 text-navy-700' : 'hover:bg-slate-50'}`}
                          >
                            This Week
                          </button>
                          <button
                            onClick={() => { setPeriod('month'); setShowDatePicker(false); }}
                            className={`w-full text-left px-3 py-2 rounded-xl text-sm ${period === 'month' ? 'bg-slate-100 text-navy-700' : 'hover:bg-slate-50'}`}
                          >
                            This Month
                          </button>
                          <button
                            onClick={() => { setPeriod('quarter'); setShowDatePicker(false); }}
                            className={`w-full text-left px-3 py-2 rounded-xl text-sm ${period === 'quarter' ? 'bg-slate-100 text-navy-700' : 'hover:bg-slate-50'}`}
                          >
                            This Quarter
                          </button>
                          <button
                            onClick={() => { setPeriod('year'); setShowDatePicker(false); }}
                            className={`w-full text-left px-3 py-2 rounded-xl text-sm ${period === 'year' ? 'bg-slate-100 text-navy-700' : 'hover:bg-slate-50'}`}
                          >
                            This Year
                          </button>
                          <div className="border-t border-slate-200 my-2"></div>
                          <div className="space-y-2">
                            <input
                              type="date"
                              aria-label="From date"
                              value={customDateRange.from}
                              onChange={(e) => setCustomDateRange(prev => ({ ...prev, from: e.target.value }))}
                              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm"
                              placeholder="From Date"
                            />
                            <input
                              type="date"
                              aria-label="To date"
                              value={customDateRange.to}
                              onChange={(e) => setCustomDateRange(prev => ({ ...prev, to: e.target.value }))}
                              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm"
                              placeholder="To Date"
                            />
                            <button
                              onClick={applyCustomRange}
                              className="w-full px-3 py-2 bg-navy-700 text-white rounded-xl text-sm hover:bg-navy-800"
                            >
                              Apply
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>
              
              <button
                onClick={fetchPerformance}
                aria-label="Refresh performance data"
                className="p-2 min-h-[40px] min-w-[40px] flex items-center justify-center bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors"
                disabled={loading}
              >
                <FiRefreshCw className={`h-4 w-4 text-slate-600 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
          
          {/* Staff Info */}
          {staffInfo && (
            <div className="mt-4 flex items-center space-x-4 p-4 bg-slate-50 rounded-xl">
              <div className="w-12 h-12 bg-slate-200 rounded-full flex items-center justify-center">
                <span className="text-navy-700 font-bold text-lg">
                  {staffInfo.name?.charAt(0) || 'S'}
                </span>
              </div>
              <div>
                <h2 className="font-semibold text-slate-900">{staffInfo.name}</h2>
                <div className="flex flex-wrap gap-3 mt-1">
                  <span className="text-xs text-slate-500 flex items-center">
                    <FiBriefcase className="h-3 w-3 mr-1" />
                    {staffInfo.role || 'Staff'}
                  </span>
                  <span className="text-xs text-slate-500 flex items-center">
                    <FiTarget className="h-3 w-3 mr-1" />
                    Staff ID: {staffInfo.id}
                  </span>
                </div>
              </div>
            </div>
          )}
          
          {/* Period Info */}
          {data?.period && (
            <div className="mt-3 text-sm text-slate-500 flex items-center">
              <FiCalendar className="h-4 w-4 mr-1" />
              Showing data from {formatDate(data.period.from)} to {formatDate(data.period.to)} ({data.period.total_days} days)
            </div>
          )}
        </div>
        
        {/* Tabs */}
        <div className="border-t border-slate-200 px-6">
          <div className="flex space-x-6 overflow-x-auto">
            {tabs.map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  aria-current={activeTab === tab.id ? 'page' : undefined}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-2 py-3 border-b-2 text-sm font-medium transition-colors whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'border-navy-500 text-navy-700'
                      : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
      
      {/* Main Content */}
      <div className="px-6 py-6">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <FiLoader className="animate-spin h-8 w-8 text-navy-700 mx-auto mb-3" />
              <p className="text-slate-500">Loading your performance data...</p>
            </div>
          </div>
        ) : !data ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
            <FiBarChart2 className="h-12 w-12 mx-auto mb-4 text-slate-400" />
            <h3 className="text-lg font-medium text-slate-900 mb-2">No Data Available</h3>
            <p className="text-slate-500">
              No service records found for the selected period. Try selecting a different date range.
            </p>
          </div>
        ) : (
          <>
            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                {/* ===== LEFT: target, charges, per-day chart ===== */}
                <div className="lg:col-span-2 space-y-5 min-w-0">

                  {/* Target card — always this month */}
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 sm:p-6">
                    {target.has_target ? (
                      <div className="flex flex-col sm:flex-row gap-6 items-center">
                        <div className="relative w-40 h-40 shrink-0">
                          <svg viewBox="0 0 36 36" className="w-40 h-40 -rotate-90" aria-hidden="true">
                            <circle cx="18" cy="18" r="15.9" fill="none" stroke="#e2e8f0" strokeWidth="3" />
                            <circle cx="18" cy="18" r="15.9" fill="none" stroke="#1e3a5f" strokeWidth="3" strokeLinecap="round"
                              strokeDasharray={`${Math.min(Math.max(target.progress_percentage, 0), 100)} 100`} />
                          </svg>
                          <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-3xl font-bold text-navy-700">{Math.round(target.progress_percentage)}%</span>
                            <span className="text-xs text-slate-500">of target</span>
                          </div>
                        </div>
                        <div className="flex-1 w-full min-w-0">
                          <p className="text-sm text-slate-500">This month's service-charge target</p>
                          <p className="text-3xl font-bold text-slate-900 mt-1">
                            {formatCurrency(target.achieved)}
                            <span className="text-lg text-slate-400 font-medium"> / {formatCurrency(target.monthly_target)}</span>
                          </p>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4 text-sm">
                            <div className="rounded-xl bg-slate-50 p-3">
                              <p className="text-xs text-slate-500">Need per day</p>
                              {target.remaining > 0 ? (
                                <>
                                  <p className="font-bold text-lg text-slate-900">{formatCurrency(target.needed_per_day)}</p>
                                  <p className="text-xs text-slate-500">{target.days_left} day{target.days_left === 1 ? '' : 's'} left</p>
                                </>
                              ) : (
                                <p className="font-bold text-lg text-emerald-700">Target reached</p>
                              )}
                            </div>
                            <div className="rounded-xl bg-slate-50 p-3">
                              <p className="text-xs text-slate-500">Your daily average</p>
                              <p className="font-bold text-lg text-slate-900">{formatCurrency(target.daily_avg)}</p>
                              <p className={`text-xs ${target.daily_avg >= target.needed_per_day ? 'text-emerald-600' : 'text-amber-600'}`}>
                                {target.remaining <= 0 ? 'keep going' : target.daily_avg >= target.needed_per_day ? 'ahead of pace' : 'behind pace'}
                              </p>
                            </div>
                            <div className={`rounded-xl p-3 ${onPace ? 'bg-emerald-50' : 'bg-amber-50'}`}>
                              <p className={`text-xs ${onPace ? 'text-emerald-700' : 'text-amber-700'}`}>Projected month-end</p>
                              <p className={`font-bold text-lg ${onPace ? 'text-emerald-700' : 'text-amber-700'}`}>{formatCurrency(target.projected)}</p>
                              <p className={`text-xs ${onPace ? 'text-emerald-700' : 'text-amber-700'}`}>{onPace ? 'on track for target' : 'below target at this pace'}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-4">
                        <div className="p-3 rounded-xl bg-slate-100"><FiTarget className="h-6 w-6 text-navy-700" /></div>
                        <div>
                          <p className="font-semibold text-slate-900">No target set for this month</p>
                          <p className="text-sm text-slate-500">Your target appears here once it is set. Everything below still shows your service charges for the selected period.</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Where charges come from + best days */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <h3 className="font-semibold text-slate-900 text-sm">Where your charges come from</h3>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 mb-3">
                        <span className="text-2xl font-bold text-navy-700">{formatCurrency(summary.total_service_charges)}</span>
                        <TrendPill value={periodProfitChange} />
                      </div>
                      {chargeShare.parts.length > 0 ? (
                        <>
                          <div className="flex h-3 rounded-full overflow-hidden bg-slate-100">
                            {chargeShare.parts.map((p, i) => (
                              <div key={p.name} className={shareColors[i % shareColors.length]} style={{ width: `${p.pct}%` }} title={`${p.name}: ${formatCurrency(p.value)}`} />
                            ))}
                          </div>
                          <ul className="mt-3 space-y-1.5 text-sm">
                            {chargeShare.parts.map((p, i) => (
                              <li key={p.name} className="flex items-center justify-between gap-2">
                                <span className="flex items-center gap-2 min-w-0">
                                  <span className={`w-2.5 h-2.5 rounded-sm shrink-0 ${shareColors[i % shareColors.length]}`} />
                                  <span className="truncate text-slate-700">{p.name}</span>
                                </span>
                                <span className="font-semibold text-slate-900 shrink-0">{formatCurrency(p.value)}</span>
                              </li>
                            ))}
                          </ul>
                        </>
                      ) : (
                        <p className="text-sm text-slate-500 py-4">No service charges in this period.</p>
                      )}
                      <p className="text-xs text-slate-500 mt-3">
                        Department fees handled: {formatCurrency(summary.total_department_charges)} (not your earning)
                      </p>
                    </div>

                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                      <h3 className="font-semibold text-slate-900 text-sm mb-3">Your best days</h3>
                      {bestDays.length > 0 ? (
                        <ul className="space-y-1">
                          {bestDays.map((d, i) => (
                            <li key={d.date}>
                              <button
                                type="button"
                                onClick={() => fetchDailyLog(d.date)}
                                className="w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 text-left min-h-[44px]"
                              >
                                <span className="flex items-center gap-2 text-sm text-slate-700">
                                  <span className="w-6 h-6 rounded-full bg-slate-100 text-navy-700 text-xs font-bold flex items-center justify-center">{i + 1}</span>
                                  {shortDay(d.date)}
                                </span>
                                <span className="font-bold text-navy-700">{formatCurrency(d.service_charges)}</span>
                                <span className="text-xs text-slate-500 w-20 text-right">{d.services_count} service{d.services_count === 1 ? '' : 's'}</span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-slate-500 py-4">No days with service charges in this period.</p>
                      )}
                      <p className="text-xs text-slate-500 mt-3">Tap a day to see everything you did that day.</p>
                    </div>
                  </div>

                  {/* Service charge per day */}
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                      <h3 className="font-semibold text-slate-900 text-sm flex items-center">
                        <FiBarChart2 className="h-4 w-4 mr-2 text-navy-700" />
                        Service charge per day
                      </h3>
                      {target.has_target && (
                        <span className="text-xs text-slate-500 flex items-center gap-1.5">
                          <span className="inline-block w-4 border-t-2 border-dashed border-amber-500" />
                          daily target {formatCurrency(target.daily_target)}
                        </span>
                      )}
                    </div>
                    {chargeChartData ? (
                      <div className="h-64">
                        <MixedChart type="bar" data={chargeChartData} options={chargeChartOptions} />
                      </div>
                    ) : (
                      <div className="h-40 flex items-center justify-center text-sm text-slate-500">No services in this period</div>
                    )}
                  </div>
                </div>

                {/* ===== RIGHT: history, attention, quick numbers ===== */}
                <div className="space-y-5 min-w-0">
                  {/* Needs your attention */}
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                    <h3 className="font-semibold text-slate-900 text-sm mb-3">Needs your attention</h3>
                    <div className="space-y-2.5">
                      {attentionItems.map(item => (
                        <button
                          key={item.key}
                          type="button"
                          onClick={() => navigate(item.to)}
                          className={`w-full flex items-center justify-between gap-3 rounded-xl p-3 text-left min-h-[44px] hover:opacity-90 ${toneBox[item.tone]}`}
                        >
                          <span className="min-w-0">
                            <span className="block font-semibold text-sm">{item.title}</span>
                            <span className="block text-xs opacity-80">{item.sub}</span>
                          </span>
                          <span className="text-xs font-semibold shrink-0 flex items-center">{item.action}<FiChevronRight className="h-4 w-4 ml-0.5" /></span>
                        </button>
                      ))}
                      {target.has_target && target.remaining > 0 && (
                        <div className={`rounded-xl p-3 ${toneBox.slate}`}>
                          <p className="font-semibold text-sm">{formatCurrency(target.needed_per_day)} a day to hit your target</p>
                          <p className="text-xs text-slate-500">You average {formatCurrency(target.daily_avg)} — {target.daily_avg >= target.needed_per_day ? 'on track' : 'a little behind'}</p>
                        </div>
                      )}
                      {attentionItems.length === 0 && !(target.has_target && target.remaining > 0) && (
                        <div className="rounded-xl bg-emerald-50 text-emerald-700 p-3 flex items-center gap-2 text-sm font-medium">
                          <FiCheckCircle className="h-4 w-4 shrink-0" /> All clear — nothing needs action right now.
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Last 6 months */}
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                    <h3 className="font-semibold text-slate-900 text-sm mb-3">Last months vs target</h3>
                    {target.history?.length > 0 ? (
                      <ul className="space-y-2.5 text-sm">
                        {[...target.history].reverse().map(h => {
                          const pct = h.percent !== null && h.percent !== undefined ? h.percent : (h.target > 0 ? (h.achieved / h.target) * 100 : 0);
                          const bar = pct >= 100 ? 'bg-emerald-500' : pct >= 90 ? 'bg-amber-400' : 'bg-rose-400';
                          const txt = pct >= 100 ? 'text-emerald-600' : pct >= 90 ? 'text-amber-600' : 'text-rose-600';
                          return (
                            <li key={h.month} className="flex items-center gap-2" title={`${formatCurrency(h.achieved)} of ${formatCurrency(h.target)}`}>
                              <span className="w-9 text-slate-500">{shortMonth(h.month)}</span>
                              <div className="flex-1 h-2 rounded-full bg-slate-100">
                                <div className={`h-2 rounded-full ${bar}`} style={{ width: `${Math.min(Math.max(pct, 0), 100)}%` }} />
                              </div>
                              <span className={`w-12 text-right text-xs font-semibold ${txt}`}>{Math.round(pct)}%</span>
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <p className="text-sm text-slate-500">Past months appear here once a month is closed.</p>
                    )}
                  </div>

                  {/* Quick numbers */}
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                    <h3 className="font-semibold text-slate-900 text-sm mb-2">Quick numbers</h3>
                    <dl className="divide-y divide-slate-100 text-sm">
                      <div className="flex items-center justify-between py-2.5">
                        <dt className="text-slate-500">Services done</dt>
                        <dd className="font-semibold text-slate-900 flex items-center gap-2">{summary.total_services || 0}<TrendPill value={comparison?.metrics?.services?.change} label="" /></dd>
                      </div>
                      <div className="flex items-center justify-between py-2.5">
                        <dt className="text-slate-500">Avg charge / service</dt>
                        <dd className="font-semibold text-slate-900">{formatCurrency(summary.avg_service_charge_per_service)}</dd>
                      </div>
                      <div className="flex items-center justify-between py-2.5">
                        <dt className="text-slate-500">Best day</dt>
                        <dd className="font-semibold text-slate-900">{bestDays[0] ? formatCurrency(bestDays[0].service_charges) : '—'}</dd>
                      </div>
                      <div className="flex items-center justify-between py-2.5" title="Service charges 50% · collection rate 30% · consistency 20%">
                        <dt className="text-slate-500">Performance score</dt>
                        <dd className="font-semibold text-slate-900">{summary.incentive_score || 0}/100</dd>
                      </div>
                      <div className="flex items-center justify-between py-2.5">
                        <dt className="text-slate-500">Customer rating</dt>
                        <dd className="font-semibold text-slate-900">{ratings.total_reviews > 0 ? `${fixed1(ratings.avg_rating)} ★ (${ratings.total_reviews})` : 'No reviews yet'}</dd>
                      </div>
                      <div className="flex items-center justify-between py-2.5">
                        <dt className="text-slate-500">Repeat customers</dt>
                        <dd className="font-semibold text-slate-900">{Math.round(Number(summary.repeat_customer_rate) || 0)}%</dd>
                      </div>
                      <div className="flex items-center justify-between py-2.5">
                        <dt className="text-slate-500">Collection rate</dt>
                        <dd className="font-semibold text-slate-900">{Math.round(Number(summary.collection_rate) || 0)}%</dd>
                      </div>
                      <div className="flex items-center justify-between py-2.5">
                        <dt className="text-slate-500">Attendance</dt>
                        <dd className="font-semibold text-slate-900">{attendance.total_days > 0 ? `${attendance.present_days} / ${attendance.total_days} days` : '—'}</dd>
                      </div>
                    </dl>
                  </div>
                </div>
              </div>
            )}
            
            {/* Services Tab */}
            {activeTab === 'services' && (
              <>
                {breakdownLoading && !serviceBreakdown && (
                  <div className="flex items-center justify-center py-16 text-slate-500">
                    <FiLoader className="h-5 w-5 mr-2 animate-spin" />
                    Loading service breakdown…
                  </div>
                )}
                {/* Category Breakdown - FIXED Responsive Layout */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                  <div className="bg-white rounded-2xl border border-slate-200 p-5">
                    <h3 className="font-semibold text-slate-900 text-sm flex items-center mb-4">
                      <FiPieChart className="h-4 w-4 mr-2 text-navy-700" />
                      Service Charge by Category
                    </h3>
                    {categoryChartData && serviceBreakdown?.length > 0 ? (
                      <div className="flex flex-col md:flex-row items-center h-auto md:h-80">
                        <div className="w-full md:w-1/2 flex justify-center">
                          <div className="w-48 h-48 md:w-56 md:h-56">
                            <Doughnut data={categoryChartData} options={doughnutOptions} />
                          </div>
                        </div>
                        <div className="w-full md:w-1/2 pl-0 md:pl-4 mt-4 md:mt-0">
                          <div className="space-y-2 max-h-56 overflow-y-auto">
                            {serviceBreakdown.slice(0, 5).map((cat, idx) => (
                              <div key={idx} className="flex items-center justify-between text-sm">
                                <div className="flex items-center">
                                  <div className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: categoryChartData.datasets[0].backgroundColor[idx] }} />
                                  <span className="text-slate-700 truncate max-w-[120px]">{cat.service_name}</span>
                                </div>
                                <div className="text-right">
                                  <p className="font-semibold text-slate-900">{formatCurrency(cat.total_profit)}</p>
                                  <p className="text-xs text-slate-500">{cat.total_services} services</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="h-64 flex items-center justify-center text-slate-500">
                        <p>No service data available</p>
                      </div>
                    )}
                  </div>
                  
                  {/* Service Performance Metrics */}
                  <div className="bg-white rounded-2xl border border-slate-200 p-5">
                    <h3 className="font-semibold text-slate-900 text-sm flex items-center mb-4">
                      <FiActivity className="h-4 w-4 mr-2 text-navy-700" />
                      Service Performance Metrics
                    </h3>
                    {serviceBreakdown?.length > 0 ? (
                      <div className="space-y-4 max-h-96 overflow-y-auto">
                        {serviceBreakdown.map((service, idx) => (
                          <div key={idx} className="border-b border-slate-100 pb-3 last:border-0">
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-medium text-slate-900 text-sm">{service.service_name}</span>
                              <span className="text-xs font-semibold text-navy-700">{formatCurrency(service.total_profit)} earned</span>
                            </div>
                            <div className="grid grid-cols-3 gap-2 text-xs">
                              <div>
                                <p className="text-slate-500">Services</p>
                                <p className="font-semibold text-slate-700">{service.total_services}</p>
                              </div>
                              <div>
                                <p className="text-slate-500">Avg Charge</p>
                                <p className="font-semibold text-navy-700">{formatCurrency(service.avg_profit)}</p>
                              </div>
                              <div>
                                <p className="text-slate-500">Total billed</p>
                                <p className="font-semibold text-slate-700">{formatCurrency(service.total_revenue)}</p>
                              </div>
                            </div>
                            <div className="mt-2">
                              <div className="flex justify-between text-xs mb-1">
                                <span className="text-slate-500">Share of your charges</span>
                                <span className="text-slate-500">{Math.round(service.profit_percentage || 0)}%</span>
                              </div>
                              <div className="w-full bg-slate-200 rounded-full h-1.5">
                                <div
                                  className="bg-navy-500 h-1.5 rounded-full"
                                  style={{ width: `${service.profit_percentage || 0}%` }}
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="h-64 flex items-center justify-center text-slate-500">
                        <p>No service data available</p>
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Top Customers */}
                {data?.top_customers?.length > 0 && (
                  <div className="bg-white rounded-2xl border border-slate-200 p-5">
                    <h3 className="font-semibold text-slate-900 text-sm flex items-center mb-4">
                      <FiUsers className="h-4 w-4 mr-2 text-navy-700" />
                      Top Customers
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {data.top_customers.map((customer, idx) => (
                        <div key={idx} className="border border-slate-200 rounded-xl p-3 hover:shadow-md transition-shadow">
                          <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 bg-slate-200 rounded-full flex items-center justify-center">
                              <FiUser className="h-5 w-5 text-navy-700" />
                            </div>
                            <div className="flex-1">
                              <p className="font-medium text-slate-900 text-sm truncate">{customer.customer_name}</p>
                              <p className="text-xs text-slate-500">{customer.phone}</p>
                            </div>
                            <div className="text-right">
                              <p className="font-bold text-emerald-600 text-sm">{formatCurrency(customer.total_spent)}</p>
                              <p className="text-xs text-slate-500">{customer.service_count} services</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
            
            {/* Achievements Tab */}
            {activeTab === 'achievements' && !achievements && (
              <div className="flex items-center justify-center py-16 text-slate-500">
                <FiLoader className="h-5 w-5 mr-2 animate-spin" />
                Loading achievements…
              </div>
            )}
            {activeTab === 'achievements' && achievements && (
              <>
                {/* Lifetime Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="bg-gradient-to-br from-navy-700 to-navy-800 rounded-xl p-4 text-white">
                    <p className="text-slate-200 text-xs">Lifetime Services</p>
                    <p className="text-2xl font-bold">{achievements.lifetime?.total_services || 0}</p>
                  </div>
                  <div className="bg-gradient-to-br from-emerald-600 to-emerald-700 rounded-xl p-4 text-white">
                    <p className="text-emerald-100 text-xs">Lifetime Revenue</p>
                    <p className="text-2xl font-bold">{formatCurrency(achievements.lifetime?.total_revenue || 0)}</p>
                  </div>
                  <div className="bg-gradient-to-br from-navy-500 to-navy-700 rounded-xl p-4 text-white">
                    <p className="text-slate-200 text-xs">Unique Customers</p>
                    <p className="text-2xl font-bold">{achievements.lifetime?.unique_customers || 0}</p>
                  </div>
                  <div className="bg-gradient-to-br from-amber-600 to-amber-700 rounded-xl p-4 text-white">
                    <p className="text-amber-100 text-xs">Active Days</p>
                    <p className="text-2xl font-bold">{achievements.lifetime?.active_days || 0}</p>
                  </div>
                </div>
                
                {/* Additional Lifetime Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="bg-white rounded-2xl border border-slate-200 p-3 text-center">
                    <p className="text-xs text-slate-500">Collection Rate</p>
                    <p className="text-lg font-bold text-slate-900">{fixed1(achievements.lifetime?.lifetime_collection_rate)}%</p>
                  </div>
                  <div className="bg-white rounded-2xl border border-slate-200 p-3 text-center">
                    <p className="text-xs text-slate-500">Weekly Streak</p>
                    <p className="text-lg font-bold text-slate-900">{achievements.lifetime?.weekly_streak || 0} weeks</p>
                  </div>
                  <div className="bg-white rounded-2xl border border-slate-200 p-3 text-center">
                    <p className="text-xs text-slate-500">Revenue Streak</p>
                    <p className="text-lg font-bold text-slate-900">{achievements.lifetime?.daily_revenue_streak || 0} days</p>
                  </div>
                  <div className="bg-white rounded-2xl border border-slate-200 p-3 text-center">
                    <p className="text-xs text-slate-500">Categories Mastered</p>
                    <p className="text-lg font-bold text-slate-900">{achievements.lifetime?.distinct_categories || 0}</p>
                  </div>
                </div>
                
                {/* Best Day & Top Customer */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  {achievements.best_day && (
                    <div className="bg-white rounded-2xl border border-slate-200 p-5">
                      <div className="flex items-center space-x-3 mb-3">
                        <div className="p-2 bg-amber-100 rounded-xl">
                          <FiZap className="h-5 w-5 text-amber-600" />
                        </div>
                        <h3 className="font-semibold text-slate-900">Best Day Ever!</h3>
                      </div>
                      <p className="text-sm text-slate-600">On {formatDate(achievements.best_day.date)}</p>
                      <div className="grid grid-cols-2 gap-3 mt-3">
                        <div>
                          <p className="text-xs text-slate-500">Services</p>
                          <p className="text-xl font-bold text-slate-900">{achievements.best_day.services_count}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">Revenue</p>
                          <p className="text-xl font-bold text-emerald-600">{formatCurrency(achievements.best_day.revenue)}</p>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {achievements.top_customer && (
                    <div className="bg-white rounded-2xl border border-slate-200 p-5">
                      <div className="flex items-center space-x-3 mb-3">
                        <div className="p-2 bg-slate-100 rounded-xl">
                          <FiHeart className="h-5 w-5 text-navy-700" />
                        </div>
                        <h3 className="font-semibold text-slate-900">Top Customer</h3>
                      </div>
                      <p className="text-sm font-medium text-slate-900">{achievements.top_customer.name}</p>
                      <div className="grid grid-cols-2 gap-3 mt-3">
                        <div>
                          <p className="text-xs text-slate-500">Services</p>
                          <p className="text-xl font-bold text-slate-900">{achievements.top_customer.services_count}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">Total Spent</p>
                          <p className="text-xl font-bold text-emerald-600">{formatCurrency(achievements.top_customer.total_spent)}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Achievements Grid */}
                <div className="bg-white rounded-2xl border border-slate-200 p-5">
                  <h3 className="font-semibold text-slate-900 text-sm flex items-center mb-4">
                    <FiAward className="h-4 w-4 mr-2 text-amber-500" />
                    Your Achievements
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {achievements.achievements?.map((achievement, idx) => (
                      <AchievementCard key={idx} achievement={achievement} index={idx} />
                    ))}
                  </div>
                </div>
              </>
            )}
            
            {/* Attendance Tab */}
            {activeTab === 'attendance' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Attendance Stats */}
                <div className="lg:col-span-1 space-y-4">
                  <div className="bg-white rounded-2xl border border-slate-200 p-5">
                    <h3 className="font-semibold text-slate-900 text-sm flex items-center mb-4">
                      <FiClock className="h-4 w-4 mr-2 text-navy-700" />
                      Attendance Summary
                    </h3>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-600 text-sm">Total Days</span>
                        <span className="font-semibold text-slate-900">{attendance.total_days || 0}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-600 text-sm">Present Days</span>
                        <span className="font-semibold text-emerald-600">{attendance.present_days || 0}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-600 text-sm">Absent Days</span>
                        <span className="font-semibold text-rose-600">{attendance.absent_days || 0}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-600 text-sm">Late Days</span>
                        <span className="font-semibold text-amber-600">{attendance.late_days || 0}</span>
                      </div>
                      <div className="pt-3 border-t border-slate-100">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-600 text-sm">Attendance Rate</span>
                          <span className={`font-bold text-lg ${
                            attendance.attendance_rate >= 90 ? 'text-emerald-600' :
                            attendance.attendance_rate >= 75 ? 'text-amber-600' : 'text-rose-600'
                          }`}>
                            {attendance.attendance_rate || 0}%
                          </span>
                        </div>
                        <div className="mt-2 w-full bg-slate-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${
                              attendance.attendance_rate >= 90 ? 'bg-emerald-500' :
                              attendance.attendance_rate >= 75 ? 'bg-amber-500' : 'bg-rose-500'
                            }`}
                            style={{ width: `${attendance.attendance_rate || 0}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-white rounded-2xl border border-slate-200 p-5">
                    <h3 className="font-semibold text-slate-900 text-sm flex items-center mb-4">
                      <FiActivity className="h-4 w-4 mr-2 text-navy-700" />
                      Time Metrics
                    </h3>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-600 text-sm">Total Hours Worked</span>
                        <span className="font-semibold text-slate-900">{fixed1(attendance.total_hours)} hrs</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-600 text-sm">Total Late Minutes</span>
                        <span className="font-semibold text-rose-600">{attendance.total_late_minutes || 0} min</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-600 text-sm">Total Extra Minutes</span>
                        <span className="font-semibold text-emerald-600">{attendance.total_extra_minutes || 0} min</span>
                      </div>
                      <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                        <span className="text-slate-600 text-sm">Avg Daily Hours</span>
                        <span className="font-semibold text-slate-900">
                          {Number(attendance.present_days) > 0 ? fixed1(Number(attendance.total_hours) / Number(attendance.present_days)) : 0} hrs
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Weekly Breakdown */}
                <div className="lg:col-span-2">
                  <div className="bg-white rounded-2xl border border-slate-200 p-5">
                    <h3 className="font-semibold text-slate-900 text-sm flex items-center mb-4">
                      <FiBarChart2 className="h-4 w-4 mr-2 text-navy-700" />
                      Weekly Performance
                    </h3>
                    {data?.weekly_breakdown?.length > 0 ? (
                      <div className="space-y-3">
                        {data.weekly_breakdown.map((week, idx) => (
                          <div key={idx} className="border-b border-slate-100 pb-3 last:border-0">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-medium text-slate-700">
                                Week {week.week_number} ({formatDate(week.week_start)})
                              </span>
                              <span className="text-sm font-bold text-emerald-600">
                                {formatCurrency(week.total_collected)}
                              </span>
                            </div>
                            <div className="flex items-center space-x-4 text-xs">
                              <span className="text-slate-500">{week.services_count} services</span>
                              <span className="text-slate-500">
                                Avg: {formatCurrency(Number(week.services_count) > 0 ? Number(week.total_collected) / Number(week.services_count) : 0)}
                              </span>
                            </div>
                            <div className="mt-2 w-full bg-slate-200 rounded-full h-1.5">
                              <div
                                className="bg-navy-500 h-1.5 rounded-full"
                                style={{ width: `${Math.min((week.total_collected / (data?.summary?.total_collected || 1)) * 100, 100)}%` }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="h-48 flex items-center justify-center text-slate-500">
                        <p>No weekly data available</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
      
      {/* Daily Log Modal */}
      <AnimatePresence>
        {showDailyLog && dailyLog && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowDailyLog(false)}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
            >
              <div role="dialog" aria-modal="true" aria-label="Daily activity log" className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[80vh] overflow-hidden">
                <div className="border-b border-slate-200 p-4 flex items-center justify-between bg-slate-50">
                  <div>
                    <h3 className="font-bold text-slate-900">Daily Activity Log</h3>
                    <p className="text-sm text-slate-600">{formatDate(dailyLog.date)}</p>
                  </div>
                  <button
                    onClick={() => setShowDailyLog(false)}
                    aria-label="Close"
                    className="p-2 hover:bg-slate-200 rounded-xl transition-colors"
                  >
                    <FiX className="h-5 w-5 text-slate-500" />
                  </button>
                </div>
                
                <div className="p-4 overflow-y-auto max-h-[calc(80vh-80px)]">
                  {/* Attendance Info */}
                  {dailyLog.attendance && (
                    <div className="bg-slate-50 rounded-xl p-4 mb-4">
                      <h4 className="font-medium text-slate-900 text-sm mb-2">Attendance</h4>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <span className="text-slate-500">Punch In:</span>
                          <span className="ml-2 font-medium">{formatTime(dailyLog.attendance.punch_in)}</span>
                        </div>
                        <div>
                          <span className="text-slate-500">Punch Out:</span>
                          <span className="ml-2 font-medium">{formatTime(dailyLog.attendance.punch_out)}</span>
                        </div>
                        <div>
                          <span className="text-slate-500">Hours Worked:</span>
                          <span className="ml-2 font-medium">{fixed1(dailyLog.attendance.hours)} hrs</span>
                        </div>
                        <div>
                          <span className="text-slate-500">Status:</span>
                          <span className={`ml-2 font-medium ${
                            dailyLog.attendance.status === 'present' ? 'text-emerald-600' : 'text-rose-600'
                          }`}>
                            {dailyLog.attendance.status}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* Services */}
                  {dailyLog.services?.length > 0 ? (
                    <div>
                      <h4 className="font-medium text-slate-900 text-sm mb-3">
                        Services ({dailyLog.services.length})
                      </h4>
                      <div className="space-y-3">
                        {dailyLog.services.map((service, idx) => (
                          <div key={idx} className="border border-slate-200 rounded-xl p-3">
                            <div className="flex justify-between items-start">
                              <div>
                                <p className="font-medium text-slate-900">{service.service_name}</p>
                                <p className="text-sm text-slate-600">{service.customer_name}</p>
                                <p className="text-xs text-slate-500 mt-1">{service.time}</p>
                              </div>
                              <div className="text-right">
                                <p className="font-bold text-emerald-600">{formatCurrency(service.amount)}</p>
                                <p className="text-xs text-slate-500">Profit: {formatCurrency(service.service_charge)}</p>
                              </div>
                            </div>
                            {service.pending > 0 && (
                              <div className="mt-2 text-xs text-amber-600">
                                Pending: {formatCurrency(service.pending)}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                      
                      <div className="mt-4 p-3 bg-slate-100 rounded-xl">
                        <div className="flex justify-between text-sm">
                          <span className="font-medium text-slate-700">Daily Summary</span>
                          <span className="font-bold text-navy-700">{formatCurrency(dailyLog.summary.total_collected)}</span>
                        </div>
                        <div className="flex justify-between text-sm mt-1">
                          <span className="text-slate-600">Services:</span>
                          <span className="font-medium">{dailyLog.summary.total_services}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-600">Your Profit:</span>
                          <span className="font-medium text-emerald-600">{formatCurrency(dailyLog.summary.total_profit)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-600">Avg Transaction:</span>
                          <span className="font-medium">{formatCurrency(dailyLog.summary.avg_transaction)}</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-slate-500">
                      <FiCalendar className="h-12 w-12 mx-auto mb-3 text-slate-400" />
                      <p>No services recorded on this day</p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default StaffPerformance;