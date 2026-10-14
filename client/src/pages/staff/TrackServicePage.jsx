import React, { useState, useEffect, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { 
  FiUser, FiPhone, FiClock, FiCheckCircle, FiAlertCircle, 
  FiRefreshCw, FiSearch, FiEdit, FiMessageSquare, FiChevronDown, 
  FiFileText, FiBarChart2, FiDollarSign, FiCalendar,
  FiTrendingUp, FiMail, FiDownload, FiFilter, FiMoreHorizontal,
  FiShare2, FiPrinter, FiSettings, FiAward, FiTarget, FiPieChart,
  FiPlus, FiGrid, FiColumns, FiCreditCard, FiFlag, FiArrowLeft, FiMessageCircle,
  FiUpload, FiTrash2, FiEye, FiEyeOff, FiPaperclip, FiX, FiSave, FiMove, FiHash,
  FiChevronLeft, FiChevronRight, FiExternalLink, FiSliders, FiList
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
  getTrackingStats, 
  getTrackingActivity,
  getTrackingDocuments,
  uploadTrackingDocument,
  toggleTrackingDocumentVisibility,
  updateTrackingDocumentRemark,   
  deleteTrackingDocument
} from '/src/services/serviceService';
import { useParams, useNavigate } from 'react-router-dom';
import NotesPanel from '/src/components/notes/NotesPanel';

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
              There was an error loading the service tracking. Please try refreshing the page.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-2 bg-[#172a45] text-white rounded-lg hover:bg-[#1e3a5f] transition-colors"
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

// Date formatting utility
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

// Timeline date formatting utility - Fixes UTC parsing issues
const formatTimelineDate = (dateString) => {
  if (!dateString) return 'Not set';
  try {
    const date = new Date(dateString);

    if (isNaN(date.getTime())) {
      return 'Invalid date';
    }

    return new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).format(date).replace(',', ' at');

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
  const [categories, setCategories] = useState([]);

  //for showing tracking history
  const [activityHistory, setActivityHistory] = useState([]);
  const [activityLoading, setActivityLoading] = useState(false);

  //for document session
  const [documents, setDocuments] = useState([]);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [uploadingDocument, setUploadingDocument] = useState(false);

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

  // Default to this month to prevent huge initial loading times
  const [timeRange, setTimeRange] = useState('month'); 

  // Auto-reset subcategory when service changes
  useEffect(() => {
    setSubcategoryFilter('all');
  }, [serviceFilter]);

  // Safely remember all discovered subcategories so the dropdown never shrinks
  const [discoveredSubcategories, setDiscoveredSubcategories] = useState({});

  useEffect(() => {
    setDiscoveredSubcategories(prev => {
      const next = { ...prev };
      services.forEach(s => {
        if (s.categoryId && s.subcategoryId) {
          if (!next[s.categoryId]) next[s.categoryId] = new Map();
          next[s.categoryId].set(s.subcategoryId, s.subcategoryName);
        }
      });
      return next;
    });
  }, [services]);

  // Compute available subcategories safely
  const availableSubcategories = useMemo(() => {
    if (serviceFilter === 'all') return [];
    
    // 1. Try to get it from the Categories API if provided
    const selectedCat = categories.find(c => c.id.toString() === serviceFilter.toString());
    if (selectedCat && selectedCat.subcategories) return selectedCat.subcategories;
    
    // 2. Fallback to our remembered subcategories
    if (discoveredSubcategories[serviceFilter]) {
      return Array.from(discoveredSubcategories[serviceFilter], ([id, name]) => ({ id, name }));
    }
    
    return [];
  }, [serviceFilter, categories, discoveredSubcategories]);

  const handleSaveView = () => {
    const filtersToSave = {
      status: statusFilter,
      staff: staffFilter,
      expiry: expiryFilter,
      date: dateFilter,
      service: serviceFilter,
      subcategory: subcategoryFilter
    };
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
    setTimeRange('month'); // Reset time range to default too
  };

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
  
  const [viewMode, setViewModeState] = useState(() => {
    try { return localStorage.getItem('trackServiceView') || 'queue'; } catch { return 'queue'; }
  });
  const setViewMode = (mode) => {
    setViewModeState(mode);
    try { localStorage.setItem('trackServiceView', mode); } catch { /* storage unavailable */ }
  };
  const [exportOpen, setExportOpen] = useState(false);

  useEffect(() => {
    if (id) return;
    const onKey = (e) => { if (e.key === 'Escape') setSelectedService(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [id]);
  const [isSidebarVisible, setIsSidebarVisible] = useState(true);

  const [draggedServiceId, setDraggedServiceId] = useState(null);
  const [dragOverColumn, setDragOverColumn] = useState(null);

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

  useEffect(() => {
    if (selectedService && detailPanelRef.current) {
      detailPanelRef.current.scrollTop = 0;
    }
  }, [selectedService?.id]);

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

  // Transform backend data (Instantly process using pre-calculated backend data)
  const transformBackendData = async (trackingData) => {
    return trackingData.map((trackingEntry) => {
      // Extract payments directly from backend JSON
      const totalCharge = parseFloat(trackingEntry.total_charges || 0);
      const totalReceived = parseFloat(trackingEntry.total_received || 0);
      const payments = trackingEntry.payment_details_array || [];

      let paymentStatus = 'Pending';
      if (totalCharge <= 0) paymentStatus = 'Not Applicable';
      else if (totalReceived >= totalCharge) paymentStatus = 'Received';
      else if (totalReceived > 0) paymentStatus = 'Partial';

      const paymentDetailsStr = payments.length > 0 
        ? payments.map(p => `${p.method === 'cash' ? 'Cash' : p.method === 'digital_wallet' ? 'Digital Wallet' : p.method}: ₹${Number(p.amount).toFixed(2)} (${p.status})`).join(', ')
        : 'No payments recorded';

      // Grouping date must strictly use created_at to avoid moving items to "today" when updated
      const createdDate = new Date(trackingEntry.created_at || trackingEntry.updated_at || Date.now());
      const dateStr = createdDate.toISOString().split('T')[0];
      
      const updatedDate = new Date(trackingEntry.updated_at || Date.now());
      const timeStr = updatedDate.toTimeString().split(' ')[0].substring(0, 5);

      const calculatedProgress = trackingEntry.progress || calculateProgress(
        statusMap[trackingEntry.status] || 'Pending',
        trackingEntry.current_step || 'Submitted'
      );

      const workSource = trackingEntry.work_source || (trackingEntry.customer_service_id ? 'online' : 'offline');

      return {
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
        totalCharge: totalCharge,
        cost: totalCharge,
        status: statusMap[trackingEntry.status] || 'Pending',
        currentStep: trackingEntry.current_step || 'Submitted',
        progress: calculatedProgress,
        priority: trackingEntry.priority || 'medium',
        date: dateStr, // Safely bound to creation date now
        time: timeStr,
        // Format ISO String instantly so it doesn't show 2026-09-21T00:00:00.000Z in UI
        estimatedDelivery: trackingEntry.estimated_delivery && !isNaN(new Date(trackingEntry.estimated_delivery)) ? formatDate(trackingEntry.estimated_delivery) : 'Not set',
        expiryDate: trackingEntry.expiry_date && !isNaN(new Date(trackingEntry.expiry_date)) ? formatDate(trackingEntry.expiry_date) : 'N/A',
        createdAt: trackingEntry.created_at || trackingEntry.updated_at,
        updatedAt: trackingEntry.updated_at,
        duration: null,
        notes: trackingEntry.notes || 'No notes available',
        rating: null,
        followUpRequired: trackingEntry.status === 'rejected' || trackingEntry.status === 'resubmit',
        paymentStatus: paymentStatus,
        paymentDetails: paymentDetailsStr,
        payments: payments,
        phone: trackingEntry.phone || 'N/A',
        email: trackingEntry.email || '',
        aadhaar: trackingEntry.aadhaar || '',
        steps: Array.isArray(trackingEntry.steps) ? trackingEntry.steps.map(step => ({
          id: step.id,
          name: step.name,
          completed: step.completed,
          date: step.date,
          created_at: step.created_at,
          step_order: step.step_order,
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
      };
    });
  };

  const fetchStats = async () => {
    const apiStatus = reverseStatusMap[statusFilter] || statusFilter;
    const data = await getTrackingStats({ 
        timeRange: timeRange === 'all' ? undefined : timeRange, 
        date: dateFilter || undefined,
        service: serviceFilter === 'all' ? undefined : serviceFilter,
        subcategory: subcategoryFilter === 'all' ? undefined : subcategoryFilter,
        // status is intentionally NOT sent: the status tabs show a count for every status
        staff: staffFilter === 'all' ? undefined : staffFilter,
      });
    setGlobalStats(data || {});
  };

  const fetchActivityHistory = async (trackingId) => {
    if (!trackingId) {
      setActivityHistory([]);
      return;
    }

    try {
      setActivityLoading(true);

      const response = await getTrackingActivity(trackingId);

      const activities = Array.isArray(response?.activities)
        ? response.activities
        : [];

      setActivityHistory(activities);
    } catch (error) {
      console.error('Error fetching activity history:', error);
      setActivityHistory([]);
    } finally {
      setActivityLoading(false);
    }
  };

    const fetchDocuments = async (trackingId) => {
    if (!trackingId) {
      setDocuments([]);
      return;
    }
    try {
      setDocumentsLoading(true);
      const data = await getTrackingDocuments(trackingId);
      setDocuments(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching documents:', error);
      setDocuments([]);
    } finally {
      setDocumentsLoading(false);
    }
  };

  const handleUploadDocument = async (trackingId, file, label, visibleToCustomer, remark) => {
    try {
      setUploadingDocument(true);
      const formData = new FormData();
      formData.append('file', file);
      formData.append('label', label);
      formData.append('visible_to_customer', visibleToCustomer ? 'true' : 'false');
      if (remark && remark.trim()) formData.append('remark', remark.trim());
      await uploadTrackingDocument(trackingId, formData);
      await fetchDocuments(trackingId);
      toast.success('Document uploaded');
    } catch (error) {
      console.error('Error uploading document:', error);
      toast.error('Failed to upload document: ' + (error.response?.data?.error || error.message));
    } finally {
      setUploadingDocument(false);
    }
  };

  const handleToggleDocumentVisibility = async (trackingId, docId, visible) => {
    try {
      await toggleTrackingDocumentVisibility(trackingId, docId, visible);
      await fetchDocuments(trackingId);
      toast.success(visible ? 'Document is now visible to the customer' : 'Document hidden from the customer');
    } catch (error) {
      console.error('Error updating document visibility:', error);
      toast.error('Failed to update document visibility');
    }
  };

  const handleUpdateDocumentRemark = async (trackingId, docId, remark) => {
    try {
      await updateTrackingDocumentRemark(trackingId, docId, remark);
      await fetchDocuments(trackingId);
      toast.success('Remark saved');
    } catch (error) {
      console.error('Error updating remark:', error);
      toast.error('Failed to save remark');
    }
  };

  const handleDeleteDocument = async (trackingId, docId) => {
    try {
      await deleteTrackingDocument(trackingId, docId);
      await fetchDocuments(trackingId);
      toast.success('Document deleted');
    } catch (error) {
      console.error('Error deleting document:', error);
      toast.error('Failed to delete document');
    }
  };

  const fetchSingleTrackingEntry = async (entryId) => {
    try {
      console.log('Fetching single tracking entry:', entryId);
      const [response, staffResponse] = await Promise.all([
        getTrackingEntryById(entryId),
        getStaff()
      ]);
      
      const staffData = Array.isArray(staffResponse) ? staffResponse : 
                      Array.isArray(staffResponse?.data) ? staffResponse.data : [];
      setStaffList(staffData);
      
      const transformed = await transformBackendData([response]);
      
      if (transformed.length > 0) {
        setServices(transformed);
        setSelectedService(transformed[0]);
        await fetchActivityHistory(transformed[0].id);
        await fetchDocuments(transformed[0].id);
        
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
          setSelectedService(prev => ({
            ...prev,
            assignedTo: assignedStaff.name,
            assignedToId: assignedStaff.id
          }));
        }
        
        setIsSidebarVisible(false);
      }
    } catch (error) {
      console.error('Error fetching single tracking entry:', error);
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
        timeRange: timeRange === 'all' ? undefined : timeRange,
        date: dateFilter || undefined,
        service: serviceFilter === 'all' ? undefined : serviceFilter,
        categoryId: serviceFilter === 'all' ? undefined : serviceFilter, 
        subcategory: subcategoryFilter === 'all' ? undefined : subcategoryFilter,
        subcategoryId: subcategoryFilter === 'all' ? undefined : subcategoryFilter,
        status: statusFilter === 'all' ? undefined : apiStatus,
        staff: staffFilter === 'all' ? undefined : staffFilter,
        expiry: expiryFilter === 'all' ? undefined : expiryFilter,
        search: debouncedSearch || undefined,
        aadhaar: debouncedAadhaar || undefined
      };

      const [trackingResponse, staffResponse, categoriesResponse] = await Promise.all([
        getTrackingEntries(params),
        getStaff(),
        getCategories()
      ]);

      if (trackingResponse && trackingResponse.pagination) {
        setTotalRecords(trackingResponse.pagination.totalRecords);
        setTotalPages(trackingResponse.pagination.totalPages);
      }

      const trackingData = Array.isArray(trackingResponse?.data) 
        ? trackingResponse.data 
        : Array.isArray(trackingResponse) ? trackingResponse : [];

      const staffData = Array.isArray(staffResponse?.data) ? staffResponse.data : Array.isArray(staffResponse) ? staffResponse : [];
      const categoriesData = Array.isArray(categoriesResponse?.data) ? categoriesResponse.data : Array.isArray(categoriesResponse) ? categoriesResponse : [];

      setStaffList(staffData);
      setCategories(categoriesData);

      let transformedServices = await transformBackendData(trackingData);

      // Explicit local fallback for category & subcategory filtering to enforce selection
      if (serviceFilter !== 'all') {
        transformedServices = transformedServices.filter(s => String(s.categoryId) === String(serviceFilter));
      }
      if (subcategoryFilter !== 'all') {
        transformedServices = transformedServices.filter(s => String(s.subcategoryId) === String(subcategoryFilter));
      }

      setServices(transformedServices);
      setIsSidebarVisible(true);
      
    } catch (error) {
      console.error('TrackServicePage: Error fetching data:', error);
      toast.error('Failed to fetch data');
      setStaffList([]);
      setCategories([]);
    }
  };

  useEffect(() => {
    const loadInitialData = async () => {
      setLoading(true);
      try {
        if (id) {
          await fetchSingleTrackingEntry(id);
        } else {
          await Promise.all([
            fetchAllTrackingEntries(),
            fetchStats()
          ]);
        }
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setLoading(false);
      }
    };
    loadInitialData();
  }, []);

  useEffect(() => {
    if (id) return;
    const reloadFilteredData = async () => {
      try {
        await Promise.all([
          fetchAllTrackingEntries(),
          fetchStats()
        ]);
      } catch (error) {
        console.error('Filter reload error:', error);
      }
    };
    reloadFilteredData();
  }, [
    currentPage,
    debouncedSearch,
    debouncedAadhaar,
    statusFilter,
    staffFilter,
    expiryFilter,
    timeRange,
    dateFilter,
    serviceFilter,
    subcategoryFilter
  ]);

  const handleUpdateStatus = async (serviceId, newStatus) => {
    try {
      const apiStatus = reverseStatusMap[newStatus] || newStatus;
      const service = services.find(s => s.id === serviceId);
      
      const newProgress = calculateProgress(newStatus, service.currentStep);
      
      if (service) {
          service.status = newStatus;
          service.progress = newProgress;
      }

      setServices(prevServices => prevServices.map(s =>
        s.id === serviceId ? { ...s, status: newStatus, progress: newProgress } : s
      ));
      
      if (selectedService?.id === serviceId) {
        setSelectedService(prev => ({ ...prev, status: newStatus, progress: newProgress }));
      }

      await updateTrackingStatus(serviceId, apiStatus);
      await fetchActivityHistory(serviceId);
      toast.success(`Status updated to ${newStatus}`);
      
    } catch (error) {
      console.error('TrackServicePage: Error updating status:', error);
      toast.error('Failed to update status: ' + (error.response?.data?.error || error.message));
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

      // Handle Optimistic UI injection for Timeline
      const stepOrderMap = { 'Submitted': 1, 'Initial Review': 2, 'Document Verification': 3, 'Final Approval': 4 };
      if (updates.currentStep !== undefined && service.currentStep !== updates.currentStep) {
          const targetOrder = stepOrderMap[updates.currentStep] || 1;
          const nowIso = new Date().toISOString();
          
          if (service.steps && service.steps.length > 0) {
              updates.steps = service.steps.map(step => {
                  const currentOrder = stepOrderMap[step.name] || step.step_order || 1;
                  if (currentOrder <= targetOrder) {
                      return { 
                          ...step, 
                          completed: true, 
                          // Only assign the brand new time if it's the specific step we just clicked
                          date: (currentOrder === targetOrder) ? nowIso : (step.date || service.createdAt)
                      };
                  }
                  return { ...step, completed: false };
              });
          }
          updates.updatedAt = nowIso;
      }

      Object.assign(service, updates);
      if (updates.applicationNumber !== undefined) service.applicationNumber = updates.applicationNumber;
      if (updates.currentStep !== undefined) service.currentStep = updates.currentStep;

      setServices(prevServices => prevServices.map(s => {
        if (s.id === service.id) {
          return {
            ...s,
            ...updates,
            steps: updates.steps || s.steps,
            updatedAt: updates.updatedAt || s.updatedAt,
            assignedTo: updates.assignedTo !== undefined ? (staffList.find(staff => staff.id === parseInt(updates.assignedTo))?.name || 'Unassigned') : s.assignedTo,
            assignedToId: updates.assignedTo !== undefined ? parseInt(updates.assignedTo) : s.assignedToId,
            rawEstimatedDelivery: updates.estimatedDelivery !== undefined ? updates.estimatedDelivery : s.rawEstimatedDelivery,
            estimatedDelivery: updates.estimatedDelivery !== undefined ? formatDate(updates.estimatedDelivery) : s.estimatedDelivery,
            progress: payload.progress
          };
        }
        return s;
      }));
      
      if (selectedService?.id === service.id) {
        setSelectedService(prev => ({ 
            ...prev, 
            ...updates, 
            steps: updates.steps || prev.steps,
            updatedAt: updates.updatedAt || prev.updatedAt,
            progress: payload.progress 
        }));
        setTrackingFormData(prev => ({ ...prev, ...updates }));
      }

      await updateTrackingEntry(service.id, payload);
      await fetchActivityHistory(service.id);
      toast.success('Details updated successfully');

    } catch (error) {
      console.error('Error updating details:', error);
      toast.error('Failed to update tracking details');
    }
  };

  const handleNotifyCustomer = async (service) => {
    try {
      console.log('TrackServicePage: Sending notification for service:', {
        id: service.id,
        serviceEntryId: service.serviceEntryId,
        customerName: service.customerName,
        applicationNumber: service.applicationNumber,
        status: service.status
      });
      
      await notifyCustomer(service.id, `Dear ${service.customerName}, your ${service.serviceType} application (App No: ${service.applicationNumber || 'N/A'}) is now ${service.status}.`);
      toast.success(`Notification sent to ${service.customerName} via WhatsApp`);
    } catch (error) {
      console.error('TrackServicePage: Error sending notification:', error);
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
      if (trackingFormData.applicationNumber && trackingFormData.applicationNumber.length > 50) {
        throw new Error('Application number must be 50 characters or less');
      }

      if (trackingFormData.aadhaar && !/^\d{12}$/.test(trackingFormData.aadhaar)) {
        throw new Error('Aadhaar number must be exactly 12 digits');
      }

      if (trackingFormData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trackingFormData.email)) {
        throw new Error('Please enter a valid email address');
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
      
      // Optimitic Timeline injection
      const stepOrderMap = { 'Submitted': 1, 'Initial Review': 2, 'Document Verification': 3, 'Final Approval': 4 };
      const targetOrder = stepOrderMap[trackingFormData.currentStep] || 1;
      const nowIso = new Date().toISOString();
      
      let updatedSteps = selectedService.steps;
      if (updatedSteps && updatedSteps.length > 0 && selectedService.currentStep !== trackingFormData.currentStep) {
          updatedSteps = updatedSteps.map(step => {
              const currentOrder = stepOrderMap[step.name] || step.step_order || 1;
              if (currentOrder <= targetOrder) {
                  return { 
                      ...step, 
                      completed: true, 
                      date: (currentOrder === targetOrder) ? nowIso : (step.date || selectedService.createdAt)
                  };
              }
              return { ...step, completed: false };
          });
      }

      const response = await updateTrackingEntry(selectedService.id, payload);
      await fetchActivityHistory(selectedService.id);
      await fetchDocuments(selectedService.id);

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
          rawEstimatedDelivery: trackingFormData.estimatedDelivery,
          steps: updatedSteps,
          updatedAt: (selectedService.currentStep !== trackingFormData.currentStep) ? nowIso : service.updatedAt
        } : service
      );
      
      setServices(updatedServices);
      setSelectedService({
        ...selectedService,
        applicationNumber: trackingFormData.applicationNumber || `APP${selectedService.serviceEntryId}`,
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
        rawEstimatedDelivery: trackingFormData.estimatedDelivery,
        steps: updatedSteps,
        updatedAt: (selectedService.currentStep !== trackingFormData.currentStep) ? nowIso : selectedService.updatedAt
      });
      
      setActiveTab('overview');
    } catch (error) {
      console.error('TrackServicePage: Error updating tracking details:', error);
      toast.error('Failed to update tracking details: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleServiceSelect = async (service, preventNav = false) => {
    setSelectedService(service);
    await fetchActivityHistory(service.id);
    await fetchDocuments(service.id);

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
    
    /*if (!id && !preventNav && viewMode === 'kanban') {
      navigate(`/dashboard/staff/track_service/${service.id}`, { replace: true });
    }*/
  };

  const detailPanelRef = useRef(null);
  const currentServiceIndex = services.findIndex(s => s.id === selectedService?.id);

  const handleNavigateApplication = async (direction) => {
    const nextIndex = currentServiceIndex + direction;
    if (nextIndex < 0 || nextIndex >= services.length) return;
    await handleServiceSelect(services[nextIndex], true);
  };


  /* =====================================================================
     DETAIL VIEW (shared by the single-application page and the side panel)
  ===================================================================== */

  const STEP_ORDER = { 'Submitted': 1, 'Initial Review': 2, 'Document Verification': 3, 'Final Approval': 4 };

  const getDisplaySteps = (service) => {
    if (service.steps && service.steps.length > 0) {
      return [...service.steps].sort((a, b) => (a.step_order || 0) - (b.step_order || 0));
    }
    const currentOrder = STEP_ORDER[service.currentStep] || 1;
    return [
      { id: 1, name: 'Submitted', completed: true, step_order: 1, date: service.createdAt },
      { id: 2, name: 'Initial Review', completed: currentOrder >= 2, step_order: 2, date: currentOrder === 2 ? service.updatedAt : null },
      { id: 3, name: 'Document Verification', completed: currentOrder >= 3, step_order: 3, date: currentOrder === 3 ? service.updatedAt : null },
      { id: 4, name: 'Final Approval', completed: currentOrder >= 4, step_order: 4, date: currentOrder >= 4 ? service.updatedAt : null }
    ];
  };

  const StatusPill = ({ status, size = 'sm' }) => {
    const cfg = statusConfig[status] || statusConfig['Pending'];
    return (
      <span className={`inline-flex items-center gap-1.5 rounded-full font-semibold border ${cfg.bg} ${cfg.color} ${cfg.border} ${
        size === 'lg' ? 'px-3 py-1 text-xs' : 'px-2 py-0.5 text-[11px]'
      }`}>
        <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
        {status}
      </span>
    );
  };

  const PriorityPill = ({ priority }) => {
    const cfg = priorityConfig[priority || 'medium'] || priorityConfig.medium;
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${cfg.bg} ${cfg.border} ${cfg.color}`}>
        <FiFlag className="h-3 w-3" /> {cfg.label}
      </span>
    );
  };

  const sectionLabel = 'text-xs font-semibold text-gray-500';
  const fieldCls = 'w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#172a45] focus:border-[#172a45]';

  // Header: who, what, contact, main actions
  const renderDetailHeader = (service) => (
    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div className="flex items-start gap-4 min-w-0">
          <div className="w-12 h-12 rounded-xl bg-[#172a45] text-white flex items-center justify-center text-lg font-bold flex-shrink-0">
            {(service.customerName || '?').charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-bold text-gray-900 truncate">{service.customerName || 'Unknown'}</h2>
              <StatusPill status={service.status} size="lg" />
              <span className={`px-2 py-0.5 text-[11px] font-semibold rounded-full border ${
                service.workSource === 'online'
                  ? 'bg-green-50 text-green-700 border-green-200'
                  : 'bg-blue-50 text-blue-700 border-blue-200'
              }`}>
                {service.workSource === 'online' ? 'Online booking' : 'Walk-in'}
              </span>
            </div>
            <p className="text-sm text-gray-700 mt-1 font-medium">
              {service.serviceType}
              {service.subcategoryName && service.subcategoryName !== 'N/A' && (
                <span className="text-gray-500 font-normal"> · {service.subcategoryName}</span>
              )}
            </p>
            <div className="flex items-center gap-x-4 gap-y-1 mt-2 flex-wrap text-xs text-gray-600">
              <span className="inline-flex items-center gap-1 font-mono font-semibold text-gray-800">
                <FiHash className="h-3.5 w-3.5 text-[#172a45]" />{service.trackingId}
              </span>
              <a href={`tel:${service.phone}`} className="inline-flex items-center gap-1 hover:text-[#172a45]">
                <FiPhone className="h-3.5 w-3.5" />{service.phone || 'N/A'}
              </a>
              {service.email && (
                <span className="inline-flex items-center gap-1"><FiMail className="h-3.5 w-3.5" />{service.email}</span>
              )}
              {service.aadhaar && (
                <span className="inline-flex items-center gap-1"><FiCreditCard className="h-3.5 w-3.5" />{service.aadhaar}</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => handleNotifyCustomer(service)}
            className="px-3 py-2 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-1.5 shadow-sm"
            title="Send the current status to the customer on WhatsApp"
          >
            <FiMessageSquare className="h-4 w-4" /> Notify
          </button>
          <button
            onClick={() => navigate(`/dashboard/staff/service-workspace/${service.id}`)}
            className="px-3 py-2 text-sm font-medium bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-1.5"
          >
            <FiGrid className="h-4 w-4" /> Workspace
          </button>
        </div>
      </div>
    </div>
  );

  // Right-hand panel: everything staff change day to day, one click each
  const renderQuickUpdate = (service) => {
    const steps = stepOptions.map(s => s.value);
    const currentOrder = STEP_ORDER[service.currentStep] || 1;

    return (
      <div className="space-y-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
            <FiEdit className="h-4 w-4 text-[#172a45]" /> Quick update
          </h3>

          {/* Status */}
          <div>
            <p className={`${sectionLabel} mb-2`}>Status</p>
            <div className="grid grid-cols-2 gap-1.5">
              {Object.keys(statusConfig).map(statusKey => {
                const cfg = statusConfig[statusKey];
                const active = service.status === statusKey;
                return (
                  <button
                    key={statusKey}
                    onClick={() => !active && handleUpdateStatus(service.id, statusKey)}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition ${
                      active
                        ? `${cfg.bg} ${cfg.color} ${cfg.border} ring-2 ring-offset-1 ring-current cursor-default`
                        : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                    {statusKey}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Step */}
          <div>
            <p className={`${sectionLabel} mb-2`}>Current step</p>
            <div className="space-y-1">
              {steps.map((step, i) => {
                const order = i + 1;
                const done = order < currentOrder;
                const current = order === currentOrder;
                return (
                  <button
                    key={step}
                    onClick={() => !current && handleInlineTrackingUpdate(service, { currentStep: step })}
                    className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs text-left transition ${
                      current ? 'bg-blue-50 text-[#172a45] font-bold' : 'hover:bg-gray-50 text-gray-600'
                    }`}
                  >
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${
                      done ? 'bg-emerald-500 text-white' : current ? 'bg-[#172a45] text-white' : 'bg-gray-200 text-gray-500'
                    }`}>
                      {done ? <FiCheckCircle className="h-3 w-3" /> : order}
                    </span>
                    {step}
                  </button>
                );
              })}
            </div>
          </div>

          {/* App number */}
          <div>
            <label className={`${sectionLabel} block mb-1.5`}>Application number</label>
            <input
              key={`${service.id}-${service.applicationNumber}`}
              type="text"
              defaultValue={service.applicationNumber || ''}
              placeholder="Enter application number"
              maxLength={50}
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v !== (service.applicationNumber || '')) handleInlineTrackingUpdate(service, { applicationNumber: v });
              }}
              onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
              className={`${fieldCls} font-mono`}
            />
          </div>

          {/* Assigned */}
          <div>
            <label className={`${sectionLabel} block mb-1.5`}>Assigned to</label>
            <select
              value={service.assignedToId || ''}
              onChange={(e) => handleInlineTrackingUpdate(service, { assignedTo: e.target.value })}
              className={fieldCls}
            >
              <option value="">Unassigned</option>
              {staffList.map(staff => <option key={staff.id} value={staff.id}>{staff.name}</option>)}
            </select>
          </div>

          {/* Delivery */}
          <div>
            <label className={`${sectionLabel} block mb-1.5`}>Estimated delivery</label>
            <input
              type="date"
              value={formatDateForInput(service.rawEstimatedDelivery)}
              onChange={(e) => handleInlineTrackingUpdate(service, { estimatedDelivery: e.target.value })}
              className={fieldCls}
            />
          </div>

          {/* Priority */}
          <div>
            <p className={`${sectionLabel} mb-1.5`}>Priority</p>
            <div className="flex bg-gray-100 p-1 rounded-lg">
              {priorityOptions.map(p => {
                const active = (service.priority || 'medium') === p.value;
                return (
                  <button
                    key={p.value}
                    onClick={() => !active && handleInlineTrackingUpdate(service, { priority: p.value })}
                    className={`flex-1 py-1.5 rounded-md text-xs font-semibold transition ${
                      active ? `bg-white shadow-sm ${priorityConfig[p.value].color}` : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Payment */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <FiDollarSign className="h-4 w-4 text-emerald-600" /> Payment
            </h3>
            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${
              (paymentStatusConfig[service.paymentStatus] || paymentStatusConfig.default).bg
            } ${(paymentStatusConfig[service.paymentStatus] || paymentStatusConfig.default).color} ${
              (paymentStatusConfig[service.paymentStatus] || paymentStatusConfig.default).border
            }`}>
              {service.paymentStatus}
            </span>
          </div>
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between text-gray-600"><span>Service charge</span><span className="font-mono">₹{(service.serviceCharge || 0).toFixed(2)}</span></div>
            <div className="flex justify-between text-gray-600"><span>Department charge</span><span className="font-mono">₹{(service.departmentCharge || 0).toFixed(2)}</span></div>
            <div className="flex justify-between font-bold text-gray-900 border-t border-gray-200 pt-1.5 mt-1.5"><span>Total</span><span className="font-mono">₹{(service.totalCharge || 0).toFixed(2)}</span></div>
          </div>
          {service.payments?.length > 0 && (
            <p className="text-[11px] text-gray-500 mt-2 leading-relaxed">{service.paymentDetails}</p>
          )}
        </div>
      </div>
    );
  };

  // Overview tab: progress, timeline, details, review
  const renderOverview = (service) => {
    const displaySteps = getDisplaySteps(service);
    return (
      <div className="space-y-6">
        {/* Progress stepper */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-gray-900">Progress</h3>
            <span className="text-sm font-bold text-[#172a45]">{service.progress}%</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2 mb-4">
            <div className="bg-[#172a45] h-2 rounded-full transition-all duration-500" style={{ width: `${service.progress}%` }} />
          </div>
          <ol className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            {displaySteps.map((step, i) => {
              const current = step.name === service.currentStep;
              return (
                <li key={step.id || i} className={`rounded-lg border p-3 ${
                  current ? 'border-blue-300 bg-blue-50' : step.completed ? 'border-emerald-200 bg-emerald-50/50' : 'border-gray-200 bg-gray-50'
                }`}>
                  <div className="flex items-center gap-2">
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                      step.completed ? 'bg-emerald-500 text-white' : current ? 'bg-[#172a45] text-white' : 'bg-gray-300 text-white'
                    }`}>
                      {step.completed ? <FiCheckCircle className="h-3 w-3" /> : i + 1}
                    </span>
                    <span className={`text-xs font-semibold ${step.completed || current ? 'text-gray-900' : 'text-gray-500'}`}>{step.name}</span>
                  </div>
                  <p className="text-[11px] text-gray-500 mt-1.5 pl-7">
                    {step.completed && step.date ? formatTimelineDate(step.date) : current ? 'In this step' : 'Pending'}
                  </p>
                </li>
              );
            })}
          </ol>
        </div>

        {/* Details */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-xl border border-gray-200 p-4">
            <h3 className="text-sm font-bold text-gray-900 mb-2">Service details</h3>
            <dl className="divide-y divide-gray-100 text-sm">
              {[
                ['Application no.', service.applicationNumber || 'N/A'],
                ['Created', formatDate(service.createdAt)],
                ['Last updated', formatDate(service.updatedAt)],
                ['Estimated delivery', service.estimatedDelivery || 'Not set'],
                ['Average time', service.averageTime || 'Not set'],
                ['Expiry date', service.expiryDate || 'N/A'],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between py-1.5 gap-4">
                  <dt className="text-gray-500">{k}</dt>
                  <dd className="font-medium text-gray-900 text-right">{v}</dd>
                </div>
              ))}
              <div className="flex justify-between py-1.5 gap-4">
                <dt className="text-gray-500">Priority</dt>
                <dd><PriorityPill priority={service.priority} /></dd>
              </div>
            </dl>
          </div>
          <div className="rounded-xl border border-gray-200 p-4">
            <h3 className="text-sm font-bold text-gray-900 mb-2">Customer remarks</h3>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">
              {service.notes && service.notes !== 'No notes available' ? service.notes : <span className="text-gray-400">No remarks</span>}
            </p>
          </div>
        </div>

        {service.serviceRating && (
          <div className="rounded-xl border border-gray-200 p-4">
            <h3 className="text-sm font-bold text-gray-900 mb-2">Customer review</h3>
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
              <span>Service: <span className="text-yellow-500">{'★'.repeat(service.serviceRating)}</span><span className="text-gray-300">{'★'.repeat(5 - service.serviceRating)}</span></span>
              {service.staffRating && (
                <span>Staff: <span className="text-yellow-500">{'★'.repeat(service.staffRating)}</span><span className="text-gray-300">{'★'.repeat(5 - service.staffRating)}</span></span>
              )}
            </div>
            {service.reviewText && <p className="text-sm text-gray-600 mt-2 italic">"{service.reviewText}"</p>}
            {service.reviewSubmittedAt && <p className="text-xs text-gray-400 mt-1">Submitted {formatDate(service.reviewSubmittedAt)}</p>}
          </div>
        )}
      </div>
    );
  };

  const DETAIL_TABS = [
    { id: 'overview', label: 'Overview', icon: FiBarChart2 },
    { id: 'tracking', label: 'Edit details', icon: FiEdit },
    { id: 'documents', label: 'Documents', icon: FiPaperclip },
    { id: 'history', label: 'History', icon: FiClock },
    { id: 'discussion', label: 'Discussion', icon: FiMessageCircle },
  ];

  const renderDetailTabs = (service) => (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <nav className="flex overflow-x-auto border-b border-gray-200 bg-gray-50/60 scrollbar-hide">
        {DETAIL_TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
              activeTab === tab.id
                ? 'border-[#172a45] text-[#172a45] bg-white'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            <tab.icon className="h-4 w-4" /> {tab.label}
            {tab.id === 'documents' && documents.length > 0 && (
              <span className="ml-0.5 text-[10px] bg-gray-200 text-gray-700 px-1.5 rounded-full">{documents.length}</span>
            )}
          </button>
        ))}
      </nav>
      <div className="p-5">
        {activeTab === 'overview' && renderOverview(service)}
        {activeTab === 'tracking' && (
          <TrackingView
            service={service}
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
            documents={documents}
            documentsLoading={documentsLoading}
            uploadingDocument={uploadingDocument}
            onUpload={(file, label, visible, remark) => handleUploadDocument(service.id, file, label, visible, remark)}
            onUpdateRemark={(docId, remark) => handleUpdateDocumentRemark(service.id, docId, remark)}
            onToggleVisibility={(docId, visible) => handleToggleDocumentVisibility(service.id, docId, visible)}
            onDelete={(docId) => handleDeleteDocument(service.id, docId)}
          />
        )}
        {activeTab === 'history' && (
          <HistoryView activityHistory={activityHistory} activityLoading={activityLoading} />
        )}
        {activeTab === 'discussion' && (
          <div>
            <p className="text-sm text-gray-500 mb-3">
              Internal only — customers never see this. Tag staff with @ to assign them.
            </p>
            <NotesPanel
              contextType="service_entry"
              contextId={service.serviceEntryId}
              embedded={true}
              showHeader={false}
            />
          </div>
        )}
      </div>
    </div>
  );

  // Full detail layout: header on top, tabs on the left, quick update on the right
  const renderServiceDetail = (service, { inDrawer = false } = {}) => (
    <div className="space-y-4">
      {renderDetailHeader(service)}
      <div className={`grid grid-cols-1 gap-4 ${inDrawer ? 'xl:grid-cols-3' : 'lg:grid-cols-3'}`}>
        <div className={`${inDrawer ? 'xl:col-span-2' : 'lg:col-span-2'} min-w-0`}>
          {renderDetailTabs(service)}
        </div>
        <aside className={inDrawer ? '' : 'lg:sticky lg:top-4 self-start'}>
          {renderQuickUpdate(service)}
        </aside>
      </div>
    </div>
  );

  // Kept for compatibility with any code that still calls it
  const renderDetailPane = () => (selectedService ? renderServiceDetail(selectedService) : null);

  const fetchAllFilteredDataForExport = async () => {
    const apiStatus = reverseStatusMap[statusFilter] || statusFilter;
    
    const params = {
      page: 1,
      limit: totalRecords > 0 ? totalRecords : 10000, 
      timeRange: timeRange === 'all' ? undefined : timeRange,
      date: dateFilter || undefined,
      service: serviceFilter === 'all' ? undefined : serviceFilter,
      categoryId: serviceFilter === 'all' ? undefined : serviceFilter,
      subcategory: subcategoryFilter === 'all' ? undefined : subcategoryFilter,
      subcategoryId: subcategoryFilter === 'all' ? undefined : subcategoryFilter,
      status: statusFilter === 'all' ? undefined : apiStatus,
      staff: staffFilter === 'all' ? undefined : staffFilter,
      expiry: expiryFilter === 'all' ? undefined : expiryFilter,
      search: debouncedSearch || undefined,
      aadhaar: debouncedAadhaar || undefined
    };

    try {
      const trackingResponse = await getTrackingEntries(params);
      const trackingData = Array.isArray(trackingResponse?.data) 
        ? trackingResponse.data 
        : Array.isArray(trackingResponse) ? trackingResponse : [];

      let transformedData = await transformBackendData(trackingData);

      // Explicit local fallback for category & subcategory filtering
      if (serviceFilter !== 'all') {
        transformedData = transformedData.filter(s => String(s.categoryId) === String(serviceFilter));
      }
      if (subcategoryFilter !== 'all') {
        transformedData = transformedData.filter(s => String(s.subcategoryId) === String(subcategoryFilter));
      }

      return transformedData;
    } catch (error) {
      console.error('Error fetching export data:', error);
      throw new Error('Failed to fetch complete dataset');
    }
  };
  
  const handleExportExcel = async () => {
    try {
      if (totalRecords === 0) {
        toast.info("No data to export");
        return;
      }
      
      toast.info("Preparing Excel file... This might take a moment.", { autoClose: 2000 });
      
      const fullDataset = await fetchAllFilteredDataForExport();

      const exportData = fullDataset.map(s => ({
        'Application No': s.applicationNumber || 'N/A',
        'Customer Name': s.customerName || 'Unknown',
        'Phone': s.phone || 'N/A',
        'Email': s.email || 'N/A',
        'Service Type': s.serviceType || 'Unknown',
        'Subcategory': s.subcategoryName || 'N/A',
        'Status': s.status || 'Pending',
        'Current Step': s.currentStep || 'Submitted',
        'Priority': s.priority || 'Medium',
        'Assigned To': s.assignedTo || 'Unassigned',
        'Created Date': s.date || 'N/A',
        'Estimated Delivery': s.estimatedDelivery || 'Not set',
        'Service Charge': s.serviceCharge || 0,
        'Department Charge': s.departmentCharge || 0,
        'Total Charge': s.totalCharge || 0,
        'Payment Status': s.paymentStatus || 'Pending'
      }));

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Tracked Services");
      XLSX.writeFile(workbook, `Service_Tracking_${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.success("Excel exported successfully!");
    } catch (error) {
      console.error("Export Error:", error);
      toast.error("Failed to export Excel. Ensure xlsx is installed.");
    }
  };

  const handleExportPDF = async () => {
    try {
      if (totalRecords === 0) {
        toast.info("No data to export");
        return;
      }
      
      toast.info("Generating PDF... This might take a moment.", { autoClose: 2000 });
      
      const fullDataset = await fetchAllFilteredDataForExport();
      
      const doc = new jsPDF('landscape');
      
      // Document Header
      doc.setFontSize(16);
      doc.text("Service Tracking Report", 14, 15);
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(`Generated on: ${new Date().toLocaleDateString()} | Total Records: ${fullDataset.length}`, 14, 22);

      const tableColumn = ["App No", "Customer Name", "Phone", "Service", "Status", "Step", "Assigned To", "Total"];
      const tableRows = [];

      fullDataset.forEach(s => {
        const rowData = [
          s.applicationNumber || 'N/A',
          s.customerName || 'Unknown',
          s.phone || 'N/A',
          s.serviceType || 'Unknown',
          s.status || 'Pending',
          s.currentStep || 'Submitted',
          s.assignedTo || 'Unassigned',
          `Rs ${s.totalCharge || 0}`
        ];
        tableRows.push(rowData);
      });

      autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        startY: 28,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [79, 70, 229] },
        alternateRowStyles: { fillColor: [249, 250, 251] }
      });

      doc.save(`Service_Tracking_${new Date().toISOString().split('T')[0]}.pdf`);
      toast.success("PDF exported successfully!");
    } catch (error) {
      console.error("Export Error:", error);
      toast.error("Failed to export PDF. Please check the console for details.");
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

  const kanbanColumns = ['Pending', 'In Progress', 'Resubmit', 'Delayed', 'Completed', 'Paid'];

  const servicesByStatus = useMemo(() => {
    const groups = {};
    kanbanColumns.forEach(s => { groups[s] = []; });
    services.forEach(s => {
      if (!groups[s.status]) groups[s.status] = [];
      groups[s.status].push(s);
    });
    return groups;
  }, [services]);

  const handleDragStart = (serviceId) => setDraggedServiceId(serviceId);
  const handleDragEnd = () => { setDraggedServiceId(null); setDragOverColumn(null); };

  const handleColumnDrop = (statusKey) => {
    if (draggedServiceId) {
      const service = services.find(s => s.id === draggedServiceId);
      if (service && service.status !== statusKey) {
        handleUpdateStatus(draggedServiceId, statusKey);
      }
    }
    setDraggedServiceId(null);
    setDragOverColumn(null);
  };


  const KanbanCard = ({ service, priorityConfig, isSelected, isDragging, onDragStart, onDragEnd, onClick }) => {
    const cardRef = useRef(null);

    const handleDragStart = (e) => {
      if (cardRef.current) e.dataTransfer.setDragImage(cardRef.current, 20, 20);
      e.dataTransfer.effectAllowed = 'move';
      onDragStart();
    };

    return (
      <div
        ref={cardRef}
        draggable
        onDragStart={handleDragStart}
        onDragEnd={onDragEnd}
        onClick={onClick}
        className={`p-3 rounded-lg border bg-white cursor-grab active:cursor-grabbing transition-all ${
          isDragging ? 'opacity-40' : ''
        } ${isSelected ? 'border-[#172a45] ring-2 ring-blue-200 shadow-md' : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'}`}
      >
        <div className="flex items-start justify-between gap-2 mb-1">
          <p className="text-sm font-semibold text-gray-900 truncate" title={service.customerName}>{service.customerName || 'Unknown'}</p>
          <FiMove className="h-3 w-3 text-gray-300 flex-shrink-0 mt-0.5" />
        </div>
        <p className="text-xs text-gray-500 truncate mb-2" title={service.serviceType}>{service.serviceType || 'Unknown'}</p>
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-mono text-gray-400 truncate">{service.applicationNumber || 'N/A'}</span>
          <PriorityPill priority={service.priority} />
        </div>
        <div className="mt-2 pt-2 border-t border-gray-100 flex items-center justify-between text-[11px]">
          <span className="text-gray-500 truncate">{service.assignedTo || 'Unassigned'}</span>
          <span className="text-[#172a45] font-medium flex-shrink-0">{service.estimatedDelivery}</span>
        </div>
      </div>
    );
  };

  const renderKanbanBoard = () => (
    <div className="overflow-x-auto pb-2">
      <div className="flex gap-3 min-w-max">
        {kanbanColumns.map((statusKey) => {
          const columnServices = servicesByStatus[statusKey] || [];
          const cfg = statusConfig[statusKey];
          const isDragOver = dragOverColumn === statusKey;
          return (
            <div
              key={statusKey}
              onDragOver={(e) => { e.preventDefault(); setDragOverColumn(statusKey); }}
              onDragLeave={() => setDragOverColumn(null)}
              onDrop={(e) => { e.preventDefault(); handleColumnDrop(statusKey); }}
              className={`w-72 flex-shrink-0 rounded-xl border-2 transition-colors ${isDragOver ? `${cfg.border} bg-blue-50/50` : 'border-gray-200 bg-gray-50'}`}
            >
              <div className={`flex items-center justify-between px-3 py-2.5 rounded-t-lg border-b ${cfg.border} ${cfg.bg}`}>
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                  <span className={`text-xs font-bold uppercase tracking-wide ${cfg.color}`}>{statusKey}</span>
                </div>
                <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full bg-white/70 ${cfg.color}`}>{columnServices.length}</span>
              </div>
              <div className="p-2 space-y-2 max-h-[calc(100vh-320px)] overflow-y-auto min-h-[80px]">
                {columnServices.length === 0 ? (
                  <div className="text-center py-8 text-xs text-gray-400">Drop here</div>
                ) : (
                  columnServices.map((service) => (
                    <KanbanCard
                      key={service.id}
                      service={service}
                      priorityConfig={priorityConfig}
                      isSelected={selectedService?.id === service.id}
                      isDragging={draggedServiceId === service.id}
                      onDragStart={() => handleDragStart(service.id)}
                      onDragEnd={handleDragEnd}
                      onClick={() => handleServiceSelect(service)}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  /* =====================================================================
     LIST MODE: toolbar, filters, table, side panel
  ===================================================================== */

  const STATUS_TABS = [
    { key: 'all', label: 'All', count: globalStats.total },
    { key: 'Pending', label: 'Pending', count: globalStats.pending },
    { key: 'In Progress', label: 'In Progress', count: globalStats.in_progress },
    { key: 'Resubmit', label: 'Resubmit', count: globalStats.resubmit },
    { key: 'Delayed', label: 'Delayed', count: globalStats.delayed },
    { key: 'Completed', label: 'Completed', count: globalStats.completed },
    { key: 'Paid', label: 'Paid', count: globalStats.paid },
  ];

  const TIME_RANGE_LABELS = { week: 'Last 7 days', month: 'This month', year: 'This year', all: 'All time' };

  const activeFilterChips = [
    statusFilter !== 'all' && { key: 'status', label: `Status: ${statusFilter}`, clear: () => setStatusFilter('all') },
    serviceFilter !== 'all' && {
      key: 'service',
      label: `Service: ${categories.find(c => String(c.id) === String(serviceFilter))?.name || serviceFilter}`,
      clear: () => setServiceFilter('all'),
    },
    subcategoryFilter !== 'all' && {
      key: 'sub',
      label: `Type: ${availableSubcategories.find(s => String(s.id) === String(subcategoryFilter))?.name || subcategoryFilter}`,
      clear: () => setSubcategoryFilter('all'),
    },
    staffFilter !== 'all' && {
      key: 'staff',
      label: `Staff: ${staffList.find(s => String(s.id) === String(staffFilter))?.name || staffFilter}`,
      clear: () => setStaffFilter('all'),
    },
    dateFilter && { key: 'date', label: `Date: ${formatDate(dateFilter)}`, clear: () => setDateFilter('') },
    expiryFilter !== 'all' && {
      key: 'expiry',
      label: expiryFilter === 'upcoming' ? 'Upcoming expiry' : 'Overdue',
      clear: () => setExpiryFilter('all'),
    },
    aadhaarSearch && { key: 'aadhaar', label: `Aadhaar: ${aadhaarSearch}`, clear: () => setAadhaarSearch('') },
    searchTerm && { key: 'search', label: `"${searchTerm}"`, clear: () => setSearchTerm('') },
  ].filter(Boolean);

  const selectCls = 'px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#172a45] cursor-pointer';
  const cellSelect = 'w-full text-xs bg-white border border-gray-200 rounded-md px-2 py-1 outline-none focus:border-[#172a45] hover:border-gray-300 cursor-pointer';

  const renderToolbar = () => (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
      {/* Main filter row */}
      <div className="p-3 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
          <input
            type="text"
            placeholder="Search name, phone or application no."
            className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#172a45]"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <select className={selectCls} value={timeRange} onChange={(e) => setTimeRange(e.target.value)} title="Period">
          {Object.entries(TIME_RANGE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>

        <select className={selectCls} value={serviceFilter} onChange={(e) => setServiceFilter(e.target.value)}>
          <option value="all">All services</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>

        {serviceFilter !== 'all' && availableSubcategories.length > 0 && (
          <select className={selectCls} value={subcategoryFilter} onChange={(e) => setSubcategoryFilter(e.target.value)}>
            <option value="all">All types</option>
            {availableSubcategories.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        )}

        <select className={selectCls} value={staffFilter} onChange={(e) => setStaffFilter(e.target.value)}>
          <option value="all">All staff</option>
          {staffList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>

        <button
          onClick={() => setShowAdvancedFilters(v => !v)}
          className={`px-3 py-2 text-sm rounded-lg border flex items-center gap-1.5 transition ${
            showAdvancedFilters ? 'bg-blue-50 border-blue-200 text-[#172a45]' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
          }`}
        >
          <FiSliders className="h-4 w-4" /> More
        </button>
      </div>

      {/* Extra filters */}
      <AnimatePresence initial={false}>
        {showAdvancedFilters && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
              <label className="text-xs text-gray-500">
                Created on
                <input type="date" className={`${selectCls} w-full mt-1`} value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} />
              </label>
              <label className="text-xs text-gray-500">
                Expiry
                <select className={`${selectCls} w-full mt-1`} value={expiryFilter} onChange={(e) => setExpiryFilter(e.target.value)}>
                  <option value="all">Any</option>
                  <option value="upcoming">Upcoming expiry</option>
                  <option value="overdue">Overdue</option>
                </select>
              </label>
              <label className="text-xs text-gray-500">
                Aadhaar number
                <input type="text" maxLength="12" placeholder="12 digits" className={`${selectCls} w-full mt-1`} value={aadhaarSearch} onChange={(e) => setAadhaarSearch(e.target.value.replace(/\D/g, ''))} />
              </label>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Active filters */}
      {activeFilterChips.length > 0 && (
        <div className="px-3 pb-3 flex flex-wrap items-center gap-1.5">
          {activeFilterChips.map(chip => (
            <span key={chip.key} className="inline-flex items-center gap-1 pl-2.5 pr-1 py-1 rounded-full bg-blue-50 text-[#172a45] text-xs font-medium border border-blue-100">
              {chip.label}
              <button onClick={chip.clear} className="p-0.5 rounded-full hover:bg-blue-100" title="Remove filter">
                <FiX className="h-3 w-3" />
              </button>
            </span>
          ))}
          <button onClick={handleClearFilters} className="text-xs font-semibold text-gray-500 hover:text-gray-800 px-2">Clear all</button>
          <button onClick={handleSaveView} className="text-xs font-semibold text-[#172a45] hover:text-[#172a45] px-2 flex items-center gap-1">
            <FiSave className="h-3 w-3" /> Save as my default
          </button>
        </div>
      )}
    </div>
  );

  const renderTable = () => (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[1000px]">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200 text-[11px] text-gray-500 uppercase tracking-wider">
              <th className="px-4 py-2.5 font-semibold">Customer</th>
              <th className="px-4 py-2.5 font-semibold">Service</th>
              <th className="px-4 py-2.5 font-semibold w-40">Application no.</th>
              <th className="px-4 py-2.5 font-semibold w-36">Status</th>
              <th className="px-4 py-2.5 font-semibold w-52">Step</th>
              <th className="px-4 py-2.5 font-semibold w-40">Assigned</th>
              <th className="px-4 py-2.5 font-semibold w-36">Delivery</th>
              <th className="px-4 py-2.5 font-semibold text-right w-24"></th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(servicesByDate)
              .sort(([a], [b]) => (a === 'Unknown Date' ? 1 : b === 'Unknown Date' ? -1 : b.localeCompare(a)))
              .map(([date, dateServices]) => (
              <React.Fragment key={date}>
                <tr className="bg-gray-50/80">
                  <td colSpan="8" className="px-4 py-1.5 text-[11px] font-bold text-gray-600 uppercase tracking-wider border-y border-gray-100">
                    {date === 'Unknown Date' ? date : formatDate(date)}
                    <span className="ml-2 text-gray-400 font-medium normal-case">{dateServices.length} {dateServices.length === 1 ? 'entry' : 'entries'}</span>
                  </td>
                </tr>
                {dateServices.map(service => {
                  const selected = selectedService?.id === service.id;
                  const cfg = statusConfig[service.status] || statusConfig['Pending'];
                  return (
                    <tr
                      key={service.id}
                      className={`border-b border-gray-100 transition-colors ${selected ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                    >
                      <td className="px-4 py-2.5">
                        <button onClick={() => handleServiceSelect(service)} className="text-left group">
                          <div className="text-sm font-semibold text-gray-900 group-hover:text-[#172a45] whitespace-nowrap">{service.customerName}</div>
                          <div className="text-xs text-gray-500">{service.phone || 'N/A'}</div>
                        </button>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="text-sm text-gray-900 truncate max-w-[200px]" title={service.serviceType}>{service.serviceType}</div>
                        {service.subcategoryName && service.subcategoryName !== 'N/A' && (
                          <div className="text-xs text-gray-500 truncate max-w-[200px]" title={service.subcategoryName}>{service.subcategoryName}</div>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <input
                          key={`${service.id}-${service.applicationNumber}`}
                          type="text"
                          defaultValue={service.applicationNumber || ''}
                          onBlur={(e) => {
                            const v = e.target.value.trim();
                            if (v !== (service.applicationNumber || '')) handleInlineTrackingUpdate(service, { applicationNumber: v });
                          }}
                          onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                          className="w-full text-xs font-mono border border-transparent hover:border-gray-200 focus:border-[#172a45] rounded-md px-2 py-1 bg-transparent focus:bg-white outline-none"
                          placeholder="Add app no."
                        />
                      </td>
                      <td className="px-4 py-2.5">
                        <select
                          value={service.status}
                          onChange={(e) => handleUpdateStatus(service.id, e.target.value)}
                          className={`w-full text-[11px] font-bold rounded-full px-2.5 py-1 border outline-none cursor-pointer ${cfg.bg} ${cfg.color} ${cfg.border}`}
                        >
                          {Object.keys(statusConfig).map(k => <option key={k} value={k}>{k}</option>)}
                        </select>
                      </td>
                      <td className="px-4 py-2.5">
                        <select
                          value={service.currentStep || 'Submitted'}
                          onChange={(e) => handleInlineTrackingUpdate(service, { currentStep: e.target.value })}
                          className={cellSelect}
                        >
                          {stepOptions.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                        </select>
                      </td>
                      <td className="px-4 py-2.5">
                        <select
                          value={service.assignedToId || ''}
                          onChange={(e) => handleInlineTrackingUpdate(service, { assignedTo: e.target.value })}
                          className={cellSelect}
                        >
                          <option value="">Unassigned</option>
                          {staffList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                      </td>
                      <td className="px-4 py-2.5">
                        <input
                          type="date"
                          value={formatDateForInput(service.rawEstimatedDelivery)}
                          onChange={(e) => handleInlineTrackingUpdate(service, { estimatedDelivery: e.target.value })}
                          className={cellSelect}
                        />
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleNotifyCustomer(service)}
                            title="Notify customer on WhatsApp"
                            className="p-1.5 rounded-md text-gray-400 hover:text-green-600 hover:bg-green-50"
                          >
                            <FiMessageSquare className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleServiceSelect(service)}
                            title="Open details"
                            className={`p-1.5 rounded-md ${selected ? 'text-[#172a45] bg-blue-100' : 'text-gray-400 hover:text-[#172a45] hover:bg-blue-50'}`}
                          >
                            <FiChevronRight className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </React.Fragment>
            ))}

            {services.length === 0 && (
              <tr>
                <td colSpan="8" className="text-center py-16 text-gray-500">
                  <FiSearch className="mx-auto h-10 w-10 mb-3 opacity-30" />
                  <p className="text-base font-medium text-gray-900">No applications found</p>
                  <p className="text-sm mt-1">Try a different period or remove some filters.</p>
                  {activeFilterChips.length > 0 && (
                    <button onClick={handleClearFilters} className="mt-3 text-sm font-semibold text-[#172a45] hover:text-[#172a45]">Clear all filters</button>
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50 text-sm">
          <span className="text-gray-600">
            Showing <b>{(currentPage - 1) * limit + 1}</b>–<b>{Math.min(currentPage * limit, totalRecords)}</b> of <b>{totalRecords}</b>
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1.5 font-medium text-gray-700 bg-white rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
            >
              <FiChevronLeft className="h-4 w-4" /> Prev
            </button>
            <span className="text-gray-600">Page {currentPage} of {totalPages}</span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1.5 font-medium text-gray-700 bg-white rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
            >
              Next <FiChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );

  // Side panel that slides in over the list
  const renderDrawer = () => (
    <AnimatePresence>
      {selectedService && (
        <>
          <motion.div
            key="drawer-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedService(null)}
            className="fixed inset-0 bg-gray-900/30 z-40"
          />
          <motion.div
            key="drawer"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 320 }}
            className="fixed inset-y-0 right-0 z-50 w-full max-w-5xl bg-gray-50 shadow-2xl flex flex-col"
          >
            <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-white border-b border-gray-200">
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleNavigateApplication(-1)}
                  disabled={currentServiceIndex <= 0}
                  className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Previous application"
                >
                  <FiChevronLeft className="h-4 w-4" />
                </button>
                <span className="text-xs font-medium text-gray-500 tabular-nums">
                  {currentServiceIndex + 1} / {services.length}
                </span>
                <button
                  onClick={() => handleNavigateApplication(1)}
                  disabled={currentServiceIndex >= services.length - 1}
                  className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Next application"
                >
                  <FiChevronRight className="h-4 w-4" />
                </button>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => navigate(`/dashboard/staff/track_service/${selectedService.id}`)}
                  className="px-3 py-1.5 text-xs font-semibold text-[#172a45] hover:bg-blue-50 rounded-lg flex items-center gap-1.5"
                  title="Open on its own page (shareable link)"
                >
                  <FiExternalLink className="h-3.5 w-3.5" /> Open full page
                </button>
                <button
                  onClick={() => setSelectedService(null)}
                  className="p-2 rounded-lg text-gray-500 hover:bg-gray-100"
                  title="Close (Esc)"
                >
                  <FiX className="h-5 w-5" />
                </button>
              </div>
            </div>
            <div ref={detailPanelRef} className="flex-1 overflow-y-auto p-4">
              {renderServiceDetail(selectedService, { inDrawer: true })}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );

  /* =====================================================================
     METRICS: one status bar + counts (also the status filter)
  ===================================================================== */

  const METRIC_SEGMENTS = [
    { key: 'Pending', count: globalStats.pending, bar: 'bg-amber-500' },
    { key: 'In Progress', count: globalStats.in_progress, bar: 'bg-blue-600' },
    { key: 'Resubmit', count: globalStats.resubmit, bar: 'bg-orange-500' },
    { key: 'Delayed', count: globalStats.delayed, bar: 'bg-rose-600' },
    { key: 'Completed', count: globalStats.completed, bar: 'bg-emerald-600' },
    { key: 'Paid', count: globalStats.paid, bar: 'bg-green-500' },
  ].filter(s => typeof s.count === 'number');

  const renderMetrics = () => {
    const total = globalStats.total || METRIC_SEGMENTS.reduce((a, s) => a + (s.count || 0), 0) || 0;
    const pct = (n) => (total ? Math.round(((n || 0) / total) * 100) : 0);
    const onTime = globalStats.sla_compliance != null ? Math.round(globalStats.sla_compliance) : null;

    return (
      <section className="bg-white rounded-xl border border-gray-200 p-4" aria-label="Applications by status">
        <div className="flex flex-wrap items-end justify-between gap-3 mb-3">
          <div>
            <p className="text-sm text-gray-500">{TIME_RANGE_LABELS[timeRange]}</p>
            <p className="text-3xl font-bold text-[#172a45] leading-tight tabular-nums">
              {total} <span className="text-base font-medium text-gray-500">applications</span>
            </p>
          </div>
          {onTime != null && (
            <div className="text-right">
              <p className="text-sm text-gray-500">Delivered on time</p>
              <p className={`text-2xl font-bold tabular-nums ${onTime >= 90 ? 'text-emerald-700' : onTime >= 75 ? 'text-amber-700' : 'text-rose-700'}`}>
                {onTime}%
              </p>
            </div>
          )}
        </div>

        {/* The status bar */}
        <div className="flex h-3 w-full rounded-full overflow-hidden bg-gray-100" role="img"
          aria-label={METRIC_SEGMENTS.map(s => `${s.key} ${s.count}`).join(', ')}>
          {METRIC_SEGMENTS.map(s => (s.count > 0 ? (
            <button
              key={s.key}
              onClick={() => setStatusFilter(statusFilter === s.key ? 'all' : s.key)}
              title={`${s.key}: ${s.count}`}
              style={{ width: `${pct(s.count)}%` }}
              className={`${s.bar} h-full transition-opacity ${statusFilter !== 'all' && statusFilter !== s.key ? 'opacity-25' : ''}`}
            />
          ) : null))}
        </div>

        {/* Counts, which are also the status filter */}
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-7 gap-1 mt-3">
          <button
            onClick={() => setStatusFilter('all')}
            className={`text-left rounded-lg px-3 py-2 transition ${statusFilter === 'all' ? 'bg-[#172a45] text-white' : 'hover:bg-gray-50'}`}
          >
            <span className={`block text-xs ${statusFilter === 'all' ? 'text-blue-100' : 'text-gray-500'}`}>All</span>
            <span className="block text-lg font-bold tabular-nums">{total}</span>
          </button>
          {METRIC_SEGMENTS.map(s => {
            const active = statusFilter === s.key;
            return (
              <button
                key={s.key}
                onClick={() => setStatusFilter(active ? 'all' : s.key)}
                className={`text-left rounded-lg px-3 py-2 transition ${active ? 'bg-[#172a45] text-white' : 'hover:bg-gray-50'}`}
              >
                <span className={`flex items-center gap-1.5 text-xs ${active ? 'text-blue-100' : 'text-gray-500'}`}>
                  <span className={`w-2 h-2 rounded-full ${s.bar}`} /> {s.key}
                </span>
                <span className="block text-lg font-bold tabular-nums">
                  {s.count}
                  <span className={`ml-1 text-xs font-medium ${active ? 'text-blue-100' : 'text-gray-400'}`}>{pct(s.count)}%</span>
                </span>
              </button>
            );
          })}
        </div>
      </section>
    );
  };

  /* =====================================================================
     QUEUE VIEW: list on the left, the selected application on the right
  ===================================================================== */

  const todayKey = new Date().toISOString().split('T')[0];
  const isOverdue = (s) =>
    s.rawEstimatedDelivery &&
    !['Completed', 'Paid'].includes(s.status) &&
    formatDateForInput(s.rawEstimatedDelivery) < todayKey;

  const initials = (name) =>
    (name || '?').split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();

  const renderQueueItem = (service) => {
    const selected = selectedService?.id === service.id;
    const cfg = statusConfig[service.status] || statusConfig['Pending'];
    const overdue = isOverdue(service);
    return (
      <li key={service.id}>
        <button
          onClick={() => handleServiceSelect(service)}
          className={`w-full text-left pl-3 pr-3 py-3 border-l-4 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#172a45] ${
            selected ? 'bg-blue-50/70 border-[#172a45]' : 'border-transparent hover:bg-gray-50'
          }`}
        >
          <div className="flex items-start justify-between gap-2">
            <p className={`text-sm truncate ${selected ? 'font-bold text-[#172a45]' : 'font-semibold text-gray-900'}`}>
              {service.customerName}
            </p>
            <span className={`flex-shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${cfg.bg} ${cfg.color}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} /> {service.status}
            </span>
          </div>
          <p className="text-xs text-gray-600 truncate mt-0.5">
            {service.serviceType}
            {service.subcategoryName && service.subcategoryName !== 'N/A' && <span className="text-gray-400"> / {service.subcategoryName}</span>}
          </p>
          <div className="flex items-center justify-between gap-2 mt-1.5 text-[11px]">
            <span className="font-mono text-gray-500 truncate">{service.applicationNumber || 'No app no.'}</span>
            <span className="flex items-center gap-2 flex-shrink-0">
              {service.rawEstimatedDelivery && (
                <span className={overdue ? 'text-rose-700 font-semibold' : 'text-gray-500'}>
                  {overdue ? 'Overdue ' : 'Due '}{service.estimatedDelivery}
                </span>
              )}
              <span
                className="w-5 h-5 rounded-full bg-gray-200 text-gray-700 text-[9px] font-bold flex items-center justify-center"
                title={service.assignedTo || 'Unassigned'}
              >
                {service.assignedToId ? initials(service.assignedTo) : '–'}
              </span>
            </span>
          </div>
        </button>
      </li>
    );
  };

  const renderQueue = () => {
    const groups = Object.entries(servicesByDate).sort(([a], [b]) =>
      a === 'Unknown Date' ? 1 : b === 'Unknown Date' ? -1 : b.localeCompare(a)
    );
    return (
      <div className="grid grid-cols-1 lg:grid-cols-[360px_minmax(0,1fr)] gap-4 items-start">
        {/* Queue */}
        <aside className={`bg-white rounded-xl border border-gray-200 overflow-hidden lg:sticky lg:top-4 ${selectedService ? 'hidden lg:block' : ''}`}>
          <div className="px-3 py-2.5 border-b border-gray-100 flex items-center justify-between text-xs text-gray-500">
            <span>
              {totalRecords ? <>Showing {(currentPage - 1) * limit + 1}–{Math.min(currentPage * limit, totalRecords)} of {totalRecords}</> : `${services.length} shown`}
            </span>
            {totalPages > 1 && (
              <span className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-1 rounded hover:bg-gray-100 disabled:opacity-30"
                  aria-label="Previous page"
                >
                  <FiChevronLeft className="h-4 w-4" />
                </button>
                <span className="tabular-nums">{currentPage}/{totalPages}</span>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="p-1 rounded hover:bg-gray-100 disabled:opacity-30"
                  aria-label="Next page"
                >
                  <FiChevronRight className="h-4 w-4" />
                </button>
              </span>
            )}
          </div>
          <div className="max-h-[calc(100vh-180px)] overflow-y-auto">
            {services.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-sm font-medium text-gray-900">No applications match</p>
                <p className="text-xs text-gray-500 mt-1">Try another period, or clear the filters.</p>
                {activeFilterChips.length > 0 && (
                  <button onClick={handleClearFilters} className="mt-3 text-sm font-semibold text-[#172a45] underline">Clear filters</button>
                )}
              </div>
            ) : (
              groups.map(([date, rows]) => (
                <div key={date}>
                  <p className="sticky top-0 z-10 bg-gray-50/95 backdrop-blur px-3 py-1.5 text-xs font-semibold text-gray-600 border-y border-gray-100">
                    {date === 'Unknown Date' ? date : date === todayKey ? 'Today' : formatDate(date)}
                    <span className="ml-1.5 font-normal text-gray-400">{rows.length}</span>
                  </p>
                  <ul className="divide-y divide-gray-100">{rows.map(renderQueueItem)}</ul>
                </div>
              ))
            )}
          </div>
        </aside>

        {/* Selected application */}
        <div className="min-w-0">
          {selectedService ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <button
                  onClick={() => setSelectedService(null)}
                  className="lg:hidden flex items-center gap-1.5 text-sm font-medium text-gray-600"
                >
                  <FiArrowLeft className="h-4 w-4" /> Back to queue
                </button>
                <div className="hidden lg:flex items-center gap-1 text-xs text-gray-500">
                  <button
                    onClick={() => handleNavigateApplication(-1)}
                    disabled={currentServiceIndex <= 0}
                    className="p-1.5 rounded-md hover:bg-white disabled:opacity-30"
                    aria-label="Previous application"
                  >
                    <FiChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="tabular-nums">{currentServiceIndex + 1} of {services.length}</span>
                  <button
                    onClick={() => handleNavigateApplication(1)}
                    disabled={currentServiceIndex >= services.length - 1}
                    className="p-1.5 rounded-md hover:bg-white disabled:opacity-30"
                    aria-label="Next application"
                  >
                    <FiChevronRight className="h-4 w-4" />
                  </button>
                </div>
                <button
                  onClick={() => navigate(`/dashboard/staff/track_service/${selectedService.id}`)}
                  className="text-xs font-semibold text-[#172a45] hover:underline flex items-center gap-1"
                >
                  <FiExternalLink className="h-3.5 w-3.5" /> Open on its own page
                </button>
              </div>
              {renderServiceDetail(selectedService, { inDrawer: true })}
            </div>
          ) : (
            <div className="hidden lg:flex flex-col items-center justify-center text-center bg-white rounded-xl border border-dashed border-gray-300 py-24 px-6">
              <FiFileText className="h-10 w-10 text-gray-300 mb-3" />
              <p className="text-base font-semibold text-gray-900">Pick an application from the queue</p>
              <p className="text-sm text-gray-500 mt-1">Its details, documents and quick update panel open here.</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  /* =====================================================================
     PAGE
  ===================================================================== */

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#172a45] border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-gray-600 font-medium">{id ? 'Loading application…' : 'Loading applications…'}</p>
        </div>
      </div>
    );
  }

  const servicesByDate = services.reduce((groups, service) => {
    const dateKey = service.date || 'Unknown Date';
    if (!groups[dateKey]) groups[dateKey] = [];
    groups[dateKey].push(service);
    return groups;
  }, {});

  /* ---------- Single application page ---------- */
  if (id) {
    return (
      <ErrorBoundary>
        <div className="min-h-screen bg-gray-50">
          <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-5 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <button
                onClick={handleBackToList}
                className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-[#172a45]"
              >
                <FiArrowLeft className="h-4 w-4" /> All applications
              </button>
              <button
                onClick={() => fetchSingleTrackingEntry(id)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                <FiRefreshCw className="h-4 w-4" /> Refresh
              </button>
            </div>

            {selectedService ? (
              renderServiceDetail(selectedService)
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
                <FiAlertCircle className="mx-auto h-10 w-10 text-gray-300 mb-3" />
                <h3 className="text-lg font-semibold text-gray-900">Application not found</h3>
                <p className="text-sm text-gray-500 mt-1">It may have been removed, or you may not have access to it.</p>
                <button onClick={handleBackToList} className="mt-4 px-4 py-2 text-sm font-semibold text-white bg-[#172a45] rounded-lg hover:bg-[#1e3a5f]">
                  Go to all applications
                </button>
              </div>
            )}
          </div>
          <style>{`.scrollbar-hide{-ms-overflow-style:none;scrollbar-width:none}.scrollbar-hide::-webkit-scrollbar{display:none}`}</style>
        </div>
      </ErrorBoundary>
    );
  }

  /* ---------- All applications ---------- */
  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-5 space-y-4">
          {/* Header */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold text-gray-900">Service Tracking</h1>
              <p className="text-sm text-gray-500">Find an application, update it, and let the customer know.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex bg-white border border-gray-200 p-1 rounded-lg" role="tablist" aria-label="View">
                {[
                  { id: 'queue', label: 'Queue', icon: FiColumns },
                  { id: 'grid', label: 'Table', icon: FiList },
                  { id: 'kanban', label: 'Board', icon: FiGrid },
                ].map(v => (
                  <button
                    key={v.id}
                    role="tab"
                    aria-selected={viewMode === v.id}
                    onClick={() => setViewMode(v.id)}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 ${
                      viewMode === v.id ? 'bg-[#172a45] text-white' : 'text-gray-500 hover:text-gray-800'
                    }`}
                  >
                    <v.icon className="h-4 w-4" /> {v.label}
                  </button>
                ))}
              </div>

              <div className="relative">
                <button
                  onClick={() => setExportOpen(o => !o)}
                  onBlur={() => setTimeout(() => setExportOpen(false), 150)}
                  className="px-3 py-2 text-sm font-medium bg-white border border-gray-200 rounded-lg hover:bg-gray-50 flex items-center gap-1.5"
                >
                  <FiDownload className="h-4 w-4" /> Export <FiChevronDown className="h-3.5 w-3.5" />
                </button>
                {exportOpen && (
                  <div className="absolute right-0 mt-1 w-40 bg-white border border-gray-200 rounded-lg shadow-lg z-30 py-1">
                    <button onMouseDown={handleExportExcel} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2">
                      <FiFileText className="h-4 w-4 text-emerald-600" /> Excel
                    </button>
                    <button onMouseDown={handleExportPDF} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2">
                      <FiFileText className="h-4 w-4 text-rose-600" /> PDF
                    </button>
                  </div>
                )}
              </div>

              <button
                onClick={() => Promise.all([fetchAllTrackingEntries(), fetchStats()])}
                className="p-2 text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
                title="Refresh"
              >
                <FiRefreshCw className="h-4 w-4" />
              </button>

              <button
                onClick={() => navigate('/dashboard/staff/service_entry')}
                className="px-3 py-2 text-sm font-semibold bg-[#172a45] text-white rounded-lg hover:bg-[#1e3a5f] flex items-center gap-1.5 shadow-sm whitespace-nowrap"
              >
                <FiPlus className="h-4 w-4" /> New entry
              </button>
            </div>
          </div>

          {renderMetrics()}

          {renderToolbar()}

          {viewMode === 'queue' ? renderQueue() : viewMode === 'grid' ? renderTable() : renderKanbanBoard()}
        </div>

        {viewMode !== 'queue' && renderDrawer()}

        <style>{`.scrollbar-hide{-ms-overflow-style:none;scrollbar-width:none}.scrollbar-hide::-webkit-scrollbar{display:none}`}</style>
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
      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#172a45] focus:border-[#172a45]"
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
      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#172a45] focus:border-[#172a45]"
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
      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#172a45] focus:border-[#172a45]"
    />
  </div>
);

const ActivityItem = ({ action, description, time, user }) => (
  <div className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
    <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
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
          label="Aadhaar Number"
          name="aadhaar"
          value={formData.aadhaar}
          onChange={onFormChange}
          placeholder="Enter 12-digit Aadhaar number"
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
          label="Customer Remarks (Sent via WhatsApp)"
          name="notes"
          value={formData.notes}
          onChange={onFormChange}
          placeholder="Enter remarks visible to the customer..."
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
          className="px-6 py-2.5 bg-[#172a45] text-white rounded-lg hover:bg-[#1e3a5f] transition-colors"
        >
          Save Changes
        </button>
      </div>
    </form>
  </div>
);

/* ============================================================
   INLINE REMARK EDITOR — used inside Documents table
   ============================================================ */

const DocumentRemarkEditor = ({ doc, onSave }) => {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(doc.remark || '');
  const inputRef = useRef(null);

  useEffect(() => { setValue(doc.remark || ''); }, [doc.remark]);
  useEffect(() => { if (editing && inputRef.current) inputRef.current.focus(); }, [editing]);

  const commit = () => {
    if (value.trim() !== (doc.remark || '').trim()) onSave(value.trim());
    setEditing(false);
  };
  const cancel = () => { setValue(doc.remark || ''); setEditing(false); };

  if (editing) {
    return (
      <div className="mt-2 flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
        <div className="relative flex-1 min-w-0">
          <FiMessageSquare className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-amber-500 pointer-events-none" />
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); commit(); }
              if (e.key === 'Escape') cancel();
            }}
            onBlur={commit}
            placeholder="Remark for customer (e.g. Password: 1234)"
            className="w-full pl-7 pr-2 py-1 text-xs border border-amber-300 bg-amber-50/60 rounded-md focus:ring-2 focus:ring-amber-400/40 focus:border-amber-400 outline-none transition-all"
          />
        </div>
      </div>
    );
  }

  if (doc.remark) {
    return (
      <button
        onClick={(e) => { e.stopPropagation(); setEditing(true); }}
        className="mt-1.5 group/remark inline-flex items-center gap-1.5 max-w-full text-left text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-2 py-0.5 hover:bg-amber-100 transition-colors"
        title="Click to edit remark"
      >
        <FiMessageSquare className="h-3 w-3 text-amber-600 flex-shrink-0" />
        <span className="truncate">{doc.remark}</span>
        <FiEdit className="h-2.5 w-2.5 opacity-0 group-hover/remark:opacity-60 flex-shrink-0" />
      </button>
    );
  }

  return (
    <button
      onClick={(e) => { e.stopPropagation(); setEditing(true); }}
      className="mt-1.5 text-[11px] text-gray-400 hover:text-[#172a45] flex items-center gap-1 transition-colors"
    >
      <FiPlus className="h-2.5 w-2.5" />
      Add customer remark
    </button>
  );
};

/* ============================================================
   ENHANCED DOCUMENTS VIEW
   ============================================================ */

const EnhancedDocumentsView = ({ 
  documents = [], documentsLoading, uploadingDocument,
  onUpload, onToggleVisibility, onDelete, onUpdateRemark
}) => {
  const [file, setFile] = useState(null);
  const [label, setLabel] = useState('');
  const [visibleToCustomer, setVisibleToCustomer] = useState(false);
  const [remark, setRemark] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!file || !label.trim()) {
      toast.error('Choose a file and enter a label first');
      return;
    }
    onUpload(file, label.trim(), visibleToCustomer, remark);
    setFile(null);
    setLabel('');
    setVisibleToCustomer(false);
    setRemark('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e) => { e.preventDefault(); e.stopPropagation(); setDragActive(true); };
  const handleDragLeave = (e) => { e.preventDefault(); e.stopPropagation(); setDragActive(false); };

  const formatBytes = (bytes) => {
    if (!bytes) return '';
    const kb = bytes / 1024;
    return kb > 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${Math.round(kb)} KB`;
  };

  const getFileIcon = (doc) => {
    const name = (doc.file_name || doc.label || '').toLowerCase();
    if (name.endsWith('.pdf')) return { Icon: FiFileText, color: 'text-rose-600', bg: 'bg-rose-50' };
    if (name.match(/\.(jpg|jpeg|png|gif|webp)$/)) return { Icon: FiEye, color: 'text-blue-600', bg: 'bg-blue-50' };
    if (name.match(/\.(doc|docx)$/)) return { Icon: FiFileText, color: 'text-[#172a45]', bg: 'bg-blue-50' };
    return { Icon: FiFileText, color: 'text-gray-600', bg: 'bg-gray-50' };
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-9 h-9 bg-blue-100 rounded-lg flex items-center justify-center">
              <FiPaperclip className="h-4 w-4 text-[#172a45]" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Customer Documents</h3>
          </div>
          <p className="text-sm text-gray-500 ml-11">
            Upload and manage documents. Files marked visible and their remarks appear on the customer's public tracking page.
          </p>
        </div>
        <div className="flex items-center gap-2 ml-11 sm:ml-0">
          <div className="px-3 py-1.5 bg-gray-100 rounded-lg">
            <span className="text-xs font-medium text-gray-600">
              {documents.length} {documents.length === 1 ? 'file' : 'files'}
            </span>
          </div>
          <div className="px-3 py-1.5 bg-emerald-50 rounded-lg border border-emerald-200">
            <span className="text-xs font-medium text-emerald-700">
              {documents.filter(d => d.visible_to_customer).length} visible
            </span>
          </div>
        </div>
      </div>

      {/* Upload Form */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3 bg-gray-50 border-b border-gray-200 flex items-center gap-2">
          <FiUpload className="h-4 w-4 text-[#172a45]" />
          <h4 className="text-sm font-semibold text-gray-900">Upload New Document</h4>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Label */}
            <div className="lg:col-span-4">
              <label className="block text-xs font-medium text-gray-600 mb-1.5">
                Document Label <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Income Certificate"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#172a45] focus:border-[#172a45] transition-all"
              />
            </div>

            {/* File Drop Zone */}
            <div className="lg:col-span-5">
              <label className="block text-xs font-medium text-gray-600 mb-1.5">
                File <span className="text-rose-500">*</span>
              </label>
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`relative flex items-center gap-3 px-3 py-2.5 border-2 border-dashed rounded-lg cursor-pointer transition-all ${
                  dragActive
                    ? 'border-indigo-500 bg-blue-50'
                    : file
                    ? 'border-emerald-400 bg-emerald-50/40'
                    : 'border-gray-300 bg-gray-50 hover:border-[#172a45] hover:bg-blue-50/40'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                  onChange={(e) => setFile(e.target.files[0] || null)}
                  className="hidden"
                />
                {file ? (
                  <>
                    <FiFileText className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                    <span className="text-sm text-gray-800 truncate flex-1">{file.name}</span>
                    <span className="text-xs text-gray-500 flex-shrink-0">{formatBytes(file.size)}</span>
                  </>
                ) : (
                  <>
                    <FiUpload className="h-4 w-4 text-gray-400 flex-shrink-0" />
                    <span className="text-sm text-gray-500 truncate flex-1">
                      {dragActive ? 'Drop file here' : 'Click or drag file to upload'}
                    </span>
                    <span className="text-xs text-gray-400 flex-shrink-0 hidden sm:inline">PDF, DOC, IMG</span>
                  </>
                )}
              </div>
            </div>

            {/* Visibility + Button */}
            <div className="lg:col-span-3 flex flex-col">
              <label className="block text-xs font-medium text-gray-600 mb-1.5">
                Visibility
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setVisibleToCustomer(!visibleToCustomer)}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-medium rounded-lg border transition-all ${
                    visibleToCustomer
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                      : 'bg-gray-50 text-gray-600 border-gray-300 hover:bg-gray-100'
                  }`}
                  title={visibleToCustomer ? 'Visible to customer' : 'Hidden from customer'}
                >
                  {visibleToCustomer ? <FiEye className="h-3.5 w-3.5" /> : <FiEyeOff className="h-3.5 w-3.5" />}
                  {visibleToCustomer ? 'Visible' : 'Hidden'}
                </button>
                <button
                  type="submit"
                  disabled={uploadingDocument || !file || !label.trim()}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 bg-[#172a45] text-white text-xs font-semibold rounded-lg hover:bg-[#1e3a5f] disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
                >
                  {uploadingDocument ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Uploading
                    </>
                  ) : (
                    <>
                      <FiUpload className="h-3.5 w-3.5" />
                      Upload
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Remark row — full width, amber-tinted to signal customer-facing */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-medium text-gray-600 mb-1.5">
              <FiMessageSquare className="h-3.5 w-3.5 text-amber-500" />
              Customer Remark
              <span className="text-gray-400 font-normal">— optional, shown to the customer alongside the document</span>
            </label>
            <input
              type="text"
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              placeholder="e.g. Password: 1234 — visible on the customer's tracking page"
              className="w-full px-3 py-2 text-sm border border-amber-200 bg-amber-50/40 rounded-lg focus:ring-2 focus:ring-amber-400/40 focus:border-amber-400 outline-none transition-all placeholder:text-amber-700/40"
            />
          </div>
        </form>
      </div>

      {/* Documents List */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FiFileText className="h-4 w-4 text-[#172a45]" />
            <h4 className="text-sm font-semibold text-gray-900">Uploaded Documents</h4>
          </div>
          {documents.length > 0 && (
            <span className="text-xs text-gray-500">
              {documents.length} {documents.length === 1 ? 'document' : 'documents'}
            </span>
          )}
        </div>

        {documentsLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-[#172a45] border-t-transparent rounded-full animate-spin"></div>
            <span className="ml-3 text-sm text-gray-500">Loading documents...</span>
          </div>
        ) : documents.length === 0 ? (
          <div className="text-center py-12 px-6">
            <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <FiFileText className="h-7 w-7 text-gray-400" />
            </div>
            <p className="text-sm font-medium text-gray-900 mb-1">No documents yet</p>
            <p className="text-xs text-gray-500">Upload the first document using the form above</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/70 border-b border-gray-200 text-[11px] text-gray-500 uppercase tracking-wider">
                  <th className="px-5 py-3 font-semibold">Document & Remark</th>
                  <th className="px-5 py-3 font-semibold w-40">Uploaded By</th>
                  <th className="px-5 py-3 font-semibold w-32">Date</th>
                  <th className="px-5 py-3 font-semibold w-28 text-center">Size</th>
                  <th className="px-5 py-3 font-semibold w-32 text-center">Visibility</th>
                  <th className="px-5 py-3 font-semibold w-24 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {documents.map((doc) => {
                  const { Icon, color, bg } = getFileIcon(doc);
                  return (
                    <tr key={doc.id} className="hover:bg-gray-50/60 transition-colors group align-top">
                      <td className="px-5 py-4">
                        <div className="flex items-start gap-3">
                          <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${bg}`}>
                            <Icon className={`h-4 w-4 ${color}`} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-gray-900 truncate" title={doc.label}>
                              {doc.label}
                            </p>
                            <p className="text-xs text-gray-500 truncate" title={doc.file_name}>
                              {doc.file_name || 'document'}
                            </p>
                            <DocumentRemarkEditor
                              doc={doc}
                              onSave={(text) => onUpdateRemark(doc.id, text)}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className="text-sm text-gray-700">
                          {doc.uploaded_by_name || 'Staff'}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <span className="text-sm text-gray-600">
                          {formatDate(doc.created_at)}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-center">
                        <span className="text-xs text-gray-500 font-mono">
                          {formatBytes(doc.file_size) || '—'}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-center">
                        <button
                          onClick={() => onToggleVisibility(doc.id, !doc.visible_to_customer)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                            doc.visible_to_customer
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                              : 'bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200'
                          }`}
                          title={doc.visible_to_customer ? 'Click to hide from customer' : 'Click to make visible to customer'}
                        >
                          {doc.visible_to_customer ? (
                            <>
                              <FiEye className="h-3 w-3" />
                              Visible
                            </>
                          ) : (
                            <>
                              <FiEyeOff className="h-3 w-3" />
                              Hidden
                            </>
                          )}
                        </button>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-1">
                          <a
                            href={doc.file_url || doc.url || '#'}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-lg text-gray-400 hover:text-[#172a45] hover:bg-blue-50 transition-colors"
                            title="View document"
                            onClick={(e) => {
                              if (!doc.file_url && !doc.url) e.preventDefault();
                            }}
                          >
                            <FiEye className="h-4 w-4" />
                          </a>
                          <button
                            onClick={() => {
                              if (window.confirm(`Delete "${doc.label}"? This cannot be undone.`)) onDelete(doc.id);
                            }}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                            title="Delete document"
                          >
                            <FiTrash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

const HistoryView = ({ activityHistory, activityLoading }) => {
  if (activityLoading) {
    return (
      <div className="space-y-6">
        <h3 className="font-semibold text-gray-900">Activity History</h3>

        <div className="flex items-center justify-center py-10">
          <div className="w-6 h-6 border-2 border-[#172a45] border-t-transparent rounded-full animate-spin"></div>
          <span className="ml-3 text-sm text-gray-500">
            Loading activity history...
          </span>
        </div>
      </div>
    );
  }

  if (!activityHistory || activityHistory.length === 0) {
    return (
      <div className="space-y-6">
        <h3 className="font-semibold text-gray-900">Activity History</h3>

        <div className="text-center py-10 bg-gray-50 rounded-lg border border-gray-200">
          <FiClock className="mx-auto h-8 w-8 text-gray-400 mb-2" />
          <p className="text-sm text-gray-500">
            No activity history available
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">
          Activity History
        </h3>

        <span className="text-xs text-gray-500">
          {activityHistory.length} {activityHistory.length === 1 ? 'event' : 'events'}
        </span>
      </div>

      <div className="space-y-3">
        {activityHistory.map((activity) => (
          <ActivityItem
            key={activity.id}
            action={activity.action}
            description={activity.description}
            time={
              activity.created_at
                ? formatTimelineDate(activity.created_at)
                : 'Unknown time'
            }
            user={activity.performed_by_name || 'System'}
          />
        ))}
      </div>
    </div>
  );
};

export default TrackServicePage;