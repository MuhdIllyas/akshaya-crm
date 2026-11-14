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
import CustomerMessages from '@/components/CustomerMessages';
import CustomerCentres from '@/components/CustomerCentres';
import { customersPath } from '@/utils/customersPath';
import NewCustomerModal from '@/components/NewCustomerModal';

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
  const [loading, setLoading] = useState(true);          // the customer list
  const [detailLoading, setDetailLoading] = useState(false); // the selected customer's profile
  const [statusFilter, setStatusFilter] = useState('all');   // all | pending | verified
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [appFilter, setAppFilter] = useState('active'); // active | completed | all
  const [appSearch, setAppSearch] = useState('');
  const [showNewCustomer, setShowNewCustomer] = useState(false);

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
      // shown masked; the full number is only used to look up their applications
      const last4 = String(data.aadhaar_number).replace(/\D/g, '').slice(-4);
      aadhaarDisplay = last4 ? `XXXX-XXXX-${last4}` : 'Not Uploaded';
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
      ration_status: data.ration_card_status
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

  const loadCustomers = async () => {
    try {
      setLoading(true);
      const allRes = await getAllCustomers();
      setCustomers(Array.isArray(allRes) ? allRes : allRes.data || []);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load customers");
    } finally {
      setLoading(false);
    }
  };

  // The list loads once; picking a customer only reloads the profile panel.
  useEffect(() => {
    loadCustomers();
  }, []);

  useEffect(() => {
    if (!customerId) {
      setSelectedCustomer(null);
      setCustomerApplications([]);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    setActiveTab('applications');
    setAppFilter('active');
    setAppSearch('');
    getCustomerById(customerId)
      .then((res) => {
        if (!cancelled) setSelectedCustomer(normalizeCustomer(res.data || res));
      })
      .catch((err) => {
        console.error(err);
        if (!cancelled) {
          setSelectedCustomer(null);
          toast.error(err.response?.status === 404 ? "Customer not found" : "Failed to load the customer");
        }
      })
      .finally(() => !cancelled && setDetailLoading(false));
    return () => {
      cancelled = true;
    };
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
    if (statusFilter === 'verified' && customer.is_verified !== true) return false;
    if (statusFilter === 'pending' && customer.is_verified === true) return false;

    return (
      name.includes(term) ||
      phone.includes(term) ||
      aadhaar.includes(term) ||
      email.includes(term)
    );
  }).map(c => normalizeCustomer(c));

  // List helpers (display only)
  const visibleCustomers = filteredCustomers.slice(0, visibleCount);
  const verifiedCount = customers.filter(c => c.is_verified === true).length;
  const initials = (name) => (name || '?').split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();

  // New service entry for this customer (name and phone filled in)
  // Saved from the New customer form (or the Aadhaar was already registered)
  const handleCustomerCreated = ({ id, existing } = {}) => {
    setShowNewCustomer(false);
    toast.success(existing ? 'This Aadhaar is already registered. Opening that customer.' : 'Customer saved');
    loadCustomers();
    if (id) navigate(customersPath(id));
  };

  const handleNewEntry = () => {
    if (!selectedCustomer) return;
    navigate('/dashboard/staff/service_entry', {
      state: { prefillCustomer: { name: selectedCustomer.name, phone: selectedCustomer.phone } },
    });
  };

  const handleViewApplication = (app) => {
    if (app.source === 'Pending Online') {
      toast.info('This application needs to be processed first');
    } else {
      navigate(`/dashboard/staff/track_service/${app.id}`);
    }
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

  const pendingCount = customers.length - verifiedCount;
  const showProfileOnPhone = Boolean(customerId); // phones: list, or profile with a back link

  return (
    <ErrorBoundary>
      <div className="p-4 sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-navy-700 text-white">
              <FiUser className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h1 className="text-xl font-semibold text-slate-900 sm:text-2xl">Customers</h1>
              <p className="truncate text-sm text-slate-500">
                {loading ? 'Loading…' : `${customers.length} customers · ${pendingCount} to verify`}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 gap-2">
            <button
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
              onClick={() => { loadCustomers(); if (selectedCustomer) fetchCustomerApplications(selectedCustomer); }}
              aria-label="Refresh"
            >
              <FiRefreshCw className="h-4 w-4" />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <button
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-navy-700 px-3 text-sm font-medium text-white transition-colors hover:bg-navy-800 sm:px-4"
              onClick={() => setShowNewCustomer(true)}
              aria-label="New customer"
            >
              <FiPlus className="h-4 w-4" />
              <span className="hidden sm:inline">New customer</span>
            </button>
          </div>
        </div>

        <NewCustomerModal
          open={showNewCustomer}
          onClose={() => setShowNewCustomer(false)}
          onCreated={handleCustomerCreated}
          onOpenCustomer={(id) => { setShowNewCustomer(false); navigate(customersPath(id)); }}
        />

        <div className="grid gap-4 lg:h-[calc(100vh-17.5rem)] lg:min-h-[460px] lg:grid-cols-[minmax(280px,340px)_minmax(0,1fr)]">
          {/* ===== Customer list ===== */}
          <aside className={`${showProfileOnPhone ? 'hidden lg:flex' : 'flex'} min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm`}>
            <div className="space-y-2 border-b border-slate-200 p-3">
              <div className="relative">
                <FiSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Name, phone or last 4 of Aadhaar"
                  className="min-h-[40px] w-full rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-3 text-base focus:border-navy-500/40 focus:ring-2 focus:ring-navy-500/30 sm:text-sm"
                  value={searchTerm}
                  onChange={(e) => { setSearchTerm(e.target.value); setVisibleCount(PAGE_SIZE); }}
                />
              </div>
              <div className="flex gap-1.5" role="group" aria-label="Filter customers">
                {[['all', 'All'], ['pending', `To verify${pendingCount ? ` (${pendingCount})` : ''}`], ['verified', 'Verified']].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => { setStatusFilter(value); setVisibleCount(PAGE_SIZE); }}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${statusFilter === value ? 'bg-navy-700 text-white' : 'border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              {loading ? (
                <p className="p-6 text-center text-sm text-slate-500">Loading customers…</p>
              ) : filteredCustomers.length === 0 ? (
                <div className="p-8 text-center text-slate-500">
                  <FiSearch className="mx-auto mb-2 h-6 w-6 opacity-50" />
                  <p className="text-sm">No customers found</p>
                </div>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {visibleCustomers.map((customer) => {
                    const active = String(customer.id) === String(customerId);
                    return (
                      <li key={customer.id}>
                        <button
                          type="button"
                          onClick={() => navigate(customersPath(customer.id))}
                          aria-current={active ? 'true' : undefined}
                          className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors ${active ? 'bg-navy-500/10' : 'hover:bg-slate-50'}`}
                        >
                          <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-xs font-semibold ${active ? 'bg-navy-700 text-white' : 'bg-navy-500/10 text-navy-700'}`}>
                            {initials(customer.name)}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center justify-between gap-2">
                              <span className={`truncate text-sm ${active ? 'font-semibold text-navy-800' : 'font-medium text-slate-900'}`}>{customer.name}</span>
                              {customer.is_verified === 'Verified'
                                ? <FiCheckCircle className="h-3.5 w-3.5 shrink-0 text-emerald-600" aria-label="Verified" />
                                : <span className="shrink-0 text-[11px] font-medium text-amber-700">To verify</span>}
                            </span>
                            <span className="block truncate text-xs text-slate-500">
                              {customer.phone}{customer.district && customer.district !== '—' ? ` · ${customer.district}` : ''}
                            </span>
                          </span>
                          <FiChevronRight className="h-4 w-4 shrink-0 text-slate-300 lg:hidden" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
              {filteredCustomers.length > visibleCount && (
                <button
                  type="button"
                  onClick={() => setVisibleCount((n) => n + PAGE_SIZE * 2)}
                  className="w-full border-t border-slate-100 py-3 text-sm font-medium text-navy-700 hover:bg-slate-50"
                >
                  Show more ({filteredCustomers.length - visibleCount} left)
                </button>
              )}
            </div>
          </aside>

          {/* ===== Selected customer ===== */}
          <section className={`${showProfileOnPhone ? 'flex' : 'hidden lg:flex'} min-h-0 min-w-0 flex-col`}>
            <button
              onClick={() => navigate(customersPath())}
              className="mb-3 inline-flex min-h-[40px] items-center gap-2 text-sm font-medium text-navy-700 hover:text-navy-800 lg:hidden"
            >
              <FiArrowLeft className="h-4 w-4" />
              All customers
            </button>

            {detailLoading ? (
              <div className="grid min-h-[320px] flex-1 place-items-center rounded-2xl border border-slate-200 bg-white">
                <div className="h-10 w-10 animate-spin rounded-full border-4 border-navy-700 border-t-transparent" />
              </div>
            ) : !selectedCustomer ? (
              <div className="grid min-h-[320px] flex-1 place-items-center rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
                <div>
                  <FiUser className="mx-auto mb-2 h-8 w-8 text-slate-300" />
                  <p className="font-medium text-slate-700">Select a customer</p>
                  <p className="mt-1 text-sm text-slate-500">Their applications, documents and messages open here.</p>
                </div>
              </div>
            ) : (
                <div className="flex min-h-[480px] flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm lg:min-h-0">
                  {/* Customer strip: always in view */}
                  <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-slate-200 p-3 sm:px-4">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-navy-700 text-white">
                      <FiUser className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="truncate text-base font-semibold text-slate-900 sm:text-lg">{selectedCustomer.name}</h2>
                        <VerificationBadge isVerified={selectedCustomer.is_verified} />
                      </div>
                      <p className="truncate text-xs text-slate-500 sm:text-sm">
                        {[
                          selectedCustomer.phone,
                          selectedCustomer.aadhaarDisplay !== 'Not Uploaded' ? selectedCustomer.aadhaarDisplay : null,
                          `${selectedCustomer.activeApplications || 0} active of ${selectedCustomer.totalApplications || 0}`,
                          selectedCustomer.createdAt ? `since ${formatDate(selectedCustomer.createdAt)}` : null,
                        ].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        className="inline-flex h-10 items-center gap-2 rounded-xl bg-navy-700 px-4 text-sm font-medium text-white transition-colors hover:bg-navy-800"
                        onClick={handleNewEntry}
                      >
                        <FiPlus className="h-4 w-4" />
                        <span>New entry</span>
                      </button>
                      <button
                        onClick={() => setActiveTab('messages')}
                        className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                      >
                        <FiMessageSquare className="h-4 w-4" />
                        <span>Message</span>
                      </button>
                    </div>
                  </div>

                  <nav className="flex shrink-0 overflow-x-auto border-b border-slate-200 px-2">
                    {['applications', 'documents', 'messages', 'profile', 'history'].map((tab) => (
                      <button
                        key={tab}
                        className={`-mb-px whitespace-nowrap border-b-2 px-3 py-3 text-sm font-medium transition-colors sm:px-4 ${
                          activeTab === tab
                            ? 'border-navy-700 text-navy-700'
                            : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700'
                        }`}
                        onClick={() => setActiveTab(tab)}
                      >
                        {{ profile: 'Profile', applications: 'Applications', documents: 'Documents', messages: 'Messages', history: 'History' }[tab]}
                      </button>
                    ))}
                  </nav>

                  {/* Only this part scrolls */}
                  <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
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
                                    <DetailRow label="Aadhaar Number" value={selectedCustomer.aadhaarDisplay} />
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

                              <div className="border-t border-slate-200 pt-6">
                                <CustomerCentres customerId={selectedCustomer.id} />
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
                          
                          {activeTab === 'applications' && (() => {
                            const isDone = (status) => status === 'Completed' || status === 'Paid';
                            const counts = {
                              active: customerApplications.filter((a) => !isDone(a.status)).length,
                              completed: customerApplications.filter((a) => isDone(a.status)).length,
                              all: customerApplications.length,
                            };
                            const q = appSearch.trim().toLowerCase();
                            const shown = customerApplications
                              .filter((a) => appFilter === 'all' || (appFilter === 'completed') === isDone(a.status))
                              .filter((a) => !q || [a.appNumber, a.type, a.subType].join(' ').toLowerCase().includes(q));
                            return (
                              <div>
                                {/* stays at the top while the list scrolls */}
                                <div className="sticky -top-4 z-10 -mx-4 -mt-4 flex flex-wrap items-center gap-2 border-b border-slate-100 bg-white px-4 py-3 sm:-top-5 sm:-mx-5 sm:-mt-5 sm:px-5">
                                  {[['active', 'Active'], ['completed', 'Completed'], ['all', 'All']].map(([value, label]) => (
                                    <button
                                      key={value}
                                      type="button"
                                      onClick={() => setAppFilter(value)}
                                      className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${appFilter === value ? 'bg-navy-700 text-white' : 'border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                                    >
                                      {label} {counts[value]}
                                    </button>
                                  ))}
                                  <div className="relative ml-auto w-full sm:w-56">
                                    <FiSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                    <input
                                      type="text"
                                      value={appSearch}
                                      onChange={(e) => setAppSearch(e.target.value)}
                                      placeholder="Search applications"
                                      className="min-h-[36px] w-full rounded-xl border border-slate-300 bg-white py-1.5 pl-9 pr-3 text-base focus:border-navy-500/40 focus:ring-2 focus:ring-navy-500/30 sm:text-sm"
                                    />
                                  </div>
                                </div>

                                {applicationsLoading ? (
                                  <div className="py-10 text-center">
                                    <div className="mx-auto mb-3 h-10 w-10 animate-spin rounded-full border-4 border-navy-700 border-t-transparent" />
                                    <p className="text-sm text-slate-500">Loading applications…</p>
                                  </div>
                                ) : shown.length === 0 ? (
                                  <div className="py-10 text-center text-slate-500">
                                    <FiFolder className="mx-auto mb-2 h-10 w-10 opacity-30" />
                                    <p className="text-sm font-medium">
                                      {customerApplications.length === 0
                                        ? 'No applications yet'
                                        : q ? 'No applications match your search' : appFilter === 'active' ? 'Nothing active right now' : 'No completed applications'}
                                    </p>
                                  </div>
                                ) : (
                                  <div className="space-y-4 pt-1">
                                    {[
                                      { key: 'online', label: 'Online — waiting to be taken', dot: 'bg-navy-500', rows: shown.filter((a) => !isDone(a.status) && a.source === 'Pending Online') },
                                      { key: 'centre', label: 'At the centre — in progress', dot: 'bg-navy-700', rows: shown.filter((a) => !isDone(a.status) && a.source !== 'Pending Online') },
                                      { key: 'done', label: 'Completed', dot: 'bg-emerald-500', rows: shown.filter((a) => isDone(a.status)) },
                                    ].filter((g) => g.rows.length > 0).map((group) => (
                                      <section key={group.key}>
                                        <h4 className="mb-1 flex items-center gap-2 px-1 text-xs font-semibold text-slate-600">
                                          <span className={`h-1.5 w-1.5 rounded-full ${group.dot}`} />
                                          {group.label}
                                          <span className="font-normal text-slate-400">{group.rows.length}</span>
                                        </h4>
                                        <ul className="divide-y divide-slate-100">
                                          {group.rows.map((app) => (
                                            <li key={app.id}>
                                              <button
                                                type="button"
                                                onClick={() => handleViewApplication(app)}
                                                className="grid w-full grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-3 rounded-lg px-1 py-2 text-left transition-colors hover:bg-slate-50 sm:grid-cols-[2rem_minmax(0,1fr)_10rem_4.5rem_auto]"
                                              >
                                                <span className={`grid h-8 w-8 place-items-center rounded-lg ${app.source === 'Pending Online' ? 'bg-navy-500/10 text-navy-700' : 'bg-slate-100 text-slate-600'}`}>
                                                  {app.source === 'Pending Online' ? <FiLink className="h-4 w-4" /> : <FiFolder className="h-4 w-4" />}
                                                </span>
                                                <span className="min-w-0">
                                                  <span className="block truncate text-sm font-medium text-slate-900">{app.type}</span>
                                                  <span className="block truncate text-xs text-slate-500">
                                                    {app.subType && app.subType !== 'N/A' ? app.subType : app.source === 'Pending Online' ? 'Online booking' : 'Service entry'}
                                                    <span className="sm:hidden"> · {app.appNumber}</span>
                                                  </span>
                                                </span>
                                                <span className="hidden truncate font-mono text-xs text-slate-600 sm:block" title={app.appNumber}>{app.appNumber}</span>
                                                <span className="hidden text-xs text-slate-500 sm:block">
                                                  {app.submissionDate ? new Date(app.submissionDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : ''}
                                                </span>
                                                <span className="flex items-center gap-1.5 justify-self-end">
                                                  <StatusBadge status={app.status} />
                                                  <FiChevronRight className="h-4 w-4 text-slate-300" />
                                                </span>
                                              </button>
                                            </li>
                                          ))}
                                        </ul>
                                      </section>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })()}

                          {activeTab === "documents" && selectedCustomer && (
                            <StaffCustomerDocuments customerId={selectedCustomer.id} />
                          )}

                          {activeTab === "messages" && selectedCustomer && (
                            <CustomerMessages customer={selectedCustomer} />
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
            )}
          </section>
        </div>

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