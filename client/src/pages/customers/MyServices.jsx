import React, { useState, useEffect } from 'react';
import { 
  FiUpload, FiEye, FiCheckCircle, FiAlertCircle, FiClock, 
  FiFileText, FiDollarSign, FiInfo, FiCalendar, FiRefreshCw, 
  FiHash, FiPlusCircle, FiXCircle, FiLoader, FiExternalLink,
  FiArrowRight, FiUser, FiStar
} from 'react-icons/fi';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import ApplyForService from '@/components/ApplyForService';
import ReviewModal from '@/components/ReviewModal';
import { getBookingReview } from '@/services/reviewService';

const MyServices = () => {
  const [activeFilter, setActiveFilter] = useState('active');
  const [services, setServices] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const navigate = useNavigate();

  // Review states
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [selectedServiceForReview, setSelectedServiceForReview] = useState(null);
  const [reviewedServices, setReviewedServices] = useState({});
  const [reviewMode, setReviewMode] = useState('submit'); // 'submit' or 'view'

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

  // Handle response errors globally
  API.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error.response?.status === 401) {
        // Handle unauthorized access
        toast.error('Session expired. Please login again.');
        // Redirect to login after a delay
        setTimeout(() => {
          localStorage.removeItem("customer_token");
          window.location.href = '/customer/login';
        }, 2000);
      }
      return Promise.reject(error);
    }
  );

  // Check if a service has been reviewed
  const checkReviewStatus = async (serviceId) => {
    try {
      const review = await getBookingReview(serviceId);
      if (review) {
        setReviewedServices(prev => ({
          ...prev,
          [serviceId]: review
        }));
        return review;
      }
    } catch (error) {
      // No review found or error - ignore
      console.log('No review found for service:', serviceId);
      return null;
    }
  };

  // Fetch services from backend using Axios
  const fetchServices = async () => {
    try {
      setIsLoading(true);
      const response = await API.get('/api/customer/bookings');
      setServices(response.data);
      
      // Check review status for completed services
      const completedServices = response.data.filter(s => s.status === 'completed');
      for (const service of completedServices) {
        await checkReviewStatus(service.id);
      }
    } catch (error) {
      console.error('Error fetching services:', error);
      let errorMessage = 'Failed to load services';
      
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      }
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  // Handle refresh
  const handleRefresh = () => {
    setRefreshing(true);
    fetchServices();
  };

  // Handle service application
  const handleServiceApplicationSuccess = () => {
    setShowApplyModal(false);
    toast.success('Service application submitted successfully!');
    fetchServices(); // Refresh the list
  };

  // Handle cancel service
  const handleCancelService = async (serviceId, serviceName) => {
    if (!window.confirm(`Are you sure you want to cancel "${serviceName}"?`)) {
      return;
    }

    try {
      await API.delete(`/api/customer/bookings/${serviceId}`);
      toast.success('Service application cancelled successfully');
      fetchServices(); // Refresh list
    } catch (error) {
      console.error('Error cancelling service:', error);
      let errorMessage = 'Failed to cancel service';
      
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      }
      toast.error(errorMessage);
    }
  };

  // Handle continue application
  const handleContinueApplication = (serviceId) => {
    navigate(`/customer/myservices/continue/${serviceId}`);
  };

  // Handle view details
  const handleViewDetails = (serviceId) => {
    navigate(`/customer/myservices/${serviceId}`);
  };

  // Handle upload documents
  const handleUploadDocuments = (serviceId) => {
    navigate(`/customer/myservices/${serviceId}/documents`);
  };

  // Handle make payment
  const handleMakePayment = (serviceId) => {
    navigate(`/customer/myservices/${serviceId}/payment`);
  };

  // Handle open review modal for submission
  const handleOpenReview = (service) => {
    setSelectedServiceForReview(service);
    setReviewMode('submit');
    setReviewModalOpen(true);
  };

  // Handle view existing review
  const handleViewReview = (service, review) => {
    setSelectedServiceForReview({
      ...service,
      review: review
    });
    setReviewMode('view');
    setReviewModalOpen(true);
  };

  // Handle review success
  const handleReviewSuccess = () => {
    // Refresh services to update review status
    fetchServices();
  };

  // Initialize and fetch services
  useEffect(() => {
    fetchServices();
  }, []);

  const getStatusColor = (status) => {
    switch(status) {
      case 'draft':
        return { bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-200' };
      case 'pending_documents':
      case 'action_required':
        return { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' };
      case 'under_review':
      case 'in_progress':
        return { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' };
      case 'payment_pending':
        return { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' };
      case 'completed':
        return { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' };
      case 'rejected':
      case 'cancelled':
        return { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' };
      default:
        return { bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-200' };
    }
  };

  const getStatusIcon = (status) => {
    switch(status) {
      case 'draft':
        return <FiFileText className="text-lg" />;
      case 'pending_documents':
      case 'action_required':
        return <FiAlertCircle className="text-lg" />;
      case 'under_review':
      case 'in_progress':
        return <FiClock className="text-lg" />;
      case 'payment_pending':
        return <FiDollarSign className="text-lg" />;
      case 'completed':
        return <FiCheckCircle className="text-lg" />;
      case 'rejected':
      case 'cancelled':
        return <FiXCircle className="text-lg" />;
      default:
        return <FiClock className="text-lg" />;
    }
  };

  const getActionIcon = (actionType) => {
    switch(actionType) {
      case 'upload_document':
        return <FiUpload className="text-sm" />;
      case 'make_payment':
        return <FiDollarSign className="text-sm" />;
      case 'view_details':
      case 'view_certificate':
      case 'view_reason':
      case 'view_review':
        return <FiEye className="text-sm" />;
      case 'continue_application':
        return <FiArrowRight className="text-sm" />;
      case 'review':
        return <FiStar className="text-sm" />;
      default:
        return <FiEye className="text-sm" />;
    }
  };

  // Determine primary action based on status
  const getPrimaryAction = (service) => {
    const amount = service.total_charges || service.service_data?.total_charges || 0;
    const hasReview = reviewedServices[service.id];
    
    switch(service.status) {
      case 'draft':
        return {
          type: "continue_application",
          label: "Continue Application",
          onClick: () => handleContinueApplication(service.id)
        };
      case 'pending_documents':
      case 'action_required':
        return {
          type: "upload_document",
          label: "Upload Documents",
          onClick: () => handleUploadDocuments(service.id)
        };
      case 'payment_pending':
        return {
          type: "make_payment",
          label: `Pay Now (₹${amount})`,
          onClick: () => handleMakePayment(service.id)
        };
      case 'under_review':
      case 'in_progress':
        return {
          type: "view_details",
          label: "View Details",
          onClick: () => handleViewDetails(service.id)
        };
      case 'completed':
        if (hasReview) {
          return {
            type: "view_review",
            label: "View My Review",
            onClick: () => handleViewReview(service, hasReview)
          };
        } else {
          return {
            type: "review",
            label: "Rate Service",
            onClick: () => handleOpenReview(service)
          };
        }
      case 'rejected':
        return {
          type: "view_reason",
          label: "View Reason",
          onClick: () => handleViewDetails(service.id)
        };
      default:
        return {
          type: "view_details",
          label: "View Details",
          onClick: () => handleViewDetails(service.id)
        };
    }
  };

  // Get status display label
  const getStatusLabel = (status) => {
    const labels = {
      'draft': 'Draft',
      'pending_documents': 'Action Required',
      'action_required': 'Action Required',
      'payment_pending': 'Payment Pending',
      'under_review': 'Under Review',
      'in_progress': 'In Progress',
      'completed': 'Completed',
      'rejected': 'Rejected',
      'cancelled': 'Cancelled'
    };
    return labels[status] || status;
  };

  const filterServices = () => {
    const activeStatuses = ['draft', 'pending_documents', 'action_required', 'under_review', 'in_progress', 'payment_pending'];
    const completedStatuses = ['completed', 'rejected', 'cancelled'];
    
    switch(activeFilter) {
      case 'active':
        return services.filter(service => activeStatuses.includes(service.status));
      case 'completed':
        return services.filter(service => completedStatuses.includes(service.status));
      case 'all':
      default:
        return services;
    }
  };

  const filteredServices = filterServices();

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      // If it's already in YYYY-MM-DD format, parse it directly
      if (typeof dateString === 'string' && dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
        const [year, month, day] = dateString.split('-');
        const date = new Date(year, month - 1, day);
        return date.toLocaleDateString('en-IN', {
          day: 'numeric',
          month: 'short',
          year: 'numeric'
        });
      }
      
      // Otherwise try parsing normally
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'N/A';
      
      return date.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'N/A';
    }
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'N/A';
      
      const timeOptions = { hour: '2-digit', minute: '2-digit' };
      return `${date.toLocaleDateString('en-IN')} at ${date.toLocaleTimeString('en-IN', timeOptions)}`;
    } catch (error) {
      return 'N/A';
    }
  };

  const getActionButtonClass = (status) => {
    if (status === 'pending_documents' || status === 'payment_pending') {
      return 'bg-navy-700 text-white hover:bg-navy-800 border border-navy-700';
    }
    if (status === 'completed') {
      return 'bg-emerald-600 text-white hover:bg-emerald-700 border border-emerald-600';
    }
    return 'bg-white text-navy-700 hover:bg-gray-50 border border-gray-300';
  };

  // Get completion date display
  const getCompletionDisplay = (service) => {
    if (service.status === 'completed') {
      return 'Completed';
    } else if (service.status === 'rejected' || service.status === 'cancelled') {
      return service.status.charAt(0).toUpperCase() + service.status.slice(1);
    } else if (service.estimated_completion) {
      return formatDate(service.estimated_completion);
    }
    return 'Not set';
  };

  // Get progress percentage
  const getProgress = (service) => {
    // Try all possible locations where progress might be stored
    let progressValue = 
      service.progress ||                       // Direct property
      service.tracking_progress ||               // tracking_progress field
      service.service_data?.progress ||          // Inside service_data
      service.service_data?.tracking?.progress || // Inside service_data.tracking
      0;                                          // Default to 0 if none found
    
    // Convert to number and ensure it's valid
    progressValue = Number(progressValue);
    
    if (isNaN(progressValue)) {
      progressValue = 0;
    }
    
    // If progress is 0 but service is active, provide default based on status
    if (progressValue === 0) {
      const defaultProgress = {
        'draft': 10,
        'pending_documents': 30,
        'action_required': 30,
        'payment_pending': 40,
        'submitted': 25,
        'under_review': 50,
        'in_progress': 70,
        'completed': 100,
        'rejected': 100,
        'cancelled': 100
      };
      
      progressValue = defaultProgress[service.status] || 25;
    }
    
    return progressValue;
  };

  // Calculate counts for filter tabs
  const activeCount = services.filter(s => 
    ['draft', 'pending_documents', 'action_required', 'under_review', 'in_progress', 'payment_pending'].includes(s.status)
  ).length;
  
  const completedCount = services.filter(s => 
    ['completed', 'rejected', 'cancelled'].includes(s.status)
  ).length;

  const reviewedCount = Object.keys(reviewedServices).length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-navy-700 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading your services...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <ToastContainer position="top-right" autoClose={3000} />
      
      {/* Page Header with Apply Button */}
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">My Services</h1>
            <p className="text-gray-600 mt-1">Track all your service applications</p>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="inline-flex items-center justify-center px-4 py-2.5 text-sm bg-white text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors duration-200 border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FiRefreshCw className={`mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </button>
            <button
              onClick={() => setShowApplyModal(true)}
              className="inline-flex items-center justify-center px-5 py-2.5 bg-navy-700 text-white rounded-xl font-medium hover:bg-navy-800 transition-colors duration-200 shadow-sm"
            >
              <FiPlusCircle className="mr-2" />
              Apply for New Service
            </button>
          </div>
        </div>
      </div>

      {/* Filter Tabs with Service Count */}
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex space-x-2 bg-gray-100 p-1 rounded-xl max-w-md">
            {['all', 'active', 'completed'].map((filter) => (
              <button
                key={filter}
                onClick={() => setActiveFilter(filter)}
                disabled={isLoading}
                className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all duration-200 ${
                  activeFilter === filter
                    ? 'bg-white text-navy-700 shadow-sm'
                    : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
                } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {filter.charAt(0).toUpperCase() + filter.slice(1)}
                <span className="ml-1 text-xs opacity-70">
                  ({filter === 'all' && services.length}
                  {filter === 'active' && activeCount}
                  {filter === 'completed' && completedCount})
                </span>
              </button>
            ))}
          </div>
          
          {/* Last Updated Time */}
          <div className="flex items-center text-sm text-gray-500">
            <FiRefreshCw className="mr-2" />
            <span>Last updated: {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        </div>
      </div>

      {/* Review Summary Banner - Show if there are reviewed services */}
      {reviewedCount > 0 && (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-center justify-between">
          <div className="flex items-center">
            <FiStar className="text-yellow-500 mr-2" />
            <span className="text-sm text-gray-700">
              You have <span className="font-semibold">{reviewedCount}</span> reviewed service{reviewedCount > 1 ? 's' : ''}
            </span>
          </div>
          <button
            onClick={() => setActiveFilter('completed')}
            className="text-xs text-navy-600 hover:text-navy-800 font-medium"
          >
            View completed services
          </button>
        </div>
      )}

      {/* Services List or Empty State */}
      {filteredServices.length > 0 ? (
        <div className="space-y-3 mb-8">
          {filteredServices.map((service) => {
            const statusColors = getStatusColor(service.status);
            const primaryAction = getPrimaryAction(service);
            const progress = getProgress(service);
            const completionDisplay = getCompletionDisplay(service);
            const hasReview = reviewedServices[service.id];
            
            return (
              <div
                key={service.id}
                className={`bg-white rounded-xl p-5 shadow-sm border ${statusColors.border} hover:shadow-md transition-all duration-200`}
              >
                <div className="flex flex-col lg:flex-row gap-5">
                  {/* Left Column: Service Details */}
                  <div className="lg:w-2/3">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-3 mb-2">
                          <span className="inline-flex items-center bg-gray-100 px-2.5 py-1 rounded-lg text-xs text-gray-700">
                            <FiHash className="mr-1.5" />
                            {service.application_number || `TEMP-${service.id}`}
                          </span>

                          <span className="inline-flex items-center bg-blue-50 px-2.5 py-1 rounded-lg text-xs text-blue-700 border border-blue-100">
                            {service.category || 'Service'}
                          </span>
                          {service.subcategory_name && (
                            <span className="inline-flex items-center bg-purple-50 px-2.5 py-1 rounded-lg text-xs text-purple-700 border border-purple-100">
                              {service.subcategory_name}
                            </span>
                          )}
                          
                          {/* Review Badge for completed services */}
                          {service.status === 'completed' && hasReview && (
                            <span className="inline-flex items-center bg-yellow-100 px-2.5 py-1 rounded-lg text-xs text-yellow-700 border border-yellow-200">
                              <FiStar className="mr-1.5" />
                              Reviewed
                            </span>
                          )}
                        </div>
                        {service.service_description && (
                          <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                            {service.service_description}
                          </p>
                        )}
                      </div>
                      
                      {/* Status Badge */}
                      <div className={`inline-flex items-center self-start px-3 py-1.5 rounded-lg ${statusColors.bg} ${statusColors.text} border ${statusColors.border}`}>
                        {getStatusIcon(service.status)}
                        <span className="ml-2 font-medium text-sm">{getStatusLabel(service.status)}</span>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    {service.status !== 'completed' && service.status !== 'rejected' && service.status !== 'cancelled' && (
                      <div className="mb-4">
                        <div className="flex justify-between text-xs text-gray-600 mb-1">
                          <span>Progress</span>
                          <span className={`font-semibold ${
                            progress < 30 ? 'text-amber-600' :
                            progress < 60 ? 'text-blue-600' :
                            progress < 90 ? 'text-indigo-600' :
                            'text-emerald-600'
                          }`}>{progress}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden shadow-inner">
                          <div 
                            className="h-3 rounded-full transition-all duration-700 ease-out"
                            style={{ 
                              width: `${progress}%`,
                              background: progress < 30 
                                ? 'linear-gradient(90deg, #f59e0b 0%, #d97706 100%)'
                                : progress < 60
                                ? 'linear-gradient(90deg, #3b82f6 0%, #2563eb 100%)'
                                : progress < 90
                                ? 'linear-gradient(90deg, #6366f1 0%, #4f46e5 100%)'
                                : 'linear-gradient(90deg, #10b981 0%, #059669 100%)',
                              boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
                            }}
                          ></div>
                        </div>
                        {/* Show current step from tracking */}
                        {(service.current_step || 
                          service.tracking_current_step || 
                          service.service_data?.current_step || 
                          service.service_data?.tracking?.current_step) && (
                          <p className="text-xs text-gray-500 mt-1">
                            Current step: <span className="font-medium">
                              {service.current_step || 
                              service.tracking_current_step || 
                              service.service_data?.current_step || 
                              service.service_data?.tracking?.current_step}
                            </span>
                            {(service.assigned_staff_name || service.service_data?.tracking?.assigned_staff_name) && (
                              <span className="ml-2 text-navy-600">
                                • Assigned to: {service.assigned_staff_name || service.service_data?.tracking?.assigned_staff_name}
                              </span>
                            )}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Service Metadata */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div className="flex items-center">
                        <div className="bg-gray-100 p-2 rounded-lg mr-3">
                          <FiCalendar className="text-gray-600" />
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Applied On</p>
                          <p className="text-sm font-medium text-gray-800">
                            {formatDate(service.applied_at)}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center">
                        <div className="bg-gray-100 p-2 rounded-lg mr-3">
                          <FiRefreshCw className="text-gray-600" />
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">
                            {service.status === 'completed' ? 'Completed On' : 'Estimated Completion'}
                          </p>
                          <p className={`text-sm font-medium ${
                            service.status === 'completed' ? 'text-emerald-600' : 
                            service.status === 'rejected' || service.status === 'cancelled' ? 'text-rose-600' : 
                            'text-gray-800'
                          }`}>
                            {completionDisplay}
                          </p>
                        </div>
                      </div>
                      {service.assigned_staff_name && (
                        <div className="flex items-center text-sm text-gray-600 mt-1">
                          <FiUser className="mr-2 text-gray-400" />
                          <span>Assigned to: <span className="font-medium">{service.assigned_staff_name}</span></span>
                        </div>
                      )}
                      {service.service_data?.tracking?.estimated_delivery && (
                        <div className="flex items-center text-sm text-gray-600 mt-1">
                          <FiCalendar className="mr-2 text-gray-400" />
                          <span>Est. Delivery: {formatDate(service.service_data.tracking.estimated_delivery)}</span>
                        </div>
                      )}
                    </div>

                    {/* Action Message */}
                    {service.status === 'pending_documents' && (
                      <div className="flex items-start bg-orange-50 p-3 rounded-lg border border-orange-100 mb-3">
                        <FiAlertCircle className="text-orange-600 mt-0.5 mr-2 flex-shrink-0" />
                        <div className="flex-1">
                          <p className="text-sm text-orange-700">
                            <span className="font-medium">Documents Required:</span> Please upload the required documents to continue processing.
                          </p>
                          <button 
                            onClick={() => handleUploadDocuments(service.id)}
                            className="inline-flex items-center text-xs text-orange-800 font-medium mt-1 hover:text-orange-900"
                          >
                            <FiExternalLink className="mr-1" />
                            View required documents
                          </button>
                        </div>
                      </div>
                    )}
                    
                    {service.status === 'payment_pending' && (
                      <div className="flex items-start bg-rose-50 p-3 rounded-lg border border-rose-100 mb-3">
                        <FiAlertCircle className="text-rose-600 mt-0.5 mr-2 flex-shrink-0" />
                        <div className="flex-1">
                          <p className="text-sm text-rose-700">
                            <span className="font-medium">Payment Required:</span> Payment pending for processing fees.
                          </p>
                          <button 
                            onClick={() => handleMakePayment(service.id)}
                            className="inline-flex items-center text-xs text-rose-800 font-medium mt-1 hover:text-rose-900"
                          >
                            <FiExternalLink className="mr-1" />
                            Proceed to payment
                          </button>
                        </div>
                      </div>
                    )}
                    
                    {service.status === 'rejected' && (
                      <div className="flex items-start bg-rose-50 p-3 rounded-lg border border-rose-100 mb-3">
                        <FiAlertCircle className="text-rose-600 mt-0.5 mr-2 flex-shrink-0" />
                        <p className="text-sm text-rose-700">
                          <span className="font-medium">Application Rejected:</span> {service.remarks || 'Please check the details for more information.'}
                        </p>
                      </div>
                    )}

                    {/* Remarks if any */}
                    {service.remarks && service.status !== 'rejected' && (
                      <div className="text-xs text-gray-600 bg-gray-50 p-2 rounded-lg">
                        <span className="font-medium">Note:</span> {service.remarks}
                      </div>
                    )}
                  </div>

                  {/* Right Column: Action Button */}
                  <div className="lg:w-1/3 lg:border-l lg:border-gray-200 lg:pl-5">
                    <div className="flex flex-col h-full">
                      <div className="mb-4">
                        <p className="text-xs text-gray-500 mb-2">Last Updated</p>
                        <p className="text-sm font-medium text-gray-800">
                          {formatDateTime(service.last_updated)}
                        </p>
                      </div>
                      
                      <div className="mt-auto space-y-2">
                        <button
                          onClick={primaryAction.onClick}
                          className={`inline-flex items-center justify-center w-full py-3 rounded-lg font-medium transition-colors duration-200 ${getActionButtonClass(service.status)}`}
                        >
                          {getActionIcon(primaryAction.type)}
                          <span className="ml-2">{primaryAction.label}</span>
                        </button>
                        
                        {/* Secondary Actions */}
                        <div className="flex space-x-2">
                          <button
                            onClick={() => navigate(`/customer/myservices/${service.id}/timeline`)}
                            className="inline-flex items-center justify-center flex-1 py-2 text-sm text-navy-600 hover:text-navy-800 hover:bg-navy-50 rounded-lg transition-colors duration-200 border border-gray-200"
                          >
                            <FiEye className="mr-1.5" />
                            View Details
                          </button>
                          
                          {(service.status === 'draft' || service.status === 'pending_documents' || service.status === 'payment_pending') && (
                            <button
                              onClick={() => handleCancelService(service.id, service.service_name || service.application_number)}
                              className="inline-flex items-center justify-center flex-1 py-2 text-sm text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-lg transition-colors duration-200 border border-rose-200"
                            >
                              <FiXCircle className="mr-1.5" />
                              Cancel
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Empty State */
        <div className="bg-white rounded-xl p-8 shadow-sm border border-gray-200 text-center mb-8">
          <div className="max-w-md mx-auto">
            <div className="bg-gray-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
              <FiFileText className="text-gray-400 text-3xl" />
            </div>
            <h3 className="text-xl font-bold text-gray-800 mb-2">No services found</h3>
            <p className="text-gray-600 mb-6">
              {activeFilter === 'all'
                ? "You haven't applied for any services yet. Get started with our digital services!"
                : `You don't have any ${activeFilter} services at the moment.`}
            </p>
            <div className="space-y-3">
              <button
                onClick={() => setShowApplyModal(true)}
                className="inline-flex items-center justify-center w-full sm:w-auto px-6 py-3 bg-navy-700 text-white rounded-lg font-medium hover:bg-navy-800 transition-colors duration-200"
              >
                <FiPlusCircle className="mr-2" />
                Apply for a New Service
              </button>
              <p className="text-sm text-gray-500">
                Browse available services and apply online
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Help Section */}
      {filteredServices.length > 0 && (
        <div className="mt-8 p-5 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl border border-blue-100">
          <div className="flex flex-col md:flex-row items-start gap-5">
            <div className="bg-white p-3 rounded-xl shadow-sm flex-shrink-0">
              <FiInfo className="text-blue-600 text-xl" />
            </div>
            <div className="flex-1">
              <h4 className="font-semibold text-blue-800 mb-2 text-lg">Need help with your services?</h4>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4">
                <div className="space-y-3">
                  <p className="text-sm text-blue-700">
                    <span className="font-medium">Service Queries:</span> Have questions about your application status or requirements?
                  </p>
                  <div className="flex items-center space-x-4">
                    <button 
                      onClick={() => navigate('/customer/support')}
                      className="text-sm bg-white text-navy-700 font-medium hover:text-navy-800 hover:bg-gray-50 px-4 py-2 rounded-lg border border-gray-300 transition-colors"
                    >
                      Submit Support Ticket
                    </button>
                    <a 
                      href="tel:0471-1234567" 
                      className="text-sm text-navy-700 font-medium hover:text-navy-800 inline-flex items-center"
                    >
                      Call Support
                    </a>
                  </div>
                </div>
                <div className="space-y-3">
                  <p className="text-sm text-blue-700">
                    <span className="font-medium">Support Hours:</span> Monday to Saturday, 9 AM to 6 PM
                  </p>
                  <p className="text-sm text-blue-700">
                    <span className="font-medium">Email:</span> support@akshayacentre.gov.in
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Apply for Service Modal */}
      {showApplyModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center sticky top-0 bg-white z-10">
              <h3 className="text-xl font-bold text-gray-800">Apply for Service</h3>
              <button
                onClick={() => setShowApplyModal(false)}
                className="text-gray-500 hover:text-gray-700 p-1 rounded-full hover:bg-gray-100"
              >
                ✕
              </button>
            </div>
            <div className="p-6">
              <ApplyForService 
                onSuccess={handleServiceApplicationSuccess}
                onCancel={() => setShowApplyModal(false)}
              />
            </div>
          </div>
        </div>
      )}

      {/* Review Modal */}
      {reviewModalOpen && selectedServiceForReview && (
        <ReviewModal
          isOpen={reviewModalOpen}
          onClose={() => {
            setReviewModalOpen(false);
            setSelectedServiceForReview(null);
            setReviewMode('submit');
          }}
          booking={selectedServiceForReview}
          mode={reviewMode}
          onSuccess={handleReviewSuccess}
        />
      )}
    </div>
  );
};

export default MyServices;