import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { 
  FiUsers, FiClock, FiCheckCircle, FiPlayCircle, FiPlus, FiSearch, 
  FiAlertCircle, FiRefreshCw, FiCalendar, FiBarChart2, FiTrendingUp,
  FiUser, FiAward, FiXCircle, FiCheckSquare, FiTarget, FiDollarSign,
  FiBriefcase, FiActivity, FiStar, FiInfo, FiChevronRight
} from 'react-icons/fi';
import { getCategories, getTokens, getServiceEntries } from '/src/services/serviceService';
import { getWalletsForCentre } from '@/services/walletService';
import QuickServiceModal from '@/components/QuickServiceModal';
import api from '@/services/serviceService';
import { socket, connectSocket } from '@/services/socket';

// Helper functions
const formatCurrency = (amount) => {
  if (amount === undefined || amount === null) return '₹0';
  return `₹${Number(amount).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
};

const formatDate = (date) => {
  if (!date) return '—';
  const d = new Date(date);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

// Stat Card Component
const StatCard = ({ title, value, icon: Icon, color, subtitle, loading }) => (
  <motion.div
    whileHover={{ y: -2 }}
    className="bg-white rounded-xl border border-gray-200 hover:shadow-lg transition-all duration-300 p-5"
  >
    <div className="flex items-center justify-between">
      <div>
        <p className="font-medium text-gray-600 mb-1 text-sm">{title}</p>
        {loading ? (
          <div className="h-8 w-20 bg-gray-200 animate-pulse rounded"></div>
        ) : (
          <p className="font-bold text-gray-900 text-2xl">{value}</p>
        )}
        {subtitle && <p className="text-gray-500 text-sm mt-1">{subtitle}</p>}
      </div>
      <div className={`rounded-xl ${color} p-3`}>
        <Icon className="text-white h-6 w-6" />
      </div>
    </div>
  </motion.div>
);

const StaffDashboard = () => {
  const navigate = useNavigate();
  const [tokens, setTokens] = useState([]);
  const [categories, setCategories] = useState([]);
  const [recentServiceEntries, setRecentServiceEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeDate, setActiveDate] = useState('today');
  const [activeView, setActiveView] = useState('active');
  const staffId = localStorage.getItem('id')?.trim();
  const centreId = localStorage.getItem('centre_id')?.trim();
  const [showQuickService, setShowQuickService] = useState(false);
  const [wallets, setWallets] = useState([]);
  const [onlineBookings, setOnlineBookings] = useState([]);
  const [processingBookings, setProcessingBookings] = useState([]);
  const [lastUpdated, setLastUpdated] = useState(new Date());

  // Period state (same as StaffPerformance)
  const [period, setPeriod] = useState('month');
  const [customDateRange, setCustomDateRange] = useState({ from: '', to: '' });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [performanceLoading, setPerformanceLoading] = useState(false);

  // Performance metrics from backend
  const [performance, setPerformance] = useState({
    completionRate: 0,
    avgTransactionValue: 0,
    customerSatisfaction: 'N/A',
    totalServices: 0,
    totalCollected: 0,
    collectionRate: 0,
    incentiveScore: 0,
    avgRating: 0,
    totalReviews: 0,
  });

  const hasJoinedCentre = useRef(false);

  // --- Welcome banner state ---
  const [currentTime, setCurrentTime] = useState(new Date());
  const staffName = localStorage.getItem('username') || 'Staff';
  const staffInitials = staffName
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'ST';

  // Update clock every minute
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const getGreeting = () => {
    const hour = currentTime.getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const formatCurrentTime = (date) =>
    date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  const formatCurrentDate = (date) =>
    date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  // --- Socket setup (unchanged) ---
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    if (!socket.connected) connectSocket(token);

    const onConnect = () => {
      if (centreId && !hasJoinedCentre.current) {
        socket.emit('joinCentre', centreId);
        hasJoinedCentre.current = true;
      }
    };

    const onConnectError = (error) => {
      if (error.message === 'Socket authentication failed') {
        toast.error('Session expired. Please login again.');
      }
    };

    socket.on('connect', onConnect);
    socket.on('connect_error', onConnectError);

    if (socket.connected && centreId && !hasJoinedCentre.current) {
      socket.emit('joinCentre', centreId);
      hasJoinedCentre.current = true;
    }

    return () => {
      socket.off('connect', onConnect);
      socket.off('connect_error', onConnectError);
    };
  }, [centreId]);

  // --- Refresh tokens (unchanged) ---
  const refreshTokens = useCallback(async () => {
    try {
      const tokensRes = await getTokens(centreId, 'all');
      setTokens(tokensRes.data || []);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Error refreshing tokens:', err);
    }
  }, [centreId]);

  // --- Fetch service entries (unchanged) ---
  const fetchServiceEntries = useCallback(async () => {
    try {
      const serviceEntriesRes = await getServiceEntries();
      let staffEntries = serviceEntriesRes.data;
      const hasStaffId = serviceEntriesRes.data.some(entry => entry.staff_id || entry.staffId);
      if (hasStaffId) {
        staffEntries = serviceEntriesRes.data.filter(entry => {
          const entryStaffId = String(entry.staff_id || entry.staffId || '').trim();
          return entryStaffId === String(staffId).trim();
        });
      }
      const sortedEntries = staffEntries.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      setRecentServiceEntries(sortedEntries.slice(0, 5));
      return sortedEntries;
    } catch (err) {
      console.error('Error fetching service entries:', err);
      return [];
    }
  }, [staffId]);

  // --- Fetch online bookings (unchanged) ---
  const fetchOnlineBookings = useCallback(async () => {
    try {
      const pendingRes = await api.get('/customer-services', { params: { status: 'under_review' } });
      const processingRes = await api.get('/customer-services', { params: { status: 'processing', staff_id: staffId } });
      const serviceEntriesRes = await getServiceEntries();
      const processedBookingIds = new Set();
      serviceEntriesRes.data.forEach(entry => {
        if (entry.customer_service_id) processedBookingIds.add(entry.customer_service_id.toString());
      });
      const filteredProcessingBookings = (processingRes.data || []).filter(
        booking => !processedBookingIds.has(booking.id.toString())
      );
      setOnlineBookings(pendingRes.data || []);
      setProcessingBookings(filteredProcessingBookings);
    } catch (err) {
      console.error('Error fetching online bookings:', err);
      toast.error('Failed to load online bookings');
    }
  }, [staffId]);

  // --- Fetch performance metrics with period support ---
  const fetchPerformance = useCallback(async () => {
    setPerformanceLoading(true);
    try {
      const token = localStorage.getItem('token');
      let params = new URLSearchParams();
      
      if (period === 'custom' && customDateRange.from && customDateRange.to) {
        params.append('from', customDateRange.from);
        params.append('to', customDateRange.to);
        params.append('period', 'custom');
      } else {
        params.append('period', period);
      }
      
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/staffperformance/dashboard?${params.toString()}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (!response.ok) throw new Error('Failed to fetch performance data');
      
      const result = await response.json();
      const { summary, ratings } = result.data;
      
      setPerformance({
        completionRate: summary.collection_rate || 0,
        avgTransactionValue: summary.avg_transaction_value || 0,
        customerSatisfaction: ratings?.avg_rating ? `${ratings.avg_rating}/5` : 'N/A',
        totalServices: summary.total_services || 0,
        totalCollected: summary.total_collected || 0,
        collectionRate: summary.collection_rate || 0,
        incentiveScore: summary.incentive_score || 0,
        avgRating: ratings?.avg_rating || 0,
        totalReviews: ratings?.total_reviews || 0,
      });
    } catch (err) {
      console.error('Error fetching performance:', err);
      toast.error('Failed to load performance data');
    } finally {
      setPerformanceLoading(false);
    }
  }, [period, customDateRange]);

  // Load wallets (unchanged)
  useEffect(() => {
    getWalletsForCentre().then(setWallets).catch(() => toast.error('Failed to load wallets'));
  }, []);

  // Initial data fetch
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        if (!staffId || !centreId) throw new Error('Missing staff or centre ID');
        const categoriesRes = await getCategories();
        setCategories(categoriesRes.data || []);
        await refreshTokens();
        await fetchServiceEntries();
        await fetchOnlineBookings();
        await fetchPerformance();
      } catch (err) {
        setError('Failed to load dashboard data: ' + (err.response?.data?.error || err.message));
        toast.error('Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [staffId, centreId, refreshTokens, fetchServiceEntries, fetchOnlineBookings, fetchPerformance]);

  // Refetch performance when period changes
  useEffect(() => {
    if (!loading) {
      fetchPerformance();
    }
  }, [period, customDateRange, fetchPerformance, loading]);

  // --- Socket events (unchanged) ---
  useEffect(() => {
    const onTokenUpdate = (data) => {
      setTokens(prev => prev.map(t => t.tokenId === data.tokenId ? { ...t, status: data.status } : t));
      refreshTokens();
    };
    const onCentreTokenUpdate = (data) => {
      setTokens(prev => prev.map(t => t.tokenId === data.tokenId ? { ...t, status: data.status } : t));
      refreshTokens();
    };
    const onNewToken = (data) => {
      toast.info(data.message || 'New token created');
      refreshTokens();
    };
    const onTokenReassigned = (data) => {
      toast.info(data.message || 'Token reassigned');
      refreshTokens();
    };
    const onServiceEntryCreated = async (data) => {
      const entryStaffId = String(data.staff_id || '').trim();
      if (!entryStaffId || entryStaffId === String(staffId).trim()) {
        await fetchServiceEntries();
        await fetchOnlineBookings();
        await refreshTokens();
        await fetchPerformance();
      }
    };

    socket.on('tokenUpdate', onTokenUpdate);
    socket.on(`tokenUpdate:${centreId}`, onCentreTokenUpdate);
    socket.on('newToken', onNewToken);
    socket.on('tokenReassigned', onTokenReassigned);
    socket.on('serviceEntryCreated', onServiceEntryCreated);

    return () => {
      socket.off('tokenUpdate', onTokenUpdate);
      socket.off(`tokenUpdate:${centreId}`, onCentreTokenUpdate);
      socket.off('newToken', onNewToken);
      socket.off('tokenReassigned', onTokenReassigned);
      socket.off('serviceEntryCreated', onServiceEntryCreated);
    };
  }, [centreId, staffId, refreshTokens, fetchServiceEntries, fetchOnlineBookings, fetchPerformance]);

  // --- Helper functions (unchanged) ---
  const getCategoryName = (id) => categories.find(c => c.id === id)?.name || 'N/A';
  const getSubcategoryName = (catId, subId) => {
    const cat = categories.find(c => c.id === catId);
    return cat?.subcategories?.find(s => s.id === subId)?.name || 'N/A';
  };
  const shortenTokenId = (tokenId) => tokenId ? `#${tokenId.split('-').pop()}` : 'N/A';
  const handleStartService = (tokenId) => navigate(`/dashboard/staff/token/${tokenId}/service`);
  const handleViewDetails = (tokenId) => navigate(`/dashboard/staff/token/${tokenId}/details`);
  const formatTime = (dateString) => new Date(dateString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const formatDateUI = (dateString) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  // Token filtering (unchanged)
  const getActiveTokens = () => tokens.filter(t => {
    const tokenStaff = String(t.staffId || '').trim();
    const localStaff = String(staffId).trim();
    const isAssignedToMe = tokenStaff === localStaff;
    const isUnassigned = !tokenStaff || tokenStaff === 'null' || tokenStaff === '';
    return (isAssignedToMe || isUnassigned) && t.status !== 'completed';
  });
  const getCompletedTokens = () => tokens.filter(t => {
    const tokenStaff = String(t.staffId || '').trim();
    const localStaff = String(staffId).trim();
    return tokenStaff === localStaff && t.status === 'completed';
  });
  const getCampaignTokens = () => tokens.filter(t => {
    const tokenStaff = String(t.staffId || '').trim();
    const localStaff = String(staffId).trim();
    return tokenStaff === localStaff && t.type === 'campaign';
  });

  const activeTokens = getActiveTokens();
  const completedTokens = getCompletedTokens();
  const campaignTokens = getCampaignTokens();

  const getFilteredTokens = () => {
    let source = activeView === 'active' ? activeTokens : activeView === 'completed' ? completedTokens : campaignTokens;
    return source.filter(token => {
      const matchesSearch = token.customerName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           token.tokenId?.toString().includes(searchQuery) ||
                           token.phone?.includes(searchQuery);
      const tokenDate = new Date(token.createdAt).toDateString();
      const today = new Date().toDateString();
      const yesterday = new Date(Date.now() - 86400000).toDateString();
      const weekAgo = new Date(Date.now() - 604800000);
      const matchesDate = activeDate === 'today' ? tokenDate === today :
                         activeDate === 'yesterday' ? tokenDate === yesterday :
                         activeDate === 'week' ? new Date(tokenDate) >= weekAgo : true;
      return matchesSearch && matchesDate;
    });
  };

  const filteredTokens = getFilteredTokens();
  const groupTokensByDate = (tokens) => {
    const grouped = {};
    tokens.forEach(token => {
      const date = new Date(token.createdAt).toDateString();
      if (!grouped[date]) grouped[date] = [];
      grouped[date].push(token);
    });
    return Object.entries(grouped)
      .sort(([a], [b]) => new Date(b) - new Date(a))
      .reduce((acc, [date, arr]) => ({ ...acc, [date]: arr.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt)) }), {});
  };
  const groupedTokens = groupTokensByDate(filteredTokens);

  const statusCounts = {
    pending: activeTokens.filter(t => t.status === 'pending').length,
    inProgress: activeTokens.filter(t => t.status === 'in-progress' || t.status === 'processing').length,
    completed: completedTokens.length,
    campaign: campaignTokens.length,
    total: activeTokens.length + completedTokens.length
  };

  const handleTakeWork = async (bookingId) => {
    try {
      await api.put(`/customer-services/${bookingId}/take`);
      toast.success('Work assigned to you');
      await fetchOnlineBookings();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Already taken by another staff');
    }
  };

  const handleStartOnlineService = (booking) => {
    setProcessingBookings(prev => prev.filter(b => b.id !== booking.id));
    navigate(`/dashboard/staff/online-service/${booking.id}`, {
      state: {
        customerServiceId: booking.id,
        customerName: booking.customer_name,
        phone: booking.phone,
        categoryId: booking.service_id,
        subcategoryId: booking.subcategory_id
      }
    });
  };

  const getStatusBadgeColor = (status) => {
    switch(status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'in-progress': case 'processing': return 'bg-blue-100 text-blue-800';
      case 'pending': return 'bg-amber-100 text-amber-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };
  const getStatusIcon = (status) => {
    switch(status) {
      case 'completed': return <FiCheckCircle className="h-4 w-4 text-green-500" />;
      case 'in-progress': case 'processing': return <FiPlayCircle className="h-4 w-4 text-blue-500" />;
      case 'pending': return <FiClock className="h-4 w-4 text-amber-500" />;
      default: return null;
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center"><div className="w-12 h-12 border-3 border-gray-900 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div><p className="text-gray-600">Loading dashboard...</p></div>
    </div>
  );
  if (error) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-lg p-8 max-w-md w-full border border-gray-200 text-center">
        <FiAlertCircle className="mx-auto h-12 w-12 text-red-500 mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Data Loading Error</h3>
        <p className="text-gray-600 mb-6">{error}</p>
        <button onClick={() => window.location.reload()} className="px-6 py-3 bg-blue-700 text-white rounded-lg hover:bg-blue-800">Try Again</button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <ToastContainer position="top-right" autoClose={4000} />

      {/* ===== NEW WELCOME BANNER (matches Capture.PNG) ===== */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
            {/* Left side: Avatar + greeting + status */}
            <div className="flex-1">
              <div className="flex items-start gap-4 mb-3">
                <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center text-2xl font-bold flex-shrink-0">
                  {staffInitials}
                </div>
                <div>
                  <h2 className="text-2xl font-bold">
                    {getGreeting()}, {staffName}!
                  </h2>
                  <p className="text-white/80 text-lg mt-0.5">
                    Welcome back to your workspace.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4 text-sm text-white/90 mt-2 mb-6">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 bg-green-400 rounded-full"></span>
                  <span>Online</span>
                </div>
                <button
                  onClick={() => navigate('/profile')}
                  className="underline hover:text-white/80"
                >
                  View Profile
                </button>
              </div>

              {/* Quick Actions */}
              <div>
                <p className="text-xs uppercase tracking-wider text-white/70 mb-2 font-semibold">Quick Actions</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => navigate('/staff/token/create')}
                    className="px-4 py-2 bg-white/20 rounded-lg text-sm font-medium hover:bg-white/30 transition"
                  >
                    New Token
                  </button>
                  <button
                    onClick={() => setShowQuickService(true)}
                    className="px-4 py-2 bg-white/20 rounded-lg text-sm font-medium hover:bg-white/30 transition"
                  >
                    Quick Service
                  </button>
                  <button
                    onClick={() => navigate('/staff/reports')}
                    className="px-4 py-2 bg-white/20 rounded-lg text-sm font-medium hover:bg-white/30 transition"
                  >
                    View Reports
                  </button>
                </div>
              </div>
            </div>

            {/* Right side: Date & Time */}
            <div className="md:text-right">
              <p className="text-3xl font-light tracking-tight">{formatCurrentTime(currentTime)}</p>
              <p className="text-white/80 text-sm mt-1">{formatCurrentDate(currentTime)}</p>
            </div>
          </div>

          {/* Announcement */}
          <div className="mt-5 pt-5 border-t border-white/20 text-sm text-white/70 italic">
            Exciting updates coming soon! Check back frequently — new features will be announced here.
          </div>
        </div>
      </div>
      
      {/* Original Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="px-6 py-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
                <FiTrendingUp className="text-white h-6 w-6" />
              </div>
              <div>
                <h1 className="font-bold text-gray-900 text-2xl">Service Dashboard</h1>
                <p className="text-gray-600 text-sm">Manage tokens, track services, and view performance</p>
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
              
              <span className="text-xs text-gray-500">Last updated: {lastUpdated.toLocaleTimeString()}</span>
              <button
                onClick={refreshTokens}
                className="p-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                title="Refresh"
              >
                <FiRefreshCw className="h-4 w-4 text-gray-600" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="p-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="max-w-7xl mx-auto">
          
          {/* Floating Action Button */}
          <button
            onClick={() => setShowQuickService(true)}
            className="fixed bottom-8 right-8 bg-blue-700 text-white p-4 rounded-full shadow-lg hover:bg-blue-800 transition-all z-20"
          >
            <FiPlus className="h-6 w-6" />
          </button>

          {/* Search & Filter Bar */}
          <div className="flex flex-wrap gap-4 mb-6">
            <div className="relative flex-1 max-w-md">
              <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search by token, customer name, or phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2.5 w-full border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <select value={activeDate} onChange={(e) => setActiveDate(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2.5">
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="week">This Week</option>
              <option value="all">All Time</option>
            </select>
          </div>

          {/* Stats Row - Token Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5 mb-8">
            <StatCard title="Total Tokens" value={statusCounts.total} icon={FiUsers} color="bg-gray-600" />
            <StatCard title="Pending" value={statusCounts.pending} icon={FiClock} color="bg-amber-500" />
            <StatCard title="In Progress" value={statusCounts.inProgress} icon={FiPlayCircle} color="bg-blue-500" />
            <StatCard title="Completed" value={statusCounts.completed} icon={FiCheckCircle} color="bg-green-500" />
            <StatCard title="Campaign" value={statusCounts.campaign} icon={FiAward} color="bg-purple-500" />
          </div>

          {/* Two‑Column Layout */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            
            {/* Left Column – Tokens & Online Bookings */}
            <div className="xl:col-span-2 space-y-6">
              
              {/* Online Bookings */}
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                  <h2 className="text-lg font-semibold text-gray-900">Online Booking Queue</h2>
                </div>
                <div className="p-6">
                  {onlineBookings.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">No pending online bookings</div>
                  ) : (
                    <div className="space-y-3">
                      {onlineBookings.map(booking => (
                        <div key={booking.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors">
                          <div className="flex items-center gap-4 flex-1">
                            <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center font-semibold text-indigo-800">#{booking.id}</div>
                            <div>
                              <h4 className="font-medium text-gray-900">{booking.customer_name}</h4>
                              <p className="text-sm text-gray-600">{getCategoryName(booking.service_id)} • {getSubcategoryName(booking.service_id, booking.subcategory_id)}</p>
                              <div className="flex gap-4 mt-1 text-xs text-gray-500">
                                <span>{new Date(booking.applied_at).toLocaleTimeString()}</span>
                                <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded">Online</span>
                              </div>
                            </div>
                          </div>
                          <button onClick={() => handleTakeWork(booking.id)} className="px-4 py-2 bg-blue-700 text-white rounded-lg hover:bg-blue-800">Take Work</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* My Online Processing Work */}
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                  <h2 className="text-lg font-semibold text-gray-900">My Online Processing Work</h2>
                </div>
                <div className="p-6">
                  {processingBookings.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">No active online work</div>
                  ) : (
                    <div className="space-y-3">
                      {processingBookings.map(booking => (
                        <div key={booking.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:border-gray-300">
                          <div className="flex items-center gap-4 flex-1">
                            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center font-semibold text-green-800">#{booking.id}</div>
                            <div>
                              <h4 className="font-medium text-gray-900">{booking.customer_name}</h4>
                              <p className="text-sm text-gray-600">{getCategoryName(booking.service_id)} • {getSubcategoryName(booking.service_id, booking.subcategory_id)}</p>
                              <div className="flex gap-4 mt-1 text-xs text-gray-500">
                                <span>{new Date(booking.taken_at || booking.applied_at).toLocaleTimeString()}</span>
                                <span className="bg-green-50 text-green-700 px-2 py-0.5 rounded">Assigned to you</span>
                              </div>
                            </div>
                          </div>
                          <button onClick={() => handleStartOnlineService(booking)} className="px-4 py-2 bg-green-700 text-white rounded-lg hover:bg-green-800 flex items-center gap-2">
                            <FiPlayCircle className="h-4 w-4" /> Start
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Token Tabs */}
              <div className="bg-white rounded-xl border border-gray-200">
                <div className="flex border-b border-gray-200">
                  {[
                    { id: 'active', label: 'Active', icon: FiPlayCircle, count: activeTokens.length, color: 'blue' },
                    { id: 'completed', label: 'Completed', icon: FiCheckSquare, count: completedTokens.length, color: 'green' },
                    { id: 'campaign', label: 'Campaign', icon: FiAward, count: campaignTokens.length, color: 'purple' },
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveView(tab.id)}
                      className={`flex-1 py-3 text-center font-medium transition-all ${
                        activeView === tab.id
                          ? `border-b-2 border-${tab.color}-600 text-${tab.color}-700`
                          : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      <div className="flex items-center justify-center gap-2">
                        <tab.icon className="h-4 w-4" />
                        <span>{tab.label}</span>
                        <span className="text-xs bg-gray-100 text-gray-600 rounded-full px-2 py-0.5">{tab.count}</span>
                      </div>
                    </button>
                  ))}
                </div>

                <div className="p-6">
                  {Object.keys(groupedTokens).length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                      <FiPlayCircle className="mx-auto h-12 w-12 text-gray-300 mb-4" />
                      <p>No {activeView} tokens found</p>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {Object.entries(groupedTokens).map(([date, dateTokens]) => (
                        <div key={date}>
                          <div className="flex items-center gap-2 mb-3">
                            <FiCalendar className="h-4 w-4 text-gray-500" />
                            <h3 className="font-medium text-gray-700">{formatDateUI(date)}</h3>
                            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{dateTokens.length}</span>
                          </div>
                          <div className="space-y-3">
                            {dateTokens.map(token => {
                              const tokenStaff = String(token.staffId || '').trim();
                              const currentStaff = String(staffId).trim();
                              const isAssignedToMe = tokenStaff === currentStaff;
                              const isUnassigned = !tokenStaff || tokenStaff === 'null' || tokenStaff === '';
                              return (
                                <div key={token.tokenId} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors">
                                  <div className="flex items-center gap-4 flex-1">
                                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center font-semibold ${
                                      activeView === 'completed' ? 'bg-green-100 text-green-800' :
                                      activeView === 'campaign' ? 'bg-purple-100 text-purple-800' :
                                      'bg-gray-100 text-gray-900'
                                    }`}>
                                      {shortenTokenId(token.tokenId)}
                                    </div>
                                    <div className="flex-1">
                                      <div className="flex flex-wrap items-center gap-2 mb-1">
                                        <h4 className="font-medium text-gray-900">{token.customerName || 'Customer'}</h4>
                                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeColor(token.status)}`}>
                                          {getStatusIcon(token.status)} {token.status?.replace('-', ' ')}
                                        </span>
                                        {activeView === 'active' && isAssignedToMe && (
                                          <span className="bg-green-100 text-green-800 px-2 py-0.5 rounded text-xs">Assigned to me</span>
                                        )}
                                        {activeView === 'active' && isUnassigned && (
                                          <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded text-xs">Available</span>
                                        )}
                                      </div>
                                      <p className="text-sm text-gray-600">{getCategoryName(token.categoryId)} • {getSubcategoryName(token.categoryId, token.subcategoryId)}</p>
                                      <div className="flex flex-wrap gap-4 mt-1 text-xs text-gray-500">
                                        <span>{formatTime(token.createdAt)}</span>
                                        {token.phone && <span>{token.phone}</span>}
                                        {activeView === 'completed' && token.updatedAt && (
                                          <span className="text-green-600">Completed: {formatTime(token.updatedAt)}</span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                  <div>
                                    {activeView === 'active' && (token.status === 'pending' || token.status === 'in-progress') && (isAssignedToMe || isUnassigned) && (
                                      <button onClick={() => handleStartService(token.tokenId)} className="px-4 py-2 bg-blue-700 text-white rounded-lg hover:bg-blue-800 flex items-center gap-2">
                                        <FiPlayCircle className="h-4 w-4" />
                                        {token.status === 'pending' ? 'Start' : 'Continue'}
                                      </button>
                                    )}
                                    {(activeView === 'completed' || activeView === 'campaign') && (
                                      <button onClick={() => handleViewDetails(token.tokenId)} className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-800 flex items-center gap-2">
                                        <FiBarChart2 className="h-4 w-4" /> Details
                                      </button>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right Column – Performance & Recent Activity */}
            <div className="space-y-6">
              
              {/* Performance Score Card */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-900 text-sm flex items-center">
                    <FiTarget className="h-4 w-4 mr-2 text-indigo-600" />
                    Performance Score
                  </h3>
                  <div className="relative group">
                    <FiInfo className="h-4 w-4 text-gray-400 cursor-pointer" />
                    <div className="absolute bottom-full right-0 mb-2 hidden group-hover:block w-64 p-2 bg-gray-900 text-white text-xs rounded-lg z-10">
                      Score based on collection rate (50%), revenue efficiency (30%), and consistency (20%)
                    </div>
                  </div>
                </div>
                <div className="text-center">
                  <div className="relative inline-block">
                    <svg className="w-32 h-32">
                      <circle className="text-gray-200" strokeWidth="12" stroke="currentColor" fill="transparent" r="54" cx="64" cy="64" />
                      <circle
                        className="transition-all duration-1000"
                        strokeWidth="12"
                        strokeDasharray={339.292}
                        strokeDashoffset={339.292 * (1 - (performanceLoading ? 0 : performance.incentiveScore / 100))}
                        strokeLinecap="round"
                        stroke={`url(#gradient)`}
                        fill="transparent"
                        r="54"
                        cx="64"
                        cy="64"
                      />
                      <defs>
                        <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                          <stop offset="0%" stopColor={performance.incentiveScore >= 80 ? '#10B981' : performance.incentiveScore >= 60 ? '#F59E0B' : '#EF4444'} />
                          <stop offset="100%" stopColor={performance.incentiveScore >= 80 ? '#059669' : performance.incentiveScore >= 60 ? '#D97706' : '#DC2626'} />
                        </linearGradient>
                      </defs>
                    </svg>
                    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center">
                      <p className="text-2xl font-bold text-gray-900">{performanceLoading ? '...' : `${performance.incentiveScore}%`}</p>
                      <p className="text-xs text-gray-500">
                        {!performanceLoading && (performance.incentiveScore >= 80 ? 'Excellent' : performance.incentiveScore >= 60 ? 'Good' : performance.incentiveScore >= 40 ? 'Average' : 'Needs Improvement')}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Performance Metrics */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="font-semibold text-gray-900 text-sm flex items-center mb-4">
                  <FiActivity className="h-4 w-4 mr-2 text-indigo-600" />
                  Performance Metrics
                </h3>
                {performanceLoading ? (
                  <div className="space-y-3">
                    <div className="h-8 bg-gray-200 animate-pulse rounded"></div>
                    <div className="h-8 bg-gray-200 animate-pulse rounded"></div>
                    <div className="h-8 bg-gray-200 animate-pulse rounded"></div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between mb-1 text-sm">
                        <span className="text-gray-600">Completion Rate</span>
                        <span className="font-medium text-gray-900">{performance.completionRate}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div className="bg-green-600 h-2 rounded-full" style={{ width: `${performance.completionRate}%` }} />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between mb-1 text-sm">
                        <span className="text-gray-600">Avg Transaction Value</span>
                        <span className="font-medium text-gray-900">{formatCurrency(performance.avgTransactionValue)}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full"
                          style={{ width: `${Math.min((performance.avgTransactionValue / 1000) * 100, 100)}%` }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between mb-1 text-sm">
                        <span className="text-gray-600">Customer Satisfaction</span>
                        <span className="font-medium text-gray-900">{performance.customerSatisfaction}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-purple-600 h-2 rounded-full"
                          style={{ width: `${(performance.avgRating / 5) * 100}%` }}
                        />
                      </div>
                    </div>

                    <div className="pt-2 border-t border-gray-100">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Collection Rate</span>
                        <span className="font-medium text-gray-900">{performance.collectionRate}%</span>
                      </div>
                      <div className="flex justify-between text-sm mt-2">
                        <span className="text-gray-600">Total Revenue</span>
                        <span className="font-medium text-gray-900">{formatCurrency(performance.totalCollected)}</span>
                      </div>
                      <div className="flex justify-between text-sm mt-2">
                        <span className="text-gray-600">Total Services</span>
                        <span className="font-medium text-gray-900">{performance.totalServices}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Recent Activity */}
              <div className="bg-white rounded-xl border border-gray-200">
                <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                  <h3 className="text-lg font-semibold text-gray-900">Recent Activity</h3>
                </div>
                <div className="p-6">
                  {recentServiceEntries.length > 0 ? (
                    <div className="space-y-4">
                      {recentServiceEntries.map(entry => (
                        <div key={entry.id} className="flex gap-3 pb-4 last:pb-0 border-b last:border-0 border-gray-100">
                          <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
                            <FiUser className="h-4 w-4 text-gray-600" />
                          </div>
                          <div className="flex-1">
                            <div className="flex justify-between items-baseline">
                              <p className="text-sm font-medium text-gray-900 truncate">{entry.customerName || 'Customer'}</p>
                              <span className="text-xs text-gray-500 ml-2">{formatTime(entry.created_at)}</span>
                            </div>
                            <p className="text-sm text-gray-600">{getCategoryName(entry.category)} service</p>
                            <div className="flex justify-between items-center mt-1">
                              <span className={`text-xs font-medium ${
                                entry.status === 'completed' ? 'text-green-600' :
                                entry.status === 'in-progress' ? 'text-blue-600' :
                                entry.status === 'pending' ? 'text-amber-600' : 'text-gray-600'
                              }`}>
                                {entry.status?.replace('-', ' ')}
                              </span>
                              {entry.tokenId && <span className="text-xs text-gray-500 font-mono">{shortenTokenId(entry.tokenId)}</span>}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">No recent activity</div>
                  )}
                </div>
              </div>

              {/* Quick Actions */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => navigate('/staff/token/create')} className="p-3 border border-gray-300 rounded-lg hover:border-gray-400 text-left transition-colors">
                    <FiPlus className="h-5 w-5 text-gray-600 mb-2" />
                    <span className="text-sm font-medium text-gray-900">New Token</span>
                  </button>
                  <button onClick={() => navigate('/staff/reports')} className="p-3 border border-gray-300 rounded-lg hover:border-gray-400 text-left transition-colors">
                    <FiBarChart2 className="h-5 w-5 text-gray-600 mb-2" />
                    <span className="text-sm font-medium text-gray-900">Reports</span>
                  </button>
                  <button onClick={() => navigate('/staff/customers')} className="p-3 border border-gray-300 rounded-lg hover:border-gray-400 text-left transition-colors">
                    <FiUsers className="h-5 w-5 text-gray-600 mb-2" />
                    <span className="text-sm font-medium text-gray-900">Customers</span>
                  </button>
                  <button onClick={refreshTokens} className="p-3 border border-gray-300 rounded-lg hover:border-gray-400 text-left transition-colors">
                    <FiRefreshCw className="h-5 w-5 text-gray-600 mb-2" />
                    <span className="text-sm font-medium text-gray-900">Refresh</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      <QuickServiceModal open={showQuickService} onClose={() => setShowQuickService(false)} wallets={wallets} />
    </div>
  );
};

export default StaffDashboard;
