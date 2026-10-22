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
import { getCategories, getTokens } from '/src/services/serviceService';
import { getWalletsForCentre } from '@/services/walletService';
import { postAttendance } from '/src/services/salaryService';
import QuickServiceModal from '@/components/QuickServiceModal';
import api from '@/services/serviceService';
import { socket } from '@/services/socket';

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
    className="bg-white rounded-2xl border border-slate-200 hover:shadow-lg transition-all duration-300 p-5"
  >
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="font-medium text-slate-600 mb-1 text-sm">{title}</p>
        {loading ? (
          <div className="h-8 w-20 bg-slate-200 animate-pulse rounded"></div>
        ) : (
          <p className="font-bold text-slate-900 text-2xl">{value}</p>
        )}
        {subtitle && <p className="text-slate-500 text-sm mt-1">{subtitle}</p>}
      </div>
      <div className={`rounded-xl ${color} p-3 shrink-0`}>
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
  const [todayAttendance, setTodayAttendance] = useState(null);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
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
    monthlyTarget: 0,
    currentAchieved: 0,
    dailyTarget: 0,
    todayAchieved: 0,
    targetProgress: 0,
    targetHistory: [] ,
  });

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

  // Application Tracking State
  const [trackingStats, setTrackingStats] = useState({ total: 0, pending: 0, in_progress: 0, completed: 0, delayed: 0 });
  const [trackingEntries, setTrackingEntries] = useState([]);
  const [statView, setStatView] = useState('applications'); 
  const [activeAppView, setActiveAppView] = useState('active');

  // --- Welcome banner state ---
  const [currentTime, setCurrentTime] = useState(new Date());
  const staffName = localStorage.getItem('username') || 'Staff';
  const staffInitials = staffName
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'ST';

  // --- Birthdays ---
  const todayKey = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  const [birthdays, setBirthdays] = useState([]);
  const [hideMyBirthday, setHideMyBirthday] = useState(() => {
    try { return localStorage.getItem(`bday-hidden-${todayKey}`) === '1'; } catch { return false; }
  });

  const toPhotoUrl = (p) => {
    if (!p || p === 'null' || p === 'undefined') return null;
    return p.startsWith('http') || p.startsWith('data:image') ? p : `${import.meta.env.VITE_API_URL}${p}`;
  };

  // Photo Formatting
  const [imageError, setImageError] = useState(false);
  const rawPhoto = localStorage.getItem('photo') ;
  
  let staffPhotoUrl = null;
  if (rawPhoto && rawPhoto !== 'null' && rawPhoto !== 'undefined') {
    staffPhotoUrl = rawPhoto.startsWith('http') || rawPhoto.startsWith('data:image') 
      ? rawPhoto 
      : `${import.meta.env.VITE_API_URL}${rawPhoto}`;
  }

  const fetchTrackingData = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };

      // Explicitly pass the staffId to force the backend to return ONLY this user's data
      const [statsRes, entriesRes] = await Promise.all([
        fetch(`${import.meta.env.VITE_API_URL}/api/servicetracking/stats?staff=${staffId}`, { headers }),
        fetch(`${import.meta.env.VITE_API_URL}/api/servicetracking/entries?staff=${staffId}&limit=100`, { headers })
      ]);

      if (!statsRes.ok) throw new Error('Failed to fetch tracking stats');
      if (!entriesRes.ok) throw new Error('Failed to fetch tracking entries');

      const statsData = await statsRes.json();
      const entriesData = await entriesRes.json();

      setTrackingStats(statsData || { total: 0, pending: 0, in_progress: 0, completed: 0, delayed: 0 });
      
      // The /entries endpoint wraps the array inside a 'data' property
      const entries = entriesData.data || [];
      setTrackingEntries(entries);
    } catch (err) {
      console.error('Error fetching tracking data:', err);
    }
  }, [staffId]); // Added staffId to dependencies

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

  // --- Socket global listeners ---
  useEffect(() => {
    const onConnectError = (error) => {
      if (error.message === 'Socket authentication failed') {
        toast.error('Session expired. Please login again.');
      }
    };

    socket.on('connect_error', onConnectError);

    return () => {
      socket.off('connect_error', onConnectError);
    };
  }, []);


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

  // --- Fetch Entire Workspace (Hybrid BFF) ---
  const fetchWorkspaceInit = useCallback(async () => {
    try {
      setPerformanceLoading(true);
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
        `${import.meta.env.VITE_API_URL}/api/staffperformance/workspace-init?${params.toString()}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (!response.ok) throw new Error('Failed to fetch workspace data');
      
      const result = await response.json();
      const { performance: perfData, tasks, events, recentActivity, onlinePending, onlineProcessing, todayAttendance: att } = result.data;

      setTodayAttendance(att);
      
      // 1. Set Performance
      setPerformance({
        completionRate: perfData.summary.collection_rate || 0,
        avgTransactionValue: perfData.summary.avg_transaction_value || 0,
        customerSatisfaction: perfData.ratings?.avg_rating ? `${perfData.ratings.avg_rating}/5` : 'N/A',
        totalServices: perfData.summary.total_services || 0,
        totalCollected: perfData.summary.total_collected || 0,
        collectionRate: perfData.summary.collection_rate || 0,
        incentiveScore: perfData.summary.incentive_score || 0,
        avgRating: perfData.ratings?.avg_rating || 0,
        totalReviews: perfData.ratings?.total_reviews || 0,

        monthlyTarget: perfData.target?.monthly_target || 0,
        currentAchieved: perfData.target?.current_achieved || 0,
        dailyTarget: perfData.target?.daily_target || 0,
        todayAchieved: perfData.target?.today_achieved || 0, 
        targetProgress: perfData.target?.progress_percentage || 0,
        targetHistory: perfData.target?.history || [],
      });

      // 2. Set Tasks & Events with STRICT isolation
      // Only keep tasks assigned strictly to this staff member
      setMyTasks(tasks || []);
      
      const validEvents = (events || [])
        .filter(e => {
          if (!e.assigned_to) return true;
          return String(e.assigned_to) === String(staffId);
        })
        // 🔥 Flip 'a' and 'b' to sort in descending order (largest dates first)
        .sort((a, b) => new Date(b.date || b.start_datetime) - new Date(a.date || a.start_datetime));
      setUpcomingEvents(validEvents);

      // 3. Set Activities & Bookings
      setRecentServiceEntries(recentActivity || []);
      setOnlineBookings(onlinePending || []);
      setProcessingBookings(onlineProcessing || []);

    } catch (err) {
      console.error('Error fetching workspace:', err);
      toast.error('Failed to load workspace data');
    } finally {
      setPerformanceLoading(false);
    }
  }, [period, customDateRange]);

  // --- Auto-cycle Events Tabs ---
  useEffect(() => {
    if (isEventsHovered || upcomingEvents.length === 0) return;
    const tabs = ['All', 'Tasks', 'Deliveries', 'Expiries', 'Days'];
    
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
      fetchWorkspaceInit(); // 👈 And this here!
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

  useEffect(() => {
    const token = localStorage.getItem('token');
    fetch(`${import.meta.env.VITE_API_URL}/api/staff/birthdays/today`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(res => (res.ok ? res.json() : []))
      .then(data => setBirthdays(Array.isArray(data) ? data : []))
      .catch(() => setBirthdays([]));
  }, []);

  const myBirthday = birthdays.find(b => b.isMe);
  const colleagueBirthdays = birthdays.filter(b => !b.isMe);

  const dismissMyBirthday = () => {
    setHideMyBirthday(true);
    try { localStorage.setItem(`bday-hidden-${todayKey}`, '1'); } catch {}
  };

  const MESSENGER_ROUTE = '/dashboard/staff/messenger';
  const [openingChatFor, setOpeningChatFor] = useState(null);

  // Open (or create) the direct chat with a colleague and pre-fill a birthday wish
  const handleSendWishes = async (person) => {
    if (openingChatFor) return;
    setOpeningChatFor(person.id);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/chat/conversation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          participants: [person.id],
          is_group: false,
          conversationType: 'internal',
          channel: 'internal',
        }),
      });
      if (!res.ok) throw new Error('Failed to open chat');
      const conv = await res.json();

      const firstName = (person.name || '').split(' ')[0];
      navigate(MESSENGER_ROUTE, {
        state: {
          openConversationId: conv.id,
          draftMessage: `Happy Birthday, ${firstName}! 🎉 Wishing you a wonderful year ahead.`,
        },
      });
    } catch (err) {
      console.error(err);
      toast.error('Could not open chat. Please try again.');
    } finally {
      setOpeningChatFor(null);
    }
  };

  // Initial data fetch
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        if (!staffId || !centreId) throw new Error('Missing staff or centre ID');
        
        // Load the 3 main pillars concurrently
        await Promise.all([
          getCategories().then(res => setCategories(res.data || [])),
          refreshTokens(),
          fetchWorkspaceInit(),
          fetchTrackingData()
        ]);
        
      } catch (err) {
        setError('Failed to load dashboard data: ' + (err.response?.data?.error || err.message));
        toast.error('Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [staffId, centreId, refreshTokens, fetchWorkspaceInit]);

  const isMounted = useRef(false);

  // Refetch when period changes
  useEffect(() => {
    if (isMounted.current && !loading) {
      fetchWorkspaceInit();
    } else if (!loading) {
      isMounted.current = true;
    }
  }, [period, customDateRange, fetchWorkspaceInit, loading]);

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
        await refreshTokens();
        await fetchWorkspaceInit();
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
  }, [centreId, staffId, refreshTokens, fetchWorkspaceInit]);

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

  const filteredApplications = useMemo(() => {
    let source = trackingEntries;
    
    // 1. Filter by Tab View
    if (activeAppView === 'active') {
      source = source.filter(app => ['pending', 'in_progress', 'resubmit'].includes(app.status));
    } else if (activeAppView === 'completed') {
      source = source.filter(app => ['completed', 'paid'].includes(app.status));
    } else if (activeAppView === 'delayed') {
      source = source.filter(app => ['rejected', 'delayed'].includes(app.status));
    }

    // 2. Filter by Search Query (Seamless integration with the top search bar)
    const searchLower = searchQuery.toLowerCase().trim();
    if (searchLower) {
      source = source.filter(app => 
        String(app.customer_name || '').toLowerCase().includes(searchLower) ||
        String(app.application_number || '').toLowerCase().includes(searchLower) ||
        String(app.phone || '').toLowerCase().includes(searchLower)
      );
    }

    return source;
  }, [trackingEntries, activeAppView, searchQuery]);

  const handleTakeWork = async (bookingId) => {
    try {
      await api.put(`/customer-services/${bookingId}/take`);
      toast.success('Work assigned to you');
      await fetchWorkspaceInit(); // 👈 Just call this to refresh everything!
    } catch (err) {
      toast.error(err.response?.data?.error || 'Already taken by another staff');
    }
  };

  const handleQuickPunch = async () => {
    try {
      setAttendanceLoading(true);
      const isPunchOut = todayAttendance && todayAttendance.punch_in && !todayAttendance.punch_out;
      
      // Get exact current time formatted for Asia/Kolkata to match backend validation perfectly
      const now = new Date();
      const formattedDate = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }); // YYYY-MM-DD
      const formattedTime = now.toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: 'Asia/Kolkata'
      }); // HH:mm
      
      // Send the exact payload the backend expects
      await postAttendance({
        punch_type: isPunchOut ? 'out' : 'in',
        date: formattedDate,
        time: formattedTime
      });
      
      toast.success(`Successfully punched ${isPunchOut ? 'out' : 'in'}`);
      await fetchWorkspaceInit(); // Instantly refresh the dashboard!
    } catch (err) {
      console.error('Attendance Punch Error:', err.response?.data || err.message);
      toast.error(err.response?.data?.error || 'Failed to update attendance');
    } finally {
      setAttendanceLoading(false);
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
      case 'completed': return 'bg-emerald-100 text-emerald-800';
      case 'in-progress': case 'processing': return 'bg-slate-200 text-navy-800';
      case 'pending': return 'bg-amber-100 text-amber-800';
      default: return 'bg-slate-100 text-slate-800';
    }
  };
  const getStatusIcon = (status) => {
    switch(status) {
      case 'completed': return <FiCheckCircle className="h-4 w-4 text-emerald-500" />;
      case 'in-progress': case 'processing': return <FiPlayCircle className="h-4 w-4 text-navy-500" />;
      case 'pending': return <FiClock className="h-4 w-4 text-amber-500" />;
      default: return null;
    }
  };

  // history is newest-first; only months that had a real target count
  const targetHistory = (performance.targetHistory || []).filter(h => h.target > 0);
  const lastMonth = targetHistory[0];
  const targetStreak = (() => {
    let n = 0;
    for (const h of targetHistory) { if (h.percent >= 100) n++; else break; }
    return n;
  })();

  // ── STEP 1: derived values (Glance strip) ────────────────────────────
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  // Tasks tile
  const overdueTasks = myTasks.filter(t => t.due_date && new Date(t.due_date) < todayStart);
  const nextTask = [...myTasks]
    .filter(t => t.due_date)
    .sort((a, b) => new Date(a.due_date) - new Date(b.due_date))[0] || null;

  // Next event tile (upcomingEvents is sorted newest-first, so pick the nearest future one)
  const nextEvent = upcomingEvents
    .map(e => ({ ...e, _d: new Date(e.date || e.start_datetime) }))
    .filter(e => !isNaN(e._d) && e._d >= todayStart)
    .sort((a, b) => a._d - b._d)[0] || null;

  // Score tile
  const scoreLabel =
    performance.incentiveScore >= 80 ? 'Excellent' :
    performance.incentiveScore >= 60 ? 'Good' :
    performance.incentiveScore >= 40 ? 'Average' : 'Needs improvement';
  const scoreColor =
    performance.incentiveScore >= 80 ? 'bg-emerald-500' :
    performance.incentiveScore >= 60 ? 'bg-amber-400' : 'bg-rose-500';

  const barColor = (p) => (p >= 100 ? 'bg-emerald-500' : p >= 50 ? 'bg-amber-400' : 'bg-rose-500');
  const scrollToPerf = () =>
    document.getElementById('perf-details')?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  if (loading) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="text-center"><div className="w-12 h-12 border-[3px] border-navy-700 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div><p className="text-slate-600">Loading dashboard...</p></div>
    </div>
  );
  if (error) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-xl p-8 max-w-md w-full border border-slate-200 text-center">
        <FiAlertCircle className="mx-auto h-12 w-12 text-rose-600 mb-4" />
        <h3 className="text-lg font-semibold text-slate-900 mb-2">Data Loading Error</h3>
        <p className="text-slate-600 mb-6">{error}</p>
        <button onClick={() => window.location.reload()} className="px-6 py-3 bg-navy-700 text-white rounded-xl hover:bg-navy-800">Try Again</button>
      </div>
    </div>
  );

  // Find the wallet assigned to the logged-in staff member
  const myWallet = wallets.find(w => String(w.assigned_staff_id) === String(staffId));

  return (
    <div className="min-h-screen bg-slate-50 sd-root">
      <style>{`.sd-root button:focus-visible,.sd-root a:focus-visible,.sd-root select:focus-visible,.sd-root input:focus-visible,.sd-root [tabindex]:focus-visible{outline:3px solid #3b5d8f;outline-offset:2px}`}</style>
      <a href="#sd-main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:bg-white focus:text-navy-800 focus:px-4 focus:py-2 focus:rounded-xl focus:font-semibold focus:shadow-lg">
        Skip to main content
      </a>

      {/* ===== DARK BLUE WELCOME BANNER ===== */}
      <div className="bg-gradient-to-r from-navy-800 via-navy-700 to-navy-800 text-white px-6 py-6">
        <div className="w-full">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
            <div className="flex-1">
              <div className="flex items-start gap-4 mb-3">
                <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center text-2xl font-bold flex-shrink-0 overflow-hidden shadow-sm">
                  {staffPhotoUrl && !imageError ? (
                    <img 
                      src={staffPhotoUrl} 
                      alt="Profile" 
                      className="w-full h-full object-cover"
                      onError={() => setImageError(true)} 
                    />
                  ) : (
                    staffInitials
                  )}
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
                  <span className="h-2 w-2 bg-emerald-400 rounded-full"></span>
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
                    className="px-4 py-2 bg-white/20 rounded-xl text-sm font-medium hover:bg-white/30 transition"
                  >
                    New Token
                  </button>
                  <button
                    onClick={() => setShowQuickService(true)}
                    className="px-4 py-2 bg-white/20 rounded-xl text-sm font-medium hover:bg-white/30 transition"
                  >
                    Quick Service
                  </button>
                  <button
                    onClick={() => navigate('/dashboard/staff/performance')}
                    className="px-4 py-2 bg-white/20 rounded-xl text-sm font-medium hover:bg-white/30 transition"
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
            🎨 New Messenger UI active! 🐛 Bug fixes deployed for peak performance. Stay sharp, team! ⚡
          </div>
        </div>
      </div>

      {/* ===== BIRTHDAY: MY OWN ===== */}
      <AnimatePresence>
        {myBirthday && !hideMyBirthday && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="relative overflow-hidden bg-rose-600 text-white"
          >
            {/* floating emojis */}
            {['🎉', '🎈', '🎂', '✨', '🎁', '🎊'].map((e, i) => (
              <motion.span
                key={i}
                className="absolute text-2xl select-none pointer-events-none"
                style={{ left: `${8 + i * 16}%`, bottom: '-10px' }}
                animate={{ y: [-10, -90], opacity: [0, 1, 0] }}
                transition={{ duration: 3 + (i % 3), repeat: Infinity, delay: i * 0.6 }}
              >
                {e}
              </motion.span>
            ))}

            <div className="relative w-full px-6 py-5 flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="text-5xl">🎂</div>
                <div>
                  <h3 className="text-xl font-bold">Happy Birthday, {myBirthday.name}! 🎉</h3>
                  <p className="text-white/90 text-sm mt-0.5">
                    Wishing you a wonderful year ahead from the whole team. Thank you for everything you do!
                  </p>
                </div>
              </div>
              <button
                onClick={dismissMyBirthday}
                className="p-2 rounded-full bg-white/20 hover:bg-white/30 shrink-0"
                title="Dismiss"
                aria-label="Dismiss birthday message"
              >
                <FiXCircle className="h-5 w-5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ===== BIRTHDAY: COLLEAGUES ===== */}
      {colleagueBirthdays.length > 0 && (
        <div className="bg-rose-50 border-l-4 border-rose-500">
          <div className="w-full px-6 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex -space-x-2 shrink-0">
                {colleagueBirthdays.slice(0, 3).map(b => (
                  toPhotoUrl(b.photo) ? (
                    <img key={b.id} src={toPhotoUrl(b.photo)} alt={b.name}
                        className="w-9 h-9 rounded-full border-2 border-white object-cover" />
                  ) : (
                    <div key={b.id} className="w-9 h-9 rounded-full border-2 border-white bg-rose-200 text-rose-800 flex items-center justify-center text-xs font-bold">
                      {b.name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                  )
                ))}
              </div>
              <p className="text-sm text-rose-900">
                🎂 Today is{' '}
                <span className="font-bold">
                  {colleagueBirthdays.map(b => b.name).join(', ').replace(/, ([^,]*)$/, ' & $1')}
                </span>
                's birthday! Don't forget to wish them 🎉
              </p>
            </div>
            {colleagueBirthdays.length === 1 ? (
              <button
                onClick={() => handleSendWishes(colleagueBirthdays[0])}
                disabled={!!openingChatFor}
                className="px-4 py-2 bg-rose-600 text-white text-sm font-bold rounded-xl hover:bg-rose-700 shadow-sm shrink-0 disabled:opacity-60"
              >
                {openingChatFor ? 'Opening…' : 'Send Wishes'}
              </button>
            ) : (
              <div className="flex flex-wrap gap-2 shrink-0">
                {colleagueBirthdays.map(b => (
                  <button
                    key={b.id}
                    onClick={() => handleSendWishes(b)}
                    disabled={!!openingChatFor}
                    className="px-3 py-1.5 bg-rose-600 text-white text-xs font-bold rounded-xl hover:bg-rose-700 shadow-sm disabled:opacity-60"
                  >
                    {openingChatFor === b.id ? 'Opening…' : `Wish ${(b.name || '').split(' ')[0]}`}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===== NEW: SMART ATTENDANCE BANNER ===== */}
      <AnimatePresence>
        {!loading && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            role="status"
            className={`border-l-4 shadow-sm ${
              !todayAttendance || !todayAttendance.punch_in 
                ? 'bg-rose-50 border-rose-500' 
                : (!todayAttendance.punch_out 
                    ? 'bg-emerald-50 border-emerald-500' 
                    : 'bg-amber-50 border-amber-500')
            }`}
          >
            <div className="w-full px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                {!todayAttendance || !todayAttendance.punch_in ? (
                  <>
                    <div className="p-2 bg-rose-100 rounded-full">
                      <FiAlertCircle className="h-5 w-5 text-rose-600" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-rose-900">You haven't punched in yet!</h3>
                      <p className="text-xs text-rose-700 mt-0.5">Please punch in to start tracking your hours for today.</p>
                    </div>
                  </>
                ) : !todayAttendance.punch_out ? (
                  <>
                    <div className="p-2 bg-emerald-100 rounded-full">
                      <FiCheckCircle className="h-5 w-5 text-emerald-700" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-emerald-900">You are punched in</h3>
                      <p className="text-xs text-emerald-700 mt-0.5">
                        Since {new Date(`1970-01-01T${todayAttendance.punch_in}`).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="p-2 bg-amber-100 rounded-full">
                      <FiClock className="h-5 w-5 text-amber-700" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-amber-900">You are currently punched out</h3>
                      <p className="text-xs text-amber-700 mt-0.5">
                        Punched out at {new Date(`1970-01-01T${todayAttendance.punch_out}`).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}. Remember to punch back in!
                      </p>
                    </div>
                  </>
                )}
              </div>
              <button
                onClick={handleQuickPunch}
                disabled={attendanceLoading}
                className={`px-6 py-2 rounded-xl text-sm font-bold text-white shadow-sm transition-all disabled:opacity-50 flex items-center justify-center min-w-[140px] ${
                  !todayAttendance || !todayAttendance.punch_in 
                    ? 'bg-rose-600 hover:bg-rose-700' 
                    : (!todayAttendance.punch_out 
                        ? 'bg-navy-700 hover:bg-navy-800' 
                        : 'bg-amber-600 hover:bg-amber-700')
                }`}
              >
                {attendanceLoading ? 'Processing...' : (!todayAttendance || !todayAttendance.punch_in ? 'Punch In Now' : (!todayAttendance.punch_out ? 'Punch Out' : 'Punch Back In'))}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* ========================================= */}
      
      {/* Original Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
        <div className="px-6 py-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-gradient-to-br from-navy-500 to-navy-700 rounded-xl flex items-center justify-center shadow-lg">
                <FiTrendingUp className="text-white h-6 w-6" />
              </div>
              <div>
                <h1 className="font-bold text-slate-900 text-2xl">Service Dashboard</h1>
                <p className="text-slate-600 text-sm">Manage tokens, track services, and view performance</p>
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
                              value={customDateRange.from}
                              onChange={(e) => setCustomDateRange(prev => ({ ...prev, from: e.target.value }))}
                              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm"
                              placeholder="From Date"
                              aria-label="From date"
                            />
                            <input
                              type="date"
                              value={customDateRange.to}
                              onChange={(e) => setCustomDateRange(prev => ({ ...prev, to: e.target.value }))}
                              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm"
                              placeholder="To Date"
                              aria-label="To date"
                            />
                            <button
                              onClick={() => { setPeriod('custom'); setShowDatePicker(false); }}
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
              
              <span className="hidden md:inline text-xs text-slate-500">Last updated: {lastUpdated.toLocaleTimeString()}</span>
              <button
                onClick={refreshTokens}
                className="p-2 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors"
                title="Refresh"
                aria-label="Refresh tokens"
              >
                <FiRefreshCw className="h-4 w-4 text-slate-600" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <main id="sd-main" className="p-6 pb-24">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="w-full">
          
          {/* ===== LAYOUT F: MAIN WORK AREA + MY DAY PANEL ===== */}
          <div className="flex flex-col xl:flex-row xl:flex-wrap 2xl:flex-nowrap gap-6 items-start">

            {/* Main column – stats, work queue, activity, performance */}
            <div className="flex-1 min-w-0 w-full">
              {/* Floating Action Button */}
              <button
                onClick={() => setShowQuickService(true)}
                aria-label="Quick service"
                title="Quick service"
                className="fixed bottom-8 right-8 bg-navy-700 text-white p-4 rounded-full shadow-lg hover:bg-navy-800 transition-all z-20"
              >
                <FiPlus className="h-6 w-6" />
              </button>

              {/* Search & Filter Bar + Wallet Pill */}
              <div className="flex flex-wrap gap-4 mb-6 items-center">
                <div className="relative flex-1 max-w-md">
                  <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500" />
                  <input
                    type="text"
                    aria-label="Search tokens"
                    placeholder="Search by token, customer name, or phone..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 pr-4 py-2.5 w-full border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-navy-500/30 focus:border-navy-500"
                  />
                </div>
                <select aria-label="Date range" value={activeDate} onChange={(e) => setActiveDate(e.target.value)} className="border border-slate-300 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-navy-500/30 focus:border-navy-500">
                  <option value="today">Today</option>
                  <option value="yesterday">Yesterday</option>
                  <option value="week">This Week</option>
                  <option value="all">All Time</option>
                </select>

                {/* ----- Ultra‑Compact Wallet Pill ----- */}
                {myWallet && (
                  <motion.div
                    whileHover={{ y: -1 }}
                    className="inline-flex items-center gap-2 bg-white border border-slate-300 rounded-full px-3 py-2 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                  >
                    <div className="p-1 bg-slate-200 rounded-full">
                      <FiBriefcase className="h-3.5 w-3.5 text-navy-700" />
                    </div>
                    <span className="text-sm font-medium text-slate-700">
                      {myWallet.name}
                    </span>
                    <span className="text-sm font-bold text-slate-900">
                      {formatCurrency(myWallet.balance)}
                    </span>
                  </motion.div>
                )}
              </div>

              {/* Stats Toggle Header */}
              <div className="flex items-center justify-between mb-4 mt-2">
                <h2 className="text-lg font-bold text-slate-900">Today at a glance</h2>
                <div className="bg-slate-100 p-1 rounded-xl inline-flex">
                  <button aria-pressed={statView === 'applications'} onClick={() => setStatView('applications')} className={`px-4 py-2 min-h-[40px] text-sm font-bold rounded-lg transition-all ${statView === 'applications' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Applications</button>
                  <button aria-pressed={statView === 'tokens'} onClick={() => setStatView('tokens')} className={`px-4 py-2 min-h-[40px] text-sm font-bold rounded-lg transition-all ${statView === 'tokens' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Walk-in Tokens</button>
                </div>
              </div>

              {/* Stats Row */}
              <div className="grid grid-cols-2 md:grid-cols-3 2xl:grid-cols-5 gap-3 mb-6">
                {statView === 'applications' ? (
                  <>
                    <StatCard title="Total Apps" value={trackingStats.total || 0} icon={FiTarget} color="bg-slate-600" />
                    <StatCard title="Pending" value={trackingStats.pending || 0} icon={FiClock} color="bg-amber-500" />
                    <StatCard title="In Progress" value={trackingStats.in_progress || 0} icon={FiPlayCircle} color="bg-navy-500" />
                    <StatCard title="Completed" value={trackingStats.completed || 0} icon={FiCheckCircle} color="bg-emerald-500" />
                    <StatCard title="Delayed" value={trackingStats.delayed || 0} icon={FiAlertCircle} color="bg-rose-500" />
                  </>
                ) : (
                  <>
                    <StatCard title="Total Tokens" value={statusCounts.total} icon={FiUsers} color="bg-slate-600" />
                    <StatCard title="Pending" value={statusCounts.pending} icon={FiClock} color="bg-amber-500" />
                    <StatCard title="In Progress" value={statusCounts.inProgress} icon={FiPlayCircle} color="bg-navy-500" />
                    <StatCard title="Completed" value={statusCounts.completed} icon={FiCheckCircle} color="bg-emerald-500" />
                    <StatCard title="Campaign" value={statusCounts.campaign} icon={FiAward} color="bg-navy-500" />
                  </>
                )}
              </div>

              {/* ===== STEP 2: GLANCE STRIP ===== */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">

                {/* Score */}
                <div
                  onClick={scrollToPerf}
                  role="button"
                  tabIndex={0}
                  aria-label="Performance score. Press to jump to performance details"
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); scrollToPerf(); } }}
                  className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm cursor-pointer hover:border-navy-500 transition-colors"
                >
                  <p className="text-xs font-semibold text-slate-600 flex items-center mb-3">
                    <FiAward className="h-3.5 w-3.5 mr-1.5 text-navy-700" />
                    Performance score
                  </p>
                  {performanceLoading ? (
                    <div className="h-14 bg-slate-200 animate-pulse rounded" />
                  ) : (
                    <>
                      <p className="text-2xl font-black text-slate-900">{performance.incentiveScore}%</p>
                      <p className="text-xs text-slate-500 mb-2">{scoreLabel}</p>
                      <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                        <div className={`h-full rounded-full ${scoreColor}`} style={{ width: `${Math.min(performance.incentiveScore, 100)}%` }} />
                      </div>
                    </>
                  )}
                </div>

                {/* Tasks */}
                <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
                  <p className="text-xs font-semibold text-slate-600 flex items-center mb-3">
                    <FiCheckSquare className="h-3.5 w-3.5 mr-1.5 text-navy-700" />
                    Pending tasks
                  </p>
                  <p className="text-2xl font-black text-slate-900">{myTasks.length}</p>
                  {overdueTasks.length > 0 ? (
                    <p className="text-xs font-bold text-rose-600 mt-1">{overdueTasks.length} overdue</p>
                  ) : nextTask ? (
                    <p className="text-xs text-slate-500 mt-1 truncate" title={nextTask.title}>
                      Next: {nextTask.title}
                    </p>
                  ) : (
                    <p className="text-xs text-emerald-700 mt-1">All clear</p>
                  )}
                </div>

                {/* Next event */}
                <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
                  <p className="text-xs font-semibold text-slate-600 flex items-center mb-3">
                    <FiCalendar className="h-3.5 w-3.5 mr-1.5 text-navy-700" />
                    Next event
                  </p>
                  {nextEvent ? (
                    <>
                      <p className="text-sm font-bold text-slate-900 line-clamp-2" title={nextEvent.title}>{nextEvent.title}</p>
                      <p className="text-xs text-slate-500 mt-1">{getEventDayLabel(nextEvent.date || nextEvent.start_datetime)}</p>
                    </>
                  ) : (
                    <p className="text-xs text-slate-500">Nothing upcoming</p>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-6">
              <div role="region" aria-label="Work queue" className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[min(850px,85vh)] min-h-[520px]">
                
                {/* Master Workspace Tabs */}
                <div role="tablist" aria-label="Work queue sections" className="flex p-3 border-b border-slate-200 bg-slate-50/80 gap-2 overflow-x-auto hide-scrollbar">
                  <button role="tab" aria-selected={workspaceTab === 'tokens'} onClick={() => setWorkspaceTab('tokens')} className={`flex items-center gap-2 px-4 py-2.5 min-h-[44px] rounded-xl text-sm font-semibold whitespace-nowrap transition-all ${workspaceTab === 'tokens' ? 'bg-white text-navy-700 shadow-sm border border-slate-200' : 'text-slate-600 hover:bg-slate-200/50'}`}>
                    <FiUsers className="h-4 w-4" />
                    Walk-in Tokens
                    <span className={`px-2 py-0.5 rounded-full text-xs ${workspaceTab === 'tokens' ? 'bg-slate-200 text-navy-700' : 'bg-slate-200 text-slate-600'}`}>{statusCounts.total}</span>
                  </button>
                  <button role="tab" aria-selected={workspaceTab === 'queue'} onClick={() => setWorkspaceTab('queue')} className={`flex items-center gap-2 px-4 py-2.5 min-h-[44px] rounded-xl text-sm font-semibold whitespace-nowrap transition-all ${workspaceTab === 'queue' ? 'bg-white text-navy-700 shadow-sm border border-slate-200' : 'text-slate-600 hover:bg-slate-200/50'}`}>
                    <FiGlobe className="h-4 w-4" />
                    Online Queue
                    <span className={`px-2 py-0.5 rounded-full text-xs ${workspaceTab === 'queue' ? 'bg-slate-200 text-navy-700' : 'bg-slate-200 text-slate-600'}`}>{onlineBookings.length}</span>
                  </button>
                  <button role="tab" aria-selected={workspaceTab === 'processing'} onClick={() => setWorkspaceTab('processing')} className={`flex items-center gap-2 px-4 py-2.5 min-h-[44px] rounded-xl text-sm font-semibold whitespace-nowrap transition-all ${workspaceTab === 'processing' ? 'bg-white text-emerald-700 shadow-sm border border-slate-200' : 'text-slate-600 hover:bg-slate-200/50'}`}>
                    <FiPlayCircle className="h-4 w-4" />
                    My Online Work
                    <span className={`px-2 py-0.5 rounded-full text-xs ${workspaceTab === 'processing' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>{processingBookings.length}</span>
                  </button>
                  <button role="tab" aria-selected={workspaceTab === 'applications'} onClick={() => setWorkspaceTab('applications')} className={`flex items-center gap-2 px-4 py-2.5 min-h-[44px] rounded-xl text-sm font-semibold whitespace-nowrap transition-all ${workspaceTab === 'applications' ? 'bg-white text-navy-700 shadow-sm border border-slate-200' : 'text-slate-600 hover:bg-slate-200/50'}`}>
                    <FiTarget className="h-4 w-4" />
                    Applications
                    <span className={`px-2 py-0.5 rounded-full text-xs ${workspaceTab === 'applications' ? 'bg-slate-200 text-navy-700' : 'bg-slate-200 text-slate-600'}`}>{trackingStats.total || 0}</span>
                  </button>
                </div>

                {/* Workspace Content */}
                <div className="flex-1 overflow-y-auto bg-slate-50/30 p-4 sm:p-6">
                  
                  {/* TAB 1: TOKENS */}
                  {workspaceTab === 'tokens' && (
                    <div className="space-y-4">
                      {/* Sub-Tabs for Tokens */}
                      <div className="flex gap-2 border-b border-slate-200 pb-3">
                        {['active', 'completed', 'campaign'].map(tab => (
                          <button
                            key={tab}
                            aria-pressed={activeView === tab}
                            onClick={() => setActiveView(tab)}
                            className={`px-4 py-2 min-h-[40px] rounded-full text-xs font-bold capitalize transition-colors ${
                              activeView === tab ? 'bg-navy-700 text-white shadow-sm' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                            }`}
                          >
                            {tab}
                          </button>
                        ))}
                      </div>

                      {Object.keys(groupedTokens).length === 0 ? (
                        <div className="text-center py-16 text-slate-500">
                          <FiPlayCircle className="mx-auto h-12 w-12 mb-3 opacity-30"/>
                          <p className="font-medium">No tokens found</p>
                        </div>
                      ) : (
                        <div className="space-y-6">
                          {Object.entries(groupedTokens).map(([date, dateTokens]) => (
                            <div key={date}>
                              <div className="flex items-center gap-2 mb-3 pl-1">
                                <FiCalendar className="h-4 w-4 text-navy-500" />
                                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">{formatDateUI(date)}</h3>
                                <div className="h-px bg-slate-200 flex-1 ml-2"></div>
                              </div>
                              <div className="grid grid-cols-1 gap-3">
                                {dateTokens.map(token => {
                                  const isAssignedToMe = String(token.staffId || '').trim() === String(staffId).trim();
                                  const isUnassigned = !token.staffId || token.staffId === 'null';
                                  
                                  return (
                                    <div key={token.tokenId} className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-xl hover:shadow-md hover:border-navy-500 transition-all group">
                                      <div className="flex items-center gap-3 min-w-0 flex-1">
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 ${
                                          activeView === 'completed' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                                          activeView === 'campaign' ? 'bg-slate-100 text-navy-700 border border-slate-200' :
                                          'bg-slate-100 text-navy-700 border border-slate-200'
                                        }`}>
                                          {shortenTokenId(token.tokenId)}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                          <div className="flex items-center gap-2 mb-0.5">
                                            <h4 className="font-bold text-slate-900 text-sm truncate">{token.customerName || 'Customer'}</h4>
                                            <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider ${getStatusBadgeColor(token.status)}`}>
                                              {token.status?.replace('-', ' ')}
                                            </span>
                                            {isAssignedToMe && activeView === 'active' && <span className="bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded text-xs font-bold">Mine</span>}
                                          </div>
                                          <p className="text-xs text-slate-500 truncate flex items-center gap-2">
                                            <span className="font-medium text-slate-700">{getCategoryName(token.categoryId)}</span>
                                            <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                                            <span>{formatTime(token.createdAt)}</span>
                                            {token.phone && <><span className="w-1 h-1 bg-slate-300 rounded-full"></span><span>{token.phone}</span></>}
                                          </p>
                                        </div>
                                      </div>
                                      
                                      <div className="flex items-center gap-2 pl-3 shrink-0">
                                        {(activeView === 'active' || activeView === 'campaign') && (token.status === 'pending' || token.status === 'in-progress') && (isAssignedToMe || isUnassigned) && (
                                          <>
                                            <button 
                                              onClick={() => handleStartService(token.tokenId, token.staffId, token.status)} 
                                              className="px-3 py-2 min-h-[40px] bg-navy-700 text-white rounded-xl hover:bg-navy-800 flex items-center gap-1.5 text-xs font-semibold shadow-sm transition-colors"
                                            >
                                              <FiPlayCircle className="h-3.5 w-3.5" /> {token.status === 'pending' ? 'Start' : 'Resume'}
                                            </button>
                                            <button 
                                              onClick={() => openCancelModal(token)} 
                                              className="p-2.5 text-slate-500 hover:bg-rose-50 hover:text-rose-600 rounded-xl transition-colors"
                                              title="Cancel Token"
                                              aria-label={`Cancel token ${token.tokenId}`}
                                            >
                                              <FiXCircle className="h-4 w-4" />
                                            </button>
                                          </>
                                        )}
                                        {(activeView === 'completed' || (activeView === 'campaign' && token.status === 'completed')) && (
                                          <button onClick={() => handleViewDetails(token.tokenId, token.trackingId)} className="px-3 py-2 min-h-[40px] bg-white border border-slate-300 text-slate-700 rounded-xl hover:bg-slate-50 flex items-center gap-1.5 text-xs font-semibold shadow-sm transition-colors">
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
                        <div className="text-center py-16 text-slate-500">
                          <FiGlobe className="mx-auto h-12 w-12 mb-3 opacity-30"/>
                          <p className="font-medium">No pending online bookings</p>
                        </div>
                      ) : (
                        onlineBookings.map(booking => (
                          <div key={booking.id} className="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-xl hover:shadow-md transition-all group">
                            <div className="flex items-center gap-4 min-w-0">
                              <div className="w-10 h-10 bg-slate-100 text-navy-700 border border-slate-200 rounded-xl flex items-center justify-center font-bold text-sm shrink-0">#{booking.id}</div>
                              <div className="min-w-0">
                                <h4 className="font-bold text-slate-900 text-sm truncate">{booking.customer_name}</h4>
                                <p className="text-xs text-slate-500 mt-0.5 truncate">{getCategoryName(booking.service_id)} • {getSubcategoryName(booking.service_id, booking.subcategory_id)}</p>
                                <p className="text-xs text-slate-500 mt-1 font-mono">{new Date(booking.applied_at).toLocaleString()}</p>
                              </div>
                            </div>
                            <button onClick={() => handleTakeWork(booking.id)} className="px-4 py-2 min-h-[40px] bg-navy-700 text-white text-xs font-bold rounded-xl hover:bg-navy-800 shadow-sm shrink-0 transition-colors">
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
                        <div className="text-center py-16 text-slate-500">
                          <FiCheckSquare className="mx-auto h-12 w-12 mb-3 opacity-30"/>
                          <p className="font-medium">No active online work</p>
                        </div>
                      ) : (
                        processingBookings.map(booking => (
                          <div key={booking.id} className="flex items-center justify-between p-4 bg-white border border-emerald-100 rounded-xl hover:shadow-md transition-all group">
                            <div className="flex items-center gap-4 min-w-0">
                              <div className="w-10 h-10 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-xl flex items-center justify-center font-bold text-sm shrink-0">#{booking.id}</div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 mb-0.5">
                                  <h4 className="font-bold text-slate-900 text-sm truncate">{booking.customer_name}</h4>
                                  <span className="bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded text-xs font-bold uppercase tracking-wider">Assigned to you</span>
                                </div>
                                <p className="text-xs text-slate-500 truncate">{getCategoryName(booking.service_id)} • {getSubcategoryName(booking.service_id, booking.subcategory_id)}</p>
                                <p className="text-xs text-slate-500 mt-1 font-mono">Taken at: {new Date(booking.taken_at || booking.applied_at).toLocaleString()}</p>
                              </div>
                            </div>
                            <button onClick={() => handleStartOnlineService(booking)} className="px-4 py-2 min-h-[40px] bg-emerald-700 text-white text-xs font-bold rounded-xl hover:bg-emerald-800 shadow-sm shrink-0 flex items-center gap-1.5 transition-colors">
                              <FiPlayCircle className="h-4 w-4" /> Start
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                
                  {/* TAB 4: APPLICATIONS TRACKING */}
                  {workspaceTab === 'applications' && (
                    <div className="space-y-4">
                      
                      {/* Sub-Tabs for Applications */}
                      <div className="flex gap-2 border-b border-slate-200 pb-3">
                        {['active', 'completed', 'delayed'].map(tab => {
                          // Calculate counts based on global stats for the badges
                          let count = 0;
                          if (tab === 'active') count = (trackingStats.pending || 0) + (trackingStats.in_progress || 0);
                          if (tab === 'completed') count = (trackingStats.completed || 0);
                          if (tab === 'delayed') count = (trackingStats.delayed || 0);

                          return (
                            <button
                              key={tab}
                              aria-pressed={activeAppView === tab}
                              onClick={() => setActiveAppView(tab)}
                              className={`px-4 py-2 min-h-[40px] rounded-full text-xs font-bold capitalize transition-colors flex items-center gap-1.5 ${
                                activeAppView === tab ? 'bg-navy-800 text-white shadow-sm' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                              }`}
                            >
                              {tab}
                              <span className={`px-1.5 py-0.5 rounded-full text-xs ${activeAppView === tab ? 'bg-white/20' : 'bg-slate-200 text-slate-500'}`}>
                                {count}
                              </span>
                            </button>
                          )
                        })}
                      </div>

                      {/* Application List */}
                      <div className="space-y-3">
                        {filteredApplications.length === 0 ? (
                          <div className="text-center py-16 text-slate-500">
                            <FiTarget className="mx-auto h-12 w-12 mb-3 opacity-30"/>
                            <p className="font-medium">No {activeAppView} applications found</p>
                          </div>
                        ) : (
                          filteredApplications.map(app => (
                            <div key={app.id} className="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-xl hover:shadow-md transition-all group">
                              <div className="flex items-center gap-4 min-w-0">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 ${
                                  activeAppView === 'completed' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                                  activeAppView === 'delayed' ? 'bg-rose-50 text-rose-700 border border-rose-100' :
                                  'bg-slate-100 text-navy-700 border border-slate-200'
                                }`}>
                                  {app.application_number ? `#${app.application_number.slice(-4)}` : 'APP'}
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2 mb-0.5">
                                    <h4 className="font-bold text-slate-900 text-sm truncate">{app.customer_name}</h4>
                                    <span className={`px-1.5 py-0.5 rounded text-xs font-bold uppercase tracking-wider ${
                                      app.status === 'completed' || app.status === 'paid' ? 'bg-emerald-100 text-emerald-700' :
                                      app.status === 'in_progress' ? 'bg-slate-200 text-navy-700' :
                                      app.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                                      app.status === 'rejected' ? 'bg-rose-100 text-rose-700' :
                                      app.status === 'resubmit' ? 'bg-orange-100 text-orange-700' :
                                      'bg-slate-100 text-slate-700'
                                    }`}>
                                      {app.status?.replace('_', ' ')}
                                    </span>
                                    <span className="text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-bold">
                                      {app.progress}%
                                    </span>
                                  </div>
                                  <p className="text-xs text-slate-500 truncate flex items-center gap-2">
                                    <span className="font-medium">{app.service_name}</span>
                                    <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                                    <span>{app.current_step || 'Submitted'}</span>
                                  </p>
                                  <p className="text-xs text-slate-500 mt-1 font-mono">
                                    Last updated: {new Date(app.updated_at).toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })}
                                  </p>
                                </div>
                              </div>
                              <button 
                                onClick={() => navigate(`/dashboard/staff/track_service/${app.id}`)} 
                                className="px-4 py-2 min-h-[40px] bg-white border border-slate-300 text-slate-700 text-xs font-bold rounded-xl hover:bg-slate-50 shadow-sm shrink-0 flex items-center gap-1.5 transition-colors"
                              >
                                <FiBarChart2 className="h-4 w-4" /> Track
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>


              </div>

              <div className="mt-6">
              {/* ===== STEP 3: PERFORMANCE DETAILS ROW ===== */}
              <div id="perf-details" role="region" aria-label="Performance details" className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-6 items-start scroll-mt-20">

                {/* 3a: MONTHLY & DAILY TARGET METER */}
                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                  <h3 className="font-semibold text-slate-900 text-sm flex items-center mb-4">
                    <FiTarget className="h-4 w-4 mr-2 text-navy-700" />
                    Target (+10% Growth)
                  </h3>
              
                  {performanceLoading ? (
                    <div className="h-24 bg-slate-200 animate-pulse rounded"></div>
                  ) : (
                    <div>
                      {/* --- MONTHLY PROGRESS --- */}
                      <div className="flex justify-between items-end mb-2">
                        <div>
                          <p className="text-xs text-slate-500 font-medium">Month Achieved</p>
                          <p className="text-xl font-black text-slate-900">
                            {formatCurrency(performance.currentAchieved)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-slate-500 font-medium">Month Target</p>
                          <p className="text-lg font-bold text-slate-900">
                            {formatCurrency(performance.monthlyTarget)}
                          </p>
                        </div>
                      </div>
                  
                      <div role="progressbar" aria-label="Monthly target progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(Math.min(performance.targetProgress, 100))} className="w-full bg-slate-100 rounded-full h-3 mb-1 overflow-hidden shadow-inner">
                        <div 
                          className={`h-full rounded-full transition-all duration-1000 ${
                            performance.targetProgress >= 100 ? 'bg-emerald-500' :
                            performance.targetProgress >= 50 ? 'bg-amber-400' : 
                            'bg-rose-500'
                          }`}
                          style={{ width: `${Math.min(performance.targetProgress, 100)}%` }}
                        ></div>
                      </div>
                      <p className="text-xs font-bold text-slate-500 text-right mb-4">
                        {performance.targetProgress.toFixed(1)}% Completed
                      </p>

                      <div className="border-t border-slate-100 mb-4"></div>

                      {/* --- DAILY PROGRESS --- */}
                      <div className="bg-slate-100/50 rounded-xl p-3 border border-slate-100">
                        <div className="flex justify-between items-center mb-2">
                          <h4 className="text-xs font-bold text-navy-800 flex items-center gap-1.5">
                            <FiActivity className="h-3 w-3 text-navy-700" />
                            Today's Goal
                          </h4>
                          <span className="text-xs font-bold text-navy-700">
                            {formatCurrency(performance.todayAchieved)} / {formatCurrency(performance.dailyTarget)}
                          </span>
                        </div>
                    
                        <div className="w-full bg-slate-200/50 rounded-full h-2 overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all duration-1000 ${
                              performance.todayAchieved >= performance.dailyTarget ? 'bg-emerald-500' : 'bg-navy-500'
                            }`}
                            style={{ 
                              width: `${Math.min(performance.dailyTarget > 0 ? (performance.todayAchieved / performance.dailyTarget) * 100 : 0, 100)}%` 
                            }}
                          ></div>
                        </div>
                        {performance.todayAchieved >= performance.dailyTarget && performance.dailyTarget > 0 && (
                           <p className="text-xs font-bold text-emerald-700 mt-1.5 flex items-center gap-1">
                             <FiCheckCircle className="h-3 w-3" /> Daily target met!
                           </p>
                        )}
                      </div>
                      {/* --- PREVIOUS MONTHS --- */}
                      {targetHistory.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-slate-100">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="text-xs font-bold text-slate-700">Previous months</h4>
                            {targetStreak >= 2 && (
                              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                                🔥 {targetStreak} months in a row
                              </span>
                            )}
                          </div>

                          <div className="flex gap-2 overflow-x-auto pb-1">
                            {[...targetHistory].reverse().map((h) => {
                              const met = h.percent >= 100;
                              return (
                                <div
                                  key={h.month}
                                  title={`Target ${formatCurrency(h.target)} · Achieved ${formatCurrency(h.achieved)}`}
                                  className={`flex-shrink-0 rounded-xl px-2.5 py-1.5 text-center border ${
                                    met ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                                        : 'bg-rose-50 border-rose-200 text-rose-700'
                                  }`}
                                >
                                  <p className="text-xs font-medium">
                                    {new Date(h.month).toLocaleString('en-IN', { month: 'short' })}
                                  </p>
                                  <p className="text-xs font-bold">
                                    {met ? '✓' : '✗'} {Math.round(h.percent || 0)}%
                                  </p>
                                </div>
                              );
                            })}
                          </div>

                          {lastMonth && (
                            <p className="text-xs text-slate-500 mt-2">
                              Last month:{' '}
                              {lastMonth.percent >= 100
                                ? <span className="font-semibold text-emerald-700">target achieved 🎉</span>
                                : <span className="font-semibold text-rose-600">
                                    {formatCurrency(Math.max(lastMonth.target - lastMonth.achieved, 0))} short of target
                                  </span>}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* 3b: PERFORMANCE SCORE CARD */}
                <div className="bg-white rounded-2xl border border-slate-200 p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-slate-900 text-sm flex items-center">
                      <FiTarget className="h-4 w-4 mr-2 text-navy-700" />
                      Performance Score
                    </h3>
                    <div className="relative group" tabIndex={0} aria-label="How the score is calculated: collection rate 50%, revenue efficiency 30%, consistency 20%">
                      <FiInfo className="h-4 w-4 text-slate-500 cursor-pointer" />
                      <div className="absolute bottom-full right-0 mb-2 hidden group-hover:block group-focus-within:block w-64 p-2 bg-slate-900 text-white text-xs rounded-xl z-10">
                        Score based on collection rate (50%), revenue efficiency (30%), and consistency (20%)
                      </div>
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="relative inline-block">
                      <svg className="w-32 h-32" role="img" aria-label={`Performance score ${performanceLoading ? 0 : performance.incentiveScore} percent`}>
                        <circle className="text-slate-200" strokeWidth="12" stroke="currentColor" fill="transparent" r="54" cx="64" cy="64" />
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
                        <p className="text-2xl font-bold text-slate-900">{performanceLoading ? '...' : `${performance.incentiveScore}%`}</p>
                        <p className="text-xs text-slate-500">
                          {!performanceLoading && (performance.incentiveScore >= 80 ? 'Excellent' : performance.incentiveScore >= 60 ? 'Good' : performance.incentiveScore >= 40 ? 'Average' : 'Needs Improvement')}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 3c: PERFORMANCE METRICS */}
                <div className="bg-white rounded-2xl border border-slate-200 p-5">
                  <h3 className="font-semibold text-slate-900 text-sm flex items-center mb-4">
                    <FiActivity className="h-4 w-4 mr-2 text-navy-700" />
                    Performance Metrics
                  </h3>
                  {performanceLoading ? (
                    <div className="space-y-3">
                      <div className="h-8 bg-slate-200 animate-pulse rounded"></div>
                      <div className="h-8 bg-slate-200 animate-pulse rounded"></div>
                      <div className="h-8 bg-slate-200 animate-pulse rounded"></div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div>
                        <div className="flex justify-between mb-1 text-sm">
                          <span className="text-slate-600">Completion Rate</span>
                          <span className="font-medium text-slate-900">{performance.completionRate}%</span>
                        </div>
                        <div role="progressbar" aria-label="Completion rate" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Number(performance.completionRate) || 0} className="w-full bg-slate-200 rounded-full h-2">
                          <div className="bg-emerald-600 h-2 rounded-full" style={{ width: `${performance.completionRate}%` }} />
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between mb-1 text-sm">
                          <span className="text-slate-600">Avg Transaction Value</span>
                          <span className="font-medium text-slate-900">{formatCurrency(performance.avgTransactionValue)}</span>
                        </div>
                        <div className="w-full bg-slate-200 rounded-full h-2">
                          <div
                            className="bg-navy-700 h-2 rounded-full"
                            style={{ width: `${Math.min((performance.avgTransactionValue / 1000) * 100, 100)}%` }}
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between mb-1 text-sm">
                          <span className="text-slate-600">Customer Satisfaction</span>
                          <span className="font-medium text-slate-900">{performance.customerSatisfaction}</span>
                        </div>
                        <div className="w-full bg-slate-200 rounded-full h-2">
                          <div
                            className="bg-navy-700 h-2 rounded-full"
                            style={{ width: `${(performance.avgRating / 5) * 100}%` }}
                          />
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-100">
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-600">Collection Rate</span>
                          <span className="font-medium text-slate-900">{performance.collectionRate}%</span>
                        </div>
                        <div className="flex justify-between text-sm mt-2">
                          <span className="text-slate-600">Total Revenue</span>
                          <span className="font-medium text-slate-900">{formatCurrency(performance.totalCollected)}</span>
                        </div>
                        <div className="flex justify-between text-sm mt-2">
                          <span className="text-slate-600">Total Services</span>
                          <span className="font-medium text-slate-900">{performance.totalServices}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              </div>
            </div>

            {/* My day panel – target, tasks, attendance & wallet, calendar */}
            <aside aria-label="My day" className="w-full xl:w-[340px] xl:shrink-0 xl:order-first space-y-6">
              {/* ===== TARGET (summary) ===== */}
              <div
                onClick={scrollToPerf}
                role="button"
                tabIndex={0}
                aria-label="Monthly target. Press to jump to target details"
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); scrollToPerf(); } }}
                className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm cursor-pointer hover:border-navy-500 transition-colors"
              >
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-semibold text-slate-600 flex items-center">
                    <FiTarget className="h-3.5 w-3.5 mr-1.5 text-navy-700" />
                    Target (+10% Growth)
                  </p>
                  {!performanceLoading && performance.monthlyTarget > 0 && (
                    <span className={`text-xs font-bold ${performance.targetProgress >= 100 ? 'text-emerald-700' : 'text-slate-700'}`}>
                      {performance.targetProgress.toFixed(0)}%
                    </span>
                  )}
                </div>

                {performanceLoading ? (
                  <div className="h-14 bg-slate-200 animate-pulse rounded" />
                ) : performance.monthlyTarget > 0 ? (
                  <>
                    <div className="flex justify-between items-baseline text-sm mb-1">
                      <span className="font-black text-slate-900">{formatCurrency(performance.currentAchieved)}</span>
                      <span className="text-xs text-slate-500">of {formatCurrency(performance.monthlyTarget)}</span>
                    </div>
                    <div role="progressbar" aria-label="Monthly target progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(Math.min(performance.targetProgress, 100))} className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                      <div className={`h-full rounded-full ${barColor(performance.targetProgress)}`}
                           style={{ width: `${Math.min(performance.targetProgress, 100)}%` }} />
                    </div>

                    <div className="flex justify-between text-xs text-slate-500 mt-2.5 mb-1">
                      <span>Today's goal</span>
                      <span className={performance.dailyTarget > 0 && performance.todayAchieved >= performance.dailyTarget ? 'font-bold text-emerald-700' : ''}>
                        {formatCurrency(performance.todayAchieved)} / {formatCurrency(performance.dailyTarget)}
                      </span>
                    </div>
                    <div role="progressbar" aria-label="Today goal progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(Math.min(performance.dailyTarget > 0 ? (performance.todayAchieved / performance.dailyTarget) * 100 : 0, 100))} className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${performance.dailyTarget > 0 && performance.todayAchieved >= performance.dailyTarget ? 'bg-emerald-500' : 'bg-navy-500'}`}
                        style={{ width: `${Math.min(performance.dailyTarget > 0 ? (performance.todayAchieved / performance.dailyTarget) * 100 : 0, 100)}%` }}
                      />
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-slate-500 py-3">No target set for this month yet</p>
                )}
              </div>



              {/* ===== MY TASKS ===== */}
              <div role="region" aria-label="My pending tasks" className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-slate-900 text-sm flex items-center">
                    <FiCheckSquare className="h-4 w-4 mr-2 text-navy-700" />
                    My Pending Tasks
                  </h3>
                  <span className="bg-slate-200 text-navy-800 text-xs font-bold px-2 py-0.5 rounded-full">
                    {myTasks.length}
                  </span>
                </div>
                
                {myTasks.length === 0 ? (
                  <div className="text-center py-4 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                    <p className="text-sm text-slate-500">No pending tasks! 🎉</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                    {myTasks.map(task => (
                      <div key={task.id} className="flex gap-3 items-start p-3 border border-slate-100 rounded-xl bg-slate-50 hover:bg-white transition shadow-sm">
                        <button 
                          onClick={() => handleCompleteTask(task.id)}
                          className="mt-0.5 p-1 text-slate-500 hover:text-emerald-700 transition-colors"
                          title="Mark as complete"
                          aria-label={`Mark task complete: ${task.title}`}
                        >
                          <FiCheckCircle className="h-5 w-5" />
                        </button>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-slate-800">{task.title}</p>
                          {task.due_date && (
                            <p className="text-xs text-rose-600 mt-1 flex items-center gap-1 font-medium">
                              <FiClock className="h-3 w-3" /> Due {getEventDayLabel(task.due_date)}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* ===== MY DAY: ATTENDANCE & WALLET ===== */}
              <div role="region" aria-label="My wallet" className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                <h3 className="font-semibold text-slate-900 text-sm flex items-center mb-3">
                  <FiDollarSign className="h-4 w-4 mr-2 text-navy-700" />
                  My wallet
                </h3>
                <dl className="divide-y divide-slate-100 text-sm">
                  <div className="flex justify-between py-2">
                    <dt className="text-slate-600">{myWallet ? myWallet.name : 'My wallet'}</dt>
                    <dd className="font-semibold text-slate-900">{myWallet ? formatCurrency(myWallet.balance) : 'Not assigned'}</dd>
                  </div>
                </dl>
              </div>

              {/* ===== UPCOMING EVENTS (AUTO-CYCLING) ===== */}
              <div 
                role="region"
                aria-label="Upcoming calendar"
                className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm"
                onMouseEnter={() => setIsEventsHovered(true)}
                onMouseLeave={() => setIsEventsHovered(false)}
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-slate-900 text-sm flex items-center">
                    <FiCalendar className="h-4 w-4 mr-2 text-navy-700" />
                    Upcoming Calendar
                  </h3>
                  <span className="text-xs uppercase font-bold tracking-wider text-slate-500 flex items-center gap-1">
                    {isEventsHovered ? <FiClock className="text-amber-500" /> : <FiPlayCircle className="text-emerald-500 animate-pulse" />}
                    {isEventsHovered ? 'Paused' : 'Auto'}
                  </span>
                </div>

                {/* Event Tabs */}
                <div className="flex gap-2 mb-4 overflow-x-auto hide-scrollbar pb-1">
                  {['All', 'Tasks', 'Deliveries', 'Expiries', 'Days'].map(tab => {
                    const count = upcomingEvents.filter(e => {
                      const displayKey = e.event_type || e.type;
                      if (tab === 'All') return true;
                      if (tab === 'Tasks') return e.source === 'task' || displayKey === 'task' || displayKey === 'deadline';
                      if (tab === 'Deliveries') return e.source === 'service_delivery';
                      if (tab === 'Expiries') return e.source === 'service_expiry';
                      if (tab === 'Days') return ['working', 'holiday', 'weekend'].includes(displayKey);
                      return false;
                    }).length;

                    return (
                      <button
                        key={tab}
                        aria-pressed={activeEventTab === tab}
                        onClick={() => setActiveEventTab(tab)}
                        className={`text-xs px-3 py-2 min-h-[40px] rounded-full font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                          activeEventTab === tab 
                            ? 'bg-navy-700 text-white shadow-md' 
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {tab} 
                        <span className={`px-1.5 py-0.5 rounded-full text-xs ${activeEventTab === tab ? 'bg-white/20' : 'bg-slate-200'}`}>
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
                      const displayKey = e.event_type || e.type;
                      if (activeEventTab === 'All') return true;
                      if (activeEventTab === 'Tasks') return e.source === 'task' || displayKey === 'task' || displayKey === 'deadline';
                      if (activeEventTab === 'Deliveries') return e.source === 'service_delivery';
                      if (activeEventTab === 'Expiries') return e.source === 'service_expiry';
                      if (activeEventTab === 'Days') return ['working', 'holiday', 'weekend'].includes(displayKey);
                      return false;
                    });

                    if (filteredEvents.length === 0) {
                      return (
                        <div className="text-center py-6 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                          <p className="text-sm text-slate-500">No {activeEventTab.toLowerCase()} scheduled.</p>
                        </div>
                      );
                    }

                    return filteredEvents.map(event => {
                      const dayLabel = getEventDayLabel(event.date || event.start_datetime);
                      const isToday = dayLabel === 'Today';
                      const isTomorrow = dayLabel === 'Tomorrow';
                      
                      const displayKey = event.event_type || event.type;
                      
                      let Icon = FiCalendar;
                      let typeColor = 'text-navy-700 bg-slate-100 border-slate-200';
                      let badgeLabel = 'Event';
                      
                      if (event.source === 'service_delivery') {
                        Icon = FiBriefcase;
                        typeColor = 'text-navy-700 bg-slate-100 border-slate-200';
                        badgeLabel = 'Delivery';
                      } else if (event.source === 'service_expiry') {
                        Icon = FiAlertCircle;
                        typeColor = 'text-rose-600 bg-rose-50 border-rose-100';
                        badgeLabel = 'Expiry';
                      } else if (event.source === 'task' || displayKey === 'task' || displayKey === 'deadline') {
                        Icon = FiCheckSquare;
                        typeColor = 'text-emerald-700 bg-emerald-50 border-emerald-100';
                        badgeLabel = 'Task';
                      } else if (displayKey === 'working' || displayKey === 'start') {
                        Icon = FiBriefcase;
                        typeColor = 'text-emerald-700 bg-emerald-50 border-emerald-100';
                        badgeLabel = displayKey === 'working' ? 'Working Day' : 'Start';
                      } else if (displayKey === 'holiday') {
                        Icon = FiStar;
                        typeColor = 'text-rose-600 bg-rose-50 border-rose-100';
                        badgeLabel = 'Holiday';
                      } else if (displayKey === 'weekend') {
                        Icon = FiClock; 
                        typeColor = 'text-slate-600 bg-slate-50 border-slate-200';
                        badgeLabel = 'Weekend';
                      } else if (displayKey === 'announcement') {
                        Icon = FiInfo;
                        typeColor = 'text-navy-700 bg-slate-100 border-slate-200';
                        badgeLabel = 'Announcement';
                      }

                      return (
                        <div key={event.id} className={`flex items-start gap-3 p-3 rounded-xl border ${typeColor} shadow-sm transition-all hover:shadow-md group`}>
                          <div className={`mt-0.5 p-1.5 rounded-md bg-white shadow-sm shrink-0`}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-slate-900 truncate" title={event.title}>{event.title}</p>
                            {event.description && <p className="text-xs text-slate-600 truncate mt-0.5">{event.description}</p>}
                            <div className="flex items-center justify-between mt-1.5">
                              <p className="text-xs font-medium flex items-center gap-1">
                                <FiClock className="h-3 w-3" />
                                <span className={`${isToday ? 'text-rose-600 font-bold' : isTomorrow ? 'text-amber-700 font-bold' : 'text-slate-600'}`}>
                                  {dayLabel}
                                </span>
                              </p>
                              <span className="text-xs uppercase tracking-wider font-bold opacity-70">
                                {badgeLabel}
                              </span>
                            </div>
                          </div>
                          
                          <div className="shrink-0 flex flex-col items-center justify-center self-stretch ml-1">
                            <button
                              onClick={() => handleViewService(event)}
                              className="p-2 bg-white/60 hover:bg-white rounded-full shadow-sm text-slate-500 hover:text-navy-700 transition-all border border-black/5 opacity-80 hover:opacity-100"
                              title="Go to Service Tracking"
                              aria-label={`Open ${event.title} in service tracking`}
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
            </aside>

            {/* Right rail – recent activity */}
            <div className="w-full 2xl:w-[340px] 2xl:shrink-0 order-last">
              {/* Recent Activity (Compact Version) */}
              <div role="region" aria-label="Recent activity" className="bg-white rounded-2xl border border-slate-200">
                <div className="px-5 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900">Recent Activity</h3>
                  <span className="text-xs font-medium text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded-full shadow-sm">
                    {recentServiceEntries.length} items
                  </span>
                </div>
                <div className="p-4 overflow-y-auto max-h-[500px]">
                  {Object.keys(groupedRecentActivities).length > 0 ? (
                    <div className="space-y-6">
                      {Object.entries(groupedRecentActivities).map(([date, entries]) => (
                        <div key={date} className="relative">
                          
                          {/* Compact Date Sticky Header */}
                          <div className="flex items-center gap-2 mb-3 sticky top-0 bg-white/95 backdrop-blur-sm py-1.5 z-20 -mx-1 px-1">
                            <div className="p-1 bg-slate-100 rounded text-slate-500">
                              <FiCalendar className="h-3 w-3" />
                            </div>
                            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-widest">
                              {formatDateUI(date)}
                            </h4>
                            <div className="h-px bg-slate-200 flex-1 ml-1"></div>
                          </div>

                          {/* Compact Timeline Entries */}
                          <div className="space-y-2.5 relative">
                            {entries.map((entry, index) => (
                              <div key={entry.id} className="group relative flex gap-3">
                                {index !== entries.length - 1 && (
                                  <div className="absolute left-[15px] top-8 bottom-[-10px] w-[2px] bg-slate-100 group-hover:bg-slate-200 transition-colors"></div>
                                )}
                                
                                <div className="w-8 h-8 mt-1 bg-slate-100 border border-slate-200 rounded-full flex items-center justify-center shrink-0 z-10 transition-transform group-hover:scale-110">
                                  <FiUser className="h-3.5 w-3.5 text-navy-700" />
                                </div>

                                <div className="flex-1 bg-white border border-slate-100 rounded-xl p-3 shadow-sm hover:shadow-md transition-all group-hover:border-slate-300 flex flex-col justify-center">
                                  
                                  <div className="flex justify-between items-center mb-1.5 gap-2">
                                    <div className="flex items-center gap-2 min-w-0">
                                      <p className="text-sm font-bold text-slate-900 truncate">{entry.customerName || 'Customer'}</p>
                                      
                                      <span className={`px-1.5 py-0.5 rounded text-xs font-bold uppercase tracking-wider shrink-0 ${
                                        entry.status === 'completed' ? 'bg-emerald-50 text-emerald-700' :
                                        entry.status === 'in-progress' ? 'bg-slate-100 text-navy-700' :
                                        entry.status === 'pending' ? 'bg-amber-50 text-amber-700' : 
                                        'bg-slate-50 text-slate-700'
                                      }`}>
                                        {entry.status?.replace('-', ' ')}
                                      </span>
                                    </div>
                                    
                                    <span className="text-xs font-medium text-slate-500 shrink-0">
                                      {formatTime(entry.created_at)}
                                    </span>
                                  </div>
                                  
                                  <div className="flex justify-between items-end gap-2">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <p className="text-xs font-medium text-slate-600 truncate max-w-[160px]">
                                        {getCategoryName(entry.category)}
                                      </p>
                                      
                                      {entry.tokenId && (
                                        <span className="text-xs text-slate-500 font-mono font-bold before:content-['•'] before:mr-1.5">
                                          {shortenTokenId(entry.tokenId)}
                                        </span>
                                      )}
                                      
                                      {entry.workSource === 'online' && (
                                        <span className="text-xs text-navy-700 font-bold uppercase border border-slate-200 bg-slate-100 px-1 rounded flex items-center gap-0.5 ml-1">
                                          <FiGlobe className="h-2 w-2" /> Online
                                        </span>
                                      )}
                                      {entry.is_edited && (
                                        <span className="text-xs text-slate-500 font-bold uppercase border border-slate-200 bg-slate-50 px-1 rounded ml-1">
                                          Edited
                                        </span>
                                      )}
                                    </div>
                                    
                                    {(entry.tokenId || entry.tracking_id) && (
                                      <button 
                                        onClick={() => handleViewDetails(entry.tokenId, entry.tracking_id)}
                                        className="text-xs font-bold text-navy-700 bg-slate-100 hover:bg-slate-200 px-3 py-2 min-h-[36px] rounded-lg transition-colors shrink-0 flex items-center gap-1"
                                      >
                                        Details <FiChevronRight className="h-3 w-3" />
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
                    <div className="flex flex-col items-center justify-center py-10 text-slate-500">
                      <FiActivity className="h-8 w-8 mb-2 opacity-20" />
                      <p className="text-sm font-medium">No recent activity</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

        </motion.div>
      </main>
      {/* Cancel Modal */}
        {showCancelModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-800/50 backdrop-blur-sm p-4">
            <div role="dialog" aria-modal="true" aria-label="Cancel token" className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
              <h3 className="text-xl font-semibold text-slate-900 mb-2">Cancel Token</h3>
              <p className="text-slate-600 mb-4">
                Are you sure you want to cancel token <span className="font-mono font-bold">{cancelTokenData?.tokenId}</span> for <span className="font-medium">{cancelTokenData?.customerName}</span>?
              </p>
              <div className="mb-4">
                <label htmlFor="cancel-reason" className="block text-sm font-medium text-slate-700 mb-1">Reason (optional)</label>
                <textarea 
                  id="cancel-reason"
                  value={cancelReason} 
                  onChange={(e) => setCancelReason(e.target.value)} 
                  rows="3" 
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-navy-500/30 focus:border-navy-500" 
                  placeholder="e.g., customer requested, duplicate entry..." 
                />
              </div>
              <div className="flex gap-3 justify-end">
                <button 
                  onClick={() => setShowCancelModal(false)} 
                  className="px-4 py-2 text-slate-700 bg-slate-100 rounded-xl hover:bg-slate-200 transition"
                >
                  No, Keep Token
                </button>
                <button 
                  onClick={handleCancelConfirm} 
                  disabled={cancelling} 
                  className="px-4 py-2 bg-rose-600 text-white rounded-xl hover:bg-rose-700 transition disabled:opacity-50"
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