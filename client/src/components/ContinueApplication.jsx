import React, { useState, useEffect } from 'react';
import { 
  FiFile, FiCheck, FiUpload, FiArrowLeft, 
  FiInfo, FiAlertCircle, FiExternalLink 
} from 'react-icons/fi';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const ContinueApplication = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serviceApplication, setServiceApplication] = useState(null);
  const [availableDocuments, setAvailableDocuments] = useState([]);
  const [requiredDocuments, setRequiredDocuments] = useState([]);
  const [selectedDocuments, setSelectedDocuments] = useState([]);
  const [applicationError, setApplicationError] = useState('');

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

  // Fetch service application details
  const fetchServiceApplication = async () => {
    try {
      setIsLoading(true);
      const response = await API.get(`/api/customer/bookings/${id}`);
      setServiceApplication(response.data);
      
      // Extract required documents from service_data
      const serviceData = response.data.service_data || {};
      const reqDocs = serviceData.required_documents || [];
      setRequiredDocuments(reqDocs);
      
      // Initialize selected documents from service_data if exists
      const savedSelected = serviceData.selected_documents || [];
      // Ensure it's always an array of strings
      const cleanSelected = Array.isArray(savedSelected) 
        ? savedSelected.map(doc => {
            if (typeof doc === 'string') return doc;
            if (doc && typeof doc === 'object') return doc.document_name || doc.name || '';
            return '';
          }).filter(Boolean)
        : [];
      setSelectedDocuments(cleanSelected);
      
      setApplicationError('');
    } catch (error) {
      console.error('Error fetching service application:', error);
      let errorMessage = 'Failed to load service application';
      
      if (error.response?.status === 401) {
        errorMessage = 'Session expired. Please login again.';
        setTimeout(() => {
          navigate('/customer/login');
        }, 2000);
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      }
      
      setApplicationError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch customer's available documents
  const fetchAvailableDocuments = async () => {
    try {
      const response = await API.get('/api/customer/documents');
      setAvailableDocuments(response.data);
    } catch (error) {
      console.error('Error fetching documents:', error);
      toast.error('Failed to load your documents');
    }
  };

  useEffect(() => {
    fetchServiceApplication();
    fetchAvailableDocuments();
  }, [id]);

  // Handle document selection - FIXED: Simplified logic
  const handleDocumentSelect = (documentName) => {
    console.log('Toggling document:', documentName);
    console.log('Current selected:', selectedDocuments);
    
    setSelectedDocuments(prev => {
      // If already selected, remove it
      if (prev.includes(documentName)) {
        const newSelected = prev.filter(doc => doc !== documentName);
        console.log('Removed. New selected:', newSelected);
        return newSelected;
      } 
      // Otherwise add it
      else {
        const newSelected = [...prev, documentName];
        console.log('Added. New selected:', newSelected);
        return newSelected;
      }
    });
  };

  // Check if a document is available
  const isDocumentAvailable = (documentName) => {
    const isAvailable = availableDocuments.some(doc => 
      doc.document_name === documentName && 
      doc.status === 'approved' && 
      doc.is_latest === true
    );
    console.log(`Document ${documentName} available:`, isAvailable);
    return isAvailable;
  };

  // Get document status and details
  const getDocumentStatus = (documentName) => {
    const doc = availableDocuments.find(d => 
      d.document_name === documentName && d.is_latest === true
    );
    
    if (!doc) {
      console.log(`Document ${documentName}: Not found in available documents`);
      return { available: false, status: 'missing', doc: null };
    }
    
    const status = {
      available: doc.status === 'approved',
      status: doc.status,
      doc: doc
    };
    console.log(`Document ${documentName} status:`, status);
    return status;
  };

  // Check if document is selected - FIXED
  const isDocumentSelected = (documentName) => {
    const isSelected = selectedDocuments.includes(documentName);
    console.log(`Document ${documentName} selected:`, isSelected);
    return isSelected;
  };

  // Check if all required documents are selected
  const areAllRequiredDocumentsReady = () => {
    const allSelected = requiredDocuments.every(doc => 
      selectedDocuments.includes(doc.document_name)
    );
    console.log('All documents selected:', allSelected);
    return allSelected;
  };

  // Handle continue to next step
  const handleContinue = async () => {
    try {
      setIsSubmitting(true);
      console.log('=== HANDLE CONTINUE STARTED ===');
      console.log('Service ID:', id);
      console.log('Selected Documents:', selectedDocuments);
      console.log('User Token:', localStorage.getItem("customer_token"));
      
      // Validate selected documents
      if (selectedDocuments.length === 0) {
        toast.error('Please select at least one document');
        setIsSubmitting(false);
        return;
      }

      console.log('Making API call to select-documents endpoint...');
      
      // Make the API call
      const response = await API.put(`/api/customer/bookings/${id}/select-documents`, {
        selected_documents: selectedDocuments
      });

      console.log('=== API RESPONSE RECEIVED ===');
      console.log('Response Status:', response.status);
      console.log('Response Data:', response.data);
      console.log('Response Headers:', response.headers);

      if (response.data.success) {
        toast.success(response.data.message);
        console.log('Next step from backend:', response.data.next_step);
        
        // Navigate based on next_step
        setTimeout(() => {
          if (response.data.next_step === 'upload_documents') {
            console.log('Navigating to documents upload page');
            navigate(`/customer/myservices/${id}/documents`);
          } else {
            console.log('Navigating back to services list');
            navigate('/customer/myservices');
          }
        }, 1000);
      } else {
        console.error('API returned success: false');
        toast.error(response.data.message || 'Failed to update documents');
        setIsSubmitting(false);
      }

    } catch (error) {
      console.error('=== ERROR IN HANDLE CONTINUE ===');
      console.error('Error object:', error);
      
      // Log complete error details
      if (error.response) {
        console.error('Response Data:', error.response.data);
        console.error('Response Status:', error.response.status);
        console.error('Response Headers:', error.response.headers);
        toast.error(error.response.data?.message || `Server error: ${error.response.status}`);
      } else if (error.request) {
        console.error('No response received. Request:', error.request);
        toast.error('No response from server. Check network connection.');
      } else {
        console.error('Error Message:', error.message);
        toast.error(`Error: ${error.message}`);
      }
      
      console.error('Error Config:', error.config);
      setIsSubmitting(false);
    }
  };

  // Handle save as draft
  const handleSaveDraft = async () => {
    try {
      setIsSubmitting(true);
      
      // Update service application with selected documents
      const updatedServiceData = {
        ...serviceApplication.service_data,
        selected_documents: selectedDocuments
      };

      const response = await API.put(`/api/customer/bookings/${id}`, {
        service_data: updatedServiceData,
        status: 'draft',
        remarks: 'Draft saved with selected documents'
      });

      console.log('Save draft response:', response.data);
      toast.success('Draft saved successfully!');
      
      setTimeout(() => {
        navigate('/customer/myservices');
      }, 500);

    } catch (error) {
      console.error('Error saving draft:', error);
      setIsSubmitting(false);
      
      let errorMessage = 'Failed to save draft';
      
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      }
      
      toast.error(errorMessage);
    }
  };

  // Handle cancel
  const handleCancel = () => {
    navigate('/customer/myservices');
  };

  // Add debug logging
  useEffect(() => {
    console.log('Current state:', {
      selectedDocuments,
      requiredDocuments: requiredDocuments.map(d => d.document_name),
      isSubmitting,
      allReady: areAllRequiredDocumentsReady()
    });
  }, [selectedDocuments, isSubmitting, requiredDocuments]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-navy-700 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading application...</p>
        </div>
      </div>
    );
  }

  if (applicationError) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-6 text-center">
          <FiAlertCircle className="text-rose-600 text-4xl mx-auto mb-4" />
          <h3 className="text-lg font-bold text-rose-800 mb-2">Error Loading Application</h3>
          <p className="text-rose-700 mb-4">{applicationError}</p>
          <button
            onClick={() => navigate('/customer/myservices')}
            className="inline-flex items-center px-4 py-2 bg-navy-700 text-white rounded-lg hover:bg-navy-800"
          >
            <FiArrowLeft className="mr-2" />
            Back to Services
          </button>
        </div>
      </div>
    );
  }

  if (!serviceApplication) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center">
          <FiAlertCircle className="text-amber-600 text-4xl mx-auto mb-4" />
          <h3 className="text-lg font-bold text-amber-800 mb-2">Application Not Found</h3>
          <button
            onClick={() => navigate('/customer/myservices')}
            className="inline-flex items-center px-4 py-2 bg-navy-700 text-white rounded-lg hover:bg-navy-800"
          >
            <FiArrowLeft className="mr-2" />
            Back to Services
          </button>
        </div>
      </div>
    );
  }

  const serviceData = serviceApplication.service_data || {};
  const totalCharges = serviceData.total_charges || 0;
  const allDocumentsReady = areAllRequiredDocumentsReady();

  return (
    <div className="max-w-4xl mx-auto">
      <ToastContainer position="top-right" autoClose={3000} />
      
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={handleCancel}
          className="inline-flex items-center text-navy-700 hover:text-navy-800 mb-4"
        >
          <FiArrowLeft className="mr-2" />
          Back to Services
        </button>
        
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Continue Application</h1>
            <p className="text-gray-600 mt-1">
              {serviceData.service_name} • Application #{serviceApplication.tracking?.application_number || serviceApplication.application_number}
            </p>
          </div>
          <div className="bg-blue-50 px-4 py-2 rounded-lg border border-blue-100">
            <p className="text-sm text-blue-700">
              Total Charges: <span className="font-bold">₹{totalCharges}</span>
            </p>
          </div>
        </div>
      </div>

      {/* Application Summary */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6 shadow-sm">
        <h3 className="text-lg font-bold text-gray-800 mb-4">Application Summary</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-500">Service</p>
            <p className="font-medium text-gray-800">{serviceData.service_name}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Application Number</p>
            <p className="font-medium text-gray-800">
              {serviceApplication.tracking?.application_number || serviceApplication.application_number}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Status</p>
            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-amber-100 text-amber-800">
              {serviceApplication.status_label}
            </span>
          </div>
          <div>
            <p className="text-sm text-gray-500">Created On</p>
            <p className="font-medium text-gray-800">
              {new Date(serviceApplication.applied_at).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'long',
                year: 'numeric'
              })}
            </p>
          </div>
        </div>
        
        {serviceData.service_description && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-700">{serviceData.service_description}</p>
          </div>
        )}
      </div>

      {/* Document Selection */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-bold text-gray-800">Select Required Documents</h3>
            <p className="text-gray-600 text-sm mt-1">
              Choose from your uploaded documents or upload new ones
            </p>
          </div>
          <a
            href="/customer/mydocuments"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center text-sm text-navy-700 hover:text-navy-800"
          >
            <FiExternalLink className="mr-1" />
            Manage Documents
          </a>
        </div>

        {requiredDocuments.length === 0 ? (
          <div className="text-center py-8">
            <FiInfo className="text-gray-400 text-4xl mx-auto mb-4" />
            <p className="text-gray-600">No documents required for this service.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {requiredDocuments.map((doc, index) => {
              const documentName = doc.document_name;
              const docStatus = getDocumentStatus(documentName);
              const isSelected = isDocumentSelected(documentName);
              const isAvailable = docStatus.available;
              
              console.log(`Rendering document ${documentName}:`, {
                isSelected,
                isAvailable,
                status: docStatus.status
              });
              
              return (
                <div 
                  key={index} 
                  className={`p-4 border rounded-lg transition-all duration-200 ${
                    isSelected 
                      ? 'border-navy-300 bg-navy-50' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center mb-2">
                        <input
                          type="checkbox"
                          id={`doc-${index}`}
                          checked={isSelected}
                          onChange={() => handleDocumentSelect(documentName)}
                          disabled={!isAvailable && !isSelected}
                          className="h-5 w-5 text-navy-600 rounded focus:ring-navy-500 cursor-pointer"
                        />
                        <label 
                          htmlFor={`doc-${index}`} 
                          className={`ml-3 font-medium cursor-pointer ${isAvailable ? 'text-gray-800' : 'text-gray-500'}`}
                          onClick={() => {
                            if (!(!isAvailable && !isSelected)) {
                              handleDocumentSelect(documentName);
                            }
                          }}
                        >
                          {documentName}
                        </label>
                        
                        {isAvailable && isSelected && (
                          <span className="ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                            <FiCheck className="mr-1" />
                            Selected
                          </span>
                        )}
                      </div>
                      
                      <div className="ml-8">
                        {/* Document Status */}
                        <div className="mb-2">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            docStatus.available 
                              ? 'bg-emerald-100 text-emerald-700' 
                              : docStatus.status === 'pending'
                              ? 'bg-amber-100 text-amber-700'
                              : docStatus.status === 'rejected'
                              ? 'bg-rose-100 text-rose-700'
                              : 'bg-gray-100 text-gray-700'
                          }`}>
                            {docStatus.available 
                              ? 'Available' 
                              : docStatus.status === 'pending'
                              ? 'Pending Review'
                              : docStatus.status === 'rejected'
                              ? 'Rejected'
                              : 'Not Uploaded'
                            }
                          </span>
                          
                          {doc.requires_number && (
                            <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                              Requires Number
                            </span>
                          )}
                          
                          {doc.requires_expiry && (
                            <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                              Requires Expiry
                            </span>
                          )}
                        </div>
                        
                        {/* Document Details if available */}
                        {docStatus.doc && (
                          <div className="text-sm text-gray-600 space-y-1">
                            <p>Version: {docStatus.doc.version}</p>
                            {docStatus.doc.expiry_date && (
                              <p>Expires: {new Date(docStatus.doc.expiry_date).toLocaleDateString('en-IN')}</p>
                            )}
                            <p>Uploaded: {new Date(docStatus.doc.created_at).toLocaleDateString('en-IN')}</p>
                          </div>
                        )}
                        
                        {/* Action Links for unavailable documents */}
                        {!isAvailable && (
                          <div className="mt-3">
                            <a
                              href="/customer/mydocuments"
                              className="inline-flex items-center text-sm text-navy-700 hover:text-navy-800"
                            >
                              <FiUpload className="mr-1" />
                              {docStatus.status === 'rejected' ? 'Upload New Version' : 'Upload Document'}
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* Document Icon */}
                    <div className={`p-3 rounded-lg ${
                      isAvailable 
                        ? 'bg-navy-100 text-navy-600' 
                        : 'bg-gray-100 text-gray-400'
                    }`}>
                      <FiFile className="text-xl" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Upload New Document CTA */}
        <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-100">
          <div className="flex items-center">
            <FiInfo className="text-blue-600 mr-3 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm text-blue-700">
                Missing a required document? Upload it from your documents dashboard.
              </p>
            </div>
            <a
              href="/customer/mydocuments"
              className="inline-flex items-center px-4 py-2 bg-white text-navy-700 rounded-lg border border-gray-300 hover:border-navy-400 hover:bg-gray-50"
            >
              <FiUpload className="mr-2" />
              Go to Documents
            </a>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h4 className="font-bold text-gray-800">Ready to Continue?</h4>
            <p className="text-sm text-gray-600 mt-1">
              {selectedDocuments.length} of {requiredDocuments.length} documents selected
              {allDocumentsReady && (
                <span className="ml-2 text-emerald-600 font-medium">
                  ✓ All documents ready
                </span>
              )}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={handleSaveDraft}
              disabled={isSubmitting}
              className="px-6 py-3 text-gray-700 border border-gray-300 rounded-lg font-medium hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Save as Draft
            </button>
            <button
              onClick={handleContinue}
              disabled={isSubmitting || selectedDocuments.length === 0}
              className={`px-6 py-3 rounded-lg font-medium transition-colors flex items-center justify-center min-w-[180px] ${
                isSubmitting || selectedDocuments.length === 0
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-navy-700 text-white hover:bg-navy-800'
              }`}
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Processing...
                </>
              ) : allDocumentsReady ? (
                `Continue to Document Review`
              ) : (
                `Save and Continue Later`
              )}
            </button>
          </div>
        </div>
        
        {/* Progress Indicator */}
        <div className="mt-6">
          <div className="flex justify-between text-sm text-gray-600 mb-1">
            <span>Application Progress</span>
            <span>{allDocumentsReady ? '50%' : '25%'}</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-navy-600 h-2 rounded-full transition-all duration-300"
              style={{ width: allDocumentsReady ? '50%' : '25%' }}
            ></div>
          </div>
          <div className="flex justify-between mt-2">
            <span className="text-xs text-gray-500">1. Application Started</span>
            <span className="text-xs text-gray-500">2. Document Selection</span>
            <span className="text-xs text-gray-500">3. Review</span>
            <span className="text-xs text-gray-500">4. Submit</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContinueApplication;