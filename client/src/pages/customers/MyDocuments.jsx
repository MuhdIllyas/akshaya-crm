import React, { useState, useEffect } from 'react';
import { 
  FiFile, FiCheck, FiX, FiClock, FiDownload, FiUpload, FiEye, 
  FiUser, FiUsers, FiBriefcase, FiInfo, FiSearch, FiFilter, 
  FiChevronRight, FiCalendar, FiRefreshCw, FiPlus, FiTrash2, 
  FiEdit, FiChevronDown, FiHome, FiMapPin, FiGlobe 
} from 'react-icons/fi';
import axios from "axios";
import {  toast } from 'react-toastify';

const MyDocuments = () => {
  const [activeScope, setActiveScope] = useState('individual');
  const [documents, setDocuments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showVersionModal, setShowVersionModal] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [documentToDelete, setDocumentToDelete] = useState(null);
  const [documentToEdit, setDocumentToEdit] = useState(null);
  const [documentVersions, setDocumentVersions] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('grid');
  const [households, setHouseholds] = useState([]);
  const [uploadForm, setUploadForm] = useState({
    file: null,
    documentName: '',
    documentNumber: '',
    documentType: 'identity',
    expiryDate: '',
    householdId: '',
    rationCardType: 'general',
    district: '',
    state: ''
  });
  const [editForm, setEditForm] = useState({
    documentNumber: '',
    expiryDate: '',
    rationCardType: 'general',
    district: '',
    state: '',
    newFile: null
  });
  const [dragOver, setDragOver] = useState(false);
  const [documentMaster, setDocumentMaster] = useState([]);
  const [selectedDocMeta, setSelectedDocMeta] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize Axios instance
  const API = axios.create({
    baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000",
  });

  // Add auth interceptor
  API.interceptors.request.use((config) => {
    const token = localStorage.getItem("customer_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });

  // Helper to get file extension
  const getFileExtension = (mimeType) => {
    switch(mimeType) {
      case 'application/pdf': return 'PDF';
      case 'image/jpeg': return 'JPG';
      case 'image/png': return 'PNG';
      case 'image/jpg': return 'JPG';
      case 'application/msword': return 'DOC';
      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': return 'DOCX';
      default: return 'FILE';
    }
  };

  // Helper to format file size
  const formatFileSize = (bytes) => {
    if (!bytes) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // Map backend document to frontend format
  const mapDocument = (doc) => ({
    id: doc.id,
    name: doc.document_name,
    type: doc.document_type || 'other',
    scope: doc.scope,
    status: doc.status,
    uploaded_date: doc.created_at,
    version: doc.version || 1,
    file_type: getFileExtension(doc.mime_type),
    file_size: formatFileSize(doc.file_size || 0),
    icon: getIconByType(doc.document_type || 'other'),
    color: getColorByType(doc.document_type || 'other'),
    review_remarks: doc.review_remarks,
    mime_type: doc.mime_type,
    file_hash: doc.file_hash,
    document_number_last4: doc.document_number_last4,
    expiry_date: doc.expiry_date,
    household_id: doc.household_id,
    is_latest: doc.is_latest,
    file_url: doc.file_url
  });

  // Fetch documents from backend
  const fetchDocuments = async () => {
    try {
      setIsLoading(true);
      const res = await API.get(`/api/customer/documents`, {
        params: { scope: activeScope }
      });
      
      // Filter to show only latest versions
      const latestDocs = res.data.filter(doc => doc.is_latest);
      setDocuments(latestDocs.map(mapDocument));
    } catch (err) {
      console.error("Failed to fetch documents", err);
      setDocuments([]);
      toast.error("Failed to load documents");
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch households
  const fetchHouseholds = async () => {
    try {
      const res = await API.get("/api/customer/documents/households");
      setHouseholds(res.data);
    } catch (err) {
      console.error("Failed to fetch households", err);
      toast.error("Failed to load households");
    }
  };

  // Fetch document master
  const fetchDocumentMaster = async () => {
    try {
      const res = await API.get("/api/customer/documents/document-master");
      setDocumentMaster(res.data);
    } catch (err) {
      console.error("Failed to fetch document master", err);
      toast.error("Failed to load document types");
    }
  };

  // Fetch document versions
  const fetchDocumentVersions = async (documentId) => {
    try {
      const res = await API.get(`/api/customer/documents/${documentId}/versions`);
      setDocumentVersions(res.data);
      setShowVersionModal(true);
    } catch (err) {
      console.error("Failed to fetch versions", err);
      toast.error("Failed to load document versions");
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, [activeScope]);

  useEffect(() => {
    fetchDocumentMaster();
    fetchHouseholds();
  }, []);

  // Open document in new tab
  const openDocument = async (docId) => {
    try {
      const token = localStorage.getItem("customer_token");

      const response = await fetch(
        `${API.defaults.baseURL}/api/customer/documents/${docId}/download`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Unauthorized");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      window.open(url, "_blank");
    } catch (err) {
      toast.error("Unable to open document");
    }
  };

  // Download document
  const downloadDocument = async (docId, docName) => {
    try {
      const token = localStorage.getItem("customer_token");

      const response = await fetch(
        `${API.defaults.baseURL}/api/customer/documents/${docId}/download`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Download failed");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = docName || 'document';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      toast.error("Unable to download document");
    }
  };

  // Handle file selection
  const handleFileSelect = (e, isEdit = false) => {
    const file = e.target.files[0];
    if (file) {
      if (isEdit) {
        setEditForm({
          ...editForm,
          newFile: file
        });
      } else {
        setUploadForm({
          ...uploadForm,
          file: file
        });
      }
    }
  };

  // Handle drag and drop events
  const handleDragOver = (e, isEdit = false) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleDrop = (e, isEdit = false) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      if (isEdit) {
        setEditForm({
          ...editForm,
          newFile: file
        });
      } else {
        setUploadForm({
          ...uploadForm,
          file: file
        });
      }
    }
  };

  // Handle edit document
  const handleEditClick = async (doc) => {
    try {
      // Fetch the document details to get the actual document number
      const response = await API.get(`/api/customer/documents/${doc.id}`);
      const documentDetails = response.data;
      
      setDocumentToEdit(doc);
      setEditForm({
        documentNumber: documentDetails.document_number || '', // Use the actual document number
        expiryDate: documentDetails.expiry_date ? 
          new Date(documentDetails.expiry_date).toISOString().split('T')[0] : '',
        rationCardType: documentDetails.ration_card_type || 'general',
        district: documentDetails.district || '',
        state: documentDetails.state || '',
        newFile: null
      });
      
      // Also fetch document master info to know if this document requires number/expiry
      const docMaster = documentMaster.find(d => d.name === doc.name);
      setSelectedDocMeta(docMaster || null);
      
      setShowEditModal(true);
    } catch (err) {
      console.error("Failed to fetch document details", err);
      toast.error("Failed to load document details");
    }
  };

  // Handle edit form submission
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    
    if (!documentToEdit) return;
    
    try {
      setIsSubmitting(true);
      
      const formData = new FormData();
      
      // Add new file if selected
      if (editForm.newFile) {
        formData.append("file", editForm.newFile);
      }
      
      // Add other fields
      if (editForm.documentNumber) {
        formData.append("document_number", editForm.documentNumber);
      }
      
      if (editForm.expiryDate) {
        formData.append("expiry_date", editForm.expiryDate);
      }
      
      if (editForm.rationCardType) {
        formData.append("ration_card_type", editForm.rationCardType);
      }
      
      if (editForm.district) {
        formData.append("district", editForm.district);
      }
      
      if (editForm.state) {
        formData.append("state", editForm.state);
      }
      
      await API.put(`/api/customer/documents/${documentToEdit.id}`, formData, {
        headers: { 
          "Content-Type": "multipart/form-data" 
        }
      });

      setShowEditModal(false);
      setDocumentToEdit(null);
      fetchDocuments();
      
      toast.success('Document updated successfully!');
    } catch (err) {
      console.error("Edit failed", err);
      let errorMessage = "Document update failed. Please try again.";
      
      if (err.response?.data?.message) {
        errorMessage = err.response.data.message;
      }
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle delete document
  const handleDeleteDocument = async () => {
    if (!documentToDelete) return;

    try {
      await API.delete(`/api/customer/documents/${documentToDelete.id}`);
      
      setShowDeleteModal(false);
      setDocumentToDelete(null);
      fetchDocuments();
      
      toast.success('Document deleted successfully!');
    } catch (err) {
      console.error("Delete failed", err);
      let errorMessage = "Delete failed. Please try again.";
      
      if (err.response?.data?.message) {
        errorMessage = err.response.data.message;
      }
      toast.error(errorMessage);
    }
  };

  // Handle upload form submission
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

    // Check if document requires number
    const selectedDoc = documentMaster.find(d => d.name === uploadForm.documentName);
    if (selectedDoc?.requires_number && !uploadForm.documentNumber.trim()) {
      toast.error('Please enter document number for this document type');
      return;
    }

    // Check if document requires expiry date
    if (selectedDoc?.requires_expiry && !uploadForm.expiryDate) {
      toast.error('Please select expiry date for this document');
      return;
    }

    try {
      setIsSubmitting(true);
      const formData = new FormData();
      
      formData.append("file", uploadForm.file);
      formData.append("document_name", uploadForm.documentName);
      
      if (uploadForm.documentNumber.trim()) {
        formData.append("document_number", uploadForm.documentNumber);
      }
      
      if (uploadForm.expiryDate) {
        formData.append("expiry_date", uploadForm.expiryDate);
      }
      
      if (uploadForm.documentType && uploadForm.documentType !== 'identity') {
        formData.append("document_type", uploadForm.documentType);
      }
      
      // Household fields for ration card
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

      await API.post("/api/customer/documents", formData, {
        headers: { 
          "Content-Type": "multipart/form-data" 
        }
      });

      // Reset form and close modal
      setShowUploadModal(false);
      setUploadForm({
        file: null,
        documentName: '',
        documentNumber: '',
        documentType: 'identity',
        expiryDate: '',
        householdId: '',
        rationCardType: 'general',
        district: '',
        state: ''
      });
      setSelectedDocMeta(null);

      // Refresh data
      fetchDocuments();
      fetchHouseholds();

      toast.success('Document uploaded successfully! Status: Pending Review');
    } catch (err) {
      console.error("Upload failed", err);
      let errorMessage = "Document upload failed. Please try again.";
      
      if (err.response?.data?.message) {
        errorMessage = err.response.data.message;
      }
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Reset upload modal
  const resetUploadModal = () => {
    setShowUploadModal(false);
    setUploadForm({
      file: null,
      documentName: '',
      documentNumber: '',
      documentType: 'identity',
      expiryDate: '',
      householdId: '',
      rationCardType: 'general',
      district: '',
      state: ''
    });
    setSelectedDocMeta(null);
  };

  // Helper functions
  const getIconByType = (type) => {
    switch(type) {
      case 'identity': return 'id';
      case 'tax': return 'card';
      case 'income': return 'certificate';
      case 'family': return 'family';
      case 'certificate': return 'certificate';
      case 'photo': return 'photo';
      default: return 'file';
    }
  };

  const getColorByType = (type) => {
    switch(type) {
      case 'identity': return 'bg-navy-500/10 text-navy-700';
      case 'tax': return 'bg-navy-500/10 text-navy-700';
      case 'income': return 'bg-amber-100 text-amber-700';
      case 'family': return 'bg-emerald-100 text-emerald-700';
      case 'certificate': return 'bg-navy-500/10 text-navy-700';
      case 'photo': return 'bg-navy-500/10 text-navy-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  const getIcon = (iconName) => {
    switch(iconName) {
      case 'id': return <FiUser className="text-xl" />;
      case 'card': return <FiFile className="text-xl" />;
      case 'certificate': return <FiFile className="text-xl" />;
      case 'family': return <FiUsers className="text-xl" />;
      case 'photo': return <FiFile className="text-xl" />;
      default: return <FiFile className="text-xl" />;
    }
  };

  const getStatusIcon = (status) => {
    switch(status) {
      case 'approved': return <FiCheck className="text-emerald-600" />;
      case 'rejected': return <FiX className="text-rose-600" />;
      case 'pending': return <FiClock className="text-amber-600" />;
      default: return <FiClock className="text-slate-600" />;
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const getStatusColor = (status) => {
    switch(status) {
      case 'approved': return 'border-l-4 border-emerald-500';
      case 'rejected': return 'border-l-4 border-rose-500';
      case 'pending': return 'border-l-4 border-amber-500';
      default: return 'border-l-4 border-slate-300';
    }
  };

  const getScopeLabel = (scope) => {
    switch(scope) {
      case 'individual': return 'Personal';
      case 'household': return 'Family';
      case 'service': return 'Service';
      default: return scope;
    }
  };

  const getScopeIcon = (scope) => {
    switch(scope) {
      case 'individual': return <FiUser className="text-slate-500" />;
      case 'household': return <FiUsers className="text-slate-500" />;
      case 'service': return <FiBriefcase className="text-slate-500" />;
      default: return <FiFile className="text-slate-500" />;
    }
  };

  // Check if document is expired
  const isDocumentExpired = (expiryDate) => {
    if (!expiryDate) return false;
    return new Date(expiryDate) < new Date();
  };

  // Calculate stats from current documents
  const stats = {
    total: documents.length,
    approved: documents.filter(d => d.status === 'approved').length,
    pending: documents.filter(d => d.status === 'pending').length,
    rejected: documents.filter(d => d.status === 'rejected').length
  };

  // Filter documents based on search query
  const filteredDocuments = documents.filter(doc => 
    doc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    doc.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (doc.document_number_last4 && doc.document_number_last4.includes(searchQuery))
  );

  // Handle scope change
  const handleScopeChange = (scope) => {
    setActiveScope(scope);
  };

  return (
    <div>
      {/* Header with Stats */}
      <div className="mb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div>
            <h1 className="text-xl font-semibold text-slate-900 sm:text-2xl">My Documents</h1>
            <p className="text-sm text-slate-500 mt-0.5">Manage all your uploaded documents in one place</p>
          </div>
          
          <button
            onClick={() => setShowUploadModal(true)}
            className="inline-flex h-11 sm:h-10 items-center justify-center px-4 text-sm bg-navy-700 text-white rounded-xl font-medium hover:bg-navy-800 transition-colors duration-200 shadow-sm"
            disabled={isSubmitting}
          >
            <FiUpload className="mr-2" />
            {isSubmitting ? 'Processing...' : 'Upload Document'}
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-4 divide-x divide-slate-100 rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="px-2 py-3 text-center sm:px-4 sm:py-4">
            <p className="text-xl font-semibold text-slate-900 sm:text-2xl">{stats.total}</p>
            <p className="text-[11px] text-slate-500 sm:text-sm">Total<span className="hidden sm:inline"> Documents</span></p>
          </div>
          <div className="px-2 py-3 text-center sm:px-4 sm:py-4">
            <p className="text-xl font-semibold text-emerald-600 sm:text-2xl">{stats.approved}</p>
            <p className="text-[11px] text-slate-500 sm:text-sm">Approved</p>
          </div>
          <div className="px-2 py-3 text-center sm:px-4 sm:py-4">
            <p className="text-xl font-semibold text-amber-600 sm:text-2xl">{stats.pending}</p>
            <p className="text-[11px] text-slate-500 sm:text-sm">Pending</p>
          </div>
          <div className="px-2 py-3 text-center sm:px-4 sm:py-4">
            <p className="text-xl font-semibold text-rose-600 sm:text-2xl">{stats.rejected}</p>
            <p className="text-[11px] text-slate-500 sm:text-sm">Rejected</p>
          </div>
        </div>
      </div>

      {/* Control Bar */}
      <div className="bg-white rounded-2xl p-3 sm:p-4 border border-slate-200 shadow-sm mb-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          {/* Scope Filter */}
          <div className="flex items-center gap-1 overflow-x-auto bg-slate-100 p-1 rounded-xl">
            {[
              { key: 'individual', label: 'Personal', icon: <FiUser className="text-sm" /> },
              { key: 'household', label: 'Family', icon: <FiUsers className="text-sm" /> },
              { key: 'service', label: 'Service', icon: <FiBriefcase className="text-sm" /> }
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => handleScopeChange(tab.key)}
                className={`flex items-center whitespace-nowrap min-h-[40px] sm:min-h-0 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  activeScope === tab.key
                    ? 'bg-white text-navy-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-800 hover:bg-slate-50'
                }`}
              >
                {tab.icon}
                <span className="ml-2">{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Search and View Controls */}
          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="relative flex-1 lg:flex-none lg:w-64">
              <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search documents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 min-h-[44px] sm:min-h-[40px] py-2 text-base sm:text-sm bg-slate-100 rounded-xl border border-slate-300 focus:border-navy-500 focus:ring-2 focus:ring-navy-500/30 focus:bg-white"
              />
            </div>

            {/* View Toggle */}
            <div className="hidden lg:flex items-center space-x-1 bg-slate-100 p-1 rounded-lg">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded ${viewMode === 'grid' ? 'bg-white shadow-sm' : 'hover:bg-slate-50'}`}
              >
                <div className="w-4 h-4 grid grid-cols-2 gap-0.5">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className={`${viewMode === 'grid' ? 'bg-navy-700' : 'bg-slate-400'}`}></div>
                  ))}
                </div>
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded ${viewMode === 'list' ? 'bg-white shadow-sm' : 'hover:bg-slate-50'}`}
              >
                <div className="w-4 h-4 flex flex-col justify-between">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className={`h-1 ${viewMode === 'list' ? 'bg-navy-700' : 'bg-slate-400'}`}></div>
                  ))}
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Documents Grid/List */}
      {isLoading ? (
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-navy-700 mx-auto"></div>
            <p className="mt-4 text-slate-600">Loading documents...</p>
          </div>
        </div>
      ) : filteredDocuments.length > 0 ? (
        <>
          {/* Grid View */}
          {viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredDocuments.map((doc) => (
                <div
                  key={doc.id}
                  className={`bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow duration-200 ${getStatusColor(doc.status)}`}
                >
                  <div className="p-4">
                    {/* Document Header */}
                    <div className="flex items-start justify-between mb-4">
                      <div className={`p-3 rounded-lg ${doc.color}`}>
                        {getIcon(doc.icon)}
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs px-2 py-1 bg-slate-100 text-slate-700 rounded">
                          {doc.file_type}
                        </span>
                        <div className="text-slate-400 hover:text-slate-600">
                          {getStatusIcon(doc.status)}
                        </div>
                      </div>
                    </div>

                    {/* Document Info */}
                    <h3 className="font-bold text-slate-800 mb-2">{doc.name}</h3>
                    
                    <div className="space-y-2 mb-4">
                      <div className="flex items-center text-sm text-slate-600">
                        <FiCalendar className="mr-2 flex-shrink-0" />
                        <span>Uploaded {formatDate(doc.uploaded_date)}</span>
                      </div>
                      <div className="flex items-center text-sm text-slate-600">
                        <FiRefreshCw className="mr-2 flex-shrink-0" />
                        <span>Version {doc.version}</span>
                        <span className="mx-2">•</span>
                        <span>{doc.file_size}</span>
                      </div>
                      {doc.document_number_last4 && (
                        <div className="flex items-center text-sm text-slate-600">
                          <FiFile className="mr-2 flex-shrink-0" />
                          <span>Number: ****{doc.document_number_last4}</span>
                        </div>
                      )}
                      {doc.expiry_date && (
                        <div className={`flex items-center text-sm ${isDocumentExpired(doc.expiry_date) ? 'text-rose-600' : 'text-slate-600'}`}>
                          <FiCalendar className="mr-2 flex-shrink-0" />
                          <span>Expires: {formatDate(doc.expiry_date)}</span>
                          {isDocumentExpired(doc.expiry_date) && (
                            <span className="ml-2 px-2 py-0.5 text-xs bg-rose-100 text-rose-700 rounded">Expired</span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Status Badge */}
                    <div className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium mb-2 ${
                      doc.status === 'approved' ? 'bg-emerald-50 text-emerald-700' :
                      doc.status === 'rejected' ? 'bg-rose-50 text-rose-700' :
                      'bg-amber-50 text-amber-700'
                    }`}>
                      {getStatusIcon(doc.status)}
                      <span className="ml-1 capitalize">{doc.status}</span>
                    </div>

                    {/* Scope Badge */}
                    <div className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium mb-4 bg-slate-100 text-slate-700 ml-2">
                      {getScopeIcon(doc.scope)}
                      <span className="ml-1">{getScopeLabel(doc.scope)}</span>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                      <div className="flex items-center space-x-2">
                        <button 
                          onClick={() => openDocument(doc.id)}
                          className="grid h-10 w-10 place-items-center text-slate-600 hover:text-navy-700 hover:bg-navy-500/10 rounded-lg transition-colors"
                          title="View document"
                        >
                          <FiEye />
                        </button>
                        <button 
                          onClick={() => downloadDocument(doc.id, doc.name)}
                          className="grid h-10 w-10 place-items-center text-slate-600 hover:text-navy-700 hover:bg-navy-500/10 rounded-lg transition-colors"
                          title="Download document"
                        >
                          <FiDownload />
                        </button>
                        <button 
                          onClick={() => fetchDocumentVersions(doc.id)}
                          className="grid h-10 w-10 place-items-center text-slate-600 hover:text-navy-700 hover:bg-navy-500/10 rounded-lg transition-colors"
                          title="View versions"
                        >
                          <FiRefreshCw />
                        </button>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button 
                          onClick={() => handleEditClick(doc)}
                          className="grid h-10 w-10 place-items-center text-slate-600 hover:text-navy-700 hover:bg-navy-500/10 rounded-lg transition-colors"
                          title="Edit document"
                        >
                          <FiEdit />
                        </button>
                        <button 
                          onClick={() => {
                            setDocumentToDelete(doc);
                            setShowDeleteModal(true);
                          }}
                          className="grid h-10 w-10 place-items-center text-slate-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors"
                          title="Delete document"
                        >
                          <FiTrash2 />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* List View */
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-x-auto">
              <table className="w-full min-w-[760px]">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left py-4 px-6 text-sm font-medium text-slate-700">Document</th>
                    <th className="text-left py-4 px-6 text-sm font-medium text-slate-700">Scope</th>
                    <th className="text-left py-4 px-6 text-sm font-medium text-slate-700">Document Number</th>
                    <th className="text-left py-4 px-6 text-sm font-medium text-slate-700">Expiry Date</th>
                    <th className="text-left py-4 px-6 text-sm font-medium text-slate-700">Status</th>
                    <th className="text-left py-4 px-6 text-sm font-medium text-slate-700">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredDocuments.map((doc) => (
                    <tr key={doc.id} className="hover:bg-slate-50">
                      <td className="py-4 px-6">
                        <div className="flex items-center">
                          <div className={`p-2 rounded-lg mr-3 ${doc.color}`}>
                            {getIcon(doc.icon)}
                          </div>
                          <div>
                            <p className="font-medium text-slate-800">{doc.name}</p>
                            <p className="text-sm text-slate-500">
                              v{doc.version} • {doc.file_size} • {doc.file_type}
                            </p>
                            <p className="text-xs text-slate-400 mt-1">
                              Uploaded {formatDate(doc.uploaded_date)}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center text-slate-700">
                          {getScopeIcon(doc.scope)}
                          <span className="ml-2">{getScopeLabel(doc.scope)}</span>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <div className="text-slate-700">
                          {doc.document_number_last4 ? `****${doc.document_number_last4}` : 'N/A'}
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <div className={`${isDocumentExpired(doc.expiry_date) ? 'text-rose-600' : 'text-slate-700'}`}>
                          {doc.expiry_date ? formatDate(doc.expiry_date) : 'N/A'}
                          {isDocumentExpired(doc.expiry_date) && (
                            <span className="ml-2 px-2 py-0.5 text-xs bg-rose-100 text-rose-700 rounded">Expired</span>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <div className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                          doc.status === 'approved' ? 'bg-emerald-50 text-emerald-700' :
                          doc.status === 'rejected' ? 'bg-rose-50 text-rose-700' :
                          'bg-amber-50 text-amber-700'
                        }`}>
                          {getStatusIcon(doc.status)}
                          <span className="ml-1 capitalize">{doc.status}</span>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center space-x-2">
                          <button 
                            onClick={() => openDocument(doc.id)}
                            className="grid h-10 w-10 place-items-center text-slate-600 hover:text-navy-700 hover:bg-navy-500/10 rounded-lg"
                            title="View document"
                          >
                            <FiEye />
                          </button>
                          <button 
                            onClick={() => downloadDocument(doc.id, doc.name)}
                            className="grid h-10 w-10 place-items-center text-slate-600 hover:text-navy-700 hover:bg-navy-500/10 rounded-lg"
                            title="Download document"
                          >
                            <FiDownload />
                          </button>
                          <button 
                            onClick={() => fetchDocumentVersions(doc.id)}
                            className="grid h-10 w-10 place-items-center text-slate-600 hover:text-navy-700 hover:bg-navy-500/10 rounded-lg"
                            title="View versions"
                          >
                            <FiRefreshCw />
                          </button>
                          <button 
                            onClick={() => handleEditClick(doc)}
                            className="grid h-10 w-10 place-items-center text-slate-600 hover:text-navy-700 hover:bg-navy-500/10 rounded-lg"
                            title="Edit document"
                          >
                            <FiEdit />
                          </button>
                          <button 
                            onClick={() => {
                              setDocumentToDelete(doc);
                              setShowDeleteModal(true);
                            }}
                            className="grid h-10 w-10 place-items-center text-slate-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg"
                            title="Delete document"
                          >
                            <FiTrash2 />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : (
        /* Empty State */
        <div className="bg-white rounded-2xl p-8 sm:p-12 border border-slate-200 shadow-sm text-center">
          <div className="max-w-md mx-auto">
            <div className="bg-slate-100 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6">
              <FiFile className="text-slate-400 text-3xl" />
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-3">
              No {activeScope === 'individual' ? 'Personal' : activeScope === 'household' ? 'Family' : 'Service'} Documents
            </h3>
            <p className="text-slate-600 mb-6">
              {activeScope === 'individual' && "Upload your personal identification documents to get started."}
              {activeScope === 'household' && "Add family documents for household services and applications."}
              {activeScope === 'service' && "Upload documents specific to the services you're applying for."}
            </p>
            <button
              onClick={() => setShowUploadModal(true)}
              className="inline-flex h-11 items-center justify-center px-6 bg-navy-700 text-white rounded-xl font-medium hover:bg-navy-800 transition-colors duration-200"
              disabled={isSubmitting}
            >
              <FiUpload className="mr-2" />
              {isSubmitting ? 'Processing...' : 'Upload Your First Document'}
            </button>
          </div>
        </div>
      )}

      {/* Quick Stats Footer */}
      {filteredDocuments.length > 0 && (
        <div className="mt-8">
          <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center">
                <div className="bg-navy-500/10 p-3 rounded-xl mr-4">
                  <FiInfo className="text-navy-700 text-xl" />
                </div>
                <div>
                  <h4 className="font-semibold text-navy-800">Document Tips</h4>
                  <p className="text-sm text-navy-700 mt-1">
                    • Keep documents updated • Store multiple versions • Ensure document numbers are correct
                  </p>
                </div>
              </div>
              <button 
                onClick={() => {
                  const householdDocs = documents.filter(d => d.scope === 'household');
                  if (householdDocs.length > 0) {
                    setActiveScope('household');
                  }
                }}
                className="text-sm font-medium text-navy-700 hover:text-navy-800 min-h-[44px] px-4 py-2 bg-white rounded-xl border border-slate-300 hover:border-navy-500/40 transition-colors"
              >
                View Household Documents →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload Document Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90dvh] overflow-y-auto">
            <div className="p-4 sm:p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-slate-800">
                  Upload New Document
                </h3>
                <button
                  onClick={resetUploadModal}
                  className="grid h-10 w-10 place-items-center text-slate-500 hover:text-slate-700"
                  disabled={isSubmitting}
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleUploadSubmit}>
                {/* File Upload Area */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Select Document (Max 5MB)
                  </label>
                  <div 
                    className={`border-2 border-dashed ${dragOver ? 'border-navy-500 bg-navy-500/10' : 'border-slate-300'} rounded-xl p-6 sm:p-8 text-center hover:border-navy-500/40 transition-colors cursor-pointer`}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => document.getElementById('file-upload').click()}
                  >
                    {uploadForm.file ? (
                      <div className="text-center">
                        <FiFile className="text-4xl text-navy-700 mx-auto mb-2" />
                        <p className="font-medium text-slate-800">{uploadForm.file.name}</p>
                        <p className="text-sm text-slate-500 mt-1">
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
                        <FiUpload className="text-4xl text-slate-400 mx-auto mb-4" />
                        <p className="text-slate-600 mb-2">
                          <span className="font-medium text-navy-700">Click to browse</span> or drag and drop
                        </p>
                        <p className="text-sm text-slate-500">
                          PDF, JPG, PNG, DOC up to 5MB
                        </p>
                        <input
                          type="file"
                          id="file-upload"
                          className="hidden"
                          onChange={handleFileSelect}
                          accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                          disabled={isSubmitting}
                        />
                      </>
                    )}
                  </div>
                </div>

                {/* Document Name Dropdown */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Document Type *
                  </label>
                  <select
                    value={uploadForm.documentName}
                    onChange={(e) => {
                      const selected = documentMaster.find(
                        d => d.name === e.target.value
                      );
                      setUploadForm({
                        ...uploadForm,
                        documentName: e.target.value,
                        documentNumber: "", // reset when changing doc
                        expiryDate: "", // reset when changing doc
                        householdId: "", // reset when changing doc
                        rationCardType: "general",
                        district: "",
                        state: ""
                      });
                      setSelectedDocMeta(selected || null);
                    }}
                    className="w-full min-h-[44px] px-3 py-2 text-base sm:text-sm border border-slate-300 rounded-lg focus:border-navy-500 focus:ring-2 focus:ring-navy-500/30"
                    required
                    disabled={isSubmitting}
                  >
                    <option value="">Select document type</option>
                    {documentMaster.map(doc => (
                      <option key={doc.name} value={doc.name}>
                        {doc.name} ({doc.scope})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Document Number (conditional) */}
                {selectedDocMeta?.requires_number && (
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Document Number *
                    </label>
                    <input
                      type="text"
                      value={uploadForm.documentNumber}
                      onChange={(e) =>
                        setUploadForm({ ...uploadForm, documentNumber: e.target.value })
                      }
                      placeholder="Enter document number"
                      className="w-full min-h-[44px] px-3 py-2 text-base sm:text-sm border border-slate-300 rounded-lg focus:border-navy-500 focus:ring-2 focus:ring-navy-500/30"
                      required={selectedDocMeta?.requires_number}
                      disabled={isSubmitting}
                    />
                  </div>
                )}

                {/* Expiry Date (conditional) */}
                {selectedDocMeta?.requires_expiry && (
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Expiry Date *
                    </label>
                    <input
                      type="date"
                      value={uploadForm.expiryDate}
                      onChange={(e) =>
                        setUploadForm({ ...uploadForm, expiryDate: e.target.value })
                      }
                      className="w-full min-h-[44px] px-3 py-2 text-base sm:text-sm border border-slate-300 rounded-lg focus:border-navy-500 focus:ring-2 focus:ring-navy-500/30"
                      required={selectedDocMeta?.requires_expiry}
                      disabled={isSubmitting}
                    />
                  </div>
                )}

                {/* Household Selection (for household scope documents) */}
                {selectedDocMeta?.scope === 'household' && !selectedDocMeta?.creates_household && households.length > 0 && (
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Select Household
                    </label>
                    <select
                      value={uploadForm.householdId}
                      onChange={(e) =>
                        setUploadForm({ ...uploadForm, householdId: e.target.value })
                      }
                      className="w-full min-h-[44px] px-3 py-2 text-base sm:text-sm border border-slate-300 rounded-lg focus:border-navy-500 focus:ring-2 focus:ring-navy-500/30"
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

                {/* Household Creation Fields (for ration card) */}
                {selectedDocMeta?.creates_household && (
                  <div className="mb-6 p-4 bg-navy-500/10 rounded-lg border border-navy-500/10">
                    <h4 className="font-medium text-navy-800 mb-3 flex items-center">
                      <FiHome className="mr-2" />
                      Household Details
                    </h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-navy-700 mb-2">
                          Ration Card Type
                        </label>
                        <select
                          value={uploadForm.rationCardType}
                          onChange={(e) =>
                            setUploadForm({ ...uploadForm, rationCardType: e.target.value })
                          }
                          className="w-full min-h-[44px] px-3 py-2 text-base sm:text-sm border border-navy-500/20 rounded-lg focus:border-navy-500 focus:ring-2 focus:ring-navy-500/30"
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
                        <label className="block text-sm font-medium text-navy-700 mb-2">
                          District
                        </label>
                        <input
                          type="text"
                          value={uploadForm.district}
                          onChange={(e) =>
                            setUploadForm({ ...uploadForm, district: e.target.value })
                          }
                          placeholder="Enter district"
                          className="w-full min-h-[44px] px-3 py-2 text-base sm:text-sm border border-navy-500/20 rounded-lg focus:border-navy-500 focus:ring-2 focus:ring-navy-500/30"
                          disabled={isSubmitting}
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-navy-700 mb-2">
                          State
                        </label>
                        <input
                          type="text"
                          value={uploadForm.state}
                          onChange={(e) =>
                            setUploadForm({ ...uploadForm, state: e.target.value })
                          }
                          placeholder="Enter state"
                          className="w-full min-h-[44px] px-3 py-2 text-base sm:text-sm border border-navy-500/20 rounded-lg focus:border-navy-500 focus:ring-2 focus:ring-navy-500/30"
                          disabled={isSubmitting}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Document Category (optional) */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Document Category (Optional)
                  </label>
                  <select
                    value={uploadForm.documentType}
                    onChange={(e) => setUploadForm({...uploadForm, documentType: e.target.value})}
                    className="w-full min-h-[44px] px-3 py-2 text-base sm:text-sm border border-slate-300 rounded-lg focus:border-navy-500 focus:ring-2 focus:ring-navy-500/30"
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

                {/* Form Actions */}
                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end pt-6 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={resetUploadModal}
                    className="min-h-[44px] px-6 py-2 text-slate-700 border border-slate-300 rounded-xl font-medium hover:bg-slate-50 transition-colors"
                    disabled={isSubmitting}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!uploadForm.file || !uploadForm.documentName.trim() || isSubmitting}
                    className={`min-h-[44px] px-6 py-2 rounded-xl font-medium transition-colors ${
                      (uploadForm.file && uploadForm.documentName.trim() && !isSubmitting)
                        ? 'bg-navy-700 text-white hover:bg-navy-800'
                        : 'bg-slate-300 text-slate-500 cursor-not-allowed'
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

      {/* Edit Document Modal */}
      {showEditModal && documentToEdit && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90dvh] overflow-y-auto">
            <div className="p-4 sm:p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-slate-800">
                  Edit Document: {documentToEdit.name}
                </h3>
                <button
                  onClick={() => {
                    setShowEditModal(false);
                    setDocumentToEdit(null);
                    setSelectedDocMeta(null);
                  }}
                  className="grid h-10 w-10 place-items-center text-slate-500 hover:text-slate-700"
                  disabled={isSubmitting}
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleEditSubmit}>
                {/* Optional: Upload new file */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Upload New File (Optional)
                  </label>
                  <div 
                    className={`border-2 border-dashed ${dragOver ? 'border-navy-500 bg-navy-500/10' : 'border-slate-300'} rounded-xl p-6 sm:p-8 text-center hover:border-navy-500/40 transition-colors cursor-pointer`}
                    onDragOver={(e) => handleDragOver(e, true)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, true)}
                    onClick={() => document.getElementById('edit-file-upload').click()}
                  >
                    {editForm.newFile ? (
                      <div className="text-center">
                        <FiFile className="text-4xl text-navy-700 mx-auto mb-2" />
                        <p className="font-medium text-slate-800">{editForm.newFile.name}</p>
                        <p className="text-sm text-slate-500 mt-1">
                          {formatFileSize(editForm.newFile.size)}
                        </p>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditForm({...editForm, newFile: null});
                          }}
                          className="text-rose-600 hover:text-rose-700 text-sm font-medium mt-3"
                          disabled={isSubmitting}
                        >
                          Remove File
                        </button>
                      </div>
                    ) : (
                      <>
                        <FiUpload className="text-4xl text-slate-400 mx-auto mb-4" />
                        <p className="text-slate-600 mb-2">
                          <span className="font-medium text-navy-700">Click to upload new version</span>
                        </p>
                        <p className="text-sm text-slate-500">
                          Leave empty to keep current file
                        </p>
                        <input
                          type="file"
                          id="edit-file-upload"
                          className="hidden"
                          onChange={(e) => handleFileSelect(e, true)}
                          accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                          disabled={isSubmitting}
                        />
                      </>
                    )}
                  </div>
                  <p className="text-sm text-slate-500 mt-2">
                    Current file: {documentToEdit.name}.{documentToEdit.file_type.toLowerCase()}
                  </p>
                </div>

                {/* Document Number (only show if document requires it) */}
                {selectedDocMeta?.requires_number && (
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Document Number {selectedDocMeta?.requires_number ? '*' : '(Optional)'}
                    </label>
                    <input
                      type="text"
                      value={editForm.documentNumber}
                      onChange={(e) =>
                        setEditForm({ ...editForm, documentNumber: e.target.value })
                      }
                      placeholder="Enter document number"
                      className="w-full min-h-[44px] px-3 py-2 text-base sm:text-sm border border-slate-300 rounded-lg focus:border-navy-500 focus:ring-2 focus:ring-navy-500/30"
                      required={selectedDocMeta?.requires_number}
                      disabled={isSubmitting}
                    />
                    <p className="text-xs text-slate-500 mt-1">
                      {documentToEdit.document_number_last4 ? 
                        `Currently: ****${documentToEdit.document_number_last4}` : 
                        'No document number saved'}
                    </p>
                  </div>
                )}

                {/* Expiry Date (only show if document requires it) */}
                {selectedDocMeta?.requires_expiry && (
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Expiry Date {selectedDocMeta?.requires_expiry ? '*' : '(Optional)'}
                    </label>
                    <input
                      type="date"
                      value={editForm.expiryDate}
                      onChange={(e) =>
                        setEditForm({ ...editForm, expiryDate: e.target.value })
                      }
                      className="w-full min-h-[44px] px-3 py-2 text-base sm:text-sm border border-slate-300 rounded-lg focus:border-navy-500 focus:ring-2 focus:ring-navy-500/30"
                      required={selectedDocMeta?.requires_expiry}
                      disabled={isSubmitting}
                    />
                  </div>
                )}

                {/* Household fields for ration card (only if creates_household) */}
                {selectedDocMeta?.creates_household && (
                  <div className="mb-6 p-4 bg-navy-500/10 rounded-lg border border-navy-500/10">
                    <h4 className="font-medium text-navy-800 mb-3 flex items-center">
                      <FiHome className="mr-2" />
                      Update Household Details
                    </h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-navy-700 mb-2">
                          Ration Card Type
                        </label>
                        <select
                          value={editForm.rationCardType}
                          onChange={(e) =>
                            setEditForm({ ...editForm, rationCardType: e.target.value })
                          }
                          className="w-full min-h-[44px] px-3 py-2 text-base sm:text-sm border border-navy-500/20 rounded-lg focus:border-navy-500 focus:ring-2 focus:ring-navy-500/30"
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
                        <label className="block text-sm font-medium text-navy-700 mb-2">
                          District
                        </label>
                        <input
                          type="text"
                          value={editForm.district}
                          onChange={(e) =>
                            setEditForm({ ...editForm, district: e.target.value })
                          }
                          placeholder="Enter district"
                          className="w-full min-h-[44px] px-3 py-2 text-base sm:text-sm border border-navy-500/20 rounded-lg focus:border-navy-500 focus:ring-2 focus:ring-navy-500/30"
                          disabled={isSubmitting}
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-navy-700 mb-2">
                          State
                        </label>
                        <input
                          type="text"
                          value={editForm.state}
                          onChange={(e) =>
                            setEditForm({ ...editForm, state: e.target.value })
                          }
                          placeholder="Enter state"
                          className="w-full min-h-[44px] px-3 py-2 text-base sm:text-sm border border-navy-500/20 rounded-lg focus:border-navy-500 focus:ring-2 focus:ring-navy-500/30"
                          disabled={isSubmitting}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Form Actions */}
                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end pt-6 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => {
                      setShowEditModal(false);
                      setDocumentToEdit(null);
                      setSelectedDocMeta(null);
                    }}
                    className="min-h-[44px] px-6 py-2 text-slate-700 border border-slate-300 rounded-xl font-medium hover:bg-slate-50 transition-colors"
                    disabled={isSubmitting}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className={`min-h-[44px] px-6 py-2 rounded-xl font-medium transition-colors ${
                      !isSubmitting
                        ? 'bg-navy-700 text-white hover:bg-navy-800'
                        : 'bg-slate-300 text-slate-500 cursor-not-allowed'
                    }`}
                  >
                    <FiEdit className="inline mr-2" />
                    {isSubmitting ? 'Updating...' : 'Update Document'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && documentToDelete && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 sm:p-6">
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-rose-100 mb-4">
                <FiTrash2 className="h-6 w-6 text-rose-600" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">Delete Document</h3>
              <p className="text-slate-600 mb-6">
                Are you sure you want to delete <span className="font-semibold">"{documentToDelete.name}"</span>?
                This action cannot be undone.
              </p>
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-center">
                <button
                  onClick={() => {
                    setShowDeleteModal(false);
                    setDocumentToDelete(null);
                  }}
                  className="min-h-[44px] px-6 py-2 text-slate-700 border border-slate-300 rounded-xl font-medium hover:bg-slate-50 transition-colors"
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteDocument}
                  className="min-h-[44px] px-6 py-2 bg-rose-600 text-white rounded-xl font-medium hover:bg-rose-700 transition-colors"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Deleting...' : 'Delete Document'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Versions Modal */}
      {showVersionModal && selectedDocument && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90dvh] overflow-y-auto">
            <div className="p-4 sm:p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-xl font-bold text-slate-800">
                    Document Versions
                  </h3>
                  <p className="text-slate-600 text-sm mt-1">
                    {selectedDocument.name}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowVersionModal(false);
                    setDocumentVersions([]);
                  }}
                  className="grid h-10 w-10 place-items-center text-slate-500 hover:text-slate-700"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                {documentVersions.length > 0 ? (
                  documentVersions.map((version, index) => (
                    <div 
                      key={version.id} 
                      className={`p-4 border rounded-lg ${version.is_latest ? 'border-navy-500/20 bg-navy-500/10' : 'border-slate-200 bg-white'}`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center">
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                            version.status === 'approved' ? 'bg-emerald-50 text-emerald-700' :
                            version.status === 'rejected' ? 'bg-rose-50 text-rose-700' :
                            'bg-amber-50 text-amber-700'
                          }`}>
                            {version.status === 'approved' && <FiCheck className="mr-1" />}
                            {version.status === 'rejected' && <FiX className="mr-1" />}
                            {version.status === 'pending' && <FiClock className="mr-1" />}
                            {version.status}
                          </span>
                          {version.is_latest && (
                            <span className="ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-navy-500/10 text-navy-700">
                              Latest
                            </span>
                          )}
                        </div>
                        <span className="text-sm font-medium text-slate-700">
                          Version {version.version}
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-slate-600">
                        <div className="flex items-center">
                          <FiCalendar className="mr-2 flex-shrink-0" />
                          <span>{formatDate(version.created_at)}</span>
                        </div>
                        <div className="flex items-center">
                          <FiFile className="mr-2 flex-shrink-0" />
                          <span>{formatFileSize(version.file_size)}</span>
                        </div>
                        {version.expiry_date && (
                          <div className="flex items-center">
                            <FiCalendar className="mr-2 flex-shrink-0" />
                            <span>Expires: {formatDate(version.expiry_date)}</span>
                          </div>
                        )}
                      </div>
                      
                      {version.review_remarks && (
                        <div className="mt-3 p-3 bg-slate-50 rounded border border-slate-200">
                          <p className="text-sm text-slate-700">
                            <span className="font-medium">Remarks:</span> {version.review_remarks}
                          </p>
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8">
                    <p className="text-slate-600">No versions found</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyDocuments;