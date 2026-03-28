import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiUser, FiPhone, FiHash, FiPlus, FiCheckCircle, FiXCircle, FiChevronDown, FiUserPlus, FiClock, FiFilter, FiSearch, FiEdit2, FiCalendar, FiAward, FiFileText } from 'react-icons/fi';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { io } from '.io-client';
import { getServices, createToken, getTokens, getCampaignHistory, getActiveCampaigns, getStaff, assignStaffToToken } from '/src/services/serviceService';
import { , connect } from '@/services/socket';

const AdminTokenManagement = () => {
  const [formData, setFormData] = useState({
    customerName: '',
    phone: '',
    category: '',
    subcategory: '',
    campaign: '',
    type: 'normal',
    centreId: localStorage.getItem('centre_id') || '',
  });
  const [categories, setCategories] = useState([]);
  const [filteredSubcategories, setFilteredSubcategories] = useState([]);
  const [activeCampaigns, setActiveCampaigns] = useState([]);
  const [campaignHistory, setCampaignHistory] = useState([]);
  const [tokens, setTokens] = useState([]);
  const [staffList, setStaffList] = useState({});
  const [selectedStaff, setSelectedStaff] = useState({});
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('all');
  const [tokenView, setTokenView] = useState('active'); // 'active' or 'history'
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedToken, setSelectedToken] = useState(null);
  const [showTokenModal, setShowTokenModal] = useState(false);
  const [campaignMap, setCampaignMap] = useState({}); // Map to store campaign details by ID
  
  const userRole = localStorage.getItem('role');
  const userId = localStorage.getItem('id');
  const centreId = localStorage.getItem('centre_id');

  useEffect(() => {
    socket.on('connect', () => {
      console.log('AdminTokenManagement.jsx: Connected to Socket.IO server:', socket.id);
      if (centreId) {
        socket.emit('joinCentre', centreId);
        console.log('AdminTokenManagement.jsx: Joined centre room:', `centre_${centreId}`);
      }
    });

    socket.on('newToken', (data) => {
      console.log('AdminTokenManagement.jsx: Received newToken:', data);
      toast.info(data.message);
      if (tokenView === 'active') {
        fetchTokens();
      }
    });

    .on('tokenReassigned', (data) => {
      console.log('AdminTokenManagement.jsx: Received tokenReassigned:', data);
      toast.info(data.message);
      if (tokenView === 'active') {
        fetchTokens();
      }
    });

    .on('connect_error', (err) => {
      console.error('AdminTokenManagement.jsx: .IO connection error:', err.message);
      toast.error('Failed to connect to real-time notifications.');
    });

    return () => {
      .off('newToken');
      .off('tokenReassigned');
      .disconnect();
      console.log('AdminTokenManagement.jsx: Disconnected from .IO server');
    };
  }, [centreId, tokenView]);

  const fetchTokens = async () => {
    try {
      // Fetch only active tokens (normal + active campaign)
      const tokensRes = await getTokens(formData.centreId, '');
      setTokens(tokensRes.data);
      console.log('AdminTokenManagement.jsx: Fetched active tokens:', JSON.stringify(tokensRes.data, null, 2));
      return tokensRes;
    } catch (err) {
      console.error('AdminTokenManagement.jsx: Error fetching tokens:', err.response?.data || err.message);
      toast.error('Failed to fetch tokens: ' + (err.response?.data?.error || err.message));
      return null;
    }
  };

  const fetchCampaignHistory = async () => {
    try {
      const historyRes = await getCampaignHistory(formData.centreId);
      setCampaignHistory(historyRes.data);
      console.log('AdminTokenManagement.jsx: Fetched campaign history:', JSON.stringify(historyRes.data, null, 2));
    } catch (err) {
      console.error('AdminTokenManagement.jsx: Error fetching campaign history:', err.response?.data || err.message);
      toast.error('Failed to fetch campaign history: ' + (err.response?.data?.error || err.message));
    }
  };

  // Build campaign map from both active campaigns and campaign history
  useEffect(() => {
    const map = {};
    
    // Add active campaigns to map
    activeCampaigns.forEach(campaign => {
      map[campaign.id] = {
        id: campaign.id,
        name: campaign.name,
        code: campaign.campaign_code || campaign.name.replace(/[^a-zA-Z0-9]/g, '').substring(0, 5).toUpperCase(),
        startDate: campaign.start_date,
        endDate: campaign.end_date,
        targetTokens: campaign.target_tokens,
        tokensGenerated: campaign.tokens_generated || 0
      };
    });
    
    // Add campaigns from history that might not be in active campaigns
    campaignHistory.forEach(token => {
      if (token.campaignId && !map[token.campaignId]) {
        map[token.campaignId] = {
          id: token.campaignId,
          name: token.campaignName || 'Unknown Campaign',
          code: token.campaignCode || 'CAM',
          startDate: token.campaignStartDate,
          endDate: token.campaignEndDate
        };
      }
    });
    
    setCampaignMap(map);
    console.log('AdminTokenManagement.jsx: Campaign map built:', map);
  }, [activeCampaigns, campaignHistory]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const categoriesRes = await getServices();
        setCategories(categoriesRes.data);
        console.log('AdminTokenManagement.jsx: Fetched categories:', JSON.stringify(categoriesRes.data, null, 2));

        // Fetch only active campaigns for the form
        const activeCampaignsRes = await getActiveCampaigns(formData.centreId);
        setActiveCampaigns(activeCampaignsRes.data);
        console.log('AdminTokenManagement.jsx: Fetched active campaigns:', JSON.stringify(activeCampaignsRes.data, null, 2));

        const tokensRes = await fetchTokens();
        if (!tokensRes) throw new Error('Failed to fetch tokens');

        await fetchCampaignHistory();

        const uniqueCentreIds = [...new Set(tokensRes.data.map(token => token.centreId))];
        const staffPromises = uniqueCentreIds.map(centreId => getStaff(centreId));
        const staffResponses = await Promise.all(staffPromises);
        const staffData = uniqueCentreIds.reduce((acc, centreId, index) => {
          acc[centreId] = staffResponses[index].data;
          return acc;
        }, {});
        setStaffList(staffData);
        console.log('AdminTokenManagement.jsx: Fetched staff:', JSON.stringify(staffData, null, 2));
      } catch (err) {
        console.error('AdminTokenManagement.jsx: Error fetching data:', err.message);
        setError('Failed to load data.');
        toast.error('Failed to load data: ' + err.message);
      }
    };
    fetchData();
  }, [formData.centreId]);

  useEffect(() => {
    if (formData.category && categories.length > 0) {
      const category = categories.find(cat => cat.id === parseInt(formData.category));
      setFilteredSubcategories(category?.subcategories || []);
      console.log('AdminTokenManagement.jsx: Filtered subcategories:', category?.subcategories || []);
    } else {
      setFilteredSubcategories([]);
    }
  }, [formData.category, categories]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => {
      const newFormData = { ...prev, [name]: value };
      if (name === 'type' && value === 'normal') {
        newFormData.campaign = '';
      }
      console.log('AdminTokenManagement.jsx: Input changed:', { [name]: value });
      return newFormData;
    });
  };

  const handleStaffChange = (tokenId, staffId) => {
    setSelectedStaff(prev => ({ ...prev, [tokenId]: staffId }));
    console.log('AdminTokenManagement.jsx: Selected staff for token:', { tokenId, staffId });
  };

  const handleAssignStaff = async (tokenId, centreId) => {
    const staffId = selectedStaff[tokenId];
    if (!staffId) {
      toast.error('Please select a staff member to assign');
      return;
    }
    try {
      await assignStaffToToken(tokenId, parseInt(staffId));
      toast.success(`Staff assigned to token ${tokenId}`);
      await fetchTokens();
    } catch (err) {
      console.error('AdminTokenManagement.jsx: Error assigning staff:', err.response?.data || err.message);
      toast.error(`Failed to assign staff: ${err.response?.data?.error || err.message}`);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log('AdminTokenManagement.jsx: Submitting form:', JSON.stringify(formData, null, 2));

    const errors = [];
    if (!formData.customerName || formData.customerName.trim().length < 2) {
      errors.push('Customer name is required and must be at least 2 characters');
    }
    if (!formData.phone || !/^\d{10}$/.test(formData.phone)) {
      errors.push('Valid 10-digit phone number is required');
    }
    if (!['normal', 'campaign'].includes(formData.type)) {
      errors.push('Token type is required and must be either "normal" or "campaign"');
    }
    
    // Campaign-specific validation
    if (formData.type === 'campaign') {
      if (!formData.campaign) {
        errors.push('Campaign selection is required for campaign tokens');
      } else {
        // Check if campaign has reached its target
        const selectedCampaign = activeCampaigns.find(c => c.id === parseInt(formData.campaign));
        if (selectedCampaign) {
          if (selectedCampaign.tokens_generated >= selectedCampaign.target_tokens) {
            errors.push('This campaign has reached its target token limit');
          }
        }
      }
    }
    if (formData.type === 'normal' && formData.campaign) {
      errors.push('Campaign should not be selected for normal tokens');
    }
    if (userRole !== 'admin' && (!formData.centreId || isNaN(parseInt(formData.centreId)))) {
      errors.push('Valid centre ID is required for non-admin users');
    }
    if (formData.category && isNaN(parseInt(formData.category))) {
      errors.push('Valid category ID is required');
    }
    if (formData.subcategory && isNaN(parseInt(formData.subcategory))) {
      errors.push('Valid subcategory ID is required');
    }

    if (errors.length > 0) {
      console.warn('AdminTokenManagement.jsx: Validation errors:', errors);
      errors.forEach(error => toast.error(error));
      return;
    }

    try {
      const submissionData = {
        customerName: formData.customerName.trim(),
        phone: formData.phone.trim(),
        categoryId: formData.category ? parseInt(formData.category) : null,
        subcategoryId: formData.subcategory ? parseInt(formData.subcategory) : null,
        campaignId: formData.type === 'campaign' ? parseInt(formData.campaign) : null,
        type: formData.type,
        created_by: userId,
        centreId: userRole === 'admin' ? undefined : parseInt(formData.centreId),
      };

      console.log('AdminTokenManagement.jsx: Submitting token:', JSON.stringify(submissionData, null, 2));
      const response = await createToken(submissionData);
      console.log('AdminTokenManagement.jsx: Token creation response:', JSON.stringify(response.data, null, 2));
      toast.success('Token created successfully!');

      // Reset form
      setFormData({
        customerName: '',
        phone: '',
        category: '',
        subcategory: '',
        campaign: '',
        type: 'normal',
        centreId: formData.centreId,
      });
      setFilteredSubcategories([]);

      // Refresh data
      await fetchTokens();
      await fetchCampaignHistory();

      // Refresh active campaigns
      const activeCampaignsRes = await getActiveCampaigns(formData.centreId);
      setActiveCampaigns(activeCampaignsRes.data);

      // Fetch staff if needed
      if (!staffList[submissionData.centreId]) {
        const staffRes = await getStaff(submissionData.centreId);
        setStaffList(prev => ({ ...prev, [submissionData.centreId]: staffRes.data }));
      }
    } catch (err) {
      console.error('AdminTokenManagement.jsx: Error creating token:', err.response?.data || err.message);
      if (err.response?.data?.details) {
        err.response.data.details.forEach(detail => toast.error(detail));
      } else {
        toast.error(err.response?.data?.error || 'Failed to create token.');
      }
    }
  };

  const getCategoryName = (categoryId) => {
    const category = categories.find(cat => cat.id === categoryId);
    return category ? category.name : 'N/A';
  };

  const getSubcategoryName = (categoryId, subcategoryId) => {
    const category = categories.find(cat => cat.id === categoryId);
    const subcategory = category?.subcategories?.find(sub => sub.id === subcategoryId);
    return subcategory ? subcategory.name : 'N/A';
  };

  const getCampaignName = (campaignId) => {
    if (!campaignId) return 'N/A';
    const campaign = campaignMap[campaignId];
    return campaign ? campaign.name : 'N/A';
  };

  const getCampaignCode = (campaignId) => {
    if (!campaignId) return 'N/A';
    const campaign = campaignMap[campaignId];
    return campaign ? campaign.code : 'CAM';
  };

  const getCampaignDates = (campaignId) => {
    if (!campaignId) return null;
    const campaign = campaignMap[campaignId];
    return campaign ? { start: campaign.startDate, end: campaign.endDate } : null;
  };

  const getStaffName = (staffId, centreId) => {
    const staff = staffList[centreId]?.find(s => s.id === parseInt(staffId));
    return staff ? staff.name : 'Unassigned';
  };

  const statusStyles = {
    pending: 'bg-yellow-100 text-yellow-800',
    processed: 'bg-green-100 text-green-800',
    cancelled: 'bg-red-100 text-red-800',
    completed: 'bg-blue-100 text-blue-800'
  };

  const typeStyles = {
    normal: 'bg-blue-100 text-blue-800',
    campaign: 'bg-purple-100 text-purple-800'
  };

  const getCampaignStatus = (campaignId) => {
    const dates = getCampaignDates(campaignId);
    if (!dates || !dates.end) return null;
    
    const today = new Date();
    const endDate = new Date(dates.end);
    if (endDate < today) {
      return <span className="text-xs text-red-600 ml-2">(Expired)</span>;
    }
    return null;
  };

  const filteredTokens = (tokenView === 'active' ? tokens : campaignHistory).filter(token => {
    if (activeTab === 'all') return true;
    return token.status === activeTab;
  }).filter(token => {
    return token.customerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
           token.tokenId?.toLowerCase().includes(searchTerm.toLowerCase());
  });

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <ToastContainer position="top-right" autoClose={5000} />
      
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Token Management</h1>
          <p className="text-gray-600 mt-2">Manage and track customer service tokens</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-5 mb-8">
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex items-center">
              <div className="p-3 bg-blue-100 rounded-xl">
                <FiHash className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <h3 className="text-sm text-gray-500">Total Active Tokens</h3>
                <p className="text-2xl font-bold">{tokens.length}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex items-center">
              <div className="p-3 bg-green-100 rounded-xl">
                <FiCheckCircle className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-4">
                <h3 className="text-sm text-gray-500">Processed</h3>
                <p className="text-2xl font-bold">{tokens.filter(t => t.status === 'processed' || t.status === 'completed').length}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex items-center">
              <div className="p-3 bg-yellow-100 rounded-xl">
                <FiClock className="h-6 w-6 text-yellow-600" />
              </div>
              <div className="ml-4">
                <h3 className="text-sm text-gray-500">Pending</h3>
                <p className="text-2xl font-bold">{tokens.filter(t => t.status === 'pending').length}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex items-center">
              <div className="p-3 bg-purple-100 rounded-xl">
                <FiAward className="h-6 w-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <h3 className="text-sm text-gray-500">Active Campaigns</h3>
                <p className="text-2xl font-bold">{activeCampaigns.length}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Token Generation Form */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-indigo-100 p-3 rounded-xl">
              <FiPlus className="h-6 w-6 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Generate New Token</h2>
              <p className="text-gray-600 text-sm">Create a new token for customer service</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Customer Name</label>
                <div className="relative">
                  <FiUser className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    name="customerName"
                    value={formData.customerName}
                    onChange={handleInputChange}
                    className="pl-10 pr-4 py-3 w-full border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                    placeholder="Enter customer name"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Phone Number</label>
                <div className="relative">
                  <FiPhone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    className="pl-10 pr-4 py-3 w-full border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                    placeholder="Enter 10-digit phone number"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Centre ID</label>
                <div className="relative">
                  <FiHash className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    name="centreId"
                    value={formData.centreId}
                    onChange={handleInputChange}
                    className="pl-10 pr-4 py-3 w-full border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                    placeholder="Enter centre ID"
                    disabled={userRole !== 'superadmin'}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Service Category</label>
                <div className="relative">
                  <FiHash className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <FiChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none" />
                  <select
                    name="category"
                    value={formData.category}
                    onChange={handleInputChange}
                    className="pl-10 pr-10 py-3 w-full border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent appearance-none transition-all"
                  >
                    <option value="">Select category</option>
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Subcategory</label>
                <div className="relative">
                  <FiHash className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <FiChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none" />
                  <select
                    name="subcategory"
                    value={formData.subcategory}
                    onChange={handleInputChange}
                    className="pl-10 pr-10 py-3 w-full border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent appearance-none transition-all"
                    disabled={!formData.category}
                  >
                    <option value="">Select subcategory</option>
                    {filteredSubcategories.map(sub => (
                      <option key={sub.id} value={sub.id}>{sub.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Token Type</label>
                <div className="relative">
                  <FiHash className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <FiChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none" />
                  <select
                    name="type"
                    value={formData.type}
                    onChange={handleInputChange}
                    className="pl-10 pr-10 py-3 w-full border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent appearance-none transition-all"
                    required
                  >
                    <option value="normal">Normal</option>
                    <option value="campaign">Campaign</option>
                  </select>
                </div>
              </div>
              {formData.type === 'campaign' && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Campaign</label>
                  <div className="relative">
                    <FiHash className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                    <FiChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none" />
                    <select
                      name="campaign"
                      value={formData.campaign}
                      onChange={handleInputChange}
                      className="pl-10 pr-10 py-3 w-full border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent appearance-none transition-all"
                      required
                    >
                      <option value="">Select campaign</option>
                      {activeCampaigns.map(cmp => {
                        const campaignCode = cmp.campaign_code || cmp.name.replace(/[^a-zA-Z0-9]/g, '').substring(0, 5).toUpperCase();
                        const nextNumber = (cmp.tokens_generated || 0) + 1;
                        return (
                          <option key={cmp.id} value={cmp.id}>
                            {cmp.name} ({campaignCode}-{centreId}-{String(nextNumber).padStart(3, '0')}) - {cmp.tokens_generated || 0}/{cmp.target_tokens} tokens
                          </option>
                        );
                      })}
                    </select>
                  </div>
                  {formData.campaign && (
                    <div className="bg-purple-50 p-3 rounded-xl mt-2">
                      {(() => {
                        const selectedCampaign = activeCampaigns.find(c => c.id === parseInt(formData.campaign));
                        if (!selectedCampaign) return null;
                        const campaignCode = selectedCampaign.campaign_code || selectedCampaign.name.replace(/[^a-zA-Z0-9]/g, '').substring(0, 5).toUpperCase();
                        const nextNumber = (selectedCampaign.tokens_generated || 0) + 1;
                        return (
                          <>
                            <p className="text-xs text-purple-700">
                              <span className="font-semibold">Campaign Token Format:</span>{' '}
                              {campaignCode}-{centreId}-{String(nextNumber).padStart(3, '0')}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                              Valid until {new Date(selectedCampaign.end_date).toLocaleDateString()}
                            </p>
                          </>
                        );
                      })()}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="flex justify-end pt-4">
              <button
                type="submit"
                className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-xl hover:from-indigo-700 hover:to-indigo-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-all flex items-center gap-2 shadow-md hover:shadow-lg"
              >
                <FiPlus className="h-5 w-5" />
                Generate Token
              </button>
            </div>
          </form>
        </motion.div>

        {/* Token View Tabs */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-6">
          <div className="flex flex-wrap gap-2">
            <button
              className={`px-6 py-2 rounded-xl text-sm font-medium transition-all ${
                tokenView === 'active' 
                  ? 'bg-indigo-600 text-white shadow-md' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
              onClick={() => setTokenView('active')}
            >
              <div className="flex items-center gap-2">
                <FiHash className="h-4 w-4" />
                Active Tokens
              </div>
            </button>
            <button
              className={`px-6 py-2 rounded-xl text-sm font-medium transition-all ${
                tokenView === 'history' 
                  ? 'bg-purple-600 text-white shadow-md' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
              onClick={() => setTokenView('history')}
            >
              <div className="flex items-center gap-2">
                <FiFileText className="h-4 w-4" />
                Campaign History
              </div>
            </button>
          </div>
        </div>

        {/* Token List Controls */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex flex-wrap gap-2">
              <button 
                className={`px-4 py-2 rounded-xl text-sm font-medium ${activeTab === 'all' ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                onClick={() => setActiveTab('all')}
              >
                All {tokenView === 'active' ? 'Active' : 'Campaign'} Tokens
              </button>
              <button 
                className={`px-4 py-2 rounded-xl text-sm font-medium ${activeTab === 'pending' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                onClick={() => setActiveTab('pending')}
              >
                Pending
              </button>
              <button 
                className={`px-4 py-2 rounded-xl text-sm font-medium ${activeTab === 'processed' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                onClick={() => setActiveTab('processed')}
              >
                Processed
              </button>
              <button 
                className={`px-4 py-2 rounded-xl text-sm font-medium ${activeTab === 'completed' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                onClick={() => setActiveTab('completed')}
              >
                Completed
              </button>
              <button 
                className={`px-4 py-2 rounded-xl text-sm font-medium ${activeTab === 'cancelled' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                onClick={() => setActiveTab('cancelled')}
              >
                Cancelled
              </button>
            </div>
            
            <div className="flex gap-3">
              <div className="relative">
                <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search tokens..."
                  className="pl-10 pr-4 py-2 w-full md:w-64 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
          </div>
          
          {tokenView === 'history' && (
            <div className="mt-4 bg-purple-50 p-3 rounded-xl">
              <p className="text-sm text-purple-700 flex items-center">
                <FiFileText className="mr-2" />
                Showing all campaign tokens including expired campaigns for record-keeping
              </p>
            </div>
          )}
        </div>

        {/* Token Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="py-4 px-6 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Token Details</th>
                  <th className="py-4 px-6 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Service Information</th>
                  <th className="py-4 px-6 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="py-4 px-6 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Assigned To</th>
                  {(userRole === 'admin' || userRole === 'superadmin') && tokenView === 'active' && (
                    <th className="py-4 px-6 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredTokens.map(token => {
                  const campaignDates = token.campaignId ? getCampaignDates(token.campaignId) : null;
                  const isExpired = campaignDates?.end && new Date(campaignDates.end) < new Date();
                  
                  return (
                    <motion.tr 
                      key={token.id || token.tokenId}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="py-4 px-6">
                        <div className="flex items-center">
                          <div className={`p-2 rounded-lg ${
                            token.type === 'campaign' ? 'bg-purple-100' : 'bg-indigo-100'
                          }`}>
                            <FiHash className={`h-5 w-5 ${
                              token.type === 'campaign' ? 'text-purple-600' : 'text-indigo-600'
                            }`} />
                          </div>
                          <div className="ml-4">
                            <div className="font-medium text-gray-900 flex items-center">
                              <span className={token.type === 'campaign' ? 'font-mono' : ''}>
                                {token.tokenId}
                              </span>
                              {token.type === 'campaign' && (
                                <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                                  Campaign
                                </span>
                              )}
                              {token.type === 'campaign' && isExpired && tokenView === 'history' && (
                                <span className="ml-2 text-xs text-red-600">(Expired)</span>
                              )}
                            </div>
                            <div className="text-sm text-gray-500">{token.customerName}</div>
                          </div>
                        </div>
                        <div className="mt-2 text-sm text-gray-500 flex items-center">
                          <FiPhone className="h-4 w-4 mr-1" />
                          {token.phone}
                        </div>
                        {token.type === 'campaign' && token.campaignId && (
                          <div className="mt-1 text-xs text-purple-600 flex items-center">
                            <FiCalendar className="h-3 w-3 mr-1" />
                            {getCampaignName(token.campaignId)}
                            {campaignDates?.end && (
                              <span className="ml-1 text-gray-500">
                                (until {new Date(campaignDates.end).toLocaleDateString()})
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                      
                      <td className="py-4 px-6">
                        <div className="font-medium text-gray-900">{getCategoryName(token.categoryId)}</div>
                        <div className="text-sm text-gray-500">{getSubcategoryName(token.categoryId, token.subcategoryId)}</div>
                        <div className="mt-1">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${typeStyles[token.type]}`}>
                            {token.type}
                          </span>
                        </div>
                      </td>
                      
                      <td className="py-4 px-6">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${statusStyles[token.status] || 'bg-gray-100 text-gray-800'}`}>
                          {token.status}
                        </span>
                        <div className="text-xs text-gray-500 mt-1 flex items-center">
                          <FiClock className="h-3 w-3 mr-1" />
                          {new Date(token.createdAt).toLocaleDateString()}
                        </div>
                      </td>
                      
                      <td className="py-4 px-6">
                        <div className="flex items-center">
                          <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                            <FiUser className="h-4 w-4 text-gray-600" />
                          </div>
                          <div className="ml-3">
                            <div className="text-sm font-medium text-gray-900">{getStaffName(token.staffId, token.centreId)}</div>
                            <div className="text-xs text-gray-500">{token.centreName}</div>
                          </div>
                        </div>
                      </td>
                      
                      {(userRole === 'admin' || userRole === 'superadmin') && tokenView === 'active' && (
                        <td className="py-4 px-6">
                          {token.status === 'pending' && token.type === 'normal' ? (
                            <div className="flex flex-col space-y-2">
                              <select
                                value={selectedStaff[token.tokenId] || ''}
                                onChange={(e) => handleStaffChange(token.tokenId, e.target.value)}
                                className="text-sm border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                              >
                                <option value="">Select staff</option>
                                {staffList[token.centreId]?.map(staff => (
                                  <option key={staff.id} value={staff.id}>{staff.name}</option>
                                ))}
                              </select>
                              <button
                                onClick={() => handleAssignStaff(token.tokenId, token.centreId)}
                                className="text-sm bg-indigo-600 text-white px-2 py-1 rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-1"
                                disabled={!selectedStaff[token.tokenId]}
                              >
                                <FiUserPlus className="h-4 w-4" />
                                Assign
                              </button>
                            </div>
                          ) : token.type === 'campaign' ? (
                            <div className="text-sm text-purple-600 bg-purple-50 p-2 rounded-lg">
                              <FiAward className="inline mr-1" />
                              Campaign Token
                            </div>
                          ) : (
                            <span className="text-gray-500 text-sm">Assignment not allowed</span>
                          )}
                        </td>
                      )}
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          
          {filteredTokens.length === 0 && (
            <div className="text-center py-12">
              <FiHash className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No tokens found</h3>
              <p className="mt-1 text-sm text-gray-500">
                {tokenView === 'active' 
                  ? 'No active tokens available. Create a new token to get started.'
                  : 'No campaign history available.'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminTokenManagement;
