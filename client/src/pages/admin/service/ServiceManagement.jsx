import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FiPlus } from "react-icons/fi";
import axios from "axios";
import {
  getServices,
  getWallets,
  createService,
  updateService,
  deleteService,
  addSubcategory,
  deleteSubcategory,
} from "@/services/serviceService";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

// Icons
const WalletIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-indigo-500" viewBox="0 0 20 20" fill="currentColor">
    <path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z" />
    <path fillRule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1z" clipRule="evenodd" />
  </svg>
);

const FeeIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-teal-500" viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.736 6.979C9.208 6.193 9.696 6 10 6c.304 0 .792.193 1.264.979a1 1 0 001.715-1.029C12.279 4.784 11.232 4 10 4s-2.279.784-2.979 1.95a1 1 0 101.715 1.029zM6 9a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
  </svg>
);

const LinkIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-500" viewBox="0 0 20 20" fill="currentColor">
    <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
    <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" />
  </svg>
);

const DocumentIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-amber-500" viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
  </svg>
);

const ChevronIcon = ({ open }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 text-gray-500 transition-transform ${open ? "rotate-180" : ""}`} viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
  </svg>
);

const ServiceManagement = () => {
  // State variables
  const [services, setServices] = useState([]);
  const [wallets, setWallets] = useState([]);
  const [expandedService, setExpandedService] = useState(null);
  const [expandedSubCategory, setExpandedSubCategory] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingService, setEditingService] = useState(null);
  const [newSubcategory, setNewSubcategory] = useState("");
  const [newSubcategoryDeptCharges, setNewSubcategoryDeptCharges] = useState("");
  const [newSubcategoryServiceCharges, setNewSubcategoryServiceCharges] = useState("");
  const [newSubcategoryDocuments, setNewSubcategoryDocuments] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [newServiceDocuments, setNewServiceDocuments] = useState("");
  const [editServiceDocuments, setEditServiceDocuments] = useState("");
  const [newServiceRequiresWallet, setNewServiceRequiresWallet] = useState(true);
  const [requiresWorkflow, setRequiresWorkflow] = useState(true);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Add expiry boolean state variables
  const [newServiceHasExpiry, setNewServiceHasExpiry] = useState(false);
  const [editServiceHasExpiry, setEditServiceHasExpiry] = useState(false);

  // Fetch wallets and services on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [walletsResponse, servicesResponse] = await Promise.all([
          getWallets(),
          getServices(searchQuery),
        ]);
        console.log('Wallets response:', JSON.stringify(walletsResponse.data, null, 2));
        console.log('Services response:', JSON.stringify(servicesResponse.data, null, 2));
        setWallets(Array.isArray(walletsResponse.data) ? walletsResponse.data : []);
        setServices(Array.isArray(servicesResponse.data) ? servicesResponse.data : []);
      } catch (err) {
        console.error("Error fetching data:", err.response?.data || err.message);
        setError("Failed to load data. Please try again.");
        toast.error("Failed to load data.");
        setServices([]);
        setWallets([]);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [searchQuery]);

  // Filter services and sub-categories
  const filteredServices = services.filter((service) => {
    if (!searchQuery) return true;
    
    const lowerQuery = searchQuery.toLowerCase();
    const serviceMatches = 
      service.name?.toLowerCase().includes(lowerQuery) ||
      service.description?.toLowerCase().includes(lowerQuery);
    const subCategoryMatches = (service.subcategories || []).some(subCat => 
      subCat.name?.toLowerCase().includes(lowerQuery)
    );
    
    return serviceMatches || subCategoryMatches;
  });

  // Highlight matching text
  const highlightMatch = (text) => {
    if (!searchQuery || !text) return text;
    
    const regex = new RegExp(`(${searchQuery})`, "gi");
    const parts = text.split(regex);
    
    return parts.map((part, index) => 
      regex.test(part) ? 
        <span key={index} className="bg-yellow-200 text-gray-900 font-medium">{part}</span> : 
        part
    );
  };

  // Get wallet by ID
  const getWalletById = (id) => wallets.find((wallet) => wallet.id === id) || null;

  // Format currency
  const formatCurrency = (amount) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 0,
    }).format(amount || 0);

  // Toggle service details
  const toggleServiceDetails = (id) => {
    setExpandedService(expandedService === id ? null : id);
    setExpandedSubCategory(null);
  };

  // Toggle sub-category details
  const toggleSubCategory = (id) => {
    setExpandedSubCategory(expandedSubCategory === id ? null : id);
  };

  // Add new subcategory
  const handleAddSubcategory = async (serviceId) => {
    if (!newSubcategory.trim()) {
      toast.error("Subcategory name is required.");
      return;
    }

    const documents = newSubcategoryDocuments
      .split("\n")
      .map((doc) => doc.trim())
      .filter((doc) => doc.length > 0);

    try {
      const subcategoryData = {
        name: newSubcategory,
        department_charges: parseInt(newSubcategoryDeptCharges) || 0,
        service_charges: parseInt(newSubcategoryServiceCharges) || 0,
        requires_wallet: services.find((s) => s.id === serviceId)?.requires_wallet || false,
        requiredDocuments: documents,
      };

      const response = await addSubcategory(serviceId, subcategoryData);
      console.log('Add subcategory response:', JSON.stringify(response.data, null, 2));

      // Refetch services to ensure subcategories are updated
      const servicesResponse = await getServices(searchQuery);
      console.log('Updated services after adding subcategory:', JSON.stringify(servicesResponse.data, null, 2));
      setServices(Array.isArray(servicesResponse.data) ? servicesResponse.data : []);

      setNewSubcategory("");
      setNewSubcategoryDeptCharges("");
      setNewSubcategoryServiceCharges("");
      setNewSubcategoryDocuments("");
      toast.success("Subcategory added successfully!");
    } catch (err) {
      console.error("Error adding subcategory:", err.response?.data || err.message);
      const errorMessage = err.response?.data?.error || "Failed to add subcategory.";
      setError(errorMessage);
      toast.error(errorMessage);
    }
  };

  // Delete subcategory
  const handleDeleteSubcategory = async (serviceId, subId) => {
    try {
      const response = await deleteSubcategory(serviceId, subId);
      console.log('Delete subcategory response:', JSON.stringify(response.data, null, 2));
      
      // Refetch services to ensure subcategories are updated
      const servicesResponse = await getServices(searchQuery);
      console.log('Updated services after deleting subcategory:', JSON.stringify(servicesResponse.data, null, 2));
      setServices(Array.isArray(servicesResponse.data) ? servicesResponse.data : []);
      
      toast.success("Subcategory deleted successfully!");
    } catch (err) {
      console.error("Error deleting subcategory:", err.response?.data || err.message);
      const errorMessage = err.response?.data?.error || "Failed to delete subcategory.";
      setError(errorMessage);
      toast.error(errorMessage);
    }
  };

  // Delete service
  const handleDeleteService = async (serviceId) => {
    try {
      await deleteService(serviceId);
      setServices(services.filter((s) => s.id !== serviceId));
      toast.success("Service deleted successfully!");
    } catch (err) {
      console.error("Error deleting service:", err.response?.data || err.message);
      const errorMessage = err.response?.data?.error || "Failed to delete service.";
      setError(errorMessage);
      toast.error(errorMessage);
    }
  };

  // Open edit modal
  const openEditModal = (service) => {
    setEditingService(service);
    setEditServiceDocuments(service.required_documents?.map(doc => doc.document_name).join('\n') || '');
    setEditServiceHasExpiry(service.has_expiry || false);
    setShowEditModal(true);
  };

  // Add new service
  const handleAddService = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);

    const documents = newServiceDocuments
      .split("\n")
      .map((doc) => doc.trim())
      .filter((doc) => doc.length > 0);

    const requiresWallet = formData.get("requiresWallet") === "on";

    try {
      // Validate wallet_id if requiresWallet is true
      const walletId = requiresWallet ? parseInt(formData.get("walletId")) : null;
      if (requiresWallet && !wallets.find((w) => w.id === walletId)) {
        throw new Error("Invalid wallet selected");
      }

      const serviceData = {
        name: formData.get("name"),
        description: formData.get("description"),
        wallet_id: walletId,
        website: formData.get("website"),
        status: formData.get("status"),
        department_charges: parseInt(formData.get("departmentCharges")) || 0,
        service_charges: parseInt(formData.get("serviceCharges")) || 0,
        requires_wallet: requiresWallet,
        requires_workflow: requiresWorkflow,
        requiredDocuments: documents,
        has_expiry: newServiceHasExpiry,
      };

      const response = await createService(serviceData);
      console.log('Add service response:', JSON.stringify(response.data, null, 2));
      setServices([...services, response.data]);
      setShowAddModal(false);
      setNewServiceDocuments("");
      setNewServiceRequiresWallet(true);
      setNewServiceHasExpiry(false);
      setError(null);
      toast.success("Service added successfully!");
    } catch (err) {
      console.error("Error adding service:", err.response?.data || err.message);
      const errorMessage = err.response?.data?.error || err.message || "Failed to add service.";
      setError(errorMessage);
      toast.error(errorMessage);
    }
  };

  // Edit service
  const handleEditService = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);

    const documents = editServiceDocuments
      .split("\n")
      .map((doc) => doc.trim())
      .filter((doc) => doc.length > 0);

    const requiresWallet = formData.get("requiresWallet") === "on";

    try {
      const walletId = requiresWallet ? parseInt(formData.get("walletId")) : null;
      if (requiresWallet && !wallets.find((w) => w.id === walletId)) {
        throw new Error("Invalid wallet selected");
      }

      const serviceData = {
        name: formData.get("name"),
        description: formData.get("description"),
        wallet_id: walletId,
        website: formData.get("website"),
        status: formData.get("status"),
        department_charges: parseInt(formData.get("departmentCharges")) || 0,
        service_charges: parseInt(formData.get("serviceCharges")) || 0,
        requires_wallet: requiresWallet,
        requires_workflow: requiresWorkflow,
        requiredDocuments: documents,
        has_expiry: editServiceHasExpiry,
      };

      const response = await updateService(editingService.id, serviceData);
      console.log('Edit service response:', JSON.stringify(response.data, null, 2));
      setServices(services.map((s) => (s.id === editingService.id ? response.data : s)));
      setShowEditModal(false);
      setEditingService(null);
      setEditServiceDocuments("");
      setEditServiceHasExpiry(false);
      toast.success("Service updated successfully!");
    } catch (err) {
      console.error("Error updating service:", err.response?.data || err.message);
      const errorMessage = err.response?.data?.error || "Failed to update service.";
      setError(errorMessage);
      toast.error(errorMessage);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-indigo-50 p-4 sm:p-6">
      <ToastContainer />
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 pb-4 border-b border-gray-100">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Service Management</h1>
            <p className="text-gray-600 mt-1">
              Manage government services, financial configurations, and service categories
            </p>
          </div>
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowAddModal(true)}
            className="mt-4 md:mt-0 bg-[#1e3a5f] hover:bg-[#172a45] text-white font-medium px-4 py-2.5 rounded-xl flex items-center transition-all duration-300 shadow-md hover:shadow-lg"
          >
            <FiPlus className="mr-2" />
            Add New Service
          </motion.button>
        </div>

        {/* Error Message */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700"
          >
            {error}
          </motion.div>
        )}

        {/* Loading State */}
        {loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-white p-8 rounded-2xl shadow-lg text-center border border-gray-100"
          >
            <div className="mx-auto w-24 h-24 bg-indigo-50 rounded-full flex items-center justify-center mb-4">
              <svg className="animate-spin h-12 w-12 text-indigo-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
            <p className="text-gray-600">Loading services...</p>
          </motion.div>
        )}

        {/* Stats Cards */}
        {!loading && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-8">
            {[
              { label: "Total Services", value: services.length, icon: "📊", bgColor: "from-indigo-100 to-indigo-50", borderColor: "border-indigo-200" },
              { 
                label: "Active Services", 
                value: services.filter((s) => s.status === "active").length,
                icon: "✅",
                bgColor: "from-emerald-100 to-emerald-50",
                borderColor: "border-emerald-200"
              },
              { 
                label: "Sub-Categories", 
                value: services.reduce((sum, service) => sum + (service.subcategories?.length || 0), 0),
                icon: "🗂️",
                bgColor: "from-amber-100 to-amber-50",
                borderColor: "border-amber-200"
              }
            ].map((stat, index) => (
              <motion.div 
                key={index} 
                className={`rounded-2xl shadow-lg p-5 border ${stat.borderColor} bg-gradient-to-br ${stat.bgColor} transition-all`}
                whileHover={{ y: -5, boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1)" }}
              >
                <div className="flex items-center">
                  <span className="text-3xl mr-3">{stat.icon}</span>
                  <div>
                    <p className="text-sm text-gray-600">{stat.label}</p>
                    <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Search */}
        {!loading && (
          <div className="bg-white p-5 rounded-2xl shadow-lg border border-gray-100 mb-8">
            <div className="flex items-center">
              <div className="relative w-full">
                <input
                  type="text"
                  placeholder="Search services or sub-categories..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
                <svg
                  className="absolute left-4 top-3.5 h-5 w-5 text-gray-400"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>
              <button 
                onClick={() => setSearchQuery("")}
                className="ml-3 px-4 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors font-medium"
              >
                Clear
              </button>
            </div>
            <div className="mt-3 text-sm text-indigo-600">
              <span className="font-medium">Search Tip:</span> Try searching for "income" or "property" to see sub-category results
            </div>
          </div>
        )}

        {/* Services Grid */}
        {!loading && filteredServices.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredServices.map((service) => {
              const wallet = getWalletById(service.wallet_id);
              return (
                <motion.div
                  key={service.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className="bg-white rounded-2xl shadow-lg overflow-hidden border border-gray-100"
                  whileHover={{ y: -5, boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1)" }}
                >
                  <div className="p-6">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center">
                          <div className="bg-indigo-100 p-2 rounded-lg mr-3">
                            <DocumentIcon />
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h2 className="text-lg font-bold text-gray-900">
                                {highlightMatch(service.name)}
                              </h2>

                              {service.requires_workflow === false ? (
                                <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">
                                  Quick Service
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-indigo-100 text-indigo-700 border border-indigo-200">
                                  Workflow Service
                                </span>
                              )}
                            </div>
                            <span
                              className={`mt-1 px-2.5 py-1 rounded-full text-xs font-medium ${
                                service.status === "active" ? "bg-emerald-100 text-emerald-800" : "bg-gray-100 text-gray-800"
                              }`}
                            >
                              {service.status.charAt(0).toUpperCase() + service.status.slice(1)}
                            </span>
                          </div>
                        </div>
                        <p className="text-gray-600 text-sm mt-3">
                          {highlightMatch(service.description)}
                        </p>
                      </div>
                    </div>
                    
                    <div className="mt-5 grid grid-cols-2 gap-3">
                      <div className="border border-gray-100 bg-gray-50 rounded-xl p-4">
                        <div className="flex items-center">
                          <FeeIcon />
                          <div className="ml-2">
                            <p className="text-xs text-gray-600">Dept. Charges</p>
                            <p className="font-bold text-gray-900 text-lg">{formatCurrency(service.department_charges)}</p>
                          </div>
                        </div>
                      </div>
                      <div className="border border-gray-100 bg-gray-50 rounded-xl p-4">
                        <div className="flex items-center">
                          <FeeIcon />
                          <div className="ml-2">
                            <p className="text-xs text-gray-600">Service Charges</p>
                            <p className="font-bold text-gray-900 text-lg">{formatCurrency(service.service_charges)}</p>
                          </div>
                        </div>
                      </div>
                      
                      {/* Has Expiry Card */}
                      <div className="col-span-2 border border-gray-100 bg-blue-50 rounded-xl p-4">
                        <div className="flex items-center">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-500" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                          </svg>
                          <div className="ml-2">
                            <p className="text-xs text-gray-600">Has Expiry Date</p>
                            <p className="font-bold text-gray-900">
                              {service.has_expiry ? "Yes" : "No"}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {service.requires_wallet && wallet && (
                      <div className="mt-4 border border-gray-100 bg-gray-50 rounded-xl p-4">
                        <div className="flex items-center">
                          <WalletIcon />
                          <div className="ml-2">
                            <p className="text-xs text-gray-600">Linked Wallet</p>
                            <p className="font-bold text-gray-900">{wallet.name}</p>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    <div className="mt-5 flex items-center">
                      <LinkIcon />
                      <a
                        href={service.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-indigo-600 hover:text-indigo-800 text-sm font-medium ml-1"
                      >
                        Visit Official Website
                      </a>
                    </div>
                  </div>
                  
                  <div className="border-t border-gray-100 p-5 bg-gray-50">
                    <div className="flex justify-between items-center">
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => toggleServiceDetails(service.id)}
                        className="text-gray-700 hover:text-indigo-600 text-sm font-medium flex items-center px-3 py-2 bg-white rounded-lg border border-gray-200"
                      >
                        {expandedService === service.id ? "Hide Details" : "View Details"}
                        <ChevronIcon open={expandedService === service.id} />
                      </motion.button>
                      <div className="flex gap-2">
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => openEditModal(service)}
                          className="text-gray-600 hover:text-gray-900 text-sm font-medium flex items-center px-3 py-2 bg-white rounded-lg border border-gray-200"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                          </svg>
                          Edit
                        </motion.button>
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => handleDeleteService(service.id)}
                          className="text-red-500 hover:text-red-700 text-sm flex items-center px-3 py-2 bg-red-50 rounded-lg"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                          Delete
                        </motion.button>
                      </div>
                    </div>
                    
                    <AnimatePresence>
                      {expandedService === service.id && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="mt-5"
                        >
                          {/* Service Level Documents */}
                          <div className="mb-6">
                            <h4 className="font-medium text-gray-900 mb-3 flex items-center">
                              <DocumentIcon className="mr-2" />
                              Required Documents
                            </h4>
                            <ul className="space-y-2">
                              {(service.required_documents || []).map((doc, index) => (
                                <motion.li 
                                  key={index} 
                                  className="flex items-start bg-amber-50 rounded-xl p-3 border border-amber-100"
                                  initial={{ opacity: 0, x: -10 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  transition={{ delay: index * 0.1 }}
                                >
                                  <span className="text-amber-500 mr-2">•</span>
                                  <span className="text-gray-700">{doc.document_name}</span>
                                </motion.li>
                              ))}
                            </ul>
                          </div>
                          
                          {/* Expiry Information */}
                          <div className="mb-6 border border-gray-100 bg-blue-50 rounded-xl p-4">
                            <div className="flex items-center">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-500" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                              </svg>
                              <div className="ml-2">
                                <p className="text-sm font-medium text-gray-900">Expiry Information</p>
                                <p className="text-gray-600 mt-1">
                                  This service {service.has_expiry ? 
                                    <span className="font-medium text-green-600">requires</span> : 
                                    <span className="font-medium text-gray-600">does not require</span>
                                  } an expiration date
                                </p>
                              </div>
                            </div>
                          </div>

                          {/* Workflow - Quick Service  */}
                          <div className="mb-6 border border-gray-100 bg-purple-50 rounded-xl p-4">
                            <div className="flex items-center">
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="h-5 w-5 text-purple-500"
                                viewBox="0 0 20 20"
                                fill="currentColor"
                              >
                                <path
                                  fillRule="evenodd"
                                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM9 9V7a1 1 0 112 0v2a1 1 0 01-2 0zm0 4a1 1 0 112 0 1 1 0 01-2 0z"
                                  clipRule="evenodd"
                                />
                              </svg>
                              <div className="ml-2">
                                <p className="text-sm font-medium text-gray-900">Service Type</p>
                                <p className="text-gray-700 mt-1">
                                  {service.requires_workflow === false
                                    ? 'Quick Service (No workflow / tracking)'
                                    : 'Workflow Service (Has tracking & stages)'}
                                </p>
                              </div>
                            </div>
                          </div>

                          {/* Sub-Categories Section */}
                          <div className="mt-6">
                            <div className="flex justify-between items-center mb-4">
                              <h4 className="font-medium text-gray-900 text-lg">Sub-Categories</h4>
                              <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                                {(service.subcategories || []).length} items
                              </span>
                            </div>
                            
                            {(service.subcategories && service.subcategories.length > 0) ? (
                              <div className="max-h-80 overflow-y-auto pr-2">
                                {service.subcategories.map((subCat) => {
                                  const isMatch = searchQuery && 
                                    subCat.name?.toLowerCase().includes(searchQuery.toLowerCase());
                                
                                  return (
                                    <div 
                                      key={subCat.id} 
                                      className={`mb-3 border border-gray-100 rounded-xl overflow-hidden bg-white shadow-sm ${isMatch ? "ring-2 ring-indigo-500" : ""}`}
                                    >
                                      <button
                                        onClick={() => toggleSubCategory(subCat.id)}
                                        className="w-full flex justify-between items-center p-4 bg-gray-50 hover:bg-gray-100 transition-colors"
                                      >
                                        <div className="text-left">
                                          <p className="font-medium text-gray-900">
                                            {highlightMatch(subCat.name)}
                                          </p>
                                          <div className="flex gap-2 mt-2">
                                            <span className="text-xs bg-blue-100 text-blue-800 px-2.5 py-1 rounded-full">
                                              Dept: {formatCurrency(subCat.department_charges)}
                                            </span>
                                            <span className="text-xs bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-full">
                                              Service: {formatCurrency(subCat.service_charges)}
                                            </span>
                                          </div>
                                        </div>
                                        <ChevronIcon 
                                          open={expandedSubCategory === subCat.id} 
                                          className="h-5 w-5 text-gray-500" 
                                        />
                                      </button>
                                      
                                      <AnimatePresence>
                                        {expandedSubCategory === subCat.id && (
                                          <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: "auto", opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            className="bg-white"
                                          >
                                            <div className="p-4 border-t border-gray-100">
                                              {(subCat.required_documents || []).length > 0 && (
                                                <div className="mb-4">
                                                  <h5 className="text-sm text-gray-700 font-medium mb-2 flex items-center">
                                                    <DocumentIcon className="mr-2" />
                                                    Required Documents:
                                                  </h5>
                                                  <ul className="space-y-2">
                                                    {subCat.required_documents.map((doc, index) => (
                                                      <li key={index} className="flex items-start bg-gray-50 rounded-lg p-2">
                                                        <span className="text-amber-500 mr-2">•</span>
                                                        <span className="text-gray-600 text-sm">{doc.document_name}</span>
                                                      </li>
                                                    ))}
                                                  </ul>
                                                </div>
                                              )}
                          
                                              <div className="flex justify-end">
                                                <motion.button
                                                  whileHover={{ scale: 1.03 }}
                                                  whileTap={{ scale: 0.98 }}
                                                  onClick={() => handleDeleteSubcategory(service.id, subCat.id)}
                                                  className="text-red-500 hover:text-red-700 text-sm flex items-center px-3 py-1.5 bg-red-50 rounded-lg"
                                                >
                                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                                                    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                                                  </svg>
                                                  Delete Sub-category
                                                </motion.button>
                                              </div>
                                            </div>
                                          </motion.div>
                                        )}
                                      </AnimatePresence>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="text-gray-600 text-sm p-4 bg-gray-50 rounded-xl">
                                No sub-categories available. Add a new sub-category below.
                              </div>
                            )}
                          </div>

                          {/* Add Sub-Category Form */}
                          <div className="mt-6 pt-5 border-t border-gray-200">
                            <h4 className="font-medium text-gray-900 mb-4 text-lg">Add New Sub-Category</h4>
                            <div className="space-y-4">
                              <div>
                                <label className="block text-sm text-gray-700 mb-2 font-medium">Name *</label>
                                <input
                                  type="text"
                                  value={newSubcategory}
                                  onChange={(e) => setNewSubcategory(e.target.value)}
                                  placeholder="Sub-category name"
                                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                  required
                                />
                              </div>
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <label className="block text-sm text-gray-700 mb-2 font-medium">Dept. Charges (₹) *</label>
                                  <input
                                    type="number"
                                    value={newSubcategoryDeptCharges}
                                    onChange={(e) => setNewSubcategoryDeptCharges(e.target.value)}
                                    placeholder="Department charges"
                                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                    required
                                  />
                                </div>
                                <div>
                                  <label className="block text-sm text-gray-700 mb-2 font-medium">Service Charges (₹) *</label>
                                  <input
                                    type="number"
                                    value={newSubcategoryServiceCharges}
                                    onChange={(e) => setNewSubcategoryServiceCharges(e.target.value)}
                                    placeholder="Service charges"
                                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                    required
                                  />
                                </div>
                              </div>
                              <div>
                                <label className="block text-sm text-gray-700 mb-2 font-medium">Required Documents (one per line)</label>
                                <textarea
                                  value={newSubcategoryDocuments}
                                  onChange={(e) => setNewSubcategoryDocuments(e.target.value)}
                                  placeholder="List required documents"
                                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                  rows={3}
                                ></textarea>
                              </div>
                            </div>
                            <motion.button
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              onClick={() => handleAddSubcategory(service.id)}
                              className="mt-4 w-full px-4 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors font-medium"
                              disabled={!newSubcategory.trim()}
                            >
                              Add Sub-Category
                            </motion.button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* No Services Found */}
        {!loading && filteredServices.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-white p-8 rounded-2xl shadow-lg text-center border border-gray-100"
          >
            <div className="mx-auto w-24 h-24 bg-indigo-50 rounded-full flex items-center justify-center mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              {searchQuery ? "No services found" : "No services available"}
            </h3>
            <p className="text-gray-600 mb-6 max-w-md mx-auto">
              {searchQuery
                ? "Your search didn't match any services. Try different keywords."
                : "Get started by adding your first service."}
            </p>
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setShowAddModal(true)}
              className="px-5 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors shadow-md font-medium"
            >
              Add New Service
            </motion.button>
          </motion.div>
        )}

        {/* Add Service Modal */}
        <AnimatePresence>
          {showAddModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
            >
              <motion.div
                initial={{ scale: 0.95, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.95, y: 20 }}
                className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl border border-gray-200"
              >
                <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-6 sticky top-0 z-10">
                  <h2 className="text-xl font-bold text-white">Add New Service</h2>
                </div>
                <form onSubmit={handleAddService} className="p-6">
                  <div className="space-y-5">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Service Name *</label>
                      <input
                        type="text"
                        name="name"
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Description *</label>
                      <textarea
                        name="description"
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        rows={3}
                        required
                      ></textarea>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Department Charges (₹) *</label>
                        <input
                          type="number"
                          name="departmentCharges"
                          min="0"
                          className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Service Charges (₹) *</label>
                        <input
                          type="number"
                          name="serviceCharges"
                          min="0"
                          className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                          required
                        />
                      </div>
                    </div>
                    
                    <div>
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={newServiceHasExpiry}
                          onChange={(e) => setNewServiceHasExpiry(e.target.checked)}
                          className="rounded text-indigo-600 focus:ring-indigo-500 h-5 w-5"
                        />
                        <span className="ml-3 text-sm text-gray-700 font-medium">
                          This service has an expiry date
                        </span>
                      </label>
                      <p className="mt-1 text-xs text-gray-500 ml-8">
                        Check this if the service requires an expiration date (e.g., passports, licenses)
                      </p>
                    </div>
                    
                    <div>
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          name="requiresWallet"
                          checked={newServiceRequiresWallet}
                          onChange={(e) => setNewServiceRequiresWallet(e.target.checked)}
                          className="rounded text-indigo-600 focus:ring-indigo-500 h-5 w-5"
                        />
                        <span className="ml-3 text-sm text-gray-700 font-medium">Requires Wallet Integration</span>
                      </label>
                    </div>

                    <div>
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          name="requiresWorkflow"
                          checked={!requiresWorkflow}
                          onChange={(e) => setRequiresWorkflow(!e.target.checked)}
                          className="rounded text-indigo-600 focus:ring-indigo-500 h-5 w-5"
                        />
                        <span className="ml-3 text-sm text-gray-700 font-medium">This is a Quick Service (no workflow)</span>
                      </label>
                    </div>
                    
                    {newServiceRequiresWallet && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Linked Wallet *</label>
                        <select
                          name="walletId"
                          className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                          required={newServiceRequiresWallet}
                        >
                          <option value="">Select wallet</option>
                          {wallets.map((wallet) => (
                            <option key={wallet.id} value={wallet.id}>
                              {wallet.name} ({formatCurrency(wallet.balance)})
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Website *</label>
                      <input
                        type="url"
                        name="website"
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        required
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Status *</label>
                      <select
                        name="status"
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        required
                      >
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Required Documents (one per line)</label>
                      <textarea
                        value={newServiceDocuments}
                        onChange={(e) => setNewServiceDocuments(e.target.value)}
                        placeholder="List required documents"
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        rows={3}
                      ></textarea>
                    </div>
                  </div>
                  <div className="mt-8 flex justify-end gap-3 border-t border-gray-200 pt-5">
                    <motion.button
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.98 }}
                      type="button"
                      onClick={() => setShowAddModal(false)}
                      className="px-5 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors font-medium"
                    >
                      Cancel
                    </motion.button>
                    <motion.button 
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.98 }}
                      type="submit" 
                      className="px-5 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors font-medium"
                    >
                      Add Service
                    </motion.button>
                  </div>
                </form>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Edit Service Modal */}
        <AnimatePresence>
          {showEditModal && editingService && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
            >
              <motion.div
                initial={{ scale: 0.95, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.95, y: 20 }}
                className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl border border-gray-200"
              >
                <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-6 sticky top-0 z-10">
                  <h2 className="text-xl font-bold text-white">Edit Service</h2>
                </div>
                <form onSubmit={handleEditService} className="p-6">
                  <div className="space-y-5">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Service Name *</label>
                      <input
                        type="text"
                        name="name"
                        defaultValue={editingService.name}
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Description *</label>
                      <textarea
                        name="description"
                        defaultValue={editingService.description}
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        rows={3}
                        required
                      ></textarea>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Department Charges (₹) *</label>
                        <input
                          type="number"
                          name="departmentCharges"
                          min="0"
                          defaultValue={editingService.department_charges}
                          className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Service Charges (₹) *</label>
                        <input
                          type="number"
                          name="serviceCharges"
                          min="0"
                          defaultValue={editingService.service_charges}
                          className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                          required
                        />
                      </div>
                    </div>
                    
                    <div>
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={editServiceHasExpiry}
                          onChange={(e) => setEditServiceHasExpiry(e.target.checked)}
                          className="rounded text-indigo-600 focus:ring-indigo-500 h-5 w-5"
                        />
                        <span className="ml-3 text-sm text-gray-700 font-medium">
                          This service has an expiry date
                        </span>
                      </label>
                    </div>
                    
                    <div>
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          name="requiresWallet"
                          defaultChecked={editingService.requires_wallet}
                          className="rounded text-indigo-600 focus:ring-indigo-500 h-5 w-5"
                        />
                        <span className="ml-3 text-sm text-gray-700 font-medium">Requires Wallet Integration</span>
                      </label>
                    </div>
                    
                    {editingService.requires_wallet && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Linked Wallet *</label>
                        <select
                          name="walletId"
                          defaultValue={editingService.wallet_id || ""}
                          className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                          required={editingService.requires_wallet}
                        >
                          <option value="">Select wallet</option>
                          {wallets.map((wallet) => (
                            <option key={wallet.id} value={wallet.id}>
                              {wallet.name} ({formatCurrency(wallet.balance)})
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Website *</label>
                      <input
                        type="url"
                        name="website"
                        defaultValue={editingService.website}
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        required
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Status *</label>
                      <select
                        name="status"
                        defaultValue={editingService.status}
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        required
                      >
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Required Documents (one per line)</label>
                      <textarea
                        value={editServiceDocuments}
                        onChange={(e) => setEditServiceDocuments(e.target.value)}
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        rows={3}
                      ></textarea>
                    </div>
                  </div>
                  <div className="mt-8 flex justify-end gap-3 border-t border-gray-200 pt-5">
                    <motion.button
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.98 }}
                      type="button"
                      onClick={() => setShowEditModal(false)}
                      className="px-5 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors font-medium"
                    >
                      Cancel
                    </motion.button>
                    <motion.button 
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.98 }}
                      type="submit" 
                      className="px-5 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors font-medium"
                    >
                      Save Changes
                    </motion.button>
                  </div>
                </form>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default ServiceManagement;