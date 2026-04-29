import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FiUser, FiPhone, FiHash, FiPlus, FiCheckCircle, FiXCircle, FiChevronDown } from 'react-icons/fi';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { getServices, createToken, getTokens, getCampaigns } from '/src/services/campaignService';

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
  const [error, setError] = useState(null);
  const userRole = localStorage.getItem('role');
  const userId = localStorage.getItem('id');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const categoriesRes = await getServices();
        setCategories(categoriesRes.data);
        console.log('TokenGenerator.jsx: Fetched categories:', JSON.stringify(categoriesRes.data, null, 2));

        const campaignsRes = await getCampaigns();
        setCampaigns(campaignsRes.data);
        console.log('TokenGenerator.jsx: Fetched campaigns:', JSON.stringify(campaignsRes.data, null, 2));

        const tokensRes = await getTokens();
        setTokens(tokensRes.data);
        console.log('TokenGenerator.jsx: Fetched tokens:', JSON.stringify(tokensRes.data, null, 2));
      } catch (err) {
        console.error('TokenGenerator.jsx: Error fetching data:', err.response?.data || err.message);
        setError('Failed to load data.');
        toast.error('Failed to load data: ' + (err.response?.data?.error || err.message));
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    if (formData.category && categories.length > 0) {
      const category = categories.find(cat => cat.id === parseInt(formData.category));
      setFilteredSubcategories(category?.subcategories || []);
      console.log('TokenGenerator.jsx: Filtered subcategories:', category?.subcategories || []);
    } else {
      setFilteredSubcategories([]);
    }
  }, [formData.category, categories]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    console.log('TokenGenerator.jsx: Input changed:', { [name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log('TokenGenerator.jsx: Submitting form:', JSON.stringify(formData, null, 2));

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
      console.warn('TokenGenerator.jsx: Validation errors:', errors);
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

      console.log('TokenGenerator.jsx: Submitting token:', JSON.stringify(submissionData, null, 2));
      const response = await createToken(submissionData);
      console.log('TokenGenerator.jsx: Token creation response:', JSON.stringify(response.data, null, 2));
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
      console.error('TokenGenerator.jsx: Error creating token:', err.response?.data || err.message);
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
    const campaign = campaigns.find(cmp => cmp.id === campaignId);
    return campaign ? campaign.name : 'N/A';
  };

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6">
      <ToastContainer position="top-right" autoClose={5000} />
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="bg-white rounded-xl shadow-md border border-gray-100 p-6"
      >
        <div className="flex items-center gap-2 mb-6">
          <div className="bg-indigo-100 p-2 rounded-lg">
            <FiHash className="h-5 w-5 text-indigo-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900">Generate Token</h2>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Customer Name</label>
              <div className="relative">
                <FiUser className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  name="customerName"
                  value={formData.customerName}
                  onChange={handleInputChange}
                  className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Enter customer name"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
              <div className="relative">
                <FiPhone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Enter phone number"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Centre ID</label>
              <input
                type="text"
                name="centreId"
                value={formData.centreId}
                onChange={handleInputChange}
                className="px-4 py-2 w-full border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Enter centre ID"
                disabled={userRole !== 'superadmin'}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Service Category</label>
              <div className="relative">
                <FiChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <select
                  name="category"
                  value={formData.category}
                  onChange={handleInputChange}
                  className="px-4 py-2 w-full border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none"
                >
                  <option value="">Select category</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Subcategory</label>
              <div className="relative">
                <FiChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <select
                  name="subcategory"
                  value={formData.subcategory}
                  onChange={handleInputChange}
                  className="px-4 py-2 w-full border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none"
                  disabled={!formData.category}
                >
                  <option value="">Select subcategory</option>
                  {filteredSubcategories.map(sub => (
                    <option key={sub.id} value={sub.id}>{sub.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Campaign (Optional)</label>
              <div className="relative">
                <FiChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <select
                  name="campaign"
                  value={formData.campaign}
                  onChange={handleInputChange}
                  className="px-4 py-2 w-full border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none"
                >
                  <option value="">Select campaign</option>
                  {campaigns.map(cmp => (
                    <option key={cmp.id} value={cmp.id}>{cmp.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 flex items-center gap-2"
            >
              <FiPlus className="h-5 w-5" />
              Generate Token
            </button>
          </div>
        </form>
      </motion.div>

      <div className="mt-8 bg-white rounded-xl shadow-md border border-gray-100 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-5">Recent Tokens</h3>
        {tokens.length === 0 ? (
          <div className="bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl p-8 text-center">
            <FiHash className="mx-auto h-12 w-12 text-gray-400 mb-3" />
            <p className="text-gray-600 font-medium">No tokens found</p>
            <p className="text-gray-500 text-sm mt-1">Generated tokens will appear here</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Token ID</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Centre</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Service</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Campaign</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created At</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {tokens.map(token => (
                  <tr key={token.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{token.tokenId}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div className="font-medium">{token.customerName}</div>
                      <div className="text-gray-500">{token.phone}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{token.centreName}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      <div className="font-medium">{getCategoryName(token.categoryId)}</div>
                      <div className="text-gray-500">{getSubcategoryName(token.categoryId, token.subcategoryId)}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{getCampaignName(token.campaignId)}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2.5 py-1 text-xs font-medium rounded-full ${
                          token.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                          token.status === 'processed' ? 'bg-green-100 text-green-800' :
                          'bg-red-100 text-red-800'
                        }`}
                      >
                        {token.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(token.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default TokenGenerator;
