// ViewServiceDetails.jsx

import React, { useState, useEffect } from 'react';
import {
  FiFileText, FiCalendar, FiDollarSign, FiUser,
  FiCheckCircle, FiXCircle, FiClock, FiAlertCircle,
  FiArrowLeft, FiPrinter, FiDownload, FiExternalLink,
  FiCreditCard, FiInfo, FiMapPin, FiMessageSquare, FiRefreshCw
} from 'react-icons/fi';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const ViewServiceDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [serviceApplication, setServiceApplication] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [timeline, setTimeline] = useState([]);
  const [timelineLoading, setTimelineLoading] = useState(false);

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
  const fetchServiceDetails = async () => {
    try {
      setIsLoading(true);
      const response = await API.get(`/api/customer/bookings/${id}`);
      console.log('Service details fetched:', response.data);
      setServiceApplication(response.data);
    } catch (error) {
      console.error('Error fetching service details:', error);
      let errorMessage = 'Failed to load service details';
      
      if (error.response?.status === 401) {
        errorMessage = 'Session expired. Please login again.';
        setTimeout(() => {
          navigate('/customer/login');
        }, 2000);
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      }
      
      toast.error(errorMessage);
      navigate('/customer/myservices');
    } finally {
      setIsLoading(false);
    }
  };

  // After setting serviceApplication
  useEffect(() => {
    if (serviceApplication) {
      console.log('Service application progress:', {
        progress: serviceApplication.progress,
        tracking_progress: serviceApplication.tracking?.progress,
        current_step: serviceApplication.current_step,
        tracking_current_step: serviceApplication.tracking?.current_step
      });
    }
  }, [serviceApplication]);

  // Fetch timeline data
  const fetchTimeline = async () => {
    if (!id) return;
    
    try {
      setTimelineLoading(true);
      const response = await API.get(`/api/customer/bookings/${id}/timeline`);
      setTimeline(response.data);
    } catch (error) {
      console.error('Error fetching timeline:', error);
      toast.error('Failed to load timeline');
    } finally {
      setTimelineLoading(false);
    }
  };

  useEffect(() => {
    fetchServiceDetails();
  }, [id]);

  // Fetch timeline when tab changes to timeline
  useEffect(() => {
    if (activeTab === 'timeline' && serviceApplication) {
      fetchTimeline();
    }
  }, [activeTab, serviceApplication]);

  // Get progress value from multiple possible locations
  const getProgressValue = () => {
    if (!serviceApplication) return 0;
    
    return serviceApplication.progress || 
           serviceApplication.tracking?.progress || 
           serviceApplication.service_data?.progress || 
           serviceApplication.service_data?.tracking?.progress || 
           0;
  };

  // Get status color based on progress
  const getProgressColor = (progress) => {
    if (progress < 30) return 'from-amber-500 to-amber-600';
    if (progress < 60) return 'from-blue-500 to-blue-600';
    if (progress < 90) return 'from-indigo-500 to-indigo-600';
    return 'from-emerald-500 to-emerald-600';
  };

  const getProgressTextColor = (progress) => {
    if (progress < 30) return 'text-amber-600';
    if (progress < 60) return 'text-blue-600';
    if (progress < 90) return 'text-indigo-600';
    return 'text-emerald-600';
  };

  // Get payment status color and icon
  const getPaymentStatusConfig = (status) => {
    const config = {
      'completed': { bg: 'bg-emerald-100', text: 'text-emerald-700', icon: FiCheckCircle, border: 'border-emerald-200' },
      'received': { bg: 'bg-emerald-100', text: 'text-emerald-700', icon: FiCheckCircle, border: 'border-emerald-200' },
      'success': { bg: 'bg-emerald-100', text: 'text-emerald-700', icon: FiCheckCircle, border: 'border-emerald-200' },
      'pending': { bg: 'bg-amber-100', text: 'text-amber-700', icon: FiClock, border: 'border-amber-200' },
      'initiated': { bg: 'bg-amber-100', text: 'text-amber-700', icon: FiClock, border: 'border-amber-200' },
      'failed': { bg: 'bg-rose-100', text: 'text-rose-700', icon: FiXCircle, border: 'border-rose-200' },
      'cancelled': { bg: 'bg-gray-100', text: 'text-gray-700', icon: FiXCircle, border: 'border-gray-200' }
    };
    return config[status] || config.pending;
  };

  // Format payment status text
  const formatPaymentStatus = (status) => {
    const statusMap = {
      'completed': 'Payment Completed',
      'received': 'Payment Received',
      'success': 'Payment Successful',
      'initiated': 'Payment Initiated',
      'pending': 'Payment Pending',
      'failed': 'Payment Failed',
      'cancelled': 'Payment Cancelled'
    };
    return statusMap[status] || status || 'Pending';
  };

  // Get status color and icon
  const getStatusConfig = (status) => {
    const config = {
      'draft': { color: 'gray', icon: FiFileText, bg: 'bg-gray-100', text: 'text-gray-700' },
      'pending_documents': { color: 'amber', icon: FiAlertCircle, bg: 'bg-amber-100', text: 'text-amber-700' },
      'action_required': { color: 'amber', icon: FiAlertCircle, bg: 'bg-amber-100', text: 'text-amber-700' },
      'payment_pending': { color: 'rose', icon: FiDollarSign, bg: 'bg-rose-100', text: 'text-rose-700' },
      'under_review': { color: 'blue', icon: FiClock, bg: 'bg-blue-100', text: 'text-blue-700' },
      'in_progress': { color: 'blue', icon: FiClock, bg: 'bg-blue-100', text: 'text-blue-700' },
      'completed': { color: 'emerald', icon: FiCheckCircle, bg: 'bg-emerald-100', text: 'text-emerald-700' },
      'rejected': { color: 'rose', icon: FiXCircle, bg: 'bg-rose-100', text: 'text-rose-700' },
      'cancelled': { color: 'gray', icon: FiXCircle, bg: 'bg-gray-100', text: 'text-gray-700' },
      'submitted': { color: 'blue', icon: FiCheckCircle, bg: 'bg-blue-100', text: 'text-blue-700' }
    };
    return config[status] || config.draft;
  };

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return 'Not available';
    try {
      if (typeof dateString === 'string' && dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
        const [year, month, day] = dateString.split('-');
        const date = new Date(year, month - 1, day);
        return date.toLocaleDateString('en-IN', {
          day: 'numeric',
          month: 'long',
          year: 'numeric'
        });
      }
      
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Invalid date';
      
      return date.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'Invalid date';
    }
  };

  // Format date time
  const formatDateTime = (dateString) => {
    if (!dateString) return 'Not available';
    try {
      const date = new Date(dateString);
      return date.toLocaleString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      return 'Invalid date';
    }
  };

  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount || 0);
  };

  // Helper functions for timeline icons and badges
  const getIconForEvent = (event) => {
    switch(event.icon) {
      case 'file': return <FiFileText className="text-blue-600" />;
      case 'check': return <FiCheckCircle className="text-emerald-600" />;
      case 'send': return <FiCheckCircle className="text-navy-600" />;
      case 'dollar': return <FiDollarSign className="text-amber-600" />;
      case 'user': return <FiUser className="text-purple-600" />;
      case 'refresh': return <FiRefreshCw className="text-indigo-600" />;
      case 'clock': return <FiClock className="text-amber-600" />;
      case 'message': return <FiMessageSquare className="text-gray-600" />;
      case 'x': return <FiXCircle className="text-rose-600" />;
      default: return <FiInfo className="text-gray-600" />;
    }
  };

  const getActorBadge = (actorType) => {
    switch(actorType) {
      case 'customer':
        return <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs">You</span>;
      case 'staff':
        return <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full text-xs">Staff</span>;
      case 'system':
        return <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded-full text-xs">System</span>;
      default:
        return <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded-full text-xs">System</span>;
    }
  };

  // Render overview tab
  const renderOverview = () => {
    if (!serviceApplication) return null;
    
    const serviceData = serviceApplication.service_data || {};
    const statusConfig = getStatusConfig(serviceApplication.status);
    const StatusIcon = statusConfig.icon;
    const progress = getProgressValue();
    const progressColor = getProgressColor(progress);
    const progressTextColor = getProgressTextColor(progress);

    return (
      <div className="space-y-6">
        {/* Status Card */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center">
              <div className={`p-3 rounded-lg ${statusConfig.bg} ${statusConfig.text} mr-4`}>
                <StatusIcon className="text-xl" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-800">Application Status</h3>
                <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium mt-1 ${statusConfig.bg} ${statusConfig.text}`}>
                  <StatusIcon className="mr-2" />
                  {serviceApplication.status_label || serviceApplication.status}
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-500">Application Number</div>
              <div className="text-lg font-bold text-gray-800">{serviceApplication.application_number}</div>
            </div>
          </div>
          
          {/* Progress Bar - Status Based Colors */}
          {serviceApplication.progress !== undefined && (
            <div className="mt-6">
              <div className="flex justify-between text-sm text-gray-600 mb-1">
                <span>Progress</span>
                <span className={`font-semibold ${progressTextColor}`}>{progress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden shadow-inner">
                <div 
                  key={`progress-${serviceApplication.id}-${progress}`}
                  className={`h-3 rounded-full transition-all duration-700 ease-out bg-gradient-to-r ${progressColor}`}
                  style={{ 
                    width: `${progress}%`,
                    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
                  }}
                ></div>
              </div>
              {/* Show current step from tracking */}
              {(serviceApplication.current_step || serviceApplication.tracking?.current_step) && (
                <p className="text-sm text-gray-600 mt-2">
                  Current step: <span className="font-medium">
                    {serviceApplication.current_step || serviceApplication.tracking?.current_step}
                  </span>
                  {serviceApplication.tracking?.assigned_staff_name && (
                    <span className="ml-2 text-navy-600">
                      • Assigned to: {serviceApplication.tracking.assigned_staff_name}
                    </span>
                  )}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Service Details */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <h3 className="text-lg font-bold text-gray-800 mb-6">Service Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Service Name</label>
                  <p className="text-gray-800 font-medium">{serviceData.service_name}</p>
                </div>
                {serviceApplication.subcategory_name && (
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">Service Option</label>
                    <p className="text-gray-800 font-medium">{serviceApplication.subcategory_name}</p>
                  </div>
                )}
                {serviceData.service_description && (
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">Description</label>
                    <p className="text-gray-800">{serviceData.service_description}</p>
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Category</label>
                  <p className="text-gray-800">{serviceData.category || 'Government Services'}</p>
                </div>
              </div>
            </div>
            
            <div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1 flex items-center">
                    <FiCalendar className="mr-2" />
                    Applied On
                  </label>
                  <p className="text-gray-800 font-medium">
                    {formatDate(serviceApplication.applied_at)}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1 flex items-center">
                    <FiClock className="mr-2" />
                    Last Updated
                  </label>
                  <p className="text-gray-800 font-medium">
                    {formatDateTime(serviceApplication.last_updated)}
                  </p>
                </div>
                {serviceApplication.estimated_completion && (
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1 flex items-center">
                      <FiCalendar className="mr-2" />
                      Estimated Completion
                    </label>
                    <p className="text-gray-800 font-medium">
                      {formatDate(serviceApplication.estimated_completion)}
                    </p>
                  </div>
                )}
                {serviceApplication.tracking_updated && (
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">
                      Last Tracking Update
                    </label>
                    <p className="text-gray-800">
                      {formatDateTime(serviceApplication.tracking_updated)}
                    </p>
                  </div>
                )}
                {serviceApplication.tracking?.assigned_staff_name && (
                  <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-100">
                    <div className="flex items-center">
                      <FiUser className="text-blue-600 mr-3" />
                      <div>
                        <p className="text-sm text-blue-700">
                          <span className="font-medium">Assigned Staff:</span> {serviceApplication.tracking.assigned_staff_name}
                        </p>
                        <p className="text-xs text-blue-600 mt-1">
                          Last updated: {serviceApplication.tracking.updated_at ? new Date(serviceApplication.tracking.updated_at).toLocaleString() : 'N/A'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Payment Information - FIXED to prioritize payments array */}
        {(serviceApplication.payments?.length > 0 || serviceData.payment) && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center">
              <FiCreditCard className="mr-2" />
              Payment Information
            </h3>
            
            {/* Use data from payments array if available (staff-entered data) */}
            {serviceApplication.payments && serviceApplication.payments.length > 0 ? (
              // Show the latest payment from staff
              (() => {
                const latestPayment = serviceApplication.payments[0];
                const statusConfig = getPaymentStatusConfig(latestPayment.payment_status);
                const StatusIcon = statusConfig.icon;
                
                return (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-500 mb-1">Payment Method</label>
                          <p className="text-gray-800 font-medium capitalize">
                            {latestPayment.wallet_name || 'Online Payment'}
                          </p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-500 mb-1">Payment Status</label>
                          <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium ${statusConfig.bg} ${statusConfig.text} border ${statusConfig.border}`}>
                            <StatusIcon className="mr-2" />
                            {formatPaymentStatus(latestPayment.payment_status)}
                          </span>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-500 mb-1">Payment Date</label>
                          <p className="text-gray-800">{formatDate(latestPayment.payment_date)}</p>
                        </div>
                      </div>
                    </div>
                    
                    <div>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-500 mb-1">Charges Breakdown</label>
                          <div className="space-y-2">
                            {serviceData.department_charges > 0 && (
                              <div className="flex justify-between">
                                <span className="text-gray-600">Department Charges</span>
                                <span className="font-medium">{formatCurrency(serviceData.department_charges)}</span>
                              </div>
                            )}
                            {serviceData.service_charges > 0 && (
                              <div className="flex justify-between">
                                <span className="text-gray-600">Service Charges</span>
                                <span className="font-medium">{formatCurrency(serviceData.service_charges)}</span>
                              </div>
                            )}
                            <div className="border-t pt-2 mt-2">
                              <div className="flex justify-between font-bold text-lg">
                                <span>Total Amount</span>
                                <span className="text-navy-700">{formatCurrency(serviceData.total_charges)}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        {/* Payment Summary Card based on actual payment status */}
                        {latestPayment.payment_status === 'received' && (
                          <div className="mt-4 p-4 bg-emerald-50 rounded-lg border border-emerald-200">
                            <div className="flex items-center">
                              <FiCheckCircle className="text-emerald-600 mr-3 text-xl" />
                              <div>
                                <p className="text-sm font-medium text-emerald-800">Payment Complete</p>
                                <p className="text-xs text-emerald-600 mt-1">
                                  Your payment has been successfully received
                                </p>
                              </div>
                            </div>
                          </div>
                        )}
                        
                        {latestPayment.payment_status === 'pending' && (
                          <div className="mt-4 p-4 bg-amber-50 rounded-lg border border-amber-200">
                            <div className="flex items-center">
                              <FiClock className="text-amber-600 mr-3 text-xl" />
                              <div>
                                <p className="text-sm font-medium text-amber-800">Payment Pending</p>
                                <p className="text-xs text-amber-600 mt-1">
                                  Your payment is being processed
                                </p>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()
            ) : (
              // Fallback to serviceData.payment if no payments array (old customer submission data)
              serviceData.payment && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-500 mb-1">Payment Method</label>
                        <p className="text-gray-800 font-medium capitalize">
                          {serviceData.payment.payment_method || 'Not specified'}
                        </p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-500 mb-1">Payment Status</label>
                        {(() => {
                          const statusConfig = getPaymentStatusConfig(serviceData.payment.payment_status);
                          const StatusIcon = statusConfig.icon;
                          return (
                            <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium ${statusConfig.bg} ${statusConfig.text} border ${statusConfig.border}`}>
                              <StatusIcon className="mr-2" />
                              {formatPaymentStatus(serviceData.payment.payment_status)}
                            </span>
                          );
                        })()}
                      </div>
                      {serviceData.payment.submitted_at && (
                        <div>
                          <label className="block text-sm font-medium text-gray-500 mb-1">Payment Initiated On</label>
                          <p className="text-gray-800">{formatDate(serviceData.payment.submitted_at)}</p>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-500 mb-1">Charges Breakdown</label>
                        <div className="space-y-2">
                          {serviceData.department_charges > 0 && (
                            <div className="flex justify-between">
                              <span className="text-gray-600">Department Charges</span>
                              <span className="font-medium">{formatCurrency(serviceData.department_charges)}</span>
                            </div>
                          )}
                          {serviceData.service_charges > 0 && (
                            <div className="flex justify-between">
                              <span className="text-gray-600">Service Charges</span>
                              <span className="font-medium">{formatCurrency(serviceData.service_charges)}</span>
                            </div>
                          )}
                          <div className="border-t pt-2 mt-2">
                            <div className="flex justify-between font-bold text-lg">
                              <span>Total Amount</span>
                              <span className="text-navy-700">{formatCurrency(serviceData.total_charges)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      {/* Payment Summary Card from service_data */}
                      {serviceData.payment.payment_status === 'pending' && (
                        <div className="mt-4 p-4 bg-amber-50 rounded-lg border border-amber-200">
                          <div className="flex items-center">
                            <FiClock className="text-amber-600 mr-3 text-xl" />
                            <div>
                              <p className="text-sm font-medium text-amber-800">Payment Pending</p>
                              <p className="text-xs text-amber-600 mt-1">
                                Your payment is being processed
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            )}
          </div>
        )}

        {/* Payment History - from payments array */}
        {serviceApplication.payments && serviceApplication.payments.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center">
              <FiCreditCard className="mr-2" />
              Payment History
            </h3>
            <div className="space-y-3">
              {serviceApplication.payments.map((payment, index) => {
                const statusConfig = getPaymentStatusConfig(payment.payment_status);
                const StatusIcon = statusConfig.icon;
                return (
                  <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center">
                      <div className={`p-2 rounded-lg mr-3 ${statusConfig.bg}`}>
                        <StatusIcon className={statusConfig.text} />
                      </div>
                      <div>
                        <p className="font-medium text-gray-800">{formatCurrency(payment.amount)}</p>
                        <p className="text-xs text-gray-500">
                          {payment.wallet_name || 'Online Payment'} • {formatDate(payment.payment_date)}
                        </p>
                      </div>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusConfig.bg} ${statusConfig.text}`}>
                      {formatPaymentStatus(payment.payment_status)}
                    </span>
                  </div>
                );
              })}
            </div>
            
            {/* Total Paid Amount */}
            {serviceApplication.total_paid > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="flex justify-between items-center">
                  <span className="font-medium text-gray-700">Total Paid</span>
                  <span className="font-bold text-lg text-emerald-600">
                    {formatCurrency(serviceApplication.total_paid)}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Additional Information */}
        {serviceData.additional_info && Object.keys(serviceData.additional_info).length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center">
              <FiInfo className="mr-2" />
              Additional Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {serviceData.additional_info.instructions && (
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-500 mb-1">Special Instructions</label>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-gray-800 whitespace-pre-wrap">{serviceData.additional_info.instructions}</p>
                  </div>
                </div>
              )}
              
              {serviceData.additional_info.contact_method && (
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Preferred Contact Method</label>
                  <p className="text-gray-800 font-medium capitalize">{serviceData.additional_info.contact_method}</p>
                </div>
              )}
              
              {serviceData.additional_info.urgency && (
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Urgency Level</label>
                  <p className="text-gray-800 font-medium capitalize">{serviceData.additional_info.urgency}</p>
                </div>
              )}
              
              {serviceData.additional_info.travel_date && (
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Travel Date</label>
                  <p className="text-gray-800 font-medium">{formatDate(serviceData.additional_info.travel_date)}</p>
                </div>
              )}
              
              {serviceData.additional_info.stay_duration && (
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Duration of Stay (Days)</label>
                  <p className="text-gray-800 font-medium">{serviceData.additional_info.stay_duration} days</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Remarks */}
        {serviceApplication.remarks && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center">
              <FiMessageSquare className="mr-2" />
              Remarks
            </h3>
            <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
              <p className="text-blue-800">{serviceApplication.remarks}</p>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Render documents tab
  const renderDocuments = () => {
    if (!serviceApplication) return null;
    
    const serviceData = serviceApplication.service_data || {};
    const selectedDocuments = serviceData.selected_documents || [];
    const requiredDocuments = serviceData.required_documents || [];

    return (
      <div className="space-y-6">
        {/* Selected Documents */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <h3 className="text-lg font-bold text-gray-800 mb-6">Selected Documents</h3>
          
          {selectedDocuments.length === 0 ? (
            <div className="text-center py-8">
              <FiFileText className="text-gray-400 text-4xl mx-auto mb-4" />
              <p className="text-gray-600">No documents selected for this application</p>
            </div>
          ) : (
            <div className="space-y-4">
              {selectedDocuments.map((docName, index) => {
                const docInfo = requiredDocuments.find(d => d.document_name === docName);
                
                return (
                  <div key={index} className="p-4 border border-gray-200 rounded-lg">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center mb-3">
                          <div className="bg-navy-100 p-2 rounded-lg mr-3">
                            <FiFileText className="text-navy-600" />
                          </div>
                          <div>
                            <h4 className="font-medium text-gray-800">{docName}</h4>
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium mt-1 bg-emerald-100 text-emerald-700">
                              Selected
                            </span>
                          </div>
                        </div>
                        
                        {docInfo && (
                          <div className="ml-11 space-y-2 text-sm text-gray-600">
                            {docInfo.scope && (
                              <p>
                                <span className="font-medium mr-2">Scope:</span>
                                {docInfo.scope}
                              </p>
                            )}
                            {docInfo.requires_number && (
                              <p className="flex items-center">
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                                  Requires Document Number
                                </span>
                              </p>
                            )}
                            {docInfo.requires_expiry && (
                              <p className="flex items-center">
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                                  Requires Expiry Date
                                </span>
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Required Documents Summary */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <h3 className="text-lg font-bold text-gray-800 mb-6">Documents Summary</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gray-50 p-4 rounded-lg text-center">
              <div className="text-2xl font-bold text-gray-800 mb-1">{requiredDocuments.length}</div>
              <div className="text-sm text-gray-600">Total Required</div>
            </div>
            <div className="bg-emerald-50 p-4 rounded-lg text-center">
              <div className="text-2xl font-bold text-emerald-700 mb-1">{selectedDocuments.length}</div>
              <div className="text-sm text-emerald-600">Selected</div>
            </div>
            <div className="bg-blue-50 p-4 rounded-lg text-center">
              <div className="text-2xl font-bold text-blue-700 mb-1">
                {Math.round((selectedDocuments.length / Math.max(requiredDocuments.length, 1)) * 100)}%
              </div>
              <div className="text-sm text-blue-600">Completion</div>
            </div>
          </div>
        </div>

        {/* Document Requirements */}
        {requiredDocuments.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <h3 className="text-lg font-bold text-gray-800 mb-6">Document Requirements</h3>
            <div className="space-y-3">
              {requiredDocuments.map((doc, index) => (
                <div key={index} className="flex items-center justify-between p-3 border border-gray-100 rounded-lg">
                  <div className="flex items-center">
                    <FiFileText className="text-gray-400 mr-3" />
                    <span className="text-gray-800">{doc.document_name}</span>
                  </div>
                  {selectedDocuments.includes(doc.document_name) ? (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                      <FiCheckCircle className="mr-1" />
                      Selected
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                      Not Selected
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  // Render timeline tab
  const renderTimeline = () => {
    if (!serviceApplication) return null;

    if (timelineLoading) {
      return (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-navy-700 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading timeline...</p>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <h3 className="text-lg font-bold text-gray-800 mb-6">Application Timeline</h3>
          
          {timeline.length === 0 ? (
            <div className="text-center py-8">
              <FiClock className="text-gray-400 text-4xl mx-auto mb-4" />
              <p className="text-gray-600">No timeline events available</p>
            </div>
          ) : (
            <div className="relative">
              {/* Vertical line */}
              <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200"></div>
              
              <div className="space-y-6">
                {timeline.map((event, index) => (
                  <div key={event.id || index} className="relative flex items-start">
                    {/* Icon */}
                    <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center z-10 ${
                      event.actor_type === 'customer' ? 'bg-blue-100' :
                      event.actor_type === 'staff' ? 'bg-purple-100' :
                      'bg-gray-100'
                    }`}>
                      {getIconForEvent(event)}
                    </div>
                    
                    {/* Content */}
                    <div className="flex-1 ml-4 pb-6">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-gray-800">{event.action}</p>
                          {getActorBadge(event.actor_type)}
                        </div>
                        <span className="text-sm text-gray-500">
                          {new Date(event.created_at).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                      
                      <p className="text-sm text-gray-600 mt-1">{event.details}</p>
                      
                      {/* Show step order for tracking steps */}
                      {event.step_name && (
                        <div className="mt-2">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            event.completed 
                              ? 'bg-emerald-100 text-emerald-700' 
                              : 'bg-amber-100 text-amber-700'
                          }`}>
                            {event.completed ? '✓ Completed' : '○ In Progress'}
                          </span>
                        </div>
                      )}
                      
                      {/* Show performer info */}
                      {event.performed_by && event.performed_by !== 'system' && (
                        <p className="text-xs text-gray-500 mt-2">
                          By: {event.performed_by.replace('customer:', '').replace('staff:', '')}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-navy-700 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading service details...</p>
        </div>
      </div>
    );
  }

  if (!serviceApplication) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center">
          <FiAlertCircle className="text-amber-600 text-4xl mx-auto mb-4" />
          <h3 className="text-lg font-bold text-amber-800 mb-2">Service Not Found</h3>
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

  return (
    <div className="max-w-6xl mx-auto">
      <ToastContainer position="top-right" autoClose={3000} />
      
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => navigate('/customer/myservices')}
          className="inline-flex items-center text-navy-700 hover:text-navy-800 mb-4"
        >
          <FiArrowLeft className="mr-2" />
          Back to My Services
        </button>
        
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Application Details</h1>
            <p className="text-gray-600 mt-1">
              {serviceData.service_name} • Application #{serviceApplication.application_number}
            </p>
          </div>
          
          <div className="flex space-x-3">
            <button
              onClick={() => window.print()}
              className="inline-flex items-center px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              <FiPrinter className="mr-2" />
              Print
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6">
        <div className="flex space-x-2 border-b border-gray-200">
          {['overview', 'documents', 'timeline'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-3 font-medium text-sm transition-colors ${
                activeTab === tab
                  ? 'text-navy-700 border-b-2 border-navy-700'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && renderOverview()}
      {activeTab === 'documents' && renderDocuments()}
      {activeTab === 'timeline' && renderTimeline()}

      {/* Action Buttons */}
      <div className="mt-8 p-6 bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h4 className="font-bold text-gray-800">Need help with this application?</h4>
            <p className="text-sm text-gray-600 mt-1">
              Contact our support team for assistance
            </p>
          </div>
          <div className="flex space-x-3">
            <button
              onClick={() => navigate('/customer/support')}
              className="px-4 py-2 bg-white text-navy-700 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Submit Support Ticket
            </button>
            <button
              onClick={() => navigate('/customer/myservices')}
              className="px-4 py-2 bg-navy-700 text-white rounded-lg hover:bg-navy-800"
            >
              Back to My Services
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ViewServiceDetails;