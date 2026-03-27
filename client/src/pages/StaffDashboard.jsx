import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { 
  FiUsers, 
  FiClock, 
  FiCheckCircle, 
  FiPlayCircle, 
  FiPlus, 
  FiFilter, 
  FiSearch, 
  FiAlertCircle, 
  FiRefreshCw,
  FiCalendar,
  FiChevronRight,
  FiBarChart2,
  FiTrendingUp,
  FiTrendingDown,
  FiMoreHorizontal,
  FiUser,
  FiAward,
  FiXCircle,
  FiCheckSquare,
  FiTag
} from 'react-icons/fi';
import io from 'socket.io-client';
import { getCategories, getTokens, getServiceEntries } from '/src/services/serviceService';
import { getWalletsForCentre } from '@/services/walletService';
import QuickServiceModal from '@/components/QuickServiceModal';
import api from '@/services/serviceService';

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
  const [activeView, setActiveView] = useState('active'); // 'active', 'completed', or 'campaign'
  const staffId = localStorage.getItem('id')?.trim();
  const centreId = localStorage.getItem('centre_id')?.trim();
  const [showQuickService, setShowQuickService] = useState(false);
  const [wallets, setWallets] = useState([]);
  const [onlineBookings, setOnlineBookings] = useState([]);
  const [processingBookings, setProcessingBookings] = useState([]);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [socket, setSocket] = useState(null);

  // Initialize socket connection with token
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      console.error('No token found for socket connection');
      return;
    }

    const newSocket = io('${import.meta.env.VITE_API_URL}', {
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      auth: {
        token: token
      },
      transports: ['websocket', 'polling']
    });

    newSocket.on('connect', () => {
      console.log('Socket connected successfully');
      // Join centre room after connection
      if (centreId) {
        newSocket.emit('joinCentre', centreId);
        console.log('Joined centre room:', centreId);
      }
    });

    newSocket.on('connect_error', (error) => {
      console.error('Socket connection error:', error.message);
      if (error.message === 'Socket authentication failed') {
        toast.error('Session expired. Please login again.');
        // Optionally redirect to login
        // navigate('/login');
      }
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [centreId, navigate]);

  // Refresh tokens function
  const refreshTokens = useCallback(async () => {
    try {
      console.log('StaffDashboard: Refreshing tokens...');
      const tokensRes = await getTokens(centreId, 'all');
      setTokens(tokensRes.data || []);
      setLastUpdated(new Date());
      console.log('StaffDashboard: Tokens refreshed:', tokensRes.data);
    } catch (err) {
      console.error('Error refreshing tokens:', err);
    }
  }, [centreId]);

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
      } else {
        console.warn('No staff_id in entries, using all entries as fallback');
      }

      const sortedEntries = staffEntries.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      setRecentServiceEntries(sortedEntries.slice(0, 5));
      
      return sortedEntries;
    } catch (err) {
      console.error('Error fetching service entries:', err.response?.data || err.message);
      return [];
    }
  }, [staffId]);

  const fetchOnlineBookings = useCallback(async () => {
    try {
      const pendingRes = await api.get('/customer-services', {
        params: { status: 'under_review' }
      });

      const processingRes = await api.get('/customer-services', {
        params: { status: 'processing', staff_id: staffId }
      });

      // Get all service entries for online bookings to check which ones already have entries
      const serviceEntriesRes = await getServiceEntries();
      
      // Create a Set of customer_service_ids that already have service entries
      const processedBookingIds = new Set();
      serviceEntriesRes.data.forEach(entry => {
        if (entry.customer_service_id) {
          processedBookingIds.add(entry.customer_service_id.toString());
        }
      });

      // Filter out processing bookings that already have service entries
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

  // Load wallets
  useEffect(() => {
      getWalletsForCentre()
      .then(setWallets)
      .catch(() => toast.error('Failed to load wallets'));
  }, []);

  // Initial data fetch
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        if (!staffId || !centreId) {
          throw new Error('Staff ID or Centre ID missing. Please log in again.');
        }

        const categoriesRes = await getCategories();
        setCategories(categoriesRes.data || []);

        await refreshTokens();
        await fetchServiceEntries();
        await fetchOnlineBookings();
      } catch (err) {
        console.error('Error fetching data:', err.response?.data || err.message);
        setError('Failed to load dashboard data: ' + (err.response?.data?.error || err.message));
        toast.error('Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [staffId, centreId, refreshTokens, fetchServiceEntries, fetchOnlineBookings]);

  // Socket event listeners
  useEffect(() => {
    if (!socket) return;

    // Listen for token updates (general)
    socket.on('tokenUpdate', (data) => {
      console.log('StaffDashboard: Received tokenUpdate:', data);
      
      setTokens(prev => {
        const updatedTokens = prev.map(token =>
          token.tokenId === data.tokenId ? { ...token, status: data.status } : token
        );
        console.log('StaffDashboard: Updated tokens:', updatedTokens);
        return updatedTokens;
      });
      
      // Also refresh to ensure consistency
      refreshTokens();
    });

    // Listen for centre-specific token updates
    socket.on(`tokenUpdate:${centreId}`, (data) => {
      console.log('StaffDashboard: Received centre-specific token update:', data);
      
      setTokens(prev => {
        const updatedTokens = prev.map(token =>
          token.tokenId === data.tokenId ? { ...token, status: data.status } : token
        );
        return updatedTokens;
      });
      
      refreshTokens();
    });

    // Listen for new tokens
    socket.on('newToken', (data) => {
      console.log('StaffDashboard: Received newToken:', data);
      toast.info(data.message || 'New token created');
      refreshTokens();
    });

    // Listen for token reassignments
    socket.on('tokenReassigned', (data) => {
      console.log('StaffDashboard: Received tokenReassigned:', data);
      toast.info(data.message || 'Token reassigned');
      refreshTokens();
    });

    // Listen for service entry creation
    socket.on('serviceEntryCreated', async (data) => {
      console.log('StaffDashboard: Received serviceEntryCreated:', data);
      const entryStaffId = String(data.staff_id || '').trim();
      if (!entryStaffId || entryStaffId === String(staffId).trim()) {
        await fetchServiceEntries();
        await fetchOnlineBookings();
        await refreshTokens(); // Refresh tokens to update status
      }
    });

    return () => {
      socket.off('tokenUpdate');
      socket.off(`tokenUpdate:${centreId}`);
      socket.off('newToken');
      socket.off('tokenReassigned');
      socket.off('serviceEntryCreated');
    };
  }, [socket, centreId, staffId, refreshTokens, fetchServiceEntries, fetchOnlineBookings]);

  const getCategoryName = (categoryId) => {
    const category = categories.find(cat => cat.id === categoryId);
    return category ? category.name : 'N/A';
  };

  const getSubcategoryName = (categoryId, subcategoryId) => {
    const category = categories.find(cat => cat.id === categoryId);
    const subcategory = category?.subcategories?.find(sub => sub.id === subcategoryId);
    return subcategory ? subcategory.name : 'N/A';
  };

  const shortenTokenId = (tokenId) => {
    if (!tokenId) return 'N/A';
    const parts = tokenId.split('-');
    return parts.length > 0 ? `#${parts[parts.length - 1]}` : tokenId;
  };

  const handleStartService = (tokenId) => {
    navigate(`/dashboard/staff/token/${tokenId}/service`);
  };

  const handleViewDetails = (tokenId) => {
    navigate(`/dashboard/staff/token/${tokenId}/details`);
  };

  // Get active tokens (pending and in-progress, both normal and campaign)
  const getActiveTokens = () => {
    return tokens.filter(token => {
      const tokenStaffId = String(token.staffId || '').trim();
      const localStaffId = String(staffId).trim();
      
      // Show tokens that are:
      // 1. Assigned to this staff OR
      // 2. Unassigned (available for anyone to take)
      // 3. NOT assigned to other staff
      const isAssignedToMe = tokenStaffId === localStaffId;
      const isUnassigned = !tokenStaffId || tokenStaffId === 'null' || tokenStaffId === '';
      
      // Only show pending and in-progress tokens (not completed)
      const isActive = token.status !== 'completed';
      
      return (isAssignedToMe || isUnassigned) && isActive;
    });
  };

  // Get completed tokens (only assigned to this staff)
  const getCompletedTokens = () => {
    return tokens.filter(token => {
      const tokenStaffId = String(token.staffId || '').trim();
      const localStaffId = String(staffId).trim();
      
      // Show only tokens assigned to this staff that are completed
      return tokenStaffId === localStaffId && token.status === 'completed';
    });
  };

  // Get campaign tokens (all campaign tokens assigned to this staff - any status)
  const getCampaignTokens = () => {
    return tokens.filter(token => {
      const tokenStaffId = String(token.staffId || '').trim();
      const localStaffId = String(staffId).trim();
      
      // Show campaign tokens assigned to this staff (any status)
      return tokenStaffId === localStaffId && token.type === 'campaign';
    });
  };

  const activeTokens = getActiveTokens();
  const completedTokens = getCompletedTokens();
  const campaignTokens = getCampaignTokens();

  // Filter tokens based on current view, search, and date
  const getFilteredTokens = () => {
    let sourceTokens = [];
    
    if (activeView === 'active') {
      sourceTokens = activeTokens;
    } else if (activeView === 'completed') {
      sourceTokens = completedTokens;
    } else if (activeView === 'campaign') {
      sourceTokens = campaignTokens;
    }
    
    return sourceTokens.filter(token => {
      const matchesSearch = token.customerName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           token.tokenId?.toString().includes(searchQuery) ||
                           token.phone?.includes(searchQuery);
      
      // Filter by date
      const tokenDate = new Date(token.createdAt).toDateString();
      const today = new Date().toDateString();
      const yesterday = new Date(Date.now() - 86400000).toDateString();
      const weekAgo = new Date(Date.now() - 604800000);
      
      const matchesDate = 
        activeDate === 'today' ? tokenDate === today :
        activeDate === 'yesterday' ? tokenDate === yesterday :
        activeDate === 'week' ? new Date(tokenDate) >= weekAgo :
        true;
      
      return matchesSearch && matchesDate;
    });
  };

  const filteredTokens = getFilteredTokens();

  // Group tokens by date
  const groupTokensByDate = (tokens) => {
    const grouped = {};
    
    tokens.forEach(token => {
      const date = new Date(token.createdAt).toDateString();
      if (!grouped[date]) {
        grouped[date] = [];
      }
      grouped[date].push(token);
    });

    return Object.entries(grouped)
      .sort(([dateA], [dateB]) => new Date(dateB) - new Date(dateA))
      .reduce((acc, [date, tokens]) => {
        acc[date] = tokens.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        return acc;
      }, {});
  };

  const groupedTokens = groupTokensByDate(filteredTokens);

  // Status counts
  const statusCounts = {
    pending: activeTokens.filter(t => t.status === 'pending').length,
    inProgress: activeTokens.filter(t => t.status === 'in-progress' || t.status === 'processing').length,
    completed: completedTokens.length,
    campaign: campaignTokens.length,
    total: activeTokens.length + completedTokens.length
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-US', { 
        weekday: 'short', 
        month: 'short', 
        day: 'numeric' 
      });
    }
  };

  // Calculate metrics
  const completionRate = statusCounts.total > 0 
    ? Math.round((statusCounts.completed / statusCounts.total) * 100) 
    : 0;

  const avgServiceTime = "24min"; // This would come from actual data
  const customerSatisfaction = "4.8/5"; // This would come from actual data

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
    // Immediately remove this booking from the processing list
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
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'in-progress':
      case 'processing':
        return 'bg-blue-100 text-blue-800';
      case 'pending':
        return 'bg-amber-100 text-amber-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status) => {
    switch(status) {
      case 'completed':
        return <FiCheckCircle className="h-4 w-4 text-green-500" />;
      case 'in-progress':
      case 'processing':
        return <FiPlayCircle className="h-4 w-4 text-blue-500" />;
      case 'pending':
        return <FiClock className="h-4 w-4 text-amber-500" />;
      case 'cancelled':
        return <FiXCircle className="h-4 w-4 text-red-500" />;
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-3 border-gray-900 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-lg p-8 max-w-md w-full border border-gray-200">
          <div className="text-center">
            <FiAlertCircle className="mx-auto h-12 w-12 text-red-500 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Data Loading Error</h3>
            <p className="text-gray-600 mb-6">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-3 bg-blue-700 text-white rounded-lg hover:bg-blue-800 transition-colors font-medium"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <ToastContainer position="top-right" autoClose={4000} />
      
      {/* Top Navigation */}
      <div className="bg-white border-b border-gray-200">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Service Dashboard</h1>
              <p className="text-gray-600 text-sm">Token management and service tracking</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-500">
                Last updated: {lastUpdated.toLocaleTimeString()}
              </span>
              <button
                onClick={refreshTokens}
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                title="Refresh"
              >
                <FiRefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="p-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="max-w-7xl mx-auto"
        >
          {/* Header Actions */}
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-6">
            <div className="flex items-center gap-4">
              <div className="relative">
                <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <input
                  type="text"
                  placeholder="Search tokens, customers, phone..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-4 py-2.5 w-80 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400 text-sm"
                />
              </div>
              
              <select 
                value={activeDate}
                onChange={(e) => setActiveDate(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400 text-sm"
              >
                <option value="today">Today</option>
                <option value="yesterday">Yesterday</option>
                <option value="week">This Week</option>
                <option value="all">All Time</option>
              </select>
            </div>
          </div>

          {/* Stats Overview */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-5 mb-6">
            <div className="bg-white rounded-lg border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-gray-600 uppercase tracking-wide">Total Tokens</h3>
                <FiUsers className="h-4 w-4 text-gray-400" />
              </div>
              <div className="flex items-baseline justify-between">
                <p className="text-2xl font-semibold text-gray-900">{statusCounts.total}</p>
                <div className="flex items-center text-green-600 text-sm">
                  <FiTrendingUp className="h-4 w-4 mr-1" />
                  <span>All time</span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-gray-600 uppercase tracking-wide">Pending</h3>
                <FiClock className="h-4 w-4 text-amber-500" />
              </div>
              <div className="flex items-baseline justify-between">
                <p className="text-2xl font-semibold text-gray-900">{statusCounts.pending}</p>
                <div className="flex items-center text-amber-600 text-sm">
                  <span>Waiting</span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-gray-600 uppercase tracking-wide">In Progress</h3>
                <FiPlayCircle className="h-4 w-4 text-blue-500" />
              </div>
              <div className="flex items-baseline justify-between">
                <p className="text-2xl font-semibold text-gray-900">{statusCounts.inProgress}</p>
                <div className="flex items-center text-blue-600 text-sm">
                  <span>Active</span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-gray-600 uppercase tracking-wide">Completed</h3>
                <FiCheckCircle className="h-4 w-4 text-green-500" />
              </div>
              <div className="flex items-baseline justify-between">
                <p className="text-2xl font-semibold text-gray-900">{statusCounts.completed}</p>
                <div className="flex items-center text-green-600 text-sm">
                  <span>{completionRate}% rate</span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-gray-600 uppercase tracking-wide">Campaign</h3>
                <FiAward className="h-4 w-4 text-purple-500" />
              </div>
              <div className="flex items-baseline justify-between">
                <p className="text-2xl font-semibold text-gray-900">{statusCounts.campaign}</p>
                <div className="flex items-center text-purple-600 text-sm">
                  <span>Special</span>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Service Card */}
          <motion.div
            whileHover={{ y: -2 }}
            onClick={() => setShowQuickService(true)}
            className="bg-white rounded-lg border border-gray-200 p-5 mb-6 hover:shadow-md transition-all cursor-pointer"
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-gray-600 uppercase tracking-wide">
                Quick Service
              </h3>
              <FiPlus className="h-4 w-4 text-gray-400" />
            </div>
            <p className="text-2xl font-semibold text-gray-900">+</p>
            <p className="text-sm text-gray-500">
              Money Transfer • Printing • PVC
            </p>
          </motion.div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {/* Main Content - Token Queue */}
            <div className="xl:col-span-2">
              {/* Online Customer Bookings */}
              <div className="bg-white rounded-lg border border-gray-200 mb-6">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h2 className="text-lg font-semibold text-gray-900">
                    Online Booking Queue
                  </h2>
                </div>

                <div className="p-6">
                  {onlineBookings.length === 0 ? (
                    <div className="text-center py-8">
                      <FiCalendar className="mx-auto h-8 w-8 text-gray-400 mb-2" />
                      <p className="text-gray-500 text-sm">No pending online bookings</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {onlineBookings.map((booking) => (
                        <motion.div
                          key={booking.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ duration: 0.3 }}
                          className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
                        >
                          <div className="flex items-center gap-4 flex-1">
                            <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center font-semibold text-indigo-800">
                              #{booking.id}
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-3 mb-1">
                                <h4 className="font-medium text-gray-900 truncate">
                                  {booking.customer_name}
                                </h4>
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                                  pending
                                </span>
                              </div>

                              <p className="text-sm text-gray-600 truncate">
                                {getCategoryName(booking.service_id)} • {getSubcategoryName(booking.service_id, booking.subcategory_id)}
                              </p>

                              <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
                                <span>
                                  {new Date(booking.applied_at).toLocaleTimeString([], {
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </span>
                                <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded">
                                  Online
                                </span>
                              </div>
                            </div>
                          </div>

                          <div>
                            <button
                              onClick={() => handleTakeWork(booking.id)}
                              className="px-4 py-2 bg-blue-700 text-white rounded-lg hover:bg-blue-800 transition-colors text-sm font-medium"
                            >
                              Take Work
                            </button>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* My Online Processing Work */}
              <div className="bg-white rounded-lg border border-gray-200 mb-6">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h2 className="text-lg font-semibold text-gray-900">
                    My Online Processing Work
                  </h2>
                </div>

                <div className="p-6">
                  {processingBookings.length === 0 ? (
                    <div className="text-center py-8">
                      <FiClock className="mx-auto h-8 w-8 text-gray-400 mb-2" />
                      <p className="text-gray-500 text-sm">No active online work</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {processingBookings.map((booking) => (
                        <motion.div
                          key={booking.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ duration: 0.3 }}
                          className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
                        >
                          <div className="flex items-center gap-4 flex-1">
                            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center font-semibold text-green-800">
                              #{booking.id}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-3 mb-1">
                                <h4 className="font-medium text-gray-900 truncate">
                                  {booking.customer_name}
                                </h4>
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                  processing
                                </span>
                              </div>
                              <p className="text-sm text-gray-600 truncate">
                                {getCategoryName(booking.service_id)} • {getSubcategoryName(booking.service_id, booking.subcategory_id)}
                              </p>
                              <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
                                <span>
                                  {new Date(booking.taken_at || booking.applied_at).toLocaleTimeString([], {
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </span>
                                <span className="bg-green-50 text-green-700 px-2 py-0.5 rounded">
                                  Assigned to you
                                </span>
                              </div>
                            </div>
                          </div>

                          <button
                            onClick={() => handleStartOnlineService(booking)}
                            className="px-4 py-2 bg-green-700 text-white rounded-lg hover:bg-green-800 transition-colors text-sm font-medium flex items-center gap-2"
                          >
                            <FiPlayCircle className="h-4 w-4" />
                            Start Service
                          </button>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* View Tabs - Moved below My Online Processing Work */}
              <div className="bg-white rounded-lg border border-gray-200 p-2 mb-6 inline-flex">
                <button
                  onClick={() => setActiveView('active')}
                  className={`px-6 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    activeView === 'active' 
                      ? 'bg-blue-700 text-white shadow-md' 
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <FiPlayCircle className="h-4 w-4" />
                    Active ({activeTokens.length})
                  </div>
                </button>
                <button
                  onClick={() => setActiveView('completed')}
                  className={`px-6 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    activeView === 'completed' 
                      ? 'bg-green-700 text-white shadow-md' 
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <FiCheckSquare className="h-4 w-4" />
                    Completed ({completedTokens.length})
                  </div>
                </button>
                <button
                  onClick={() => setActiveView('campaign')}
                  className={`px-6 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    activeView === 'campaign' 
                      ? 'bg-purple-700 text-white shadow-md' 
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <FiAward className="h-4 w-4" />
                    Campaign ({campaignTokens.length})
                  </div>
                </button>
              </div>

              {/* Service Queue - Active, Completed, or Campaign */}
              <div className="bg-white rounded-lg border border-gray-200">
                <div className="px-6 py-4 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-gray-900">
                      {activeView === 'active' ? 'Active Tokens' : 
                       activeView === 'completed' ? 'Completed Services' : 
                       'Campaign Tokens'}
                    </h2>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <span>{filteredTokens.length} {activeView}</span>
                      {activeView === 'active' && (
                        <select 
                          value={filterStatus} 
                          onChange={(e) => setFilterStatus(e.target.value)}
                          className="border border-gray-300 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-gray-400"
                        >
                          <option value="all">All</option>
                          <option value="pending">Pending</option>
                          <option value="in-progress">In Progress</option>
                        </select>
                      )}
                      <button 
                        onClick={refreshTokens}
                        className="p-1 hover:bg-gray-100 rounded"
                        title="Refresh"
                      >
                        <FiRefreshCw className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="p-6">
                  {Object.keys(groupedTokens).length === 0 ? (
                    <div className="text-center py-12">
                      {activeView === 'active' && (
                        <>
                          <FiPlayCircle className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                          <h3 className="text-lg font-medium text-gray-900 mb-2">No active tokens</h3>
                          <p className="text-gray-500">No tokens match your current filters</p>
                        </>
                      )}
                      {activeView === 'completed' && (
                        <>
                          <FiCheckCircle className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                          <h3 className="text-lg font-medium text-gray-900 mb-2">No completed tokens</h3>
                          <p className="text-gray-500">You haven't completed any services yet</p>
                        </>
                      )}
                      {activeView === 'campaign' && (
                        <>
                          <FiAward className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                          <h3 className="text-lg font-medium text-gray-900 mb-2">No campaign tokens</h3>
                          <p className="text-gray-500">No campaign tokens assigned to you</p>
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {Object.entries(groupedTokens).map(([date, dateTokens]) => (
                        <div key={date} className="space-y-4">
                          <div className="flex items-center justify-between">
                            <h3 className="font-medium text-gray-900 flex items-center gap-2">
                              <FiCalendar className="h-4 w-4 text-gray-500" />
                              {formatDate(date)}
                            </h3>
                            <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                              {dateTokens.length} {dateTokens.length === 1 ? 'item' : 'items'}
                            </span>
                          </div>

                          <div className="space-y-3">
                            {dateTokens.map((token) => {
                              // Determine if this token is assigned to current staff
                              const tokenStaffId = String(token.staffId || '').trim();
                              const currentStaffId = String(staffId).trim();
                              const isAssignedToMe = tokenStaffId === currentStaffId;
                              const isUnassigned = !tokenStaffId || tokenStaffId === 'null' || tokenStaffId === '';
                              
                              return (
                                <motion.div
                                  key={token.tokenId}
                                  initial={{ opacity: 0 }}
                                  animate={{ opacity: 1 }}
                                  transition={{ duration: 0.3 }}
                                  className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
                                >
                                  <div className="flex items-center gap-4 flex-1">
                                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center font-semibold ${
                                      activeView === 'completed' 
                                        ? 'bg-green-100 text-green-800' 
                                        : activeView === 'campaign'
                                        ? 'bg-purple-100 text-purple-800'
                                        : 'bg-gray-100 text-gray-900'
                                    }`}>
                                      {shortenTokenId(token.tokenId)}
                                    </div>
                                    
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-3 mb-1">
                                        <div className="flex items-center gap-2">
                                          <h4 className="font-medium text-gray-900 truncate">
                                            {token.customerName || 'Customer'}
                                          </h4>
                                          {token.type === 'campaign' && activeView !== 'campaign' && (
                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                                              <FiAward className="h-3 w-3 mr-1" />
                                              Campaign
                                            </span>
                                          )}
                                        </div>
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeColor(token.status)}`}>
                                          {getStatusIcon(token.status)}
                                          <span className="ml-1">{token.status?.replace('-', ' ')}</span>
                                        </span>
                                        {activeView === 'active' && isAssignedToMe && (
                                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                                            <FiUser className="h-3 w-3 mr-1" />
                                            Assigned to me
                                          </span>
                                        )}
                                        {activeView === 'active' && isUnassigned && (
                                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                            <FiClock className="h-3 w-3 mr-1" />
                                            Available
                                          </span>
                                        )}
                                      </div>
                                      
                                      <p className="text-sm text-gray-600 truncate">
                                        {getCategoryName(token.categoryId)} • {getSubcategoryName(token.categoryId, token.subcategoryId)}
                                      </p>
                                      
                                      <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
                                        <span>{formatTime(token.createdAt)}</span>
                                        {token.phone && (
                                          <span>{token.phone}</span>
                                        )}
                                        {activeView === 'completed' && token.updatedAt && (
                                          <span className="text-green-600">
                                            Completed: {formatTime(token.updatedAt)}
                                          </span>
                                        )}
                                        {activeView === 'campaign' && token.campaignName && (
                                          <span className="text-purple-600">
                                            {token.campaignName}
                                          </span>
                                        )}
                                        {activeView === 'campaign' && token.status === 'completed' && (
                                          <span className="text-green-600">
                                            ✓ Completed
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-3">
                                    {activeView === 'active' && 
                                     (token.status === 'pending' || token.status === 'in-progress' || token.status === 'processing') && 
                                     (isAssignedToMe || isUnassigned) && (
                                      <button
                                        onClick={() => handleStartService(token.tokenId)}
                                        className="px-4 py-2 bg-blue-700 text-white rounded-lg hover:bg-blue-800 transition-colors flex items-center gap-2 text-sm font-medium"
                                      >
                                        <FiPlayCircle className="h-4 w-4" />
                                        {token.status === 'pending' ? 'Start' : 'Continue'}
                                      </button>
                                    )}
                                    {(activeView === 'completed' || activeView === 'campaign') && (
                                      <button
                                        onClick={() => handleViewDetails(token.tokenId)}
                                        className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-800 transition-colors flex items-center gap-2 text-sm font-medium"
                                      >
                                        <FiBarChart2 className="h-4 w-4" />
                                        View Details
                                      </button>
                                    )}
                                  </div>
                                </motion.div>
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

            {/* Sidebar - Analytics & Recent Activity */}
            <div className="space-y-6">
              {/* Performance Metrics */}
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance Metrics</h3>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium text-gray-600">Completion Rate</span>
                      <span className="text-sm font-semibold text-gray-900">{completionRate}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-green-600 h-2 rounded-full transition-all duration-500" 
                        style={{ width: `${completionRate}%` }}
                      ></div>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium text-gray-600">Avg. Service Time</span>
                      <span className="text-sm font-semibold text-gray-900">{avgServiceTime}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div className="bg-blue-600 h-2 rounded-full" style={{ width: '75%' }}></div>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium text-gray-600">Customer Satisfaction</span>
                      <span className="text-sm font-semibold text-gray-900">{customerSatisfaction}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div className="bg-purple-600 h-2 rounded-full" style={{ width: '96%' }}></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Recent Activity */}
              <div className="bg-white rounded-lg border border-gray-200">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900">Recent Activity</h3>
                </div>
                <div className="p-6">
                  {recentServiceEntries.length > 0 ? (
                    <div className="space-y-4">
                      {recentServiceEntries.map((entry) => (
                        <div key={entry.id} className="flex items-start gap-3 pb-4 last:pb-0 last:border-0 border-b border-gray-100">
                          <div className="flex-shrink-0 mt-1">
                            <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                              <FiUser className="h-4 w-4 text-gray-600" />
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-baseline justify-between mb-1">
                              <p className="text-sm font-medium text-gray-900 truncate">
                                {entry.customerName || 'Customer'}
                              </p>
                              <span className="text-xs text-gray-500 whitespace-nowrap ml-2">
                                {formatTime(entry.created_at)}
                              </span>
                            </div>
                            <p className="text-sm text-gray-600 mb-1">
                              {getCategoryName(entry.category)} service
                            </p>
                            <div className="flex items-center justify-between">
                              <span className={`text-xs font-medium ${
                                entry.status === 'completed' 
                                  ? 'text-green-600' 
                                  : entry.status === 'in-progress' || entry.status === 'processing'
                                  ? 'text-blue-600'
                                  : entry.status === 'pending'
                                  ? 'text-amber-600'
                                  : 'text-gray-600'
                              }`}>
                                {entry.status ? entry.status.replace('-', ' ') : 'N/A'}
                              </span>
                              {entry.tokenId && (
                                <span className="text-xs text-gray-500 font-mono">
                                  {shortenTokenId(entry.tokenId)}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <FiBarChart2 className="mx-auto h-8 w-8 text-gray-400 mb-2" />
                      <p className="text-gray-500 text-sm">No recent activity</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Quick Actions */}
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
                <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={() => navigate('/staff/token/create')}
                    className="p-3 border border-gray-300 rounded-lg hover:border-gray-400 transition-colors text-left"
                  >
                    <FiPlus className="h-5 w-5 text-gray-600 mb-2" />
                    <span className="text-sm font-medium text-gray-900">New Token</span>
                  </button>
                  <button 
                    onClick={() => navigate('/staff/reports')}
                    className="p-3 border border-gray-300 rounded-lg hover:border-gray-400 transition-colors text-left"
                  >
                    <FiBarChart2 className="h-5 w-5 text-gray-600 mb-2" />
                    <span className="text-sm font-medium text-gray-900">Reports</span>
                  </button>
                  <button 
                    onClick={() => navigate('/staff/customers')}
                    className="p-3 border border-gray-300 rounded-lg hover:border-gray-400 transition-colors text-left"
                  >
                    <FiUsers className="h-5 w-5 text-gray-600 mb-2" />
                    <span className="text-sm font-medium text-gray-900">Customers</span>
                  </button>
                  <button 
                    onClick={refreshTokens}
                    className="p-3 border border-gray-300 rounded-lg hover:border-gray-400 transition-colors text-left"
                  >
                    <FiRefreshCw className="h-5 w-5 text-gray-600 mb-2" />
                    <span className="text-sm font-medium text-gray-900">Refresh</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
      
      {/* Quick Service Modal */}
      <QuickServiceModal
        open={showQuickService}
        onClose={() => setShowQuickService(false)}
        wallets={wallets}
      />
    </div>
  );
};

export default StaffDashboard;
