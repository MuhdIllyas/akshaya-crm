import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FiAward, 
  FiUser, 
  FiPhone, 
  FiClock, 
  FiChevronRight, 
  FiChevronDown,
  FiEye,
  FiCheckCircle,
  FiClock as FiPending,
  FiXCircle,
  FiLoader,
  FiCalendar,
  FiFileText,
  FiTrendingUp
} from 'react-icons/fi';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

const getToken = () => localStorage.getItem('token');

const CampaignTokenManagementStaff = () => {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedCampaigns, setExpandedCampaigns] = useState(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const navigate = useNavigate();

  useEffect(() => {
    fetchCampaignTokens();
  }, []);

  const fetchCampaignTokens = async () => {
    setLoading(true);
    try {
      const token = getToken();
      const response = await axios.get(`${API_BASE_URL}/servicemanagement/staff/campaign-tokens`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCampaigns(response.data.campaigns || []);
      
      // Auto-expand campaigns that have tokens
      const newExpanded = new Set();
      response.data.campaigns.forEach(campaign => {
        if (campaign.tokens && campaign.tokens.length > 0) {
          newExpanded.add(campaign.campaign_id);
        }
      });
      setExpandedCampaigns(newExpanded);
    } catch (err) {
      console.error('Error fetching campaign tokens:', err);
      toast.error('Failed to load campaign tokens: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  const toggleCampaign = (campaignId) => {
    setExpandedCampaigns(prev => {
      const newSet = new Set(prev);
      if (newSet.has(campaignId)) {
        newSet.delete(campaignId);
      } else {
        newSet.add(campaignId);
      }
      return newSet;
    });
  };

  const expandAll = () => {
    const allIds = new Set(campaigns.map(c => c.campaign_id));
    setExpandedCampaigns(allIds);
  };

  const collapseAll = () => {
    setExpandedCampaigns(new Set());
  };

  const handleViewTracking = (trackingId, tokenCode) => {
    if (trackingId) {
      navigate(`/servicetracking/${trackingId}`);
    } else if (tokenCode) {
      // If no tracking yet, go to token details or show message
      toast.info(`No service entry created yet for token ${tokenCode}. Please create service entry first.`);
    } else {
      toast.info('Service tracking not available yet.');
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      pending: 'bg-yellow-100 text-yellow-800',
      processed: 'bg-green-100 text-green-800',
      completed: 'bg-blue-100 text-blue-800',
      cancelled: 'bg-red-100 text-red-800',
      'in-progress': 'bg-indigo-100 text-indigo-800',
      'in_progress': 'bg-indigo-100 text-indigo-800'
    };
    const icons = {
      pending: <FiPending className="h-3 w-3 mr-1" />,
      processed: <FiCheckCircle className="h-3 w-3 mr-1" />,
      completed: <FiCheckCircle className="h-3 w-3 mr-1" />,
      cancelled: <FiXCircle className="h-3 w-3 mr-1" />,
      'in-progress': <FiLoader className="h-3 w-3 mr-1" />
    };
    return (
      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${styles[status] || 'bg-gray-100 text-gray-800'}`}>
        {icons[status] || null}
        {status?.replace('_', ' ') || 'Unknown'}
      </span>
    );
  };

  const getProgressColor = (progress) => {
    if (progress >= 75) return 'bg-green-500';
    if (progress >= 50) return 'bg-blue-500';
    if (progress >= 25) return 'bg-yellow-500';
    return 'bg-gray-300';
  };

  const isCampaignActive = (startDate, endDate) => {
    const now = new Date();
    const start = new Date(startDate);
    const end = new Date(endDate);
    return now >= start && now <= end;
  };

  // Filter tokens across all campaigns
  const filteredCampaigns = campaigns.map(campaign => ({
    ...campaign,
    tokens: campaign.tokens.filter(token => {
      const matchesSearch = 
        token.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        token.token_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        token.phone?.includes(searchTerm);
      const matchesStatus = statusFilter === 'all' || token.token_status === statusFilter;
      return matchesSearch && matchesStatus;
    })
  })).filter(campaign => campaign.tokens.length > 0);

  const totalTokens = campaigns.reduce((sum, c) => sum + c.tokens.length, 0);
  const completedTokens = campaigns.reduce((sum, c) => 
    sum + c.tokens.filter(t => t.token_status === 'completed' || t.service_status === 'completed').length, 0);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading campaign tokens...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-2xl shadow-lg">
              <FiAward className="h-7 w-7 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Campaign Token Management</h1>
              <p className="text-gray-600 mt-1">Track and manage campaign service requests</p>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-5 mb-8">
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Campaign Tokens</p>
                <p className="text-2xl font-bold text-gray-900">{totalTokens}</p>
              </div>
              <div className="p-3 bg-purple-100 rounded-xl">
                <FiAward className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </div>
          
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Active Campaigns</p>
                <p className="text-2xl font-bold text-gray-900">
                  {campaigns.filter(c => isCampaignActive(c.campaign_start, c.campaign_end)).length}
                </p>
              </div>
              <div className="p-3 bg-green-100 rounded-xl">
                <FiTrendingUp className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </div>
          
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Completed Services</p>
                <p className="text-2xl font-bold text-gray-900">{completedTokens}</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-xl">
                <FiCheckCircle className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </div>
          
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Campaigns</p>
                <p className="text-2xl font-bold text-gray-900">{campaigns.length}</p>
              </div>
              <div className="p-3 bg-indigo-100 rounded-xl">
                <FiFileText className="h-6 w-6 text-indigo-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  statusFilter === 'all' 
                    ? 'bg-indigo-600 text-white shadow-md' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                All Tokens
              </button>
              <button
                onClick={() => setStatusFilter('pending')}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  statusFilter === 'pending' 
                    ? 'bg-yellow-500 text-white shadow-md' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Pending
              </button>
              <button
                onClick={() => setStatusFilter('processed')}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  statusFilter === 'processed' 
                    ? 'bg-green-600 text-white shadow-md' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Processed
              </button>
              <button
                onClick={() => setStatusFilter('completed')}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  statusFilter === 'completed' 
                    ? 'bg-blue-600 text-white shadow-md' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Completed
              </button>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={expandAll}
                className="px-4 py-2 text-sm font-medium text-indigo-600 bg-indigo-50 rounded-xl hover:bg-indigo-100 transition-all"
              >
                Expand All
              </button>
              <button
                onClick={collapseAll}
                className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-all"
              >
                Collapse All
              </button>
            </div>
          </div>
          
          {/* Search Bar */}
          <div className="mt-4">
            <div className="relative">
              <input
                type="text"
                placeholder="Search by customer name, token ID, or phone..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Campaign List */}
        {filteredCampaigns.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
            <FiAward className="mx-auto h-16 w-16 text-gray-300" />
            <h3 className="mt-4 text-lg font-medium text-gray-900">No campaign tokens found</h3>
            <p className="mt-2 text-gray-500">
              {searchTerm || statusFilter !== 'all' 
                ? 'Try adjusting your search or filters'
                : 'No campaign tokens have been created yet for your centre'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <AnimatePresence>
              {filteredCampaigns.map((campaign) => (
                <motion.div
                  key={campaign.campaign_id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
                >
                  {/* Campaign Header */}
                  <button
                    onClick={() => toggleCampaign(campaign.campaign_id)}
                    className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`p-2 rounded-xl ${
                        isCampaignActive(campaign.campaign_start, campaign.campaign_end)
                          ? 'bg-green-100'
                          : 'bg-gray-100'
                      }`}>
                        <FiAward className={`h-5 w-5 ${
                          isCampaignActive(campaign.campaign_start, campaign.campaign_end)
                            ? 'text-green-600'
                            : 'text-gray-500'
                        }`} />
                      </div>
                      <div className="text-left">
                        <h3 className="font-semibold text-gray-900">{campaign.campaign_name}</h3>
                        <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                          <span className="flex items-center">
                            <FiCalendar className="h-3 w-3 mr-1" />
                            {new Date(campaign.campaign_start).toLocaleDateString()} - {new Date(campaign.campaign_end).toLocaleDateString()}
                          </span>
                          <span className="flex items-center">
                            <FiFileText className="h-3 w-3 mr-1" />
                            {campaign.tokens.length} tokens
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {!isCampaignActive(campaign.campaign_start, campaign.campaign_end) && (
                        <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded-full">Expired</span>
                      )}
                      {expandedCampaigns.has(campaign.campaign_id) ? (
                        <FiChevronDown className="h-5 w-5 text-gray-400" />
                      ) : (
                        <FiChevronRight className="h-5 w-5 text-gray-400" />
                      )}
                    </div>
                  </button>

                  {/* Tokens Table */}
                  <AnimatePresence>
                    {expandedCampaigns.has(campaign.campaign_id) && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className="border-t border-gray-100"
                      >
                        <div className="overflow-x-auto">
                          <table className="w-full">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="py-3 px-6 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  Token ID
                                </th>
                                <th className="py-3 px-6 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  Customer
                                </th>
                                <th className="py-3 px-6 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  Service
                                </th>
                                <th className="py-3 px-6 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  Status
                                </th>
                                <th className="py-3 px-6 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  Progress
                                </th>
                                <th className="py-3 px-6 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  Created
                                </th>
                                <th className="py-3 px-6 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  Actions
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                              {campaign.tokens.map((token) => (
                                <tr key={token.token_id} className="hover:bg-gray-50 transition-colors">
                                  <td className="py-4 px-6">
                                    <span className="font-mono text-sm font-medium text-gray-900">
                                      {token.token_code}
                                    </span>
                                  </td>
                                  <td className="py-4 px-6">
                                    <div className="flex items-center">
                                      <div className="p-1.5 bg-gray-100 rounded-lg">
                                        <FiUser className="h-4 w-4 text-gray-500" />
                                      </div>
                                      <div className="ml-3">
                                        <div className="font-medium text-gray-900">{token.customer_name}</div>
                                        <div className="text-sm text-gray-500 flex items-center mt-0.5">
                                          <FiPhone className="h-3 w-3 mr-1" />
                                          {token.phone}
                                        </div>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="py-4 px-6">
                                    <div>
                                      <div className="text-sm text-gray-900">{token.service_name || '—'}</div>
                                      <div className="text-xs text-gray-500">{token.subcategory_name || '—'}</div>
                                    </div>
                                    {token.application_number && (
                                      <div className="text-xs text-gray-400 mt-1">
                                        App: {token.application_number}
                                      </div>
                                    )}
                                  </td>
                                  <td className="py-4 px-6">
                                    {getStatusBadge(token.service_status || token.token_status)}
                                  </td>
                                  <td className="py-4 px-6">
                                    {token.progress !== undefined && token.progress !== null ? (
                                      <div className="w-32">
                                        <div className="flex justify-between text-xs text-gray-500 mb-1">
                                          <span>{token.progress}%</span>
                                        </div>
                                        <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                          <div 
                                            className={`h-full rounded-full ${getProgressColor(token.progress)}`}
                                            style={{ width: `${token.progress}%` }}
                                          />
                                        </div>
                                      </div>
                                    ) : (
                                      <span className="text-sm text-gray-400">Not started</span>
                                    )}
                                  </td>
                                  <td className="py-4 px-6">
                                    <div className="text-sm text-gray-600">
                                      {new Date(token.token_created_at).toLocaleDateString()}
                                    </div>
                                    {token.last_updated && (
                                      <div className="text-xs text-gray-400 flex items-center mt-1">
                                        <FiClock className="h-3 w-3 mr-1" />
                                        {new Date(token.last_updated).toLocaleDateString()}
                                      </div>
                                    )}
                                  </td>
                                  <td className="py-4 px-6">
                                    <button
                                      onClick={() => handleViewTracking(token.tracking_id, token.token_code)}
                                      className="inline-flex items-center px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg text-sm font-medium hover:bg-indigo-100 transition-all"
                                    >
                                      <FiEye className="h-4 w-4 mr-1" />
                                      View Service
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
};

export default CampaignTokenManagementStaff;