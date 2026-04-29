import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FiUser, FiPhone, FiHash, FiPlus, FiCheckCircle, FiXCircle, FiChevronDown, FiClock, FiAward, FiSearch, FiFileText } from 'react-icons/fi';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { getServices, createToken, getTokens, getCampaigns, getStaff, assignToken } from '/src/services/campaignService';

const TokenGenerator = () => {
  const [formData, setFormData] = useState({
    customerName: '',
    phone: '',
    category: '',
    subcategory: '',
    campaign: '',
    centreId: localStorage.getItem('centre_id') || '',
  });
  
  const [categories, setCategories] = useState([]);
  const [filteredSubcategories, setFilteredSubcategories] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [tokens, setTokens] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [tokenView, setTokenView] = useState('active'); // 'active' or 'campaign'
  
  const userRole = localStorage.getItem('role');
  const userId = localStorage.getItem('id');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const categoriesRes = await getServices();
        setCategories(categoriesRes.data);

        const campaignsRes = await getCampaigns();
        setCampaigns(campaignsRes.data);

        const tokensRes = await getTokens();
        setTokens(tokensRes.data);

        const staffRes = await getStaff(formData.centreId);
        setStaffList(staffRes.data);
      } catch (err) {
        console.error('TokenGenerator.jsx: Error fetching data:', err.response?.data || err.message);
        setError('Failed to load data.');
        toast.error('Failed to load data: ' + (err.response?.data?.error || err.message));
      }
    };
    fetchData();
  }, [formData.centreId]);

  useEffect(() => {
    if (formData.category && categories.length > 0) {
      const category = categories.find(cat => cat.id === parseInt(formData.category));
      setFilteredSubcategories(category?.subcategories || []);
    } else {
      setFilteredSubcategories([]);
    }
  }, [formData.category, categories]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const errors = [];
    if (!formData.customerName || formData.customerName.trim().length < 2) {
      errors.push('Customer name is required and must be at least 2 characters');
    }
    if (!formData.phone || !/^\d{10}$/.test(formData.phone)) {
      errors.push('Valid 10-digit phone number is required');
    }
    if (!formData.centreId || isNaN(parseInt(formData.centreId))) {
      errors.push('Valid centre ID is required');
    }
    if (formData.category && isNaN(parseInt(formData.category))) {
      errors.push('Valid category ID is required');
    }
    if (formData.subcategory && isNaN(parseInt(formData.subcategory))) {
      errors.push('Valid subcategory ID is required');
    }
    if (formData.campaign && isNaN(parseInt(formData.campaign))) {
      errors.push('Valid campaign ID is required');
    }

    if (errors.length > 0) {
      errors.forEach(error => toast.error(error));
      return;
    }

    try {
      const submissionData = {
        customerName: formData.customerName.trim(),
        phone: formData.phone.trim(),
        categoryId: formData.category ? parseInt(formData.category) : null,
        subcategoryId: formData.subcategory ? parseInt(formData.subcategory) : null,
        campaignId: formData.campaign ? parseInt(formData.campaign) : null,
        centreId: parseInt(formData.centreId) || null,
        type: formData.campaign ? 'campaign' : 'normal'
      };

      await createToken(submissionData);
      toast.success('Token created successfully!');

      setFormData({
        customerName: '',
        phone: '',
        category: '',
        subcategory: '',
        campaign: '',
        centreId: formData.centreId,
      });
      setFilteredSubcategories([]);

      const tokensRes = await getTokens();
      setTokens(tokensRes.data);
    } catch (err) {
      if (err.response?.data?.details) {
        err.response.data.details.forEach(detail => toast.error(detail));
      } else {
        toast.error(err.response?.data?.error || 'Failed to create token.');
      }
    }
  };

  const handleAssignToken = async (tokenId, staffId) => {
    if (!staffId) return;
    try {
      await assignToken(tokenId, staffId);
      toast.success('Token reassigned successfully!');
      
      const tokensRes = await getTokens();
      setTokens(tokensRes.data);
    } catch (err) {
      toast.error('Failed to assign token: ' + (err.response?.data?.error || err.message));
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
    const campaign = campaigns.find(cmp => cmp.id === campaignId);
    return campaign ? campaign.name : 'N/A';
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

  // Filter tokens based on view, active status tab, and search
  const filteredTokens = tokens
    .filter(token => {
      // First filter by token view (active or campaign)
      if (tokenView === 'campaign') {
        return token.type === 'campaign';
      }
      return true; // 'active' shows all
    })
    .filter(token => {
      if (activeTab === 'all') return true;
      return token.status === activeTab;
    })
    .filter(token => {
      return token.customerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
             token.tokenId?.toLowerCase().includes(searchTerm.toLowerCase());
    });

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <ToastContainer position="top-right" autoClose={5000} />
      
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Token Generator</h1>
          <p className="text-gray-600 mt-2">Create and manage customer service tokens</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-5 mb-8">
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex items-center">
              <div className="p-3 bg-blue-100 rounded-xl">
                <FiHash className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <h3 className="text-sm text-gray-500">Total Tokens</h3>
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
                <p className="text-2xl font-bold">
                  {tokens.filter(t => t.status === 'processed' || t.status === 'completed').length}
                </p>
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
                <h3 className="text-sm text-gray-500">Campaign Tokens</h3>
                <p className="text-2xl font-bold">{tokens.filter(t => t.type === 'campaign').length}</p>
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
                    placeholder="Enter phone number"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Centre ID</label>
                <input
                  type="text"
                  name="centreId"
                  value={formData.centreId}
                  onChange={handleInputChange}
                  className={`px-4 py-3 w-full border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all ${userRole !== 'superadmin' ? 'bg-gray-50' : ''}`}
                  placeholder="Enter centre ID"
                  disabled={userRole !== 'superadmin'}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Service Category</label>
                <div className="relative">
                  <FiChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none" />
                  <select
                    name="category"
                    value={formData.category}
                    onChange={handleInputChange}
                    className="px-4 py-3 w-full border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none transition-all"
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
                  <FiChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none" />
                  <select
                    name="subcategory"
                    value={formData.subcategory}
                    onChange={handleInputChange}
                    className="px-4 py-3 w-full border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none transition-all"
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
                <label className="text-sm font-medium text-gray-700">Campaign (Optional)</label>
                <div className="relative">
                  <FiChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none" />
                  <select
                    name="campaign"
                    value={formData.campaign}
                    onChange={handleInputChange}
                    className="px-4 py-3 w-full border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none transition-all"
                  >
                    <option value="">Select campaign</option>
                    {campaigns.map(cmp => (
                      <option key={cmp.id} value={cmp.id}>{cmp.name}</option>
                    ))}
                  </select>
                </div>
              </div>
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

        {/* Token View Tabs (same as AdminTokenManagement) */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-6">
          <div className="flex flex-wrap gap-2">
            <button
              className={`px-6 py-2 rounded-xl text-sm font-medium transition-all ${
                tokenView === 'active' 
                  ? 'bg-indigo-600 text-white shadow-md' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
              onClick={() => { setTokenView('active'); setActiveTab('all'); }}
            >
              <div className="flex items-center gap-2">
                <FiHash className="h-4 w-4" />
                Active Tokens
              </div>
            </button>
            <button
              className={`px-6 py-2 rounded-xl text-sm font-medium transition-all ${
                tokenView === 'campaign' 
                  ? 'bg-purple-600 text-white shadow-md' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
              onClick={() => { setTokenView('campaign'); setActiveTab('all'); }}
            >
              <div className="flex items-center gap-2">
                <FiFileText className="h-4 w-4" />
                Campaign Tokens
              </div>
            </button>
          </div>
          {tokenView === 'campaign' && (
            <div className="mt-4 bg-purple-50 p-3 rounded-xl">
              <p className="text-sm text-purple-700 flex items-center">
                <FiAward className="mr-2" />
                Showing only campaign tokens (all statuses)
              </p>
            </div>
          )}
        </div>

        {/* Token List Controls */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex flex-wrap gap-2">
              <button 
                className={`px-4 py-2 rounded-xl text-sm font-medium ${activeTab === 'all' ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                onClick={() => setActiveTab('all')}
              >
                All {tokenView === 'campaign' ? 'Campaign' : 'Active'} Tokens
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
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredTokens.map(token => (
                  <tr key={token.id || token.tokenId} className="hover:bg-gray-50 transition-colors">
                    <td className="py-4 px-6">
                      <div className="flex items-center">
                        <div className={`p-2 rounded-lg ${token.type === 'campaign' ? 'bg-purple-100' : 'bg-indigo-100'}`}>
                          <FiHash className={`h-5 w-5 ${token.type === 'campaign' ? 'text-purple-600' : 'text-indigo-600'}`} />
                        </div>
                        <div className="ml-4">
                          <div className="font-medium text-gray-900 flex items-center">
                            <span className={token.type === 'campaign' ? 'font-mono' : ''}>
                              {token.tokenId}
                            </span>
                            <span className={`ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${typeStyles[token.type]}`}>
                              {token.type}
                            </span>
                          </div>
                          <div className="text-sm text-gray-500">{token.customerName}</div>
                        </div>
                      </div>
                      <div className="mt-2 text-sm text-gray-500 flex items-center">
                        <FiPhone className="h-4 w-4 mr-1" />
                        {token.phone}
                      </div>
                    </td>
                    
                    <td className="py-4 px-6">
                      <div className="font-medium text-gray-900">{getCategoryName(token.categoryId)}</div>
                      <div className="text-sm text-gray-500">{getSubcategoryName(token.categoryId, token.subcategoryId)}</div>
                      {token.campaignId && (
                        <div className="mt-1 text-xs text-purple-600 flex items-center">
                          <FiAward className="h-3 w-3 mr-1" />
                          {getCampaignName(token.campaignId)}
                        </div>
                      )}
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
                    
                    {/* Assigned To Column */}
                    <td className="py-4 px-6">
                      {token.status === 'pending' ? (
                        <div className="relative">
                          <select
                            value={token.staffId || ''}
                            onChange={(e) => handleAssignToken(token.tokenId, e.target.value)}
                            className="w-full border border-gray-300 rounded-lg py-2 pl-3 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none bg-white cursor-pointer"
                          >
                            <option value="" disabled>Unassigned</option>
                            {staffList.map(staff => (
                              <option key={staff.id} value={staff.id}>{staff.name}</option>
                            ))}
                          </select>
                          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500">
                            <FiChevronDown className="h-4 w-4" />
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center">
                          <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                            <FiUser className="h-4 w-4 text-gray-600" />
                          </div>
                          <div className="ml-3">
                            <div className="text-sm font-medium text-gray-900">{token.staffName || 'Unassigned'}</div>
                            <div className="text-xs text-gray-500">{token.centreName}</div>
                          </div>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {filteredTokens.length === 0 && (
            <div className="text-center py-12">
              <FiHash className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No tokens found</h3>
              <p className="mt-1 text-sm text-gray-500">
                {tokenView === 'campaign' 
                  ? 'No campaign tokens available.'
                  : 'No active tokens available. Create a new token to get started.'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TokenGenerator;