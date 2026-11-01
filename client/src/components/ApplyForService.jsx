import React, { useState, useEffect } from 'react';
import { 
  FiSearch, FiChevronDown, FiCheck, FiX, 
  FiInfo, FiFileText, FiCalendar, FiDollarSign,
  FiAlertCircle, FiClock, FiBriefcase, FiFile
} from 'react-icons/fi';
import axios from 'axios';
import { toast } from 'react-toastify';

const ApplyForService = ({ onSuccess, onCancel }) => {
  const [step, setStep] = useState(1);
  const [services, setServices] = useState([]);
  const [filteredServices, setFilteredServices] = useState([]);
  const [selectedService, setSelectedService] = useState(null);
  const [selectedSubcategory, setSelectedSubcategory] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const serviceDocuments = selectedService?.required_documents || [];
  const subcategoryDocuments = selectedSubcategory?.required_documents || [];

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

  // Fetch available services
  const fetchAvailableServices = async () => {
    try {
      setIsLoading(true);
      
      // Use the endpoint from customerBooking.js
      const response = await API.get('/api/customer/bookings/available');
      setServices(response.data);
      setFilteredServices(response.data);
      
    } catch (error) {
      console.error('Error fetching services:', error);
      toast.error('Failed to load services. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle service selection
  const handleServiceSelect = (service) => {
    setSelectedService(service);
    
    // If service has subcategories, let user select one
    if (service.subcategories && service.subcategories.length > 0) {
      setSelectedSubcategory(null); // Reset subcategory selection
      setStep(2); // Move to subcategory selection step
    } else {
      setStep(3); // Move directly to review step
    }
  };

  // Handle subcategory selection
  const handleSubcategorySelect = (subcategory) => {
    setSelectedSubcategory(subcategory);
    setStep(3); // Move to review step
  };

  // Handle search
  const handleSearch = (query) => {
    setSearchQuery(query);
    const filtered = services.filter(service => 
      service.service_name.toLowerCase().includes(query.toLowerCase()) ||
      service.description?.toLowerCase().includes(query.toLowerCase()) ||
      (service.subcategories && service.subcategories.some(sub => 
        sub.name.toLowerCase().includes(query.toLowerCase())
      ))
    );
    setFilteredServices(filtered);
  };

  // Handle apply for service
  const handleApply = async () => {
    if (!selectedService) return;
    
    try {
      setIsSubmitting(true);
      
      const serviceData = {
        service_id: selectedService.id,
        subcategory_id: selectedSubcategory?.id || null,
        service_data: {
          service_name: selectedService.service_name,
          description: selectedService.description,
          department_charges: selectedSubcategory ? 
            selectedSubcategory.department_charges : selectedService.department_charges,
          service_charges: selectedSubcategory ? 
            selectedSubcategory.service_charges : selectedService.service_charges,
          total_charges: selectedSubcategory ? 
            selectedSubcategory.total_charges : selectedService.total_charges,
          requires_workflow: selectedService.requires_workflow,
          has_expiry: selectedService.has_expiry,
          category: "Government Services"
        },
        selected_documents: finalDocuments.map(doc => ({
          document_name: doc.document_name
        }))
      };

      // Use the correct endpoint from customerBooking.js
      const response = await API.post('/api/customer/bookings/apply', serviceData);
      
      if (response.data.success) {
        toast.success(response.data.message || 'Service application created successfully!');
        
        // Show specific next steps message if available
        if (response.data.next_steps) {
          toast.info(response.data.next_steps);
        }
        
        onSuccess(); // Call parent callback
      } else {
        toast.error(response.data.message || 'Failed to create service application');
      }
      
    } catch (error) {
      console.error('Error applying for service:', error);
      let errorMessage = 'Failed to apply for service. Please try again.';
      
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Initialize
  useEffect(() => {
    fetchAvailableServices();
  }, []);

  const finalDocuments = [
    ...(selectedService?.required_documents || []),
    ...(selectedSubcategory?.required_documents || [])
  ];

  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Get estimated time display
  const getEstimatedTime = (hasExpiry) => {
    if (hasExpiry) return '30 days (with expiry)';
    return 'Standard processing';
  };

  // Get status color
  const getStatusColor = (status) => {
    return status === 'active' ? 
      'bg-emerald-50 text-emerald-700 border-emerald-200' : 
      'bg-slate-50 text-slate-700 border-slate-200';
  };

  // Render service card
  const renderServiceCard = (service) => {
    const hasSubcategories = service.subcategories && service.subcategories.length > 0;
    const hasDocuments = service.required_documents && service.required_documents.length > 0;

    return (
      <button
        key={service.id}
        onClick={() => handleServiceSelect(service)}
        className="text-left p-4 bg-white rounded-2xl border border-slate-200 shadow-sm hover:border-navy-500/40 hover:shadow-md transition-all duration-200"
      >
        <div className="flex items-start justify-between mb-3">
          <div className={`p-2 rounded-lg ${hasSubcategories ? 'bg-navy-500/10' : 'bg-navy-500/10'}`}>
            {hasSubcategories ? 
              <FiBriefcase className="text-navy-700 text-xl" /> :
              <FiFileText className="text-navy-700 text-xl" />
            }
          </div>
          <div className="flex flex-col items-end">
            <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${getStatusColor(service.service_status)}`}>
              {service.service_status === 'active' ? 'Available' : service.service_status}
            </span>
            {hasSubcategories && (
              <span className="text-xs text-slate-500 mt-1">
                {service.subcategories.length} options
              </span>
            )}
          </div>
        </div>
        
        <h4 className="font-bold text-slate-800 mb-1">{service.service_name}</h4>
        <p className="text-sm text-slate-600 line-clamp-2 mb-3">
          {service.description || 'No description available'}
        </p>
        
        {/* Show only total fee to customer */}
        <div className="flex items-center justify-between mb-2">
          <div className="text-lg font-bold text-navy-700">
            {formatCurrency(service.total_charges)}
          </div>
          {hasDocuments && (
            <div className="flex items-center text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded">
              <FiFile className="mr-1" />
              <span>{service.required_documents.length} document(s)</span>
            </div>
          )}
        </div>
        
        <div className="flex items-center justify-between">
          <div className="text-sm">
            <span className="text-slate-500">
              {service.requires_workflow ? 'With review process' : 'Direct processing'}
            </span>
          </div>
          <FiChevronDown className="text-slate-400" />
        </div>
      </button>
    );
  };

  return (
    <div className="apply-for-service">
      {/* Step indicator */}
      <div className="mb-6 sm:mb-8">
        <div className="flex items-center justify-center">
          <div className="flex items-center">
            <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full sm:h-10 sm:w-10 ${step >= 1 ? 'bg-navy-700 text-white' : 'bg-slate-200 text-slate-500'}`}>
              <span className="font-medium">1</span>
            </div>
            <div className={`hidden text-sm font-medium ml-2 sm:block ${step >= 1 ? 'text-navy-700' : 'text-slate-500'}`}>
              Select Service
            </div>
          </div>
          
          <div className={`h-1 w-8 mx-2 rounded-full sm:w-16 sm:mx-4 ${step >= 2 ? 'bg-navy-700' : 'bg-slate-200'}`}></div>
          
          <div className="flex items-center">
            <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full sm:h-10 sm:w-10 ${step >= 2 ? 'bg-navy-700 text-white' : 'bg-slate-200 text-slate-500'}`}>
              <span className="font-medium">2</span>
            </div>
            <div className={`hidden text-sm font-medium ml-2 sm:block ${step >= 2 ? 'text-navy-700' : 'text-slate-500'}`}>
              {selectedService?.subcategories?.length > 0 ? 'Select Option' : 'Review Details'}
            </div>
          </div>

          {(!selectedService?.subcategories || selectedService?.subcategories?.length === 0) && (
            <>
              <div className={`h-1 w-8 mx-2 rounded-full sm:w-16 sm:mx-4 ${step >= 3 ? 'bg-navy-700' : 'bg-slate-200'}`}></div>
              
              <div className="flex items-center">
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full sm:h-10 sm:w-10 ${step >= 3 ? 'bg-navy-700 text-white' : 'bg-slate-200 text-slate-500'}`}>
                  <span className="font-medium">3</span>
                </div>
                <div className={`hidden text-sm font-medium ml-2 sm:block ${step >= 3 ? 'text-navy-700' : 'text-slate-500'}`}>
                  Review & Apply
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Step 1: Select Service */}
      {step === 1 && (
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 mb-1">Select a Service</h3>
            <p className="text-sm text-slate-600 mb-2">Choose from available government services</p>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <FiSearch className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search services by name or description..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="min-h-[44px] w-full rounded-xl border border-slate-300 bg-slate-50 py-2.5 pl-11 pr-4 text-base focus:border-navy-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-navy-500/30 sm:text-sm"
            />
          </div>

          {/* Services Grid */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-navy-700 mx-auto"></div>
                <p className="mt-4 text-slate-600">Loading services...</p>
              </div>
            </div>
          ) : filteredServices.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 sm:max-h-[420px] sm:overflow-y-auto sm:pr-2">
              {filteredServices.map(renderServiceCard)}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="bg-slate-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <FiSearch className="text-slate-400 text-2xl" />
              </div>
              <h4 className="text-lg font-semibold text-slate-800 mb-2">No services found</h4>
              <p className="text-slate-600">
                {searchQuery 
                  ? `No services matching "${searchQuery}"`
                  : 'No services available at the moment'
                }
              </p>
            </div>
          )}
        </div>
      )}

      {/* Step 2: Select Subcategory (if service has subcategories) */}
      {step === 2 && selectedService && selectedService.subcategories && selectedService.subcategories.length > 0 && (
        <div className="space-y-6">
          <div>
            <button
              onClick={() => setStep(1)}
              className="inline-flex min-h-[44px] items-center text-sm font-medium text-navy-700 hover:text-navy-800 -mt-2"
            >
              ← Back to services
            </button>
            <h3 className="text-lg font-semibold text-slate-900 mb-1">Select Service Option</h3>
            <p className="text-sm text-slate-600 mb-2">Choose from available options for {selectedService.service_name}</p>
          </div>

          {/* Main Service Info */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5 mb-6">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div className="min-w-0">
                <h4 className="text-lg font-semibold text-slate-900 mb-1 break-words sm:text-xl">{selectedService.service_name}</h4>
                <p className="text-sm text-slate-600 mb-2">{selectedService.description}</p>
              </div>
              <div className="shrink-0 text-right">
                <div className="text-lg font-semibold text-slate-900">
                  {formatCurrency(selectedService.total_charges)}
                </div>
                <div className="text-sm text-slate-500">
                  Base service fee
                </div>
              </div>
            </div>
          </div>

          {/* Subcategories Grid */}
          <div className="space-y-4">
            <h4 className="font-semibold text-slate-800 mb-4">Available Options</h4>
            {selectedService.subcategories.map((subcategory) => (
              <button
                key={subcategory.id}
                onClick={() => handleSubcategorySelect(subcategory)}
                className={`w-full text-left p-4 sm:p-5 bg-white rounded-2xl border shadow-sm transition-all duration-200 ${
                  selectedSubcategory?.id === subcategory.id
                    ? 'border-navy-500 bg-navy-500/10'
                    : 'border-slate-200 hover:border-navy-500/30 hover:shadow-md'
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center mb-2">
                      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-navy-500/10 mr-3">
                        <FiFile className="text-navy-700" />
                      </div>
                      <div>
                        <h5 className="font-bold text-slate-800">{subcategory.name}</h5>
                      </div>
                    </div>
                    {/* REMOVED: Department and Service charges breakdown */}
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-bold text-navy-700">
                      {formatCurrency(subcategory.total_charges)}
                    </div>
                    <div className="text-sm text-slate-500">Total fee</div>
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Continue without subcategory option */}
          <div className="mt-6 pt-6 border-t border-slate-200">
            <button
              onClick={() => {
                setSelectedSubcategory(null);
                setStep(3);
              }}
              className="min-h-[44px] w-full rounded-xl border border-slate-300 bg-slate-50 p-3 text-slate-700 transition-colors hover:bg-slate-100"
            >
              <div className="flex items-center justify-center">
                <span className="font-medium">Continue with base service</span>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* Step 3/2: Review Details & Apply */}
      {(step === 3 || (step === 2 && (!selectedService?.subcategories || selectedService?.subcategories?.length === 0))) && selectedService && (
        <div className="space-y-6">
          <div>
            <button
              onClick={() => selectedService.subcategories?.length > 0 ? setStep(2) : setStep(1)}
              className="inline-flex min-h-[44px] items-center text-sm font-medium text-navy-700 hover:text-navy-800 -mt-2"
            >
              ← {selectedService.subcategories?.length > 0 ? 'Back to options' : 'Back to services'}
            </button>
            <h3 className="text-lg font-semibold text-slate-900 mb-1">Review Service Details</h3>
            <p className="text-sm text-slate-600 mb-2">Confirm details before applying</p>
          </div>

          {/* Service Summary Card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h4 className="text-lg font-semibold text-slate-900 mb-1 break-words sm:text-xl">
                  {selectedService.service_name}
                  {selectedSubcategory && ` - ${selectedSubcategory.name}`}
                </h4>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="inline-flex items-center rounded-full bg-navy-500/10 px-3 py-1 text-sm font-medium text-navy-700 ring-1 ring-inset ring-navy-500/20">
                    Service ID: {selectedService.id}
                  </span>
                  <span className="text-sm text-slate-500">
                    Government Services
                  </span>
                </div>
              </div>
            </div>

            <p className="text-slate-700 mb-6">
              {selectedService.description || 'No detailed description available.'}
            </p>

            {/* Key Details Grid */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4 mb-6">
              <div className="rounded-xl bg-slate-50 p-4">
                <div className="flex items-center text-slate-600 mb-2">
                  <FiDollarSign className="mr-2" />
                  <span className="text-sm font-medium">Total Charges</span>
                </div>
                <p className="text-xl font-bold text-slate-800">
                  {formatCurrency(
                    selectedSubcategory ? 
                    selectedSubcategory.total_charges : 
                    selectedService.total_charges
                  )}
                </p>
              </div>

              <div className="rounded-xl bg-slate-50 p-4">
                <div className="flex items-center text-slate-600 mb-2">
                  <FiClock className="mr-2" />
                  <span className="text-sm font-medium">Processing Time</span>
                </div>
                <p className="text-xl font-bold text-slate-800">
                  {getEstimatedTime(selectedService.has_expiry)}
                </p>
              </div>

              <div className="rounded-xl bg-slate-50 p-4">
                <div className="flex items-center text-slate-600 mb-2">
                  <FiFileText className="mr-2" />
                  <span className="text-sm font-medium">Documents Required</span>
                </div>
                  <p className="text-xl font-bold text-slate-800">
                    {finalDocuments.length > 0 ? 'Yes' : 'No'}
                  </p>
                  {finalDocuments.length > 0 && (
                    <p className="text-xs text-slate-500 mt-1">
                      {finalDocuments.length} document(s)
                    </p>
                  )}
              </div>
            </div>

            {/* Required Documents - Only show if there are documents */}
            {/* Service-level documents */}
              {serviceDocuments.length > 0 && (
                <div className="mb-6">
                  <h5 className="font-semibold text-slate-800 mb-3 flex items-center">
                    <FiAlertCircle className="mr-2 text-amber-600" />
                    Service Documents
                  </h5>

                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                    <ul className="space-y-2">
                      {serviceDocuments.map((doc, index) => (
                        <li key={index} className="flex items-center">
                          <FiFile className="text-amber-600 mr-3" />
                          <span className="text-amber-800 font-medium">
                            {doc.document_name}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {/* Sub-category documents */}
              {selectedSubcategory && subcategoryDocuments.length > 0 && (
                <div className="mb-6">
                  <h5 className="font-semibold text-slate-800 mb-3 flex items-center">
                    <FiAlertCircle className="mr-2 text-amber-600" />
                    Documents needed for {selectedSubcategory.name}
                  </h5>

                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                    <ul className="space-y-2">
                      {subcategoryDocuments.map((doc, index) => (
                        <li key={index} className="flex items-center">
                          <FiFile className="text-amber-600 mr-3" />
                          <span className="text-amber-800 font-medium">
                            {doc.document_name}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

            {/* Important Notes */}
            {selectedService.requires_workflow && (
              <div className="mb-6">
                <h5 className="font-semibold text-slate-800 mb-3">Important Notes</h5>
                <div className="rounded-xl border border-navy-500/20 bg-navy-500/10 p-4">
                  <p className="text-sm text-navy-700">
                    This service requires workflow processing. Your application will be reviewed by our staff.
                    You'll receive updates on the progress through your dashboard.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-6 sm:flex-row sm:items-center sm:justify-between">
            <button
              onClick={() => selectedService.subcategories?.length > 0 ? setStep(2) : setStep(1)}
              className="min-h-[44px] rounded-xl border border-slate-300 px-6 py-3 font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
              disabled={isSubmitting}
            >
              Back
            </button>
            <div className="flex flex-col-reverse gap-3 sm:flex-row">
              <button
                onClick={onCancel}
                className="min-h-[44px] rounded-xl border border-slate-300 px-6 py-3 font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                onClick={handleApply}
                disabled={isSubmitting}
                className={`min-h-[44px] rounded-xl px-6 py-3 font-medium transition-colors ${isSubmitting ? 'bg-slate-300 text-slate-500 cursor-not-allowed' : 'bg-navy-700 text-white hover:bg-navy-800'}`}
              >
                {isSubmitting ? (
                  <>
                    <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white inline-block mr-2"></span>
                    Applying...
                  </>
                ) : (
                  'Apply for Service'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ApplyForService;