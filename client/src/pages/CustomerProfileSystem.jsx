import React, { useState, useEffect } from 'react';
import { 
  FiUser, FiPhone, FiCreditCard, FiCalendar, FiFolder, FiLink, 
  FiPlus, FiEdit, FiTrash2, FiSearch, FiChevronDown, FiCheck, 
  FiX, FiRefreshCw, FiMail, FiMessageSquare, FiEye, FiTrendingUp,
  FiBarChart2, FiFilter, FiDownload, FiPrinter, FiMoreHorizontal,
  FiGrid, FiList, FiFlag, FiTarget, FiPieChart, FiAward,
  FiAlertCircle, FiClock, FiCheckCircle, FiDollarSign, FiShield, FiArrowLeft, FiChevronRight
} from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useParams, useNavigate } from "react-router-dom";
import { getAllCustomers, getCustomerById } from "@/services/customerService";
import { getCustomerHistory } from "@/services/serviceService";
import StaffCustomerDocuments from './staff/StaffCustomerDocuments';

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
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
          <div className="bg-white rounded-xl border border-slate-200 p-8 max-w-md text-center">
            <div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <FiAlertCircle className="h-8 w-8 text-rose-600" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">Something went wrong</h2>
            <p className="text-slate-600 mb-4">
              There was an error loading customer profiles. Please try refreshing the page.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="h-11 px-6 bg-navy-700 text-white rounded-xl hover:bg-navy-700 transition-colors"
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

const PAGE_SIZE = 20;

const CustomerProfileSystem = () => {
  const [activeTab, setActiveTab] = useState('profile');
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerApplications, setCustomerApplications] = useState([]);
  const [applicationsLoading, setApplicationsLoading] = useState(false);
  const [services, setServices] = useState([]);
  const [staffMembers, setStaffMembers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [viewMode, setViewMode] = useState('list');
  const [page, setPage] = useState(1);

  const { customerId } = useParams();
  const navigate = useNavigate();

  // Status configuration matching TrackServicePage with colors
  const statusConfig = {
    'Pending': { 
      color: 'text-amber-800', 
      bg: 'bg-amber-100', 
      border: 'border-amber-300',
      dot: 'bg-amber-600',
      icon: FiClock
    },
    'In Progress': { 
      color: 'text-navy-800', 
      bg: 'bg-navy-500/10', 
      border: 'border-navy-500/20',
      dot: 'bg-navy-700',
      icon: FiTrendingUp
    },
    'Delayed': { 
      color: 'text-rose-800', 
      bg: 'bg-rose-100', 
      border: 'border-rose-300',
      dot: 'bg-rose-600',
      icon: FiAlertCircle
    },
    'Completed': { 
      color: 'text-emerald-800', 
      bg: 'bg-emerald-100', 
      border: 'border-emerald-300',
      dot: 'bg-emerald-600',
      icon: FiCheckCircle
    },
    'Resubmit': { 
      color: 'text-amber-800', 
      bg: 'bg-amber-100', 
      border: 'border-amber-300',
      dot: 'bg-amber-600',
      icon: FiRefreshCw
    },
    'Paid': { 
      color: 'text-emerald-700', 
      bg: 'bg-emerald-100', 
      border: 'border-emerald-300',
      dot: 'bg-emerald-600',
      icon: FiDollarSign
    }
  };

  // Map backend status to frontend status
  const statusMap = {
    'pending': 'Pending',
    'in_progress': 'In Progress',
    'completed': 'Completed',
    'rejected': 'Delayed',
    'resubmit': 'Resubmit',
    'paid': 'Paid'
  };

  const priorityConfig = {
    'low': { 
      color: 'text-emerald-600', 
      bg: 'bg-emerald-50', 
      border: 'border-emerald-200',
      label: 'Low'
    },
    'medium': { 
      color: 'text-amber-600', 
      bg: 'bg-amber-50', 
      border: 'border-amber-200',
      label: 'Medium'
    },
    'high': { 
      color: 'text-rose-600', 
      bg: 'bg-rose-50', 
      border: 'border-rose-200',
      label: 'High'
    }
  };

  // Normalize customer data from backend
  const normalizeCustomer = (data) => {
    // For list view (from /api/customer/) - only has aadhaar_last4
    // For detail view (from /api/customer/:id) - has aadhaar_number from documents join
    
    let aadhaarValue = "Not Uploaded";
    let aadhaarDisplay = "Not Uploaded";
    
    if (data.aadhaar_number) {
      // Full Aadhaar number from documents (detail view)
      aadhaarValue = data.aadhaar_number;
      aadhaarDisplay = data.aadhaar_number;
    } else if (data.aadhaar_last4) {
      // Last 4 digits only (list view)
      aadhaarValue = data.aadhaar_last4;
      aadhaarDisplay = `XXXX-XXXX-${data.aadhaar_last4}`;
    }
    
    // Determine verification status - Check boolean value
    let verificationStatus = "Pending";
    let verifiedDate = null;
    
    // Check if is_verified is true (boolean)
    if (data.is_verified === true) {
      verificationStatus = "Verified";
      verifiedDate = data.verified_at || data.created_at || null;
    }
    
    return {
      id: data.id,
      name: data.name || '—',
      phone: data.phone || data.primary_phone || '—',
      email: data.email || '—',
      aadhaar: aadhaarValue,
      aadhaarDisplay: aadhaarDisplay,
      aadhaar_last4: data.aadhaar_last4,
      aadhaar_number: data.aadhaar_number,
      rationCard: data.ration_card_number || "Not Uploaded",
      dateOfBirth: data.date_of_birth ? new Date(data.date_of_birth).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      }) : "—",
      gender: data.gender || "—",
      maritalStatus: data.marital_status || "—",
      occupation: data.occupation || "—",
      emergencyContact: data.emergency_contact || "—",
      address: data.address || "—",
      district: data.district || "—",
      state: data.state || "—",
      pincode: data.pincode || "—",
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      is_verified: verificationStatus,
      verified_at: verifiedDate,
      status: data.status || "Active",
      profile_photo: data.profile_photo,
      aadhaar_status: data.aadhaar_status,
      ration_status: data.ration_card_status,
      satisfaction: 92
    };
  };

  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'N/A';
      return date.toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch (error) {
      return 'N/A';
    }
  };

  // Format timeline date (DD-MM-YYYY at HH:mm)
  const formatTimelineDate = (dateString) => {
    if (!dateString) return 'Not set';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Invalid date';
      
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      
      return `${day}-${month}-${year} at ${hours}:${minutes}`;
    } catch (error) {
      return 'Invalid date';
    }
  };

  // Fetch customer applications by Aadhaar/email/phone
  const fetchCustomerApplications = async (customer) => {
    if (!customer) return;
    
    setApplicationsLoading(true);
    try {
      const params = {};
      
      if (customer.aadhaar && customer.aadhaar !== 'Not Uploaded' && customer.aadhaar !== '—') {
        const aadhaarNumbers = customer.aadhaar.replace(/\D/g, '');
        if (aadhaarNumbers.length === 12) {
          params.aadhaar = aadhaarNumbers;
        }
      } 
      
      if (!params.aadhaar && customer.email && customer.email !== '—') {
        params.email = customer.email;
      } 
      
      if (!params.aadhaar && !params.email && customer.phone && customer.phone !== '—') {
        const phoneNumbers = customer.phone.replace(/\D/g, '');
        if (phoneNumbers.length >= 10) {
          params.phone = phoneNumbers.slice(-10);
        }
      }

      if (Object.keys(params).length === 0) {
        setCustomerApplications([]);
        setApplicationsLoading(false);
        return;
      }

      const response = await getCustomerHistory(params);
      
      const transformedApps = [];
      
      if (response.processed && Array.isArray(response.processed)) {
        response.processed.forEach(app => {
          const displayStatus = statusMap[app.status] || app.status || 'Pending';
          
          transformedApps.push({
            id: app.id,
            appNumber: app.application_number || 'N/A',
            type: app.service_name || 'Unknown Service',
            subType: app.subcategory_name || 'N/A',
            status: displayStatus,
            priority: app.priority || 'medium',
            assignedStaff: app.assigned_to,
            createdDate: formatDate(app.submission_date),
            submissionDate: app.submission_date,
            progress: app.progress || 25,
            source: 'Processed',
            application_number: app.application_number,
            service_name: app.service_name,
            subcategory_name: app.subcategory_name
          });
        });
      }
      
      if (response.pending && Array.isArray(response.pending)) {
        response.pending.forEach(app => {
          transformedApps.push({
            id: `pending-${app.id}`,
            appNumber: app.application_number || 'Pending',
            type: app.service_name || 'Unknown Service',
            subType: 'N/A',
            status: 'Pending',
            priority: 'medium',
            assignedStaff: null,
            createdDate: formatDate(app.submission_date),
            submissionDate: app.submission_date,
            progress: 0,
            source: 'Pending Online',
            originalId: app.id
          });
        });
      }
      
      transformedApps.sort((a, b) => {
        const dateA = a.submissionDate ? new Date(a.submissionDate) : new Date(0);
        const dateB = b.submissionDate ? new Date(b.submissionDate) : new Date(0);
        return dateB - dateA;
      });
      
      setCustomerApplications(transformedApps);
      
      const activeCount = transformedApps.filter(app => 
        app.status === 'Pending' || app.status === 'In Progress'
      ).length;
      
      setSelectedCustomer(prev => ({
        ...prev,
        activeApplications: activeCount,
        totalApplications: transformedApps.length
      }));
      
    } catch (error) {
      console.error('Error fetching customer applications:', error);
      toast.error('Failed to fetch customer applications');
      setCustomerApplications([]);
    } finally {
      setApplicationsLoading(false);
    }
  };

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);

        const allRes = await getAllCustomers();
        const customersData = Array.isArray(allRes) ? allRes : allRes.data || [];
        setCustomers(customersData);

        if (customerId) {
          const customerRes = await getCustomerById(customerId);
          const customerData = customerRes.data || customerRes;
          const customer = normalizeCustomer(customerData);
          setSelectedCustomer(customer);
          await fetchCustomerApplications(customer);
        } else {
          setSelectedCustomer(null);
          setCustomerApplications([]);
        }

      } catch (err) {
        console.error(err);
        toast.error("Failed to load customer data");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [customerId]);

  useEffect(() => {
    if (selectedCustomer) {
      fetchCustomerApplications(selectedCustomer);
    }
  }, [selectedCustomer?.id]);

  const filteredCustomers = customers.filter(customer => {
    const name = customer.name?.toLowerCase() || "";
    const phone = customer.primary_phone || customer.phone || "";
    const aadhaar = customer.aadhaar_last4 || "";
    const email = customer.email?.toLowerCase() || "";

    const term = searchTerm.toLowerCase();

    return (
      name.includes(term) ||
      phone.includes(term) ||
      aadhaar.includes(term) ||
      email.includes(term)
    );
  }).map(c => normalizeCustomer(c));

  // List page helpers (display only)
  const totalPages = Math.max(1, Math.ceil(filteredCustomers.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedCustomers = filteredCustomers.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const verifiedCount = customers.filter(c => c.is_verified === true).length;
  const initials = (name) => (name || '?').split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();

  const handleAddApplication = () => {
    toast.info("This would open a form to add a new application in a real implementation");
  };

  const handleNotifyCustomer = () => {
    if (!selectedCustomer) return;
    toast.success(`Notification sent to ${selectedCustomer.name}`);
  };

  const handleEditCustomer = () => {
    toast.info("Edit customer profile form would open");
  };

  const handleExportData = () => {
    toast.success("Customer data exported successfully");
  };

  const handlePrintReport = () => {
    toast.info("Generating print report...");
    window.print();
  };

  const handleViewApplication = (app) => {
    if (app.source === 'Pending Online') {
      toast.info('This application needs to be processed first');
    } else {
      navigate(`/dashboard/staff/track_service/${app.id}`);
    }
  };

  // UPDATED: CustomerCard without "0 Active"
  const CustomerCard = ({ customer, isSelected, onClick }) => {
    return (
      <motion.div
        whileHover={{ y: -2 }}
        className={`p-3 rounded-xl border-2 cursor-pointer transition-all duration-300 ${
          isSelected 
            ? 'border-navy-700 bg-navy-500/10 shadow-md' 
            : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
        }`}
        onClick={onClick}
      >
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center space-x-2 min-w-0 flex-1">
            <div className="relative flex-shrink-0">
              <div className="w-8 h-8 bg-navy-700 rounded-lg flex items-center justify-center">
                <FiUser className="h-4 w-4 text-white" />
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold text-slate-900 text-sm truncate" title={customer.name}>
                {customer.name}
              </h3>
              <p className="text-xs text-slate-500 truncate" title={customer.phone}>
                {customer.phone}
              </p>
            </div>
          </div>
        </div>
        <div className="mb-2">
          <p className="text-xs text-slate-600 truncate" title={customer.email}>
            {customer.email}
          </p>
          <p className="text-xs text-slate-600 truncate" title={`${customer.district}, ${customer.state}`}>
            {customer.district}, {customer.state}
          </p>
        </div>
        <div className="flex items-center gap-2 mb-2">
          {customer.is_verified === "Verified" ? (
            <span className="px-1.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center">
              <FiCheck className="h-3 w-3 mr-1" />
              Verified
            </span>
          ) : (
            <span className="px-1.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200 flex items-center">
              <FiClock className="h-3 w-3 mr-1" />
              Pending
            </span>
          )}
        </div>
        <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100">
          <div className="text-xs text-slate-500 truncate flex-1 min-w-0 mr-2">
            Aadhaar: {customer.aadhaarDisplay || 'Not Uploaded'}
          </div>
          <div className="text-xs font-medium text-navy-700 whitespace-nowrap flex-shrink-0">
            {customer.satisfaction}% Sat
          </div>
        </div>
      </motion.div>
    );
  };

  const StatItem = ({ label, value }) => (
    <div className="text-center p-3 sm:p-4 bg-slate-50 rounded-xl border border-slate-200">
      <p className="text-sm font-medium text-slate-600 mb-1">{label}</p>
      <p className="text-lg font-semibold text-slate-900">{value}</p>
    </div>
  );

  const DetailRow = ({ label, value, valueClass = "" }) => (
    <div className="flex justify-between items-start gap-4 py-1">
      <span className="shrink-0 text-sm text-slate-600">{label}</span>
      <span className={`min-w-0 break-words text-right text-sm font-medium ${valueClass}`}>{value || '—'}</span>
    </div>
  );

  const TimelineItem = ({ title, dateTime, completed, current }) => (
    <div className="flex items-center space-x-3">
      <div className={`w-2 h-2 rounded-full ${completed ? 'bg-emerald-500' : current ? 'bg-navy-700' : 'bg-slate-300'}`}></div>
      <div className="flex-1">
        <p className={`text-sm font-medium ${completed || current ? 'text-slate-900' : 'text-slate-500'}`}>
          {title}
        </p>
        <p className="text-xs text-slate-500">{dateTime}</p>
      </div>
    </div>
  );

  const ActivityItem = ({ action, description, time, user }) => (
    <div className="flex items-start space-x-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
      <div className="w-2 h-2 bg-navy-700 rounded-full mt-2"></div>
      <div className="flex-1">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-slate-900">{action}</p>
          <p className="text-xs text-slate-500">{time}</p>
        </div>
        <p className="text-sm text-slate-600 mt-1">{description}</p>
        <p className="text-xs text-slate-500 mt-1">By {user}</p>
      </div>
    </div>
  );

  const StatusBadge = ({ status }) => {
    const config = statusConfig[status] || statusConfig['Pending'];
    const Icon = config.icon;
    
    return (
      <span className={`px-2 inline-flex items-center gap-1 text-xs leading-5 font-semibold rounded-full ${config.bg} ${config.border} ${config.color}`}>
        <Icon className="h-3 w-3" />
        {status}
      </span>
    );
  };

  const VerificationBadge = ({ isVerified }) => {
    if (isVerified === "Verified") {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 border border-emerald-200">
          <FiCheck className="h-3 w-3 mr-1" />
          Verified
        </span>
      );
    } else {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200">
          <FiClock className="h-3 w-3 mr-1" />
          Pending
        </span>
      );
    }
  };

  if (loading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-navy-700 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600 font-medium">Loading customer dashboard...</p>
        </div>
      </div>
    );
  }
  
  return (
    <ErrorBoundary>
      <div className="p-4 sm:p-6">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-navy-700 text-white">
              <FiUser className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h1 className="text-xl font-semibold text-slate-900 sm:text-2xl">Customer Profile Management</h1>
              <p className="text-sm text-slate-500">Manage and track customer profiles and applications</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {!selectedCustomer && (
              <>
                <button className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-navy-700 px-4 text-sm font-medium text-white transition-colors hover:bg-navy-800 sm:h-10">
                  <FiPlus className="h-4 w-4" />
                  <span>New Customer</span>
                </button>
                <button
                  onClick={handleExportData}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 sm:h-10"
                >
                  <FiDownload className="h-4 w-4" />
                  <span>Export</span>
                </button>
                <button
                  onClick={handlePrintReport}
                  className="hidden h-10 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 sm:inline-flex"
                >
                  <FiPrinter className="h-4 w-4" />
                  <span>Print</span>
                </button>
              </>
            )}
            <button
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 sm:h-10"
              onClick={() => window.location.reload()}
            >
              <FiRefreshCw className="h-4 w-4" />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {selectedCustomer ? (
          <div>
            <button
              onClick={() => navigate('/dashboard/staff/customers')}
              className="mb-3 inline-flex min-h-[40px] items-center gap-2 text-sm font-medium text-navy-700 hover:text-navy-800"
            >
              <FiArrowLeft className="h-4 w-4" />
              All customers
            </button>
                <div className="space-y-6">
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-6">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
                      <div className="flex min-w-0 items-center gap-3 sm:gap-4">
                        <div className="w-14 h-14 sm:w-16 sm:h-16 shrink-0 bg-navy-700 rounded-xl flex items-center justify-center">
                          <FiUser className="h-8 w-8 text-white" />
                        </div>
                        <div>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-1">
                            <h2 className="text-xl sm:text-2xl font-semibold text-slate-900">{selectedCustomer.name}</h2>
                            <VerificationBadge isVerified={selectedCustomer.is_verified} />
                          </div>
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                            <div className="flex items-center space-x-1 text-slate-600">
                              <FiPhone className="h-4 w-4" />
                              <span className="text-sm">{selectedCustomer.phone}</span>
                            </div>
                            <div className="flex items-center space-x-1 text-slate-600">
                              <FiMail className="h-4 w-4" />
                              <span className="text-sm break-all">{selectedCustomer.email}</span>
                            </div>
                            <div className="flex items-center space-x-1 text-slate-600">
                              <FiCreditCard className="h-4 w-4" />
                              <span className="text-sm">{selectedCustomer.aadhaarDisplay || selectedCustomer.aadhaar}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 mt-4 lg:mt-0">
                        <button
                          className="h-10 px-4 bg-navy-700 text-white rounded-xl hover:bg-navy-800 flex items-center space-x-2 transition-all duration-200"
                          onClick={handleNotifyCustomer}
                        >
                          <FiMessageSquare className="h-4 w-4" />
                          <span>Notify</span>
                        </button>
                        <button 
                          onClick={handleEditCustomer}
                          className="h-10 px-4 border border-slate-300 bg-white text-slate-700 rounded-xl hover:bg-slate-50 flex items-center space-x-2 transition-all duration-200"
                        >
                          <FiEdit className="h-4 w-4" />
                          <span>Edit</span>
                        </button>
                        <button className="grid h-10 w-10 place-items-center border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors">
                          <FiMoreHorizontal className="h-4 w-4 text-slate-600" />
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                      <StatItem label="District" value={selectedCustomer.district || 'N/A'} />
                      <StatItem label="Active Apps" value={selectedCustomer.activeApplications || 0} />
                      <StatItem label="Total Apps" value={selectedCustomer.totalApplications || 0} />
                      <StatItem label="Satisfaction" value={`${selectedCustomer.satisfaction}%`} />
                    </div>
                  </div>
                  
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="border-b border-slate-200">
                      <nav className="flex -mb-px overflow-x-auto">
                        {['profile', 'applications', 'documents', 'history'].map((tab) => (
                          <button
                            key={tab}
                            className={`flex-1 whitespace-nowrap py-3.5 px-4 sm:px-6 text-center font-medium text-sm border-b-2 transition-colors ${
                              activeTab === tab
                                ? 'border-navy-700 text-navy-700'
                                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                            }`}
                            onClick={() => setActiveTab(tab)}
                          >
                            {tab === 'profile' && 'Profile'}
                            {tab === 'applications' && 'Applications'}
                            {tab === 'documents' && 'Documents'}
                            {tab === 'history' && 'History'}
                          </button>
                        ))}
                      </nav>
                    </div>
                    <div className="p-4 sm:p-6">
                      <AnimatePresence mode="wait">
                        <motion.div
                          key={activeTab}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -20 }}
                          transition={{ duration: 0.2 }}
                        >
                          {activeTab === 'profile' && (
                            <div className="space-y-6">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-4">
                                  <h3 className="font-semibold text-slate-900">Personal Information</h3>
                                  <div className="space-y-3">
                                    <DetailRow label="Full Name" value={selectedCustomer.name} />
                                    <DetailRow label="Phone Number" value={selectedCustomer.phone} />
                                    <DetailRow label="Email Address" value={selectedCustomer.email} />
                                    <DetailRow label="Aadhaar Number" value={selectedCustomer.aadhaar_number || selectedCustomer.aadhaar} />
                                    <DetailRow label="Ration Card" value={selectedCustomer.rationCard} />
                                    <DetailRow label="Date of Birth" value={selectedCustomer.dateOfBirth} />
                                    <DetailRow label="Gender" value={selectedCustomer.gender} />
                                    <DetailRow label="Marital Status" value={selectedCustomer.maritalStatus} />
                                    <DetailRow label="Occupation" value={selectedCustomer.occupation} />
                                    <DetailRow label="Emergency Contact" value={selectedCustomer.emergencyContact} />
                                  </div>
                                </div>
                                <div className="space-y-4">
                                  <h3 className="font-semibold text-slate-900">Address Details</h3>
                                  <div className="space-y-3">
                                    <DetailRow label="Full Address" value={selectedCustomer.address} />
                                    <DetailRow label="District" value={selectedCustomer.district} />
                                    <DetailRow label="State" value={selectedCustomer.state} />
                                    <DetailRow label="Pincode" value={selectedCustomer.pincode} />
                                    <div className="py-2">
                                      <h4 className="text-sm font-medium text-slate-700 mb-2">Verification Status</h4>
                                      <div className="space-y-2">
                                        <DetailRow 
                                          label="Profile Status" 
                                          value={selectedCustomer.is_verified} 
                                          valueClass={selectedCustomer.is_verified === "Verified" ? "text-emerald-600 font-semibold" : "text-amber-600 font-semibold"}
                                        />
                                        <DetailRow 
                                          label="Verified On" 
                                          value={selectedCustomer.verified_at ? formatDate(selectedCustomer.verified_at) : (selectedCustomer.is_verified === "Verified" ? 'At registration' : 'Not verified')} 
                                        />
                                        <DetailRow 
                                          label="Account Status" 
                                          value={selectedCustomer.status}
                                          valueClass={selectedCustomer.status === 'Active' ? 'text-emerald-600 font-semibold' : 'text-rose-600 font-semibold'}
                                        />
                                      </div>
                                    </div>
                                    <div className="py-2">
                                      <h4 className="text-sm font-medium text-slate-700 mb-2">Timestamps</h4>
                                      <div className="space-y-2">
                                        <DetailRow label="Member Since" value={formatDate(selectedCustomer.createdAt)} />
                                        <DetailRow label="Last Updated" value={formatDate(selectedCustomer.updatedAt)} />
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                              
                              {selectedCustomer.profile_photo && (
                                <div className="border-t border-slate-200 pt-6">
                                  <h3 className="font-semibold text-slate-900 mb-4">Profile Photo</h3>
                                  <div className="flex items-center space-x-4">
                                    <div className="w-24 h-24 rounded-lg overflow-hidden border border-slate-200">
                                      <img 
                                        src={selectedCustomer.profile_photo} 
                                        alt="Profile" 
                                        className="w-full h-full object-cover"
                                        onError={(e) => {
                                          e.target.onerror = null;
                                          e.target.src = "https://via.placeholder.com/150?text=No+Photo";
                                        }}
                                      />
                                    </div>
                                    <div>
                                      <p className="text-sm text-slate-600">Profile photo uploaded</p>
                                      <button className="mt-2 min-h-[40px] text-sm text-navy-700 hover:text-navy-800">
                                        View Full Size
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                          
                          {activeTab === 'applications' && (
                            <div className="space-y-6">
                              <div className="flex flex-wrap gap-3 justify-between items-center">
                                <h3 className="font-semibold text-slate-900">Applications</h3>
                                <button 
                                  className="h-10 px-4 bg-navy-700 text-white rounded-xl hover:bg-navy-800 flex items-center"
                                  onClick={handleAddApplication}
                                >
                                  <FiPlus className="mr-2" /> New Application
                                </button>
                              </div>
                              
                              {applicationsLoading ? (
                                <div className="text-center py-8">
                                  <div className="w-12 h-12 border-4 border-navy-700 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                                  <p className="text-slate-600">Loading applications...</p>
                                </div>
                              ) : customerApplications.length > 0 ? (
                                <>
                                  <div className="overflow-x-auto">
                                    <table className="min-w-full divide-y divide-slate-200">
                                      <thead className="bg-slate-50">
                                        <tr>
                                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">App Number</th>
                                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Service</th>
                                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
                                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Priority</th>
                                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Date</th>
                                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Actions</th>
                                        </tr>
                                      </thead>
                                      <tbody className="bg-white divide-y divide-slate-200">
                                        {customerApplications.map(app => {
                                          const priority = priorityConfig[app.priority || 'medium'];
                                          return (
                                            <tr 
                                              key={app.id} 
                                              className="hover:bg-slate-50 cursor-pointer transition-colors" 
                                              onClick={() => handleViewApplication(app)}
                                            >
                                              <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-sm font-medium text-slate-900">{app.appNumber}</div>
                                                {app.source === 'Pending Online' && (
                                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">
                                                    Online Booking
                                                  </span>
                                                )}
                                              </td>
                                              <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-sm text-slate-900">{app.type}</div>
                                                <div className="text-xs text-slate-500">{app.subType}</div>
                                              </td>
                                              <td className="px-6 py-4 whitespace-nowrap">
                                                <StatusBadge status={app.status} />
                                              </td>
                                              <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${priority.bg} ${priority.border} ${priority.color}`}>
                                                  {priority.label}
                                                </span>
                                              </td>
                                              <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                                                {app.createdDate}
                                              </td>
                                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                                <button 
                                                  className="inline-grid h-10 w-10 place-items-center text-navy-700 hover:text-navy-800 transition-colors"
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleViewApplication(app);
                                                  }}
                                                  title="View Application"
                                                >
                                                  <FiEye className="h-4 w-4" />
                                                </button>
                                              </td>
                                            </tr>
                                          );
                                        })}
                                      </tbody>
                                    </table>
                                  </div>
                                  
                                  {customerApplications.filter(app => app.source !== 'Pending Online').length > 0 && (
                                    <div className="mt-6">
                                      <h4 className="font-semibold text-slate-900 mb-4">Recent Application Progress</h4>
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {customerApplications.filter(app => app.source !== 'Pending Online').slice(0, 4).map(app => {
                                          return (
                                            <div 
                                              key={app.id} 
                                              className="border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer" 
                                              onClick={() => handleViewApplication(app)}
                                            >
                                              <div className="flex justify-between items-start mb-3">
                                                <div>
                                                  <h5 className="font-medium text-slate-900">{app.appNumber}</h5>
                                                  <p className="text-sm text-slate-600">{app.type} - {app.subType}</p>
                                                </div>
                                                <StatusBadge status={app.status} />
                                              </div>
                                              <div className="mb-2">
                                                <div className="flex justify-between text-sm mb-1">
                                                  <span className="text-slate-600">Progress</span>
                                                  <span className="font-medium">{app.progress}%</span>
                                                </div>
                                                <div className="w-full bg-slate-200 rounded-full h-2">
                                                  <div 
                                                    className="bg-navy-500 h-2 rounded-full transition-all duration-500"
                                                    style={{ width: `${app.progress}%` }}
                                                  ></div>
                                                </div>
                                              </div>
                                              <div className="text-sm text-slate-600">
                                                Applied: {app.createdDate}
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  )}
                                </>
                              ) : (
                                <div className="text-center py-12 text-slate-500">
                                  <FiFolder className="mx-auto h-16 w-16 mb-4 opacity-30" />
                                  <p className="text-lg font-medium mb-2">No applications found</p>
                                  <p className="text-sm text-slate-400">This customer hasn't submitted any applications yet</p>
                                </div>
                              )}
                            </div>
                          )}
                          
                          {activeTab === "documents" && selectedCustomer && (
                            <StaffCustomerDocuments customerId={selectedCustomer.id} />
                          )}

                          {activeTab === 'history' && (
                            <div className="space-y-6">
                              <h3 className="font-semibold text-slate-900 mb-4">Customer Timeline</h3>
                              
                              <div className="space-y-4">
                                <TimelineItem 
                                  title="Profile Created"
                                  dateTime={formatTimelineDate(selectedCustomer.createdAt)}
                                  completed={true}
                                  current={false}
                                />
                                
                                {selectedCustomer.verified_at && (
                                  <TimelineItem 
                                    title="Aadhaar Verified"
                                    dateTime={formatTimelineDate(selectedCustomer.verified_at)}
                                    completed={true}
                                    current={false}
                                  />
                                )}
                                
                                {customerApplications.slice(0, 3).map((app) => (
                                  <TimelineItem 
                                    key={app.id}
                                    title={`Application ${app.status}`}
                                    dateTime={formatTimelineDate(app.submissionDate)}
                                    completed={app.status === 'Completed'}
                                    current={app.status === 'In Progress'}
                                  />
                                ))}
                              </div>
                              
                              <div className="mt-8">
                                <h4 className="font-semibold text-slate-900 mb-3">Recent Activity</h4>
                                <div className="space-y-3">
                                  <ActivityItem 
                                    action="Profile Updated"
                                    description="Customer information was updated"
                                    time={formatDate(selectedCustomer.updatedAt)}
                                    user="System"
                                  />
                                  {customerApplications.length > 0 && (
                                    <ActivityItem 
                                      action="New Application"
                                      description={`Submitted ${customerApplications[0]?.type} application`}
                                      time={customerApplications[0]?.createdDate}
                                      user="Customer"
                                    />
                                  )}
                                  {selectedCustomer.verified_at && (
                                    <ActivityItem 
                                      action="Document Verified"
                                      description="Aadhaar document was verified"
                                      time={formatDate(selectedCustomer.verified_at)}
                                      user="Staff"
                                    />
                                  )}
                                </div>
                              </div>
                            </div>
                          )}
                        </motion.div>
                      </AnimatePresence>
                    </div>
                  </div>
                </div>
          </div>
        ) : (
          <>
            <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
              {[
                ['Total customers', customers.length],
                ['Verified', verifiedCount],
                ['Pending verification', customers.length - verifiedCount],
                ['Matching search', filteredCustomers.length]
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
                  <p className="text-xs text-slate-500">{label}</p>
                  <p className="text-xl font-semibold text-slate-900">{value}</p>
                </div>
              ))}
            </div>

            <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
              <div className="relative flex-1">
                <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
                <input
                  type="text"
                  placeholder="Search name, phone, email"
                  title="Search by name, phone, Aadhaar last 4 or email"
                  className="w-full pl-10 pr-4 min-h-[44px] py-2 text-base sm:text-sm bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-navy-500/30 focus:border-navy-500/40 transition-all"
                  value={searchTerm}
                  onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
                />
              </div>
              <div className="flex gap-2">
                <div className="relative flex-1 lg:w-48 lg:flex-none">
                  <select
                    className="w-full min-h-[44px] px-3 py-2 text-base sm:text-sm bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-navy-500/30 focus:border-navy-500/40 appearance-none"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                  >
                    <option value="all">All Statuses</option>
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                    <option value="High Priority">High Priority</option>
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-700">
                    <FiChevronDown className="h-5 w-5" />
                  </div>
                </div>
                <div className="flex rounded-xl bg-slate-100 p-1">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`grid h-10 w-10 place-items-center rounded-lg ${viewMode === 'grid' ? 'bg-white text-navy-700 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                    <FiGrid className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`grid h-10 w-10 place-items-center rounded-lg ${viewMode === 'list' ? 'bg-white text-navy-700 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                    <FiList className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>

            {filteredCustomers.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500 shadow-sm sm:p-12">
                <FiSearch className="mx-auto h-8 w-8 mb-2 opacity-50" />
                <p className="text-sm">No customers found</p>
                <p className="text-xs text-slate-400 mt-1">Try adjusting your search</p>
              </div>
            ) : viewMode === 'grid' ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {pagedCustomers.map(customer => (
                  <CustomerCard
                    key={customer.id}
                    customer={customer}
                    isSelected={false}
                    onClick={() => navigate(`/dashboard/staff/customers/${customer.id}`)}
                  />
                ))}
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="hidden grid-cols-12 gap-3 border-b border-slate-200 bg-slate-50 px-5 py-2.5 text-xs font-medium uppercase tracking-wide text-slate-500 md:grid">
                  <span className="col-span-4">Customer</span>
                  <span className="col-span-2">Phone</span>
                  <span className="col-span-2">District</span>
                  <span className="col-span-2">Aadhaar</span>
                  <span className="col-span-2">Status</span>
                </div>
                <ul className="divide-y divide-slate-100">
                  {pagedCustomers.map(customer => (
                    <li key={customer.id}>
                      <button
                        type="button"
                        onClick={() => navigate(`/dashboard/staff/customers/${customer.id}`)}
                        className="grid w-full grid-cols-2 items-center gap-x-3 gap-y-1 px-4 py-3 text-left transition-colors hover:bg-slate-50 md:grid-cols-12 md:px-5"
                      >
                        <div className="col-span-2 flex min-w-0 items-center gap-3 md:col-span-4">
                          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-navy-500/10 text-xs font-semibold text-navy-700">
                            {initials(customer.name)}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-slate-900">{customer.name}</p>
                            <p className="truncate text-xs text-slate-400">
                              <span className="md:hidden">{customer.phone} · {customer.district} · </span>
                              {customer.email}
                            </p>
                          </div>
                        </div>
                        <p className="hidden truncate text-sm text-slate-600 md:col-span-2 md:block">{customer.phone}</p>
                        <p className="hidden truncate text-sm text-slate-600 md:col-span-2 md:block">{customer.district}</p>
                        <p className="hidden truncate text-sm text-slate-600 md:col-span-2 md:block">{customer.aadhaarDisplay || 'Not Uploaded'}</p>
                        <div className="col-span-2 flex items-center justify-between md:col-span-2">
                          <VerificationBadge isVerified={customer.is_verified} />
                          <FiChevronRight className="h-4 w-4 text-slate-300 md:hidden" />
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {filteredCustomers.length > 0 && (
              <div className="mt-3 flex flex-col items-center justify-between gap-3 text-sm text-slate-500 sm:flex-row">
                <span>
                  {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filteredCustomers.length)} of {filteredCustomers.length}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage(currentPage - 1)}
                    disabled={currentPage <= 1}
                    className="h-10 rounded-xl border border-slate-300 bg-white px-4 font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <span className="px-2">Page {currentPage} of {totalPages}</span>
                  <button
                    onClick={() => setPage(currentPage + 1)}
                    disabled={currentPage >= totalPages}
                    className="h-10 rounded-xl border border-slate-300 bg-white px-4 font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        <style>{`
          .scrollbar-hide {
            -ms-overflow-style: none;
            scrollbar-width: none;
          }
          .scrollbar-hide::-webkit-scrollbar {
            display: none;
          }
        `}</style>
      </div>
    </ErrorBoundary>
  );
};

export default CustomerProfileSystem;