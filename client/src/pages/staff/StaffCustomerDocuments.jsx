import React, { useState, useEffect } from 'react';
import { 
  FiFile, FiCheck, FiX, FiClock, FiDownload, FiUpload, FiEye, 
  FiUser, FiUsers, FiBriefcase, FiInfo, FiSearch, FiFilter, 
  FiChevronRight, FiCalendar, FiRefreshCw, FiPlus, FiTrash2, 
  FiEdit, FiChevronDown, FiHome, FiMapPin, FiGlobe, FiShield,
  FiMessageSquare, FiAlertCircle
} from 'react-icons/fi';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { 
  getStaffCustomerDocuments, 
  getDocumentMaster, 
  uploadStaffDocument, 
  reviewDocument, 
  downloadDocumentFile, 
  viewDocument,
  getCustomerServices,
  getCustomerHouseholds
} from '@/services/staffDocumentService';

// Form controls in the modals, in the app theme
const MODAL_FIELD = 'h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-base text-slate-900 focus:border-navy-500/40 focus:outline-none focus:ring-2 focus:ring-navy-500/30 disabled:bg-slate-50 sm:text-sm';
const MODAL_LABEL = 'mb-1.5 block text-sm font-medium text-slate-700';

const StaffCustomerDocuments = ({ customerId }) => {
  const [documents, setDocuments] = useState([]);
  const [filteredDocuments, setFilteredDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [filters, setFilters] = useState({
    scope: 'all',
    status: 'all',
    uploadedBy: 'all',
    showOldVersions: false
  });
  const [searchQuery, setSearchQuery] = useState('');
  
  // New state for services and households
  const [customerServices, setCustomerServices] = useState([]);
  const [loadingServices, setLoadingServices] = useState(false);
  
  const [uploadForm, setUploadForm] = useState({
    file: null,
    documentName: '',
    documentNumber: '',
    documentType: 'identity',
    expiryDate: '',
    scope: 'individual',
    householdId: '',
    serviceEntryId: '', // New field for service documents
    rationCardType: 'general',
    district: '',
    state: ''
  });
  const [reviewForm, setReviewForm] = useState({
    status: 'approved',
    remarks: ''
  });
  const [documentMaster, setDocumentMaster] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [households, setHouseholds] = useState([]);
  const [selectedDocMeta, setSelectedDocMeta] = useState(null);

// Fetch customer services
const fetchCustomerServices = async () => {
  if (!customerId) return;
  
  setLoadingServices(true);
  try {
    const res = await getCustomerServices(customerId);
    console.log("🔍 Full response object:", res);
    console.log("🔍 Response type:", typeof res);
    console.log("🔍 Response keys:", Object.keys(res));
    
    // Check different possible response structures
    let servicesData = [];
    
    if (Array.isArray(res)) {
      console.log("✅ Response is an array directly");
      servicesData = res;
    } else if (res.data && Array.isArray(res.data)) {
      console.log("✅ Response has data array");
      servicesData = res.data;
    } else if (res.services && Array.isArray(res.services)) {
      console.log("✅ Response has services array");
      servicesData = res.services;
    } else {
      console.log("❌ Unexpected response structure:", res);
    }
    
    console.log("📊 Services data being set:", servicesData);
    console.log("📊 Number of services:", servicesData.length);
    
    if (servicesData.length > 0) {
      console.log("📊 First service example:", servicesData[0]);
    }
    
    setCustomerServices(servicesData);
    
  } catch (err) {
    console.error("❌ Failed to fetch customer services", err);
    console.error("❌ Error details:", err.response || err.message);
  } finally {
    setLoadingServices(false);
  }
};

  // Fetch documents
  const fetchDocuments = async () => {
    try {
      const res = await getStaffCustomerDocuments(customerId, filters.showOldVersions);
      setDocuments(res.data || []);
    } catch (err) {
      console.error("Failed to fetch documents", err);
      toast.error("Failed to load documents");
    }
  };

  // Fetch document master
  const fetchDocumentMaster = async () => {
    try {
      const res = await getDocumentMaster();
      setDocumentMaster(res.data || []);
    } catch (err) {
      console.error("Failed to fetch document master", err);
      toast.error("Failed to load document types");
    }
  };

  // Fetch households
  const fetchHouseholds = async () => {
    try {
      const res = await getCustomerHouseholds(customerId);
      setHouseholds(res.data || []);
    } catch (err) {
      console.error("Failed to fetch households", err);
    }
  };

  useEffect(() => {
    if (!customerId) return;

    const load = async () => {
      setLoading(true);
      try {
        await Promise.all([
          fetchDocuments(),
          fetchDocumentMaster(),
          fetchHouseholds(),
          fetchCustomerServices()
        ]);
      } catch (err) {
        console.error("Failed to load customer documents", err);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [customerId]);

  // Re-fetch when showOldVersions changes
  useEffect(() => {
    if (customerId) {
      fetchDocuments();
    }
  }, [filters.showOldVersions]);

  // Filter documents based on search
  useEffect(() => {
    let filtered = documents.filter(doc => 
      doc.document_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.document_type?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (doc.document_number && doc.document_number.includes(searchQuery)) ||
      (doc.masked_document_number && doc.masked_document_number.includes(searchQuery))
    );

    // Apply scope filter
    if (filters.scope !== 'all') {
      filtered = filtered.filter(doc => doc.scope === filters.scope);
    }

    // Apply status filter
    if (filters.status !== 'all') {
      filtered = filtered.filter(doc => doc.status === filters.status);
    }

    // Apply uploaded by filter
    if (filters.uploadedBy !== 'all') {
      filtered = filtered.filter(doc => doc.uploaded_by === filters.uploadedBy);
    }

    setFilteredDocuments(filtered);
  }, [searchQuery, documents, filters]);

  // Helper functions
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const getStatusColor = (status) => {
    switch(status) {
      case 'approved': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'rejected': return 'bg-rose-100 text-rose-800 border-rose-200';
      case 'pending': return 'bg-amber-100 text-amber-800 border-amber-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getScopeColor = (scope) => {
    switch(scope) {
      case 'individual': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'household': return 'bg-green-100 text-green-800 border-green-200';
      case 'service': return 'bg-purple-100 text-purple-800 border-purple-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getUploadedByColor = (uploadedBy) => {
    switch(uploadedBy) {
      case 'staff': return 'bg-indigo-100 text-indigo-800 border-indigo-200';
      case 'customer': return 'bg-amber-100 text-amber-800 border-amber-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  // Handle document review
  const handleReviewClick = (doc) => {
    setSelectedDocument(doc);
    setReviewForm({
      status: doc.status,
      remarks: doc.review_remarks || ''
    });
    setShowReviewModal(true);
  };

  const handleReviewSubmit = async (e) => {
    e.preventDefault();
    
    if (!selectedDocument) return;

    try {
      setIsSubmitting(true);
      
      await reviewDocument(selectedDocument.id, {
        status: reviewForm.status,
        remarks: reviewForm.remarks
      });

      setShowReviewModal(false);
      setSelectedDocument(null);
      await fetchDocuments();
      
      toast.success(`Document marked as ${reviewForm.status}`);
    } catch (err) {
      console.error("Review failed", err);
      toast.error(err.response?.data?.message || "Review failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle scope change - fetch services when scope is service
  const handleScopeChange = (e) => {
    const newScope = e.target.value;
    setUploadForm({
      ...uploadForm,
      scope: newScope,
      serviceEntryId: '', // Reset service selection when scope changes
      householdId: '' // Reset household selection when scope changes
    });
    
    // Fetch services if scope is service and we haven't loaded them yet
    if (newScope === 'service' && customerServices.length === 0) {
      fetchCustomerServices();
    }
  };

  // Handle staff upload
  const handleUploadSubmit = async (e) => {
    e.preventDefault();

    if (!uploadForm.file) {
      toast.error('Please select a file to upload');
      return;
    }

    if (!uploadForm.documentName.trim()) {
      toast.error('Please select a document type');
      return;
    }

    // Get selected document metadata
    const selectedDoc = documentMaster.find(d => d.name === uploadForm.documentName);

    // Validate based on scope
    if (uploadForm.scope === 'service') {
      if (!uploadForm.serviceEntryId) {
        toast.error('Please select a service application for this document');
        return;
      }
    }

    if (uploadForm.scope === 'household') {
      if (!selectedDoc?.creates_household && !uploadForm.householdId) {
        toast.error('Please select a household for this document');
        return;
      }
    }

    // Validate required fields from document master
    if (selectedDoc?.requires_number && !uploadForm.documentNumber.trim()) {
      toast.error(`Document number is required for ${uploadForm.documentName}`);
      return;
    }

    if (selectedDoc?.requires_expiry && !uploadForm.expiryDate) {
      toast.error(`Expiry date is required for ${uploadForm.documentName}`);
      return;
    }

    try {
      setIsSubmitting(true);
      const formData = new FormData();
      
      formData.append("file", uploadForm.file);
      formData.append("document_name", uploadForm.documentName);
      formData.append("scope", uploadForm.scope);
      
      // Only append document number if provided
      if (uploadForm.documentNumber.trim()) {
        formData.append("document_number", uploadForm.documentNumber);
      }
      
      // Only append expiry date if provided
      if (uploadForm.expiryDate) {
        formData.append("expiry_date", uploadForm.expiryDate);
      }
      
      if (uploadForm.documentType && uploadForm.documentType !== 'identity') {
        formData.append("document_type", uploadForm.documentType);
      }
      
      // Handle different scopes
      if (uploadForm.scope === 'household') {
        if (selectedDoc?.creates_household) {
          if (uploadForm.rationCardType) {
            formData.append("ration_card_type", uploadForm.rationCardType);
          }
          if (uploadForm.district) {
            formData.append("district", uploadForm.district);
          }
          if (uploadForm.state) {
            formData.append("state", uploadForm.state);
          }
        } else if (uploadForm.householdId) {
          formData.append("household_id", uploadForm.householdId);
        }
      } else if (uploadForm.scope === 'service') {
        // CRITICAL: Append service_entry_id for service documents
        formData.append("service_entry_id", uploadForm.serviceEntryId);
      }

      await uploadStaffDocument(customerId, formData);

      // Reset form and close modal
      setShowUploadModal(false);
      setUploadForm({
        file: null,
        documentName: '',
        documentNumber: '',
        documentType: 'identity',
        expiryDate: '',
        scope: 'individual',
        householdId: '',
        serviceEntryId: '',
        rationCardType: 'general',
        district: '',
        state: ''
      });
      setSelectedDocMeta(null);

      // Refresh data
      await fetchDocuments();

      toast.success('Document uploaded successfully!');
    } catch (err) {
      console.error("Upload failed", err);
      toast.error(err.response?.data?.message || "Document upload failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Download document using service function
  const handleDownloadDocument = async (docId, docName) => {
    try {
      const { blob, filename } = await downloadDocumentFile(docId);
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = docName || filename || 'document';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast.success('Download started');
    } catch (err) {
      console.error("Download failed", err);
      toast.error(err.response?.data?.message || "Unable to download document");
    }
  };

  // View document using service function
  const handleViewDocument = async (docId) => {
    try {
      const url = await viewDocument(docId);
      window.open(url, '_blank');
    } catch (err) {
      console.error("View document failed", err);
      toast.error(err.response?.data?.message || "Unable to open document");
    }
  };

  // Stats
  const stats = {
    total: documents.length,
    approved: documents.filter(d => d.status === 'approved').length,
    pending: documents.filter(d => d.status === 'pending').length,
    rejected: documents.filter(d => d.status === 'rejected').length,
    staffUploaded: documents.filter(d => d.uploaded_by === 'staff').length,
    customerUploaded: documents.filter(d => d.uploaded_by === 'customer').length,
    individual: documents.filter(d => d.scope === 'individual').length,
    household: documents.filter(d => d.scope === 'household').length,
    service: documents.filter(d => d.scope === 'service').length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-navy-700 border-t-transparent"></div>
          <p className="mt-4 text-gray-600">Loading documents...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      
      {/* Toolbar: status chips (filter), search, more filters, refresh, upload */}
      <div className="mb-2 flex flex-wrap items-center gap-2">
        {[['all', 'All', stats.total], ['approved', 'Approved', stats.approved], ['pending', 'Pending', stats.pending], ['rejected', 'Rejected', stats.rejected]].map(([value, label, count]) => (
          <button
            key={value}
            type="button"
            onClick={() => setFilters({ ...filters, status: value })}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${filters.status === value ? 'bg-navy-700 text-white' : 'border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
          >
            {label} {count}
          </button>
        ))}

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-48">
            <FiSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search documents"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="min-h-[36px] w-full rounded-xl border border-slate-300 bg-white py-1.5 pl-9 pr-3 text-base focus:border-navy-500/40 focus:ring-2 focus:ring-navy-500/30 sm:text-sm"
            />
          </div>

          <details className="relative">
            <summary className="inline-flex h-9 cursor-pointer list-none items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50">
              <FiFilter className="h-4 w-4" />
              Filters
              {(filters.scope !== 'all' || filters.uploadedBy !== 'all' || filters.showOldVersions) && (
                <span className="h-1.5 w-1.5 rounded-full bg-navy-700" aria-label="Filters on" />
              )}
            </summary>
            <div className="absolute right-0 z-20 mt-2 w-60 space-y-3 rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
              <label className="block text-xs font-medium text-slate-600">
                Scope
                <select
                  value={filters.scope}
                  onChange={(e) => setFilters({ ...filters, scope: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm"
                >
                  <option value="all">All scopes</option>
                  <option value="individual">Individual</option>
                  <option value="household">Household</option>
                  <option value="service">Service</option>
                </select>
              </label>
              <label className="block text-xs font-medium text-slate-600">
                Uploaded by
                <select
                  value={filters.uploadedBy}
                  onChange={(e) => setFilters({ ...filters, uploadedBy: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm"
                >
                  <option value="all">Anyone</option>
                  <option value="staff">Staff</option>
                  <option value="customer">Customer</option>
                </select>
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={filters.showOldVersions}
                  onChange={(e) => setFilters({ ...filters, showOldVersions: e.target.checked })}
                  className="h-4 w-4 accent-navy-700"
                />
                Show old versions
              </label>
            </div>
          </details>

          <button
            onClick={fetchDocuments}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
            disabled={isSubmitting}
          >
            <FiRefreshCw className="h-4 w-4" />
            Refresh
          </button>
          <button
            onClick={() => setShowUploadModal(true)}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-navy-700 px-3 text-sm font-medium text-white hover:bg-navy-800"
            disabled={isSubmitting}
          >
            <FiUpload className="h-4 w-4" />
            Upload
          </button>
        </div>
      </div>

      {/* Documents */}
      {filteredDocuments.length === 0 ? (
        <div className="py-10 text-center text-slate-500">
          <FiFile className="mx-auto mb-2 h-10 w-10 opacity-30" />
          <p className="text-sm font-medium">{documents.length === 0 ? 'No documents yet' : 'No documents match these filters'}</p>
        </div>
      ) : (
        <ul className="divide-y divide-slate-100">
          {filteredDocuments.map((doc) => {
            const expired = doc.expiry_date && new Date(doc.expiry_date) < new Date();
            const Icon = doc.scope === 'service' ? FiBriefcase : doc.scope === 'household' ? FiUsers : FiFile;
            return (
              <li
                key={doc.id}
                className="grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 px-1 py-2.5 sm:grid-cols-[2rem_minmax(0,1fr)_6.5rem_6.5rem_5.5rem_auto]"
              >
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-navy-500/10 text-navy-700">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-slate-900">
                    {doc.document_name}
                    {doc.scope !== 'individual' && (
                      <span className="ml-2 rounded-full border border-slate-200 px-1.5 py-0.5 align-middle text-[10px] font-medium capitalize text-slate-600">{doc.scope}</span>
                    )}
                    {!doc.is_latest && (
                      <span className="ml-2 rounded-full border border-slate-200 px-1.5 py-0.5 align-middle text-[10px] font-medium text-slate-500">old v{doc.version}</span>
                    )}
                  </span>
                  <span className="block truncate text-xs text-slate-500">
                    Uploaded by {doc.uploaded_by === 'staff' ? 'staff' : 'customer'} · {formatDate(doc.created_at)} · {formatFileSize(doc.file_size)}
                  </span>
                </span>
                <span className="hidden font-mono text-xs text-slate-600 sm:block">
                  {doc.document_number_last4 ? `XXXX-${doc.document_number_last4}` : '—'}
                </span>
                <span className={`hidden text-xs sm:block ${expired ? 'font-medium text-rose-600' : 'text-slate-500'}`}>
                  {doc.expiry_date ? `${expired ? 'Expired ' : ''}${formatDate(doc.expiry_date)}` : 'No expiry'}
                </span>
                <span className={`hidden justify-self-start rounded-full border px-2 py-0.5 text-xs font-medium capitalize sm:inline-block ${getStatusColor(doc.status)}`}>
                  {doc.status}
                </span>
                <span className="flex items-center justify-end gap-1">
                  {doc.uploaded_by === 'customer' && doc.status === 'pending' && (
                    <button
                      onClick={() => handleReviewClick(doc)}
                      className="inline-flex h-8 items-center gap-1 rounded-lg bg-navy-700 px-2.5 text-xs font-medium text-white hover:bg-navy-800"
                      title="Review"
                    >
                      <FiCheck className="h-3.5 w-3.5" /> Review
                    </button>
                  )}
                  {doc.review_remarks && (
                    <button
                      onClick={() => toast.info(doc.review_remarks, { autoClose: 5000, position: 'top-center' })}
                      className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-navy-700"
                      title="Review remarks"
                      aria-label="Review remarks"
                    >
                      <FiMessageSquare className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    onClick={() => handleViewDocument(doc.id)}
                    className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-navy-700"
                    title="View"
                    aria-label="View"
                  >
                    <FiEye className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDownloadDocument(doc.id, doc.document_name)}
                    className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-navy-700"
                    title="Download"
                    aria-label="Download"
                  >
                    <FiDownload className="h-4 w-4" />
                  </button>
                </span>
                {/* phones: status + expiry under the name */}
                <span className="col-span-2 col-start-2 flex items-center gap-2 text-xs sm:hidden">
                  <span className={`rounded-full border px-2 py-0.5 font-medium capitalize ${getStatusColor(doc.status)}`}>{doc.status}</span>
                  <span className={expired ? 'font-medium text-rose-600' : 'text-slate-500'}>
                    {doc.expiry_date ? `${expired ? 'Expired ' : 'Expires '}${formatDate(doc.expiry_date)}` : 'No expiry'}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {/* Upload Modal for Staff */}
      {showUploadModal && (() => {
        const canUpload =
          uploadForm.file &&
          uploadForm.documentName.trim() &&
          uploadForm.scope &&
          !isSubmitting &&
          (uploadForm.scope !== 'service' || uploadForm.serviceEntryId) &&
          (uploadForm.scope !== 'household' || selectedDocMeta?.creates_household || uploadForm.householdId);
        const pickFile = (file) => { if (file && !isSubmitting) setUploadForm({ ...uploadForm, file }); };
        return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
            {/* Header */}
            <div className="flex shrink-0 items-center gap-3 border-b border-slate-200 px-5 py-4">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-navy-700 text-white">
                <FiUpload className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-semibold text-slate-900 sm:text-lg">Upload document</h3>
                <p className="text-xs text-slate-500 sm:text-sm">Added to this customer's documents by staff</p>
              </div>
              <button
                type="button"
                onClick={() => setShowUploadModal(false)}
                className="grid h-9 w-9 place-items-center rounded-xl text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
                disabled={isSubmitting}
                aria-label="Close"
              >
                <FiX className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleUploadSubmit} className="flex min-h-0 flex-1 flex-col">
              <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5">
                {/* File */}
                <div>
                  <label className={MODAL_LABEL}>File <span className="text-rose-500">*</span></label>
                  {uploadForm.file ? (
                    <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-navy-700 ring-1 ring-slate-200">
                        <FiFile className="h-5 w-5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-900">{uploadForm.file.name}</p>
                        <p className="text-xs text-slate-500">{formatFileSize(uploadForm.file.size)}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setUploadForm({ ...uploadForm, file: null })}
                        className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                        disabled={isSubmitting}
                      >
                        <FiTrash2 className="h-4 w-4" />
                        Remove
                      </button>
                    </div>
                  ) : (
                    <label
                      htmlFor="staff-file-upload"
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => { e.preventDefault(); pickFile(e.dataTransfer.files?.[0]); }}
                      className="flex cursor-pointer flex-col items-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center transition-colors hover:border-navy-500 hover:bg-navy-50"
                    >
                      <span className="mb-3 grid h-12 w-12 place-items-center rounded-xl bg-white text-navy-700 ring-1 ring-slate-200">
                        <FiUpload className="h-5 w-5" />
                      </span>
                      <span className="text-sm text-slate-700">
                        <span className="font-semibold text-navy-700">Choose a file</span> or drop it here
                      </span>
                      <span className="mt-1 text-xs text-slate-500">PDF, JPG, PNG or DOC · up to 5 MB</span>
                      <input
                        type="file"
                        id="staff-file-upload"
                        className="hidden"
                        onChange={(e) => pickFile(e.target.files[0])}
                        accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                        disabled={isSubmitting}
                      />
                    </label>
                  )}
                </div>

                {/* Document type + category */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className={MODAL_LABEL}>Document type <span className="text-rose-500">*</span></label>
                    <select
                      value={uploadForm.documentName}
                      onChange={(e) => {
                        const selectedDoc = documentMaster.find(d => d.name === e.target.value);
                        setSelectedDocMeta(selectedDoc || null);
                        setUploadForm({
                          ...uploadForm,
                          documentName: e.target.value,
                          documentNumber: '',
                          expiryDate: '',
                          // Don't change scope here - let user select scope separately
                        });
                      }}
                      className={MODAL_FIELD}
                      required
                      disabled={isSubmitting}
                    >
                      <option value="">Select document type</option>
                      {documentMaster.map(doc => (
                        <option key={doc.name} value={doc.name}>
                          {doc.name} ({doc.scope}){doc.requires_number ? ' · number' : ''}{doc.requires_expiry ? ' · expiry' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={MODAL_LABEL}>Category</label>
                    <select
                      value={uploadForm.documentType}
                      onChange={(e) => setUploadForm({...uploadForm, documentType: e.target.value})}
                      className={MODAL_FIELD}
                      disabled={isSubmitting}
                    >
                      <option value="identity">Identity Proof</option>
                      <option value="tax">Tax Document</option>
                      <option value="income">Income Certificate</option>
                      <option value="family">Family Document</option>
                      <option value="certificate">Certificate</option>
                      <option value="photo">Photograph</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>

                {/* Scope */}
                <div>
                  <label className={MODAL_LABEL}>Belongs to <span className="text-rose-500">*</span></label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      ['individual', 'Individual', FiUser],
                      ['household', 'Household', FiHome],
                      ['service', 'Service', FiBriefcase],
                    ].map(([value, label, Icon]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => handleScopeChange({ target: { value } })}
                        disabled={isSubmitting}
                        className={`inline-flex h-10 items-center justify-center gap-2 rounded-xl text-sm font-medium transition-colors ${
                          uploadForm.scope === value
                            ? 'bg-navy-700 text-white'
                            : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Service selection */}
                {uploadForm.scope === 'service' && (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <label className={MODAL_LABEL}>Application <span className="text-rose-500">*</span></label>
                    {loadingServices ? (
                      <div className="flex items-center gap-2 py-2 text-sm text-slate-500">
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-navy-700 border-t-transparent" />
                        Loading applications…
                      </div>
                    ) : customerServices.length > 0 ? (
                      <select
                        value={uploadForm.serviceEntryId}
                        onChange={(e) => setUploadForm({...uploadForm, serviceEntryId: e.target.value})}
                        className={MODAL_FIELD}
                        required
                        disabled={isSubmitting}
                      >
                        <option value="">Select an application</option>
                        {customerServices.map(service => (
                          <option key={service.id} value={service.id}>
                            {service.service_name} - {service.application_number || 'N/A'} ({service.status})
                          </option>
                        ))}
                      </select>
                    ) : (
                      <p className="text-sm text-slate-500">
                        This customer has no in-progress or completed applications.
                      </p>
                    )}
                  </div>
                )}

                {/* Household: create new */}
                {uploadForm.scope === 'household' && selectedDocMeta?.creates_household && (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="mb-3 text-sm font-semibold text-slate-800">New household</p>
                    <div className="grid gap-4 sm:grid-cols-3">
                      <div>
                        <label className={MODAL_LABEL}>Ration card type</label>
                        <select
                          value={uploadForm.rationCardType}
                          onChange={(e) => setUploadForm({...uploadForm, rationCardType: e.target.value})}
                          className={MODAL_FIELD}
                          disabled={isSubmitting}
                        >
                          <option value="general">General</option>
                          <option value="blue">Blue</option>
                          <option value="red">Red</option>
                          <option value="white">White</option>
                          <option value="yellow">Yellow</option>
                        </select>
                      </div>
                      <div>
                        <label className={MODAL_LABEL}>District</label>
                        <input
                          type="text"
                          value={uploadForm.district}
                          onChange={(e) => setUploadForm({...uploadForm, district: e.target.value})}
                          placeholder="District"
                          className={MODAL_FIELD}
                          disabled={isSubmitting}
                        />
                      </div>
                      <div>
                        <label className={MODAL_LABEL}>State</label>
                        <input
                          type="text"
                          value={uploadForm.state}
                          onChange={(e) => setUploadForm({...uploadForm, state: e.target.value})}
                          placeholder="State"
                          className={MODAL_FIELD}
                          disabled={isSubmitting}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Household: pick existing */}
                {uploadForm.scope === 'household' && !selectedDocMeta?.creates_household && households.length > 0 && (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <label className={MODAL_LABEL}>Household <span className="text-rose-500">*</span></label>
                    <select
                      value={uploadForm.householdId}
                      onChange={(e) => setUploadForm({...uploadForm, householdId: e.target.value})}
                      className={MODAL_FIELD}
                      required
                      disabled={isSubmitting}
                    >
                      <option value="">Select a household</option>
                      {households.map(household => (
                        <option key={household.id} value={household.id}>
                          Ration Card: ****{household.ration_card_last4} ({household.ration_card_type})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Number + expiry (shown once a type is chosen) */}
                {uploadForm.documentName && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className={MODAL_LABEL}>
                        Document number{' '}
                        {selectedDocMeta?.requires_number
                          ? <span className="text-rose-500">*</span>
                          : <span className="font-normal text-slate-400">(optional)</span>}
                      </label>
                      <input
                        type="text"
                        value={uploadForm.documentNumber}
                        onChange={(e) => setUploadForm({...uploadForm, documentNumber: e.target.value})}
                        placeholder="Document number"
                        className={MODAL_FIELD}
                        disabled={isSubmitting}
                        required={!!selectedDocMeta?.requires_number}
                      />
                    </div>
                    <div>
                      <label className={MODAL_LABEL}>
                        Expiry date{' '}
                        {selectedDocMeta?.requires_expiry
                          ? <span className="text-rose-500">*</span>
                          : <span className="font-normal text-slate-400">(optional)</span>}
                      </label>
                      <input
                        type="date"
                        value={uploadForm.expiryDate}
                        onChange={(e) => setUploadForm({...uploadForm, expiryDate: e.target.value})}
                        className={MODAL_FIELD}
                        disabled={isSubmitting}
                        required={!!selectedDocMeta?.requires_expiry}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex shrink-0 justify-end gap-2 border-t border-slate-200 px-5 py-4">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="inline-flex h-10 items-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!canUpload}
                  className="inline-flex h-10 items-center gap-2 rounded-xl bg-navy-700 px-4 text-sm font-medium text-white transition-colors hover:bg-navy-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <FiUpload className="h-4 w-4" />
                  {isSubmitting ? 'Uploading…' : 'Upload'}
                </button>
              </div>
            </form>
          </div>
        </div>
        );
      })()}

      {/* Review Modal */}
      {showReviewModal && selectedDocument && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-xl">
            <div className="flex items-center gap-3 border-b border-slate-200 px-5 py-4">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-navy-700 text-white">
                <FiShield className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-semibold text-slate-900 sm:text-lg">Review document</h3>
                <p className="truncate text-xs text-slate-500 sm:text-sm">
                  {selectedDocument.document_name} · uploaded by {selectedDocument.uploaded_by}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowReviewModal(false)}
                className="grid h-9 w-9 place-items-center rounded-xl text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
                disabled={isSubmitting}
                aria-label="Close"
              >
                <FiX className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleReviewSubmit}>
              <div className="space-y-5 px-5 py-5">
                <div>
                  <label className={MODAL_LABEL}>Decision <span className="text-rose-500">*</span></label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      ['approved', 'Approve', FiCheck, 'bg-emerald-600 text-white'],
                      ['rejected', 'Reject', FiX, 'bg-rose-600 text-white'],
                      ['pending', 'Keep pending', FiClock, 'bg-amber-500 text-white'],
                    ].map(([value, label, Icon, activeClass]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setReviewForm({ ...reviewForm, status: value })}
                        disabled={isSubmitting}
                        aria-pressed={reviewForm.status === value}
                        className={`inline-flex h-10 items-center justify-center gap-1.5 rounded-xl px-2 text-sm font-medium transition-colors ${
                          reviewForm.status === value
                            ? activeClass
                            : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        <span className="truncate">{label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className={MODAL_LABEL}>
                    Remarks <span className="font-normal text-slate-400">(optional)</span>
                  </label>
                  <textarea
                    value={reviewForm.remarks}
                    onChange={(e) => setReviewForm({...reviewForm, remarks: e.target.value})}
                    placeholder="Add review remarks…"
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 focus:border-navy-500/40 focus:outline-none focus:ring-2 focus:ring-navy-500/30 disabled:bg-slate-50 sm:text-sm"
                    rows="3"
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4">
                <button
                  type="button"
                  onClick={() => setShowReviewModal(false)}
                  className="inline-flex h-10 items-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex h-10 items-center rounded-xl bg-navy-700 px-4 text-sm font-medium text-white transition-colors hover:bg-navy-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isSubmitting ? 'Submitting…' : 'Submit review'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default StaffCustomerDocuments;