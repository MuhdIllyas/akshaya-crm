// src/pages/Home.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import { Link, useNavigate } from 'react-router-dom';
import {
  FiHome, FiFileText, FiCheckCircle, FiClock, FiAlertCircle,
  FiBell, FiUser, FiCalendar, FiActivity, FiTrendingUp,
  FiArrowRight, FiRefreshCw, FiSearch, FiFilter, FiMoreVertical,
  FiSmartphone, FiDollarSign, FiPackage, FiUsers, FiAward,
  FiMessageSquare, FiChevronRight, FiDownload, FiEye,
  FiXCircle, FiInfo, FiExternalLink
} from 'react-icons/fi';
import axios from 'axios';

// ---------------------------------------------------------------------
// UI Components
// ---------------------------------------------------------------------

// Stats Card Component
const StatsCard = ({ title, value, icon: Icon, color, bg, onClick }) => (
  <motion.div
    whileHover={{ y: -2 }}
    onClick={onClick}
    className={`bg-white rounded-xl border border-gray-200 p-5 hover:shadow-lg transition-all duration-300 ${onClick ? 'cursor-pointer' : ''}`}
  >
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
      </div>
      <div className={`p-3 rounded-xl ${bg}`}>
        <Icon className={`h-5 w-5 ${color}`} />
      </div>
    </div>
  </motion.div>
);

// Notification Item Component
const NotificationItem = ({ notification, onClick }) => {
  const getIcon = (type) => {
    switch (type) {
      case 'success': return FiCheckCircle;
      case 'warning': return FiAlertCircle;
      case 'info': return FiInfo;
      case 'error': return FiXCircle;
      default: return FiBell;
    }
  };

  const getColor = (type) => {
    switch (type) {
      case 'success': return { bg: 'bg-emerald-50', text: 'text-emerald-600' };
      case 'warning': return { bg: 'bg-amber-50', text: 'text-amber-600' };
      case 'info': return { bg: 'bg-blue-50', text: 'text-blue-600' };
      case 'error': return { bg: 'bg-rose-50', text: 'text-rose-600' };
      default: return { bg: 'bg-gray-50', text: 'text-gray-600' };
    }
  };

  const Icon = getIcon(notification.type);
  const colors = getColor(notification.type);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ backgroundColor: '#f9fafb' }}
      onClick={() => onClick?.(notification)}
      className={`p-4 border-b border-gray-100 cursor-pointer transition-colors ${!notification.read ? 'bg-blue-50/30' : ''}`}
    >
      <div className="flex items-start space-x-3">
        <div className={`p-2 rounded-lg ${colors.bg} flex-shrink-0`}>
          <Icon className={`h-4 w-4 ${colors.text}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <h4 className="text-sm font-medium text-gray-900 truncate">
              {notification.title}
            </h4>
            {!notification.read && (
              <span className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0"></span>
            )}
          </div>
          <p className="text-xs text-gray-600 line-clamp-2 mb-1">{notification.message}</p>
          <p className="text-xs text-gray-400">{notification.time}</p>
        </div>
      </div>
    </motion.div>
  );
};

// Application Card Component
const ApplicationCard = ({ application, onClick }) => {
  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'completed': return { bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-200' };
      case 'pending': return { bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-200' };
      case 'processing': return { bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-200' };
      case 'rejected': return { bg: 'bg-rose-50', text: 'text-rose-600', border: 'border-rose-200' };
      default: return { bg: 'bg-gray-50', text: 'text-gray-600', border: 'border-gray-200' };
    }
  };

  const statusColors = getStatusColor(application.status);

  return (
    <motion.div
      whileHover={{ y: -2 }}
      className={`bg-white rounded-lg border ${statusColors.border} p-4 hover:shadow-md transition-all cursor-pointer`}
      onClick={() => onClick?.(application)}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center space-x-2">
          <div className="p-1.5 bg-navy-50 rounded">
            <FiFileText className="h-4 w-4 text-navy-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900">{application.service_name || application.name}</p>
            <p className="text-xs text-gray-500">{application.application_id || application.id}</p>
          </div>
        </div>
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors.bg} ${statusColors.text}`}>
          {application.status}
        </span>
      </div>
      
      <div className="space-y-1 mb-3">
        <div className="flex items-center text-xs text-gray-600">
          <FiUser className="h-3 w-3 mr-1" />
          <span>{application.applicant_name || application.customer_name}</span>
        </div>
        <div className="flex items-center text-xs text-gray-600">
          <FiCalendar className="h-3 w-3 mr-1" />
          <span>Applied: {new Date(application.created_at || application.date).toLocaleDateString('en-IN')}</span>
        </div>
      </div>
      
      {application.progress !== undefined && (
        <div className="mt-3">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-gray-600">Progress</span>
            <span className="font-medium text-gray-700">{application.progress}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-1.5">
            <div 
              className="bg-navy-600 h-1.5 rounded-full transition-all"
              style={{ width: `${application.progress}%` }}
            />
          </div>
        </div>
      )}
    </motion.div>
  );
};

// Service Category Card
const ServiceCategoryCard = ({ category, onClick }) => (
  <motion.div
    whileHover={{ scale: 1.02 }}
    onClick={onClick}
    className="bg-gradient-to-br from-navy-50 to-blue-50 rounded-xl p-5 border border-navy-100 cursor-pointer hover:shadow-lg transition-all"
  >
    <div className="flex items-center space-x-3 mb-3">
      <div className="p-2 bg-navy-100 rounded-lg">
        <FiPackage className="h-5 w-5 text-navy-600" />
      </div>
      <h3 className="font-semibold text-gray-900">{category.name}</h3>
    </div>
    <p className="text-sm text-gray-600 mb-3">{category.description}</p>
    <div className="flex items-center justify-between">
      <span className="text-xs text-gray-500">{category.count} services</span>
      <FiArrowRight className="h-4 w-4 text-navy-600" />
    </div>
  </motion.div>
);

// Quick Link Card
const QuickLinkCard = ({ title, icon: Icon, color, bg, onClick }) => (
  <motion.div
    whileHover={{ y: -2 }}
    onClick={onClick}
    className="bg-white rounded-xl border border-gray-200 p-4 cursor-pointer hover:shadow-md transition-all"
  >
    <div className="flex items-center space-x-3">
      <div className={`p-2.5 rounded-xl ${bg}`}>
        <Icon className={`h-5 w-5 ${color}`} />
      </div>
      <span className="font-medium text-gray-700 text-sm">{title}</span>
    </div>
  </motion.div>
);

// Section Header
const SectionHeader = ({ title, icon: Icon, action, actionText, onAction }) => (
  <div className="flex items-center justify-between mb-4">
    <div className="flex items-center space-x-2">
      {Icon && <Icon className="h-5 w-5 text-navy-600" />}
      <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
    </div>
    {action && (
      <button
        onClick={onAction}
        className="text-sm text-navy-600 hover:text-navy-700 font-medium flex items-center"
      >
        {actionText || 'View All'} <FiChevronRight className="h-4 w-4 ml-1" />
      </button>
    )}
  </div>
);

// ---------------------------------------------------------------------
// Main Home Component
// ---------------------------------------------------------------------
const Home = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // State for data
  const [stats, setStats] = useState({
    totalApplications: 0,
    pendingApplications: 0,
    completedToday: 0,
    activeServices: 0,
    unreadNotifications: 0,
    pendingPayments: 0,
  });
  
  const [recentApplications, setRecentApplications] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [serviceCategories, setServiceCategories] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [todaySchedule, setTodaySchedule] = useState([]);
  const [userInfo, setUserInfo] = useState({
    name: '',
    role: '',
    centre_name: ''
  });

  // Get user info from localStorage
  useEffect(() => {
    const username = localStorage.getItem('username') || 'User';
    const role = localStorage.getItem('role') || 'Staff';
    const centreName = localStorage.getItem('centre_name') || 'Akshaya e-Centre Pukayur';
    
    setUserInfo({
      name: username,
      role: role.charAt(0).toUpperCase() + role.slice(1),
      centre_name: centreName
    });
  }, []);

  // Fetch all home page data
  const fetchHomeData = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };
      const apiUrl = import.meta.env.VITE_API_URL;

      // Parallel API calls
      const [
        applicationsRes,
        notificationsRes,
        statsRes,
        categoriesRes,
        announcementsRes,
        scheduleRes
      ] = await Promise.allSettled([
        axios.get(`${apiUrl}/api/applications/recent?limit=6`, { headers }),
        axios.get(`${apiUrl}/api/notifications?limit=5`, { headers }),
        axios.get(`${apiUrl}/api/dashboard/stats`, { headers }),
        axios.get(`${apiUrl}/api/services/categories`, { headers }),
        axios.get(`${apiUrl}/api/announcements?limit=3`, { headers }),
        axios.get(`${apiUrl}/api/schedule/today`, { headers })
      ]);

      // Process applications
      if (applicationsRes.status === 'fulfilled' && applicationsRes.value.data) {
        const apps = applicationsRes.value.data.applications || applicationsRes.value.data || [];
        setRecentApplications(Array.isArray(apps) ? apps.slice(0, 6) : []);
      }

      // Process notifications
      if (notificationsRes.status === 'fulfilled' && notificationsRes.value.data) {
        const notifs = notificationsRes.value.data.notifications || notificationsRes.value.data || [];
        setNotifications(Array.isArray(notifs) ? notifs : []);
        const unreadCount = Array.isArray(notifs) ? notifs.filter(n => !n.read).length : 0;
        setStats(prev => ({ ...prev, unreadNotifications: unreadCount }));
      }

      // Process stats
      if (statsRes.status === 'fulfilled' && statsRes.value.data) {
        const statsData = statsRes.value.data;
        setStats(prev => ({
          ...prev,
          totalApplications: statsData.totalApplications || 0,
          pendingApplications: statsData.pendingApplications || 0,
          completedToday: statsData.completedToday || 0,
          activeServices: statsData.activeServices || 0,
          pendingPayments: statsData.pendingPayments || 0,
        }));
      }

      // Process service categories
      if (categoriesRes.status === 'fulfilled' && categoriesRes.value.data) {
        const categories = categoriesRes.value.data.categories || categoriesRes.value.data || [];
        setServiceCategories(Array.isArray(categories) ? categories : []);
      }

      // Process announcements
      if (announcementsRes.status === 'fulfilled' && announcementsRes.value.data) {
        const announcements = announcementsRes.value.data.announcements || announcementsRes.value.data || [];
        setAnnouncements(Array.isArray(announcements) ? announcements : []);
      }

      // Process schedule
      if (scheduleRes.status === 'fulfilled' && scheduleRes.value.data) {
        const schedule = scheduleRes.value.data.schedule || scheduleRes.value.data || [];
        setTodaySchedule(Array.isArray(schedule) ? schedule : []);
      }

    } catch (error) {
      console.error('Error fetching home data:', error);
      
      // Set mock data for demo/preview
      setMockData();
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Mock data for preview/demo
  const setMockData = () => {
    setStats({
      totalApplications: 156,
      pendingApplications: 23,
      completedToday: 18,
      activeServices: 12,
      unreadNotifications: 5,
      pendingPayments: 8,
    });

    setRecentApplications([
      {
        id: 'APP001',
        application_id: 'AKS-2024-001',
        service_name: 'Aadhaar Update',
        applicant_name: 'Rajesh Kumar',
        customer_name: 'Rajesh Kumar',
        status: 'Processing',
        created_at: new Date().toISOString(),
        progress: 65
      },
      {
        id: 'APP002',
        application_id: 'AKS-2024-002',
        service_name: 'Income Certificate',
        applicant_name: 'Priya Sharma',
        customer_name: 'Priya Sharma',
        status: 'Pending',
        created_at: new Date(Date.now() - 86400000).toISOString(),
        progress: 30
      },
      {
        id: 'APP003',
        application_id: 'AKS-2024-003',
        service_name: 'PAN Card Application',
        applicant_name: 'Mohammed Aslam',
        customer_name: 'Mohammed Aslam',
        status: 'Completed',
        created_at: new Date(Date.now() - 172800000).toISOString(),
        progress: 100
      },
      {
        id: 'APP004',
        application_id: 'AKS-2024-004',
        service_name: 'Caste Certificate',
        applicant_name: 'Lakshmi Menon',
        customer_name: 'Lakshmi Menon',
        status: 'Processing',
        created_at: new Date(Date.now() - 259200000).toISOString(),
        progress: 80
      },
      {
        id: 'APP005',
        application_id: 'AKS-2024-005',
        service_name: 'Driving License Renewal',
        applicant_name: 'Suresh Nair',
        customer_name: 'Suresh Nair',
        status: 'Pending',
        created_at: new Date(Date.now() - 345600000).toISOString(),
        progress: 45
      },
      {
        id: 'APP006',
        application_id: 'AKS-2024-006',
        service_name: 'Birth Certificate',
        applicant_name: 'Anjali Krishnan',
        customer_name: 'Anjali Krishnan',
        status: 'Processing',
        created_at: new Date(Date.now() - 432000000).toISOString(),
        progress: 55
      }
    ]);

    setNotifications([
      {
        id: 1,
        title: 'New Application Submitted',
        message: 'Aadhaar Update application submitted by Rajesh Kumar requires verification.',
        type: 'info',
        time: '5 minutes ago',
        read: false
      },
      {
        id: 2,
        title: 'Application Approved',
        message: 'Income Certificate application for Priya Sharma has been approved.',
        type: 'success',
        time: '1 hour ago',
        read: false
      },
      {
        id: 3,
        title: 'Payment Pending',
        message: '3 applications have pending payments. Please follow up with customers.',
        type: 'warning',
        time: '3 hours ago',
        read: false
      },
      {
        id: 4,
        title: 'Service Update',
        message: 'e-District portal will be under maintenance on Sunday from 10 AM to 2 PM.',
        type: 'info',
        time: 'Yesterday',
        read: true
      },
      {
        id: 5,
        title: 'New Announcement',
        message: 'New service added: Digital Life Certificate for pensioners.',
        type: 'success',
        time: 'Yesterday',
        read: false
      }
    ]);

    setServiceCategories([
      { id: 1, name: 'Aadhaar Services', description: 'Enrolment, Update, PVC Card', count: 5 },
      { id: 2, name: 'Certificate Services', description: 'Income, Caste, Birth, Death', count: 8 },
      { id: 3, name: 'PAN Card Services', description: 'New PAN, Correction, Reprint', count: 4 },
      { id: 4, name: 'Driving License', description: 'New, Renewal, Duplicate', count: 6 },
    ]);

    setAnnouncements([
      {
        id: 1,
        title: 'New Digital Service Available',
        content: 'e-Filing of Income Tax Returns now available at our centre.',
        date: '2024-01-15',
        type: 'info'
      },
      {
        id: 2,
        title: 'Holiday Notice',
        content: 'Centre will remain closed on Republic Day (Jan 26th).',
        date: '2024-01-10',
        type: 'warning'
      }
    ]);

    setTodaySchedule([
      { id: 1, time: '10:00 AM', title: 'Token System - Aadhaar', count: 5 },
      { id: 2, time: '11:30 AM', title: 'Certificate Applications', count: 3 },
      { id: 3, time: '02:00 PM', title: 'PAN Card Verification', count: 2 },
      { id: 4, time: '03:30 PM', title: 'Driving License - Photo', count: 4 },
    ]);
  };

  useEffect(() => {
    fetchHomeData();
  }, []);

  // Refresh handler
  const handleRefresh = async () => {
    setRefreshing(true);
    toast.info('Refreshing data...');
    await fetchHomeData();
    toast.success('Data refreshed successfully');
  };

  // Navigation handlers
  const handleApplicationClick = (application) => {
    navigate(`/applications/${application.id}`);
  };

  const handleNotificationClick = (notification) => {
    // Mark as read
    setNotifications(prev => 
      prev.map(n => n.id === notification.id ? { ...n, read: true } : n)
    );
    
    // Navigate based on notification type
    if (notification.link) {
      navigate(notification.link);
    }
  };

  const handleCategoryClick = (category) => {
    navigate(`/services?category=${category.id}`);
  };

  const handleViewAllApplications = () => {
    navigate('/applications');
  };

  const handleViewAllNotifications = () => {
    navigate('/notifications');
  };

  const handleNewApplication = () => {
    navigate('/applications/new');
  };

  // Quick actions configuration
  const quickActions = [
    { 
      title: 'New Application', 
      icon: FiFileText, 
      color: 'text-navy-600', 
      bg: 'bg-navy-50',
      onClick: () => navigate('/applications/new')
    },
    { 
      title: 'Search Customer', 
      icon: FiSearch, 
      color: 'text-blue-600', 
      bg: 'bg-blue-50',
      onClick: () => navigate('/customers')
    },
    { 
      title: 'Collect Payment', 
      icon: FiDollarSign, 
      color: 'text-emerald-600', 
      bg: 'bg-emerald-50',
      onClick: () => navigate('/payments/collect')
    },
    { 
      title: 'View Reports', 
      icon: FiTrendingUp, 
      color: 'text-purple-600', 
      bg: 'bg-purple-50',
      onClick: () => navigate('/reports')
    },
  ];

  // Get greeting based on time
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  // Get current date
  const getCurrentDate = () => {
    return new Date().toLocaleDateString('en-IN', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-navy-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Loading Akshaya e-Centre...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-navy-800 to-navy-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">
                {getGreeting()}, {userInfo.name}! 👋
              </h1>
              <p className="text-navy-200 mt-1">
                {userInfo.centre_name} • {getCurrentDate()}
              </p>
            </div>
            <div className="mt-4 md:mt-0 flex items-center space-x-3">
              <button
                onClick={handleRefresh}
                className="flex items-center space-x-2 px-4 py-2 bg-white/10 rounded-lg hover:bg-white/20 transition-colors"
                disabled={refreshing}
              >
                <FiRefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                <span className="text-sm">Refresh</span>
              </button>
              <Link
                to="/profile"
                className="flex items-center space-x-2 px-4 py-2 bg-white/10 rounded-lg hover:bg-white/20 transition-colors"
              >
                <FiUser className="h-4 w-4" />
                <span className="text-sm">{userInfo.role}</span>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          <StatsCard
            title="Total Applications"
            value={stats.totalApplications}
            icon={FiFileText}
            color="text-blue-600"
            bg="bg-blue-50"
            onClick={handleViewAllApplications}
          />
          <StatsCard
            title="Pending"
            value={stats.pendingApplications}
            icon={FiClock}
            color="text-amber-600"
            bg="bg-amber-50"
            onClick={handleViewAllApplications}
          />
          <StatsCard
            title="Completed Today"
            value={stats.completedToday}
            icon={FiCheckCircle}
            color="text-emerald-600"
            bg="bg-emerald-50"
            onClick={handleViewAllApplications}
          />
          <StatsCard
            title="Active Services"
            value={stats.activeServices}
            icon={FiPackage}
            color="text-indigo-600"
            bg="bg-indigo-50"
          />
          <StatsCard
            title="Pending Payments"
            value={stats.pendingPayments}
            icon={FiDollarSign}
            color="text-rose-600"
            bg="bg-rose-50"
            onClick={() => navigate('/payments/pending')}
          />
          <StatsCard
            title="Notifications"
            value={stats.unreadNotifications}
            icon={FiBell}
            color="text-purple-600"
            bg="bg-purple-50"
            onClick={handleViewAllNotifications}
          />
        </div>

        {/* Quick Actions */}
        <div className="mb-6">
          <SectionHeader title="Quick Actions" icon={FiActivity} />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {quickActions.map((action, index) => (
              <QuickLinkCard key={index} {...action} />
            ))}
          </div>
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Recent Applications */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <SectionHeader
                title="Recent Applications"
                icon={FiFileText}
                action
                actionText="View All"
                onAction={handleViewAllApplications}
              />
              
              <div className="px-4 pb-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {recentApplications.map((app) => (
                    <ApplicationCard
                      key={app.id}
                      application={app}
                      onClick={handleApplicationClick}
                    />
                  ))}
                </div>
                
                {recentApplications.length === 0 && (
                  <div className="text-center py-8">
                    <FiFileText className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500">No recent applications</p>
                    <button
                      onClick={handleNewApplication}
                      className="mt-3 text-navy-600 hover:text-navy-700 font-medium text-sm"
                    >
                      Create New Application →
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column - Notifications & Schedule */}
          <div className="space-y-6">
            {/* Notifications */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <SectionHeader
                title="Notifications"
                icon={FiBell}
                action
                actionText="View All"
                onAction={handleViewAllNotifications}
              />
              
              <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
                {notifications.map((notification) => (
                  <NotificationItem
                    key={notification.id}
                    notification={notification}
                    onClick={handleNotificationClick}
                  />
                ))}
                
                {notifications.length === 0 && (
                  <div className="text-center py-8">
                    <FiBell className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500">No new notifications</p>
                  </div>
                )}
              </div>
            </div>

            {/* Today's Schedule */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <SectionHeader
                title="Today's Schedule"
                icon={FiCalendar}
              />
              
              <div className="p-4">
                {todaySchedule.length > 0 ? (
                  <div className="space-y-3">
                    {todaySchedule.map((item) => (
                      <div key={item.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center space-x-3">
                          <div className="text-sm font-medium text-navy-600 w-20">{item.time}</div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">{item.title}</p>
                            <p className="text-xs text-gray-500">{item.count} appointments</p>
                          </div>
                        </div>
                        <FiChevronRight className="h-4 w-4 text-gray-400" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <FiCalendar className="h-10 w-10 text-gray-300 mx-auto mb-2" />
                    <p className="text-gray-500 text-sm">No appointments scheduled</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Service Categories */}
        <div className="mt-6">
          <SectionHeader
            title="Service Categories"
            icon={FiPackage}
            action
            actionText="All Services"
            onAction={() => navigate('/services')}
          />
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {serviceCategories.map((category) => (
              <ServiceCategoryCard
                key={category.id}
                category={category}
                onClick={handleCategoryClick}
              />
            ))}
            
            {serviceCategories.length === 0 && (
              <div className="col-span-4 text-center py-8">
                <FiPackage className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No service categories available</p>
              </div>
            )}
          </div>
        </div>

        {/* Announcements Banner */}
        {announcements.length > 0 && (
          <div className="mt-6">
            <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl border border-amber-200 p-4">
              <div className="flex items-start space-x-3">
                <div className="p-2 bg-amber-100 rounded-lg">
                  <FiInfo className="h-5 w-5 text-amber-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 mb-1">Announcements</h3>
                  <div className="space-y-2">
                    {announcements.slice(0, 2).map((announcement) => (
                      <div key={announcement.id} className="text-sm">
                        <span className="font-medium text-gray-800">{announcement.title}:</span>
                        <span className="text-gray-600 ml-1">{announcement.content}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <button
                  onClick={() => navigate('/announcements')}
                  className="text-navy-600 hover:text-navy-700"
                >
                  <FiExternalLink className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 pt-6 border-t border-gray-200">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <p className="text-sm text-gray-500">
              © 2025 Muhammed Illyas. All rights reserved.
            </p>
            <p className="text-sm text-gray-500">
              Akshaya e-Centre Pukayur • Digital Empowerment Initiative
            </p>
          </div>
        </div>
      </div>

      {/* Custom Styles */}
      <style>{`
        .bg-navy-50 { background-color: #f0f4f8; }
        .bg-navy-100 { background-color: #d9e2ec; }
        .bg-navy-200 { background-color: #bccde0; }
        .bg-navy-600 { background-color: #2c5282; }
        .bg-navy-700 { background-color: #1e3a5f; }
        .bg-navy-800 { background-color: #172a45; }
        .bg-navy-900 { background-color: #0a192f; }
        .text-navy-200 { color: #bccde0; }
        .text-navy-600 { color: #2c5282; }
        .text-navy-700 { color: #1e3a5f; }
        .border-navy-100 { border-color: #d9e2ec; }
        .border-navy-200 { border-color: #bccde0; }
        
        .line-clamp-2 {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
      `}</style>
    </div>
  );
};

export default Home;
