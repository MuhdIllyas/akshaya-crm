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
      'bg-gray-50 text-gray-700 border-gray-200';
  };

  // Render service card
  const renderServiceCard = (service) => {
    const hasSubcategories = service.subcategories && service.subcategories.length > 0;
    const hasDocuments = service.required_documents && service.required_documents.length > 0;

    return (
      <button
        key={service.id}
        onClick={() => handleServiceSelect(service)}
        className="text-left p-4 bg-white rounded-xl border border-gray-200 hover:border-navy-300 hover:shadow-md transition-all duration-200"
      >
        <div className="flex items-start justify-between mb-3">
          <div className={`p-2 rounded-lg ${hasSubcategories ? 'bg-purple-50' : 'bg-blue-50'}`}>
            {hasSubcategories ? 
              <FiBriefcase className="text-purple-600 text-xl" /> :
              <FiFileText className="text-blue-600 text-xl" />
            }
          </div>
          <div className="flex flex-col items-end">
            <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${getStatusColor(service.service_status)}`}>
              {service.service_status === 'active' ? 'Available' : service.service_status}
            </span>
            {hasSubcategories && (
              <span className="text-xs text-gray-500 mt-1">
                {service.subcategories.length} options
              </span>
            )}
          </div>
        </div>
        
        <h4 className="font-bold text-gray-800 mb-1">{service.service_name}</h4>
        <p className="text-sm text-gray-600 line-clamp-2 mb-3">
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
            <span className="text-gray-500">
              {service.requires_workflow ? 'With review process' : 'Direct processing'}
            </span>
          </div>
          <FiChevronDown className="text-gray-400" />
        </div>
      </button>
    );
  };

  return (
    <div className="apply-for-service">
      {/* Step indicator */}
      <div className="mb-8">
        <div className="flex items-center justify-center">
          <div className="flex items-center">
            <div className={`flex items-center justify-center w-10 h-10 rounded-full ${step >= 1 ? 'bg-navy-600 text-white' : 'bg-gray-200 text-gray-500'}`}>
              <span className="font-medium">1</span>
            </div>
            <div className={`text-sm font-medium ml-2 ${step >= 1 ? 'text-navy-700' : 'text-gray-500'}`}>
              Select Service
            </div>
          </div>
          
          <div className={`h-1 w-16 mx-4 ${step >= 2 ? 'bg-navy-600' : 'bg-gray-200'}`}></div>
          
          <div className="flex items-center">
            <div className={`flex items-center justify-center w-10 h-10 rounded-full ${step >= 2 ? 'bg-navy-600 text-white' : 'bg-gray-200 text-gray-500'}`}>
              <span className="font-medium">2</span>
            </div>
            <div className={`text-sm font-medium ml-2 ${step >= 2 ? 'text-navy-700' : 'text-gray-500'}`}>
              {selectedService?.subcategories?.length > 0 ? 'Select Option' : 'Review Details'}
            </div>
          </div>

          {(!selectedService?.subcategories || selectedService?.subcategories?.length === 0) && (
            <>
              <div className={`h-1 w-16 mx-4 ${step >= 3 ? 'bg-navy-600' : 'bg-gray-200'}`}></div>
              
              <div className="flex items-center">
                <div className={`flex items-center justify-center w-10 h-10 rounded-full ${step >= 3 ? 'bg-navy-600 text-white' : 'bg-gray-200 text-gray-500'}`}>
                  <span className="font-medium">3</span>
                </div>
                <div className={`text-sm font-medium ml-2 ${step >= 3 ? 'text-navy-700' : 'text-gray-500'}`}>
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
            <h3 className="text-lg font-bold text-gray-800 mb-4">Select a Service</h3>
            <p className="text-gray-600 mb-6">Choose from available government services</p>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <FiSearch className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search services by name or description..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-gray-50 rounded-xl border border-gray-300 focus:border-navy-500 focus:ring-2 focus:ring-navy-200 focus:bg-white"
            />
          </div>

          {/* Services Grid */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-navy-700 mx-auto"></div>
                <p className="mt-4 text-gray-600">Loading services...</p>
              </div>
            </div>
          ) : filteredServices.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[400px] overflow-y-auto pr-2">
              {filteredServices.map(renderServiceCard)}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="bg-gray-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <FiSearch className="text-gray-400 text-2xl" />
              </div>
              <h4 className="text-lg font-semibold text-gray-800 mb-2">No services found</h4>
              <p className="text-gray-600">
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
              className="inline-flex items-center text-sm text-navy-700 hover:text-navy-800 mb-4"
            >
              ← Back to services
            </button>
            <h3 className="text-lg font-bold text-gray-800 mb-4">Select Service Option</h3>
            <p className="text-gray-600 mb-6">Choose from available options for {selectedService.service_name}</p>
          </div>

          {/* Main Service Info */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h4 className="text-xl font-bold text-gray-800 mb-1">{selectedService.service_name}</h4>
                <p className="text-sm text-gray-600 mb-2">{selectedService.description}</p>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold text-gray-800">
                  {formatCurrency(selectedService.total_charges)}
                </div>
                <div className="text-sm text-gray-500">
                  Base service fee
                </div>
              </div>
            </div>
          </div>

          {/* Subcategories Grid */}
          <div className="space-y-4">
            <h4 className="font-semibold text-gray-800 mb-4">Available Options</h4>
            {selectedService.subcategories.map((subcategory) => (
              <button
                key={subcategory.id}
                onClick={() => handleSubcategorySelect(subcategory)}
                className={`w-full text-left p-5 bg-white rounded-xl border transition-all duration-200 ${
                  selectedSubcategory?.id === subcategory.id
                    ? 'border-navy-500 bg-navy-50'
                    : 'border-gray-200 hover:border-navy-300 hover:shadow-md'
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center mb-2">
                      <div className="bg-blue-100 p-2 rounded-lg mr-3">
                        <FiFile className="text-blue-600" />
                      </div>
                      <div>
                        <h5 className="font-bold text-gray-800">{subcategory.name}</h5>
                      </div>
                    </div>
                    {/* REMOVED: Department and Service charges breakdown */}
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-bold text-navy-700">
                      {formatCurrency(subcategory.total_charges)}
                    </div>
                    <div className="text-sm text-gray-500">Total fee</div>
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Continue without subcategory option */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <button
              onClick={() => {
                setSelectedSubcategory(null);
                setStep(3);
              }}
              className="w-full p-4 bg-gray-50 text-gray-700 rounded-xl border border-gray-300 hover:bg-gray-100 transition-colors"
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
              className="inline-flex items-center text-sm text-navy-700 hover:text-navy-800 mb-4"
            >
              ← {selectedService.subcategories?.length > 0 ? 'Back to options' : 'Back to services'}
            </button>
            <h3 className="text-lg font-bold text-gray-800 mb-4">Review Service Details</h3>
            <p className="text-gray-600 mb-6">Confirm details before applying</p>
          </div>

          {/* Service Summary Card */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h4 className="text-xl font-bold text-gray-800 mb-1">
                  {selectedService.service_name}
                  {selectedSubcategory && ` - ${selectedSubcategory.name}`}
                </h4>
                <div className="flex items-center space-x-3">
                  <span className="inline-flex items-center px-3 py-1 bg-blue-50 text-blue-700 rounded-lg text-sm font-medium">
                    Service ID: {selectedService.id}
                  </span>
                  <span className="text-sm text-gray-500">
                    Government Services
                  </span>
                </div>
              </div>
            </div>

            <p className="text-gray-700 mb-6">
              {selectedService.description || 'No detailed description available.'}
            </p>

            {/* Key Details Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="flex items-center text-gray-600 mb-2">
                  <FiDollarSign className="mr-2" />
                  <span className="text-sm font-medium">Total Charges</span>
                </div>
                <p className="text-xl font-bold text-gray-800">
                  {formatCurrency(
                    selectedSubcategory ? 
                    selectedSubcategory.total_charges : 
                    selectedService.total_charges
                  )}
                </p>
              </div>

              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="flex items-center text-gray-600 mb-2">
                  <FiClock className="mr-2" />
                  <span className="text-sm font-medium">Processing Time</span>
                </div>
                <p className="text-xl font-bold text-gray-800">
                  {getEstimatedTime(selectedService.has_expiry)}
                </p>
              </div>

              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="flex items-center text-gray-600 mb-2">
                  <FiFileText className="mr-2" />
                  <span className="text-sm font-medium">Documents Required</span>
                </div>
                  <p className="text-xl font-bold text-gray-800">
                    {finalDocuments.length > 0 ? 'Yes' : 'No'}
                  </p>
                  {finalDocuments.length > 0 && (
                    <p className="text-xs text-gray-500 mt-1">
                      {finalDocuments.length} document(s)
                    </p>
                  )}
              </div>
            </div>

            {/* Required Documents - Only show if there are documents */}
            {/* Service-level documents */}
              {serviceDocuments.length > 0 && (
                <div className="mb-6">
                  <h5 className="font-semibold text-gray-800 mb-3 flex items-center">
                    <FiAlertCircle className="mr-2 text-amber-600" />
                    Service Documents
                  </h5>

                  <div className="bg-amber-50 border border-amber-100 rounded-lg p-4">
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
                  <h5 className="font-semibold text-gray-800 mb-3 flex items-center">
                    <FiAlertCircle className="mr-2 text-amber-600" />
                    Documents needed for {selectedSubcategory.name}
                  </h5>

                  <div className="bg-amber-50 border border-amber-100 rounded-lg p-4">
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
                <h5 className="font-semibold text-gray-800 mb-3">Important Notes</h5>
                <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
                  <p className="text-sm text-blue-800">
                    This service requires workflow processing. Your application will be reviewed by our staff.
                    You'll receive updates on the progress through your dashboard.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-6 border-t border-gray-200">
            <button
              onClick={() => selectedService.subcategories?.length > 0 ? setStep(2) : setStep(1)}
              className="px-6 py-3 text-gray-700 border border-gray-300 rounded-lg font-medium hover:bg-gray-50 transition-colors"
              disabled={isSubmitting}
            >
              Back
            </button>
            <div className="flex space-x-4">
              <button
                onClick={onCancel}
                className="px-6 py-3 text-gray-700 border border-gray-300 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                onClick={handleApply}
                disabled={isSubmitting}
                className={`px-6 py-3 rounded-lg font-medium transition-colors ${isSubmitting ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-navy-700 text-white hover:bg-navy-800'}`}
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