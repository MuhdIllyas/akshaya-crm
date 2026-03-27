import React, { useState, useEffect, useMemo } from 'react';
import { 
  FiSearch, FiFilter, FiDownload, FiEye, FiMessageSquare,
  FiClock, FiUser, FiPhone, FiMapPin, FiDollarSign, FiCheckCircle,
  FiAlertCircle, FiRefreshCw, FiChevronDown, FiFileText, FiTrendingUp,
  FiBarChart2, FiPieChart, FiCalendar, FiShoppingBag, FiAward, FiX,
  FiMail, FiTag, FiFlag, FiArchive, FiStar, FiShare2, FiPrinter,
  FiArrowLeft, FiArrowRight, FiDownloadCloud, FiCopy, FiLink,
  FiList, FiGrid, FiUsers, FiUserCheck, FiUserPlus, FiCreditCard
} from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';
import { getTrackingEntries, updateTrackingStatus, updateTrackingEntry, notifyCustomer, getServiceEntries, getServiceEntryByTokenId } from '/src/services/serviceService';
import axios from 'axios';

// Import Chart.js components
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

// Custom Toast Container
const SafeToastContainer = () => {
  const [ToastContainer, setToastContainer] = useState(null);

  useEffect(() => {
    import('react-toastify').then((module) => {
      setToastContainer(() => module.ToastContainer);
    }).catch((error) => {
      console.warn('Toast notifications disabled:', error);
    });
  }, []);

  if (!ToastContainer) return null;

  return (
    <ToastContainer 
      position="top-right"
      autoClose={5000}
      hideProgressBar={false}
      newestOnTop
      closeOnClick
      rtl={false}
      pauseOnFocusLoss
      draggable
      pauseOnHover
      theme="light"
    />
  );
};

// Safe toast function
const createSafeToast = () => {
  let toast = null;
  
  import('react-toastify').then((module) => {
    toast = module.toast;
  }).catch((error) => {
    console.warn('Toast notifications disabled:', error);
    toast = {
      success: (msg) => console.log('SUCCESS:', msg),
      error: (msg) => console.error('ERROR:', msg),
      info: (msg) => console.info('INFO:', msg),
      warn: (msg) => console.warn('WARN:', msg),
    };
  });

  return {
    success: (message) => {
      if (toast && toast.success) {
        toast.success(message);
      } else {
        console.log('SUCCESS:', message);
      }
    },
    error: (message) => {
      if (toast && toast.error) {
        toast.error(message);
      } else {
        console.error('ERROR:', message);
      }
    },
    info: (message) => {
      if (toast && toast.info) {
        toast.info(message);
      } else {
        console.info('INFO:', message);
      }
    },
    warn: (message) => {
      if (toast && toast.warn) {
        toast.warn(message);
      } else {
        console.warn('WARN:', message);
      }
    }
  };
};

const toast = createSafeToast();

// Error Boundary Component
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
          <div className="bg-white rounded-xl border border-gray-200 p-8 max-w-md text-center">
            <div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <FiAlertCircle className="h-8 w-8 text-rose-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Something went wrong</h2>
            <p className="text-gray-600 mb-4">
              There was an error loading the service logs. Please try refreshing the page.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Refresh Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Chart Components
const StatusDistributionChart = ({ services }) => {
  const statusCounts = useMemo(() => {
    const counts = {
      'Pending': 0,
      'In Progress': 0,
      'Completed': 0,
      'Delayed': 0,
      'Resubmit': 0,
      'Paid': 0
    };

    services.forEach(service => {
      if (counts.hasOwnProperty(service.status)) {
        counts[service.status]++;
      }
    });

    return counts;
  }, [services]);

  const data = {
    labels: Object.keys(statusCounts),
    datasets: [
      {
        data: Object.values(statusCounts),
        backgroundColor: [
          'rgba(245, 158, 11, 0.8)',    // amber
          'rgba(59, 130, 246, 0.8)',    // blue
          'rgba(16, 185, 129, 0.8)',    // emerald
          'rgba(239, 68, 68, 0.8)',     // rose
          'rgba(251, 191, 36, 0.8)',    // yellow
          'rgba(34, 197, 94, 0.8)'      // green
        ],
        borderColor: [
          'rgb(245, 158, 11)',
          'rgb(59, 130, 246)',
          'rgb(16, 185, 129)',
          'rgb(239, 68, 68)',
          'rgb(251, 191, 36)',
          'rgb(34, 197, 94)'
        ],
        borderWidth: 2,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right',
        labels: {
          boxWidth: 12,
          padding: 15,
          font: { size: 12 },
          generateLabels: (chart) => {
            const data = chart.data;
            if (data.labels.length && data.datasets.length) {
              return data.labels.map((label, i) => {
                const dataset = data.datasets[0];
                const value = dataset.data[i];
                const percentage = ((value / dataset.data.reduce((a, b) => a + b, 0)) * 100).toFixed(1);
                return {
                  text: `${label}: ${value} (${percentage}%)`,
                  fillStyle: dataset.backgroundColor[i],
                  strokeStyle: dataset.borderColor[i],
                  lineWidth: dataset.borderWidth,
                  hidden: false,
                  index: i
                };
              });
            }
            return [];
          }
        }
      },
      tooltip: {
        callbacks: {
          label: function(context) {
            const label = context.label || '';
            const value = context.raw || 0;
            const total = context.dataset.data.reduce((a, b) => a + b, 0);
            const percentage = ((value / total) * 100).toFixed(1);
            return `${label}: ${value} (${percentage}%)`;
          }
        }
      },
      title: {
        display: true,
        text: 'Service Status Distribution',
        position: 'top',
      },
    },
    cutout: '50%',
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900">Status Overview</h3>
        <FiPieChart className="h-5 w-5 text-indigo-600" />
      </div>
      <div className="h-64 relative">
        <Doughnut data={data} options={options} />
      </div>
    </div>
  );
};

const MonthlyServiceTrendChart = ({ services }) => {
  const monthlyData = useMemo(() => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const currentYear = new Date().getFullYear();
    const monthlyCounts = new Array(12).fill(0);

    services.forEach(service => {
      const date = new Date(service.date);
      if (date.getFullYear() === currentYear) {
        const month = date.getMonth();
        monthlyCounts[month]++;
      }
    });

    return { labels: months, counts: monthlyCounts };
  }, [services]);

  const data = {
    labels: monthlyData.labels,
    datasets: [
      {
        label: 'Service Count',
        data: monthlyData.counts,
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
      title: {
        display: true,
        text: 'Monthly Service Trends',
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: 'Number of Services',
        },
      },
    },
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900">Monthly Trends</h3>
        <FiTrendingUp className="h-5 w-5 text-indigo-600" />
      </div>
      <div className="h-64">
        <Line data={data} options={options} />
      </div>
    </div>
  );
};

const ServiceTypeDistributionChart = ({ services }) => {
  const serviceTypeData = useMemo(() => {
    const typeCounts = {};

    services.forEach(service => {
      const type = service.serviceType || 'Unknown';
      typeCounts[type] = (typeCounts[type] || 0) + 1;
    });

    const topTypes = Object.entries(typeCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 6)
      .map(([type]) => type);

    return {
      labels: topTypes,
      counts: topTypes.map(type => typeCounts[type]),
    };
  }, [services]);

  const data = {
    labels: serviceTypeData.labels,
    datasets: [
      {
        label: 'Service Count',
        data: serviceTypeData.counts,
        backgroundColor: [
          'rgba(99, 102, 241, 0.8)',
          'rgba(16, 185, 129, 0.8)',
          'rgba(245, 158, 11, 0.8)',
          'rgba(139, 92, 246, 0.8)',
          'rgba(14, 165, 233, 0.8)',
          'rgba(236, 72, 153, 0.8)'
        ],
        borderColor: [
          'rgb(99, 102, 241)',
          'rgb(16, 185, 129)',
          'rgb(245, 158, 11)',
          'rgb(139, 92, 246)',
          'rgb(14, 165, 233)',
          'rgb(236, 72, 153)'
        ],
        borderWidth: 2,
      },
    ],
  };

  const options = {
    responsive: true,
    plugins: {
      legend: { position: 'top' },
      title: {
        display: true,
        text: 'Service Types Distribution',
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: 'Number of Services',
        },
      },
    },
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900">Service Types</h3>
        <FiBarChart2 className="h-5 w-5 text-indigo-600" />
      </div>
      <div className="h-64">
        <Bar data={data} options={options} />
      </div>
    </div>
  );
};

const StaffWorkloadChart = ({ services }) => {
  const staffData = useMemo(() => {
    const staffWorkload = {};

    services.forEach(service => {
      const staff = service.staffName || 'Unassigned';
      if (!staffWorkload[staff]) {
        staffWorkload[staff] = {
          total: 0,
          completed: 0,
          inProgress: 0,
          pending: 0,
        };
      }
      
      staffWorkload[staff].total++;
      if (service.status === 'Completed') {
        staffWorkload[staff].completed++;
      } else if (service.status === 'In Progress') {
        staffWorkload[staff].inProgress++;
      } else if (service.status === 'Pending') {
        staffWorkload[staff].pending++;
      }
    });

    const staffWithWorkload = Object.entries(staffWorkload)
      .sort(([,a], [,b]) => b.total - a.total)
      .slice(0, 8)
      .map(([staff, data]) => ({
        staff,
        ...data,
        completionRate: (data.completed / data.total) * 100,
      }));

    return staffWithWorkload;
  }, [services]);

  const data = {
    labels: staffData.map(item => item.staff),
    datasets: [
      {
        label: 'Total Services',
        data: staffData.map(item => item.total),
        backgroundColor: 'rgba(99, 102, 241, 0.8)',
        borderColor: 'rgb(99, 102, 241)',
        borderWidth: 2,
      },
      {
        label: 'Completed',
        data: staffData.map(item => item.completed),
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
      title: {
        display: true,
        text: 'Staff Workload & Completion',
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: 'Number of Services',
        },
      },
    },
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900">Staff Workload</h3>
        <FiUserCheck className="h-5 w-5 text-indigo-600" />
      </div>
      <div className="h-64">
        <Bar data={data} options={options} />
      </div>
    </div>
  );
};

const PriorityDistributionChart = ({ services }) => {
  const priorityData = useMemo(() => {
    const counts = { high: 0, medium: 0, low: 0 };
    
    services.forEach(service => {
      const priority = service.priority || 'medium';
      if (counts.hasOwnProperty(priority)) {
        counts[priority]++;
      }
    });

    return counts;
  }, [services]);

  const data = {
    labels: ['High', 'Medium', 'Low'],
    datasets: [
      {
        data: [priorityData.high, priorityData.medium, priorityData.low],
        backgroundColor: [
          'rgba(239, 68, 68, 0.8)',    // red for high
          'rgba(245, 158, 11, 0.8)',   // amber for medium
          'rgba(16, 185, 129, 0.8)',   // emerald for low
        ],
        borderColor: [
          'rgb(239, 68, 68)',
          'rgb(245, 158, 11)',
          'rgb(16, 185, 129)',
        ],
        borderWidth: 2,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right',
        labels: {
          boxWidth: 12,
          padding: 15,
          font: { size: 12 },
          generateLabels: (chart) => {
            const data = chart.data;
            if (data.labels.length && data.datasets.length) {
              return data.labels.map((label, i) => {
                const dataset = data.datasets[0];
                const value = dataset.data[i];
                const total = dataset.data.reduce((a, b) => a + b, 0);
                const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                return {
                  text: `${label}: ${value} (${percentage}%)`,
                  fillStyle: dataset.backgroundColor[i],
                  strokeStyle: dataset.borderColor[i],
                  lineWidth: dataset.borderWidth,
                  hidden: false,
                  index: i
                };
              });
            }
            return [];
          }
        }
      },
      tooltip: {
        callbacks: {
          label: function(context) {
            const label = context.label || '';
            const value = context.raw || 0;
            const total = context.dataset.data.reduce((a, b) => a + b, 0);
            const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
            return `${label}: ${value} (${percentage}%)`;
          }
        }
      },
      title: {
        display: true,
        text: 'Service Priority Distribution',
        position: 'top',
      },
    },
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900">Priority Levels</h3>
        <FiAlertCircle className="h-5 w-5 text-indigo-600" />
      </div>
      <div className="h-64 relative">
        <Pie data={data} options={options} />
      </div>
    </div>
  );
};

const ServiceCompletionRateChart = ({ services }) => {
  const completionData = useMemo(() => {
    const monthlyCompletion = {};
    
    services.forEach(service => {
      const date = new Date(service.date);
      const monthYear = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
      
      if (!monthlyCompletion[monthYear]) {
        monthlyCompletion[monthYear] = { total: 0, completed: 0 };
      }
      
      monthlyCompletion[monthYear].total++;
      if (service.status === 'Completed') {
        monthlyCompletion[monthYear].completed++;
      }
    });

    const completionRates = Object.entries(monthlyCompletion)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([month, data]) => ({
        month: new Date(month).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        rate: (data.completed / data.total) * 100
      }));

    return completionRates;
  }, [services]);

  const data = {
    labels: completionData.map(item => item.month),
    datasets: [
      {
        label: 'Completion Rate (%)',
        data: completionData.map(item => item.rate),
        borderColor: 'rgb(16, 185, 129)',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        tension: 0.4,
        fill: true,
      },
    ],
  };

  const options = {
    responsive: true,
    plugins: {
      title: {
        display: true,
        text: 'Service Completion Rate Trend',
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        max: 100,
        title: {
          display: true,
          text: 'Completion Rate (%)',
        },
      },
    },
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900">Completion Trends</h3>
        <FiTrendingUp className="h-5 w-5 text-indigo-600" />
      </div>
      <div className="h-64">
        <Line data={data} options={options} />
      </div>
    </div>
  );
};

// StatCard Component
const StatCard = ({ title, value, icon: Icon, color, subtitle }) => (
  <motion.div
    whileHover={{ y: -2 }}
    className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-lg transition-all duration-300"
  >
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
        <p className="text-2xl font-bold text-gray-900 mb-1">{value}</p>
        <p className="text-sm text-gray-500">{subtitle}</p>
      </div>
      <div className={`p-3 rounded-xl ${color}`}>
        <Icon className="h-6 w-6 text-white" />
      </div>
    </div>
  </motion.div>
);

const SuperAdminServiceLogs = () => {
  const [services, setServices] = useState([]);
  const [filteredServices, setFilteredServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [staffFilter, setStaffFilter] = useState('all');
  const [serviceTypeFilter, setServiceTypeFilter] = useState('all');
  const [subcategoryFilter, setSubcategoryFilter] = useState('all');
  const [dateRange, setDateRange] = useState('all');
  const [centreFilter, setCentreFilter] = useState('all');
  const [centres, setCentres] = useState([]);
  const [selectedService, setSelectedService] = useState(null);
  const [viewMode, setViewMode] = useState('grid');
  const [sortBy, setSortBy] = useState('date');
  const [sortOrder, setSortOrder] = useState('desc');
  const [activeDetailTab, setActiveDetailTab] = useState('overview');
  const [showCharts, setShowCharts] = useState(true);

  // Map backend status to frontend status
  const statusMap = {
    'pending': 'Pending',
    'in_progress': 'In Progress',
    'completed': 'Completed',
    'rejected': 'Delayed',
    'resubmit': 'Resubmit',
    'paid': 'Paid'
  };

  const reverseStatusMap = {
    'Pending': 'pending',
    'In Progress': 'in_progress',
    'Completed': 'completed',
    'Delayed': 'rejected',
    'Resubmit': 'resubmit',
    'Paid': 'paid'
  };

  const paymentStatusConfig = {
    'Not Applicable': { color: 'text-gray-600', bg: 'bg-gray-50', border: 'border-gray-200', dot: 'bg-gray-400' },
    'Received': { color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', dot: 'bg-emerald-500' },
    'Partial': { color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200', dot: 'bg-amber-400' },
    'Pending': { color: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-200', dot: 'bg-rose-500' },
    'Processing': { color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200', dot: 'bg-blue-500' },
    'default': { color: 'text-gray-600', bg: 'bg-gray-50', border: 'border-gray-200', dot: 'bg-gray-400' }
  };

  const statusConfig = {
    'Pending': { color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200', dot: 'bg-amber-400' },
    'In Progress': { color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200', dot: 'bg-blue-500' },
    'Delayed': { color: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-200', dot: 'bg-rose-500' },
    'Completed': { color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', dot: 'bg-emerald-500' },
    'Resubmit': { color: 'text-yellow-600', bg: 'bg-yellow-50', border: 'border-yellow-200', dot: 'bg-yellow-400' },
    'Paid': { color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200', dot: 'bg-green-500' }
  };

  const priorityConfig = {
    'low': { color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', label: 'Low' },
    'medium': { color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200', label: 'Medium' },
    'high': { color: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-200', label: 'High' }
  };

  // Fetch centres
  const fetchCentres = async () => {
    try {
      const response = await axios.get(`${import.meta.env.VITE_API_URL}/api//centres`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      console.log('SuperAdminServiceLogs: Fetched centres:', response.data);
      return response.data;
    } catch (error) {
      console.error('SuperAdminServiceLogs: Error fetching centres:', error);
      toast.error('Failed to fetch centres: ' + (error.response?.data?.error || error.message));
      return [];
    }
  };

  // Fetch service entries
  const fetchServiceEntries = async () => {
    try {
      const response = await getServiceEntries();
      const entries = Array.isArray(response) ? response : response.data || [];
      console.log('SuperAdminServiceLogs: Fetched service entries:', JSON.stringify(entries, null, 2));
      return entries;
    } catch (error) {
      console.error('SuperAdminServiceLogs: Error fetching service entries:', error);
      toast.error('Failed to fetch service entries: ' + (error.response?.data?.error || error.message));
      return [];
    }
  };

  // Fetch payment details
  const fetchPaymentDetails = async (serviceEntryId, tokenId, serviceEntries) => {
    try {
      let serviceEntry;
      if (tokenId) {
        const response = await getServiceEntryByTokenId(tokenId);
        serviceEntry = response;
      } else {
        serviceEntry = serviceEntries.find(entry => entry.id === serviceEntryId);
      }
      if (!serviceEntry) {
        console.warn(`SuperAdminServiceLogs: No service entry found for serviceEntryId: ${serviceEntryId}, tokenId: ${tokenId}`);
        return { payments: [], totalCharge: 0, paymentStatus: 'Not Applicable', paymentDetails: 'No payments recorded' };
      }

      const payments = Array.isArray(serviceEntry.payments) ? serviceEntry.payments : [];
      const totalCharge = parseFloat(serviceEntry.totalCharge || serviceEntry.total_charges || 0);
      const totalReceived = payments
        .filter(p => p.status === 'received')
        .reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);

      let paymentStatus;
      if (totalCharge <= 0) {
        paymentStatus = 'Not Applicable';
      } else if (totalReceived >= totalCharge) {
        paymentStatus = 'Received';
      } else if (totalReceived > 0) {
        paymentStatus = 'Partial';
      } else {
        paymentStatus = 'Pending';
      }

      const paymentDetails = formatPayments(payments);

      console.log('SuperAdminServiceLogs: Payment details for serviceEntryId:', serviceEntryId, {
        totalReceived,
        totalCharge,
        paymentStatus,
        payments,
        paymentDetails
      });

      return {
        payments,
        totalCharge,
        paymentStatus,
        paymentDetails
      };
    } catch (err) {
      console.error('SuperAdminServiceLogs: Error processing payment details:', err);
      return { payments: [], totalCharge: 0, paymentStatus: 'Pending', paymentDetails: 'Error fetching payments' };
    }
  };

  // Format payments
  const formatPayments = (payments) => {
    if (!Array.isArray(payments) || payments.length === 0) return 'No payments recorded';
    return payments.map(p => {
      const method = p.method === 'cash' ? 'Cash' : p.method === 'digital_wallet' ? 'Digital Wallet' : p.method;
      return `${method}: ₹${Number(p.amount).toFixed(2)} (${p.status})`;
    }).join(', ');
  };

  // Initialize data
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        console.log('SuperAdminServiceLogs: Starting data load...');
        
        const [centresData, trackingResponse, serviceEntries] = await Promise.all([
          fetchCentres(),
          getTrackingEntries(centreFilter !== 'all' ? { centre_id: centreFilter } : {}),
          fetchServiceEntries()
        ]);

        console.log('SuperAdminServiceLogs: Raw tracking response:', JSON.stringify(trackingResponse, null, 2));
        console.log('SuperAdminServiceLogs: Service entries:', JSON.stringify(serviceEntries, null, 2));
        console.log('SuperAdminServiceLogs: Centres:', JSON.stringify(centresData, null, 2));

        setCentres(centresData);

        const trackingData = Array.isArray(trackingResponse) 
          ? trackingResponse 
          : trackingResponse.data || [];

        if (trackingData.length === 0) {
          console.warn('SuperAdminServiceLogs: No tracking data found');
          setServices([]);
          setFilteredServices([]);
          toast.warn('No service tracking entries found. Please check the database or filters.');
          return;
        }

        const transformed = await transformBackendData(trackingData, serviceEntries, centresData);
        console.log('SuperAdminServiceLogs: Transformed data:', JSON.stringify(transformed, null, 2));

        console.log('=== Service IDs and Steps Debug ===');
        transformed.forEach((service, index) => {
          console.log(`Service ${index + 1}:`, {
            id: service.id,
            serviceEntryId: service.serviceEntryId,
            customerName: service.customerName,
            applicationNumber: service.applicationNumber,
            status: service.status,
            paymentStatus: service.paymentStatus,
            centreName: service.centreName,
            workSource: service.workSource,
            serviceRating: service.serviceRating,
            staffRating: service.staffRating,
            reviewText: service.reviewText,
            steps: service.steps
          });
        });
        
        setServices(transformed);
        setFilteredServices(transformed);
        toast.success(`Loaded ${transformed.length} service tracking entries`);
      } catch (err) {
        console.error("SuperAdminServiceLogs: Error loading service logs:", err);
        toast.error(`Failed to load service logs: ${err.response?.data?.error || err.message}`);
        setServices([]);
        setFilteredServices([]);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [centreFilter]);

  // Transform backend data
  const transformBackendData = async (trackingData, serviceEntries, centres) => {
    const transformed = [];
    for (const trackingEntry of trackingData) {
      const paymentData = await fetchPaymentDetails(
        trackingEntry.service_entry_id,
        trackingEntry.token_id,
        serviceEntries
      );

      const updatedDate = new Date(trackingEntry.updated_at || Date.now());
      const dateStr = updatedDate.toISOString().split('T')[0];
      const timeStr = updatedDate.toTimeString().split(' ')[0].substring(0, 5);

      // Determine work source
      const workSource = trackingEntry.work_source || 
                        (trackingEntry.customer_service_id ? 'online' : 'offline');

      // Find centre using trackingEntry.centre_id
      const centre = centres.find(c => c.id === trackingEntry.centre_id);

      transformed.push({
        id: trackingEntry.id.toString(),
        serviceEntryId: trackingEntry.service_entry_id?.toString(),
        trackingId: `TR-${trackingEntry.id}`,
        applicationNumber: trackingEntry.application_number || `APP${trackingEntry.service_entry_id}`,
        customerName: trackingEntry.customer_name || 'Unknown',
        customerPhone: trackingEntry.phone || 'N/A',
        customerEmail: trackingEntry.email || `${trackingEntry.customer_name?.toLowerCase().replace(/\s+/g, '') || 'unknown'}@example.com`,
        address: 'Address not available',
        serviceType: trackingEntry.service_name || 'Unknown',
        subcategoryName: trackingEntry.subcategory_name || 'N/A',
        categoryId: trackingEntry.category_id,
        subcategoryId: trackingEntry.subcategory_id,
        staffName: trackingEntry.assigned_to_name || 'Unassigned',
        staffId: trackingEntry.assigned_to ? `EMP-${trackingEntry.assigned_to}` : 'EMP-0000',
        assignedTo: trackingEntry.assigned_to_name || 'Unassigned',
        assignedToId: trackingEntry.assigned_to,
        serviceCharge: parseFloat(trackingEntry.service_charges) || 0,
        departmentCharge: parseFloat(trackingEntry.department_charges) || 0,
        totalCharge: paymentData.totalCharge || 0,
        cost: paymentData.totalCharge || 0,
        status: statusMap[trackingEntry.status] || 'Pending',
        currentStep: trackingEntry.current_step || 'Submitted',
        progress: trackingEntry.progress || 0,
        priority: trackingEntry.priority || 'medium',
        date: dateStr,
        time: timeStr,
        estimatedDelivery: trackingEntry.estimated_delivery && !isNaN(new Date(trackingEntry.estimated_delivery)) ? new Date(trackingEntry.estimated_delivery).toISOString() : 'Not set',
        expiryDate: trackingEntry.expiry_date && !isNaN(new Date(trackingEntry.expiry_date)) ? new Date(trackingEntry.expiry_date).toISOString() : 'Not set',
        createdAt: trackingEntry.created_at && !isNaN(new Date(trackingEntry.created_at)) ? new Date(trackingEntry.created_at).toISOString() : new Date().toISOString(),
        updatedAt: trackingEntry.updated_at && !isNaN(new Date(trackingEntry.updated_at)) ? new Date(trackingEntry.updated_at).toISOString() : new Date().toISOString(),
        duration: null,
        notes: trackingEntry.notes || 'No notes available',
        rating: null,
        followUpRequired: trackingEntry.status === 'rejected' || trackingEntry.status === 'resubmit',
        paymentStatus: paymentData.paymentStatus,
        paymentDetails: paymentData.paymentDetails,
        payments: paymentData.payments,
        steps: Array.isArray(trackingEntry.steps) && trackingEntry.steps.length > 0 
          ? trackingEntry.steps.map(step => ({
              id: step.id,
              name: step.name || 'Unnamed Step',
              completed: step.completed || false,
              date: step.date && !isNaN(new Date(step.date)) ? new Date(step.date).toISOString() : null,
              created_at: step.created_at && !isNaN(new Date(step.created_at)) ? new Date(step.created_at).toISOString() : new Date().toISOString(),
              step_order: parseInt(step.step_order) || 0,
              estimated_days: parseInt(step.estimated_days) || 0
            })).filter(step => step.name && step.step_order > 0)
          : [
              { name: 'Submitted', completed: true, date: trackingEntry.created_at || new Date().toISOString(), step_order: 1, estimated_days: 1, created_at: new Date().toISOString() },
              { name: 'Initial Review', completed: trackingEntry.status !== 'pending', date: trackingEntry.status !== 'pending' ? trackingEntry.updated_at : null, step_order: 2, estimated_days: 3, created_at: new Date().toISOString() },
              { name: 'Document Verification', completed: ['completed', 'paid'].includes(trackingEntry.status) || trackingEntry.current_step === 'Document Verification', date: ['completed', 'paid'].includes(trackingEntry.status) || trackingEntry.current_step === 'Document Verification' ? trackingEntry.updated_at : null, step_order: 3, estimated_days: 5, created_at: new Date().toISOString() },
              { name: 'Final Approval', completed: ['completed', 'paid'].includes(trackingEntry.status), date: ['completed', 'paid'].includes(trackingEntry.status) ? trackingEntry.updated_at : null, step_order: 4, estimated_days: 2, created_at: new Date().toISOString() }
            ],
        centreId: trackingEntry.centre_id || null,
        centreName: centre ? centre.name : 'Unknown Centre',
        
        // Source information
        workSource: workSource,

        // Review information
        serviceRating: trackingEntry.service_rating,
        staffRating: trackingEntry.staff_rating,
        reviewText: trackingEntry.review_text,
        reviewSubmittedAt: trackingEntry.submitted_at,
        aadhaar: trackingEntry.aadhaar || 'N/A'
      });
    }
    return transformed;
  };

  // Get unique values for filters
  const staffMembers = useMemo(() => {
    const staff = [...new Set(services.map(service => service.staffName))];
    return staff.sort();
  }, [services]);

  const serviceTypes = useMemo(() => {
    const types = [...new Set(services.map(service => service.serviceType))];
    return types.sort();
  }, [services]);

  const subcategories = useMemo(() => {
    const subs = [...new Set(services.map(service => service.subcategoryName))];
    return subs.sort();
  }, [services]);

  const uniqueCentres = useMemo(() => {
    return centres.sort((a, b) => a.name.localeCompare(b.name));
  }, [centres]);

  // Filter and sort services
  useEffect(() => {
    let filtered = services;

    if (searchTerm) {
      filtered = filtered.filter(service =>
        (service.customerName?.toLowerCase().includes(searchTerm.toLowerCase()) || false) ||
        (service.serviceType?.toLowerCase().includes(searchTerm.toLowerCase()) || false) ||
        (service.applicationNumber?.toLowerCase().includes(searchTerm.toLowerCase()) || false) ||
        (service.staffName?.toLowerCase().includes(searchTerm.toLowerCase()) || false) ||
        (service.customerPhone?.includes(searchTerm) || false) ||
        (service.subcategoryName?.toLowerCase().includes(searchTerm.toLowerCase()) || false) ||
        (service.centreName?.toLowerCase().includes(searchTerm.toLowerCase()) || false)
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(service => service.status === statusFilter);
    }

    if (priorityFilter !== 'all') {
      filtered = filtered.filter(service => service.priority === priorityFilter);
    }

    if (staffFilter !== 'all') {
      filtered = filtered.filter(service => service.staffName === staffFilter);
    }

    if (serviceTypeFilter !== 'all') {
      filtered = filtered.filter(service => service.serviceType === serviceTypeFilter);
    }

    if (subcategoryFilter !== 'all') {
      filtered = filtered.filter(service => service.subcategoryName === subcategoryFilter);
    }

    if (dateRange !== 'all') {
      const now = new Date();
      const filterDate = new Date();
      
      switch (dateRange) {
        case 'today':
          filtered = filtered.filter(service => service.date === now.toISOString().split('T')[0]);
          break;
        case 'week':
          filterDate.setDate(now.getDate() - 7);
          filtered = filtered.filter(service => new Date(service.date) >= filterDate);
          break;
        case 'month':
          filterDate.setMonth(now.getMonth() - 1);
          filtered = filtered.filter(service => new Date(service.date) >= filterDate);
          break;
        default:
          break;
      }
    }

    filtered.sort((a, b) => {
      let aValue, bValue;
      
      switch (sortBy) {
        case 'date':
          aValue = new Date(a.date);
          bValue = new Date(b.date);
          break;
        case 'customer':
          aValue = a.customerName?.toLowerCase() || '';
          bValue = b.customerName?.toLowerCase() || '';
          break;
        case 'service':
          aValue = a.serviceType?.toLowerCase() || '';
          bValue = b.serviceType?.toLowerCase() || '';
          break;
        case 'subcategory':
          aValue = a.subcategoryName?.toLowerCase() || '';
          bValue = b.subcategoryName?.toLowerCase() || '';
          break;
        case 'staff':
          aValue = a.staffName?.toLowerCase() || '';
          bValue = b.staffName?.toLowerCase() || '';
          break;
        case 'cost':
          aValue = a.cost || 0;
          bValue = b.cost || 0;
          break;
        case 'priority':
          const priorityOrder = { high: 3, medium: 2, low: 1 };
          aValue = priorityOrder[a.priority] || 0;
          bValue = priorityOrder[b.priority] || 0;
          break;
        case 'centre':
          aValue = a.centreName?.toLowerCase() || '';
          bValue = b.centreName?.toLowerCase() || '';
          break;
        default:
          aValue = a[sortBy] || '';
          bValue = b[sortBy] || '';
      }

      if (sortOrder === 'desc') {
        return aValue < bValue ? 1 : aValue > bValue ? -1 : 0;
      } else {
        return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
      }
    });

    setFilteredServices(filtered);
  }, [
    searchTerm, statusFilter, priorityFilter, staffFilter, 
    serviceTypeFilter, subcategoryFilter, dateRange, centreFilter,
    sortBy, sortOrder, services
  ]);

  // Statistics
  const stats = useMemo(() => {
    const total = services.length;
    const completed = services.filter(s => s.status === 'Completed').length;
    const inProgress = services.filter(s => s.status === 'In Progress').length;
    const pending = services.filter(s => s.status === 'Pending').length;
    const delayed = services.filter(s => s.status === 'Delayed').length;
    const followUpRequired = services.filter(s => s.followUpRequired).length;
    
    const avgProgress = services.length > 0 
      ? (services.reduce((sum, service) => sum + (service.progress || 0), 0) / services.length).toFixed(1)
      : 0;

    const completionRate = total > 0 ? ((completed / total) * 100).toFixed(1) : 0;

    return {
      total,
      completed,
      inProgress,
      pending,
      delayed,
      followUpRequired,
      avgProgress,
      completionRate
    };
  }, [services]);

  // Update service status
  const handleStatusUpdate = async (serviceId, newStatus) => {
    try {
      console.log('SuperAdminServiceLogs: Updating status for tracking ID:', serviceId, 'to:', newStatus);
      const backendStatus = reverseStatusMap[newStatus];
      await updateTrackingStatus(serviceId, backendStatus);
      
      setServices(prev => prev.map(service => 
        service.id === serviceId 
          ? { ...service, status: newStatus }
          : service
      ));
      
      toast.success(`Status updated to ${newStatus}`);
    } catch (error) {
      console.error('Failed to update status:', error);
      toast.error('Failed to update status: ' + (error.response?.data?.error || error.message));
    }
  };

  // Send notification
  const handleNotifyCustomer = async (service) => {
    try {
      console.log('SuperAdminServiceLogs: Sending notification for service:', {
        id: service.id,
        serviceEntryId: service.serviceEntryId,
        customerName: service.customerName,
        applicationNumber: service.applicationNumber,
        status: service.status
      });
      
      await notifyCustomer(service.id, `Dear ${service.customerName}, your ${service.serviceType} application (App No: ${service.applicationNumber || 'N/A'}) is now ${service.status}.`);
      toast.success(`Notification sent to ${service.customerName} via WhatsApp`);
    } catch (error) {
      console.error('SuperAdminServiceLogs: Error sending notification:', error);
      console.error('Service object that failed:', service);
      toast.error('Failed to send notification: ' + (error.response?.data?.error || error.message));
    }
  };

  const ServiceCard = ({ service, onClick, statusConfig, priorityConfig, paymentStatusConfig }) => {
    const status = statusConfig[service.status] || statusConfig['Pending'];
    const priority = priorityConfig[service.priority] || priorityConfig['medium'];
    const paymentStatus = paymentStatusConfig[service.paymentStatus] || paymentStatusConfig['default'];

    return (
      <motion.div
        whileHover={{ y: -2 }}
        className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-lg transition-all duration-300 cursor-pointer group"
        onClick={onClick}
      >
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-indigo-500 rounded-xl flex items-center justify-center group-hover:bg-indigo-600 transition-colors duration-200">
              <FiUserCheck className="h-6 w-6 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">{service.customerName || 'Unknown'}</h3>
              <p className="text-sm text-gray-500">{service.serviceType || 'Unknown'}</p>
              <p className="text-xs text-gray-400">{service.subcategoryName || 'N/A'}</p>
              <p className="text-xs text-gray-400">{service.centreName}</p>
            </div>
          </div>
          <div className="flex flex-col items-end space-y-2">
            <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${status.bg} ${status.color}`}>
              {service.status}
            </span>
            <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${priority.bg} ${priority.color}`}>
              {priority.label}
            </span>
          </div>
        </div>

        {/* Source Badge */}
        <div className="mb-3">
          {service.workSource === "online" ? (
            <span className="px-2.5 py-1 text-xs font-medium bg-green-100 text-green-700 rounded-full border border-green-200">
              Online Booking
            </span>
          ) : (
            <span className="px-2.5 py-1 text-xs font-medium bg-blue-100 text-blue-700 rounded-full border border-blue-200">
              Offline Walk-in
            </span>
          )}
        </div>

        {/* Review Preview */}
        {service.serviceRating && (
          <div className="mb-4 p-2 bg-amber-50 rounded-lg border border-amber-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-1">
                <FiStar className="h-3 w-3 text-amber-500 fill-amber-500" />
                <span className="text-xs font-medium text-amber-700">Rating: {service.serviceRating}/5</span>
              </div>
              {service.staffRating && (
                <span className="text-xs text-amber-600">Staff: {service.staffRating}/5</span>
              )}
            </div>
          </div>
        )}

        <div className="space-y-3 mb-4">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center space-x-2 text-gray-600">
              <FiUser className="h-4 w-4" />
              <span>Staff</span>
            </div>
            <span className="font-medium">{service.staffName}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center space-x-2 text-gray-600">
              <FiCalendar className="h-4 w-4" />
              <span>Date</span>
            </div>
            <span className="font-medium">{service.date}</span>
          </div>
          {service.cost > 0 && (
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center space-x-2 text-gray-600">
                <FiDollarSign className="h-4 w-4" />
                <span>Cost</span>
              </div>
              <span className="font-medium text-emerald-600">₹{service.cost.toFixed(2)}</span>
            </div>
          )}
        </div>

        <div className="pt-4 border-t border-gray-200">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-gray-600">Progress</span>
            <span className="font-medium">{service.progress}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-indigo-500 h-2 rounded-full transition-all duration-500"
              style={{ width: `${service.progress}%` }}
            />
          </div>
        </div>
      </motion.div>
    );
  };

  const ServiceListRow = ({ service, onClick, statusConfig, priorityConfig }) => {
    const status = statusConfig[service.status] || statusConfig['Pending'];
    const priority = priorityConfig[service.priority] || priorityConfig['medium'];

    return (
      <motion.tr
        whileHover={{ backgroundColor: 'rgba(243, 244, 246, 0.5)' }}
        className="border-b border-gray-200 hover:bg-gray-50 cursor-pointer transition-colors"
        onClick={onClick}
      >
        <td className="py-4 px-4 whitespace-nowrap">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-indigo-500 rounded-lg flex items-center justify-center flex-shrink-0">
              <FiUserCheck className="h-5 w-5 text-white" />
            </div>
            <div className="min-w-0">
              <p className="font-medium text-gray-900 truncate max-w-[150px]" title={service.customerName || 'Unknown'}>
                {service.customerName || 'Unknown'}
              </p>
              <p className="text-sm text-gray-500 truncate max-w-[150px]" title={service.applicationNumber || 'N/A'}>
                {service.applicationNumber || 'N/A'}
              </p>
            </div>
          </div>
        </td>
        <td className="py-4 px-4 whitespace-nowrap">
          <p className="text-sm text-gray-900 truncate max-w-[120px]" title={service.serviceType || 'Unknown'}>
            {service.serviceType || 'Unknown'}
          </p>
        </td>
        <td className="py-4 px-4 whitespace-nowrap">
          <p className="text-sm text-gray-900 truncate max-w-[120px]" title={service.subcategoryName || 'N/A'}>
            {service.subcategoryName || 'N/A'}
          </p>
        </td>
        <td className="py-4 px-4 whitespace-nowrap">
          <p className="text-sm text-gray-900 truncate max-w-[120px]" title={service.centreName}>
            {service.centreName}
          </p>
        </td>
        <td className="py-4 px-4 whitespace-nowrap">
          <p className="text-sm text-gray-900 truncate max-w-[120px]" title={service.staffName}>
            {service.staffName}
          </p>
        </td>
        <td className="py-4 px-4 whitespace-nowrap">
          <p className="text-sm text-gray-600">{service.date}</p>
        </td>
        <td className="py-4 px-4 whitespace-nowrap">
          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${status.bg} ${status.color} whitespace-nowrap`}>
            {service.status}
          </span>
        </td>
        <td className="py-4 px-4 whitespace-nowrap">
          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${priority.bg} ${priority.color} whitespace-nowrap`}>
            {priority.label}
          </span>
        </td>
        <td className="py-4 px-4 whitespace-nowrap">
          <div className="flex flex-col space-y-1 min-w-[100px]">
            <span className={`text-xs px-2 py-0.5 rounded-full inline-flex items-center justify-center ${service.workSource === 'online' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
              {service.workSource === 'online' ? 'Online' : 'Offline'}
            </span>
            {service.serviceRating && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 inline-flex items-center justify-center">
                <FiStar className="h-3 w-3 mr-1 fill-amber-500" />
                {service.serviceRating}/5
              </span>
            )}
          </div>
        </td>
        <td className="py-4 px-4 whitespace-nowrap">
          {service.cost > 0 ? (
            <p className="text-sm font-medium text-emerald-600">₹{service.cost.toFixed(2)}</p>
          ) : (
            <p className="text-sm text-gray-400">-</p>
          )}
        </td>
        <td className="py-4 px-4 whitespace-nowrap">
          <div className="flex items-center space-x-2 min-w-[100px]">
            <div className="w-16 bg-gray-200 rounded-full h-2 flex-shrink-0">
              <div
                className="bg-indigo-500 h-2 rounded-full transition-all duration-500"
                style={{ width: `${service.progress}%` }}
              />
            </div>
            <span className="text-xs text-gray-600 w-8">{service.progress}%</span>
          </div>
        </td>
        <td className="py-4 px-4 whitespace-nowrap">
          <div className="flex items-center space-x-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClick(service);
              }}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="View Details"
            >
              <FiEye className="h-4 w-4 text-gray-600" />
            </button>
          </div>
        </td>
      </motion.tr>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Loading service logs...</p>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gray-50">
        <SafeToastContainer />
        
        {/* Header */}
        <div className="bg-white border-b border-gray-200 sticky top-0 z-30">
          <div className="max-w-[98%] 2xl:max-w-[1600px] mx-auto px-4 sm:px-6 py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-indigo-500 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0">
                  <FiUsers className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Super Admin Service Logs</h1>
                  <p className="text-gray-600">Monitor and manage service entries across all centres</p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setShowCharts(!showCharts)}
                  className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  {showCharts ? <FiEye className="h-4 w-4" /> : <FiBarChart2 className="h-4 w-4" />}
                  <span>{showCharts ? 'Hide Charts' : 'Show Charts'}</span>
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex items-center space-x-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
                  onClick={() => toast.success('Export started')}
                >
                  <FiDownload className="h-4 w-4" />
                  <span>Export</span>
                </motion.button>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-[98%] 2xl:max-w-[1600px] mx-auto px-4 sm:px-6 py-8">
          {/* Stats Overview */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-8">
            <StatCard
              title="Total Services"
              value={stats.total}
              subtitle="All services"
              icon={FiUsers}
              color="bg-blue-500"
            />
            <StatCard
              title="Completed"
              value={stats.completed}
              subtitle={`${stats.completionRate}% rate`}
              icon={FiCheckCircle}
              color="bg-emerald-500"
            />
            <StatCard
              title="In Progress"
              value={stats.inProgress}
              subtitle="Active now"
              icon={FiTrendingUp}
              color="bg-amber-500"
            />
            <StatCard
              title="Pending"
              value={stats.pending}
              subtitle="Awaiting action"
              icon={FiClock}
              color="bg-purple-500"
            />
            <StatCard
              title="Follow-up"
              value={stats.followUpRequired}
              subtitle="Need attention"
              icon={FiAlertCircle}
              color="bg-rose-500"
            />
            <StatCard
              title="Avg Progress"
              value={`${stats.avgProgress}%`}
              subtitle="Overall progress"
              icon={FiBarChart2}
              color="bg-indigo-500"
            />
          </div>

          {/* Charts Section */}
          {showCharts && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-8"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900">Service Analytics</h2>
                <div className="flex items-center space-x-2 text-sm text-gray-600">
                  <FiBarChart2 className="h-4 w-4" />
                  <span>Service & Staff Performance</span>
                </div>
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                <StatusDistributionChart services={services} />
                <MonthlyServiceTrendChart services={services} />
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                <ServiceTypeDistributionChart services={services} />
                <StaffWorkloadChart services={services} />
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <PriorityDistributionChart services={services} />
                <ServiceCompletionRateChart services={services} />
              </div>

              {/* Quick Insights */}
              <div className="mt-6 bg-white rounded-xl border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-900">Service Insights</h3>
                  <FiTrendingUp className="h-5 w-5 text-indigo-600" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
                    <span className="text-sm text-blue-700">Most Active Service</span>
                    <span className="font-semibold text-blue-900">
                      {(() => {
                        const serviceCounts = {};
                        services.forEach(s => {
                          const type = s.serviceType || 'Unknown';
                          serviceCounts[type] = (serviceCounts[type] || 0) + 1;
                        });
                        return Object.entries(serviceCounts).sort(([,a], [,b]) => b - a)[0]?.[0] || 'N/A';
                      })()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-emerald-50 rounded-lg">
                    <span className="text-sm text-emerald-700">Completion Rate</span>
                    <span className="font-semibold text-emerald-900">
                      {stats.completionRate}%
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-amber-50 rounded-lg">
                    <span className="text-sm text-amber-700">Busiest Staff</span>
                    <span className="font-semibold text-amber-900">
                      {(() => {
                        const staffCounts = {};
                        services.forEach(s => {
                          const staff = s.staffName || 'Unassigned';
                          staffCounts[staff] = (staffCounts[staff] || 0) + 1;
                        });
                        return Object.entries(staffCounts).sort(([,a], [,b]) => b - a)[0]?.[0] || 'N/A';
                      })()}
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Filters and Controls */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
            <div className="flex flex-col space-y-3">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                <div className="flex flex-col sm:flex-row gap-2 flex-1">
                  <div className="relative flex-1 sm:max-w-xs">
                    <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <input
                      type="text"
                      placeholder="Search services..."
                      className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 w-full"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <select
                      className="border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm min-w-[120px]"
                      value={centreFilter}
                      onChange={(e) => setCentreFilter(e.target.value)}
                    >
                      <option value="all">All Centres</option>
                      {uniqueCentres.map(centre => (
                        <option key={centre.id} value={centre.id}>{centre.name}</option>
                      ))}
                    </select>
                    <select
                      className="border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm min-w-[120px]"
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                    >
                      <option value="all">All Status</option>
                      <option value="Pending">Pending</option>
                      <option value="In Progress">In Progress</option>
                      <option value="Completed">Completed</option>
                      <option value="Delayed">Delayed</option>
                      <option value="Resubmit">Resubmit</option>
                      <option value="Paid">Paid</option>
                    </select>
                    <select
                      className="border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm min-w-[120px]"
                      value={priorityFilter}
                      onChange={(e) => setPriorityFilter(e.target.value)}
                    >
                      <option value="all">All Priority</option>
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                    <select
                      className="border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm min-w-[120px]"
                      value={staffFilter}
                      onChange={(e) => setStaffFilter(e.target.value)}
                    >
                      <option value="all">All Staff</option>
                      {staffMembers.map(staff => (
                        <option key={staff} value={staff}>{staff}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex border border-gray-300 rounded-lg overflow-hidden">
                    <button
                      onClick={() => setViewMode('grid')}
                      className={`p-2 ${viewMode === 'grid' ? 'bg-indigo-100 text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}
                      title="Grid View"
                    >
                      <FiGrid className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setViewMode('list')}
                      className={`p-2 ${viewMode === 'list' ? 'bg-indigo-100 text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}
                      title="List View"
                    >
                      <FiList className="h-4 w-4" />
                    </button>
                  </div>
                  <button
                    onClick={() => {
                      setSearchTerm('');
                      setStatusFilter('all');
                      setPriorityFilter('all');
                      setStaffFilter('all');
                      setServiceTypeFilter('all');
                      setSubcategoryFilter('all');
                      setDateRange('all');
                      setCentreFilter('all');
                      toast.info('Filters reset');
                    }}
                    className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    title="Reset Filters"
                  >
                    <FiRefreshCw className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 border-t pt-3">
                <select
                  className="border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm min-w-[140px]"
                  value={serviceTypeFilter}
                  onChange={(e) => setServiceTypeFilter(e.target.value)}
                >
                  <option value="all">All Service Types</option>
                  {serviceTypes.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
                <select
                  className="border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm min-w-[140px]"
                  value={subcategoryFilter}
                  onChange={(e) => setSubcategoryFilter(e.target.value)}
                >
                  <option value="all">All Subcategories</option>
                  {subcategories.map(sub => (
                    <option key={sub} value={sub}>{sub}</option>
                  ))}
                </select>
                <select
                  className="border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm min-w-[140px]"
                  value={dateRange}
                  onChange={(e) => setDateRange(e.target.value)}
                >
                  <option value="all">All Dates</option>
                  <option value="today">Today</option>
                  <option value="week">Last 7 Days</option>
                  <option value="month">Last 30 Days</option>
                </select>
              </div>
            </div>
          </div>

          {/* Results Count and Sort */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-2">
            <p className="text-sm text-gray-600">
              Showing <span className="font-semibold">{filteredServices.length}</span> of <span className="font-semibold">{services.length}</span> services
            </p>
            <div className="flex items-center gap-2">
              <select
                className="border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
              >
                <option value="date">Sort by Date</option>
                <option value="customer">Sort by Customer</option>
                <option value="service">Sort by Service Type</option>
                <option value="subcategory">Sort by Subcategory</option>
                <option value="staff">Sort by Staff</option>
                <option value="cost">Sort by Cost</option>
                <option value="priority">Sort by Priority</option>
                <option value="centre">Sort by Centre</option>
              </select>
              <button
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                className="p-1.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm"
              >
                {sortOrder === 'asc' ? '↑' : '↓'}
              </button>
            </div>
          </div>

          {/* Services View */}
          {viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              <AnimatePresence>
                {filteredServices.map((service) => (
                  <motion.div
                    key={service.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.2 }}
                  >
                    <ServiceCard
                      service={service}
                      onClick={() => setSelectedService(service)}
                      statusConfig={statusConfig}
                      priorityConfig={priorityConfig}
                      paymentStatusConfig={paymentStatusConfig}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
              <div className="min-w-[1400px]">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer & ID</th>
                      <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Service Type</th>
                      <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subcategory</th>
                      <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Centre</th>
                      <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Staff</th>
                      <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                      <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Priority</th>
                      <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Source/Review</th>
                      <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cost</th>
                      <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Progress</th>
                      <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    <AnimatePresence>
                      {filteredServices.map((service) => (
                        <ServiceListRow
                          key={service.id}
                          service={service}
                          onClick={() => setSelectedService(service)}
                          statusConfig={statusConfig}
                          priorityConfig={priorityConfig}
                        />
                      ))}
                    </AnimatePresence>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {filteredServices.length === 0 && (
            <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
              <FiSearch className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No services found</h3>
              <p className="text-gray-600">Try adjusting your search or filter criteria</p>
            </div>
          )}
        </div>

        {/* Side Panel */}
        <AnimatePresence>
          {selectedService && (
            <ServiceDetailsPanel
              service={selectedService}
              onClose={() => {
                setSelectedService(null);
                setActiveDetailTab('overview');
              }}
              activeTab={activeDetailTab}
              onTabChange={setActiveDetailTab}
              statusConfig={statusConfig}
              paymentStatusConfig={paymentStatusConfig}
              priorityConfig={priorityConfig}
              toast={toast}
              onStatusUpdate={handleStatusUpdate}
              onNotifyCustomer={handleNotifyCustomer}
            />
          )}
        </AnimatePresence>
      </div>
    </ErrorBoundary>
  );
};

// ServiceDetailsPanel Component
const ServiceDetailsPanel = ({ 
  service, 
  onClose, 
  activeTab, 
  onTabChange, 
  statusConfig, 
  paymentStatusConfig,
  priorityConfig, 
  toast,
  onStatusUpdate,
  onNotifyCustomer
}) => {
  const status = statusConfig[service.status] || statusConfig['Pending'];
  const priority = priorityConfig[service.priority] || priorityConfig['medium'];
  const paymentStatus = paymentStatusConfig[service.paymentStatus] || paymentStatusConfig['default'];

  const tabItems = [
    { id: 'overview', label: 'Overview', icon: FiFileText },
    { id: 'timeline', label: 'Timeline', icon: FiClock },
    { id: 'payments', label: 'Payments', icon: FiDollarSign },
    { id: 'reviews', label: 'Reviews', icon: FiStar },
  ];

  const handleAction = async (action, data = null) => {
    try {
      switch (action) {
        case 'Share':
          toast.success(`Sharing ${service.applicationNumber || 'N/A'}`);
          break;
        case 'Print':
          toast.success(`Printing ${service.applicationNumber || 'N/A'}`);
          break;
        case 'Notify Customer':
          await onNotifyCustomer(service);
          break;
        case 'Update Status':
          if (data) {
            await onStatusUpdate(service.id, data);
          }
          break;
        default:
          toast.info(`${action} action performed for ${service.applicationNumber || 'N/A'}`);
      }
    } catch (error) {
      toast.error(`Failed to perform ${action}: ${error.message}`);
    }
  };

  return (
    <>
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="fixed right-0 top-0 h-full w-full max-w-2xl bg-white shadow-2xl z-50 flex flex-col border-l border-gray-200"
      >
        <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
          <div className="flex items-center space-x-3">
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <FiArrowRight className="h-5 w-5 text-gray-600" />
            </button>
            <div>
              <h2 className="text-xl font-bold text-gray-900">{service.customerName || 'Unknown'}</h2>
              <p className="text-gray-600 flex items-center space-x-2">
                <span>{service.applicationNumber || 'N/A'}</span>
                <span>•</span>
                <span>{service.serviceType || 'Unknown'}</span>
                <span>•</span>
                <span>{service.subcategoryName || 'N/A'}</span>
                <span>•</span>
                <span>{service.centreName}</span>
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => handleAction('Share')}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Share"
            >
              <FiShare2 className="h-5 w-5 text-gray-600" />
            </button>
            <button
              onClick={() => handleAction('Print')}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Print"
            >
              <FiPrinter className="h-5 w-5 text-gray-600" />
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <FiX className="h-5 w-5 text-gray-600" />
            </button>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="border-b border-gray-200 bg-white">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <span className={`px-3 py-1.5 rounded-full text-sm font-medium ${status.bg} ${status.color}`}>
                  {service.status}
                </span>
                <span className={`px-3 py-1.5 rounded-full text-sm font-medium ${priority.bg} ${priority.color}`}>
                  {priority.label} Priority
                </span>
                {service.followUpRequired && (
                  <span className="px-3 py-1.5 rounded-full text-sm font-medium bg-amber-50 text-amber-700">
                    Follow-up Required
                  </span>
                )}
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handleAction('Notify Customer')}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center space-x-2"
                >
                  <FiMessageSquare className="h-4 w-4" />
                  <span>Notify</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Status Quick Actions */}
        <div className="border-b border-gray-200 bg-white p-4">
          <div className="flex flex-wrap gap-2">
            {Object.keys(statusConfig).map(statusKey => (
              <button
                key={statusKey}
                onClick={() => handleAction('Update Status', statusKey)}
                disabled={service.status === statusKey}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  service.status === statusKey 
                    ? `${statusConfig[statusKey].bg} ${statusConfig[statusKey].color} cursor-not-allowed`
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Mark as {statusKey}
              </button>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 bg-white">
          <nav className="flex space-x-8 px-6">
            {tabItems.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => onTabChange(tab.id)}
                  className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 transition-colors ${
                    activeTab === tab.id
                      ? 'border-indigo-500 text-indigo-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-6">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.2 }}
              >
                {activeTab === 'overview' && <OverviewTab service={service} paymentStatusConfig={paymentStatusConfig} priorityConfig={priorityConfig} />}
                {activeTab === 'timeline' && <TimelineTab service={service} />}
                {activeTab === 'payments' && <PaymentsTab service={service} paymentStatusConfig={paymentStatusConfig} />}
                {activeTab === 'reviews' && <ReviewsTab service={service} />}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </motion.div>
    </>
  );
};

// OverviewTab Component
const OverviewTab = ({ service, paymentStatusConfig, priorityConfig }) => (
  <div className="space-y-6">
    {/* Source Badge */}
    <div className="flex justify-end">
      {service.workSource === "online" ? (
        <span className="px-3 py-1 text-xs font-medium bg-green-100 text-green-700 rounded-full border border-green-200">
          Online Booking
        </span>
      ) : (
        <span className="px-3 py-1 text-xs font-medium bg-blue-100 text-blue-700 rounded-full border border-blue-200">
          Offline Walk-in
        </span>
      )}
    </div>

    {/* Progress */}
    <div className="bg-gray-50 rounded-xl p-6">
      <h3 className="font-semibold text-gray-900 mb-4">Service Progress</h3>
      <div className="space-y-4">
        <div className="flex justify-between text-sm">
          <span className="font-medium">Completion Progress</span>
          <span className="text-indigo-600 font-semibold">{service.progress}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div 
            className="bg-indigo-500 h-3 rounded-full transition-all duration-500"
            style={{ width: `${service.progress}%` }}
          ></div>
        </div>
        <div className="grid grid-cols-4 gap-2 text-xs text-gray-600">
          <div className="text-center">Submitted</div>
          <div className="text-center">Initial Review</div>
          <div className="text-center">Document Verification</div>
          <div className="text-center">Final Approval</div>
        </div>
      </div>
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Service Details */}
      <div className="space-y-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center space-x-2">
            <FiShoppingBag className="h-5 w-5 text-indigo-600" />
            <span>Service Information</span>
          </h3>
          <div className="space-y-3">
            <DetailRow label="Service Type" value={service.serviceType || 'Unknown'} />
            <DetailRow label="Subcategory" value={service.subcategoryName || 'N/A'} />
            <DetailRow label="Application Number" value={service.applicationNumber || 'N/A'} />
            <DetailRow label="Centre" value={service.centreName} />
            <DetailRow label="Current Step" value={service.currentStep || 'Submitted'} />
            <DetailRow label="Estimated Delivery" value={service.estimatedDelivery || 'Not set'} />
            <DetailRow label="Date & Time" value={`${service.date} at ${service.time}`} />
            <DetailRow 
              label="Priority" 
              value={
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${priorityConfig[service.priority]?.bg} ${priorityConfig[service.priority]?.border}`}>
                  <span className={priorityConfig[service.priority]?.color}>{priorityConfig[service.priority]?.label}</span>
                </span>
              } 
            />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center space-x-2">
            <FiUserCheck className="h-5 w-5 text-indigo-600" />
            <span>Customer Information</span>
          </h3>
          <div className="space-y-3">
            <DetailRow label="Customer Name" value={service.customerName || 'Unknown'} />
            <DetailRow label="Phone" value={service.customerPhone || 'N/A'} />
            <DetailRow label="Email" value={service.customerEmail || 'N/A'} />
            <DetailRow label="Aadhaar" value={service.aadhaar || 'N/A'} />
          </div>
        </div>
      </div>

      {/* Staff & Financial */}
      <div className="space-y-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center space-x-2">
            <FiUser className="h-5 w-5 text-indigo-600" />
            <span>Staff Information</span>
          </h3>
          <div className="space-y-3">
            <DetailRow label="Staff Name" value={service.staffName} />
            <DetailRow label="Staff ID" value={service.staffId} />
            <DetailRow label="Assigned To" value={service.assignedTo} />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center space-x-2">
            <FiDollarSign className="h-5 w-5 text-indigo-600" />
            <span>Financial Information</span>
          </h3>
          <div className="space-y-3">
            {service.serviceCharge > 0 && (
              <DetailRow label="Service Charge" value={`₹${service.serviceCharge.toFixed(2)}`} />
            )}
            {service.departmentCharge > 0 && (
              <DetailRow label="Department Charge" value={`₹${service.departmentCharge.toFixed(2)}`} />
            )}
            {service.totalCharge > 0 && (
              <DetailRow label="Total Charge" value={`₹${service.totalCharge.toFixed(2)}`} />
            )}
            <DetailRow 
              label="Payment Status" 
              value={service.paymentStatus} 
              valueClass={paymentStatusConfig[service.paymentStatus]?.color || paymentStatusConfig['default'].color} 
            />
          </div>
        </div>
      </div>
    </div>
  </div>
);

// PaymentsTab Component
const PaymentsTab = ({ service, paymentStatusConfig }) => {
  const paymentStatus = paymentStatusConfig[service.paymentStatus] || paymentStatusConfig['default'];

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-6">Payment Information</h3>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm text-gray-600">Total Amount</p>
              <p className="text-2xl font-bold text-gray-900">
                {service.totalCharge > 0 ? `₹${service.totalCharge.toFixed(2)}` : 'Not set'}
              </p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm text-gray-600">Payment Status</p>
              <p className={`text-lg font-semibold ${paymentStatus.color}`}>
                {service.paymentStatus}
              </p>
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm text-gray-600 mb-2">Payment Details</p>
            <p className="text-sm text-gray-900">
              {service.paymentDetails}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

// TimelineTab Component
const TimelineTab = ({ service }) => {
  const generateTimeline = (service) => {
    const timeline = [];
    const formatDate = (date) => {
      if (!date || isNaN(new Date(date))) {
        console.warn(`SuperAdminServiceLogs: Invalid date detected: ${date}`);
        return 'Not set';
      }
      return new Date(date).toLocaleString('en-IN', { 
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      }).replace(',', '');
    };

    const steps = Array.isArray(service.steps) && service.steps.length > 0 
      ? service.steps.sort((a, b) => a.step_order - b.step_order)
      : [
          { name: 'Submitted', completed: true, date: service.createdAt || new Date().toISOString(), step_order: 1, estimated_days: 1, created_at: new Date().toISOString() },
          { name: 'Initial Review', completed: service.status !== 'pending', date: service.status !== 'pending' ? service.updatedAt : null, step_order: 2, estimated_days: 3, created_at: new Date().toISOString() },
          { name: 'Document Verification', completed: ['completed', 'paid'].includes(service.status) || service.current_step === 'Document Verification', date: ['completed', 'paid'].includes(service.status) || service.current_step === 'Document Verification' ? service.updatedAt : null, step_order: 3, estimated_days: 5, created_at: new Date().toISOString() },
          { name: 'Final Approval', completed: ['completed', 'paid'].includes(service.status), date: ['completed', 'paid'].includes(service.status) ? service.updatedAt : null, step_order: 4, estimated_days: 2, created_at: new Date().toISOString() }
        ];

    console.log('SuperAdminServiceLogs: Steps for service', service.id, JSON.stringify(steps, null, 2));

    steps.forEach((step, index) => {
      let statusType;
      if (step.completed) {
        statusType = 'completed';
      } else if (index === steps.findIndex(s => !s.completed)) {
        statusType = 'current';
      } else {
        statusType = 'upcoming';
      }

      const estimatedDate = !step.completed && step.estimated_days 
        ? (() => {
            const lastCompletedStep = steps.slice(0, index).reverse().find(s => s.completed && s.date);
            const baseDate = lastCompletedStep && lastCompletedStep.date && !isNaN(new Date(lastCompletedStep.date)) 
              ? new Date(lastCompletedStep.date) 
              : new Date(service.createdAt || Date.now());
            if (isNaN(baseDate)) {
              console.warn(`SuperAdminServiceLogs: Invalid base date for step ${step.name}: ${baseDate}`);
              return 'Not set';
            }
            baseDate.setDate(baseDate.getDate() + (step.estimated_days || 1));
            return baseDate.toLocaleDateString('en-IN', { 
              day: '2-digit',
              month: 'short',
              year: 'numeric'
            });
          })()
        : service.estimatedDelivery || 'Not set';

      timeline.push({
        status: statusType,
        title: step.name,
        description: getDescription(step.name, service),
        time: step.completed 
          ? formatDate(step.date || service.createdAt || Date.now()) 
          : (statusType === 'current' ? formatDate(service.updatedAt || Date.now()) : `Estimated: ${estimatedDate}`),
        user: getUser(step.name, service)
      });
    });

    if (['Delayed', 'Resubmit'].includes(service.status)) {
      timeline.push({
        status: 'completed',
        title: 'Status Update',
        description: `Service marked as ${service.status}`,
        time: formatDate(service.updatedAt || Date.now()),
        user: service.staffName || 'System'
      });
    }

    return timeline;
  };

  const getDescription = (title, service) => {
    const descriptions = {
      'Submitted': 'Customer submitted service request through the portal',
      'Initial Review': 'Service request reviewed and assigned to staff',
      'Document Verification': 'Documents are being verified',
      'Final Approval': 'Waiting for final approval and completion'
    };
    return descriptions[title] || title;
  };

  const getUser = (title, service) => {
    const users = {
      'Submitted': 'System',
      'Initial Review': 'Admin',
      'Document Verification': service.staffName || 'Unassigned',
      'Final Approval': 'System'
    };
    return users[title] || 'System';
  };

  const timeline = generateTimeline(service);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-6">Service Timeline</h3>
        <div className="space-y-6">
          {timeline.length > 0 ? (
            timeline.map((item, index) => (
              <TimelineItem key={index} {...item} />
            ))
          ) : (
            <div className="text-center py-4 text-gray-500">
              No timeline events available
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ReviewsTab Component
const ReviewsTab = ({ service }) => {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-6 flex items-center space-x-2">
          <FiStar className="h-5 w-5 text-indigo-600" />
          <span>Customer Reviews</span>
        </h3>

        {service.serviceRating ? (
          <div className="space-y-6">
            {/* Service Rating */}
            <div className="bg-gray-50 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-medium text-gray-900">Service Rating</h4>
                <span className="text-2xl font-bold text-indigo-600">{service.serviceRating}/5</span>
              </div>
              <div className="flex items-center space-x-1 mb-2">
                {[...Array(5)].map((_, i) => (
                  <FiStar 
                    key={i} 
                    className={`h-6 w-6 ${i < service.serviceRating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`} 
                  />
                ))}
              </div>
            </div>

            {/* Staff Rating */}
            {service.staffRating && (
              <div className="bg-gray-50 rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-medium text-gray-900">Staff Rating</h4>
                  <span className="text-2xl font-bold text-indigo-600">{service.staffRating}/5</span>
                </div>
                <div className="flex items-center space-x-1 mb-2">
                  {[...Array(5)].map((_, i) => (
                    <FiStar 
                      key={i} 
                      className={`h-6 w-6 ${i < service.staffRating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`} 
                    />
                  ))}
                </div>
                <p className="text-sm text-gray-600 mt-2">
                  Staff Member: {service.staffName}
                </p>
              </div>
            )}

            {/* Review Text */}
            {service.reviewText && (
              <div className="bg-gray-50 rounded-xl p-6">
                <h4 className="font-medium text-gray-900 mb-3">Review Comments</h4>
                <div className="bg-white p-4 rounded-lg border border-gray-200">
                  <p className="text-gray-700 italic">"{service.reviewText}"</p>
                </div>
              </div>
            )}

            {/* Review Date */}
            {service.reviewSubmittedAt && (
              <div className="text-right">
                <p className="text-xs text-gray-500">
                  Submitted on {new Date(service.reviewSubmittedAt).toLocaleDateString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <FiStar className="h-8 w-8 text-gray-400" />
            </div>
            <h4 className="text-lg font-medium text-gray-900 mb-2">No Reviews Yet</h4>
            <p className="text-gray-600">This service hasn't received any customer reviews yet.</p>
          </div>
        )}
      </div>
    </div>
  );
};

// TimelineItem Component
const TimelineItem = ({ status, title, description, time, user }) => (
  <div className="flex space-x-4">
    <div className="flex flex-col items-center">
      <div className={`w-3 h-3 rounded-full ${
        status === 'completed' ? 'bg-emerald-500' :
        status === 'current' ? 'bg-indigo-500' :
        'bg-gray-300'
      }`}></div>
      {status !== 'upcoming' && <div className="w-0.5 h-full bg-gray-200 mt-1"></div>}
    </div>
    <div className="flex-1 pb-6">
      <div className="flex items-start justify-between mb-1">
        <h4 className="font-medium text-gray-900">{title}</h4>
        <span className="text-sm text-gray-500">{time}</span>
      </div>
      <p className="text-sm text-gray-600 mb-1">{description}</p>
      <p className="text-xs text-gray-500">By {user}</p>
    </div>
  </div>
);

// DetailRow Component
const DetailRow = ({ label, value, valueClass = "" }) => (
  <div className="flex justify-between items-center py-2">
    <span className="text-sm text-gray-600">{label}</span>
    <span className={`text-sm font-medium text-right ${valueClass}`}>{value}</span>
  </div>
);

export default SuperAdminServiceLogs;
