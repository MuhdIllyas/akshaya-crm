import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FiPlus, FiCalendar, FiTarget, FiCheckCircle, FiTrendingUp, FiEdit2, FiX, FiRefreshCw } from 'react-icons/fi';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useNavigate } from 'react-router-dom';
import { getServices, getCampaigns, createCampaign, updateCampaign, deleteCampaign } from '/src/services/serviceService';

const CampaignManagement = ({ centreId: propCentreId }) => {
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState([]);
  const [services, setServices] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    serviceId: '',
    startDate: '',
    endDate: '',
    targetTokens: ''
  });
  const [loading, setLoading] = useState(false);
  const [servicesLoading, setServicesLoading] = useState(false);
  const [servicesError, setServicesError] = useState(null);
  const centreId = propCentreId || localStorage.getItem('centre_id');
  const userRole = localStorage.getItem('role');
  const token = localStorage.getItem('token');

  useEffect(() => {
    console.log('CampaignManagement.jsx: Initial values:', { token, userRole, centreId });
    if (!token) {
      toast.error('No authentication token found. Please log in.');
      navigate('/login');
      return;
    }
    if (!['admin', 'superadmin'].includes(userRole)) {
      toast.error('Access denied. Admins and superadmins only.');
      navigate('/login');
      return;
    }
    if (!centreId) {
      toast.error('Centre ID is missing. Please log in again.');
      navigate('/login');
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      setServicesLoading(true);
      try {
        const servicesRes = await getServices();
        console.log('CampaignManagement.jsx: Services fetched:', servicesRes.data);
        if (!servicesRes.data || servicesRes.data.length === 0) {
          setServicesError('No services found in the database. Contact superadmin to add services.');
        } else {
          setServices(servicesRes.data);
          setServicesError(null);
        }

        const campaignsRes = await getCampaigns(centreId);
        console.log('CampaignManagement.jsx: Campaigns fetched:', campaignsRes.data);
        setCampaigns(campaignsRes.data || []);
      } catch (err) {
        console.error('CampaignManagement.jsx: Error fetching data:', err);
        const errorMessage = err.response?.status === 401
          ? 'Session expired. Please log in again.'
          : err.response?.data?.error || 'Failed to load data. Please try again.';
        setServicesError(errorMessage);
        toast.error(errorMessage);
        if (err.response?.status === 401) {
          localStorage.removeItem('token');
          localStorage.removeItem('role');
          localStorage.removeItem('centre_id');
          navigate('/login');
        }
      } finally {
        setLoading(false);
        setServicesLoading(false);
      }
    };

    console.log('CampaignManagement.jsx: Fetching data for centreId:', centreId);
    fetchData();
  }, [centreId, navigate, userRole, token]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleCreateOrUpdateCampaign = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.serviceId || !formData.startDate || !formData.endDate || !formData.targetTokens) {
      toast.error('Please fill all required fields');
      return;
    }
    if (new Date(formData.endDate) < new Date(formData.startDate)) {
      toast.error('End date must be on or after start date');
      return;
    }
    if (parseInt(formData.targetTokens) < 0) {
      toast.error('Target tokens must be a non-negative number');
      return;
    }

    const campaignData = {
      name: formData.name,
      description: formData.description,
      service_id: parseInt(formData.serviceId),
      start_date: formData.startDate,
      end_date: formData.endDate,
      centre_id: parseInt(centreId),
      target_tokens: parseInt(formData.targetTokens)
    };

    console.log('CampaignManagement.jsx: Submitting campaign:', campaignData);
    try {
      setLoading(true);
      if (isEditing) {
        await updateCampaign(selectedCampaign.id, campaignData);
        toast.success('Campaign updated successfully');
        setCampaigns(campaigns.map(c => (c.id === selectedCampaign.id ? { 
          ...c, 
          ...campaignData, 
          service_name: services.find(s => s.id === parseInt(formData.serviceId))?.name,
          startDate: campaignData.start_date,
          endDate: campaignData.end_date,
          target_tokens: campaignData.target_tokens
        } : c)));
      } else {
        const res = await createCampaign(campaignData);
        toast.success('Campaign created successfully');
        setCampaigns([...campaigns, { 
          ...campaignData, 
          id: res.data.id, 
          service_name: services.find(s => s.id === parseInt(formData.serviceId))?.name,
          startDate: campaignData.start_date,
          endDate: campaignData.end_date,
          target_tokens: campaignData.target_tokens
        }]);
      }
      resetForm();
    } catch (err) {
      console.error('CampaignManagement.jsx: Error saving campaign:', err);
      const errorMessage = err.response?.status === 401
        ? 'Session expired. Please log in again.'
        : err.response?.data?.error || 'Failed to save campaign. Please try again.';
      toast.error(errorMessage);
      if (err.response?.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('role');
        localStorage.removeItem('centre_id');
        navigate('/login');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEditCampaign = (campaign) => {
    setIsEditing(true);
    setSelectedCampaign(campaign);
    setFormData({
      name: campaign.name,
      description: campaign.description || '',
      serviceId: String(campaign.service_id || campaign.serviceId),
      startDate: campaign.start_date || campaign.startDate,
      endDate: campaign.end_date || campaign.endDate,
      targetTokens: String(campaign.target_tokens || 0)
    });
    setShowModal(true);
  };

  const handleDeleteCampaign = async (campaignId) => {
    if (!window.confirm('Are you sure you want to delete this campaign?')) return;
    console.log('CampaignManagement.jsx: Deleting campaign:', campaignId);
    try {
      setLoading(true);
      await deleteCampaign(campaignId);
      toast.success('Campaign deleted successfully');
      setCampaigns(campaigns.filter(c => c.id !== campaignId));
    } catch (err) {
      console.error('CampaignManagement.jsx: Error deleting campaign:', err);
      const errorMessage = err.response?.status === 401
        ? 'Session expired. Please log in again.'
        : err.response?.data?.error || 'Failed to delete campaign. Please try again.';
      toast.error(errorMessage);
      if (err.response?.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('role');
        localStorage.removeItem('centre_id');
        navigate('/login');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRetryFetchServices = async () => {
    setServicesLoading(true);
    setServicesError(null);
    console.log('CampaignManagement.jsx: Retrying services fetch');
    try {
      const servicesRes = await getServices();
      console.log('CampaignManagement.jsx: Services fetched on retry:', servicesRes.data);
      if (!servicesRes.data || servicesRes.data.length === 0) {
        setServicesError('No services found in the database. Contact superadmin to add services.');
      } else {
        setServices(servicesRes.data);
      }
    } catch (err) {
      console.error('CampaignManagement.jsx: Error retrying services fetch:', err);
      const errorMessage = err.response?.status === 401
        ? 'Session expired. Please log in again.'
        : err.response?.data?.error || 'Failed to load services. Please try again.';
      setServicesError(errorMessage);
      toast.error(errorMessage);
      if (err.response?.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('role');
        localStorage.removeItem('centre_id');
        navigate('/login');
      }
    } finally {
      setServicesLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      serviceId: '',
      startDate: '',
      endDate: '',
      targetTokens: ''
    });
    setShowModal(false);
    setIsEditing(false);
    setSelectedCampaign(null);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const getStatus = (startDate, endDate) => {
    const today = new Date();
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (end < today) return 'completed';
    if (start <= today && today <= end) return 'active';
    return 'upcoming';
  };

  const getStatusColor = (status) => {
    if (status === 'completed') return 'bg-purple-100 text-purple-800';
    if (status === 'active') return 'bg-green-100 text-green-800';
    return 'bg-blue-100 text-blue-800';
  };

  const getStatusIcon = (status) => {
    const statusClass = status === 'completed' ? 'bg-purple-500' : 
                       status === 'active' ? 'bg-green-500' : 'bg-blue-500';
    return <div className={`w-2 h-2 rounded-full ${statusClass} mr-2`}></div>;
  };

  const calculateTimelineProgress = (startDate, endDate) => {
    const today = new Date();
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (today >= end) return 100;
    if (today < start) return 0;
    const totalDuration = end - start;
    const elapsed = today - start;
    return Math.min(Math.round((elapsed / totalDuration) * 100), 100);
  };

  const calculateTokenProgress = (tokensGenerated, targetTokens) => {
    if (!targetTokens || targetTokens <= 0) return 0;
    return Math.min(Math.round((tokensGenerated / targetTokens) * 100), 100);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-indigo-50 p-4 sm:p-6">
      <ToastContainer />
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-800">Campaign Management</h1>
            <p className="text-gray-600 mt-1">Create and manage service campaigns for your centre</p>
          </div>
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => { setIsEditing(false); setShowModal(true); }}
            className="mt-4 md:mt-0 bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-4 py-2.5 rounded-xl flex items-center transition-all duration-300 shadow-md hover:shadow-lg"
            disabled={loading || servicesLoading || servicesError}
          >
            <FiPlus className="mr-2" />
            Create Campaign
          </motion.button>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
          <div className="bg-white rounded-2xl shadow-sm p-5 border border-gray-100">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-gray-600">Total Campaigns</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{campaigns.length}</p>
              </div>
              <div className="bg-indigo-100 p-3 rounded-xl">
                <FiTarget className="text-indigo-600 text-xl" />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-2xl shadow-sm p-5 border border-gray-100">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-gray-600">Active Campaigns</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {campaigns.filter(c => getStatus(c.start_date || c.startDate, c.end_date || c.endDate) === 'active').length}
                </p>
              </div>
              <div className="bg-green-100 p-3 rounded-xl">
                <FiTrendingUp className="text-green-600 text-xl" />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-2xl shadow-sm p-5 border border-gray-100">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-gray-600">Total Tokens Generated</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {campaigns.reduce((sum, campaign) => sum + (campaign.tokens_generated || campaign.tokenCount || 0), 0)}
                </p>
              </div>
              <div className="bg-amber-100 p-3 rounded-xl">
                <FiCheckCircle className="text-amber-600 text-xl" />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-2xl shadow-sm p-5 border border-gray-100">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-gray-600">Completed Campaigns</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {campaigns.filter(c => getStatus(c.start_date || c.startDate, c.end_date || c.endDate) === 'completed').length}
                </p>
              </div>
              <div className="bg-purple-100 p-3 rounded-xl">
                <FiCheckCircle className="text-purple-600 text-xl" />
              </div>
            </div>
          </div>
        </div>

        {/* Campaigns Grid */}
        {campaigns.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm p-8 text-center">
            <FiTarget className="mx-auto text-4xl text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-700">No campaigns found</h3>
            <p className="text-gray-500 mt-1">This centre doesn't have any campaigns yet.</p>
            <button 
              onClick={() => setShowModal(true)} 
              className="mt-4 text-indigo-600 hover:text-indigo-800 font-medium"
              disabled={servicesLoading || servicesError}
            >
              Create your first campaign
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {campaigns.map((campaign) => {
              const status = getStatus(campaign.start_date || campaign.startDate, campaign.end_date || campaign.endDate);
              const timelineProgress = calculateTimelineProgress(campaign.start_date || campaign.startDate, campaign.end_date || campaign.endDate);
              const tokenProgress = calculateTokenProgress(campaign.tokens_generated || campaign.tokenCount || 0, campaign.target_tokens || 0);
              return (
                <div key={campaign.id} className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-100 transition-all hover:shadow-md">
                  <div className="p-5">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center">
                          <div className="bg-indigo-100 text-indigo-800 p-2 rounded-lg mr-3">
                            <FiTarget />
                          </div>
                          <div>
                            <h3 className="font-bold text-gray-900">{campaign.name}</h3>
                            <div className={`mt-1 inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(status)}`}>
                              {getStatusIcon(status)}
                              {status.charAt(0).toUpperCase() + status.slice(1)}
                            </div>
                          </div>
                        </div>
                        <p className="text-gray-600 text-sm mt-3">{campaign.description || 'No description provided'}</p>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => handleEditCampaign(campaign)} className="text-gray-400 hover:text-indigo-600">
                          <FiEdit2 />
                        </button>
                        <button onClick={() => handleDeleteCampaign(campaign.id)} className="text-gray-400 hover:text-red-600">
                          <FiX />
                        </button>
                      </div>
                    </div>
                    <div className="mt-5 flex items-center justify-between">
                      <div className="flex items-center">
                        <FiCalendar className="text-gray-500 mr-2" />
                        <span className="text-sm text-gray-600">{formatDate(campaign.start_date || campaign.startDate)} - {formatDate(campaign.end_date || campaign.endDate)}</span>
                      </div>
                      <div className="flex items-center">
                        <FiCheckCircle className="text-gray-500 mr-2" />
                        <span className="text-sm text-gray-600">{campaign.service_name || campaign.serviceName}</span>
                      </div>
                    </div>
                    <div className="mt-5 grid grid-cols-1 gap-3">
                      <div className="bg-gray-50 p-4 rounded-xl">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs text-gray-500">Timeline Progress</p>
                            <p className="text-sm font-medium">{timelineProgress}%</p>
                          </div>
                          <div className="w-2/3">
                            <div className="bg-gray-200 rounded-full h-2.5">
                              <div 
                                className={`h-2.5 rounded-full ${status === 'completed' ? 'bg-purple-500' : status === 'active' ? 'bg-green-500' : 'bg-blue-500'}`} 
                                style={{ width: `${timelineProgress}%` }}
                              ></div>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="bg-gray-50 p-4 rounded-xl">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs text-gray-600">Token Progress</p>
                            <p className="text-sm font-medium">{campaign.tokens_generated || campaign.tokenCount || 0}/{campaign.target_tokens || 0} ({tokenProgress}%)</p>
                          </div>
                          <div className="w-2/3">
                            <div className="bg-gray-200 rounded-full h-2.5">
                              <div 
                                className="h-2.5 rounded-full bg-blue-500" 
                                style={{ width: `${tokenProgress}%` }}
                              ></div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Create/Edit Campaign Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl border border-gray-200"
            >
              <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-6 sticky top-0">
                <h2 className="text-xl font-bold text-white">{isEditing ? 'Edit Campaign' : 'Create New Campaign'}</h2>
              </div>
              <form onSubmit={handleCreateOrUpdateCampaign} className="p-6">
                <div className="space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Campaign Name *</label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      placeholder="e.g., Summer Promotion 2023"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                    <textarea
                      name="description"
                      value={formData.description}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      placeholder="Describe the campaign goals..."
                      rows={3}
                    ></textarea>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Service *</label>
                    {servicesLoading ? (
                      <p className="text-sm text-gray-500">Loading services...</p>
                    ) : servicesError ? (
                      <div className="text-sm text-red-500">
                        {servicesError}
                        <button
                          type="button"
                          onClick={handleRetryFetchServices}
                          className="ml-2 text-indigo-600 hover:text-indigo-800 flex items-center"
                        >
                          <FiRefreshCw className={`mr-1 ${servicesLoading ? 'animate-spin' : ''}`} />
                          Retry
                        </button>
                      </div>
                    ) : services.length === 0 ? (
                      <p className="text-sm text-red-500">No services available. Contact superadmin to add services.</p>
                    ) : (
                      <select
                        name="serviceId"
                        value={formData.serviceId}
                        onChange={handleInputChange}
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        required
                      >
                        <option value="">Select a service</option>
                        {services.map(service => (
                          <option key={service.id} value={service.id}>
                            {service.name}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Start Date *</label>
                      <input
                        type="date"
                        name="startDate"
                        value={formData.startDate}
                        onChange={handleInputChange}
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">End Date *</label>
                      <input
                        type="date"
                        name="endDate"
                        value={formData.endDate}
                        onChange={handleInputChange}
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Target Tokens *</label>
                    <input
                      type="number"
                      name="targetTokens"
                      value={formData.targetTokens}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      placeholder="e.g., 100"
                      min="0"
                      required
                    />
                  </div>
                </div>
                <div className="mt-8 flex justify-end gap-3 border-t border-gray-200 pt-5">
                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.98 }}
                    type="button"
                    onClick={resetForm}
                    className="px-5 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors font-medium"
                    disabled={loading}
                  >
                    Cancel
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.98 }}
                    type="submit"
                    className="px-5 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors font-medium"
                    disabled={loading || servicesLoading || servicesError}
                  >
                    {loading ? 'Saving...' : isEditing ? 'Update Campaign' : 'Create Campaign'}
                  </motion.button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CampaignManagement;