import React, { useState, useEffect, useMemo } from 'react';
import { 
  FiUser, FiPhone, FiClock, FiCheckCircle, FiAlertCircle, 
  FiRefreshCw, FiSearch, FiEdit, FiMessageSquare, FiChevronDown, 
  FiFileText, FiBarChart2, FiDollarSign, FiCalendar,
  FiTrendingUp, FiMail, FiDownload, FiFilter, FiMoreHorizontal,
  FiShare2, FiPrinter, FiSettings, FiAward, FiTarget, FiPieChart,
  FiPlus, FiGrid, FiList, FiCreditCard, FiFlag, FiArrowLeft
} from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { 
  getTrackingEntries, 
  getTrackingEntryById,
  updateTrackingEntry, 
  updateTrackingStatus, 
  notifyCustomer, 
  getStaff, 
  getCategories, 
  getServiceEntries,
  getTrackingStats
} from '/src/services/serviceService';
import { useParams, useNavigate } from 'react-router-dom';

// ==========================================
// STATIC CONFIGURATIONS & HELPERS (Moved Outside Component)
// ==========================================
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
  'Pending': { color: 'text-amber-800', bg: 'bg-amber-100', border: 'border-amber-300', dot: 'bg-amber-600', button: 'bg-amber-600 hover:bg-amber-700 text-white' },
  'In Progress': { color: 'text-blue-800', bg: 'bg-blue-100', border: 'border-blue-300', dot: 'bg-blue-600', button: 'bg-blue-600 hover:bg-blue-700 text-white' },
  'Delayed': { color: 'text-rose-800', bg: 'bg-rose-100', border: 'border-rose-300', dot: 'bg-rose-600', button: 'bg-rose-600 hover:bg-rose-700 text-white' },
  'Completed': { color: 'text-emerald-800', bg: 'bg-emerald-100', border: 'border-emerald-300', dot: 'bg-emerald-600', button: 'bg-emerald-600 hover:bg-emerald-700 text-white' },
  'Resubmit': { color: 'text-orange-800', bg: 'bg-orange-100', border: 'border-orange-300', dot: 'bg-orange-600', button: 'bg-orange-600 hover:bg-orange-700 text-white' },
  'Paid': { color: 'text-green-700', bg: 'bg-green-100', border: 'border-green-300', dot: 'bg-green-600', button: 'bg-green-600 hover:bg-green-700 text-white' }
};

const priorityConfig = {
  'low': { color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', label: 'Low' },
  'medium': { color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200', label: 'Medium' },
  'high': { color: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-200', label: 'High' }
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

const formatDate = (dateString) => {
  if (!dateString) return 'Not set';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Invalid date';
    return date.toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch (error) {
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
    return 'Invalid date';
  }
};

const calculateProgress = (status, currentStep) => {
  const stepProgress = { 'Submitted': 25, 'Initial Review': 50, 'Document Verification': 75, 'Final Approval': 100 };
  if (status === 'Completed' || status === 'Paid') return 100;
  return stepProgress[currentStep] || 25;
};

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
    return '';
  }
};

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  componentDidCatch(error, errorInfo) { console.error('Error caught by boundary:', error, errorInfo); }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
          <div className="bg-white rounded-xl border border-gray-200 p-8 max-w-md text-center">
            <div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <FiAlertCircle className="h-8 w-8 text-rose-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Something went wrong</h2>
            <p className="text-gray-600 mb-4">There was an error loading the service tracking. Please try refreshing the page.</p>
            <button onClick={() => window.location.reload()} className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">Refresh Page</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// ==========================================
// MAIN COMPONENT
// ==========================================
const TrackServicePage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [services, setServices] = useState([]);
  const [entryServices, setEntryServices] = useState([]);
  const [selectedService, setSelectedService] = useState(null);
  const [loading, setLoading] = useState(true);
  const [staffList, setStaffList] = useState([]);
  const [categories, setCategories] = useState([]);

  const getSavedFilters = () => {
    try {
      const saved = localStorage.getItem('staffServiceSavedView');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('Could not load saved filters', e);
    }
    return { status: 'all', staff: 'all', expiry: 'all', date: '', service: 'all', subcategory: 'all' };
  };

  const initialFilters = getSavedFilters();

  const [searchTerm, setSearchTerm] = useState('');
  const [aadhaarSearch, setAadhaarSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(initialFilters.status);
  const [staffFilter, setStaffFilter] = useState(initialFilters.staff);
  const [expiryFilter, setExpiryFilter] = useState(initialFilters.expiry);
  const [dateFilter, setDateFilter] = useState(initialFilters.date || ''); 
  const [serviceFilter, setServiceFilter] = useState(initialFilters.service || 'all'); 
  const [subcategoryFilter, setSubcategoryFilter] = useState(initialFilters.subcategory || 'all'); 
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // Auto-reset subcategory when service changes
  useEffect(() => {
    setSubcategoryFilter('all');
  }, [serviceFilter]);

  // Compute available subcategories based on selected Service
  const availableSubcategories = useMemo(() => {
    if (serviceFilter === 'all') return [];
    
    // Check categories list first
    const selectedCat = categories.find(c => c.id.toString() === serviceFilter.toString());
    if (selectedCat && selectedCat.subcategories) return selectedCat.subcategories;
    
    // Fallback if needed
    const subs = new Map();
    services.forEach(s => {
      if (s.categoryId?.toString() === serviceFilter.toString() && s.subcategoryId) {
        subs.set(s.subcategoryId, s.subcategoryName);
      }
    });
    return Array.from(subs, ([id, name]) => ({ id, name }));
  }, [serviceFilter, categories, services]);

  const handleSaveView = () => {
    const filtersToSave = { status: statusFilter, staff: staffFilter, expiry: expiryFilter, date: dateFilter, service: serviceFilter, subcategory: subcategoryFilter };
    localStorage.setItem('staffServiceSavedView', JSON.stringify(filtersToSave));
    toast.success('Your custom view has been saved!');
  };

  const handleClearFilters = () => {
    setStatusFilter('all');
    setStaffFilter('all');
    setExpiryFilter('all');
    setSearchTerm('');
    setAadhaarSearch('');
    setDateFilter('');
    setServiceFilter('all');
    setSubcategoryFilter('all');
  };

  const [activeTab, setActiveTab] = useState('overview');
  const [trackingFormData, setTrackingFormData] = useState({
    applicationNumber: '', currentStep: '', estimatedDelivery: '', averageTime: '',
    notes: '', assignedTo: '', aadhaar: '', email: '', priority: 'medium'
  });
  const [timeRange, setTimeRange] = useState('week');
  const [viewMode, setViewMode] = useState('grid');
  const [isSidebarVisible, setIsSidebarVisible] = useState(true);

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const limit = 50;

  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [debouncedAadhaar, setDebouncedAadhaar] = useState('');
  const [globalStats, setGlobalStats] = useState({ total: 0, completed: 0, in_progress: 0, delayed: 0, pending: 0, sla_compliance: 100 });

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedAadhaar(aadhaarSearch), 500);
    return () => clearTimeout(timer);
  }, [aadhaarSearch]);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, debouncedAadhaar, statusFilter, staffFilter, expiryFilter, timeRange, dateFilter, serviceFilter, subcategoryFilter]);

  const fetchStats = async () => {
    try {
      const apiStatus = reverseStatusMap[statusFilter] || statusFilter;
      const data = await getTrackingStats({ 
        timeRange, 
        date: dateFilter || undefined,
        service: serviceFilter === 'all' ? undefined : serviceFilter,
        subcategory: subcategoryFilter === 'all' ? undefined : subcategoryFilter,
        status: statusFilter === 'all' ? undefined : apiStatus,
        staff: staffFilter === 'all' ? undefined : staffFilter,
      });
      setGlobalStats(data || { total: 0, completed: 0, in_progress: 0, delayed: 0, pending: 0, sla_compliance: 100 });
    } catch (error) {
      console.error('Error fetching global stats:', error);
    }
  };

  const fetchPaymentDetails = async (serviceEntryId, serviceEntries) => {
    try {
      const serviceEntry = serviceEntries.find(entry => Number(entry.id) === Number(serviceEntryId));
      if (!serviceEntry) return { payments: [], totalCharge: 0, paymentStatus: 'Not Applicable', paymentDetails: 'No payments recorded' };

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
      return { payments: [], totalCharge: 0, paymentStatus: 'Pending', paymentDetails: 'Error fetching payments' };
    }
  };

  const transformBackendData = async (trackingData, serviceEntries) => {
    const transformed = [];
    for (const trackingEntry of trackingData) {
      const paymentData = await fetchPaymentDetails(trackingEntry.service_entry_id, serviceEntries);
      const updatedDate = new Date(trackingEntry.updated_at);
      const dateStr = updatedDate.toISOString().split('T')[0];
      const timeStr = updatedDate.toTimeString().split(' ')[0].substring(0, 5);
      const finalProgress = calculateProgress(statusMap[trackingEntry.status] || 'Pending', trackingEntry.current_step || 'Submitted');
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
        progress: finalProgress,
        priority: trackingEntry.priority || 'medium',
        date: dateStr,
        time: timeStr,
        estimatedDelivery: formatDate(trackingEntry.estimated_delivery),
        expiryDate: formatDate(trackingEntry.expiry_date),
        createdAt: trackingEntry.updated_at,
        updatedAt: trackingEntry.updated_at,
        notes: trackingEntry.notes || 'No notes available',
        followUpRequired: trackingEntry.status === 'rejected' || trackingEntry.status === 'resubmit',
        paymentStatus: paymentData.paymentStatus,
        paymentDetails: paymentData.paymentDetails,
        payments: paymentData.payments,
        phone: trackingEntry.phone || 'N/A',
        email: trackingEntry.email || '',
        aadhaar: trackingEntry.aadhaar || '',
        steps: Array.isArray(trackingEntry.steps) ? trackingEntry.steps : [],
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

  const fetchSingleTrackingEntry = async (entryId) => {
    try {
      const [response, staffResponse] = await Promise.all([ getTrackingEntryById(entryId), getStaff() ]);
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
      toast.error('Failed to load the specific application');
      await fetchAllTrackingEntries();
    }
  };

  const fetchAllTrackingEntries = async () => {
    try {
      const apiStatus = reverseStatusMap[statusFilter] || statusFilter;
      const params = {
        page: currentPage,
        limit: limit,
        timeRange: timeRange,
        date: dateFilter || undefined,
        service: serviceFilter === 'all' ? undefined : serviceFilter,
        subcategory: subcategoryFilter === 'all' ? undefined : subcategoryFilter,
        status: statusFilter === 'all' ? undefined : apiStatus,
        staff: staffFilter === 'all' ? undefined : staffFilter,
        expiry: expiryFilter === 'all' ? undefined : expiryFilter,
        search: debouncedSearch || undefined,
        aadhaar: debouncedAadhaar || undefined
      };

      const [trackingResponse, entryResponse, staffResponse, categoriesResponse] = await Promise.all([
        getTrackingEntries(params), getServiceEntries(), getStaff(), getCategories()
      ]);

      if (trackingResponse && trackingResponse.pagination) {
        setTotalRecords(trackingResponse.pagination.totalRecords);
        setTotalPages(trackingResponse.pagination.totalPages);
      }

      const trackingData = Array.isArray(trackingResponse?.data) ? trackingResponse.data : Array.isArray(trackingResponse) ? trackingResponse : [];
      const staffData = Array.isArray(staffResponse?.data) ? staffResponse.data : Array.isArray(staffResponse) ? staffResponse : [];
      const entryData = Array.isArray(entryResponse?.data) ? entryResponse.data : Array.isArray(entryResponse) ? entryResponse : [];
      const categoriesData = Array.isArray(categoriesResponse?.data) ? categoriesResponse.data : Array.isArray(categoriesResponse) ? categoriesResponse : [];

      setStaffList(staffData);
      setCategories(categoriesData);
      setEntryServices(entryData);

      const transformedServices = await transformBackendData(trackingData, entryData);
      setServices(transformedServices);
      setIsSidebarVisible(true);
    } catch (error) {
      toast.error('Failed to fetch data');
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
        await fetchStats(); 
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [id, currentPage, debouncedSearch, debouncedAadhaar, statusFilter, staffFilter, expiryFilter, timeRange, dateFilter, serviceFilter, subcategoryFilter]);

  const handleUpdateStatus = async (serviceId, newStatus) => {
    try {
      const apiStatus = reverseStatusMap[newStatus] || newStatus;
      const service = services.find(s => s.id === serviceId);
      const newProgress = calculateProgress(newStatus, service.currentStep);
      
      await updateTrackingStatus(serviceId, apiStatus);
      toast.success(`Status updated to ${newStatus}`);
      
      const updatedServices = services.map(service =>
        service.id === serviceId ? { ...service, status: newStatus, progress: newProgress } : service
      );
      setServices(updatedServices);
      
      if (selectedService?.id === serviceId) {
        setSelectedService({ ...selectedService, status: newStatus, progress: newProgress });
      }
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  const handleInlineTrackingUpdate = async (service, updates) => {
    try {
      const payload = {
        applicationNumber: updates.applicationNumber !== undefined ? updates.applicationNumber : service.applicationNumber,
        currentStep: updates.currentStep !== undefined ? updates.currentStep : service.currentStep,
        estimatedDelivery: updates.estimatedDelivery !== undefined ? updates.estimatedDelivery : service.rawEstimatedDelivery,
        averageTime: service.averageTime || '7 days',
        notes: service.notes || null,
        assignedTo: updates.assignedTo !== undefined ? (updates.assignedTo ? parseInt(updates.assignedTo) : null) : service.assignedToId,
        aadhaar: service.aadhaar || null,
        email: service.email || null,
        priority: updates.priority !== undefined ? updates.priority : service.priority,
        progress: updates.currentStep ? calculateProgress(service.status, updates.currentStep) : service.progress
      };

      await updateTrackingEntry(service.id, payload);
      toast.success('Details updated successfully');

      const updatedServices = services.map(s => {
        if (s.id === service.id) {
          return {
            ...s, ...updates,
            assignedTo: updates.assignedTo !== undefined ? (staffList.find(staff => staff.id === parseInt(updates.assignedTo))?.name || 'Unassigned') : s.assignedTo,
            assignedToId: updates.assignedTo !== undefined ? parseInt(updates.assignedTo) : s.assignedToId,
            rawEstimatedDelivery: updates.estimatedDelivery !== undefined ? updates.estimatedDelivery : s.rawEstimatedDelivery,
            estimatedDelivery: updates.estimatedDelivery !== undefined ? formatDate(updates.estimatedDelivery) : s.estimatedDelivery,
            progress: payload.progress
          };
        }
        return s;
      });
      setServices(updatedServices);
      
      if (selectedService?.id === service.id) {
        setSelectedService(updatedServices.find(s => s.id === service.id));
        setTrackingFormData(prev => ({ ...prev, ...updates }));
      }
    } catch (error) {
      toast.error('Failed to update tracking details');
    }
  };

  const handleNotifyCustomer = async (service) => {
    try {
      await notifyCustomer(service.id, `Dear ${service.customerName}, your ${service.serviceType} application (App No: ${service.applicationNumber || 'N/A'}) is now ${service.status}.`);
      toast.success(`Notification sent to ${service.customerName} via WhatsApp`);
    } catch (error) {
      toast.error('Failed to send notification');
    }
  };

  const handleTrackingFormChange = (e) => {
    const { name, value } = e.target;
    setTrackingFormData({ ...trackingFormData, [name]: value });
  };

  const handleTrackingFormSubmit = async (e) => {
    e.preventDefault();
    try {
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
      
      const updatedServices = services.map(service =>
        service.id === selectedService.id ? {
          ...service,
          applicationNumber: trackingFormData.applicationNumber || `APP${service.serviceEntryId}`,
          currentStep: trackingFormData.currentStep || 'Submitted',
          estimatedDelivery: formatDate(trackingFormData.estimatedDelivery),
          averageTime: trackingFormData.averageTime || '7 days',
          notes: trackingFormData.notes || '',
          assignedTo: staffList.find(staff => staff.id === parseInt(trackingFormData.assignedTo))?.name || trackingFormData.assignedTo || 'Unassigned',
          assignedToId: trackingFormData.assignedTo,
          aadhaar: trackingFormData.aadhaar || '',
          email: trackingFormData.email || '',
          priority: trackingFormData.priority || 'medium',
          progress: newProgress,
          rawEstimatedDelivery: trackingFormData.estimatedDelivery
        } : service
      );
      
      setServices(updatedServices);
      setSelectedService(updatedServices.find(s => s.id === selectedService.id));
      setActiveTab('overview');
    } catch (error) {
      toast.error('Failed to update tracking details');
    }
  };

  const handleServiceSelect = (service, preventNav = false) => {
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
    
    if (!id && !preventNav && viewMode === 'list') {
      navigate(`/dashboard/staff/track_service/${service.id}`, { replace: true });
    }
  };

  const handleBackToList = () => {
    navigate('/dashboard/staff/track_service');
  };

  const renderQuickActionsPanel = () => (
    <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm h-full flex flex-col justify-center">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900">Quick Actions</h3>
        <div className="flex space-x-1">
          <button 
            onClick={() => setViewMode('grid')}
            className={`p-2 rounded-lg ${viewMode === 'grid' ? 'bg-indigo-100 text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}
            title="Spreadsheet View"
          >
            <FiGrid className="h-4 w-4" />
          </button>
          <button 
            onClick={() => setViewMode('list')}
            className={`p-2 rounded-lg ${viewMode === 'list' ? 'bg-indigo-100 text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}
            title="Detail View"
          >
            <FiList className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <button className="p-3 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors flex flex-col items-center justify-center">
          <FiPlus className="h-5 w-5 mb-1" />
          <span className="text-xs font-medium">New Service</span>
        </button>
        <button className="p-3 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 transition-colors flex flex-col items-center justify-center">
          <FiDownload className="h-5 w-5 mb-1" />
          <span className="text-xs font-medium">Export</span>
        </button>
        <button className="p-3 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors flex flex-col items-center justify-center">
          <FiFilter className="h-5 w-5 mb-1" />
          <span className="text-xs font-medium">Filters</span>
        </button>
        <button className="p-3 bg-purple-50 text-purple-600 rounded-lg hover:bg-purple-100 transition-colors flex flex-col items-center justify-center">
          <FiPrinter className="h-5 w-5 mb-1" />
          <span className="text-xs font-medium">Print</span>
        </button>
      </div>
    </div>
  );

  const renderFiltersPanel = () => (
    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
          <FiFilter className="text-indigo-600" /> Filters
        </h3>
        <button 
          onClick={handleSaveView}
          className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2 py-1.5 rounded-md hover:bg-indigo-100 transition-colors"
        >
          Save My View
        </button>
      </div>
      <div className="space-y-4">
        <div className="relative">
          <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <input
            type="text"
            placeholder="Search name, phone, app no..."
            className="w-full pl-10 pr-4 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <button
          onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
          className="flex items-center justify-between w-full text-sm font-medium text-gray-600 hover:text-indigo-600 py-2 border-b border-gray-100 transition-colors"
        >
          <span>Advanced Filters</span>
          <FiChevronDown className={`transition-transform duration-300 ${showAdvancedFilters ? 'rotate-180' : ''}`} />
        </button>
        <AnimatePresence>
          {showAdvancedFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className={`overflow-hidden pt-2 ${viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 items-end' : 'space-y-4'}`}
            >
              <div className={viewMode === 'grid' ? '' : 'space-y-1.5'}>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Date</label>
                <div className="relative">
                  <FiCalendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <input type="date" className="w-full pl-10 pr-4 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} />
                </div>
              </div>
              
              <div className={viewMode === 'grid' ? '' : 'space-y-1.5'}>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Service Category</label>
                <select className="w-full px-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none cursor-pointer" value={serviceFilter} onChange={(e) => setServiceFilter(e.target.value)}>
                  <option value="all">All Services</option>
                  {categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}
                </select>
              </div>

              <div className={viewMode === 'grid' ? '' : 'space-y-1.5'}>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Subcategory</label>
                <select 
                  className={`w-full px-3 py-2.5 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none transition-all ${serviceFilter === 'all' ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed' : 'bg-gray-50 border-gray-200 cursor-pointer text-gray-900'}`} 
                  value={subcategoryFilter} 
                  onChange={(e) => setSubcategoryFilter(e.target.value)}
                  disabled={serviceFilter === 'all'}
                >
                  <option value="all">{serviceFilter === 'all' ? 'Select a Service first' : 'All Subcategories'}</option>
                  {availableSubcategories.map(sub => <option key={sub.id} value={sub.id}>{sub.name}</option>)}
                </select>
              </div>

              <div className={viewMode === 'grid' ? '' : 'space-y-1.5'}>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Status</label>
                <select className="w-full px-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none cursor-pointer" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                  <option value="all">All Statuses</option>
                  <option value="Pending">Pending</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Delayed">Delayed</option>
                  <option value="Completed">Completed</option>
                  <option value="Resubmit">Resubmit</option>
                  <option value="Paid">Paid</option>
                </select>
              </div>
              
              <div className={viewMode === 'grid' ? '' : 'space-y-1.5'}>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Assigned Staff</label>
                <select className="w-full px-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none cursor-pointer" value={staffFilter} onChange={(e) => setStaffFilter(e.target.value)}>
                  <option value="all">Everyone</option>
                  {staffList.map(staff => <option key={staff.id} value={staff.id}>{staff.name}</option>)}
                </select>
              </div>
              
              <div className={viewMode === 'grid' ? '' : 'space-y-1.5'}>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Timeline</label>
                <select className="w-full px-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none cursor-pointer" value={expiryFilter} onChange={(e) => setExpiryFilter(e.target.value)}>
                  <option value="all">Any Date</option>
                  <option value="upcoming">Upcoming Expiry</option>
                  <option value="overdue">Overdue</option>
                </select>
              </div>
              
              <div className={viewMode === 'grid' ? '' : 'space-y-1.5'}>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Aadhaar Search</label>
                <div className="relative">
                  <FiCreditCard className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <input type="text" placeholder="Search ID..." className="w-full pl-10 pr-4 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500" value={aadhaarSearch} onChange={(e) => setAadhaarSearch(e.target.value)} maxLength="12"/>
                </div>
              </div>
              
              <div className={viewMode === 'grid' ? 'col-span-1 md:col-span-3 lg:col-span-4' : ''}>
                <button onClick={handleClearFilters} className="w-full py-2.5 text-xs font-semibold text-gray-600 border border-gray-200 hover:bg-gray-50 hover:text-gray-900 rounded-xl transition-all">
                  Clear All Filters
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );

  const renderCardList = () => (
    <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900">
          Services <span className="text-gray-500 font-normal">({totalRecords})</span>
        </h3>
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
          <span className="text-xs text-gray-500">Active</span>
        </div>
      </div>
      <div className="space-y-3 max-h-[500px] overflow-y-auto scrollbar-hide">
        {services.map(service => (
          <ServiceCard
            key={service.id}
            service={service}
            isSelected={selectedService?.id === service.id}
            onClick={() => handleServiceSelect(service)}
          />
        ))}
        {services.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <FiSearch className="mx-auto h-8 w-8 mb-2 opacity-50" />
            <p className="text-sm">No services found</p>
          </div>
        )}
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-4 mt-4 border-t border-gray-100">
          <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-2 py-1 text-xs font-medium text-gray-600 bg-gray-50 rounded border border-gray-200 hover:bg-gray-100 disabled:opacity-50">Previous</button>
          <div className="text-xs text-gray-500 font-medium">Page {currentPage} of {totalPages}</div>
          <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="px-2 py-1 text-xs font-medium text-gray-600 bg-gray-50 rounded border border-gray-200 hover:bg-gray-100 disabled:opacity-50">Next</button>
        </div>
      )}
    </div>
  );

  const renderDetailPane = () => {
    if (!selectedService) {
      return (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center shadow-sm">
          <div className="w-20 h-20 bg-gray-100 rounded-xl flex items-center justify-center mx-auto mb-4">
            <FiUser className="h-10 w-10 text-gray-400" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No Service Selected</h3>
          <p className="text-gray-500 max-w-sm mx-auto">
            Select a service from the list to view detailed information
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-6">
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                <FiUser className="h-8 w-8 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">{selectedService.customerName || 'Unknown'}</h2>
                <div className="flex items-center space-x-4 mt-2">
                  <div className="flex items-center space-x-1 text-gray-600">
                    <FiPhone className="h-4 w-4" />
                    <span className="text-sm">{selectedService.phone || 'N/A'}</span>
                  </div>
                  <div className="flex items-center space-x-1 text-gray-600">
                    <FiMail className="h-4 w-4" />
                    <span className="text-sm">{selectedService.email || 'N/A'}</span>
                  </div>
                  <div className="flex items-center space-x-1 text-gray-600">
                    <FiCreditCard className="h-4 w-4" />
                    <span className="text-sm">{selectedService.aadhaar || 'N/A'}</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex space-x-2 mt-4 lg:mt-0">
              <button
                className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 flex items-center space-x-2 transition-all duration-200 shadow-sm"
                onClick={() => handleNotifyCustomer(selectedService)}
              >
                <FiMessageSquare className="h-4 w-4" />
                <span>Notify</span>
              </button>
              <button
                onClick={() => navigate(`/dashboard/staff/service-workspace/${selectedService.id}`)}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center space-x-2 transition-all duration-200 shadow-sm"
              >
                <FiGrid className="h-4 w-4" />
                <span>Workspace</span>
              </button>
              <button 
                onClick={() => setActiveTab('tracking')}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center space-x-2 transition-all duration-200 shadow-sm"
              >
                <FiEdit className="h-4 w-4" />
                <span>Edit</span>
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
        
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="border-b border-gray-200 bg-gray-50/50">
            <nav className="flex -mb-px">
              {['overview', 'tracking', 'documents', 'history'].map((tab) => (
                <button
                  key={tab}
                  className={`flex-1 py-4 px-6 text-center font-medium text-sm border-b-2 transition-colors ${
                    activeTab === tab
                      ? 'border-indigo-500 text-indigo-600 bg-white'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                  onClick={() => setActiveTab(tab)}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </nav>
          </div>
          <div className="p-6">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                {activeTab === 'overview' && (
                  <OverviewView 
                    service={selectedService} 
                    onUpdateStatus={handleUpdateStatus}
                    priorityConfig={priorityConfig}
                  />
                )}
                {activeTab === 'tracking' && (
                  <TrackingView 
                    service={selectedService}
                    formData={trackingFormData}
                    onFormChange={handleTrackingFormChange}
                    staffList={staffList}
                    stepOptions={stepOptions}
                    priorityOptions={priorityOptions}
                    onSave={handleTrackingFormSubmit}
                    onCancel={() => setActiveTab('overview')}
                  />
                )}
                {activeTab === 'documents' && (
                  <EnhancedDocumentsView 
                    service={selectedService}
                    entryServices={entryServices}
                    categories={categories}
                    formatPayments={formatPayments}
                    priorityConfig={priorityConfig}
                  />
                )}
                {activeTab === 'history' && (
                  <HistoryView service={selectedService} />
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
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

  // Group services by date for Spreadsheet View
  const servicesByDate = services.reduce((groups, service) => {
    const dateKey = service.date || 'Unknown Date';
    if (!groups[dateKey]) groups[dateKey] = [];
    groups[dateKey].push(service);
    return groups;
  }, {});

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white border-b border-gray-200">
          <div className="max-w-[1600px] mx-auto px-6 py-4">
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
                  <button
                    onClick={handleBackToList}
                    className="flex items-center space-x-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-all duration-200"
                  >
                    <FiArrowLeft className="h-4 w-4" />
                    <span>Back to List</span>
                  </button>
                )}
                <select 
                  className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={timeRange}
                  onChange={(e) => setTimeRange(e.target.value)}
                >
                  <option value="week">Last 7 days</option>
                  <option value="month">Last 30 days</option>
                  <option value="quarter">Last quarter</option>
                </select>
                <button
                  className="flex items-center space-x-2 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-all duration-200 shadow-sm"
                  onClick={() => window.location.reload()}
                >
                  <FiRefreshCw className="h-4 w-4" />
                  <span>Refresh</span>
                </button>
              </div>
            </div>
          </div>
        </header>
        
        <div className="max-w-[1600px] mx-auto px-6 py-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <KPIStat title="Total Services" value={globalStats.total || 0} subtitle="In selected period" trend={12} icon={FiBarChart2} color="bg-gradient-to-br from-blue-500 to-blue-600" />
            <KPIStat title="In Progress" value={globalStats.in_progress || 0} subtitle="Active now" trend={8} icon={FiTrendingUp} color="bg-gradient-to-br from-amber-500 to-amber-600" />
            <KPIStat title="Completed" value={globalStats.completed || 0} subtitle="Successfully done" trend={15} icon={FiCheckCircle} color="bg-gradient-to-br from-emerald-500 to-emerald-600" />
            <KPIStat title="SLA Compliance" value={`${Math.round(globalStats.sla_compliance || 100)}%`} subtitle="On time delivery" trend={2} icon={FiAward} color="bg-gradient-to-br from-purple-500 to-purple-600" />
          </div>

          {viewMode === 'grid' ? (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1">
                  {renderQuickActionsPanel()}
                </div>
                <div className="lg:col-span-2">
                  {renderFiltersPanel()}
                </div>
              </div>
              
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col min-h-[500px]">
                <div className="overflow-x-auto flex-1">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200 text-xs text-gray-500 uppercase tracking-wider">
                        <th className="px-4 py-3 font-medium">Customer</th>
                        <th className="px-4 py-3 font-medium">Service</th>
                        <th className="px-4 py-3 font-medium w-48">App Number</th>
                        <th className="px-4 py-3 font-medium w-40">Status & Step</th>
                        <th className="px-4 py-3 font-medium w-48">Staff & Delivery</th>
                        <th className="px-4 py-3 font-medium text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white">
                      {Object.entries(servicesByDate).length > 0 ? (
                        Object.entries(servicesByDate).map(([date, dateServices]) => (
                          <React.Fragment key={date}>
                            {/* Date Header Row */}
                            <tr className="bg-gray-50 border-y border-gray-200">
                              <td colSpan="6" className="px-4 py-2.5 text-xs font-bold text-gray-700 uppercase tracking-wider">
                                <div className="flex items-center gap-2">
                                  <FiCalendar className="h-4 w-4 text-indigo-500" />
                                  {date === 'Unknown Date' ? date : formatDate(date)}
                                  <span className="bg-gray-200 text-gray-600 py-0.5 px-2 rounded-full text-[10px] ml-2">
                                    {dateServices.length} items
                                  </span>
                                </div>
                              </td>
                            </tr>
                            
                            {/* Services belonging to this date */}
                            {dateServices.map(service => (
                              <React.Fragment key={service.id}>
                                <tr className={`hover:bg-gray-50 transition-colors group ${selectedService?.id === service.id ? 'bg-indigo-50/20' : ''}`}>
                                  {/* 1. Two-Line Customer Info */}
                                  <td className="px-4 py-3">
                                    <div className="text-sm font-semibold text-gray-900 whitespace-nowrap">{service.customerName}</div>
                                    <div className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                                      <FiPhone className="h-3 w-3" /> {service.phone || 'N/A'}
                                    </div>
                                  </td>

                                  {/* 2. Two-Line Service Info */}
                                  <td className="px-4 py-3">
                                    <div className="text-sm text-gray-900 font-medium truncate max-w-[200px]" title={service.serviceType}>
                                      {service.serviceType}
                                    </div>
                                    <div className="text-xs text-gray-500 truncate max-w-[200px] mt-0.5" title={service.subcategoryName}>
                                      {service.subcategoryName || '-'}
                                    </div>
                                  </td>

                                  {/* 3. Inline App Number Edit */}
                                  <td className="px-4 py-3">
                                    <input 
                                      type="text"
                                      defaultValue={service.applicationNumber || ''}
                                      onBlur={(e) => {
                                          if(e.target.value !== service.applicationNumber) {
                                              handleInlineTrackingUpdate(service, { applicationNumber: e.target.value });
                                          }
                                      }}
                                      className="w-full text-xs font-medium border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 px-2 py-1.5 border bg-white shadow-sm transition-all hover:border-gray-400"
                                      placeholder="App No..."
                                    />
                                  </td>

                                  {/* 4. Two-Line Status & Step Edits */}
                                  <td className="px-4 py-3 space-y-1.5">
                                    <select 
                                      value={service.status}
                                      onChange={(e) => handleUpdateStatus(service.id, e.target.value)}
                                      className={`w-full text-[11px] font-bold rounded-md px-2 py-1 border outline-none shadow-sm cursor-pointer transition-all ${
                                          statusConfig[service.status]?.bg || 'bg-gray-100'
                                      } ${statusConfig[service.status]?.color || 'text-gray-800'} ${statusConfig[service.status]?.border || 'border-gray-200'}`}
                                    >
                                      {Object.keys(statusConfig).map(statusKey => (
                                          <option key={statusKey} value={statusKey}>{statusKey}</option>
                                      ))}
                                    </select>
                                    
                                    <select
                                      value={service.currentStep || 'Submitted'}
                                      onChange={(e) => handleInlineTrackingUpdate(service, { currentStep: e.target.value })}
                                      className="w-full text-[11px] font-medium text-gray-600 bg-white border border-gray-300 rounded-md px-2 py-1 shadow-sm outline-none focus:border-indigo-500 cursor-pointer"
                                    >
                                      {stepOptions.map(step => (
                                          <option key={step.value} value={step.value}>{step.label}</option>
                                      ))}
                                    </select>
                                  </td>

                                  {/* 5. Two-Line Staff & Est Delivery Edits */}
                                  <td className="px-4 py-3 space-y-1.5">
                                    <select
                                      value={service.assignedToId || ''}
                                      onChange={(e) => handleInlineTrackingUpdate(service, { assignedTo: e.target.value })}
                                      className="w-full text-[11px] font-medium text-gray-700 bg-white border border-gray-300 rounded-md px-2 py-1 shadow-sm outline-none focus:border-indigo-500 cursor-pointer"
                                    >
                                      <option value="">Unassigned Staff</option>
                                      {staffList.map(staff => (
                                          <option key={staff.id} value={staff.id}>{staff.name}</option>
                                      ))}
                                    </select>
                                    
                                    <input 
                                      type="date"
                                      value={formatDateForInput(service.rawEstimatedDelivery)}
                                      onChange={(e) => handleInlineTrackingUpdate(service, { estimatedDelivery: e.target.value })}
                                      className="w-full text-[11px] font-medium text-gray-600 bg-white border border-gray-300 rounded-md px-2 py-1 shadow-sm outline-none focus:border-indigo-500 cursor-pointer"
                                    />
                                  </td>

                                  {/* 6. Expand Button (Page-jump blocked!) */}
                                  <td className="px-4 py-3 align-top">
                                    <div className="flex items-center justify-end gap-2 mt-1">
                                      {/* Notify Button */}
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleNotifyCustomer(service);
                                        }}
                                        title="Send WhatsApp Notification"
                                        className="p-1.5 rounded-lg transition-colors border shadow-sm bg-white text-gray-500 border-gray-200 hover:text-green-600 hover:bg-green-50 hover:border-green-200"
                                      >
                                        <FiMessageSquare className="h-4 w-4" />
                                      </button>
                                      
                                      {/* Expand Button */}
                                      <button 
                                        onClick={() => {
                                            if (selectedService?.id === service.id) {
                                                setSelectedService(null); // Collapse instantly
                                            } else {
                                                handleServiceSelect(service, true); // Expand AND prevent navigation jump
                                            }
                                        }} 
                                        title={selectedService?.id === service.id ? "Collapse Details" : "Expand Details"}
                                        className={`p-1.5 rounded-lg transition-colors border shadow-sm ${
                                          selectedService?.id === service.id 
                                            ? 'bg-indigo-100 text-indigo-700 border-indigo-200' 
                                            : 'bg-white text-gray-500 border-gray-200 hover:text-indigo-600 hover:bg-indigo-50 hover:border-indigo-200'
                                        }`}
                                      >
                                        <FiChevronDown className={`h-4 w-4 transform transition-transform duration-300 ${selectedService?.id === service.id ? 'rotate-180' : ''}`} />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                                
                                {/* Expandable Inner Row */}
                                {selectedService?.id === service.id && (
                                  <tr>
                                    <td colSpan="6" className="p-0 border-b-2 border-indigo-200 bg-gray-50/60 shadow-inner">
                                      <div className="p-6 max-h-[600px] overflow-y-auto">
                                          {renderDetailPane()}
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
                            ))}
                          </React.Fragment>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="6" className="text-center py-16 text-gray-500">
                            <FiSearch className="mx-auto h-10 w-10 mb-3 opacity-30" />
                            <p className="text-base font-medium text-gray-900">No services found</p>
                            <p className="text-sm mt-1">Try adjusting your filters or search terms.</p>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Controls For Spreadsheet Mode */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50">
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-white rounded-lg border border-gray-300 hover:bg-gray-50 hover:text-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                    >
                      Previous Page
                    </button>
                    <div className="text-sm text-gray-600 font-medium bg-white px-4 py-1.5 rounded-lg border border-gray-200 shadow-sm">
                      Page {currentPage} of {totalPages}
                    </div>
                    <button
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-white rounded-lg border border-gray-300 hover:bg-gray-50 hover:text-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                    >
                      Next Page
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
              {/* Left sidebar for List Mode */}
              {isSidebarVisible && (
                <div className="xl:col-span-1 flex flex-col space-y-6">
                  {renderQuickActionsPanel()}
                  {renderFiltersPanel()}
                  {renderCardList()}
                </div>
              )}
              
              {/* Detail Pane */}
              <div className={isSidebarVisible ? "xl:col-span-3" : "xl:col-span-4"}>
                {renderDetailPane()}
              </div>
            </div>
          )}

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

const StatItem = ({ label, value }) => (
  <div className="text-center p-4 bg-gray-50 rounded-lg border border-gray-200">
    <p className="text-sm font-medium text-gray-600 mb-1">{label}</p>
    <p className="text-lg font-semibold text-gray-900">{value}</p>
  </div>
);

const FinancialRow = ({ label, amount, currency, isTotal = false }) => (
  <div className="flex justify-between items-center">
    <span className={`text-sm ${isTotal ? 'font-semibold text-gray-900' : 'text-gray-600'}`}>
      {label}
    </span>
    <span className={`font-mono ${isTotal ? 'text-lg font-bold text-gray-900' : 'text-gray-900'}`}>
      {currency}{amount?.toFixed(2) || '0.00'}
    </span>
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
    <input
      type={type}
      name={name}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      maxLength={maxLength}
      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
    />
  </div>
);

const FormSelect = ({ label, name, value, onChange, options, placeholder }) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>
    <select
      name={name}
      value={value}
      onChange={onChange}
      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
    >
      <option value="">{placeholder}</option>
      {options.map(option => (
        <option key={option.value} value={option.value}>{option.label}</option>
      ))}
    </select>
  </div>
);

const FormTextarea = ({ label, name, value, onChange, placeholder, rows = 4 }) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>
    <textarea
      name={name}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      rows={rows}
      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
    />
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
        <FormField 
          label="Application Number"
          name="applicationNumber"
          value={formData.applicationNumber}
          onChange={onFormChange}
          placeholder="Enter application number (optional)"
        />
        <FormSelect
          label="Current Step"
          name="currentStep"
          value={formData.currentStep}
          onChange={onFormChange}
          options={stepOptions}
          placeholder="Select current step"
        />
        <FormField 
          label="Estimated Delivery"
          name="estimatedDelivery"
          type="date"
          value={formData.estimatedDelivery}
          onChange={onFormChange}
        />
        <FormSelect
          label="Priority"
          name="priority"
          value={formData.priority}
          onChange={onFormChange}
          options={priorityOptions}
          placeholder="Select priority"
        />
      </div>
      <div className="space-y-4">
        <FormField 
          label="Average Time"
          name="averageTime"
          value={formData.averageTime}
          onChange={onFormChange}
          placeholder="e.g., 7 days"
        />
        <FormSelect
          label="Assign To"
          name="assignedTo"
          value={formData.assignedTo}
          onChange={onFormChange}
          options={staffList.map(staff => ({ value: staff.id, label: staff.name }))}
          placeholder="Select staff member"
        />
        <FormField 
          label="ID Number"
          name="aadhaar"
          value={formData.aadhaar}
          onChange={onFormChange}
          placeholder="Enter 12-digit ID number"
          maxLength="12"
        />
        <FormField 
          label="Email Address"
          name="email"
          type="email"
          value={formData.email}
          onChange={onFormChange}
          placeholder="Enter customer email address"
        />
        <FormTextarea
          label="Notes"
          name="notes"
          value={formData.notes}
          onChange={onFormChange}
          placeholder="Enter additional notes"
          rows={3}
        />
      </div>
      <div className="md:col-span-2 flex justify-end space-x-3 pt-4 border-t border-gray-200">
        <button
          type="button"
          className="px-6 py-2.5 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          onClick={onCancel}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
        >
          Save Changes
        </button>
      </div>
    </form>
  </div>
);

const EnhancedDocumentsView = ({ service, entryServices, categories, formatPayments, priorityConfig }) => {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <h3 className="font-semibold text-gray-900">Service Information</h3>
          <div className="space-y-3">
            <DetailRow label="Token ID" value={service.trackingId || 'N/A'} />
            <DetailRow label="Customer Name" value={service.customerName || 'Unknown'} />
            <DetailRow label="Phone" value={service.phone || 'N/A'} />
            <DetailRow label="Email" value={service.email || 'N/A'} />
            <DetailRow label="ID" value={service.aadhaar || 'N/A'} />
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
              <span className="text-sm text-gray-900">
                {service.paymentDetails || 'No payments recorded'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const HistoryView = ({ service }) => (
  <div className="space-y-6">
    <h3 className="font-semibold text-gray-900">Activity History</h3>
    <div className="space-y-3">
      <ActivityItem 
        action="Status updated"
        description={`Changed to ${service.status}`}
        time={formatDate(service.updatedAt) || 'Recently'}
        user="System"
      />
      <ActivityItem 
        action="Service assigned"
        description={`Assigned to ${service.assignedTo || 'Unassigned'}`}
        time={formatDate(service.updatedAt) || 'Recently'}
        user="Administrator"
      />
      <ActivityItem 
        action="Application submitted"
        description="New service application received"
        time={formatDate(service.createdAt) || 'Recently'}
        user="Customer"
      />
    </div>
  </div>
);

export default TrackServicePage;