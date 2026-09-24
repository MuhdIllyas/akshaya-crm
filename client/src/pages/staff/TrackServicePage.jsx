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
  FiCopy, FiCheck, FiMoreVertical
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
   UTILITY FUNCTIONS
   ============================================================ */
const formatDate = (dateString) => {
  if (!dateString) return 'Not set';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Invalid date';
    return date.toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch { return 'Invalid date'; }
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
  } catch { return 'Invalid date'; }
};

// Standalone — safe for use outside the component tree
const formatDateForInputStatic = (dateString) => {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    return date.toISOString().split('T')[0];
  } catch { return ''; }
};

/* ============================================================
   INLINE EDIT FIELD — click-to-edit primitive
   ============================================================ */
const InlineEditField = ({
  label, value, displayValue, type = 'text', options,
  placeholder = 'Not set', noneLabel = '— None —', onSave,
  variant = 'default', icon: Icon
}) => {
  const [editing, setEditing] = useState(false);
  const [tempValue, setTempValue] = useState(value ?? '');
  const inputRef = useRef(null);

  useEffect(() => { setTempValue(value ?? ''); }, [value]);
  useEffect(() => { if (editing && inputRef.current) inputRef.current.focus(); }, [editing]);

  const commit = () => {
    const next = tempValue ?? '';
    const current = value ?? '';
    if (String(next) !== String(current)) onSave(next);
    setEditing(false);
  };
  const cancel = () => { setTempValue(value ?? ''); setEditing(false); };
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && type !== 'select') { e.preventDefault(); commit(); }
    if (e.key === 'Escape') cancel();
  };

  /* ---------- CHIP variant (compact inline-editable pill) ---------- */
  if (variant === 'chip') {
    if (editing) {
      return type === 'select' ? (
        <select
          ref={inputRef} value={tempValue}
          onChange={(e) => setTempValue(e.target.value)}
          onBlur={commit} onKeyDown={handleKeyDown}
          className="text-xs font-medium border border-indigo-400 rounded-md px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
        >
          <option value="">{noneLabel}</option>
          {options?.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
        </select>
      ) : (
        <input
          ref={inputRef} type={type} value={tempValue}
          onChange={(e) => setTempValue(e.target.value)}
          onBlur={commit} onKeyDown={handleKeyDown}
          className="text-xs font-medium border border-indigo-400 rounded-md px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 w-32"
        />
      );
    }
    const displayNode = displayValue !== undefined ? displayValue
      : (value !== undefined && value !== null && value !== '')
        ? value
        : <span className="text-gray-400 italic">{placeholder}</span>;
    return (
      <button
        onClick={() => setEditing(true)}
        title={`Edit ${label}`}
        className="group/chip inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-gray-200 bg-white hover:border-indigo-300 hover:bg-indigo-50/60 transition-colors text-xs"
      >
        {Icon && <Icon className="h-3 w-3 text-gray-400 group-hover/chip:text-indigo-500 flex-shrink-0" />}
        <span className="text-gray-400 font-medium">{label}:</span>
        <span className="font-medium text-gray-800 truncate max-w-[140px]">{displayNode}</span>
        <FiEdit className="h-2.5 w-2.5 text-gray-300 group-hover/chip:text-indigo-500 flex-shrink-0" />
      </button>
    );
  }

  /* ---------- DEFAULT variant (label + value row) ---------- */
  if (editing) {
    return (
      <div className="flex justify-between items-center py-1 gap-2">
        <span className="text-xs text-gray-500 flex-shrink-0">{label}</span>
        {type === 'select' ? (
          <select
            ref={inputRef} value={tempValue}
            onChange={(e) => setTempValue(e.target.value)}
            onBlur={commit} onKeyDown={handleKeyDown}
            className="text-xs font-medium border border-indigo-400 rounded-md px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 min-w-0 max-w-[65%] flex-1"
          >
            <option value="">{noneLabel}</option>
            {options?.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          </select>
        ) : (
          <input
            ref={inputRef} type={type} value={tempValue}
            onChange={(e) => setTempValue(e.target.value)}
            onBlur={commit} onKeyDown={handleKeyDown}
            className="text-xs font-medium border border-indigo-400 rounded-md px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 min-w-0 max-w-[65%] flex-1 text-right"
          />
        )}
      </div>
    );
  }
  const displayNode = displayValue !== undefined ? displayValue
    : (value !== undefined && value !== null && value !== '')
      ? value
      : <span className="text-gray-400 italic">{placeholder}</span>;
  return (
    <div
      className="flex justify-between items-center py-1 gap-2 cursor-pointer rounded-md px-1.5 -mx-1.5 hover:bg-indigo-50/60 transition-colors group"
      onClick={() => setEditing(true)} title="Click to edit"
    >
      <span className="text-xs text-gray-500 flex-shrink-0">{label}</span>
      <div className="flex items-center gap-1.5 min-w-0 justify-end">
        <span className="text-xs font-medium text-gray-900 truncate">{displayNode}</span>
        <FiEdit className="h-3 w-3 text-gray-300 group-hover:text-indigo-500 flex-shrink-0 transition-colors" />
      </div>
    </div>
  );
};

/* ============================================================
   STATUS DROPDOWN — compact status changer
   ============================================================ */
const StatusDropdown = ({ currentStatus, statusConfig, onChange }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const cfg = statusConfig[currentStatus] || statusConfig['Pending'];

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all hover:shadow-sm ${cfg.bg} ${cfg.color} ${cfg.border}`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`}></span>
        {currentStatus}
        <FiChevronDown className={`h-3 w-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.96 }}
            transition={{ duration: 0.12 }}
            className="absolute top-full left-0 mt-1 w-48 bg-white rounded-lg border border-gray-200 shadow-lg py-1 z-40"
          >
            {Object.keys(statusConfig).map((statusKey) => {
              const c = statusConfig[statusKey];
              const isCurrent = currentStatus === statusKey;
              return (
                <button
                  key={statusKey}
                  onClick={() => { setOpen(false); if (!isCurrent) onChange(statusKey); }}
                  disabled={isCurrent}
                  className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left transition-colors ${
                    isCurrent ? 'bg-gray-50 cursor-default opacity-60' : 'hover:bg-gray-50'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${c.dot} flex-shrink-0`}></span>
                  <span className={`font-medium ${c.color}`}>{statusKey}</span>
                  {isCurrent && <FiCheck className="h-3 w-3 ml-auto text-gray-400" />}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
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
  const [isSidebarVisible, setIsSidebarVisible] = useState(true);

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
    } catch { return ''; }
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
      totalCharge,
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
      paymentStatus,
      paymentDetails: paymentDetailsStr,
      payments,
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
      workSource,
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
    } catch { setActivityHistory([]); }
    finally { setActivityLoading(false); }
  };

  const fetchDocuments = async (trackingId) => {
    if (!trackingId) { setDocuments([]); return; }
    try {
      setDocumentsLoading(true);
      const data = await getTrackingDocuments(trackingId);
      setDocuments(Array.isArray(data) ? data : []);
    } catch { setDocuments([]); }
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
      toast.error('Failed to upload document: ' + (error.response?.data?.error || error.message));
    } finally { setUploadingDocument(false); }
  };

  const handleToggleDocumentVisibility = async (trackingId, docId, visible) => {
    try {
      await toggleTrackingDocumentVisibility(trackingId, docId, visible);
      await fetchDocuments(trackingId);
      toast.success(visible ? 'Document is now visible to the customer' : 'Document hidden from the customer');
    } catch { toast.error('Failed to update document visibility'); }
  };

  const handleUpdateDocumentRemark = async (trackingId, docId, remark) => {
    try {
      await updateTrackingDocumentRemark(trackingId, docId, remark);
      await fetchDocuments(trackingId);
      toast.success('Remark saved');
    } catch { toast.error('Failed to save remark'); }
  };

  const handleDeleteDocument = async (trackingId, docId) => {
    try {
      await deleteTrackingDocument(trackingId, docId);
      await fetchDocuments(trackingId);
      toast.success('Document deleted');
    } catch { toast.error('Failed to delete document'); }
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
        setIsSidebarVisible(false);
      }
    } catch {
      toast.error('Failed to load the specific application');
      await fetchAllTrackingEntries();
    }
  };

  const fetchAllTrackingEntries = async () => {
    try {
      const apiStatus = reverseStatusMap[statusFilter] || statusFilter;
      const params = {
        page: currentPage, limit,
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
      setIsSidebarVisible(true);
    } catch {
      toast.error('Failed to fetch data');
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
      toast.error('Failed to update status: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleInlineTrackingUpdate = async (service, updates) => {
    try {
      const payload = {
        applicationNumber: updates.applicationNumber !== undefined ? updates.applicationNumber : service.applicationNumber,
        currentStep: updates.currentStep !== undefined ? updates.currentStep : service.currentStep,
        estimatedDelivery: updates.estimatedDelivery !== undefined ? updates.estimatedDelivery : service.rawEstimatedDelivery,
        averageTime: updates.averageTime !== undefined ? updates.averageTime : (service.averageTime || '7 days'),
        notes: updates.notes !== undefined ? updates.notes : (service.notes || null),
        assignedTo: updates.assignedTo !== undefined ? (updates.assignedTo ? parseInt(updates.assignedTo) : null) : service.assignedToId,
        aadhaar: updates.aadhaar !== undefined ? updates.aadhaar : (service.aadhaar || null),
        email: updates.email !== undefined ? updates.email : (service.email || null),
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
            assignedToId: updates.assignedTo !== undefined ? (updates.assignedTo ? parseInt(updates.assignedTo) : null) : s.assignedToId,
            rawEstimatedDelivery: updates.estimatedDelivery !== undefined ? updates.estimatedDelivery : s.rawEstimatedDelivery,
            estimatedDelivery: updates.estimatedDelivery !== undefined ? formatDate(updates.estimatedDelivery) : s.estimatedDelivery,
            progress: payload.progress
          };
        }
        return s;
      }));

      if (selectedService?.id === service.id) {
        setSelectedService(prev => ({
          ...prev, ...updates,
          steps: updates.steps || prev.steps,
          updatedAt: updates.updatedAt || prev.updatedAt,
          assignedTo: updates.assignedTo !== undefined ? (staffList.find(staff => staff.id === parseInt(updates.assignedTo))?.name || 'Unassigned') : prev.assignedTo,
          assignedToId: updates.assignedTo !== undefined ? (updates.assignedTo ? parseInt(updates.assignedTo) : null) : prev.assignedToId,
          estimatedDelivery: updates.estimatedDelivery !== undefined ? formatDate(updates.estimatedDelivery) : prev.estimatedDelivery,
          rawEstimatedDelivery: updates.estimatedDelivery !== undefined ? updates.estimatedDelivery : prev.rawEstimatedDelivery,
          progress: payload.progress
        }));
        setTrackingFormData(prev => ({ ...prev, ...updates }));
      }

      await updateTrackingEntry(service.id, payload);
      await fetchActivityHistory(service.id);
      toast.success('Details updated successfully');
    } catch {
      toast.error('Failed to update tracking details');
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
    if (!id && !preventNav && viewMode === 'list') navigate(`/dashboard/staff/track_service/${service.id}`, { replace: true });
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
    } catch { throw new Error('Failed to fetch complete dataset'); }
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
    } catch { toast.error("Failed to export Excel."); }
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
    } catch { toast.error("Failed to export PDF."); }
  };

  const handleBackToList = () => navigate('/dashboard/staff/track_service');

  /* ============================================================
     DETAIL PANE — REDESIGNED LAYOUT
     ============================================================ */
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

    const service = selectedService;

    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {/* ============ A. STICKY COMPACT HEADER ============ */}
        <div className="sticky top-0 z-30 bg-white border-b border-gray-200">
          <div className="px-4 py-2.5 flex items-center gap-3">
            {/* Avatar */}
            <div className="relative flex-shrink-0">
              <div className="w-9 h-9 rounded-full bg-indigo-600 flex items-center justify-center shadow-sm">
                <span className="text-white text-xs font-bold">
                  {(service.customerName || 'U').charAt(0).toUpperCase()}
                </span>
              </div>
              <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white ${statusConfig[service.status]?.dot}`}></span>
            </div>

            {/* Name + phone */}
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-gray-900 truncate leading-tight">{service.customerName}</h2>
              <p className="text-[11px] text-gray-500 truncate flex items-center gap-1">
                <FiPhone className="h-2.5 w-2.5" />{service.phone}
              </p>
            </div>

            {/* Divider */}
            <div className="hidden md:block w-px h-6 bg-gray-200"></div>

            {/* App No with copy */}
            <button
              onClick={() => {
                navigator.clipboard.writeText(service.applicationNumber || '');
                toast.success('App number copied');
              }}
              className="hidden md:flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-gray-100 transition-colors group"
              title="Click to copy"
            >
              <span className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">App No</span>
              <span className="text-xs font-mono font-medium text-gray-800">{service.applicationNumber || 'N/A'}</span>
              <FiCopy className="h-2.5 w-2.5 text-gray-300 group-hover:text-indigo-500 transition-colors" />
            </button>

            {/* Spacer */}
            <div className="flex-1"></div>

            {/* Status dropdown */}
            <StatusDropdown
              currentStatus={service.status}
              statusConfig={statusConfig}
              onChange={(newStatus) => handleUpdateStatus(service.id, newStatus)}
            />

            {/* Icon buttons */}
            <button
              onClick={() => handleNotifyCustomer(service)}
              title="Notify customer"
              className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:text-green-600 hover:bg-green-50 hover:border-green-200 transition-colors">
              <FiMessageSquare className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => navigate(`/dashboard/staff/service-workspace/${service.id}`)}
              title="Open workspace"
              className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:text-purple-600 hover:bg-purple-50 hover:border-purple-200 transition-colors">
              <FiGrid className="h-3.5 w-3.5" />
            </button>
            {viewMode === 'list' && (
              <button
                onClick={() => setSelectedService(null)}
                title="Close"
                className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-colors">
                <FiX className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* ============ C. AT-A-GLANCE STRIP ============ */}
          <div className="px-4 py-2 bg-gray-50 border-t border-gray-100 flex items-center gap-2 flex-wrap">
            <InlineEditField
              variant="chip"
              label="Step"
              icon={FiTrendingUp}
              value={service.currentStep || 'Submitted'}
              type="select"
              options={stepOptions}
              noneLabel="— Select step —"
              onSave={(v) => handleInlineTrackingUpdate(service, { currentStep: v })}
            />
            <InlineEditField
              variant="chip"
              label="Assigned"
              icon={FiUser}
              value={service.assignedToId ?? ''}
              displayValue={service.assignedTo || 'Unassigned'}
              type="select"
              options={staffList.map(s => ({ value: String(s.id), label: s.name }))}
              noneLabel="— Unassigned —"
              onSave={(v) => handleInlineTrackingUpdate(service, { assignedTo: v })}
            />
            <InlineEditField
              variant="chip"
              label="ETA"
              icon={FiCalendar}
              value={formatDateForInputStatic(service.rawEstimatedDelivery)}
              displayValue={service.estimatedDelivery || 'Not set'}
              type="date"
              onSave={(v) => handleInlineTrackingUpdate(service, { estimatedDelivery: v })}
            />
            <InlineEditField
              variant="chip"
              label="Priority"
              icon={FiFlag}
              value={service.priority || 'medium'}
              displayValue={
                <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold ${priorityConfig[service.priority]?.bg} ${priorityConfig[service.priority]?.color} border ${priorityConfig[service.priority]?.border}`}>
                  {priorityConfig[service.priority]?.label}
                </span>
              }
              type="select"
              options={priorityOptions}
              onSave={(v) => handleInlineTrackingUpdate(service, { priority: v })}
            />
          </div>
        </div>

        {/* ============ D. TAB BAR (4 tabs) ============ */}
        <div className="border-b border-gray-200 bg-white">
          <nav className="flex -mb-px px-2">
            {[
              { id: 'overview', label: 'Overview', icon: FiFileText },
              { id: 'documents', label: 'Documents', icon: FiPaperclip },
              { id: 'history', label: 'History', icon: FiClock },
              { id: 'discussion', label: 'Discussion', icon: FiMessageCircle }
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
                    isActive
                      ? 'border-indigo-500 text-indigo-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* ============ TAB CONTENT ============ */}
        <div className="p-4 bg-gray-50/40">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.15 }}
            >
              {activeTab === 'overview' && (
                <OverviewView
                  service={service}
                  priorityConfig={priorityConfig}
                  paymentStatusConfig={paymentStatusConfig}
                  staffList={staffList}
                  stepOptions={stepOptions}
                  priorityOptions={priorityOptions}
                  onInlineUpdate={(updates) => handleInlineTrackingUpdate(service, updates)}
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
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-indigo-100 flex items-center justify-center">
                      <FiMessageCircle className="h-3.5 w-3.5 text-indigo-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 text-xs">Internal Discussion</h3>
                      <p className="text-[11px] text-gray-500">Tag staff using @ to assign tasks</p>
                    </div>
                  </div>
                  <div className="bg-white rounded-xl p-2 border border-gray-200">
                    <NotesPanel contextType="service_entry" contextId={service.serviceEntryId} embedded={true} showHeader={false} />
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    );
  };

  const KPIStat = ({ title, value, subtitle, trend, icon: Icon, color }) => (
    <motion.div whileHover={{ y: -2 }}
      className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-lg transition-all duration-300 group">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mb-1">{value}</p>
          <div className="flex items-center space-x-2">
            <span className={`text-xs font-medium ${trend > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              {trend > 0 ? '+' : ''}{trend}%
            </span>
            <span className="text-xs text-gray-500">{subtitle}</span>
          </div>
        </div>
        <div className={`p-3 rounded-xl ${color} transition-colors group-hover:scale-110`}>
          <Icon className="h-6 w-6 text-white" />
        </div>
      </div>
    </motion.div>
  );

  const ServiceCard = ({ service, isSelected, onClick }) => {
    const config = statusConfig[service.status] || statusConfig['Pending'];
    const priority = priorityConfig[service.priority || 'medium'];
    return (
      <motion.div whileHover={{ y: -2 }}
        className={`p-3 rounded-xl border-2 cursor-pointer transition-all duration-300 ${
          isSelected ? 'border-indigo-500 bg-indigo-50 shadow-md' : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
        }`}
        onClick={onClick}>
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center space-x-2 min-w-0 flex-1">
            <div className="relative flex-shrink-0">
              <div className="w-8 h-8 bg-gray-800 rounded-lg flex items-center justify-center">
                <FiUser className="h-4 w-4 text-white" />
              </div>
              <div className={`absolute -top-1 -right-1 w-2 h-2 rounded-full border-2 border-white ${config.dot}`}></div>
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold text-gray-900 text-sm truncate">{service.customerName}</h3>
              <p className="text-xs text-gray-500 truncate">{service.phone}</p>
            </div>
          </div>
        </div>
        <div className="mb-2">
          <p className="text-sm font-medium text-gray-900 truncate">{service.serviceType}</p>
          <p className="text-xs text-gray-600 truncate">{service.subcategoryName || 'N/A'}</p>
        </div>
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className={`px-1.5 py-0.5 rounded-full text-xs font-medium flex items-center space-x-1 ${config.bg} ${config.border}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`}></span>
            <span className={config.color}>{service.status}</span>
          </span>
          <span className={`px-1.5 py-0.5 rounded-full text-xs font-medium flex items-center space-x-1 ${priority.bg} ${priority.border}`}>
            <FiFlag className={`h-2.5 w-2.5 ${priority.color}`} />
            <span className={priority.color}>{priority.label}</span>
          </span>
        </div>
        <div className="flex items-center justify-between pt-2 border-t border-gray-100">
          <div className="text-xs text-gray-500 truncate flex-1 min-w-0 mr-2">{service.applicationNumber}</div>
          <div className="text-xs font-medium text-indigo-600 flex-shrink-0">{service.averageTime}</div>
        </div>
      </motion.div>
    );
  };

  const renderQuickActionsPanel = () => (
    <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm h-full flex flex-col justify-center">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900">Quick Actions</h3>
        <div className="flex space-x-1">
          <button onClick={() => setViewMode('grid')}
            className={`p-2 rounded-lg ${viewMode === 'grid' ? 'bg-indigo-100 text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}>
            <FiGrid className="h-4 w-4" />
          </button>
          <button onClick={() => setViewMode('list')}
            className={`p-2 rounded-lg ${viewMode === 'list' ? 'bg-indigo-100 text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}>
            <FiList className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <button className="p-3 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors flex flex-col items-center justify-center">
          <FiPlus className="h-5 w-5 mb-1" /><span className="text-xs font-medium">New</span>
        </button>
        <button onClick={handleExportExcel}
          className="p-3 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 transition-colors flex flex-col items-center justify-center">
          <FiDownload className="h-5 w-5 mb-1" /><span className="text-xs font-medium">Excel</span>
        </button>
        <button onClick={handleExportPDF}
          className="p-3 bg-rose-50 text-rose-600 rounded-lg hover:bg-rose-100 transition-colors flex flex-col items-center justify-center">
          <FiFileText className="h-5 w-5 mb-1" /><span className="text-xs font-medium">PDF</span>
        </button>
        <button className="p-3 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors flex flex-col items-center justify-center">
          <FiFilter className="h-5 w-5 mb-1" /><span className="text-xs font-medium">Filters</span>
        </button>
        <button className="p-3 bg-purple-50 text-purple-600 rounded-lg hover:bg-purple-100 transition-colors flex flex-col items-center justify-center">
          <FiPrinter className="h-5 w-5 mb-1" /><span className="text-xs font-medium">Print</span>
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
        <button onClick={handleSaveView}
          className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2 py-1.5 rounded-md hover:bg-indigo-100 transition-colors">
          Save My View
        </button>
      </div>
      <div className="space-y-4">
        <div className="relative">
          <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <input type="text" placeholder="Search name, phone, app no..."
            className="w-full pl-10 pr-4 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
            value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        </div>
        <button onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
          className="flex items-center justify-between w-full text-sm font-medium text-gray-600 hover:text-indigo-600 py-2 border-b border-gray-100 transition-colors">
          <span>Advanced Filters</span>
          <FiChevronDown className={`transition-transform ${showAdvancedFilters ? 'rotate-180' : ''}`} />
        </button>
        <AnimatePresence>
          {showAdvancedFilters && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
              className={`overflow-hidden pt-2 ${viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 items-end' : 'space-y-4'}`}>
              <div><label className="block text-xs font-medium text-gray-500 mb-1.5">Data Range</label>
                <select className="w-full px-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl" value={timeRange} onChange={(e) => setTimeRange(e.target.value)}>
                  <option value="week">Last 7 Days</option><option value="month">This Month</option><option value="year">This Year</option><option value="all">All Time</option>
                </select>
              </div>
              <div><label className="block text-xs font-medium text-gray-500 mb-1.5">Date</label>
                <input type="date" className="w-full px-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} />
              </div>
              <div><label className="block text-xs font-medium text-gray-500 mb-1.5">Service</label>
                <select className="w-full px-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl" value={serviceFilter} onChange={(e) => setServiceFilter(e.target.value)}>
                  <option value="all">All Services</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div><label className="block text-xs font-medium text-gray-500 mb-1.5">Subcategory</label>
                <select className="w-full px-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl" value={subcategoryFilter} onChange={(e) => setSubcategoryFilter(e.target.value)} disabled={serviceFilter === 'all'}>
                  <option value="all">All</option>
                  {availableSubcategories.map(sub => <option key={sub.id} value={sub.id}>{sub.name}</option>)}
                </select>
              </div>
              <div><label className="block text-xs font-medium text-gray-500 mb-1.5">Status</label>
                <select className="w-full px-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                  <option value="all">All Statuses</option>
                  {Object.keys(statusConfig).map(k => <option key={k} value={k}>{k}</option>)}
                </select>
              </div>
              <div><label className="block text-xs font-medium text-gray-500 mb-1.5">Staff</label>
                <select className="w-full px-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl" value={staffFilter} onChange={(e) => setStaffFilter(e.target.value)}>
                  <option value="all">Everyone</option>
                  {staffList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div><label className="block text-xs font-medium text-gray-500 mb-1.5">Timeline</label>
                <select className="w-full px-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl" value={expiryFilter} onChange={(e) => setExpiryFilter(e.target.value)}>
                  <option value="all">Any</option><option value="upcoming">Upcoming</option><option value="overdue">Overdue</option>
                </select>
              </div>
              <div><label className="block text-xs font-medium text-gray-500 mb-1.5">Aadhaar</label>
                <input type="text" placeholder="12-digit" className="w-full px-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl" value={aadhaarSearch} onChange={(e) => setAadhaarSearch(e.target.value)} maxLength="12" />
              </div>
              <div className={viewMode === 'grid' ? 'col-span-1 md:col-span-3 lg:col-span-4' : ''}>
                <button onClick={handleClearFilters} className="w-full py-2.5 text-xs font-semibold text-gray-600 border border-gray-200 hover:bg-gray-50 rounded-xl transition-all">
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
        <h3 className="font-semibold text-gray-900">Services <span className="text-gray-500 font-normal">({totalRecords})</span></h3>
        <div className="flex items-center space-x-2"><div className="w-2 h-2 bg-emerald-500 rounded-full"></div><span className="text-xs text-gray-500">Active</span></div>
      </div>
      <div className="space-y-3 max-h-[500px] overflow-y-auto scrollbar-hide">
        {services.map(service => (
          <ServiceCard key={service.id} service={service}
            isSelected={selectedService?.id === service.id}
            onClick={() => handleServiceSelect(service)} />
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
          <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-2 py-1 text-xs font-medium text-gray-600 bg-gray-50 rounded border border-gray-200 hover:bg-gray-100 disabled:opacity-50 transition-colors">Previous</button>
          <div className="text-xs text-gray-500 font-medium">Page {currentPage} of {totalPages}</div>
          <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="px-2 py-1 text-xs font-medium text-gray-600 bg-gray-50 rounded border border-gray-200 hover:bg-gray-100 disabled:opacity-50 transition-colors">Next</button>
        </div>
      )}
    </div>
  );

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
                <div className="w-9 h-9 bg-indigo-600 rounded-lg flex items-center justify-center shadow-md">
                  <FiTarget className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-gray-900">Service Management</h1>
                  <p className="text-gray-600 text-sm">Track and manage service applications</p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                {id && (
                  <button onClick={handleBackToList}
                    className="flex items-center space-x-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-all">
                    <FiArrowLeft className="h-4 w-4" /><span>Back to List</span>
                  </button>
                )}
                <button className="flex items-center space-x-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-all shadow-sm"
                  onClick={() => window.location.reload()}>
                  <FiRefreshCw className="h-4 w-4" /><span>Refresh</span>
                </button>
              </div>
            </div>
          </div>
        </header>

        <div className="max-w-[1600px] mx-auto px-6 py-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <KPIStat title="Total Services" value={globalStats.total || 0} subtitle="In selected period" trend={12} icon={FiBarChart2} color="bg-blue-500" />
            <KPIStat title="In Progress" value={globalStats.in_progress || 0} subtitle="Active now" trend={8} icon={FiTrendingUp} color="bg-amber-500" />
            <KPIStat title="Completed" value={globalStats.completed || 0} subtitle="Successfully done" trend={15} icon={FiCheckCircle} color="bg-emerald-500" />
            <KPIStat title="SLA Compliance" value={`${Math.round(globalStats.sla_compliance || 100)}%`} subtitle="On time delivery" trend={2} icon={FiAward} color="bg-purple-500" />
          </div>

          {viewMode === 'grid' ? (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1">{renderQuickActionsPanel()}</div>
                <div className="lg:col-span-2">{renderFiltersPanel()}</div>
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
                      {Object.entries(servicesByDate).map(([date, dateServices]) => (
                        <React.Fragment key={date}>
                          <tr className="bg-gray-50 border-y border-gray-200">
                            <td colSpan="6" className="px-4 py-2.5 text-xs font-bold text-gray-700 uppercase tracking-wider">
                              <div className="flex items-center gap-2">
                                <FiCalendar className="h-4 w-4 text-indigo-500" />
                                {date === 'Unknown Date' ? date : formatDate(date)}
                                <span className="bg-gray-200 text-gray-600 py-0.5 px-2 rounded-full text-[10px] ml-2">{dateServices.length} items</span>
                              </div>
                            </td>
                          </tr>
                          {dateServices.map(service => (
                            <React.Fragment key={service.id}>
                              <tr className={`hover:bg-gray-50 transition-colors group ${selectedService?.id === service.id ? 'bg-indigo-50/20' : ''}`}>
                                <td className="px-4 py-3">
                                  <div className="text-sm font-semibold text-gray-900 whitespace-nowrap">{service.customerName}</div>
                                  <div className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                                    <FiPhone className="h-3 w-3" /> {service.phone}
                                  </div>
                                </td>
                                <td className="px-4 py-3">
                                  <div className="text-sm text-gray-900 font-medium truncate max-w-[200px]">{service.serviceType}</div>
                                  <div className="text-xs text-gray-500 truncate max-w-[200px] mt-0.5">{service.subcategoryName}</div>
                                </td>
                                <td className="px-4 py-3">
                                  <input type="text" defaultValue={service.applicationNumber || ''}
                                    onBlur={(e) => { if (e.target.value !== service.applicationNumber) handleInlineTrackingUpdate(service, { applicationNumber: e.target.value }); }}
                                    className="w-full text-xs font-medium border-gray-300 rounded-md focus:ring-indigo-500 px-2 py-1.5 border bg-white shadow-sm transition-all hover:border-gray-400"
                                    placeholder="App No..." />
                                </td>
                                <td className="px-4 py-3 space-y-1.5">
                                  <select value={service.status} onChange={(e) => handleUpdateStatus(service.id, e.target.value)}
                                    className={`w-full text-[11px] font-bold rounded-md px-2 py-1 border outline-none cursor-pointer ${statusConfig[service.status]?.bg} ${statusConfig[service.status]?.color} ${statusConfig[service.status]?.border}`}>
                                    {Object.keys(statusConfig).map(k => <option key={k} value={k}>{k}</option>)}
                                  </select>
                                  <select value={service.currentStep || 'Submitted'} onChange={(e) => handleInlineTrackingUpdate(service, { currentStep: e.target.value })}
                                    className="w-full text-[11px] font-medium text-gray-600 bg-white border border-gray-300 rounded-md px-2 py-1 cursor-pointer">
                                    {stepOptions.map(step => <option key={step.value} value={step.value}>{step.label}</option>)}
                                  </select>
                                </td>
                                <td className="px-4 py-3 space-y-1.5">
                                  <select value={service.assignedToId || ''} onChange={(e) => handleInlineTrackingUpdate(service, { assignedTo: e.target.value })}
                                    className="w-full text-[11px] font-medium text-gray-700 bg-white border border-gray-300 rounded-md px-2 py-1 cursor-pointer">
                                    <option value="">Unassigned</option>
                                    {staffList.map(staff => <option key={staff.id} value={staff.id}>{staff.name}</option>)}
                                  </select>
                                  <input type="date" value={formatDateForInputStatic(service.rawEstimatedDelivery)}
                                    onChange={(e) => handleInlineTrackingUpdate(service, { estimatedDelivery: e.target.value })}
                                    className="w-full text-[11px] font-medium text-gray-600 bg-white border border-gray-300 rounded-md px-2 py-1 cursor-pointer" />
                                </td>
                                <td className="px-4 py-3 align-top">
                                  <div className="flex items-center justify-end gap-2 mt-1">
                                    <button onClick={(e) => { e.stopPropagation(); handleNotifyCustomer(service); }}
                                      title="Notify customer"
                                      className="p-1.5 rounded-lg border shadow-sm bg-white text-gray-500 border-gray-200 hover:text-green-600 hover:bg-green-50">
                                      <FiMessageSquare className="h-4 w-4" />
                                    </button>
                                    <button onClick={() => {
                                      if (selectedService?.id === service.id) setSelectedService(null);
                                      else handleServiceSelect(service, true);
                                    }}
                                      className={`p-1.5 rounded-lg border shadow-sm ${
                                        selectedService?.id === service.id
                                          ? 'bg-indigo-100 text-indigo-700 border-indigo-200'
                                          : 'bg-white text-gray-500 border-gray-200 hover:text-indigo-600 hover:bg-indigo-50'
                                      }`}>
                                      <FiChevronDown className={`h-4 w-4 transform transition-transform ${selectedService?.id === service.id ? 'rotate-180' : ''}`} />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                              {selectedService?.id === service.id && (
                                <tr>
                                  <td colSpan="6" className="p-0 border-b-2 border-indigo-200 bg-gray-50/60">
                                    <div className="max-h-[700px] overflow-y-auto">
                                      {renderDetailPane()}
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          ))}
                        </React.Fragment>
                      ))}
                      {services.length === 0 && (
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
                {totalPages > 1 && (
                  <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50">
                    <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-white rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50">
                      Previous Page
                    </button>
                    <div className="text-sm text-gray-600 font-medium bg-white px-4 py-1.5 rounded-lg border border-gray-200">
                      Page {currentPage} of {totalPages}
                    </div>
                    <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-white rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50">
                      Next Page
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
              {isSidebarVisible && (
                <div className="xl:col-span-1 flex flex-col space-y-6">
                  {renderQuickActionsPanel()}
                  {renderFiltersPanel()}
                  {renderCardList()}
                </div>
              )}
              <div className={isSidebarVisible ? "xl:col-span-3" : "xl:col-span-4"}>
                {renderDetailPane()}
              </div>
            </div>
          )}
        </div>

        <style>{`
          .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
          .scrollbar-hide::-webkit-scrollbar { display: none; }
        `}</style>
      </div>
    </ErrorBoundary>
  );
};

/* ============================================================
   REDESIGNED OVERVIEW VIEW
   ============================================================ */
const OverviewView = ({ service, priorityConfig, paymentStatusConfig, staffList, stepOptions, priorityOptions, onInlineUpdate }) => {
  const [showMore, setShowMore] = useState(false);

  const displaySteps = useMemo(() => {
    if (service.steps && service.steps.length > 0) {
      return [...service.steps].sort((a, b) => (a.step_order || 0) - (b.step_order || 0));
    }
    const stepOrderMap = { 'Submitted': 1, 'Initial Review': 2, 'Document Verification': 3, 'Final Approval': 4 };
    const currentOrder = stepOrderMap[service.currentStep] || 1;
    return [
      { id: 1, name: 'Submitted', completed: true, step_order: 1, date: service.createdAt },
      { id: 2, name: 'Initial Review', completed: currentOrder >= 2, step_order: 2, date: currentOrder === 2 ? service.updatedAt : null },
      { id: 3, name: 'Document Verification', completed: currentOrder >= 3, step_order: 3, date: currentOrder === 3 ? service.updatedAt : null },
      { id: 4, name: 'Final Approval', completed: currentOrder >= 4, step_order: 4, date: currentOrder >= 4 ? service.updatedAt : null }
    ];
  }, [service]);

  return (
    <div className="space-y-3">
      {/* ============ PROGRESS + TIMELINE ============ */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
            <FiTrendingUp className="h-3.5 w-3.5 text-indigo-600" />
            Progress
          </span>
          <span className="text-sm font-bold text-indigo-600">{service.progress}%</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden mb-3">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${service.progress}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="bg-indigo-500 h-full rounded-full"
          />
        </div>

        {/* Compact timeline as horizontal pills */}
        <div className="flex items-center gap-1">
          {displaySteps.map((step, idx) => {
            const isCompleted = step.completed;
            const isCurrent = step.name === service.currentStep;
            return (
              <React.Fragment key={step.id}>
                <div
                  className={`flex-1 min-w-0 px-2 py-1.5 rounded-md border text-center transition-all ${
                    isCompleted ? 'bg-emerald-50 border-emerald-200'
                    : isCurrent ? 'bg-indigo-50 border-indigo-300 ring-1 ring-indigo-500/20'
                    : 'bg-gray-50 border-gray-200'
                  }`}
                  title={step.completed ? (step.date ? formatTimelineDate(step.date) : 'Completed') : 'Pending'}
                >
                  <div className="flex items-center justify-center gap-1">
                    {isCompleted ? (
                      <FiCheckCircle className="h-3 w-3 text-emerald-600 flex-shrink-0" />
                    ) : isCurrent ? (
                      <div className="w-2.5 h-2.5 rounded-full border-2 border-indigo-500 flex items-center justify-center flex-shrink-0">
                        <div className="w-1 h-1 rounded-full bg-indigo-500 animate-pulse" />
                      </div>
                    ) : (
                      <div className="w-2.5 h-2.5 rounded-full border-2 border-gray-300 flex-shrink-0" />
                    )}
                    <span className={`text-[10px] font-semibold truncate ${
                      isCompleted ? 'text-emerald-800' : isCurrent ? 'text-indigo-800' : 'text-gray-500'
                    }`}>{step.name}</span>
                  </div>
                </div>
                {idx < displaySteps.length - 1 && (
                  <div className={`h-px w-2 flex-shrink-0 ${isCompleted ? 'bg-emerald-300' : 'bg-gray-200'}`}></div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* ============ TWO-COLUMN: DETAILS + FINANCIALS ============ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Service Details — primary editable fields */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-xs font-semibold text-gray-700 mb-3 flex items-center gap-1.5">
            <FiFileText className="h-3.5 w-3.5 text-indigo-600" />
            Service Details
            <span className="text-[10px] text-gray-400 font-normal italic ml-auto">Click to edit</span>
          </h3>
          <div className="space-y-1">
            {/* Read-only derived fields */}
            <DetailRow label="Service Type" value={service.serviceType} />
            <DetailRow label="Subcategory" value={service.subcategoryName} />

            {/* Editable — most common changes */}
            <InlineEditField
              label="Application No"
              value={service.applicationNumber || ''}
              placeholder="Not set"
              onSave={(v) => onInlineUpdate({ applicationNumber: v })}
            />
            <InlineEditField
              label="Average Time"
              value={service.averageTime || ''}
              placeholder="Not set"
              onSave={(v) => onInlineUpdate({ averageTime: v })}
            />
            <InlineEditField
              label="Aadhaar"
              value={service.aadhaar || ''}
              placeholder="Not set"
              onSave={(v) => onInlineUpdate({ aadhaar: v })}
            />
            <InlineEditField
              label="Email"
              type="email"
              value={service.email || ''}
              placeholder="Not set"
              onSave={(v) => onInlineUpdate({ email: v })}
            />
            <InlineEditField
              label="Notes"
              value={service.notes || ''}
              placeholder="No notes"
              onSave={(v) => onInlineUpdate({ notes: v })}
            />
            <DetailRow label="Last Updated" value={formatDate(service.updatedAt)} />
          </div>
        </div>

        {/* Financial summary */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-xs font-semibold text-gray-700 mb-3 flex items-center gap-1.5">
            <FiDollarSign className="h-3.5 w-3.5 text-emerald-600" />
            Financial Summary
          </h3>
          <div className="space-y-2">
            <div className="flex justify-between items-center py-1">
              <span className="text-xs text-gray-500">Service Charge</span>
              <span className="text-xs font-mono font-medium text-gray-800">₹{service.serviceCharge?.toFixed(2) || '0.00'}</span>
            </div>
            <div className="flex justify-between items-center py-1">
              <span className="text-xs text-gray-500">Department Charge</span>
              <span className="text-xs font-mono font-medium text-gray-800">₹{service.departmentCharge?.toFixed(2) || '0.00'}</span>
            </div>
            <div className="flex justify-between items-center py-1.5 border-t border-gray-200">
              <span className="text-xs font-semibold text-gray-900">Total</span>
              <span className="text-sm font-mono font-bold text-gray-900">₹{service.totalCharge?.toFixed(2) || '0.00'}</span>
            </div>
            <div className="flex justify-between items-center pt-2">
              <span className="text-xs text-gray-500">Payment Status</span>
              <span className={`text-xs font-semibold ${paymentStatusConfig[service.paymentStatus]?.color || paymentStatusConfig['default'].color}`}>
                {service.paymentStatus}
              </span>
            </div>
            {service.paymentDetails && service.paymentDetails !== 'No payments recorded' && (
              <div className="bg-gray-50 rounded-lg p-2.5 mt-1">
                <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold mb-1">Records</p>
                <p className="text-[11px] text-gray-700 leading-relaxed">{service.paymentDetails}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ============ COLLAPSIBLE SECONDARY INFO ============ */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <button
          onClick={() => setShowMore(!showMore)}
          className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-gray-50 transition-colors"
        >
          <span className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
            <FiMoreVertical className="h-3.5 w-3.5 text-gray-400" />
            More details
            {service.serviceRating && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">Has review</span>}
          </span>
          <FiChevronDown className={`h-3.5 w-3.5 text-gray-400 transition-transform ${showMore ? 'rotate-180' : ''}`} />
        </button>
        <AnimatePresence initial={false}>
          {showMore && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden border-t border-gray-100"
            >
              <div className="p-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <DetailRow label="Expiry Date" value={service.expiryDate || 'N/A'} />
                  <DetailRow label="Created" value={formatDate(service.createdAt)} />
                </div>

                {service.serviceRating && (
                  <div className="bg-amber-50/60 rounded-lg border border-amber-200 p-3 mt-2">
                    <p className="text-[10px] uppercase tracking-wider text-amber-700 font-semibold mb-2 flex items-center gap-1">
                      <FiAward className="h-3 w-3" /> Customer Review
                    </p>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-600">Service Rating</span>
                        <div className="flex items-center gap-0.5">
                          {[...Array(5)].map((_, i) => (
                            <span key={i} className={`text-sm ${i < service.serviceRating ? 'text-yellow-400' : 'text-gray-300'}`}>★</span>
                          ))}
                          <span className="ml-1 text-[10px] text-gray-500">({service.serviceRating}/5)</span>
                        </div>
                      </div>
                      {service.staffRating && (
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-600">Staff Rating</span>
                          <div className="flex items-center gap-0.5">
                            {[...Array(5)].map((_, i) => (
                              <span key={i} className={`text-sm ${i < service.staffRating ? 'text-yellow-400' : 'text-gray-300'}`}>★</span>
                            ))}
                            <span className="ml-1 text-[10px] text-gray-500">({service.staffRating}/5)</span>
                          </div>
                        </div>
                      )}
                      {service.reviewText && (
                        <p className="text-xs text-gray-700 italic bg-white p-2 rounded border border-amber-200 leading-relaxed">
                          "{service.reviewText}"
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

/* ============================================================
   SMALL REUSABLE COMPONENTS
   ============================================================ */
const StatItem = ({ label, value }) => (
  <div className="text-center p-3 bg-gray-50 rounded-lg border border-gray-200">
    <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wider mb-1">{label}</p>
    <p className="text-sm font-semibold text-gray-900 truncate">{value}</p>
  </div>
);

const DetailRow = ({ label, value, valueClass = "" }) => (
  <div className="flex justify-between items-center py-1">
    <span className="text-xs text-gray-500">{label}</span>
    <span className={`text-xs font-medium text-gray-800 truncate ml-2 max-w-[65%] text-right ${valueClass}`}>{value}</span>
  </div>
);

const FinancialRow = ({ label, amount, currency, isTotal = false }) => (
  <div className="flex justify-between items-center">
    <span className={`text-xs ${isTotal ? 'font-semibold text-gray-900' : 'text-gray-500'}`}>{label}</span>
    <span className={`font-mono ${isTotal ? 'text-sm font-bold text-gray-900' : 'text-xs text-gray-800'}`}>
      {currency}{amount?.toFixed(2) || '0.00'}
    </span>
  </div>
);

const ActivityItem = ({ action, description, time, user }) => (
  <div className="flex items-start gap-3 p-3 bg-white rounded-lg border border-gray-200">
    <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full mt-1.5 flex-shrink-0"></div>
    <div className="flex-1 min-w-0">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold text-gray-900">{action}</p>
        <p className="text-[10px] text-gray-500 whitespace-nowrap">{time}</p>
      </div>
      <p className="text-xs text-gray-600 mt-0.5">{description}</p>
      <p className="text-[10px] text-gray-400 mt-0.5">By {user}</p>
    </div>
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
          <input ref={inputRef} type="text" value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); commit(); }
              if (e.key === 'Escape') cancel();
            }}
            onBlur={commit}
            placeholder="Remark for customer (e.g. Password: 1234)"
            className="w-full pl-7 pr-2 py-1 text-xs border border-amber-300 bg-amber-50/60 rounded-md focus:ring-2 focus:ring-amber-400/40 outline-none transition-all" />
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
      <FiPlus className="h-2.5 w-2.5" /> Add customer remark
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
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
          <FiPaperclip className="h-3.5 w-3.5 text-indigo-600" /> Customer Documents
        </h3>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] px-2 py-0.5 bg-gray-100 rounded-full font-medium text-gray-600">{documents.length} files</span>
          <span className="text-[10px] px-2 py-0.5 bg-emerald-50 border border-emerald-200 rounded-full font-medium text-emerald-700">
            {documents.filter(d => d.visible_to_customer).length} visible
          </span>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-2 bg-gray-50 border-b border-gray-100 flex items-center gap-1.5">
          <FiUpload className="h-3 w-3 text-indigo-600" />
          <h4 className="text-[11px] font-semibold text-gray-900">Upload New Document</h4>
        </div>
        <form onSubmit={handleSubmit} className="p-3 space-y-2.5">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-2.5">
            <div className="lg:col-span-4">
              <input type="text" placeholder="Document label (e.g. Income Certificate)" value={label} onChange={(e) => setLabel(e.target.value)}
                className="w-full px-2.5 py-2 text-xs border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all" />
            </div>
            <div className="lg:col-span-5">
              <div onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`flex items-center gap-2 px-2.5 py-2 border-2 border-dashed rounded-md cursor-pointer transition-all ${
                  dragActive ? 'border-indigo-500 bg-indigo-50'
                  : file ? 'border-emerald-400 bg-emerald-50/40'
                  : 'border-gray-300 bg-gray-50 hover:border-indigo-400'
                }`}>
                <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                  onChange={(e) => setFile(e.target.files[0] || null)} className="hidden" />
                {file ? (
                  <>
                    <FiFileText className="h-3.5 w-3.5 text-emerald-600 flex-shrink-0" />
                    <span className="text-xs text-gray-800 truncate flex-1">{file.name}</span>
                    <span className="text-[10px] text-gray-500 flex-shrink-0">{formatBytes(file.size)}</span>
                  </>
                ) : (
                  <>
                    <FiUpload className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                    <span className="text-xs text-gray-500 truncate flex-1">{dragActive ? 'Drop file here' : 'Click or drag file'}</span>
                  </>
                )}
              </div>
            </div>
            <div className="lg:col-span-3 flex gap-1.5">
              <button type="button" onClick={() => setVisibleToCustomer(!visibleToCustomer)}
                className={`flex-1 flex items-center justify-center gap-1 px-2 py-2 text-[11px] font-medium rounded-md border transition-all ${
                  visibleToCustomer ? 'bg-emerald-50 text-emerald-700 border-emerald-300' : 'bg-gray-50 text-gray-600 border-gray-300'
                }`}>
                {visibleToCustomer ? <FiEye className="h-3 w-3" /> : <FiEyeOff className="h-3 w-3" />}
                {visibleToCustomer ? 'Visible' : 'Hidden'}
              </button>
              <button type="submit" disabled={uploadingDocument || !file || !label.trim()}
                className="flex-1 flex items-center justify-center gap-1 px-2 py-2 bg-indigo-600 text-white text-[11px] font-semibold rounded-md hover:bg-indigo-700 disabled:opacity-50">
                {uploadingDocument ? (
                  <><div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>…</>
                ) : (
                  <><FiUpload className="h-3 w-3" />Upload</>
                )}
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <FiMessageSquare className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />
            <input type="text" value={remark} onChange={(e) => setRemark(e.target.value)}
              placeholder="Customer remark (e.g. Password: 1234) — shown on tracking page"
              className="flex-1 px-2.5 py-1.5 text-xs border border-amber-200 bg-amber-50/40 rounded-md focus:ring-2 focus:ring-amber-400/40 focus:border-amber-400 outline-none placeholder:text-amber-700/40" />
          </div>
        </form>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {documentsLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
            <span className="ml-2 text-xs text-gray-500">Loading…</span>
          </div>
        ) : documents.length === 0 ? (
          <div className="text-center py-8">
            <FiFileText className="mx-auto h-6 w-6 text-gray-400 mb-1.5" />
            <p className="text-xs font-medium text-gray-700">No documents yet</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {documents.map((doc) => {
              const { Icon, color, bg } = getFileIcon(doc);
              return (
                <div key={doc.id} className="p-3 hover:bg-gray-50/60 transition-colors">
                  <div className="flex items-start gap-2.5">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${bg}`}>
                      <Icon className={`h-3.5 w-3.5 ${color}`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-gray-900 truncate">{doc.label}</p>
                          <p className="text-[10px] text-gray-500 truncate">
                            {doc.file_name || 'document'} · {formatBytes(doc.file_size)} · {formatDate(doc.created_at)}
                          </p>
                        </div>
                        <div className="flex items-center gap-0.5 flex-shrink-0">
                          <button onClick={() => onToggleVisibility(doc.id, !doc.visible_to_customer)}
                            className={`p-1 rounded-md border transition-all ${
                              doc.visible_to_customer
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                : 'bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200'
                            }`}
                            title={doc.visible_to_customer ? 'Visible' : 'Hidden'}>
                            {doc.visible_to_customer ? <FiEye className="h-3 w-3" /> : <FiEyeOff className="h-3 w-3" />}
                          </button>
                          {(doc.file_url || doc.url) && (
                            <a href={doc.file_url || doc.url} target="_blank" rel="noopener noreferrer"
                              className="p-1 rounded-md text-gray-400 hover:text-indigo-600 hover:bg-indigo-50" title="View">
                              <FiEye className="h-3 w-3" />
                            </a>
                          )}
                          <button onClick={() => { if (window.confirm(`Delete "${doc.label}"?`)) onDelete(doc.id); }}
                            className="p-1 rounded-md text-gray-400 hover:text-rose-600 hover:bg-rose-50" title="Delete">
                            <FiTrash2 className="h-3 w-3" />
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

const HistoryView = ({ activityHistory, activityLoading }) => {
  if (activityLoading) {
    return (
      <div className="space-y-3">
        <h3 className="text-xs font-semibold text-gray-700">Activity History</h3>
        <div className="flex items-center justify-center py-8">
          <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <span className="ml-2 text-xs text-gray-500">Loading…</span>
        </div>
      </div>
    );
  }
  if (!activityHistory || activityHistory.length === 0) {
    return (
      <div className="space-y-3">
        <h3 className="text-xs font-semibold text-gray-700">Activity History</h3>
        <div className="text-center py-8 bg-white rounded-lg border border-gray-200">
          <FiClock className="mx-auto h-6 w-6 text-gray-400 mb-1.5" />
          <p className="text-xs text-gray-500">No activity yet</p>
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-gray-700">Activity History</h3>
        <span className="text-[10px] text-gray-500">{activityHistory.length} {activityHistory.length === 1 ? 'event' : 'events'}</span>
      </div>
      <div className="space-y-2">
        {activityHistory.map((activity) => (
          <ActivityItem
            key={activity.id}
            action={activity.action}
            description={activity.description}
            time={activity.created_at ? formatTimelineDate(activity.created_at) : 'Unknown time'}
            user={activity.performed_by_name || 'System'}
          />
        ))}
      </div>
    </div>
  );
};

export default TrackServicePage;