import React, { useState, useEffect } from 'react';
import { 
  FiFile, FiCheck, FiAlertCircle, FiArrowLeft,
  FiUpload, FiExternalLink, FiEye, FiDownload,
  FiCreditCard, FiLock, FiCalendar, FiUser
} from 'react-icons/fi';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const ApplicationDocuments = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [serviceApplication, setServiceApplication] = useState(null);
  const [selectedDocuments, setSelectedDocuments] = useState([]);
  const [additionalInfo, setAdditionalInfo] = useState({});
  const [paymentMethod, setPaymentMethod] = useState('online');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [originalDocumentNames, setOriginalDocumentNames] = useState([]); // Store original document names

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
      
      // Get selected documents from service_data
      const serviceData = response.data.service_data || {};
      const selectedDocs = serviceData.selected_documents || [];
      
      // Store original document names
      setOriginalDocumentNames(selectedDocs);
      
      // Initialize selected documents from service_data if exists
      const savedAdditionalInfo = serviceData.additional_info || {};
      setAdditionalInfo(savedAdditionalInfo);
      
    } catch (error) {
      console.error('Error fetching service application:', error);
      let errorMessage = 'Failed to load application details';
      
      if (error.response?.status === 401) {
        errorMessage = 'Session expired. Please login again.';
        setTimeout(() => {
          navigate('/customer/login');
        }, 2000);
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      }
      
      toast.error(errorMessage);
      navigate('/customer/myservices'); // FIXED: Changed from /customer/services
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch document details for selected documents - FIXED
  const fetchDocumentDetails = async () => {
    try {
      const response = await API.get('/api/customer/documents');
      const allDocuments = response.data;
      
      // Filter and enrich selected documents with details
      const enrichedDocuments = originalDocumentNames.map(docName => {
        const doc = allDocuments.find(d => 
          d.document_name === docName && d.is_latest === true
        );
        return {
          name: docName,
          id: doc?.id,
          status: doc?.status || 'missing',
          version: doc?.version,
          expiry_date: doc?.expiry_date,
          created_at: doc?.created_at,
          document_url: doc?.document_url,
          previewUrl: doc?.document_url || '#'
        };
      }).filter(doc => doc.id); // Only keep documents that exist in the database
      
      setSelectedDocuments(enrichedDocuments);
    } catch (error) {
      console.error('Error fetching document details:', error);
      toast.error('Failed to load document details');
    }
  };

  useEffect(() => {
    fetchServiceApplication();
  }, [id]);

  useEffect(() => {
    if (originalDocumentNames.length > 0 && serviceApplication) {
      fetchDocumentDetails();
    }
  }, [serviceApplication, originalDocumentNames]);

  // Handle additional info changes
  const handleAdditionalInfoChange = (field, value) => {
    setAdditionalInfo(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Handle payment method change
  const handlePaymentMethodChange = (method) => {
    setPaymentMethod(method);
    if (method === 'online') {
      setShowPaymentForm(true);
    } else {
      setShowPaymentForm(false);
    }
  };

  // Preview document
  const handlePreviewDocument = (documentUrl) => {
    if (documentUrl && documentUrl !== '#') {
      window.open(documentUrl, '_blank');
    } else {
      toast.error('Document preview not available');
    }
  };

  // Download document
  const handleDownloadDocument = async (documentId, fileName) => {
    if (!documentId) {
      toast.error('Document not available for download');
      return;
    }

    try {
      const response = await API.get(`/api/customer/documents/${documentId}/download`, {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fileName || 'document.pdf');
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Error downloading document:', error);
      toast.error('Failed to download document');
    }
  };

  // Submit application (payment pending)
  const handlePayment = async () => {
    if (!termsAccepted) {
      toast.error('Please accept the terms and conditions');
      return;
    }

    if (selectedDocuments.length === 0) {
      toast.error('No documents selected for this application');
      return;
    }

    setIsProcessingPayment(true);
    
    try {
      // Submit application with payment info
      const response = await API.put(`/api/customer/bookings/${id}/payment`, {
        payment_method: paymentMethod,
        additional_info: additionalInfo,
        selected_documents: originalDocumentNames
      });

      console.log('Application submission response:', response.data);

      if (response.data.success) {
        // Show appropriate message based on payment method
        if (paymentMethod === 'online') {
          toast.success(
            <div>
              <p className="font-bold mb-2">Application Submitted Successfully!</p>
              <p>Our staff will contact you via WhatsApp/Email with payment details.</p>
              <p className="mt-2 text-sm">Amount to pay: ₹{totalCharges}</p>
            </div>,
            { autoClose: 8000 }
          );
        } else {
          toast.success(
            <div>
              <p className="font-bold mb-2">Application Submitted Successfully!</p>
              <p>Please visit our office to complete payment.</p>
              <p className="mt-2 text-sm">Address: Akshaya Centre, Trivandrum</p>
              <p className="text-sm">Amount to pay: ₹{totalCharges}</p>
            </div>,
            { autoClose: 8000 }
          );
        }
        
        // Navigate to confirmation
        setTimeout(() => {
          navigate(`/customer/myservices/${id}/confirmation`);
        }, 1500);
      } else {
        toast.error(response.data.message || 'Submission failed');
        setIsProcessingPayment(false);
      }
      
    } catch (error) {
      console.error('Error submitting application:', error);
      
      let errorMessage = 'Failed to submit application';
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      }
      
      toast.error(errorMessage);
      setIsProcessingPayment(false);
    }
  };

  // Final submission - FIXED
  const handleFinalSubmission = async () => {
    try {
      setIsSubmitting(true);
      
      // Update service application with additional info and final submission
      const updatedServiceData = {
        ...serviceApplication.service_data,
        additional_info: additionalInfo,
        submitted_at: new Date().toISOString(),
        selected_documents: originalDocumentNames // Use original document names
      };

      await API.put(`/api/customer/bookings/${id}`, {
        service_data: updatedServiceData,
        status: 'submitted',
        payment_status: 'completed',
        remarks: 'Application submitted successfully'
      });

      toast.success('Application submitted successfully!');
      
      // Redirect to confirmation page
      navigate(`/customer/myservices/${id}/confirmation`); // FIXED: Changed route

    } catch (error) {
      console.error('Error submitting application:', error);
      let errorMessage = 'Failed to submit application';
      
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      }
      
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle back - FIXED
  const handleBack = () => {
    navigate(`/customer/myservices/continue/${id}`); // FIXED: Changed route
  };

  // Handle save as draft - FIXED
  const handleSaveDraft = async () => {
    try {
      setIsSubmitting(true);
      
      // Update service application with additional info
      const updatedServiceData = {
        ...serviceApplication.service_data,
        additional_info: additionalInfo,
        selected_documents: originalDocumentNames
      };

      await API.put(`/api/customer/bookings/${id}`, {
        service_data: updatedServiceData,
        status: 'pending_documents',
        remarks: 'Draft saved with additional information'
      });

      toast.success('Application saved as draft!');
      
      // Navigate back to MyServices page
      navigate('/customer/myservices');

    } catch (error) {
      console.error('Error saving draft:', error);
      let errorMessage = 'Failed to save draft';
      
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      }
      
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-navy-700 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading application details...</p>
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
            onClick={() => navigate('/customer/myservices')} // FIXED: Changed route
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

  return (
    <div className="max-w-6xl mx-auto">
      <ToastContainer position="top-right" autoClose={3000} />
      
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={handleBack}
          className="inline-flex items-center text-navy-700 hover:text-navy-800 mb-4"
        >
          <FiArrowLeft className="mr-2" />
          Back to Document Selection
        </button>
        
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Review & Submit Application</h1>
            <p className="text-gray-600 mt-1">
              {serviceData.service_name} • Application #{serviceApplication.tracking?.application_number || serviceApplication.application_number}
            </p>
          </div>
          <div className="bg-emerald-50 px-4 py-2 rounded-lg border border-emerald-100">
            <p className="text-sm text-emerald-700">
              Step 3 of 4: <span className="font-bold">Review & Payment</span>
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Document Review */}
        <div className="lg:col-span-2 space-y-6">
          {/* Document Review Section */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <h3 className="text-lg font-bold text-gray-800 mb-6">Review Selected Documents</h3>
            
            {selectedDocuments.length === 0 ? (
              <div className="text-center py-8">
                <FiAlertCircle className="text-gray-400 text-4xl mx-auto mb-4" />
                <p className="text-gray-600">No documents available for this application.</p>
                <div className="mt-4 flex flex-col sm:flex-row gap-3 justify-center">
                  <button
                    onClick={handleBack}
                    className="px-4 py-2 text-navy-700 border border-navy-300 rounded-lg hover:bg-navy-50"
                  >
                    Go Back to Select Documents
                  </button>
                  <a
                    href="/customer/mydocuments"
                    className="px-4 py-2 bg-white text-navy-700 rounded-lg border border-gray-300 hover:border-navy-400 hover:bg-gray-50 text-center"
                  >
                    Upload Documents
                  </a>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {selectedDocuments.map((doc, index) => (
                  <div 
                    key={index} 
                    className="p-4 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center mb-3">
                          <div className={`p-2 rounded-lg mr-3 ${
                            doc.status === 'approved' 
                              ? 'bg-emerald-100 text-emerald-600' 
                              : 'bg-amber-100 text-amber-600'
                          }`}>
                            <FiFile className="text-xl" />
                          </div>
                          <div>
                            <h4 className="font-medium text-gray-800">{doc.name}</h4>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium mt-1 ${
                              doc.status === 'approved' 
                                ? 'bg-emerald-100 text-emerald-700' 
                                : 'bg-amber-100 text-amber-700'
                            }`}>
                              {doc.status === 'approved' ? 'Approved' : 'Pending Review'}
                            </span>
                          </div>
                        </div>
                        
                        <div className="ml-11 space-y-2 text-sm text-gray-600">
                          {doc.version && (
                            <p className="flex items-center">
                              <span className="font-medium mr-2">Version:</span>
                              {doc.version}
                            </p>
                          )}
                          {doc.expiry_date && (
                            <p className="flex items-center">
                              <FiCalendar className="mr-2" />
                              Expires: {new Date(doc.expiry_date).toLocaleDateString('en-IN')}
                            </p>
                          )}
                          {doc.created_at && (
                            <p className="flex items-center">
                              <FiCalendar className="mr-2" />
                              Uploaded: {new Date(doc.created_at).toLocaleDateString('en-IN')}
                            </p>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex space-x-2 ml-4">
                        <button
                          onClick={() => handlePreviewDocument(doc.previewUrl)}
                          disabled={!doc.previewUrl || doc.previewUrl === '#'}
                          className="p-2 text-gray-600 hover:text-navy-700 hover:bg-gray-100 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Preview"
                        >
                          <FiEye className="text-lg" />
                        </button>
                        <button
                          onClick={() => handleDownloadDocument(doc.id, doc.name)}
                          disabled={!doc.id}
                          className="p-2 text-gray-600 hover:text-navy-700 hover:bg-gray-100 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Download"
                        >
                          <FiDownload className="text-lg" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            {/* Document Upload CTA */}
            <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-100">
              <div className="flex items-center">
                <FiAlertCircle className="text-blue-600 mr-3 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm text-blue-700">
                    Need to update a document? You can upload a new version before final submission.
                  </p>
                </div>
                <a
                  href="/customer/mydocuments"
                  className="inline-flex items-center px-4 py-2 bg-white text-navy-700 rounded-lg border border-gray-300 hover:border-navy-400 hover:bg-gray-50 text-sm"
                >
                  <FiUpload className="mr-2" />
                  Upload New Version
                </a>
              </div>
            </div>
          </div>

          {/* Additional Information Section */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <h3 className="text-lg font-bold text-gray-800 mb-6">Additional Information</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Special Instructions (Optional)
                </label>
                <textarea
                  value={additionalInfo.instructions || ''}
                  onChange={(e) => handleAdditionalInfoChange('instructions', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy-500 focus:border-navy-500"
                  rows="3"
                  placeholder="Any special instructions or notes for the service provider..."
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Preferred Contact Method
                  </label>
                  <select
                    value={additionalInfo.contact_method || 'email'}
                    onChange={(e) => handleAdditionalInfoChange('contact_method', e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy-500 focus:border-navy-500"
                  >
                    <option value="email">Email</option>
                    <option value="phone">Phone</option>
                    <option value="whatsapp">WhatsApp</option>
                    <option value="sms">SMS</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Urgency Level
                  </label>
                  <select
                    value={additionalInfo.urgency || 'normal'}
                    onChange={(e) => handleAdditionalInfoChange('urgency', e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy-500 focus:border-navy-500"
                  >
                    <option value="low">Low (Standard Timeline)</option>
                    <option value="normal">Normal</option>
                    <option value="high">High (Express Service)</option>
                    <option value="urgent">Urgent (Additional Charges May Apply)</option>
                  </select>
                </div>
              </div>
              
              {/* Service-specific fields can be added here dynamically */}
              {serviceData.service_type === 'visa' && (
                <div className="p-4 bg-gray-50 rounded-lg">
                  <h4 className="font-medium text-gray-800 mb-3">Visa Specific Information</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Travel Date
                      </label>
                      <input
                        type="date"
                        value={additionalInfo.travel_date || ''}
                        onChange={(e) => handleAdditionalInfoChange('travel_date', e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy-500 focus:border-navy-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Duration of Stay (Days)
                      </label>
                      <input
                        type="number"
                        value={additionalInfo.stay_duration || ''}
                        onChange={(e) => handleAdditionalInfoChange('stay_duration', e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy-500 focus:border-navy-500"
                        min="1"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Payment & Summary */}
        <div className="space-y-6">
          {/* Order Summary */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <h3 className="text-lg font-bold text-gray-800 mb-6">Order Summary</h3>
            
            <div className="space-y-4">
              <div className="flex justify-between">
                <span className="text-gray-600">Service Fee</span>
                <span className="font-medium">₹{totalCharges}</span>
              </div>
              
              <div className="border-t pt-4">
                <div className="flex justify-between text-lg font-bold">
                  <span>Total Amount</span>
                  <span>₹{totalCharges.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* In the Payment Method section */}
          <div className="space-y-4">
            <div className="space-y-3">
              <div className={`p-4 border rounded-lg cursor-pointer transition-all ${paymentMethod === 'online' ? 'border-navy-500 bg-navy-50' : 'border-gray-200 hover:border-gray-300'}`}
                onClick={() => handlePaymentMethodChange('online')}>
                <label className="flex items-center cursor-pointer">
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="online"
                    checked={paymentMethod === 'online'}
                    onChange={() => handlePaymentMethodChange('online')}
                    className="h-4 w-4 text-navy-600 focus:ring-navy-500"
                  />
                  <span className="ml-3 flex items-center">
                    <FiCreditCard className="mr-2 text-gray-600" />
                    Pay Online (GPay/PhonePe/UPI)
                  </span>
                </label>
                {paymentMethod === 'online' && (
                  <div className="mt-3 ml-7 text-sm text-gray-600">
                    <p>• Staff will send payment QR code via WhatsApp/Email</p>
                    <p>• Complete payment after receiving instructions</p>
                    <p>• Upload payment screenshot for verification</p>
                  </div>
                )}
              </div>
              
              <div className={`p-4 border rounded-lg cursor-pointer transition-all ${paymentMethod === 'cash' ? 'border-navy-500 bg-navy-50' : 'border-gray-200 hover:border-gray-300'}`}
                onClick={() => handlePaymentMethodChange('cash')}>
                <label className="flex items-center cursor-pointer">
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="cash"
                    checked={paymentMethod === 'cash'}
                    onChange={() => handlePaymentMethodChange('cash')}
                    className="h-4 w-4 text-navy-600 focus:ring-navy-500"
                  />
                  <span className="ml-3 flex items-center">
                    <FiUser className="mr-2 text-gray-600" />
                    Pay at Office
                  </span>
                </label>
                {paymentMethod === 'cash' && (
                  <div className="mt-3 ml-7 text-sm text-gray-600">
                    <p>• Visit our office to complete payment</p>
                    <p>• Address: Akshaya Centre, Trivandrum</p>
                    <p>• Timings: Mon-Sat, 9 AM to 6 PM</p>
                    <p>• Bring your application number for reference</p>
                  </div>
                )}
              </div>
            </div>
            
            {/* Terms & Conditions */}
            <div className="mt-6">
              <label className="flex items-start cursor-pointer">
                <input
                  type="checkbox"
                  checked={termsAccepted}
                  onChange={(e) => setTermsAccepted(e.target.checked)}
                  className="h-5 w-5 text-navy-600 rounded focus:ring-navy-500 mt-0.5"
                />
                <span className="ml-3 text-sm text-gray-700">
                  I agree to the Terms & Conditions and Privacy Policy. I understand that 
                  service processing will begin only after payment verification.
                </span>
              </label>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <div className="space-y-4">
              <button
                onClick={handlePayment}
                disabled={isProcessingPayment || !termsAccepted || selectedDocuments.length === 0}
                className={`w-full py-4 rounded-lg font-bold text-lg transition-colors flex items-center justify-center ${
                  isProcessingPayment || !termsAccepted || selectedDocuments.length === 0
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-navy-700 text-white hover:bg-navy-800'
                }`}
              >
                {isProcessingPayment ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                    Submitting Application...
                  </>
                ) : (
                  <>
                    <FiCheck className="mr-3" />
                    Submit Application {paymentMethod === 'cash' ? '(Pay at Office)' : '(Payment Pending)'}
                  </>
                )}
              </button>
              
              <button
                onClick={handleSaveDraft} // FIXED: Changed from handleCancel
                disabled={isProcessingPayment || isSubmitting}
                className="w-full py-3 text-gray-700 border border-gray-300 rounded-lg font-medium hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Save as Draft
              </button>
              
              <div className="text-center text-sm text-gray-500">
                <p>Your application will be processed within 24-48 hours</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Progress Indicator */}
      <div className="mt-8 bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <div className="flex justify-between text-sm text-gray-600 mb-1">
          <span>Application Progress</span>
          <span>75%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className="bg-navy-600 h-2 rounded-full transition-all duration-300"
            style={{ width: '75%' }}
          ></div>
        </div>
        <div className="flex justify-between mt-2">
          <span className="text-xs text-gray-500 flex items-center">
            <FiCheck className="mr-1 text-emerald-600" />
            1. Application Started
          </span>
          <span className="text-xs text-gray-500 flex items-center">
            <FiCheck className="mr-1 text-emerald-600" />
            2. Document Selection
          </span>
          <span className="text-xs font-medium text-navy-700">3. Review & Payment</span>
          <span className="text-xs text-gray-500">4. Confirmation</span>
        </div>
      </div>
    </div>
  );
};

export default ApplicationDocuments;