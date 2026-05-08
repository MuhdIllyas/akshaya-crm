import React, { useState, useEffect, useMemo } from 'react';
import { 
  FiUser, FiPhone, FiClock, FiCheckCircle, FiAlertCircle, 
  FiRefreshCw, FiSearch, FiEdit, FiMessageSquare, FiChevronDown, 
  FiFileText, FiBarChart2, FiDollarSign, FiCalendar,
  FiTrendingUp, FiMail, FiDownload, FiFilter, FiMoreHorizontal,
  FiShare2, FiPrinter, FiSettings, FiAward, FiTarget, FiPieChart,
  FiPlus, FiGrid, FiList, FiCreditCard, FiFlag, FiArrowLeft,
  FiAlertTriangle
} from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { 
  getTrackingEntries, 
  getTrackingEntryById,
  updateTrackingEntry, 
  updateTrackingStatus, 
  notifyCustomer, 
  getStaff, 
  getCategories, 
  getServiceEntries 
} from '/src/services/serviceService';
import { useParams, useNavigate } from 'react-router-dom';

// Error Boundary Component (unchanged)
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
              There was an error loading the service tracking. Please try refreshing the page.
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

// Date formatting utilities (unchanged)
const formatDate = (dateString) => {
  if (!dateString) return 'Not set';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Invalid date';
    return date.toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  } catch (error) {
    console.error('Error formatting date:', error);
    return 'Invalid date';
  }
};

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
    console.error('Error formatting timeline date:', error);
    return 'Invalid date';
  }
};

const TrackServicePage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [services, setServices] = useState([]);
  const [entryServices, setEntryServices] = useState([]);
  const [selectedService, setSelectedService] = useState(null);
  const [loading, setLoading] = useState(true);
  const [staffList, setStaffList] = useState([]);

  // --- UPGRADED FILTER STATES & LOCAL STORAGE ---
  const getSavedFilters = () => {
    try {
      const saved = localStorage.getItem('staffServiceSavedView');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('Could not load saved filters', e);
    }
    // Default: show current user's tasks if no saved preference
    const currentUser = getCurrentStaffId();
    return { status: 'all', staff: currentUser || 'all', expiry: 'all' };
  };

  const initialFilters = getSavedFilters();

  const [searchTerm, setSearchTerm] = useState('');
  const [aadhaarSearch, setAadhaarSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(initialFilters.status);
  const [staffFilter, setStaffFilter] = useState(initialFilters.staff);
  const [expiryFilter, setExpiryFilter] = useState(initialFilters.expiry);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [showUrgentOnly, setShowUrgentOnly] = useState(false); // New urgent filter

  // Helper to get current staff id (placeholder – replace with actual auth context)
  const getCurrentStaffId = () => {
    // In a real app, use your auth context or local storage
    // For demo, return a sample number (e.g., from localStorage or a global state)
    return localStorage.getItem('currentStaffId') || null;
  };

  const currentStaffId = getCurrentStaffId();

  const handleSaveView = () => {
    const filtersToSave = {
      status: statusFilter,
      staff: staffFilter,
      expiry: expiryFilter,
      urgentOnly: showUrgentOnly
    };
    localStorage.setItem('staffServiceSavedView', JSON.stringify(filtersToSave));
    toast.success('Your custom view has been saved!');
  };

  const handleClearFilters = () => {
    setStatusFilter('all');
    setStaffFilter(currentStaffId || 'all');
    setExpiryFilter('all');
    setSearchTerm('');
    setAadhaarSearch('');
    setShowUrgentOnly(false);
  };

  // Toggle between My Tasks and All Services
  const handleSetMyTasks = () => {
    if (currentStaffId) {
      setStaffFilter(currentStaffId);
      toast.success('Showing your assigned tasks');
    } else {
      toast.warn('Current staff not identified');
    }
  };

  const handleSetAllServices = () => {
    setStaffFilter('all');
    toast.success('Showing all services');
  };
  // ----------------------------------------------

  const [categories, setCategories] = useState([]);
  const [activeTab, setActiveTab] = useState('overview');
  const [trackingFormData, setTrackingFormData] = useState({
    applicationNumber: '',
    currentStep: '',
    estimatedDelivery: '',
    averageTime: '',
    notes: '',
    assignedTo: '',
    aadhaar: '',
    email: '',
    priority: 'medium'
  });
  const [timeRange, setTimeRange] = useState('week');
  const [viewMode, setViewMode] = useState('table'); // Default to table view for clarity
  const [isSidebarVisible, setIsSidebarVisible] = useState(true);

  // Status mappings (unchanged)
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

  const statusConfig = {
    'Pending': { 
      color: 'text-amber-800', 
      bg: 'bg-amber-100', 
      border: 'border-amber-300',
      dot: 'bg-amber-600',
      button: 'bg-amber-600 hover:bg-amber-700 text-white'
    },
    'In Progress': { 
      color: 'text-blue-800', 
      bg: 'bg-blue-100', 
      border: 'border-blue-300',
      dot: 'bg-blue-600',
      button: 'bg-blue-600 hover:bg-blue-700 text-white'
    },
    'Delayed': { 
      color: 'text-rose-800', 
      bg: 'bg-rose-100', 
      border: 'border-rose-300',
      dot: 'bg-rose-600',
      button: 'bg-rose-600 hover:bg-rose-700 text-white'
    },
    'Completed': { 
      color: 'text-emerald-800', 
      bg: 'bg-emerald-100', 
      border: 'border-emerald-300',
      dot: 'bg-emerald-600',
      button: 'bg-emerald-600 hover:bg-emerald-700 text-white'
    },
    'Resubmit': { 
      color: 'text-orange-800', 
      bg: 'bg-orange-100', 
      border: 'border-orange-300',
      dot: 'bg-orange-600',
      button: 'bg-orange-600 hover:bg-orange-700 text-white'
    },
    'Paid': { 
      color: 'text-green-700', 
      bg: 'bg-green-100', 
      border: 'border-green-300',
      dot: 'bg-green-600',
      button: 'bg-green-600 hover:bg-green-700 text-white'
    }
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

  const paymentStatusConfig = {
    'Not Applicable': { color: 'text-gray-600', bg: 'bg-gray-50', border: 'border-gray-200', dot: 'bg-gray-400' },
    'Received': { color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', dot: 'bg-emerald-500' },
    'Partial': { color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200', dot: 'bg-amber-400' },
    'Pending': { color: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-200', dot: 'bg-rose-500' },
    'Processing': { color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200', dot: 'bg-blue-500' },
    'default': { color: 'text-gray-600', bg: 'bg-gray-50', border: 'border-gray-200', dot: 'bg-gray-400' }
  };

  const stepOptions = [
    { value: 'Submitted', label: 'Submitted' },
    { value: 'Initial Review', label: 'Initial Review' },
    { value: 'Document Verification', label: 'Document Verification' },
    { value: 'Final Approval', label: 'Final Approval' }
  ];

  const priorityOptions = [
    { value: 'low', label: 'Low' },
    { value: 'medium', label: 'Medium' },
    { value: 'high', label: 'High' }
  ];

  // Progress calculation (unchanged)
  const calculateProgress = (status, currentStep) => {
    const stepProgress = {
      'Submitted': 25,
      'Initial Review': 50,
      'Document Verification': 75,
      'Final Approval': 100
    };
    if (status === 'Completed' || status === 'Paid') return 100;
    return stepProgress[currentStep] || 25;
  };

  // Format payments (unchanged)
  const formatPayments = (payments) => {
    if (!Array.isArray(payments) || payments.length === 0) return 'No payments recorded';
    return payments.map(p => {
      const method = p.method === 'cash' ? 'Cash' : p.method === 'digital_wallet' ? 'Digital Wallet' : p.method;
      return `${method}: ₹${Number(p.amount).toFixed(2)} (${p.status})`;
    }).join(', ');
  };

  const formatDateForInput = (dateString) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return '';
      return date.toISOString().split('T')[0];
    } catch (error) {
      console.error('Error formatting date for input:', error);
      return '';
    }
  };

  // Fetch payment details (unchanged)
  const fetchPaymentDetails = async (serviceEntryId, serviceEntries) => {
    try {
      const serviceEntry = serviceEntries.find(entry => entry.id === serviceEntryId);
      if (!serviceEntry) {
        return { payments: [], totalCharge: 0, paymentStatus: 'Not Applicable', paymentDetails: 'No payments recorded' };
      }
      const payments = Array.isArray(serviceEntry.payments) ? serviceEntry.payments : [];
      const totalCharge = parseFloat(serviceEntry.totalCharge || serviceEntry.total_charges || 0);
      const totalReceived = payments.filter(p => p.status === 'received').reduce((sum, p) => sum + (parseFloat(p.amount || 0)), 0);
      let paymentStatus;
      if (totalCharge <= 0) paymentStatus = 'Not Applicable';
      else if (totalReceived >= totalCharge) paymentStatus = 'Received';
      else if (totalReceived > 0) paymentStatus = 'Partial';
      else paymentStatus = 'Pending';
      return { payments, totalCharge, paymentStatus, paymentDetails: formatPayments(payments) };
    } catch (err) {
      console.error('Error processing payment details:', err);
      return { payments: [], totalCharge: 0, paymentStatus: 'Pending', paymentDetails: 'Error fetching payments' };
    }
  };

  // Transform backend data (unchanged)
  const transformBackendData = async (trackingData, serviceEntries) => {
    const transformed = [];
    for (const trackingEntry of trackingData) {
      const paymentData = await fetchPaymentDetails(trackingEntry.service_entry_id, serviceEntries);
      const updatedDate = new Date(trackingEntry.updated_at);
      const dateStr = updatedDate.toISOString().split('T')[0];
      const timeStr = updatedDate.toTimeString().split(' ')[0].substring(0, 5);
      const calculatedProgress = calculateProgress(
        statusMap[trackingEntry.status] || 'Pending',
        trackingEntry.current_step || 'Submitted'
      );
      const workSource = trackingEntry.work_source || (trackingEntry.customer_service_id ? 'online' : 'offline');
      transformed.push({
        id: trackingEntry.id.toString(),
        serviceEntryId: trackingEntry.service_entry_id?.toString(),
        trackingId: `TR-${trackingEntry.id}`,
        applicationNumber: trackingEntry.application_number || `APP${trackingEntry.service_entry_id}`,
        customerName: trackingEntry.customer_name || 'Unknown',
        customerPhone: trackingEntry.phone || 'N/A',
        customerEmail: trackingEntry.email || `${trackingEntry.customer_name?.toLowerCase().replace(/\s+/g, '') || 'unknown'}@example.com`,
        serviceType: trackingEntry.service_name || 'Unknown',
        serviceName: trackingEntry.service_name || 'Unknown',
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
        progress: calculatedProgress,
        priority: trackingEntry.priority || 'medium',
        date: dateStr,
        time: timeStr,
        estimatedDelivery: formatDate(trackingEntry.estimated_delivery),
        expiryDate: formatDate(trackingEntry.expiry_date),
        createdAt: trackingEntry.updated_at,
        updatedAt: trackingEntry.updated_at,
        duration: null,
        notes: trackingEntry.notes || 'No notes available',
        rating: null,
        followUpRequired: trackingEntry.status === 'rejected' || trackingEntry.status === 'resubmit',
        paymentStatus: paymentData.paymentStatus,
        paymentDetails: paymentData.paymentDetails,
        payments: paymentData.payments,
        phone: trackingEntry.phone || 'N/A',
        email: trackingEntry.email || '',
        aadhaar: trackingEntry.aadhaar || '',
        steps: Array.isArray(trackingEntry.steps) ? trackingEntry.steps.map(step => ({
          id: step.id, name: step.name, completed: step.completed,
          date: step.date, created_at: step.created_at, step_order: step.step_order,
          estimated_days: step.estimated_days
        })) : [],
        averageTime: trackingEntry.average_time || '7 days',
        rawEstimatedDelivery: trackingEntry.estimated_delivery,
        rawExpiryDate: trackingEntry.expiry_date,
        workSource: workSource,
        serviceRating: trackingEntry.service_rating,
        staffRating: trackingEntry.staff_rating,
        reviewText: trackingEntry.review_text,
        reviewSubmittedAt: trackingEntry.submitted_at
      });
    }
    return transformed;
  };

  // Fetch all entries (unchanged)
  const fetchAllTrackingEntries = async () => {
    try {
      const [trackingResponse, entryResponse, staffResponse, categoriesResponse] = await Promise.all([
        getTrackingEntries(),
        getServiceEntries(),
        getStaff(),
        getCategories()
      ]);
      const staffData = Array.isArray(staffResponse) ? staffResponse : Array.isArray(staffResponse?.data) ? staffResponse.data : [];
      const categoriesData = Array.isArray(categoriesResponse) ? categoriesResponse : Array.isArray(categoriesResponse?.data) ? categoriesResponse.data : [];
      const entryData = Array.isArray(entryResponse) ? entryResponse : Array.isArray(entryResponse?.data) ? entryResponse.data : [];
      const trackingData = Array.isArray(trackingResponse) ? trackingResponse : Array.isArray(trackingResponse?.data) ? trackingResponse.data : [];

      if (trackingData.length === 0) {
        toast.warn('No service tracking entries found');
      }

      setStaffList(staffData);
      setCategories(categoriesData);
      setEntryServices(entryData);

      const transformedServices = await transformBackendData(trackingData, entryData);
      setServices(transformedServices);

      if (transformedServices.length > 0) {
        const firstService = transformedServices[0];
        setSelectedService(firstService);
        setTrackingFormData({
          applicationNumber: firstService.applicationNumber || `APP${firstService.serviceEntryId}`,
          currentStep: firstService.currentStep || 'Submitted',
          estimatedDelivery: formatDateForInput(firstService.rawEstimatedDelivery) || '',
          averageTime: firstService.averageTime || '7 days',
          notes: firstService.notes || '',
          assignedTo: firstService.assignedToId || '',
          aadhaar: firstService.aadhaar || '',
          email: firstService.email || '',
          priority: firstService.priority || 'medium',
        });
      }
      setIsSidebarVisible(true);
      toast.success(`Loaded ${transformedServices.length} service tracking entries`);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to fetch data: ' + (error.response?.data?.error || error.message));
      setStaffList([]);
      setCategories([]);
      setEntryServices([]);
    }
  };

  const fetchSingleTrackingEntry = async (entryId) => {
    try {
      const [response, staffResponse] = await Promise.all([getTrackingEntryById(entryId), getStaff()]);
      const entryResponse = await getServiceEntries();
      const entryData = Array.isArray(entryResponse) ? entryResponse : Array.isArray(entryResponse?.data) ? entryResponse.data : [];
      const staffData = Array.isArray(staffResponse) ? staffResponse : Array.isArray(staffResponse?.data) ? staffResponse.data : [];
      setStaffList(staffData);
      const transformed = await transformBackendData([response], entryData);
      if (transformed.length > 0) {
        setServices(transformed);
        setSelectedService(transformed[0]);
        const assignedStaff = staffData.find(staff => staff.id === transformed[0].assignedToId);
        setTrackingFormData({
          applicationNumber: transformed[0].applicationNumber || `APP${transformed[0].serviceEntryId}`,
          currentStep: transformed[0].currentStep || 'Submitted',
          estimatedDelivery: formatDateForInput(transformed[0].rawEstimatedDelivery) || '',
          averageTime: transformed[0].averageTime || '7 days',
          notes: transformed[0].notes || '',
          assignedTo: transformed[0].assignedToId || '',
          aadhaar: transformed[0].aadhaar || '',
          email: transformed[0].email || '',
          priority: transformed[0].priority || 'medium',
        });
        if (assignedStaff) {
          setSelectedService(prev => ({ ...prev, assignedTo: assignedStaff.name, assignedToId: assignedStaff.id }));
        }
        setIsSidebarVisible(false);
      }
    } catch (error) {
      console.error('Error fetching single entry:', error);
      toast.error('Failed to load the specific application');
      await fetchAllTrackingEntries();
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        if (id) {
          await fetchSingleTrackingEntry(id);
        } else {
          await fetchAllTrackingEntries();
        }
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [id]);

  // Updated filtering with urgent-only flag
  const filteredServices = useMemo(() => {
    return services.filter(service => {
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = !searchTerm ||
        (service.customerName?.toLowerCase().includes(searchLower)) ||
        (service.phone?.includes(searchTerm)) ||
        (service.serviceType?.toLowerCase().includes(searchLower)) ||
        (service.applicationNumber?.toLowerCase().includes(searchLower)) ||
        (service.email?.toLowerCase().includes(searchLower));
      
      const matchesAadhaarSearch = !aadhaarSearch || (service.aadhaar?.includes(aadhaarSearch));
      const matchesStatus = statusFilter === 'all' || service.status === statusFilter;
      const matchesStaff = staffFilter === 'all' || service.assignedToId?.toString() === staffFilter.toString();

      let matchesExpiry = true;
      if (expiryFilter !== 'all') {
        if (!service.rawExpiryDate) {
          matchesExpiry = false;
        } else {
          const expiryDate = new Date(service.rawExpiryDate);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          if (expiryFilter === 'upcoming') {
            matchesExpiry = expiryDate >= today && service.status !== 'Completed';
          } else if (expiryFilter === 'overdue') {
            matchesExpiry = expiryDate < today && service.status !== 'Completed';
          }
        }
      }

      let matchesUrgent = true;
      if (showUrgentOnly) {
        const today = new Date();
        const threeDaysLater = new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000);
        const isUrgent = service.priority === 'high' ||
          (service.rawExpiryDate && new Date(service.rawExpiryDate) < threeDaysLater && service.status !== 'Completed');
        matchesUrgent = isUrgent;
      }

      return matchesSearch && matchesAadhaarSearch && matchesStatus && matchesStaff && matchesExpiry && matchesUrgent;
    });
  }, [services, searchTerm, aadhaarSearch, statusFilter, staffFilter, expiryFilter, showUrgentOnly]);

  // Stats for summary badges
  const myTasksStats = useMemo(() => {
    const myTasks = staffFilter === 'all' ? services : services.filter(s => s.assignedToId?.toString() === staffFilter);
    const inProgress = myTasks.filter(s => s.status === 'In Progress').length;
    const overdue = myTasks.filter(s => {
      if (!s.rawExpiryDate || s.status === 'Completed') return false;
      return new Date(s.rawExpiryDate) < new Date();
    }).length;
    const completed = myTasks.filter(s => s.status === 'Completed').length;
    return { inProgress, overdue, completed };
  }, [services, staffFilter]);

  const handleUpdateStatus = async (serviceId, newStatus) => {
    try {
      const apiStatus = reverseStatusMap[newStatus] || newStatus;
      const service = services.find(s => s.id === serviceId);
      const newProgress = calculateProgress(newStatus, service.currentStep);
      await updateTrackingStatus(serviceId, apiStatus);
      toast.success(`Status updated to ${newStatus}`);
      const updatedServices = services.map(s =>
        s.id === serviceId ? { ...s, status: newStatus, progress: newProgress } : s
      );
      setServices(updatedServices);
      if (selectedService?.id === serviceId) {
        setSelectedService({ ...selectedService, status: newStatus, progress: newProgress });
      }
    } catch (error) {
      toast.error('Failed to update status: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleNotifyCustomer = async (service) => {
    try {
      await notifyCustomer(service.id, `Dear ${service.customerName}, your ${service.serviceType} application (App No: ${service.applicationNumber || 'N/A'}) is now ${service.status}.`);
      toast.success(`Notification sent to ${service.customerName} via WhatsApp`);
    } catch (error) {
      toast.error('Failed to send notification: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleTrackingFormChange = (e) => {
    const { name, value } = e.target;
    setTrackingFormData({ ...trackingFormData, [name]: value });
  };

  const handleTrackingFormSubmit = async (e) => {
    e.preventDefault();
    try {
      if (trackingFormData.aadhaar && !/^\d{12}$/.test(trackingFormData.aadhaar)) {
        throw new Error('Aadhaar number must be exactly 12 digits');
      }
      const newProgress = calculateProgress(selectedService.status, trackingFormData.currentStep);
      const payload = {
        applicationNumber: trackingFormData.applicationNumber || null,
        currentStep: trackingFormData.currentStep || null,
        estimatedDelivery: trackingFormData.estimatedDelivery || null,
        averageTime: trackingFormData.averageTime || '7 days',
        notes: trackingFormData.notes || null,
        assignedTo: trackingFormData.assignedTo ? parseInt(trackingFormData.assignedTo) : null,
        aadhaar: trackingFormData.aadhaar || null,
        email: trackingFormData.email || null,
        priority: trackingFormData.priority || 'medium',
        progress: newProgress
      };
      await updateTrackingEntry(selectedService.id, payload);
      toast.success('Tracking details updated successfully');
      const updatedServices = services.map(s =>
        s.id === selectedService.id ? {
          ...s,
          applicationNumber: trackingFormData.applicationNumber || `APP${s.serviceEntryId}`,
          currentStep: trackingFormData.currentStep || 'Submitted',
          estimatedDelivery: formatDate(trackingFormData.estimatedDelivery),
          averageTime: trackingFormData.averageTime || '7 days',
          notes: trackingFormData.notes || '',
          assignedTo: staffList.find(st => st.id === parseInt(trackingFormData.assignedTo))?.name || 'Unassigned',
          assignedToId: trackingFormData.assignedTo,
          aadhaar: trackingFormData.aadhaar || '',
          email: trackingFormData.email || '',
          priority: trackingFormData.priority || 'medium',
          progress: newProgress,
          rawEstimatedDelivery: trackingFormData.estimatedDelivery
        } : s
      );
      setServices(updatedServices);
      setSelectedService(prev => ({
        ...prev,
        applicationNumber: trackingFormData.applicationNumber || `APP${prev.serviceEntryId}`,
        currentStep: trackingFormData.currentStep || 'Submitted',
        estimatedDelivery: formatDate(trackingFormData.estimatedDelivery),
        averageTime: trackingFormData.averageTime || '7 days',
        notes: trackingFormData.notes || '',
        assignedTo: staffList.find(st => st.id === parseInt(trackingFormData.assignedTo))?.name || 'Unassigned',
        assignedToId: trackingFormData.assignedTo,
        aadhaar: trackingFormData.aadhaar || '',
        email: trackingFormData.email || '',
        priority: trackingFormData.priority || 'medium',
        progress: newProgress,
        rawEstimatedDelivery: trackingFormData.estimatedDelivery
      }));
      setActiveTab('overview');
    } catch (error) {
      toast.error('Failed to update tracking details: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleServiceSelect = (service) => {
    setSelectedService(service);
    setTrackingFormData({
      applicationNumber: service.applicationNumber || `APP${service.serviceEntryId}`,
      currentStep: service.currentStep || 'Submitted',
      estimatedDelivery: formatDateForInput(service.rawEstimatedDelivery) || '',
      averageTime: service.averageTime || '7 days',
      notes: service.notes || '',
      assignedTo: service.assignedToId || '',
      aadhaar: service.aadhaar || '',
      email: service.email || '',
      priority: service.priority || 'medium',
    });
    setActiveTab('overview');
    if (!id) {
      navigate(`/dashboard/staff/track_service/${service.id}`, { replace: true });
    }
  };

  const handleBackToList = () => {
    navigate('/dashboard/staff/track_service');
  };

  const stats = {
    total: services.length,
    completed: services.filter(s => s.status === 'Completed').length,
    inProgress: services.filter(s => s.status === 'In Progress').length,
    delayed: services.filter(s => s.status === 'Delayed').length,
    pending: services.filter(s => s.status === 'Pending').length
  };

  const TimelineItem = ({ title, dateTime, completed, current }) => (
    <div className="flex items-center space-x-3">
      <div className={`w-2 h-2 rounded-full ${completed ? 'bg-emerald-500' : current ? 'bg-indigo-500' : 'bg-gray-300'}`}></div>
      <div className="flex-1">
        <p className={`text-sm font-medium ${completed || current ? 'text-gray-900' : 'text-gray-500'}`}>{title}</p>
        <p className="text-xs text-gray-500">{dateTime}</p>
      </div>
    </div>
  );

  // OverviewView (unchanged)
  const OverviewView = ({ service, onUpdateStatus, priorityConfig }) => {
    const getDisplaySteps = () => {
      if (service.steps && service.steps.length > 0) {
        return service.steps.sort((a, b) => a.step_order - b.step_order);
      }
      const allSteps = [
        { id: 1, name: 'Submitted', completed: true, step_order: 1 },
        { id: 2, name: 'Initial Review', completed: ['Initial Review', 'Document Verification', 'Final Approval'].includes(service.currentStep), step_order: 2 },
        { id: 3, name: 'Document Verification', completed: ['Document Verification', 'Final Approval'].includes(service.currentStep), step_order: 3 },
        { id: 4, name: 'Final Approval', completed: service.currentStep === 'Final Approval', step_order: 4 }
      ];
      return allSteps;
    };
    const displaySteps = getDisplaySteps();

    return (
      <div className="space-y-6">
        <div className="flex justify-end">
          {service.workSource === "online" ? (
            <span className="px-3 py-1 text-xs font-medium bg-green-100 text-green-700 rounded-full border border-green-200">Online Booking</span>
          ) : (
            <span className="px-3 py-1 text-xs font-medium bg-blue-100 text-blue-700 rounded-full border border-blue-200">Offline Walk-in</span>
          )}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <h3 className="font-semibold text-gray-900 mb-4">Service Progress</h3>
            <div className="space-y-4">
              <div className="flex justify-between text-sm">
                <span className="font-medium">Completion Progress</span>
                <span className="text-indigo-600 font-semibold">{service.progress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div className="bg-gradient-to-r from-indigo-500 to-purple-600 h-3 rounded-full transition-all duration-500" style={{ width: `${service.progress}%` }}></div>
              </div>
              <div className="grid grid-cols-4 gap-2 text-xs text-gray-600">
                <div className="text-center">Submitted</div>
                <div className="text-center">Initial Review</div>
                <div className="text-center">Document Verification</div>
                <div className="text-center">Final Approval</div>
              </div>
            </div>
            <div className="mt-6">
              <h4 className="font-semibold text-gray-900 mb-3">Update Status</h4>
              <div className="flex flex-wrap gap-2">
                {Object.keys(statusConfig).map(statusKey => (
                  <button
                    key={statusKey}
                    className={`px-4 py-2 rounded-lg flex items-center text-sm transition-colors ${service.status === statusKey ? 'bg-gray-600 text-white cursor-not-allowed opacity-75' : `${statusConfig[statusKey].button} hover:shadow-md transform hover:scale-105`}`}
                    onClick={() => onUpdateStatus(service.id, statusKey)}
                    disabled={service.status === statusKey}
                  >
                    {statusKey === 'In Progress' && <FiTrendingUp className="mr-2" />}
                    {statusKey === 'Delayed' && <FiAlertCircle className="mr-2" />}
                    {statusKey === 'Completed' && <FiCheckCircle className="mr-2" />}
                    {statusKey === 'Pending' && <FiClock className="mr-2" />}
                    {statusKey === 'Resubmit' && <FiRefreshCw className="mr-2" />}
                    {statusKey === 'Paid' && <FiDollarSign className="mr-2" />}
                    {statusKey}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 mb-4">Timeline</h3>
            <div className="space-y-3">
              {displaySteps.map(step => (
                <TimelineItem key={step.id} title={step.name} dateTime={formatTimelineDate(step.date || service.createdAt)} completed={step.completed} current={step.name === service.currentStep} />
              ))}
            </div>
          </div>
        </div>
        {/* rest of overview unchanged */}
      </div>
    );
  };

  const KPIStat = ({ title, value, subtitle, trend, icon: Icon, color }) => (
    <motion.div whileHover={{ y: -2 }} className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-lg transition-all duration-300 group">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mb-1">{value}</p>
          <div className="flex items-center space-x-2">
            <span className={`text-xs font-medium ${trend > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{trend > 0 ? '+' : ''}{trend}%</span>
            <span className="text-xs text-gray-500">{subtitle}</span>
          </div>
        </div>
        <div className={`p-3 rounded-xl ${color} transition-colors group-hover:scale-110`}>
          <Icon className="h-6 w-6 text-white" />
        </div>
      </div>
    </motion.div>
  );

  // New: Compact Table Row for the sidebar list
  const ServiceTableRow = ({ service, isSelected, onClick }) => {
    const status = statusConfig[service.status] || statusConfig['Pending'];
    const priority = priorityConfig[service.priority || 'medium'];
    const isUrgent = service.priority === 'high' || (service.rawExpiryDate && new Date(service.rawExpiryDate) < new Date(Date.now() + 3*86400000));
    return (
      <tr 
        className={`cursor-pointer transition-colors ${isSelected ? 'bg-indigo-50' : 'hover:bg-gray-50'} ${isUrgent ? 'bg-red-50 border-l-4 border-rose-600' : ''}`}
        onClick={onClick}
      >
        <td className="p-3 whitespace-nowrap">
          <div className="flex items-center space-x-2">
            <FiUser className="h-4 w-4 text-gray-500" />
            <span className="font-medium text-sm text-gray-900 truncate max-w-[120px]">{service.customerName || 'Unknown'}</span>
          </div>
        </td>
        <td className="p-3 whitespace-nowrap">
          <span className="text-xs text-gray-600">{service.applicationNumber || 'N/A'}</span>
        </td>
        <td className="p-3 whitespace-nowrap">
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${status.bg} ${status.border} ${status.color}`}>
            {service.status}
          </span>
        </td>
        <td className="p-3 whitespace-nowrap">
          <span className={`inline-flex items-center space-x-1 text-xs font-medium ${priority.color}`}>
            <FiFlag className="h-3 w-3" />
            <span>{priority.label}</span>
          </span>
        </td>
        <td className="p-3 whitespace-nowrap text-xs text-gray-600">
          {service.expiryDate || 'N/A'}
        </td>
        <td className="p-3 whitespace-nowrap">
          <div className="flex items-center space-x-2">
            {service.workSource === 'online' ? (
              <span className="text-[10px] bg-green-100 text-green-700 px-1.5 rounded-full">Online</span>
            ) : (
              <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 rounded-full">Offline</span>
            )}
            <button 
              className="text-indigo-600 hover:text-indigo-800"
              onClick={(e) => { e.stopPropagation(); handleServiceSelect(service); }}
            >
              <FiEdit className="h-4 w-4" />
            </button>
          </div>
        </td>
      </tr>
    );
  };

  const ServiceCard = ({ service, isSelected, onClick }) => {
    const config = statusConfig[service.status] || statusConfig['Pending'];
    const priority = priorityConfig[service.priority || 'medium'];
    return (
      <motion.div whileHover={{ y: -2 }} className={`p-3 rounded-xl border-2 cursor-pointer transition-all duration-300 ${isSelected ? 'border-indigo-500 bg-indigo-50 shadow-md' : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'}`} onClick={onClick}>
        {/* card content unchanged */}
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center space-x-2 min-w-0 flex-1">
            <div className="relative flex-shrink-0">
              <div className="w-8 h-8 bg-gradient-to-br from-gray-800 to-gray-600 rounded-lg flex items-center justify-center">
                <FiUser className="h-4 w-4 text-white" />
              </div>
              <div className={`absolute -top-1 -right-1 w-2 h-2 rounded-full border-2 border-white ${config.dot}`}></div>
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold text-gray-900 text-sm truncate" title={service.customerName || 'Unknown'}>{service.customerName || 'Unknown'}</h3>
              <p className="text-xs text-gray-500 truncate" title={service.phone || 'N/A'}>{service.phone || 'N/A'}</p>
            </div>
          </div>
        </div>
        <div className="mb-2">
          <p className="text-sm font-medium text-gray-900 truncate" title={service.serviceType || 'Unknown'}>{service.serviceType || 'Unknown'}</p>
          <p className="text-xs text-gray-600 truncate" title={service.subcategoryName || 'N/A'}>{service.subcategoryName || 'N/A'}</p>
        </div>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1 flex-shrink-0">
            <span className={`px-1.5 py-0.5 rounded-full text-xs font-medium flex items-center space-x-1 ${config.bg} ${config.border}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`}></span>
              <span className={config.color}>{service.status}</span>
            </span>
            <span className={`px-1.5 py-0.5 rounded-full text-xs font-medium flex items-center space-x-1 ${priority.bg} ${priority.border}`}>
              <FiFlag className={`h-2.5 w-2.5 ${priority.color}`} />
              <span className={priority.color}>{priority.label}</span>
            </span>
          </div>
        </div>
        <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100">
          <div className="text-xs text-gray-500 truncate flex-1 min-w-0 mr-2">
            {service.applicationNumber ? `App: ${service.applicationNumber}` : 'No App Number'}
          </div>
          <div className="text-xs font-medium text-indigo-600 whitespace-nowrap flex-shrink-0">
            {service.averageTime || 'Not set'}
          </div>
        </div>
        <div className="mt-2">
          {service.workSource === "online" ? (
            <span className="px-1.5 py-0.5 text-[10px] bg-green-100 text-green-700 rounded-full border border-green-200">Online</span>
          ) : (
            <span className="px-1.5 py-0.5 text-[10px] bg-blue-100 text-blue-700 rounded-full border border-blue-200">Offline</span>
          )}
        </div>
      </motion.div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Loading service dashboard...</p>
        </div>
      </div>
    );
  }

  // Pre-sort staff list with current user first
  const sortedStaffList = useMemo(() => {
    if (!currentStaffId) return staffList;
    const current = staffList.find(staff => staff.id.toString() === currentStaffId);
    const others = staffList.filter(staff => staff.id.toString() !== currentStaffId);
    return current ? [current, ...others] : staffList;
  }, [staffList, currentStaffId]);

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gray-50">
        <ToastContainer position="top-right" autoClose={3000} hideProgressBar={false} newestOnTop closeOnClick rtl={false} pauseOnFocusLoss draggable pauseOnHover />
        
        <header className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="w-9 h-9 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-lg flex items-center justify-center shadow-lg">
                  <FiTarget className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-gray-900">Service Management</h1>
                  <p className="text-gray-600 text-sm">Track and manage service applications</p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                {id && (
                  <button onClick={handleBackToList} className="flex items-center space-x-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-all duration-200">
                    <FiArrowLeft className="h-4 w-4" /><span>Back to List</span>
                  </button>
                )}
                <select className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" value={timeRange} onChange={(e) => setTimeRange(e.target.value)}>
                  <option value="week">Last 7 days</option>
                  <option value="month">Last 30 days</option>
                  <option value="quarter">Last quarter</option>
                </select>
                <button className="flex items-center space-x-2 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-all duration-200 shadow-sm" onClick={() => window.location.reload()}>
                  <FiRefreshCw className="h-4 w-4" /><span>Refresh</span>
                </button>
              </div>
            </div>
          </div>
        </header>
        
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <KPIStat title="Total Services" value={stats.total} subtitle="This month" trend={12} icon={FiBarChart2} color="bg-gradient-to-br from-blue-500 to-blue-600" />
            <KPIStat title="In Progress" value={stats.inProgress} subtitle="Active now" trend={8} icon={FiTrendingUp} color="bg-gradient-to-br from-amber-500 to-amber-600" />
            <KPIStat title="Completed" value={stats.completed} subtitle="On track" trend={15} icon={FiCheckCircle} color="bg-gradient-to-br from-emerald-500 to-emerald-600" />
            <KPIStat title="SLA Compliance" value="94%" subtitle="Above target" trend={2} icon={FiAward} color="bg-gradient-to-br from-purple-500 to-purple-600" />
          </div>
          
          <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
            {isSidebarVisible && (
              <div className="xl:col-span-1">
                {/* Quick Actions */}
                <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-gray-900">Quick Actions</h3>
                    <div className="flex space-x-1">
                      <button onClick={() => setViewMode('grid')} className={`p-2 rounded-lg ${viewMode === 'grid' ? 'bg-indigo-100 text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}><FiGrid className="h-4 w-4" /></button>
                      <button onClick={() => setViewMode('table')} className={`p-2 rounded-lg ${viewMode === 'table' ? 'bg-indigo-100 text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}><FiList className="h-4 w-4" /></button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <button className="p-3 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors flex flex-col items-center justify-center">
                      <FiPlus className="h-5 w-5 mb-1" /><span className="text-xs font-medium">New Service</span>
                    </button>
                    <button className="p-3 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 transition-colors flex flex-col items-center justify-center">
                      <FiDownload className="h-5 w-5 mb-1" /><span className="text-xs font-medium">Export</span>
                    </button>
                    <button className="p-3 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors flex flex-col items-center justify-center">
                      <FiFilter className="h-5 w-5 mb-1" /><span className="text-xs font-medium">Filters</span>
                    </button>
                    <button className="p-3 bg-purple-50 text-purple-600 rounded-lg hover:bg-purple-100 transition-colors flex flex-col items-center justify-center">
                      <FiPrinter className="h-5 w-5 mb-1" /><span className="text-xs font-medium">Print</span>
                    </button>
                  </div>
                </div>

                {/* New: My Tasks / All Services Toggle */}
                <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
                  <div className="flex items-center justify-center space-x-3">
                    <button
                      onClick={handleSetMyTasks}
                      className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${staffFilter === (currentStaffId || 'all') && staffFilter !== 'all' ? 'bg-indigo-600 text-white shadow-md' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                    >
                      My Tasks
                    </button>
                    <button
                      onClick={handleSetAllServices}
                      className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${staffFilter === 'all' ? 'bg-indigo-600 text-white shadow-md' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                    >
                      All Services
                    </button>
                  </div>
                  {/* Summary badges for current user */}
                  <div className="flex justify-center space-x-4 mt-3 text-xs">
                    <span className="flex items-center space-x-1 cursor-pointer hover:text-indigo-600" onClick={() => { setStaffFilter(currentStaffId); setStatusFilter('In Progress'); }}>
                      <FiTrendingUp className="h-3 w-3 text-amber-600" />
                      <span>{myTasksStats.inProgress} In Progress</span>
                    </span>
                    <span className="flex items-center space-x-1 cursor-pointer hover:text-indigo-600" onClick={() => { setStaffFilter(currentStaffId); setExpiryFilter('overdue'); }}>
                      <FiAlertTriangle className="h-3 w-3 text-rose-600" />
                      <span>{myTasksStats.overdue} Overdue</span>
                    </span>
                    <span className="flex items-center space-x-1 cursor-pointer hover:text-indigo-600" onClick={() => { setStaffFilter(currentStaffId); setStatusFilter('Completed'); }}>
                      <FiCheckCircle className="h-3 w-3 text-emerald-600" />
                      <span>{myTasksStats.completed} Done</span>
                    </span>
                  </div>
                </div>
                
                {/* Filters Panel */}
                <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-gray-900 flex items-center gap-2"><FiFilter className="text-indigo-600" /> Filters</h3>
                    <button onClick={handleSaveView} className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2 py-1.5 rounded-md hover:bg-indigo-100 transition-colors">Save My View</button>
                  </div>
                  <div className="space-y-4">
                    <div className="relative">
                      <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                      <input type="text" placeholder="Search name, phone, app no..." className="w-full pl-10 pr-4 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                    </div>
                    <button onClick={() => setShowAdvancedFilters(!showAdvancedFilters)} className="flex items-center justify-between w-full text-sm font-medium text-gray-600 hover:text-indigo-600 py-2 border-b border-gray-100 transition-colors">
                      <span>Advanced Filters</span>
                      <FiChevronDown className={`transition-transform duration-300 ${showAdvancedFilters ? 'rotate-180' : ''}`} />
                    </button>
                    <AnimatePresence>
                      {showAdvancedFilters && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="space-y-4 overflow-hidden pt-2">
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1.5">Status</label>
                            <div className="relative">
                              <select className="w-full px-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none cursor-pointer" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                                <option value="all">All Statuses</option>
                                <option value="Pending">Pending</option>
                                <option value="In Progress">In Progress</option>
                                <option value="Delayed">Delayed</option>
                                <option value="Completed">Completed</option>
                                <option value="Resubmit">Resubmit</option>
                                <option value="Paid">Paid</option>
                              </select>
                              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-400"><FiChevronDown className="h-4 w-4" /></div>
                            </div>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1.5">Assigned Staff</label>
                            <div className="relative">
                              <select className="w-full px-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none cursor-pointer" value={staffFilter} onChange={(e) => setStaffFilter(e.target.value)}>
                                <option value="all">Everyone</option>
                                {sortedStaffList.map(staff => (
                                  <option key={staff.id} value={staff.id}>{staff.name}</option>
                                ))}
                              </select>
                              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-400"><FiChevronDown className="h-4 w-4" /></div>
                            </div>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1.5">Timeline</label>
                            <div className="relative">
                              <select className="w-full px-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none cursor-pointer" value={expiryFilter} onChange={(e) => setExpiryFilter(e.target.value)}>
                                <option value="all">Any Date</option>
                                <option value="upcoming">Upcoming Expiry</option>
                                <option value="overdue">Overdue</option>
                              </select>
                              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-400"><FiChevronDown className="h-4 w-4" /></div>
                            </div>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1.5">Aadhaar Search</label>
                            <div className="relative">
                              <FiCreditCard className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                              <input type="text" placeholder="Search by Aadhaar..." className="w-full pl-10 pr-4 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all" value={aadhaarSearch} onChange={(e) => setAadhaarSearch(e.target.value)} maxLength="12" />
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <input
                              id="urgentFilter"
                              type="checkbox"
                              className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                              checked={showUrgentOnly}
                              onChange={(e) => setShowUrgentOnly(e.target.checked)}
                            />
                            <label htmlFor="urgentFilter" className="text-xs font-medium text-gray-700">Only Show Urgent</label>
                          </div>
                          <button onClick={handleClearFilters} className="w-full mt-4 py-2.5 text-xs font-semibold text-gray-600 border border-gray-200 hover:bg-gray-50 hover:text-gray-900 rounded-xl transition-all">Clear All Filters</button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
                
                {/* Services List – Table or Grid */}
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-gray-900">
                      Services <span className="text-gray-500 font-normal">({filteredServices.length})</span>
                    </h3>
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                      <span className="text-xs text-gray-500">Active</span>
                    </div>
                  </div>
                  
                  {viewMode === 'table' ? (
                    <div className="overflow-x-auto max-h-[500px] overflow-y-auto scrollbar-hide">
                      <table className="w-full text-left border-collapse">
                        <thead className="sticky top-0 bg-white border-b border-gray-200">
                          <tr className="text-xs text-gray-500 uppercase tracking-wider">
                            <th className="p-3">Customer</th>
                            <th className="p-3">App #</th>
                            <th className="p-3">Status</th>
                            <th className="p-3">Priority</th>
                            <th className="p-3">Due</th>
                            <th className="p-3">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredServices.map(service => (
                            <ServiceTableRow
                              key={service.id}
                              service={service}
                              isSelected={selectedService?.id === service.id}
                              onClick={() => handleServiceSelect(service)}
                            />
                          ))}
                          {filteredServices.length === 0 && (
                            <tr>
                              <td colSpan={6} className="text-center py-8 text-gray-500">
                                <FiSearch className="mx-auto h-8 w-8 mb-2 opacity-50" />
                                <p className="text-sm">No services found</p>
                                <p className="text-xs">Try adjusting your filters</p>
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-[500px] overflow-y-auto scrollbar-hide">
                      {filteredServices.map(service => (
                        <ServiceCard
                          key={service.id}
                          service={service}
                          isSelected={selectedService?.id === service.id}
                          onClick={() => handleServiceSelect(service)}
                        />
                      ))}
                      {filteredServices.length === 0 && (
                        <div className="text-center py-8 text-gray-500">
                          <FiSearch className="mx-auto h-8 w-8 mb-2 opacity-50" />
                          <p className="text-sm">No services found</p>
                          <p className="text-xs">Try adjusting your filters</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
            
            {/* Main content (unchanged) */}
            <div className={isSidebarVisible ? "xl:col-span-3" : "xl:col-span-4"}>
              {selectedService ? (
                <div className="space-y-6">
                  <div className="bg-white rounded-xl border border-gray-200 p-6">
                    {/* header with customer info, actions */}
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-6">
                      <div className="flex items-center space-x-4">
                        <div className="w-16 h-16 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                          <FiUser className="h-8 w-8 text-white" />
                        </div>
                        <div>
                          <h2 className="text-2xl font-bold text-gray-900">{selectedService.customerName || 'Unknown'}</h2>
                          <div className="flex items-center space-x-4 mt-2">
                            <div className="flex items-center space-x-1 text-gray-600"><FiPhone className="h-4 w-4" /><span className="text-sm">{selectedService.phone || 'N/A'}</span></div>
                            <div className="flex items-center space-x-1 text-gray-600"><FiMail className="h-4 w-4" /><span className="text-sm">{selectedService.email || 'N/A'}</span></div>
                            <div className="flex items-center space-x-1 text-gray-600"><FiCreditCard className="h-4 w-4" /><span className="text-sm">{selectedService.aadhaar || 'N/A'}</span></div>
                          </div>
                        </div>
                      </div>
                      <div className="flex space-x-2 mt-4 lg:mt-0">
                        <button className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 flex items-center space-x-2 transition-all duration-200" onClick={() => handleNotifyCustomer(selectedService)}>
                          <FiMessageSquare className="h-4 w-4" /><span>Notify</span>
                        </button>
                        <button onClick={() => navigate(`/dashboard/staff/service-workspace/${selectedService.id}`)} className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center space-x-2 transition-all duration-200">
                          <FiGrid className="h-4 w-4" /><span>Workspace</span>
                        </button>
                        <button onClick={() => setActiveTab('tracking')} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center space-x-2 transition-all duration-200">
                          <FiEdit className="h-4 w-4" /><span>Edit</span>
                        </button>
                        <button className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                          <FiMoreHorizontal className="h-4 w-4 text-gray-600" />
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                      <StatItem label="Application No." value={selectedService.applicationNumber || 'N/A'} />
                      <StatItem label="Current Step" value={selectedService.currentStep || 'N/A'} />
                      <StatItem label="Est. Delivery" value={selectedService.estimatedDelivery || 'Not set'} />
                      <StatItem label="Assigned To" value={selectedService.assignedTo || 'Unassigned'} />
                    </div>
                  </div>
                  
                  <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <div className="border-b border-gray-200">
                      <nav className="flex -mb-px">
                        {['overview', 'tracking', 'documents', 'history'].map((tab) => (
                          <button key={tab} className={`flex-1 py-4 px-6 text-center font-medium text-sm border-b-2 transition-colors ${activeTab === tab ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`} onClick={() => setActiveTab(tab)}>
                            {tab === 'overview' && 'Overview'}{tab === 'tracking' && 'Tracking'}{tab === 'documents' && 'Documents'}{tab === 'history' && 'History'}
                          </button>
                        ))}
                      </nav>
                    </div>
                    <div className="p-6">
                      <AnimatePresence mode="wait">
                        <motion.div key={activeTab} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.2 }}>
                          {activeTab === 'overview' && <OverviewView service={selectedService} onUpdateStatus={handleUpdateStatus} priorityConfig={priorityConfig} />}
                          {activeTab === 'tracking' && (
                            <TrackingView service={selectedService} formData={trackingFormData} onFormChange={handleTrackingFormChange} staffList={staffList} stepOptions={stepOptions} priorityOptions={priorityOptions} onSave={handleTrackingFormSubmit} onCancel={() => setActiveTab('overview')} />
                          )}
                          {activeTab === 'documents' && <EnhancedDocumentsView service={selectedService} entryServices={entryServices} categories={categories} formatPayments={formatPayments} priorityConfig={priorityConfig} />}
                          {activeTab === 'history' && <HistoryView service={selectedService} />}
                        </motion.div>
                      </AnimatePresence>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
                  <div className="w-20 h-20 bg-gray-200 rounded-xl flex items-center justify-center mx-auto mb-4">
                    <FiUser className="h-10 w-10 text-gray-400" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">No Service Selected</h3>
                  <p className="text-gray-600 max-w-sm mx-auto">Select a service from the list to view detailed information</p>
                </div>
              )}
            </div>
          </div>
        </div>
        
        <style>{`
          .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
          .scrollbar-hide::-webkit-scrollbar { display: none; }
        `}</style>
      </div>
    </ErrorBoundary>
  );
};

// StatItem, FinancialRow, DetailRow, FormField, FormSelect, FormTextarea, ActivityItem (unchanged)
const StatItem = ({ label, value }) => (
  <div className="text-center p-4 bg-gray-50 rounded-lg border border-gray-200">
    <p className="text-sm font-medium text-gray-600 mb-1">{label}</p>
    <p className="text-lg font-semibold text-gray-900">{value}</p>
  </div>
);

const FinancialRow = ({ label, amount, currency, isTotal = false }) => (
  <div className="flex justify-between items-center">
    <span className={`text-sm ${isTotal ? 'font-semibold text-gray-900' : 'text-gray-600'}`}>{label}</span>
    <span className={`font-mono ${isTotal ? 'text-lg font-bold text-gray-900' : 'text-gray-900'}`}>{currency}{amount?.toFixed(2) || '0.00'}</span>
  </div>
);

const DetailRow = ({ label, value, valueClass = "" }) => (
  <div className="flex justify-between items-center py-1">
    <span className="text-sm text-gray-600">{label}</span>
    <span className={`text-sm font-medium ${valueClass}`}>{value}</span>
  </div>
);

const FormField = ({ label, name, value, onChange, type = 'text', placeholder, maxLength }) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>
    <input type={type} name={name} value={value} onChange={onChange} placeholder={placeholder} maxLength={maxLength} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
  </div>
);

const FormSelect = ({ label, name, value, onChange, options, placeholder }) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>
    <select name={name} value={value} onChange={onChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500">
      <option value="">{placeholder}</option>
      {options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
  </div>
);

const FormTextarea = ({ label, name, value, onChange, placeholder, rows = 4 }) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>
    <textarea name={name} value={value} onChange={onChange} placeholder={placeholder} rows={rows} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
  </div>
);

const ActivityItem = ({ action, description, time, user }) => (
  <div className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
    <div className="w-2 h-2 bg-indigo-500 rounded-full mt-2"></div>
    <div className="flex-1">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-gray-900">{action}</p>
        <p className="text-xs text-gray-500">{time}</p>
      </div>
      <p className="text-sm text-gray-600 mt-1">{description}</p>
      <p className="text-xs text-gray-500 mt-1">By {user}</p>
    </div>
  </div>
);

const TrackingView = ({ service, formData, onFormChange, staffList, stepOptions, priorityOptions, onSave, onCancel }) => (
  <div className="space-y-6">
    <h3 className="font-semibold text-gray-900">Update Tracking Information</h3>
    <form onSubmit={onSave} className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="space-y-4">
        <FormField label="Application Number" name="applicationNumber" value={formData.applicationNumber} onChange={onFormChange} placeholder="Enter application number (optional)" />
        <FormSelect label="Current Step" name="currentStep" value={formData.currentStep} onChange={onFormChange} options={stepOptions} placeholder="Select current step" />
        <FormField label="Estimated Delivery" name="estimatedDelivery" type="date" value={formData.estimatedDelivery} onChange={onFormChange} />
        <FormSelect label="Priority" name="priority" value={formData.priority} onChange={onFormChange} options={priorityOptions} placeholder="Select priority" />
      </div>
      <div className="space-y-4">
        <FormField label="Average Time" name="averageTime" value={formData.averageTime} onChange={onFormChange} placeholder="e.g., 7 days" />
        <FormSelect label="Assign To" name="assignedTo" value={formData.assignedTo} onChange={onFormChange} options={staffList.map(staff => ({ value: staff.id, label: staff.name }))} placeholder="Select staff member" />
        <FormField label="Aadhaar Number" name="aadhaar" value={formData.aadhaar} onChange={onFormChange} placeholder="Enter 12-digit Aadhaar number" maxLength="12" />
        <FormField label="Email Address" name="email" type="email" value={formData.email} onChange={onFormChange} placeholder="Enter customer email address" />
        <FormTextarea label="Notes" name="notes" value={formData.notes} onChange={onFormChange} placeholder="Enter additional notes" rows={3} />
      </div>
      <div className="md:col-span-2 flex justify-end space-x-3 pt-4 border-t border-gray-200">
        <button type="button" className="px-6 py-2.5 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors" onClick={onCancel}>Cancel</button>
        <button type="submit" className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">Save Changes</button>
      </div>
    </form>
  </div>
);

const EnhancedDocumentsView = ({ service, entryServices, categories, formatPayments, priorityConfig }) => (
  <div className="space-y-6">
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="space-y-4">
        <h3 className="font-semibold text-gray-900">Service Information</h3>
        {/* details unchanged */}
        <div className="space-y-3">
          <DetailRow label="Token ID" value={service.trackingId || 'N/A'} />
          <DetailRow label="Customer Name" value={service.customerName || 'Unknown'} />
          <DetailRow label="Phone" value={service.phone || 'N/A'} />
          <DetailRow label="Email" value={service.email || 'N/A'} />
          <DetailRow label="Aadhaar" value={service.aadhaar || 'N/A'} />
          <DetailRow label="Service" value={service.serviceType || 'Unknown'} />
          <DetailRow label="Subcategory" value={service.subcategoryName || 'N/A'} />
          <DetailRow label="Expiry Date" value={service.expiryDate || 'Not set'} />
          <div className="flex justify-between items-center py-1">
            <span className="text-sm text-gray-600">Priority</span>
            <span className={`px-2 py-1 rounded-full text-xs font-medium flex items-center space-x-1 ${priorityConfig[service.priority]?.bg} ${priorityConfig[service.priority]?.border}`}>
              <FiFlag className={`h-3 w-3 ${priorityConfig[service.priority]?.color}`} />
              <span className={priorityConfig[service.priority]?.color}>{priorityConfig[service.priority]?.label}</span>
            </span>
          </div>
        </div>
      </div>
      <div className="space-y-4">
        <h3 className="font-semibold text-gray-900">Financial Information</h3>
        <div className="space-y-3">
          <FinancialRow label="Service Charge" amount={service.serviceCharge} currency="₹" />
          <FinancialRow label="Department Charge" amount={service.departmentCharge} currency="₹" />
          <FinancialRow label="Total Charge" amount={service.totalCharge} currency="₹" />
          <div className="flex justify-between items-center py-2">
            <span className="text-sm text-gray-600">Payments:</span>
            <span className="text-sm text-gray-900">{service.paymentDetails || 'No payments recorded'}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
);

const HistoryView = ({ service }) => (
  <div className="space-y-6">
    <h3 className="font-semibold text-gray-900">Activity History</h3>
    <div className="space-y-3">
      <ActivityItem action="Status updated" description={`Changed to ${service.status}`} time={formatDate(service.updatedAt) || 'Recently'} user="System" />
      <ActivityItem action="Service assigned" description={`Assigned to ${service.assignedTo || 'Unassigned'}`} time={formatDate(service.updatedAt) || 'Recently'} user="Administrator" />
      <ActivityItem action="Application submitted" description="New service application received" time={formatDate(service.createdAt) || 'Recently'} user="Customer" />
    </div>
  </div>
);

export default TrackServicePage;