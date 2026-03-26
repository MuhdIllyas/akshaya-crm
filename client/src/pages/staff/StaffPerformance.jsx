import React, { useState, useEffect, useMemo } from 'react';
import {
  FiTrendingUp, FiTrendingDown, FiDollarSign, FiBriefcase,
  FiUsers, FiStar, FiCalendar, FiClock, FiAward, FiTarget,
  FiBarChart2, FiPieChart, FiCheckCircle, FiAlertCircle,
  FiRefreshCw, FiDownload, FiFilter, FiChevronRight, FiChevronLeft,
  FiUser, FiPhone, FiMail, FiMapPin, FiActivity, FiSmile,
  FiThumbsUp, FiThumbsDown, FiLoader, FiInfo, FiEye, FiZap, FiHeart, FiGift
} from 'react-icons/fi';
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
  RadialLinearScale
} from 'chart.js';
import { Line, Bar, Doughnut, Radar } from 'react-chartjs-2';
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
  RadialLinearScale
);

// Format currency
const formatCurrency = (amount) => {
  if (amount === undefined || amount === null) return '₹0';
  return `₹${Number(amount).toLocaleString('en-IN', {
    maximumFractionDigits: 0
  })}`;
};

// Format date
const formatDate = (date) => {
  if (!date) return '—';
  const d = new Date(date);
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
};

// Format time
const formatTime = (time) => {
  if (!time) return '—';
  return new Date(`2000-01-01T${time}`).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit'
  });
};

// Stat Card Component
const StatCard = ({ title, value, icon: Icon, color, subtitle, trend, onClick, loading, trendValue }) => (
  <motion.div
    whileHover={{ y: -2 }}
    className="bg-white rounded-xl border border-gray-200 hover:shadow-lg transition-all duration-300 cursor-pointer p-5"
    onClick={onClick}
  >
    <div className="flex items-center justify-between">
      <div>
        <p className="font-medium text-gray-600 mb-1 text-sm">{title}</p>
        {loading ? (
          <div className="h-8 w-24 bg-gray-200 animate-pulse rounded"></div>
        ) : (
          <p className="font-bold text-gray-900 mb-1 text-2xl">{value}</p>
        )}
        {subtitle && (
          <p className="text-gray-500 text-sm">{subtitle}</p>
        )}
        {trend !== undefined && trendValue !== undefined && (
          <p className={`font-medium text-sm mt-1 flex items-center ${trendValue >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
            {trendValue >= 0 ? <FiTrendingUp className="mr-1 h-3 w-3" /> : <FiTrendingDown className="mr-1 h-3 w-3" />}
            {Math.abs(trendValue)}% {trend}
          </p>
        )}
      </div>
      <div className={`rounded-xl ${color} p-3`}>
        <Icon className="text-white h-6 w-6" />
      </div>
    </div>
  </motion.div>
);

// Performance Gauge Component
const PerformanceGauge = ({ score, loading }) => {
  const getScoreColor = () => {
    if (score >= 80) return 'from-emerald-500 to-emerald-600';
    if (score >= 60) return 'from-amber-500 to-amber-600';
    return 'from-rose-500 to-rose-600';
  };
  
  const getScoreLabel = () => {
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Good';
    if (score >= 40) return 'Average';
    return 'Needs Improvement';
  };
  
  const getScoreMessage = () => {
    if (score >= 80) return 'Outstanding! Keep up the great work!';
    if (score >= 60) return 'Good performance. Aim higher!';
    if (score >= 40) return 'Room for improvement. Stay focused!';
    return 'Need to work harder. Ask for help if needed!';
  };
  
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900 text-sm flex items-center">
          <FiAward className="h-4 w-4 mr-2 text-indigo-600" />
          Performance Score
        </h3>
        <div className="relative group">
          <FiInfo className="h-4 w-4 text-gray-400 cursor-pointer" />
          <div className="absolute bottom-full right-0 mb-2 hidden group-hover:block w-64 p-2 bg-gray-900 text-white text-xs rounded-lg z-10">
            Score based on collection rate (50%), revenue efficiency (30%), and consistency (20%)
          </div>
        </div>
      </div>
      
      {loading ? (
        <div className="h-32 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      ) : (
        <div className="text-center">
          <div className="relative inline-block">
            <svg className="w-32 h-32">
              <circle
                className="text-gray-200"
                strokeWidth="12"
                stroke="currentColor"
                fill="transparent"
                r="54"
                cx="64"
                cy="64"
              />
              <circle
                className="transition-all duration-1000"
                strokeWidth="12"
                strokeDasharray={339.292}
                strokeDashoffset={339.292 * (1 - score / 100)}
                strokeLinecap="round"
                stroke={`url(#gradient)`}
                fill="transparent"
                r="54"
                cx="64"
                cy="64"
              />
              <defs>
                <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor={score >= 80 ? '#10B981' : score >= 60 ? '#F59E0B' : '#EF4444'} />
                  <stop offset="100%" stopColor={score >= 80 ? '#059669' : score >= 60 ? '#D97706' : '#DC2626'} />
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center">
              <p className="text-2xl font-bold text-gray-900">{score}%</p>
              <p className="text-xs text-gray-500">{getScoreLabel()}</p>
            </div>
          </div>
          <p className="text-xs text-gray-600 mt-3">{getScoreMessage()}</p>
        </div>
      )}
    </div>
  );
};

// Rating Card Component
const RatingCard = ({ rating, totalReviews, distribution, loading }) => (
  <div className="bg-white rounded-xl border border-gray-200 p-5">
    <div className="flex items-center justify-between mb-4">
      <h3 className="font-semibold text-gray-900 text-sm flex items-center">
        <FiStar className="h-4 w-4 mr-2 text-yellow-500" />
        Customer Rating
      </h3>
    </div>
    
    {loading ? (
      <div className="space-y-3">
        <div className="h-12 bg-gray-200 animate-pulse rounded"></div>
        <div className="h-8 bg-gray-200 animate-pulse rounded"></div>
      </div>
    ) : (
      <>
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-3xl font-bold text-gray-900">
              {rating || '—'}
            </div>
            <div className="flex items-center mt-1">
              {[1, 2, 3, 4, 5].map(star => (
                <FiStar
                  key={star}
                  className={`h-4 w-4 ${star <= Math.round(rating || 0) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`}
                />
              ))}
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-600">{totalReviews || 0} reviews</p>
            <p className="text-xs text-gray-500">Total feedback</p>
          </div>
        </div>
        
        {/* Rating Distribution */}
        {distribution && distribution.length > 0 && (
          <div className="space-y-2 mt-4 pt-4 border-t border-gray-100">
            {distribution.map((item, idx) => {
              const percentage = totalReviews > 0 ? (item.count / totalReviews) * 100 : 0;
              return (
                <div key={idx} className="flex items-center text-xs">
                  <span className="w-8 text-gray-600">{item.rating}★</span>
                  <div className="flex-1 mx-2">
                    <div className="w-full bg-gray-200 rounded-full h-1.5">
                      <div
                        className={`h-1.5 rounded-full ${
                          item.rating >= 4 ? 'bg-emerald-500' :
                          item.rating >= 3 ? 'bg-amber-500' : 'bg-rose-500'
                        }`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                  <span className="w-12 text-right text-gray-500">
                    {Math.round(percentage)}% ({item.count})
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </>
    )}
  </div>
);

// Achievement Card Component
const AchievementCard = ({ achievement, index }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: index * 0.1 }}
    className={`bg-white rounded-xl border p-4 ${
      achievement.earned ? 'border-emerald-200 bg-emerald-50' : 'border-gray-200'
    }`}
  >
    <div className="flex items-center space-x-3">
      <div className={`text-2xl ${achievement.earned ? 'opacity-100' : 'opacity-50'}`}>
        {achievement.icon}
      </div>
      <div className="flex-1">
        <h4 className={`font-semibold text-sm ${achievement.earned ? 'text-emerald-800' : 'text-gray-700'}`}>
          {achievement.name}
        </h4>
        <p className="text-xs text-gray-500">{achievement.description}</p>
        {!achievement.earned && achievement.progress !== undefined && (
          <div className="mt-2">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-gray-600">Progress</span>
              <span className="text-gray-600">{Math.round((achievement.progress / achievement.target) * 100)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-1.5">
              <div
                className="bg-indigo-500 h-1.5 rounded-full"
                style={{ width: `${(achievement.progress / achievement.target) * 100}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
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
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('month');
  const [customDateRange, setCustomDateRange] = useState({ from: '', to: '' });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [achievements, setAchievements] = useState(null);
  const [comparison, setComparison] = useState(null);
  const [serviceBreakdown, setServiceBreakdown] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [showDailyLog, setShowDailyLog] = useState(false);
  const [dailyLog, setDailyLog] = useState(null);
  const [staffInfo, setStaffInfo] = useState(null);
  
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
  
  const fetchPerformance = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      
      // Build query params
      let params = new URLSearchParams();
      
      if (period === 'custom' && customDateRange.from && customDateRange.to) {
        params.append('from', customDateRange.from);
        params.append('to', customDateRange.to);
        params.append('period', 'custom');
      } else {
        params.append('period', period);
      }
      
      // Fetch dashboard data
      const response = await fetch(
        `http://localhost:5000/api/staffperformance/dashboard?${params.toString()}`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      
      if (!response.ok) throw new Error('Failed to fetch performance data');
      
      const result = await response.json();
      setData(result.data);
      
      // Fetch achievements
      const achievementsResponse = await fetch(
        'http://localhost:5000/api/staffperformance/achievements',
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      if (achievementsResponse.ok) {
        const achievementsResult = await achievementsResponse.json();
        setAchievements(achievementsResult.data);
      }
      
      // Fetch comparison data
      const comparisonResponse = await fetch(
        `http://localhost:5000/api/staffperformance/compare?period=${period}`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      if (comparisonResponse.ok) {
        const comparisonResult = await comparisonResponse.json();
        setComparison(comparisonResult.data);
      }
      
      // Fetch service breakdown
      const breakdownResponse = await fetch(
        `http://localhost:5000/api/staffperformance/service-breakdown?${params.toString()}`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      if (breakdownResponse.ok) {
        const breakdownResult = await breakdownResponse.json();
        setServiceBreakdown(breakdownResult.data);
      }
      
    } catch (error) {
      console.error('Error fetching performance:', error);
      toast.error('Failed to load performance data');
    } finally {
      setLoading(false);
    }
  };
  
  const fetchDailyLog = async (date) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `http://localhost:5000/api/staffperformance/daily-log?date=${date}`,
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
  
  useEffect(() => {
    if (staffInfo?.id) {
      fetchPerformance();
    }
  }, [period, customDateRange, staffInfo]);
  
  // Chart data for daily performance
  const dailyChartData = useMemo(() => {
    if (!data?.daily_performance?.length) return null;
    
    return {
      labels: data.daily_performance.map(d => formatDate(d.date)),
      datasets: [
        {
          label: 'Revenue Collected (₹)',
          data: data.daily_performance.map(d => d.collected_amount),
          borderColor: 'rgb(99, 102, 241)',
          backgroundColor: 'rgba(99, 102, 241, 0.1)',
          tension: 0.4,
          fill: true,
          yAxisID: 'y',
        },
        {
          label: 'Services Count',
          data: data.daily_performance.map(d => d.services_count),
          borderColor: 'rgb(16, 185, 129)',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          tension: 0.4,
          fill: true,
          yAxisID: 'y1',
        }
      ]
    };
  }, [data]);
  
  const dailyChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { position: 'top', labels: { font: { size: 11 } } },
      tooltip: {
        callbacks: {
          label: (context) => {
            let label = context.dataset.label || '';
            let value = context.raw;
            if (context.dataset.label?.includes('Revenue')) {
              return `${label}: ${formatCurrency(value)}`;
            }
            return `${label}: ${value}`;
          }
        }
      }
    },
    scales: {
      y: {
        type: 'linear',
        display: true,
        position: 'left',
        title: { display: true, text: 'Revenue (₹)', font: { size: 10 } },
        ticks: { callback: (value) => `₹${value/1000}k`, font: { size: 10 } }
      },
      y1: {
        type: 'linear',
        display: true,
        position: 'right',
        title: { display: true, text: 'Services', font: { size: 10 } },
        grid: { drawOnChartArea: false },
        ticks: { font: { size: 10 } }
      },
      x: {
        ticks: { font: { size: 10 }, maxRotation: 45, minRotation: 45 }
      }
    }
  };
  
  // Category breakdown chart
  const categoryChartData = useMemo(() => {
    if (!serviceBreakdown?.length) return null;
    
    const top5 = serviceBreakdown.slice(0, 5);
    const colors = ['#6366F1', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];
    
    return {
      labels: top5.map(c => c.service_name),
      datasets: [{
        data: top5.map(c => c.total_revenue),
        backgroundColor: colors,
        borderWidth: 0
      }]
    };
  }, [serviceBreakdown]);
  
  // Monthly trends chart
  const monthlyTrendsChart = useMemo(() => {
    if (!data?.monthly_trends?.length) return null;
    
    return {
      labels: data.monthly_trends.map(t => t.month),
      datasets: [
        {
          label: 'Revenue',
          data: data.monthly_trends.map(t => t.total_collected),
          borderColor: 'rgb(99, 102, 241)',
          backgroundColor: 'rgba(99, 102, 241, 0.1)',
          fill: true,
          tension: 0.4,
        },
        {
          label: 'Profit',
          data: data.monthly_trends.map(t => t.service_charges),
          borderColor: 'rgb(16, 185, 129)',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          fill: true,
          tension: 0.4,
        }
      ]
    };
  }, [data]);
  
  const summary = data?.summary || {};
  const pending = data?.pending || {};
  const ratings = data?.ratings || {};
  const attendance = data?.attendance || {};
  
  const tabs = [
    { id: 'overview', label: 'Overview', icon: FiBarChart2 },
    { id: 'services', label: 'Services', icon: FiBriefcase },
    { id: 'achievements', label: 'Achievements', icon: FiAward },
    { id: 'attendance', label: 'Attendance', icon: FiClock }
  ];
  
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-30 shadow-sm">
        <div className="px-6 py-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                <FiTrendingUp className="text-white h-6 w-6" />
              </div>
              <div>
                <h1 className="font-bold text-gray-900 text-2xl">My Performance Dashboard</h1>
                <p className="text-gray-600 flex items-center text-sm">
                  <FiBriefcase className="h-3 w-3 mr-1" />
                  Track your revenue, services, and customer satisfaction
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              {/* Period Selector */}
              <div className="relative">
                <button
                  onClick={() => setShowDatePicker(!showDatePicker)}
                  className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <FiCalendar className="h-4 w-4 text-gray-500" />
                  <span className="text-sm">
                    {period === 'today' && 'Today'}
                    {period === 'week' && 'This Week'}
                    {period === 'month' && 'This Month'}
                    {period === 'quarter' && 'This Quarter'}
                    {period === 'year' && 'This Year'}
                    {period === 'custom' && 'Custom Range'}
                  </span>
                  <FiChevronRight className="h-4 w-4 text-gray-500 transform rotate-90" />
                </button>
                
                <AnimatePresence>
                  {showDatePicker && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setShowDatePicker(false)} />
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className="absolute top-full mt-2 right-0 bg-white border border-gray-200 rounded-lg shadow-lg z-50 w-64"
                      >
                        <div className="p-3">
                          <button
                            onClick={() => { setPeriod('today'); setShowDatePicker(false); }}
                            className={`w-full text-left px-3 py-2 rounded-lg text-sm ${period === 'today' ? 'bg-indigo-50 text-indigo-600' : 'hover:bg-gray-50'}`}
                          >
                            Today
                          </button>
                          <button
                            onClick={() => { setPeriod('week'); setShowDatePicker(false); }}
                            className={`w-full text-left px-3 py-2 rounded-lg text-sm ${period === 'week' ? 'bg-indigo-50 text-indigo-600' : 'hover:bg-gray-50'}`}
                          >
                            This Week
                          </button>
                          <button
                            onClick={() => { setPeriod('month'); setShowDatePicker(false); }}
                            className={`w-full text-left px-3 py-2 rounded-lg text-sm ${period === 'month' ? 'bg-indigo-50 text-indigo-600' : 'hover:bg-gray-50'}`}
                          >
                            This Month
                          </button>
                          <button
                            onClick={() => { setPeriod('quarter'); setShowDatePicker(false); }}
                            className={`w-full text-left px-3 py-2 rounded-lg text-sm ${period === 'quarter' ? 'bg-indigo-50 text-indigo-600' : 'hover:bg-gray-50'}`}
                          >
                            This Quarter
                          </button>
                          <button
                            onClick={() => { setPeriod('year'); setShowDatePicker(false); }}
                            className={`w-full text-left px-3 py-2 rounded-lg text-sm ${period === 'year' ? 'bg-indigo-50 text-indigo-600' : 'hover:bg-gray-50'}`}
                          >
                            This Year
                          </button>
                          <div className="border-t border-gray-200 my-2"></div>
                          <div className="space-y-2">
                            <input
                              type="date"
                              value={customDateRange.from}
                              onChange={(e) => setCustomDateRange(prev => ({ ...prev, from: e.target.value }))}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                              placeholder="From Date"
                            />
                            <input
                              type="date"
                              value={customDateRange.to}
                              onChange={(e) => setCustomDateRange(prev => ({ ...prev, to: e.target.value }))}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                              placeholder="To Date"
                            />
                            <button
                              onClick={() => { setPeriod('custom'); setShowDatePicker(false); }}
                              className="w-full px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700"
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
                className="p-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                disabled={loading}
              >
                <FiRefreshCw className={`h-4 w-4 text-gray-600 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
          
          {/* Staff Info */}
          {staffInfo && (
            <div className="mt-4 flex items-center space-x-4 p-4 bg-gray-50 rounded-lg">
              <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center">
                <span className="text-indigo-600 font-bold text-lg">
                  {staffInfo.name?.charAt(0) || 'S'}
                </span>
              </div>
              <div>
                <h2 className="font-semibold text-gray-900">{staffInfo.name}</h2>
                <div className="flex flex-wrap gap-3 mt-1">
                  <span className="text-xs text-gray-500 flex items-center">
                    <FiBriefcase className="h-3 w-3 mr-1" />
                    {staffInfo.role || 'Staff'}
                  </span>
                  <span className="text-xs text-gray-500 flex items-center">
                    <FiTarget className="h-3 w-3 mr-1" />
                    Staff ID: {staffInfo.id}
                  </span>
                </div>
              </div>
            </div>
          )}
          
          {/* Period Info */}
          {data?.period && (
            <div className="mt-3 text-sm text-gray-500 flex items-center">
              <FiCalendar className="h-4 w-4 mr-1" />
              Showing data from {formatDate(data.period.from)} to {formatDate(data.period.to)} ({data.period.total_days} days)
            </div>
          )}
        </div>
        
        {/* Tabs */}
        <div className="border-t border-gray-200 px-6">
          <div className="flex space-x-6 overflow-x-auto">
            {tabs.map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-2 py-3 border-b-2 text-sm font-medium transition-colors whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'border-indigo-500 text-indigo-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
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
              <FiLoader className="animate-spin h-8 w-8 text-indigo-600 mx-auto mb-3" />
              <p className="text-gray-500">Loading your performance data...</p>
            </div>
          </div>
        ) : !data ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <FiBarChart2 className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Data Available</h3>
            <p className="text-gray-500">
              No service records found for the selected period. Try selecting a different date range.
            </p>
          </div>
        ) : (
          <>
            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <>
                {/* Stats Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <StatCard
                    title="Revenue Collected"
                    value={formatCurrency(summary.total_collected)}
                    subtitle={`Billed: ${formatCurrency(summary.total_billed)}`}
                    icon={FiDollarSign}
                    color="bg-emerald-600"
                    loading={loading}
                    trend="vs last period"
                    trendValue={comparison?.metrics?.revenue?.change}
                  />
                  <StatCard
                    title="Services Completed"
                    value={summary.total_services || 0}
                    subtitle="Total services"
                    icon={FiBriefcase}
                    color="bg-blue-600"
                    loading={loading}
                    trend="vs last period"
                    trendValue={comparison?.metrics?.services?.change}
                  />
                  <StatCard
                    title="Collection Rate"
                    value={`${summary.collection_rate || 0}%`}
                    subtitle="Of total billed"
                    icon={FiTarget}
                    color="bg-purple-600"
                    loading={loading}
                  />
                  <StatCard
                    title="Service Charge Earned"
                    value={formatCurrency(summary.total_service_charges)}
                    subtitle="Your profit"
                    icon={FiTrendingUp}
                    color="bg-amber-600"
                    loading={loading}
                    trend="vs last period"
                    trendValue={comparison?.metrics?.profit?.change}
                  />
                </div>
                
                {/* Second Row */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <StatCard
                    title="Avg Daily Revenue"
                    value={formatCurrency(summary.avg_daily_revenue)}
                    subtitle="Per active day"
                    icon={FiActivity}
                    color="bg-indigo-600"
                    loading={loading}
                  />
                  <StatCard
                    title="Avg Transaction Value"
                    value={formatCurrency(summary.avg_transaction_value)}
                    subtitle="Per service"
                    icon={FiTrendingUp}
                    color="bg-cyan-600"
                    loading={loading}
                  />
                  <StatCard
                    title="Active Days"
                    value={summary.active_days || 0}
                    subtitle={`Out of ${data?.period?.total_days || 0} days`}
                    icon={FiCalendar}
                    color="bg-teal-600"
                    loading={loading}
                  />
                </div>
                
                {/* Performance & Ratings Row */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
                  <PerformanceGauge score={summary.incentive_score} loading={loading} />
                  <RatingCard 
                    rating={ratings.avg_rating} 
                    totalReviews={ratings.total_reviews}
                    distribution={ratings.distribution}
                    loading={loading}
                  />
                </div>
                
                {/* Pending Payments Alert */}
                {pending.pending_count > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-3">
                        <div className="p-2 bg-amber-100 rounded-lg">
                          <FiClock className="h-5 w-5 text-amber-600" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-amber-800">Pending Payments</h3>
                          <p className="text-amber-700 text-sm mt-1">
                            You have {pending.pending_count} pending payment{pending.pending_count !== 1 ? 's' : ''} totaling {formatCurrency(pending.pending_amount)}
                          </p>
                          {pending.overdue_count > 0 && (
                            <p className="text-rose-600 text-sm mt-1">
                              {pending.overdue_count} overdue payment{pending.overdue_count !== 1 ? 's' : ''} ({formatCurrency(pending.overdue_amount)})
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Daily Performance Chart */}
                {dailyChartData && (
                  <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="font-semibold text-gray-900 text-sm flex items-center">
                          <FiBarChart2 className="h-4 w-4 mr-2 text-indigo-600" />
                          Daily Performance
                        </h3>
                        <p className="text-gray-500 text-xs">Revenue & Services Trend</p>
                      </div>
                      <button
                        onClick={() => setActiveTab('services')}
                        className="text-xs text-indigo-600 hover:text-indigo-800"
                      >
                        View Details →
                      </button>
                    </div>
                    <div className="h-80">
                      <Line data={dailyChartData} options={dailyChartOptions} />
                    </div>
                  </div>
                )}
                
                {/* Monthly Trends */}
                {monthlyTrendsChart && (
                  <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
                    <h3 className="font-semibold text-gray-900 text-sm flex items-center mb-4">
                      <FiTrendingUp className="h-4 w-4 mr-2 text-indigo-600" />
                      Monthly Performance Trend
                    </h3>
                    <div className="h-64">
                      <Line data={monthlyTrendsChart} options={{ responsive: true, maintainAspectRatio: false }} />
                    </div>
                  </div>
                )}
                
                {/* Recent Services */}
                {data?.recent_services?.length > 0 && (
                  <div className="bg-white rounded-xl border border-gray-200 p-5">
                    <h3 className="font-semibold text-gray-900 text-sm flex items-center mb-4">
                      <FiClock className="h-4 w-4 mr-2 text-indigo-600" />
                      Recent Services
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-50 border-b border-gray-200">
                          <tr>
                            <th className="py-2 px-3 text-left text-xs font-medium text-gray-500">Date</th>
                            <th className="py-2 px-3 text-left text-xs font-medium text-gray-500">Customer</th>
                            <th className="py-2 px-3 text-left text-xs font-medium text-gray-500">Service</th>
                            <th className="py-2 px-3 text-left text-xs font-medium text-gray-500">Amount</th>
                            <th className="py-2 px-3 text-left text-xs font-medium text-gray-500">Your Profit</th>
                            <th className="py-2 px-3 text-left text-xs font-medium text-gray-500">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.recent_services.slice(0, 10).map((service, idx) => (
                            <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer" onClick={() => fetchDailyLog(service.created_at?.split('T')[0])}>
                              <td className="py-2 px-3 text-sm text-gray-600">{formatDate(service.created_at)}</td>
                              <td className="py-2 px-3 text-sm text-gray-900">{service.customer_name}</td>
                              <td className="py-2 px-3 text-sm text-gray-600">{service.service_name}</td>
                              <td className="py-2 px-3 font-semibold text-emerald-600 text-sm">{formatCurrency(service.received_amount)}</td>
                              <td className="py-2 px-3 font-semibold text-indigo-600 text-sm">{formatCurrency(service.service_charges)}</td>
                              <td className="py-2 px-3">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                  service.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                                  service.pending_amount > 0 ? 'bg-yellow-100 text-yellow-700' :
                                  'bg-gray-100 text-gray-700'
                                }`}>
                                  {service.status === 'completed' ? 'Completed' : 
                                   service.pending_amount > 0 ? `Pending (${formatCurrency(service.pending_amount)})` : 'Completed'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {data.recent_services.length > 10 && (
                      <div className="mt-4 text-center">
                        <button className="text-sm text-indigo-600 hover:text-indigo-800">
                          View All Services →
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
            
            {/* Services Tab */}
            {activeTab === 'services' && (
              <>
                {/* Category Breakdown */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                  <div className="bg-white rounded-xl border border-gray-200 p-5">
                    <h3 className="font-semibold text-gray-900 text-sm flex items-center mb-4">
                      <FiPieChart className="h-4 w-4 mr-2 text-indigo-600" />
                      Revenue by Service Category
                    </h3>
                    {categoryChartData && serviceBreakdown?.length > 0 ? (
                      <div className="flex items-center h-64">
                        <div className="w-1/2">
                          <Doughnut data={categoryChartData} options={{ cutout: '60%' }} />
                        </div>
                        <div className="w-1/2 pl-4">
                          <div className="space-y-2 max-h-56 overflow-y-auto">
                            {serviceBreakdown.slice(0, 5).map((cat, idx) => (
                              <div key={idx} className="flex items-center justify-between text-sm">
                                <div className="flex items-center">
                                  <div className="w-2 h-2 rounded-full mr-2" style={{ backgroundColor: categoryChartData.datasets[0].backgroundColor[idx] }} />
                                  <span className="text-gray-700 truncate max-w-[120px]">{cat.service_name}</span>
                                </div>
                                <div className="text-right">
                                  <p className="font-semibold text-gray-900">{formatCurrency(cat.total_revenue)}</p>
                                  <p className="text-xs text-gray-500">{cat.total_services} services</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="h-64 flex items-center justify-center text-gray-500">
                        <p>No service data available</p>
                      </div>
                    )}
                  </div>
                  
                  {/* Service Performance Metrics */}
                  <div className="bg-white rounded-xl border border-gray-200 p-5">
                    <h3 className="font-semibold text-gray-900 text-sm flex items-center mb-4">
                      <FiActivity className="h-4 w-4 mr-2 text-indigo-600" />
                      Service Performance Metrics
                    </h3>
                    {serviceBreakdown?.length > 0 ? (
                      <div className="space-y-4 max-h-64 overflow-y-auto">
                        {serviceBreakdown.map((service, idx) => (
                          <div key={idx} className="border-b border-gray-100 pb-3 last:border-0">
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-medium text-gray-900 text-sm">{service.service_name}</span>
                              <span className="text-xs font-semibold text-emerald-600">{formatCurrency(service.total_revenue)}</span>
                            </div>
                            <div className="grid grid-cols-3 gap-2 text-xs">
                              <div>
                                <p className="text-gray-500">Services</p>
                                <p className="font-semibold text-gray-700">{service.total_services}</p>
                              </div>
                              <div>
                                <p className="text-gray-500">Avg Revenue</p>
                                <p className="font-semibold text-gray-700">{formatCurrency(service.avg_revenue)}</p>
                              </div>
                              <div>
                                <p className="text-gray-500">Profit</p>
                                <p className="font-semibold text-indigo-600">{formatCurrency(service.total_profit)}</p>
                              </div>
                            </div>
                            <div className="mt-2">
                              <div className="flex justify-between text-xs mb-1">
                                <span className="text-gray-500">Revenue Share</span>
                                <span className="text-gray-500">{Math.round(service.revenue_percentage)}%</span>
                              </div>
                              <div className="w-full bg-gray-200 rounded-full h-1.5">
                                <div
                                  className="bg-indigo-500 h-1.5 rounded-full"
                                  style={{ width: `${service.revenue_percentage}%` }}
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="h-64 flex items-center justify-center text-gray-500">
                        <p>No service data available</p>
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Top Customers */}
                {data?.top_customers?.length > 0 && (
                  <div className="bg-white rounded-xl border border-gray-200 p-5">
                    <h3 className="font-semibold text-gray-900 text-sm flex items-center mb-4">
                      <FiUsers className="h-4 w-4 mr-2 text-indigo-600" />
                      Top Customers
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {data.top_customers.map((customer, idx) => (
                        <div key={idx} className="border border-gray-200 rounded-lg p-3 hover:shadow-md transition-shadow">
                          <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
                              <FiUser className="h-5 w-5 text-indigo-600" />
                            </div>
                            <div className="flex-1">
                              <p className="font-medium text-gray-900 text-sm truncate">{customer.customer_name}</p>
                              <p className="text-xs text-gray-500">{customer.phone}</p>
                            </div>
                            <div className="text-right">
                              <p className="font-bold text-emerald-600 text-sm">{formatCurrency(customer.total_spent)}</p>
                              <p className="text-xs text-gray-500">{customer.service_count} services</p>
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
            {activeTab === 'achievements' && achievements && (
              <>
                {/* Lifetime Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl p-4 text-white">
                    <p className="text-indigo-100 text-xs">Lifetime Services</p>
                    <p className="text-2xl font-bold">{achievements.lifetime?.total_services || 0}</p>
                  </div>
                  <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl p-4 text-white">
                    <p className="text-emerald-100 text-xs">Lifetime Revenue</p>
                    <p className="text-2xl font-bold">{formatCurrency(achievements.lifetime?.total_revenue || 0)}</p>
                  </div>
                  <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-4 text-white">
                    <p className="text-purple-100 text-xs">Unique Customers</p>
                    <p className="text-2xl font-bold">{achievements.lifetime?.unique_customers || 0}</p>
                  </div>
                  <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl p-4 text-white">
                    <p className="text-amber-100 text-xs">Active Days</p>
                    <p className="text-2xl font-bold">{achievements.lifetime?.active_days || 0}</p>
                  </div>
                </div>
                
                {/* Best Day & Top Customer */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  {achievements.best_day && (
                    <div className="bg-white rounded-xl border border-gray-200 p-5">
                      <div className="flex items-center space-x-3 mb-3">
                        <div className="p-2 bg-amber-100 rounded-lg">
                          <FiZap className="h-5 w-5 text-amber-600" />
                        </div>
                        <h3 className="font-semibold text-gray-900">Best Day Ever!</h3>
                      </div>
                      <p className="text-sm text-gray-600">On {formatDate(achievements.best_day.date)}</p>
                      <div className="grid grid-cols-2 gap-3 mt-3">
                        <div>
                          <p className="text-xs text-gray-500">Services</p>
                          <p className="text-xl font-bold text-gray-900">{achievements.best_day.services_count}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Revenue</p>
                          <p className="text-xl font-bold text-emerald-600">{formatCurrency(achievements.best_day.revenue)}</p>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {achievements.top_customer && (
                    <div className="bg-white rounded-xl border border-gray-200 p-5">
                      <div className="flex items-center space-x-3 mb-3">
                        <div className="p-2 bg-purple-100 rounded-lg">
                          <FiHeart className="h-5 w-5 text-purple-600" />
                        </div>
                        <h3 className="font-semibold text-gray-900">Top Customer</h3>
                      </div>
                      <p className="text-sm font-medium text-gray-900">{achievements.top_customer.name}</p>
                      <div className="grid grid-cols-2 gap-3 mt-3">
                        <div>
                          <p className="text-xs text-gray-500">Services</p>
                          <p className="text-xl font-bold text-gray-900">{achievements.top_customer.services_count}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Total Spent</p>
                          <p className="text-xl font-bold text-emerald-600">{formatCurrency(achievements.top_customer.total_spent)}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Achievements Grid */}
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <h3 className="font-semibold text-gray-900 text-sm flex items-center mb-4">
                    <FiAward className="h-4 w-4 mr-2 text-yellow-500" />
                    Your Achievements
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
                  <div className="bg-white rounded-xl border border-gray-200 p-5">
                    <h3 className="font-semibold text-gray-900 text-sm flex items-center mb-4">
                      <FiClock className="h-4 w-4 mr-2 text-indigo-600" />
                      Attendance Summary
                    </h3>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600 text-sm">Total Days</span>
                        <span className="font-semibold text-gray-900">{attendance.total_days || 0}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600 text-sm">Present Days</span>
                        <span className="font-semibold text-emerald-600">{attendance.present_days || 0}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600 text-sm">Absent Days</span>
                        <span className="font-semibold text-rose-600">{attendance.absent_days || 0}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600 text-sm">Late Days</span>
                        <span className="font-semibold text-amber-600">{attendance.late_days || 0}</span>
                      </div>
                      <div className="pt-3 border-t border-gray-100">
                        <div className="flex items-center justify-between">
                          <span className="text-gray-600 text-sm">Attendance Rate</span>
                          <span className={`font-bold text-lg ${
                            attendance.attendance_rate >= 90 ? 'text-emerald-600' :
                            attendance.attendance_rate >= 75 ? 'text-amber-600' : 'text-rose-600'
                          }`}>
                            {attendance.attendance_rate || 0}%
                          </span>
                        </div>
                        <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
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
                  
                  <div className="bg-white rounded-xl border border-gray-200 p-5">
                    <h3 className="font-semibold text-gray-900 text-sm flex items-center mb-4">
                      <FiActivity className="h-4 w-4 mr-2 text-indigo-600" />
                      Time Metrics
                    </h3>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600 text-sm">Total Hours Worked</span>
                        <span className="font-semibold text-gray-900">{attendance.total_hours?.toFixed(1) || 0} hrs</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600 text-sm">Total Late Minutes</span>
                        <span className="font-semibold text-rose-600">{attendance.total_late_minutes || 0} min</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600 text-sm">Total Extra Minutes</span>
                        <span className="font-semibold text-emerald-600">{attendance.total_extra_minutes || 0} min</span>
                      </div>
                      <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                        <span className="text-gray-600 text-sm">Avg Daily Hours</span>
                        <span className="font-semibold text-gray-900">
                          {attendance.present_days > 0 ? (attendance.total_hours / attendance.present_days).toFixed(1) : 0} hrs
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Weekly Breakdown */}
                <div className="lg:col-span-2">
                  <div className="bg-white rounded-xl border border-gray-200 p-5">
                    <h3 className="font-semibold text-gray-900 text-sm flex items-center mb-4">
                      <FiBarChart2 className="h-4 w-4 mr-2 text-indigo-600" />
                      Weekly Performance
                    </h3>
                    {data?.weekly_breakdown?.length > 0 ? (
                      <div className="space-y-3">
                        {data.weekly_breakdown.map((week, idx) => (
                          <div key={idx} className="border-b border-gray-100 pb-3 last:border-0">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-medium text-gray-700">
                                Week {week.week_number} ({formatDate(week.week_start)})
                              </span>
                              <span className="text-sm font-bold text-emerald-600">
                                {formatCurrency(week.total_collected)}
                              </span>
                            </div>
                            <div className="flex items-center space-x-4 text-xs">
                              <span className="text-gray-500">{week.services_count} services</span>
                              <span className="text-gray-500">
                                Avg: {formatCurrency(week.total_collected / week.services_count)}
                              </span>
                            </div>
                            <div className="mt-2 w-full bg-gray-200 rounded-full h-1.5">
                              <div
                                className="bg-indigo-500 h-1.5 rounded-full"
                                style={{ width: `${Math.min((week.total_collected / (data?.summary?.total_collected || 1)) * 100, 100)}%` }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="h-48 flex items-center justify-center text-gray-500">
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
              <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] overflow-hidden">
                <div className="border-b border-gray-200 p-4 flex items-center justify-between bg-gray-50">
                  <div>
                    <h3 className="font-bold text-gray-900">Daily Activity Log</h3>
                    <p className="text-sm text-gray-600">{formatDate(dailyLog.date)}</p>
                  </div>
                  <button
                    onClick={() => setShowDailyLog(false)}
                    className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
                  >
                    <FiX className="h-5 w-5 text-gray-500" />
                  </button>
                </div>
                
                <div className="p-4 overflow-y-auto max-h-[calc(80vh-80px)]">
                  {/* Attendance Info */}
                  {dailyLog.attendance && (
                    <div className="bg-gray-50 rounded-lg p-4 mb-4">
                      <h4 className="font-medium text-gray-900 text-sm mb-2">Attendance</h4>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <span className="text-gray-500">Punch In:</span>
                          <span className="ml-2 font-medium">{formatTime(dailyLog.attendance.punch_in)}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">Punch Out:</span>
                          <span className="ml-2 font-medium">{formatTime(dailyLog.attendance.punch_out)}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">Hours Worked:</span>
                          <span className="ml-2 font-medium">{dailyLog.attendance.hours?.toFixed(1)} hrs</span>
                        </div>
                        <div>
                          <span className="text-gray-500">Status:</span>
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
                  {dailyLog.services.length > 0 ? (
                    <div>
                      <h4 className="font-medium text-gray-900 text-sm mb-3">
                        Services ({dailyLog.services.length})
                      </h4>
                      <div className="space-y-3">
                        {dailyLog.services.map((service, idx) => (
                          <div key={idx} className="border border-gray-200 rounded-lg p-3">
                            <div className="flex justify-between items-start">
                              <div>
                                <p className="font-medium text-gray-900">{service.service_name}</p>
                                <p className="text-sm text-gray-600">{service.customer_name}</p>
                                <p className="text-xs text-gray-500 mt-1">{service.time}</p>
                              </div>
                              <div className="text-right">
                                <p className="font-bold text-emerald-600">{formatCurrency(service.amount)}</p>
                                <p className="text-xs text-gray-500">Profit: {formatCurrency(service.service_charge)}</p>
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
                      
                      <div className="mt-4 p-3 bg-indigo-50 rounded-lg">
                        <div className="flex justify-between text-sm">
                          <span className="font-medium text-gray-700">Daily Summary</span>
                          <span className="font-bold text-indigo-600">{formatCurrency(dailyLog.summary.total_collected)}</span>
                        </div>
                        <div className="flex justify-between text-sm mt-1">
                          <span className="text-gray-600">Services:</span>
                          <span className="font-medium">{dailyLog.summary.total_services}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Your Profit:</span>
                          <span className="font-medium text-emerald-600">{formatCurrency(dailyLog.summary.total_profit)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Avg Transaction:</span>
                          <span className="font-medium">{formatCurrency(dailyLog.summary.avg_transaction)}</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <FiCalendar className="h-12 w-12 mx-auto mb-3 text-gray-300" />
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