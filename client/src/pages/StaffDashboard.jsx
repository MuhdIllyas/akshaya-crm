import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { 
  FiUsers, FiClock, FiCheckCircle, FiPlayCircle, FiPlus, FiSearch, 
  FiAlertCircle, FiRefreshCw, FiCalendar, FiBarChart2, FiTrendingUp,
  FiUser, FiAward, FiXCircle, FiCheckSquare, FiTarget, FiDollarSign, FiGlobe,
  FiBriefcase, FiActivity, FiStar, FiInfo, FiChevronRight, FiExternalLink
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
  const [workspaceTab, setWorkspaceTab] = useState('tokens');
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

  // Cancel modal state
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelTokenData, setCancelTokenData] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);

  // --- Tasks & Events State ---
  const [myTasks, setMyTasks] = useState([]);
  const [upcomingEvents, setUpcomingEvents] = useState([]);

  // Dynamic Auto-Cycling States
  const [activeEventTab, setActiveEventTab] = useState('All');
  const [isEventsHovered, setIsEventsHovered] = useState(false);

  const getEventDayLabel = (dateStr) => {
    const date = new Date(dateStr);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
    return date.toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' });
  };

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


  // --- Fetch service entries (optimized) ---
  const fetchServiceEntries = useCallback(async () => {
    try {
      // Pass the explicit staffId directly to the backend
      const serviceEntriesRes = await getServiceEntries(false, staffId);
      
      // Backend already returns exact matches sorted by date, so we just take the top 15
      const entries = serviceEntriesRes.data || [];
      setRecentServiceEntries(entries.slice(0, 15)); 
      return entries;
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

  // --- Fetch Tasks & Events ---
  const fetchTasksAndEvents = useCallback(async () => {
    try {
      const tasksUrl = (api.defaults.baseURL || '').replace('servicemanagement', 'tasks');
      const eventsUrl = (api.defaults.baseURL || '').replace('servicemanagement', 'events');

      // 1. Fetch Pending Tasks
      const tasksRes = await api.get('/all', {
        baseURL: tasksUrl,
        params: { assigned_to: staffId, status: 'pending' }
      });
      setMyTasks(tasksRes.data || []);

      // 2. Fetch Upcoming Events (Next 7 days)
      const today = new Date();
      const nextWeek = new Date(today);
      nextWeek.setDate(nextWeek.getDate() + 7);

      const eventsRes = await api.get('/', {
        baseURL: eventsUrl,
        params: { 
          start: today.toISOString().split('T')[0], 
          end: nextWeek.toISOString().split('T')[0] 
        }
      });
      
      // Filter out past events and sort
      today.setHours(0,0,0,0);
      const validEvents = (eventsRes.data || [])
        .filter(e => new Date(e.date || e.start_datetime) >= today)
        .sort((a, b) => new Date(a.date || a.start_datetime) - new Date(b.date || b.start_datetime));
      
      setUpcomingEvents(validEvents.slice(0, 10)); // Keep top 10
    } catch (err) {
      console.error('Error fetching tasks/events:', err);
    }
  }, [staffId]);

  // --- Auto-cycle Events Tabs ---
  useEffect(() => {
    if (isEventsHovered || upcomingEvents.length === 0) return;
    const tabs = ['All', 'Tasks', 'Deliveries', 'Expiries'];
    
    const interval = setInterval(() => {
      setActiveEventTab(prev => {
        const currentIndex = tabs.indexOf(prev);
        return tabs[(currentIndex + 1) % tabs.length];
      });
    }, 5000); // Rotates every 5 seconds
    
    return () => clearInterval(interval);
  }, [isEventsHovered, upcomingEvents.length]);

  const handleCompleteTask = async (taskId) => {
    try {
      const tasksUrl = (api.defaults.baseURL || '').replace('servicemanagement', 'tasks');
      await api.patch(`/${taskId}/status`, { status: 'completed' }, { baseURL: tasksUrl });
      toast.success('Task completed!');
      fetchTasksAndEvents(); // Refresh lists
    } catch (err) {
      toast.error('Failed to complete task');
    }
  };

  // 🔥 Navigation Handler for Calendar Events
  const handleViewService = (event) => {
    const eventIdStr = String(event.id || "");
    let targetTrackingId;
    
    // 1. FOR EXPIRIES
    if (eventIdStr.startsWith("expiry-")) {
      targetTrackingId = event.tracking_id; 
    } 
    // 2. FOR DELIVERIES
    else if (eventIdStr.startsWith("delivery-")) {
      targetTrackingId = eventIdStr.replace("delivery-", ""); 
    } 
    // 3. FALLBACK FOR CUSTOM TASKS
    else if (event.tracking_id) {
      targetTrackingId = event.tracking_id;
    }

    if (targetTrackingId) {
      navigate(`/dashboard/staff/track_service/${targetTrackingId}`); 
    } else {
      toast.error("Cannot open: No tracking steps exist for this service yet.");
    }
  };

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
      
      // Fire all API requests concurrently
      const [categoriesRes] = await Promise.all([
        getCategories(),
        refreshTokens(),
        fetchServiceEntries(),
        fetchOnlineBookings(),
        fetchPerformance(),
        fetchTasksAndEvents()
      ]);

      // Set state for the ones that don't handle their own state inside their functions
      setCategories(categoriesRes.data || []);
      
    } catch (err) {
      setError('Failed to load dashboard data: ' + (err.response?.data?.error || err.message));
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };
  
  fetchData();
  }, [staffId, centreId, refreshTokens, fetchServiceEntries, fetchOnlineBookings, fetchPerformance, fetchTasksAndEvents]);

  const isMounted = useRef(false);

  // Refetch performance when period changes
  useEffect(() => {
    if (isMounted.current && !loading) {
      fetchPerformance();
    } else if (!loading) {
      isMounted.current = true;
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
  const handleStartService = async (tokenId, tokenStaffId, tokenStatus) => {
    try {
      if (!tokenStaffId || tokenStaffId === 'null' || tokenStaffId === '') {
        await api.put(`/token/${tokenId}/assign`, { staffId });
      }
      if (tokenStatus === 'pending') {
        await api.put(`/token/${tokenId}/status`, { status: 'in-progress' });
      }
      navigate(`/dashboard/staff/token/${tokenId}/service`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to start service. Someone else might have already taken it.');
      refreshTokens(); 
    }
  };
  const openCancelModal = (token) => {
    setCancelTokenData({ tokenId: token.tokenId, customerName: token.customerName || 'Customer' });
    setCancelReason('');
    setShowCancelModal(true);
  };

  const handleCancelConfirm = async () => {
    if (!cancelTokenData) return;
    setCancelling(true);
    try {
      await api.put(`/tokens/${cancelTokenData.tokenId}/cancel`, { 
        reason: cancelReason.trim() || null 
      });
      toast.success(`Token ${cancelTokenData.tokenId} cancelled successfully`);
      setShowCancelModal(false);
      setCancelTokenData(null);
      setCancelReason('');
      refreshTokens(); // Refresh the list to remove the token
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || 'Failed to cancel token');
    } finally {
      setCancelling(false);
    }
  };
  const handleViewDetails = (tokenId, trackingId) => {
    if (trackingId) {
      navigate(`/dashboard/staff/track_service/${trackingId}`);
    } else if (tokenId) {
      // Fallback just in case it's a legacy token without a tracking entry
      navigate(`/dashboard/staff/token/${tokenId}/details`);
    } else {
      toast.info("No tracking details available for this quick service.");
    }
  };
  const formatTime = (dateString) => new Date(dateString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const formatDateUI = (dateString) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  // Token filtering optimized with useMemo
  const { activeTokens, completedTokens, campaignTokens, statusCounts } = useMemo(() => {
    const localStaff = String(staffId).trim();

    const active = tokens.filter(t => {
      const tokenStaff = String(t.staffId || '').trim();
      const isAssignedToMe = tokenStaff === localStaff;
      const isUnassigned = !tokenStaff || tokenStaff === 'null' || tokenStaff === '';
      return (isAssignedToMe || isUnassigned) && t.status !== 'completed' && t.status !== 'cancelled';
    });

    const completed = tokens.filter(t => {
      const tokenStaff = String(t.staffId || '').trim();
      return tokenStaff === localStaff && t.status === 'completed' && t.type !== 'campaign';
    });

    const campaign = tokens.filter(t => {
      const tokenStaff = String(t.staffId || '').trim();
      const isAssignedToMe = tokenStaff === localStaff;
      const isUnassigned = !tokenStaff || tokenStaff === 'null' || tokenStaff === '';
      return (isAssignedToMe || isUnassigned) && t.type === 'campaign' && t.status !== 'cancelled';
    });

    return {
      activeTokens: active,
      completedTokens: completed,
      campaignTokens: campaign,
      statusCounts: {
        pending: active.filter(t => t.status === 'pending').length,
        inProgress: active.filter(t => t.status === 'in-progress' || t.status === 'processing').length,
        completed: completed.length,
        campaign: campaign.length,
        total: active.length + completed.length
      }
    };
  }, [tokens, staffId]);

  const filteredTokens = useMemo(() => {
    let source = activeView === 'active' ? activeTokens : activeView === 'completed' ? completedTokens : campaignTokens;
    
    // 1. Calculate search string ONCE outside the loop (Performance)
    const searchLower = searchQuery.toLowerCase().trim();
    
    // 2. Safely calculate Dates ONCE outside the loop
    const todayObj = new Date();
    todayObj.setHours(0, 0, 0, 0); // Normalize today to midnight
    
    const yesterdayObj = new Date(todayObj);
    yesterdayObj.setDate(yesterdayObj.getDate() - 1);
    
    const weekAgoObj = new Date(todayObj);
    weekAgoObj.setDate(weekAgoObj.getDate() - 7);

    const todayStr = todayObj.toDateString();
    const yesterdayStr = yesterdayObj.toDateString();

    return source.filter(token => {
      // 3. Safe string conversion to prevent crashes if a number is passed
      const matchesSearch = !searchLower || 
                            String(token.customerName || '').toLowerCase().includes(searchLower) ||
                            String(token.tokenId || '').toLowerCase().includes(searchLower) ||
                            String(token.phone || '').toLowerCase().includes(searchLower);

      // 4. Accurate date matching ignoring the exact hour/minute
      const tokenDateObj = new Date(token.createdAt);
      tokenDateObj.setHours(0, 0, 0, 0);
      const tokenDateStr = tokenDateObj.toDateString();

      const matchesDate = activeDate === 'today' ? tokenDateStr === todayStr :
                          activeDate === 'yesterday' ? tokenDateStr === yesterdayStr :
                          activeDate === 'week' ? tokenDateObj >= weekAgoObj : 
                          true; // Fallback for 'all'

      return matchesSearch && matchesDate;
    });
  }, [activeTokens, completedTokens, campaignTokens, activeView, searchQuery, activeDate]);

  const groupedTokens = useMemo(() => {
    const grouped = {};
    filteredTokens.forEach(token => {
      const date = new Date(token.createdAt).toDateString();
      if (!grouped[date]) grouped[date] = [];
      grouped[date].push(token);
    });
    return Object.entries(grouped)
      .sort(([a], [b]) => new Date(b) - new Date(a))
      .reduce((acc, [date, arr]) => ({ ...acc, [date]: arr.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt)) }), {});
  }, [filteredTokens]);

  const groupedRecentActivities = useMemo(() => {
    return recentServiceEntries.reduce((acc, entry) => {
      const date = new Date(entry.created_at).toDateString();
      if (!acc[date]) acc[date] = [];
      acc[date].push(entry);
      return acc;
    }, {});
  }, [recentServiceEntries]);

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

  // Find the wallet assigned to the logged-in staff member
  const myWallet = wallets.find(w => String(w.assigned_staff_id) === String(staffId));

  return (
    <div className="min-h-screen bg-gray-50">

      {/* ===== DARK BLUE WELCOME BANNER ===== */}
      <div className="bg-gradient-to-r from-blue-900 via-blue-800 to-indigo-900 text-white px-6 py-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
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
                  onClick={() => navigate('/dashboard/my-profile')}
                  className="underline hover:text-white/80"
                >
                  View Profile
                </button>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-white/70 mb-2 font-semibold">Quick Actions</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => navigate('/dashboard/staff/token')}
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
                    onClick={() => navigate('/dashboard/staff/performance')}
                    className="px-4 py-2 bg-white/20 rounded-lg text-sm font-medium hover:bg-white/30 transition"
                  >
                    View Reports
                  </button>
                </div>
              </div>
            </div>
            <div className="md:text-right">
              <p className="text-3xl font-light tracking-tight">{formatCurrentTime(currentTime)}</p>
              <p className="text-white/80 text-sm mt-1">{formatCurrentDate(currentTime)}</p>
            </div>
          </div>
          <div className="mt-5 pt-5 border-t border-white/20 text-sm text-white/70 italic">
            🚀 Added Invoice Generation in Service Entry!! 💸🧾 Check it out when you start the next service! 👀
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

          {/* Search & Filter Bar + Wallet Pill */}
          <div className="flex flex-wrap gap-4 mb-6 items-center">
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

            {/* ----- Ultra‑Compact Wallet Pill ----- */}
            {myWallet && (
              <motion.div
                whileHover={{ y: -1 }}
                className="inline-flex items-center gap-2 bg-white border border-indigo-200 rounded-full px-3 py-2 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
              >
                <div className="p-1 bg-indigo-100 rounded-full">
                  <FiBriefcase className="h-3.5 w-3.5 text-indigo-600" />
                </div>
                <span className="text-sm font-medium text-gray-700">
                  {myWallet.name}
                </span>
                <span className="text-sm font-bold text-gray-900">
                  {formatCurrency(myWallet.balance)}
                </span>
              </motion.div>
            )}
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
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
            
            {/* Left Column – Unified Workspace */}
            <div className="xl:col-span-2 flex flex-col gap-6">
              
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col h-[850px]">
                
                {/* Master Workspace Tabs */}
                <div className="flex p-3 border-b border-gray-200 bg-gray-50/80 gap-2 overflow-x-auto hide-scrollbar">
                  <button onClick={() => setWorkspaceTab('tokens')} className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold whitespace-nowrap transition-all ${workspaceTab === 'tokens' ? 'bg-white text-indigo-700 shadow-sm border border-gray-200' : 'text-gray-600 hover:bg-gray-200/50'}`}>
                    <FiUsers className="h-4 w-4" />
                    Walk-in Tokens
                    <span className={`px-2 py-0.5 rounded-full text-xs ${workspaceTab === 'tokens' ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-200 text-gray-600'}`}>{statusCounts.total}</span>
                  </button>
                  <button onClick={() => setWorkspaceTab('queue')} className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold whitespace-nowrap transition-all ${workspaceTab === 'queue' ? 'bg-white text-blue-700 shadow-sm border border-gray-200' : 'text-gray-600 hover:bg-gray-200/50'}`}>
                    <FiGlobe className="h-4 w-4" />
                    Online Queue
                    <span className={`px-2 py-0.5 rounded-full text-xs ${workspaceTab === 'queue' ? 'bg-blue-100 text-blue-700' : 'bg-gray-200 text-gray-600'}`}>{onlineBookings.length}</span>
                  </button>
                  <button onClick={() => setWorkspaceTab('processing')} className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold whitespace-nowrap transition-all ${workspaceTab === 'processing' ? 'bg-white text-emerald-700 shadow-sm border border-gray-200' : 'text-gray-600 hover:bg-gray-200/50'}`}>
                    <FiPlayCircle className="h-4 w-4" />
                    My Online Work
                    <span className={`px-2 py-0.5 rounded-full text-xs ${workspaceTab === 'processing' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-200 text-gray-600'}`}>{processingBookings.length}</span>
                  </button>
                </div>

                {/* Workspace Content */}
                <div className="flex-1 overflow-y-auto bg-gray-50/30 p-4 sm:p-6">
                  
                  {/* TAB 1: TOKENS */}
                  {workspaceTab === 'tokens' && (
                    <div className="space-y-4">
                      {/* Sub-Tabs for Tokens */}
                      <div className="flex gap-2 border-b border-gray-200 pb-3">
                        {['active', 'completed', 'campaign'].map(tab => (
                          <button
                            key={tab}
                            onClick={() => setActiveView(tab)}
                            className={`px-4 py-1.5 rounded-full text-xs font-bold capitalize transition-colors ${
                              activeView === tab ? 'bg-gray-800 text-white shadow-sm' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-100'
                            }`}
                          >
                            {tab}
                          </button>
                        ))}
                      </div>

                      {Object.keys(groupedTokens).length === 0 ? (
                        <div className="text-center py-16 text-gray-400">
                          <FiPlayCircle className="mx-auto h-12 w-12 mb-3 opacity-30"/>
                          <p className="font-medium">No tokens found</p>
                        </div>
                      ) : (
                        <div className="space-y-6">
                          {Object.entries(groupedTokens).map(([date, dateTokens]) => (
                            <div key={date}>
                              <div className="flex items-center gap-2 mb-3 pl-1">
                                <FiCalendar className="h-4 w-4 text-indigo-500" />
                                <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider">{formatDateUI(date)}</h3>
                                <div className="h-px bg-gray-200 flex-1 ml-2"></div>
                              </div>
                              <div className="grid grid-cols-1 gap-3">
                                {dateTokens.map(token => {
                                  const isAssignedToMe = String(token.staffId || '').trim() === String(staffId).trim();
                                  const isUnassigned = !token.staffId || token.staffId === 'null';
                                  
                                  return (
                                    <div key={token.tokenId} className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-xl hover:shadow-md hover:border-indigo-300 transition-all group">
                                      <div className="flex items-center gap-3 min-w-0 flex-1">
                                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm shrink-0 ${
                                          activeView === 'completed' ? 'bg-green-50 text-green-700 border border-green-100' :
                                          activeView === 'campaign' ? 'bg-purple-50 text-purple-700 border border-purple-100' :
                                          'bg-indigo-50 text-indigo-700 border border-indigo-100'
                                        }`}>
                                          {shortenTokenId(token.tokenId)}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                          <div className="flex items-center gap-2 mb-0.5">
                                            <h4 className="font-bold text-gray-900 text-sm truncate">{token.customerName || 'Customer'}</h4>
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${getStatusBadgeColor(token.status)}`}>
                                              {token.status?.replace('-', ' ')}
                                            </span>
                                            {isAssignedToMe && activeView === 'active' && <span className="bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded text-[10px] font-bold">Mine</span>}
                                          </div>
                                          <p className="text-xs text-gray-500 truncate flex items-center gap-2">
                                            <span className="font-medium text-gray-700">{getCategoryName(token.categoryId)}</span>
                                            <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                                            <span>{formatTime(token.createdAt)}</span>
                                            {token.phone && <><span className="w-1 h-1 bg-gray-300 rounded-full"></span><span>{token.phone}</span></>}
                                          </p>
                                        </div>
                                      </div>
                                      
                                      <div className="flex items-center gap-2 pl-3 shrink-0">
                                        {(activeView === 'active' || activeView === 'campaign') && (token.status === 'pending' || token.status === 'in-progress') && (isAssignedToMe || isUnassigned) && (
                                          <>
                                            <button 
                                              onClick={() => handleStartService(token.tokenId, token.staffId, token.status)} 
                                              className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-1.5 text-xs font-semibold shadow-sm transition-colors"
                                            >
                                              <FiPlayCircle className="h-3.5 w-3.5" /> {token.status === 'pending' ? 'Start' : 'Resume'}
                                            </button>
                                            <button 
                                              onClick={() => openCancelModal(token)} 
                                              className="p-1.5 text-gray-400 hover:bg-rose-50 hover:text-rose-600 rounded-lg transition-colors"
                                              title="Cancel Token"
                                            >
                                              <FiXCircle className="h-4 w-4" />
                                            </button>
                                          </>
                                        )}
                                        {(activeView === 'completed' || (activeView === 'campaign' && token.status === 'completed')) && (
                                          <button onClick={() => handleViewDetails(token.tokenId, token.trackingId)} className="px-3 py-1.5 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 flex items-center gap-1.5 text-xs font-semibold shadow-sm transition-colors">
                                            <FiBarChart2 className="h-3.5 w-3.5" /> Details
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
                  )}

                  {/* TAB 2: ONLINE QUEUE */}
                  {workspaceTab === 'queue' && (
                    <div className="space-y-3">
                      {onlineBookings.length === 0 ? (
                        <div className="text-center py-16 text-gray-400">
                          <FiGlobe className="mx-auto h-12 w-12 mb-3 opacity-30"/>
                          <p className="font-medium">No pending online bookings</p>
                        </div>
                      ) : (
                        onlineBookings.map(booking => (
                          <div key={booking.id} className="flex items-center justify-between p-4 bg-white border border-blue-100 rounded-xl hover:shadow-md transition-all group">
                            <div className="flex items-center gap-4 min-w-0">
                              <div className="w-10 h-10 bg-blue-50 text-blue-700 border border-blue-100 rounded-lg flex items-center justify-center font-bold text-sm shrink-0">#{booking.id}</div>
                              <div className="min-w-0">
                                <h4 className="font-bold text-gray-900 text-sm truncate">{booking.customer_name}</h4>
                                <p className="text-xs text-gray-500 mt-0.5 truncate">{getCategoryName(booking.service_id)} • {getSubcategoryName(booking.service_id, booking.subcategory_id)}</p>
                                <p className="text-[10px] text-gray-400 mt-1 font-mono">{new Date(booking.applied_at).toLocaleString()}</p>
                              </div>
                            </div>
                            <button onClick={() => handleTakeWork(booking.id)} className="px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 shadow-sm shrink-0 transition-colors">
                              Take Work
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {/* TAB 3: MY ONLINE WORK */}
                  {workspaceTab === 'processing' && (
                    <div className="space-y-3">
                      {processingBookings.length === 0 ? (
                        <div className="text-center py-16 text-gray-400">
                          <FiCheckSquare className="mx-auto h-12 w-12 mb-3 opacity-30"/>
                          <p className="font-medium">No active online work</p>
                        </div>
                      ) : (
                        processingBookings.map(booking => (
                          <div key={booking.id} className="flex items-center justify-between p-4 bg-white border border-emerald-100 rounded-xl hover:shadow-md transition-all group">
                            <div className="flex items-center gap-4 min-w-0">
                              <div className="w-10 h-10 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-lg flex items-center justify-center font-bold text-sm shrink-0">#{booking.id}</div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 mb-0.5">
                                  <h4 className="font-bold text-gray-900 text-sm truncate">{booking.customer_name}</h4>
                                  <span className="bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">Assigned to you</span>
                                </div>
                                <p className="text-xs text-gray-500 truncate">{getCategoryName(booking.service_id)} • {getSubcategoryName(booking.service_id, booking.subcategory_id)}</p>
                                <p className="text-[10px] text-gray-400 mt-1 font-mono">Taken at: {new Date(booking.taken_at || booking.applied_at).toLocaleString()}</p>
                              </div>
                            </div>
                            <button onClick={() => handleStartOnlineService(booking)} className="px-4 py-2 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700 shadow-sm shrink-0 flex items-center gap-1.5 transition-colors">
                              <FiPlayCircle className="h-4 w-4" /> Start
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right Column – Performance, Tasks & Events */}
            <div className="space-y-6">
              
              {/* ===== NEW: MY TASKS ===== */}
              <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-900 text-sm flex items-center">
                    <FiCheckSquare className="h-4 w-4 mr-2 text-indigo-600" />
                    My Pending Tasks
                  </h3>
                  <span className="bg-indigo-100 text-indigo-800 text-xs font-bold px-2 py-0.5 rounded-full">
                    {myTasks.length}
                  </span>
                </div>
                
                {myTasks.length === 0 ? (
                  <div className="text-center py-4 bg-gray-50 rounded-lg border border-dashed border-gray-200">
                    <p className="text-sm text-gray-500">No pending tasks! 🎉</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                    {myTasks.map(task => (
                      <div key={task.id} className="flex gap-3 items-start p-3 border border-gray-100 rounded-lg bg-gray-50 hover:bg-white transition shadow-sm">
                        <button 
                          onClick={() => handleCompleteTask(task.id)}
                          className="mt-0.5 text-gray-400 hover:text-emerald-500 transition-colors"
                          title="Mark as complete"
                        >
                          <FiCheckCircle className="h-5 w-5" />
                        </button>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-800">{task.title}</p>
                          {task.due_date && (
                            <p className="text-xs text-rose-500 mt-1 flex items-center gap-1 font-medium">
                              <FiClock className="h-3 w-3" /> Due {getEventDayLabel(task.due_date)}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* ===== NEW: UPCOMING EVENTS (AUTO-CYCLING) ===== */}
              <div 
                className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm"
                onMouseEnter={() => setIsEventsHovered(true)}
                onMouseLeave={() => setIsEventsHovered(false)}
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-gray-900 text-sm flex items-center">
                    <FiCalendar className="h-4 w-4 mr-2 text-indigo-600" />
                    Upcoming Calendar
                  </h3>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-gray-400 flex items-center gap-1">
                    {isEventsHovered ? <FiClock className="text-amber-500" /> : <FiPlayCircle className="text-emerald-500 animate-pulse" />}
                    {isEventsHovered ? 'Paused' : 'Auto'}
                  </span>
                </div>

                {/* Event Tabs */}
                <div className="flex gap-2 mb-4 overflow-x-auto hide-scrollbar pb-1">
                  {['All', 'Tasks', 'Deliveries', 'Expiries'].map(tab => {
                    const count = upcomingEvents.filter(e => {
                      if (tab === 'All') return true;
                      if (tab === 'Tasks') return e.source === 'task' || e.source === 'calendar_event';
                      if (tab === 'Deliveries') return e.source === 'service_delivery';
                      if (tab === 'Expiries') return e.source === 'service_expiry';
                      return false;
                    }).length;

                    return (
                      <button
                        key={tab}
                        onClick={() => setActiveEventTab(tab)}
                        className={`text-xs px-3 py-1.5 rounded-full font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                          activeEventTab === tab 
                            ? 'bg-indigo-600 text-white shadow-md' 
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {tab} 
                        <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${activeEventTab === tab ? 'bg-white/20' : 'bg-gray-200'}`}>
                          {count}
                        </span>
                      </button>
                    )
                  })}
                </div>
                
                {/* Dynamic Event Feed */}
                <motion.div 
                  key={activeEventTab}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-3 max-h-60 overflow-y-auto pr-1"
                >
                  {(() => {
                    const filteredEvents = upcomingEvents.filter(e => {
                      if (activeEventTab === 'All') return true;
                      if (activeEventTab === 'Tasks') return e.source === 'task' || e.source === 'calendar_event';
                      if (activeEventTab === 'Deliveries') return e.source === 'service_delivery';
                      if (activeEventTab === 'Expiries') return e.source === 'service_expiry';
                      return false;
                    });

                    if (filteredEvents.length === 0) {
                      return (
                        <div className="text-center py-6 bg-gray-50 rounded-lg border border-dashed border-gray-200">
                          <p className="text-sm text-gray-500">No {activeEventTab.toLowerCase()} scheduled.</p>
                        </div>
                      );
                    }

                    return filteredEvents.map(event => {
                      const dayLabel = getEventDayLabel(event.date || event.start_datetime);
                      const isToday = dayLabel === 'Today';
                      const isTomorrow = dayLabel === 'Tomorrow';
                      
                      let Icon = FiCalendar;
                      let typeColor = 'text-indigo-600 bg-indigo-50 border-indigo-100';
                      let badgeLabel = 'Event';
                      
                      if (event.source === 'service_delivery') {
                        Icon = FiBriefcase;
                        typeColor = 'text-blue-600 bg-blue-50 border-blue-100';
                        badgeLabel = 'Delivery';
                      } else if (event.source === 'service_expiry') {
                        Icon = FiAlertCircle;
                        typeColor = 'text-rose-600 bg-rose-50 border-rose-100';
                        badgeLabel = 'Expiry';
                      } else if (event.source === 'task' || event.source === 'calendar_event') {
                        Icon = FiCheckSquare;
                        typeColor = 'text-emerald-600 bg-emerald-50 border-emerald-100';
                        badgeLabel = 'Task';
                      }

                      return (
                        <div key={event.id} className={`flex items-start gap-3 p-3 rounded-lg border ${typeColor} shadow-sm transition-all hover:shadow-md group`}>
                          <div className={`mt-0.5 p-1.5 rounded-md bg-white shadow-sm shrink-0`}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-gray-900 truncate" title={event.title}>{event.title}</p>
                            {event.description && <p className="text-xs text-gray-600 truncate mt-0.5">{event.description}</p>}
                            <div className="flex items-center justify-between mt-1.5">
                              <p className="text-xs font-medium flex items-center gap-1">
                                <FiClock className="h-3 w-3" />
                                <span className={`${isToday ? 'text-rose-600 font-bold' : isTomorrow ? 'text-amber-600 font-bold' : 'text-gray-600'}`}>
                                  {dayLabel}
                                </span>
                              </p>
                              <span className="text-[9px] uppercase tracking-wider font-bold opacity-70">
                                {badgeLabel}
                              </span>
                            </div>
                          </div>
                          
                          {/* 🔥 The Action Button */}
                          <div className="shrink-0 flex flex-col items-center justify-center self-stretch ml-1">
                            <button
                              onClick={() => handleViewService(event)}
                              className="p-2 bg-white/60 hover:bg-white rounded-full shadow-sm text-gray-500 hover:text-indigo-600 transition-all border border-black/5 opacity-80 hover:opacity-100"
                              title="Go to Service Tracking"
                            >
                              <FiExternalLink className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </motion.div>
              </div>
              
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
                  <div className="p-6 overflow-y-auto max-h-[500px]">
                    {Object.keys(groupedRecentActivities).length > 0 ? (
                      <div className="space-y-8">
                        {Object.entries(groupedRecentActivities).map(([date, entries]) => (
                          <div key={date} className="relative">
                            {/* Date Sticky Header */}
                            <div className="flex items-center gap-3 mb-4 sticky top-0 bg-white/90 backdrop-blur-sm py-2 z-20 -mx-2 px-2">
                              <div className="p-1.5 bg-gray-100 rounded-md">
                                <FiCalendar className="h-3.5 w-3.5 text-gray-600" />
                              </div>
                              <h4 className="text-xs font-bold text-gray-800 uppercase tracking-wider">
                                {formatDateUI(date)}
                              </h4>
                              <div className="h-px bg-gray-200 flex-1 ml-2"></div>
                            </div>

                            {/* Timeline Entries */}
                            <div className="space-y-4 relative">
                              {entries.map((entry, index) => (
                                <div key={entry.id} className="group relative flex gap-4">
                                  {/* Timeline Vertical Line (hides on the very last item of the day) */}
                                  {index !== entries.length - 1 && (
                                    <div className="absolute left-[19px] top-10 bottom-[-24px] w-[2px] bg-gray-100 group-hover:bg-indigo-100 transition-colors"></div>
                                  )}
                                  
                                  {/* Activity Avatar */}
                                  <div className="w-10 h-10 bg-indigo-50 border border-indigo-100 rounded-full flex items-center justify-center shrink-0 z-10 transition-transform group-hover:scale-110">
                                    <FiUser className="h-4 w-4 text-indigo-600" />
                                  </div>

                                  {/* Activity Card */}
                                  <div className="flex-1 bg-white border border-gray-100 rounded-xl p-4 shadow-sm hover:shadow-md transition-all group-hover:border-indigo-200">
                                    <div className="flex justify-between items-start mb-2">
                                      <div className="flex flex-wrap items-center gap-2">
                                        <p className="text-sm font-bold text-gray-900">{entry.customerName || 'Customer'}</p>
                                        
                                        {/* Upgraded Badges */}
                                        <div className="flex items-center gap-1.5">
                                          {entry.workSource === 'online' && (
                                            <span className="flex items-center gap-1 px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded text-[10px] font-bold uppercase tracking-wider border border-blue-100">
                                              <FiGlobe className="h-3 w-3" /> Online
                                            </span>
                                          )}
                                          {entry.is_edited && (
                                            <span className="px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded text-[10px] font-bold uppercase tracking-wider border border-gray-200">
                                              Edited
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                      
                                      {/* Time Tag */}
                                      <span className="text-[10px] font-semibold text-gray-500 bg-gray-50 px-2 py-1 rounded-md shrink-0 border border-gray-100">
                                        {formatTime(entry.created_at)}
                                      </span>
                                    </div>
                                    
                                    <p className="text-xs font-medium text-gray-600 mb-3">{getCategoryName(entry.category)} service</p>
                                    
                                    {/* Action & Status Row */}
                                    <div className="flex justify-between items-center pt-3 border-t border-gray-50">
                                      <div className="flex items-center gap-2">
                                        {/* Upgraded Status Pills */}
                                        <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${
                                          entry.status === 'completed' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                                          entry.status === 'in-progress' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                                          entry.status === 'pending' ? 'bg-amber-50 text-amber-700 border border-amber-200' : 
                                          'bg-gray-50 text-gray-700 border border-gray-200'
                                        }`}>
                                          {entry.status?.replace('-', ' ')}
                                        </span>
                                        
                                        {entry.tokenId && (
                                          <span className="text-[11px] text-gray-500 font-mono font-medium pl-2 border-l border-gray-200">
                                            {shortenTokenId(entry.tokenId)}
                                          </span>
                                        )}
                                      </div>
                                      
                                      {/* Enhanced Details Button */}
                                      {(entry.tokenId || entry.tracking_id) && (
                                        <button 
                                          onClick={() => handleViewDetails(entry.tokenId, entry.tracking_id)}
                                          className="px-3 py-1.5 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-700 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider shadow-sm transition-all shrink-0"
                                        >
                                          <FiBarChart2 className="h-3.5 w-3.5" /> Details
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                    <div className="text-center py-8 text-gray-500">No recent activity</div>
                  )}
                </div>
              </div>
              
            </div>
          </div>
        </motion.div>
      </div>
      {/* Cancel Modal */}
        {showCancelModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Cancel Token</h3>
              <p className="text-gray-600 mb-4">
                Are you sure you want to cancel token <span className="font-mono font-bold">{cancelTokenData?.tokenId}</span> for <span className="font-medium">{cancelTokenData?.customerName}</span>?
              </p>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason (optional)</label>
                <textarea 
                  value={cancelReason} 
                  onChange={(e) => setCancelReason(e.target.value)} 
                  rows="3" 
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-indigo-500 focus:border-indigo-500" 
                  placeholder="e.g., customer requested, duplicate entry..." 
                />
              </div>
              <div className="flex gap-3 justify-end">
                <button 
                  onClick={() => setShowCancelModal(false)} 
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition"
                >
                  No, Keep Token
                </button>
                <button 
                  onClick={handleCancelConfirm} 
                  disabled={cancelling} 
                  className="px-4 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 transition disabled:opacity-50"
                >
                  {cancelling ? 'Cancelling...' : 'Yes, Cancel Token'}
                </button>
              </div>
            </div>
          </div>
        )}

      <QuickServiceModal open={showQuickService} onClose={() => setShowQuickService(false)} wallets={wallets} />
    </div>
  );
};

export default StaffDashboard;
