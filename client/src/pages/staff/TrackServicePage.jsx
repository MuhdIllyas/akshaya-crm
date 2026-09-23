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
  FiPlus, FiGrid, FiList, FiCreditCard, FiFlag, FiArrowLeft, FiMessageCircle,
  FiUpload, FiTrash2, FiEye, FiEyeOff, FiPaperclip, FiX, FiSave,
  FiChevronRight, FiLayers, FiActivity, FiZap, FiSliders, FiExternalLink,
  FiStar, FiUsers, FiInbox
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

/* ============================================================
   ERROR BOUNDARY
   ============================================================ */
class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  componentDidCatch(error, info) { console.error('Error caught by boundary:', error, info); }
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
            <button onClick={() => window.location.reload()} className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
              Refresh Page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

/* ============================================================
   UTILITIES
   ============================================================ */
const formatDate = (dateString) => {
  if (!dateString) return 'Not set';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Invalid date';
    return date.toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch (error) { console.error(error); return 'Invalid date'; }
};

const formatTimelineDate = (dateString) => {
  if (!dateString) return 'Not set';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Invalid date';
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Kolkata', day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: false
    }).format(date).replace(',', ' at');
  } catch (error) { console.error(error); return 'Invalid date'; }
};

/* ============================================================
   MAIN COMPONENT
   ============================================================ */
const TrackServicePage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [services, setServices] = useState([]);
  const [entryServices, setEntryServices] = useState([]);
  const [selectedService, setSelectedService] = useState(null);
  const [loading, setLoading] = useState(true);
  const [staffList, setStaffList] = useState([]);
  const [categories, setCategories] = useState([]);

  const [activityHistory, setActivityHistory] = useState([]);
  const [activityLoading, setActivityLoading] = useState(false);

  const [documents, setDocuments] = useState([]);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [uploadingDocument, setUploadingDocument] = useState(false);

  const getSavedFilters = () => {
    try {
      const saved = localStorage.getItem('staffServiceSavedView');
      if (saved) return JSON.parse(saved);
    } catch (e) { console.error(e); }
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
  const [timeRange, setTimeRange] = useState('month');

  useEffect(() => { setSubcategoryFilter('all'); }, [serviceFilter]);

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

  const availableSubcategories = useMemo(() => {
    if (serviceFilter === 'all') return [];
    const selectedCat = categories.find(c => c.id.toString() === serviceFilter.toString());
    if (selectedCat && selectedCat.subcategories) return selectedCat.subcategories;
    if (discoveredSubcategories[serviceFilter]) {
      return Array.from(discoveredSubcategories[serviceFilter], ([id, name]) => ({ id, name }));
    }
    return [];
  }, [serviceFilter, categories, discoveredSubcategories]);

  const handleSaveView = () => {
    localStorage.setItem('staffServiceSavedView', JSON.stringify({
      status: statusFilter, staff: staffFilter, expiry: expiryFilter,
      date: dateFilter, service: serviceFilter, subcategory: subcategoryFilter
    }));
    toast.success('Your custom view has been saved!');
  };

  const handleClearFilters = () => {
    setStatusFilter('all'); setStaffFilter('all'); setExpiryFilter('all');
    setSearchTerm(''); setAadhaarSearch(''); setDateFilter('');
    setServiceFilter('all'); setSubcategoryFilter('all'); setTimeRange('month');
  };

  const [activeTab, setActiveTab] = useState('overview');
  const [trackingFormData, setTrackingFormData] = useState({
    applicationNumber: '', currentStep: '', estimatedDelivery: '', averageTime: '',
    notes: '', assignedTo: '', aadhaar: '', email: '', priority: 'medium'
  });
  
  const [viewMode, setViewMode] = useState('grid');

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const limit = 50;

  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [debouncedAadhaar, setDebouncedAadhaar] = useState('');

  const [globalStats, setGlobalStats] = useState({ total: 0, completed: 0, in_progress: 0, delayed: 0, pending: 0, sla_compliance: 100 });

  useEffect(() => { const t = setTimeout(() => setDebouncedSearch(searchTerm), 500); return () => clearTimeout(t); }, [searchTerm]);
  useEffect(() => { const t = setTimeout(() => setDebouncedAadhaar(aadhaarSearch), 500); return () => clearTimeout(t); }, [aadhaarSearch]);
  useEffect(() => { setCurrentPage(1); }, [debouncedSearch, debouncedAadhaar, statusFilter, staffFilter, expiryFilter, timeRange, dateFilter, serviceFilter, subcategoryFilter]);

  const statusMap = {
    'pending': 'Pending', 'in_progress': 'In Progress', 'completed': 'Completed',
    'rejected': 'Delayed', 'resubmit': 'Resubmit', 'paid': 'Paid'
  };
  const reverseStatusMap = {
    'Pending': 'pending', 'In Progress': 'in_progress', 'Completed': 'completed',
    'Delayed': 'rejected', 'Resubmit': 'resubmit', 'Paid': 'paid'
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
    { value: 'low', label: 'Low' }, { value: 'medium', label: 'Medium' }, { value: 'high', label: 'High' }
  ];

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
    } catch (error) { return ''; }
  };

  const transformBackendData = async (trackingData) => trackingData.map((trackingEntry) => {
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

    const createdDate = new Date(trackingEntry.created_at || trackingEntry.updated_at || Date.now());
    const dateStr = createdDate.toISOString().split('T')[0];
    const updatedDate = new Date(trackingEntry.updated_at || Date.now());
    const timeStr = updatedDate.toTimeString().split(' ')[0].substring(0, 5);

    const calculatedProgress = trackingEntry.progress || calculateProgress(
      statusMap[trackingEntry.status] || 'Pending', trackingEntry.current_step || 'Submitted'
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
      date: dateStr,
      time: timeStr,
      estimatedDelivery: trackingEntry.estimated_delivery && !isNaN(new Date(trackingEntry.estimated_delivery)) ? formatDate(trackingEntry.estimated_delivery) : 'Not set',
      expiryDate: trackingEntry.expiry_date && !isNaN(new Date(trackingEntry.expiry_date)) ? new Date(trackingEntry.expiry_date).toISOString() : 'N/A',
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
        id: step.id, name: step.name, completed: step.completed, date: step.date,
        created_at: step.created_at, step_order: step.step_order, estimated_days: step.estimated_days
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

  const fetchStats = async () => {
    const apiStatus = reverseStatusMap[statusFilter] || statusFilter;
    const data = await getTrackingStats({
      timeRange: timeRange === 'all' ? undefined : timeRange,
      date: dateFilter || undefined,
      service: serviceFilter === 'all' ? undefined : serviceFilter,
      subcategory: subcategoryFilter === 'all' ? undefined : subcategoryFilter,
      status: statusFilter === 'all' ? undefined : apiStatus,
      staff: staffFilter === 'all' ? undefined : staffFilter,
    });
    setGlobalStats(data);
  };

  const fetchActivityHistory = async (trackingId) => {
    if (!trackingId) { setActivityHistory([]); return; }
    try {
      setActivityLoading(true);
      const response = await getTrackingActivity(trackingId);
      setActivityHistory(Array.isArray(response?.activities) ? response.activities : []);
    } catch (error) { console.error(error); setActivityHistory([]); }
    finally { setActivityLoading(false); }
  };

  const fetchDocuments = async (trackingId) => {
    if (!trackingId) { setDocuments([]); return; }
    try {
      setDocumentsLoading(true);
      const data = await getTrackingDocuments(trackingId);
      setDocuments(Array.isArray(data) ? data : []);
    } catch (error) { console.error(error); setDocuments([]); }
    finally { setDocumentsLoading(false); }
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
      console.error(error);
      toast.error('Failed to upload document: ' + (error.response?.data?.error || error.message));
    } finally { setUploadingDocument(false); }
  };

  const handleToggleDocumentVisibility = async (trackingId, docId, visible) => {
    try {
      await toggleTrackingDocumentVisibility(trackingId, docId, visible);
      await fetchDocuments(trackingId);
      toast.success(visible ? 'Document is now visible to the customer' : 'Document hidden from the customer');
    } catch (error) { console.error(error); toast.error('Failed to update document visibility'); }
  };

  const handleUpdateDocumentRemark = async (trackingId, docId, remark) => {
    try {
      await updateTrackingDocumentRemark(trackingId, docId, remark);
      await fetchDocuments(trackingId);
      toast.success('Remark saved');
    } catch (error) { console.error(error); toast.error('Failed to save remark'); }
  };

  const handleDeleteDocument = async (trackingId, docId) => {
    try {
      await deleteTrackingDocument(trackingId, docId);
      await fetchDocuments(trackingId);
      toast.success('Document deleted');
    } catch (error) { console.error(error); toast.error('Failed to delete document'); }
  };

  const fetchSingleTrackingEntry = async (entryId) => {
    try {
      const [response, staffResponse] = await Promise.all([getTrackingEntryById(entryId), getStaff()]);
      const staffData = Array.isArray(staffResponse) ? staffResponse : Array.isArray(staffResponse?.data) ? staffResponse.data : [];
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
        if (assignedStaff) setSelectedService(prev => ({ ...prev, assignedTo: assignedStaff.name, assignedToId: assignedStaff.id }));
      }
    } catch (error) {
      console.error(error); toast.error('Failed to load the specific application');
      await fetchAllTrackingEntries();
    }
  };

  const fetchAllTrackingEntries = async () => {
    try {
      const apiStatus = reverseStatusMap[statusFilter] || statusFilter;
      const params = {
        page: currentPage, limit: limit,
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
        getTrackingEntries(params), getStaff(), getCategories()
      ]);
      if (trackingResponse && trackingResponse.pagination) {
        setTotalRecords(trackingResponse.pagination.totalRecords);
        setTotalPages(trackingResponse.pagination.totalPages);
      }
      const trackingData = Array.isArray(trackingResponse?.data) ? trackingResponse.data : Array.isArray(trackingResponse) ? trackingResponse : [];
      const staffData = Array.isArray(staffResponse?.data) ? staffResponse.data : Array.isArray(staffResponse) ? staffResponse : [];
      const categoriesData = Array.isArray(categoriesResponse?.data) ? categoriesResponse.data : Array.isArray(categoriesResponse) ? categoriesResponse : [];
      setStaffList(staffData); setCategories(categoriesData);
      let transformedServices = await transformBackendData(trackingData);
      if (serviceFilter !== 'all') transformedServices = transformedServices.filter(s => String(s.categoryId) === String(serviceFilter));
      if (subcategoryFilter !== 'all') transformedServices = transformedServices.filter(s => String(s.subcategoryId) === String(subcategoryFilter));
      setServices(transformedServices);
    } catch (error) {
      console.error(error); toast.error('Failed to fetch data');
      setStaffList([]); setCategories([]);
    }
  };

  useEffect(() => {
    const loadInitialData = async () => {
      setLoading(true);
      try {
        if (id) await fetchSingleTrackingEntry(id);
        else await Promise.all([fetchAllTrackingEntries(), fetchStats()]);
      } catch (error) { console.error(error); }
      finally { setLoading(false); }
    };
    loadInitialData();
  }, []);

  useEffect(() => {
    if (id) return;
    const reloadFilteredData = async () => {
      try { await Promise.all([fetchAllTrackingEntries(), fetchStats()]); }
      catch (error) { console.error(error); }
    };
    reloadFilteredData();
  }, [currentPage, debouncedSearch, debouncedAadhaar, statusFilter, staffFilter, expiryFilter, timeRange, dateFilter, serviceFilter, subcategoryFilter]);

  const handleUpdateStatus = async (serviceId, newStatus) => {
    try {
      const apiStatus = reverseStatusMap[newStatus] || newStatus;
      const service = services.find(s => s.id === serviceId);
      const newProgress = calculateProgress(newStatus, service.currentStep);
      if (service) { service.status = newStatus; service.progress = newProgress; }
      setServices(prev => prev.map(s => s.id === serviceId ? { ...s, status: newStatus, progress: newProgress } : s));
      if (selectedService?.id === serviceId) setSelectedService(prev => ({ ...prev, status: newStatus, progress: newProgress }));
      await updateTrackingStatus(serviceId, apiStatus);
      await fetchActivityHistory(serviceId);
      toast.success(`Status updated to ${newStatus}`);
    } catch (error) {
      console.error(error); toast.error('Failed to update status: ' + (error.response?.data?.error || error.message));
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
      const stepOrderMap = { 'Submitted': 1, 'Initial Review': 2, 'Document Verification': 3, 'Final Approval': 4 };
      if (updates.currentStep !== undefined && service.currentStep !== updates.currentStep) {
        const targetOrder = stepOrderMap[updates.currentStep] || 1;
        const nowIso = new Date().toISOString();
        if (service.steps && service.steps.length > 0) {
          updates.steps = service.steps.map(step => {
            const currentOrder = stepOrderMap[step.name] || step.step_order || 1;
            if (currentOrder <= targetOrder) {
              return { ...step, completed: true, date: (currentOrder === targetOrder) ? nowIso : (step.date || service.createdAt) };
            }
            return { ...step, completed: false };
          });
        }
        updates.updatedAt = nowIso;
      }
      Object.assign(service, updates);
      if (updates.applicationNumber !== undefined) service.applicationNumber = updates.applicationNumber;
      if (updates.currentStep !== undefined) service.currentStep = updates.currentStep;
      setServices(prev => prev.map(s => {
        if (s.id === service.id) {
          return {
            ...s, ...updates,
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
        setSelectedService(prev => ({ ...prev, ...updates, steps: updates.steps || prev.steps, updatedAt: updates.updatedAt || prev.updatedAt, progress: payload.progress }));
        setTrackingFormData(prev => ({ ...prev, ...updates }));
      }
      await updateTrackingEntry(service.id, payload);
      await fetchActivityHistory(service.id);
      toast.success('Details updated successfully');
    } catch (error) { console.error(error); toast.error('Failed to update tracking details'); }
  };

  const handleNotifyCustomer = async (service) => {
    try {
      await notifyCustomer(service.id, `Dear ${service.customerName}, your ${service.serviceType} application (App No: ${service.applicationNumber || 'N/A'}) is now ${service.status}.`);
      toast.success(`Notification sent to ${service.customerName} via WhatsApp`);
    } catch (error) {
      console.error(error); toast.error('Failed to send notification: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleTrackingFormChange = (e) => {
    const { name, value } = e.target;
    setTrackingFormData({ ...trackingFormData, [name]: value });
  };

  const handleTrackingFormSubmit = async (e) => {
    e.preventDefault();
    try {
      if (trackingFormData.applicationNumber && trackingFormData.applicationNumber.length > 50) throw new Error('Application number must be 50 characters or less');
      if (trackingFormData.aadhaar && !/^\d{12}$/.test(trackingFormData.aadhaar)) throw new Error('Aadhaar number must be exactly 12 digits');
      if (trackingFormData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trackingFormData.email)) throw new Error('Please enter a valid email address');
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
      const stepOrderMap = { 'Submitted': 1, 'Initial Review': 2, 'Document Verification': 3, 'Final Approval': 4 };
      const targetOrder = stepOrderMap[trackingFormData.currentStep] || 1;
      const nowIso = new Date().toISOString();
      let updatedSteps = selectedService.steps;
      if (updatedSteps && updatedSteps.length > 0 && selectedService.currentStep !== trackingFormData.currentStep) {
        updatedSteps = updatedSteps.map(step => {
          const currentOrder = stepOrderMap[step.name] || step.step_order || 1;
          if (currentOrder <= targetOrder) return { ...step, completed: true, date: (currentOrder === targetOrder) ? nowIso : (step.date || selectedService.createdAt) };
          return { ...step, completed: false };
        });
      }
      await updateTrackingEntry(selectedService.id, payload);
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
      setSelectedService({ ...selectedService, applicationNumber: trackingFormData.applicationNumber || `APP${selectedService.serviceEntryId}`, currentStep: trackingFormData.currentStep || 'Submitted', estimatedDelivery: formatDate(trackingFormData.estimatedDelivery), averageTime: trackingFormData.averageTime || '7 days', notes: trackingFormData.notes || '', assignedTo: staffList.find(staff => staff.id === parseInt(trackingFormData.assignedTo))?.name || trackingFormData.assignedTo || 'Unassigned', assignedToId: trackingFormData.assignedTo, aadhaar: trackingFormData.aadhaar || '', email: trackingFormData.email || '', priority: trackingFormData.priority || 'medium', progress: newProgress, rawEstimatedDelivery: trackingFormData.estimatedDelivery, steps: updatedSteps, updatedAt: (selectedService.currentStep !== trackingFormData.currentStep) ? nowIso : selectedService.updatedAt });
      setActiveTab('overview');
    } catch (error) {
      console.error(error); toast.error('Failed to update tracking details: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleServiceSelect = async (service) => {
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
  };

  const handleCloseDrawer = () => {
    setSelectedService(null);
    if (id) navigate('/dashboard/staff/track_service', { replace: true });
  };

  const fetchAllFilteredDataForExport = async () => {
    const apiStatus = reverseStatusMap[statusFilter] || statusFilter;
    const params = {
      page: 1, limit: totalRecords > 0 ? totalRecords : 10000,
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
      const trackingData = Array.isArray(trackingResponse?.data) ? trackingResponse.data : Array.isArray(trackingResponse) ? trackingResponse : [];
      let transformedData = await transformBackendData(trackingData);
      if (serviceFilter !== 'all') transformedData = transformedData.filter(s => String(s.categoryId) === String(serviceFilter));
      if (subcategoryFilter !== 'all') transformedData = transformedData.filter(s => String(s.subcategoryId) === String(subcategoryFilter));
      return transformedData;
    } catch (error) { console.error(error); throw new Error('Failed to fetch complete dataset'); }
  };

  const handleExportExcel = async () => {
    try {
      if (totalRecords === 0) { toast.info("No data to export"); return; }
      toast.info("Preparing Excel file...", { autoClose: 2000 });
      const fullDataset = await fetchAllFilteredDataForExport();
      const exportData = fullDataset.map(s => ({
        'Application No': s.applicationNumber || 'N/A', 'Customer Name': s.customerName || 'Unknown',
        'Phone': s.phone || 'N/A', 'Email': s.email || 'N/A', 'Service Type': s.serviceType || 'Unknown',
        'Subcategory': s.subcategoryName || 'N/A', 'Status': s.status || 'Pending',
        'Current Step': s.currentStep || 'Submitted', 'Priority': s.priority || 'Medium',
        'Assigned To': s.assignedTo || 'Unassigned', 'Created Date': s.date || 'N/A',
        'Estimated Delivery': s.estimatedDelivery || 'Not set', 'Service Charge': s.serviceCharge || 0,
        'Department Charge': s.departmentCharge || 0, 'Total Charge': s.totalCharge || 0,
        'Payment Status': s.paymentStatus || 'Pending'
      }));
      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Tracked Services");
      XLSX.writeFile(workbook, `Service_Tracking_${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.success("Excel exported successfully!");
    } catch (error) { console.error(error); toast.error("Failed to export Excel."); }
  };

  const handleExportPDF = async () => {
    try {
      if (totalRecords === 0) { toast.info("No data to export"); return; }
      toast.info("Generating PDF...", { autoClose: 2000 });
      const fullDataset = await fetchAllFilteredDataForExport();
      const doc = new jsPDF('landscape');
      doc.setFontSize(16); doc.text("Service Tracking Report", 14, 15);
      doc.setFontSize(10); doc.setTextColor(100);
      doc.text(`Generated on: ${new Date().toLocaleDateString()} | Total Records: ${fullDataset.length}`, 14, 22);
      const tableColumn = ["App No", "Customer Name", "Phone", "Service", "Status", "Step", "Assigned To", "Total"];
      const tableRows = fullDataset.map(s => [s.applicationNumber || 'N/A', s.customerName || 'Unknown', s.phone || 'N/A', s.serviceType || 'Unknown', s.status || 'Pending', s.currentStep || 'Submitted', s.assignedTo || 'Unassigned', `Rs ${s.totalCharge || 0}`]);
      autoTable(doc, { head: [tableColumn], body: tableRows, startY: 28, styles: { fontSize: 8 }, headStyles: { fillColor: [79, 70, 229] }, alternateRowStyles: { fillColor: [249, 250, 251] } });
      doc.save(`Service_Tracking_${new Date().toISOString().split('T')[0]}.pdf`);
      toast.success("PDF exported successfully!");
    } catch (error) { console.error(error); toast.error("Failed to export PDF."); }
  };

  const handleBackToList = () => navigate('/dashboard/staff/track_service');

  const servicesByDate = services.reduce((groups, service) => {
    const dateKey = service.date || 'Unknown Date';
    if (!groups[dateKey]) groups[dateKey] = [];
    groups[dateKey].push(service);
    return groups;
  }, {});

  const activeFilterCount = [staffFilter, expiryFilter, serviceFilter, subcategoryFilter].filter(f => f !== 'all').length
    + (dateFilter ? 1 : 0) + (aadhaarSearch ? 1 : 0);

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

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gray-50">

        {/* ================= HEADER ================= */}
        <header className="bg-white border-b border-gray-200">
          <div className="max-w-[1600px] mx-auto px-6 py-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                  <FiTarget className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-gray-900">Service Management</h1>
                  <p className="text-gray-500 text-xs mt-0.5">Track, edit and manage service applications</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {id && (
                  <button onClick={handleBackToList}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors">
                    <FiArrowLeft className="h-4 w-4" />
                    <span className="hidden sm:inline">Back</span>
                  </button>
                )}
                <button onClick={handleExportExcel}
                  className="hidden md:flex items-center gap-1.5 px-3.5 py-2 bg-white border border-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors">
                  <FiDownload className="h-4 w-4" />
                  <span>Export</span>
                </button>
                <button onClick={() => window.location.reload()}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors shadow-sm">
                  <FiRefreshCw className="h-4 w-4" />
                  <span className="hidden sm:inline">Refresh</span>
                </button>
              </div>
            </div>
          </div>
        </header>

        <div className="max-w-[1600px] mx-auto px-6 py-6 space-y-5">

          {/* ================= KPI STRIP ================= */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiTile label="Total Services" value={globalStats.total || 0} trend={12} icon={FiBarChart2} tint="blue" sub="In selected period" />
            <KpiTile label="In Progress" value={globalStats.in_progress || 0} trend={8} icon={FiTrendingUp} tint="amber" sub="Active right now" />
            <KpiTile label="Completed" value={globalStats.completed || 0} trend={15} icon={FiCheckCircle} tint="emerald" sub="Successfully closed" />
            <KpiTile label="SLA Compliance" value={`${Math.round(globalStats.sla_compliance || 100)}%`} trend={2} icon={FiAward} tint="purple" sub="On-time delivery" />
          </div>

          {/* ================= FILTER BAR ================= */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
            <div className="p-4 flex flex-col lg:flex-row lg:items-center gap-3">
              <div className="relative flex-1 min-w-0">
                <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by name, phone, application no, Aadhaar or service..."
                  className="w-full pl-10 pr-10 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 focus:bg-white transition-all"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                {searchTerm && (
                  <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    <FiX className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide">
                <FilterChip active={statusFilter === 'all'} onClick={() => setStatusFilter('all')}>All</FilterChip>
                <FilterChip active={statusFilter === 'Pending'} onClick={() => setStatusFilter('Pending')} dot="bg-amber-500">Pending</FilterChip>
                <FilterChip active={statusFilter === 'In Progress'} onClick={() => setStatusFilter('In Progress')} dot="bg-blue-500">Active</FilterChip>
                <FilterChip active={statusFilter === 'Completed'} onClick={() => setStatusFilter('Completed')} dot="bg-emerald-500">Done</FilterChip>
                <FilterChip active={statusFilter === 'Delayed'} onClick={() => setStatusFilter('Delayed')} dot="bg-rose-500">Delayed</FilterChip>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
                  <button onClick={() => setViewMode('grid')}
                    className={`p-1.5 rounded-md transition-colors ${viewMode === 'grid' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
                    title="Table view">
                    <FiGrid className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => setViewMode('list')}
                    className={`p-1.5 rounded-md transition-colors ${viewMode === 'list' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
                    title="Card view">
                    <FiList className="h-3.5 w-3.5" />
                  </button>
                </div>

                <button onClick={handleSaveView}
                  className="hidden sm:flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors">
                  <FiSave className="h-3.5 w-3.5" />
                  Save View
                </button>

                <button onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                  className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg transition-colors ${
                    showAdvancedFilters ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}>
                  <FiSliders className="h-3.5 w-3.5" />
                  Filters
                  {activeFilterCount > 0 && (
                    <span className={`ml-0.5 px-1.5 py-0.5 text-[10px] font-bold rounded-full ${
                      showAdvancedFilters ? 'bg-white text-indigo-600' : 'bg-indigo-600 text-white'
                    }`}>{activeFilterCount}</span>
                  )}
                </button>
              </div>
            </div>

            <AnimatePresence>
              {showAdvancedFilters && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden border-t border-gray-100">
                  <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                    <FilterField label="Data Range">
                      <select className="filter-input" value={timeRange} onChange={(e) => setTimeRange(e.target.value)}>
                        <option value="week">Last 7 Days</option>
                        <option value="month">This Month</option>
                        <option value="year">This Year</option>
                        <option value="all">All Time</option>
                      </select>
                    </FilterField>
                    <FilterField label="Specific Date">
                      <input type="date" className="filter-input" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} />
                    </FilterField>
                    <FilterField label="Service Category">
                      <select className="filter-input" value={serviceFilter} onChange={(e) => setServiceFilter(e.target.value)}>
                        <option value="all">All Services</option>
                        {categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}
                      </select>
                    </FilterField>
                    <FilterField label="Subcategory">
                      <select className={`filter-input ${serviceFilter === 'all' ? 'opacity-50 cursor-not-allowed' : ''}`}
                        value={subcategoryFilter} onChange={(e) => setSubcategoryFilter(e.target.value)} disabled={serviceFilter === 'all'}>
                        <option value="all">{serviceFilter === 'all' ? 'Select a Service first' : 'All Subcategories'}</option>
                        {availableSubcategories.map(sub => <option key={sub.id} value={sub.id}>{sub.name}</option>)}
                      </select>
                    </FilterField>
                    <FilterField label="Assigned Staff">
                      <select className="filter-input" value={staffFilter} onChange={(e) => setStaffFilter(e.target.value)}>
                        <option value="all">Everyone</option>
                        {staffList.map(staff => <option key={staff.id} value={staff.id}>{staff.name}</option>)}
                      </select>
                    </FilterField>
                    <FilterField label="Timeline">
                      <select className="filter-input" value={expiryFilter} onChange={(e) => setExpiryFilter(e.target.value)}>
                        <option value="all">Any Date</option>
                        <option value="upcoming">Upcoming Expiry</option>
                        <option value="overdue">Overdue</option>
                      </select>
                    </FilterField>
                    <FilterField label="Aadhaar Search">
                      <input type="text" placeholder="12-digit Aadhaar" className="filter-input" value={aadhaarSearch} onChange={(e) => setAadhaarSearch(e.target.value)} maxLength="12" />
                    </FilterField>
                    <div className="flex items-end">
                      <button onClick={handleClearFilters}
                        className="w-full py-2.5 text-xs font-semibold text-gray-600 border border-gray-200 hover:bg-gray-50 hover:text-gray-900 rounded-lg transition-all">
                        Clear All Filters
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ================= RESULTS HEADER ================= */}
          <div className="flex items-center justify-between px-1">
            <p className="text-xs text-gray-500">
              Showing <span className="font-semibold text-gray-800">{services.length}</span> of <span className="font-semibold text-gray-800">{totalRecords}</span> services
            </p>
            <p className="text-[11px] text-gray-400 hidden sm:block">
              Click any row to open details · Page {currentPage} of {totalPages}
            </p>
          </div>

          {/* ================= TABLE / CARD VIEW ================= */}
          {viewMode === 'grid' ? (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50/70 border-b border-gray-200 text-[10px] text-gray-500 uppercase tracking-wider">
                      <th className="px-4 py-3 font-semibold">Customer</th>
                      <th className="px-4 py-3 font-semibold">Service</th>
                      <th className="px-4 py-3 font-semibold w-[200px]">Application</th>
                      <th className="px-4 py-3 font-semibold w-[160px]">Status</th>
                      <th className="px-4 py-3 font-semibold w-[190px]">Assigned</th>
                      <th className="px-4 py-3 font-semibold w-[120px] text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(servicesByDate).map(([date, dateServices]) => (
                      <React.Fragment key={date}>
                        <tr className="bg-gray-50/50 border-y border-gray-100">
                          <td colSpan="6" className="px-4 py-2">
                            <div className="flex items-center gap-2">
                              <FiCalendar className="h-3.5 w-3.5 text-indigo-500" />
                              <span className="text-[11px] font-bold text-gray-700 uppercase tracking-wider">
                                {date === 'Unknown Date' ? date : formatDate(date)}
                              </span>
                              <span className="bg-gray-200 text-gray-600 py-0.5 px-2 rounded-full text-[10px] font-semibold">
                                {dateServices.length}
                              </span>
                            </div>
                          </td>
                        </tr>

                        {dateServices.map(service => (
                          <tr
                            key={service.id}
                            onClick={() => handleServiceSelect(service)}
                            className={`cursor-pointer group border-b border-gray-100 transition-colors ${
                              selectedService?.id === service.id ? 'bg-indigo-50/50' : 'hover:bg-gray-50'
                            }`}>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                <div className="relative flex-shrink-0">
                                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-sm">
                                    <span className="text-white text-xs font-bold">
                                      {(service.customerName || 'U').charAt(0).toUpperCase()}
                                    </span>
                                  </div>
                                  <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white ${statusConfig[service.status]?.dot || 'bg-gray-400'}`}></span>
                                </div>
                                <div className="min-w-0">
                                  <div className="text-sm font-semibold text-gray-900 truncate max-w-[180px]">{service.customerName}</div>
                                  <div className="flex items-center gap-1.5 text-[11px] text-gray-500 mt-0.5">
                                    <FiPhone className="h-3 w-3" />
                                    <span className="truncate">{service.phone || 'N/A'}</span>
                                  </div>
                                </div>
                              </div>
                            </td>

                            <td className="px-4 py-3">
                              <div className="text-sm font-medium text-gray-900 truncate max-w-[180px]">{service.serviceType}</div>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="text-[11px] text-gray-500 truncate max-w-[100px]">{service.subcategoryName || '-'}</span>
                                {service.workSource === 'online' ? (
                                  <span className="text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 bg-green-100 text-green-700 rounded">Online</span>
                                ) : (
                                  <span className="text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded">Walk-in</span>
                                )}
                              </div>
                            </td>

                            <td className="px-4 py-3">
                              <div className="text-xs font-mono font-medium text-gray-800 truncate">{service.applicationNumber}</div>
                              <div className="text-[10px] text-gray-400 font-mono mt-0.5">{service.trackingId}</div>
                            </td>

                            <td className="px-4 py-3">
                              <div className="flex flex-col gap-1">
                                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold w-fit ${statusConfig[service.status]?.bg} ${statusConfig[service.status]?.color} border ${statusConfig[service.status]?.border}`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${statusConfig[service.status]?.dot}`}></span>
                                  {service.status}
                                </span>
                                <span className="text-[10px] text-gray-500 truncate">{service.currentStep}</span>
                              </div>
                            </td>

                            <td className="px-4 py-3">
                              <div className="flex flex-col gap-1">
                                <span className="text-xs font-medium text-gray-700 truncate">{service.assignedTo}</span>
                                <span className="text-[10px] text-gray-500">
                                  {service.estimatedDelivery === 'Not set' ? 'No delivery set' : `Est. ${service.estimatedDelivery}`}
                                </span>
                              </div>
                            </td>

                            <td className="px-4 py-3">
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleNotifyCustomer(service); }}
                                  title="Notify customer"
                                  className="p-1.5 rounded-lg text-gray-400 hover:text-green-600 hover:bg-green-50 transition-colors">
                                  <FiMessageSquare className="h-3.5 w-3.5" />
                                </button>
                                <div className={`p-1.5 rounded-lg transition-colors ${
                                  selectedService?.id === service.id
                                    ? 'bg-indigo-100 text-indigo-700'
                                    : 'text-gray-400 group-hover:text-indigo-600 group-hover:bg-indigo-50'
                                }`}>
                                  <FiChevronRight className="h-4 w-4" />
                                </div>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </React.Fragment>
                    ))}

                    {services.length === 0 && (
                      <tr>
                        <td colSpan="6" className="text-center py-16 text-gray-500">
                          <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                            <FiInbox className="h-6 w-6 text-gray-400" />
                          </div>
                          <p className="text-base font-semibold text-gray-900">No services found</p>
                          <p className="text-sm mt-1 text-gray-500">Try adjusting your filters or search terms</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
                  <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
                    className="px-3.5 py-1.5 text-xs font-semibold text-gray-700 bg-white rounded-lg border border-gray-200 hover:bg-gray-50 hover:text-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm">
                    ← Previous
                  </button>
                  <div className="text-xs text-gray-600 font-medium">
                    Page <span className="font-bold text-gray-900">{currentPage}</span> of {totalPages}
                  </div>
                  <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
                    className="px-3.5 py-1.5 text-xs font-semibold text-gray-700 bg-white rounded-lg border border-gray-200 hover:bg-gray-50 hover:text-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm">
                    Next →
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {services.map(service => (
                <ServiceCard key={service.id} service={service}
                  isSelected={selectedService?.id === service.id}
                  onClick={() => handleServiceSelect(service)}
                  statusConfig={statusConfig}
                  priorityConfig={priorityConfig} />
              ))}
              {services.length === 0 && (
                <div className="col-span-full bg-white rounded-xl border border-gray-200 text-center py-16">
                  <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                    <FiInbox className="h-6 w-6 text-gray-400" />
                  </div>
                  <p className="text-base font-semibold text-gray-900">No services found</p>
                  <p className="text-sm mt-1 text-gray-500">Try adjusting your filters or search terms</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ================= SLIDE-OVER DRAWER ================= */}
        <AnimatePresence>
          {selectedService && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                onClick={handleCloseDrawer}
                className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm z-40"
              />
              <motion.aside
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'tween', duration: 0.25, ease: 'easeOut' }}
                className="fixed top-0 right-0 h-full w-full sm:w-[640px] lg:w-[720px] bg-white shadow-2xl z-50 flex flex-col">

                {/* Drawer header */}
                <div className="flex items-start justify-between gap-3 p-5 border-b border-gray-200 bg-gradient-to-br from-indigo-600 to-purple-600 text-white">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center flex-shrink-0 border border-white/20">
                      <span className="text-white text-lg font-bold">
                        {(selectedService.customerName || 'U').charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-lg font-bold truncate">{selectedService.customerName}</h2>
                      <div className="flex items-center gap-3 text-xs text-white/80 mt-1 flex-wrap">
                        <span className="flex items-center gap-1"><FiPhone className="h-3 w-3" />{selectedService.phone}</span>
                        {selectedService.email && <span className="hidden sm:flex items-center gap-1"><FiMail className="h-3 w-3" />{selectedService.email}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button onClick={() => handleNotifyCustomer(selectedService)}
                      className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-white/15 hover:bg-white/25 backdrop-blur text-xs font-semibold rounded-lg border border-white/20 transition-colors">
                      <FiMessageSquare className="h-3.5 w-3.5" /> Notify
                    </button>
                    <button onClick={() => navigate(`/dashboard/staff/service-workspace/${selectedService.id}`)}
                      className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-white/15 hover:bg-white/25 backdrop-blur text-xs font-semibold rounded-lg border border-white/20 transition-colors">
                      <FiGrid className="h-3.5 w-3.5" /> Workspace
                    </button>
                    <button onClick={handleCloseDrawer}
                      className="p-2 rounded-lg hover:bg-white/15 transition-colors">
                      <FiX className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Quick info strip */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-0 border-b border-gray-100 bg-gray-50">
                  <QuickStat label="App No" value={selectedService.applicationNumber || 'N/A'} />
                  <QuickStat label="Step" value={selectedService.currentStep || 'N/A'} />
                  <QuickStat label="Delivery" value={selectedService.estimatedDelivery || 'Not set'} />
                  <QuickStat label="Assigned" value={selectedService.assignedTo || 'Unassigned'} />
                </div>

                {/* Tabs */}
                <div className="border-b border-gray-200 bg-gray-50/50 overflow-x-auto scrollbar-hide">
                  <nav className="flex -mb-px px-2">
                    {[
                      { id: 'overview', label: 'Overview', icon: FiLayers },
                      { id: 'tracking', label: 'Edit', icon: FiEdit },
                      { id: 'documents', label: 'Documents', icon: FiPaperclip },
                      { id: 'history', label: 'History', icon: FiClock },
                      { id: 'discussion', label: 'Discussion', icon: FiMessageCircle }
                    ].map(tab => {
                      const Icon = tab.icon;
                      const isActive = activeTab === tab.id;
                      return (
                        <button key={tab.id}
                          onClick={() => setActiveTab(tab.id)}
                          className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
                            isActive
                              ? 'border-indigo-500 text-indigo-600 bg-white'
                              : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-white/50'
                          }`}>
                          <Icon className="h-3.5 w-3.5" />
                          {tab.label}
                        </button>
                      );
                    })}
                  </nav>
                </div>

                {/* Drawer body */}
                <div className="flex-1 overflow-y-auto bg-gray-50/40">
                  <div className="p-5">
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={activeTab}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.15 }}>
                        {activeTab === 'overview' && (
                          <OverviewView
                            service={selectedService}
                            onUpdateStatus={handleUpdateStatus}
                            statusConfig={statusConfig}
                            priorityConfig={priorityConfig}
                            paymentStatusConfig={paymentStatusConfig}
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
                            documents={documents}
                            documentsLoading={documentsLoading}
                            uploadingDocument={uploadingDocument}
                            onUpload={(file, label, visible, remark) => handleUploadDocument(selectedService.id, file, label, visible, remark)}
                            onUpdateRemark={(docId, remark) => handleUpdateDocumentRemark(selectedService.id, docId, remark)}
                            onToggleVisibility={(docId, visible) => handleToggleDocumentVisibility(selectedService.id, docId, visible)}
                            onDelete={(docId) => handleDeleteDocument(selectedService.id, docId)}
                          />
                        )}
                        {activeTab === 'history' && (
                          <HistoryView activityHistory={activityHistory} activityLoading={activityLoading} />
                        )}
                        {activeTab === 'discussion' && (
                          <div className="space-y-4">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center">
                                <FiMessageCircle className="h-4 w-4 text-indigo-600" />
                              </div>
                              <div>
                                <h3 className="font-semibold text-gray-900 text-sm">Internal Discussion & Tasks</h3>
                                <p className="text-xs text-gray-500">Tag staff with @ to assign them tasks</p>
                              </div>
                            </div>
                            <div className="bg-white rounded-xl p-3 border border-gray-200">
                              <NotesPanel contextType="service_entry" contextId={selectedService.serviceEntryId} embedded={true} showHeader={false} />
                            </div>
                          </div>
                        )}
                      </motion.div>
                    </AnimatePresence>
                  </div>
                </div>
              </motion.aside>
            </>
          )}
        </AnimatePresence>

        <style>{`
          .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
          .scrollbar-hide::-webkit-scrollbar { display: none; }
          .filter-input {
            width: 100%;
            padding: 0.625rem 0.75rem;
            font-size: 0.8125rem;
            background-color: #f9fafb;
            border: 1px solid #e5e7eb;
            border-radius: 0.5rem;
            outline: none;
            transition: all 0.15s ease;
          }
          .filter-input:focus {
            background-color: white;
            border-color: #6366f1;
            box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.15);
          }
        `}</style>
      </div>
    </ErrorBoundary>
  );
};

/* ============================================================
   NEW SUB-COMPONENTS
   ============================================================ */

const KpiTile = ({ label, value, trend, icon: Icon, tint, sub }) => {
  const tints = {
    blue: { grad: 'from-blue-500 to-blue-600', soft: 'bg-blue-50', fg: 'text-blue-600' },
    amber: { grad: 'from-amber-500 to-amber-600', soft: 'bg-amber-50', fg: 'text-amber-600' },
    emerald: { grad: 'from-emerald-500 to-emerald-600', soft: 'bg-emerald-50', fg: 'text-emerald-600' },
    purple: { grad: 'from-purple-500 to-purple-600', soft: 'bg-purple-50', fg: 'text-purple-600' }
  };
  const t = tints[tint] || tints.blue;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-all duration-300">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-gray-500 mb-1">{label}</p>
          <p className="text-2xl font-bold text-gray-900 leading-none">{value}</p>
          <div className="flex items-center gap-1.5 mt-2">
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
              trend > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
            }`}>
              {trend > 0 ? '↑' : '↓'} {Math.abs(trend)}%
            </span>
            <span className="text-[10px] text-gray-400 truncate">{sub}</span>
          </div>
        </div>
        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${t.grad} flex items-center justify-center shadow-sm flex-shrink-0`}>
          <Icon className="h-5 w-5 text-white" />
        </div>
      </div>
    </div>
  );
};

const FilterChip = ({ active, onClick, children, dot }) => (
  <button onClick={onClick}
    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-full border transition-all whitespace-nowrap flex-shrink-0 ${
      active
        ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
        : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300 hover:text-indigo-600'
    }`}>
    {dot && <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-white' : dot}`} />}
    {children}
  </button>
);

const FilterField = ({ label, children }) => (
  <div>
    <label className="block text-[10px] uppercase tracking-wider font-semibold text-gray-500 mb-1.5">{label}</label>
    {children}
  </div>
);

const QuickStat = ({ label, value }) => (
  <div className="px-4 py-3 border-r border-gray-100 last:border-r-0">
    <p className="text-[9px] uppercase tracking-wider font-semibold text-gray-400">{label}</p>
    <p className="text-xs font-bold text-gray-800 mt-0.5 truncate" title={value}>{value}</p>
  </div>
);

const ServiceCard = ({ service, isSelected, onClick, statusConfig, priorityConfig }) => {
  const config = statusConfig[service.status] || statusConfig['Pending'];
  const priority = priorityConfig[service.priority || 'medium'];

  return (
    <motion.div
      whileHover={{ y: -2 }}
      onClick={onClick}
      className={`bg-white rounded-xl border-2 p-4 cursor-pointer transition-all duration-200 ${
        isSelected ? 'border-indigo-500 shadow-md' : 'border-gray-200 hover:border-gray-300 hover:shadow-md'
      }`}>
      <div className="flex items-start gap-3 mb-3">
        <div className="relative flex-shrink-0">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
            <span className="text-white text-sm font-bold">{(service.customerName || 'U').charAt(0).toUpperCase()}</span>
          </div>
          <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${config.dot}`}></span>
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-gray-900 text-sm truncate">{service.customerName}</h3>
          <p className="text-xs text-gray-500 truncate">{service.phone}</p>
        </div>
        <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">
          {service.progress}%
        </span>
      </div>

      <p className="text-xs font-medium text-gray-800 truncate mb-1">{service.serviceType}</p>
      <p className="text-[11px] text-gray-500 truncate mb-3">{service.subcategoryName || 'N/A'}</p>

      <div className="flex items-center gap-1.5 mb-3 flex-wrap">
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${config.bg} ${config.color} border ${config.border}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`}></span>
          {service.status}
        </span>
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${priority.bg} ${priority.color} border ${priority.border}`}>
          <FiFlag className="h-2.5 w-2.5" />
          {priority.label}
        </span>
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-gray-100 text-[10px]">
        <span className="text-gray-500 font-mono truncate">{service.applicationNumber}</span>
        <span className={`px-1.5 py-0.5 rounded-full font-semibold ${
          service.workSource === 'online' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
        }`}>
          {service.workSource === 'online' ? 'Online' : 'Walk-in'}
        </span>
      </div>
    </motion.div>
  );
};

/* ============================================================
   OVERVIEW (drawer)
   ============================================================ */
const OverviewView = ({ service, onUpdateStatus, statusConfig, priorityConfig, paymentStatusConfig }) => {
  const getDisplaySteps = () => {
    if (service.steps && service.steps.length > 0) return service.steps.sort((a, b) => (a.step_order || 0) - (b.step_order || 0));
    const stepOrderMap = { 'Submitted': 1, 'Initial Review': 2, 'Document Verification': 3, 'Final Approval': 4 };
    const currentOrder = stepOrderMap[service.currentStep] || 1;
    return [
      { id: 1, name: 'Submitted', completed: true, step_order: 1, date: service.createdAt },
      { id: 2, name: 'Initial Review', completed: currentOrder >= 2, step_order: 2, date: currentOrder === 2 ? service.updatedAt : null },
      { id: 3, name: 'Document Verification', completed: currentOrder >= 3, step_order: 3, date: currentOrder === 3 ? service.updatedAt : null },
      { id: 4, name: 'Final Approval', completed: currentOrder >= 4, step_order: 4, date: currentOrder >= 4 ? service.updatedAt : null }
    ];
  };
  const displaySteps = getDisplaySteps();

  return (
    <div className="space-y-4">
      {/* Progress card */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-900 text-sm flex items-center gap-2">
            <FiZap className="h-4 w-4 text-indigo-600" />
            Service Progress
          </h3>
          <span className="text-lg font-bold text-indigo-600">{service.progress}%</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden mb-4">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${service.progress}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="bg-gradient-to-r from-indigo-500 to-purple-600 h-full rounded-full"
          />
        </div>

        <div className="grid grid-cols-2 gap-2 mb-4">
          {displaySteps.map((step) => {
            const isCompleted = step.completed;
            const isCurrent = step.name === service.currentStep;
            return (
              <div key={step.id}
                className={`px-3 py-2 rounded-lg border text-xs transition-all ${
                  isCompleted ? 'bg-emerald-50 border-emerald-200'
                  : isCurrent ? 'bg-indigo-50 border-indigo-200 ring-2 ring-indigo-500/10'
                  : 'bg-gray-50 border-gray-200'
                }`}>
                <div className="flex items-center gap-1.5 mb-0.5">
                  {isCompleted ? <FiCheckCircle className="h-3 w-3 text-emerald-600 flex-shrink-0" />
                    : isCurrent ? <div className="w-3 h-3 rounded-full border-2 border-indigo-500 flex items-center justify-center flex-shrink-0"><div className="w-1 h-1 rounded-full bg-indigo-500 animate-pulse" /></div>
                    : <div className="w-3 h-3 rounded-full border-2 border-gray-300 flex-shrink-0" />}
                  <span className={`font-semibold truncate ${
                    isCompleted ? 'text-emerald-800' : isCurrent ? 'text-indigo-800' : 'text-gray-500'
                  }`}>{step.name}</span>
                </div>
                <p className="text-[10px] text-gray-500 truncate pl-[18px]">
                  {step.completed ? (step.date ? formatTimelineDate(step.date) : 'Completed') : 'Pending'}
                </p>
              </div>
            );
          })}
        </div>

        <div>
          <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold mb-2">Update Status</p>
          <div className="flex items-center flex-wrap gap-1.5">
            {Object.keys(statusConfig).map(statusKey => {
              const isCurrent = service.status === statusKey;
              const c = statusConfig[statusKey];
              return (
                <button key={statusKey}
                  onClick={() => !isCurrent && onUpdateStatus(service.id, statusKey)}
                  disabled={isCurrent}
                  className={`px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                    isCurrent ? `${c.bg} ${c.color} ${c.border} cursor-default` : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}>
                  {isCurrent && <FiCheckCircle className="inline h-3 w-3 mr-1 -mt-0.5" />}
                  {statusKey}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Details + Financials grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 text-sm mb-4 flex items-center gap-2">
            <FiFileText className="h-4 w-4 text-indigo-600" />
            Service Details
          </h3>
          <div className="space-y-2.5">
            <DetailRow label="Service Type" value={service.serviceType} />
            <DetailRow label="Subcategory" value={service.subcategoryName} />
            <DetailRow label="Average Time" value={service.averageTime} />
            <DetailRow label="Expiry Date" value={service.expiryDate || 'N/A'} />
            <div className="flex items-center justify-between py-1">
              <span className="text-xs text-gray-500">Priority</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 border ${priorityConfig[service.priority]?.bg} ${priorityConfig[service.priority]?.border} ${priorityConfig[service.priority]?.color}`}>
                <FiFlag className="h-2.5 w-2.5" />
                {priorityConfig[service.priority]?.label}
              </span>
            </div>
            <DetailRow label="Last Updated" value={formatDate(service.updatedAt)} />
            <DetailRow label="Notes" value={service.notes} />
            <DetailRow label="Assigned To" value={service.assignedTo} />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 text-sm mb-4 flex items-center gap-2">
            <FiDollarSign className="h-4 w-4 text-emerald-600" />
            Financials
          </h3>
          <div className="space-y-2.5">
            <FinancialRow label="Service Charge" amount={service.serviceCharge} currency="₹" />
            <FinancialRow label="Department Charge" amount={service.departmentCharge} currency="₹" />
            <div className="border-t border-gray-200 pt-2.5">
              <FinancialRow label="Total Amount" amount={service.totalCharge} currency="₹" isTotal={true} />
            </div>
            <div className="flex items-center justify-between py-1">
              <span className="text-xs text-gray-500">Payment Status</span>
              <span className={`text-xs font-semibold ${paymentStatusConfig[service.paymentStatus]?.color || paymentStatusConfig['default'].color}`}>
                {service.paymentStatus}
              </span>
            </div>
            {service.paymentDetails && service.paymentDetails !== 'No payments recorded' && (
              <div className="bg-gray-50 rounded-lg p-3 mt-1">
                <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold mb-1">Payment Records</p>
                <p className="text-xs text-gray-700 leading-relaxed">{service.paymentDetails}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Customer review */}
      {service.serviceRating && (
        <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl border border-amber-200 p-5">
          <h3 className="font-semibold text-gray-900 text-sm mb-3 flex items-center gap-2">
            <FiStar className="h-4 w-4 text-amber-500" />
            Customer Review
          </h3>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-600 font-medium w-20">Service:</span>
              <div className="flex items-center gap-0.5">
                {[...Array(5)].map((_, i) => (
                  <span key={i} className={i < service.serviceRating ? 'text-yellow-400' : 'text-gray-300'}>★</span>
                ))}
                <span className="ml-1.5 text-xs text-gray-600">({service.serviceRating}/5)</span>
              </div>
            </div>
            {service.staffRating && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-600 font-medium w-20">Staff:</span>
                <div className="flex items-center gap-0.5">
                  {[...Array(5)].map((_, i) => (
                    <span key={i} className={i < service.staffRating ? 'text-yellow-400' : 'text-gray-300'}>★</span>
                  ))}
                  <span className="ml-1.5 text-xs text-gray-600">({service.staffRating}/5)</span>
                </div>
              </div>
            )}
            {service.reviewText && (
              <div>
                <p className="text-sm text-gray-700 bg-white p-3 rounded-lg border border-amber-200 italic">"{service.reviewText}"</p>
              </div>
            )}
            {service.reviewSubmittedAt && (
              <p className="text-[10px] text-gray-500">Submitted on {formatDate(service.reviewSubmittedAt)}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

/* ============================================================
   LEGACY SUB-COMPONENTS
   ============================================================ */

const FinancialRow = ({ label, amount, currency, isTotal = false }) => (
  <div className="flex justify-between items-center">
    <span className={`text-xs ${isTotal ? 'font-semibold text-gray-900' : 'text-gray-500'}`}>{label}</span>
    <span className={`font-mono ${isTotal ? 'text-base font-bold text-gray-900' : 'text-sm text-gray-800'}`}>
      {currency}{amount?.toFixed(2) || '0.00'}
    </span>
  </div>
);

const DetailRow = ({ label, value, valueClass = "" }) => (
  <div className="flex justify-between items-center py-1">
    <span className="text-xs text-gray-500 flex-shrink-0">{label}</span>
    <span className={`text-xs font-medium text-gray-800 ${valueClass} truncate ml-2 max-w-[60%] text-right`}>{value}</span>
  </div>
);

const FormField = ({ label, name, value, onChange, type = 'text', placeholder, maxLength }) => (
  <div>
    <label className="block text-xs font-semibold text-gray-700 mb-1.5">{label}</label>
    <input type={type} name={name} value={value} onChange={onChange} placeholder={placeholder} maxLength={maxLength}
      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all" />
  </div>
);

const FormSelect = ({ label, name, value, onChange, options, placeholder }) => (
  <div>
    <label className="block text-xs font-semibold text-gray-700 mb-1.5">{label}</label>
    <select name={name} value={value} onChange={onChange}
      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all">
      <option value="">{placeholder}</option>
      {options.map(option => (<option key={option.value} value={option.value}>{option.label}</option>))}
    </select>
  </div>
);

const FormTextarea = ({ label, name, value, onChange, placeholder, rows = 4 }) => (
  <div>
    <label className="block text-xs font-semibold text-gray-700 mb-1.5">{label}</label>
    <textarea name={name} value={value} onChange={onChange} placeholder={placeholder} rows={rows}
      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all resize-none" />
  </div>
);

const TrackingView = ({ service, formData, onFormChange, staffList, stepOptions, priorityOptions, onSave, onCancel }) => (
  <div className="space-y-5">
    <div className="flex items-center gap-2">
      <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center">
        <FiEdit className="h-4 w-4 text-indigo-600" />
      </div>
      <div>
        <h3 className="font-semibold text-gray-900 text-sm">Update Tracking Information</h3>
        <p className="text-xs text-gray-500">Edit the details below and save changes</p>
      </div>
    </div>
    <form onSubmit={onSave} className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField label="Application Number" name="applicationNumber" value={formData.applicationNumber} onChange={onFormChange} placeholder="Enter application number (optional)" />
        <FormSelect label="Current Step" name="currentStep" value={formData.currentStep} onChange={onFormChange} options={stepOptions} placeholder="Select current step" />
        <FormField label="Estimated Delivery" name="estimatedDelivery" type="date" value={formData.estimatedDelivery} onChange={onFormChange} />
        <FormSelect label="Priority" name="priority" value={formData.priority} onChange={onFormChange} options={priorityOptions} placeholder="Select priority" />
        <FormField label="Average Time" name="averageTime" value={formData.averageTime} onChange={onFormChange} placeholder="e.g., 7 days" />
        <FormSelect label="Assign To" name="assignedTo" value={formData.assignedTo} onChange={onFormChange} options={staffList.map(staff => ({ value: staff.id, label: staff.name }))} placeholder="Select staff member" />
        <FormField label="Aadhaar Number" name="aadhaar" value={formData.aadhaar} onChange={onFormChange} placeholder="12-digit Aadhaar" maxLength="12" />
        <FormField label="Email Address" name="email" type="email" value={formData.email} onChange={onFormChange} placeholder="customer@example.com" />
      </div>
      <FormTextarea label="Customer Remarks (Sent via WhatsApp)" name="notes" value={formData.notes} onChange={onFormChange} placeholder="Enter remarks visible to the customer..." rows={3} />
      <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
        <button type="button" onClick={onCancel}
          className="px-4 py-2 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors">
          Cancel
        </button>
        <button type="submit"
          className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 shadow-sm transition-colors">
          <FiSave className="h-3.5 w-3.5" />
          Save Changes
        </button>
      </div>
    </form>
  </div>
);

/* ============================================================
   DOCUMENTS VIEW
   ============================================================ */
const DocumentRemarkEditor = ({ doc, onSave }) => {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(doc.remark || '');
  const inputRef = useRef(null);

  useEffect(() => { setValue(doc.remark || ''); }, [doc.remark]);
  useEffect(() => { if (editing && inputRef.current) inputRef.current.focus(); }, [editing]);

  const commit = () => { if (value.trim() !== (doc.remark || '').trim()) onSave(value.trim()); setEditing(false); };
  const cancel = () => { setValue(doc.remark || ''); setEditing(false); };

  if (editing) {
    return (
      <div className="mt-2 flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
        <div className="relative flex-1 min-w-0">
          <FiMessageSquare className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-amber-500 pointer-events-none" />
          <input ref={inputRef} type="text" value={value} onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commit(); } if (e.key === 'Escape') cancel(); }}
            onBlur={commit}
            placeholder="Remark for customer (e.g. Password: 1234)"
            className="w-full pl-7 pr-2 py-1 text-xs border border-amber-300 bg-amber-50/60 rounded-md focus:ring-2 focus:ring-amber-400/40 focus:border-amber-400 outline-none transition-all" />
        </div>
      </div>
    );
  }
  if (doc.remark) {
    return (
      <button onClick={(e) => { e.stopPropagation(); setEditing(true); }}
        className="mt-1.5 group/remark inline-flex items-center gap-1.5 max-w-full text-left text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-2 py-0.5 hover:bg-amber-100 transition-colors"
        title="Click to edit remark">
        <FiMessageSquare className="h-3 w-3 text-amber-600 flex-shrink-0" />
        <span className="truncate">{doc.remark}</span>
        <FiEdit className="h-2.5 w-2.5 opacity-0 group-hover/remark:opacity-60 flex-shrink-0" />
      </button>
    );
  }
  return (
    <button onClick={(e) => { e.stopPropagation(); setEditing(true); }}
      className="mt-1.5 text-[11px] text-gray-400 hover:text-indigo-600 flex items-center gap-1 transition-colors">
      <FiPlus className="h-2.5 w-2.5" />
      Add customer remark
    </button>
  );
};

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
    if (!file || !label.trim()) { toast.error('Choose a file and enter a label first'); return; }
    onUpload(file, label.trim(), visibleToCustomer, remark);
    setFile(null); setLabel(''); setVisibleToCustomer(false); setRemark('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };
  const handleDrop = (e) => { e.preventDefault(); e.stopPropagation(); setDragActive(false); if (e.dataTransfer.files && e.dataTransfer.files[0]) setFile(e.dataTransfer.files[0]); };
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
    if (name.match(/\.(doc|docx)$/)) return { Icon: FiFileText, color: 'text-indigo-600', bg: 'bg-indigo-50' };
    return { Icon: FiFileText, color: 'text-gray-600', bg: 'bg-gray-50' };
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center">
          <FiPaperclip className="h-4 w-4 text-indigo-600" />
        </div>
        <div>
          <h3 className="font-semibold text-gray-900 text-sm">Customer Documents</h3>
          <p className="text-xs text-gray-500">Files marked visible and their remarks appear on the customer's tracking page</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100 flex items-center gap-2">
          <FiUpload className="h-3.5 w-3.5 text-indigo-600" />
          <h4 className="text-xs font-semibold text-gray-900">Upload New Document</h4>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-3">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
            <div className="lg:col-span-4">
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Document Label <span className="text-rose-500">*</span></label>
              <input type="text" placeholder="e.g. Income Certificate" value={label} onChange={(e) => setLabel(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all" />
            </div>
            <div className="lg:col-span-5">
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">File <span className="text-rose-500">*</span></label>
              <div onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`flex items-center gap-2 px-3 py-2 border-2 border-dashed rounded-lg cursor-pointer transition-all ${
                  dragActive ? 'border-indigo-500 bg-indigo-50'
                  : file ? 'border-emerald-400 bg-emerald-50/40'
                  : 'border-gray-300 bg-gray-50 hover:border-indigo-400 hover:bg-indigo-50/40'
                }`}>
                <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                  onChange={(e) => setFile(e.target.files[0] || null)} className="hidden" />
                {file ? (
                  <>
                    <FiFileText className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                    <span className="text-sm text-gray-800 truncate flex-1">{file.name}</span>
                    <span className="text-xs text-gray-500 flex-shrink-0">{formatBytes(file.size)}</span>
                  </>
                ) : (
                  <>
                    <FiUpload className="h-4 w-4 text-gray-400 flex-shrink-0" />
                    <span className="text-sm text-gray-500 truncate flex-1">{dragActive ? 'Drop file here' : 'Click or drag file'}</span>
                  </>
                )}
              </div>
            </div>
            <div className="lg:col-span-3 flex flex-col">
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Visibility</label>
              <div className="flex gap-2">
                <button type="button" onClick={() => setVisibleToCustomer(!visibleToCustomer)}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-2.5 py-2 text-xs font-semibold rounded-lg border transition-all ${
                    visibleToCustomer ? 'bg-emerald-50 text-emerald-700 border-emerald-300' : 'bg-gray-50 text-gray-600 border-gray-300 hover:bg-gray-100'
                  }`}>
                  {visibleToCustomer ? <FiEye className="h-3.5 w-3.5" /> : <FiEyeOff className="h-3.5 w-3.5" />}
                  {visibleToCustomer ? 'Visible' : 'Hidden'}
                </button>
                <button type="submit" disabled={uploadingDocument || !file || !label.trim()}
                  className="flex-1 flex items-center justify-center gap-1.5 px-2.5 py-2 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm">
                  {uploadingDocument ? (<><div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>Uploading</>) : (<><FiUpload className="h-3.5 w-3.5" />Upload</>)}
                </button>
              </div>
            </div>
          </div>
          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 mb-1.5">
              <FiMessageSquare className="h-3.5 w-3.5 text-amber-500" />
              Customer Remark
              <span className="text-gray-400 font-normal">— optional, shown alongside the document</span>
            </label>
            <input type="text" value={remark} onChange={(e) => setRemark(e.target.value)}
              placeholder="e.g. Password: 1234"
              className="w-full px-3 py-2 text-sm border border-amber-200 bg-amber-50/40 rounded-lg focus:ring-2 focus:ring-amber-400/40 focus:border-amber-400 outline-none transition-all placeholder:text-amber-700/40" />
          </div>
        </form>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FiFileText className="h-3.5 w-3.5 text-indigo-600" />
            <h4 className="text-xs font-semibold text-gray-900">Uploaded Documents</h4>
          </div>
          {documents.length > 0 && (
            <span className="text-[11px] text-gray-500">{documents.length} · {documents.filter(d => d.visible_to_customer).length} visible</span>
          )}
        </div>

        {documentsLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
            <span className="ml-3 text-sm text-gray-500">Loading documents...</span>
          </div>
        ) : documents.length === 0 ? (
          <div className="text-center py-12 px-6">
            <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <FiFileText className="h-6 w-6 text-gray-400" />
            </div>
            <p className="text-sm font-semibold text-gray-900 mb-1">No documents yet</p>
            <p className="text-xs text-gray-500">Upload the first document using the form above</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {documents.map((doc) => {
              const { Icon, color, bg } = getFileIcon(doc);
              return (
                <div key={doc.id} className="p-4 hover:bg-gray-50/60 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${bg}`}>
                      <Icon className={`h-4 w-4 ${color}`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-gray-900 truncate">{doc.label}</p>
                          <p className="text-[11px] text-gray-500 truncate">
                            {doc.file_name || 'document'} · {formatBytes(doc.file_size)} · {formatDate(doc.created_at)}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button onClick={() => onToggleVisibility(doc.id, !doc.visible_to_customer)}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border transition-all ${
                              doc.visible_to_customer
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                : 'bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200'
                            }`}>
                            {doc.visible_to_customer ? <FiEye className="h-2.5 w-2.5" /> : <FiEyeOff className="h-2.5 w-2.5" />}
                            {doc.visible_to_customer ? 'Visible' : 'Hidden'}
                          </button>
                          {(doc.file_url || doc.url) && (
                            <a href={doc.file_url || doc.url} target="_blank" rel="noopener noreferrer"
                              className="p-1 rounded-md text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors" title="View">
                              <FiExternalLink className="h-3.5 w-3.5" />
                            </a>
                          )}
                          <button onClick={() => { if (window.confirm(`Delete "${doc.label}"?`)) onDelete(doc.id); }}
                            className="p-1 rounded-md text-gray-400 hover:text-rose-600 hover:bg-rose-50 transition-colors" title="Delete">
                            <FiTrash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                      <DocumentRemarkEditor doc={doc} onSave={(text) => onUpdateRemark(doc.id, text)} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

/* ============================================================
   HISTORY VIEW
   ============================================================ */
const HistoryView = ({ activityHistory, activityLoading }) => {
  if (activityLoading) {
    return (
      <div className="space-y-4">
        <h3 className="font-semibold text-gray-900 text-sm">Activity History</h3>
        <div className="flex items-center justify-center py-10">
          <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <span className="ml-3 text-sm text-gray-500">Loading...</span>
        </div>
      </div>
    );
  }
  if (!activityHistory || activityHistory.length === 0) {
    return (
      <div className="space-y-4">
        <h3 className="font-semibold text-gray-900 text-sm">Activity History</h3>
        <div className="text-center py-10 bg-white rounded-lg border border-gray-200">
          <FiClock className="mx-auto h-8 w-8 text-gray-400 mb-2" />
          <p className="text-sm font-medium text-gray-900">No activity yet</p>
          <p className="text-xs text-gray-500 mt-1">Activity will appear here as changes are made</p>
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900 text-sm">Activity History</h3>
        <span className="text-xs text-gray-500">{activityHistory.length} {activityHistory.length === 1 ? 'event' : 'events'}</span>
      </div>
      <div className="relative">
        <div className="absolute left-[15px] top-3 bottom-3 w-px bg-gray-200"></div>
        <div className="space-y-3">
          {activityHistory.map((activity) => (
            <div key={activity.id} className="relative flex gap-3">
              <div className="w-8 h-8 rounded-full bg-white border-2 border-indigo-200 flex items-center justify-center flex-shrink-0 z-10">
                <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
              </div>
              <div className="flex-1 bg-white rounded-lg border border-gray-200 p-3">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <p className="text-sm font-semibold text-gray-900">{activity.action}</p>
                  <p className="text-[10px] text-gray-400 whitespace-nowrap">
                    {activity.created_at ? formatTimelineDate(activity.created_at) : 'Unknown time'}
                  </p>
                </div>
                <p className="text-xs text-gray-600 leading-relaxed">{activity.description}</p>
                <p className="text-[10px] text-gray-400 mt-1.5">By {activity.performed_by_name || 'System'}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TrackServicePage;