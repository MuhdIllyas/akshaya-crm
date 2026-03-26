import React, { useState, useEffect } from 'react';
import { 
  FiFile, FiCheck, FiX, FiClock, FiDownload, FiUpload, FiEye, 
  FiUser, FiUsers, FiBriefcase, FiInfo, FiSearch, FiFilter, 
  FiChevronRight, FiCalendar, FiRefreshCw, FiPlus, FiTrash2, 
  FiEdit, FiChevronDown, FiHome, FiMapPin, FiGlobe, FiShield,
  FiMessageSquare, FiAlertCircle
} from 'react-icons/fi';
import { ToastContainer, toast } from 'react-toastify';
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
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading documents...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <ToastContainer position="top-right" autoClose={3000} />
      
      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Customer Documents</h1>
            <p className="text-gray-600 mt-1">Manage and review customer uploaded documents</p>
          </div>
          
          <div className="flex space-x-3">
            <button
              onClick={() => setShowUploadModal(true)}
              className="inline-flex items-center justify-center px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors duration-200 shadow-sm"
              disabled={isSubmitting}
            >
              <FiUpload className="mr-2" />
              Upload as Staff
            </button>
            
            <button
              onClick={fetchDocuments}
              className="inline-flex items-center justify-center px-5 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors duration-200 shadow-sm"
              disabled={isSubmitting}
            >
              <FiRefreshCw className="mr-2" />
              Refresh
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-6">
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total</p>
                <p className="text-2xl font-bold text-gray-800">{stats.total}</p>
              </div>
              <div className="bg-blue-50 p-2 rounded-lg">
                <FiFile className="text-blue-600" />
              </div>
            </div>
          </div>
          
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Approved</p>
                <p className="text-2xl font-bold text-emerald-600">{stats.approved}</p>
              </div>
              <div className="bg-emerald-50 p-2 rounded-lg">
                <FiCheck className="text-emerald-600" />
              </div>
            </div>
          </div>
          
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Pending</p>
                <p className="text-2xl font-bold text-amber-600">{stats.pending}</p>
              </div>
              <div className="bg-amber-50 p-2 rounded-lg">
                <FiClock className="text-amber-600" />
              </div>
            </div>
          </div>
          
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Rejected</p>
                <p className="text-2xl font-bold text-rose-600">{stats.rejected}</p>
              </div>
              <div className="bg-rose-50 p-2 rounded-lg">
                <FiX className="text-rose-600" />
              </div>
            </div>
          </div>
          
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Staff</p>
                <p className="text-2xl font-bold text-indigo-600">{stats.staffUploaded}</p>
              </div>
              <div className="bg-indigo-50 p-2 rounded-lg">
                <FiShield className="text-indigo-600" />
              </div>
            </div>
          </div>
          
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Customer</p>
                <p className="text-2xl font-bold text-amber-600">{stats.customerUploaded}</p>
              </div>
              <div className="bg-amber-50 p-2 rounded-lg">
                <FiUser className="text-amber-600" />
              </div>
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Service</p>
                <p className="text-2xl font-bold text-purple-600">{stats.service}</p>
              </div>
              <div className="bg-purple-50 p-2 rounded-lg">
                <FiBriefcase className="text-purple-600" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm mb-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex-1">
            <div className="relative">
              <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search documents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-gray-100 rounded-lg border border-gray-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 focus:bg-white"
              />
            </div>
          </div>
          
          <div className="flex flex-wrap gap-2">
            <select
              value={filters.scope}
              onChange={(e) => setFilters({...filters, scope: e.target.value})}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 text-sm"
            >
              <option value="all">All Scopes</option>
              <option value="individual">Individual</option>
              <option value="household">Household</option>
              <option value="service">Service</option>
            </select>
            
            <select
              value={filters.status}
              onChange={(e) => setFilters({...filters, status: e.target.value})}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 text-sm"
            >
              <option value="all">All Status</option>
              <option value="approved">Approved</option>
              <option value="pending">Pending</option>
              <option value="rejected">Rejected</option>
            </select>
            
            <select
              value={filters.uploadedBy}
              onChange={(e) => setFilters({...filters, uploadedBy: e.target.value})}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 text-sm"
            >
              <option value="all">All Uploaders</option>
              <option value="staff">Staff Uploads</option>
              <option value="customer">Customer Uploads</option>
            </select>
            
            <label className="flex items-center space-x-2 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer">
              <input
                type="checkbox"
                checked={filters.showOldVersions}
                onChange={(e) => setFilters({...filters, showOldVersions: e.target.checked})}
                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-sm text-gray-700">Show Old Versions</span>
            </label>
          </div>
        </div>
      </div>

      {/* Documents List */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {filteredDocuments.length === 0 ? (
          <div className="text-center py-12">
            <FiFile className="mx-auto h-12 w-12 text-gray-400 mb-3" />
            <p className="text-gray-500 text-sm">No documents found</p>
            <p className="text-xs text-gray-400 mt-1">Try adjusting your filters or search</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Document</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Scope</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Number</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Uploaded By</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Version</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Expiry</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredDocuments.map((doc) => (
                  <tr key={doc.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div className="flex-shrink-0">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                            doc.scope === 'service' ? 'bg-purple-500' : 
                            doc.scope === 'household' ? 'bg-green-500' : 'bg-blue-500'
                          }`}>
                            {doc.scope === 'service' ? (
                              <FiBriefcase className="h-4 w-4 text-white" />
                            ) : doc.scope === 'household' ? (
                              <FiUsers className="h-4 w-4 text-white" />
                            ) : (
                              <FiFile className="h-4 w-4 text-white" />
                            )}
                          </div>
                        </div>
                        <div className="ml-3">
                          <p className="text-sm font-medium text-gray-900">{doc.document_name}</p>
                          <p className="text-xs text-gray-500">{doc.document_type}</p>
                          <p className="text-xs text-gray-400 mt-1">
                            {formatDate(doc.created_at)} • {formatFileSize(doc.file_size)}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 text-xs rounded-full ${getScopeColor(doc.scope)}`}>
                        {doc.scope}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">
                        {doc.masked_document_number || 'N/A'}
                      </div>
                      <div className="text-xs text-gray-500">
                        Last4: {doc.document_number_last4 || 'N/A'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(doc.status)}`}>
                        {doc.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 text-xs rounded-full ${getUploadedByColor(doc.uploaded_by)}`}>
                        {doc.uploaded_by}
                      </span>
                      {doc.uploaded_by === 'staff' && doc.reviewed_by_staff_name && (
                        <p className="text-xs text-gray-500 mt-1">Reviewed by: {doc.reviewed_by_staff_name}</p>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">
                        v{doc.version}
                        {doc.is_latest && (
                          <span className="ml-2 px-1.5 py-0.5 text-xs bg-emerald-100 text-emerald-800 rounded">
                            Latest
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className={`text-sm ${doc.expiry_date && new Date(doc.expiry_date) < new Date() ? 'text-rose-600' : 'text-gray-900'}`}>
                        {doc.expiry_date ? formatDate(doc.expiry_date) : 'N/A'}
                        {doc.expiry_date && new Date(doc.expiry_date) < new Date() && (
                          <span className="ml-2 px-1.5 py-0.5 text-xs bg-rose-100 text-rose-800 rounded">
                            Expired
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleDownloadDocument(doc.id, doc.document_name)}
                          className="p-1.5 text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 rounded"
                          title="Download"
                        >
                          <FiDownload />
                        </button>
                        <button
                          onClick={() => handleViewDocument(doc.id)}
                          className="p-1.5 text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 rounded"
                          title="View"
                        >
                          <FiEye />
                        </button>
                        {doc.uploaded_by === 'customer' && doc.status === 'pending' && (
                          <button
                            onClick={() => handleReviewClick(doc)}
                            className="p-1.5 text-amber-600 hover:text-amber-700 hover:bg-amber-50 rounded"
                            title="Review"
                          >
                            <FiCheck />
                          </button>
                        )}
                        {doc.review_remarks && (
                          <button
                            onClick={() => {
                              toast.info(doc.review_remarks, {
                                autoClose: 5000,
                                position: 'top-center'
                              });
                            }}
                            className="p-1.5 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded"
                            title="View Remarks"
                          >
                            <FiMessageSquare />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Upload Modal for Staff */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-gray-800">
                  Upload Document as Staff
                </h3>
                <button
                  onClick={() => setShowUploadModal(false)}
                  className="text-gray-500 hover:text-gray-700 p-2"
                  disabled={isSubmitting}
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleUploadSubmit}>
                <div className="space-y-4">
                  {/* File Upload */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Select Document (Max 5MB) *
                    </label>
                    <div 
                      className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-indigo-400 transition-colors cursor-pointer"
                      onClick={() => document.getElementById('staff-file-upload').click()}
                    >
                      {uploadForm.file ? (
                        <div className="text-center">
                          <FiFile className="text-4xl text-indigo-600 mx-auto mb-2" />
                          <p className="font-medium text-gray-800">{uploadForm.file.name}</p>
                          <p className="text-sm text-gray-500 mt-1">
                            {formatFileSize(uploadForm.file.size)}
                          </p>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setUploadForm({...uploadForm, file: null});
                            }}
                            className="text-rose-600 hover:text-rose-700 text-sm font-medium mt-3"
                            disabled={isSubmitting}
                          >
                            Remove File
                          </button>
                        </div>
                      ) : (
                        <>
                          <FiUpload className="text-4xl text-gray-400 mx-auto mb-4" />
                          <p className="text-gray-600 mb-2">
                            <span className="font-medium text-indigo-700">Click to browse</span> or drag and drop
                          </p>
                          <p className="text-sm text-gray-500">
                            PDF, JPG, PNG, DOC up to 5MB
                          </p>
                          <input
                            type="file"
                            id="staff-file-upload"
                            className="hidden"
                            onChange={(e) => setUploadForm({...uploadForm, file: e.target.files[0]})}
                            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                            disabled={isSubmitting}
                          />
                        </>
                      )}
                    </div>
                  </div>

                  {/* Document Type */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Document Type *
                    </label>
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
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
                      required
                      disabled={isSubmitting}
                    >
                      <option value="">Select document type</option>
                      {documentMaster.map(doc => (
                        <option key={doc.name} value={doc.name}>
                          {doc.name} ({doc.scope}) {doc.requires_number ? ' [Number Required]' : ''} {doc.requires_expiry ? ' [Expiry Required]' : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Document Category */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Document Category
                    </label>
                    <select
                      value={uploadForm.documentType}
                      onChange={(e) => setUploadForm({...uploadForm, documentType: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
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

                  {/* Scope Selection - This is the key dropdown */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Scope *
                    </label>
                    <select
                      value={uploadForm.scope}
                      onChange={handleScopeChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
                      required
                      disabled={isSubmitting}
                    >
                      <option value="individual">Individual</option>
                      <option value="household">Household</option>
                      <option value="service">Service</option>
                    </select>
                  </div>

                  {/* Service Selection - Show when scope is service */}
                  {uploadForm.scope === 'service' && (
                    <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                      <h4 className="font-medium text-purple-800 mb-3 flex items-center">
                        <FiBriefcase className="mr-2" />
                        Select Service Application *
                      </h4>
                      
                      {loadingServices ? (
                        <div className="text-center py-4">
                          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600 mx-auto"></div>
                          <p className="text-sm text-purple-600 mt-2">Loading services...</p>
                        </div>
                      ) : customerServices.length > 0 ? (
                        <select
                          value={uploadForm.serviceEntryId}
                          onChange={(e) => setUploadForm({...uploadForm, serviceEntryId: e.target.value})}
                          className="w-full px-4 py-2 border border-purple-300 rounded-lg focus:border-purple-500 focus:ring-2 focus:ring-purple-200"
                          required
                          disabled={isSubmitting}
                        >
                          <option value="">Select a service application</option>
                          {customerServices.map(service => (
                            <option key={service.id} value={service.id}>
                              {service.service_name} - {service.application_number || 'N/A'} ({service.status})
                            </option>
                          ))}
                        </select>
                      ) : (
                        <div className="text-center py-4 bg-white rounded-lg border border-purple-200">
                          <p className="text-gray-600 mb-2">No service applications found</p>
                          <p className="text-sm text-gray-500">
                            This customer doesn't have any in-progress or completed services
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Document Number Field - conditionally required */}
                  {selectedDocMeta?.requires_number && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Document Number *
                      </label>
                      <input
                        type="text"
                        value={uploadForm.documentNumber}
                        onChange={(e) => setUploadForm({...uploadForm, documentNumber: e.target.value})}
                        placeholder="Enter document number"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
                        disabled={isSubmitting}
                        required
                      />
                    </div>
                  )}

                  {/* Optional Document Number */}
                  {uploadForm.documentName && !selectedDocMeta?.requires_number && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Document Number (Optional)
                      </label>
                      <input
                        type="text"
                        value={uploadForm.documentNumber}
                        onChange={(e) => setUploadForm({...uploadForm, documentNumber: e.target.value})}
                        placeholder="Enter document number (optional)"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
                        disabled={isSubmitting}
                      />
                    </div>
                  )}

                  {/* Expiry Date Field - conditionally required */}
                  {selectedDocMeta?.requires_expiry && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Expiry Date *
                      </label>
                      <input
                        type="date"
                        value={uploadForm.expiryDate}
                        onChange={(e) => setUploadForm({...uploadForm, expiryDate: e.target.value})}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
                        disabled={isSubmitting}
                        required
                      />
                    </div>
                  )}

                  {/* Optional Expiry Date */}
                  {uploadForm.documentName && !selectedDocMeta?.requires_expiry && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Expiry Date (Optional)
                      </label>
                      <input
                        type="date"
                        value={uploadForm.expiryDate}
                        onChange={(e) => setUploadForm({...uploadForm, expiryDate: e.target.value})}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
                        disabled={isSubmitting}
                      />
                    </div>
                  )}

                  {/* Household Creation Fields - for household scope */}
                  {uploadForm.scope === 'household' && selectedDocMeta?.creates_household && (
                    <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                      <h4 className="font-medium text-blue-800 mb-3 flex items-center">
                        <FiHome className="mr-2" />
                        Create New Household
                      </h4>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-blue-700 mb-2">
                            Ration Card Type
                          </label>
                          <select
                            value={uploadForm.rationCardType}
                            onChange={(e) => setUploadForm({...uploadForm, rationCardType: e.target.value})}
                            className="w-full px-4 py-2 border border-blue-300 rounded-lg focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
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
                          <label className="block text-sm font-medium text-blue-700 mb-2">
                            District
                          </label>
                          <input
                            type="text"
                            value={uploadForm.district}
                            onChange={(e) => setUploadForm({...uploadForm, district: e.target.value})}
                            placeholder="Enter district"
                            className="w-full px-4 py-2 border border-blue-300 rounded-lg focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
                            disabled={isSubmitting}
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-blue-700 mb-2">
                            State
                          </label>
                          <input
                            type="text"
                            value={uploadForm.state}
                            onChange={(e) => setUploadForm({...uploadForm, state: e.target.value})}
                            placeholder="Enter state"
                            className="w-full px-4 py-2 border border-blue-300 rounded-lg focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
                            disabled={isSubmitting}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Household Selection - for household scope */}
                  {uploadForm.scope === 'household' && !selectedDocMeta?.creates_household && households.length > 0 && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Select Household *
                      </label>
                      <select
                        value={uploadForm.householdId}
                        onChange={(e) => setUploadForm({...uploadForm, householdId: e.target.value})}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
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
                </div>

                <div className="flex items-center justify-end space-x-4 pt-6 border-t border-gray-200 mt-6">
                  <button
                    type="button"
                    onClick={() => setShowUploadModal(false)}
                    className="px-6 py-2 text-gray-700 border border-gray-300 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                    disabled={isSubmitting}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={
                      !uploadForm.file || 
                      !uploadForm.documentName.trim() || 
                      !uploadForm.scope ||
                      isSubmitting ||
                      (uploadForm.scope === 'service' && !uploadForm.serviceEntryId) ||
                      (uploadForm.scope === 'household' && !selectedDocMeta?.creates_household && !uploadForm.householdId)
                    }
                    className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                      (uploadForm.file && uploadForm.documentName.trim() && uploadForm.scope && !isSubmitting &&
                       (uploadForm.scope !== 'service' || uploadForm.serviceEntryId) &&
                       (uploadForm.scope !== 'household' || selectedDocMeta?.creates_household || uploadForm.householdId))
                        ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                        : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    <FiUpload className="inline mr-2" />
                    {isSubmitting ? 'Uploading...' : 'Upload Document'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Review Modal */}
      {showReviewModal && selectedDocument && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-800">
                Review Document
              </h3>
              <button
                onClick={() => setShowReviewModal(false)}
                className="text-gray-500 hover:text-gray-700 p-2"
                disabled={isSubmitting}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleReviewSubmit}>
              <div className="mb-4">
                <p className="text-sm text-gray-600 mb-2">Document: <span className="font-medium">{selectedDocument.document_name}</span></p>
                <p className="text-sm text-gray-600">Uploaded by: <span className="font-medium">{selectedDocument.uploaded_by}</span></p>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Status *
                </label>
                <div className="space-y-2">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="approved"
                      checked={reviewForm.status === 'approved'}
                      onChange={(e) => setReviewForm({...reviewForm, status: e.target.value})}
                      className="text-emerald-600 focus:ring-emerald-500"
                      disabled={isSubmitting}
                    />
                    <span className="ml-2 text-sm text-gray-700">Approved</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="rejected"
                      checked={reviewForm.status === 'rejected'}
                      onChange={(e) => setReviewForm({...reviewForm, status: e.target.value})}
                      className="text-rose-600 focus:ring-rose-500"
                      disabled={isSubmitting}
                    />
                    <span className="ml-2 text-sm text-gray-700">Rejected</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="pending"
                      checked={reviewForm.status === 'pending'}
                      onChange={(e) => setReviewForm({...reviewForm, status: e.target.value})}
                      className="text-amber-600 focus:ring-amber-500"
                      disabled={isSubmitting}
                    />
                    <span className="ml-2 text-sm text-gray-700">Keep Pending</span>
                  </label>
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Remarks (Optional)
                </label>
                <textarea
                  value={reviewForm.remarks}
                  onChange={(e) => setReviewForm({...reviewForm, remarks: e.target.value})}
                  placeholder="Add review remarks..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
                  rows="3"
                  disabled={isSubmitting}
                />
              </div>

              <div className="flex items-center justify-end space-x-4">
                <button
                  type="button"
                  onClick={() => setShowReviewModal(false)}
                  className="px-6 py-2 text-gray-700 border border-gray-300 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                    !isSubmitting
                      ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  {isSubmitting ? 'Submitting...' : 'Submit Review'}
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